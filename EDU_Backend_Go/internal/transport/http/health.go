package http

import (
	"context"
	stdhttp "net/http"
	"time"

	"github.com/gin-gonic/gin"

	"edu-platform/internal/app"
	"edu-platform/pkg/response"
)

type HealthHandler struct {
	deps app.Dependencies
}

func NewHealthHandler(deps app.Dependencies) *HealthHandler {
	return &HealthHandler{deps: deps}
}

func (h *HealthHandler) Health(c *gin.Context) {
	status := gin.H{
		"app":       h.deps.Config.App.Name,
		"env":       h.deps.Config.App.Env,
		"version":   h.deps.Config.App.Version,
		"database":  "up",
		"redis":     "disabled",
		"k8s":       "disabled",
		"timestamp": time.Now().Format(time.RFC3339),
	}

	sqlDB, err := h.deps.DB.DB()
	if err != nil || sqlDB.PingContext(c.Request.Context()) != nil {
		status["database"] = "down"
		c.JSON(stdhttp.StatusServiceUnavailable, gin.H{"success": false, "data": status})
		return
	}

	if h.deps.Redis != nil {
		if h.deps.Redis.Ping(context.Background()).Err() == nil {
			status["redis"] = "up"
		} else {
			status["redis"] = "down"
		}
	}
	if h.deps.K8S != nil {
		status["k8s"] = "up"
	}

	response.Success(c, status, "OK")
}

func (h *HealthHandler) Version(c *gin.Context) {
	response.Success(c, gin.H{
		"name":    h.deps.Config.App.Name,
		"version": h.deps.Config.App.Version,
		"env":     h.deps.Config.App.Env,
	}, "OK")
}
