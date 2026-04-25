package router_test

import (
	"fmt"
	"net/http"
	"testing"

	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/assignment"
)

func TestM4SubmissionGradeReturnAndPublishFlow(t *testing.T) {
	fixture := newM3AssignmentFixture(t)
	teacherToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherA.Username, "teacher@123")
	studentAToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.studentA.Username, "student@123")
	studentBToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.studentB.Username, "student@123")

	manual := agent.AgentManual{
		SourceType:  agent.SourceTypeLesson,
		SourceID:    101,
		Title:       "M4 手册",
		IsPublished: 1,
		CreatorID:   fixture.teacherA.ID,
		Description: "M4 提交测试手册",
	}
	if err := fixture.db.Create(&manual).Error; err != nil {
		t.Fatalf("seed manual failed: %v", err)
	}
	if err := fixture.db.Create(&agent.UserAgentProgress{
		UserID:         fixture.studentA.ID,
		ManualID:       manual.ID,
		CurrentStep:    2,
		CompletedSteps: []int{0, 1},
	}).Error; err != nil {
		t.Fatalf("seed agent progress failed: %v", err)
	}

	createResp := createAssignmentViaAPI(t, fixture, teacherToken, map[string]any{
		"title":    "M4 提交评分任务",
		"classIds": []uint64{fixture.activeClass.ID},
		"resources": []map[string]any{{
			"resourceType": assignment.ResourceTypeManual,
			"resourceId":   manual.ID,
			"manualId":     manual.ID,
		}},
		"rule": map[string]any{
			"attemptLimit":  2,
			"allowLate":     false,
			"allowResubmit": true,
			"scoreMode":     "rubric",
		},
		"rubricItems": []map[string]any{{
			"title":    "步骤完成",
			"maxScore": 60,
		}, {
			"title":    "说明质量",
			"maxScore": 40,
		}},
	})
	if createResp.Code != http.StatusCreated {
		t.Fatalf("expected create assignment 201, got %d: %s", createResp.Code, createResp.Body.String())
	}
	var createAPI apiResponse
	decodeJSON(t, createResp.Body.Bytes(), &createAPI)
	var created assignment.AssignmentDetail
	decodeJSON(t, createAPI.Data, &created)
	if len(created.Rubric.Items) != 2 {
		t.Fatalf("expected rubric items, got %+v", created.Rubric)
	}
	publishResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/assignments/%d/publish", created.ID), nil, teacherToken)
	if publishResp.Code != http.StatusOK {
		t.Fatalf("expected publish 200, got %d: %s", publishResp.Code, publishResp.Body.String())
	}

	foreignSubmit := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/student/assignments/%d/submissions", created.ID), map[string]any{
		"contentText": "不是目标班级的提交",
	}, studentBToken)
	if foreignSubmit.Code != http.StatusForbidden {
		t.Fatalf("expected non-class student forbidden, got %d: %s", foreignSubmit.Code, foreignSubmit.Body.String())
	}

	submitResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/student/assignments/%d/submissions", created.ID), map[string]any{
		"contentText":   "第一次提交",
		"agentManualId": manual.ID,
	}, studentAToken)
	if submitResp.Code != http.StatusCreated {
		t.Fatalf("expected submit 201, got %d: %s", submitResp.Code, submitResp.Body.String())
	}
	var submitAPI apiResponse
	decodeJSON(t, submitResp.Body.Bytes(), &submitAPI)
	var firstSubmission assignment.SubmissionDetail
	decodeJSON(t, submitAPI.Data, &firstSubmission)
	if len(firstSubmission.Checks) == 0 {
		t.Fatalf("expected snapshot checks, got %+v", firstSubmission)
	}

	listResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/submissions", nil, teacherToken)
	if listResp.Code != http.StatusOK {
		t.Fatalf("expected submission list 200, got %d: %s", listResp.Code, listResp.Body.String())
	}
	var listAPI apiResponse
	decodeJSON(t, listResp.Body.Bytes(), &listAPI)
	var list assignment.SubmissionListResponse
	decodeJSON(t, listAPI.Data, &list)
	if list.Total != 1 {
		t.Fatalf("expected one pending submission, got %+v", list)
	}

	gradesBeforeResp := performJSON(t, fixture.engine, http.MethodGet, "/api/student/grades", nil, studentAToken)
	var gradesBeforeAPI apiResponse
	decodeJSON(t, gradesBeforeResp.Body.Bytes(), &gradesBeforeAPI)
	var gradesBefore assignment.StudentGradesResponse
	decodeJSON(t, gradesBeforeAPI.Data, &gradesBefore)
	if len(gradesBefore.List) != 1 || gradesBefore.List[0].Status != assignment.GradeStatusPending {
		t.Fatalf("expected pending grade before publish, got %+v", gradesBefore)
	}

	returnResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/submissions/%d/return", firstSubmission.ID), map[string]any{
		"feedback": "请补充说明",
	}, teacherToken)
	if returnResp.Code != http.StatusOK {
		t.Fatalf("expected return 200, got %d: %s", returnResp.Code, returnResp.Body.String())
	}

	resubmitResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/student/assignments/%d/submissions", created.ID), map[string]any{
		"contentText":   "第二次提交",
		"agentManualId": manual.ID,
	}, studentAToken)
	if resubmitResp.Code != http.StatusCreated {
		t.Fatalf("expected resubmit 201, got %d: %s", resubmitResp.Code, resubmitResp.Body.String())
	}
	var resubmitAPI apiResponse
	decodeJSON(t, resubmitResp.Body.Bytes(), &resubmitAPI)
	var secondSubmission assignment.SubmissionDetail
	decodeJSON(t, resubmitAPI.Data, &secondSubmission)
	if secondSubmission.AttemptNo != 2 || secondSubmission.Status != assignment.SubmissionStatusResubmitted {
		t.Fatalf("expected second attempt resubmitted, got %+v", secondSubmission.Submission)
	}

	gradeResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/submissions/%d/grade", secondSubmission.ID), map[string]any{
		"scores": []map[string]any{{
			"rubricItemId": created.Rubric.Items[0].ID,
			"score":        55,
		}, {
			"rubricItemId": created.Rubric.Items[1].ID,
			"score":        35,
		}},
		"feedback": "完成良好",
	}, teacherToken)
	if gradeResp.Code != http.StatusOK {
		t.Fatalf("expected grade 200, got %d: %s", gradeResp.Code, gradeResp.Body.String())
	}
	var gradeAPI apiResponse
	decodeJSON(t, gradeResp.Body.Bytes(), &gradeAPI)
	var graded assignment.SubmissionDetail
	decodeJSON(t, gradeAPI.Data, &graded)
	if graded.Grade == nil || graded.Grade.Status != assignment.GradeStatusReviewed || graded.Grade.Score != 90 {
		t.Fatalf("expected reviewed grade score 90, got %+v", graded.Grade)
	}

	publishGradeResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/grades/%d/publish", graded.Grade.ID), nil, teacherToken)
	if publishGradeResp.Code != http.StatusOK {
		t.Fatalf("expected publish grade 200, got %d: %s", publishGradeResp.Code, publishGradeResp.Body.String())
	}

	gradesAfterResp := performJSON(t, fixture.engine, http.MethodGet, "/api/student/grades", nil, studentAToken)
	var gradesAfterAPI apiResponse
	decodeJSON(t, gradesAfterResp.Body.Bytes(), &gradesAfterAPI)
	var gradesAfter assignment.StudentGradesResponse
	decodeJSON(t, gradesAfterAPI.Data, &gradesAfter)
	if len(gradesAfter.List) != 1 || gradesAfter.List[0].Status != assignment.GradeStatusPublished || gradesAfter.List[0].Score == nil || *gradesAfter.List[0].Score != 90 {
		t.Fatalf("expected published grade visible, got %+v", gradesAfter)
	}

	detailResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/assignments/%d", created.ID), nil, teacherToken)
	var detailAPI apiResponse
	decodeJSON(t, detailResp.Body.Bytes(), &detailAPI)
	var detail assignment.AssignmentDetail
	decodeJSON(t, detailAPI.Data, &detail)
	if detail.SubmissionProgress == nil || detail.SubmissionProgress.PublishedGrades != 1 || detail.SubmissionProgress.Returned != 1 {
		t.Fatalf("expected assignment submission progress, got %+v", detail.SubmissionProgress)
	}
}
