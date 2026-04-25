package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"edu-platform/pkg/response"
)

func Recovery(log *zap.Logger) gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, recovered interface{}) {
		log.Error("panic recovered", zap.Any("recovered", recovered))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "服务器内部错误",
			"code":    "INTERNAL_ERROR",
		})
	})
}

func NotFound() gin.HandlerFunc {
	return func(c *gin.Context) {
		response.NotFound(c, "接口不存在")
	}
}
