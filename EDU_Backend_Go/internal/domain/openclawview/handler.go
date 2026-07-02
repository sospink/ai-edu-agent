package openclawview

import (
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/middleware"
	"edu-platform/pkg/i18n"
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
		response.ErrorKey(c, http.StatusBadRequest, "OPENCLAW_SESSION_ID_REQUIRED", "openclaw.sessionIdRequired", nil)
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
		writeSessionError(c, err, "OPENCLAW_THINKING_FAILED", "openclaw.thinkingFailed")
		return
	}
	response.SuccessKey(c, view, "openclaw.thinkingLoaded", nil)
}

func (h *Handler) GetExecuting(c *gin.Context) {
	sessionID := strings.TrimSpace(c.Param("sessionId"))
	if sessionID == "" {
		response.ErrorKey(c, http.StatusBadRequest, "OPENCLAW_SESSION_ID_REQUIRED", "openclaw.sessionIdRequired", nil)
		return
	}

	view, err := h.service.GetExecutingView(c.Request.Context(), currentUserID(c), sessionID, parseScope(c.Query("scope")), parseSinceTS(c.Query("sinceTs")))
	if err != nil {
		writeSessionError(c, err, "OPENCLAW_EXECUTING_FAILED", "openclaw.executingFailed")
		return
	}
	response.SuccessKey(c, view, "openclaw.executingLoaded", nil)
}

func (h *Handler) GetCompleted(c *gin.Context) {
	sessionID := strings.TrimSpace(c.Param("sessionId"))
	if sessionID == "" {
		response.ErrorKey(c, http.StatusBadRequest, "OPENCLAW_SESSION_ID_REQUIRED", "openclaw.sessionIdRequired", nil)
		return
	}

	view, err := h.service.GetCompletedView(c.Request.Context(), currentUserID(c), sessionID, parseScope(c.Query("scope")), parseSinceTS(c.Query("sinceTs")))
	if err != nil {
		writeSessionError(c, err, "OPENCLAW_COMPLETED_FAILED", "openclaw.completedFailed")
		return
	}
	response.SuccessKey(c, view, "openclaw.completedLoaded", nil)
}

func (h *Handler) GetPhase(c *gin.Context) {
	sessionID := strings.TrimSpace(c.Param("sessionId"))
	if sessionID == "" {
		response.ErrorKey(c, http.StatusBadRequest, "OPENCLAW_SESSION_ID_REQUIRED", "openclaw.sessionIdRequired", nil)
		return
	}

	view, err := h.service.GetPhase(c.Request.Context(), currentUserID(c), sessionID, parseScope(c.Query("scope")), parseSinceTS(c.Query("sinceTs")))
	if err != nil {
		writeSessionError(c, err, "OPENCLAW_PHASE_FAILED", "openclaw.phaseFailed")
		return
	}
	response.SuccessKey(c, view, "openclaw.phaseLoaded", nil)
}

func (h *Handler) DownloadFile(c *gin.Context) {
	messageID := strings.TrimSpace(c.Param("messageId"))
	fileKey := strings.TrimSpace(c.Param("fileKey"))
	if messageID == "" || fileKey == "" {
		response.ErrorKey(c, http.StatusBadRequest, "OPENCLAW_FILE_PARAMS_REQUIRED", "openclaw.fileParamsRequired", nil)
		return
	}

	resource, err := h.service.DownloadFile(c.Request.Context(), messageID, fileKey, c.DefaultQuery("type", "file"))
	if err != nil {
		response.ErrorKey(c, http.StatusInternalServerError, "FILE_DOWNLOAD_ERROR", "openclaw.fileDownloadFailed", nil)
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
		response.ErrorKey(c, http.StatusBadRequest, "OPENCLAW_MESSAGE_REQUIRED", "openclaw.messageRequired", nil)
		return
	}
	if strings.TrimSpace(req.SessionKey) != "" {
		response.ErrorKey(c, http.StatusBadRequest, "OPENCLAW_SESSION_KEY_FORBIDDEN", "openclaw.sessionKeyForbidden", nil)
		return
	}

	result, err := h.service.SendMessage(c.Request.Context(), currentUserID(c), req.SessionID, req.Text)
	if err != nil {
		writeSessionError(c, err, "SEND_MESSAGE_ERROR", "openclaw.sendFailed")
		return
	}
	response.SuccessKey(c, result, "openclaw.messageSent", nil)
}

func writeSessionError(c *gin.Context, err error, code string, fallbackKey i18n.MessageKey) {
	key := fallbackKey
	matched := true
	switch {
	case errors.Is(err, ErrSessionForbidden):
		key = "openclaw.sessionForbidden"
	case errors.Is(err, ErrSessionNotFound):
		key = "openclaw.sessionNotFound"
	case errors.Is(err, ErrInvalidSessionID):
		key = "openclaw.sessionInvalid"
	case errors.Is(err, ErrSessionRuntimeInvalid):
		key = "openclaw.runtimeInvalid"
	default:
		matched = false
	}
	// 已知会话错误已有专属文案，无需重复明细；未知错误保留底层原因便于诊断网关/会话异常。
	if matched {
		response.ErrorKey(c, statusForSessionError(err), code, key, nil)
		return
	}
	response.ErrorKeyWithDetail(c, statusForSessionError(err), code, key, nil, err)
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
