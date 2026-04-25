package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"edu-platform/internal/config"
)

func TestCoachStreamRecordsSingleChatEventAndResetsFailureCount(t *testing.T) {
	var captured chatCompletionRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &captured)
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"收到\"}}]}\n\n")
		_, _ = fmt.Fprint(w, "data: [DONE]\n\n")
	}))
	defer server.Close()

	dbPath := filepath.Join(t.TempDir(), "agent-coach.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&AgentStep{}, &AgentStepAttempt{}, &AgentLearningEvent{}, &AgentChatSession{}, &AgentChatMessage{}, &AIFeatureSetting{}, &LabTerminalEvent{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	ai := NewAIClient(config.QwenConfig{APIKey: "test-key", BaseURL: server.URL, Model: "coach-test"}, zap.NewNop())
	service := NewService(db, zap.NewNop(), ai)

	step := AgentStep{ManualID: 21, StepOrder: 2, Title: "排查失败", Content: []ContentBlock{{Type: "text", Text: "检查命令输出"}}}
	if err := db.Create(&step).Error; err != nil {
		t.Fatalf("create step: %v", err)
	}
	attempts := []AgentStepAttempt{
		{UserID: 8, ManualID: 21, StepID: step.ID, StepOrder: step.StepOrder, AttemptType: AgentStepAttemptTypeVerify, Success: false, FailureReason: "第一次失败"},
		{UserID: 8, ManualID: 21, StepID: step.ID, StepOrder: step.StepOrder, AttemptType: AgentStepAttemptTypeVerify, Success: true},
		{UserID: 8, ManualID: 21, StepID: step.ID, StepOrder: step.StepOrder, AttemptType: AgentStepAttemptTypeVerify, Success: false, FailureReason: "最近失败"},
	}
	if err := db.Create(&attempts).Error; err != nil {
		t.Fatalf("create attempts: %v", err)
	}
	session := AgentChatSession{UserID: 8, ManualID: 21, StepOrder: 2, LastActiveAt: nowForTest()}
	if err := db.Create(&session).Error; err != nil {
		t.Fatalf("create chat session: %v", err)
	}
	if err := db.Create(&AgentChatMessage{SessionID: session.ID, Role: "user", Content: "服务端历史"}).Error; err != nil {
		t.Fatalf("create chat message: %v", err)
	}
	if err := db.Create(&[]LabTerminalEvent{
		{UserID: 8, ManualID: 21, StepOrder: 2, Command: "echo old", OutputSummary: "old", ExitCode: 0},
		{UserID: 8, ManualID: 21, StepOrder: 2, Command: "kubectl get pods", OutputSummary: strings.Repeat("最近输出", 80), ExitCode: 0},
		{UserID: 8, ManualID: 21, StepOrder: 2, Command: "cat config", OutputSummary: "token=abc123", ExitCode: 1},
		{UserID: 8, ManualID: 21, StepOrder: 2, Command: "pwd", OutputSummary: "/workspace", ExitCode: 0},
	}).Error; err != nil {
		t.Fatalf("create terminal events: %v", err)
	}

	var meta CoachMeta
	var streamed strings.Builder
	err = service.CoachStream(
		context.Background(),
		8,
		CoachRequest{
			ManualID:    21,
			StepOrder:   2,
			Question:    "我该怎么继续？",
			ChatHistory: []ChatMessage{{Role: "user", Content: "上一轮问题"}},
		},
		func(item CoachMeta) error {
			meta = item
			return nil
		},
		func(chunk string) error {
			streamed.WriteString(chunk)
			return nil
		},
	)
	if err != nil {
		t.Fatalf("coach stream: %v", err)
	}
	if meta.FailureCount != 1 || meta.HintLevel != 1 {
		t.Fatalf("expected failure count reset to 1 and level 1, got %+v", meta)
	}
	if streamed.String() != "收到" {
		t.Fatalf("unexpected streamed content: %q", streamed.String())
	}
	var chatEvents int64
	if err := db.Model(&AgentLearningEvent{}).
		Where("user_id = ? AND manual_id = ? AND step_order = ? AND event_type = ?", 8, 21, 2, AgentEventTypeChat).
		Count(&chatEvents).Error; err != nil {
		t.Fatalf("count chat events: %v", err)
	}
	if chatEvents != 1 {
		t.Fatalf("expected one chat_sent event, got %d", chatEvents)
	}
	joinedMessages := ""
	for _, msg := range captured.Messages {
		joinedMessages += msg.Content + "\n"
	}
	if !strings.Contains(joinedMessages, "服务端历史") || strings.Contains(joinedMessages, "上一轮问题") {
		t.Fatalf("expected server history only, got %q", joinedMessages)
	}
	if !strings.Contains(joinedMessages, "最近终端记录：") || !strings.Contains(joinedMessages, "$ kubectl get pods") || strings.Contains(joinedMessages, "echo old") {
		t.Fatalf("expected recent terminal summaries in prompt, got %q", joinedMessages)
	}
	var messages []AgentChatMessage
	if err := db.Where("session_id = ?", session.ID).Order("id ASC").Find(&messages).Error; err != nil {
		t.Fatalf("load persisted chat messages: %v", err)
	}
	if len(messages) != 3 || messages[1].Role != "user" || messages[2].Role != "assistant" {
		t.Fatalf("expected user and assistant persisted after history, got %+v", messages)
	}
	for i := 0; i < 25; i++ {
		if err := db.Create(&AgentChatMessage{SessionID: session.ID, Role: "user", Content: fmt.Sprintf("历史%d", i)}).Error; err != nil {
			t.Fatalf("seed extra message: %v", err)
		}
	}

	meta = CoachMeta{}
	err = service.CoachStream(
		context.Background(),
		8,
		CoachRequest{ManualID: 21, StepOrder: 2, Question: "给我完整提示", Escalate: true},
		func(item CoachMeta) error {
			meta = item
			return nil
		},
		func(string) error { return nil },
	)
	if err != nil {
		t.Fatalf("coach stream with escalation: %v", err)
	}
	if meta.HintLevel != 3 || meta.FailureCount != 1 {
		t.Fatalf("expected escalation level 3 with one failure, got %+v", meta)
	}
	var messageCount int64
	if err := db.Model(&AgentChatMessage{}).Where("session_id = ?", session.ID).Count(&messageCount).Error; err != nil {
		t.Fatalf("count pruned messages: %v", err)
	}
	if messageCount > 20 {
		t.Fatalf("expected chat messages pruned to <= 20, got %d", messageCount)
	}
}

func TestRedactSensitiveText(t *testing.T) {
	input := "Authorization: Bearer abc.def password=123 token=abc api_key=key secret=s\n-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----"
	output := redactSensitiveText(input)
	if strings.Contains(output, "abc.def") || strings.Contains(output, "password=123") || strings.Contains(output, "api_key=key") || strings.Contains(output, "PRIVATE KEY") {
		t.Fatalf("expected sensitive text redacted, got %q", output)
	}
	if count := strings.Count(output, "[REDACTED]"); count < 4 {
		t.Fatalf("expected multiple redactions, got %q", output)
	}
}

func nowForTest() time.Time {
	return time.Now()
}
