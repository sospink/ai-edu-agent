package assignment

import (
	"context"
	"strconv"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/middleware"
	apperrors "edu-platform/pkg/errors"
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
		response.Unauthorized(c, "请先登录")
		return
	}
	result, err := h.service.ListForTeacher(c.Request.Context(), claims.UserID, claims.RoleType, parseListQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取作业列表成功")
}

func (h *Handler) CreateTeacherAssignment(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	var req UpsertAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.BadRequest("请求参数错误"))
		return
	}
	result, err := h.service.Create(c.Request.Context(), claims.UserID, claims.RoleType, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Created(c, result, "创建作业成功")
}

func (h *Handler) GetTeacherAssignment(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
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
	response.Success(c, result, "获取作业详情成功")
}

func (h *Handler) UpdateTeacherAssignment(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req UpsertAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.BadRequest("请求参数错误"))
		return
	}
	result, err := h.service.Update(c.Request.Context(), claims.UserID, claims.RoleType, id, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "更新作业成功")
}

func (h *Handler) PublishTeacherAssignment(c *gin.Context) {
	h.transitionTeacherAssignment(c, h.service.Publish, "发布作业成功")
}

func (h *Handler) CloseTeacherAssignment(c *gin.Context) {
	h.transitionTeacherAssignment(c, h.service.Close, "关闭作业成功")
}

func (h *Handler) DraftTeacherAssignment(c *gin.Context) {
	h.transitionTeacherAssignment(c, h.service.Draft, "作业已设为草稿")
}

func (h *Handler) ListStudentAssignments(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	result, err := h.service.ListForStudent(c.Request.Context(), claims.UserID, parseListQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取我的任务成功")
}

func (h *Handler) GetStudentAssignment(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
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
	response.Success(c, result, "获取任务详情成功")
}

func (h *Handler) CreateStudentSubmission(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req CreateSubmissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.BadRequest("请求参数错误"))
		return
	}
	result, err := h.service.CreateStudentSubmission(c.Request.Context(), claims.UserID, id, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Created(c, result, "提交成功")
}

func (h *Handler) GetStudentSubmission(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
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
	response.Success(c, result, "获取提交详情成功")
}

func (h *Handler) ListStudentGrades(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	result, err := h.service.ListStudentGrades(c.Request.Context(), claims.UserID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取成绩成功")
}

func (h *Handler) ListStudentNotifications(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	result, err := h.service.ListStudentNotifications(c.Request.Context(), claims.UserID, parseTeacherDashboardQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取通知成功")
}

func (h *Handler) MarkStudentNotificationRead(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
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
	response.Success(c, result, "通知已读")
}

func (h *Handler) AdminOverview(c *gin.Context) {
	result, err := h.service.Overview(c.Request.Context())
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取作业概览成功")
}

func (h *Handler) AdminTeachingQualityOverview(c *gin.Context) {
	result, err := h.service.TeachingQualityOverview(c.Request.Context())
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取教学质量概览成功")
}

func (h *Handler) ListAdminAssignments(c *gin.Context) {
	result, err := h.service.ListForAdmin(c.Request.Context(), parseListQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取作业列表成功")
}

func (h *Handler) ListTeacherSubmissions(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	result, err := h.service.ListTeacherSubmissions(c.Request.Context(), claims.UserID, claims.RoleType, parseSubmissionListQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取待批改列表成功")
}

func (h *Handler) GetTeacherSubmission(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
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
	response.Success(c, result, "获取提交详情成功")
}

func (h *Handler) RunTeacherSubmissionChecks(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
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
	response.Success(c, result, "重新验证已记录")
}

func (h *Handler) GradeTeacherSubmission(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req GradeSubmissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.BadRequest("请求参数错误"))
		return
	}
	result, err := h.service.GradeTeacherSubmission(c.Request.Context(), claims.UserID, claims.RoleType, id, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "评分已保存")
}

func (h *Handler) ReturnTeacherSubmission(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req ReturnSubmissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.BadRequest("请求参数错误"))
		return
	}
	result, err := h.service.ReturnTeacherSubmission(c.Request.Context(), claims.UserID, claims.RoleType, id, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "提交已退回")
}

func (h *Handler) PublishTeacherGrade(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
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
	response.Success(c, result, "成绩已发布")
}

func (h *Handler) SuggestSubmissionFeedback(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
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
	response.Created(c, result, "AI 反馈草稿已生成")
}

func (h *Handler) SuggestAssignmentSummary(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
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
	response.Created(c, result, "AI 作业摘要已生成")
}

func (h *Handler) SuggestStudentWeakness(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req AIGenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.BadRequest("请求参数错误"))
		return
	}
	result, err := h.service.WeaknessDiagnosis(c.Request.Context(), claims.UserID, claims.RoleType, id, req.ClassID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Created(c, result, "AI 薄弱点诊断已生成")
}

func (h *Handler) UpdateAISuggestion(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req AISuggestionActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.BadRequest("请求参数错误"))
		return
	}
	result, err := h.service.UpdateAISuggestion(c.Request.Context(), claims.UserID, claims.RoleType, id, req.Action)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "AI 建议状态已更新")
}

func (h *Handler) AgentStepStats(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	sourceType := parseIntQuery(c, "sourceType", 0)
	sourceID := parseUintQuery(c, "sourceId")
	classID := parseUintQuery(c, "classId")
	if sourceType == 0 || sourceID == 0 || classID == 0 {
		_ = c.Error(apperrors.BadRequest("请选择 Agent 手册来源和班级"))
		return
	}
	result, err := h.service.AgentStepStats(c.Request.Context(), claims.UserID, claims.RoleType, sourceType, sourceID, classID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "Agent 步骤统计已加载")
}

func (h *Handler) GenerateAgentStepInsight(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	stepID, ok := parseIDParam(c, "stepId")
	if !ok {
		return
	}
	var req AgentStepInsightRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.ClassID == 0 {
		_ = c.Error(apperrors.BadRequest("请选择班级"))
		return
	}
	result, err := h.service.GenerateAgentStepInsight(c.Request.Context(), claims.UserID, claims.RoleType, stepID, req.ClassID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Created(c, result, "AI 步骤诊断已生成")
}

func (h *Handler) AgentObservatory(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	manualID := parseUintQuery(c, "manualId")
	classID := parseUintQuery(c, "classId")
	result, err := h.service.AgentObservatory(c.Request.Context(), claims.UserID, claims.RoleType, manualID, classID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "Agent 观察台已加载")
}

func (h *Handler) AgentCellDetail(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
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
	response.Success(c, result, "Agent 详情已加载")
}

func (h *Handler) ReplaceAgentStepSkillTags(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	stepID, ok := parseIDParam(c, "stepId")
	if !ok {
		return
	}
	var req AgentStepSkillTagsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.BadRequest("请求参数错误"))
		return
	}
	result, err := h.service.ReplaceAgentStepSkillTags(c.Request.Context(), claims.UserID, claims.RoleType, stepID, req.Tags)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "技能标签已更新")
}

func (h *Handler) AgentSkillWeakness(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	manualID := parseUintQuery(c, "manualId")
	classID := parseUintQuery(c, "classId")
	result, err := h.service.AgentSkillWeakness(c.Request.Context(), claims.UserID, claims.RoleType, manualID, classID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "Agent 薄弱点已加载")
}

func (h *Handler) GenerateFAQSuggestion(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	stepID, ok := parseIDParam(c, "stepId")
	if !ok {
		return
	}
	var req AIGenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.ClassID == 0 {
		_ = c.Error(apperrors.BadRequest("请选择班级"))
		return
	}
	result, err := h.service.GenerateFAQSuggestion(c.Request.Context(), claims.UserID, claims.RoleType, stepID, req.ClassID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Created(c, result, "AI FAQ 草稿已生成")
}

func (h *Handler) PublishFAQ(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req FAQPublishRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.ClassID == 0 {
		_ = c.Error(apperrors.BadRequest("请选择班级"))
		return
	}
	result, err := h.service.PublishFAQ(c.Request.Context(), claims.UserID, claims.RoleType, id, req.ClassID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Created(c, result, "FAQ 已发布")
}

func (h *Handler) ListTeacherFAQ(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
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
	response.Success(c, result, "FAQ 列表已加载")
}

func (h *Handler) ArchiveFAQ(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
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
	response.Success(c, result, "FAQ 已归档")
}

func (h *Handler) CreateAgentIntervention(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	var req AgentInterventionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.BadRequest("请求参数错误"))
		return
	}
	result, err := h.service.CreateAgentIntervention(c.Request.Context(), claims.UserID, claims.RoleType, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Created(c, result, "干预记录已创建")
}

func (h *Handler) ListTeacherInterventions(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
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
	response.Success(c, result, "干预记录已加载")
}

func (h *Handler) AIStatus(c *gin.Context) {
	result, err := h.service.AIStatus(c.Request.Context())
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "AI 状态已加载")
}

func (h *Handler) GetAdminAISettings(c *gin.Context) {
	result, err := h.service.GetAISetting(c.Request.Context())
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "AI 设置已加载")
}

func (h *Handler) UpdateAdminAISettings(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.BadRequest("请求参数错误"))
		return
	}
	result, err := h.service.UpdateAISetting(c.Request.Context(), claims.UserID, claims.RoleType, req.Enabled, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "AI 设置已更新")
}

func (h *Handler) TeacherTeachingOverview(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	result, err := h.service.TeachingOverview(c.Request.Context(), claims.UserID, claims.RoleType)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取教学工作台概览成功")
}

func (h *Handler) TeacherTodoItems(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	result, err := h.service.TodoItems(c.Request.Context(), claims.UserID, claims.RoleType, parseTeacherDashboardQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取教学待办成功")
}

func (h *Handler) TeacherRiskStudents(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	result, _, err := h.service.RiskStudents(c.Request.Context(), claims.UserID, claims.RoleType, parseTeacherDashboardQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取风险学生成功")
}

func (h *Handler) TeacherAssignmentProgress(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	result, err := h.service.AssignmentProgress(c.Request.Context(), claims.UserID, claims.RoleType, parseTeacherDashboardQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取作业进度成功")
}

func (h *Handler) ListTeacherGrades(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	result, err := h.service.ListTeacherGrades(c.Request.Context(), claims.UserID, claims.RoleType, parseTeacherDashboardQuery(c))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取成绩簿成功")
}

func (h *Handler) RemindStudents(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	var req RemindRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.BadRequest("请求参数错误"))
		return
	}
	result, err := h.service.RemindStudents(c.Request.Context(), claims.UserID, claims.RoleType, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "提醒已发送")
}

func (h *Handler) ReopenTeacherAssignment(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	id, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req ReopenAssignmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.BadRequest("请求参数错误"))
		return
	}
	result, err := h.service.ReopenAssignment(c.Request.Context(), claims.UserID, claims.RoleType, id, req)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "提交已重开")
}

func (h *Handler) transitionTeacherAssignment(c *gin.Context, action func(context.Context, uint64, int, uint64) (*AssignmentDetail, error), message string) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
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
	response.Success(c, result, message)
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
		response.BadRequest(c, "无效的作业 ID")
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
