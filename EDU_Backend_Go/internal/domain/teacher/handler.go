package teacher

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/middleware"
	"edu-platform/pkg/pagination"
	"edu-platform/pkg/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) ListManuals(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	q := pagination.Normalize(page, pageSize)

	var sourceType *int
	if raw := c.Query("sourceType"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			sourceType = &parsed
		}
	}
	var published *int
	if raw := c.Query("published"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			published = &parsed
		}
	}

	items, total, err := h.service.ListManuals(c.Request.Context(), claims.UserID, claims.RoleType, ManualListQuery{
		Page:       q.Page,
		PageSize:   q.PageSize,
		Q:          c.Query("q"),
		SourceType: sourceType,
		Published:  published,
	})
	if err != nil {
		_ = c.Error(err)
		return
	}

	response.Success(c, gin.H{
		"list":     items,
		"total":    total,
		"page":     q.Page,
		"pageSize": q.PageSize,
	}, "获取手册列表成功")
}

func (h *Handler) ListStudentProgress(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	q := pagination.Normalize(page, pageSize)

	view := ProgressView(c.DefaultQuery("view", string(ProgressViewCourse)))
	items, total, summary, err := h.service.ListProgress(c.Request.Context(), claims.UserID, claims.RoleType, ProgressListQuery{
		View:     view,
		Page:     q.Page,
		PageSize: q.PageSize,
		Q:        c.Query("q"),
	})
	if err != nil {
		_ = c.Error(err)
		return
	}

	response.Success(c, gin.H{
		"view":     view,
		"summary":  summary,
		"list":     items,
		"total":    total,
		"page":     q.Page,
		"pageSize": q.PageSize,
	}, "获取学生进度成功")
}
