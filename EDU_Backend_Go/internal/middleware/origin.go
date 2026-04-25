package middleware

import (
	"net/http"
	"strings"

	"edu-platform/internal/config"
)

func IsOriginAllowed(cfg *config.Config, origin string) bool {
	origin = normalizeOrigin(origin)
	if origin == "" {
		return true
	}
	if cfg == nil || len(cfg.Security.AllowedOrigins) == 0 {
		return false
	}
	for _, allowed := range cfg.Security.AllowedOrigins {
		allowed = normalizeOrigin(allowed)
		if allowed == "" {
			continue
		}
		if allowed == "*" || strings.EqualFold(allowed, origin) {
			return true
		}
	}
	return false
}

func normalizeOrigin(value string) string {
	return strings.TrimRight(strings.TrimSpace(value), "/")
}

func ResolveOrigin(cfg *config.Config, r *http.Request) (string, bool) {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return "", true
	}
	return origin, IsOriginAllowed(cfg, origin)
}
