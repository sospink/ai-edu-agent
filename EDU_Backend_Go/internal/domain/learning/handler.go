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
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	enrollments, err := h.service.GetUserEnrollments(claims.UserID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, enrollments, "learning.recordsLoaded", nil)
}

func (h *Handler) GetContinueLearning(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, err := h.service.GetContinueLearning(claims.UserID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "learning.continueLoaded", nil)
}

func (h *Handler) GetOverview(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	result, err := h.service.GetOverview(c.Request.Context(), claims.UserID)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, result, "learning.overviewLoaded", nil)
}

func (h *Handler) GetUserActivityLogs(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	days, _ := strconv.Atoi(c.DefaultQuery("days", "365"))
	logs, err := h.service.GetUserActivityLogs(claims.UserID, days)
	if err != nil {
		_ = c.Error(err)
		return
	}
	response.SuccessKey(c, logs, "learning.activityLoaded", nil)
}
