package lab

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"edu-platform/internal/config"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/llm"
	"edu-platform/internal/domain/operations"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/publishing"
	"edu-platform/internal/domain/user"
	appjwt "edu-platform/pkg/jwt"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type gatewayTransport func(*http.Request) (*http.Response, error)

func TestProjectWorkbenchGatewayAndDirectory(t *testing.T) {
	g, session, router, token := gatewayFixture(t)
	if err := g.lab.db.AutoMigrate(&project.Project{}); err != nil {
		t.Fatal(err)
	}
	p := project.Project{ID: 91, Slug: PromptWorkbenchSlug, Status: project.ProjectStatusPublished}
	if err := g.lab.db.Create(&p).Error; err != nil {
		t.Fatal(err)
	}
	session.SourceType, session.SourceID = SourceTypeProject, p.ID
	if err := g.lab.db.Save(session).Error; err != nil {
		t.Fatal(err)
	}
	if g.lab.WorkspaceDirectory(session) != PromptWorkbenchDirectory {
		t.Fatal("项目工作目录未绑定")
	}
	if w := gatewayRequest(router, token, "GET", "/models", ""); w.Code != 200 {
		t.Fatalf("项目模型鉴权失败: %d", w.Code)
	}
	g.lab.db.Model(&p).Update("status", project.ProjectStatusArchived)
	if w := gatewayRequest(router, token, "GET", "/models", ""); w.Code != 401 {
		t.Fatal("下架项目仍可调用模型")
	}
	g.lab.db.Model(&p).Updates(map[string]any{"status": 1, "slug": "other"})
	if g.lab.WorkspaceDirectory(session) != "" {
		t.Fatal("普通项目获得专用工作区")
	}
}

func (f gatewayTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func gatewayFixture(t *testing.T) (*CourseModelGateway, *UserLabSession, *gin.Engine, string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "gateway.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err = db.AutoMigrate(&UserLabSession{}, &course.Course{}, &user.User{}, &operations.AuditLog{}); err != nil {
		t.Fatal(err)
	}
	if err = db.Exec("CREATE TABLE ai_feature_settings (id integer PRIMARY KEY, enabled boolean)").Error; err != nil {
		t.Fatal(err)
	}
	if err = db.Exec("INSERT INTO ai_feature_settings VALUES (1, 1)").Error; err != nil {
		t.Fatal(err)
	}
	for _, record := range []any{&course.Course{ID: 1, Slug: PromptWorkbenchSlug, Status: 1}, &user.User{ID: 1, Username: "student", Email: "student@example.com", Status: 1}} {
		if err = db.Create(record).Error; err != nil {
			t.Fatal(err)
		}
	}
	cfg := &config.Config{JWT: config.JWTConfig{Secret: "test-course-secret", Issuer: "test"}, Security: config.SecurityConfig{AllowedOrigins: []string{"https://edu.example.com"}}}
	s := NewService(db, zap.NewNop(), cfg, nil, nil)
	g := NewCourseModelGateway(s, llm.NewStore(t.TempDir(), config.QwenConfig{APIKey: "provider-secret", BaseURL: "https://model.example.com/v1", Model: "actual-model"}))
	expiry := time.Now().Add(time.Hour)
	session := &UserLabSession{ID: 11, UserID: 1, SourceID: 1, SourceType: SourceTypeCourse, Status: SessionStatusRunning, ExpiresAt: &expiry, IDEPort: 3000}
	if err = db.Create(session).Error; err != nil {
		t.Fatal(err)
	}
	token, err := g.token(session)
	if err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	r.GET("/models", g.Models)
	r.POST("/chat/completions", g.Chat)
	return g, session, r, token
}

func gatewayRequest(r *gin.Engine, token, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestCourseGatewayScopesAndRevocation(t *testing.T) {
	g, s, r, token := gatewayFixture(t)
	if w := gatewayRequest(r, token, "GET", "/models", ""); w.Code != 200 || strings.Contains(w.Body.String(), "provider-secret") {
		t.Fatalf("models: %d", w.Code)
	}
	m, _ := appjwt.NewManager(g.lab.cfg.JWT.Secret, "test", "1h")
	regular, _ := m.GenerateToken(1, "student", 1)
	if w := gatewayRequest(r, regular, "GET", "/models", ""); w.Code != 401 {
		t.Fatal("accepted ordinary login token")
	}
	if _, err := m.ParseToken(token); err == nil {
		t.Fatal("course token accepted as login token")
	}
	if w := gatewayRequest(r, "", "GET", "/models", ""); w.Code != 401 {
		t.Fatal("unauthenticated access")
	}
	env, err := g.lab.courseModelEnvironment(s)
	if err != nil || env["EDU_MODEL_TOKEN"] == "" || env["EDU_MODEL_BASE_URL"] != "https://edu.example.com/api/course-model/v1" {
		t.Fatal("runtime configuration invalid", err)
	}
	if url := g.lab.BuildURLs(s).IDEURL; !strings.Contains(url, "%2Fworkspace%2Fprompt-workbench") {
		t.Fatal(url)
	}
	s.AppPorts = []publishing.LabTemplateAppPort{{Name: "workbench", ContainerPort: 8000}}
	target, ok := resolveProxyTarget(s, "app-workbench")
	if !ok {
		t.Fatal("course app target not resolved")
	}
	access, err := g.lab.courseProxyAccessToken(s, target)
	if err != nil || access != token {
		t.Fatalf("app proxy did not receive its session access token: %v", err)
	}
	for _, other := range []string{"workbench", "ide", "novnc"} {
		if access, err := g.lab.courseProxyAccessToken(s, other); err != nil || access != "" {
			t.Fatalf("credential attached to unrelated target %s", other)
		}
	}
	if err = g.lab.db.Model(s).Update("status", SessionStatusStopped).Error; err != nil {
		t.Fatal(err)
	}
	if w := gatewayRequest(r, token, "GET", "/models", ""); w.Code != 401 {
		t.Fatal("stopped session retains gateway access")
	}
}

func TestCourseGatewayPreservesToolsStreamsAndHidesCredential(t *testing.T) {
	g, _, r, token := gatewayFixture(t)
	g.client = &http.Client{Transport: gatewayTransport(func(req *http.Request) (*http.Response, error) {
		if req.Header.Get("Authorization") != "Bearer provider-secret" {
			t.Fatal("upstream credentials incorrect")
		}
		var body map[string]any
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["model"] != "actual-model" || body["tools"] == nil {
			t.Fatal("model or tools lost")
		}
		payload := `{"model":"actual-model","choices":[{"message":{"content":"OK"}}]}`
		if body["stream"] == true {
			payload = "data: {\"choices\":[{\"delta\":{\"content\":\"OK\"}}]}\n\ndata: [DONE]\n\n"
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(payload)), Header: make(http.Header)}, nil
	})}
	for _, stream := range []string{"false", "true"} {
		body := `{"model":"course-model","messages":[{"role":"user","content":"hello"}],"tools":[{"type":"function","function":{"name":"read_file","parameters":{"type":"object"}}}],"stream":` + stream + `}`
		w := gatewayRequest(r, token, "POST", "/chat/completions", body)
		if w.Code != 200 || !strings.HasPrefix(w.Header().Get("X-Request-ID"), "edu-") || bytes.Contains(w.Body.Bytes(), []byte("provider-secret")) {
			t.Fatalf("completion: %d %s", w.Code, w.Body.String())
		}
		if stream == "true" && !strings.Contains(w.Body.String(), "[DONE]") {
			t.Fatal("stream marker lost")
		}
	}
	var count int64
	g.lab.db.Model(&operations.AuditLog{}).Where("action = ?", "course_model_call").Count(&count)
	if count != 2 {
		t.Fatalf("audit count %d", count)
	}
}

func TestCourseGatewayRejectsMisuseAndLimits(t *testing.T) {
	g, s, r, token := gatewayFixture(t)
	for _, body := range []string{`{"messages":[]}`, `{"messages":[{}],"model":"another-model"}`, `{"messages":[{}],"max_tokens":999999}`, `{"messages":[{}],"base_url":"https://evil.example"}`} {
		if w := gatewayRequest(r, token, "POST", "/chat/completions", body); w.Code != 400 {
			t.Fatalf("unexpected status %d", w.Code)
		}
	}
	release, ok := g.acquire(s)
	if !ok {
		t.Fatal("initial budget rejected")
	}
	if _, ok := g.acquire(s); ok {
		t.Fatal("parallel session accepted")
	}
	release()
	g.budgets[s.ID].Total = 400
	if w := gatewayRequest(r, token, "POST", "/chat/completions", `{"messages":[{}]}`); w.Code != 429 {
		t.Fatal("budget not enforced")
	}
}

func TestCourseGatewayExtendsWriteDeadline(t *testing.T) {
	g, _, router, token := gatewayFixture(t)
	g.client = &http.Client{Transport: gatewayTransport(func(r *http.Request) (*http.Response, error) {
		time.Sleep(100 * time.Millisecond)
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"choices":[{"message":{"content":"OK"}}]}`))}, nil
	})}
	server := httptest.NewUnstartedServer(router)
	server.Config.WriteTimeout = 20 * time.Millisecond
	server.Start()
	defer server.Close()
	req, _ := http.NewRequest("POST", server.URL+"/chat/completions", strings.NewReader(`{"messages":[{"role":"user","content":"hello"}]}`))
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := server.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil || resp.StatusCode != 200 || !bytes.Contains(data, []byte("OK")) {
		t.Fatalf("write deadline truncated response: %v %s", err, data)
	}
}

func TestCourseGatewayReportsInterruptedStreamAndStudentExecution(t *testing.T) {
	g, session, router, token := gatewayFixture(t)
	command := g.lab.WorkspaceExecCommand(session, []string{"bash", "-lc", "id"})
	if strings.Join(command, " ") != "/usr/sbin/runuser -u student -- bash -lc id" {
		t.Fatal(command)
	}
	other := *session
	other.SourceID = 999
	if got := g.lab.WorkspaceExecCommand(&other, []string{"bash"}); len(got) != 1 {
		t.Fatal("changed unrelated Lab execution")
	}
	g.client = &http.Client{Transport: gatewayTransport(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("data: {\"choices\":[{\"delta\":{\"content\":\"partial\"}}]}\n\n"))}, nil
	})}
	w := gatewayRequest(router, token, "POST", "/chat/completions", `{"messages":[{"role":"user","content":"hello"}],"stream":true}`)
	if !strings.Contains(w.Body.String(), "stream_incomplete") {
		t.Fatal("truncated stream looks successful")
	}
}
