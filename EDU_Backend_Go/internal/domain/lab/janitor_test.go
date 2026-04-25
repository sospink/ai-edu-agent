package lab

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestSweepSessionsStopsExpiredSessionAndDeletesResources(t *testing.T) {
	db := newLabTestDB(t)
	k8s := fake.NewSimpleClientset()
	service := NewService(db, zap.NewNop(), nil, k8s, nil)

	expiredAt := time.Now().Add(-5 * time.Minute)
	session := &UserLabSession{
		ID:            301,
		UserID:        7,
		ContainerName: PodName(301),
		Status:        SessionStatusRunning,
		ExpiresAt:     &expiredAt,
	}
	if err := db.Create(session).Error; err != nil {
		t.Fatalf("create session: %v", err)
	}

	createRuntimeObjects(t, k8s, session)

	if err := service.SweepSessions(context.Background()); err != nil {
		t.Fatalf("sweep sessions: %v", err)
	}

	var refreshed UserLabSession
	if err := db.First(&refreshed, session.ID).Error; err != nil {
		t.Fatalf("reload session: %v", err)
	}
	if refreshed.Status != SessionStatusStopped {
		t.Fatalf("expected stopped session, got %d", refreshed.Status)
	}

	if _, err := k8s.CoreV1().Pods(service.runtimeNamespace()).Get(context.Background(), session.ContainerName, metav1.GetOptions{}); err == nil {
		t.Fatal("expected pod to be deleted")
	}
	if _, err := k8s.CoreV1().Services(service.runtimeNamespace()).Get(context.Background(), ServiceName(session.ID), metav1.GetOptions{}); err == nil {
		t.Fatal("expected service to be deleted")
	}
}

func TestSweepSessionsDeletesOrphanResources(t *testing.T) {
	db := newLabTestDB(t)
	k8s := fake.NewSimpleClientset()
	service := NewService(db, zap.NewNop(), nil, k8s, nil)

	orphan := &UserLabSession{ID: 999, UserID: 1, ContainerName: PodName(999), Status: SessionStatusStopped}
	createRuntimeObjects(t, k8s, orphan)

	if err := service.SweepSessions(context.Background()); err != nil {
		t.Fatalf("sweep sessions: %v", err)
	}

	if _, err := k8s.CoreV1().Pods(service.runtimeNamespace()).Get(context.Background(), orphan.ContainerName, metav1.GetOptions{}); err == nil {
		t.Fatal("expected orphan pod to be deleted")
	}
	if _, err := k8s.CoreV1().Services(service.runtimeNamespace()).Get(context.Background(), ServiceName(orphan.ID), metav1.GetOptions{}); err == nil {
		t.Fatal("expected orphan service to be deleted")
	}
}

func newLabTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "lab-janitor.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&UserLabSession{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	return db
}

func createRuntimeObjects(t *testing.T, k8s *fake.Clientset, session *UserLabSession) {
	t.Helper()

	labels := labLabels(session)
	if _, err := k8s.CoreV1().Pods("edu-runtime-dev").Create(context.Background(), &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      session.ContainerName,
			Namespace: "edu-runtime-dev",
			Labels:    labels,
		},
	}, metav1.CreateOptions{}); err != nil {
		t.Fatalf("create pod: %v", err)
	}
	if _, err := k8s.CoreV1().Services("edu-runtime-dev").Create(context.Background(), &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      ServiceName(session.ID),
			Namespace: "edu-runtime-dev",
			Labels:    labels,
		},
	}, metav1.CreateOptions{}); err != nil {
		t.Fatalf("create service: %v", err)
	}
}
