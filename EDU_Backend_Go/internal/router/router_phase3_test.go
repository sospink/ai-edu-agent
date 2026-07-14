package router_test

import (
	"bytes"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"edu-platform/internal/app"
	"edu-platform/internal/config"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/user"
	"edu-platform/internal/router"
)

type courseListPayload struct {
	List     []course.Course `json:"list"`
	Total    int64           `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"pageSize"`
}

type projectListPayload struct {
	List     []project.ProjectDetail `json:"list"`
	Total    int64                   `json:"total"`
	Page     int                     `json:"page"`
	PageSize int                     `json:"pageSize"`
}

func TestCourseAndProjectPublicReadRoutes(t *testing.T) {
	fixture := newPhase3Fixture(t)

	courseResp := performJSON(t, fixture.engine, http.MethodGet, "/api/courses?page=1&pageSize=10", nil, "")
	if courseResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for courses list, got %d: %s", courseResp.Code, courseResp.Body.String())
	}
	var courseAPI apiResponse
	decodeJSON(t, courseResp.Body.Bytes(), &courseAPI)
	if !courseAPI.Success {
		t.Fatalf("expected success for courses list, got %+v", courseAPI)
	}
	var coursePage courseListPayload
	decodeJSON(t, courseAPI.Data, &coursePage)
	if coursePage.Total != 1 || len(coursePage.List) != 1 {
		t.Fatalf("unexpected course list payload: %+v", coursePage)
	}

	detailResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/courses/%d", fixture.course.ID), nil, "")
	if detailResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for course detail, got %d", detailResp.Code)
	}
	decodeJSON(t, detailResp.Body.Bytes(), &courseAPI)
	if !courseAPI.Success {
		t.Fatalf("expected course detail success, got %+v", courseAPI)
	}
	var courseDetail course.CourseDetail
	decodeJSON(t, courseAPI.Data, &courseDetail)
	if len(courseDetail.Stages) != 1 || len(courseDetail.Stages[0].Lessons) != 2 {
		t.Fatalf("expected nested course detail, got %+v", courseDetail)
	}

	projectResp := performJSON(t, fixture.engine, http.MethodGet, "/api/projects?page=1&pageSize=10", nil, "")
	if projectResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for projects list, got %d", projectResp.Code)
	}
	var projectAPI apiResponse
	decodeJSON(t, projectResp.Body.Bytes(), &projectAPI)
	if !projectAPI.Success {
		t.Fatalf("expected project list success, got %+v", projectAPI)
	}
	var projectPage projectListPayload
	decodeJSON(t, projectAPI.Data, &projectPage)
	if projectPage.Total != 1 || len(projectPage.List) != 1 || len(projectPage.List[0].Tags) != 1 {
		t.Fatalf("unexpected project list payload: %+v", projectPage)
	}
	tagsResp := performJSON(t, fixture.engine, http.MethodGet, "/api/tags", nil, "")
	if tagsResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for tags list, got %d", tagsResp.Code)
	}
}

func TestLearningRoutesAndCourseProgress(t *testing.T) {
	fixture := newPhase3Fixture(t)
	token := mustLogin(t, fixture.authFixture, fixture.authFixture.student.Username, "student@123")

	enrollResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/courses/%d/enroll", fixture.course.ID), nil, token)
	if enrollResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for enroll, got %d: %s", enrollResp.Code, enrollResp.Body.String())
	}

	startResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/courses/lessons/%d/start", fixture.lesson1.ID), map[string]any{}, token)
	if startResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for start lesson, got %d: %s", startResp.Code, startResp.Body.String())
	}

	completeResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/courses/lessons/%d/complete", fixture.lesson1.ID), map[string]any{
		"score": 95,
	}, token)
	if completeResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for complete lesson, got %d: %s", completeResp.Code, completeResp.Body.String())
	}
	var completeAPI apiResponse
	decodeJSON(t, completeResp.Body.Bytes(), &completeAPI)
	if !completeAPI.Success {
		t.Fatalf("expected complete lesson success, got %+v", completeAPI)
	}
	var completePayload course.CompleteLessonPayload
	decodeJSON(t, completeAPI.Data, &completePayload)
	if completePayload.EarnedXP != fixture.lesson1.Points {
		t.Fatalf("expected earned xp %d, got %+v", fixture.lesson1.Points, completePayload)
	}

	progressResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/courses/%d/progress", fixture.course.ID), nil, token)
	if progressResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for course progress, got %d", progressResp.Code)
	}
	var progressAPI apiResponse
	decodeJSON(t, progressResp.Body.Bytes(), &progressAPI)
	if !progressAPI.Success {
		t.Fatalf("expected progress success, got %+v", progressAPI)
	}
	var records []course.UserLessonRecord
	decodeJSON(t, progressAPI.Data, &records)
	if len(records) != 1 || records[0].Status != course.LessonRecordStatusCompleted {
		t.Fatalf("unexpected lesson records: %+v", records)
	}

	enrollmentsResp := performJSON(t, fixture.engine, http.MethodGet, "/api/learning/enrollments", nil, token)
	if enrollmentsResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for learning enrollments, got %d", enrollmentsResp.Code)
	}
	var enrollmentsAPI apiResponse
	decodeJSON(t, enrollmentsResp.Body.Bytes(), &enrollmentsAPI)
	if !enrollmentsAPI.Success {
		t.Fatalf("expected enrollments success, got %+v", enrollmentsAPI)
	}
	var enrollments []course.EnrollmentWithCourse
	decodeJSON(t, enrollmentsAPI.Data, &enrollments)
	if len(enrollments) != 1 || enrollments[0].ProgressPercent != 50 {
		t.Fatalf("unexpected enrollments payload: %+v", enrollments)
	}

	continueResp := performJSON(t, fixture.engine, http.MethodGet, "/api/learning/continue", nil, token)
	if continueResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for continue learning, got %d", continueResp.Code)
	}
	var continueAPI apiResponse
	decodeJSON(t, continueResp.Body.Bytes(), &continueAPI)
	if !continueAPI.Success {
		t.Fatalf("expected continue success, got %+v", continueAPI)
	}
	var continuePayload *course.ContinueLearningPayload
	decodeJSON(t, continueAPI.Data, &continuePayload)
	if continuePayload == nil || continuePayload.NextLesson == nil || continuePayload.NextLesson.ID != fixture.lesson2.ID {
		t.Fatalf("unexpected continue payload: %+v", continuePayload)
	}

	activityResp := performJSON(t, fixture.engine, http.MethodGet, "/api/learning/activity?days=30", nil, token)
	if activityResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for activity logs, got %d", activityResp.Code)
	}
	var activityAPI apiResponse
	decodeJSON(t, activityResp.Body.Bytes(), &activityAPI)
	if !activityAPI.Success {
		t.Fatalf("expected activity success, got %+v", activityAPI)
	}
	var logs []course.UserActivityLog
	decodeJSON(t, activityAPI.Data, &logs)
	if len(logs) != 1 || logs[0].ContributionCount != 1 {
		t.Fatalf("unexpected activity logs: %+v", logs)
	}
}

type phase3Fixture struct {
	engine      http.Handler
	db          *gorm.DB
	authFixture *testFixture
	course      *course.Course
	stage       *course.CourseStage
	lesson1     *course.CourseLesson
	lesson2     *course.CourseLesson
	project     *project.Project
	projectUnit *project.ProjectUnit
	tag         *project.Tag
}

func newPhase3Fixture(t *testing.T) *phase3Fixture {
	t.Helper()

	gin.SetMode(gin.TestMode)

	dbPath := filepath.Join(t.TempDir(), "phase3-test.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := db.AutoMigrate(
		&user.User{},
		&course.Course{},
		&course.CourseStage{},
		&course.CourseLesson{},
		&course.Skill{},
		&course.LessonSkill{},
		&course.LessonMaterial{},
		&course.UserCourseEnrollment{},
		&course.UserLessonRecord{},
		&course.UserActivityLog{},
		&project.Project{},
		&project.ProjectUnit{},
		&project.Tag{},
		&project.ProjectTag{},
	); err != nil {
		t.Fatalf("auto migrate phase3 models failed: %v", err)
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

	courseRecord := &course.Course{
		Title:          "Go 云原生课程",
		Slug:           "go-cloud",
		Description:    "课程详情",
		IconURL:        "/icons/go.png",
		CoverColor:     "#0ea5e9",
		Difficulty:     2,
		TotalLessons:   2,
		TotalSkills:    1,
		EstimatedHours: 2,
		Status:         course.CourseStatusPublished,
		EnvImage:       "edu-env:v1",
		IDEImage:       "edu-ide:v1",
	}
	if err := db.Create(courseRecord).Error; err != nil {
		t.Fatalf("seed course failed: %v", err)
	}
	stageRecord := &course.CourseStage{
		CourseID:    courseRecord.ID,
		Title:       "第一阶段",
		Description: "基础",
		SortOrder:   1,
		LevelLabel:  "BEGINNER",
	}
	if err := db.Create(stageRecord).Error; err != nil {
		t.Fatalf("seed stage failed: %v", err)
	}
	lesson1 := &course.CourseLesson{
		CourseID:        courseRecord.ID,
		StageID:         stageRecord.ID,
		Title:           "第一课",
		Type:            1,
		DurationMinutes: 30,
		LabIdentifier:   "lab-1",
		Points:          20,
		SortOrder:       1,
	}
	lesson2 := &course.CourseLesson{
		CourseID:        courseRecord.ID,
		StageID:         stageRecord.ID,
		Title:           "第二课",
		Type:            4,
		DurationMinutes: 20,
		LabIdentifier:   "text-2",
		Points:          15,
		SortOrder:       2,
	}
	if err := db.Create(lesson1).Error; err != nil {
		t.Fatalf("seed lesson1 failed: %v", err)
	}
	if err := db.Create(lesson2).Error; err != nil {
		t.Fatalf("seed lesson2 failed: %v", err)
	}
	skill := &course.Skill{Name: "Go", Category: "Backend"}
	if err := db.Create(skill).Error; err != nil {
		t.Fatalf("seed skill failed: %v", err)
	}
	if err := db.Create(&course.LessonSkill{LessonID: lesson1.ID, SkillID: skill.ID}).Error; err != nil {
		t.Fatalf("seed lesson skill failed: %v", err)
	}
	if err := db.Create(&course.LessonMaterial{
		LessonID:  lesson2.ID,
		Title:     "讲义",
		Type:      1,
		FileURL:   "/uploads/materials/doc.md",
		FileName:  "doc.md",
		FileSize:  128,
		SortOrder: 1,
	}).Error; err != nil {
		t.Fatalf("seed lesson material failed: %v", err)
	}

	projectRecord := &project.Project{
		Title:           "Go 项目实战",
		Slug:            "go-project-practice",
		Subtitle:        "项目副标题",
		CoverURL:        "/covers/p1.png",
		Difficulty:      2,
		Status:          project.ProjectStatusPublished,
		Description:     "项目描述",
		LearningGoals:   []string{"掌握 Go", "掌握 K8S"},
		Prerequisites:   []string{"Linux"},
		LabsCount:       1,
		ChallengesCount: 0,
		StudentsCount:   3,
		EnvImage:        "env:v1",
		IDEImage:        "ide:v1",
		CreatedBy:       admin.ID,
	}
	if err := db.Create(projectRecord).Error; err != nil {
		t.Fatalf("seed project failed: %v", err)
	}
	projectUnit := &project.ProjectUnit{
		ProjectID:   projectRecord.ID,
		Title:       "项目单元",
		Description: "单元描述",
		Type:        1,
		ModeGroup:   1,
		EnvID:       "env-1",
		TimeLimit:   45,
		Points:      30,
		SortOrder:   1,
		IsHidden:    0,
	}
	if err := db.Create(projectUnit).Error; err != nil {
		t.Fatalf("seed project unit failed: %v", err)
	}
	tag := &project.Tag{Name: "Go", StyleColor: "#3B82F6"}
	if err := db.Create(tag).Error; err != nil {
		t.Fatalf("seed tag failed: %v", err)
	}
	if err := db.Create(&project.ProjectTag{ProjectID: projectRecord.ID, TagID: tag.ID}).Error; err != nil {
		t.Fatalf("seed project tag failed: %v", err)
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

	return &phase3Fixture{
		engine: engine,
		db:     db,
		authFixture: &testFixture{
			engine:  engine,
			db:      db,
			service: userService,
			admin:   admin,
			student: student,
		},
		course:      courseRecord,
		stage:       stageRecord,
		lesson1:     lesson1,
		lesson2:     lesson2,
		project:     projectRecord,
		projectUnit: projectUnit,
		tag:         tag,
	}
}

func TestTagCrudRoutes(t *testing.T) {
	fixture := newPhase3Fixture(t)
	token := mustLogin(t, fixture.authFixture, fixture.authFixture.admin.Username, "admin@123")

	createResp := performJSON(t, fixture.engine, http.MethodPost, "/api/tags", map[string]any{
		"name":       "K8S",
		"styleColor": "#16a34a",
	}, token)
	if createResp.Code != http.StatusCreated {
		t.Fatalf("expected 201 for create tag, got %d: %s", createResp.Code, createResp.Body.String())
	}

	var payload apiResponse
	decodeJSON(t, createResp.Body.Bytes(), &payload)
	if !payload.Success {
		t.Fatalf("expected create tag success, got %+v", payload)
	}
	var tag project.Tag
	decodeJSON(t, payload.Data, &tag)

	updateResp := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/tags/%d", tag.ID), map[string]any{
		"name": "Kubernetes",
	}, token)
	if updateResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for update tag, got %d", updateResp.Code)
	}

	deleteResp := performJSON(t, fixture.engine, http.MethodDelete, fmt.Sprintf("/api/tags/%d", tag.ID), nil, token)
	if deleteResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for delete tag, got %d", deleteResp.Code)
	}
}

func TestCourseManagementAndMaterialWriteRoutes(t *testing.T) {
	fixture := newPhase3Fixture(t)
	token := mustLogin(t, fixture.authFixture, fixture.authFixture.admin.Username, "admin@123")

	createCourseResp := performJSON(t, fixture.engine, http.MethodPost, "/api/courses", map[string]any{
		"title":          "新的课程",
		"slug":           "new-course",
		"description":    "课程描述",
		"iconUrl":        "/icons/new.svg",
		"coverColor":     "#22c55e",
		"difficulty":     1,
		"status":         1,
		"estimatedHours": 1,
	}, token)
	if createCourseResp.Code != http.StatusCreated {
		t.Fatalf("expected 201 for create course, got %d: %s", createCourseResp.Code, createCourseResp.Body.String())
	}
	var createCourseAPI apiResponse
	decodeJSON(t, createCourseResp.Body.Bytes(), &createCourseAPI)
	var createdCourse course.Course
	decodeJSON(t, createCourseAPI.Data, &createdCourse)

	stageResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/courses/%d/stages", createdCourse.ID), map[string]any{
		"title":       "新阶段",
		"description": "阶段描述",
		"sortOrder":   0,
		"levelLabel":  "BEGINNER",
	}, token)
	if stageResp.Code != http.StatusCreated {
		t.Fatalf("expected 201 for create stage, got %d: %s", stageResp.Code, stageResp.Body.String())
	}
	var stageAPI apiResponse
	decodeJSON(t, stageResp.Body.Bytes(), &stageAPI)
	var createdStage course.CourseStage
	decodeJSON(t, stageAPI.Data, &createdStage)

	lessonResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/courses/%d/stages/%d/lessons", createdCourse.ID, createdStage.ID), map[string]any{
		"title":           "新课时",
		"type":            4,
		"durationMinutes": 25,
		"points":          12,
		"sortOrder":       0,
	}, token)
	if lessonResp.Code != http.StatusCreated {
		t.Fatalf("expected 201 for create lesson, got %d: %s", lessonResp.Code, lessonResp.Body.String())
	}
	var lessonAPI apiResponse
	decodeJSON(t, lessonResp.Body.Bytes(), &lessonAPI)
	var createdLesson course.CourseLesson
	decodeJSON(t, lessonAPI.Data, &createdLesson)

	tempFile := filepath.Join(t.TempDir(), "material.md")
	if err := os.WriteFile(tempFile, []byte("# lesson material"), 0o644); err != nil {
		t.Fatalf("write temp material failed: %v", err)
	}
	uploadResp := performMultipartFile(
		t,
		fixture.engine,
		http.MethodPost,
		fmt.Sprintf("/api/courses/lessons/%d/materials", createdLesson.ID),
		"material",
		tempFile,
		map[string]string{"title": "课时资料"},
		token,
	)
	if uploadResp.Code != http.StatusCreated {
		t.Fatalf("expected 201 for upload material, got %d: %s", uploadResp.Code, uploadResp.Body.String())
	}
	var uploadAPI apiResponse
	decodeJSON(t, uploadResp.Body.Bytes(), &uploadAPI)
	var material course.LessonMaterial
	decodeJSON(t, uploadAPI.Data, &material)
	if material.FileURL == "" {
		t.Fatalf("expected uploaded material file url, got %+v", material)
	}

	updateMaterialResp := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/courses/materials/%d", material.ID), map[string]any{
		"title": "已更新资料",
	}, token)
	if updateMaterialResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for update material, got %d: %s", updateMaterialResp.Code, updateMaterialResp.Body.String())
	}

	deleteLessonResp := performJSON(t, fixture.engine, http.MethodDelete, fmt.Sprintf("/api/courses/%d/lessons/%d", createdCourse.ID, createdLesson.ID), nil, token)
	if deleteLessonResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for delete lesson, got %d: %s", deleteLessonResp.Code, deleteLessonResp.Body.String())
	}
}

func TestProjectAndUnitWriteRoutes(t *testing.T) {
	fixture := newPhase3Fixture(t)
	token := mustLogin(t, fixture.authFixture, fixture.authFixture.admin.Username, "admin@123")

	createProjectResp := performJSON(t, fixture.engine, http.MethodPost, "/api/projects", map[string]any{
		"title":         "新的项目",
		"slug":          "new-project",
		"subtitle":      "项目副标题",
		"coverUrl":      "/cover.png",
		"difficulty":    1,
		"status":        1,
		"description":   "项目描述",
		"learningGoals": []string{"学习 Go"},
		"prerequisites": []string{"Linux"},
		"tagIds":        []uint64{fixture.tag.ID},
	}, token)
	if createProjectResp.Code != http.StatusCreated {
		t.Fatalf("expected 201 for create project, got %d: %s", createProjectResp.Code, createProjectResp.Body.String())
	}
	var projectAPI apiResponse
	decodeJSON(t, createProjectResp.Body.Bytes(), &projectAPI)
	var createdProject project.Project
	decodeJSON(t, projectAPI.Data, &createdProject)

	unitResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/projects/%d/units", createdProject.ID), map[string]any{
		"title":       "新单元",
		"description": "单元描述",
		"type":        1,
		"modeGroup":   1,
		"envId":       "env-test",
		"timeLimit":   45,
		"points":      10,
		"sortOrder":   0,
		"isHidden":    0,
	}, token)
	if unitResp.Code != http.StatusCreated {
		t.Fatalf("expected 201 for create unit, got %d: %s", unitResp.Code, unitResp.Body.String())
	}
	var unitAPI apiResponse
	decodeJSON(t, unitResp.Body.Bytes(), &unitAPI)
	var createdUnit project.ProjectUnit
	decodeJSON(t, unitAPI.Data, &createdUnit)

	updateProjectResp := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/projects/%d", createdProject.ID), map[string]any{
		"title": "更新后的项目",
	}, token)
	if updateProjectResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for update project, got %d: %s", updateProjectResp.Code, updateProjectResp.Body.String())
	}

	reorderResp := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/projects/%d/units/reorder", createdProject.ID), map[string]any{
		"orders": []map[string]any{{"id": createdUnit.ID, "sortOrder": 2}},
	}, token)
	if reorderResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for reorder units, got %d: %s", reorderResp.Code, reorderResp.Body.String())
	}

	deleteProjectResp := performJSON(t, fixture.engine, http.MethodDelete, fmt.Sprintf("/api/projects/%d", createdProject.ID), nil, token)
	if deleteProjectResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for delete project, got %d: %s", deleteProjectResp.Code, deleteProjectResp.Body.String())
	}
}

func performMultipartFile(
	t *testing.T,
	handler http.Handler,
	method, target, fieldName, filePath string,
	fields map[string]string,
	token string,
) *httptest.ResponseRecorder {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	fileWriter, err := writer.CreateFormFile(fieldName, filepath.Base(filePath))
	if err != nil {
		t.Fatalf("create form file failed: %v", err)
	}
	content, err := os.ReadFile(filePath)
	if err != nil {
		t.Fatalf("read file failed: %v", err)
	}
	if _, err := fileWriter.Write(content); err != nil {
		t.Fatalf("write form file failed: %v", err)
	}
	for key, value := range fields {
		if err := writer.WriteField(key, value); err != nil {
			t.Fatalf("write field failed: %v", err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer failed: %v", err)
	}

	req := httptest.NewRequest(method, target, body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, req)
	return recorder
}
