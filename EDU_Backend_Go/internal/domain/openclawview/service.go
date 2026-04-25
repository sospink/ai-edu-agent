package openclawview

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"

	"edu-platform/internal/config"
	"edu-platform/internal/domain/lab"
	"edu-platform/internal/domain/project"
)

type Service struct {
	logger          *zap.Logger
	db              *gorm.DB
	openclaw        *OpenClawClient
	feishu          *FeishuClient
	feishuChatID    string
	feishuBotOpenID string
}

var (
	ErrInvalidSessionID      = errors.New("invalid openclaw session id")
	ErrSessionNotFound       = errors.New("openclaw session not found")
	ErrSessionForbidden      = errors.New("openclaw session forbidden")
	ErrSessionRuntimeInvalid = errors.New("openclaw session runtime invalid")
)

func NewService(cfg *config.Config, logger *zap.Logger, db *gorm.DB) *Service {
	return &Service{
		logger:          logger,
		db:              db,
		openclaw:        NewOpenClawClient(cfg.OpenClaw, logger),
		feishu:          NewFeishuClient(cfg.Feishu, logger),
		feishuChatID:    strings.TrimSpace(cfg.Feishu.ChatID),
		feishuBotOpenID: strings.TrimSpace(cfg.Feishu.BotOpenID),
	}
}

func (s *Service) GetThinkingView(ctx context.Context, userID uint64, sessionID string, limit int, scope ViewScope, sinceTS int64) (ThinkingView, error) {
	if limit <= 0 {
		limit = 20
	}
	sessionKey, err := s.resolveSessionKeyForUser(ctx, userID, sessionID)
	if err != nil {
		return ThinkingView{}, err
	}

	if s.feishu.IsConfigured() && s.feishuChatID != "" {
		feishuCtx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
		defer cancel()
		if messages, err := s.feishu.ListRecentBotReplies(feishuCtx, s.feishuChatID, limit, s.feishuBotOpenID); err == nil {
			items := make([]ThinkingMessage, 0, len(messages))
			for _, message := range messages {
				if message.CreateTime < sinceTS {
					continue
				}
				if strings.TrimSpace(message.Text) == "" {
					continue
				}
				items = append(items, ThinkingMessage{
					ID:        "feishu-" + defaultString(message.MessageID, randomID()),
					TS:        message.CreateTime,
					Source:    "feishu",
					Role:      "assistant",
					Content:   message.Text,
					MessageID: message.MessageID,
					MsgType:   message.MsgType,
				})
			}
			sort.Slice(items, func(i, j int) bool { return items[i].TS < items[j].TS })
			if len(items) > limit {
				items = items[len(items)-limit:]
			}
			return ThinkingView{Messages: items}, nil
		}
	}

	history, err := s.chatHistoryByKey(ctx, sessionKey, scope)
	if err != nil {
		return ThinkingView{Messages: []ThinkingMessage{}}, nil
	}

	items := make([]ThinkingMessage, 0, len(history))
	for _, message := range history {
		if strings.ToLower(pickString(message["role"])) != "assistant" {
			continue
		}
		text := strings.TrimSpace(extractMessageText(message["content"]))
		if text == "" {
			continue
		}
		ts := extractTimestamp(message)
		if ts < sinceTS {
			continue
		}
		items = append(items, ThinkingMessage{
			ID:      fmt.Sprintf("openclaw-%s-%d", sessionID, len(items)+1),
			TS:      ts,
			Source:  "openclaw",
			Role:    "assistant",
			Content: text,
		})
	}
	if len(items) > limit {
		items = items[len(items)-limit:]
	}
	return ThinkingView{Messages: items}, nil
}

func (s *Service) GetExecutingView(ctx context.Context, userID uint64, sessionID string, scope ViewScope, sinceTS int64) (ExecutingView, error) {
	history, err := s.chatHistory(ctx, userID, sessionID, scope)
	if err != nil {
		if isSessionResolutionError(err) {
			return ExecutingView{}, err
		}
		return ExecutingView{
			Status:      "running",
			Progress:    0,
			CurrentStep: "等待执行任务",
			Events:      []ExecutingEvent{},
			Toolchain:   []ExecutingToolchainSkill{},
		}, nil
	}

	events := buildExecutingEvents(history, sinceTS)
	skills := s.getToolchain(ctx)

	hasReply := false
	hasError := false
	for _, event := range events {
		if event.Kind == "agent_reply" {
			hasReply = true
		}
		if event.Level == "error" {
			hasError = true
		}
	}

	progress := 0
	if len(events) > 0 {
		progress = minInt(99, maxInt(len(events)*6, 5))
	}
	if hasReply {
		progress = 100
	}

	status := "running"
	if hasError {
		status = "error"
	} else if hasReply {
		status = "completed"
	}

	currentStep := "等待执行任务"
	if len(events) > 0 {
		currentStep = events[len(events)-1].Title
	}

	return ExecutingView{
		Status:      status,
		Progress:    progress,
		CurrentStep: currentStep,
		Events:      events,
		Toolchain:   skills,
	}, nil
}

func (s *Service) GetCompletedView(ctx context.Context, userID uint64, sessionID string, scope ViewScope, sinceTS int64) (CompletedView, error) {
	executing, err := s.GetExecutingView(ctx, userID, sessionID, scope, sinceTS)
	if err != nil {
		return CompletedView{}, err
	}
	history, err := s.chatHistory(ctx, userID, sessionID, scope)
	if err != nil && isSessionResolutionError(err) {
		return CompletedView{}, err
	}

	finalMessages := make([]CompletedFinalMessage, 0)
	for idx, message := range history {
		if strings.ToLower(pickString(message["role"])) != "assistant" {
			continue
		}
		text := strings.TrimSpace(extractMessageText(message["content"]))
		if text == "" {
			continue
		}
		ts := extractTimestamp(message)
		if ts < sinceTS {
			continue
		}
		finalMessages = append(finalMessages, CompletedFinalMessage{
			ID:      fmt.Sprintf("final-%d", idx+1),
			TS:      ts,
			Content: text,
		})
	}

	artifacts := []CompletedArtifact{}
	if s.feishu.IsConfigured() && s.feishuChatID != "" {
		feishuCtx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
		defer cancel()
		if messages, err := s.feishu.ListRecentMessages(feishuCtx, s.feishuChatID, 40); err == nil {
			artifacts = s.feishu.ExtractArtifacts(messages)
		}
	}

	steps := make([]CompletedStep, 0, len(executing.Events))
	successCount := 0
	for _, event := range executing.Events {
		status := "success"
		switch event.Level {
		case "warn":
			status = "warning"
		case "error":
			status = "error"
		default:
			successCount++
		}
		steps = append(steps, CompletedStep{
			ID:     event.ID,
			Title:  event.Title,
			Desc:   event.Desc,
			TS:     event.TS,
			Status: status,
		})
	}

	summary := "执行完成，暂无总结内容"
	if len(finalMessages) > 0 {
		summary = finalMessages[len(finalMessages)-1].Content
	}

	duration := 0
	if len(executing.Events) >= 2 {
		start := executing.Events[0].TS
		end := executing.Events[len(executing.Events)-1].TS
		if end > start {
			duration = int((end - start) / 1000)
		}
	}

	activeSkills := 0
	for _, skill := range executing.Toolchain {
		if skill.Active {
			activeSkills++
		}
	}

	successRate := 100
	if len(steps) > 0 {
		successRate = int(float64(successCount) / float64(len(steps)) * 100)
	}

	return CompletedView{
		Summary:       summary,
		Artifacts:     artifacts,
		FinalMessages: finalMessages,
		Steps:         steps,
		Metrics: CompletedMetrics{
			DurationSeconds: duration,
			SuccessRate:     successRate,
			TotalSteps:      len(steps),
			TotalEvents:     len(executing.Events),
			ActiveSkills:    activeSkills,
		},
	}, nil
}

func (s *Service) GetPhase(ctx context.Context, userID uint64, sessionID string, scope ViewScope, sinceTS int64) (PhaseResponse, error) {
	executing, err := s.GetExecutingView(ctx, userID, sessionID, scope, sinceTS)
	if err != nil {
		return PhaseResponse{}, err
	}

	phase := "thinking"
	if executing.Status == "completed" || executing.Progress >= 100 {
		phase = "completed"
	} else if len(executing.Events) > 0 && executing.Progress > 0 {
		phase = "executing"
	}

	return PhaseResponse{
		Phase:          phase,
		Progress:       executing.Progress,
		EventsCount:    len(executing.Events),
		ArtifactsCount: 0,
	}, nil
}

func (s *Service) DownloadFile(ctx context.Context, messageID, fileKey, resourceType string) (*DownloadedResource, error) {
	callCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return s.feishu.GetMessageResource(callCtx, messageID, fileKey, resourceType)
}

func (s *Service) SendMessage(ctx context.Context, userID uint64, sessionID, text string) (map[string]interface{}, error) {
	sessionKey, err := s.resolveSessionKeyForUser(ctx, userID, sessionID)
	if err != nil {
		return nil, err
	}
	callCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	return s.openclaw.SendChatMessage(callCtx, sessionKey, text)
}

func (s *Service) GetOpenClawHealth(ctx context.Context) (map[string]interface{}, error) {
	callCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	return s.openclaw.GetHealth(callCtx)
}

func (s *Service) GetFeishuHealth(ctx context.Context) (map[string]interface{}, error) {
	callCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	return s.feishu.GetHealth(callCtx)
}

func (s *Service) chatHistory(ctx context.Context, userID uint64, sessionID string, scope ViewScope) ([]map[string]interface{}, error) {
	sessionKey, err := s.resolveSessionKeyForUser(ctx, userID, sessionID)
	if err != nil {
		return nil, err
	}
	return s.chatHistoryByKey(ctx, sessionKey, scope)
}

func (s *Service) chatHistoryByKey(ctx context.Context, sessionKey string, scope ViewScope) ([]map[string]interface{}, error) {
	callCtx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer cancel()

	result, err := s.openclaw.GetChatHistory(callCtx, sessionKey, 200)
	if err != nil {
		return nil, err
	}
	messages := extractMessages(result["messages"])
	if scope == ScopeLatestTurn {
		messages = latestTurnMessages(messages)
	}
	return messages, nil
}

func (s *Service) resolveSessionKeyForUser(ctx context.Context, userID uint64, sessionID string) (string, error) {
	sessionID = strings.TrimSpace(sessionID)
	if userID == 0 {
		return "", fmt.Errorf("%w: 请先登录后进入 OpenClaw 项目", ErrSessionForbidden)
	}
	if sessionID == "" || sessionID == "default" || strings.HasPrefix(sessionID, "agent:") {
		return "", fmt.Errorf("%w: 请从 OpenClaw 项目入口进入", ErrInvalidSessionID)
	}

	if strings.HasPrefix(sessionID, "project:") {
		return s.resolveProjectSessionKeyForUser(ctx, userID, sessionID)
	}

	parsedID, err := strconv.ParseUint(sessionID, 10, 64)
	if err != nil {
		return "", fmt.Errorf("%w: 无效的 OpenClaw 会话标识", ErrInvalidSessionID)
	}

	if s.db == nil {
		return s.resolveSessionKey(sessionID), nil
	}

	var session lab.UserLabSession
	if err := s.db.WithContext(ctx).Where("id = ?", parsedID).First(&session).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", fmt.Errorf("%w: 实验会话不存在", ErrSessionNotFound)
		}
		return "", err
	}

	if userID > 0 && session.UserID != userID {
		return "", fmt.Errorf("%w: 无权访问该实验会话", ErrSessionForbidden)
	}

	if session.RuntimeMode != lab.RuntimeModeOpenClaw {
		return "", fmt.Errorf("%w: 该实验会话不是 OpenClaw 运行时", ErrSessionRuntimeInvalid)
	}

	return s.resolveSessionKey(sessionID), nil
}

func (s *Service) resolveProjectSessionKeyForUser(ctx context.Context, userID uint64, sessionID string) (string, error) {
	projectID, unitID, err := parseProjectSessionID(sessionID)
	if err != nil {
		return "", err
	}
	if s.db == nil {
		return "", fmt.Errorf("%w: OpenClaw 项目校验不可用", ErrSessionNotFound)
	}

	var record project.Project
	if err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", projectID).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", fmt.Errorf("%w: OpenClaw 项目不存在", ErrSessionNotFound)
		}
		return "", err
	}

	tags, err := s.projectTags(ctx, projectID)
	if err != nil {
		return "", err
	}
	if !project.HasOpenClawTag(tags) {
		return "", fmt.Errorf("%w: 该项目不是 OpenClaw 场景项目", ErrSessionRuntimeInvalid)
	}

	parts := []string{"agent", "project", strconv.FormatUint(projectID, 10)}
	if unitID > 0 {
		parts = append(parts, "unit", strconv.FormatUint(unitID, 10))
	}
	parts = append(parts, "user", strconv.FormatUint(userID, 10))
	return strings.Join(parts, ":"), nil
}

func (s *Service) projectTags(ctx context.Context, projectID uint64) ([]project.Tag, error) {
	var tags []project.Tag
	err := s.db.WithContext(ctx).
		Table("tags").
		Select("tags.*").
		Joins("JOIN project_tags ON project_tags.tag_id = tags.id").
		Where("project_tags.project_id = ?", projectID).
		Find(&tags).Error
	return tags, err
}

func parseProjectSessionID(sessionID string) (uint64, uint64, error) {
	parts := strings.Split(strings.TrimSpace(sessionID), ":")
	if len(parts) != 2 && len(parts) != 4 {
		return 0, 0, fmt.Errorf("%w: 无效的 OpenClaw 项目会话标识", ErrInvalidSessionID)
	}
	if parts[0] != "project" || parts[1] == "" {
		return 0, 0, fmt.Errorf("%w: 无效的 OpenClaw 项目会话标识", ErrInvalidSessionID)
	}
	projectID, err := strconv.ParseUint(parts[1], 10, 64)
	if err != nil || projectID == 0 {
		return 0, 0, fmt.Errorf("%w: 无效的 OpenClaw 项目ID", ErrInvalidSessionID)
	}
	if len(parts) == 2 {
		return projectID, 0, nil
	}
	if parts[2] != "unit" || parts[3] == "" {
		return 0, 0, fmt.Errorf("%w: 无效的 OpenClaw 项目单元标识", ErrInvalidSessionID)
	}
	unitID, err := strconv.ParseUint(parts[3], 10, 64)
	if err != nil || unitID == 0 {
		return 0, 0, fmt.Errorf("%w: 无效的 OpenClaw 项目单元ID", ErrInvalidSessionID)
	}
	return projectID, unitID, nil
}

func isSessionResolutionError(err error) bool {
	return errors.Is(err, ErrInvalidSessionID) ||
		errors.Is(err, ErrSessionNotFound) ||
		errors.Is(err, ErrSessionForbidden) ||
		errors.Is(err, ErrSessionRuntimeInvalid)
}

func (s *Service) resolveSessionKey(sessionID string) string {
	sessionID = strings.TrimSpace(sessionID)
	if strings.HasPrefix(sessionID, "agent:") {
		return sessionID
	}
	if sessionID != "" {
		return "agent:lab:session:" + sanitizeSessionFragment(sessionID)
	}
	if s.feishuChatID != "" {
		return "agent:main:feishu:group:" + s.feishuChatID
	}
	return "agent:main:default"
}

func sanitizeSessionFragment(sessionID string) string {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return "default"
	}

	var builder strings.Builder
	builder.Grow(len(sessionID))
	lastDash := false
	for _, r := range sessionID {
		switch {
		case (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9'):
			builder.WriteRune(r)
			lastDash = false
		case r == '-' || r == '_' || r == ':' || r == '.':
			if builder.Len() > 0 && !lastDash {
				builder.WriteByte('-')
				lastDash = true
			}
		default:
			if builder.Len() > 0 && !lastDash {
				builder.WriteByte('-')
				lastDash = true
			}
		}
	}

	value := strings.Trim(builder.String(), "-")
	if value == "" {
		return "default"
	}
	return value
}

func (s *Service) getToolchain(ctx context.Context) []ExecutingToolchainSkill {
	callCtx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer cancel()

	result, err := s.openclaw.GetSkillsStatus(callCtx)
	if err != nil {
		return []ExecutingToolchainSkill{}
	}
	items := extractInterfaceSlice(result["skills"])
	toolchain := make([]ExecutingToolchainSkill, 0, len(items))
	for idx, item := range items {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		state := defaultString(pickString(m["state"]), "ready")
		active := pickBool(m["active"])
		if !active {
			active = state == "ready"
		}
		toolchain = append(toolchain, ExecutingToolchainSkill{
			ID:     defaultString(pickString(m["id"]), fmt.Sprintf("skill-%d", idx+1)),
			Name:   defaultString(pickString(m["name"]), defaultString(pickString(m["id"]), "unknown")),
			Active: active,
			State:  state,
			Source: defaultString(pickString(m["source"]), "openclaw"),
			Detail: defaultString(pickString(m["detail"]), pickString(m["description"])),
		})
	}
	return toolchain
}

func buildExecutingEvents(messages []map[string]interface{}, sinceTS int64) []ExecutingEvent {
	events := make([]ExecutingEvent, 0)
	eventIndex := 0
	for idx, message := range messages {
		role := strings.ToLower(pickString(message["role"]))
		ts := extractTimestamp(message)
		if ts < sinceTS {
			continue
		}

		switch role {
		case "user":
			text := strings.TrimSpace(extractMessageText(message["content"]))
			if text == "" {
				continue
			}
			events = append(events, ExecutingEvent{
				ID:     fmt.Sprintf("user-%d-%d", idx, eventIndex),
				TS:     ts,
				Title:  "接收用户指令",
				Desc:   truncateText(text, 120),
				Level:  "info",
				Source: "system",
				Kind:   "user_input",
			})
			eventIndex++
		case "assistant":
			contentParts := extractInterfaceSlice(message["content"])
			hasToolUse := false
			for _, part := range contentParts {
				partMap, ok := part.(map[string]interface{})
				if !ok {
					continue
				}
				partType := pickString(partMap["type"])
				switch partType {
				case "toolCall", "tool_use":
					hasToolUse = true
					toolName := defaultString(pickString(partMap["name"]), "tool")
					command := pickString(partMap["command"])
					if command == "" {
						arguments, _ := partMap["arguments"].(map[string]interface{})
						command = firstNonEmpty(
							pickString(arguments["command"]),
							pickString(arguments["cmd"]),
							pickString(arguments["path"]),
							pickString(arguments["query"]),
						)
					}
					events = append(events, ExecutingEvent{
						ID:     fmt.Sprintf("tool-call-%d-%d", idx, eventIndex),
						TS:     ts,
						Title:  buildToolEventTitle(toolName),
						Desc:   truncateText(defaultString(command, toolName), 160),
						Level:  "info",
						Source: "assistant",
						Kind:   "tool_call",
					})
					eventIndex++
				case "text":
					text := strings.TrimSpace(pickString(partMap["text"]))
					if text == "" || hasToolUse {
						continue
					}
					events = append(events, ExecutingEvent{
						ID:     fmt.Sprintf("reply-%d-%d", idx, eventIndex),
						TS:     ts,
						Title:  "Agent 回复完成",
						Desc:   truncateText(text, 200),
						Level:  "info",
						Source: "assistant",
						Kind:   "agent_reply",
					})
					eventIndex++
				}
			}
			if len(contentParts) == 0 {
				text := strings.TrimSpace(extractMessageText(message["content"]))
				if text != "" {
					events = append(events, ExecutingEvent{
						ID:     fmt.Sprintf("reply-%d-%d", idx, eventIndex),
						TS:     ts,
						Title:  "Agent 回复完成",
						Desc:   truncateText(text, 200),
						Level:  "info",
						Source: "assistant",
						Kind:   "agent_reply",
					})
					eventIndex++
				}
			}
		case "tool":
			text := strings.TrimSpace(extractMessageText(message["content"]))
			if text == "" {
				continue
			}
			events = append(events, ExecutingEvent{
				ID:     fmt.Sprintf("tool-result-%d-%d", idx, eventIndex),
				TS:     ts,
				Title:  "工具执行结果",
				Desc:   truncateText(text, 180),
				Level:  "info",
				Source: "system",
				Kind:   "tool_result",
			})
			eventIndex++
		}
	}
	return events
}

func extractMessages(raw interface{}) []map[string]interface{} {
	items := extractInterfaceSlice(raw)
	result := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		m, ok := item.(map[string]interface{})
		if ok {
			result = append(result, m)
		}
	}
	return result
}

func latestTurnMessages(messages []map[string]interface{}) []map[string]interface{} {
	lastUserIndex := -1
	for idx := len(messages) - 1; idx >= 0; idx-- {
		if strings.ToLower(pickString(messages[idx]["role"])) == "user" {
			lastUserIndex = idx
			break
		}
	}
	if lastUserIndex >= 0 {
		return messages[lastUserIndex:]
	}
	return messages
}

func extractTimestamp(message map[string]interface{}) int64 {
	return firstNonZero(
		pickInt64(message["timestamp"]),
		pickInt64(message["ts"]),
		pickInt64(message["createdAt"]),
		pickInt64(message["createTime"]),
		pickInt64(message["time"]),
		time.Now().UnixMilli(),
	)
}

func extractMessageText(raw interface{}) string {
	switch value := raw.(type) {
	case string:
		return value
	case []interface{}:
		parts := make([]string, 0, len(value))
		for _, item := range value {
			partMap, ok := item.(map[string]interface{})
			if !ok {
				continue
			}
			partType := pickString(partMap["type"])
			if partType == "text" {
				if text := strings.TrimSpace(pickString(partMap["text"])); text != "" {
					parts = append(parts, text)
				}
			}
		}
		return strings.Join(parts, "\n")
	case map[string]interface{}:
		return pickString(value["text"])
	default:
		return ""
	}
}

func buildToolEventTitle(toolName string) string {
	if toolName == "" {
		return "调用工具"
	}
	return "调用工具: " + toolName
}

func truncateText(text string, limit int) string {
	text = strings.TrimSpace(text)
	if limit <= 0 || len([]rune(text)) <= limit {
		return text
	}
	runes := []rune(text)
	return string(runes[:limit]) + "…"
}

func firstNonZero(values ...int64) int64 {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}
