package response

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	"edu-platform/pkg/i18n"
)

type APIResponse[T any] struct {
	Success bool `json:"success"`
	// data 不使用 omitempty：成功响应必须始终携带 data 字段，空列表需序列化为 []，
	// 否则前端及测试拿到的 data 会缺失（历史 gin.H 写法始终输出 data）。
	Data    T      `json:"data"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
	Code    string `json:"code,omitempty"`
}

func Success[T any](c *gin.Context, data T, message string) {
	c.JSON(http.StatusOK, APIResponse[T]{
		Success: true,
		Data:    data,
		Message: i18n.SystemText(requestContext(c), message, "Operation completed successfully"),
	})
}

func Created[T any](c *gin.Context, data T, message string) {
	c.JSON(http.StatusCreated, APIResponse[T]{
		Success: true,
		Data:    data,
		Message: i18n.SystemText(requestContext(c), message, "Created successfully"),
	})
}

func Error(c *gin.Context, status int, message, code string) {
	c.JSON(status, APIResponse[any]{
		Success: false,
		Error:   i18n.SystemText(requestContext(c), message, "Request failed"),
		Code:    code,
	})
}

func SuccessKey[T any](c *gin.Context, data T, key i18n.MessageKey, params i18n.Params) {
	c.JSON(http.StatusOK, APIResponse[T]{
		Success: true,
		Data:    data,
		Message: i18n.Message(requestContext(c), key, params),
	})
}

func CreatedKey[T any](c *gin.Context, data T, key i18n.MessageKey, params i18n.Params) {
	c.JSON(http.StatusCreated, APIResponse[T]{
		Success: true,
		Data:    data,
		Message: i18n.Message(requestContext(c), key, params),
	})
}

func ErrorKey(c *gin.Context, status int, code string, key i18n.MessageKey, params i18n.Params) {
	c.JSON(status, APIResponse[any]{
		Success: false,
		Error:   i18n.Message(requestContext(c), key, params),
		Code:    code,
	})
}

// ErrorKeyWithDetail 在本地化前缀（key）后附加具体错误明细，兼顾 i18n 与可诊断信息：
// 运维/管理类接口需要 err 的真实原因（K8S、网关、校验等），不能只返回通用文案。
// 明细经 i18n.OptionalDetail 处理：中文原样、英文译文，无法翻译的中文在英文下丢弃以防泄漏。
func ErrorKeyWithDetail(c *gin.Context, status int, code string, key i18n.MessageKey, params i18n.Params, err error) {
	ctx := requestContext(c)
	message := i18n.Message(ctx, key, params)
	if err != nil {
		if detail := i18n.OptionalDetail(ctx, err.Error()); detail != "" {
			message = message + ": " + detail
		}
	}
	c.JSON(status, APIResponse[any]{
		Success: false,
		Error:   message,
		Code:    code,
	})
}

func BadRequestKey(c *gin.Context, key i18n.MessageKey, params i18n.Params) {
	ErrorKey(c, http.StatusBadRequest, "BAD_REQUEST", key, params)
}

func UnauthorizedKey(c *gin.Context, key i18n.MessageKey, params i18n.Params) {
	ErrorKey(c, http.StatusUnauthorized, "UNAUTHORIZED", key, params)
}

func ForbiddenKey(c *gin.Context, key i18n.MessageKey, params i18n.Params) {
	ErrorKey(c, http.StatusForbidden, "FORBIDDEN", key, params)
}

func NotFoundKey(c *gin.Context, key i18n.MessageKey, params i18n.Params) {
	ErrorKey(c, http.StatusNotFound, "NOT_FOUND", key, params)
}

func InternalKey(c *gin.Context, key i18n.MessageKey, params i18n.Params) {
	ErrorKey(c, http.StatusInternalServerError, "INTERNAL_ERROR", key, params)
}

func requestContext(c *gin.Context) context.Context {
	if c == nil || c.Request == nil {
		return context.Background()
	}
	return c.Request.Context()
}

func BadRequest(c *gin.Context, message string) {
	Error(c, http.StatusBadRequest, message, "BAD_REQUEST")
}

func Unauthorized(c *gin.Context, message string) {
	Error(c, http.StatusUnauthorized, message, "UNAUTHORIZED")
}

func Forbidden(c *gin.Context, message string) {
	Error(c, http.StatusForbidden, message, "FORBIDDEN")
}

func NotFound(c *gin.Context, message string) {
	Error(c, http.StatusNotFound, message, "NOT_FOUND")
}

func Internal(c *gin.Context, message string) {
	Error(c, http.StatusInternalServerError, message, "INTERNAL_ERROR")
}
