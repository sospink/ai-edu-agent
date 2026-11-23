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
	"edu-platform/internal/domain/llm"
	"edu-platform/internal/domain/operations"
	"edu-platform/internal/infra/authz"
	"edu-platform/pkg/i18n"
	"edu-platform/pkg/response"
)

type IntegrationsHandler struct {
	deps          app.Dependencies
	labService    *lab.Service
	operations    *operations.Service
	modelSettings *llm.Store
}

func (h *IntegrationsHandler) SetModelSettings(store *llm.Store) { h.modelSettings = store }

func NewIntegrationsHandler(deps app.Dependencies, labService *lab.Service) *IntegrationsHandler {
	return &IntegrationsHandler{
		deps:       deps,
		labService: labService,
		operations: operations.NewService(deps.DB, deps.Logger),
	}
}

func (h *IntegrationsHandler) K8SHealth(c *gin.Context) {
	if h.deps.K8S == nil {
		response.ErrorKey(c, http.StatusServiceUnavailable, "K8S_DISABLED", "integrations.k8sDisabled", nil)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	version, err := h.deps.K8S.Discovery().ServerVersion()
	if err != nil {
		response.ErrorKeyWithDetail(c, http.StatusServiceUnavailable, "K8S_UNAVAILABLE", "integrations.k8sUnavailable", nil, err)
		return
	}

	nsList, err := h.deps.K8S.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		response.ErrorKeyWithDetail(c, http.StatusServiceUnavailable, "K8S_NAMESPACE_QUERY_FAILED", "integrations.namespaceQueryFailed", nil, err)
		return
	}
	exposure, exposureErr := h.inspectLabExposure(ctx)
	if exposureErr != nil {
		exposure = newLabExposureSummary(c.Request.Context(), runtimeNamespace(h.deps))
		exposure.Status = "warning"
		exposure.Message = i18n.Message(c.Request.Context(), "integrations.exposureScanFailed", nil)
	}

	response.SuccessKey(c, gin.H{
		"enabled":             true,
		"serverVersion":       version.String(),
		"gitVersion":          version.GitVersion,
		"configuredNamespace": h.deps.Config.K8S.Namespace,
		"runtimeNamespace":    h.deps.Config.K8S.RuntimeNamespace,
		"namespaceCount":      len(nsList.Items),
		"apiServer":           "connected",
		"labExposure":         exposure,
	}, "integrations.k8sHealthy", nil)
}

func (h *IntegrationsHandler) ConfigSummary(c *gin.Context) {
	cfg := h.deps.Config
	model := llm.View{BaseURL: cfg.Qwen.BaseURL, Model: cfg.Qwen.Model, Configured: cfg.Qwen.APIKey != "", Source: "environment"}
	if h.modelSettings != nil {
		var err error
		model, err = h.modelSettings.Get()
		if err != nil {
			llmError(c, err)
			return
		}
	}
	response.SuccessKey(c, gin.H{
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
			"baseURL":   model.BaseURL,
			"model":     model.Model,
			"apiKeySet": model.Configured,
		},
		"modelService": model,
	}, "integrations.configLoaded", nil)
}

func (h *IntegrationsHandler) RBACPolicies(c *gin.Context) {
	policyPath := authz.ResolveConfigPath("rbac_policy.csv")
	file, err := os.Open(policyPath)
	if err != nil {
		response.ErrorKeyWithDetail(c, http.StatusInternalServerError, "RBAC_POLICY_READ_FAILED", "integrations.rbacReadFailed", nil, err)
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1
	records, err := reader.ReadAll()
	if err != nil {
		response.ErrorKeyWithDetail(c, http.StatusInternalServerError, "RBAC_POLICY_PARSE_FAILED", "integrations.rbacParseFailed", nil, err)
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

	response.SuccessKey(c, gin.H{
		"roles":       roles,
		"policies":    policies,
		"inheritance": inheritance,
		"policyPath":  policyPath,
	}, "integrations.rbacLoaded", nil)
}
