package operations

import (
	"net/http"
	"strconv"
	"strings"

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

func (h *Handler) ListResourceQuotas(c *gin.Context) {
	result, err := h.service.ListQuotas(c.Request.Context(), QuotaListQuery{
		ScopeType: c.Query("scopeType"),
		Enabled:   c.Query("enabled"),
		Q:         c.Query("q"),
		Page:      parseInt(c.Query("page")),
		PageSize:  parseInt(c.Query("pageSize")),
	})
	if err != nil {
		response.Internal(c, "获取资源配额失败: "+err.Error())
		return
	}
	response.Success(c, result, "资源配额已加载")
}

func (h *Handler) CreateResourceQuota(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	input, ok := bindQuotaInput(c)
	if !ok {
		return
	}
	quota, err := h.service.CreateQuota(c.Request.Context(), claims.UserID, input)
	if err != nil {
		response.BadRequest(c, "创建资源配额失败: "+err.Error())
		return
	}
	response.Created(c, quota, "资源配额已创建")
}

func (h *Handler) UpdateResourceQuota(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	id, ok := parseIDParam(c)
	if !ok {
		return
	}
	input, ok := bindQuotaInput(c)
	if !ok {
		return
	}
	quota, err := h.service.UpdateQuota(c.Request.Context(), claims.UserID, id, input)
	if err != nil {
		response.BadRequest(c, "更新资源配额失败: "+err.Error())
		return
	}
	response.Success(c, quota, "资源配额已更新")
}

func (h *Handler) UpdateResourceQuotaStatus(c *gin.Context) {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		response.Unauthorized(c, "请先登录")
		return
	}
	id, ok := parseIDParam(c)
	if !ok {
		return
	}
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数无效")
		return
	}
	quota, err := h.service.SetQuotaStatus(c.Request.Context(), claims.UserID, id, req.Enabled)
	if err != nil {
		response.BadRequest(c, "更新资源配额状态失败: "+err.Error())
		return
	}
	response.Success(c, quota, "资源配额状态已更新")
}

func (h *Handler) ListAuditLogs(c *gin.Context) {
	actorID, _ := strconv.ParseUint(strings.TrimSpace(c.Query("actorId")), 10, 64)
	result, err := h.service.ListAuditLogs(c.Request.Context(), AuditListQuery{
		ActorID:    actorID,
		Action:     c.Query("action"),
		TargetType: c.Query("targetType"),
		Result:     c.Query("result"),
		Q:          c.Query("q"),
		Page:       parseInt(c.Query("page")),
		PageSize:   parseInt(c.Query("pageSize")),
	})
	if err != nil {
		response.Internal(c, "获取审计日志失败: "+err.Error())
		return
	}
	response.Success(c, result, "审计日志已加载")
}

func bindQuotaInput(c *gin.Context) (QuotaInput, bool) {
	var req struct {
		ScopeType             string `json:"scopeType"`
		ScopeID               uint64 `json:"scopeId"`
		Name                  string `json:"name"`
		MaxConcurrentSessions int    `json:"maxConcurrentSessions"`
		MaxSessionMinutes     int    `json:"maxSessionMinutes"`
		Enabled               *bool  `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数无效")
		return QuotaInput{}, false
	}
	return QuotaInput{
		ScopeType:             req.ScopeType,
		ScopeID:               req.ScopeID,
		Name:                  req.Name,
		MaxConcurrentSessions: req.MaxConcurrentSessions,
		MaxSessionMinutes:     req.MaxSessionMinutes,
		Enabled:               req.Enabled,
	}, true
}

func parseIDParam(c *gin.Context) (uint64, bool) {
	id, err := strconv.ParseUint(strings.TrimSpace(c.Param("id")), 10, 64)
	if err != nil || id == 0 {
		response.BadRequest(c, "无效的 ID")
		return 0, false
	}
	return id, true
}

func parseInt(value string) int {
	parsed, _ := strconv.Atoi(strings.TrimSpace(value))
	return parsed
}

func WriteAuditFromGin(c *gin.Context, service *Service, action, targetType string, targetID uint64, result, message string, metadata JSONMap) {
	if service == nil {
		return
	}
	claims, _ := middleware.CurrentClaims(c)
	actorID := uint64(0)
	actorRole := 0
	if claims != nil {
		actorID = claims.UserID
		actorRole = claims.RoleType
	}
	_ = service.RecordAudit(c.Request.Context(), AuditFromRequest(actorID, actorRole, action, targetType, targetID, result, message, c.ClientIP(), c.Request.UserAgent(), metadata))
}

func ErrorStatus(err error) int {
	if err == nil {
		return http.StatusOK
	}
	return http.StatusBadRequest
}
