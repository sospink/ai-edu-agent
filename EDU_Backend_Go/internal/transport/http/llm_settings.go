package http

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"edu-platform/internal/domain/llm"
	"edu-platform/internal/middleware"
	"edu-platform/pkg/i18n"
	"edu-platform/pkg/response"
)

type LLMSettingsHandler struct {
	store     *llm.Store
	logger    *zap.Logger
	client    *http.Client
	probeSlot chan struct{}
}

func NewLLMSettingsHandler(store *llm.Store, logger *zap.Logger) *LLMSettingsHandler {
	return &LLMSettingsHandler{store: store, logger: logger, client: llm.NewHTTPClient(), probeSlot: make(chan struct{}, 1)}
}

func (h *LLMSettingsHandler) Get(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	view, err := h.store.Get()
	if err != nil {
		llmError(c, err)
		return
	}
	response.SuccessKey(c, view, "llm.loaded", nil)
}

func (h *LLMSettingsHandler) Save(c *gin.Context) {
	var input llm.Input
	if !bindLLM(c, &input) {
		return
	}
	claims, ok := middleware.CurrentClaims(c)
	if !ok {
		response.UnauthorizedKey(c, "auth.required", nil)
		return
	}
	view, err := h.store.Save(input, claims.UserID)
	if err != nil {
		llmError(c, err)
		return
	}
	// 审计日志不记录密钥、请求体或供应商响应。
	h.logger.Info("管理员更新大模型配置", zap.Uint64("actor_id", claims.UserID), zap.String("provider", view.Provider), zap.Uint64("version", view.Version), zap.Bool("configured", view.Configured))
	c.Header("Cache-Control", "no-store")
	response.SuccessKey(c, view, "llm.saved", nil)
}

func (h *LLMSettingsHandler) Test(c *gin.Context) {
	var input llm.Input
	if !bindLLM(c, &input) {
		return
	}
	select {
	case h.probeSlot <- struct{}{}:
		defer func() { <-h.probeSlot }()
	default:
		response.ErrorKey(c, 429, "LLM_TEST_BUSY", "llm.busy", nil)
		return
	}
	result, err := h.store.Test(c.Request.Context(), input, h.client)
	if err != nil {
		llmError(c, err)
		return
	}
	response.SuccessKey(c, result, "llm.tested", nil)
}

func bindLLM(c *gin.Context, input *llm.Input) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 16384)
	if c.ShouldBindJSON(input) != nil {
		llmError(c, llm.ErrInvalid)
		return false
	}
	return true
}

func llmError(c *gin.Context, err error) {
	status, code, key := 400, "LLM_INVALID_CONFIG", i18n.MessageKey("llm.invalid")
	switch {
	case errors.Is(err, llm.ErrKeyRequired):
		code, key = "LLM_KEY_REQUIRED", "llm.keyRequired"
	case errors.Is(err, llm.ErrConflict):
		status, code, key = 409, "LLM_CONFIG_CONFLICT", "llm.conflict"
	case errors.Is(err, llm.ErrStorage):
		status, code, key = 503, "LLM_STORAGE_ERROR", "llm.storage"
	default:
		var probe *llm.ProbeError
		if errors.As(err, &probe) {
			status, code = 502, probe.Code
			key = map[string]i18n.MessageKey{"LLM_CONNECTION_FAILED": "llm.connection", "LLM_AUTH_FAILED": "llm.auth", "LLM_MODEL_NOT_FOUND": "llm.model", "LLM_RATE_LIMITED": "llm.rate", "LLM_PROVIDER_ERROR": "llm.provider", "LLM_INVALID_RESPONSE": "llm.response"}[code]
		}
	}
	response.ErrorKey(c, status, code, key, nil)
}
