package router_test

import (
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
	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/assignment"
	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/publishing"
	"edu-platform/internal/domain/user"
	"edu-platform/internal/router"
)

type m2PublishingFixture struct {
	engine  http.Handler
	db      *gorm.DB
	admin   *user.User
	teacher *user.User
}

func TestM2PublishingGateReturnsCheckPayload(t *testing.T) {
	fixture := newM2PublishingFixture(t)
	teacherToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacher.Username, "teacher@123")

	courseMissingManual := seedCourseWithLabLesson(t, fixture.db, fixture.teacher.ID, 0, "course-missing-manual")
	courseResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/courses/%d/publish", courseMissingManual.ID), nil, teacherToken)
	assertPublishBlocked(t, courseResp, "COURSE_LESSON_MANUAL_REQUIRED")

	manualMissingVerification := agent.AgentManual{SourceType: agent.SourceTypeLesson, SourceID: 9001, Title: "缺验证手册", CreatorID: fixture.teacher.ID}
	if err := fixture.db.Create(&manualMissingVerification).Error; err != nil {
		t.Fatalf("seed manual failed: %v", err)
	}
	if err := fixture.db.Create(&agent.AgentStep{
		ManualID:  manualMissingVerification.ID,
		StepOrder: 1,
		Title:     "步骤",
		Content:   []agent.ContentBlock{{Type: "text", Text: "完成练习"}},
	}).Error; err != nil {
		t.Fatalf("seed manual step failed: %v", err)
	}
	manualResp := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/teacher/manuals/%d", manualMissingVerification.ID), map[string]any{
		"title":       "缺验证手册",
		"isPublished": 1,
	}, teacherToken)
	assertPublishBlocked(t, manualResp, "MANUAL_VERIFICATION_REQUIRED")

	disabledTemplate := publishing.LabTemplate{
		Name:     "停用模板",
		Code:     "disabled-template",
		EnvImage: "registry.local/lab:latest",
		Status:   publishing.LabTemplateStatusDisabled,
	}
	if err := fixture.db.Create(&disabledTemplate).Error; err != nil {
		t.Fatalf("seed disabled template failed: %v", err)
	}
	courseWithDisabledTemplate := seedCourseWithLabLesson(t, fixture.db, fixture.teacher.ID, disabledTemplate.ID, "course-disabled-template")
	seedPublishedManualForLesson(t, fixture.db, fixture.teacher.ID, courseWithDisabledTemplate.ID)
	templateResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/courses/%d/publish", courseWithDisabledTemplate.ID), nil, teacherToken)
	assertPublishBlocked(t, templateResp, "COURSE_TEMPLATE_INVALID")

	retiredProject := project.Project{
		Title:     "历史项目",
		Slug:      "retired-project",
		Status:    project.ProjectStatusArchived,
		EnvImage:  "registry.local/lab:latest",
		CreatedBy: fixture.teacher.ID,
	}
	if err := fixture.db.Create(&retiredProject).Error; err != nil {
		t.Fatalf("seed retired project failed: %v", err)
	}
	retiredUnit := project.ProjectUnit{ProjectID: retiredProject.ID, Title: "历史单元", Type: 1, SortOrder: 1}
	if err := fixture.db.Create(&retiredUnit).Error; err != nil {
		t.Fatalf("seed retired project unit failed: %v", err)
	}
	retiredTag := project.Tag{Name: "OpenClaw", StyleColor: "#10B981"}
	if err := fixture.db.Create(&retiredTag).Error; err != nil {
		t.Fatalf("seed retired project tag failed: %v", err)
	}
	if err := fixture.db.Create(&project.ProjectTag{ProjectID: retiredProject.ID, TagID: retiredTag.ID}).Error; err != nil {
		t.Fatalf("bind retired project tag failed: %v", err)
	}
	retiredManual := agent.AgentManual{SourceType: agent.SourceTypeProjectUnit, SourceID: retiredUnit.ID, Title: "历史项目手册", IsPublished: 1, CreatorID: fixture.teacher.ID}
	if err := fixture.db.Create(&retiredManual).Error; err != nil {
		t.Fatalf("seed retired project manual failed: %v", err)
	}
	if err := fixture.db.Create(&agent.AgentStep{
		ManualID:     retiredManual.ID,
		StepOrder:    1,
		Title:        "验证步骤",
		Content:      []agent.ContentBlock{{Type: "text", Text: "执行验证"}},
		Verification: &agent.VerificationRule{Type: "command_output", Command: "echo ok", Expect: "contains", Value: "ok"},
	}).Error; err != nil {
		t.Fatalf("seed retired project step failed: %v", err)
	}
	retiredResp := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/teacher/projects/%d/publish", retiredProject.ID), nil, teacherToken)
	assertPublishBlocked(t, retiredResp, "PROJECT_TYPE_RETIRED")

}

func assertPublishBlocked(t *testing.T, resp *httptest.ResponseRecorder, expectedCode string) {
	t.Helper()
	if resp.Code != http.StatusConflict {
		t.Fatalf("expected 409 publish blocked, got %d: %s", resp.Code, resp.Body.String())
	}
	var api apiResponse
	decodeJSON(t, resp.Body.Bytes(), &api)
	var check publishing.PublishCheckResult
	decodeJSON(t, api.Data, &check)
	if check.CanPublish {
		t.Fatalf("expected canPublish=false, got %+v", check)
	}
	for _, item := range check.Errors {
		if item.Code == expectedCode {
			return
		}
	}
	t.Fatalf("expected check error %s, got %+v", expectedCode, check.Errors)
}

func seedCourseWithLabLesson(t *testing.T, db *gorm.DB, teacherID, labTemplateID uint64, slug string) course.Course {
	t.Helper()
	record := course.Course{
		Title:         slug,
		Slug:          slug,
		Status:        course.CourseStatusDraft,
		EnvImage:      "registry.local/lab:latest",
		LabTemplateID: labTemplateID,
		CreatorID:     teacherID,
	}
	if labTemplateID > 0 {
		record.EnvImage = ""
	}
	if err := db.Create(&record).Error; err != nil {
		t.Fatalf("seed course failed: %v", err)
	}
	stage := course.CourseStage{CourseID: record.ID, Title: "阶段", SortOrder: 1}
	if err := db.Create(&stage).Error; err != nil {
		t.Fatalf("seed course stage failed: %v", err)
	}
	lesson := course.CourseLesson{CourseID: record.ID, StageID: stage.ID, Title: "实验课时", Type: 1, SortOrder: 1}
	if err := db.Create(&lesson).Error; err != nil {
		t.Fatalf("seed course lesson failed: %v", err)
	}
	return record
}

func seedPublishedManualForLesson(t *testing.T, db *gorm.DB, teacherID, courseID uint64) {
	t.Helper()
	var lesson course.CourseLesson
	if err := db.Where("course_id = ?", courseID).First(&lesson).Error; err != nil {
		t.Fatalf("find lesson failed: %v", err)
	}
	manual := agent.AgentManual{SourceType: agent.SourceTypeLesson, SourceID: lesson.ID, Title: "已发布手册", IsPublished: 1, CreatorID: teacherID}
	if err := db.Create(&manual).Error; err != nil {
		t.Fatalf("seed published manual failed: %v", err)
	}
	if err := db.Create(&agent.AgentStep{
		ManualID:     manual.ID,
		StepOrder:    1,
		Title:        "验证步骤",
		Content:      []agent.ContentBlock{{Type: "text", Text: "执行验证"}},
		Verification: &agent.VerificationRule{Type: "command_output", Command: "echo ok", Expect: "contains", Value: "ok"},
	}).Error; err != nil {
		t.Fatalf("seed published manual step failed: %v", err)
	}
}

func newM2PublishingFixture(t *testing.T) *m2PublishingFixture {
	t.Helper()
	gin.SetMode(gin.TestMode)

	dbPath := filepath.Join(t.TempDir(), "m2-publishing-test.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := db.AutoMigrate(
		&user.User{},
		&course.Course{},
		&course.CourseStage{},
		&course.CourseLesson{},
		&course.LessonMaterial{},
		&project.Project{},
		&project.ProjectUnit{},
		&project.Tag{},
		&project.ProjectTag{},
		&agent.AgentManual{},
		&agent.AgentStep{},
		&classroom.Term{},
		&classroom.Class{},
		&classroom.ClassMember{},
		&classroom.ClassTeacher{},
		&publishing.LabTemplate{},
		&publishing.ContentPublishCheck{},
		&publishing.PublishAuditLog{},
		&assignment.TeachingAssignment{},
		&assignment.AssignmentResource{},
		&assignment.AssignmentClass{},
		&assignment.AssignmentRule{},
		&assignment.Submission{},
		&assignment.SubmissionFile{},
		&assignment.SubmissionCheck{},
		&assignment.Rubric{},
		&assignment.RubricItem{},
		&assignment.Grade{},
		&assignment.TeacherFeedback{},
	); err != nil {
		t.Fatalf("auto migrate m2 publishing models failed: %v", err)
	}
	userService := user.NewService(db, zap.NewNop())
	admin, err := userService.Create(user.CreateParams{Username: "m2-admin", Email: "m2-admin@example.com", Password: "admin@123", FullName: "管理员", RoleType: user.RoleAdmin})
	if err != nil {
		t.Fatalf("seed admin failed: %v", err)
	}
	teacher, err := userService.Create(user.CreateParams{Username: "m2-teacher", Email: "m2-teacher@example.com", Password: "teacher@123", FullName: "教师", RoleType: user.RoleTeacher})
	if err != nil {
		t.Fatalf("seed teacher failed: %v", err)
	}

	cfg := &config.Config{
		App:    config.AppConfig{Name: "edu-platform-test", Env: "test", Version: "test"},
		JWT:    config.JWTConfig{Secret: "test-secret", Issuer: "edu-platform-test", ExpiresIn: "7d"},
		Upload: config.UploadConfig{Root: filepath.Join(t.TempDir(), "uploads")},
	}
	engine := router.New(app.Dependencies{Config: cfg, Logger: zap.NewNop(), DB: db, Enforcer: mustTestEnforcer(t)})
	return &m2PublishingFixture{engine: engine, db: db, admin: admin, teacher: teacher}
}
