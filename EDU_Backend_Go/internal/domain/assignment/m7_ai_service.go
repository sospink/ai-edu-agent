package assignment

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"gorm.io/gorm"

	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/operations"
	"edu-platform/internal/domain/user"
	apperrors "edu-platform/pkg/errors"
	"edu-platform/pkg/i18n"
)

const (
	aiSnippetLimit       = 900
	aiEvidenceLimit      = 12
	aiDefaultSummaryText = "暂无可用证据。"
)

func (s *Service) AIStatus(ctx context.Context) (*AIStatusResponse, error) {
	setting, err := s.ensureAISetting(ctx)
	if err != nil {
		return nil, err
	}
	return &AIStatusResponse{
		Enabled:    setting.Enabled,
		Configured: s.aiConfigured(),
		Model:      s.aiModelName(),
	}, nil
}

func (s *Service) GetAISetting(ctx context.Context) (*AIFeatureSetting, error) {
	return s.ensureAISetting(ctx)
}

func (s *Service) UpdateAISetting(ctx context.Context, actorID uint64, roleType int, enabled bool, ip, userAgent string) (*AIFeatureSetting, error) {
	setting, err := s.ensureAISetting(ctx)
	if err != nil {
		return nil, err
	}
	setting.Enabled = enabled
	setting.UpdatedBy = actorID
	if err := s.db.WithContext(ctx).Save(setting).Error; err != nil {
		return nil, err
	}
	if s.operationsService != nil {
		_ = s.operationsService.RecordAudit(ctx, operations.AuditLog{
			ActorID:    actorID,
			ActorRole:  roleType,
			Action:     AIActionSettingsUpdate,
			TargetType: "ai_feature_settings",
			TargetID:   setting.ID,
			Result:     operations.AuditResultSuccess,
			Message:    "更新 AI 辅助能力开关",
			Metadata:   operations.JSONMap{"enabled": enabled},
			IP:         ip,
			UserAgent:  userAgent,
		})
	}
	return setting, nil
}

func (s *Service) SuggestFeedback(ctx context.Context, actorID uint64, roleType int, submissionID uint64) (*AISuggestion, error) {
	detail, err := s.GetTeacherSubmission(ctx, actorID, roleType, submissionID)
	if err != nil {
		return nil, err
	}
	evidence := s.feedbackEvidence(detail)
	prompt := s.feedbackPrompt(detail, evidence)
	return s.generateSuggestion(ctx, actorID, AIActionSuggestFeedback, AISuggestionTypeFeedbackDraft, AISourceTypeSubmission, submissionID, i18n.T(ctx, "提交反馈草稿"), prompt, evidence)
}

func (s *Service) AssignmentSummary(ctx context.Context, actorID uint64, roleType int, assignmentID, classID uint64) (*AISuggestion, error) {
	record, err := s.findAssignment(ctx, assignmentID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureTeacherCanManage(ctx, actorID, roleType, record); err != nil {
		return nil, err
	}
	if classID > 0 {
		if err := s.ensureAssignmentClassForTeacher(ctx, actorID, roleType, assignmentID, classID); err != nil {
			return nil, err
		}
	}
	evidence, prompt, err := s.assignmentSummaryPrompt(ctx, record, classID)
	if err != nil {
		return nil, err
	}
	return s.generateSuggestion(ctx, actorID, AIActionAssignmentSummary, AISuggestionTypeAssignmentSummary, AISourceTypeAssignment, assignmentID, i18n.T(ctx, "作业提交摘要"), prompt, evidence)
}

func (s *Service) WeaknessDiagnosis(ctx context.Context, actorID uint64, roleType int, studentID, classID uint64) (*AISuggestion, error) {
	if classID == 0 {
		return nil, apperrors.BadRequest("请选择班级后再生成诊断")
	}
	if err := s.ensureTeacherCanDiagnoseStudent(ctx, actorID, roleType, studentID, classID); err != nil {
		return nil, err
	}
	evidence, prompt, err := s.weaknessPrompt(ctx, studentID, classID)
	if err != nil {
		return nil, err
	}
	return s.generateSuggestion(ctx, actorID, AIActionWeaknessDiagnosis, AISuggestionTypeWeaknessDiagnosis, AISourceTypeStudent, studentID, i18n.T(ctx, "学生薄弱点诊断"), prompt, evidence)
}

func (s *Service) UpdateAISuggestion(ctx context.Context, actorID uint64, roleType int, suggestionID uint64, action string) (*AISuggestion, error) {
	var suggestion AISuggestion
	if err := s.db.WithContext(ctx).First(&suggestion, suggestionID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperrors.NotFound("AI 建议不存在")
		}
		return nil, err
	}
	if roleType < int(user.RoleAdmin) && suggestion.CreatedBy != actorID {
		return nil, apperrors.Forbidden("无权处理该 AI 建议")
	}
	if suggestion.Status != AISuggestionStatusPending {
		return nil, unprocessable("AI 建议已处理，不能重复操作")
	}
	now := time.Now()
	switch strings.TrimSpace(action) {
	case "confirm":
		suggestion.Status = AISuggestionStatusConfirmed
		suggestion.ConfirmedBy = actorID
		suggestion.ConfirmedAt = &now
	case "dismiss":
		suggestion.Status = AISuggestionStatusDismissed
	default:
		return nil, apperrors.BadRequest("不支持的 AI 建议操作")
	}
	if err := s.db.WithContext(ctx).Save(&suggestion).Error; err != nil {
		return nil, err
	}
	return &suggestion, nil
}

func (s *Service) AdoptAISuggestionForSubmission(ctx context.Context, tx *gorm.DB, actorID uint64, submissionID, suggestionID uint64, adoptedContent string) error {
	if suggestionID == 0 {
		return nil
	}
	var suggestion AISuggestion
	if err := tx.WithContext(ctx).First(&suggestion, suggestionID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return unprocessable("AI 建议不存在或已不可用")
		}
		return err
	}
	if suggestion.SourceType != AISourceTypeSubmission || suggestion.SourceID != submissionID || suggestion.SuggestionType != AISuggestionTypeFeedbackDraft {
		return unprocessable("AI 建议与当前提交不匹配")
	}
	if suggestion.Status != AISuggestionStatusPending || suggestion.CreatedBy != actorID {
		return unprocessable("AI 建议已处理或不属于当前教师")
	}
	now := time.Now()
	suggestion.Status = AISuggestionStatusConfirmed
	suggestion.ConfirmedBy = actorID
	suggestion.ConfirmedAt = &now
	suggestion.AdoptedContent = strings.TrimSpace(adoptedContent)
	return tx.WithContext(ctx).Save(&suggestion).Error
}

func (s *Service) generateSuggestion(ctx context.Context, actorID uint64, action, suggestionType, sourceType string, sourceID uint64, title, userPrompt string, evidence JSONMap) (*AISuggestion, error) {
	if err := s.ensureAICanGenerate(ctx, actorID, action, sourceType, sourceID); err != nil {
		return nil, err
	}
	result, err := s.aiClient.Complete(ctx, teacherAISystemPrompt(ctx), userPrompt)
	if err != nil {
		_, _ = s.recordAIRequest(ctx, AIRequest{
			ActorID: actorID, Action: action, SourceType: sourceType, SourceID: sourceID,
			Model: s.aiModelName(), Status: AIRequestStatusFailed, Error: err.Error(),
		})
		return nil, serviceUnavailable("AI 生成失败: " + err.Error())
	}
	if strings.TrimSpace(result.Content) == "" {
		err := errors.New("AI 返回内容为空")
		_, _ = s.recordAIRequest(ctx, AIRequest{
			ActorID: actorID, Action: action, SourceType: sourceType, SourceID: sourceID,
			Model: result.Model, PromptTokens: result.PromptTokens, TotalTokens: result.TotalTokens, LatencyMS: result.LatencyMS,
			Status: AIRequestStatusFailed, Error: err.Error(),
		})
		return nil, serviceUnavailable("AI 返回内容为空")
	}
	request, err := s.recordAIRequest(ctx, AIRequest{
		ActorID: actorID, Action: action, SourceType: sourceType, SourceID: sourceID,
		Model: result.Model, PromptTokens: result.PromptTokens, TotalTokens: result.TotalTokens, LatencyMS: result.LatencyMS,
		Status: AIRequestStatusSuccess,
	})
	if err != nil {
		return nil, err
	}
	suggestion := &AISuggestion{
		RequestID:      request.ID,
		SuggestionType: suggestionType,
		SourceType:     sourceType,
		SourceID:       sourceID,
		CreatedBy:      actorID,
		Title:          title,
		Content:        result.Content,
		Evidence:       evidence,
		Status:         AISuggestionStatusPending,
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&AISuggestion{}).
			Where("source_type = ? AND source_id = ? AND suggestion_type = ? AND status = ?", sourceType, sourceID, suggestionType, AISuggestionStatusPending).
			Update("status", AISuggestionStatusDismissed).Error; err != nil {
			return err
		}
		return tx.Create(suggestion).Error
	}); err != nil {
		return nil, err
	}
	return suggestion, nil
}

func (s *Service) ensureAICanGenerate(ctx context.Context, actorID uint64, action, sourceType string, sourceID uint64) error {
	setting, err := s.ensureAISetting(ctx)
	if err != nil {
		return err
	}
	if !setting.Enabled {
		_, _ = s.recordAIRequest(ctx, AIRequest{ActorID: actorID, Action: action, SourceType: sourceType, SourceID: sourceID, Model: s.aiModelName(), Status: AIRequestStatusFailed, Error: "AI 辅助能力已关闭"})
		return serviceUnavailable("AI 辅助能力已关闭")
	}
	if !s.aiConfigured() {
		_, _ = s.recordAIRequest(ctx, AIRequest{ActorID: actorID, Action: action, SourceType: sourceType, SourceID: sourceID, Model: s.aiModelName(), Status: AIRequestStatusFailed, Error: "AI 服务未配置"})
		return serviceUnavailable("AI 服务未配置")
	}
	return nil
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

func (s *Service) recordAIRequest(ctx context.Context, request AIRequest) (*AIRequest, error) {
	if strings.TrimSpace(request.Status) == "" {
		request.Status = AIRequestStatusSuccess
	}
	if err := s.db.WithContext(ctx).Create(&request).Error; err != nil {
		return nil, err
	}
	return &request, nil
}

func (s *Service) aiConfigured() bool {
	return s.aiClient != nil && s.aiClient.Enabled()
}

func (s *Service) aiModelName() string {
	if s.aiClient == nil {
		return ""
	}
	return s.aiClient.ModelName()
}

func (s *Service) feedbackEvidence(detail *SubmissionDetail) JSONMap {
	checks := make([]JSONMap, 0, len(detail.Checks))
	for index, check := range detail.Checks {
		if index >= aiEvidenceLimit {
			break
		}
		output, outputTruncated := truncateAIText(firstNonEmpty(check.Output, check.Error), aiSnippetLimit)
		checks = append(checks, JSONMap{
			"id":        check.ID,
			"type":      check.CheckType,
			"status":    check.Status,
			"score":     check.Score,
			"maxScore":  check.MaxScore,
			"summary":   output,
			"truncated": outputTruncated,
		})
	}
	content, contentTruncated := truncateAIText(detail.ContentText, aiSnippetLimit)
	rubrics := make([]JSONMap, 0, len(detail.Rubric.Items))
	for _, item := range detail.Rubric.Items {
		description, truncated := truncateAIText(item.Description, 360)
		rubrics = append(rubrics, JSONMap{"id": item.ID, "title": item.Title, "maxScore": item.MaxScore, "description": description, "truncated": truncated})
	}
	return JSONMap{
		"submissionId":     detail.ID,
		"assignmentId":     detail.AssignmentID,
		"studentId":        detail.StudentID,
		"attemptNo":        detail.AttemptNo,
		"submissionStatus": detail.Status,
		"contentSummary":   content,
		"contentTruncated": contentTruncated,
		"checks":           checks,
		"rubrics":          rubrics,
	}
}

func (s *Service) feedbackPrompt(detail *SubmissionDetail, evidence JSONMap) string {
	return fmt.Sprintf(`请基于以下提交证据生成教师可编辑的反馈草稿。

作业：%s
学生：%s
提交说明摘要：%s
验证证据：%s
Rubric：%s

要求：
1. 只能输出“主要问题 / 建议反馈 / 依据”三段。
2. 不要给最终分数，不要替教师发布结论。
3. 语气专业、具体、可直接粘贴后编辑。`,
		detail.AssignmentTitle,
		firstNonEmpty(detail.StudentName, detail.StudentUsername, fmt.Sprintf("学生 %d", detail.StudentID)),
		stringifyEvidence(evidence["contentSummary"]),
		stringifyEvidence(evidence["checks"]),
		stringifyEvidence(evidence["rubrics"]),
	)
}

func (s *Service) assignmentSummaryPrompt(ctx context.Context, assignmentRecord *TeachingAssignment, classID uint64) (JSONMap, string, error) {
	progress, err := s.loadSubmissionProgress(ctx, assignmentRecord.ID)
	if err != nil {
		return nil, "", err
	}
	var rows []struct {
		ID          uint64  `gorm:"column:id"`
		StudentID   uint64  `gorm:"column:student_id"`
		StudentName string  `gorm:"column:student_name"`
		Status      string  `gorm:"column:status"`
		ContentText string  `gorm:"column:content_text"`
		GradeStatus string  `gorm:"column:grade_status"`
		Score       float64 `gorm:"column:score"`
		CheckStatus string  `gorm:"column:check_status"`
		CheckType   string  `gorm:"column:check_type"`
		CheckOutput string  `gorm:"column:check_output"`
		CheckError  string  `gorm:"column:check_error"`
	}
	db := s.db.WithContext(ctx).Table("submissions s").
		Select(`s.id, s.student_id, COALESCE(u.full_name, u.username) AS student_name, s.status, s.content_text,
			COALESCE(g.status, '') AS grade_status, COALESCE(g.score, 0) AS score,
			COALESCE(sc.status, '') AS check_status, COALESCE(sc.check_type, '') AS check_type,
			COALESCE(sc.output, '') AS check_output, COALESCE(sc.error, '') AS check_error`).
		Joins("JOIN sys_users u ON u.id = s.student_id").
		Joins("LEFT JOIN grades g ON g.submission_id = s.id").
		Joins("LEFT JOIN submission_checks sc ON sc.submission_id = s.id").
		Where("s.assignment_id = ?", assignmentRecord.ID)
	if classID > 0 {
		db = db.Where("EXISTS (SELECT 1 FROM class_members cm WHERE cm.class_id = ? AND cm.user_id = s.student_id AND cm.status = ?)", classID, classroom.ClassMemberStatusActive)
	}
	if err := db.Order("s.updated_at DESC, s.id DESC").Limit(40).Find(&rows).Error; err != nil {
		return nil, "", err
	}
	items := make([]JSONMap, 0, len(rows))
	for index, row := range rows {
		if index >= aiEvidenceLimit {
			break
		}
		content, contentTruncated := truncateAIText(row.ContentText, 360)
		checkText, checkTruncated := truncateAIText(firstNonEmpty(row.CheckOutput, row.CheckError), 360)
		items = append(items, JSONMap{
			"submissionId":     row.ID,
			"studentId":        row.StudentID,
			"studentName":      row.StudentName,
			"status":           row.Status,
			"gradeStatus":      row.GradeStatus,
			"score":            row.Score,
			"contentSummary":   content,
			"contentTruncated": contentTruncated,
			"checkType":        row.CheckType,
			"checkStatus":      row.CheckStatus,
			"checkSummary":     checkText,
			"checkTruncated":   checkTruncated,
		})
	}
	evidence := JSONMap{
		"assignmentId": assignmentRecord.ID,
		"classId":      classID,
		"progress":     progress,
		"samples":      items,
	}
	prompt := fmt.Sprintf(`请基于以下作业整体证据，生成教师工作台用的作业摘要。

作业：%s
进度：总学生 %d，已提交 %d，待批改 %d，退回 %d，已评分 %d，已发布成绩 %d。
样本证据：%s

要求：
1. 只能输出“主要问题 / 建议反馈 / 依据”三段。
2. 不要给最终分数，不要自动评定班级表现。
3. 重点帮助教师快速了解提交质量、共性问题和下一步教学动作。`,
		assignmentRecord.Title,
		progress.TotalStudents,
		progress.Submitted,
		progress.PendingReview,
		progress.Returned,
		progress.Graded,
		progress.PublishedGrades,
		stringifyEvidence(items),
	)
	if len(items) == 0 {
		evidence["empty"] = true
		prompt += "\n当前没有提交样本，请明确说明证据不足，只给出可采集证据建议。"
	}
	return evidence, prompt, nil
}

func (s *Service) weaknessPrompt(ctx context.Context, studentID, classID uint64) (JSONMap, string, error) {
	var student user.User
	if err := s.db.WithContext(ctx).First(&student, studentID).Error; err != nil {
		return nil, "", err
	}
	var rows []struct {
		AssignmentID     uint64  `gorm:"column:assignment_id"`
		AssignmentTitle  string  `gorm:"column:assignment_title"`
		SubmissionID     uint64  `gorm:"column:submission_id"`
		SubmissionStatus string  `gorm:"column:submission_status"`
		GradeStatus      string  `gorm:"column:grade_status"`
		Score            float64 `gorm:"column:score"`
		MaxScore         float64 `gorm:"column:max_score"`
		CheckType        string  `gorm:"column:check_type"`
		CheckStatus      string  `gorm:"column:check_status"`
		CheckOutput      string  `gorm:"column:check_output"`
		CheckError       string  `gorm:"column:check_error"`
		ContentText      string  `gorm:"column:content_text"`
	}
	if err := s.db.WithContext(ctx).Table("teaching_assignments ta").
		Select(`ta.id AS assignment_id, ta.title AS assignment_title, COALESCE(s.id, 0) AS submission_id,
			COALESCE(s.status, 'not_started') AS submission_status, COALESCE(g.status, '') AS grade_status,
			COALESCE(g.score, 0) AS score, COALESCE(g.max_score, 0) AS max_score,
			COALESCE(sc.check_type, '') AS check_type, COALESCE(sc.status, '') AS check_status,
			COALESCE(sc.output, '') AS check_output, COALESCE(sc.error, '') AS check_error,
			COALESCE(s.content_text, '') AS content_text`).
		Joins("JOIN assignment_classes ac ON ac.assignment_id = ta.id AND ac.class_id = ?", classID).
		Joins("LEFT JOIN submissions s ON s.assignment_id = ta.id AND s.student_id = ?", studentID).
		Joins("LEFT JOIN grades g ON g.submission_id = s.id").
		Joins("LEFT JOIN submission_checks sc ON sc.submission_id = s.id").
		Where("ta.status IN ?", []AssignmentStatus{AssignmentStatusPublished, AssignmentStatusClosed}).
		Order("ta.updated_at DESC, ta.id DESC").
		Limit(40).
		Find(&rows).Error; err != nil {
		return nil, "", err
	}
	items := make([]JSONMap, 0, len(rows))
	for index, row := range rows {
		if index >= aiEvidenceLimit {
			break
		}
		checkText, checkTruncated := truncateAIText(firstNonEmpty(row.CheckOutput, row.CheckError), 360)
		content, contentTruncated := truncateAIText(row.ContentText, 360)
		items = append(items, JSONMap{
			"assignmentId":     row.AssignmentID,
			"assignmentTitle":  row.AssignmentTitle,
			"submissionId":     row.SubmissionID,
			"submissionStatus": row.SubmissionStatus,
			"gradeStatus":      row.GradeStatus,
			"score":            row.Score,
			"maxScore":         row.MaxScore,
			"checkType":        row.CheckType,
			"checkStatus":      row.CheckStatus,
			"checkSummary":     checkText,
			"checkTruncated":   checkTruncated,
			"contentSummary":   content,
			"contentTruncated": contentTruncated,
		})
	}
	evidence := JSONMap{
		"studentId": studentID,
		"classId":   classID,
		"samples":   items,
	}
	prompt := fmt.Sprintf(`请基于学生在当前班级的作业与验证证据，生成教师可用的薄弱点诊断。

学生：%s
证据：%s

要求：
1. 只能输出“主要问题 / 建议反馈 / 依据”三段。
2. 不要给最终分数，不要替教师做处分或结论。
3. 重点归纳薄弱技能、可能原因和教师下一步跟进建议。`,
		firstNonEmpty(student.FullName, student.Username, fmt.Sprintf("学生 %d", studentID)),
		stringifyEvidence(items),
	)
	if len(items) == 0 {
		evidence["empty"] = true
		prompt += "\n当前没有足够学习证据，请明确说明证据不足，并给出教师可补充观察的方向。"
	}
	return evidence, prompt, nil
}

func (s *Service) ensureAssignmentClassForTeacher(ctx context.Context, actorID uint64, roleType int, assignmentID, classID uint64) error {
	var count int64
	db := s.db.WithContext(ctx).Table("assignment_classes ac").
		Joins("JOIN classes c ON c.id = ac.class_id AND c.status = ?", classroom.ClassStatusActive).
		Where("ac.assignment_id = ? AND ac.class_id = ?", assignmentID, classID)
	if roleType < int(user.RoleAdmin) {
		db = db.Where("c.owner_teacher_id = ?", actorID)
	}
	if err := db.Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return apperrors.Forbidden("无权查看该作业班级")
	}
	return nil
}

func (s *Service) ensureTeacherCanDiagnoseStudent(ctx context.Context, actorID uint64, roleType int, studentID, classID uint64) error {
	db := s.db.WithContext(ctx).Table("class_members cm").
		Joins("JOIN classes c ON c.id = cm.class_id AND c.status = ?", classroom.ClassStatusActive).
		Where("cm.class_id = ? AND cm.user_id = ? AND cm.status = ?", classID, studentID, classroom.ClassMemberStatusActive)
	if roleType < int(user.RoleAdmin) {
		db = db.Joins("JOIN class_teachers ct ON ct.class_id = c.id AND ct.teacher_id = ? AND ct.status = ?", actorID, classroom.ClassTeacherStatusActive)
	}
	var count int64
	if err := db.Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return apperrors.Forbidden("无权诊断该学生")
	}
	return nil
}

func teacherAISystemPrompt(ctx context.Context) string {
	if i18n.LocaleFromContext(ctx) == i18n.LocaleEnUS {
		return "You are the AI teacher assistant inside an education platform. You may only help teachers generate drafts and diagnostic summaries. You must not grade automatically, publish grades, or output directly to students. " + i18n.LanguageInstruction(ctx)
	}
	return "你是教学平台里的 AI 教师助手，只能帮助教师生成草稿和诊断摘要。你不能自动评分，不能发布成绩，不能直接面向学生输出。" + i18n.LanguageInstruction(ctx)
}

func truncateAIText(value string, limit int) (string, bool) {
	text := strings.TrimSpace(value)
	if text == "" {
		return aiDefaultSummaryText, false
	}
	runes := []rune(text)
	if len(runes) <= limit {
		return text, false
	}
	return string(runes[:limit]) + "...", true
}

func stringifyEvidence(value any) string {
	if value == nil {
		return aiDefaultSummaryText
	}
	return fmt.Sprintf("%+v", value)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func serviceUnavailable(message string) *apperrors.AppError {
	return apperrors.New("SERVICE_UNAVAILABLE", message, http.StatusServiceUnavailable)
}

func unprocessable(message string) *apperrors.AppError {
	return apperrors.New("UNPROCESSABLE_ENTITY", message, http.StatusUnprocessableEntity)
}
