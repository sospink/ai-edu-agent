package router_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"

	"edu-platform/internal/app"
	"edu-platform/internal/config"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/lab"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/router"
)

func TestIntegrationsRoutesRequireAdminAuth(t *testing.T) {
	fixture := newIntegrationsFixture(t, nil)

	noTokenResp := performJSON(t, fixture.engine, http.MethodGet, "/api/integrations/config/summary", nil, "")
	if noTokenResp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", noTokenResp.Code)
	}

	studentToken := mustLogin(t, fixture, fixture.student.Username, "student@123")
	studentResp := performJSON(t, fixture.engine, http.MethodGet, "/api/integrations/config/summary", nil, studentToken)
	if studentResp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-admin token, got %d", studentResp.Code)
	}

	adminToken := mustLogin(t, fixture, fixture.admin.Username, "admin@123")
	adminResp := performJSON(t, fixture.engine, http.MethodGet, "/api/integrations/config/summary", nil, adminToken)
	if adminResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin token, got %d: %s", adminResp.Code, adminResp.Body.String())
	}
}

func TestIntegrationHealthRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	openClawServer := newFakeOpenClawGateway(t)
	defer openClawServer.Close()

	feishuServer := newFakeFeishuAPI(t)
	defer feishuServer.Close()

	cfg := &config.Config{
		App: config.AppConfig{
			Name:    "edu-platform-test",
			Env:     "test",
			Version: "test",
		},
		JWT: config.JWTConfig{
			Secret:    "test-secret",
			Issuer:    "edu-platform-test",
			ExpiresIn: "7d",
		},
		Upload: config.UploadConfig{
			Root: t.TempDir(),
		},
		OpenClaw: config.OpenClawConfig{
			GatewayURL:         "ws" + strings.TrimPrefix(openClawServer.URL, "http"),
			GatewayToken:       "gateway-token",
			DeviceIdentityPath: t.TempDir() + "/openclaw-device.json",
		},
		Feishu: config.FeishuConfig{
			AppID:     "cli_test_app_id",
			AppSecret: "cli_test_app_secret",
			Domain:    feishuServer.URL,
		},
	}

	fixture := newIntegrationsFixture(t, cfg)
	adminToken := mustLogin(t, fixture, fixture.admin.Username, "admin@123")

	openClawResp := performJSON(t, fixture.engine, http.MethodGet, "/api/integrations/openclaw/health", nil, adminToken)
	if openClawResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for openclaw health, got %d: %s", openClawResp.Code, openClawResp.Body.String())
	}
	var openClawAPI apiResponse
	decodeJSON(t, openClawResp.Body.Bytes(), &openClawAPI)
	if !openClawAPI.Success {
		t.Fatalf("expected openclaw health success, got %+v", openClawAPI)
	}
	var openClawPayload map[string]any
	decodeJSON(t, openClawAPI.Data, &openClawPayload)
	if openClawPayload["provider"] != "openclaw" {
		t.Fatalf("unexpected openclaw payload: %+v", openClawPayload)
	}
	if sessionsCount, ok := openClawPayload["sessionsCount"].(float64); !ok || sessionsCount != 1 {
		t.Fatalf("expected sessionsCount=1, got %+v", openClawPayload)
	}

	feishuResp := performJSON(t, fixture.engine, http.MethodGet, "/api/integrations/feishu/health", nil, adminToken)
	if feishuResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for feishu health, got %d: %s", feishuResp.Code, feishuResp.Body.String())
	}
	var feishuAPI apiResponse
	decodeJSON(t, feishuResp.Body.Bytes(), &feishuAPI)
	if !feishuAPI.Success {
		t.Fatalf("expected feishu health success, got %+v", feishuAPI)
	}
	var feishuPayload map[string]any
	decodeJSON(t, feishuAPI.Data, &feishuPayload)
	if feishuPayload["provider"] != "feishu" {
		t.Fatalf("unexpected feishu payload: %+v", feishuPayload)
	}
	if configured, ok := feishuPayload["configured"].(bool); !ok || !configured {
		t.Fatalf("expected feishu configured=true, got %+v", feishuPayload)
	}
}

func TestDashboardOverviewAndSessionsRoutes(t *testing.T) {
	fixture := newDashboardFixture(t)
	adminToken := mustLogin(t, fixture.auth, fixture.auth.admin.Username, "admin@123")

	overviewResp := performJSON(t, fixture.auth.engine, http.MethodGet, "/api/integrations/dashboard/overview", nil, adminToken)
	if overviewResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for dashboard overview, got %d: %s", overviewResp.Code, overviewResp.Body.String())
	}
	var overviewAPI apiResponse
	decodeJSON(t, overviewResp.Body.Bytes(), &overviewAPI)
	if !overviewAPI.Success {
		t.Fatalf("expected overview success, got %+v", overviewAPI)
	}
	var overview map[string]any
	decodeJSON(t, overviewAPI.Data, &overview)
	kpis := overview["kpis"].(map[string]any)
	if kpis["activeSessions"].(float64) != 1 {
		t.Fatalf("expected activeSessions=1, got %+v", kpis)
	}
	if kpis["creatingSessions"].(float64) != 1 {
		t.Fatalf("expected creatingSessions=1, got %+v", kpis)
	}
	if kpis["errorSessions"].(float64) != 1 {
		t.Fatalf("expected errorSessions=1, got %+v", kpis)
	}
	if kpis["openClawSessions"].(float64) != 1 {
		t.Fatalf("expected openClawSessions=1, got %+v", kpis)
	}

	sessionsResp := performJSON(t, fixture.auth.engine, http.MethodGet, "/api/integrations/dashboard/sessions?status=running&page=1&pageSize=10", nil, adminToken)
	if sessionsResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for sessions list, got %d: %s", sessionsResp.Code, sessionsResp.Body.String())
	}
	var sessionsAPI apiResponse
	decodeJSON(t, sessionsResp.Body.Bytes(), &sessionsAPI)
	if !sessionsAPI.Success {
		t.Fatalf("expected sessions success, got %+v", sessionsAPI)
	}
	var listPayload struct {
		List  []map[string]any `json:"list"`
		Total int              `json:"total"`
	}
	decodeJSON(t, sessionsAPI.Data, &listPayload)
	if listPayload.Total != 1 || len(listPayload.List) != 1 {
		t.Fatalf("expected one running session, got %+v", listPayload)
	}
	if listPayload.List[0]["sourceName"] != "K8S Classic 课" {
		t.Fatalf("unexpected session source, got %+v", listPayload.List[0])
	}

	recentResp := performJSON(t, fixture.auth.engine, http.MethodGet, "/api/integrations/dashboard/sessions?timeRange=24h&page=1&pageSize=20", nil, adminToken)
	if recentResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for recent sessions list, got %d: %s", recentResp.Code, recentResp.Body.String())
	}
	var recentAPI apiResponse
	decodeJSON(t, recentResp.Body.Bytes(), &recentAPI)
	if !recentAPI.Success {
		t.Fatalf("expected recent sessions success, got %+v", recentAPI)
	}
	var recentPayload struct {
		Total int `json:"total"`
	}
	decodeJSON(t, recentAPI.Data, &recentPayload)
	if recentPayload.Total != 3 {
		t.Fatalf("expected 3 recent sessions within 24h, got %+v", recentPayload)
	}
}

func TestDashboardSessionDetailLogsAndStop(t *testing.T) {
	fixture := newDashboardFixture(t)
	adminToken := mustLogin(t, fixture.auth, fixture.auth.admin.Username, "admin@123")

	detailResp := performJSON(t, fixture.auth.engine, http.MethodGet, "/api/integrations/dashboard/sessions/301", nil, adminToken)
	if detailResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for session detail, got %d: %s", detailResp.Code, detailResp.Body.String())
	}
	var detailAPI apiResponse
	decodeJSON(t, detailResp.Body.Bytes(), &detailAPI)
	if !detailAPI.Success {
		t.Fatalf("expected detail success, got %+v", detailAPI)
	}
	var detailPayload map[string]any
	decodeJSON(t, detailAPI.Data, &detailPayload)
	if detailPayload["pod"] == nil || detailPayload["service"] == nil {
		t.Fatalf("expected pod/service detail, got %+v", detailPayload)
	}
	events := detailPayload["events"].([]any)
	if len(events) == 0 {
		t.Fatalf("expected pod events in detail payload")
	}

	logsResp := performJSON(t, fixture.auth.engine, http.MethodGet, "/api/integrations/dashboard/sessions/302/logs?tail=50", nil, adminToken)
	if logsResp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 for pending pod logs, got %d: %s", logsResp.Code, logsResp.Body.String())
	}

	stopResp := performJSON(t, fixture.auth.engine, http.MethodPost, "/api/integrations/dashboard/sessions/301/stop", nil, adminToken)
	if stopResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for stop session, got %d: %s", stopResp.Code, stopResp.Body.String())
	}
	var refreshed lab.UserLabSession
	if err := fixture.auth.db.First(&refreshed, 301).Error; err != nil {
		t.Fatalf("reload session failed: %v", err)
	}
	if refreshed.Status != lab.SessionStatusStopped {
		t.Fatalf("expected stopped session, got %+v", refreshed)
	}

	stoppedLogsResp := performJSON(t, fixture.auth.engine, http.MethodGet, "/api/integrations/dashboard/sessions/304/logs?tail=50", nil, adminToken)
	if stoppedLogsResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for stopped session logs, got %d: %s", stoppedLogsResp.Code, stoppedLogsResp.Body.String())
	}
	var stoppedLogsAPI apiResponse
	decodeJSON(t, stoppedLogsResp.Body.Bytes(), &stoppedLogsAPI)
	if stoppedLogsAPI.Code != "DASHBOARD_SESSION_LOGS_FAILED" || !strings.Contains(stoppedLogsAPI.Error, "The current session has stopped") {
		t.Fatalf("expected friendly stopped-session message, got %+v", stoppedLogsAPI)
	}
}

func TestK8SHealthReportsLabExposureRisks(t *testing.T) {
	fixture := newDashboardFixture(t)
	adminToken := mustLogin(t, fixture.auth, fixture.auth.admin.Username, "admin@123")
	labels := map[string]string{
		"app.kubernetes.io/name":       "edu-lab",
		"app.kubernetes.io/managed-by": "edu-backend-go",
		"edu/session-id":               "399",
	}
	if _, err := fixture.k8s.CoreV1().Services("edu-runtime-dev").Create(t.Context(), &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{Name: "lab-service-risk", Namespace: "edu-runtime-dev", Labels: labels},
		Spec: corev1.ServiceSpec{
			Type: corev1.ServiceTypeNodePort,
			Ports: []corev1.ServicePort{{
				Name:     lab.PortNameNoVNC,
				Port:     lab.NoVNCPort,
				NodePort: 30080,
			}},
		},
	}, metav1.CreateOptions{}); err != nil {
		t.Fatalf("seed risky service failed: %v", err)
	}
	if _, err := fixture.k8s.CoreV1().Pods("edu-runtime-dev").Create(t.Context(), &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: "lab-session-risk", Namespace: "edu-runtime-dev", Labels: labels},
		Spec: corev1.PodSpec{
			HostNetwork: true,
			Containers: []corev1.Container{{
				Name:  lab.MainContainerName,
				Image: "docker.io/library/opencode-lab:latest",
				Ports: []corev1.ContainerPort{{
					Name:          lab.PortNameNoVNC,
					ContainerPort: lab.NoVNCPort,
					HostPort:      lab.NoVNCPort,
				}},
			}},
		},
	}, metav1.CreateOptions{}); err != nil {
		t.Fatalf("seed risky pod failed: %v", err)
	}
	if _, err := fixture.k8s.NetworkingV1().Ingresses("edu-runtime-dev").Create(t.Context(), &networkingv1.Ingress{
		ObjectMeta: metav1.ObjectMeta{Name: "lab-ingress-risk", Namespace: "edu-runtime-dev"},
	}, metav1.CreateOptions{}); err != nil {
		t.Fatalf("seed risky ingress failed: %v", err)
	}

	resp := performJSON(t, fixture.auth.engine, http.MethodGet, "/api/integrations/k8s/health", nil, adminToken)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200 for k8s health, got %d: %s", resp.Code, resp.Body.String())
	}
	var api apiResponse
	decodeJSON(t, resp.Body.Bytes(), &api)
	var payload map[string]any
	decodeJSON(t, api.Data, &payload)
	exposure := payload["labExposure"].(map[string]any)
	if exposure["status"] != "danger" {
		t.Fatalf("expected danger exposure status, got %+v", exposure)
	}
	if exposure["riskCount"].(float64) < 4 {
		t.Fatalf("expected service/pod/ingress risks, got %+v", exposure)
	}
}

func newIntegrationsFixture(t *testing.T, cfg *config.Config) *testFixture {
	t.Helper()

	fixture := newTestFixture(t)
	if cfg == nil {
		cfg = &config.Config{
			App: config.AppConfig{
				Name:    "edu-platform-test",
				Env:     "test",
				Version: "test",
			},
			JWT: config.JWTConfig{
				Secret:    "test-secret",
				Issuer:    "edu-platform-test",
				ExpiresIn: "7d",
			},
			Upload: config.UploadConfig{
				Root: t.TempDir(),
			},
		}
	}

	fixture.engine = router.New(app.Dependencies{
		Config:   cfg,
		Logger:   zap.NewNop(),
		DB:       fixture.db,
		Enforcer: mustTestEnforcer(t),
	})
	return fixture
}

type dashboardFixture struct {
	auth *testFixture
	k8s  *fake.Clientset
}

func newDashboardFixture(t *testing.T) *dashboardFixture {
	t.Helper()

	authFixture := newTestFixture(t)
	if err := authFixture.db.AutoMigrate(&course.Course{}, &project.Project{}, &lab.UserLabSession{}); err != nil {
		t.Fatalf("auto migrate dashboard models failed: %v", err)
	}

	courseRecord := &course.Course{
		ID:          201,
		Title:       "K8S Classic 课",
		Slug:        "k8s-classic",
		Status:      course.CourseStatusPublished,
		EnvImage:    "registry.cn/edu/classic:v1",
		CreatedAt:   time.Now().Add(-4 * time.Hour),
		UpdatedAt:   time.Now().Add(-4 * time.Hour),
		Description: "classic",
	}
	if err := authFixture.db.Create(courseRecord).Error; err != nil {
		t.Fatalf("seed course failed: %v", err)
	}

	projectRecord := &project.Project{
		ID:          202,
		Title:       "OpenClaw 项目",
		Slug:        "openclaw-project",
		Status:      project.ProjectStatusPublished,
		EnvImage:    "registry.cn/edu/openclaw:v2",
		CreatedBy:   authFixture.admin.ID,
		CreatedAt:   time.Now().Add(-3 * time.Hour),
		UpdatedAt:   time.Now().Add(-3 * time.Hour),
		Description: "openclaw",
	}
	if err := authFixture.db.Create(projectRecord).Error; err != nil {
		t.Fatalf("seed project failed: %v", err)
	}

	expiresRunning := time.Now().Add(90 * time.Minute)
	expiresCreating := time.Now().Add(50 * time.Minute)
	sessionRunning := &lab.UserLabSession{
		ID:            301,
		UserID:        authFixture.student.ID,
		SourceType:    lab.SourceTypeCourse,
		SourceID:      courseRecord.ID,
		ContainerName: lab.PodName(301),
		ImageName:     courseRecord.EnvImage,
		VNCPort:       uint(lab.NoVNCPort),
		SSHPort:       uint(lab.SSHPort),
		Status:        lab.SessionStatusRunning,
		ExpiresAt:     &expiresRunning,
		RuntimeMode:   lab.RuntimeModeClassic,
		CreatedAt:     time.Now().Add(-30 * time.Minute),
		UpdatedAt:     time.Now().Add(-5 * time.Minute),
	}
	sessionCreating := &lab.UserLabSession{
		ID:            302,
		UserID:        authFixture.student.ID,
		SourceType:    lab.SourceTypeProject,
		SourceID:      projectRecord.ID,
		ContainerName: lab.PodName(302),
		ImageName:     projectRecord.EnvImage,
		VNCPort:       uint(lab.NoVNCPort),
		SSHPort:       uint(lab.SSHPort),
		Status:        lab.SessionStatusCreating,
		ExpiresAt:     &expiresCreating,
		RuntimeMode:   lab.RuntimeModeOpenClaw,
		GatewayPort:   uint(lab.GatewayPort),
		GatewayToken:  "project-gw-token",
		CreatedAt:     time.Now().Add(-40 * time.Minute),
		UpdatedAt:     time.Now().Add(-3 * time.Minute),
	}
	sessionError := &lab.UserLabSession{
		ID:            303,
		UserID:        authFixture.student.ID,
		SourceType:    lab.SourceTypeCourse,
		SourceID:      courseRecord.ID,
		ContainerName: lab.PodName(303),
		ImageName:     courseRecord.EnvImage,
		Status:        lab.SessionStatusError,
		ErrorMessage:  "image pull failed",
		RuntimeMode:   lab.RuntimeModeClassic,
		CreatedAt:     time.Now().Add(-2 * time.Hour),
		UpdatedAt:     time.Now().Add(-2 * time.Hour),
	}
	sessionStoppedOld := &lab.UserLabSession{
		ID:            304,
		UserID:        authFixture.student.ID,
		SourceType:    lab.SourceTypeCourse,
		SourceID:      courseRecord.ID,
		ContainerName: lab.PodName(304),
		ImageName:     courseRecord.EnvImage,
		Status:        lab.SessionStatusStopped,
		RuntimeMode:   lab.RuntimeModeClassic,
		CreatedAt:     time.Now().Add(-45 * 24 * time.Hour),
		UpdatedAt:     time.Now().Add(-40 * 24 * time.Hour),
	}
	if err := authFixture.db.Create([]*lab.UserLabSession{sessionRunning, sessionCreating, sessionError, sessionStoppedOld}).Error; err != nil {
		t.Fatalf("seed sessions failed: %v", err)
	}

	k8s := fake.NewSimpleClientset(
		&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "edu-runtime-dev"}},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      lab.PodName(301),
				Namespace: "edu-runtime-dev",
				Labels: map[string]string{
					"app.kubernetes.io/name":       "edu-lab",
					"app.kubernetes.io/managed-by": "edu-backend-go",
					"edu/session-id":               "301",
				},
			},
			Spec: corev1.PodSpec{
				NodeName: "node-a",
				Containers: []corev1.Container{
					{Name: lab.MainContainerName, Image: courseRecord.EnvImage},
				},
			},
			Status: corev1.PodStatus{
				Phase:     corev1.PodRunning,
				PodIP:     "10.42.0.31",
				StartTime: &metav1.Time{Time: time.Now().Add(-25 * time.Minute)},
				Conditions: []corev1.PodCondition{
					{Type: corev1.PodReady, Status: corev1.ConditionTrue, LastTransitionTime: metav1.NewTime(time.Now().Add(-24 * time.Minute))},
				},
			},
		},
		&corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      lab.PodName(302),
				Namespace: "edu-runtime-dev",
				Labels: map[string]string{
					"app.kubernetes.io/name":       "edu-lab",
					"app.kubernetes.io/managed-by": "edu-backend-go",
					"edu/session-id":               "302",
				},
			},
			Spec: corev1.PodSpec{
				NodeName: "node-b",
				Containers: []corev1.Container{
					{Name: lab.MainContainerName, Image: projectRecord.EnvImage},
				},
			},
			Status: corev1.PodStatus{
				Phase: corev1.PodPending,
				Conditions: []corev1.PodCondition{
					{Type: corev1.PodReady, Status: corev1.ConditionFalse, Reason: "ContainersNotReady", LastTransitionTime: metav1.NewTime(time.Now().Add(-10 * time.Minute))},
				},
			},
		},
		&corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      lab.ServiceName(301),
				Namespace: "edu-runtime-dev",
				Labels: map[string]string{
					"app.kubernetes.io/name":       "edu-lab",
					"app.kubernetes.io/managed-by": "edu-backend-go",
					"edu/session-id":               "301",
				},
			},
			Spec: corev1.ServiceSpec{
				Type:      corev1.ServiceTypeClusterIP,
				ClusterIP: "10.96.0.88",
				Ports: []corev1.ServicePort{
					{Name: lab.PortNameNoVNC, Port: lab.NoVNCPort},
				},
			},
		},
		&corev1.Event{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "pod-ready-event",
				Namespace: "edu-runtime-dev",
			},
			InvolvedObject: corev1.ObjectReference{
				Name: lab.PodName(301),
				Kind: "Pod",
			},
			Type:           "Normal",
			Reason:         "Ready",
			Message:        "Pod became ready",
			Count:          1,
			FirstTimestamp: metav1.NewTime(time.Now().Add(-20 * time.Minute)),
			LastTimestamp:  metav1.NewTime(time.Now().Add(-18 * time.Minute)),
		},
	)

	cfg := &config.Config{
		App: config.AppConfig{
			Name:    "edu-platform-test",
			Env:     "test",
			Version: "test",
		},
		JWT: config.JWTConfig{
			Secret:    "test-secret",
			Issuer:    "edu-platform-test",
			ExpiresIn: "7d",
		},
		Upload: config.UploadConfig{
			Root: filepath.Join(t.TempDir(), "uploads"),
		},
		K8S: config.K8SConfig{
			Enabled:          true,
			Namespace:        "edu-backend-go-dev",
			RuntimeNamespace: "edu-runtime-dev",
		},
		OpenClaw: config.OpenClawConfig{
			ProjectLabRuntime: "openclaw",
		},
	}

	authFixture.engine = router.New(app.Dependencies{
		Config:   cfg,
		Logger:   zap.NewNop(),
		DB:       authFixture.db,
		K8S:      k8s,
		Enforcer: mustTestEnforcer(t),
	})

	return &dashboardFixture{
		auth: authFixture,
		k8s:  k8s,
	}
}

func newFakeOpenClawGateway(t *testing.T) *httptest.Server {
	t.Helper()

	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Fatalf("upgrade websocket failed: %v", err)
		}
		defer conn.Close()

		if err := conn.WriteJSON(map[string]any{
			"type":  "event",
			"event": "connect.challenge",
			"payload": map[string]any{
				"nonce": "nonce-test",
			},
		}); err != nil {
			t.Fatalf("write challenge failed: %v", err)
		}

		for {
			var req struct {
				Type   string         `json:"type"`
				ID     string         `json:"id"`
				Method string         `json:"method"`
				Params map[string]any `json:"params"`
			}
			if err := conn.ReadJSON(&req); err != nil {
				return
			}

			var payload map[string]any
			switch req.Method {
			case "connect":
				payload = map[string]any{"accepted": true}
			case "status":
				payload = map[string]any{"status": "ok", "version": "test-gateway"}
			case "sessions.list":
				payload = map[string]any{
					"sessions": []map[string]any{
						{"id": "session-1"},
					},
				}
			default:
				payload = map[string]any{}
			}

			if err := conn.WriteJSON(map[string]any{
				"type":    "res",
				"id":      req.ID,
				"ok":      true,
				"payload": payload,
			}); err != nil {
				t.Fatalf("write response failed: %v", err)
			}
		}
	}))
}

func newFakeFeishuAPI(t *testing.T) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/open-apis/auth/v3/tenant_access_token/internal" {
			http.NotFound(w, r)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"code":                0,
			"msg":                 "ok",
			"tenant_access_token": "tenant-access-token",
			"expire":              7200,
		})
	}))
}
