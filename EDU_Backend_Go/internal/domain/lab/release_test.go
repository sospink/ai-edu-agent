package lab

import (
	"context"
	"errors"
	"testing"

	"edu-platform/internal/domain/operations"
	"go.uber.org/zap"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes/fake"
	k8stesting "k8s.io/client-go/testing"
)

func TestStopSessionConfirmsReleaseAndIsIdempotent(t *testing.T) {
	db := newLabTestDB(t)
	k8s := fake.NewSimpleClientset()
	service := NewService(db, zap.NewNop(), nil, k8s, nil)
	session := &UserLabSession{ID: 501, UserID: 9, ContainerName: PodName(501), Status: SessionStatusRunning}
	if err := db.Create(session).Error; err != nil {
		t.Fatalf("创建会话失败: %v", err)
	}
	createRuntimeObjects(t, k8s, session)

	result, err := service.StopSession(context.Background(), session.UserID, session.ID, "browser-a")
	if err != nil {
		t.Fatalf("停止会话失败: %v", err)
	}
	if !result.Released || result.State != "stopped" {
		t.Fatalf("停止结果不正确: %+v", result)
	}

	result, err = service.StopSession(context.Background(), session.UserID, session.ID, "browser-a")
	if err != nil || !result.Released {
		t.Fatalf("重复停止应幂等成功: result=%+v err=%v", result, err)
	}
}

func TestStopSessionReportsStoppingUntilResourcesDisappear(t *testing.T) {
	db := newLabTestDB(t)
	k8s := fake.NewSimpleClientset()
	k8s.PrependReactor("delete", "pods", keepObjectOnDelete)
	k8s.PrependReactor("delete", "services", keepObjectOnDelete)
	service := NewService(db, zap.NewNop(), nil, k8s, nil)
	session := &UserLabSession{ID: 502, UserID: 10, ContainerName: PodName(502), Status: SessionStatusRunning}
	if err := db.Create(session).Error; err != nil {
		t.Fatalf("创建会话失败: %v", err)
	}
	createRuntimeObjects(t, k8s, session)

	result, err := service.stopSessionWithWait(context.Background(), session, session.UserID, operations.RuntimeEventStoppedByUser, 0)
	if err != nil {
		t.Fatalf("提交停止请求失败: %v", err)
	}
	if result.Released || result.State != "stopping" || result.RetryAfterMS <= 0 {
		t.Fatalf("应返回释放中状态: %+v", result)
	}

	if err := k8s.Tracker().Delete(schema.GroupVersionResource{Group: "", Version: "v1", Resource: "pods"}, service.runtimeNamespace(), session.ContainerName); err != nil {
		t.Fatalf("移除 Pod 失败: %v", err)
	}
	if err := k8s.Tracker().Delete(schema.GroupVersionResource{Group: "", Version: "v1", Resource: "services"}, service.runtimeNamespace(), ServiceName(session.ID)); err != nil {
		t.Fatalf("移除 Service 失败: %v", err)
	}

	result, err = service.GetReleaseStatus(context.Background(), session.UserID, session.ID)
	if err != nil || !result.Released || result.State != "stopped" {
		t.Fatalf("资源消失后应确认释放完成: result=%+v err=%v", result, err)
	}
}

func TestStopSessionKeepsStoppingStateWhenDeleteFails(t *testing.T) {
	db := newLabTestDB(t)
	k8s := fake.NewSimpleClientset()
	k8s.PrependReactor("delete", "pods", func(k8stesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("模拟 Pod 删除失败")
	})
	service := NewService(db, zap.NewNop(), nil, k8s, nil)
	session := &UserLabSession{ID: 503, UserID: 11, ContainerName: PodName(503), Status: SessionStatusRunning}
	if err := db.Create(session).Error; err != nil {
		t.Fatalf("创建会话失败: %v", err)
	}
	createRuntimeObjects(t, k8s, session)

	if _, err := service.stopSessionWithWait(context.Background(), session, session.UserID, operations.RuntimeEventStoppedByUser, 0); err == nil {
		t.Fatal("删除失败时应返回错误")
	}
	var refreshed UserLabSession
	if err := db.First(&refreshed, session.ID).Error; err != nil {
		t.Fatalf("重新读取会话失败: %v", err)
	}
	if refreshed.Status != SessionStatusStopping || refreshed.ErrorMessage == "" {
		t.Fatalf("删除失败后应保留释放中状态与错误信息: %+v", refreshed)
	}
}

func keepObjectOnDelete(k8stesting.Action) (bool, runtime.Object, error) {
	return true, nil, nil
}
