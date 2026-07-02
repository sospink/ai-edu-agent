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
			response.ForbiddenKey(c, "common.originForbidden", nil)
			c.Abort()
			return
		}
		if origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		}
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With, X-Locale")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "Content-Language")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
