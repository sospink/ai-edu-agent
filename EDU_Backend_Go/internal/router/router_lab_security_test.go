package router_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"edu-platform/internal/domain/lab"
	"edu-platform/internal/domain/user"
)

func TestLabProxyRejectsForeignSession(t *testing.T) {
	fixture := newTestFixture(t)
	if err := fixture.db.AutoMigrate(&lab.UserLabSession{}); err != nil {
		t.Fatalf("auto migrate lab session failed: %v", err)
	}
	foreignUser, err := fixture.service.Create(user.CreateParams{
		Username: "student02",
		Email:    "student02@example.com",
		Password: "student@123",
		FullName: "另一个学生",
		RoleType: user.RoleStudent,
	})
	if err != nil {
		t.Fatalf("seed foreign user failed: %v", err)
	}
	session := lab.UserLabSession{
		ID:            9901,
		UserID:        foreignUser.ID,
		SourceType:    lab.SourceTypeCourse,
		SourceID:      34,
		ContainerName: lab.PodName(9901),
		ImageName:     "docker.io/library/opencode-lab:latest",
		VNCPort:       uint(lab.NoVNCPort),
		Status:        lab.SessionStatusRunning,
		RuntimeMode:   lab.RuntimeModeClassic,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	if err := fixture.db.Create(&session).Error; err != nil {
		t.Fatalf("seed foreign lab session failed: %v", err)
	}

	studentToken := mustLogin(t, fixture, fixture.student.Username, "student@123")
	resp := performJSON(t, fixture.engine, http.MethodGet, "/api/lab/proxy/9901/novnc/vnc.html", nil, studentToken)
	if resp.Code != http.StatusNotFound && resp.Code != http.StatusForbidden {
		t.Fatalf("expected foreign session proxy to be blocked, got %d: %s", resp.Code, resp.Body.String())
	}
	if strings.Contains(resp.Body.String(), "Gateway 代理失败") {
		t.Fatalf("expected request to be blocked before proxying upstream, got %s", resp.Body.String())
	}
}
