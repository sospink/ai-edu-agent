package project

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/middleware"
	"edu-platform/pkg/i18n"
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
	response.SuccessKey(c, gin.H{
		"list":     list,
		"total":    total,
		"page":     q.Page,
		"pageSize": q.PageSize,
	}, "project.listLoaded", nil)
}

func (h *Handler) GetByID(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "project.invalidId", nil)
		return
	}
	detail, serviceErr := h.service.FindByID(id)
	if serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.SuccessKey(c, detail, "project.detailLoaded", nil)
}

func (h *Handler) GetBySlug(c *gin.Context) {
	detail, err := h.service.FindBySlug(c.Param("slug"))
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, detail, "project.detailLoaded", nil)
}

func (h *Handler) GetUnits(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "project.invalidId", nil)
		return
	}
	units, serviceErr := h.service.GetUnits(id)
	if serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.SuccessKey(c, units, "project.unitsLoaded", nil)
}

func (h *Handler) GetAllTags(c *gin.Context) {
	tags, err := h.service.GetAllTags()
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, tags, "project.tagsLoaded", nil)
}

func (h *Handler) CreateTag(c *gin.Context) {
	var req struct {
		Name       string `json:"name"`
		StyleColor string `json:"styleColor"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	tag, err := h.service.CreateTag(req.Name, req.StyleColor)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.CreatedKey(c, tag, "project.tagCreated", nil)
}

func (h *Handler) UpdateTag(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "project.invalidTagId", nil)
		return
	}
	var req struct {
		Name       *string `json:"name"`
		StyleColor *string `json:"styleColor"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequestKey(c, "common.invalidParams", nil)
		return
	}
	tag, serviceErr := h.service.UpdateTag(id, req.Name, req.StyleColor)
	if serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.SuccessKey(c, tag, "project.tagUpdated", nil)
}

func (h *Handler) DeleteTag(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "project.invalidTagId", nil)
		return
	}
	if serviceErr := h.service.DeleteTag(id); serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.SuccessKey[any](c, nil, "project.tagDeleted", nil)
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
		response.BadRequestKey(c, "common.invalidParams", nil)
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
	response.CreatedKey(c, project, "project.created", nil)
}

func (h *Handler) UpdateProject(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "project.invalidId", nil)
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
		response.BadRequestKey(c, "common.invalidParams", nil)
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
	response.SuccessKey(c, project, "project.updated", nil)
}

func (h *Handler) DeleteProject(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "project.invalidId", nil)
		return
	}
	if !h.ensureProjectAccess(c, id) {
		return
	}
	if serviceErr := h.service.DeleteProject(id); serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.SuccessKey[any](c, nil, "project.deleted", nil)
}

func (h *Handler) PublishProject(c *gin.Context) {
	h.updateProjectStatus(c, ProjectStatusPublished, "publishing.projectPublished")
}

func (h *Handler) ArchiveProject(c *gin.Context) {
	h.updateProjectStatus(c, ProjectStatusArchived, "publishing.projectArchived")
}

func (h *Handler) DraftProject(c *gin.Context) {
	h.updateProjectStatus(c, ProjectStatusDraft, "publishing.projectDrafted")
}

func (h *Handler) CreateUnit(c *gin.Context) {
	projectID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "project.invalidId", nil)
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
		response.BadRequestKey(c, "common.invalidParams", nil)
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
	response.CreatedKey(c, unit, "project.unitCreated", nil)
}

func (h *Handler) UpdateUnit(c *gin.Context) {
	unitID, err := strconv.ParseUint(c.Param("unitId"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "project.invalidUnitId", nil)
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
		response.BadRequestKey(c, "common.invalidParams", nil)
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
	response.SuccessKey(c, unit, "project.unitUpdated", nil)
}

func (h *Handler) DeleteUnit(c *gin.Context) {
	unitID, err := strconv.ParseUint(c.Param("unitId"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "project.invalidUnitId", nil)
		return
	}
	if !h.ensureProjectAccessByUnit(c, unitID) {
		return
	}
	if serviceErr := h.service.DeleteUnit(unitID); serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}
	response.SuccessKey[any](c, nil, "project.unitDeleted", nil)
}

func (h *Handler) ReorderUnits(c *gin.Context) {
	projectID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "project.invalidId", nil)
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
		response.BadRequestKey(c, "common.invalidOrder", nil)
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
	response.SuccessKey(c, units, "project.unitsReordered", nil)
}

func (h *Handler) updateProjectStatus(c *gin.Context, status ProjectStatus, key i18n.MessageKey) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "project.invalidId", nil)
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
	response.SuccessKey(c, project, key, nil)
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
		response.UnauthorizedKey(c, "auth.required", nil)
		return false
	}
	if claims.RoleType >= 10 || creatorID == claims.UserID {
		return true
	}
	response.ForbiddenKey(c, "publishing.projectForbidden", nil)
	return false
}
