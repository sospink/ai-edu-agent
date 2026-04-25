package router_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/assignment"
)

func TestAgentV2TeacherObservatoryFAQInterventionAndTags(t *testing.T) {
	fixture, cleanup := newM7AIFixture(t, `{"question":"如何排查 Pod Pending？","answer":"先查看事件，再检查镜像和资源配额。"}`)
	defer cleanup()
	if err := fixture.db.AutoMigrate(
		&agent.AgentLearningEvent{},
		&agent.AgentStepAttempt{},
		&agent.AgentChatSession{},
		&agent.AgentChatMessage{},
		&agent.AgentReflectionCard{},
		&agent.AgentStepSkillTag{},
		&agent.AgentFAQItem{},
		&agent.AgentInterventionRecord{},
		&agent.LabTerminalEvent{},
	); err != nil {
		t.Fatalf("auto migrate agent v2 models failed: %v", err)
	}

	teacherToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherA.Username, "teacher@123")
	foreignTeacherToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.teacherB.Username, "teacher@123")
	adminToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.admin.Username, "admin@123")
	studentToken := mustLogin(t, &testFixture{engine: fixture.engine}, fixture.studentA.Username, "student@123")

	manual := agent.AgentManual{SourceType: agent.SourceTypeLesson, SourceID: 98701, Title: "V2 手册", CreatorID: fixture.admin.ID, IsPublished: 1}
	if err := fixture.db.Create(&manual).Error; err != nil {
		t.Fatalf("seed manual failed: %v", err)
	}
	step := agent.AgentStep{ManualID: manual.ID, StepOrder: 0, Title: "启动 Pod", Content: []agent.ContentBlock{{Type: "text", Text: "检查运行状态"}}}
	if err := fixture.db.Create(&step).Error; err != nil {
		t.Fatalf("seed step failed: %v", err)
	}
	assignmentRecord := assignment.TeachingAssignment{Title: "V2 任务", Status: assignment.AssignmentStatusPublished, CreatorID: fixture.teacherA.ID}
	if err := fixture.db.Create(&assignmentRecord).Error; err != nil {
		t.Fatalf("seed assignment failed: %v", err)
	}
	if err := fixture.db.Create(&assignment.AssignmentResource{AssignmentID: assignmentRecord.ID, ResourceType: assignment.ResourceTypeManual, ResourceID: manual.ID, ManualID: manual.ID}).Error; err != nil {
		t.Fatalf("seed assignment resource failed: %v", err)
	}
	if err := fixture.db.Create(&assignment.AssignmentClass{AssignmentID: assignmentRecord.ID, ClassID: fixture.activeClass.ID}).Error; err != nil {
		t.Fatalf("seed assignment class failed: %v", err)
	}

	assignedManualsResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/manuals?page=1&pageSize=20", nil, teacherToken)
	if assignedManualsResp.Code != http.StatusOK || !strings.Contains(assignedManualsResp.Body.String(), "V2 手册") {
		t.Fatalf("expected assigned teacher can list assigned manual, got %d: %s", assignedManualsResp.Code, assignedManualsResp.Body.String())
	}

	replaceResp := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/teacher/agent-steps/%d/skill-tags", step.ID), map[string]any{"tags": []string{"K8S", "kubectl"}}, teacherToken)
	if replaceResp.Code != http.StatusOK {
		t.Fatalf("expected assigned teacher replace tags 200, got %d: %s", replaceResp.Code, replaceResp.Body.String())
	}
	foreignReplace := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/teacher/agent-steps/%d/skill-tags", step.ID), map[string]any{"tags": []string{"bad"}}, foreignTeacherToken)
	if foreignReplace.Code != http.StatusForbidden {
		t.Fatalf("expected foreign teacher replace tags 403, got %d: %s", foreignReplace.Code, foreignReplace.Body.String())
	}
	adminReplace := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/teacher/agent-steps/%d/skill-tags", step.ID), map[string]any{"tags": []string{"admin"}}, adminToken)
	if adminReplace.Code != http.StatusOK {
		t.Fatalf("expected admin replace tags 200, got %d: %s", adminReplace.Code, adminReplace.Body.String())
	}

	for i := 0; i < 3; i++ {
		if err := fixture.db.Create(&agent.AgentStepAttempt{UserID: fixture.studentA.ID, ManualID: manual.ID, StepID: step.ID, StepOrder: 0, AttemptType: agent.AgentStepAttemptTypeVerify, Success: false, FailureReason: fmt.Sprintf("失败 %d", i+1)}).Error; err != nil {
			t.Fatalf("seed attempt failed: %v", err)
		}
	}
	session := agent.AgentChatSession{UserID: fixture.studentA.ID, ManualID: manual.ID, StepOrder: 0, LastActiveAt: time.Now()}
	if err := fixture.db.Create(&session).Error; err != nil {
		t.Fatalf("seed chat session failed: %v", err)
	}
	if err := fixture.db.Create(&agent.AgentChatMessage{SessionID: session.ID, Role: "user", Content: strings.Repeat("学生问题", 80)}).Error; err != nil {
		t.Fatalf("seed chat message failed: %v", err)
	}
	if err := fixture.db.Create(&agent.AgentInterventionRecord{ManualID: manual.ID, ClassID: fixture.activeClass.ID, StepID: step.ID, StudentID: fixture.studentA.ID, TeacherID: fixture.teacherA.ID, ActionType: "student_reminder", Title: "请回应", Content: "补充你的错误截图", Status: "pending"}).Error; err != nil {
		t.Fatalf("seed intervention failed: %v", err)
	}
	if err := fixture.db.Create(&agent.AgentReflectionCard{UserID: fixture.studentA.ID, ManualID: manual.ID, Summary: "已能定位 Pod Pending。", Strengths: agent.JSONMap{"items": []string{"会看事件"}}, Status: "draft"}).Error; err != nil {
		t.Fatalf("seed reflection failed: %v", err)
	}

	detailResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/agent-observatory/cell-detail?manualId=%d&classId=%d&studentId=%d&stepId=%d", manual.ID, fixture.activeClass.ID, fixture.studentA.ID, step.ID), nil, teacherToken)
	if detailResp.Code != http.StatusOK {
		t.Fatalf("expected cell detail 200, got %d: %s", detailResp.Code, detailResp.Body.String())
	}
	var detailAPI apiResponse
	decodeJSON(t, detailResp.Body.Bytes(), &detailAPI)
	var detail assignment.AgentCellDetailResponse
	decodeJSON(t, detailAPI.Data, &detail)
	actionsText := strings.Join(detail.SuggestedActions, "\n")
	if len(detail.Attempts) != 3 || len(detail.RecentMessages) != 1 || !strings.Contains(actionsText, "student_reminder") || !strings.Contains(actionsText, "class_broadcast") || !strings.Contains(actionsText, "等待学生回应") {
		t.Fatalf("unexpected cell detail: %+v", detail)
	}
	if len([]rune(detail.RecentMessages[0].Content)) > 200 {
		t.Fatalf("expected chat message truncated, got %d runes", len([]rune(detail.RecentMessages[0].Content)))
	}
	foreignDetail := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/agent-observatory/cell-detail?manualId=%d&classId=%d&studentId=%d&stepId=%d", manual.ID, fixture.activeClass.ID, fixture.studentA.ID, step.ID), nil, foreignTeacherToken)
	if foreignDetail.Code != http.StatusForbidden {
		t.Fatalf("expected foreign cell detail forbidden, got %d: %s", foreignDetail.Code, foreignDetail.Body.String())
	}

	suggestion := assignment.AISuggestion{SuggestionType: assignment.AISuggestionTypeFAQSuggestion, SourceType: assignment.AISourceTypeAgentStep, SourceID: step.ID, CreatedBy: fixture.teacherA.ID, Title: "FAQ 草稿", Content: `{"question":"如何排查？","answer":"看事件。"}`, Evidence: assignment.JSONMap{"question": "如何排查？", "answer": "看事件。"}, Status: assignment.AISuggestionStatusPending}
	if err := fixture.db.Create(&suggestion).Error; err != nil {
		t.Fatalf("seed faq suggestion failed: %v", err)
	}
	publishResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/teacher/ai-suggestions/%d/publish-faq", suggestion.ID), map[string]any{"classId": fixture.activeClass.ID}, teacherToken)
	if publishResp.Code != http.StatusCreated {
		t.Fatalf("expected publish faq 201, got %d: %s", publishResp.Code, publishResp.Body.String())
	}
	faqResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/agent-faq?manualId=%d&classId=%d&stepId=%d&status=published", manual.ID, fixture.activeClass.ID, step.ID), nil, teacherToken)
	if faqResp.Code != http.StatusOK || !strings.Contains(faqResp.Body.String(), "如何排查") {
		t.Fatalf("expected faq list 200 with item, got %d: %s", faqResp.Code, faqResp.Body.String())
	}
	var faqAPI apiResponse
	decodeJSON(t, publishResp.Body.Bytes(), &faqAPI)
	var publishedFAQ agent.AgentFAQItem
	decodeJSON(t, faqAPI.Data, &publishedFAQ)
	wrongClassFAQ := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/agent/faq?manualId=%d&stepOrder=0&classId=%d", manual.ID, fixture.foreignClass.ID), nil, studentToken)
	if wrongClassFAQ.Code != http.StatusForbidden {
		t.Fatalf("expected wrong class faq forbidden, got %d: %s", wrongClassFAQ.Code, wrongClassFAQ.Body.String())
	}
	archiveResp := performJSON(t, fixture.engine, http.MethodPatch, fmt.Sprintf("/api/teacher/agent-faq/%d/archive", publishedFAQ.ID), nil, teacherToken)
	if archiveResp.Code != http.StatusOK {
		t.Fatalf("expected archive faq 200, got %d: %s", archiveResp.Code, archiveResp.Body.String())
	}
	archivedResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/agent-faq?manualId=%d&classId=%d&status=archived", manual.ID, fixture.activeClass.ID), nil, teacherToken)
	if archivedResp.Code != http.StatusOK || !strings.Contains(archivedResp.Body.String(), `"status":"archived"`) {
		t.Fatalf("expected archived faq visible, got %d: %s", archivedResp.Code, archivedResp.Body.String())
	}

	materialResp := performJSON(t, fixture.engine, http.MethodPost, "/api/teacher/agent-interventions", map[string]any{
		"manualId": manual.ID, "classId": fixture.activeClass.ID, "stepId": step.ID, "actionType": "material_note", "title": "备课备注", "content": "教师内部可见",
	}, teacherToken)
	if materialResp.Code != http.StatusCreated {
		t.Fatalf("expected material note 201, got %d: %s", materialResp.Code, materialResp.Body.String())
	}
	teacherInterventions := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/agent-interventions?manualId=%d&classId=%d&stepId=%d", manual.ID, fixture.activeClass.ID, step.ID), nil, teacherToken)
	if teacherInterventions.Code != http.StatusOK || !strings.Contains(teacherInterventions.Body.String(), "备课备注") {
		t.Fatalf("expected teacher intervention list with material note, got %d: %s", teacherInterventions.Code, teacherInterventions.Body.String())
	}
	studentPending := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/agent/pending-interventions?manualId=%d", manual.ID), nil, studentToken)
	if studentPending.Code != http.StatusOK || strings.Contains(studentPending.Body.String(), "备课备注") {
		t.Fatalf("expected material note hidden from student, got %d: %s", studentPending.Code, studentPending.Body.String())
	}
	reflectionResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/students/%d/reflection-card?manualId=%d", fixture.studentA.ID, manual.ID), nil, teacherToken)
	if reflectionResp.Code != http.StatusOK || !strings.Contains(reflectionResp.Body.String(), "Pod Pending") {
		t.Fatalf("expected teacher reflection 200, got %d: %s", reflectionResp.Code, reflectionResp.Body.String())
	}
	foreignReflection := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/teacher/students/%d/reflection-card?manualId=%d", fixture.studentA.ID, manual.ID), nil, foreignTeacherToken)
	if foreignReflection.Code != http.StatusForbidden {
		t.Fatalf("expected foreign reflection forbidden, got %d: %s", foreignReflection.Code, foreignReflection.Body.String())
	}

	importMarkdown := "# 导入覆盖手册\n\n## 步骤 1: 新步骤\n\n新的步骤内容。\n"
	foreignImport := performJSON(t, fixture.engine, http.MethodPost, "/api/teacher/manuals/import", map[string]any{
		"sourceType": manual.SourceType,
		"sourceId":   manual.SourceID,
		"markdown":   importMarkdown,
	}, foreignTeacherToken)
	if foreignImport.Code != http.StatusForbidden {
		t.Fatalf("expected foreign import forbidden, got %d: %s", foreignImport.Code, foreignImport.Body.String())
	}
	assignedImport := performJSON(t, fixture.engine, http.MethodPost, "/api/teacher/manuals/import", map[string]any{
		"sourceType": manual.SourceType,
		"sourceId":   manual.SourceID,
		"markdown":   importMarkdown,
	}, teacherToken)
	if assignedImport.Code != http.StatusOK || !strings.Contains(assignedImport.Body.String(), "导入覆盖手册") {
		t.Fatalf("expected assigned teacher import 200, got %d: %s", assignedImport.Code, assignedImport.Body.String())
	}
}
