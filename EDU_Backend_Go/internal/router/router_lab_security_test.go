package router_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
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

func TestStudentCanRenewLabSessionLease(t *testing.T) {
	fixture := newTestFixture(t)
	if err := fixture.db.AutoMigrate(&lab.UserLabSession{}); err != nil {
		t.Fatalf("auto migrate lab session failed: %v", err)
	}

	leaseBefore := time.Now().Add(time.Minute)
	session := lab.UserLabSession{
		UserID:           fixture.student.ID,
		SourceType:       lab.SourceTypeCourse,
		SourceID:         42,
		ContainerName:    lab.PodName(9902),
		ImageName:        "docker.io/library/opencode-lab:latest",
		Status:           lab.SessionStatusRunning,
		RuntimeMode:      lab.RuntimeModeClassic,
		ClientInstanceID: "browser-a",
		LeaseExpiresAt:   &leaseBefore,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}
	if err := fixture.db.Create(&session).Error; err != nil {
		t.Fatalf("seed lab session failed: %v", err)
	}

	token := mustLogin(t, fixture, fixture.student.Username, "student@123")
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/lab/heartbeat/%d", session.ID), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Lab-Client", "browser-a")
	recorder := httptest.NewRecorder()
	fixture.engine.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected heartbeat 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var refreshed lab.UserLabSession
	if err := fixture.db.First(&refreshed, session.ID).Error; err != nil {
		t.Fatalf("load refreshed lab session failed: %v", err)
	}
	if refreshed.LeaseExpiresAt == nil || !refreshed.LeaseExpiresAt.After(leaseBefore) {
		t.Fatalf("expected lease to be renewed after %s, got %v", leaseBefore, refreshed.LeaseExpiresAt)
	}
}

func TestLabHeartbeatReturnsNotFoundForExpiredSession(t *testing.T) {
	fixture := newTestFixture(t)
	if err := fixture.db.AutoMigrate(&lab.UserLabSession{}); err != nil {
		t.Fatalf("auto migrate lab session failed: %v", err)
	}

	token := mustLogin(t, fixture, fixture.student.Username, "student@123")
	req := httptest.NewRequest(http.MethodPost, "/api/lab/heartbeat/999999", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Lab-Client", "browser-a")
	recorder := httptest.NewRecorder()
	fixture.engine.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected expired heartbeat 404, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"code":"LAB_SESSION_EXPIRED"`) {
		t.Fatalf("expected stable expired-session code, got %s", recorder.Body.String())
	}
}

func TestStudentCanReadOwnedLabReleaseStatus(t *testing.T) {
	fixture := newTestFixture(t)
	if err := fixture.db.AutoMigrate(&lab.UserLabSession{}); err != nil {
		t.Fatalf("auto migrate lab session failed: %v", err)
	}

	session := lab.UserLabSession{
		UserID:        fixture.student.ID,
		SourceType:    lab.SourceTypeCourse,
		SourceID:      43,
		ContainerName: lab.PodName(9903),
		Status:        lab.SessionStatusStopped,
		RuntimeMode:   lab.RuntimeModeClassic,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	if err := fixture.db.Create(&session).Error; err != nil {
		t.Fatalf("seed stopped lab session failed: %v", err)
	}

	token := mustLogin(t, fixture, fixture.student.Username, "student@123")
	resp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/lab/release/%d", session.ID), nil, token)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected release status 200, got %d: %s", resp.Code, resp.Body.String())
	}
	if !strings.Contains(resp.Body.String(), `"released":true`) {
		t.Fatalf("expected released response, got %s", resp.Body.String())
	}
}
