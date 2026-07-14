package lab

import (
	"context"
	"errors"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"edu-platform/internal/domain/operations"
)

const (
	runtimeReleaseWait       = 8 * time.Second
	runtimeReleasePoll       = 250 * time.Millisecond
	runtimeReleaseRetryMilli = 1500
)

func (s *Service) StopSession(ctx context.Context, userID, sessionID uint64, clientID string) (*StopSessionResult, error) {
	session, err := s.GetOwnedSession(ctx, userID, sessionID)
	if err != nil {
		return nil, err
	}
	if session == nil {
		return nil, errors.New("会话不存在")
	}

	if session.Status == SessionStatusStopped {
		return releasedStopResult(session.ID), nil
	}
	if session.Status == SessionStatusRunning || session.Status == SessionStatusCreating {
		if err := s.claimSessionLease(ctx, session, clientID); err != nil {
			return nil, err
		}
	}
	return s.stopSessionWithWait(ctx, session, userID, operations.RuntimeEventStoppedByUser, runtimeReleaseWait)
}

func (s *Service) GetReleaseStatus(ctx context.Context, userID, sessionID uint64) (*StopSessionResult, error) {
	session, err := s.GetOwnedSession(ctx, userID, sessionID)
	if err != nil {
		return nil, err
	}
	if session == nil || session.Status == SessionStatusStopped {
		return releasedStopResult(sessionID), nil
	}
	if session.Status != SessionStatusStopping {
		return &StopSessionResult{SessionID: sessionID, State: sessionStatusString(session.Status), Released: false}, nil
	}
	return s.reconcileStoppingSession(ctx, session, userID, operations.RuntimeEventStoppedByUser)
}

func (s *Service) stopSessionWithWait(
	ctx context.Context,
	session *UserLabSession,
	operatorID uint64,
	completedEvent string,
	wait time.Duration,
) (*StopSessionResult, error) {
	if session == nil {
		return nil, errors.New("会话不存在")
	}
	if session.Status == SessionStatusStopped {
		return releasedStopResult(session.ID), nil
	}
	if session.Status != SessionStatusStopping {
		session.Status = SessionStatusStopping
		session.ErrorMessage = ""
		if err := s.db.WithContext(ctx).Save(session).Error; err != nil {
			return nil, err
		}
		_ = s.recordRuntimeEvent(ctx, session.ID, session.UserID, operations.RuntimeEventStopRequested, sessionStatusText(session.Status), "实验环境释放请求已接收", operatorID, nil)
	}

	if err := s.deleteRuntimeResources(ctx, session); err != nil {
		session.ErrorMessage = truncate("释放实验环境失败: "+err.Error(), 512)
		_ = s.db.WithContext(ctx).Save(session).Error
		return nil, err
	}

	released, err := s.waitForRuntimeRelease(ctx, session, wait)
	if err != nil {
		return nil, err
	}
	if !released {
		return releasingStopResult(session.ID), nil
	}
	if err := s.markSessionReleased(ctx, session, operatorID, completedEvent); err != nil {
		return nil, err
	}
	return releasedStopResult(session.ID), nil
}

func (s *Service) reconcileStoppingSession(ctx context.Context, session *UserLabSession, operatorID uint64, completedEvent string) (*StopSessionResult, error) {
	if session == nil {
		return nil, errors.New("会话不存在")
	}
	if err := s.deleteRuntimeResources(ctx, session); err != nil {
		return nil, err
	}
	released, err := s.waitForRuntimeRelease(ctx, session, 0)
	if err != nil {
		return nil, err
	}
	if !released {
		return releasingStopResult(session.ID), nil
	}
	if err := s.markSessionReleased(ctx, session, operatorID, completedEvent); err != nil {
		return nil, err
	}
	return releasedStopResult(session.ID), nil
}

func (s *Service) waitForRuntimeRelease(ctx context.Context, session *UserLabSession, maxWait time.Duration) (bool, error) {
	deadline := time.Now().Add(maxWait)
	for {
		released, err := s.runtimeResourcesReleased(ctx, session)
		if err != nil || released || maxWait <= 0 || !time.Now().Before(deadline) {
			return released, err
		}
		if err := waitContext(ctx, runtimeReleasePoll); err != nil {
			return false, err
		}
	}
}

func (s *Service) runtimeResourcesReleased(ctx context.Context, session *UserLabSession) (bool, error) {
	if session == nil || s.k8s == nil {
		return true, nil
	}
	podReleased := strings.TrimSpace(session.ContainerName) == ""
	if !podReleased {
		_, err := s.k8s.CoreV1().Pods(s.runtimeNamespace()).Get(ctx, session.ContainerName, metav1.GetOptions{})
		switch {
		case apierrors.IsNotFound(err):
			podReleased = true
		case err != nil:
			return false, err
		}
	}
	serviceReleased := false
	_, err := s.k8s.CoreV1().Services(s.runtimeNamespace()).Get(ctx, ServiceName(session.ID), metav1.GetOptions{})
	switch {
	case apierrors.IsNotFound(err):
		serviceReleased = true
	case err != nil:
		return false, err
	}
	return podReleased && serviceReleased, nil
}

func (s *Service) markSessionReleased(ctx context.Context, session *UserLabSession, operatorID uint64, completedEvent string) error {
	if session == nil || session.Status == SessionStatusStopped {
		return nil
	}
	session.Status = SessionStatusStopped
	session.ErrorMessage = ""
	if err := s.db.WithContext(ctx).Save(session).Error; err != nil {
		return err
	}
	message := "学生停止实验环境"
	switch completedEvent {
	case operations.RuntimeEventStoppedByAdmin:
		message = "管理员停止实验环境"
	case operations.RuntimeEventOrphanRecycled:
		message = "后台已确认实验环境释放完成"
	}
	_ = s.recordRuntimeEvent(ctx, session.ID, session.UserID, completedEvent, sessionStatusText(session.Status), message, operatorID, nil)
	return nil
}

func releasedStopResult(sessionID uint64) *StopSessionResult {
	return &StopSessionResult{SessionID: sessionID, State: "stopped", Released: true}
}

func releasingStopResult(sessionID uint64) *StopSessionResult {
	return &StopSessionResult{SessionID: sessionID, State: "stopping", Released: false, RetryAfterMS: runtimeReleaseRetryMilli}
}
