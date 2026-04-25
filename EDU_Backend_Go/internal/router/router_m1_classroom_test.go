package router_test

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"edu-platform/internal/app"
	"edu-platform/internal/config"
	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/user"
	"edu-platform/internal/router"
)

type m1Fixture struct {
	engine        http.Handler
	db            *gorm.DB
	userService   *user.Service
	admin         *user.User
	teacherA      *user.User
	teacherB      *user.User
	studentActive *user.User
	studentFrozen *user.User
}

func TestM1ClassroomLifecycle(t *testing.T) {
	fixture := newM1Fixture(t)

	adminToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.admin.Username, "admin@123")
	teacherAToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherA.Username, "teacher@123")
	teacherBToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherB.Username, "teacher@123")
	studentToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.studentActive.Username, "student@123")

	createTermResp := performJSON(t, fixture.engine, http.MethodPost, "/api/admin/terms", map[string]any{
		"name":    "2026 春季学期",
		"code":    "2026-SPRING",
		"startAt": "2026-03-01",
		"endAt":   "2026-07-15",
		"status":  classroom.TermStatusActive,
	}, adminToken)
	if createTermResp.Code != http.StatusCreated {
		t.Fatalf("expected 201 for create term, got %d: %s", createTermResp.Code, createTermResp.Body.String())
	}
	var createTermAPI apiResponse
	decodeJSON(t, createTermResp.Body.Bytes(), &createTermAPI)
	var createdTerm classroom.Term
	decodeJSON(t, createTermAPI.Data, &createdTerm)
	if createdTerm.StartAt == nil || createdTerm.EndAt == nil {
		t.Fatalf("expected create term to parse start/end date, got %+v", createdTerm)
	}

	teacherTermsResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/terms", nil, teacherAToken)
	if teacherTermsResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for teacher terms, got %d: %s", teacherTermsResp.Code, teacherTermsResp.Body.String())
	}

	createClassResp := performJSON(t, fixture.engine, http.MethodPost, "/api/teacher/classes", map[string]any{
		"termId":      createdTerm.ID,
		"name":        "Go 实训 1 班",
		"code":        "GO-LAB-1",
		"description": "云原生基础班",
	}, teacherAToken)
	if createClassResp.Code != http.StatusCreated {
		t.Fatalf("expected 201 for create class, got %d: %s", createClassResp.Code, createClassResp.Body.String())
	}
	var createClassAPI apiResponse
	decodeJSON(t, createClassResp.Body.Bytes(), &createClassAPI)
	var createdClass classroom.ClassDetail
	decodeJSON(t, createClassAPI.Data, &createdClass)

	teacherListResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/classes?page=1&pageSize=10", nil, teacherAToken)
	if teacherListResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for teacher list classes, got %d: %s", teacherListResp.Code, teacherListResp.Body.String())
	}
	var teacherListAPI apiResponse
	decodeJSON(t, teacherListResp.Body.Bytes(), &teacherListAPI)
	var teacherListPayload struct {
		List  []classroom.ClassListItem `json:"list"`
		Total int64                     `json:"total"`
	}
	decodeJSON(t, teacherListAPI.Data, &teacherListPayload)
	if teacherListPayload.Total != 1 || len(teacherListPayload.List) != 1 || teacherListPayload.List[0].ID != createdClass.ID {
		t.Fatalf("expected teacher A to see only own class, got %+v", teacherListPayload)
	}

	teacherBForbidden := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/classes/%d", createdClass.ID), nil, teacherBToken)
	if teacherBForbidden.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for teacher B reading teacher A class, got %d: %s", teacherBForbidden.Code, teacherBForbidden.Body.String())
	}

	importFile := filepath.Join(t.TempDir(), "members.csv")
	if err := os.WriteFile(importFile, []byte("studentId,username,email\nS1001,,\nS1001,,\nS2002,,\n,,admin@example.com\nmissing,,missing@example.com\n"), 0o644); err != nil {
		t.Fatalf("write import file failed: %v", err)
	}
	importResp := performMultipartFile(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/classes/%d/members/import", createdClass.ID), "file", importFile, nil, teacherAToken)
	if importResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for import members, got %d: %s", importResp.Code, importResp.Body.String())
	}
	var importAPI apiResponse
	decodeJSON(t, importResp.Body.Bytes(), &importAPI)
	var importPayload classroom.ImportMembersResult
	decodeJSON(t, importAPI.Data, &importPayload)
	if importPayload.Summary.Total != 5 || importPayload.Summary.Imported != 1 || importPayload.Summary.Skipped != 1 || importPayload.Summary.Failed != 3 {
		t.Fatalf("unexpected import summary: %+v", importPayload.Summary)
	}

	membersResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/classes/%d/members", createdClass.ID), nil, teacherAToken)
	if membersResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for class members, got %d: %s", membersResp.Code, membersResp.Body.String())
	}
	var membersAPI apiResponse
	decodeJSON(t, membersResp.Body.Bytes(), &membersAPI)
	var members []classroom.ClassMemberItem
	decodeJSON(t, membersAPI.Data, &members)
	if len(members) != 1 || members[0].UserID != fixture.studentActive.ID {
		t.Fatalf("expected one imported active student, got %+v", members)
	}

	studentClassesResp := performJSON(t, fixture.engine, http.MethodGet, "/api/student/classes", nil, studentToken)
	if studentClassesResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for student classes, got %d: %s", studentClassesResp.Code, studentClassesResp.Body.String())
	}
	var studentClassesAPI apiResponse
	decodeJSON(t, studentClassesResp.Body.Bytes(), &studentClassesAPI)
	var studentClasses []classroom.ClassListItem
	decodeJSON(t, studentClassesAPI.Data, &studentClasses)
	if len(studentClasses) != 1 || studentClasses[0].ID != createdClass.ID {
		t.Fatalf("expected student to see imported class, got %+v", studentClasses)
	}

	adminClassesResp := performJSON(t, fixture.engine, http.MethodGet, "/api/admin/classes?page=1&pageSize=10", nil, adminToken)
	if adminClassesResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin class list, got %d: %s", adminClassesResp.Code, adminClassesResp.Body.String())
	}

	disableResp := performJSON(t, fixture.engine, http.MethodPatch, fmt.Sprintf("/api/admin/classes/%d/status", createdClass.ID), map[string]any{
		"status": classroom.ClassStatusDisabled,
	}, adminToken)
	if disableResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for disable class, got %d: %s", disableResp.Code, disableResp.Body.String())
	}

	teacherHiddenResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/classes?page=1&pageSize=10", nil, teacherAToken)
	if teacherHiddenResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for teacher class list after disable, got %d: %s", teacherHiddenResp.Code, teacherHiddenResp.Body.String())
	}
	var teacherHiddenAPI apiResponse
	decodeJSON(t, teacherHiddenResp.Body.Bytes(), &teacherHiddenAPI)
	var teacherHiddenPayload struct {
		List  []classroom.ClassListItem `json:"list"`
		Total int64                     `json:"total"`
	}
	decodeJSON(t, teacherHiddenAPI.Data, &teacherHiddenPayload)
	if teacherHiddenPayload.Total != 0 || len(teacherHiddenPayload.List) != 0 {
		t.Fatalf("expected disabled class hidden from teacher default list, got %+v", teacherHiddenPayload)
	}

	studentStillVisibleResp := performJSON(t, fixture.engine, http.MethodGet, "/api/student/classes", nil, studentToken)
	if studentStillVisibleResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for student classes after disable, got %d: %s", studentStillVisibleResp.Code, studentStillVisibleResp.Body.String())
	}
	var studentStillVisibleAPI apiResponse
	decodeJSON(t, studentStillVisibleResp.Body.Bytes(), &studentStillVisibleAPI)
	var studentStillVisible []classroom.ClassListItem
	decodeJSON(t, studentStillVisibleAPI.Data, &studentStillVisible)
	if len(studentStillVisible) != 1 || studentStillVisible[0].Status != classroom.ClassStatusDisabled {
		t.Fatalf("expected student to still see disabled class history, got %+v", studentStillVisible)
	}
}

func newM1Fixture(t *testing.T) *m1Fixture {
	t.Helper()
	gin.SetMode(gin.TestMode)

	dbPath := filepath.Join(t.TempDir(), "m1-test.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := db.AutoMigrate(
		&user.User{},
		&classroom.Term{},
		&classroom.Class{},
		&classroom.ClassMember{},
		&classroom.ClassTeacher{},
	); err != nil {
		t.Fatalf("auto migrate m1 models failed: %v", err)
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
	teacherA, err := userService.Create(user.CreateParams{
		Username: "teacher-a",
		Email:    "teacher-a@example.com",
		Password: "teacher@123",
		FullName: "教师 A",
		RoleType: user.RoleTeacher,
	})
	if err != nil {
		t.Fatalf("seed teacher A failed: %v", err)
	}
	teacherB, err := userService.Create(user.CreateParams{
		Username: "teacher-b",
		Email:    "teacher-b@example.com",
		Password: "teacher@123",
		FullName: "教师 B",
		RoleType: user.RoleTeacher,
	})
	if err != nil {
		t.Fatalf("seed teacher B failed: %v", err)
	}
	studentActive, err := userService.Create(user.CreateParams{
		Username:   "student01",
		Email:      "student01@example.com",
		Password:   "student@123",
		FullName:   "激活学生",
		StudentID:  "S1001",
		RoleType:   user.RoleStudent,
		GithubLink: "https://github.com/student01",
	})
	if err != nil {
		t.Fatalf("seed active student failed: %v", err)
	}
	studentFrozen, err := userService.Create(user.CreateParams{
		Username:   "student02",
		Email:      "student02@example.com",
		Password:   "student@123",
		FullName:   "冻结学生",
		StudentID:  "S2002",
		RoleType:   user.RoleStudent,
		GithubLink: "https://github.com/student02",
	})
	if err != nil {
		t.Fatalf("seed frozen student failed: %v", err)
	}
	frozenStatus := user.StatusFrozen
	if err := userService.Update(studentFrozen.ID, user.UpdateParams{Status: &frozenStatus}); err != nil {
		t.Fatalf("freeze student failed: %v", err)
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

	return &m1Fixture{
		engine:        engine,
		db:            db,
		userService:   userService,
		admin:         admin,
		teacherA:      teacherA,
		teacherB:      teacherB,
		studentActive: studentActive,
		studentFrozen: studentFrozen,
	}
}
