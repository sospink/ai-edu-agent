package project

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/middleware"
	"edu-platform/pkg/pagination"
	"edu-platform/pkg/response"
)

type TeacherHandler struct {
	service *Service
}

func NewTeacherHandler(service *Service) *TeacherHandler {
	return &TeacherHandler{service: service}
}

func (h *TeacherHandler) List(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

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

	list, total, err := h.service.ListForTeacherLocalized(c.Request.Context(), claims.UserID, claims.RoleType, q.Page, q.PageSize, c.Query("keyword"), status, difficulty, tagID)
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

func (h *TeacherHandler) GetByID(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "project.invalidId", nil)
		return
	}

	detail, serviceErr := h.service.FindByIDForTeacherLocalized(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}

	response.SuccessKey(c, detail, "project.detailLoaded", nil)
}

func (h *TeacherHandler) GetUnits(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequestKey(c, "project.invalidId", nil)
		return
	}

	units, serviceErr := h.service.GetUnitsForTeacherLocalized(c.Request.Context(), claims.UserID, claims.RoleType, id)
	if serviceErr != nil {
		_ = c.Error(serviceErr)
		return
	}

	response.SuccessKey(c, units, "project.unitsLoaded", nil)
}
