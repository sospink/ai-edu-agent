package courseharness

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"edu-platform/internal/middleware"
	"edu-platform/pkg/jwt"
)

func TestSquareAccessAndStorage(t *testing.T) {
	h, _, lesson := proxyFixture(t)
	square := Instance{Square: true, UserID: lesson.UserID, Locale: "zh-CN"}
	ctx := context.Background()
	if !h.allowed(ctx, square) || h.allowed(ctx, Instance{UserID: lesson.UserID}) {
		t.Fatal("广场应允许有效账号，课程入口仍需有效课时")
	}
	for _, other := range []Instance{lesson, {Square: true, UserID: 2, Locale: square.Locale}, {Square: true, UserID: square.UserID, Locale: "en-US"}} {
		if square.sameWorkspace(other) || square.directory(h.root) == other.directory(h.root) {
			t.Fatal("用户、课时或语言之间发生工作区冲突")
		}
	}
	if err := h.db.Exec("UPDATE sys_users SET status=0 WHERE id=1").Error; err != nil {
		t.Fatal(err)
	}
	if h.allowed(ctx, square) {
		t.Fatal("停用账号仍可访问广场")
	}
}

func TestSquareSessionRequiresAccountAndImage(t *testing.T) {
	h, _, _ := proxyFixture(t)
	h.image = "course-only"
	for _, tc := range []struct {
		user uint64
		want int
	}{{0, 401}, {2, 403}, {1, 503}} {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/", nil)
		if tc.user != 0 {
			c.Set(middleware.UserClaimsKey, &jwt.Claims{UserID: tc.user})
		}
		h.SquareSession(c)
		if w.Code != tc.want || (w.Code == 503 && !strings.Contains(w.Body.String(), "SQUARE_UNCONFIGURED")) {
			t.Fatalf("user=%d response=%d %s", tc.user, w.Code, w.Body.String())
		}
	}
}

// Docker 联调使用临时数据库与工作目录；只回收本测试创建的随机实例。
func TestSquareDockerSession(t *testing.T) {
	image := os.Getenv("EDU_TEST_SQUARE_IMAGE")
	if image == "" {
		t.Skip("需要 Linux Docker 广场镜像")
	}
	h, r, _ := proxyFixture(t)
	h.squareImage = image
	h.backendPort = "4000"
	h.logger = zap.NewNop()
	r.POST("/square", func(c *gin.Context) {
		c.Set(middleware.UserClaimsKey, &jwt.Claims{UserID: 1})
		c.Set(middleware.UserTokenKey, "test-platform")
		h.SquareSession(c)
	})
	create := func() (string, *url.URL) {
		t.Helper()
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest("POST", "/square", nil))
		var resp struct{ Data struct{ URL string } }
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &resp) != nil {
			t.Fatalf("创建工作区返回 %d", w.Code)
		}
		u, err := url.Parse(resp.Data.URL)
		if err != nil {
			t.Fatal(err)
		}
		id := strings.Trim(strings.TrimPrefix(u.Path, "/api/course-harness/proxy/"), "/")
		return id, u
	}
	id, entry := create()
	s, ok := h.get(id)
	if !ok {
		t.Fatal("工作区未登记")
	}
	t.Cleanup(func() {
		if err := h.remove(s); err != nil {
			t.Error(err)
		}
	})
	if !s.Square || s.LessonID != 0 || s.UserID != 1 {
		t.Fatal("工作区归属错误")
	}
	if second, _ := create(); second != id {
		t.Fatal("重复打开应复用同一工作区")
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", entry.RequestURI(), nil))
	if w.Code != http.StatusSeeOther && w.Code != http.StatusFound {
		t.Fatalf("登录交换返回 %d", w.Code)
	}
	cookies := w.Result().Cookies()
	get := func(withCookies bool) *httptest.ResponseRecorder {
		req := httptest.NewRequest("GET", entry.Path, nil)
		if withCookies {
			for _, ck := range cookies {
				req.AddCookie(ck)
			}
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}
	if get(false).Code != 401 {
		t.Fatal("无会话 Cookie 时应拒绝访问")
	}
	if page := get(true); page.Code != 200 || !strings.Contains(strings.ToLower(page.Body.String()), "<html") {
		t.Fatalf("工作区页面返回 %d", page.Code)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if _, err := docker(ctx, "exec", s.Container, "test", "-s", "/opt/ai-square/skills/utxo-balance/SKILL.md"); err != nil {
		t.Fatal("镜像缺少教学 Skill")
	}
}
