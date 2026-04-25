package router_test

import (
	"fmt"
	"net/http"
	"path/filepath"
	"testing"
	"time"

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
	"edu-platform/internal/domain/lab"
	"edu-platform/internal/domain/learning"
	"edu-platform/internal/domain/operations"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/publishing"
	"edu-platform/internal/domain/user"
	"edu-platform/internal/router"
)

func TestLearningOverviewUsesLearningOutcomeFacts(t *testing.T) {
	fixture := newLearningOverviewFixture(t)
	token := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.student.Username, "student@123")

	resp := performJSON(t, fixture.engine, http.MethodGet, "/api/learning/overview", nil, token)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected overview 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var api apiResponse
	decodeJSON(t, resp.Body.Bytes(), &api)
	var overview learning.OverviewResponse
	decodeJSON(t, api.Data, &overview)

	if overview.Level != 1 || overview.LevelName != "Explorer" {
		t.Fatalf("expected level 1 Explorer, got %+v", overview)
	}
	if overview.CompletedLessons != 1 || overview.TotalLessons != 2 || overview.OverallProgressPercent != 50 {
		t.Fatalf("expected 1/2 lessons and 50 progress, got %+v", overview)
	}
	if overview.CurrentStreakDays != 2 || overview.ActiveDaysLast7 != 3 {
		t.Fatalf("unexpected activity metrics: %+v", overview)
	}
	if len(overview.Milestones) != 3 ||
		overview.Milestones[0].Type != "courses" || overview.Milestones[0].Target != 3 ||
		overview.Milestones[1].Type != "lessons" || overview.Milestones[1].Target != 10 ||
		overview.Milestones[2].Type != "streak" || overview.Milestones[2].Current != 2 {
		t.Fatalf("unexpected milestones: %+v", overview.Milestones)
	}
	if overview.OutcomeSummary.SubmittedAssignments != 1 ||
		overview.OutcomeSummary.GradedAssignments != 1 ||
		overview.OutcomeSummary.PublishedGrades != 1 ||
		overview.OutcomeSummary.AgentManualsInProgress != 1 ||
		overview.OutcomeSummary.AgentCompletedSteps != 3 {
		t.Fatalf("unexpected outcome summary: %+v", overview.OutcomeSummary)
	}
}

func TestLearningOverviewLevelFiveGrowthTarget(t *testing.T) {
	fixture := newLearningOverviewFixture(t)
	token := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.student.Username, "student@123")

	if err := seedCompletedOneLessonCourses(fixture.db, fixture.student.ID, 25); err != nil {
		t.Fatalf("seed completed courses failed: %v", err)
	}

	resp := performJSON(t, fixture.engine, http.MethodGet, "/api/learning/overview", nil, token)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected overview 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var api apiResponse
	decodeJSON(t, resp.Body.Bytes(), &api)
	var overview learning.OverviewResponse
	decodeJSON(t, api.Data, &overview)
	if overview.Level != 5 || overview.LevelName != "Master" {
		t.Fatalf("expected level 5 Master, got %+v", overview)
	}
	if len(overview.Milestones) == 0 || overview.Milestones[0].Target != overview.CompletedCourses+5 {
		t.Fatalf("expected level 5 dynamic course target, got %+v", overview.Milestones)
	}
}

func TestTeacherStudentProgressScopesCourseRowsByClassTeacher(t *testing.T) {
	fixture := newLearningOverviewFixture(t)
	teacherToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacher.Username, "teacher@123")
	foreignTeacherToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.foreignTeacher.Username, "teacher@123")
	adminToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.admin.Username, "admin@123")

	assertTeacherProgressTotal := func(token string, expected int) {
		t.Helper()
		resp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/students/progress?view=course", nil, token)
		if resp.Code != http.StatusOK {
			t.Fatalf("expected teacher progress 200, got %d: %s", resp.Code, resp.Body.String())
		}
		var api apiResponse
		decodeJSON(t, resp.Body.Bytes(), &api)
		var payload struct {
			List []struct {
				UserID uint64 `json:"userId"`
			} `json:"list"`
			Total int64 `json:"total"`
		}
		decodeJSON(t, api.Data, &payload)
		if int(payload.Total) != expected || len(payload.List) != expected {
			t.Fatalf("expected %d progress rows, got %+v", expected, payload)
		}
	}

	assertTeacherProgressTotal(teacherToken, 1)
	assertTeacherProgressTotal(foreignTeacherToken, 1)
	assertTeacherProgressTotal(adminToken, 2)
}

type learningOverviewFixture struct {
	engine         http.Handler
	db             *gorm.DB
	admin          *user.User
	teacher        *user.User
	foreignTeacher *user.User
	student        *user.User
	foreignStudent *user.User
}

func newLearningOverviewFixture(t *testing.T) *learningOverviewFixture {
	t.Helper()
	gin.SetMode(gin.TestMode)

	dbPath := filepath.Join(t.TempDir(), "learning-overview-test.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := db.AutoMigrate(
		&user.User{},
		&course.Course{},
		&course.CourseStage{},
		&course.CourseLesson{},
		&course.UserCourseEnrollment{},
		&course.UserLessonRecord{},
		&course.UserActivityLog{},
		&agent.AgentManual{},
		&agent.AgentStep{},
		&agent.UserAgentProgress{},
		&classroom.Term{},
		&classroom.Class{},
		&classroom.ClassMember{},
		&classroom.ClassTeacher{},
		&assignment.TeachingAssignment{},
		&assignment.AssignmentClass{},
		&assignment.Submission{},
		&assignment.Grade{},
		&project.Project{},
		&project.ProjectUnit{},
		&project.Tag{},
		&project.ProjectTag{},
		&lab.UserLabSession{},
		&publishing.LabTemplate{},
		&operations.AuditLog{},
	); err != nil {
		t.Fatalf("auto migrate learning overview models failed: %v", err)
	}

	userService := user.NewService(db, zap.NewNop())
	admin := mustCreateUser(t, userService, "overview-admin", "overview-admin@example.com", "管理员", user.RoleAdmin)
	teacher := mustCreateUser(t, userService, "overview-teacher", "overview-teacher@example.com", "教师", user.RoleTeacher)
	foreignTeacher := mustCreateUser(t, userService, "overview-foreign-teacher", "overview-foreign-teacher@example.com", "外部教师", user.RoleTeacher)
	student := mustCreateUser(t, userService, "overview-student", "overview-student@example.com", "学生", user.RoleStudent)
	foreignStudent := mustCreateUser(t, userService, "overview-foreign-student", "overview-foreign-student@example.com", "外部学生", user.RoleStudent)

	term := classroom.Term{Name: "学习概览学期", Code: "OVERVIEW-TERM", Status: classroom.TermStatusActive, CreatedBy: admin.ID}
	if err := db.Create(&term).Error; err != nil {
		t.Fatalf("seed term failed: %v", err)
	}
	classA := classroom.Class{TermID: term.ID, Name: "概览一班", Code: "OVERVIEW-A", OwnerTeacherID: teacher.ID, Status: classroom.ClassStatusActive, CreatedBy: teacher.ID}
	classB := classroom.Class{TermID: term.ID, Name: "概览二班", Code: "OVERVIEW-B", OwnerTeacherID: foreignTeacher.ID, Status: classroom.ClassStatusActive, CreatedBy: foreignTeacher.ID}
	if err := db.Create(&[]classroom.Class{classA, classB}).Error; err != nil {
		t.Fatalf("seed classes failed: %v", err)
	}
	if err := db.First(&classA, "code = ?", "OVERVIEW-A").Error; err != nil {
		t.Fatalf("reload class A failed: %v", err)
	}
	if err := db.First(&classB, "code = ?", "OVERVIEW-B").Error; err != nil {
		t.Fatalf("reload class B failed: %v", err)
	}
	now := time.Now()
	if err := db.Create(&[]classroom.ClassTeacher{
		{ClassID: classA.ID, TeacherID: teacher.ID, Role: classroom.ClassTeacherRoleOwner, Status: classroom.ClassTeacherStatusActive},
		{ClassID: classB.ID, TeacherID: foreignTeacher.ID, Role: classroom.ClassTeacherRoleOwner, Status: classroom.ClassTeacherStatusActive},
	}).Error; err != nil {
		t.Fatalf("seed class teachers failed: %v", err)
	}
	if err := db.Create(&[]classroom.ClassMember{
		{ClassID: classA.ID, UserID: student.ID, Status: classroom.ClassMemberStatusActive, JoinedAt: &now},
		{ClassID: classB.ID, UserID: foreignStudent.ID, Status: classroom.ClassMemberStatusActive, JoinedAt: &now},
	}).Error; err != nil {
		t.Fatalf("seed class members failed: %v", err)
	}

	courseRecord, lessons, err := seedCourseWithLessons(db, "overview-course", 2, teacher.ID)
	if err != nil {
		t.Fatalf("seed course failed: %v", err)
	}
	if err := db.Create(&course.UserCourseEnrollment{
		UserID:                student.ID,
		CourseID:              courseRecord.ID,
		Status:                course.EnrollmentStatusInProgress,
		ProgressPercent:       50,
		CompletedLessonsCount: 1,
		LastLessonID:          lessons[0].ID,
		LastActiveAt:          now,
		JoinedAt:              now,
	}).Error; err != nil {
		t.Fatalf("seed enrollment failed: %v", err)
	}
	if err := db.Create(&course.UserCourseEnrollment{
		UserID:                foreignStudent.ID,
		CourseID:              courseRecord.ID,
		Status:                course.EnrollmentStatusInProgress,
		ProgressPercent:       50,
		CompletedLessonsCount: 1,
		LastLessonID:          lessons[0].ID,
		LastActiveAt:          now,
		JoinedAt:              now,
	}).Error; err != nil {
		t.Fatalf("seed foreign enrollment failed: %v", err)
	}
	if err := db.Create(&course.UserLessonRecord{
		UserID:     student.ID,
		CourseID:   courseRecord.ID,
		LessonID:   lessons[0].ID,
		Status:     course.LessonRecordStatusCompleted,
		StartedAt:  &now,
		FinishedAt: &now,
	}).Error; err != nil {
		t.Fatalf("seed lesson record failed: %v", err)
	}
	for _, daysAgo := range []int{1, 2, 5} {
		if err := db.Create(&course.UserActivityLog{
			UserID:            student.ID,
			ActivityDate:      time.Now().AddDate(0, 0, -daysAgo).Format("2006-01-02"),
			ContributionCount: 1,
		}).Error; err != nil {
			t.Fatalf("seed activity log failed: %v", err)
		}
	}

	manual := agent.AgentManual{SourceType: agent.SourceTypeLesson, SourceID: lessons[0].ID, Title: "Agent 手册", IsPublished: 1, CreatorID: teacher.ID}
	if err := db.Create(&manual).Error; err != nil {
		t.Fatalf("seed agent manual failed: %v", err)
	}
	if err := db.Create(&agent.UserAgentProgress{
		UserID:         student.ID,
		ManualID:       manual.ID,
		CurrentStep:    3,
		CompletedSteps: []int{1, 2, 3},
		StartedAt:      now,
		LastActiveAt:   now,
	}).Error; err != nil {
		t.Fatalf("seed agent progress failed: %v", err)
	}

	assignmentRecord := assignment.TeachingAssignment{Title: "概览作业", Status: assignment.AssignmentStatusPublished, CreatorID: teacher.ID, PublishedAt: &now}
	if err := db.Create(&assignmentRecord).Error; err != nil {
		t.Fatalf("seed assignment failed: %v", err)
	}
	if err := db.Create(&assignment.AssignmentClass{AssignmentID: assignmentRecord.ID, ClassID: classA.ID}).Error; err != nil {
		t.Fatalf("seed assignment class failed: %v", err)
	}
	submission := assignment.Submission{AssignmentID: assignmentRecord.ID, StudentID: student.ID, AttemptNo: 1, Status: assignment.SubmissionStatusGraded, SubmittedAt: &now, GradedAt: &now}
	if err := db.Create(&submission).Error; err != nil {
		t.Fatalf("seed submission failed: %v", err)
	}
	if err := db.Create(&assignment.Grade{SubmissionID: submission.ID, StudentID: student.ID, AssignmentID: assignmentRecord.ID, Status: assignment.GradeStatusPublished, PublishedAt: &now}).Error; err != nil {
		t.Fatalf("seed grade failed: %v", err)
	}

	cfg := &config.Config{
		App:    config.AppConfig{Name: "edu-platform-test", Env: "test", Version: "test"},
		JWT:    config.JWTConfig{Secret: "test-secret", Issuer: "edu-platform-test", ExpiresIn: "7d"},
		Upload: config.UploadConfig{Root: filepath.Join(t.TempDir(), "uploads")},
	}
	engine := router.New(app.Dependencies{
		Config:   cfg,
		Logger:   zap.NewNop(),
		DB:       db,
		Enforcer: mustTestEnforcer(t),
	})

	return &learningOverviewFixture{
		engine:         engine,
		db:             db,
		admin:          admin,
		teacher:        teacher,
		foreignTeacher: foreignTeacher,
		student:        student,
		foreignStudent: foreignStudent,
	}
}

func seedCourseWithLessons(db *gorm.DB, slug string, lessonCount int, creatorID uint64) (*course.Course, []course.CourseLesson, error) {
	courseRecord := course.Course{Title: slug, Slug: slug, Status: course.CourseStatusPublished, CreatorID: creatorID}
	if err := db.Create(&courseRecord).Error; err != nil {
		return nil, nil, err
	}
	stage := course.CourseStage{CourseID: courseRecord.ID, Title: slug + " 阶段", SortOrder: 1, LevelLabel: "BEGINNER"}
	if err := db.Create(&stage).Error; err != nil {
		return nil, nil, err
	}
	lessons := make([]course.CourseLesson, 0, lessonCount)
	for i := 1; i <= lessonCount; i++ {
		lessons = append(lessons, course.CourseLesson{
			CourseID:  courseRecord.ID,
			StageID:   stage.ID,
			Title:     fmt.Sprintf("%s 课时 %d", slug, i),
			Type:      1,
			SortOrder: i,
		})
	}
	if err := db.Create(&lessons).Error; err != nil {
		return nil, nil, err
	}
	return &courseRecord, lessons, nil
}

func seedCompletedOneLessonCourses(db *gorm.DB, userID uint64, count int) error {
	now := time.Now()
	for i := 0; i < count; i++ {
		courseRecord, lessons, err := seedCourseWithLessons(db, fmt.Sprintf("overview-extra-course-%d", i), 1, 0)
		if err != nil {
			return err
		}
		if err := db.Create(&course.UserCourseEnrollment{
			UserID:                userID,
			CourseID:              courseRecord.ID,
			Status:                course.EnrollmentStatusCompleted,
			ProgressPercent:       100,
			CompletedLessonsCount: 1,
			LastLessonID:          lessons[0].ID,
			LastActiveAt:          now,
			JoinedAt:              now,
			CompletedAt:           &now,
		}).Error; err != nil {
			return err
		}
	}
	return nil
}
