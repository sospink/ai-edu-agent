package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"regexp"
	"sort"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/user"
	apperrors "edu-platform/pkg/errors"
	appredact "edu-platform/pkg/redact"
)

var ErrManualExists = errors.New("手册已存在")

type Service struct {
	db      *gorm.DB
	logger  *zap.Logger
	ai      *AIClient
	runtime RuntimeBridge
}

type RuntimeBridge interface {
	ResolveRuntime(ctx context.Context, runtimeRef string) (*RuntimeSession, error)
	ExecuteRuntimeCommand(ctx context.Context, sessionID uint64, command string) (RuntimeCommandResult, error)
}

func NewService(db *gorm.DB, logger *zap.Logger, ai *AIClient) *Service {
	return &Service{
		db:     db,
		logger: logger,
		ai:     ai,
	}
}

func (s *Service) SetRuntimeBridge(runtime RuntimeBridge) {
	s.runtime = runtime
}

func (s *Service) GetManual(ctx context.Context, sourceType int, sourceID uint64) (*AgentManual, error) {
	var manual AgentManual
	if err := s.db.WithContext(ctx).
		Where("source_type = ? AND source_id = ? AND is_published = 1", sourceType, sourceID).
		First(&manual).Error; err != nil {
		return nil, err
	}
	if err := s.loadManualSteps(ctx, &manual); err != nil {
		return nil, err
	}
	s.localizeManual(ctx, &manual)
	return &manual, nil
}

func (s *Service) GetManualForAdmin(ctx context.Context, sourceType int, sourceID uint64) (*AgentManual, error) {
	var manual AgentManual
	if err := s.db.WithContext(ctx).
		Where("source_type = ? AND source_id = ?", sourceType, sourceID).
		First(&manual).Error; err != nil {
		return nil, err
	}
	if err := s.loadManualSteps(ctx, &manual); err != nil {
		return nil, err
	}
	s.localizeManual(ctx, &manual)
	return &manual, nil
}

func (s *Service) GetManualByID(ctx context.Context, manualID uint64) (*AgentManual, error) {
	var manual AgentManual
	if err := s.db.WithContext(ctx).First(&manual, manualID).Error; err != nil {
		return nil, err
	}
	if err := s.loadManualSteps(ctx, &manual); err != nil {
		return nil, err
	}
	s.localizeManual(ctx, &manual)
	return &manual, nil
}

func (s *Service) FindManualByID(ctx context.Context, manualID uint64) (*AgentManual, error) {
	var manual AgentManual
	if err := s.db.WithContext(ctx).First(&manual, manualID).Error; err != nil {
		return nil, err
	}
	return &manual, nil
}

func (s *Service) EnsureAssignedTeacherCanMaintainManual(ctx context.Context, actorID uint64, manualID uint64) error {
	var count int64
	err := s.db.WithContext(ctx).Table("assignment_resources AS ar").
		Joins("JOIN teaching_assignments AS ta ON ta.id = ar.assignment_id AND ta.status <> ?", 3).
		Joins("JOIN assignment_classes AS ac ON ac.assignment_id = ta.id").
		Joins("JOIN classes AS c ON c.id = ac.class_id AND c.status = ?", classroom.ClassStatusActive).
		Joins("JOIN class_teachers AS ct ON ct.class_id = c.id AND ct.status = ?", classroom.ClassTeacherStatusActive).
		Where("ar.manual_id = ? AND ct.teacher_id = ?", manualID, actorID).
		Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return apperrors.Forbidden("无权维护该手册")
	}
	return nil
}

func (s *Service) GetProgress(ctx context.Context, userID, manualID uint64) (*UserAgentProgress, error) {
	var progress UserAgentProgress
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND manual_id = ?", userID, manualID).
		First(&progress).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &progress, nil
}

func (s *Service) GetOrCreateProgress(ctx context.Context, userID, manualID uint64) (*UserAgentProgress, error) {
	progress, err := s.GetProgress(ctx, userID, manualID)
	if err != nil {
		return nil, err
	}
	if progress != nil {
		return progress, nil
	}

	now := time.Now()
	progress = &UserAgentProgress{
		UserID:         userID,
		ManualID:       manualID,
		CurrentStep:    0,
		CompletedSteps: []int{},
		ChatHistory:    []ChatMessage{},
		StartedAt:      now,
		LastActiveAt:   now,
	}
	if err := s.db.WithContext(ctx).Create(progress).Error; err != nil {
		return nil, err
	}
	return progress, nil
}

func (s *Service) UpdateProgress(ctx context.Context, userID, manualID uint64, data UserAgentProgress) (*UserAgentProgress, error) {
	progress, err := s.GetOrCreateProgress(ctx, userID, manualID)
	if err != nil {
		return nil, err
	}

	progress.CurrentStep = data.CurrentStep
	progress.CompletedSteps = normalizeCompletedSteps(data.CompletedSteps)
	progress.ChatHistory = normalizeChatHistory(data.ChatHistory)
	progress.LastActiveAt = time.Now()

	if err := s.db.WithContext(ctx).Save(progress).Error; err != nil {
		return nil, err
	}
	return progress, nil
}

func (s *Service) CompleteStep(ctx context.Context, userID, manualID uint64, stepOrder int) (*UserAgentProgress, error) {
	progress, err := s.GetOrCreateProgress(ctx, userID, manualID)
	if err != nil {
		return nil, err
	}

	if !containsInt(progress.CompletedSteps, stepOrder) {
		progress.CompletedSteps = append(progress.CompletedSteps, stepOrder)
		progress.CompletedSteps = normalizeCompletedSteps(progress.CompletedSteps)
	}
	progress.CurrentStep = stepOrder + 1
	progress.LastActiveAt = time.Now()

	if err := s.db.WithContext(ctx).Save(progress).Error; err != nil {
		return nil, err
	}
	return progress, nil
}

func (s *Service) VerifyStep(ctx context.Context, userID, manualID uint64, stepOrder int, runtimeRef string) (VerifyResult, error) {
	var step AgentStep
	if err := s.db.WithContext(ctx).
		Where("manual_id = ? AND step_order = ?", manualID, stepOrder).
		First(&step).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return VerifyResult{Success: false, Message: "步骤不存在"}, nil
		}
		return VerifyResult{}, err
	}

	_ = s.RecordLearningEvent(ctx, userID, manualID, stepOrder, AgentEventTypeVerify, nil)

	if step.Verification == nil || strings.TrimSpace(step.Verification.Type) == "" {
		result := VerifyResult{Success: true, Message: "无需验证，可以继续"}
		_ = s.recordStepAttempt(ctx, userID, manualID, &step, 0, AgentStepAttemptTypeVerify, result, StepAttemptEvidence{})
		return result, nil
	}

	if s.runtime == nil {
		result := VerifyResult{
			Success: false,
			Message: "运行时验证未启用",
			Details: "当前环境未注入实验运行时桥接服务，请检查后端启动配置。",
			CheckItems: []CheckItem{
				{Name: "runtime", Status: "failed", Message: "运行时桥接不可用"},
			},
		}
		_ = s.recordStepAttempt(ctx, userID, manualID, &step, 0, AgentStepAttemptTypeVerify, result, StepAttemptEvidence{})
		return result, nil
	}

	runtimeRef = strings.TrimSpace(runtimeRef)
	if runtimeRef == "" {
		result := VerifyResult{
			Success: false,
			Message: "缺少运行时标识",
			Details: "当前验证依赖实验运行时上下文，请检查 Lab 会话是否已创建。",
			CheckItems: []CheckItem{
				{Name: "runtime", Status: "failed", Message: "运行时标识为空"},
			},
		}
		_ = s.recordStepAttempt(ctx, userID, manualID, &step, 0, AgentStepAttemptTypeVerify, result, StepAttemptEvidence{})
		return result, nil
	}

	runtimeSession, err := s.runtime.ResolveRuntime(ctx, runtimeRef)
	if err != nil {
		result := VerifyResult{
			Success: false,
			Message: "实验环境解析失败",
			Details: err.Error(),
			CheckItems: []CheckItem{
				{Name: "runtime", Status: "failed", Message: "运行时解析失败"},
			},
		}
		_ = s.recordStepAttempt(ctx, userID, manualID, &step, 0, AgentStepAttemptTypeVerify, result, StepAttemptEvidence{})
		return result, nil
	}
	if runtimeSession == nil {
		result := VerifyResult{
			Success: false,
			Message: "实验环境不存在",
			Details: "未找到可用于验证的实验会话，请重新打开或创建 Lab 环境。",
			CheckItems: []CheckItem{
				{Name: "runtime", Status: "failed", Message: "运行时会话不存在"},
			},
		}
		_ = s.recordStepAttempt(ctx, userID, manualID, &step, 0, AgentStepAttemptTypeVerify, result, StepAttemptEvidence{})
		return result, nil
	}
	if userID != 0 && runtimeSession.UserID != 0 && runtimeSession.UserID != userID {
		result := VerifyResult{
			Success: false,
			Message: "实验环境不属于当前用户",
			Details: "请在自己的实验环境中执行验证。",
			CheckItems: []CheckItem{
				{Name: "runtime", Status: "failed", Message: "运行时归属校验失败"},
			},
		}
		_ = s.recordStepAttempt(ctx, userID, manualID, &step, runtimeSession.ID, AgentStepAttemptTypeVerify, result, StepAttemptEvidence{LabSessionID: runtimeSession.ID})
		return result, nil
	}
	if runtimeSession.Status != "running" {
		message := "实验环境尚未就绪"
		if runtimeSession.Status == "stopped" || runtimeSession.Status == "error" {
			message = "实验环境已停止"
		}
		result := VerifyResult{
			Success: false,
			Message: message,
			Details: fmt.Sprintf("当前运行时状态为 %s，请确认 Lab 已成功启动。", runtimeSession.Status),
			CheckItems: []CheckItem{
				{Name: "runtime", Status: "failed", Message: fmt.Sprintf("运行时状态: %s", runtimeSession.Status)},
			},
		}
		_ = s.recordStepAttempt(ctx, userID, manualID, &step, runtimeSession.ID, AgentStepAttemptTypeVerify, result, StepAttemptEvidence{LabSessionID: runtimeSession.ID})
		return result, nil
	}

	result, evidence, err := s.executeVerification(ctx, runtimeSession.ID, step.Verification)
	if err != nil {
		result := VerifyResult{
			Success: false,
			Message: "验证命令执行失败",
			Details: err.Error(),
			CheckItems: []CheckItem{
				{Name: "runtime", Status: "failed", Message: err.Error()},
			},
		}
		_ = s.recordStepAttempt(ctx, userID, manualID, &step, runtimeSession.ID, AgentStepAttemptTypeVerify, result, StepAttemptEvidence{LabSessionID: runtimeSession.ID})
		return result, nil
	}
	evidence.LabSessionID = runtimeSession.ID
	if err := s.recordStepAttempt(ctx, userID, manualID, &step, runtimeSession.ID, AgentStepAttemptTypeVerify, result, evidence); err != nil {
		s.logger.Warn("record agent step attempt failed", zap.Error(err))
	}
	return result, nil
}

func (s *Service) executeVerification(ctx context.Context, sessionID uint64, rule *VerificationRule) (VerifyResult, StepAttemptEvidence, error) {
	switch strings.TrimSpace(rule.Type) {
	case "file_exists":
		target := strings.TrimSpace(rule.Path)
		if target == "" {
			return invalidRuleResult("file_exists 缺少 path"), StepAttemptEvidence{}, nil
		}
		return s.runSimpleCommandCheck(ctx, sessionID,
			fmt.Sprintf("test -e %s", shellQuote(target)),
			path.Base(target)+" 存在校验",
			fmt.Sprintf("已检测到 %s", target),
			fmt.Sprintf("未检测到 %s", target),
		)
	case "service_running":
		if rule.Port <= 0 {
			return invalidRuleResult("service_running 缺少有效 port"), StepAttemptEvidence{}, nil
		}
		return s.runSimpleCommandCheck(ctx, sessionID,
			fmt.Sprintf(":</dev/tcp/127.0.0.1/%d", rule.Port),
			fmt.Sprintf("端口 %d 连通性校验", rule.Port),
			fmt.Sprintf("服务端口 %d 可访问", rule.Port),
			fmt.Sprintf("服务端口 %d 不可访问", rule.Port),
		)
	case "custom":
		command := strings.TrimSpace(firstNonEmpty(rule.Script, rule.Command))
		if command == "" {
			return invalidRuleResult("custom 缺少 script/command"), StepAttemptEvidence{}, nil
		}
		return s.runSimpleCommandCheck(ctx, sessionID,
			command,
			"自定义验证脚本",
			"自定义验证通过",
			"自定义验证未通过",
		)
	case "command_output":
		return s.verifyCommandOutput(ctx, sessionID, rule)
	default:
		return VerifyResult{
			Success: false,
			Message: "暂不支持的验证类型",
			Details: fmt.Sprintf("检测到验证类型 %s，当前后端尚未实现该规则。", rule.Type),
			CheckItems: []CheckItem{
				{Name: strings.TrimSpace(rule.Type), Status: "failed", Message: "验证类型未实现"},
			},
		}, StepAttemptEvidence{}, nil
	}
}

func (s *Service) runSimpleCommandCheck(
	ctx context.Context,
	sessionID uint64,
	command string,
	name string,
	successMessage string,
	failedMessage string,
) (VerifyResult, StepAttemptEvidence, error) {
	result, err := s.runtime.ExecuteRuntimeCommand(ctx, sessionID, command)
	if err != nil {
		return VerifyResult{}, StepAttemptEvidence{}, err
	}
	evidence := commandEvidence(command, result)
	if result.ExitCode == 0 {
		return VerifyResult{
			Success: true,
			Message: successMessage,
			Details: strings.TrimSpace(result.Output),
			CheckItems: []CheckItem{
				{Name: name, Status: "passed", Message: successMessage},
			},
		}, evidence, nil
	}

	return VerifyResult{
		Success: false,
		Message: failedMessage,
		Details: compactResultDetails(result),
		CheckItems: []CheckItem{
			{Name: name, Status: "failed", Message: firstNonEmpty(strings.TrimSpace(result.Error), failedMessage)},
		},
	}, evidence, nil
}

func (s *Service) verifyCommandOutput(ctx context.Context, sessionID uint64, rule *VerificationRule) (VerifyResult, StepAttemptEvidence, error) {
	command := strings.TrimSpace(rule.Command)
	if command == "" {
		return invalidRuleResult("command_output 缺少 command"), StepAttemptEvidence{}, nil
	}

	result, err := s.runtime.ExecuteRuntimeCommand(ctx, sessionID, command)
	if err != nil {
		return VerifyResult{}, StepAttemptEvidence{}, err
	}
	evidence := commandEvidence(command, result)
	if result.ExitCode != 0 {
		return VerifyResult{
			Success: false,
			Message: "验证命令执行失败",
			Details: compactResultDetails(result),
			CheckItems: []CheckItem{
				{Name: "command_output", Status: "failed", Message: firstNonEmpty(strings.TrimSpace(result.Error), "命令退出码非 0")},
			},
		}, evidence, nil
	}

	output := strings.TrimSpace(result.Output)
	expect := strings.TrimSpace(rule.Expect)
	if expect == "" {
		expect = "not_empty"
	}

	success := false
	message := ""
	switch expect {
	case "not_empty":
		success = output != ""
		if success {
			message = "命令已返回非空结果"
		} else {
			message = "命令输出为空"
		}
	case "contains":
		success = strings.Contains(result.Output, rule.Value)
		if success {
			message = fmt.Sprintf("命令输出包含 %q", rule.Value)
		} else {
			message = fmt.Sprintf("命令输出未包含 %q", rule.Value)
		}
	case "equals":
		success = output == strings.TrimSpace(rule.Value)
		if success {
			message = "命令输出与期望完全一致"
		} else {
			message = fmt.Sprintf("命令输出不等于 %q", strings.TrimSpace(rule.Value))
		}
	case "regex":
		matched, matchErr := regexp.MatchString(rule.Value, result.Output)
		if matchErr != nil {
			return invalidRuleResult("regex 表达式非法: " + matchErr.Error()), evidence, nil
		}
		success = matched
		if success {
			message = fmt.Sprintf("命令输出匹配正则 %q", rule.Value)
		} else {
			message = fmt.Sprintf("命令输出未匹配正则 %q", rule.Value)
		}
	default:
		return invalidRuleResult("command_output 不支持 expect=" + expect), evidence, nil
	}

	status := "failed"
	if success {
		status = "passed"
	}
	return VerifyResult{
		Success: success,
		Message: message,
		Details: compactResultDetails(result),
		CheckItems: []CheckItem{
			{Name: "command_output", Status: status, Message: message},
		},
	}, evidence, nil
}

func (s *Service) Chat(ctx context.Context, req ChatRequest) (string, error) {
	return s.ai.Chat(ctx, req)
}

func (s *Service) ChatStream(ctx context.Context, req ChatRequest, onChunk func(string) error) error {
	return s.ai.ChatStream(ctx, req, onChunk)
}

func (s *Service) CoachStream(ctx context.Context, userID uint64, req CoachRequest, onMeta func(CoachMeta) error, onChunk func(string) error) error {
	if strings.TrimSpace(req.Question) == "" {
		return fmt.Errorf("请输入问题")
	}
	setting, err := s.ensureAISetting(ctx)
	if err != nil {
		return err
	}
	if !setting.Enabled {
		return fmt.Errorf("AI 辅助能力已关闭")
	}
	if s.ai == nil || !s.ai.Enabled() {
		return fmt.Errorf("AI 服务未配置")
	}

	step, err := s.findStep(ctx, req.ManualID, req.StepOrder)
	if err != nil {
		return err
	}
	session, err := s.getOrCreateChatSession(ctx, userID, req.ManualID, req.StepOrder)
	if err != nil {
		return err
	}
	history, err := s.GetCoachHistory(ctx, userID, req.ManualID, req.StepOrder)
	if err != nil {
		return err
	}
	failureCount, err := s.consecutiveFailureCount(ctx, userID, step.ID)
	if err != nil {
		return err
	}
	level := coachHintLevel(failureCount, req.Escalate)
	meta := CoachMeta{HintLevel: level, FailureCount: failureCount}
	if onMeta != nil {
		if err := onMeta(meta); err != nil {
			return err
		}
	}

	_ = s.RecordLearningEvent(ctx, userID, req.ManualID, req.StepOrder, AgentEventTypeChat, JSONMap{
		"hintLevel":        level,
		"failureCount":     failureCount,
		"escalate":         req.Escalate,
		"troubleshootMode": req.TroubleshootMode,
	})
	if err := s.createChatMessage(ctx, session.ID, "user", req.Question); err != nil {
		return err
	}

	contextText := s.stepContext(step)
	if terminalContext, terminalErr := s.recentTerminalContext(ctx, userID, req.ManualID, req.StepOrder); terminalErr != nil {
		if s.logger != nil {
			s.logger.Warn("load recent terminal context failed", zap.Error(terminalErr))
		}
	} else if terminalContext != "" {
		contextText += "\n\n" + terminalContext
	}
	systemGuide := coachSystemGuide(level, req.TroubleshootMode)
	chatReq := ChatRequest{
		Question:    req.Question,
		StepContext: systemGuide + "\n\n当前学习内容：\n" + contextText,
		ChatHistory: history,
	}
	var assistant strings.Builder
	err = s.ai.ChatStream(ctx, chatReq, func(chunk string) error {
		assistant.WriteString(chunk)
		if onChunk != nil {
			return onChunk(chunk)
		}
		return nil
	})
	if err != nil {
		return err
	}
	if strings.TrimSpace(assistant.String()) != "" {
		if err := s.createChatMessage(ctx, session.ID, "assistant", assistant.String()); err != nil {
			return err
		}
	}
	return s.pruneChatMessages(ctx, session.ID, 20)
}

func (s *Service) ExplainCode(ctx context.Context, code, language string) (string, error) {
	return s.ai.ExplainCode(ctx, code, language)
}

func (s *Service) GetVerificationSuggestion(ctx context.Context, req VerificationHelpRequest) (string, error) {
	return s.ai.GetVerificationHelp(ctx, req)
}

func (s *Service) PromptEnhance(ctx context.Context, req PromptEnhanceRequest) (PromptEnhanceResult, error) {
	return s.ai.PromptEnhance(ctx, req)
}

func (s *Service) RecordLearningEvent(ctx context.Context, userID, manualID uint64, stepOrder int, eventType string, meta JSONMap) error {
	eventType = strings.TrimSpace(eventType)
	if !validAgentEventType(eventType) {
		return fmt.Errorf("不支持的 Agent 事件类型: %s", eventType)
	}
	if meta == nil {
		meta = JSONMap{}
	}
	return s.db.WithContext(ctx).Create(&AgentLearningEvent{
		UserID:    userID,
		ManualID:  manualID,
		StepOrder: stepOrder,
		EventType: eventType,
		Meta:      meta,
	}).Error
}

func (s *Service) GenerateReflectionCard(ctx context.Context, userID, manualID uint64) (*AgentReflectionCard, error) {
	var existing AgentReflectionCard
	if err := s.db.WithContext(ctx).Where("user_id = ? AND manual_id = ?", userID, manualID).First(&existing).Error; err == nil {
		return &existing, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	setting, err := s.ensureAISetting(ctx)
	if err != nil {
		return nil, err
	}
	if !setting.Enabled {
		return nil, fmt.Errorf("AI 辅助能力已关闭")
	}
	if s.ai == nil || !s.ai.Enabled() {
		return nil, fmt.Errorf("AI 服务未配置")
	}
	manual, err := s.GetManualByID(ctx, manualID)
	if err != nil {
		return nil, err
	}
	evidence, prompt := s.buildReflectionPrompt(ctx, userID, manual)
	result, err := s.ai.Complete(ctx,
		"你是 Agent EDU 的学习复盘助手。只根据给出的学习证据生成鼓励性复盘，不评分，不夸大，不披露内部数据。",
		prompt,
	)
	if err != nil {
		return nil, fmt.Errorf("学习复盘生成失败: %w", err)
	}
	card := parseReflectionContent(result.Content)
	card.UserID = userID
	card.ManualID = manualID
	card.Evidence = evidence
	card.Status = "draft"
	if strings.TrimSpace(card.Summary) == "" {
		card.Summary = "你已经完成了本次学习任务。建议回看关键步骤，把遇到的问题整理成自己的操作笔记。"
	}
	if err := s.db.WithContext(ctx).Create(card).Error; err != nil {
		if isUniqueConstraintError(err) {
			var latest AgentReflectionCard
			if findErr := s.db.WithContext(ctx).Where("user_id = ? AND manual_id = ?", userID, manualID).First(&latest).Error; findErr == nil {
				return &latest, nil
			}
		}
		return nil, err
	}
	return card, nil
}

func (s *Service) MarkReflectionViewed(ctx context.Context, userID, reflectionID uint64) (*AgentReflectionCard, error) {
	var card AgentReflectionCard
	if err := s.db.WithContext(ctx).Where("id = ? AND user_id = ?", reflectionID, userID).First(&card).Error; err != nil {
		return nil, err
	}
	card.Status = "viewed"
	if err := s.db.WithContext(ctx).Save(&card).Error; err != nil {
		return nil, err
	}
	return &card, nil
}

func (s *Service) TeacherReflectionCard(ctx context.Context, teacherID uint64, roleType int, studentID, manualID uint64) (*AgentReflectionCard, error) {
	if err := s.ensureTeacherCanReadStudent(ctx, teacherID, roleType, studentID); err != nil {
		return nil, err
	}
	var card AgentReflectionCard
	if err := s.db.WithContext(ctx).Where("user_id = ? AND manual_id = ?", studentID, manualID).First(&card).Error; err != nil {
		return nil, err
	}
	return &card, nil
}

func (s *Service) ListFAQ(ctx context.Context, userID, manualID uint64, stepOrder int, classID uint64) ([]AgentFAQItem, error) {
	if err := s.ensureStudentInActiveClass(ctx, userID, classID); err != nil {
		return nil, err
	}
	var items []AgentFAQItem
	if err := s.db.WithContext(ctx).
		Where("manual_id = ? AND class_id = ? AND step_order = ? AND status = ?", manualID, classID, stepOrder, "published").
		Order("published_at DESC, id DESC").
		Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) PendingInterventions(ctx context.Context, userID, manualID uint64) ([]AgentInterventionRecord, error) {
	var items []AgentInterventionRecord
	if err := s.db.WithContext(ctx).
		Where("student_id = ? AND manual_id = ? AND status = ? AND action_type <> ?", userID, manualID, "pending", "material_note").
		Order("created_at DESC, id DESC").
		Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) MarkInterventionRead(ctx context.Context, userID, interventionID uint64) (*AgentInterventionRecord, error) {
	var item AgentInterventionRecord
	if err := s.db.WithContext(ctx).Where("id = ? AND student_id = ?", interventionID, userID).First(&item).Error; err != nil {
		return nil, err
	}
	now := time.Now()
	item.Status = "read"
	item.ReadAt = &now
	if err := s.db.WithContext(ctx).Save(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *Service) RecordTerminalEventAsync(ctx context.Context, userID, labSessionID, manualID uint64, stepOrder int, command, output string, exitCode int) {
	if manualID == 0 || stepOrder < 0 || strings.TrimSpace(command) == "" {
		return
	}
	go func() {
		bg := context.Background()
		event := LabTerminalEvent{
			UserID:        userID,
			LabSessionID:  labSessionID,
			ManualID:      manualID,
			StepOrder:     stepOrder,
			Command:       redactSensitiveText(command),
			OutputSummary: truncateString(redactSensitiveText(output), 1000),
			ExitCode:      exitCode,
		}
		if err := s.db.WithContext(bg).Create(&event).Error; err != nil && s.logger != nil {
			s.logger.Warn("record lab terminal event failed", zap.Error(err))
		}
	}()
}

func (s *Service) GetCoachHistory(ctx context.Context, userID, manualID uint64, stepOrder int) ([]ChatMessage, error) {
	var session AgentChatSession
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND manual_id = ? AND step_order = ?", userID, manualID, stepOrder).
		First(&session).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return []ChatMessage{}, nil
		}
		return nil, err
	}
	var messages []AgentChatMessage
	if err := s.db.WithContext(ctx).
		Where("session_id = ?", session.ID).
		Order("created_at ASC, id ASC").
		Limit(20).
		Find(&messages).Error; err != nil {
		return nil, err
	}
	result := make([]ChatMessage, 0, len(messages))
	for _, msg := range messages {
		result = append(result, ChatMessage{
			Role:      msg.Role,
			Content:   msg.Content,
			Timestamp: msg.CreatedAt.Format(time.RFC3339),
		})
	}
	return result, nil
}

func (s *Service) getOrCreateChatSession(ctx context.Context, userID, manualID uint64, stepOrder int) (*AgentChatSession, error) {
	now := time.Now()
	session := AgentChatSession{UserID: userID, ManualID: manualID, StepOrder: stepOrder, LastActiveAt: now}
	if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "manual_id"}, {Name: "step_order"}},
		DoUpdates: clause.Assignments(map[string]any{"last_active_at": now, "updated_at": now}),
	}).Create(&session).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND manual_id = ? AND step_order = ?", userID, manualID, stepOrder).
		First(&session).Error; err != nil {
		return nil, err
	}
	return &session, nil
}

func (s *Service) createChatMessage(ctx context.Context, sessionID uint64, role, content string) error {
	role = strings.TrimSpace(role)
	content = strings.TrimSpace(content)
	if role != "user" && role != "assistant" {
		return fmt.Errorf("不支持的消息角色: %s", role)
	}
	if content == "" {
		return nil
	}
	if err := s.db.WithContext(ctx).Create(&AgentChatMessage{
		SessionID: sessionID,
		Role:      role,
		Content:   content,
	}).Error; err != nil {
		return err
	}
	return nil
}

func (s *Service) recentTerminalContext(ctx context.Context, userID, manualID uint64, stepOrder int) (string, error) {
	var events []LabTerminalEvent
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND manual_id = ? AND step_order = ?", userID, manualID, stepOrder).
		Order("created_at DESC, id DESC").
		Limit(3).
		Find(&events).Error; err != nil {
		return "", err
	}
	if len(events) == 0 {
		return "", nil
	}
	parts := []string{"最近终端记录："}
	for _, event := range events {
		parts = append(parts, fmt.Sprintf("$ %s\n%s", strings.TrimSpace(event.Command), truncateString(event.OutputSummary, 300)))
	}
	return strings.Join(parts, "\n"), nil
}

func (s *Service) pruneChatMessages(ctx context.Context, sessionID uint64, limit int) error {
	if limit <= 0 {
		limit = 20
	}
	var keepIDs []uint64
	if err := s.db.WithContext(ctx).
		Model(&AgentChatMessage{}).
		Where("session_id = ?", sessionID).
		Order("created_at DESC, id DESC").
		Limit(limit).
		Pluck("id", &keepIDs).Error; err != nil {
		return err
	}
	if len(keepIDs) == 0 {
		return nil
	}
	return s.db.WithContext(ctx).
		Where("session_id = ? AND id NOT IN ?", sessionID, keepIDs).
		Delete(&AgentChatMessage{}).Error
}

func (s *Service) findStep(ctx context.Context, manualID uint64, stepOrder int) (*AgentStep, error) {
	var step AgentStep
	if err := s.db.WithContext(ctx).Where("manual_id = ? AND step_order = ?", manualID, stepOrder).First(&step).Error; err != nil {
		return nil, err
	}
	localized := s.localizeSteps(ctx, []AgentStep{step})
	step = localized[0]
	return &step, nil
}

func (s *Service) consecutiveFailureCount(ctx context.Context, userID, stepID uint64) (int, error) {
	var attempts []AgentStepAttempt
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND step_id = ?", userID, stepID).
		Order("created_at DESC, id DESC").
		Limit(20).
		Find(&attempts).Error; err != nil {
		return 0, err
	}
	count := 0
	for _, attempt := range attempts {
		if attempt.Success {
			break
		}
		count++
	}
	return count, nil
}

func (s *Service) CreateManual(ctx context.Context, manual AgentManual) (*AgentManual, error) {
	var existing AgentManual
	err := s.db.WithContext(ctx).
		Where("source_type = ? AND source_id = ?", manual.SourceType, manual.SourceID).
		First(&existing).Error
	if err == nil {
		return nil, ErrManualExists
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	manual.IsPublished = 0
	if err := s.db.WithContext(ctx).Create(&manual).Error; err != nil {
		return nil, err
	}
	return &manual, nil
}

func (s *Service) UpdateManual(ctx context.Context, manualID uint64, updates map[string]any) (*AgentManual, error) {
	var manual AgentManual
	if err := s.db.WithContext(ctx).First(&manual, manualID).Error; err != nil {
		return nil, err
	}

	if title, ok := updates["title"].(string); ok {
		manual.Title = strings.TrimSpace(title)
	}
	if description, ok := updates["description"].(string); ok {
		manual.Description = description
	}
	if isPublished, ok := updates["isPublished"].(int); ok {
		manual.IsPublished = isPublished
	}
	if isPublished, ok := updates["isPublished"].(float64); ok {
		manual.IsPublished = int(isPublished)
	}

	if err := s.db.WithContext(ctx).Save(&manual).Error; err != nil {
		return nil, err
	}
	return &manual, nil
}

func (s *Service) DeleteManual(ctx context.Context, manualID uint64) error {
	var manual AgentManual
	if err := s.db.WithContext(ctx).First(&manual, manualID).Error; err != nil {
		return err
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("manual_id = ?", manualID).Delete(&AgentStep{}).Error; err != nil {
			return err
		}
		if err := tx.Where("manual_id = ?", manualID).Delete(&UserAgentProgress{}).Error; err != nil {
			return err
		}
		return tx.Delete(&manual).Error
	})
}

func (s *Service) UpdateSteps(ctx context.Context, manualID uint64, steps []AgentStep) ([]AgentStep, error) {
	var manual AgentManual
	if err := s.db.WithContext(ctx).First(&manual, manualID).Error; err != nil {
		return nil, err
	}

	sanitized := make([]AgentStep, 0, len(steps))
	for idx, step := range steps {
		sanitized = append(sanitized, AgentStep{
			ManualID:       manualID,
			StepOrder:      idx,
			Title:          strings.TrimSpace(step.Title),
			Content:        sanitizeContentBlocks(step.Content),
			QuickQuestions: sanitizeQuickQuestions(step.QuickQuestions),
			Verification:   sanitizeVerification(step.Verification),
		})
	}

	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("manual_id = ?", manualID).Delete(&AgentStep{}).Error; err != nil {
			return err
		}
		if len(sanitized) == 0 {
			return nil
		}
		return tx.Create(&sanitized).Error
	}); err != nil {
		return nil, err
	}

	return sanitized, nil
}

func (s *Service) ImportFromMarkdown(ctx context.Context, sourceType int, sourceID uint64, markdown string, creatorID uint64) (*AgentManual, error) {
	parsed, err := ParseMarkdown(markdown)
	if err != nil {
		return nil, err
	}

	var manual AgentManual
	err = s.db.WithContext(ctx).
		Where("source_type = ? AND source_id = ?", sourceType, sourceID).
		First(&manual).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		manual = AgentManual{
			SourceType:  sourceType,
			SourceID:    sourceID,
			Title:       defaultString(parsed.Title, "导入的手册"),
			Description: parsed.Description,
			IsPublished: 0,
			CreatorID:   creatorID,
		}
		if err := s.db.WithContext(ctx).Create(&manual).Error; err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	} else {
		manual.Title = defaultString(parsed.Title, manual.Title)
		manual.Description = parsed.Description
		if err := s.db.WithContext(ctx).Save(&manual).Error; err != nil {
			return nil, err
		}
	}

	steps := make([]AgentStep, 0, len(parsed.Steps))
	for idx, step := range parsed.Steps {
		steps = append(steps, AgentStep{
			ManualID:       manual.ID,
			StepOrder:      idx,
			Title:          step.Title,
			Content:        step.Content,
			QuickQuestions: step.QuickQuestions,
			Verification:   step.Verification,
		})
	}
	if _, err := s.importStepsPreservingIDs(ctx, manual.ID, steps); err != nil {
		return nil, err
	}
	return s.GetManualByID(ctx, manual.ID)
}

func (s *Service) importStepsPreservingIDs(ctx context.Context, manualID uint64, steps []AgentStep) ([]AgentStep, error) {
	var existing []AgentStep
	if err := s.db.WithContext(ctx).
		Where("manual_id = ?", manualID).
		Order("step_order ASC").
		Find(&existing).Error; err != nil {
		return nil, err
	}

	saved := make([]AgentStep, 0, len(steps))
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for idx, step := range steps {
			next := AgentStep{
				ManualID:       manualID,
				StepOrder:      idx,
				Title:          strings.TrimSpace(step.Title),
				Content:        sanitizeContentBlocks(step.Content),
				QuickQuestions: sanitizeQuickQuestions(step.QuickQuestions),
				Verification:   sanitizeVerification(step.Verification),
			}
			if idx < len(existing) {
				next.ID = existing[idx].ID
				if err := tx.Model(&AgentStep{}).
					Where("id = ? AND manual_id = ?", next.ID, manualID).
					Select("step_order", "title", "content", "quick_questions", "verification").
					Updates(&next).Error; err != nil {
					return err
				}
			} else if err := tx.Create(&next).Error; err != nil {
				return err
			}
			saved = append(saved, next)
		}

		if len(existing) > len(steps) {
			removedIDs := make([]uint64, 0, len(existing)-len(steps))
			for _, step := range existing[len(steps):] {
				removedIDs = append(removedIDs, step.ID)
			}
			if err := tx.Where("step_id IN ?", removedIDs).Delete(&AgentStepSkillTag{}).Error; err != nil && !strings.Contains(strings.ToLower(err.Error()), "agent_step_skill_tags") {
				return err
			}
			if err := tx.Where("entity_id IN ?", removedIDs).Delete(&AgentStepTranslation{}).Error; err != nil && !isMissingAgentTranslationTableError(err) {
				return err
			}
			if err := tx.Where("id IN ? AND manual_id = ?", removedIDs, manualID).Delete(&AgentStep{}).Error; err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return saved, nil
}

func (s *Service) loadManualSteps(ctx context.Context, manual *AgentManual) error {
	var steps []AgentStep
	if err := s.db.WithContext(ctx).
		Where("manual_id = ?", manual.ID).
		Order("step_order ASC").
		Find(&steps).Error; err != nil {
		return err
	}
	if len(steps) > 0 {
		stepIDs := make([]uint64, 0, len(steps))
		for _, step := range steps {
			stepIDs = append(stepIDs, step.ID)
		}
		var tags []AgentStepSkillTag
		if err := s.db.WithContext(ctx).
			Where("step_id IN ?", stepIDs).
			Order("id ASC").
			Find(&tags).Error; err != nil && !strings.Contains(strings.ToLower(err.Error()), "agent_step_skill_tags") {
			return err
		}
		byStep := map[uint64][]string{}
		for _, tag := range tags {
			byStep[tag.StepID] = append(byStep[tag.StepID], tag.SkillTag)
		}
		for idx := range steps {
			steps[idx].SkillTags = byStep[steps[idx].ID]
		}
	}
	manual.Steps = steps
	return nil
}

func normalizeCompletedSteps(steps []int) []int {
	unique := make(map[int]struct{}, len(steps))
	result := make([]int, 0, len(steps))
	for _, step := range steps {
		if step < 0 {
			continue
		}
		if _, exists := unique[step]; exists {
			continue
		}
		unique[step] = struct{}{}
		result = append(result, step)
	}
	sort.Ints(result)
	return result
}

func normalizeChatHistory(history []ChatMessage) []ChatMessage {
	result := make([]ChatMessage, 0, len(history))
	for _, item := range history {
		role := strings.TrimSpace(item.Role)
		if role != "user" && role != "assistant" {
			continue
		}
		content := strings.TrimSpace(item.Content)
		if content == "" {
			continue
		}
		item.Role = role
		item.Content = content
		result = append(result, item)
	}
	return result
}

func sanitizeContentBlocks(blocks []ContentBlock) []ContentBlock {
	result := make([]ContentBlock, 0, len(blocks))
	for _, block := range blocks {
		block.Type = strings.TrimSpace(block.Type)
		if block.Type == "" {
			continue
		}
		result = append(result, block)
	}
	return result
}

func sanitizeQuickQuestions(questions []string) []string {
	result := make([]string, 0, len(questions))
	for _, question := range questions {
		question = strings.TrimSpace(question)
		if question == "" {
			continue
		}
		result = append(result, question)
	}
	return result
}

func sanitizeVerification(rule *VerificationRule) *VerificationRule {
	if rule == nil || strings.TrimSpace(rule.Type) == "" {
		return nil
	}
	return rule
}

func (s *Service) recordStepAttempt(ctx context.Context, userID, manualID uint64, step *AgentStep, labSessionID uint64, attemptType string, result VerifyResult, evidence StepAttemptEvidence) error {
	attemptType = strings.TrimSpace(attemptType)
	if attemptType != AgentStepAttemptTypeVerify {
		return fmt.Errorf("不支持的步骤尝试类型: %s", attemptType)
	}
	eventType := AgentEventTypeVerifyFail
	if result.Success {
		eventType = AgentEventTypeVerifyPass
	}
	failureReason := ""
	if !result.Success {
		failureReason = truncateString(firstNonEmpty(result.Message, result.Details), 512)
	}
	evidence.LabSessionID = firstNonZero(evidence.LabSessionID, labSessionID)
	record := AgentStepAttempt{
		UserID:        userID,
		ManualID:      manualID,
		StepID:        step.ID,
		StepOrder:     step.StepOrder,
		LabSessionID:  labSessionID,
		AttemptType:   attemptType,
		Success:       result.Success,
		FailureReason: failureReason,
		Evidence: JSONMap{
			"verificationOutput": truncateString(evidence.VerificationOutput, 1000),
			"verificationCmd":    evidence.VerificationCmd,
			"exitCode":           evidence.ExitCode,
			"labSessionId":       evidence.LabSessionID,
		},
	}
	if err := s.db.WithContext(ctx).Create(&record).Error; err != nil {
		return err
	}
	return s.RecordLearningEvent(ctx, userID, manualID, step.StepOrder, eventType, JSONMap{
		"attemptId":     record.ID,
		"stepId":        step.ID,
		"labSessionId":  evidence.LabSessionID,
		"failureReason": failureReason,
	})
}

func (s *Service) ensureAISetting(ctx context.Context) (*AIFeatureSetting, error) {
	var setting AIFeatureSetting
	err := s.db.WithContext(ctx).First(&setting, 1).Error
	if err == nil {
		return &setting, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	setting = AIFeatureSetting{ID: 1, Enabled: true}
	if err := s.db.WithContext(ctx).Create(&setting).Error; err != nil {
		return nil, err
	}
	return &setting, nil
}

func (s *Service) stepContext(step *AgentStep) string {
	if step == nil {
		return ""
	}
	parts := []string{fmt.Sprintf("当前步骤: %s", step.Title)}
	for _, block := range step.Content {
		text := strings.TrimSpace(firstNonEmpty(block.Text, block.Code))
		if text != "" {
			parts = append(parts, text)
		}
	}
	return truncateString(strings.Join(parts, "\n"), 1200)
}

func coachHintLevel(failureCount int, escalate bool) int {
	if escalate && failureCount >= 1 {
		return 3
	}
	if failureCount >= 5 {
		return 3
	}
	if failureCount >= 3 {
		return 2
	}
	return 1
}

func coachSystemGuide(level int, troubleshoot bool) string {
	base := "你是 Agent EDU 的 AI 辅助教师。你要帮助学生自己完成实验，不代执行、不代提交，回答使用中文，保持简洁。"
	switch level {
	case 2:
		base += "\n当前提示级别为 Level 2：给方向提示和检查路径，不直接给完整命令。"
	case 3:
		base += "\n当前提示级别为 Level 3：可以给完整可操作步骤和必要命令，但仍不能替学生完成最终提交。"
	default:
		base += "\n当前提示级别为 Level 1：优先用 Socratic 方式追问、反问和拆解思路，避免直接给答案。"
	}
	if troubleshoot {
		base += "\n学生正在排查验证失败。回复必须包含三段：【原因分析】【修复步骤】【验证方法】；修复步骤不超过 3 步。"
	}
	return base
}

func validAgentEventType(eventType string) bool {
	switch eventType {
	case AgentEventTypeOpen, AgentEventTypeChat, AgentEventTypeHintRequest, AgentEventTypeVerify, AgentEventTypeVerifyFail, AgentEventTypeVerifyPass, AgentEventTypeStepDone, AgentEventTypeTroubleshoot:
		return true
	default:
		return false
	}
}

func commandEvidence(command string, result RuntimeCommandResult) StepAttemptEvidence {
	return StepAttemptEvidence{
		VerificationOutput: compactResultDetails(result),
		VerificationCmd:    command,
		ExitCode:           result.ExitCode,
	}
}

func truncateString(value string, limit int) string {
	value = strings.TrimSpace(value)
	if limit <= 0 {
		return value
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit]) + "..."
}

func firstNonZero(values ...uint64) uint64 {
	for _, value := range values {
		if value != 0 {
			return value
		}
	}
	return 0
}

func containsInt(list []int, target int) bool {
	for _, item := range list {
		if item == target {
			return true
		}
	}
	return false
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func invalidRuleResult(message string) VerifyResult {
	return VerifyResult{
		Success: false,
		Message: "验证规则配置错误",
		Details: message,
		CheckItems: []CheckItem{
			{Name: "verification", Status: "failed", Message: message},
		},
	}
}

func compactResultDetails(result RuntimeCommandResult) string {
	details := strings.TrimSpace(result.Output)
	if details == "" {
		details = strings.TrimSpace(result.Error)
	}
	if details == "" {
		details = fmt.Sprintf("命令退出码: %d", result.ExitCode)
	}
	return details
}

func shellQuote(value string) string {
	if value == "" {
		return "''"
	}
	return "'" + strings.ReplaceAll(value, "'", `'"'"'`) + "'"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func (s *Service) buildReflectionPrompt(ctx context.Context, userID uint64, manual *AgentManual) (JSONMap, string) {
	var progress UserAgentProgress
	_ = s.db.WithContext(ctx).Where("user_id = ? AND manual_id = ?", userID, manual.ID).First(&progress).Error
	var attempts []AgentStepAttempt
	_ = s.db.WithContext(ctx).
		Where("user_id = ? AND manual_id = ?", userID, manual.ID).
		Order("created_at DESC, id DESC").
		Limit(30).
		Find(&attempts).Error
	var chats []AgentChatMessage
	_ = s.db.WithContext(ctx).
		Table("agent_chat_messages AS m").
		Select("m.*").
		Joins("JOIN agent_chat_sessions AS s ON s.id = m.session_id").
		Where("s.user_id = ? AND s.manual_id = ?", userID, manual.ID).
		Order("m.created_at DESC, m.id DESC").
		Limit(20).
		Find(&chats).Error
	failures := 0
	for _, attempt := range attempts {
		if !attempt.Success {
			failures++
		}
	}
	evidence := JSONMap{
		"manualId":        manual.ID,
		"manualTitle":     manual.Title,
		"completedSteps":  progress.CompletedSteps,
		"attemptCount":    len(attempts),
		"failureCount":    failures,
		"recentChatCount": len(chats),
	}
	parts := []string{
		"请基于以下学习证据生成 JSON，不要输出 Markdown。结构必须是：{\"summary\":\"...\",\"strengths\":[\"...\"],\"stuckPoints\":[\"...\"],\"reviewSuggestions\":[\"...\"]}。",
		fmt.Sprintf("手册：%s", manual.Title),
		fmt.Sprintf("完成步骤：%v", progress.CompletedSteps),
		fmt.Sprintf("验证次数：%d，失败次数：%d", len(attempts), failures),
	}
	for i, attempt := range attempts {
		if i >= 8 {
			break
		}
		parts = append(parts, fmt.Sprintf("尝试%d：step=%d success=%v reason=%s evidence=%v", i+1, attempt.StepOrder, attempt.Success, attempt.FailureReason, attempt.Evidence))
	}
	for i, msg := range chats {
		if i >= 8 {
			break
		}
		parts = append(parts, fmt.Sprintf("对话%d：%s: %s", i+1, msg.Role, truncateString(msg.Content, 160)))
	}
	return evidence, truncateString(strings.Join(parts, "\n"), 5000)
}

func parseReflectionContent(content string) *AgentReflectionCard {
	card := &AgentReflectionCard{
		Strengths:         JSONMap{"items": []string{}},
		StuckPoints:       JSONMap{"items": []string{}},
		ReviewSuggestions: JSONMap{"items": []string{}},
	}
	type reflectionPayload struct {
		Summary           string   `json:"summary"`
		Strengths         []string `json:"strengths"`
		StuckPoints       []string `json:"stuckPoints"`
		ReviewSuggestions []string `json:"reviewSuggestions"`
	}
	var payload reflectionPayload
	raw := strings.TrimSpace(content)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &payload); err == nil {
		card.Summary = strings.TrimSpace(payload.Summary)
		card.Strengths = JSONMap{"items": cleanStringList(payload.Strengths, 5)}
		card.StuckPoints = JSONMap{"items": cleanStringList(payload.StuckPoints, 5)}
		card.ReviewSuggestions = JSONMap{"items": cleanStringList(payload.ReviewSuggestions, 5)}
		return card
	}
	card.Summary = truncateString(content, 1200)
	return card
}

func cleanStringList(values []string, limit int) []string {
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		result = append(result, truncateString(value, 160))
		if limit > 0 && len(result) >= limit {
			break
		}
	}
	return result
}

func (s *Service) ensureStudentInActiveClass(ctx context.Context, userID, classID uint64) error {
	if classID == 0 {
		return fmt.Errorf("请选择班级")
	}
	var count int64
	err := s.db.WithContext(ctx).Table("class_members AS cm").
		Joins("JOIN classes AS c ON c.id = cm.class_id AND c.status = ?", classroom.ClassStatusActive).
		Where("cm.user_id = ? AND cm.class_id = ? AND cm.status = ?", userID, classID, classroom.ClassMemberStatusActive).
		Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return fmt.Errorf("无权访问该班级内容")
	}
	return nil
}

func (s *Service) ensureTeacherCanReadStudent(ctx context.Context, teacherID uint64, roleType int, studentID uint64) error {
	if roleType >= int(user.RoleAdmin) {
		return nil
	}
	var count int64
	err := s.db.WithContext(ctx).Table("class_members AS cm").
		Joins("JOIN classes AS c ON c.id = cm.class_id AND c.status = ?", classroom.ClassStatusActive).
		Joins("JOIN class_teachers AS ct ON ct.class_id = cm.class_id AND ct.status = ?", classroom.ClassTeacherStatusActive).
		Where("cm.user_id = ? AND cm.status = ? AND ct.teacher_id = ?", studentID, classroom.ClassMemberStatusActive, teacherID).
		Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return fmt.Errorf("无权查看该学生复盘")
	}
	return nil
}

func redactSensitiveText(value string) string {
	return appredact.SensitiveText(value)
}

func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}
	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "duplicate") || strings.Contains(lower, "unique")
}
