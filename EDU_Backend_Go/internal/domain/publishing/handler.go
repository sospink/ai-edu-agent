package publishing

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/middleware"
	"edu-platform/pkg/i18n"
	appjwt "edu-platform/pkg/jwt"
	"edu-platform/pkg/pagination"
	"edu-platform/pkg/response"
)

type Handler struct {
	service        *Service
	courseService  *course.Service
	projectService *project.Service
}

func NewHandler(service *Service, courseService *course.Service, projectService *project.Service) *Handler {
	return &Handler{
		service:        service,
		courseService:  courseService,
		projectService: projectService,
	}
}

func (h *Handler) CheckCourse(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "publishing.invalidCourseId")
	if !ok {
		return
	}
	result, err := h.service.CheckCourse(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "publishing.courseCheckCompleted", nil)
}

func (h *Handler) PublishCourse(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "publishing.invalidCourseId")
	if !ok {
		return
	}
	record, err := h.service.PublishCourse(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, record, "publishing.coursePublished", nil)
}

func (h *Handler) ArchiveCourse(c *gin.Context) {
	h.setCourseStatus(c, course.CourseStatusArchived, "publishing.courseArchived")
}

func (h *Handler) DraftCourse(c *gin.Context) {
	h.setCourseStatus(c, course.CourseStatusDraft, "publishing.courseDrafted")
}

func (h *Handler) UpdateCourse(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "publishing.invalidCourseId")
	if !ok {
		return
	}
	if !h.ensureCourseAccess(c, id, claims.UserID, claims.RoleType) {
		return
	}
	var req struct {
		Title          *string `json:"title"`
		Slug           *string `json:"slug"`
		Description    *string `json:"description"`
		IconURL        *string `json:"iconUrl"`
		CoverColor     *string `json:"coverColor"`
		Difficulty     *int    `json:"difficulty"`
		Status         *int    `json:"status"`
		EstimatedHours *int    `json:"estimatedHours"`
		EnvImage       *string `json:"envImage"`
		IDEImage       *string `json:"ideImage"`
		LabTemplateID  *uint64 `json:"labTemplateId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	params := course.UpdateCourseParams{
		Title:          req.Title,
		Slug:           req.Slug,
		Description:    req.Description,
		IconURL:        req.IconURL,
		CoverColor:     req.CoverColor,
		Difficulty:     req.Difficulty,
		EstimatedHours: req.EstimatedHours,
		EnvImage:       req.EnvImage,
		IDEImage:       req.IDEImage,
		LabTemplateID:  req.LabTemplateID,
	}
	if req.Status == nil {
		record, err := h.courseService.UpdateCourse(id, params)
		if err != nil {
			_ = c.Error(err)
			return
		}
		response.SuccessKey(c, record, "publishing.courseUpdated", nil)
		return
	}
	status := course.CourseStatus(*req.Status)
	if status != course.CourseStatusPublished {
		record, err := h.courseService.UpdateCourse(id, params)
		if err != nil {
			_ = c.Error(err)
			return
		}
		record, err = h.service.SetCourseStatus(c.Request.Context(), claims.UserID, claims.RoleType, id, status)
		if err != nil {
			_ = c.Error(err)
			return
		}
		response.SuccessKey(c, record, "publishing.courseUpdated", nil)
		return
	}
	if _, err := h.courseService.UpdateCourse(id, params); err != nil {
		_ = c.Error(err)
		return
	}
	record, err := h.service.PublishCourse(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, record, "publishing.courseUpdatedPublished", nil)
}

func (h *Handler) CheckProject(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "publishing.invalidProjectId")
	if !ok {
		return
	}
	result, err := h.service.CheckProject(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "publishing.projectCheckCompleted", nil)
}

func (h *Handler) PublishProject(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "publishing.invalidProjectId")
	if !ok {
		return
	}
	record, err := h.service.PublishProject(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, record, "publishing.projectPublished", nil)
}

func (h *Handler) ArchiveProject(c *gin.Context) {
	h.setProjectStatus(c, project.ProjectStatusArchived, "publishing.projectArchived")
}

func (h *Handler) DraftProject(c *gin.Context) {
	h.setProjectStatus(c, project.ProjectStatusDraft, "publishing.projectDrafted")
}

func (h *Handler) UpdateProject(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "publishing.invalidProjectId")
	if !ok {
		return
	}
	if !h.ensureProjectAccess(c, id, claims.UserID, claims.RoleType) {
		return
	}
	var req struct {
		Title         *string   `json:"title"`
		Slug          *string   `json:"slug"`
		Subtitle      *string   `json:"subtitle"`
		CoverURL      *string   `json:"coverUrl"`
		Difficulty    *int      `json:"difficulty"`
		Status        *int      `json:"status"`
		Description   *string   `json:"description"`
		LearningGoals *[]string `json:"learningGoals"`
		Prerequisites *[]string `json:"prerequisites"`
		TagIDs        *[]uint64 `json:"tagIds"`
		EnvImage      *string   `json:"envImage"`
		IDEImage      *string   `json:"ideImage"`
		LabTemplateID *uint64   `json:"labTemplateId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	params := project.UpdateProjectParams{
		Title:         req.Title,
		Slug:          req.Slug,
		Subtitle:      req.Subtitle,
		CoverURL:      req.CoverURL,
		Difficulty:    req.Difficulty,
		Description:   req.Description,
		LearningGoals: req.LearningGoals,
		Prerequisites: req.Prerequisites,
		TagIDs:        req.TagIDs,
		EnvImage:      req.EnvImage,
		IDEImage:      req.IDEImage,
		LabTemplateID: req.LabTemplateID,
	}
	if req.Status == nil {
		record, err := h.projectService.UpdateProject(id, params)
		if err != nil {
			_ = c.Error(err)
			return
		}
		response.SuccessKey(c, record, "publishing.projectUpdated", nil)
		return
	}
	status := project.ProjectStatus(*req.Status)
	if status != project.ProjectStatusPublished {
		record, err := h.projectService.UpdateProject(id, params)
		if err != nil {
			_ = c.Error(err)
			return
		}
		record, err = h.service.SetProjectStatus(c.Request.Context(), claims.UserID, claims.RoleType, id, status)
		if err != nil {
			_ = c.Error(err)
			return
		}
		response.SuccessKey(c, record, "publishing.projectUpdated", nil)
		return
	}
	if _, err := h.projectService.UpdateProject(id, params); err != nil {
		_ = c.Error(err)
		return
	}
	record, err := h.service.PublishProject(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, record, "publishing.projectUpdatedPublished", nil)
}

func (h *Handler) CheckManual(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "publishing.invalidManualId")
	if !ok {
		return
	}
	result, err := h.service.CheckManual(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "publishing.manualCheckCompleted", nil)
}

func (h *Handler) UpdateManual(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "publishing.invalidManualId")
	if !ok {
		return
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		IsPublished *int   `json:"isPublished"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	manual, err := h.service.UpdateManual(c.Request.Context(), claims.UserID, claims.RoleType, id, req.Title, req.Description, req.IsPublished)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, gin.H{
		"id":          manual.ID,
		"title":       manual.Title,
		"description": manual.Description,
		"isPublished": manual.IsPublished,
	}, "publishing.manualUpdated", nil)
}

func (h *Handler) ListTeacherLabTemplates(c *gin.Context) {
	templates, err := h.service.ListLabTemplates(c.Request.Context(), true)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, templates, "publishing.teacherTemplatesLoaded", nil)
}

func (h *Handler) ListAdminLabTemplates(c *gin.Context) {
	templates, err := h.service.ListLabTemplates(c.Request.Context(), false)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, templates, "publishing.adminTemplatesLoaded", nil)
}

func (h *Handler) CreateLabTemplate(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	input, ok := bindLabTemplateInput(c)
	if !ok {
		return
	}
	template, err := h.service.CreateLabTemplate(c.Request.Context(), claims.UserID, input)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, template, "publishing.templateCreated", nil)
}

func (h *Handler) UpdateLabTemplate(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "publishing.invalidTemplateId")
	if !ok {
		return
	}
	input, ok := bindLabTemplateInput(c)
	if !ok {
		return
	}
	template, err := h.service.UpdateLabTemplate(c.Request.Context(), claims.UserID, id, input)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, template, "publishing.templateUpdated", nil)
}

func (h *Handler) UpdateLabTemplateStatus(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "publishing.invalidTemplateId")
	if !ok {
		return
	}
	var req struct {
		Status int `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	template, err := h.service.UpdateLabTemplateStatus(c.Request.Context(), claims.UserID, id, LabTemplateStatus(req.Status))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, template, "publishing.templateStatusUpdated", nil)
}

func (h *Handler) ListAuditLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	q := pagination.Normalize(page, pageSize)
	logs, total, err := h.service.ListAuditLogs(c.Request.Context(), AuditListQuery{
		Page:        q.Page,
		PageSize:    q.PageSize,
		ContentType: c.Query("contentType"),
		Action:      c.Query("action"),
		Result:      c.Query("result"),
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, gin.H{
		"list":     logs,
		"total":    total,
		"page":     q.Page,
		"pageSize": q.PageSize,
	}, "publishing.auditLoaded", nil)
}

func (h *Handler) setCourseStatus(c *gin.Context, status course.CourseStatus, key i18n.MessageKey) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "publishing.invalidCourseId")
	if !ok {
		return
	}
	record, err := h.service.SetCourseStatus(c.Request.Context(), claims.UserID, claims.RoleType, id, status)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, record, key, nil)
}

func (h *Handler) setProjectStatus(c *gin.Context, status project.ProjectStatus, key i18n.MessageKey) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "publishing.invalidProjectId")
	if !ok {
		return
	}
	record, err := h.service.SetProjectStatus(c.Request.Context(), claims.UserID, claims.RoleType, id, status)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, record, key, nil)
}

func (h *Handler) ensureCourseAccess(c *gin.Context, courseID, actorID uint64, roleType int) bool {
	record, err := h.courseService.FindCourseEntity(courseID)
	if err != nil {
		_ = c.Error(err)
		return false
	}
	if roleType >= 10 || record.CreatorID == actorID {
		return true
	}
	response.ForbiddenKey(c, "publishing.courseForbidden", nil)
	return false
}

func (h *Handler) ensureProjectAccess(c *gin.Context, projectID, actorID uint64, roleType int) bool {
	record, err := h.projectService.FindProjectEntity(projectID)
	if err != nil {
		_ = c.Error(err)
		return false
	}
	if roleType >= 10 || record.CreatedBy == actorID {
		return true
	}
	response.ForbiddenKey(c, "publishing.projectForbidden", nil)
	return false
}

func currentClaims(c *gin.Context) (*appjwt.Claims, bool) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return nil, false
	}
	return claims, true
}

func parseUintParam(c *gin.Context, name string, key i18n.MessageKey) (uint64, bool) {
	id, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil {
		response.BadRequestKey(c, key, nil)
		return 0, false
	}
	return id, true
}

func bindLabTemplateInput(c *gin.Context) (LabTemplateInput, bool) {
	var req struct {
		Name               string                   `json:"name"`
		Code               string                   `json:"code"`
		Description        string                   `json:"description"`
		EnvImage           string                   `json:"envImage"`
		IDEImage           string                   `json:"ideImage"`
		MainCPURequest     string                   `json:"mainCpuRequest"`
		MainMemoryRequest  string                   `json:"mainMemoryRequest"`
		MainCPULimit       string                   `json:"mainCpuLimit"`
		MainMemoryLimit    string                   `json:"mainMemoryLimit"`
		IDECPURequest      string                   `json:"ideCpuRequest"`
		IDEMemoryRequest   string                   `json:"ideMemoryRequest"`
		IDECPULimit        string                   `json:"ideCpuLimit"`
		IDEMemoryLimit     string                   `json:"ideMemoryLimit"`
		DesktopEnabled     *bool                    `json:"desktopEnabled"`
		AppPorts           []LabTemplateAppPort     `json:"appPorts"`
		DefaultAppPortName string                   `json:"defaultAppPortName"`
		ExposedPorts       []LabTemplateExposedPort `json:"exposedPorts"`
		Status             int                      `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return LabTemplateInput{}, false
	}
	return LabTemplateInput{
		Name:               req.Name,
		Code:               req.Code,
		Description:        req.Description,
		EnvImage:           req.EnvImage,
		IDEImage:           req.IDEImage,
		MainCPURequest:     req.MainCPURequest,
		MainMemoryRequest:  req.MainMemoryRequest,
		MainCPULimit:       req.MainCPULimit,
		MainMemoryLimit:    req.MainMemoryLimit,
		IDECPURequest:      req.IDECPURequest,
		IDEMemoryRequest:   req.IDEMemoryRequest,
		IDECPULimit:        req.IDECPULimit,
		IDEMemoryLimit:     req.IDEMemoryLimit,
		DesktopEnabled:     req.DesktopEnabled,
		AppPorts:           req.AppPorts,
		DefaultAppPortName: req.DefaultAppPortName,
		ExposedPorts:       req.ExposedPorts,
		Status:             LabTemplateStatus(req.Status),
	}, true
}
