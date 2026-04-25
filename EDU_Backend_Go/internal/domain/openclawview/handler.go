package openclawview

import (
	"errors"
	"net/http"
	"net/url"
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

func (h *Handler) GetThinking(c *gin.Context) {
	sessionID := strings.TrimSpace(c.Param("sessionId"))
	if sessionID == "" {
		response.BadRequest(c, "缺少 sessionId 参数")
		return
	}

	limit := 20
	if raw := c.Query("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	view, err := h.service.GetThinkingView(c.Request.Context(), currentUserID(c), sessionID, limit, parseScope(c.Query("scope")), parseSinceTS(c.Query("sinceTs")))
	if err != nil {
		response.Error(c, statusForSessionError(err), err.Error(), "OPENCLAW_THINKING_FAILED")
		return
	}
	response.Success(c, view, "获取思考视图成功")
}

func (h *Handler) GetExecuting(c *gin.Context) {
	sessionID := strings.TrimSpace(c.Param("sessionId"))
	if sessionID == "" {
		response.BadRequest(c, "缺少 sessionId 参数")
		return
	}

	view, err := h.service.GetExecutingView(c.Request.Context(), currentUserID(c), sessionID, parseScope(c.Query("scope")), parseSinceTS(c.Query("sinceTs")))
	if err != nil {
		response.Error(c, statusForSessionError(err), err.Error(), "OPENCLAW_EXECUTING_FAILED")
		return
	}
	response.Success(c, view, "获取执行视图成功")
}

func (h *Handler) GetCompleted(c *gin.Context) {
	sessionID := strings.TrimSpace(c.Param("sessionId"))
	if sessionID == "" {
		response.BadRequest(c, "缺少 sessionId 参数")
		return
	}

	view, err := h.service.GetCompletedView(c.Request.Context(), currentUserID(c), sessionID, parseScope(c.Query("scope")), parseSinceTS(c.Query("sinceTs")))
	if err != nil {
		response.Error(c, statusForSessionError(err), err.Error(), "OPENCLAW_COMPLETED_FAILED")
		return
	}
	response.Success(c, view, "获取完成视图成功")
}

func (h *Handler) GetPhase(c *gin.Context) {
	sessionID := strings.TrimSpace(c.Param("sessionId"))
	if sessionID == "" {
		response.BadRequest(c, "缺少 sessionId 参数")
		return
	}

	view, err := h.service.GetPhase(c.Request.Context(), currentUserID(c), sessionID, parseScope(c.Query("scope")), parseSinceTS(c.Query("sinceTs")))
	if err != nil {
		response.Error(c, statusForSessionError(err), err.Error(), "OPENCLAW_PHASE_FAILED")
		return
	}
	response.Success(c, view, "获取阶段成功")
}

func (h *Handler) DownloadFile(c *gin.Context) {
	messageID := strings.TrimSpace(c.Param("messageId"))
	fileKey := strings.TrimSpace(c.Param("fileKey"))
	if messageID == "" || fileKey == "" {
		response.BadRequest(c, "缺少 messageId 或 fileKey")
		return
	}

	resource, err := h.service.DownloadFile(c.Request.Context(), messageID, fileKey, c.DefaultQuery("type", "file"))
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "文件下载失败", "FILE_DOWNLOAD_ERROR")
		return
	}

	filename := c.DefaultQuery("name", "download")
	c.Header("Content-Type", resource.ContentType)
	c.Header("Content-Disposition", "attachment; filename*=UTF-8''"+urlQueryEscape(filename))
	c.Data(http.StatusOK, resource.ContentType, resource.Data)
}

func (h *Handler) SendMessage(c *gin.Context) {
	var req struct {
		Text       string `json:"text"`
		SessionID  string `json:"sessionId"`
		SessionKey string `json:"sessionKey"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Text) == "" {
		response.BadRequest(c, "消息内容不能为空")
		return
	}
	if strings.TrimSpace(req.SessionKey) != "" {
		response.BadRequest(c, "不允许客户端直接提交 OpenClaw sessionKey")
		return
	}

	result, err := h.service.SendMessage(c.Request.Context(), currentUserID(c), req.SessionID, req.Text)
	if err != nil {
		response.Error(c, statusForSessionError(err), err.Error(), "SEND_MESSAGE_ERROR")
		return
	}
	response.Success(c, result, "消息发送成功")
}

func currentUserID(c *gin.Context) uint64 {
	claims, ok := middleware.CurrentClaims(c)
	if !ok || claims == nil {
		return 0
	}
	return claims.UserID
}

func statusForSessionError(err error) int {
	switch {
	case errors.Is(err, ErrSessionForbidden):
		return http.StatusForbidden
	case errors.Is(err, ErrSessionNotFound), errors.Is(err, ErrInvalidSessionID), errors.Is(err, ErrSessionRuntimeInvalid):
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
}

func parseScope(raw string) ViewScope {
	if strings.EqualFold(strings.TrimSpace(raw), string(ScopeAll)) {
		return ScopeAll
	}
	return ScopeLatestTurn
}

func parseSinceTS(raw string) int64 {
	if strings.TrimSpace(raw) == "" {
		return 0
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value <= 0 {
		return 0
	}
	if value < 1e12 {
		return value * 1000
	}
	return value
}

func urlQueryEscape(value string) string {
	return strings.ReplaceAll(url.QueryEscape(value), "+", "%20")
}
