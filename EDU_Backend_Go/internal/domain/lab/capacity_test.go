package lab

import (
	"context"
	"errors"
	"testing"
	"time"

	"edu-platform/internal/config"
	"go.uber.org/zap"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestClusterCapacitySeparatesActiveAndReleasingPods(t *testing.T) {
	now := metav1.NewTime(time.Now())
	k8s := fake.NewSimpleClientset(
		capacityTestPod("active", corev1.PodRunning, nil),
		capacityTestPod("releasing", corev1.PodRunning, &now),
		capacityTestPod("completed", corev1.PodSucceeded, nil),
	)
	service := capacityTestService(k8s, 2)

	snapshot, err := service.clusterCapacity(context.Background())
	if err != nil {
		t.Fatalf("查询容量失败: %v", err)
	}
	if snapshot.Active != 1 || snapshot.Releasing != 1 || snapshot.Limit != 2 {
		t.Fatalf("容量分型错误: %+v", snapshot)
	}
}

func TestWaitForClusterCapacityAllowsCreateAfterRelease(t *testing.T) {
	now := metav1.NewTime(time.Now())
	k8s := fake.NewSimpleClientset(
		capacityTestPod("active", corev1.PodRunning, nil),
		capacityTestPod("releasing", corev1.PodRunning, &now),
	)
	service := capacityTestService(k8s, 2)

	go func() {
		time.Sleep(50 * time.Millisecond)
		_ = k8s.CoreV1().Pods("edu-runtime-dev").Delete(context.Background(), "releasing", metav1.DeleteOptions{})
	}()

	if err := service.waitForClusterCapacity(context.Background(), time.Second); err != nil {
		t.Fatalf("释放完成后应允许创建: %v", err)
	}
}

func TestWaitForClusterCapacityReturnsReachedWhenActivePodsFillLimit(t *testing.T) {
	k8s := fake.NewSimpleClientset(
		capacityTestPod("active-1", corev1.PodRunning, nil),
		capacityTestPod("active-2", corev1.PodPending, nil),
	)
	service := capacityTestService(k8s, 2)

	err := service.waitForClusterCapacity(context.Background(), time.Second)
	if !errors.Is(err, ErrCapacityReached) {
		t.Fatalf("应返回真实满载错误，实际为: %v", err)
	}
	var capacityErr *CapacityError
	if !errors.As(err, &capacityErr) || capacityErr.Snapshot.Active != 2 {
		t.Fatalf("容量快照不正确: %#v", capacityErr)
	}
}

func TestCapacityLeaseBlocksAnotherServiceUntilReleased(t *testing.T) {
	k8s := fake.NewSimpleClientset()
	first := capacityTestService(k8s, 2)
	second := capacityTestService(k8s, 2)

	release, err := first.acquireCapacityLease(context.Background())
	if err != nil {
		t.Fatalf("第一个实例获取容量锁失败: %v", err)
	}
	defer release()
	if _, err := k8s.CoreV1().Namespaces().Get(context.Background(), "edu-backend-go-prod", metav1.GetOptions{}); err != nil {
		t.Fatalf("容量锁应自动创建共享控制命名空间: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	if _, err := second.acquireCapacityLease(ctx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("第二个实例应被容量锁阻塞，实际为: %v", err)
	}

	release()
	if _, err := k8s.CoordinationV1().Leases("edu-backend-go-prod").Get(context.Background(), capacityLeaseName, metav1.GetOptions{}); err == nil {
		t.Fatal("释放后容量锁仍然存在")
	}
}

func TestEnsureCapacityLeaseNamespaceIsIdempotent(t *testing.T) {
	k8s := fake.NewSimpleClientset()
	service := capacityTestService(k8s, 2)

	for attempt := 0; attempt < 2; attempt++ {
		if err := service.ensureCapacityLeaseNamespace(context.Background(), "edu-backend-go-prod"); err != nil {
			t.Fatalf("第 %d 次准备容量锁命名空间失败: %v", attempt+1, err)
		}
	}

	namespace, err := k8s.CoreV1().Namespaces().Get(context.Background(), "edu-backend-go-prod", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("共享控制命名空间不存在: %v", err)
	}
	if namespace.Labels["app.kubernetes.io/managed-by"] != "edu-backend-go" {
		t.Fatalf("共享控制命名空间缺少管理标签: %#v", namespace.Labels)
	}
}

func capacityTestService(k8s *fake.Clientset, limit int) *Service {
	cfg := &config.Config{K8S: config.K8SConfig{
		Namespace:        "edu-backend-go-prod",
		RuntimeNamespace: "edu-runtime-dev",
		MaxActiveLabs:    limit,
	}}
	return NewService(nil, zap.NewNop(), cfg, k8s, nil)
}

func capacityTestPod(name string, phase corev1.PodPhase, deletionTimestamp *metav1.Time) *corev1.Pod {
	return &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:              name,
			Namespace:         "edu-runtime-dev",
			DeletionTimestamp: deletionTimestamp,
			Labels: map[string]string{
				"app.kubernetes.io/name":       "edu-lab",
				"app.kubernetes.io/managed-by": "edu-backend-go",
			},
		},
		Status: corev1.PodStatus{Phase: phase},
	}
}
