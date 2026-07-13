package lab

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/url"
	"strconv"
	"strings"
	"time"

	"go.uber.org/zap"
	"gorm.io/gorm"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"
	k8sexec "k8s.io/client-go/util/exec"

	"edu-platform/internal/config"
	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/operations"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/publishing"
	appredact "edu-platform/pkg/redact"
)

type Service struct {
	db         *gorm.DB
	log        *zap.Logger
	cfg        *config.Config
	k8s        kubernetes.Interface
	restConfig *rest.Config
	operations *operations.Service
}

var (
	ErrSessionInUse    = errors.New("实验环境正在另一台设备中使用")
	ErrCapacityReached = errors.New("实验环境资源已满，请稍后再试")
)

const labLeaseDuration = 2 * time.Minute

func NewService(db *gorm.DB, log *zap.Logger, cfg *config.Config, k8sClient kubernetes.Interface, restConfig *rest.Config) *Service {
	return &Service{db: db, log: log, cfg: cfg, k8s: k8sClient, restConfig: restConfig, operations: operations.NewService(db, log)}
}

func (s *Service) GetActiveSession(ctx context.Context, userID uint64) (*UserLabSession, error) {
	var session UserLabSession
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND status = ?", userID, SessionStatusRunning).
		Order("created_at DESC").
		First(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	_ = s.SyncSessionStatus(ctx, &session)
	if session.Status != SessionStatusRunning {
		return nil, nil
	}
	return &session, nil
}

func (s *Service) GetActiveSessionForClient(ctx context.Context, userID uint64, clientID string) (*UserLabSession, error) {
	session, err := s.GetActiveSession(ctx, userID)
	if err != nil || session == nil {
		return session, err
	}
	if err := s.claimSessionLease(ctx, session, clientID); err != nil {
		return nil, err
	}
	return session, nil
}

func (s *Service) RenewSessionLease(ctx context.Context, userID, sessionID uint64, clientID string) (*UserLabSession, error) {
	session, err := s.GetOwnedSession(ctx, userID, sessionID)
	if err != nil || session == nil {
		return session, err
	}
	if session.Status != SessionStatusRunning && session.Status != SessionStatusCreating {
		return nil, errors.New("实验会话不存在或已结束")
	}
	if err := s.claimSessionLease(ctx, session, clientID); err != nil {
		return nil, err
	}
	return session, nil
}

func (s *Service) claimSessionLease(ctx context.Context, session *UserLabSession, clientID string) error {
	clientID = normalizeClientID(clientID)
	if clientID == "" {
		return errors.New("缺少实验客户端标识")
	}
	now := time.Now()
	leaseUntil := now.Add(labLeaseDuration)
	result := s.db.WithContext(ctx).Model(&UserLabSession{}).
		Where("id = ? AND (client_instance_id = '' OR client_instance_id = ? OR lease_expires_at IS NULL OR lease_expires_at < ?)", session.ID, clientID, now).
		Updates(map[string]any{"client_instance_id": clientID, "lease_expires_at": leaseUntil})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		var current UserLabSession
		if err := s.db.WithContext(ctx).
			Select("id", "client_instance_id", "lease_expires_at").
			First(&current, session.ID).Error; err != nil {
			return err
		}
		// MySQL DATETIME(3) 会把同一毫秒内的并发续租写成相同值，
		// 此时 RowsAffected 为 0，但同一浏览器仍然合法持有会话。
		if sessionLeaseOwnedByClient(&current, clientID, now) {
			session.ClientInstanceID = current.ClientInstanceID
			session.LeaseExpiresAt = current.LeaseExpiresAt
			return nil
		}
		return ErrSessionInUse
	}
	session.ClientInstanceID = clientID
	session.LeaseExpiresAt = &leaseUntil
	return nil
}

func sessionLeaseOwnedByClient(session *UserLabSession, clientID string, now time.Time) bool {
	if session == nil || normalizeClientID(session.ClientInstanceID) != normalizeClientID(clientID) {
		return false
	}
	return session.LeaseExpiresAt != nil && !session.LeaseExpiresAt.Before(now)
}

func normalizeClientID(value string) string {
	value = strings.TrimSpace(value)
	if len(value) > 64 {
		value = value[:64]
	}
	return value
}

func (s *Service) GetUserSessions(ctx context.Context, userID uint64) ([]UserLabSession, error) {
	var sessions []UserLabSession
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at DESC").Find(&sessions).Error
	return sessions, err
}

func (s *Service) GetSession(ctx context.Context, sessionID uint64) (*UserLabSession, error) {
	var session UserLabSession
	err := s.db.WithContext(ctx).Where("id = ?", sessionID).First(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &session, nil
}

func (s *Service) GetOwnedSession(ctx context.Context, userID, sessionID uint64) (*UserLabSession, error) {
	var session UserLabSession
	err := s.db.WithContext(ctx).Where("id = ? AND user_id = ?", sessionID, userID).First(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &session, nil
}

func (s *Service) CreateSession(ctx context.Context, params CreateSessionParams) (*UserLabSession, error) {
	if s.k8s == nil || s.restConfig == nil {
		return nil, errors.New("K8S Lab 运行时未启用")
	}

	source, err := s.resolveSource(ctx, params.SourceType, params.SourceID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(source.EnvImage) == "" {
		return nil, errors.New("该课程/项目未配置实验环境镜像")
	}
	params.ClientID = normalizeClientID(params.ClientID)
	if params.ClientID == "" {
		return nil, errors.New("缺少实验客户端标识")
	}
	if err := s.ensureClusterCapacity(ctx); err != nil {
		return nil, err
	}
	resolvedQuota, err := s.operations.ResolveQuotaForUser(ctx, params.UserID)
	if err != nil {
		return nil, err
	}
	if source.RuntimeMode == RuntimeModeClassic && !resolvedQuota.UnlimitedConcurrent {
		activeCount, err := s.countActiveClassicSessions(ctx, params.UserID)
		if err != nil {
			return nil, err
		}
		if activeCount >= int64(resolvedQuota.MaxConcurrentSessions) {
			message := fmt.Sprintf("已达到实验环境并发上限（%d 个），请先停止已有环境后再创建", resolvedQuota.MaxConcurrentSessions)
			_ = s.recordRuntimeEvent(ctx, 0, params.UserID, operations.RuntimeEventCreateBlockedQuota, "blocked", message, 0, operations.JSONMap{
				"sourceType":             params.SourceType,
				"sourceId":               params.SourceID,
				"quotaSource":            resolvedQuota.Source,
				"maxConcurrentSessions":  resolvedQuota.MaxConcurrentSessions,
				"currentConcurrentCount": activeCount,
			})
			return nil, errors.New(message)
		}
	}

	sessionMinutes := resolvedQuota.MaxSessionMinutes
	if sessionMinutes <= 0 {
		sessionMinutes = operations.DefaultSessionMinutes
	}
	expiresAt := time.Now().Add(time.Duration(sessionMinutes) * time.Minute)
	session := &UserLabSession{
		UserID:             params.UserID,
		SourceType:         params.SourceType,
		SourceID:           params.SourceID,
		ContainerName:      provisionalPodName(params.UserID),
		ImageName:          source.EnvImage,
		VNCPort:            0,
		IDEPort:            0,
		SSHPort:            uint(SSHPort),
		Status:             SessionStatusCreating,
		ExpiresAt:          &expiresAt,
		RuntimeMode:        source.RuntimeMode,
		GatewayPort:        0,
		GatewayToken:       "",
		DesktopEnabled:     source.DesktopEnabled,
		AppPorts:           source.AppPorts,
		DefaultAppPortName: source.DefaultAppPortName,
		ClientInstanceID:   params.ClientID,
		LeaseExpiresAt:     timePointer(time.Now().Add(labLeaseDuration)),
	}
	if source.DesktopEnabled {
		if source.VNCPort == 0 {
			source.VNCPort = uint(NoVNCPort)
		}
		session.VNCPort = uint(source.VNCPort)
	}
	if source.IDEImage != "" {
		session.IDEPort = uint(IDEPort)
	}
	if source.RuntimeMode == RuntimeModeOpenClaw {
		session.GatewayPort = uint(GatewayPort)
		session.GatewayToken = generateGatewayToken()
	}

	if err := s.db.WithContext(ctx).Create(session).Error; err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "uniq_lab_active_user") || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return nil, ErrSessionInUse
		}
		return nil, err
	}
	_ = s.recordRuntimeEvent(ctx, session.ID, session.UserID, operations.RuntimeEventCreateRequested, sessionStatusText(session.Status), "实验环境创建请求已接收", 0, operations.JSONMap{
		"sourceType":            params.SourceType,
		"sourceId":              params.SourceID,
		"quotaSource":           resolvedQuota.Source,
		"maxConcurrentSessions": resolvedQuota.MaxConcurrentSessions,
		"unlimitedConcurrent":   resolvedQuota.UnlimitedConcurrent,
		"maxSessionMinutes":     sessionMinutes,
		"runtimeMode":           runtimeModeText(source.RuntimeMode),
		"expiresAt":             expiresAt,
		"appPorts":              session.AppPorts,
		"defaultAppPortName":    session.DefaultAppPortName,
	})

	session.ContainerName = PodName(session.ID)
	if err := s.db.WithContext(ctx).Model(session).Updates(map[string]any{
		"container_name": session.ContainerName,
	}).Error; err != nil {
		return nil, err
	}
	_ = s.recordRuntimeEvent(ctx, session.ID, session.UserID, operations.RuntimeEventCreated, sessionStatusText(session.Status), "实验环境记录已创建，正在创建运行时资源", 0, nil)

	if err := s.ensureRuntimeNamespace(ctx); err != nil {
		return s.markError(ctx, session, err)
	}

	if err := s.createRuntimeResources(ctx, session, source.IDEImage, source.SourceName, source.Resources); err != nil {
		return s.markError(ctx, session, err)
	}

	if err := s.waitForPodReady(ctx, session.ContainerName, 90*time.Second); err != nil {
		return s.markError(ctx, session, err)
	}

	pod, err := s.k8s.CoreV1().Pods(s.runtimeNamespace()).Get(ctx, session.ContainerName, metav1.GetOptions{})
	if err == nil {
		session.ContainerID = string(pod.UID)
	}
	session.Status = SessionStatusRunning
	session.ErrorMessage = ""
	if err := s.db.WithContext(ctx).Save(session).Error; err != nil {
		return nil, err
	}
	_ = s.recordRuntimeEvent(ctx, session.ID, session.UserID, operations.RuntimeEventReady, sessionStatusText(session.Status), "实验环境已就绪", 0, operations.JSONMap{"pod": session.ContainerName})

	return session, nil
}

func (s *Service) StopSession(ctx context.Context, userID, sessionID uint64) error {
	session, err := s.GetOwnedSession(ctx, userID, sessionID)
	if err != nil {
		return err
	}
	if session == nil {
		return errors.New("会话不存在")
	}
	if session.Status != SessionStatusRunning && session.Status != SessionStatusCreating {
		return errors.New("会话未在运行中")
	}

	_ = s.deleteRuntimeResources(ctx, session)
	session.Status = SessionStatusStopped
	session.ErrorMessage = ""
	if err := s.db.WithContext(ctx).Save(session).Error; err != nil {
		return err
	}
	_ = s.recordRuntimeEvent(ctx, session.ID, session.UserID, operations.RuntimeEventStoppedByUser, sessionStatusText(session.Status), "学生停止实验环境", userID, nil)
	return nil
}

type AdminStopResult struct {
	SessionID uint64 `json:"sessionId"`
	Stopped   bool   `json:"stopped"`
	Reason    string `json:"reason"`
}

func (s *Service) AdminStopSession(ctx context.Context, actorID uint64, sessionID uint64) (*AdminStopResult, error) {
	session, err := s.GetSession(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	if session == nil {
		_ = s.recordAudit(ctx, actorID, operations.AuditActionSessionStop, "runtime_session", sessionID, operations.AuditResultNoop, "会话不存在，无需停止", nil)
		return &AdminStopResult{SessionID: sessionID, Stopped: false, Reason: "not_found"}, nil
	}
	if session.Status != SessionStatusRunning && session.Status != SessionStatusCreating {
		_ = s.recordAudit(ctx, actorID, operations.AuditActionSessionStop, "runtime_session", sessionID, operations.AuditResultNoop, "会话已处于停止状态", operations.JSONMap{"status": sessionStatusText(session.Status)})
		return &AdminStopResult{SessionID: sessionID, Stopped: false, Reason: "already_stopped"}, nil
	}

	_ = s.deleteRuntimeResources(ctx, session)
	session.Status = SessionStatusStopped
	session.ErrorMessage = ""
	if err := s.db.WithContext(ctx).Save(session).Error; err != nil {
		_ = s.recordAudit(ctx, actorID, operations.AuditActionSessionStop, "runtime_session", sessionID, operations.AuditResultFailed, err.Error(), nil)
		return nil, err
	}
	_ = s.recordRuntimeEvent(ctx, session.ID, session.UserID, operations.RuntimeEventStoppedByAdmin, sessionStatusText(session.Status), "管理员停止实验环境", actorID, nil)
	_ = s.recordAudit(ctx, actorID, operations.AuditActionSessionStop, "runtime_session", sessionID, operations.AuditResultSuccess, "管理员停止实验环境", operations.JSONMap{"userId": session.UserID})
	return &AdminStopResult{SessionID: sessionID, Stopped: true, Reason: "stopped"}, nil
}

func (s *Service) SyncSessionStatus(ctx context.Context, session *UserLabSession) error {
	if session == nil || s.k8s == nil || session.ContainerName == "" {
		return nil
	}
	if sessionExpired(session, time.Now()) && (session.Status == SessionStatusRunning || session.Status == SessionStatusCreating) {
		return s.stopExpiredSession(ctx, session)
	}
	pod, err := s.k8s.CoreV1().Pods(s.runtimeNamespace()).Get(ctx, session.ContainerName, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		if session.Status == SessionStatusRunning || session.Status == SessionStatusCreating {
			session.Status = SessionStatusStopped
			if saveErr := s.db.WithContext(ctx).Save(session).Error; saveErr != nil {
				return saveErr
			}
			_ = s.recordRuntimeEvent(ctx, session.ID, session.UserID, operations.RuntimeEventRuntimeMissing, sessionStatusText(session.Status), "运行时 Pod 已不存在，会话已标记停止", 0, nil)
		}
		return nil
	}
	if err != nil {
		return err
	}
	if reason, exitCode, ok := terminatedMainContainer(pod); ok {
		session.Status = SessionStatusError
		if reason == "OOMKilled" || exitCode == 137 {
			session.ErrorMessage = "实验环境内存不足，已被系统停止，请关闭其他任务后重新创建环境"
		} else {
			session.ErrorMessage = fmt.Sprintf("实验环境主进程已退出（%s，Exit %d）", reason, exitCode)
		}
		if err := s.db.WithContext(ctx).Save(session).Error; err != nil {
			return err
		}
		_ = s.recordRuntimeEvent(ctx, session.ID, session.UserID, operations.RuntimeEventError, sessionStatusText(session.Status), session.ErrorMessage, 0, operations.JSONMap{"reason": reason, "exitCode": exitCode})
		return nil
	}
	if pod.Status.Phase == corev1.PodFailed || pod.Status.Phase == corev1.PodSucceeded {
		session.Status = SessionStatusStopped
		if err := s.db.WithContext(ctx).Save(session).Error; err != nil {
			return err
		}
		_ = s.recordRuntimeEvent(ctx, session.ID, session.UserID, operations.RuntimeEventRuntimePhaseStopped, sessionStatusText(session.Status), "运行时 Pod 已结束，会话已标记停止", 0, operations.JSONMap{"phase": string(pod.Status.Phase)})
		return nil
	}
	if pod.Status.Phase == corev1.PodRunning && session.Status == SessionStatusCreating {
		session.Status = SessionStatusRunning
		session.ContainerID = string(pod.UID)
		if err := s.db.WithContext(ctx).Save(session).Error; err != nil {
			return err
		}
		_ = s.recordRuntimeEvent(ctx, session.ID, session.UserID, operations.RuntimeEventReady, sessionStatusText(session.Status), "实验环境已同步为运行中", 0, operations.JSONMap{"pod": session.ContainerName})
		return nil
	}
	return nil
}

func terminatedMainContainer(pod *corev1.Pod) (string, int32, bool) {
	if pod == nil {
		return "", 0, false
	}
	for _, status := range pod.Status.ContainerStatuses {
		if status.Name != MainContainerName || status.State.Terminated == nil {
			continue
		}
		terminated := status.State.Terminated
		return terminated.Reason, terminated.ExitCode, true
	}
	return "", 0, false
}

func (s *Service) ensureClusterCapacity(ctx context.Context) error {
	if s == nil || s.k8s == nil || s.cfg == nil || s.cfg.K8S.MaxActiveLabs <= 0 {
		return nil
	}
	pods, err := s.k8s.CoreV1().Pods(metav1.NamespaceAll).List(ctx, metav1.ListOptions{
		LabelSelector: "app.kubernetes.io/name=edu-lab,app.kubernetes.io/managed-by=edu-backend-go",
	})
	if err != nil {
		s.log.Warn("查询集群 Lab 容量失败，跳过容量门禁", zap.Error(err))
		return nil
	}
	active := 0
	for _, pod := range pods.Items {
		if pod.Status.Phase == corev1.PodPending || pod.Status.Phase == corev1.PodRunning {
			if _, _, terminated := terminatedMainContainer(&pod); !terminated {
				active++
			}
		}
	}
	if active >= s.cfg.K8S.MaxActiveLabs {
		return ErrCapacityReached
	}
	return nil
}

func (s *Service) BuildURLs(session *UserLabSession) URLs {
	runtimeMode := "classic"
	if session.RuntimeMode == RuntimeModeOpenClaw {
		runtimeMode = "openclaw"
	}

	vncURL := ""
	if session.VNCPort > 0 {
		vncURL = fmt.Sprintf("/api/lab/proxy/%d/%s/vnc.html?resize=remote&autoconnect=true&path=%s",
			session.ID,
			PortNameNoVNC,
			url.QueryEscape(fmt.Sprintf("/api/lab/proxy/%d/%s/websockify", session.ID, PortNameNoVNC)),
		)
	}

	ideURL := ""
	if session.IDEPort > 0 {
		ideURL = fmt.Sprintf("/api/lab/proxy/%d/%s/", session.ID, PortNameIDE)
	}

	gatewayURL := ""
	if session.RuntimeMode == RuntimeModeOpenClaw && session.GatewayPort > 0 {
		gatewayURL = fmt.Sprintf("/api/lab/gateway/%d/", session.ID)
	}

	appURLs := buildAppURLs(session)
	return URLs{
		VNCURL:       vncURL,
		IDEURL:       ideURL,
		SSHInfo:      "K8S exec bridge (/ws/terminal)",
		GatewayURL:   gatewayURL,
		GatewayToken: session.GatewayToken,
		RuntimeMode:  runtimeMode,
		AppURLs:      appURLs,
	}
}

func buildAppURLs(session *UserLabSession) []AppURL {
	if session == nil || len(session.AppPorts) == 0 {
		return []AppURL{}
	}
	ports := normalizeSessionAppPorts(session.AppPorts)
	defaultName := strings.TrimSpace(strings.ToLower(session.DefaultAppPortName))
	urls := make([]AppURL, 0, len(ports))
	for _, port := range ports {
		portName := appPortName(port.Name)
		path := port.Path
		if path == "" {
			path = "/"
		}
		urls = append(urls, AppURL{
			Name:          port.Name,
			Label:         port.Label,
			ContainerPort: port.ContainerPort,
			ServicePort:   appServicePort(port.ContainerPort),
			Path:          path,
			URL:           fmt.Sprintf("/api/lab/proxy/%d/%s%s", session.ID, portName, path),
			IsDefault:     port.Name == defaultName,
		})
	}
	return urls
}

func (s *Service) ExecuteCommand(ctx context.Context, session *UserLabSession, command string) ExecuteResult {
	stdout := &bytes.Buffer{}
	stderr := &bytes.Buffer{}
	err := s.StreamExec(ctx, session, []string{"/bin/bash", "-lc", command}, false, nil, stdout, stderr, nil)

	output := stdout.String()
	if output == "" {
		output = stderr.String()
	}

	if err != nil {
		exitCode := 1
		var exitErr k8sexec.ExitError
		if errors.As(err, &exitErr) {
			exitCode = exitErr.ExitStatus()
		}
		return ExecuteResult{
			Success:  false,
			Output:   output,
			ExitCode: exitCode,
			Error:    strings.TrimSpace(stderr.String()),
		}
	}

	return ExecuteResult{Success: true, Output: output, ExitCode: 0}
}

func (s *Service) RecordTerminalEventAsync(ctx context.Context, userID, labSessionID, manualID uint64, stepOrder int, command, output string, exitCode int) {
	if manualID == 0 || strings.TrimSpace(command) == "" {
		return
	}
	go func() {
		event := agent.LabTerminalEvent{
			UserID:        userID,
			LabSessionID:  labSessionID,
			ManualID:      manualID,
			StepOrder:     stepOrder,
			Command:       redactTerminalText(command),
			OutputSummary: truncate(redactTerminalText(output), 1000),
			ExitCode:      exitCode,
		}
		if err := s.db.WithContext(context.Background()).Create(&event).Error; err != nil && s.log != nil {
			s.log.Warn("record lab terminal event failed", zap.Error(err))
		}
	}()
}

func (s *Service) ResolveRuntime(ctx context.Context, runtimeRef string) (*agent.RuntimeSession, error) {
	runtimeRef = strings.TrimSpace(runtimeRef)
	if runtimeRef == "" {
		return nil, nil
	}

	var session UserLabSession
	query := s.db.WithContext(ctx)
	if sessionID, err := strconv.ParseUint(runtimeRef, 10, 64); err == nil {
		if err := query.Where("id = ?", sessionID).First(&session).Error; err == nil {
			_ = s.SyncSessionStatus(ctx, &session)
			return toRuntimeSession(&session), nil
		} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	err := query.
		Where("container_id = ? OR container_name = ?", runtimeRef, runtimeRef).
		Order("updated_at DESC").
		First(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	_ = s.SyncSessionStatus(ctx, &session)
	return toRuntimeSession(&session), nil
}

func (s *Service) ExecuteRuntimeCommand(ctx context.Context, sessionID uint64, command string) (agent.RuntimeCommandResult, error) {
	session, err := s.GetSession(ctx, sessionID)
	if err != nil {
		return agent.RuntimeCommandResult{}, err
	}
	if session == nil {
		return agent.RuntimeCommandResult{}, errors.New("实验会话不存在")
	}

	result := s.ExecuteCommand(ctx, session, command)
	return agent.RuntimeCommandResult{
		Success:  result.Success,
		Output:   result.Output,
		ExitCode: result.ExitCode,
		Error:    result.Error,
	}, nil
}

func (s *Service) StreamExec(
	ctx context.Context,
	session *UserLabSession,
	command []string,
	tty bool,
	stdin io.Reader,
	stdout io.Writer,
	stderr io.Writer,
	sizes remotecommand.TerminalSizeQueue,
) error {
	if s.k8s == nil || s.restConfig == nil {
		return errors.New("K8S exec bridge 未启用")
	}
	if session == nil || session.ContainerName == "" {
		return errors.New("实验会话无效")
	}
	if err := s.ensurePodReadyForExec(ctx, session.ContainerName); err != nil {
		return err
	}

	req := s.k8s.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(session.ContainerName).
		Namespace(s.runtimeNamespace()).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: MainContainerName,
			Command:   command,
			Stdin:     stdin != nil,
			Stdout:    stdout != nil,
			Stderr:    stderr != nil && !tty,
			TTY:       tty,
		}, scheme.ParameterCodec)

	executor, err := remotecommand.NewSPDYExecutor(s.restConfig, "POST", req.URL())
	if err != nil {
		return err
	}

	return executor.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdin:             stdin,
		Stdout:            stdout,
		Stderr:            stderr,
		Tty:               tty,
		TerminalSizeQueue: sizes,
	})
}

func (s *Service) ServiceProxyURL(sessionID uint64, target, suffix, rawQuery string) (*url.URL, error) {
	if s.k8s == nil {
		return nil, errors.New("K8S client 未启用")
	}
	portName := strings.TrimSpace(target)
	if portName == "" {
		return nil, errors.New("无效的代理目标")
	}

	pathParts := splitProxySuffix(suffix)
	req := s.k8s.CoreV1().RESTClient().
		Get().
		Namespace(s.runtimeNamespace()).
		Resource("services").
		Name(ServiceName(sessionID) + ":" + portName).
		SubResource("proxy")
	if len(pathParts) > 0 {
		req = req.Suffix(pathParts...)
	}

	upstream := *req.URL()
	if strings.HasSuffix(suffix, "/") && !strings.HasSuffix(upstream.Path, "/") {
		upstream.Path += "/"
	}
	q, _ := url.ParseQuery(rawQuery)
	q.Del("authToken")
	upstream.RawQuery = q.Encode()
	return &upstream, nil
}

func (s *Service) RestConfig() *rest.Config {
	return s.restConfig
}

type runtimeResourceProfile struct {
	MainCPURequest    string
	MainMemoryRequest string
	MainCPULimit      string
	MainMemoryLimit   string
	IDECPURequest     string
	IDEMemoryRequest  string
	IDECPULimit       string
	IDEMemoryLimit    string
}

type labSourceConfig struct {
	EnvImage           string
	IDEImage           string
	SourceName         string
	RuntimeMode        RuntimeMode
	Resources          runtimeResourceProfile
	DesktopEnabled     bool
	VNCPort            uint
	AppPorts           []publishing.LabTemplateAppPort
	DefaultAppPortName string
}

func defaultRuntimeResourceProfile() runtimeResourceProfile {
	return runtimeResourceProfile{
		MainCPURequest:    "250m",
		MainMemoryRequest: "512Mi",
		MainCPULimit:      "2",
		MainMemoryLimit:   "2Gi",
		IDECPURequest:     "100m",
		IDEMemoryRequest:  "256Mi",
		IDECPULimit:       "1",
		IDEMemoryLimit:    "1Gi",
	}
}

func runtimeResourceProfileFromTemplate(template publishing.LabTemplate) runtimeResourceProfile {
	return runtimeResourceProfile{
		MainCPURequest:    defaultResourceString(template.MainCPURequest, "250m"),
		MainMemoryRequest: defaultResourceString(template.MainMemoryRequest, "512Mi"),
		MainCPULimit:      defaultResourceString(template.MainCPULimit, "2"),
		MainMemoryLimit:   defaultResourceString(template.MainMemoryLimit, "2Gi"),
		IDECPURequest:     defaultResourceString(template.IDECPURequest, "100m"),
		IDEMemoryRequest:  defaultResourceString(template.IDEMemoryRequest, "256Mi"),
		IDECPULimit:       defaultResourceString(template.IDECPULimit, "1"),
		IDEMemoryLimit:    defaultResourceString(template.IDEMemoryLimit, "1Gi"),
	}
}

func defaultResourceString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return strings.TrimSpace(value)
}

func (s *Service) resolveSource(ctx context.Context, sourceType SourceType, sourceID uint64) (labSourceConfig, error) {
	source := labSourceConfig{
		RuntimeMode:    RuntimeModeClassic,
		Resources:      defaultRuntimeResourceProfile(),
		DesktopEnabled: true,
		VNCPort:        uint(NoVNCPort),
		AppPorts:       []publishing.LabTemplateAppPort{},
	}
	switch sourceType {
	case SourceTypeCourse:
		var record course.Course
		if err := s.db.WithContext(ctx).Where("id = ?", sourceID).First(&record).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return source, errors.New("课程不存在")
			}
			return source, err
		}
		source.EnvImage = record.EnvImage
		source.IDEImage = record.IDEImage
		source.SourceName = record.Title
		if record.LabTemplateID > 0 {
			template, err := s.resolveActiveLabTemplate(ctx, record.LabTemplateID)
			if err != nil {
				return source, err
			}
			applyLabTemplateToSource(&source, *template)
		}
		return source, nil
	case SourceTypeProject:
		var record project.Project
		if err := s.db.WithContext(ctx).Where("id = ?", sourceID).First(&record).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return source, errors.New("项目不存在")
			}
			return source, err
		}
		tags, err := s.projectTags(ctx, sourceID)
		if err != nil {
			return source, err
		}
		source.EnvImage = record.EnvImage
		source.IDEImage = record.IDEImage
		source.SourceName = record.Title
		projectLabRuntime := ""
		if s.cfg != nil {
			projectLabRuntime = s.cfg.OpenClaw.ProjectLabRuntime
		}
		if project.ResolveLabRuntimeModeWithTags(record, tags, projectLabRuntime) == project.LabRuntimeModeOpenClaw {
			source.RuntimeMode = RuntimeModeOpenClaw
			source.IDEImage = ""
			source.DesktopEnabled = true
			source.VNCPort = uint(NoVNCPort)
			source.AppPorts = []publishing.LabTemplateAppPort{}
			source.DefaultAppPortName = ""
		} else if record.LabTemplateID > 0 {
			template, err := s.resolveActiveLabTemplate(ctx, record.LabTemplateID)
			if err != nil {
				return source, err
			}
			applyLabTemplateToSource(&source, *template)
		}
		return source, nil
	default:
		return source, errors.New("无效的来源类型")
	}
}

func applyLabTemplateToSource(source *labSourceConfig, template publishing.LabTemplate) {
	source.EnvImage = template.EnvImage
	source.IDEImage = template.IDEImage
	source.Resources = runtimeResourceProfileFromTemplate(template)
	source.DesktopEnabled = template.DesktopEnabled
	source.VNCPort = labTemplateNoVNCPort(template)
	source.AppPorts = normalizeSessionAppPorts(template.AppPorts)
	source.DefaultAppPortName = template.DefaultAppPortName
	if source.DefaultAppPortName == "" && len(source.AppPorts) > 0 {
		if !source.DesktopEnabled {
			source.DefaultAppPortName = source.AppPorts[0].Name
		}
	}
}

func (s *Service) resolveActiveLabTemplate(ctx context.Context, templateID uint64) (*publishing.LabTemplate, error) {
	var template publishing.LabTemplate
	if err := s.db.WithContext(ctx).First(&template, templateID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("绑定的 Lab 模板不存在")
		}
		return nil, err
	}
	if template.Status != publishing.LabTemplateStatusActive {
		return nil, errors.New("绑定的 Lab 模板已停用")
	}
	if strings.TrimSpace(template.EnvImage) == "" {
		return nil, errors.New("绑定的 Lab 模板未配置实验镜像")
	}
	return &template, nil
}

func (s *Service) projectTags(ctx context.Context, projectID uint64) ([]project.Tag, error) {
	var tags []project.Tag
	err := s.db.WithContext(ctx).
		Table("tags").
		Select("tags.*").
		Joins("JOIN project_tags ON project_tags.tag_id = tags.id").
		Where("project_tags.project_id = ?", projectID).
		Find(&tags).Error
	return tags, err
}

func (s *Service) createRuntimeResources(ctx context.Context, session *UserLabSession, ideImage, sourceName string, resources runtimeResourceProfile) error {
	labels := labLabels(session)
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      session.ContainerName,
			Namespace: s.runtimeNamespace(),
			Labels:    labels,
		},
		Spec: corev1.PodSpec{
			RestartPolicy: corev1.RestartPolicyNever,
			Volumes: []corev1.Volume{
				{
					Name: "workspace",
					VolumeSource: corev1.VolumeSource{
						EmptyDir: &corev1.EmptyDirVolumeSource{},
					},
				},
			},
			Containers: []corev1.Container{
				{
					Name:            MainContainerName,
					Image:           session.ImageName,
					ImagePullPolicy: corev1.PullIfNotPresent,
					Env:             s.mainContainerEnv(session, sourceName),
					Lifecycle:       desktopLifecycle(session),
					Ports:           mainContainerPorts(session),
					VolumeMounts: []corev1.VolumeMount{
						{Name: "workspace", MountPath: "/workspace"},
					},
					Resources: corev1.ResourceRequirements{
						Requests: corev1.ResourceList{
							corev1.ResourceCPU:    resource.MustParse(resources.MainCPURequest),
							corev1.ResourceMemory: resource.MustParse(resources.MainMemoryRequest),
						},
						Limits: corev1.ResourceList{
							corev1.ResourceCPU:    resource.MustParse(resources.MainCPULimit),
							corev1.ResourceMemory: resource.MustParse(resources.MainMemoryLimit),
						},
					},
				},
			},
		},
	}
	if s.cfg != nil && s.cfg.K8S.LabImagePullSecret != "" {
		pod.Spec.ImagePullSecrets = []corev1.LocalObjectReference{{Name: s.cfg.K8S.LabImagePullSecret}}
	}
	if ideImage != "" {
		pod.Spec.Containers = append(pod.Spec.Containers, corev1.Container{
			Name:            IDEContainerName,
			Image:           ideImage,
			ImagePullPolicy: corev1.PullIfNotPresent,
			Args: []string{
				"--host", "0.0.0.0",
				"--without-connection-token",
				"--server-base-path", fmt.Sprintf("/api/lab/proxy/%d/%s", session.ID, PortNameIDE),
			},
			Env: []corev1.EnvVar{
				{Name: "USER_ID", Value: strconv.FormatUint(session.UserID, 10)},
				{Name: "SOURCE_NAME", Value: sourceName},
			},
			Ports: []corev1.ContainerPort{{Name: PortNameIDE, ContainerPort: IDEPort}},
			VolumeMounts: []corev1.VolumeMount{
				{Name: "workspace", MountPath: "/workspace"},
			},
			Resources: corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse(resources.IDECPURequest),
					corev1.ResourceMemory: resource.MustParse(resources.IDEMemoryRequest),
				},
				Limits: corev1.ResourceList{
					corev1.ResourceCPU:    resource.MustParse(resources.IDECPULimit),
					corev1.ResourceMemory: resource.MustParse(resources.IDEMemoryLimit),
				},
			},
		})
	}

	if err := assertLabPodSpec(pod); err != nil {
		return fmt.Errorf("Lab Pod 配置风险，创建已终止：%w", err)
	}

	_, err := s.k8s.CoreV1().Pods(s.runtimeNamespace()).Create(ctx, pod, metav1.CreateOptions{})
	if apierrors.IsAlreadyExists(err) {
		_ = s.k8s.CoreV1().Pods(s.runtimeNamespace()).Delete(ctx, pod.Name, metav1.DeleteOptions{})
		_, err = s.k8s.CoreV1().Pods(s.runtimeNamespace()).Create(ctx, pod, metav1.CreateOptions{})
	}
	if err != nil {
		return err
	}

	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      ServiceName(session.ID),
			Namespace: s.runtimeNamespace(),
			Labels:    labels,
		},
		Spec: corev1.ServiceSpec{
			Type:     corev1.ServiceTypeClusterIP,
			Selector: labels,
			Ports:    servicePorts(session),
		},
	}
	if err := assertLabServiceSpec(service); err != nil {
		return fmt.Errorf("Lab Service 配置风险，创建已终止：%w", err)
	}
	_, err = s.k8s.CoreV1().Services(s.runtimeNamespace()).Create(ctx, service, metav1.CreateOptions{})
	if apierrors.IsAlreadyExists(err) {
		_ = s.k8s.CoreV1().Services(s.runtimeNamespace()).Delete(ctx, service.Name, metav1.DeleteOptions{})
		_, err = s.k8s.CoreV1().Services(s.runtimeNamespace()).Create(ctx, service, metav1.CreateOptions{})
	}
	return err
}

func (s *Service) mainContainerEnv(session *UserLabSession, sourceName string) []corev1.EnvVar {
	env := []corev1.EnvVar{
		{Name: "USER_ID", Value: strconv.FormatUint(session.UserID, 10)},
		{Name: "SOURCE_TYPE", Value: strconv.Itoa(int(session.SourceType))},
		{Name: "SOURCE_ID", Value: strconv.FormatUint(session.SourceID, 10)},
		{Name: "SOURCE_NAME", Value: sourceName},
		{Name: "VNC_RESOLUTION", Value: "1920x1080"},
	}
	if session.VNCPort > 0 {
		env = append(env,
			corev1.EnvVar{Name: "DESKTOP_ENABLED", Value: "true"},
			corev1.EnvVar{Name: "DESKTOP_HTTP_PORT", Value: strconv.Itoa(int(session.VNCPort))},
			corev1.EnvVar{Name: "DESKTOP_VNC_PORT", Value: "5901"},
		)
	}
	if session.RuntimeMode != RuntimeModeOpenClaw {
		return env
	}
	openclawCfg := config.OpenClawConfig{}
	qwenCfg := config.QwenConfig{}
	if s.cfg != nil {
		openclawCfg = s.cfg.OpenClaw
		qwenCfg = s.cfg.Qwen
	}
	openclawEnv := map[string]string{
		"CLASSROOM_MODE":              "true",
		"CLASSROOM_FRONTEND":          "terminal",
		"CLASSROOM_FORCE_IM_DISABLED": "true",
		"DESKTOP_ENABLED":             "true",
		"DESKTOP_HTTP_PORT":           strconv.Itoa(int(NoVNCPort)),
		"DESKTOP_VNC_PORT":            "5901",
		"SSH_ENABLED":                 "true",
		"SSH_PORT":                    strconv.Itoa(int(SSHPort)),
		"SSH_USERNAME":                "root",
		"SSH_PASSWORD":                "opencode",
		"OPENCLAW_GATEWAY_BIND":       "lan",
		"OPENCLAW_GATEWAY_PORT":       strconv.Itoa(int(GatewayPort)),
		"OPENCLAW_GATEWAY_AUTH_MODE":  "token",
		"OPENCLAW_GATEWAY_TOKEN":      session.GatewayToken,
		"OPENCLAW_GATEWAY_DANGEROUSLY_ALLOW_HOST_HEADER_ORIGIN_FALLBACK": "true",
		"MODEL_ID":       firstNonEmpty(openclawCfg.ModelID, qwenCfg.Model, "glm-5"),
		"BASE_URL":       firstNonEmpty(openclawCfg.BaseURL, qwenCfg.BaseURL),
		"API_PROTOCOL":   firstNonEmpty(openclawCfg.APIProtocol, "openai-completions"),
		"CONTEXT_WINDOW": firstNonEmpty(openclawCfg.ContextWindow, "200000"),
		"MAX_TOKENS":     firstNonEmpty(openclawCfg.MaxTokens, "65536"),
		"API_KEY":        firstNonEmpty(openclawCfg.APIKey, qwenCfg.APIKey),
	}
	for key, value := range openclawEnv {
		env = append(env, corev1.EnvVar{Name: key, Value: value})
	}
	return env
}

func desktopLifecycle(session *UserLabSession) *corev1.Lifecycle {
	if session == nil || session.VNCPort == 0 {
		return nil
	}
	script := strings.Join([]string{
		"set +e",
		"if ! command -v websockify >/dev/null 2>&1; then exit 0; fi",
		"WEB_ROOT=\"\"",
		"for candidate in /usr/share/novnc /usr/share/noVNC /opt/noVNC /opt/novnc; do",
		"  if [ -d \"$candidate\" ]; then WEB_ROOT=\"$candidate\"; break; fi",
		"done",
		"if [ -z \"$WEB_ROOT\" ]; then exit 0; fi",
		"HTTP_PORT=\"${DESKTOP_HTTP_PORT:-6080}\"",
		"VNC_PORT=\"${DESKTOP_VNC_PORT:-5901}\"",
		"nohup websockify --web \"$WEB_ROOT\" \"0.0.0.0:${HTTP_PORT}\" \"localhost:${VNC_PORT}\" >/tmp/websockify.log 2>&1 &",
		"exit 0",
	}, "\n")
	return &corev1.Lifecycle{
		PostStart: &corev1.LifecycleHandler{
			Exec: &corev1.ExecAction{
				Command: []string{"sh", "-lc", script},
			},
		},
	}
}

func (s *Service) ensureRuntimeNamespace(ctx context.Context) error {
	ns := s.runtimeNamespace()
	if ns == "" {
		return errors.New("K8S runtime namespace 未配置")
	}
	_, err := s.k8s.CoreV1().Namespaces().Get(ctx, ns, metav1.GetOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		return err
	}
	if apierrors.IsNotFound(err) {
		if _, err = s.k8s.CoreV1().Namespaces().Create(ctx, &corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{Name: ns},
		}, metav1.CreateOptions{}); err != nil {
			return err
		}
	}
	return s.ensureImagePullSecret(ctx, ns)
}

func (s *Service) ensureImagePullSecret(ctx context.Context, runtimeNamespace string) error {
	if s == nil || s.k8s == nil || s.cfg == nil || strings.TrimSpace(s.cfg.K8S.LabImagePullSecret) == "" {
		return nil
	}
	secretName := strings.TrimSpace(s.cfg.K8S.LabImagePullSecret)
	if _, err := s.k8s.CoreV1().Secrets(runtimeNamespace).Get(ctx, secretName, metav1.GetOptions{}); err == nil {
		return nil
	} else if !apierrors.IsNotFound(err) {
		return err
	}

	for _, sourceNamespace := range imagePullSecretSourceNamespaces(s.cfg, runtimeNamespace) {
		secret, err := s.k8s.CoreV1().Secrets(sourceNamespace).Get(ctx, secretName, metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			continue
		}
		if err != nil {
			return err
		}
		copySecret := &corev1.Secret{
			ObjectMeta: metav1.ObjectMeta{
				Name:      secretName,
				Namespace: runtimeNamespace,
				Labels: map[string]string{
					"app.kubernetes.io/name":       "edu-lab",
					"app.kubernetes.io/managed-by": "edu-backend-go",
				},
			},
			Type:       secret.Type,
			Data:       secret.Data,
			StringData: secret.StringData,
		}
		if _, err := s.k8s.CoreV1().Secrets(runtimeNamespace).Create(ctx, copySecret, metav1.CreateOptions{}); err != nil && !apierrors.IsAlreadyExists(err) {
			return err
		}
		return nil
	}
	return fmt.Errorf("K8S runtime namespace %s 缺少镜像拉取 Secret %s，请先在该 namespace 创建或从 dev 环境复制", runtimeNamespace, secretName)
}

func imagePullSecretSourceNamespaces(cfg *config.Config, runtimeNamespace string) []string {
	candidates := []string{}
	add := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" || value == runtimeNamespace {
			return
		}
		for _, existing := range candidates {
			if existing == value {
				return
			}
		}
		candidates = append(candidates, value)
	}
	if cfg != nil {
		add(cfg.K8S.Namespace)
	}
	add("edu-runtime-dev")
	return candidates
}

func (s *Service) waitForPodReady(ctx context.Context, podName string, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for {
		if err := s.ensurePodReadyForExec(ctx, podName); err == nil {
			return nil
		} else if time.Now().After(deadline) {
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
}

func (s *Service) ensurePodReadyForExec(ctx context.Context, podName string) error {
	pod, err := s.k8s.CoreV1().Pods(s.runtimeNamespace()).Get(ctx, podName, metav1.GetOptions{})
	if err != nil {
		return err
	}
	if pod.Status.Phase != corev1.PodRunning {
		return fmt.Errorf("SSH 连接失败: Pod 尚未就绪，当前状态 %s%s", pod.Status.Phase, podReadinessDetail(pod))
	}
	for _, condition := range pod.Status.Conditions {
		if condition.Type == corev1.PodReady && condition.Status == corev1.ConditionTrue {
			return nil
		}
	}
	return errors.New("SSH 连接失败: Pod 尚未 Ready" + podReadinessDetail(pod))
}

func podReadinessDetail(pod *corev1.Pod) string {
	if pod == nil {
		return ""
	}
	statuses := append([]corev1.ContainerStatus{}, pod.Status.InitContainerStatuses...)
	statuses = append(statuses, pod.Status.ContainerStatuses...)
	for _, status := range statuses {
		if status.State.Waiting == nil {
			continue
		}
		reason := strings.TrimSpace(status.State.Waiting.Reason)
		message := strings.TrimSpace(status.State.Waiting.Message)
		if reason == "" && message == "" {
			continue
		}
		if message != "" {
			return fmt.Sprintf("，容器 %s 等待原因：%s - %s", status.Name, firstNonEmpty(reason, "Waiting"), truncate(message, 240))
		}
		return fmt.Sprintf("，容器 %s 等待原因：%s", status.Name, reason)
	}
	for _, condition := range pod.Status.Conditions {
		if condition.Status == corev1.ConditionTrue || strings.TrimSpace(condition.Message) == "" {
			continue
		}
		return fmt.Sprintf("，%s：%s", condition.Type, truncate(condition.Message, 240))
	}
	return ""
}

func (s *Service) SweepSessions(ctx context.Context) error {
	now := time.Now()

	var sessions []UserLabSession
	if err := s.db.WithContext(ctx).
		Where("status IN ?", []SessionStatus{SessionStatusCreating, SessionStatusRunning}).
		Find(&sessions).Error; err != nil {
		return err
	}

	for idx := range sessions {
		session := &sessions[idx]
		if sessionExpired(session, now) {
			if err := s.stopExpiredSession(ctx, session); err != nil {
				s.log.Warn("lab janitor failed to stop expired session", zap.Uint64("sessionId", session.ID), zap.Error(err))
			}
			continue
		}
		if err := s.SyncSessionStatus(ctx, session); err != nil {
			s.log.Warn("lab janitor failed to sync session status", zap.Uint64("sessionId", session.ID), zap.Error(err))
		}
	}

	return s.cleanupOrphanRuntimeResources(ctx)
}

func (s *Service) markError(ctx context.Context, session *UserLabSession, cause error) (*UserLabSession, error) {
	if session == nil {
		return nil, cause
	}
	session.Status = SessionStatusError
	session.ErrorMessage = truncate(cause.Error(), 512)
	_ = s.db.WithContext(ctx).Save(session).Error
	_ = s.deleteRuntimeResources(context.Background(), session)
	_ = s.recordRuntimeEvent(ctx, session.ID, session.UserID, operations.RuntimeEventError, sessionStatusText(session.Status), session.ErrorMessage, 0, operations.JSONMap{"error": cause.Error()})
	return nil, cause
}

func (s *Service) runtimeNamespace() string {
	if s.cfg != nil && s.cfg.K8S.RuntimeNamespace != "" {
		return s.cfg.K8S.RuntimeNamespace
	}
	if s.cfg != nil && s.cfg.K8S.Namespace != "" {
		return s.cfg.K8S.Namespace
	}
	return "edu-runtime-dev"
}

func PodName(sessionID uint64) string {
	return fmt.Sprintf("lab-session-%d", sessionID)
}

func ServiceName(sessionID uint64) string {
	return fmt.Sprintf("lab-service-%d", sessionID)
}

func appPortName(name string) string {
	return "app-" + strings.TrimSpace(strings.ToLower(name))
}

func appServicePort(containerPort int32) int32 {
	return containerPort + 20000
}

func provisionalPodName(userID uint64) string {
	return fmt.Sprintf("lab-u%d-%d", userID, time.Now().Unix())
}

func timePointer(value time.Time) *time.Time { return &value }

func labLabels(session *UserLabSession) map[string]string {
	return map[string]string{
		"app.kubernetes.io/name":       "edu-lab",
		"app.kubernetes.io/managed-by": "edu-backend-go",
		"edu/session-id":               strconv.FormatUint(session.ID, 10),
		"edu/user-id":                  strconv.FormatUint(session.UserID, 10),
	}
}

func mainContainerPorts(session *UserLabSession) []corev1.ContainerPort {
	ports := []corev1.ContainerPort{
		{Name: "ssh", ContainerPort: SSHPort},
	}
	if session.VNCPort > 0 {
		ports = append(ports, corev1.ContainerPort{Name: PortNameNoVNC, ContainerPort: int32(session.VNCPort)})
	}
	if session.RuntimeMode == RuntimeModeOpenClaw {
		ports = append(ports, corev1.ContainerPort{Name: PortNameGateway, ContainerPort: GatewayPort})
	}
	for _, port := range normalizeSessionAppPorts(session.AppPorts) {
		ports = append(ports, corev1.ContainerPort{Name: appPortName(port.Name), ContainerPort: port.ContainerPort})
	}
	return ports
}

func servicePorts(session *UserLabSession) []corev1.ServicePort {
	ports := []corev1.ServicePort{}
	if session.VNCPort > 0 {
		ports = append(ports, corev1.ServicePort{Name: PortNameNoVNC, Port: NoVNCPort, TargetPort: intstr.FromString(PortNameNoVNC)})
	}
	if session.IDEPort > 0 {
		ports = append(ports, corev1.ServicePort{Name: PortNameIDE, Port: IDEPort, TargetPort: intstr.FromString(PortNameIDE)})
	}
	if session.RuntimeMode == RuntimeModeOpenClaw {
		ports = append(ports, corev1.ServicePort{Name: PortNameGateway, Port: GatewayPort, TargetPort: intstr.FromString(PortNameGateway)})
	}
	for _, port := range normalizeSessionAppPorts(session.AppPorts) {
		ports = append(ports, corev1.ServicePort{
			Name:       appPortName(port.Name),
			Port:       appServicePort(port.ContainerPort),
			TargetPort: intstr.FromString(appPortName(port.Name)),
		})
	}
	return ports
}

func assertLabPodSpec(pod *corev1.Pod) error {
	if pod == nil {
		return errors.New("Pod spec 为空")
	}
	if pod.Spec.HostNetwork {
		return errors.New("禁止启用 hostNetwork，Lab 只能通过平台代理访问")
	}
	for _, container := range append(append([]corev1.Container{}, pod.Spec.InitContainers...), pod.Spec.Containers...) {
		for _, port := range container.Ports {
			if port.HostPort > 0 {
				return fmt.Errorf("容器 %s 端口 %s 禁止配置 HostPort %d", container.Name, firstNonEmpty(port.Name, strconv.Itoa(int(port.ContainerPort))), port.HostPort)
			}
		}
	}
	return nil
}

func assertLabServiceSpec(service *corev1.Service) error {
	if service == nil {
		return errors.New("Service spec 为空")
	}
	if service.Spec.Type != "" && service.Spec.Type != corev1.ServiceTypeClusterIP {
		return fmt.Errorf("禁止使用 %s 类型 Service，Lab Service 必须为 ClusterIP", service.Spec.Type)
	}
	for _, port := range service.Spec.Ports {
		if port.NodePort > 0 {
			return fmt.Errorf("Service 端口 %s 禁止配置 NodePort %d", firstNonEmpty(port.Name, strconv.Itoa(int(port.Port))), port.NodePort)
		}
	}
	return nil
}

func normalizeProxyTarget(target string) string {
	switch strings.ToLower(strings.TrimSpace(target)) {
	case PortNameNoVNC, "vnc", "desktop":
		return PortNameNoVNC
	case PortNameIDE, "webide", "code":
		return PortNameIDE
	case PortNameGateway, "openclaw":
		return PortNameGateway
	default:
		return ""
	}
}

func splitProxySuffix(suffix string) []string {
	cleaned := strings.TrimPrefix(suffix, "/")
	if cleaned == "" {
		return nil
	}
	parts := strings.Split(cleaned, "/")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func generateGatewayToken() string {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("project-gw-%d", time.Now().UnixNano())
	}
	return "project-gw-" + hex.EncodeToString(buf)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func redactTerminalText(value string) string {
	return appredact.SensitiveText(value)
}

func normalizeSessionAppPorts(ports []publishing.LabTemplateAppPort) []publishing.LabTemplateAppPort {
	if len(ports) == 0 {
		return []publishing.LabTemplateAppPort{}
	}
	out := make([]publishing.LabTemplateAppPort, 0, len(ports))
	for _, port := range ports {
		name := strings.TrimSpace(strings.ToLower(port.Name))
		if name == "" || port.ContainerPort <= 0 {
			continue
		}
		label := strings.TrimSpace(port.Label)
		if label == "" {
			label = name
		}
		path := strings.TrimSpace(port.Path)
		if path == "" {
			path = "/"
		}
		out = append(out, publishing.LabTemplateAppPort{
			Name:          name,
			Label:         label,
			ContainerPort: port.ContainerPort,
			Path:          path,
		})
	}
	return out
}

func labTemplateNoVNCPort(template publishing.LabTemplate) uint {
	for _, port := range template.ExposedPorts {
		if strings.TrimSpace(strings.ToLower(port.Type)) == PortNameNoVNC && port.ContainerPort > 0 {
			return uint(port.ContainerPort)
		}
	}
	if template.DesktopEnabled {
		return uint(NoVNCPort)
	}
	return 0
}

func truncate(value string, max int) string {
	if len(value) <= max {
		return value
	}
	return value[:max]
}

func (s *Service) stopExpiredSession(ctx context.Context, session *UserLabSession) error {
	if session == nil {
		return nil
	}
	if err := s.deleteRuntimeResources(ctx, session); err != nil {
		return err
	}
	session.Status = SessionStatusStopped
	session.ErrorMessage = "会话已过期，后台已自动回收实验资源"
	if err := s.db.WithContext(ctx).Save(session).Error; err != nil {
		return err
	}
	_ = s.recordRuntimeEvent(ctx, session.ID, session.UserID, operations.RuntimeEventExpiredRecycled, sessionStatusText(session.Status), session.ErrorMessage, 0, nil)
	_ = s.recordAudit(ctx, 0, operations.AuditActionSessionRecycle, "runtime_session", session.ID, operations.AuditResultSuccess, session.ErrorMessage, operations.JSONMap{"userId": session.UserID})
	return nil
}

func (s *Service) deleteRuntimeResources(ctx context.Context, session *UserLabSession) error {
	if session == nil || s.k8s == nil {
		return nil
	}

	var errs []error
	if err := s.k8s.CoreV1().Services(s.runtimeNamespace()).Delete(ctx, ServiceName(session.ID), metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
		errs = append(errs, err)
	}
	if session.ContainerName != "" {
		if err := s.k8s.CoreV1().Pods(s.runtimeNamespace()).Delete(ctx, session.ContainerName, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

func (s *Service) cleanupOrphanRuntimeResources(ctx context.Context) error {
	if s.k8s == nil {
		return nil
	}

	var sessions []UserLabSession
	if err := s.db.WithContext(ctx).Find(&sessions).Error; err != nil {
		return err
	}
	keepSessions := make(map[uint64]SessionStatus, len(sessions))
	for _, session := range sessions {
		keepSessions[session.ID] = session.Status
	}

	selector := "app.kubernetes.io/name=edu-lab,app.kubernetes.io/managed-by=edu-backend-go"
	pods, err := s.k8s.CoreV1().Pods(s.runtimeNamespace()).List(ctx, metav1.ListOptions{LabelSelector: selector})
	if err != nil {
		return err
	}
	for _, pod := range pods.Items {
		sessionID := parseSessionIDLabel(pod.Labels["edu/session-id"])
		status, exists := keepSessions[sessionID]
		if sessionID == 0 || !exists || !sessionShouldKeepRuntime(status) {
			if err := s.k8s.CoreV1().Pods(s.runtimeNamespace()).Delete(ctx, pod.Name, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
				s.log.Warn("lab janitor failed to delete orphan pod", zap.String("pod", pod.Name), zap.Error(err))
			} else {
				_ = s.recordRuntimeEvent(ctx, sessionID, 0, operations.RuntimeEventOrphanRecycled, "recycled", "后台已回收孤儿 Pod", 0, operations.JSONMap{"pod": pod.Name})
				_ = s.recordAudit(ctx, 0, operations.AuditActionSessionRecycle, "runtime_pod", sessionID, operations.AuditResultSuccess, "后台已回收孤儿 Pod", operations.JSONMap{"pod": pod.Name})
			}
		}
	}

	services, err := s.k8s.CoreV1().Services(s.runtimeNamespace()).List(ctx, metav1.ListOptions{LabelSelector: selector})
	if err != nil {
		return err
	}
	for _, service := range services.Items {
		sessionID := parseSessionIDLabel(service.Labels["edu/session-id"])
		status, exists := keepSessions[sessionID]
		if sessionID == 0 || !exists || !sessionShouldKeepRuntime(status) {
			if err := s.k8s.CoreV1().Services(s.runtimeNamespace()).Delete(ctx, service.Name, metav1.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
				s.log.Warn("lab janitor failed to delete orphan service", zap.String("service", service.Name), zap.Error(err))
			} else {
				_ = s.recordRuntimeEvent(ctx, sessionID, 0, operations.RuntimeEventOrphanRecycled, "recycled", "后台已回收孤儿 Service", 0, operations.JSONMap{"service": service.Name})
				_ = s.recordAudit(ctx, 0, operations.AuditActionSessionRecycle, "runtime_service", sessionID, operations.AuditResultSuccess, "后台已回收孤儿 Service", operations.JSONMap{"service": service.Name})
			}
		}
	}
	return nil
}

func toRuntimeSession(session *UserLabSession) *agent.RuntimeSession {
	if session == nil {
		return nil
	}
	return &agent.RuntimeSession{
		ID:            session.ID,
		UserID:        session.UserID,
		ContainerName: session.ContainerName,
		Status:        sessionStatusString(session.Status),
	}
}

func sessionStatusString(status SessionStatus) string {
	switch status {
	case SessionStatusCreating:
		return "creating"
	case SessionStatusRunning:
		return "running"
	case SessionStatusStopped:
		return "stopped"
	case SessionStatusError:
		return "error"
	default:
		return "unknown"
	}
}

func sessionExpired(session *UserLabSession, now time.Time) bool {
	return session != nil && session.ExpiresAt != nil && !session.ExpiresAt.After(now)
}

func parseSessionIDLabel(value string) uint64 {
	sessionID, _ := strconv.ParseUint(strings.TrimSpace(value), 10, 64)
	return sessionID
}

func sessionShouldKeepRuntime(status SessionStatus) bool {
	return status == SessionStatusCreating || status == SessionStatusRunning
}

func (s *Service) countActiveClassicSessions(ctx context.Context, userID uint64) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&UserLabSession{}).
		Where("user_id = ? AND runtime_mode = ? AND status IN ?", userID, RuntimeModeClassic, []SessionStatus{SessionStatusCreating, SessionStatusRunning}).
		Count(&count).Error
	return count, err
}

func (s *Service) recordRuntimeEvent(ctx context.Context, sessionID, userID uint64, eventType, status, message string, operatorID uint64, metadata operations.JSONMap) error {
	if s == nil || s.operations == nil {
		return nil
	}
	return s.operations.RecordRuntimeEvent(ctx, operations.RuntimeSessionEvent{
		SessionID:  sessionID,
		UserID:     userID,
		EventType:  eventType,
		Status:     status,
		Message:    truncate(message, 512),
		Metadata:   metadata,
		OperatorID: operatorID,
	})
}

func (s *Service) recordAudit(ctx context.Context, actorID uint64, action, targetType string, targetID uint64, result, message string, metadata operations.JSONMap) error {
	if s == nil || s.operations == nil {
		return nil
	}
	return s.operations.RecordAudit(ctx, operations.AuditLog{
		ActorID:    actorID,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Result:     result,
		Message:    truncate(message, 512),
		Metadata:   metadata,
	})
}

func sessionStatusText(status SessionStatus) string {
	return sessionStatusString(status)
}

func runtimeModeText(mode RuntimeMode) string {
	if mode == RuntimeModeOpenClaw {
		return "openclaw"
	}
	return "classic"
}
