package agent

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type fakeRuntimeBridge struct {
	session    *RuntimeSession
	result     RuntimeCommandResult
	lastCmd    string
	lastID     uint64
	resolveErr error
	execErr    error
}

func (f *fakeRuntimeBridge) ResolveRuntime(_ context.Context, _ string) (*RuntimeSession, error) {
	return f.session, f.resolveErr
}

func (f *fakeRuntimeBridge) ExecuteRuntimeCommand(_ context.Context, sessionID uint64, command string) (RuntimeCommandResult, error) {
	f.lastID = sessionID
	f.lastCmd = command
	return f.result, f.execErr
}

func TestVerifyStepUsesRuntimeBridgeForFileExists(t *testing.T) {
	service, bridge := newVerifyTestService(t)
	bridge.session = &RuntimeSession{ID: 23, UserID: 7, Status: "running"}
	bridge.result = RuntimeCommandResult{Success: true, ExitCode: 0}

	if err := service.db.Create(&AgentStep{
		ManualID:  11,
		StepOrder: 1,
		Title:     "检查工作区",
		Verification: &VerificationRule{
			Type: "file_exists",
			Path: "/workspace",
		},
	}).Error; err != nil {
		t.Fatalf("create step: %v", err)
	}

	result, err := service.VerifyStep(context.Background(), 7, 11, 1, "runtime-1")
	if err != nil {
		t.Fatalf("verify step: %v", err)
	}
	if !result.Success {
		t.Fatalf("expected success, got %+v", result)
	}
	if bridge.lastID != 23 {
		t.Fatalf("expected session id 23, got %d", bridge.lastID)
	}
	if bridge.lastCmd != "test -e '/workspace'" {
		t.Fatalf("unexpected verification command: %s", bridge.lastCmd)
	}
}

func TestVerifyStepChecksCommandOutput(t *testing.T) {
	service, bridge := newVerifyTestService(t)
	bridge.session = &RuntimeSession{ID: 45, UserID: 9, Status: "running"}
	bridge.result = RuntimeCommandResult{Success: true, ExitCode: 0, Output: "root\n"}

	if err := service.db.Create(&AgentStep{
		ManualID:  12,
		StepOrder: 2,
		Title:     "检查当前用户",
		Verification: &VerificationRule{
			Type:    "command_output",
			Command: "whoami",
			Expect:  "equals",
			Value:   "root",
		},
	}).Error; err != nil {
		t.Fatalf("create step: %v", err)
	}

	result, err := service.VerifyStep(context.Background(), 9, 12, 2, "45")
	if err != nil {
		t.Fatalf("verify step: %v", err)
	}
	if !result.Success {
		t.Fatalf("expected success, got %+v", result)
	}
	if bridge.lastCmd != "whoami" {
		t.Fatalf("expected whoami command, got %s", bridge.lastCmd)
	}
}

func TestVerifyStepRecordsAttemptAndEvents(t *testing.T) {
	service, bridge := newVerifyTestService(t)
	bridge.session = &RuntimeSession{ID: 77, UserID: 4, Status: "running"}
	bridge.result = RuntimeCommandResult{Success: false, ExitCode: 1, Error: "missing file"}

	if err := service.db.Create(&AgentStep{
		ManualID:  14,
		StepOrder: 3,
		Title:     "检查文件",
		Verification: &VerificationRule{
			Type: "file_exists",
			Path: "/workspace/answer.txt",
		},
	}).Error; err != nil {
		t.Fatalf("create step: %v", err)
	}

	result, err := service.VerifyStep(context.Background(), 4, 14, 3, "77")
	if err != nil {
		t.Fatalf("verify step: %v", err)
	}
	if result.Success {
		t.Fatalf("expected failed verification")
	}

	var attempt AgentStepAttempt
	if err := service.db.First(&attempt, "user_id = ? AND manual_id = ?", 4, 14).Error; err != nil {
		t.Fatalf("find attempt: %v", err)
	}
	if attempt.AttemptType != AgentStepAttemptTypeVerify {
		t.Fatalf("unexpected attempt type: %s", attempt.AttemptType)
	}
	if attempt.Success {
		t.Fatalf("expected failed attempt")
	}
	if attempt.LabSessionID != 77 {
		t.Fatalf("expected lab session 77, got %d", attempt.LabSessionID)
	}

	var eventCount int64
	if err := service.db.Model(&AgentLearningEvent{}).Where("event_type IN ?", []string{AgentEventTypeVerify, AgentEventTypeVerifyFail}).Count(&eventCount).Error; err != nil {
		t.Fatalf("count events: %v", err)
	}
	if eventCount != 2 {
		t.Fatalf("expected 2 events, got %d", eventCount)
	}
}

func TestVerifyStepRecordsAttemptWhenRuntimeMissing(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "agent-verify-no-runtime.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&AgentStep{}, &AgentStepAttempt{}, &AgentLearningEvent{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	service := NewService(db, zap.NewNop(), nil)
	if err := service.db.Create(&AgentStep{
		ManualID:     15,
		StepOrder:    1,
		Title:        "检查运行时",
		Verification: &VerificationRule{Type: "file_exists", Path: "/workspace"},
	}).Error; err != nil {
		t.Fatalf("create step: %v", err)
	}

	result, err := service.VerifyStep(context.Background(), 5, 15, 1, "runtime-1")
	if err != nil {
		t.Fatalf("verify step: %v", err)
	}
	if result.Success || result.Message != "运行时验证未启用" {
		t.Fatalf("unexpected result: %+v", result)
	}
	assertFailedAttemptRecorded(t, service.db, 5, 15, "运行时验证未启用")
}

func TestVerifyStepRecordsAttemptWhenRuntimeRefEmpty(t *testing.T) {
	service, _ := newVerifyTestService(t)
	if err := service.db.Create(&AgentStep{
		ManualID:     16,
		StepOrder:    1,
		Title:        "检查运行时标识",
		Verification: &VerificationRule{Type: "file_exists", Path: "/workspace"},
	}).Error; err != nil {
		t.Fatalf("create step: %v", err)
	}

	result, err := service.VerifyStep(context.Background(), 6, 16, 1, "")
	if err != nil {
		t.Fatalf("verify step: %v", err)
	}
	if result.Success || result.Message != "缺少运行时标识" {
		t.Fatalf("unexpected result: %+v", result)
	}
	assertFailedAttemptRecorded(t, service.db, 6, 16, "缺少运行时标识")
}

func TestVerifyStepRecordsAttemptWhenRuntimeResolveFails(t *testing.T) {
	service, bridge := newVerifyTestService(t)
	bridge.resolveErr = errors.New("k8s pod not found")
	if err := service.db.Create(&AgentStep{
		ManualID:     17,
		StepOrder:    1,
		Title:        "解析运行时",
		Verification: &VerificationRule{Type: "file_exists", Path: "/workspace"},
	}).Error; err != nil {
		t.Fatalf("create step: %v", err)
	}

	result, err := service.VerifyStep(context.Background(), 7, 17, 1, "missing-runtime")
	if err != nil {
		t.Fatalf("verify step: %v", err)
	}
	if result.Success || result.Message != "实验环境解析失败" {
		t.Fatalf("unexpected result: %+v", result)
	}
	assertFailedAttemptRecorded(t, service.db, 7, 17, "实验环境解析失败")
}

func TestVerifyStepReturnsBusinessFailureWhenRuntimeExecFails(t *testing.T) {
	service, bridge := newVerifyTestService(t)
	bridge.session = &RuntimeSession{ID: 88, UserID: 8, Status: "running"}
	bridge.execErr = errors.New("K8S exec bridge 未启用")
	if err := service.db.Create(&AgentStep{
		ManualID:     18,
		StepOrder:    1,
		Title:        "执行验证",
		Verification: &VerificationRule{Type: "file_exists", Path: "/workspace"},
	}).Error; err != nil {
		t.Fatalf("create step: %v", err)
	}

	result, err := service.VerifyStep(context.Background(), 8, 18, 1, "88")
	if err != nil {
		t.Fatalf("verify step should not return transport error: %v", err)
	}
	if result.Success || result.Message != "验证命令执行失败" || result.Details != "K8S exec bridge 未启用" {
		t.Fatalf("unexpected result: %+v", result)
	}
	assertFailedAttemptRecorded(t, service.db, 8, 18, "验证命令执行失败")
}

func TestRecordStepAttemptRejectsUnknownType(t *testing.T) {
	service, _ := newVerifyTestService(t)
	err := service.recordStepAttempt(context.Background(), 1, 2, &AgentStep{ID: 3, StepOrder: 4}, 0, "manual", VerifyResult{}, StepAttemptEvidence{})
	if err == nil {
		t.Fatalf("expected invalid attempt type error")
	}
}

func assertFailedAttemptRecorded(t *testing.T, db *gorm.DB, userID, manualID uint64, reason string) {
	t.Helper()
	var attempt AgentStepAttempt
	if err := db.First(&attempt, "user_id = ? AND manual_id = ?", userID, manualID).Error; err != nil {
		t.Fatalf("find attempt: %v", err)
	}
	if attempt.Success {
		t.Fatalf("expected failed attempt, got %+v", attempt)
	}
	if attempt.FailureReason != reason {
		t.Fatalf("expected failure reason %q, got %q", reason, attempt.FailureReason)
	}
	var eventCount int64
	if err := db.Model(&AgentLearningEvent{}).
		Where("user_id = ? AND manual_id = ? AND event_type = ?", userID, manualID, AgentEventTypeVerifyFail).
		Count(&eventCount).Error; err != nil {
		t.Fatalf("count verify failed event: %v", err)
	}
	if eventCount != 1 {
		t.Fatalf("expected one verify_failed event, got %d", eventCount)
	}
}

func TestVerifyStepRejectsForeignRuntime(t *testing.T) {
	service, bridge := newVerifyTestService(t)
	bridge.session = &RuntimeSession{ID: 99, UserID: 2, Status: "running"}

	if err := service.db.Create(&AgentStep{
		ManualID:  13,
		StepOrder: 1,
		Title:     "检查目录",
		Verification: &VerificationRule{
			Type: "file_exists",
			Path: "/workspace",
		},
	}).Error; err != nil {
		t.Fatalf("create step: %v", err)
	}

	result, err := service.VerifyStep(context.Background(), 1, 13, 1, "foreign-runtime")
	if err != nil {
		t.Fatalf("verify step: %v", err)
	}
	if result.Success {
		t.Fatalf("expected failure for foreign runtime, got %+v", result)
	}
	if result.Message != "实验环境不属于当前用户" {
		t.Fatalf("unexpected message: %s", result.Message)
	}
}

func newVerifyTestService(t *testing.T) (*Service, *fakeRuntimeBridge) {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "agent-verify.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&AgentStep{}, &AgentStepAttempt{}, &AgentLearningEvent{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	service := NewService(db, zap.NewNop(), nil)
	bridge := &fakeRuntimeBridge{}
	service.SetRuntimeBridge(bridge)
	return service, bridge
}
