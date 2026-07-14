package middleware

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"edu-platform/pkg/i18n"
	"edu-platform/pkg/response"
)

func Recovery(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			recovered := recover()
			if recovered == nil {
				return
			}
			if err, ok := recovered.(error); ok && errors.Is(err, http.ErrAbortHandler) {
				c.Abort()
				return
			}

			log.Error("panic recovered", zap.Any("recovered", recovered))
			if c.Writer.Written() {
				c.Abort()
				return
			}
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error":   i18n.T(c.Request.Context(), "服务器内部错误"),
				"code":    "INTERNAL_ERROR",
			})
		}()
		c.Next()
	}
}

func NotFound() gin.HandlerFunc {
	return func(c *gin.Context) {
		response.NotFoundKey(c, "common.notFound", nil)
	}
}
