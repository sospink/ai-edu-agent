package assignment

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"

	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/user"
	apperrors "edu-platform/pkg/errors"
)

func (s *Service) AgentObservatory(ctx context.Context, actorID uint64, roleType int, manualID, classID uint64) (*AgentObservatoryResponse, error) {
	if classID == 0 || manualID == 0 {
		return nil, apperrors.BadRequest("请选择手册和班级")
	}
	if err := s.ensureTeacherCanReadClass(ctx, actorID, roleType, classID); err != nil {
		return nil, err
	}
	var manual agent.AgentManual
	if err := s.db.WithContext(ctx).First(&manual, manualID).Error; err != nil {
		return nil, err
	}
	var steps []agent.AgentStep
	if err := s.db.WithContext(ctx).Where("manual_id = ?", manualID).Order("step_order ASC").Find(&steps).Error; err != nil {
		return nil, err
	}
	students, err := s.activeClassStudents(ctx, classID)
	if err != nil {
		return nil, err
	}
	studentIDs := make([]uint64, 0, len(students))
	for _, student := range students {
		studentIDs = append(studentIDs, student.StudentID)
	}
	progresses := map[uint64]agent.UserAgentProgress{}
	if len(studentIDs) > 0 {
		var rows []agent.UserAgentProgress
		if err := s.db.WithContext(ctx).Where("manual_id = ? AND user_id IN ?", manualID, studentIDs).Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			progresses[row.UserID] = row
		}
	}
	stepIDs := make([]uint64, 0, len(steps))
	for _, step := range steps {
		stepIDs = append(stepIDs, step.ID)
	}
	attemptsByUserStep, err := s.agentAttemptsByUserStep(ctx, stepIDs, studentIDs)
	if err != nil {
		return nil, err
	}
	eventsByUserStep, err := s.agentAIEventsByUserStep(ctx, manualID, studentIDs)
	if err != nil {
		return nil, err
	}

	response := &AgentObservatoryResponse{
		ManualID: manualID,
		ClassID:  classID,
		Steps:    make([]AgentStepAxis, 0, len(steps)),
		Students: func() []AgentStudentAxis {
			items := make([]AgentStudentAxis, 0, len(students))
			for _, student := range students {
				items = append(items, student)
			}
			return items
		}(),
		Heatmap: make([]AgentHeatmapCell, 0, len(steps)*len(students)),
	}
	for _, step := range steps {
		response.Steps = append(response.Steps, AgentStepAxis{StepID: step.ID, StepOrder: step.StepOrder, Title: step.Title})
	}
	fullCompleted := 0
	totalCompletion := 0
	activeStudents := map[uint64]struct{}{}
	aiUsageCount := 0
	riskByStudent := map[uint64]int{}
	for _, student := range students {
		progress := progresses[student.StudentID]
		completedSet := intSet(progress.CompletedSteps)
		if len(steps) > 0 && len(completedSet) >= len(steps) {
			fullCompleted++
		}
		totalCompletion += len(completedSet)
		if progress.ID != 0 {
			activeStudents[student.StudentID] = struct{}{}
		}
		for _, step := range steps {
			key := userStepKey(student.StudentID, step.StepOrder)
			attempts := attemptsByUserStep[userStepIDKey(student.StudentID, step.ID)]
			eventCount := eventsByUserStep[key]
			aiUsageCount += eventCount
			if len(attempts) > 0 || eventCount > 0 {
				activeStudents[student.StudentID] = struct{}{}
			}
			attemptCount, failCount := attemptStats(attempts)
			status := heatmapStatus(len(attempts), eventCount, completedSet[step.StepOrder], failCount)
			if status == "red" {
				riskByStudent[student.StudentID]++
			}
			response.Heatmap = append(response.Heatmap, AgentHeatmapCell{
				StudentID: student.StudentID, StepID: step.ID, StepOrder: step.StepOrder,
				Status: status, AttemptCount: attemptCount, FailCount: failCount, AIEventCount: eventCount,
			})
		}
	}
	avg := 0.0
	if len(students) > 0 && len(steps) > 0 {
		avg = float64(totalCompletion) / float64(len(students)*len(steps))
	}
	response.Summary = AgentClassSummary{
		TotalStudents:     len(students),
		CompletedCount:    fullCompleted,
		ActiveCount:       len(activeStudents),
		AvgCompletionRate: avg,
		AIUsageCount:      aiUsageCount,
	}
	for _, student := range students {
		if riskByStudent[student.StudentID] == 0 {
			continue
		}
		lastActive := ""
		if progress := progresses[student.StudentID]; progress.ID != 0 && !progress.LastActiveAt.IsZero() {
			lastActive = progress.LastActiveAt.Format(time.RFC3339)
		}
		response.RiskStudents = append(response.RiskStudents, AgentRiskStudent{
			StudentID: student.StudentID, Name: student.Name, StuckStepCount: riskByStudent[student.StudentID], LastActiveAt: lastActive,
		})
	}
	sort.SliceStable(response.RiskStudents, func(i, j int) bool {
		return response.RiskStudents[i].StuckStepCount > response.RiskStudents[j].StuckStepCount
	})
	return response, nil
}

func (s *Service) ReplaceAgentStepSkillTags(ctx context.Context, actorID uint64, roleType int, stepID uint64, tags []string) ([]agent.AgentStepSkillTag, error) {
	var step agent.AgentStep
	if err := s.db.WithContext(ctx).First(&step, stepID).Error; err != nil {
		return nil, err
	}
	if err := s.ensureTeacherCanMaintainManual(ctx, actorID, roleType, step.ManualID); err != nil {
		return nil, err
	}
	cleaned := cleanTags(tags)
	items := make([]agent.AgentStepSkillTag, 0, len(cleaned))
	for _, tag := range cleaned {
		items = append(items, agent.AgentStepSkillTag{ManualID: step.ManualID, StepID: step.ID, SkillTag: tag})
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("step_id = ?", step.ID).Delete(&agent.AgentStepSkillTag{}).Error; err != nil {
			return err
		}
		if len(items) == 0 {
			return nil
		}
		return tx.Create(&items).Error
	}); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) AgentCellDetail(ctx context.Context, actorID uint64, roleType int, manualID, classID, studentID, stepID uint64) (*AgentCellDetailResponse, error) {
	if manualID == 0 || classID == 0 || studentID == 0 || stepID == 0 {
		return nil, apperrors.BadRequest("请选择手册、班级、学生和步骤")
	}
	if err := s.ensureTeacherCanReadClass(ctx, actorID, roleType, classID); err != nil {
		return nil, err
	}
	if err := s.ensureActiveStudentInClass(ctx, studentID, classID); err != nil {
		return nil, err
	}
	var step agent.AgentStep
	if err := s.db.WithContext(ctx).Where("id = ? AND manual_id = ?", stepID, manualID).First(&step).Error; err != nil {
		return nil, err
	}

	var attempts []agent.AgentStepAttempt
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND manual_id = ? AND step_id = ?", studentID, manualID, stepID).
		Order("created_at DESC, id DESC").
		Limit(10).
		Find(&attempts).Error; err != nil {
		return nil, err
	}
	attemptItems := make([]AgentStepAttemptSummary, 0, len(attempts))
	failCount := 0
	hasSuccess := false
	for _, attempt := range attempts {
		if attempt.Success {
			hasSuccess = true
		} else {
			failCount++
		}
		attemptItems = append(attemptItems, AgentStepAttemptSummary{
			Success:       attempt.Success,
			FailureReason: truncateDisplayText(attempt.FailureReason, 200),
			CreatedAt:     attempt.CreatedAt.Format(time.RFC3339),
		})
	}
	messageItems, err := s.recentCoachMessages(ctx, studentID, manualID, step.StepOrder)
	if err != nil {
		return nil, err
	}
	terminalItems, err := s.recentTerminalEvents(ctx, studentID, manualID, step.StepOrder)
	if err != nil {
		return nil, err
	}
	interventions, err := s.listInterventions(ctx, manualID, classID, stepID, studentID, true)
	if err != nil {
		return nil, err
	}
	suggested := make([]string, 0, 3)
	if failCount >= 3 && !hasSuccess {
		suggested = append(suggested, "建议发送 student_reminder 提示该步骤")
	}
	if len(terminalItems) == 0 {
		suggested = append(suggested, "建议发送 class_broadcast 引导全班")
	}
	for _, item := range interventions {
		if item.Status == "pending" && item.ActionType != "material_note" {
			suggested = append(suggested, "已有未读提示，等待学生回应")
			break
		}
	}
	return &AgentCellDetailResponse{
		StudentID:        studentID,
		StepID:           stepID,
		Attempts:         attemptItems,
		RecentMessages:   messageItems,
		TerminalEvents:   terminalItems,
		Interventions:    interventions,
		SuggestedActions: suggested,
	}, nil
}

func (s *Service) AgentSkillWeakness(ctx context.Context, actorID uint64, roleType int, manualID, classID uint64) ([]AgentSkillWeaknessItem, error) {
	if err := s.ensureTeacherCanReadClass(ctx, actorID, roleType, classID); err != nil {
		return nil, err
	}
	var steps []agent.AgentStep
	if err := s.db.WithContext(ctx).Where("manual_id = ?", manualID).Order("step_order ASC").Find(&steps).Error; err != nil {
		return nil, err
	}
	if len(steps) == 0 {
		return []AgentSkillWeaknessItem{}, nil
	}
	var tags []agent.AgentStepSkillTag
	if err := s.db.WithContext(ctx).Where("manual_id = ?", manualID).Find(&tags).Error; err != nil {
		return nil, err
	}
	if len(tags) == 0 {
		return []AgentSkillWeaknessItem{}, nil
	}
	studentIDs, err := s.activeClassStudentIDs(ctx, classID)
	if err != nil {
		return nil, err
	}
	stepIDs := make([]uint64, 0, len(steps))
	stepByID := map[uint64]agent.AgentStep{}
	for _, step := range steps {
		stepIDs = append(stepIDs, step.ID)
		stepByID[step.ID] = step
	}
	attemptsByStep, err := s.agentAttemptsByStep(ctx, stepIDs, studentIDs)
	if err != nil {
		return nil, err
	}
	progresses := map[uint64]agent.UserAgentProgress{}
	if len(studentIDs) > 0 {
		var rows []agent.UserAgentProgress
		if err := s.db.WithContext(ctx).Where("manual_id = ? AND user_id IN ?", manualID, studentIDs).Find(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			progresses[row.UserID] = row
		}
	}
	type agg struct {
		steps         map[uint64]AgentStepAxis
		attempts      int
		failures      int
		stuckStudents map[uint64]struct{}
		completed     int
		total         int
	}
	byTag := map[string]*agg{}
	for _, tag := range tags {
		step := stepByID[tag.StepID]
		item := byTag[tag.SkillTag]
		if item == nil {
			item = &agg{steps: map[uint64]AgentStepAxis{}, stuckStudents: map[uint64]struct{}{}}
			byTag[tag.SkillTag] = item
		}
		item.steps[step.ID] = AgentStepAxis{StepID: step.ID, StepOrder: step.StepOrder, Title: step.Title}
		attempts := attemptsByStep[step.ID]
		item.attempts += len(attempts)
		for _, attempt := range attempts {
			if !attempt.Success {
				item.failures++
			}
		}
		for _, attempt := range attempts {
			if !attempt.Success {
				item.stuckStudents[attempt.UserID] = struct{}{}
			}
		}
		for _, studentID := range studentIDs {
			item.total++
			if containsStep(progresses[studentID].CompletedSteps, step.StepOrder) {
				item.completed++
			}
		}
	}
	result := make([]AgentSkillWeaknessItem, 0, len(byTag))
	for tag, item := range byTag {
		steps := make([]AgentStepAxis, 0, len(item.steps))
		for _, step := range item.steps {
			steps = append(steps, step)
		}
		sort.SliceStable(steps, func(i, j int) bool { return steps[i].StepOrder < steps[j].StepOrder })
		failureRate := 0.0
		if item.attempts > 0 {
			failureRate = float64(item.failures) / float64(item.attempts)
		}
		completionRate := 0.0
		if item.total > 0 {
			completionRate = float64(item.completed) / float64(item.total)
		}
		result = append(result, AgentSkillWeaknessItem{SkillTag: tag, FailureRate: failureRate, StuckStudentCnt: len(item.stuckStudents), CompletionRate: completionRate, Steps: steps})
	}
	sort.SliceStable(result, func(i, j int) bool {
		if result[i].FailureRate == result[j].FailureRate {
			return result[i].StuckStudentCnt > result[j].StuckStudentCnt
		}
		return result[i].FailureRate > result[j].FailureRate
	})
	return result, nil
}

func (s *Service) GenerateFAQSuggestion(ctx context.Context, actorID uint64, roleType int, stepID, classID uint64) (*AISuggestion, error) {
	if err := s.ensureTeacherCanReadClass(ctx, actorID, roleType, classID); err != nil {
		return nil, err
	}
	if err := s.ensureAICanGenerate(ctx, actorID, AIActionFAQSuggestion, AISourceTypeAgentStep, stepID); err != nil {
		return nil, err
	}
	var step agent.AgentStep
	if err := s.db.WithContext(ctx).First(&step, stepID).Error; err != nil {
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
	reasons := topFailureReasons(attemptsByStep[stepID], 5)
	outputs := sampleFailureOutputs(attemptsByStep[stepID], 3)
	prompt := fmt.Sprintf("请基于班级 %d 的 Agent 步骤「%s」生成一条学生常见问题 FAQ 草稿，输出 JSON：{\"question\":\"...\",\"answer\":\"...\"}。\n失败原因：%s\n代表输出：%s", classID, step.Title, strings.Join(reasons, "；"), strings.Join(outputs, "\n---\n"))
	result, err := s.aiClient.Complete(ctx, "你是教师备课助手。FAQ 只是草稿，必须等待教师发布后才对学生可见。", prompt)
	if err != nil {
		return nil, serviceUnavailable("AI FAQ 草稿生成失败")
	}
	question, answer := parseFAQSuggestion(result.Content)
	evidence := JSONMap{"stepId": stepID, "classId": classID, "failureReasons": reasons, "sampleOutputs": outputs, "question": question, "answer": answer}
	request, err := s.recordAIRequest(ctx, AIRequest{ActorID: actorID, Action: AIActionFAQSuggestion, SourceType: AISourceTypeAgentStep, SourceID: stepID, Model: result.Model, PromptTokens: result.PromptTokens, TotalTokens: result.TotalTokens, LatencyMS: result.LatencyMS, Status: AIRequestStatusSuccess})
	if err != nil {
		return nil, err
	}
	suggestion := &AISuggestion{RequestID: request.ID, SuggestionType: AISuggestionTypeFAQSuggestion, SourceType: AISourceTypeAgentStep, SourceID: stepID, CreatedBy: actorID, Title: "Agent FAQ 草稿", Content: result.Content, Evidence: evidence, Status: AISuggestionStatusPending}
	if err := s.db.WithContext(ctx).Create(suggestion).Error; err != nil {
		return nil, err
	}
	return suggestion, nil
}

func (s *Service) PublishFAQ(ctx context.Context, actorID uint64, roleType int, suggestionID, classID uint64) (*agent.AgentFAQItem, error) {
	if err := s.ensureTeacherCanReadClass(ctx, actorID, roleType, classID); err != nil {
		return nil, err
	}
	var suggestion AISuggestion
	if err := s.db.WithContext(ctx).First(&suggestion, suggestionID).Error; err != nil {
		return nil, err
	}
	if suggestion.SuggestionType != AISuggestionTypeFAQSuggestion || suggestion.Status != AISuggestionStatusPending || suggestion.CreatedBy != actorID {
		return nil, apperrors.Forbidden("无权发布该 FAQ 草稿")
	}
	var step agent.AgentStep
	if err := s.db.WithContext(ctx).First(&step, suggestion.SourceID).Error; err != nil {
		return nil, err
	}
	question, answer := faqPayloadFromSuggestion(suggestion)
	now := time.Now()
	item := &agent.AgentFAQItem{ManualID: step.ManualID, ClassID: classID, StepID: step.ID, StepOrder: step.StepOrder, Question: question, Answer: answer, SourceSuggestionID: suggestion.ID, Status: "published", CreatedBy: actorID, PublishedAt: &now}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(item).Error; err != nil {
			return err
		}
		return tx.Model(&suggestion).Updates(map[string]any{"status": AISuggestionStatusConfirmed, "confirmed_by": actorID, "confirmed_at": now}).Error
	}); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) ListTeacherFAQ(ctx context.Context, actorID uint64, roleType int, manualID, classID, stepID uint64, status string) ([]agent.AgentFAQItem, error) {
	if manualID == 0 || classID == 0 {
		return nil, apperrors.BadRequest("请选择手册和班级")
	}
	if err := s.ensureTeacherCanReadClass(ctx, actorID, roleType, classID); err != nil {
		return nil, err
	}
	status = strings.TrimSpace(status)
	if status == "" {
		status = "all"
	}
	if status != "all" && status != "published" && status != "archived" {
		return nil, apperrors.BadRequest("不支持的 FAQ 状态")
	}
	query := s.db.WithContext(ctx).Where("manual_id = ? AND class_id = ?", manualID, classID)
	if stepID > 0 {
		query = query.Where("step_id = ?", stepID)
	}
	if status != "all" {
		query = query.Where("status = ?", status)
	}
	var items []agent.AgentFAQItem
	if err := query.Order("published_at DESC, id DESC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) ArchiveFAQ(ctx context.Context, actorID uint64, roleType int, faqID uint64) (*agent.AgentFAQItem, error) {
	var item agent.AgentFAQItem
	if err := s.db.WithContext(ctx).First(&item, faqID).Error; err != nil {
		return nil, err
	}
	if err := s.ensureTeacherCanReadClass(ctx, actorID, roleType, item.ClassID); err != nil {
		return nil, err
	}
	if item.Status == "archived" {
		return &item, nil
	}
	if item.Status != "published" {
		return nil, apperrors.BadRequest("仅已发布 FAQ 可归档")
	}
	item.Status = "archived"
	if err := s.db.WithContext(ctx).Save(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *Service) CreateAgentIntervention(ctx context.Context, actorID uint64, roleType int, req AgentInterventionRequest) ([]agent.AgentInterventionRecord, error) {
	if err := s.ensureTeacherCanReadClass(ctx, actorID, roleType, req.ClassID); err != nil {
		return nil, err
	}
	actionType := strings.TrimSpace(req.ActionType)
	if actionType != "student_reminder" && actionType != "class_broadcast" && actionType != "material_note" {
		return nil, apperrors.BadRequest("不支持的干预类型")
	}
	title := strings.TrimSpace(req.Title)
	content := strings.TrimSpace(req.Content)
	if title == "" || content == "" || req.ManualID == 0 {
		return nil, apperrors.BadRequest("请填写干预标题和内容")
	}
	studentIDs := []uint64{0}
	if actionType == "student_reminder" {
		if req.StudentID == 0 {
			return nil, apperrors.BadRequest("请选择学生")
		}
		if err := s.ensureActiveStudentInClass(ctx, req.StudentID, req.ClassID); err != nil {
			return nil, err
		}
		studentIDs = []uint64{req.StudentID}
	} else if actionType == "class_broadcast" {
		ids, err := s.activeClassStudentIDs(ctx, req.ClassID)
		if err != nil {
			return nil, err
		}
		studentIDs = ids
	}
	records := make([]agent.AgentInterventionRecord, 0, len(studentIDs))
	for _, studentID := range studentIDs {
		records = append(records, agent.AgentInterventionRecord{ManualID: req.ManualID, ClassID: req.ClassID, StepID: req.StepID, StudentID: studentID, TeacherID: actorID, ActionType: actionType, Title: title, Content: content, Status: "pending"})
	}
	if len(records) == 0 {
		return records, nil
	}
	if err := s.db.WithContext(ctx).Create(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

func (s *Service) ListTeacherInterventions(ctx context.Context, actorID uint64, roleType int, manualID, classID, stepID uint64) ([]agent.AgentInterventionRecord, error) {
	if manualID == 0 || classID == 0 {
		return nil, apperrors.BadRequest("请选择手册和班级")
	}
	if err := s.ensureTeacherCanReadClass(ctx, actorID, roleType, classID); err != nil {
		return nil, err
	}
	return s.listInterventions(ctx, manualID, classID, stepID, 0, false)
}

type studentAxisRow struct {
	StudentID uint64
	Name      string
}

func (s *Service) activeClassStudents(ctx context.Context, classID uint64) ([]AgentStudentAxis, error) {
	var rows []studentAxisRow
	if err := s.db.WithContext(ctx).Table("class_members AS cm").
		Select("cm.user_id AS student_id, COALESCE(NULLIF(u.full_name, ''), u.username) AS name").
		Joins("JOIN sys_users AS u ON u.id = cm.user_id").
		Where("cm.class_id = ? AND cm.status = ?", classID, classroom.ClassMemberStatusActive).
		Order("u.full_name ASC, u.username ASC").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	result := make([]AgentStudentAxis, 0, len(rows))
	for _, row := range rows {
		result = append(result, AgentStudentAxis{StudentID: row.StudentID, Name: row.Name})
	}
	return result, nil
}

func (s *Service) agentAttemptsByUserStep(ctx context.Context, stepIDs, studentIDs []uint64) (map[string][]agent.AgentStepAttempt, error) {
	result := map[string][]agent.AgentStepAttempt{}
	if len(stepIDs) == 0 || len(studentIDs) == 0 {
		return result, nil
	}
	var attempts []agent.AgentStepAttempt
	if err := s.db.WithContext(ctx).Where("step_id IN ? AND user_id IN ?", stepIDs, studentIDs).Find(&attempts).Error; err != nil {
		return nil, err
	}
	for _, attempt := range attempts {
		result[userStepIDKey(attempt.UserID, attempt.StepID)] = append(result[userStepIDKey(attempt.UserID, attempt.StepID)], attempt)
	}
	return result, nil
}

func (s *Service) agentAIEventsByUserStep(ctx context.Context, manualID uint64, studentIDs []uint64) (map[string]int, error) {
	result := map[string]int{}
	if len(studentIDs) == 0 {
		return result, nil
	}
	var rows []struct {
		UserID    uint64
		StepOrder int
		Count     int
	}
	if err := s.db.WithContext(ctx).Model(&agent.AgentLearningEvent{}).
		Select("user_id, step_order, COUNT(*) AS count").
		Where("manual_id = ? AND user_id IN ? AND event_type IN ?", manualID, studentIDs, []string{agent.AgentEventTypeChat, agent.AgentEventTypeTroubleshoot}).
		Group("user_id, step_order").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[userStepKey(row.UserID, row.StepOrder)] = row.Count
	}
	return result, nil
}

func heatmapStatus(attemptCount, aiEventCount int, completed bool, failCount int) string {
	if attemptCount == 0 && aiEventCount == 0 {
		return "gray"
	}
	if completed && aiEventCount == 0 {
		return "green"
	}
	if completed && aiEventCount >= 1 {
		return "yellow"
	}
	if failCount < 3 {
		return "orange"
	}
	return "red"
}

func attemptStats(attempts []agent.AgentStepAttempt) (int, int) {
	failures := 0
	for _, attempt := range attempts {
		if !attempt.Success {
			failures++
		}
	}
	return len(attempts), failures
}

func intSet(values []int) map[int]bool {
	result := map[int]bool{}
	for _, value := range values {
		result[value] = true
	}
	return result
}

func containsStep(values []int, stepOrder int) bool {
	for _, value := range values {
		if value == stepOrder {
			return true
		}
	}
	return false
}

func userStepKey(userID uint64, stepOrder int) string {
	return fmt.Sprintf("%d:%d", userID, stepOrder)
}

func userStepIDKey(userID, stepID uint64) string {
	return fmt.Sprintf("%d:%d", userID, stepID)
}

func cleanTags(tags []string) []string {
	seen := map[string]struct{}{}
	result := []string{}
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		if len([]rune(tag)) > 64 {
			tag = string([]rune(tag)[:64])
		}
		key := strings.ToLower(tag)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, tag)
	}
	return result
}

func parseFAQSuggestion(content string) (string, string) {
	var payload struct {
		Question string `json:"question"`
		Answer   string `json:"answer"`
	}
	raw := strings.TrimSpace(content)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &payload); err == nil {
		return firstNonBlank(payload.Question, "本步骤有哪些常见问题？"), firstNonBlank(payload.Answer, content)
	}
	lines := strings.Split(strings.TrimSpace(content), "\n")
	question := "本步骤有哪些常见问题？"
	if len(lines) > 0 && strings.Contains(lines[0], "？") {
		question = strings.TrimSpace(strings.TrimPrefix(lines[0], "问题："))
	}
	return question, content
}

func faqPayloadFromSuggestion(suggestion AISuggestion) (string, string) {
	if q, ok := suggestion.Evidence["question"].(string); ok {
		if a, ok := suggestion.Evidence["answer"].(string); ok {
			return q, a
		}
	}
	return parseFAQSuggestion(suggestion.Content)
}

func firstNonBlank(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func (s *Service) ensureActiveStudentInClass(ctx context.Context, studentID, classID uint64) error {
	var count int64
	if err := s.db.WithContext(ctx).Model(&classroom.ClassMember{}).
		Where("class_id = ? AND user_id = ? AND status = ?", classID, studentID, classroom.ClassMemberStatusActive).
		Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return apperrors.Forbidden("无权查看该班级学生")
	}
	return nil
}

func (s *Service) ensureTeacherCanMaintainManual(ctx context.Context, actorID uint64, roleType int, manualID uint64) error {
	if roleType >= int(user.RoleAdmin) {
		return nil
	}
	var count int64
	err := s.db.WithContext(ctx).Table("assignment_resources AS ar").
		Joins("JOIN teaching_assignments AS ta ON ta.id = ar.assignment_id AND ta.status <> ?", AssignmentStatusArchived).
		Joins("JOIN assignment_classes AS ac ON ac.assignment_id = ta.id").
		Joins("JOIN classes AS c ON c.id = ac.class_id AND c.status = ?", classroom.ClassStatusActive).
		Joins("JOIN class_teachers AS ct ON ct.class_id = c.id AND ct.status = ?", classroom.ClassTeacherStatusActive).
		Where("ar.manual_id = ? AND ct.teacher_id = ?", manualID, actorID).
		Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return apperrors.Forbidden("无权编辑该手册步骤")
	}
	return nil
}

func (s *Service) recentCoachMessages(ctx context.Context, studentID, manualID uint64, stepOrder int) ([]AgentChatMessageItem, error) {
	var session agent.AgentChatSession
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND manual_id = ? AND step_order = ?", studentID, manualID, stepOrder).
		First(&session).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return []AgentChatMessageItem{}, nil
		}
		return nil, err
	}
	var messages []agent.AgentChatMessage
	if err := s.db.WithContext(ctx).
		Where("session_id = ?", session.ID).
		Order("created_at DESC, id DESC").
		Limit(5).
		Find(&messages).Error; err != nil {
		return nil, err
	}
	items := make([]AgentChatMessageItem, 0, len(messages))
	for i := len(messages) - 1; i >= 0; i-- {
		msg := messages[i]
		items = append(items, AgentChatMessageItem{
			Role:      msg.Role,
			Content:   truncateDisplayText(msg.Content, 200),
			CreatedAt: msg.CreatedAt.Format(time.RFC3339),
		})
	}
	return items, nil
}

func (s *Service) recentTerminalEvents(ctx context.Context, studentID, manualID uint64, stepOrder int) ([]LabTerminalEventItem, error) {
	var events []agent.LabTerminalEvent
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND manual_id = ? AND step_order = ?", studentID, manualID, stepOrder).
		Order("created_at DESC, id DESC").
		Limit(5).
		Find(&events).Error; err != nil {
		return nil, err
	}
	items := make([]LabTerminalEventItem, 0, len(events))
	for _, event := range events {
		items = append(items, LabTerminalEventItem{
			Command:       event.Command,
			OutputSummary: truncateDisplayText(event.OutputSummary, 300),
			ExitCode:      event.ExitCode,
			CreatedAt:     event.CreatedAt.Format(time.RFC3339),
		})
	}
	return items, nil
}

func (s *Service) listInterventions(ctx context.Context, manualID, classID, stepID, studentID uint64, includeMaterialNote bool) ([]agent.AgentInterventionRecord, error) {
	query := s.db.WithContext(ctx).Where("manual_id = ? AND class_id = ?", manualID, classID)
	if stepID > 0 {
		query = query.Where("step_id = ?", stepID)
	}
	if studentID > 0 {
		if includeMaterialNote {
			query = query.Where("student_id = ? OR action_type = ?", studentID, "material_note")
		} else {
			query = query.Where("student_id = ?", studentID)
		}
	}
	var items []agent.AgentInterventionRecord
	if err := query.Order("created_at DESC, id DESC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func truncateDisplayText(value string, limit int) string {
	value = strings.TrimSpace(value)
	if limit <= 0 {
		return value
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}
