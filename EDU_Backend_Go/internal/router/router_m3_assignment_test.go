package router_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
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
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/publishing"
	"edu-platform/internal/domain/user"
	"edu-platform/internal/router"
)

type m3AssignmentFixture struct {
	engine          http.Handler
	db              *gorm.DB
	admin           *user.User
	teacherA        *user.User
	teacherB        *user.User
	studentA        *user.User
	studentB        *user.User
	activeClass     classroom.Class
	disabledClass   classroom.Class
	foreignClass    classroom.Class
	publishedCourse course.Course
	draftCourse     course.Course
	openClawProject project.Project
}

func TestM3AssignmentLifecycleAndVisibility(t *testing.T) {
	fixture := newM3AssignmentFixture(t)
	teacherToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherA.Username, "teacher@123")
	studentAToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.studentA.Username, "student@123")
	studentBToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.studentB.Username, "student@123")

	createResp := createAssignmentViaAPI(t, fixture, teacherToken, map[string]any{
		"title":    "课程任务 1",
		"dueAt":    time.Now().Add(48 * time.Hour).Format(time.RFC3339),
		"classIds": []uint64{fixture.activeClass.ID},
		"resources": []map[string]any{{
			"resourceType": assignment.ResourceTypeCourse,
			"resourceId":   fixture.publishedCourse.ID,
		}},
	})
	if createResp.Code != http.StatusCreated {
		t.Fatalf("expected create assignment 201, got %d: %s", createResp.Code, createResp.Body.String())
	}
	var createAPI apiResponse
	decodeJSON(t, createResp.Body.Bytes(), &createAPI)
	var created assignment.AssignmentDetail
	decodeJSON(t, createAPI.Data, &created)

	draftVisibleResp := performJSON(t, fixture.engine, http.MethodGet, "/api/student/assignments", nil, studentAToken)
	var draftVisibleAPI apiResponse
	decodeJSON(t, draftVisibleResp.Body.Bytes(), &draftVisibleAPI)
	var draftVisible assignment.AssignmentListResponse
	decodeJSON(t, draftVisibleAPI.Data, &draftVisible)
	if draftVisible.Total != 0 {
		t.Fatalf("expected draft assignment hidden from student, got %+v", draftVisible)
	}

	publishResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/assignments/%d/publish", created.ID), nil, teacherToken)
	if publishResp.Code != http.StatusOK {
		t.Fatalf("expected publish assignment 200, got %d: %s", publishResp.Code, publishResp.Body.String())
	}

	studentAResp := performJSON(t, fixture.engine, http.MethodGet, "/api/student/assignments", nil, studentAToken)
	var studentAAPI apiResponse
	decodeJSON(t, studentAResp.Body.Bytes(), &studentAAPI)
	var studentAList assignment.AssignmentListResponse
	decodeJSON(t, studentAAPI.Data, &studentAList)
	if studentAList.Total != 1 || studentAList.List[0].ID != created.ID {
		t.Fatalf("expected target class student to see assignment, got %+v", studentAList)
	}

	studentBResp := performJSON(t, fixture.engine, http.MethodGet, "/api/student/assignments", nil, studentBToken)
	var studentBAPI apiResponse
	decodeJSON(t, studentBResp.Body.Bytes(), &studentBAPI)
	var studentBList assignment.AssignmentListResponse
	decodeJSON(t, studentBAPI.Data, &studentBList)
	if studentBList.Total != 0 {
		t.Fatalf("expected non-class student hidden, got %+v", studentBList)
	}

	closeResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/assignments/%d/close", created.ID), nil, teacherToken)
	if closeResp.Code != http.StatusOK {
		t.Fatalf("expected close assignment 200, got %d: %s", closeResp.Code, closeResp.Body.String())
	}
	detailResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/student/assignments/%d", created.ID), nil, studentAToken)
	if detailResp.Code != http.StatusOK {
		t.Fatalf("expected closed assignment detail still readable, got %d: %s", detailResp.Code, detailResp.Body.String())
	}
	var detailAPI apiResponse
	decodeJSON(t, detailResp.Body.Bytes(), &detailAPI)
	var detail assignment.AssignmentDetail
	decodeJSON(t, detailAPI.Data, &detail)
	if detail.Status != assignment.AssignmentStatusClosed || detail.CanEnter {
		t.Fatalf("expected closed assignment detail with canEnter=false, got %+v", detail)
	}
}

func TestM3StudentClassContextCoursesAndAssignments(t *testing.T) {
	fixture := newM3AssignmentFixture(t)
	teacherToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherA.Username, "teacher@123")
	studentToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.studentA.Username, "student@123")

	lessonOne := course.CourseLesson{CourseID: fixture.publishedCourse.ID, Title: "班级课时 1", Type: 1, SortOrder: 1}
	lessonTwo := course.CourseLesson{CourseID: fixture.publishedCourse.ID, Title: "班级课时 2", Type: 1, SortOrder: 2}
	if err := fixture.db.Create(&[]course.CourseLesson{lessonOne, lessonTwo}).Error; err != nil {
		t.Fatalf("seed lessons failed: %v", err)
	}
	if err := fixture.db.First(&lessonOne, "title = ?", "班级课时 1").Error; err != nil {
		t.Fatalf("reload lesson one failed: %v", err)
	}
	if err := fixture.db.First(&lessonTwo, "title = ?", "班级课时 2").Error; err != nil {
		t.Fatalf("reload lesson two failed: %v", err)
	}

	first := createAndPublishAssignment(t, fixture, teacherToken, "班级课程任务 1", fixture.activeClass.ID, assignment.ResourceTypeCourse, fixture.publishedCourse.ID)
	second := createAndPublishAssignment(t, fixture, teacherToken, "班级课时任务 2", fixture.activeClass.ID, assignment.ResourceTypeCourseLesson, lessonOne.ID)
	third := createAndPublishAssignment(t, fixture, teacherToken, "班级课程任务 3", fixture.activeClass.ID, assignment.ResourceTypeCourse, fixture.publishedCourse.ID)

	now := time.Now()
	if err := fixture.db.Create(&assignment.Submission{
		AssignmentID: first.ID,
		StudentID:    fixture.studentA.ID,
		AttemptNo:    1,
		Status:       assignment.SubmissionStatusSubmitted,
		SubmittedAt:  &now,
	}).Error; err != nil {
		t.Fatalf("seed first submission failed: %v", err)
	}
	assertStudentPendingTasks(t, fixture, studentToken, fixture.activeClass.ID, 2)

	if err := fixture.db.Create(&assignment.Submission{
		AssignmentID: second.ID,
		StudentID:    fixture.studentA.ID,
		AttemptNo:    1,
		Status:       assignment.SubmissionStatusSubmitted,
		SubmittedAt:  &now,
	}).Error; err != nil {
		t.Fatalf("seed second submission failed: %v", err)
	}
	assertStudentPendingTasks(t, fixture, studentToken, fixture.activeClass.ID, 1)

	if err := fixture.db.Create(&assignment.Submission{
		AssignmentID: third.ID,
		StudentID:    fixture.studentA.ID,
		AttemptNo:    1,
		Status:       assignment.SubmissionStatusReturned,
		SubmittedAt:  &now,
		ReturnedAt:   &now,
	}).Error; err != nil {
		t.Fatalf("seed returned submission failed: %v", err)
	}
	assertStudentPendingTasks(t, fixture, studentToken, fixture.activeClass.ID, 1)

	allResp := performJSON(t, fixture.engine, http.MethodGet, "/api/student/assignments", nil, studentToken)
	var allAPI apiResponse
	decodeJSON(t, allResp.Body.Bytes(), &allAPI)
	var allList assignment.AssignmentListResponse
	decodeJSON(t, allAPI.Data, &allList)
	if allList.Total != 3 {
		t.Fatalf("expected all active class assignments without classId, got %+v", allList)
	}

	classResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/student/assignments?classId=%d", fixture.activeClass.ID), nil, studentToken)
	var classAPI apiResponse
	decodeJSON(t, classResp.Body.Bytes(), &classAPI)
	var classList assignment.AssignmentListResponse
	decodeJSON(t, classAPI.Data, &classList)
	if classList.Total != 3 {
		t.Fatalf("expected class filtered assignments, got %+v", classList)
	}

	foreignResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/student/assignments?classId=%d", fixture.foreignClass.ID), nil, studentToken)
	var foreignAPI apiResponse
	decodeJSON(t, foreignResp.Body.Bytes(), &foreignAPI)
	var foreignList assignment.AssignmentListResponse
	decodeJSON(t, foreignAPI.Data, &foreignList)
	if foreignResp.Code != http.StatusOK || foreignList.Total != 0 {
		t.Fatalf("expected foreign class query to return empty 200, code=%d payload=%+v", foreignResp.Code, foreignList)
	}

	if err := fixture.db.Create(&course.UserLessonRecord{
		UserID:    fixture.studentA.ID,
		CourseID:  fixture.publishedCourse.ID,
		LessonID:  lessonOne.ID,
		Status:    course.LessonRecordStatusCompleted,
		StartedAt: &now,
	}).Error; err != nil {
		t.Fatalf("seed lesson progress failed: %v", err)
	}
	assignedResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/student/courses/assigned?classId=%d", fixture.activeClass.ID), nil, studentToken)
	if assignedResp.Code != http.StatusOK {
		t.Fatalf("expected assigned courses 200, got %d: %s", assignedResp.Code, assignedResp.Body.String())
	}
	var assignedAPI apiResponse
	decodeJSON(t, assignedResp.Body.Bytes(), &assignedAPI)
	var assignedCourses []course.AssignedCourse
	decodeJSON(t, assignedAPI.Data, &assignedCourses)
	if len(assignedCourses) != 1 || assignedCourses[0].ID != fixture.publishedCourse.ID || assignedCourses[0].UserProgress != 50 {
		t.Fatalf("expected one assigned course with 50 progress, got %+v", assignedCourses)
	}

	invalidResp := performJSON(t, fixture.engine, http.MethodGet, "/api/student/courses/assigned?classId=999999", nil, studentToken)
	var invalidAPI apiResponse
	decodeJSON(t, invalidResp.Body.Bytes(), &invalidAPI)
	var invalidCourses []course.AssignedCourse
	decodeJSON(t, invalidAPI.Data, &invalidCourses)
	if invalidResp.Code != http.StatusOK || len(invalidCourses) != 0 {
		t.Fatalf("expected invalid class query to return empty 200, code=%d payload=%+v", invalidResp.Code, invalidCourses)
	}
}

func TestM3AssignmentPublishGate(t *testing.T) {
	fixture := newM3AssignmentFixture(t)
	teacherAToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherA.Username, "teacher@123")
	teacherBToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherB.Username, "teacher@123")

	cases := []struct {
		name string
		body map[string]any
	}{
		{
			name: "no class",
			body: map[string]any{
				"title":    "缺班级",
				"classIds": []uint64{},
				"resources": []map[string]any{{
					"resourceType": assignment.ResourceTypeCourse,
					"resourceId":   fixture.publishedCourse.ID,
				}},
			},
		},
		{
			name: "no resource",
			body: map[string]any{
				"title":     "缺资源",
				"classIds":  []uint64{fixture.activeClass.ID},
				"resources": []map[string]any{},
			},
		},
		{
			name: "unpublished resource",
			body: map[string]any{
				"title":    "未发布资源",
				"classIds": []uint64{fixture.activeClass.ID},
				"resources": []map[string]any{{
					"resourceType": assignment.ResourceTypeCourse,
					"resourceId":   fixture.draftCourse.ID,
				}},
			},
		},
		{
			name: "disabled class",
			body: map[string]any{
				"title":    "停用班级",
				"classIds": []uint64{fixture.disabledClass.ID},
				"resources": []map[string]any{{
					"resourceType": assignment.ResourceTypeCourse,
					"resourceId":   fixture.publishedCourse.ID,
				}},
			},
		},
		{
			name: "openclaw tag missing",
			body: map[string]any{
				"title":    "OpenClaw 缺标签",
				"classIds": []uint64{fixture.activeClass.ID},
				"resources": []map[string]any{{
					"resourceType": assignment.ResourceTypeOpenClawProject,
					"resourceId":   fixture.openClawProject.ID,
				}},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			createResp := createAssignmentViaAPI(t, fixture, teacherAToken, tc.body)
			if createResp.Code != http.StatusCreated {
				t.Fatalf("expected create assignment 201, got %d: %s", createResp.Code, createResp.Body.String())
			}
			var createAPI apiResponse
			decodeJSON(t, createResp.Body.Bytes(), &createAPI)
			var created assignment.AssignmentDetail
			decodeJSON(t, createAPI.Data, &created)
			publishResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/assignments/%d/publish", created.ID), nil, teacherAToken)
			if publishResp.Code != http.StatusConflict {
				t.Fatalf("expected publish gate 409, got %d: %s", publishResp.Code, publishResp.Body.String())
			}
			var publishAPI apiResponse
			decodeJSON(t, publishResp.Body.Bytes(), &publishAPI)
			var check assignment.PublishCheckResult
			decodeJSON(t, publishAPI.Data, &check)
			if check.CanPublish || len(check.Errors) == 0 {
				t.Fatalf("expected publish check errors, got %+v", check)
			}
		})
	}

	foreignCreateResp := createAssignmentViaAPI(t, fixture, teacherBToken, map[string]any{
		"title":    "教师 B 班级任务",
		"classIds": []uint64{fixture.foreignClass.ID},
		"resources": []map[string]any{{
			"resourceType": assignment.ResourceTypeCourse,
			"resourceId":   fixture.publishedCourse.ID,
		}},
	})
	if foreignCreateResp.Code != http.StatusCreated {
		t.Fatalf("expected teacher B create assignment 201, got %d: %s", foreignCreateResp.Code, foreignCreateResp.Body.String())
	}
	var foreignCreateAPI apiResponse
	decodeJSON(t, foreignCreateResp.Body.Bytes(), &foreignCreateAPI)
	var foreignCreated assignment.AssignmentDetail
	decodeJSON(t, foreignCreateAPI.Data, &foreignCreated)

	teacherAPublishForeign := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/assignments/%d/publish", foreignCreated.ID), nil, teacherAToken)
	if teacherAPublishForeign.Code != http.StatusForbidden {
		t.Fatalf("expected teacher A forbidden to publish teacher B assignment, got %d: %s", teacherAPublishForeign.Code, teacherAPublishForeign.Body.String())
	}
}

func createAssignmentViaAPI(t *testing.T, fixture *m3AssignmentFixture, token string, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	if _, ok := body["description"]; !ok {
		body["description"] = "测试作业"
	}
	if _, ok := body["rule"]; !ok {
		body["rule"] = map[string]any{
			"attemptLimit":  1,
			"allowLate":     false,
			"allowResubmit": false,
			"scoreMode":     "completion",
		}
	}
	return performJSON(t, fixture.engine, http.MethodPost, "/api/teacher/assignments", body, token)
}

func createAndPublishAssignment(t *testing.T, fixture *m3AssignmentFixture, token, title string, classID uint64, resourceType string, resourceID uint64) assignment.AssignmentDetail {
	t.Helper()
	createResp := createAssignmentViaAPI(t, fixture, token, map[string]any{
		"title":    title,
		"dueAt":    time.Now().Add(48 * time.Hour).Format(time.RFC3339),
		"classIds": []uint64{classID},
		"resources": []map[string]any{{
			"resourceType": resourceType,
			"resourceId":   resourceID,
		}},
	})
	if createResp.Code != http.StatusCreated {
		t.Fatalf("expected create assignment 201, got %d: %s", createResp.Code, createResp.Body.String())
	}
	var createAPI apiResponse
	decodeJSON(t, createResp.Body.Bytes(), &createAPI)
	var created assignment.AssignmentDetail
	decodeJSON(t, createAPI.Data, &created)
	publishResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/assignments/%d/publish", created.ID), nil, token)
	if publishResp.Code != http.StatusOK {
		t.Fatalf("expected publish assignment 200, got %d: %s", publishResp.Code, publishResp.Body.String())
	}
	return created
}

func assertStudentPendingTasks(t *testing.T, fixture *m3AssignmentFixture, token string, classID uint64, expected int64) {
	t.Helper()
	resp := performJSON(t, fixture.engine, http.MethodGet, "/api/student/classes", nil, token)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected student classes 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var api apiResponse
	decodeJSON(t, resp.Body.Bytes(), &api)
	var classes []classroom.ClassListItem
	decodeJSON(t, api.Data, &classes)
	for _, item := range classes {
		if item.ID == classID {
			if item.PendingTaskCount != expected {
				t.Fatalf("expected pendingTaskCount=%d, got %d in %+v", expected, item.PendingTaskCount, item)
			}
			return
		}
	}
	t.Fatalf("class %d not found in student classes: %+v", classID, classes)
}

func newM3AssignmentFixture(t *testing.T) *m3AssignmentFixture {
	t.Helper()
	gin.SetMode(gin.TestMode)

	dbPath := filepath.Join(t.TempDir(), "m3-assignment-test.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := db.AutoMigrate(
		&user.User{},
		&course.Course{},
		&course.CourseStage{},
		&course.CourseLesson{},
		&course.UserLessonRecord{},
		&project.Project{},
		&project.ProjectUnit{},
		&project.Tag{},
		&project.ProjectTag{},
		&agent.AgentManual{},
		&agent.AgentStep{},
		&agent.UserAgentProgress{},
		&lab.UserLabSession{},
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
		&assignment.Notification{},
		&assignment.TeacherActionLog{},
		&assignment.SubmissionReopen{},
	); err != nil {
		t.Fatalf("auto migrate m3 assignment models failed: %v", err)
	}

	userService := user.NewService(db, zap.NewNop())
	admin := mustCreateUser(t, userService, "m3-admin", "m3-admin@example.com", "系统管理员", user.RoleAdmin)
	teacherA := mustCreateUser(t, userService, "m3-teacher-a", "m3-teacher-a@example.com", "教师 A", user.RoleTeacher)
	teacherB := mustCreateUser(t, userService, "m3-teacher-b", "m3-teacher-b@example.com", "教师 B", user.RoleTeacher)
	studentA := mustCreateUser(t, userService, "m3-student-a", "m3-student-a@example.com", "学生 A", user.RoleStudent)
	studentB := mustCreateUser(t, userService, "m3-student-b", "m3-student-b@example.com", "学生 B", user.RoleStudent)

	term := classroom.Term{Name: "2026 春季学期", Code: "M3-SPRING", Status: classroom.TermStatusActive, CreatedBy: admin.ID}
	if err := db.Create(&term).Error; err != nil {
		t.Fatalf("seed term failed: %v", err)
	}
	activeClass := classroom.Class{TermID: term.ID, Name: "M3 一班", Code: "M3-A", OwnerTeacherID: teacherA.ID, Status: classroom.ClassStatusActive, CreatedBy: teacherA.ID}
	disabledClass := classroom.Class{TermID: term.ID, Name: "M3 停用班", Code: "M3-D", OwnerTeacherID: teacherA.ID, Status: classroom.ClassStatusDisabled, CreatedBy: teacherA.ID}
	foreignClass := classroom.Class{TermID: term.ID, Name: "M3 B 班", Code: "M3-B", OwnerTeacherID: teacherB.ID, Status: classroom.ClassStatusActive, CreatedBy: teacherB.ID}
	if err := db.Create(&[]classroom.Class{activeClass, disabledClass, foreignClass}).Error; err != nil {
		t.Fatalf("seed classes failed: %v", err)
	}
	if err := db.First(&activeClass, "code = ?", "M3-A").Error; err != nil {
		t.Fatalf("reload active class failed: %v", err)
	}
	if err := db.First(&disabledClass, "code = ?", "M3-D").Error; err != nil {
		t.Fatalf("reload disabled class failed: %v", err)
	}
	if err := db.First(&foreignClass, "code = ?", "M3-B").Error; err != nil {
		t.Fatalf("reload foreign class failed: %v", err)
	}
	now := time.Now()
	if err := db.Create(&[]classroom.ClassMember{
		{ClassID: activeClass.ID, UserID: studentA.ID, Status: classroom.ClassMemberStatusActive, JoinedAt: &now},
		{ClassID: foreignClass.ID, UserID: studentB.ID, Status: classroom.ClassMemberStatusActive, JoinedAt: &now},
	}).Error; err != nil {
		t.Fatalf("seed class members failed: %v", err)
	}

	publishedCourse := course.Course{Title: "已发布课程", Slug: "m3-published-course", Status: course.CourseStatusPublished, CreatorID: teacherA.ID}
	draftCourse := course.Course{Title: "草稿课程", Slug: "m3-draft-course", Status: course.CourseStatusDraft, CreatorID: teacherA.ID}
	if err := db.Create(&[]course.Course{publishedCourse, draftCourse}).Error; err != nil {
		t.Fatalf("seed courses failed: %v", err)
	}
	if err := db.First(&publishedCourse, "slug = ?", "m3-published-course").Error; err != nil {
		t.Fatalf("reload published course failed: %v", err)
	}
	if err := db.First(&draftCourse, "slug = ?", "m3-draft-course").Error; err != nil {
		t.Fatalf("reload draft course failed: %v", err)
	}
	openClawProject := project.Project{Title: "OpenClaw 无标签项目", Slug: "m3-openclaw-missing-tag", Status: project.ProjectStatusPublished, CreatedBy: teacherA.ID}
	if err := db.Create(&openClawProject).Error; err != nil {
		t.Fatalf("seed openclaw project failed: %v", err)
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

	return &m3AssignmentFixture{
		engine:          engine,
		db:              db,
		admin:           admin,
		teacherA:        teacherA,
		teacherB:        teacherB,
		studentA:        studentA,
		studentB:        studentB,
		activeClass:     activeClass,
		disabledClass:   disabledClass,
		foreignClass:    foreignClass,
		publishedCourse: publishedCourse,
		draftCourse:     draftCourse,
		openClawProject: openClawProject,
	}
}

func mustCreateUser(t *testing.T, service *user.Service, username, email, fullName string, role user.RoleType) *user.User {
	t.Helper()
	password := "student@123"
	if role == user.RoleTeacher {
		password = "teacher@123"
	}
	if role == user.RoleAdmin {
		password = "admin@123"
	}
	created, err := service.Create(user.CreateParams{
		Username: username,
		Email:    email,
		Password: password,
		FullName: fullName,
		RoleType: role,
	})
	if err != nil {
		t.Fatalf("seed user %s failed: %v", username, err)
	}
	return created
}
