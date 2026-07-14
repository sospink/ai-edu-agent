package http

import (
	"github.com/gin-gonic/gin"

	"edu-platform/internal/config"
	"edu-platform/pkg/response"
)

type AdminSettingsHandler struct {
	cfg *config.Config
}

func NewAdminSettingsHandler(cfg *config.Config) *AdminSettingsHandler {
	return &AdminSettingsHandler{cfg: cfg}
}

func (h *AdminSettingsHandler) Get(c *gin.Context) {
	cfg := h.cfg
	if cfg == nil {
		response.InternalKey(c, "common.configUnavailable", nil)
		return
	}

	response.Success(c, gin.H{
		"app": gin.H{
			"name":    cfg.App.Name,
			"env":     cfg.App.Env,
			"version": cfg.App.Version,
		},
		"security": gin.H{
			"allowedOrigins":         cfg.Security.AllowedOrigins,
			"defaultAdminConfigured": cfg.Security.DefaultAdminPassword != "",
			"jwtIssuer":              cfg.JWT.Issuer,
			"jwtExpiresIn":           cfg.JWT.ExpiresIn,
		},
		"server": gin.H{
			"host":         cfg.Server.Host,
			"port":         cfg.Server.Port,
			"readTimeout":  cfg.Server.ReadTimeoutSeconds,
			"writeTimeout": cfg.Server.WriteTimeoutSeconds,
		},
		"runtime": gin.H{
			"k8sEnabled":       cfg.K8S.Enabled,
			"k8sNamespace":     cfg.K8S.Namespace,
			"runtimeNamespace": cfg.K8S.RuntimeNamespace,
		},
		"uploads": gin.H{
			"root":       cfg.Upload.Root,
			"publicBase": cfg.Upload.PublicBase,
			"maxImageMB": cfg.Upload.MaxImageMB,
			"maxFileMB":  cfg.Upload.MaxFileMB,
		},
	}, "获取系统设置成功")
}
