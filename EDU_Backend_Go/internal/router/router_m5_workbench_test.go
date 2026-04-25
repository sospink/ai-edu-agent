package router_test

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"edu-platform/internal/domain/assignment"
)

func TestM5WorkbenchNotificationsReopenAndGrades(t *testing.T) {
	fixture := newM3AssignmentFixture(t)
	teacherToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherA.Username, "teacher@123")
	teacherBToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherB.Username, "teacher@123")
	studentToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.studentA.Username, "student@123")
	studentBToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.studentB.Username, "student@123")
	adminToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.admin.Username, "admin@123")

	createResp := createAssignmentViaAPI(t, fixture, teacherToken, map[string]any{
		"title":    "M5 教学工作台任务",
		"classIds": []uint64{fixture.activeClass.ID},
		"resources": []map[string]any{{
			"resourceType": assignment.ResourceTypeCourse,
			"resourceId":   fixture.publishedCourse.ID,
		}},
		"rule": map[string]any{
			"attemptLimit":  1,
			"allowLate":     false,
			"allowReturn":   true,
			"allowResubmit": false,
			"scoreMode":     "rubric",
		},
	})
	if createResp.Code != http.StatusCreated {
		t.Fatalf("expected create assignment 201, got %d: %s", createResp.Code, createResp.Body.String())
	}
	var createAPI apiResponse
	decodeJSON(t, createResp.Body.Bytes(), &createAPI)
	var created assignment.AssignmentDetail
	decodeJSON(t, createAPI.Data, &created)
	publishResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/assignments/%d/publish", created.ID), nil, teacherToken)
	if publishResp.Code != http.StatusOK {
		t.Fatalf("expected publish 200, got %d: %s", publishResp.Code, publishResp.Body.String())
	}

	submitResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/student/assignments/%d/submissions", created.ID), map[string]any{
		"contentText": "M5 首次提交",
	}, studentToken)
	if submitResp.Code != http.StatusCreated {
		t.Fatalf("expected submit 201, got %d: %s", submitResp.Code, submitResp.Body.String())
	}
	var submitAPI apiResponse
	decodeJSON(t, submitResp.Body.Bytes(), &submitAPI)
	var firstSubmission assignment.SubmissionDetail
	decodeJSON(t, submitAPI.Data, &firstSubmission)

	returnResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/submissions/%d/return", firstSubmission.ID), map[string]any{
		"feedback": "可以退回，但本作业默认不允许直接重交",
	}, teacherToken)
	if returnResp.Code != http.StatusOK {
		t.Fatalf("expected return with allow_return 200, got %d: %s", returnResp.Code, returnResp.Body.String())
	}

	blockedResubmit := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/student/assignments/%d/submissions", created.ID), map[string]any{
		"contentText": "未重开前的重交",
	}, studentToken)
	if blockedResubmit.Code != http.StatusBadRequest {
		t.Fatalf("expected resubmit blocked before reopen, got %d: %s", blockedResubmit.Code, blockedResubmit.Body.String())
	}

	reopenResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/assignments/%d/reopen", created.ID), map[string]any{
		"studentIds":    []uint64{fixture.studentA.ID},
		"extraAttempts": 1,
		"reason":        "给一次补交机会",
	}, teacherToken)
	if reopenResp.Code != http.StatusOK {
		t.Fatalf("expected reopen 200, got %d: %s", reopenResp.Code, reopenResp.Body.String())
	}

	resubmitResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/student/assignments/%d/submissions", created.ID), map[string]any{
		"contentText": "重开后的重交",
	}, studentToken)
	if resubmitResp.Code != http.StatusCreated {
		t.Fatalf("expected resubmit after reopen 201, got %d: %s", resubmitResp.Code, resubmitResp.Body.String())
	}
	var resubmitAPI apiResponse
	decodeJSON(t, resubmitResp.Body.Bytes(), &resubmitAPI)
	var secondSubmission assignment.SubmissionDetail
	decodeJSON(t, resubmitAPI.Data, &secondSubmission)
	if secondSubmission.AttemptNo != 2 {
		t.Fatalf("expected reopened attempt 2, got %+v", secondSubmission.Submission)
	}

	var reopen assignment.SubmissionReopen
	if err := fixture.db.Where("assignment_id = ? AND student_id = ?", created.ID, fixture.studentA.ID).First(&reopen).Error; err != nil {
		t.Fatalf("expected submission reopen row: %v", err)
	}
	if reopen.UsedAttempts != 1 {
		t.Fatalf("expected reopen used_attempts=1, got %+v", reopen)
	}

	remindResp := performJSON(t, fixture.engine, http.MethodPost, "/api/teacher/notifications/remind", map[string]any{
		"assignmentId": created.ID,
		"studentIds":   []uint64{fixture.studentA.ID},
		"message":      "请关注本次作业反馈",
	}, teacherToken)
	if remindResp.Code != http.StatusOK {
		t.Fatalf("expected remind 200, got %d: %s", remindResp.Code, remindResp.Body.String())
	}

	notificationResp := performJSON(t, fixture.engine, http.MethodGet, "/api/student/notifications", nil, studentToken)
	if notificationResp.Code != http.StatusOK {
		t.Fatalf("expected student notifications 200, got %d: %s", notificationResp.Code, notificationResp.Body.String())
	}
	var notificationAPI apiResponse
	decodeJSON(t, notificationResp.Body.Bytes(), &notificationAPI)
	var notifications assignment.NotificationListResponse
	decodeJSON(t, notificationAPI.Data, &notifications)
	if notifications.Total < 3 || notifications.Unread < 3 {
		t.Fatalf("expected return/reopen/remind notifications, got %+v", notifications)
	}
	readResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/student/notifications/%d/read", notifications.List[0].ID), nil, studentToken)
	if readResp.Code != http.StatusOK {
		t.Fatalf("expected read notification 200, got %d: %s", readResp.Code, readResp.Body.String())
	}
	studentBNotificationResp := performJSON(t, fixture.engine, http.MethodGet, "/api/student/notifications", nil, studentBToken)
	if studentBNotificationResp.Code != http.StatusOK {
		t.Fatalf("expected student B notifications 200, got %d: %s", studentBNotificationResp.Code, studentBNotificationResp.Body.String())
	}
	var studentBNotificationAPI apiResponse
	decodeJSON(t, studentBNotificationResp.Body.Bytes(), &studentBNotificationAPI)
	var studentBNotifications assignment.NotificationListResponse
	decodeJSON(t, studentBNotificationAPI.Data, &studentBNotifications)
	if studentBNotifications.Total != 0 {
		t.Fatalf("expected student B no notifications, got %+v", studentBNotifications)
	}

	todoResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/dashboard/todo-items", nil, teacherToken)
	if todoResp.Code != http.StatusOK {
		t.Fatalf("expected teacher todo items 200, got %d: %s", todoResp.Code, todoResp.Body.String())
	}
	var todoAPI apiResponse
	decodeJSON(t, todoResp.Body.Bytes(), &todoAPI)
	var todos assignment.TodoItemsResponse
	decodeJSON(t, todoAPI.Data, &todos)
	if todos.Total == 0 || len(todos.List) == 0 {
		t.Fatalf("expected combined todo items, got %+v", todos)
	}

	gradeResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/submissions/%d/grade", secondSubmission.ID), map[string]any{
		"scores": []map[string]any{{"rubricItemId": created.Rubric.Items[0].ID, "score": 88}},
	}, teacherToken)
	if gradeResp.Code != http.StatusOK {
		t.Fatalf("expected grade 200, got %d: %s", gradeResp.Code, gradeResp.Body.String())
	}

	gradesResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/grades?assignmentId=%d&gradeStatus=reviewed", created.ID), nil, teacherToken)
	if gradesResp.Code != http.StatusOK {
		t.Fatalf("expected teacher grades 200, got %d: %s", gradesResp.Code, gradesResp.Body.String())
	}
	var gradesAPI apiResponse
	decodeJSON(t, gradesResp.Body.Bytes(), &gradesAPI)
	var grades assignment.TeacherGradesResponse
	decodeJSON(t, gradesAPI.Data, &grades)
	if grades.Total != 1 || grades.List[0].AssignmentID != created.ID {
		t.Fatalf("expected one reviewed grade, got %+v", grades)
	}

	foreignGradesResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/grades?assignmentId=%d", created.ID), nil, teacherBToken)
	if foreignGradesResp.Code != http.StatusOK {
		t.Fatalf("expected foreign teacher grades list 200, got %d: %s", foreignGradesResp.Code, foreignGradesResp.Body.String())
	}
	var foreignGradesAPI apiResponse
	decodeJSON(t, foreignGradesResp.Body.Bytes(), &foreignGradesAPI)
	var foreignGrades assignment.TeacherGradesResponse
	decodeJSON(t, foreignGradesAPI.Data, &foreignGrades)
	if foreignGrades.Total != 0 {
		t.Fatalf("expected foreign teacher no grades, got %+v", foreignGrades)
	}

	overviewResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/dashboard/teaching-overview", nil, teacherToken)
	if overviewResp.Code != http.StatusOK {
		t.Fatalf("expected teacher overview 200, got %d: %s", overviewResp.Code, overviewResp.Body.String())
	}
	riskResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/dashboard/risk-students", nil, teacherToken)
	if riskResp.Code != http.StatusOK {
		t.Fatalf("expected teacher risk students 200, got %d: %s", riskResp.Code, riskResp.Body.String())
	}
	adminQualityResp := performJSON(t, fixture.engine, http.MethodGet, "/api/admin/teaching-quality/overview", nil, adminToken)
	if adminQualityResp.Code != http.StatusOK {
		t.Fatalf("expected admin teaching quality 200, got %d: %s", adminQualityResp.Code, adminQualityResp.Body.String())
	}

	var logs []assignment.TeacherActionLog
	if err := fixture.db.Find(&logs).Error; err != nil {
		t.Fatalf("load action logs failed: %v", err)
	}
	if len(logs) < 3 {
		t.Fatalf("expected action logs for return/reopen/remind, got %+v", logs)
	}
}

func TestM5RiskStudentsReasonsForLowCompletionAndInactive(t *testing.T) {
	fixture := newM3AssignmentFixture(t)
	teacherToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherA.Username, "teacher@123")

	now := time.Now()
	dueAt := now.Add(48 * time.Hour)
	publishedAt := now.Add(-24 * time.Hour)
	assignments := []assignment.TeachingAssignment{
		{Title: "M5 风险检测任务 1", Status: assignment.AssignmentStatusPublished, CreatorID: fixture.teacherA.ID, DueAt: &dueAt, PublishedAt: &publishedAt},
		{Title: "M5 风险检测任务 2", Status: assignment.AssignmentStatusPublished, CreatorID: fixture.teacherA.ID, DueAt: &dueAt, PublishedAt: &publishedAt},
		{Title: "M5 风险检测任务 3", Status: assignment.AssignmentStatusPublished, CreatorID: fixture.teacherA.ID, DueAt: &dueAt, PublishedAt: &publishedAt},
	}
	if err := fixture.db.Create(&assignments).Error; err != nil {
		t.Fatalf("seed risk assignments failed: %v", err)
	}
	assignmentClasses := make([]assignment.AssignmentClass, 0, len(assignments))
	for _, item := range assignments {
		assignmentClasses = append(assignmentClasses, assignment.AssignmentClass{
			AssignmentID: item.ID,
			ClassID:      fixture.activeClass.ID,
		})
	}
	if err := fixture.db.Create(&assignmentClasses).Error; err != nil {
		t.Fatalf("seed risk assignment classes failed: %v", err)
	}

	oldActiveAt := now.AddDate(0, 0, -8)
	submission := assignment.Submission{
		AssignmentID: assignments[0].ID,
		StudentID:    fixture.studentA.ID,
		AttemptNo:    1,
		Status:       assignment.SubmissionStatusSubmitted,
		ContentText:  "只提交了 1/3 的任务",
		SubmittedAt:  &oldActiveAt,
		CreatedAt:    oldActiveAt,
		UpdatedAt:    oldActiveAt,
	}
	if err := fixture.db.Create(&submission).Error; err != nil {
		t.Fatalf("seed old submission failed: %v", err)
	}
	if err := fixture.db.Model(&assignment.Submission{}).Where("id = ?", submission.ID).Update("updated_at", oldActiveAt).Error; err != nil {
		t.Fatalf("force old submission updated_at failed: %v", err)
	}

	riskResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/dashboard/risk-students", nil, teacherToken)
	if riskResp.Code != http.StatusOK {
		t.Fatalf("expected teacher risk students 200, got %d: %s", riskResp.Code, riskResp.Body.String())
	}
	var riskAPI apiResponse
	decodeJSON(t, riskResp.Body.Bytes(), &riskAPI)
	var risks assignment.RiskStudentsResponse
	decodeJSON(t, riskAPI.Data, &risks)

	var target *assignment.RiskStudentItem
	for index := range risks.List {
		if risks.List[index].StudentID == fixture.studentA.ID {
			target = &risks.List[index]
			break
		}
	}
	if target == nil {
		t.Fatalf("expected student A in risk list, got %+v", risks)
	}
	if target.AssignedCount != 3 || target.SubmittedCount != 1 || target.CompletionRate >= 0.5 {
		t.Fatalf("expected 1/3 low completion risk stats, got %+v", target)
	}
	if !hasRiskReason(target.RiskReasons, "作业完成率低于 50%") {
		t.Fatalf("expected low completion reason, got %+v", target.RiskReasons)
	}
	if !hasRiskReason(target.RiskReasons, "超过 7 天无提交或 Lab 活跃") {
		t.Fatalf("expected inactive reason, got %+v", target.RiskReasons)
	}
}

func hasRiskReason(reasons []string, expected string) bool {
	for _, reason := range reasons {
		if reason == expected {
			return true
		}
	}
	return false
}
