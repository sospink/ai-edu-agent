package http

import (
	"context"
	"encoding/csv"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"edu-platform/internal/app"
	"edu-platform/internal/domain/lab"
	"edu-platform/internal/domain/openclawview"
	"edu-platform/internal/domain/operations"
	"edu-platform/internal/infra/authz"
	"edu-platform/pkg/response"
)

type IntegrationsHandler struct {
	deps         app.Dependencies
	openclawView *openclawview.Service
	labService   *lab.Service
	operations   *operations.Service
}

func NewIntegrationsHandler(deps app.Dependencies, labService *lab.Service) *IntegrationsHandler {
	return &IntegrationsHandler{
		deps:         deps,
		openclawView: openclawview.NewService(deps.Config, deps.Logger, deps.DB),
		labService:   labService,
		operations:   operations.NewService(deps.DB, deps.Logger),
	}
}

func (h *IntegrationsHandler) K8SHealth(c *gin.Context) {
	if h.deps.K8S == nil {
		response.Error(c, http.StatusServiceUnavailable, "K8S client 未启用", "K8S_DISABLED")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	version, err := h.deps.K8S.Discovery().ServerVersion()
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "K8S API 不可用: "+err.Error(), "K8S_UNAVAILABLE")
		return
	}

	nsList, err := h.deps.K8S.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		response.Error(c, http.StatusServiceUnavailable, "K8S namespace 查询失败: "+err.Error(), "K8S_NAMESPACE_QUERY_FAILED")
		return
	}
	exposure, exposureErr := h.inspectLabExposure(ctx)
	if exposureErr != nil {
		exposure = newLabExposureSummary(runtimeNamespace(h.deps))
		exposure.Status = "warning"
		exposure.Message = "Lab 暴露面扫描失败: " + exposureErr.Error()
	}

	response.Success(c, gin.H{
		"enabled":             true,
		"serverVersion":       version.String(),
		"gitVersion":          version.GitVersion,
		"configuredNamespace": h.deps.Config.K8S.Namespace,
		"runtimeNamespace":    h.deps.Config.K8S.RuntimeNamespace,
		"namespaceCount":      len(nsList.Items),
		"apiServer":           "connected",
		"labExposure":         exposure,
	}, "K8S 连接正常")
}

func (h *IntegrationsHandler) ConfigSummary(c *gin.Context) {
	cfg := h.deps.Config
	response.Success(c, gin.H{
		"configSources": gin.H{
			"envFiles": cfg.LoadedEnvFiles,
		},
		"app": gin.H{
			"name":    cfg.App.Name,
			"env":     cfg.App.Env,
			"version": cfg.App.Version,
		},
		"server": gin.H{
			"host":    cfg.Server.Host,
			"port":    cfg.Server.Port,
			"wsPort":  cfg.WebSocket.Port,
			"debugWS": cfg.WebSocket.TerminalDebug,
		},
		"database": gin.H{
			"host":        cfg.Database.Host,
			"port":        cfg.Database.Port,
			"name":        cfg.Database.Name,
			"user":        cfg.Database.User,
			"charset":     cfg.Database.Charset,
			"autoMigrate": cfg.Database.AutoMigrate,
		},
		"redis": gin.H{
			"enabled": cfg.Redis.Enabled,
			"addr":    cfg.Redis.Addr,
			"db":      cfg.Redis.DB,
		},
		"log": gin.H{
			"level": cfg.Log.Level,
			"dir":   cfg.Log.Dir,
		},
		"labSSH": gin.H{
			"host": cfg.LabSSH.Host,
			"port": cfg.LabSSH.Port,
			"user": cfg.LabSSH.User,
		},
		"docker": gin.H{
			"host":     cfg.Docker.Host,
			"port":     cfg.Docker.Port,
			"tls":      cfg.Docker.TLS,
			"certPath": cfg.Docker.CertPath,
		},
		"k8s": gin.H{
			"enabled":          cfg.K8S.Enabled,
			"inCluster":        cfg.K8S.InCluster,
			"kubeconfig":       cfg.K8S.ResolvedKubeconfig(),
			"namespace":        cfg.K8S.Namespace,
			"runtimeNamespace": cfg.K8S.RuntimeNamespace,
			"ingressClass":     cfg.K8S.IngressClass,
		},
		"qwen": gin.H{
			"baseURL":   cfg.Qwen.BaseURL,
			"model":     cfg.Qwen.Model,
			"apiKeySet": cfg.Qwen.APIKey != "",
		},
		"openclaw": gin.H{
			"gatewayURL":         cfg.OpenClaw.GatewayURL,
			"gatewayTokenSet":    cfg.OpenClaw.GatewayToken != "",
			"gatewayPasswordSet": cfg.OpenClaw.GatewayPassword != "",
			"modelID":            cfg.OpenClaw.ModelID,
			"baseURL":            cfg.OpenClaw.BaseURL,
			"apiKeySet":          cfg.OpenClaw.APIKey != "",
			"apiProtocol":        cfg.OpenClaw.APIProtocol,
			"contextWindow":      cfg.OpenClaw.ContextWindow,
			"maxTokens":          cfg.OpenClaw.MaxTokens,
			"projectLabRuntime":  cfg.OpenClaw.ProjectLabRuntime,
		},
		"feishu": gin.H{
			"domain":       cfg.Feishu.Domain,
			"appIDSet":     cfg.Feishu.AppID != "",
			"appSecretSet": cfg.Feishu.AppSecret != "",
			"chatIDSet":    cfg.Feishu.ChatID != "",
			"botOpenIDSet": cfg.Feishu.BotOpenID != "",
		},
	}, "配置摘要")
}

func (h *IntegrationsHandler) OpenClawHealth(c *gin.Context) {
	if h.openclawView == nil {
		response.Error(c, http.StatusServiceUnavailable, "OpenClaw 健康检查服务未初始化", "OPENCLAW_HEALTH_UNAVAILABLE")
		return
	}

	data, err := h.openclawView.GetOpenClawHealth(c.Request.Context())
	if err != nil {
		response.Error(c, resolveIntegrationStatus(err), "OpenClaw 健康检查失败: "+err.Error(), "OPENCLAW_HEALTH_FAILED")
		return
	}

	response.Success(c, data, "OpenClaw 连接正常")
}

func (h *IntegrationsHandler) FeishuHealth(c *gin.Context) {
	if h.openclawView == nil {
		response.Error(c, http.StatusServiceUnavailable, "飞书健康检查服务未初始化", "FEISHU_HEALTH_UNAVAILABLE")
		return
	}

	data, err := h.openclawView.GetFeishuHealth(c.Request.Context())
	if err != nil {
		response.Error(c, resolveIntegrationStatus(err), "飞书健康检查失败: "+err.Error(), "FEISHU_HEALTH_FAILED")
		return
	}

	response.Success(c, data, "飞书连接正常")
}

func resolveIntegrationStatus(err error) int {
	if err == nil {
		return http.StatusOK
	}

	message := strings.ToLower(strings.TrimSpace(err.Error()))
	switch {
	case strings.Contains(message, "未配置"),
		strings.Contains(message, "missing"),
		strings.Contains(message, "invalid"):
		return http.StatusBadRequest
	case strings.Contains(message, "unauthorized"),
		strings.Contains(message, "认证"):
		return http.StatusUnauthorized
	default:
		return http.StatusServiceUnavailable
	}
}

func (h *IntegrationsHandler) RBACPolicies(c *gin.Context) {
	policyPath := authz.ResolveConfigPath("rbac_policy.csv")
	file, err := os.Open(policyPath)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "读取权限策略失败: "+err.Error(), "RBAC_POLICY_READ_FAILED")
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1
	records, err := reader.ReadAll()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "解析权限策略失败: "+err.Error(), "RBAC_POLICY_PARSE_FAILED")
		return
	}

	type policyRow struct {
		Role   string `json:"role"`
		Object string `json:"object"`
		Action string `json:"action"`
	}
	type inheritanceRow struct {
		From string `json:"from"`
		To   string `json:"to"`
	}

	policies := make([]policyRow, 0)
	inheritance := make([]inheritanceRow, 0)
	roleSet := map[string]struct{}{}

	for _, record := range records {
		if len(record) == 0 {
			continue
		}
		for i := range record {
			record[i] = strings.TrimSpace(record[i])
		}
		switch record[0] {
		case "p":
			if len(record) < 4 {
				continue
			}
			policies = append(policies, policyRow{
				Role:   record[1],
				Object: record[2],
				Action: record[3],
			})
			roleSet[record[1]] = struct{}{}
		case "g":
			if len(record) < 3 {
				continue
			}
			inheritance = append(inheritance, inheritanceRow{
				From: record[1],
				To:   record[2],
			})
			roleSet[record[1]] = struct{}{}
			roleSet[record[2]] = struct{}{}
		}
	}

	roles := make([]string, 0, len(roleSet))
	for role := range roleSet {
		roles = append(roles, role)
	}

	response.Success(c, gin.H{
		"roles":       roles,
		"policies":    policies,
		"inheritance": inheritance,
		"policyPath":  policyPath,
	}, "获取权限策略成功")
}
