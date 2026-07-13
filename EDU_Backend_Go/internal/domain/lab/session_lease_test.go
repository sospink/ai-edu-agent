package lab

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestSessionLeaseRejectsAnotherBrowserAndAllowsExpiredTakeover(t *testing.T) {
	db := newLabTestDB(t)
	service := NewService(db, zap.NewNop(), nil, fake.NewSimpleClientset(), nil)
	leaseUntil := time.Now().Add(time.Minute)
	session := &UserLabSession{UserID: 7, Status: SessionStatusRunning, ClientInstanceID: "browser-a", LeaseExpiresAt: &leaseUntil}
	if err := db.Create(session).Error; err != nil {
		t.Fatalf("create session: %v", err)
	}

	if err := service.claimSessionLease(context.Background(), session, "browser-a"); err != nil {
		t.Fatalf("same browser should renew lease: %v", err)
	}
	if err := service.claimSessionLease(context.Background(), session, "browser-b"); !errors.Is(err, ErrSessionInUse) {
		t.Fatalf("expected session-in-use error, got %v", err)
	}

	expired := time.Now().Add(-time.Minute)
	if err := db.Model(session).Updates(map[string]any{"lease_expires_at": expired}).Error; err != nil {
		t.Fatalf("expire lease: %v", err)
	}
	if err := service.claimSessionLease(context.Background(), session, "browser-b"); err != nil {
		t.Fatalf("expired lease should allow takeover: %v", err)
	}
}

func TestSessionLeaseOwnershipHandlesIdempotentRenewal(t *testing.T) {
	now := time.Now()
	activeUntil := now.Add(time.Minute)
	expiredAt := now.Add(-time.Second)

	tests := []struct {
		name     string
		session  *UserLabSession
		clientID string
		want     bool
	}{
		{
			name:     "同一客户端的有效租约",
			session:  &UserLabSession{ClientInstanceID: "browser-a", LeaseExpiresAt: &activeUntil},
			clientID: "browser-a",
			want:     true,
		},
		{
			name:     "不同客户端",
			session:  &UserLabSession{ClientInstanceID: "browser-a", LeaseExpiresAt: &activeUntil},
			clientID: "browser-b",
			want:     false,
		},
		{
			name:     "同一客户端但租约已过期",
			session:  &UserLabSession{ClientInstanceID: "browser-a", LeaseExpiresAt: &expiredAt},
			clientID: "browser-a",
			want:     false,
		},
		{
			name:     "租约缺失",
			session:  &UserLabSession{ClientInstanceID: "browser-a"},
			clientID: "browser-a",
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := sessionLeaseOwnedByClient(tt.session, tt.clientID, now); got != tt.want {
				t.Fatalf("sessionLeaseOwnedByClient() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSyncSessionStatusMarksOOMKilledAsError(t *testing.T) {
	db := newLabTestDB(t)
	session := &UserLabSession{ID: 402, UserID: 8, ContainerName: PodName(402), Status: SessionStatusRunning}
	if err := db.Create(session).Error; err != nil {
		t.Fatalf("create session: %v", err)
	}
	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{Name: session.ContainerName, Namespace: "edu-runtime-dev"},
		Status: corev1.PodStatus{
			Phase: corev1.PodRunning,
			ContainerStatuses: []corev1.ContainerStatus{{
				Name:  MainContainerName,
				State: corev1.ContainerState{Terminated: &corev1.ContainerStateTerminated{Reason: "OOMKilled", ExitCode: 137}},
			}},
		},
	}
	service := NewService(db, zap.NewNop(), nil, fake.NewSimpleClientset(pod), nil)
	if err := service.SyncSessionStatus(context.Background(), session); err != nil {
		t.Fatalf("sync session: %v", err)
	}
	if session.Status != SessionStatusError {
		t.Fatalf("expected error status, got %d", session.Status)
	}
	if !strings.Contains(session.ErrorMessage, "内存不足") {
		t.Fatalf("expected actionable OOM message, got %q", session.ErrorMessage)
	}
}
