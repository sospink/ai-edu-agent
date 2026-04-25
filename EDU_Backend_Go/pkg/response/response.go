package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type APIResponse[T any] struct {
	Success bool   `json:"success"`
	Data    T      `json:"data,omitempty"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
	Code    string `json:"code,omitempty"`
}

func Success[T any](c *gin.Context, data T, message string) {
	c.JSON(http.StatusOK, APIResponse[T]{
		Success: true,
		Data:    data,
		Message: message,
	})
}

func Created[T any](c *gin.Context, data T, message string) {
	c.JSON(http.StatusCreated, APIResponse[T]{
		Success: true,
		Data:    data,
		Message: message,
	})
}

func Error(c *gin.Context, status int, message, code string) {
	c.JSON(status, APIResponse[any]{
		Success: false,
		Error:   message,
		Code:    code,
	})
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
