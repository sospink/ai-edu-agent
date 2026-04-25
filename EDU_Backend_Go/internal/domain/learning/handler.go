package learning

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/middleware"
	"edu-platform/pkg/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) GetUserEnrollments(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	enrollments, err := h.service.GetUserEnrollments(claims.UserID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, enrollments, "获取学习记录成功")
}

func (h *Handler) GetContinueLearning(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	result, err := h.service.GetContinueLearning(claims.UserID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取继续学习信息成功")
}

func (h *Handler) GetOverview(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	result, err := h.service.GetOverview(c.Request.Context(), claims.UserID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, result, "获取学习概览成功")
}

func (h *Handler) GetUserActivityLogs(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.Unauthorized(c, "请先登录")
		return
	}
	days, _ := strconv.Atoi(c.DefaultQuery("days", "365"))
	logs, err := h.service.GetUserActivityLogs(claims.UserID, days)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.Success(c, logs, "获取活跃记录成功")
}
