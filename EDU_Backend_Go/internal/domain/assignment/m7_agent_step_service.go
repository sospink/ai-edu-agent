package assignment

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"gorm.io/gorm"

	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/user"
	apperrors "edu-platform/pkg/errors"
)

func (s *Service) AgentStepStats(ctx context.Context, actorID uint64, roleType int, sourceType int, sourceID, classID uint64) ([]AgentStepStatsResponse, error) {
	if classID == 0 {
		return nil, apperrors.BadRequest("请选择班级")
	}
	if err := s.ensureTeacherCanReadClass(ctx, actorID, roleType, classID); err != nil {
		return nil, err
	}
	manual, steps, err := s.findAgentManualWithSteps(ctx, sourceType, sourceID)
	if err != nil {
		return nil, err
	}
	studentIDs, err := s.activeClassStudentIDs(ctx, classID)
	if err != nil {
		return nil, err
	}
	totalStudents := len(studentIDs)
	studentSet := make(map[uint64]struct{}, len(studentIDs))
	for _, id := range studentIDs {
		studentSet[id] = struct{}{}
	}

	var progresses []agent.UserAgentProgress
	if len(studentIDs) > 0 {
		if err := s.db.WithContext(ctx).
			Where("manual_id = ? AND user_id IN ?", manual.ID, studentIDs).
			Find(&progresses).Error; err != nil {
			return nil, err
		}
	}

	completedByStep := map[int]int{}
	for _, progress := range progresses {
		if _, ok := studentSet[progress.UserID]; !ok {
			continue
		}
		seen := map[int]struct{}{}
		for _, stepOrder := range progress.CompletedSteps {
			if _, exists := seen[stepOrder]; exists {
				continue
			}
			seen[stepOrder] = struct{}{}
			completedByStep[stepOrder]++
		}
	}

	stepIDs := make([]uint64, 0, len(steps))
	for _, step := range steps {
		stepIDs = append(stepIDs, step.ID)
	}
	attemptsByStep, err := s.agentAttemptsByStep(ctx, stepIDs, studentIDs)
	if err != nil {
		return nil, err
	}

	items := make([]AgentStepStatsResponse, 0, len(steps))
	for _, step := range steps {
		attempts := attemptsByStep[step.ID]
		failedCount := 0
		for _, attempt := range attempts {
			if !attempt.Success {
				failedCount++
			}
		}
		completedCount := completedByStep[step.StepOrder]
		completionRate := 0.0
		if totalStudents > 0 {
			completionRate = float64(completedCount) / float64(totalStudents)
		}
		items = append(items, AgentStepStatsResponse{
			StepID:          step.ID,
			StepOrder:       step.StepOrder,
			StepTitle:       step.Title,
			TotalStudents:   totalStudents,
			CompletedCount:  completedCount,
			CompletionRate:  completionRate,
			FailedCount:     failedCount,
			StrugglingCount: v1StrugglingCount(attempts),
			RecentFailures:  recentFailures(attempts, 5),
		})
	}
	return items, nil
}

func (s *Service) GenerateAgentStepInsight(ctx context.Context, actorID uint64, roleType int, stepID, classID uint64) (*AISuggestion, error) {
	if classID == 0 {
		return nil, apperrors.BadRequest("请选择班级")
	}
	if err := s.ensureTeacherCanReadClass(ctx, actorID, roleType, classID); err != nil {
		return nil, err
	}
	if err := s.ensureAICanGenerate(ctx, actorID, AIActionStepInsight, AISourceTypeAgentStep, stepID); err != nil {
		return nil, err
	}

	var step agent.AgentStep
	if err := s.db.WithContext(ctx).First(&step, stepID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("Agent 步骤不存在")
		}
		return nil, err
	}
	studentIDs, err := s.activeClassStudentIDs(ctx, classID)
	if err != nil {
		return nil, err
	}
	attemptsByStep, err := s.agentAttemptsByStep(ctx, []uint64{stepID}, studentIDs)
	if err != nil {
		return nil, err
	}
	attempts := attemptsByStep[stepID]
	failureReasons := topFailureReasons(attempts, 3)
	sampleOutputs := sampleFailureOutputs(attempts, 3)
	strugglingCount := v1StrugglingCount(attempts)
	evidence := JSONMap{
		"stepId":          stepID,
		"classId":         classID,
		"strugglingCount": strugglingCount,
		"failureReasons":  failureReasons,
		"sampleOutputs":   sampleOutputs,
	}
	prompt := buildStepInsightPrompt(classID, step.Title, strugglingCount, failureReasons, sampleOutputs)
	result, err := s.aiClient.Complete(ctx, "你是面向教师的 AI 教学助理。请根据学生实训证据生成简洁、可执行的教学建议；所有内容都只是教师草稿，不自动发布。", prompt)
	if err != nil {
		_, _ = s.recordAIRequest(ctx, AIRequest{
			ActorID: actorID, Action: AIActionStepInsight, SourceType: AISourceTypeAgentStep, SourceID: stepID,
			Model: s.aiModelName(), Status: AIRequestStatusFailed, Error: err.Error(),
		})
		return nil, serviceUnavailable("AI 步骤诊断生成失败")
	}
	if strings.TrimSpace(result.Content) == "" {
		err := errors.New("AI 返回内容为空")
		_, _ = s.recordAIRequest(ctx, AIRequest{
			ActorID: actorID, Action: AIActionStepInsight, SourceType: AISourceTypeAgentStep, SourceID: stepID,
			Model: result.Model, PromptTokens: result.PromptTokens, TotalTokens: result.TotalTokens, LatencyMS: result.LatencyMS,
			Status: AIRequestStatusFailed, Error: err.Error(),
		})
		return nil, serviceUnavailable("AI 返回内容为空")
	}
	request, err := s.recordAIRequest(ctx, AIRequest{
		ActorID: actorID, Action: AIActionStepInsight, SourceType: AISourceTypeAgentStep, SourceID: stepID,
		Model: result.Model, PromptTokens: result.PromptTokens, TotalTokens: result.TotalTokens, LatencyMS: result.LatencyMS,
		Status: AIRequestStatusSuccess,
	})
	if err != nil {
		return nil, err
	}
	suggestion := &AISuggestion{
		RequestID:      request.ID,
		SuggestionType: AISuggestionTypeStepInsight,
		SourceType:     AISourceTypeAgentStep,
		SourceID:       stepID,
		CreatedBy:      actorID,
		Title:          "Agent 步骤卡点诊断",
		Content:        result.Content,
		Evidence:       evidence,
		Status:         AISuggestionStatusPending,
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&AISuggestion{}).
			Where("source_type = ? AND source_id = ? AND suggestion_type = ? AND status = ? AND created_by = ?", AISourceTypeAgentStep, stepID, AISuggestionTypeStepInsight, AISuggestionStatusPending, actorID).
			Update("status", AISuggestionStatusDismissed).Error; err != nil {
			return err
		}
		return tx.Create(suggestion).Error
	}); err != nil {
		return nil, err
	}
	return suggestion, nil
}

func (s *Service) ensureTeacherCanReadClass(ctx context.Context, actorID uint64, roleType int, classID uint64) error {
	if roleType >= int(user.RoleAdmin) {
		return nil
	}
	var count int64
	err := s.db.WithContext(ctx).Table("class_teachers AS ct").
		Joins("JOIN classes AS c ON c.id = ct.class_id AND c.status = ?", classroom.ClassStatusActive).
		Where("ct.class_id = ? AND ct.teacher_id = ? AND ct.status = ?", classID, actorID, classroom.ClassTeacherStatusActive).
		Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return apperrors.Forbidden("无权查看该班级")
	}
	return nil
}

func (s *Service) activeClassStudentIDs(ctx context.Context, classID uint64) ([]uint64, error) {
	var ids []uint64
	if err := s.db.WithContext(ctx).Model(&classroom.ClassMember{}).
		Where("class_id = ? AND status = ?", classID, classroom.ClassMemberStatusActive).
		Pluck("user_id", &ids).Error; err != nil {
		return nil, err
	}
	return ids, nil
}

func (s *Service) findAgentManualWithSteps(ctx context.Context, sourceType int, sourceID uint64) (*agent.AgentManual, []agent.AgentStep, error) {
	var manual agent.AgentManual
	if err := s.db.WithContext(ctx).Where("source_type = ? AND source_id = ?", sourceType, sourceID).First(&manual).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil, apperrors.NotFound("Agent 手册不存在")
		}
		return nil, nil, err
	}
	var steps []agent.AgentStep
	if err := s.db.WithContext(ctx).Where("manual_id = ?", manual.ID).Order("step_order ASC").Find(&steps).Error; err != nil {
		return nil, nil, err
	}
	return &manual, steps, nil
}

func (s *Service) agentAttemptsByStep(ctx context.Context, stepIDs []uint64, studentIDs []uint64) (map[uint64][]agent.AgentStepAttempt, error) {
	result := map[uint64][]agent.AgentStepAttempt{}
	if len(stepIDs) == 0 || len(studentIDs) == 0 {
		return result, nil
	}
	var attempts []agent.AgentStepAttempt
	if err := s.db.WithContext(ctx).
		Where("step_id IN ? AND user_id IN ? AND attempt_type = ?", stepIDs, studentIDs, agent.AgentStepAttemptTypeVerify).
		Order("created_at DESC, id DESC").
		Find(&attempts).Error; err != nil {
		return nil, err
	}
	for _, attempt := range attempts {
		result[attempt.StepID] = append(result[attempt.StepID], attempt)
	}
	return result, nil
}

func v1StrugglingCount(attempts []agent.AgentStepAttempt) int {
	type aggregate struct {
		failures int
		success  bool
	}
	byUser := map[uint64]*aggregate{}
	for _, attempt := range attempts {
		item := byUser[attempt.UserID]
		if item == nil {
			item = &aggregate{}
			byUser[attempt.UserID] = item
		}
		if attempt.Success {
			item.success = true
		} else {
			item.failures++
		}
	}
	count := 0
	for _, item := range byUser {
		if !item.success && item.failures >= 3 {
			count++
		}
	}
	return count
}

func recentFailures(attempts []agent.AgentStepAttempt, limit int) []RecentFailure {
	failures := make([]agent.AgentStepAttempt, 0)
	for _, attempt := range attempts {
		if !attempt.Success {
			failures = append(failures, attempt)
		}
	}
	sort.SliceStable(failures, func(i, j int) bool {
		if failures[i].CreatedAt.Equal(failures[j].CreatedAt) {
			return failures[i].ID > failures[j].ID
		}
		return failures[i].CreatedAt.After(failures[j].CreatedAt)
	})
	if len(failures) > limit {
		failures = failures[:limit]
	}
	result := make([]RecentFailure, 0, len(failures))
	for _, attempt := range failures {
		result = append(result, RecentFailure{
			StudentID:     attempt.UserID,
			FailureReason: attempt.FailureReason,
			FailedAt:      attempt.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	return result
}

func topFailureReasons(attempts []agent.AgentStepAttempt, limit int) []string {
	counts := map[string]int{}
	for _, attempt := range attempts {
		if attempt.Success {
			continue
		}
		reason := strings.TrimSpace(attempt.FailureReason)
		if reason == "" {
			reason = "验证失败，未记录具体原因"
		}
		counts[reason]++
	}
	type pair struct {
		reason string
		count  int
	}
	pairs := make([]pair, 0, len(counts))
	for reason, count := range counts {
		pairs = append(pairs, pair{reason: reason, count: count})
	}
	sort.SliceStable(pairs, func(i, j int) bool {
		if pairs[i].count == pairs[j].count {
			return pairs[i].reason < pairs[j].reason
		}
		return pairs[i].count > pairs[j].count
	})
	if len(pairs) > limit {
		pairs = pairs[:limit]
	}
	result := make([]string, 0, len(pairs))
	for _, item := range pairs {
		result = append(result, item.reason)
	}
	return result
}

func sampleFailureOutputs(attempts []agent.AgentStepAttempt, limit int) []string {
	outputs := make([]string, 0, limit)
	seen := map[string]struct{}{}
	for _, attempt := range attempts {
		if attempt.Success {
			continue
		}
		output, _ := attempt.Evidence["verificationOutput"].(string)
		output = strings.TrimSpace(output)
		if output == "" {
			continue
		}
		if _, exists := seen[output]; exists {
			continue
		}
		seen[output] = struct{}{}
		outputs = append(outputs, output)
		if len(outputs) >= limit {
			break
		}
	}
	return outputs
}

func buildStepInsightPrompt(classID uint64, stepTitle string, strugglingCount int, failureReasons []string, sampleOutputs []string) string {
	if len(failureReasons) == 0 {
		failureReasons = []string{"暂无高频失败原因"}
	}
	if len(sampleOutputs) == 0 {
		sampleOutputs = []string{"暂无代表性错误输出"}
	}
	return fmt.Sprintf(`班级 %d 中，Agent 步骤「%s」有 %d 名学生达到卡点条件。

最常见失败原因（最多 3 条）：
%s

代表性错误输出（最多 3 条）：
%s

请输出：
1. 这个步骤学生最可能在哪里卡住？
2. 给教师一条教学建议，不超过 100 字。
3. 如需要课堂讲解，请给一句可直接对学生说的提示。`, classID, stepTitle, strugglingCount, strings.Join(failureReasons, "\n"), strings.Join(sampleOutputs, "\n---\n"))
}
