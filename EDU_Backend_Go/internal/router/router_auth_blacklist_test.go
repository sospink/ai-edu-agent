package router_test

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"edu-platform/internal/app"
	"edu-platform/internal/config"
	"edu-platform/internal/domain/user"
	"edu-platform/internal/router"
)

func TestLogoutRevokesTokenForHTTPAndTerminalWS(t *testing.T) {
	fixture, cleanup := newTestFixtureWithRedis(t)
	defer cleanup()

	token := mustLogin(t, fixture, fixture.student.Username, "student@123")

	beforeLogout := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/users/%d", fixture.student.ID), nil, token)
	if beforeLogout.Code != http.StatusOK {
		t.Fatalf("expected 200 before logout, got %d: %s", beforeLogout.Code, beforeLogout.Body.String())
	}

	logoutResp := performJSON(t, fixture.engine, http.MethodPost, "/api/auth/logout", nil, token)
	if logoutResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for logout, got %d: %s", logoutResp.Code, logoutResp.Body.String())
	}

	afterLogout := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/users/%d", fixture.student.ID), nil, token)
	if afterLogout.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 after logout, got %d: %s", afterLogout.Code, afterLogout.Body.String())
	}

	server := httptest.NewServer(fixture.engine)
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws/terminal?sessionId=1&token=" + url.QueryEscape(token)
	_, resp, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err == nil {
		t.Fatalf("expected websocket handshake to fail after logout")
	}
	if resp == nil {
		t.Fatalf("expected websocket response when revoked token is rejected")
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for revoked websocket token, got %d", resp.StatusCode)
	}
	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		t.Fatalf("read websocket rejection body failed: %v", readErr)
	}
	_ = resp.Body.Close()
	// 断言稳定的错误码而非具体文案，避免 i18n 文案调整误伤用例。
	if !strings.Contains(string(body), "TERMINAL_TOKEN_REVOKED") {
		t.Fatalf("expected revoked token code, got %s", string(body))
	}
}

func newTestFixtureWithRedis(t *testing.T) (*testFixture, func()) {
	t.Helper()

	gin.SetMode(gin.TestMode)

	dbPath := filepath.Join(t.TempDir(), "phase2-blacklist-test.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := db.AutoMigrate(&user.User{}); err != nil {
		t.Fatalf("auto migrate user failed: %v", err)
	}

	userService := user.NewService(db, zap.NewNop())
	admin, err := userService.Create(user.CreateParams{
		Username: "admin",
		Email:    "admin@example.com",
		Password: "admin@123",
		FullName: "系统管理员",
		RoleType: user.RoleAdmin,
	})
	if err != nil {
		t.Fatalf("seed admin failed: %v", err)
	}
	student, err := userService.Create(user.CreateParams{
		Username:  "student01",
		Email:     "student01@example.com",
		Password:  "student@123",
		FullName:  "测试学生",
		StudentID: "S1001",
		RoleType:  user.RoleStudent,
	})
	if err != nil {
		t.Fatalf("seed student failed: %v", err)
	}

	miniRedis, err := miniredis.Run()
	if err != nil {
		t.Fatalf("start miniredis failed: %v", err)
	}
	redisClient := redis.NewClient(&redis.Options{Addr: miniRedis.Addr()})

	cfg := &config.Config{
		App: config.AppConfig{
			Name:    "edu-platform-test",
			Env:     "test",
			Version: "test",
		},
		JWT: config.JWTConfig{
			Secret:    "test-secret",
			Issuer:    "edu-platform-test",
			ExpiresIn: "7d",
		},
		Upload: config.UploadConfig{
			Root: filepath.Join(t.TempDir(), "uploads"),
		},
	}

	engine := router.New(app.Dependencies{
		Config:   cfg,
		Logger:   zap.NewNop(),
		DB:       db,
		Redis:    redisClient,
		Enforcer: mustTestEnforcer(t),
	})

	fixture := &testFixture{
		engine:  engine,
		db:      db,
		service: userService,
		admin:   admin,
		student: student,
	}

	cleanup := func() {
		_ = redisClient.Close()
		miniRedis.Close()
	}

	return fixture, cleanup
}
