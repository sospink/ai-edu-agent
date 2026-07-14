package http

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"edu-platform/internal/app"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/lab"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/user"
	"edu-platform/internal/middleware"
	"edu-platform/pkg/i18n"
	"edu-platform/pkg/response"
)

const dashboardLabelSelector = "app.kubernetes.io/name=edu-lab,app.kubernetes.io/managed-by=edu-backend-go"

var (
	errDashboardLogPodMissing  = errors.New("当前会话对应的运行 Pod 已不存在，环境可能已停止或已被清理")
	errDashboardSessionStopped = errors.New("当前会话已停止，暂时无法读取运行日志")
)

type dashboardSessionRow struct {
	lab.UserLabSession
	UserName   string `json:"userName"`
	FullName   string `json:"fullName"`
	SourceName string `json:"sourceName"`
	StatusText string `json:"statusText"`
	SourceText string `json:"sourceText"`
}

type dashboardOverviewPayload struct {
	KPIs           dashboardKPIs              `json:"kpis"`
	Runtime        dashboardRuntimeSummary    `json:"runtime"`
	Integrations   []dashboardIntegrationCard `json:"integrations"`
	Highlights     []dashboardHighlight       `json:"highlights"`
	RecentSessions []dashboardSessionRow      `json:"recentSessions"`
}

type dashboardKPIs struct {
	ActiveSessions   int `json:"activeSessions"`
	CreatingSessions int `json:"creatingSessions"`
	ErrorSessions    int `json:"errorSessions"`
	Recent24h        int `json:"recent24h"`
	ExpiredPending   int `json:"expiredPending"`
}

type dashboardRuntimeSummary struct {
	ConfiguredNamespace string                `json:"configuredNamespace"`
	RuntimeNamespace    string                `json:"runtimeNamespace"`
	PodCount            int                   `json:"podCount"`
	ServiceCount        int                   `json:"serviceCount"`
	Exposure            labExposureSummary    `json:"exposure"`
	PodPhases           []dashboardNamedCount `json:"podPhases"`
	SessionStatuses     []dashboardNamedCount `json:"sessionStatuses"`
	Images              []dashboardImageUsage `json:"images"`
}

type dashboardNamedCount struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type dashboardImageUsage struct {
	Image string `json:"image"`
	Count int    `json:"count"`
}

type dashboardIntegrationCard struct {
	Key        string         `json:"key"`
	Label      string         `json:"label"`
	Status     string         `json:"status"`
	Summary    string         `json:"summary"`
	Message    string         `json:"message"`
	LastCheck  string         `json:"lastCheck"`
	Details    map[string]any `json:"details,omitempty"`
	CanRefresh bool           `json:"canRefresh"`
}

type dashboardHighlight struct {
	ID          string `json:"id"`
	Level       string `json:"level"`
	Title       string `json:"title"`
	Description string `json:"description"`
	SessionID   uint64 `json:"sessionId,omitempty"`
}

type dashboardSessionListPayload struct {
	List     []dashboardSessionRow `json:"list"`
	Total    int                   `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"pageSize"`
}

type dashboardSessionDetailPayload struct {
	Session       dashboardSessionRow   `json:"session"`
	URLs          lab.URLs              `json:"urls"`
	Pod           *dashboardPodDetail   `json:"pod,omitempty"`
	Service       *dashboardServiceInfo `json:"service,omitempty"`
	ExposureRisks []labExposureRisk     `json:"exposureRisks"`
	Events        []dashboardEventItem  `json:"events"`
}

type dashboardPodDetail struct {
	Name       string                     `json:"name"`
	Phase      string                     `json:"phase"`
	PodIP      string                     `json:"podIp"`
	NodeName   string                     `json:"nodeName"`
	StartTime  *time.Time                 `json:"startTime,omitempty"`
	Ready      bool                       `json:"ready"`
	Conditions []dashboardConditionStatus `json:"conditions"`
}

type dashboardServiceInfo struct {
	Name      string                     `json:"name"`
	Type      string                     `json:"type"`
	ClusterIP string                     `json:"clusterIp"`
	Ports     []dashboardServicePortInfo `json:"ports"`
}

type dashboardServicePortInfo struct {
	Name       string `json:"name"`
	Port       int32  `json:"port"`
	TargetPort string `json:"targetPort"`
}

type dashboardConditionStatus struct {
	Type               string     `json:"type"`
	Status             string     `json:"status"`
	Reason             string     `json:"reason"`
	Message            string     `json:"message"`
	LastTransitionTime *time.Time `json:"lastTransitionTime,omitempty"`
}

type dashboardEventItem struct {
	Type      string     `json:"type"`
	Reason    string     `json:"reason"`
	Message   string     `json:"message"`
	Count     int32      `json:"count"`
	FirstSeen *time.Time `json:"firstSeen,omitempty"`
	LastSeen  *time.Time `json:"lastSeen,omitempty"`
}

type labExposureSummary struct {
	Status            string            `json:"status"`
	Message           string            `json:"message"`
	RuntimeNamespace  string            `json:"runtimeNamespace"`
	NetworkPolicyNote string            `json:"networkPolicyNote"`
	RiskCount         int               `json:"riskCount"`
	Risks             []labExposureRisk `json:"risks"`
}

type labExposureRisk struct {
	Level     string `json:"level"`
	Kind      string `json:"kind"`
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	SessionID uint64 `json:"sessionId,omitempty"`
	Message   string `json:"message"`
}

type dashboardLogsPayload struct {
	SessionID   uint64 `json:"sessionId"`
	PodName     string `json:"podName"`
	Container   string `json:"container"`
	Tail        int64  `json:"tail"`
	Logs        string `json:"logs"`
	GeneratedAt string `json:"generatedAt"`
}

type dashboardFilters struct {
	Status     string
	SourceType string
	TimeRange  string
	Query      string
	Page       int
	PageSize   int
}

func (h *IntegrationsHandler) DashboardOverview(c *gin.Context) {
	payload, err := h.buildDashboardOverview(c.Request.Context())
	if err != nil {
		response.ErrorKeyWithDetail(c, http.StatusServiceUnavailable, "DASHBOARD_OVERVIEW_FAILED", "dashboard.overviewFailed", nil, err)
		return
	}
	response.SuccessKey(c, payload, "dashboard.overviewLoaded", nil)
}

func (h *IntegrationsHandler) DashboardSessions(c *gin.Context) {
	filters := parseDashboardFilters(c)
	payload, err := h.buildDashboardSessions(c.Request.Context(), filters)
	if err != nil {
		response.ErrorKeyWithDetail(c, http.StatusServiceUnavailable, "DASHBOARD_SESSIONS_FAILED", "dashboard.sessionsFailed", nil, err)
		return
	}
	response.SuccessKey(c, payload, "dashboard.sessionsLoaded", nil)
}

func (h *IntegrationsHandler) RuntimeSessions(c *gin.Context) {
	h.DashboardSessions(c)
}

func (h *IntegrationsHandler) DashboardSessionDetail(c *gin.Context) {
	sessionID, err := strconv.ParseUint(strings.TrimSpace(c.Param("sessionId")), 10, 64)
	if err != nil || sessionID == 0 {
		response.BadRequestKey(c, "dashboard.invalidSessionId", nil)
		return
	}

	payload, err := h.buildDashboardSessionDetail(c.Request.Context(), sessionID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFoundKey(c, "dashboard.sessionNotFound", nil)
			return
		}
		response.ErrorKeyWithDetail(c, http.StatusServiceUnavailable, "DASHBOARD_SESSION_DETAIL_FAILED", "dashboard.detailFailed", nil, err)
		return
	}
	response.SuccessKey(c, payload, "dashboard.detailLoaded", nil)
}

func (h *IntegrationsHandler) RuntimeSessionDetail(c *gin.Context) {
	h.DashboardSessionDetail(c)
}

func (h *IntegrationsHandler) DashboardSessionLogs(c *gin.Context) {
	sessionID, err := strconv.ParseUint(strings.TrimSpace(c.Param("sessionId")), 10, 64)
	if err != nil || sessionID == 0 {
		response.BadRequestKey(c, "dashboard.invalidSessionId", nil)
		return
	}

	tail := int64(200)
	if raw := strings.TrimSpace(c.Query("tail")); raw != "" {
		if parsed, parseErr := strconv.ParseInt(raw, 10, 64); parseErr == nil && parsed > 0 && parsed <= 2000 {
			tail = parsed
		}
	}

	payload, err := h.buildDashboardSessionLogs(c.Request.Context(), sessionID, tail)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			response.NotFoundKey(c, "dashboard.sessionNotFound", nil)
			return
		}
		status := http.StatusServiceUnavailable
		code := "DASHBOARD_SESSION_LOGS_FAILED"
		if apierrors.IsNotFound(err) || errors.Is(err, errDashboardLogPodMissing) {
			status = http.StatusNotFound
		} else if errors.Is(err, errDashboardSessionStopped) {
			status = http.StatusBadRequest
		}
		// 透传具体原因（会话已停止 / Pod 已不存在等），response.Error 按语言翻译，保留可操作信息。
		response.Error(c, status, err.Error(), code)
		return
	}

	response.SuccessKey(c, payload, "dashboard.logsLoaded", nil)
}

func (h *IntegrationsHandler) RuntimeSessionLogs(c *gin.Context) {
	h.DashboardSessionLogs(c)
}

func (h *IntegrationsHandler) RuntimeSessionEvents(c *gin.Context) {
	sessionID, err := strconv.ParseUint(strings.TrimSpace(c.Param("sessionId")), 10, 64)
	if err != nil || sessionID == 0 {
		response.BadRequestKey(c, "dashboard.invalidSessionId", nil)
		return
	}
	if h.operations == nil {
		response.ErrorKey(c, http.StatusServiceUnavailable, "OPERATIONS_SERVICE_UNAVAILABLE", "dashboard.eventsUnavailable", nil)
		return
	}
	events, err := h.operations.ListRuntimeEvents(c.Request.Context(), sessionID)
	if err != nil {
		response.ErrorKeyWithDetail(c, http.StatusInternalServerError, "DASHBOARD_EVENTS_FAILED", "dashboard.eventsFailed", nil, err)
		return
	}
	response.SuccessKey(c, events, "dashboard.eventsLoaded", nil)
}

func (h *IntegrationsHandler) DashboardStopSession(c *gin.Context) {
	sessionID, err := strconv.ParseUint(strings.TrimSpace(c.Param("sessionId")), 10, 64)
	if err != nil || sessionID == 0 {
		response.BadRequestKey(c, "dashboard.invalidSessionId", nil)
		return
	}
	if h.labService == nil {
		response.ErrorKey(c, http.StatusServiceUnavailable, "LAB_SERVICE_UNAVAILABLE", "dashboard.labUnavailable", nil)
		return
	}
	claims, _ := middleware.CurrentClaims(c)
	actorID := uint64(0)
	if claims != nil {
		actorID = claims.UserID
	}
	result, err := h.labService.AdminStopSession(c.Request.Context(), actorID, sessionID)
	if err != nil {
		response.ErrorKeyWithDetail(c, http.StatusBadRequest, "DASHBOARD_STOP_SESSION_FAILED", "dashboard.stopFailed", nil, err)
		return
	}
	response.SuccessKey(c, result, "dashboard.stopHandled", nil)
}

func (h *IntegrationsHandler) RuntimeStopSession(c *gin.Context) {
	h.DashboardStopSession(c)
}

func (h *IntegrationsHandler) IntegratedHealth(c *gin.Context) {
	response.SuccessKey(c, h.buildIntegrationCards(c.Request.Context()), "dashboard.integrationsLoaded", nil)
}

func (h *IntegrationsHandler) buildDashboardOverview(ctx context.Context) (dashboardOverviewPayload, error) {
	sessions, _, err := h.loadDashboardSessions(ctx)
	if err != nil {
		return dashboardOverviewPayload{}, err
	}

	kpis := dashboardKPIs{}
	now := time.Now()
	statuses := map[string]int{}
	recentSessions := make([]dashboardSessionRow, 0, minInt(len(sessions), 6))

	for _, session := range sessions {
		statuses[session.StatusText]++
		switch session.Status {
		case lab.SessionStatusRunning:
			kpis.ActiveSessions++
		case lab.SessionStatusCreating:
			kpis.CreatingSessions++
		case lab.SessionStatusError:
			kpis.ErrorSessions++
		}
		if session.CreatedAt.After(now.Add(-24 * time.Hour)) {
			kpis.Recent24h++
		}
		if session.ExpiresAt != nil && session.ExpiresAt.Before(now) && (session.Status == lab.SessionStatusRunning || session.Status == lab.SessionStatusCreating) {
			kpis.ExpiredPending++
		}
		if len(recentSessions) < 6 {
			recentSessions = append(recentSessions, session)
		}
	}

	pods, services, runtimeSummary, highlights, err := h.buildRuntimeSummary(ctx, sessions)
	if err != nil {
		return dashboardOverviewPayload{}, err
	}
	runtimeSummary.SessionStatuses = namedCountsFromMap(statuses)

	integrations := h.buildIntegrationCards(ctx)
	highlights = append(highlights, integrationHighlights(ctx, integrations)...)
	highlights = sortHighlights(highlights)

	_ = pods
	_ = services

	return dashboardOverviewPayload{
		KPIs:           kpis,
		Runtime:        runtimeSummary,
		Integrations:   integrations,
		Highlights:     highlights,
		RecentSessions: recentSessions,
	}, nil
}

func (h *IntegrationsHandler) buildDashboardSessions(ctx context.Context, filters dashboardFilters) (dashboardSessionListPayload, error) {
	sessions, _, err := h.loadDashboardSessions(ctx)
	if err != nil {
		return dashboardSessionListPayload{}, err
	}

	filtered := make([]dashboardSessionRow, 0, len(sessions))
	query := strings.ToLower(strings.TrimSpace(filters.Query))
	timeCutoff := dashboardTimeRangeCutoff(filters.TimeRange)
	for _, session := range sessions {
		if filters.Status != "" && filters.Status != "all" && session.StatusText != filters.Status {
			continue
		}
		if filters.SourceType != "" && filters.SourceType != "all" && session.SourceText != filters.SourceType {
			continue
		}
		if !timeCutoff.IsZero() && session.UpdatedAt.Before(timeCutoff) {
			continue
		}
		if query != "" {
			haystack := strings.ToLower(strings.Join([]string{
				session.ContainerName,
				session.ImageName,
				session.UserName,
				session.FullName,
				session.SourceName,
				strconv.FormatUint(session.ID, 10),
			}, " "))
			if !strings.Contains(haystack, query) {
				continue
			}
		}
		filtered = append(filtered, session)
	}

	total := len(filtered)
	start := (filters.Page - 1) * filters.PageSize
	if start > total {
		start = total
	}
	end := start + filters.PageSize
	if end > total {
		end = total
	}

	return dashboardSessionListPayload{
		List:     filtered[start:end],
		Total:    total,
		Page:     filters.Page,
		PageSize: filters.PageSize,
	}, nil
}

func (h *IntegrationsHandler) buildDashboardSessionDetail(ctx context.Context, sessionID uint64) (dashboardSessionDetailPayload, error) {
	sessions, sessionMap, err := h.loadDashboardSessions(ctx)
	if err != nil {
		return dashboardSessionDetailPayload{}, err
	}
	_ = sessions

	session, ok := sessionMap[sessionID]
	if !ok {
		return dashboardSessionDetailPayload{}, gorm.ErrRecordNotFound
	}

	payload := dashboardSessionDetailPayload{
		Session: session,
		URLs:    h.urlsForSession(&session.UserLabSession),
		Events:  []dashboardEventItem{},
	}

	if h.deps.K8S == nil {
		return payload, nil
	}

	ns := runtimeNamespace(h.deps)
	pod, err := h.deps.K8S.CoreV1().Pods(ns).Get(ctx, session.ContainerName, metav1.GetOptions{})
	if err == nil {
		payload.Pod = podToDashboardDetail(pod)
		events, evtErr := h.loadPodEvents(ctx, pod.Name)
		if evtErr == nil {
			payload.Events = events
		}
	} else if !apierrors.IsNotFound(err) {
		return dashboardSessionDetailPayload{}, err
	}

	svc, err := h.deps.K8S.CoreV1().Services(ns).Get(ctx, lab.ServiceName(session.ID), metav1.GetOptions{})
	if err == nil {
		payload.Service = serviceToDashboardInfo(svc)
	} else if !apierrors.IsNotFound(err) {
		return dashboardSessionDetailPayload{}, err
	}

	pods := []corev1.Pod{}
	services := []corev1.Service{}
	if payload.Pod != nil && pod != nil {
		pods = append(pods, *pod)
	}
	if payload.Service != nil && svc != nil {
		services = append(services, *svc)
	}
	payload.ExposureRisks = buildLabExposureSummary(ctx, ns, pods, services, nil).Risks

	return payload, nil
}

func (h *IntegrationsHandler) buildDashboardSessionLogs(ctx context.Context, sessionID uint64, tail int64) (dashboardLogsPayload, error) {
	if h.deps.K8S == nil {
		return dashboardLogsPayload{}, errors.New("K8S client 未启用")
	}

	session, err := h.labService.GetSession(ctx, sessionID)
	if err != nil {
		return dashboardLogsPayload{}, err
	}
	if session == nil {
		return dashboardLogsPayload{}, gorm.ErrRecordNotFound
	}
	if session.Status == lab.SessionStatusStopped {
		return dashboardLogsPayload{}, errDashboardSessionStopped
	}
	pod, err := h.deps.K8S.CoreV1().Pods(runtimeNamespace(h.deps)).Get(ctx, session.ContainerName, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return dashboardLogsPayload{}, errDashboardLogPodMissing
		}
		return dashboardLogsPayload{}, err
	}
	if pod.Status.Phase != corev1.PodRunning {
		return dashboardLogsPayload{}, fmt.Errorf("Pod 尚未运行，当前状态 %s", pod.Status.Phase)
	}

	req := h.deps.K8S.CoreV1().Pods(runtimeNamespace(h.deps)).GetLogs(session.ContainerName, &corev1.PodLogOptions{
		Container: lab.MainContainerName,
		TailLines: &tail,
	})
	stream, err := req.Stream(ctx)
	if err != nil {
		return dashboardLogsPayload{}, err
	}
	defer stream.Close()

	data, err := io.ReadAll(io.LimitReader(stream, 256*1024))
	if err != nil {
		return dashboardLogsPayload{}, err
	}

	return dashboardLogsPayload{
		SessionID:   sessionID,
		PodName:     session.ContainerName,
		Container:   lab.MainContainerName,
		Tail:        tail,
		Logs:        string(data),
		GeneratedAt: time.Now().Format(time.RFC3339),
	}, nil
}

func (h *IntegrationsHandler) loadDashboardSessions(ctx context.Context) ([]dashboardSessionRow, map[uint64]dashboardSessionRow, error) {
	if h.deps.DB == nil {
		return nil, nil, errors.New("database 未初始化")
	}
	if h.labService == nil {
		return nil, nil, errors.New("lab service 未初始化")
	}

	var sessions []lab.UserLabSession
	if err := h.deps.DB.WithContext(ctx).Order("created_at DESC").Find(&sessions).Error; err != nil {
		return nil, nil, err
	}

	for idx := range sessions {
		session := &sessions[idx]
		if session.Status == lab.SessionStatusRunning || session.Status == lab.SessionStatusCreating {
			_ = h.labService.SyncSessionStatus(ctx, session)
		}
	}

	userIDs := make([]uint64, 0, len(sessions))
	courseIDs := make([]uint64, 0, len(sessions))
	projectIDs := make([]uint64, 0, len(sessions))
	for _, session := range sessions {
		userIDs = append(userIDs, session.UserID)
		switch session.SourceType {
		case lab.SourceTypeCourse:
			courseIDs = append(courseIDs, session.SourceID)
		case lab.SourceTypeProject:
			projectIDs = append(projectIDs, session.SourceID)
		}
	}

	users := make(map[uint64]user.User)
	if len(userIDs) > 0 {
		var records []user.User
		if err := h.deps.DB.WithContext(ctx).Where("id IN ?", uniqueUint64(userIDs)).Find(&records).Error; err != nil {
			return nil, nil, err
		}
		for _, record := range records {
			users[record.ID] = record
		}
	}

	coursesByID := make(map[uint64]course.Course)
	if len(courseIDs) > 0 {
		var records []course.Course
		if err := h.deps.DB.WithContext(ctx).Where("id IN ?", uniqueUint64(courseIDs)).Find(&records).Error; err != nil {
			return nil, nil, err
		}
		for _, record := range records {
			coursesByID[record.ID] = record
		}
	}

	projectsByID := make(map[uint64]project.Project)
	if len(projectIDs) > 0 {
		var records []project.Project
		if err := h.deps.DB.WithContext(ctx).Where("id IN ?", uniqueUint64(projectIDs)).Find(&records).Error; err != nil {
			return nil, nil, err
		}
		for _, record := range records {
			projectsByID[record.ID] = record
		}
	}

	rows := make([]dashboardSessionRow, 0, len(sessions))
	rowMap := make(map[uint64]dashboardSessionRow, len(sessions))
	for _, session := range sessions {
		record := dashboardSessionRow{
			UserLabSession: session,
			StatusText:     dashboardSessionStatusText(session.Status),
			SourceText:     dashboardSourceTypeText(session.SourceType),
		}
		if owner, ok := users[session.UserID]; ok {
			record.UserName = owner.Username
			record.FullName = owner.FullName
		}
		switch session.SourceType {
		case lab.SourceTypeCourse:
			if source, ok := coursesByID[session.SourceID]; ok {
				record.SourceName = source.Title
			}
		case lab.SourceTypeProject:
			if source, ok := projectsByID[session.SourceID]; ok {
				record.SourceName = source.Title
			}
		}
		if record.SourceName == "" {
			record.SourceName = fmt.Sprintf("%s #%d", record.SourceText, session.SourceID)
		}
		rows = append(rows, record)
		rowMap[record.ID] = record
	}

	return rows, rowMap, nil
}

func (h *IntegrationsHandler) buildRuntimeSummary(ctx context.Context, sessions []dashboardSessionRow) ([]corev1.Pod, []corev1.Service, dashboardRuntimeSummary, []dashboardHighlight, error) {
	summary := dashboardRuntimeSummary{
		ConfiguredNamespace: h.deps.Config.K8S.Namespace,
		RuntimeNamespace:    runtimeNamespace(h.deps),
		PodPhases:           []dashboardNamedCount{},
		SessionStatuses:     []dashboardNamedCount{},
		Images:              []dashboardImageUsage{},
	}
	if h.deps.K8S == nil {
		return nil, nil, summary, []dashboardHighlight{{
			ID:          "k8s-disabled",
			Level:       "warning",
			Title:       i18n.Message(ctx, "dashboard.k8sDisabledTitle", nil),
			Description: i18n.Message(ctx, "dashboard.k8sDisabledDescription", nil),
		}}, nil
	}

	pods, err := h.deps.K8S.CoreV1().Pods(summary.RuntimeNamespace).List(ctx, metav1.ListOptions{LabelSelector: dashboardLabelSelector})
	if err != nil {
		return nil, nil, summary, nil, err
	}
	services, err := h.deps.K8S.CoreV1().Services(summary.RuntimeNamespace).List(ctx, metav1.ListOptions{LabelSelector: dashboardLabelSelector})
	if err != nil {
		return nil, nil, summary, nil, err
	}
	ingresses, ingressErr := h.deps.K8S.NetworkingV1().Ingresses(summary.RuntimeNamespace).List(ctx, metav1.ListOptions{})
	if ingressErr == nil {
		summary.Exposure = buildLabExposureSummary(ctx, summary.RuntimeNamespace, pods.Items, services.Items, ingresses.Items)
	} else {
		summary.Exposure = newLabExposureSummary(ctx, summary.RuntimeNamespace)
		summary.Exposure.Status = "warning"
		summary.Exposure.Message = i18n.Message(ctx, "dashboard.ingressScanFailed", nil)
	}

	summary.PodCount = len(pods.Items)
	summary.ServiceCount = len(services.Items)

	podPhases := map[string]int{}
	imageUse := map[string]int{}
	highlights := make([]dashboardHighlight, 0)
	podBySession := make(map[uint64]corev1.Pod, len(pods.Items))
	serviceBySession := make(map[uint64]corev1.Service, len(services.Items))

	for _, pod := range pods.Items {
		phase := strings.ToLower(string(pod.Status.Phase))
		if phase == "" {
			phase = "unknown"
		}
		podPhases[phase]++
		for _, container := range pod.Spec.Containers {
			if strings.TrimSpace(container.Image) != "" {
				imageUse[container.Image]++
			}
		}
		podBySession[parseSessionIDLabelValue(pod.Labels["edu/session-id"])] = pod
	}
	for _, service := range services.Items {
		serviceBySession[parseSessionIDLabelValue(service.Labels["edu/session-id"])] = service
	}

	for _, session := range sessions {
		if session.Status != lab.SessionStatusRunning && session.Status != lab.SessionStatusCreating {
			continue
		}
		pod, podExists := podBySession[session.ID]
		_, serviceExists := serviceBySession[session.ID]
		if !podExists {
			highlights = append(highlights, dashboardHighlight{
				ID:          fmt.Sprintf("missing-pod-%d", session.ID),
				Level:       "warning",
				Title:       i18n.Message(ctx, "dashboard.missingPodTitle", nil),
				Description: i18n.Message(ctx, "dashboard.missingPodDescription", i18n.Params{"id": session.ID}),
				SessionID:   session.ID,
			})
			continue
		}
		if !podReady(&pod) {
			highlights = append(highlights, dashboardHighlight{
				ID:          fmt.Sprintf("pod-not-ready-%d", session.ID),
				Level:       "warning",
				Title:       i18n.Message(ctx, "dashboard.podNotReadyTitle", nil),
				Description: i18n.Message(ctx, "dashboard.podNotReadyDescription", i18n.Params{"name": pod.Name, "status": pod.Status.Phase}),
				SessionID:   session.ID,
			})
		}
		if !serviceExists {
			highlights = append(highlights, dashboardHighlight{
				ID:          fmt.Sprintf("missing-service-%d", session.ID),
				Level:       "warning",
				Title:       i18n.Message(ctx, "dashboard.missingServiceTitle", nil),
				Description: i18n.Message(ctx, "dashboard.missingServiceDescription", i18n.Params{"id": session.ID}),
				SessionID:   session.ID,
			})
		}
		if session.ExpiresAt != nil && session.ExpiresAt.Before(time.Now()) {
			highlights = append(highlights, dashboardHighlight{
				ID:          fmt.Sprintf("expired-session-%d", session.ID),
				Level:       "danger",
				Title:       i18n.Message(ctx, "dashboard.expiredTitle", nil),
				Description: i18n.Message(ctx, "dashboard.expiredDescription", i18n.Params{"id": session.ID, "status": session.StatusText}),
				SessionID:   session.ID,
			})
		}
	}
	for _, risk := range summary.Exposure.Risks {
		highlights = append(highlights, dashboardHighlight{
			ID:          fmt.Sprintf("lab-exposure-%s-%s", strings.ToLower(risk.Kind), strings.ReplaceAll(risk.Name, "/", "-")),
			Level:       risk.Level,
			Title:       i18n.Message(ctx, "dashboard.exposureRiskTitle", nil),
			Description: risk.Message,
			SessionID:   risk.SessionID,
		})
	}

	summary.PodPhases = namedCountsFromMap(podPhases)
	summary.Images = topImages(imageUse, 5)

	return pods.Items, services.Items, summary, highlights, nil
}

func (h *IntegrationsHandler) buildIntegrationCards(ctx context.Context) []dashboardIntegrationCard {
	now := time.Now().Format(time.RFC3339)
	cards := []dashboardIntegrationCard{}

	k8sStatus := dashboardIntegrationCard{
		Key:        "k8s",
		Label:      "K8S",
		Status:     "success",
		Summary:    i18n.Message(ctx, "dashboard.runtimeReachable", nil),
		Message:    i18n.Message(ctx, "dashboard.clusterHealthy", nil),
		LastCheck:  now,
		CanRefresh: true,
		Details: map[string]any{
			"namespace":        h.deps.Config.K8S.Namespace,
			"runtimeNamespace": runtimeNamespace(h.deps),
		},
	}
	if h.deps.K8S == nil {
		k8sStatus.Status = "warning"
		k8sStatus.Summary = i18n.Message(ctx, "dashboard.notEnabled", nil)
		k8sStatus.Message = i18n.Message(ctx, "dashboard.k8sNotInitialized", nil)
	} else if version, err := h.deps.K8S.Discovery().ServerVersion(); err == nil {
		k8sStatus.Details["gitVersion"] = version.GitVersion
	} else {
		k8sStatus.Status = "warning"
		k8sStatus.Summary = i18n.Message(ctx, "dashboard.connectionError", nil)
		k8sStatus.Message = i18n.Message(ctx, "dashboard.k8sProbeFailed", nil)
	}
	cards = append(cards, k8sStatus)

	configCard := dashboardIntegrationCard{
		Key:        "config",
		Label:      "Config",
		Status:     "success",
		Summary:    i18n.Message(ctx, "dashboard.configLoaded", nil),
		Message:    i18n.Message(ctx, "dashboard.configReadable", nil),
		LastCheck:  now,
		CanRefresh: true,
		Details: map[string]any{
			"kubeconfig": h.deps.Config.K8S.ResolvedKubeconfig(),
		},
	}
	cards = append(cards, configCard)

	return cards
}

func (h *IntegrationsHandler) loadPodEvents(ctx context.Context, podName string) ([]dashboardEventItem, error) {
	if h.deps.K8S == nil {
		return nil, nil
	}
	events, err := h.deps.K8S.CoreV1().Events(runtimeNamespace(h.deps)).List(ctx, metav1.ListOptions{
		FieldSelector: fmt.Sprintf("involvedObject.name=%s", podName),
	})
	if err != nil {
		return nil, err
	}
	items := make([]dashboardEventItem, 0, len(events.Items))
	for _, event := range events.Items {
		firstSeen := event.FirstTimestamp.Time
		lastSeen := event.LastTimestamp.Time
		if firstSeen.IsZero() {
			firstSeen = event.EventTime.Time
		}
		if lastSeen.IsZero() {
			lastSeen = event.EventTime.Time
		}
		items = append(items, dashboardEventItem{
			Type:      event.Type,
			Reason:    event.Reason,
			Message:   event.Message,
			Count:     event.Count,
			FirstSeen: zeroTimePtr(firstSeen),
			LastSeen:  zeroTimePtr(lastSeen),
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return timeOrZero(items[i].LastSeen).After(timeOrZero(items[j].LastSeen))
	})
	if len(items) > 12 {
		items = items[:12]
	}
	return items, nil
}

func integrationHighlights(ctx context.Context, cards []dashboardIntegrationCard) []dashboardHighlight {
	items := make([]dashboardHighlight, 0)
	for _, card := range cards {
		if card.Status == "success" {
			continue
		}
		level := "warning"
		if card.Status == "danger" {
			level = "danger"
		}
		items = append(items, dashboardHighlight{
			ID:          "integration-" + card.Key,
			Level:       level,
			Title:       i18n.Message(ctx, "dashboard.integrationNeedsAttention", i18n.Params{"name": card.Label}),
			Description: card.Message,
		})
	}
	return items
}

func (h *IntegrationsHandler) inspectLabExposure(ctx context.Context) (labExposureSummary, error) {
	ns := runtimeNamespace(h.deps)
	summary := newLabExposureSummary(ctx, ns)
	if h.deps.K8S == nil {
		summary.Status = "warning"
		summary.Message = i18n.Message(ctx, "dashboard.exposureUnavailable", nil)
		return summary, nil
	}

	pods, err := h.deps.K8S.CoreV1().Pods(ns).List(ctx, metav1.ListOptions{LabelSelector: dashboardLabelSelector})
	if err != nil {
		return summary, err
	}
	services, err := h.deps.K8S.CoreV1().Services(ns).List(ctx, metav1.ListOptions{LabelSelector: dashboardLabelSelector})
	if err != nil {
		return summary, err
	}
	ingresses, err := h.deps.K8S.NetworkingV1().Ingresses(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		return summary, err
	}
	return buildLabExposureSummary(ctx, ns, pods.Items, services.Items, ingresses.Items), nil
}

func newLabExposureSummary(ctx context.Context, namespace string) labExposureSummary {
	return labExposureSummary{
		Status:            "success",
		Message:           i18n.Message(ctx, "dashboard.noPublicExposure", nil),
		RuntimeNamespace:  namespace,
		NetworkPolicyNote: i18n.Message(ctx, "dashboard.networkPolicyNote", nil),
		Risks:             []labExposureRisk{},
	}
}

func buildLabExposureSummary(ctx context.Context, namespace string, pods []corev1.Pod, services []corev1.Service, ingresses []networkingv1.Ingress) labExposureSummary {
	summary := newLabExposureSummary(ctx, namespace)
	for _, service := range services {
		sessionID := parseSessionIDLabelValue(service.Labels["edu/session-id"])
		if service.Spec.Type != "" && service.Spec.Type != corev1.ServiceTypeClusterIP {
			summary.Risks = append(summary.Risks, labExposureRisk{
				Level:     "danger",
				Kind:      "Service",
				Namespace: service.Namespace,
				Name:      service.Name,
				SessionID: sessionID,
				Message:   i18n.Message(ctx, "dashboard.serviceTypeRisk", i18n.Params{"name": service.Name, "type": service.Spec.Type}),
			})
		}
		if len(service.Spec.ExternalIPs) > 0 {
			summary.Risks = append(summary.Risks, labExposureRisk{
				Level:     "danger",
				Kind:      "Service",
				Namespace: service.Namespace,
				Name:      service.Name,
				SessionID: sessionID,
				Message:   i18n.Message(ctx, "dashboard.externalIPRisk", i18n.Params{"name": service.Name, "ips": strings.Join(service.Spec.ExternalIPs, ",")}),
			})
		}
		for _, port := range service.Spec.Ports {
			if port.NodePort > 0 {
				summary.Risks = append(summary.Risks, labExposureRisk{
					Level:     "danger",
					Kind:      "Service",
					Namespace: service.Namespace,
					Name:      service.Name,
					SessionID: sessionID,
					Message:   i18n.Message(ctx, "dashboard.nodePortRisk", i18n.Params{"name": service.Name, "port": firstNonEmpty(port.Name, strconv.Itoa(int(port.Port))), "nodePort": port.NodePort}),
				})
			}
		}
	}
	for _, pod := range pods {
		sessionID := parseSessionIDLabelValue(pod.Labels["edu/session-id"])
		if pod.Spec.HostNetwork {
			summary.Risks = append(summary.Risks, labExposureRisk{
				Level:     "danger",
				Kind:      "Pod",
				Namespace: pod.Namespace,
				Name:      pod.Name,
				SessionID: sessionID,
				Message:   i18n.Message(ctx, "dashboard.hostNetworkRisk", i18n.Params{"name": pod.Name}),
			})
		}
		for _, container := range append(append([]corev1.Container{}, pod.Spec.InitContainers...), pod.Spec.Containers...) {
			for _, port := range container.Ports {
				if port.HostPort > 0 {
					summary.Risks = append(summary.Risks, labExposureRisk{
						Level:     "danger",
						Kind:      "Pod",
						Namespace: pod.Namespace,
						Name:      pod.Name,
						SessionID: sessionID,
						Message:   i18n.Message(ctx, "dashboard.hostPortRisk", i18n.Params{"pod": pod.Name, "container": container.Name, "port": port.HostPort}),
					})
				}
			}
		}
	}
	for _, ingress := range ingresses {
		summary.Risks = append(summary.Risks, labExposureRisk{
			Level:     "danger",
			Kind:      "Ingress",
			Namespace: ingress.Namespace,
			Name:      ingress.Name,
			SessionID: parseSessionIDLabelValue(ingress.Labels["edu/session-id"]),
			Message:   i18n.Message(ctx, "dashboard.ingressRisk", i18n.Params{"name": ingress.Name}),
		})
	}
	summary.RiskCount = len(summary.Risks)
	if summary.RiskCount > 0 {
		summary.Status = "danger"
		summary.Message = i18n.Message(ctx, "dashboard.exposureRisksFound", i18n.Params{"count": summary.RiskCount})
	}
	return summary
}

func parseDashboardFilters(c *gin.Context) dashboardFilters {
	page := 1
	if raw := strings.TrimSpace(c.Query("page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			page = parsed
		}
	}
	pageSize := 12
	if raw := strings.TrimSpace(c.Query("pageSize")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			pageSize = parsed
		}
	}
	return dashboardFilters{
		Status:     strings.ToLower(strings.TrimSpace(c.Query("status"))),
		SourceType: strings.ToLower(strings.TrimSpace(c.Query("sourceType"))),
		TimeRange:  strings.ToLower(strings.TrimSpace(c.Query("timeRange"))),
		Query:      strings.TrimSpace(c.Query("q")),
		Page:       page,
		PageSize:   pageSize,
	}
}

func dashboardTimeRangeCutoff(value string) time.Time {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "24h":
		return time.Now().Add(-24 * time.Hour)
	case "7d":
		return time.Now().Add(-7 * 24 * time.Hour)
	case "30d":
		return time.Now().Add(-30 * 24 * time.Hour)
	default:
		return time.Time{}
	}
}

func runtimeNamespace(deps app.Dependencies) string {
	if deps.Config != nil && strings.TrimSpace(deps.Config.K8S.RuntimeNamespace) != "" {
		return deps.Config.K8S.RuntimeNamespace
	}
	if deps.Config != nil && strings.TrimSpace(deps.Config.K8S.Namespace) != "" {
		return deps.Config.K8S.Namespace
	}
	return "edu-runtime-dev"
}

func (h *IntegrationsHandler) urlsForSession(session *lab.UserLabSession) lab.URLs {
	if h.labService == nil || session == nil {
		return lab.URLs{}
	}
	return h.labService.BuildURLs(session)
}

func dashboardSessionStatusText(status lab.SessionStatus) string {
	switch status {
	case lab.SessionStatusCreating:
		return "creating"
	case lab.SessionStatusRunning:
		return "running"
	case lab.SessionStatusStopped:
		return "stopped"
	case lab.SessionStatusError:
		return "error"
	case lab.SessionStatusStopping:
		return "stopping"
	default:
		return "unknown"
	}
}

func dashboardSourceTypeText(sourceType lab.SourceType) string {
	switch sourceType {
	case lab.SourceTypeCourse:
		return "course"
	case lab.SourceTypeProject:
		return "project"
	default:
		return "unknown"
	}
}

func namedCountsFromMap(items map[string]int) []dashboardNamedCount {
	out := make([]dashboardNamedCount, 0, len(items))
	for name, count := range items {
		if count <= 0 {
			continue
		}
		out = append(out, dashboardNamedCount{Name: name, Count: count})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count == out[j].Count {
			return out[i].Name < out[j].Name
		}
		return out[i].Count > out[j].Count
	})
	return out
}

func topImages(items map[string]int, limit int) []dashboardImageUsage {
	out := make([]dashboardImageUsage, 0, len(items))
	for image, count := range items {
		out = append(out, dashboardImageUsage{Image: image, Count: count})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Count == out[j].Count {
			return out[i].Image < out[j].Image
		}
		return out[i].Count > out[j].Count
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

func podToDashboardDetail(pod *corev1.Pod) *dashboardPodDetail {
	if pod == nil {
		return nil
	}
	var startTime *time.Time
	if pod.Status.StartTime != nil {
		start := pod.Status.StartTime.Time
		startTime = zeroTimePtr(start)
	}
	conditions := make([]dashboardConditionStatus, 0, len(pod.Status.Conditions))
	for _, condition := range pod.Status.Conditions {
		transitionTime := condition.LastTransitionTime.Time
		conditions = append(conditions, dashboardConditionStatus{
			Type:               string(condition.Type),
			Status:             string(condition.Status),
			Reason:             condition.Reason,
			Message:            condition.Message,
			LastTransitionTime: zeroTimePtr(transitionTime),
		})
	}
	return &dashboardPodDetail{
		Name:       pod.Name,
		Phase:      string(pod.Status.Phase),
		PodIP:      pod.Status.PodIP,
		NodeName:   pod.Spec.NodeName,
		StartTime:  startTime,
		Ready:      podReady(pod),
		Conditions: conditions,
	}
}

func serviceToDashboardInfo(service *corev1.Service) *dashboardServiceInfo {
	if service == nil {
		return nil
	}
	ports := make([]dashboardServicePortInfo, 0, len(service.Spec.Ports))
	for _, port := range service.Spec.Ports {
		ports = append(ports, dashboardServicePortInfo{
			Name:       port.Name,
			Port:       port.Port,
			TargetPort: port.TargetPort.String(),
		})
	}
	return &dashboardServiceInfo{
		Name:      service.Name,
		Type:      string(service.Spec.Type),
		ClusterIP: service.Spec.ClusterIP,
		Ports:     ports,
	}
}

func podReady(pod *corev1.Pod) bool {
	if pod == nil {
		return false
	}
	for _, condition := range pod.Status.Conditions {
		if condition.Type == corev1.PodReady && condition.Status == corev1.ConditionTrue {
			return true
		}
	}
	return false
}

func zeroTimePtr(value time.Time) *time.Time {
	if value.IsZero() {
		return nil
	}
	return &value
}

func timeOrZero(value *time.Time) time.Time {
	if value == nil {
		return time.Time{}
	}
	return *value
}

func uniqueUint64(values []uint64) []uint64 {
	if len(values) == 0 {
		return nil
	}
	set := make(map[uint64]struct{}, len(values))
	out := make([]uint64, 0, len(values))
	for _, value := range values {
		if value == 0 {
			continue
		}
		if _, exists := set[value]; exists {
			continue
		}
		set[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func parseSessionIDLabelValue(value string) uint64 {
	sessionID, _ := strconv.ParseUint(strings.TrimSpace(value), 10, 64)
	return sessionID
}

func sortHighlights(items []dashboardHighlight) []dashboardHighlight {
	levelOrder := map[string]int{"danger": 0, "warning": 1, "neutral": 2}
	sort.Slice(items, func(i, j int) bool {
		left := levelOrder[items[i].Level]
		right := levelOrder[items[j].Level]
		if left == right {
			return items[i].Title < items[j].Title
		}
		return left < right
	})
	if len(items) > 8 {
		items = items[:8]
	}
	return items
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
