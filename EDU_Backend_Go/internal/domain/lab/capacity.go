package lab

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"go.uber.org/zap"
	coordinationv1 "k8s.io/api/coordination/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	capacityLeaseName       = "edu-lab-capacity-lock"
	capacityLeaseDuration   = 30 * time.Second
	capacityLockWait        = 5 * time.Second
	capacityReleaseWait     = 12 * time.Second
	capacityRetryInterval   = 500 * time.Millisecond
	capacityRetryAfterMilli = 1500
)

var (
	ErrCapacityReached   = errors.New("实验环境资源已满，请稍后再试")
	ErrCapacityReleasing = errors.New("上一实验环境正在释放，请稍后重试")
)

type CapacitySnapshot struct {
	Active       int `json:"active"`
	Releasing    int `json:"releasing"`
	Limit        int `json:"limit"`
	RetryAfterMS int `json:"retryAfterMs,omitempty"`
}

type CapacityError struct {
	Cause    error
	Snapshot CapacitySnapshot
}

func (e *CapacityError) Error() string {
	if e == nil || e.Cause == nil {
		return ErrCapacityReached.Error()
	}
	return e.Cause.Error()
}

func (e *CapacityError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Cause
}

func (s *Service) waitForClusterCapacity(ctx context.Context, maxWait time.Duration) error {
	if s == nil || s.k8s == nil || s.cfg == nil || s.cfg.K8S.MaxActiveLabs <= 0 {
		return nil
	}

	deadline := time.Now().Add(maxWait)
	for {
		snapshot, err := s.clusterCapacity(ctx)
		if err != nil {
			if s.log != nil {
				s.log.Warn("查询集群 Lab 容量失败，跳过容量门禁", zap.Error(err))
			}
			return nil
		}
		if snapshot.Active+snapshot.Releasing < snapshot.Limit {
			return nil
		}
		if snapshot.Active >= snapshot.Limit || snapshot.Releasing == 0 {
			return &CapacityError{Cause: ErrCapacityReached, Snapshot: snapshot}
		}
		if maxWait <= 0 || !time.Now().Before(deadline) {
			snapshot.RetryAfterMS = capacityRetryAfterMilli
			return &CapacityError{Cause: ErrCapacityReleasing, Snapshot: snapshot}
		}
		if err := waitContext(ctx, capacityRetryInterval); err != nil {
			return err
		}
	}
}

func (s *Service) clusterCapacity(ctx context.Context) (CapacitySnapshot, error) {
	snapshot := CapacitySnapshot{}
	if s != nil && s.cfg != nil {
		snapshot.Limit = s.cfg.K8S.MaxActiveLabs
	}
	if s == nil || s.k8s == nil {
		return snapshot, nil
	}
	pods, err := s.k8s.CoreV1().Pods(metav1.NamespaceAll).List(ctx, metav1.ListOptions{
		LabelSelector: "app.kubernetes.io/name=edu-lab,app.kubernetes.io/managed-by=edu-backend-go",
	})
	if err != nil {
		return snapshot, err
	}
	for idx := range pods.Items {
		pod := &pods.Items[idx]
		if pod.DeletionTimestamp != nil {
			snapshot.Releasing++
			continue
		}
		if pod.Status.Phase != corev1.PodPending && pod.Status.Phase != corev1.PodRunning {
			continue
		}
		if _, _, terminated := terminatedMainContainer(pod); !terminated {
			snapshot.Active++
		}
	}
	return snapshot, nil
}

func (s *Service) acquireCapacityLease(ctx context.Context) (func(), error) {
	if s == nil || s.k8s == nil || s.cfg == nil || s.cfg.K8S.MaxActiveLabs <= 0 {
		return func() {}, nil
	}
	holder := fmt.Sprintf("%s-%d-%d", hostname(), os.Getpid(), time.Now().UnixNano())
	leaseNamespace := s.capacityLeaseNamespace()
	if err := s.ensureCapacityLeaseNamespace(ctx, leaseNamespace); err != nil {
		return nil, err
	}
	leaseClient := s.k8s.CoordinationV1().Leases(leaseNamespace)
	deadline := time.Now().Add(capacityLockWait)
	durationSeconds := int32(capacityLeaseDuration / time.Second)

	for {
		now := metav1.NewMicroTime(time.Now())
		lease, err := leaseClient.Get(ctx, capacityLeaseName, metav1.GetOptions{})
		switch {
		case apierrors.IsNotFound(err):
			lease = &coordinationv1.Lease{
				ObjectMeta: metav1.ObjectMeta{Name: capacityLeaseName, Namespace: leaseNamespace},
				Spec: coordinationv1.LeaseSpec{
					HolderIdentity:       stringPointer(holder),
					LeaseDurationSeconds: int32Pointer(durationSeconds),
					AcquireTime:          &now,
					RenewTime:            &now,
				},
			}
			if _, err = leaseClient.Create(ctx, lease, metav1.CreateOptions{}); err == nil {
				return s.capacityLeaseRelease(holder), nil
			}
		case err != nil:
			return nil, err
		case leaseAvailable(lease, time.Now()):
			lease = lease.DeepCopy()
			lease.Spec.HolderIdentity = stringPointer(holder)
			lease.Spec.LeaseDurationSeconds = int32Pointer(durationSeconds)
			lease.Spec.AcquireTime = &now
			lease.Spec.RenewTime = &now
			if _, err = leaseClient.Update(ctx, lease, metav1.UpdateOptions{}); err == nil {
				return s.capacityLeaseRelease(holder), nil
			}
		}

		if err != nil && !apierrors.IsAlreadyExists(err) && !apierrors.IsConflict(err) {
			return nil, err
		}
		if !time.Now().Before(deadline) {
			return nil, &CapacityError{
				Cause: ErrCapacityReleasing,
				Snapshot: CapacitySnapshot{
					Limit:        s.cfg.K8S.MaxActiveLabs,
					RetryAfterMS: capacityRetryAfterMilli,
				},
			}
		}
		if err := waitContext(ctx, 200*time.Millisecond); err != nil {
			return nil, err
		}
	}
}

func (s *Service) ensureCapacityLeaseNamespace(ctx context.Context, namespace string) error {
	namespace = strings.TrimSpace(namespace)
	if namespace == "" {
		return errors.New("K8S Lab 容量锁命名空间未配置")
	}
	namespaceClient := s.k8s.CoreV1().Namespaces()
	if _, err := namespaceClient.Get(ctx, namespace, metav1.GetOptions{}); err == nil {
		return nil
	} else if !apierrors.IsNotFound(err) {
		return fmt.Errorf("检查 K8S Lab 容量锁命名空间 %s 失败: %w", namespace, err)
	}

	_, err := namespaceClient.Create(ctx, &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: namespace,
			Labels: map[string]string{
				"app.kubernetes.io/managed-by": "edu-backend-go",
				"app.kubernetes.io/part-of":    "agent-edu",
			},
		},
	}, metav1.CreateOptions{})
	if err != nil && !apierrors.IsAlreadyExists(err) {
		return fmt.Errorf("创建 K8S Lab 容量锁命名空间 %s 失败: %w", namespace, err)
	}
	if err == nil && s.log != nil {
		s.log.Info("已创建 K8S Lab 容量锁命名空间", zap.String("namespace", namespace))
	}
	return nil
}

func (s *Service) capacityLeaseRelease(holder string) func() {
	return func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		client := s.k8s.CoordinationV1().Leases(s.capacityLeaseNamespace())
		lease, err := client.Get(ctx, capacityLeaseName, metav1.GetOptions{})
		if err != nil || lease.Spec.HolderIdentity == nil || *lease.Spec.HolderIdentity != holder {
			return
		}
		uid := lease.UID
		resourceVersion := lease.ResourceVersion
		if err := client.Delete(ctx, capacityLeaseName, metav1.DeleteOptions{
			Preconditions: &metav1.Preconditions{UID: &uid, ResourceVersion: &resourceVersion},
		}); err != nil && !apierrors.IsNotFound(err) && s.log != nil {
			s.log.Warn("释放 K8S Lab 容量锁失败", zap.Error(err))
		}
	}
}

// 两个生产入口使用不同 runtime namespace，但容量上限是集群级的，锁必须落在共享控制 namespace。
func (s *Service) capacityLeaseNamespace() string {
	if s != nil && s.cfg != nil {
		if namespace := strings.TrimSpace(s.cfg.K8S.Namespace); namespace != "" {
			return namespace
		}
	}
	return s.runtimeNamespace()
}

func leaseAvailable(lease *coordinationv1.Lease, now time.Time) bool {
	if lease == nil || lease.Spec.HolderIdentity == nil || *lease.Spec.HolderIdentity == "" {
		return true
	}
	if lease.Spec.RenewTime == nil || lease.Spec.LeaseDurationSeconds == nil {
		return true
	}
	return lease.Spec.RenewTime.Add(time.Duration(*lease.Spec.LeaseDurationSeconds) * time.Second).Before(now)
}

func waitContext(ctx context.Context, duration time.Duration) error {
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func hostname() string {
	value, err := os.Hostname()
	if err != nil || value == "" {
		return "edu-backend"
	}
	return value
}

func stringPointer(value string) *string { return &value }
func int32Pointer(value int32) *int32    { return &value }
