package project

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/middleware"
	apperrors "edu-platform/pkg/errors"
	"edu-platform/pkg/pagination"
	"edu-platform/pkg/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	q := pagination.Normalize(page, pageSize)

	var status *int
	if raw := c.Query("status"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			status = &parsed
		}
	}
	var difficulty *int
	if raw := c.Query("difficulty"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			difficulty = &parsed
		}
	}
	var tagID *uint64
	if raw := c.Query("tagId"); raw != "" {
		if parsed, err := strconv.ParseUint(raw, 10, 64); err == nil {
			tagID = &parsed
		}
	}

	list, total, err := h.service.List(q.Page, q.PageSize, c.Query("keyword"), status, difficulty, tagID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     q.Page,
		"pageSize": q.PageSize,
	}, "获取项目列表成功")
}

func (h *Handler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的项目ID")
		return
	}
	detail, serviceErr := h.service.FindByID(id)
	if serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.Success(c, detail, "获取项目成功")
}

func (h *Handler) GetBySlug(c *gin.Context) {
	detail, err := h.service.FindBySlug(c.Param("slug"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, detail, "获取项目成功")
}

func (h *Handler) GetUnits(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的项目ID")
		return
	}
	units, serviceErr := h.service.GetUnits(id)
	if serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.Success(c, units, "获取单元列表成功")
}

func (h *Handler) GetAllTags(c *gin.Context) {
	tags, err := h.service.GetAllTags()
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, tags, "获取标签列表成功")
}

func (h *Handler) CreateTag(c *gin.Context) {
	var req struct {
		Name       string `json:"name"`
		StyleColor string `json:"styleColor"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}
	tag, err := h.service.CreateTag(req.Name, req.StyleColor)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Created(c, tag, "标签创建成功")
}

func (h *Handler) UpdateTag(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的标签ID")
		return
	}
	var req struct {
		Name       *string `json:"name"`
		StyleColor *string `json:"styleColor"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}
	tag, serviceErr := h.service.UpdateTag(id, req.Name, req.StyleColor)
	if serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.Success(c, tag, "标签更新成功")
}

func (h *Handler) DeleteTag(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的标签ID")
		return
	}
	if serviceErr := h.service.DeleteTag(id); serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.Success[any](c, nil, "标签删除成功")
}

func (h *Handler) CreateProject(c *gin.Context) {
	var req struct {
		Title         string   `json:"title"`
		Slug          string   `json:"slug"`
		Subtitle      string   `json:"subtitle"`
		CoverURL      string   `json:"coverUrl"`
		Difficulty    int      `json:"difficulty"`
		Status        *int     `json:"status"`
		Description   string   `json:"description"`
		LearningGoals []string `json:"learningGoals"`
		Prerequisites []string `json:"prerequisites"`
		TagIDs        []uint64 `json:"tagIds"`
		EnvImage      string   `json:"envImage"`
		IDEImage      string   `json:"ideImage"`
		LabTemplateID uint64   `json:"labTemplateId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}
	status := ProjectStatusDraft
	if req.Status != nil {
		if ProjectStatus(*req.Status) != ProjectStatusPublished {
			status = ProjectStatus(*req.Status)
		}
	}
	var createdBy uint64
	if claims, ok := middleware.CurrentClaims(c); ok {
		createdBy = claims.UserID
	}
	project, err := h.service.CreateProject(CreateProjectParams{
		Title:         req.Title,
		Slug:          req.Slug,
		Subtitle:      req.Subtitle,
		CoverURL:      req.CoverURL,
		Difficulty:    req.Difficulty,
		Status:        status,
		Description:   req.Description,
		LearningGoals: req.LearningGoals,
		Prerequisites: req.Prerequisites,
		TagIDs:        req.TagIDs,
		CreatedBy:     createdBy,
		EnvImage:      req.EnvImage,
		IDEImage:      req.IDEImage,
		LabTemplateID: req.LabTemplateID,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Created(c, project, "项目创建成功")
}

func (h *Handler) UpdateProject(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的项目ID")
		return
	}
	if !h.ensureProjectAccess(c, id) {
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
	}
	if bindErr := c.ShouldBindJSON(&req); bindErr != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}
	var status *ProjectStatus
	if req.Status != nil {
		casted := ProjectStatus(*req.Status)
		status = &casted
	}
	project, serviceErr := h.service.UpdateProject(id, UpdateProjectParams{
		Title:         req.Title,
		Slug:          req.Slug,
		Subtitle:      req.Subtitle,
		CoverURL:      req.CoverURL,
		Difficulty:    req.Difficulty,
		Status:        status,
		Description:   req.Description,
		LearningGoals: req.LearningGoals,
		Prerequisites: req.Prerequisites,
		TagIDs:        req.TagIDs,
		EnvImage:      req.EnvImage,
		IDEImage:      req.IDEImage,
	})
	if serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.Success(c, project, "项目更新成功")
}

func (h *Handler) DeleteProject(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的项目ID")
		return
	}
	if !h.ensureProjectAccess(c, id) {
		return
	}
	if serviceErr := h.service.DeleteProject(id); serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.Success[any](c, nil, "项目删除成功")
}

func (h *Handler) PublishProject(c *gin.Context) {
	h.updateProjectStatus(c, ProjectStatusPublished, "项目已发布")
}

func (h *Handler) ArchiveProject(c *gin.Context) {
	h.updateProjectStatus(c, ProjectStatusArchived, "项目已下架")
}

func (h *Handler) DraftProject(c *gin.Context) {
	h.updateProjectStatus(c, ProjectStatusDraft, "项目已设为草稿")
}

func (h *Handler) CreateUnit(c *gin.Context) {
	projectID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的项目ID")
		return
	}
	if !h.ensureProjectAccess(c, projectID) {
		return
	}
	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Type        int    `json:"type"`
		ModeGroup   int    `json:"modeGroup"`
		EnvID       string `json:"envId"`
		TimeLimit   int    `json:"timeLimit"`
		Points      int    `json:"points"`
		SortOrder   int    `json:"sortOrder"`
		IsHidden    int    `json:"isHidden"`
	}
	if bindErr := c.ShouldBindJSON(&req); bindErr != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}
	unit, serviceErr := h.service.CreateUnit(CreateUnitParams{
		ProjectID:   projectID,
		Title:       req.Title,
		Description: req.Description,
		Type:        req.Type,
		ModeGroup:   req.ModeGroup,
		EnvID:       req.EnvID,
		TimeLimit:   req.TimeLimit,
		Points:      req.Points,
		SortOrder:   req.SortOrder,
		IsHidden:    req.IsHidden,
	})
	if serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.Created(c, unit, "单元创建成功")
}

func (h *Handler) UpdateUnit(c *gin.Context) {
	unitID, err := strconv.ParseUint(c.Param("unitId"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的单元ID")
		return
	}
	if !h.ensureProjectAccessByUnit(c, unitID) {
		return
	}
	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		Type        *int    `json:"type"`
		ModeGroup   *int    `json:"modeGroup"`
		EnvID       *string `json:"envId"`
		TimeLimit   *int    `json:"timeLimit"`
		Points      *int    `json:"points"`
		SortOrder   *int    `json:"sortOrder"`
		IsHidden    *int    `json:"isHidden"`
	}
	if bindErr := c.ShouldBindJSON(&req); bindErr != nil {
		response.BadRequest(c, "请求参数错误")
		return
	}
	unit, serviceErr := h.service.UpdateUnit(unitID, UpdateUnitParams{
		Title:       req.Title,
		Description: req.Description,
		Type:        req.Type,
		ModeGroup:   req.ModeGroup,
		EnvID:       req.EnvID,
		TimeLimit:   req.TimeLimit,
		Points:      req.Points,
		SortOrder:   req.SortOrder,
		IsHidden:    req.IsHidden,
	})
	if serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.Success(c, unit, "单元更新成功")
}

func (h *Handler) DeleteUnit(c *gin.Context) {
	unitID, err := strconv.ParseUint(c.Param("unitId"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的单元ID")
		return
	}
	if !h.ensureProjectAccessByUnit(c, unitID) {
		return
	}
	if serviceErr := h.service.DeleteUnit(unitID); serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.Success[any](c, nil, "单元删除成功")
}

func (h *Handler) ReorderUnits(c *gin.Context) {
	projectID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的项目ID")
		return
	}
	if !h.ensureProjectAccess(c, projectID) {
		return
	}
	var req struct {
		Orders []struct {
			ID        uint64 `json:"id"`
			SortOrder int    `json:"sortOrder"`
		} `json:"orders"`
	}
	if bindErr := c.ShouldBindJSON(&req); bindErr != nil || len(req.Orders) == 0 {
		response.BadRequest(c, "排序数据格式错误")
		return
	}
	orders := make([]struct {
		ID        uint64
		SortOrder int
	}, 0, len(req.Orders))
	for _, item := range req.Orders {
		orders = append(orders, struct {
			ID        uint64
			SortOrder int
		}{ID: item.ID, SortOrder: item.SortOrder})
	}
	units, serviceErr := h.service.ReorderUnits(projectID, orders)
	if serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.Success(c, units, "单元排序更新成功")
}

func (h *Handler) updateProjectStatus(c *gin.Context, status ProjectStatus, message string) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的项目ID")
		return
	}
	if !h.ensureProjectAccess(c, id) {
		return
	}
	project, serviceErr := h.service.UpdateProjectStatus(id, status)
	if serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.Success(c, project, message)
}

func (h *Handler) ensureProjectAccess(c *gin.Context, projectID uint64) bool {
	project, err := h.service.FindProjectEntity(projectID)
	if err != nil {
		_ = c.Error(err)
		return false
	}
	return h.ensureProjectOwnership(c, project.CreatedBy)
}

func (h *Handler) ensureProjectAccessByUnit(c *gin.Context, unitID uint64) bool {
	project, err := h.service.FindProjectEntityByUnitID(unitID)
	if err != nil {
		_ = c.Error(err)
		return false
	}
	return h.ensureProjectOwnership(c, project.CreatedBy)
}

func (h *Handler) ensureProjectOwnership(c *gin.Context, creatorID uint64) bool {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return false
	}
	if claims.RoleType >= 10 || creatorID == claims.UserID {
		return true
	}
	_ = c.Error(apperrors.Forbidden("无权管理该项目"))
	return false
}
