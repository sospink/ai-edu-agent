package router_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"edu-platform/internal/app"
	"edu-platform/internal/config"
	"edu-platform/internal/domain/user"
	"edu-platform/internal/router"
)

type apiResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data"`
	Message string          `json:"message"`
	Error   string          `json:"error"`
	Code    string          `json:"code"`
}

type loginData struct {
	User  userDTO `json:"user"`
	Token string  `json:"token"`
}

type userDTO struct {
	ID        uint64          `json:"id"`
	Username  string          `json:"username"`
	Email     string          `json:"email"`
	Phone     string          `json:"phone"`
	StudentID string          `json:"studentId"`
	FullName  string          `json:"fullName"`
	RoleType  user.RoleType   `json:"roleType"`
	Status    user.UserStatus `json:"status"`
}

type paginatedUsers struct {
	List     []userDTO `json:"list"`
	Total    int64     `json:"total"`
	Page     int       `json:"page"`
	PageSize int       `json:"pageSize"`
}

type testFixture struct {
	engine   http.Handler
	db       *gorm.DB
	service  *user.Service
	admin    *user.User
	student  *user.User
	uploadID string
}

func TestAuthLoginAndGetCurrentUser(t *testing.T) {
	fixture := newTestFixture(t)

	loginResp := performJSON(t, fixture.engine, http.MethodPost, "/api/auth/login", map[string]string{
		"username": fixture.student.Username,
		"password": "student@123",
	}, "")
	if loginResp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", loginResp.Code)
	}

	var loginPayload apiResponse
	decodeJSON(t, loginResp.Body.Bytes(), &loginPayload)
	if !loginPayload.Success {
		t.Fatalf("expected login success, got %+v", loginPayload)
	}

	var data loginData
	decodeJSON(t, loginPayload.Data, &data)
	if data.Token == "" {
		t.Fatalf("expected token in login response")
	}
	if data.User.Username != fixture.student.Username {
		t.Fatalf("unexpected login user: %+v", data.User)
	}

	meResp := performJSON(t, fixture.engine, http.MethodGet, "/api/auth/me", nil, data.Token)
	if meResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for /auth/me, got %d", meResp.Code)
	}

	var mePayload apiResponse
	decodeJSON(t, meResp.Body.Bytes(), &mePayload)
	if !mePayload.Success {
		t.Fatalf("expected me success, got %+v", mePayload)
	}

	var current userDTO
	decodeJSON(t, mePayload.Data, &current)
	if current.ID != fixture.student.ID || current.Username != fixture.student.Username {
		t.Fatalf("unexpected current user: %+v", current)
	}
}

func TestAuthLoginSupportsEmailAndStudentID(t *testing.T) {
	fixture := newTestFixture(t)

	emailResp := performJSON(t, fixture.engine, http.MethodPost, "/api/auth/login", map[string]string{
		"username": fixture.student.Email,
		"password": "student@123",
	}, "")
	if emailResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for email login, got %d", emailResp.Code)
	}

	studentIDResp := performJSON(t, fixture.engine, http.MethodPost, "/api/auth/login", map[string]string{
		"username": fixture.student.StudentID,
		"password": "student@123",
	}, "")
	if studentIDResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for student id login, got %d", studentIDResp.Code)
	}
}

func TestAuthMeSupportsQueryUserIDFallback(t *testing.T) {
	fixture := newTestFixture(t)

	resp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/auth/me?userId=%d", fixture.student.ID), nil, "")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}

	var payload apiResponse
	decodeJSON(t, resp.Body.Bytes(), &payload)
	if !payload.Success {
		t.Fatalf("expected me success, got %+v", payload)
	}

	var current userDTO
	decodeJSON(t, payload.Data, &current)
	if current.ID != fixture.student.ID {
		t.Fatalf("expected fallback user id %d, got %d", fixture.student.ID, current.ID)
	}
}

func TestUserUpdatePasswordRequiresOldPasswordForSelf(t *testing.T) {
	fixture := newTestFixture(t)
	token := mustLogin(t, fixture, fixture.student.Username, "student@123")

	badResp := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/users/%d/password", fixture.student.ID), map[string]string{
		"oldPassword": "wrong-pass",
		"newPassword": "student@456",
	}, token)
	if badResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for wrong password, got %d", badResp.Code)
	}

	okResp := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/users/%d/password", fixture.student.ID), map[string]string{
		"oldPassword": "student@123",
		"newPassword": "student@456",
	}, token)
	if okResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for password update, got %d", okResp.Code)
	}

	newToken := mustLogin(t, fixture, fixture.student.Username, "student@456")
	if newToken == "" {
		t.Fatalf("expected login with new password to succeed")
	}
}

func TestAdminOnlyUsersEndpoints(t *testing.T) {
	fixture := newTestFixture(t)

	studentToken := mustLogin(t, fixture, fixture.student.Username, "student@123")
	forbiddenResp := performJSON(t, fixture.engine, http.MethodGet, "/api/users?page=1&pageSize=10", nil, studentToken)
	if forbiddenResp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-admin list access, got %d", forbiddenResp.Code)
	}

	adminToken := mustLogin(t, fixture, fixture.admin.Username, "admin@123")
	listResp := performJSON(t, fixture.engine, http.MethodGet, "/api/users?page=1&pageSize=10", nil, adminToken)
	if listResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin list access, got %d", listResp.Code)
	}

	var payload apiResponse
	decodeJSON(t, listResp.Body.Bytes(), &payload)
	if !payload.Success {
		t.Fatalf("expected list success, got %+v", payload)
	}

	var page paginatedUsers
	decodeJSON(t, payload.Data, &page)
	if page.Total != 2 {
		t.Fatalf("expected 2 users, got %d", page.Total)
	}
}

func TestAdminCanResetOtherUserPassword(t *testing.T) {
	fixture := newTestFixture(t)
	adminToken := mustLogin(t, fixture, fixture.admin.Username, "admin@123")

	resp := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/users/%d/password", fixture.student.ID), map[string]string{
		"newPassword": "reset@456",
	}, adminToken)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin password reset, got %d", resp.Code)
	}

	resetToken := mustLogin(t, fixture, fixture.student.Username, "reset@456")
	if resetToken == "" {
		t.Fatalf("expected login with reset password to succeed")
	}
}

func TestAdminUpdateUserReturnsUpdatedUserAndPreservesUntouchedFields(t *testing.T) {
	fixture := newTestFixture(t)
	adminToken := mustLogin(t, fixture, fixture.admin.Username, "admin@123")

	resp := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/users/%d", fixture.student.ID), map[string]any{
		"fullName": "更新后的学生",
		"roleType": user.RoleTeacher,
	}, adminToken)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200 for update, got %d", resp.Code)
	}

	var payload apiResponse
	decodeJSON(t, resp.Body.Bytes(), &payload)
	if !payload.Success {
		t.Fatalf("expected update success, got %+v", payload)
	}

	var updated userDTO
	decodeJSON(t, payload.Data, &updated)
	if updated.FullName != "更新后的学生" {
		t.Fatalf("expected updated full name, got %+v", updated)
	}
	if updated.RoleType != user.RoleTeacher {
		t.Fatalf("expected updated role type, got %+v", updated)
	}
	if updated.Username != fixture.student.Username || updated.Email != fixture.student.Email {
		t.Fatalf("expected untouched identity fields to be preserved, got %+v", updated)
	}
}

func TestSelfUpdateOwnProfileSucceeds(t *testing.T) {
	fixture := newTestFixture(t)
	token := mustLogin(t, fixture, fixture.student.Username, "student@123")

	resp := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/users/%d", fixture.student.ID), map[string]any{
		"fullName":   "新的昵称",
		"phone":      "13911112222",
		"bio":        "热爱 AI 实训",
		"githubLink": "https://github.com/new-student",
		"roleType":   user.RoleAdmin,
	}, token)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200 for self update, got %d", resp.Code)
	}

	var payload apiResponse
	decodeJSON(t, resp.Body.Bytes(), &payload)
	if !payload.Success {
		t.Fatalf("expected self update success, got %+v", payload)
	}

	var updated userDTO
	decodeJSON(t, payload.Data, &updated)
	if updated.FullName != "新的昵称" || updated.Phone != "13911112222" {
		t.Fatalf("expected profile fields updated, got %+v", updated)
	}
	if updated.RoleType != user.RoleStudent {
		t.Fatalf("expected self update not to escalate role, got %+v", updated)
	}
}

func TestSelfUpdateOtherUserForbidden(t *testing.T) {
	fixture := newTestFixture(t)
	studentToken := mustLogin(t, fixture, fixture.student.Username, "student@123")

	resp := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/users/%d", fixture.admin.ID), map[string]any{
		"fullName": "越权修改",
	}, studentToken)
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for updating another user, got %d", resp.Code)
	}
}

func TestSelfGetOwnUserSucceedsButOthersForbidden(t *testing.T) {
	fixture := newTestFixture(t)
	studentToken := mustLogin(t, fixture, fixture.student.Username, "student@123")

	selfResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/users/%d", fixture.student.ID), nil, studentToken)
	if selfResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for self get, got %d", selfResp.Code)
	}

	otherResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/users/%d", fixture.admin.ID), nil, studentToken)
	if otherResp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for other user get, got %d", otherResp.Code)
	}
}

func TestRefreshRejectsFrozenUsers(t *testing.T) {
	fixture := newTestFixture(t)
	token := mustLogin(t, fixture, fixture.student.Username, "student@123")

	if err := fixture.service.Freeze(fixture.student.ID); err != nil {
		t.Fatalf("freeze user failed: %v", err)
	}

	resp := performJSON(t, fixture.engine, http.MethodPost, "/api/auth/refresh", nil, token)
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for frozen user refresh, got %d", resp.Code)
	}
}

func newTestFixture(t *testing.T) *testFixture {
	t.Helper()

	gin.SetMode(gin.TestMode)

	dbPath := filepath.Join(t.TempDir(), "phase2-test.db")
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
		Username:   "student01",
		Email:      "student01@example.com",
		Password:   "student@123",
		FullName:   "测试学生",
		StudentID:  "S1001",
		Phone:      "13800000000",
		RoleType:   user.RoleStudent,
		GithubLink: "https://github.com/student01",
	})
	if err != nil {
		t.Fatalf("seed student failed: %v", err)
	}

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
		Enforcer: mustTestEnforcer(t),
	})

	return &testFixture{
		engine:  engine,
		db:      db,
		service: userService,
		admin:   admin,
		student: student,
	}
}

func mustLogin(t *testing.T, fixture *testFixture, username, password string) string {
	t.Helper()

	resp := performJSON(t, fixture.engine, http.MethodPost, "/api/auth/login", map[string]string{
		"username": username,
		"password": password,
	}, "")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d: %s", resp.Code, resp.Body.String())
	}

	var payload apiResponse
	decodeJSON(t, resp.Body.Bytes(), &payload)
	if !payload.Success {
		t.Fatalf("expected login success, got %+v", payload)
	}

	var data loginData
	decodeJSON(t, payload.Data, &data)
	return data.Token
}

func performJSON(t *testing.T, handler http.Handler, method, target string, body any, token string) *httptest.ResponseRecorder {
	t.Helper()

	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal request body failed: %v", err)
		}
	}

	req := httptest.NewRequest(method, target, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	return recorder
}

func decodeJSON(t *testing.T, raw []byte, target any) {
	t.Helper()
	if err := json.Unmarshal(raw, target); err != nil {
		t.Fatalf("decode json failed: %v; raw=%s", err, string(raw))
	}
}
