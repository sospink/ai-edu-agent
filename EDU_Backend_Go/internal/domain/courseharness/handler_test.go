package courseharness

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"edu-platform/internal/config"
	"edu-platform/internal/domain/llm"
	"go.uber.org/zap"
)

func proxyFixture(t *testing.T) (*Handler, *gin.Engine, Instance) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { sqlDB.Close() })
	for _, sql := range []string{"CREATE TABLE sys_users(id integer,status integer)", "INSERT INTO sys_users VALUES(1,1)", "CREATE TABLE courses(id integer,status integer)", "INSERT INTO courses VALUES(7,1)", "CREATE TABLE course_lessons(id integer,course_id integer)", "INSERT INTO course_lessons VALUES(8,7)"} {
		if err = db.Exec(sql).Error; err != nil {
			t.Fatal(err)
		}
	}
	s := Instance{ID: strings.Repeat("a", 32), UserID: 1, LessonID: 8, AccessKey: "private-cookie", ModelKey: "private-model", LaunchKey: "upstream-launch", ExpiresAt: time.Now().Add(time.Hour)}
	h := &Handler{db: db, root: t.TempDir(), origin: "http://edu.test", instances: map[string]Instance{s.ID: s}, tickets: map[string]ticket{}, budgets: map[string]*budget{}}
	r := gin.New()
	r.Any("/api/course-harness/proxy/:id/*path", h.Proxy)
	r.GET("/api/course-harness/model/:id/v1/models", h.Models)
	return h, r, s
}
func TestProxyIsolationAndOrigin(t *testing.T) {
	h, r, s := proxyFixture(t)
	path := "/api/course-harness/proxy/" + s.ID + "/"
	for _, test := range []struct {
		name, cookie, origin string
		status               int
	}{
		{"missing", "", "", 401}, {"wrong", "other-student", "", 401}, {"cross-site", s.AccessKey, "https://other.test", 403},
	} {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", path, nil)
			req.AddCookie(&http.Cookie{Name: "edu_harness", Value: test.cookie})
			req.Header.Set("Origin", test.origin)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			if w.Code != test.status {
				t.Fatalf("got %d", w.Code)
			}
		})
	}
	s.ExpiresAt = time.Now().Add(-time.Second)
	h.instances[s.ID] = s
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
	if w.Code != 410 {
		t.Fatal(w.Code)
	}
}
func TestBootstrapAndCookieScope(t *testing.T) {
	h, r, s := proxyFixture(t)
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Query().Get("token") != s.LaunchKey || req.URL.Query().Has("ticket") {
			t.Error("launch exchange not isolated")
		}
		if req.Host != "edu.test" || req.Header.Get("Authorization") != "" {
			t.Error("wrong upstream authority/credentials")
		}
		if req.Header.Get("Cookie") != "" {
			t.Error("platform cookies leaked")
		}
		http.SetCookie(w, &http.Cookie{Name: "dsh-auth-test", Value: "upstream", Path: "/", HttpOnly: true})
		w.Header().Set("Location", "/")
		w.WriteHeader(302)
	}))
	defer up.Close()
	u, _ := url.Parse(up.URL)
	s.Address = u.Host
	h.instances[s.ID] = s
	h.tickets["one-time"] = ticket{Instance: s.ID, ExpiresAt: time.Now().Add(time.Minute), AccessKey: s.AccessKey}
	path := "/api/course-harness/proxy/" + s.ID + "/"
	req := httptest.NewRequest("GET", path+"?ticket=one-time", nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	req = req.WithContext(ctx)
	req.Header.Set("Authorization", "Bearer platform-private")
	req.AddCookie(&http.Cookie{Name: "platform", Value: "secret"})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != 302 || w.Header().Get("Location") != path {
		t.Fatalf("%d %s", w.Code, w.Header().Get("Location"))
	}
	for _, ck := range w.Result().Cookies() {
		if ck.Path != path || !ck.HttpOnly {
			t.Errorf("bad cookie scope: %s", ck.Name)
		}
	}
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", path+"?ticket=one-time", nil))
	if w.Code != 401 {
		t.Fatal("ticket replay accepted")
	}
}
func TestPublishedAndAccountRevocation(t *testing.T) {
	h, r, s := proxyFixture(t)
	h.db.Exec("UPDATE courses SET status=0")
	if h.allowed(context.Background(), s) {
		t.Fatal("unpublished course admitted")
	}
	h.db.Exec("UPDATE courses SET status=1")
	h.db.Exec("UPDATE sys_users SET status=0")
	if h.allowed(context.Background(), s) {
		t.Fatal("disabled user admitted")
	}
	req := httptest.NewRequest("GET", "/api/course-harness/model/"+s.ID+"/v1/models", nil)
	req.Header.Set("Authorization", "Bearer "+s.ModelKey)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != 401 {
		t.Fatal(w.Code)
	}
}

func TestTicketCannotCrossLoginGeneration(t *testing.T) {
	h, r, s := proxyFixture(t)
	h.tickets["old-login"] = ticket{Instance: s.ID, ExpiresAt: time.Now().Add(time.Minute), AccessKey: s.AccessKey}
	s.AccessKey = "rotated-cookie"
	h.instances[s.ID] = s
	req := httptest.NewRequest("GET", "/api/course-harness/proxy/"+s.ID+"/?ticket=old-login", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != 401 {
		t.Fatal("old login ticket survived credential rotation")
	}
}

func TestOriginalPluginBatchQueryIsPreserved(t *testing.T) {
	h, r, s := proxyFixture(t)
	raw := "?@deepseek-ai/plugin/client.js,@deepseek-ai/other/client.js&rev=abc"
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path != "/plugins/" || req.URL.RawQuery != raw {
			t.Errorf("batch URL changed: %s", req.URL.String())
		}
		w.Write([]byte("original bundle"))
	}))
	defer up.Close()
	u, _ := url.Parse(up.URL)
	s.Address = u.Host
	h.instances[s.ID] = s
	req := httptest.NewRequest("GET", "/api/course-harness/proxy/"+s.ID+"/plugins/?"+raw, nil)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	req = req.WithContext(ctx)
	req.AddCookie(&http.Cookie{Name: "edu_harness", Value: s.AccessKey})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != 200 {
		t.Fatal(w.Code)
	}
}
func TestMaterialTraversalAndSymlink(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	os.WriteFile(filepath.Join(root, "course.md"), []byte("course"), 0600)
	os.WriteFile(filepath.Join(outside, "secret"), []byte("secret"), 0600)
	os.Symlink(filepath.Join(outside, "secret"), filepath.Join(root, "link.md"))
	if _, err := materialPath(root, "/uploads/course.md"); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/uploads/link.md", "/uploads/../secret", "https://else.test/private", "file:///etc/passwd"} {
		if _, err := materialPath(root, path); err == nil {
			t.Fatal("unsafe material:", path)
		}
	}
}
func TestBudgetAndPrivatePersistence(t *testing.T) {
	h, _, s := proxyFixture(t)
	release, ok := h.modelBudget(s.ID)
	if !ok {
		t.Fatal("first request rejected")
	}
	if _, ok = h.modelBudget(s.ID); ok {
		t.Fatal("concurrent request admitted")
	}
	release()
	if err := h.saveLocked(); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(filepath.Join(h.root, "instances.json"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0600 {
		t.Fatal("instance credentials readable by others")
	}
	if same("", "") || same("wrong", s.AccessKey) {
		t.Fatal("invalid credentials match")
	}
}

func TestOpenConnectionRevocation(t *testing.T) {
	h, _, s := proxyFixture(t)
	var revoked atomic.Bool
	h.tokenValid = func(context.Context, string) bool { return !revoked.Load() }
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go h.watchAuthorization(ctx, cancel, s.ID, s.AccessKey, 5*time.Millisecond)
	revoked.Store(true)
	select {
	case <-ctx.Done():
	case <-time.After(time.Second):
		t.Fatal("revoked session remained connected")
	}
}

func TestModelGatewayRewritesAliasAndKeepsProviderSecretServerSide(t *testing.T) {
	h, r, s := proxyFixture(t)
	h.db.Exec("CREATE TABLE ai_feature_settings(id integer,enabled boolean)")
	h.db.Exec("INSERT INTO ai_feature_settings VALUES(1,true)")
	h.logger = zap.NewNop()
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.Header.Get("Authorization") != "Bearer provider-test-secret" {
			t.Error("provider credential missing")
		}
		var body map[string]any
		json.NewDecoder(req.Body).Decode(&body)
		if body["model"] != "configured-model" || body["max_tokens"] != float64(4096) {
			t.Error("model/output budget not enforced")
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"ok"}}]}`))
	}))
	defer up.Close()
	h.client = up.Client()
	h.models = llm.NewStore(t.TempDir(), config.QwenConfig{BaseURL: up.URL, APIKey: "provider-test-secret", Model: "configured-model"})
	r.POST("/api/course-harness/model/:id/v1/chat/completions", h.Chat)
	req := httptest.NewRequest("POST", "/api/course-harness/model/"+s.ID+"/v1/chat/completions", strings.NewReader(`{"model":"course-assistant","messages":[{"role":"user","content":"hello"}],"max_tokens":9999}`))
	req.Header.Set("Authorization", "Bearer "+s.ModelKey)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != 200 || strings.Contains(w.Body.String(), "provider-test-secret") {
		t.Fatalf("unexpected response %d", w.Code)
	}
}
