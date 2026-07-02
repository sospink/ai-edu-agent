package middleware

import (
	"github.com/gin-gonic/gin"

	"edu-platform/pkg/i18n"
)

func LocaleMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		rawLocale := c.GetHeader("X-Locale")
		if rawLocale == "" {
			rawLocale = c.Query("locale")
		}
		if rawLocale == "" {
			rawLocale = c.GetHeader("Accept-Language")
		}
		locale := i18n.NormalizeLocale(rawLocale)
		c.Set("locale", locale)
		c.Writer.Header().Set("Content-Language", locale)
		c.Request = c.Request.WithContext(i18n.WithLocale(c.Request.Context(), locale))
		c.Next()
	}
}
