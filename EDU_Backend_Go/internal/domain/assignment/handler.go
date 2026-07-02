package assignment

import (
	"context"
	"strconv"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/middleware"
	"edu-platform/pkg/i18n"
	"edu-platform/pkg/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) ListTeacherAssignments(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, err := h.service.ListForTeacher(c.Request.Context(), claims.UserID, claims.RoleType, parseListQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.listLoaded", nil)
}

func (h *Handler) CreateTeacherAssignment(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	var req UpsertAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	result, err := h.service.Create(c.Request.Context(), claims.UserID, claims.RoleType, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, result, "assignment.created", nil)
}

func (h *Handler) GetTeacherAssignment(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.service.GetForTeacher(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.detailLoaded", nil)
}

func (h *Handler) UpdateTeacherAssignment(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req UpsertAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	result, err := h.service.Update(c.Request.Context(), claims.UserID, claims.RoleType, id, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.updated", nil)
}

func (h *Handler) PublishTeacherAssignment(c *gin.Context) {
	h.transitionTeacherAssignment(c, h.service.Publish, "assignment.published")
}

func (h *Handler) CloseTeacherAssignment(c *gin.Context) {
	h.transitionTeacherAssignment(c, h.service.Close, "assignment.closed")
}

func (h *Handler) DraftTeacherAssignment(c *gin.Context) {
	h.transitionTeacherAssignment(c, h.service.Draft, "assignment.drafted")
}

func (h *Handler) ListStudentAssignments(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, err := h.service.ListForStudent(c.Request.Context(), claims.UserID, parseListQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.studentListLoaded", nil)
}

func (h *Handler) GetStudentAssignment(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.service.GetForStudent(c.Request.Context(), claims.UserID, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.studentDetailLoaded", nil)
}

func (h *Handler) CreateStudentSubmission(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req CreateSubmissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	result, err := h.service.CreateStudentSubmission(c.Request.Context(), claims.UserID, id, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, result, "assignment.submitted", nil)
}

func (h *Handler) GetStudentSubmission(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.service.GetStudentSubmission(c.Request.Context(), claims.UserID, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.submissionLoaded", nil)
}

func (h *Handler) ListStudentGrades(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, err := h.service.ListStudentGrades(c.Request.Context(), claims.UserID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.gradesLoaded", nil)
}

func (h *Handler) ListStudentNotifications(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, err := h.service.ListStudentNotifications(c.Request.Context(), claims.UserID, parseTeacherDashboardQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.notificationsLoaded", nil)
}

func (h *Handler) MarkStudentNotificationRead(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.service.MarkStudentNotificationRead(c.Request.Context(), claims.UserID, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.notificationRead", nil)
}

func (h *Handler) AdminOverview(c *gin.Context) {
	result, err := h.service.Overview(c.Request.Context())
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.overviewLoaded", nil)
}

func (h *Handler) AdminTeachingQualityOverview(c *gin.Context) {
	result, err := h.service.TeachingQualityOverview(c.Request.Context())
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.qualityLoaded", nil)
}

func (h *Handler) ListAdminAssignments(c *gin.Context) {
	result, err := h.service.ListForAdmin(c.Request.Context(), parseListQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.listLoaded", nil)
}

func (h *Handler) ListTeacherSubmissions(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, err := h.service.ListTeacherSubmissions(c.Request.Context(), claims.UserID, claims.RoleType, parseSubmissionListQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.reviewQueueLoaded", nil)
}

func (h *Handler) GetTeacherSubmission(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.service.GetTeacherSubmission(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.submissionLoaded", nil)
}

func (h *Handler) RunTeacherSubmissionChecks(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req RunChecksRequest
	_ = c.ShouldBindJSON(&req)
	result, err := h.service.RunTeacherChecks(c.Request.Context(), claims.UserID, claims.RoleType, id, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.checksRecorded", nil)
}

func (h *Handler) GradeTeacherSubmission(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req GradeSubmissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	result, err := h.service.GradeTeacherSubmission(c.Request.Context(), claims.UserID, claims.RoleType, id, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.gradeSaved", nil)
}

func (h *Handler) ReturnTeacherSubmission(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req ReturnSubmissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	result, err := h.service.ReturnTeacherSubmission(c.Request.Context(), claims.UserID, claims.RoleType, id, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.returned", nil)
}

func (h *Handler) PublishTeacherGrade(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.service.PublishTeacherGrade(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.gradePublished", nil)
}

func (h *Handler) SuggestSubmissionFeedback(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.service.SuggestFeedback(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, result, "assignment.aiFeedbackCreated", nil)
}

func (h *Handler) SuggestAssignmentSummary(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req AIGenerateRequest
	_ = c.ShouldBindJSON(&req)
	result, err := h.service.AssignmentSummary(c.Request.Context(), claims.UserID, claims.RoleType, id, req.ClassID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, result, "assignment.aiSummaryCreated", nil)
}

func (h *Handler) SuggestStudentWeakness(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req AIGenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	result, err := h.service.WeaknessDiagnosis(c.Request.Context(), claims.UserID, claims.RoleType, id, req.ClassID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, result, "assignment.aiWeaknessCreated", nil)
}

func (h *Handler) UpdateAISuggestion(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req AISuggestionActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	result, err := h.service.UpdateAISuggestion(c.Request.Context(), claims.UserID, claims.RoleType, id, req.Action)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.aiSuggestionUpdated", nil)
}

func (h *Handler) AgentStepStats(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	sourceType := parseIntQuery(c, "sourceType", 0)
	sourceID := parseUintQuery(c, "sourceId")
	classID := parseUintQuery(c, "classId")
	if sourceType == 0 || sourceID == 0 || classID == 0 {
		response.BadRequestKey(c, "assignment.selectAgentContext", nil)
		return
	}
	result, err := h.service.AgentStepStats(c.Request.Context(), claims.UserID, claims.RoleType, sourceType, sourceID, classID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.agentStatsLoaded", nil)
}

func (h *Handler) GenerateAgentStepInsight(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	stepID, ok := parseIDParam(c, "stepId")
	if !ok {
		return
	}
	var req AgentStepInsightRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.ClassID == 0 {
		response.BadRequestKey(c, "assignment.selectClass", nil)
		return
	}
	result, err := h.service.GenerateAgentStepInsight(c.Request.Context(), claims.UserID, claims.RoleType, stepID, req.ClassID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, result, "assignment.aiStepCreated", nil)
}

func (h *Handler) AgentObservatory(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	manualID := parseUintQuery(c, "manualId")
	classID := parseUintQuery(c, "classId")
	result, err := h.service.AgentObservatory(c.Request.Context(), claims.UserID, claims.RoleType, manualID, classID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.observatoryLoaded", nil)
}

func (h *Handler) AgentCellDetail(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, err := h.service.AgentCellDetail(
		c.Request.Context(),
		claims.UserID,
		claims.RoleType,
		parseUintQuery(c, "manualId"),
		parseUintQuery(c, "classId"),
		parseUintQuery(c, "studentId"),
		parseUintQuery(c, "stepId"),
	)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.agentDetailLoaded", nil)
}

func (h *Handler) ReplaceAgentStepSkillTags(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	stepID, ok := parseIDParam(c, "stepId")
	if !ok {
		return
	}
	var req AgentStepSkillTagsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	result, err := h.service.ReplaceAgentStepSkillTags(c.Request.Context(), claims.UserID, claims.RoleType, stepID, req.Tags)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.skillTagsUpdated", nil)
}

func (h *Handler) AgentSkillWeakness(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	manualID := parseUintQuery(c, "manualId")
	classID := parseUintQuery(c, "classId")
	result, err := h.service.AgentSkillWeakness(c.Request.Context(), claims.UserID, claims.RoleType, manualID, classID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.weaknessLoaded", nil)
}

func (h *Handler) GenerateFAQSuggestion(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	stepID, ok := parseIDParam(c, "stepId")
	if !ok {
		return
	}
	var req AIGenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.ClassID == 0 {
		response.BadRequestKey(c, "assignment.selectClass", nil)
		return
	}
	result, err := h.service.GenerateFAQSuggestion(c.Request.Context(), claims.UserID, claims.RoleType, stepID, req.ClassID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, result, "assignment.aiFAQCreated", nil)
}

func (h *Handler) PublishFAQ(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req FAQPublishRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.ClassID == 0 {
		response.BadRequestKey(c, "assignment.selectClass", nil)
		return
	}
	result, err := h.service.PublishFAQ(c.Request.Context(), claims.UserID, claims.RoleType, id, req.ClassID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, result, "assignment.faqPublished", nil)
}

func (h *Handler) ListTeacherFAQ(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, err := h.service.ListTeacherFAQ(
		c.Request.Context(),
		claims.UserID,
		claims.RoleType,
		parseUintQuery(c, "manualId"),
		parseUintQuery(c, "classId"),
		parseUintQuery(c, "stepId"),
		c.Query("status"),
	)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.faqLoaded", nil)
}

func (h *Handler) ArchiveFAQ(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := h.service.ArchiveFAQ(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.faqArchived", nil)
}

func (h *Handler) CreateAgentIntervention(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	var req AgentInterventionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	result, err := h.service.CreateAgentIntervention(c.Request.Context(), claims.UserID, claims.RoleType, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, result, "assignment.interventionCreated", nil)
}

func (h *Handler) ListTeacherInterventions(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, err := h.service.ListTeacherInterventions(
		c.Request.Context(),
		claims.UserID,
		claims.RoleType,
		parseUintQuery(c, "manualId"),
		parseUintQuery(c, "classId"),
		parseUintQuery(c, "stepId"),
	)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.interventionsLoaded", nil)
}

func (h *Handler) AIStatus(c *gin.Context) {
	result, err := h.service.AIStatus(c.Request.Context())
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.aiStatusLoaded", nil)
}

func (h *Handler) GetAdminAISettings(c *gin.Context) {
	result, err := h.service.GetAISetting(c.Request.Context())
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.aiSettingsLoaded", nil)
}

func (h *Handler) UpdateAdminAISettings(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	result, err := h.service.UpdateAISetting(c.Request.Context(), claims.UserID, claims.RoleType, req.Enabled, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.aiSettingsUpdated", nil)
}

func (h *Handler) TeacherTeachingOverview(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, err := h.service.TeachingOverview(c.Request.Context(), claims.UserID, claims.RoleType)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.workbenchLoaded", nil)
}

func (h *Handler) TeacherTodoItems(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, err := h.service.TodoItems(c.Request.Context(), claims.UserID, claims.RoleType, parseTeacherDashboardQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.todosLoaded", nil)
}

func (h *Handler) TeacherRiskStudents(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, _, err := h.service.RiskStudents(c.Request.Context(), claims.UserID, claims.RoleType, parseTeacherDashboardQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.risksLoaded", nil)
}

func (h *Handler) TeacherAssignmentProgress(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, err := h.service.AssignmentProgress(c.Request.Context(), claims.UserID, claims.RoleType, parseTeacherDashboardQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.progressLoaded", nil)
}

func (h *Handler) ListTeacherGrades(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, err := h.service.ListTeacherGrades(c.Request.Context(), claims.UserID, claims.RoleType, parseTeacherDashboardQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.gradebookLoaded", nil)
}

func (h *Handler) RemindStudents(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	var req RemindRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	result, err := h.service.RemindStudents(c.Request.Context(), claims.UserID, claims.RoleType, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.reminderSent", nil)
}

func (h *Handler) ReopenTeacherAssignment(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req ReopenAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	result, err := h.service.ReopenAssignment(c.Request.Context(), claims.UserID, claims.RoleType, id, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "assignment.reopened", nil)
}

func (h *Handler) transitionTeacherAssignment(c *gin.Context, action func(context.Context, uint64, int, uint64) (*AssignmentDetail, error), key i18n.MessageKey) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	result, err := action(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, key, nil)
}

func parseListQuery(c *gin.Context) AssignmentListQuery {
	query := AssignmentListQuery{
		Page:     parseIntQuery(c, "page", 1),
		PageSize: parseIntQuery(c, "pageSize", 20),
		Q:        c.Query("q"),
		ClassID:  parseUintQuery(c, "classId"),
	}
	if value := c.Query("status"); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			status := AssignmentStatus(parsed)
			query.Status = &status
		}
	}
	return query
}

func parseSubmissionListQuery(c *gin.Context) SubmissionListQuery {
	return SubmissionListQuery{
		Page:         parseIntQuery(c, "page", 1),
		PageSize:     parseIntQuery(c, "pageSize", 20),
		Q:            c.Query("q"),
		Status:       c.Query("status"),
		AssignmentID: parseUintQuery(c, "assignmentId"),
		ClassID:      parseUintQuery(c, "classId"),
	}
}

func parseTeacherDashboardQuery(c *gin.Context) TeacherDashboardQuery {
	return TeacherDashboardQuery{
		Page:         parseIntQuery(c, "page", 1),
		PageSize:     parseIntQuery(c, "pageSize", 20),
		Type:         c.Query("type"),
		Q:            c.Query("q"),
		Status:       c.Query("status"),
		GradeStatus:  c.Query("gradeStatus"),
		AssignmentID: parseUintQuery(c, "assignmentId"),
		ClassID:      parseUintQuery(c, "classId"),
	}
}

func parseIntQuery(c *gin.Context, key string, fallback int) int {
	value := c.Query(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func parseIDParam(c *gin.Context, key string) (uint64, bool) {
	id, err := strconv.ParseUint(c.Param(key), 10, 64)
	if err != nil || id == 0 {
		response.BadRequestKey(c, "assignment.invalidId", nil)
		return 0, false
	}
	return id, true
}

func parseUintQuery(c *gin.Context, key string) uint64 {
	value := c.Query(key)
	if value == "" {
		return 0
	}
	parsed, err := strconv.ParseUint(value, 10, 64)
	if err != nil {
		return 0
	}
	return parsed
}
