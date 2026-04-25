package router_test

import (
	"fmt"
	"net/http"
	"testing"

	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/user"
)

func TestTeacherCourseAndProjectReadRoutesAreScopedByOwner(t *testing.T) {
	fixture := newPhase3Fixture(t)

	teacherA, err := fixture.authFixture.service.Create(user.CreateParams{
		Username: "teacher-a",
		Email:    "teacher-a@example.com",
		Password: "teacher@123",
		FullName: "教师 A",
		RoleType: user.RoleTeacher,
	})
	if err != nil {
		t.Fatalf("seed teacher A failed: %v", err)
	}
	teacherB, err := fixture.authFixture.service.Create(user.CreateParams{
		Username: "teacher-b",
		Email:    "teacher-b@example.com",
		Password: "teacher@123",
		FullName: "教师 B",
		RoleType: user.RoleTeacher,
	})
	if err != nil {
		t.Fatalf("seed teacher B failed: %v", err)
	}

	ownedCourse := &course.Course{
		Title:          "教师 A 课程",
		Slug:           "teacher-a-course",
		Description:    "教师 A 可见",
		Difficulty:     2,
		TotalLessons:   1,
		EstimatedHours: 1,
		Status:         course.CourseStatusPublished,
		CreatorID:      teacherA.ID,
	}
	if err := fixture.db.Create(ownedCourse).Error; err != nil {
		t.Fatalf("seed owned course failed: %v", err)
	}
	ownedStage := &course.CourseStage{
		CourseID:  ownedCourse.ID,
		Title:     "A 阶段",
		SortOrder: 1,
	}
	if err := fixture.db.Create(ownedStage).Error; err != nil {
		t.Fatalf("seed owned stage failed: %v", err)
	}
	ownedLesson := &course.CourseLesson{
		CourseID:  ownedCourse.ID,
		StageID:   ownedStage.ID,
		Title:     "A 课时",
		Type:      1,
		Points:    10,
		SortOrder: 1,
	}
	if err := fixture.db.Create(ownedLesson).Error; err != nil {
		t.Fatalf("seed owned lesson failed: %v", err)
	}
	if err := fixture.db.Create(&course.LessonMaterial{
		LessonID:  ownedLesson.ID,
		Title:     "A 资料",
		Type:      1,
		FileURL:   "/uploads/materials/a.md",
		FileName:  "a.md",
		FileSize:  16,
		SortOrder: 1,
	}).Error; err != nil {
		t.Fatalf("seed owned lesson material failed: %v", err)
	}

	foreignCourse := &course.Course{
		Title:          "教师 B 课程",
		Slug:           "teacher-b-course",
		Description:    "教师 B 可见",
		Difficulty:     3,
		TotalLessons:   1,
		EstimatedHours: 1,
		Status:         course.CourseStatusPublished,
		CreatorID:      teacherB.ID,
	}
	if err := fixture.db.Create(foreignCourse).Error; err != nil {
		t.Fatalf("seed foreign course failed: %v", err)
	}
	foreignStage := &course.CourseStage{
		CourseID:  foreignCourse.ID,
		Title:     "B 阶段",
		SortOrder: 1,
	}
	if err := fixture.db.Create(foreignStage).Error; err != nil {
		t.Fatalf("seed foreign stage failed: %v", err)
	}
	foreignLesson := &course.CourseLesson{
		CourseID:  foreignCourse.ID,
		StageID:   foreignStage.ID,
		Title:     "B 课时",
		Type:      1,
		Points:    10,
		SortOrder: 1,
	}
	if err := fixture.db.Create(foreignLesson).Error; err != nil {
		t.Fatalf("seed foreign lesson failed: %v", err)
	}
	if err := fixture.db.Create(&course.LessonMaterial{
		LessonID:  foreignLesson.ID,
		Title:     "B 资料",
		Type:      1,
		FileURL:   "/uploads/materials/b.md",
		FileName:  "b.md",
		FileSize:  16,
		SortOrder: 1,
	}).Error; err != nil {
		t.Fatalf("seed foreign lesson material failed: %v", err)
	}

	ownedProject := &project.Project{
		Title:      "教师 A 项目",
		Slug:       "teacher-a-project",
		Status:     project.ProjectStatusPublished,
		Difficulty: 2,
		CreatedBy:  teacherA.ID,
	}
	if err := fixture.db.Create(ownedProject).Error; err != nil {
		t.Fatalf("seed owned project failed: %v", err)
	}
	if err := fixture.db.Create(&project.ProjectUnit{
		ProjectID:   ownedProject.ID,
		Title:       "A 单元",
		Type:        1,
		ModeGroup:   1,
		Points:      10,
		SortOrder:   1,
		Description: "owned",
	}).Error; err != nil {
		t.Fatalf("seed owned project unit failed: %v", err)
	}

	foreignProject := &project.Project{
		Title:      "教师 B 项目",
		Slug:       "teacher-b-project",
		Status:     project.ProjectStatusPublished,
		Difficulty: 2,
		CreatedBy:  teacherB.ID,
	}
	if err := fixture.db.Create(foreignProject).Error; err != nil {
		t.Fatalf("seed foreign project failed: %v", err)
	}
	if err := fixture.db.Create(&project.ProjectUnit{
		ProjectID:   foreignProject.ID,
		Title:       "B 单元",
		Type:        1,
		ModeGroup:   1,
		Points:      10,
		SortOrder:   1,
		Description: "foreign",
	}).Error; err != nil {
		t.Fatalf("seed foreign project unit failed: %v", err)
	}

	teacherAToken := mustLogin(t, fixture.authFixture, teacherA.Username, "teacher@123")
	adminToken := mustLogin(t, fixture.authFixture, fixture.authFixture.admin.Username, "admin@123")

	courseListResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/courses?page=1&pageSize=10", nil, teacherAToken)
	if courseListResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for teacher course list, got %d: %s", courseListResp.Code, courseListResp.Body.String())
	}
	var courseAPI apiResponse
	decodeJSON(t, courseListResp.Body.Bytes(), &courseAPI)
	var coursePage courseListPayload
	decodeJSON(t, courseAPI.Data, &coursePage)
	if coursePage.Total != 1 || len(coursePage.List) != 1 || coursePage.List[0].ID != ownedCourse.ID {
		t.Fatalf("expected teacher to see only owned course, got %+v", coursePage)
	}

	ownedCourseResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/courses/%d", ownedCourse.ID), nil, teacherAToken)
	if ownedCourseResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for owned course detail, got %d: %s", ownedCourseResp.Code, ownedCourseResp.Body.String())
	}

	foreignCourseResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/courses/%d", foreignCourse.ID), nil, teacherAToken)
	if foreignCourseResp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for foreign course detail, got %d: %s", foreignCourseResp.Code, foreignCourseResp.Body.String())
	}

	foreignLessonResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/courses/lessons/%d", foreignLesson.ID), nil, teacherAToken)
	if foreignLessonResp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for foreign lesson detail, got %d: %s", foreignLessonResp.Code, foreignLessonResp.Body.String())
	}

	foreignMaterialResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/courses/lessons/%d/materials", foreignLesson.ID), nil, teacherAToken)
	if foreignMaterialResp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for foreign lesson materials, got %d: %s", foreignMaterialResp.Code, foreignMaterialResp.Body.String())
	}

	adminCourseResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/courses/%d", foreignCourse.ID), nil, adminToken)
	if adminCourseResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin teacher course detail, got %d: %s", adminCourseResp.Code, adminCourseResp.Body.String())
	}

	projectListResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/projects?page=1&pageSize=10", nil, teacherAToken)
	if projectListResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for teacher project list, got %d: %s", projectListResp.Code, projectListResp.Body.String())
	}
	var projectAPI apiResponse
	decodeJSON(t, projectListResp.Body.Bytes(), &projectAPI)
	var projectPage projectListPayload
	decodeJSON(t, projectAPI.Data, &projectPage)
	if projectPage.Total != 1 || len(projectPage.List) != 1 || projectPage.List[0].ID != ownedProject.ID {
		t.Fatalf("expected teacher to see only owned project, got %+v", projectPage)
	}

	foreignProjectResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/projects/%d", foreignProject.ID), nil, teacherAToken)
	if foreignProjectResp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for foreign project detail, got %d: %s", foreignProjectResp.Code, foreignProjectResp.Body.String())
	}

	foreignProjectUnitsResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/projects/%d/units", foreignProject.ID), nil, teacherAToken)
	if foreignProjectUnitsResp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for foreign project units, got %d: %s", foreignProjectUnitsResp.Code, foreignProjectUnitsResp.Body.String())
	}

	adminProjectUnitsResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/projects/%d/units", foreignProject.ID), nil, adminToken)
	if adminProjectUnitsResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin teacher project units, got %d: %s", adminProjectUnitsResp.Code, adminProjectUnitsResp.Body.String())
	}

	publicCourseResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/courses/%d", foreignCourse.ID), nil, "")
	if publicCourseResp.Code != http.StatusOK {
		t.Fatalf("expected public course route to stay readable, got %d: %s", publicCourseResp.Code, publicCourseResp.Body.String())
	}

	publicProjectResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/projects/%d", foreignProject.ID), nil, "")
	if publicProjectResp.Code != http.StatusOK {
		t.Fatalf("expected public project route to stay readable, got %d: %s", publicProjectResp.Code, publicProjectResp.Body.String())
	}
}
