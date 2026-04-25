package publishing

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/middleware"
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
	id, ok := parseUintParam(c, "id", "无效的课程ID")
	if !ok {
		return
	}
	result, err := h.service.CheckCourse(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "课程发布检查完成")
}

func (h *Handler) PublishCourse(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "无效的课程ID")
	if !ok {
		return
	}
	record, err := h.service.PublishCourse(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, record, "课程已发布")
}

func (h *Handler) ArchiveCourse(c *gin.Context) {
	h.setCourseStatus(c, course.CourseStatusArchived, "课程已下架")
}

func (h *Handler) DraftCourse(c *gin.Context) {
	h.setCourseStatus(c, course.CourseStatusDraft, "课程已设为草稿")
}

func (h *Handler) UpdateCourse(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "无效的课程ID")
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
		response.BadRequest(c, "请求参数错误")
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
		response.Success(c, record, "课程更新成功")
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
		response.Success(c, record, "课程更新成功")
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
	response.Success(c, record, "课程更新并发布成功")
}

func (h *Handler) CheckProject(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "无效的项目ID")
	if !ok {
		return
	}
	result, err := h.service.CheckProject(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "项目发布检查完成")
}

func (h *Handler) PublishProject(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "无效的项目ID")
	if !ok {
		return
	}
	record, err := h.service.PublishProject(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, record, "项目已发布")
}

func (h *Handler) ArchiveProject(c *gin.Context) {
	h.setProjectStatus(c, project.ProjectStatusArchived, "项目已下架")
}

func (h *Handler) DraftProject(c *gin.Context) {
	h.setProjectStatus(c, project.ProjectStatusDraft, "项目已设为草稿")
}

func (h *Handler) UpdateProject(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "无效的项目ID")
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
		response.BadRequest(c, "请求参数错误")
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
		response.Success(c, record, "项目更新成功")
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
		response.Success(c, record, "项目更新成功")
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
	response.Success(c, record, "项目更新并发布成功")
}

func (h *Handler) CheckManual(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "无效的手册ID")
	if !ok {
		return
	}
	result, err := h.service.CheckManual(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "手册发布检查完成")
}

func (h *Handler) UpdateManual(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "无效的手册ID")
	if !ok {
		return
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		IsPublished *int   `json:"isPublished"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}
	manual, err := h.service.UpdateManual(c.Request.Context(), claims.UserID, claims.RoleType, id, req.Title, req.Description, req.IsPublished)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, gin.H{
		"id":          manual.ID,
		"title":       manual.Title,
		"description": manual.Description,
		"isPublished": manual.IsPublished,
	}, "手册更新成功")
}

func (h *Handler) ListTeacherLabTemplates(c *gin.Context) {
	templates, err := h.service.ListLabTemplates(c.Request.Context(), true)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, templates, "获取可用 Lab 模板成功")
}

func (h *Handler) ListAdminLabTemplates(c *gin.Context) {
	templates, err := h.service.ListLabTemplates(c.Request.Context(), false)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, templates, "获取 Lab 模板成功")
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
	response.Created(c, template, "Lab 模板创建成功")
}

func (h *Handler) UpdateLabTemplate(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "无效的模板ID")
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
	response.Success(c, template, "Lab 模板更新成功")
}

func (h *Handler) UpdateLabTemplateStatus(c *gin.Context) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "无效的模板ID")
	if !ok {
		return
	}
	var req struct {
		Status int `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}
	template, err := h.service.UpdateLabTemplateStatus(c.Request.Context(), claims.UserID, id, LabTemplateStatus(req.Status))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, template, "Lab 模板状态更新成功")
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
	response.Success(c, gin.H{
		"list":     logs,
		"total":    total,
		"page":     q.Page,
		"pageSize": q.PageSize,
	}, "获取发布审计成功")
}

func (h *Handler) setCourseStatus(c *gin.Context, status course.CourseStatus, message string) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "无效的课程ID")
	if !ok {
		return
	}
	record, err := h.service.SetCourseStatus(c.Request.Context(), claims.UserID, claims.RoleType, id, status)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, record, message)
}

func (h *Handler) setProjectStatus(c *gin.Context, status project.ProjectStatus, message string) {
	claims, ok := currentClaims(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id", "无效的项目ID")
	if !ok {
		return
	}
	record, err := h.service.SetProjectStatus(c.Request.Context(), claims.UserID, claims.RoleType, id, status)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, record, message)
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
	response.Forbidden(c, "无权管理该课程")
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
	response.Forbidden(c, "无权管理该项目")
	return false
}

func currentClaims(c *gin.Context) (*appjwt.Claims, bool) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return nil, false
	}
	return claims, true
}

func parseUintParam(c *gin.Context, name, message string) (uint64, bool) {
	id, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil {
		response.BadRequest(c, message)
		return 0, false
	}
	return id, true
}

func bindLabTemplateInput(c *gin.Context) (LabTemplateInput, bool) {
	var req struct {
		Name               string                   `json:"name"`
		Code               string                   `json:"code"`
		Description        string                   `json:"description"`
		RuntimeMode        string                   `json:"runtimeMode"`
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
		response.BadRequest(c, "请求参数错误")
		return LabTemplateInput{}, false
	}
	return LabTemplateInput{
		Name:               req.Name,
		Code:               req.Code,
		Description:        req.Description,
		RuntimeMode:        req.RuntimeMode,
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
