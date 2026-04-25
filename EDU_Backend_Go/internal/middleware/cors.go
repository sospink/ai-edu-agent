package middleware

import (
	"github.com/gin-gonic/gin"

	"edu-platform/internal/config"
	"edu-platform/pkg/response"
)

func CORSMiddleware(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin, allowed := ResolveOrigin(cfg, c.Request)
		if origin != "" {
			c.Writer.Header().Set("Vary", "Origin")
		}
		if origin != "" && !allowed {
			response.Forbidden(c, "Origin 不在允许列表中")
			c.Abort()
			return
		}
		if origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		}
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
