package router_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"go.uber.org/zap"

	"edu-platform/internal/app"
	"edu-platform/internal/config"
	"edu-platform/internal/domain/assignment"
	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/operations"
	"edu-platform/internal/router"
)

func TestM7AIFeedbackSuggestionAdoptionAndRepeat(t *testing.T) {
	fixture, cleanup := newM7AIFixture(t, "主要问题\n证据显示提交说明较短。\n建议反馈\n请补充关键步骤和验证截图。\n依据\n基于提交说明与验证证据。")
	defer cleanup()

	teacherToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherA.Username, "teacher@123")
	studentToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.studentA.Username, "student@123")
	created, submission := seedM7Submission(t, fixture, teacherToken, studentToken)

	firstResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/submissions/%d/ai/suggest-feedback", submission.ID), nil, teacherToken)
	if firstResp.Code != http.StatusCreated {
		t.Fatalf("expected first ai feedback 201, got %d: %s", firstResp.Code, firstResp.Body.String())
	}
	first := decodeM7Suggestion(t, firstResp)
	if first.Status != assignment.AISuggestionStatusPending || first.SourceType != assignment.AISourceTypeSubmission || first.SourceID != submission.ID {
		t.Fatalf("unexpected first suggestion: %+v", first)
	}

	secondResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/submissions/%d/ai/suggest-feedback", submission.ID), nil, teacherToken)
	if secondResp.Code != http.StatusCreated {
		t.Fatalf("expected second ai feedback 201, got %d: %s", secondResp.Code, secondResp.Body.String())
	}
	second := decodeM7Suggestion(t, secondResp)

	var old assignment.AISuggestion
	if err := fixture.db.First(&old, first.ID).Error; err != nil {
		t.Fatalf("reload first suggestion failed: %v", err)
	}
	if old.Status != assignment.AISuggestionStatusDismissed {
		t.Fatalf("expected old pending dismissed, got %+v", old)
	}

	otherCreated, otherSubmission := seedM7Submission(t, fixture, teacherToken, studentToken)
	wrongSubmissionResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/submissions/%d/grade", otherSubmission.ID), map[string]any{
		"scores": []map[string]any{{
			"rubricItemId": otherCreated.Rubric.Items[0].ID,
			"score":        88,
		}},
		"feedback":       "错误提交采用测试",
		"aiSuggestionId": second.ID,
	}, teacherToken)
	if wrongSubmissionResp.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected different submission aiSuggestionId 422, got %d: %s", wrongSubmissionResp.Code, wrongSubmissionResp.Body.String())
	}

	gradeResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/submissions/%d/grade", submission.ID), map[string]any{
		"scores": []map[string]any{{
			"rubricItemId": created.Rubric.Items[0].ID,
			"score":        90,
		}},
		"feedback":       "教师采纳后编辑的反馈",
		"aiSuggestionId": second.ID,
	}, teacherToken)
	if gradeResp.Code != http.StatusOK {
		t.Fatalf("expected grade with ai suggestion 200, got %d: %s", gradeResp.Code, gradeResp.Body.String())
	}

	var adopted assignment.AISuggestion
	if err := fixture.db.First(&adopted, second.ID).Error; err != nil {
		t.Fatalf("reload adopted suggestion failed: %v", err)
	}
	if adopted.Status != assignment.AISuggestionStatusConfirmed || adopted.AdoptedContent != "教师采纳后编辑的反馈" {
		t.Fatalf("expected suggestion confirmed with adopted content, got %+v", adopted)
	}

	reuseResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/submissions/%d/return", submission.ID), map[string]any{
		"feedback":       "重复使用",
		"aiSuggestionId": second.ID,
	}, teacherToken)
	if reuseResp.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected confirmed suggestion reuse 422, got %d: %s", reuseResp.Code, reuseResp.Body.String())
	}
}

func TestM7AISettingsDisableRecordsFailedRequestAndAudit(t *testing.T) {
	fixture, cleanup := newM7AIFixture(t, "AI 生成内容")
	defer cleanup()

	adminToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.admin.Username, "admin@123")
	teacherToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherA.Username, "teacher@123")
	studentToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.studentA.Username, "student@123")
	_, submission := seedM7Submission(t, fixture, teacherToken, studentToken)

	statusResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/ai/status", nil, teacherToken)
	if statusResp.Code != http.StatusOK || !strings.Contains(statusResp.Body.String(), `"enabled":true`) || !strings.Contains(statusResp.Body.String(), `"configured":true`) {
		t.Fatalf("expected ai status enabled/configured, got %d: %s", statusResp.Code, statusResp.Body.String())
	}

	disableResp := performJSON(t, fixture.engine, http.MethodPatch, "/api/admin/ai-settings", map[string]any{"enabled": false}, adminToken)
	if disableResp.Code != http.StatusOK {
		t.Fatalf("expected disable ai 200, got %d: %s", disableResp.Code, disableResp.Body.String())
	}

	blockedResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/submissions/%d/ai/suggest-feedback", submission.ID), nil, teacherToken)
	if blockedResp.Code != http.StatusServiceUnavailable || !strings.Contains(blockedResp.Body.String(), "AI 辅助能力已关闭") {
		t.Fatalf("expected disabled ai 503, got %d: %s", blockedResp.Code, blockedResp.Body.String())
	}

	var failedRequests int64
	if err := fixture.db.Model(&assignment.AIRequest{}).Where("status = ? AND error = ?", assignment.AIRequestStatusFailed, "AI 辅助能力已关闭").Count(&failedRequests).Error; err != nil {
		t.Fatalf("count failed ai requests failed: %v", err)
	}
	if failedRequests != 1 {
		t.Fatalf("expected one failed ai request, got %d", failedRequests)
	}
	var auditCount int64
	if err := fixture.db.Model(&operations.AuditLog{}).Where("action = ?", assignment.AIActionSettingsUpdate).Count(&auditCount).Error; err != nil {
		t.Fatalf("count ai setting audit failed: %v", err)
	}
	if auditCount != 1 {
		t.Fatalf("expected one ai setting audit log, got %d", auditCount)
	}
}

func TestM7StepInsightSuggestionConfirmDismissScope(t *testing.T) {
	fixture, cleanup := newM7AIFixture(t, "AI 步骤诊断")
	defer cleanup()

	teacherAToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherA.Username, "teacher@123")
	teacherBToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherB.Username, "teacher@123")

	owned := assignment.AISuggestion{
		SuggestionType: assignment.AISuggestionTypeStepInsight,
		SourceType:     assignment.AISourceTypeAgentStep,
		SourceID:       777,
		CreatedBy:      fixture.teacherA.ID,
		Title:          "Agent 步骤卡点诊断",
		Content:        "建议教师确认后再使用。",
		Status:         assignment.AISuggestionStatusPending,
	}
	if err := fixture.db.Create(&owned).Error; err != nil {
		t.Fatalf("create owned step insight suggestion failed: %v", err)
	}
	confirmResp := performJSON(t, fixture.engine, http.MethodPatch, fmt.Sprintf("/api/teacher/ai-suggestions/%d", owned.ID), map[string]any{
		"action": "confirm",
	}, teacherAToken)
	if confirmResp.Code != http.StatusOK {
		t.Fatalf("expected teacher owner confirm 200, got %d: %s", confirmResp.Code, confirmResp.Body.String())
	}
	var confirmed assignment.AISuggestion
	if err := fixture.db.First(&confirmed, owned.ID).Error; err != nil {
		t.Fatalf("reload confirmed suggestion failed: %v", err)
	}
	if confirmed.Status != assignment.AISuggestionStatusConfirmed || confirmed.ConfirmedBy != fixture.teacherA.ID {
		t.Fatalf("expected confirmed step insight suggestion, got %+v", confirmed)
	}

	foreign := assignment.AISuggestion{
		SuggestionType: assignment.AISuggestionTypeStepInsight,
		SourceType:     assignment.AISourceTypeAgentStep,
		SourceID:       778,
		CreatedBy:      fixture.teacherA.ID,
		Title:          "Agent 步骤卡点诊断",
		Content:        "非创建教师不能处理。",
		Status:         assignment.AISuggestionStatusPending,
	}
	if err := fixture.db.Create(&foreign).Error; err != nil {
		t.Fatalf("create foreign step insight suggestion failed: %v", err)
	}
	foreignResp := performJSON(t, fixture.engine, http.MethodPatch, fmt.Sprintf("/api/teacher/ai-suggestions/%d", foreign.ID), map[string]any{
		"action": "dismiss",
	}, teacherBToken)
	if foreignResp.Code != http.StatusForbidden {
		t.Fatalf("expected foreign teacher dismiss forbidden, got %d: %s", foreignResp.Code, foreignResp.Body.String())
	}
	var stillPending assignment.AISuggestion
	if err := fixture.db.First(&stillPending, foreign.ID).Error; err != nil {
		t.Fatalf("reload foreign suggestion failed: %v", err)
	}
	if stillPending.Status != assignment.AISuggestionStatusPending {
		t.Fatalf("expected foreign suggestion still pending, got %+v", stillPending)
	}
}

func TestM7WeaknessAndSummaryScope(t *testing.T) {
	fixture, cleanup := newM7AIFixture(t, "主要问题\n证据不足。\n建议反馈\n继续观察。\n依据\n当前班级作业记录。")
	defer cleanup()

	teacherAToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherA.Username, "teacher@123")
	teacherBToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherB.Username, "teacher@123")
	studentToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.studentA.Username, "student@123")
	created, submission := seedM7Submission(t, fixture, teacherAToken, studentToken)

	foreignFeedback := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/submissions/%d/ai/suggest-feedback", submission.ID), nil, teacherBToken)
	if foreignFeedback.Code != http.StatusForbidden {
		t.Fatalf("expected foreign teacher feedback forbidden, got %d: %s", foreignFeedback.Code, foreignFeedback.Body.String())
	}

	foreignWeakness := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/students/%d/ai/weakness", fixture.studentA.ID), map[string]any{
		"classId": fixture.activeClass.ID,
	}, teacherBToken)
	if foreignWeakness.Code != http.StatusForbidden {
		t.Fatalf("expected foreign teacher weakness forbidden, got %d: %s", foreignWeakness.Code, foreignWeakness.Body.String())
	}

	weaknessResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/students/%d/ai/weakness", fixture.studentA.ID), map[string]any{
		"classId": fixture.activeClass.ID,
	}, teacherAToken)
	if weaknessResp.Code != http.StatusCreated {
		t.Fatalf("expected weakness suggestion 201, got %d: %s", weaknessResp.Code, weaknessResp.Body.String())
	}
	weakness := decodeM7Suggestion(t, weaknessResp)
	if weakness.SuggestionType != assignment.AISuggestionTypeWeaknessDiagnosis || weakness.SourceType != assignment.AISourceTypeStudent {
		t.Fatalf("unexpected weakness suggestion: %+v", weakness)
	}

	summaryResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/assignments/%d/ai/summary", created.ID), map[string]any{
		"classId": fixture.activeClass.ID,
	}, teacherAToken)
	if summaryResp.Code != http.StatusCreated {
		t.Fatalf("expected assignment summary 201, got %d: %s", summaryResp.Code, summaryResp.Body.String())
	}
	summary := decodeM7Suggestion(t, summaryResp)
	if summary.SuggestionType != assignment.AISuggestionTypeAssignmentSummary || summary.SourceType != assignment.AISourceTypeAssignment {
		t.Fatalf("unexpected summary suggestion: %+v", summary)
	}
}

type m7AIFixture struct {
	*m3AssignmentFixture
	engine http.Handler
}

func newM7AIFixture(t *testing.T, aiContent string) (*m7AIFixture, func()) {
	t.Helper()
	fixture := newM3AssignmentFixture(t)
	if err := fixture.db.AutoMigrate(&assignment.AIRequest{}, &assignment.AISuggestion{}, &assignment.AIFeatureSetting{}, &operations.AuditLog{}); err != nil {
		t.Fatalf("auto migrate m7 models failed: %v", err)
	}
	if err := fixture.db.Create(&[]classroom.ClassTeacher{
		{ClassID: fixture.activeClass.ID, TeacherID: fixture.teacherA.ID, Role: classroom.ClassTeacherRoleOwner, Status: classroom.ClassTeacherStatusActive},
		{ClassID: fixture.foreignClass.ID, TeacherID: fixture.teacherB.ID, Role: classroom.ClassTeacherRoleOwner, Status: classroom.ClassTeacherStatusActive},
	}).Error; err != nil {
		t.Fatalf("seed m7 class teachers failed: %v", err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(fmt.Sprintf(`{"choices":[{"message":{"content":%q}}],"usage":{"prompt_tokens":12,"total_tokens":34}}`, aiContent)))
	}))
	cfg := &config.Config{
		App:    config.AppConfig{Name: "edu-platform-test", Env: "test", Version: "test"},
		JWT:    config.JWTConfig{Secret: "test-secret", Issuer: "edu-platform-test", ExpiresIn: "7d"},
		Upload: config.UploadConfig{Root: t.TempDir()},
		Qwen:   config.QwenConfig{APIKey: "test-key", BaseURL: server.URL, Model: "m7-test-model"},
	}
	fixture.engine = router.New(app.Dependencies{
		Config:   cfg,
		Logger:   zap.NewNop(),
		DB:       fixture.db,
		Enforcer: mustTestEnforcer(t),
	})
	return &m7AIFixture{m3AssignmentFixture: fixture, engine: fixture.engine}, server.Close
}

func seedM7Submission(t *testing.T, fixture *m7AIFixture, teacherToken, studentToken string) (assignment.AssignmentDetail, assignment.SubmissionDetail) {
	t.Helper()
	createResp := createAssignmentViaAPI(t, fixture.m3AssignmentFixture, teacherToken, map[string]any{
		"title":    "M7 AI 助教任务",
		"classIds": []uint64{fixture.activeClass.ID},
		"resources": []map[string]any{{
			"resourceType": assignment.ResourceTypeCourse,
			"resourceId":   fixture.publishedCourse.ID,
		}},
		"rule": map[string]any{
			"attemptLimit":  2,
			"allowLate":     false,
			"allowReturn":   true,
			"allowResubmit": true,
			"scoreMode":     "rubric",
		},
		"rubricItems": []map[string]any{{
			"title":       "完成质量",
			"description": "结合证据、步骤和说明完整性评分",
			"maxScore":    100,
		}},
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
		"contentText": "我完成了主要步骤，但验证输出里仍有一条失败日志。",
	}, studentToken)
	if submitResp.Code != http.StatusCreated {
		t.Fatalf("expected submit 201, got %d: %s", submitResp.Code, submitResp.Body.String())
	}
	var submitAPI apiResponse
	decodeJSON(t, submitResp.Body.Bytes(), &submitAPI)
	var submission assignment.SubmissionDetail
	decodeJSON(t, submitAPI.Data, &submission)
	return created, submission
}

func decodeM7Suggestion(t *testing.T, resp *httptest.ResponseRecorder) assignment.AISuggestion {
	t.Helper()
	var payload apiResponse
	decodeJSON(t, resp.Body.Bytes(), &payload)
	var suggestion assignment.AISuggestion
	decodeJSON(t, payload.Data, &suggestion)
	return suggestion
}
