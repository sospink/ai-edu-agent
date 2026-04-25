package router_test

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
	"k8s.io/client-go/rest"

	"edu-platform/internal/app"
	"edu-platform/internal/config"
	"edu-platform/internal/domain/classroom"
	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/lab"
	"edu-platform/internal/domain/operations"
	"edu-platform/internal/router"
)

func TestM6QuotaBlocksClassicLabAndRecordsEvent(t *testing.T) {
	fixture := newM6OperationsFixture(t)
	studentToken := mustLogin(t, fixture.auth, fixture.auth.student.Username, "student@123")
	courseRecord := seedM6Course(t, fixture)

	expiresAt := time.Now().Add(time.Hour)
	existing := lab.UserLabSession{
		ID:            701,
		UserID:        fixture.auth.student.ID,
		SourceType:    lab.SourceTypeCourse,
		SourceID:      courseRecord.ID,
		ContainerName: lab.PodName(701),
		ImageName:     courseRecord.EnvImage,
		Status:        lab.SessionStatusRunning,
		RuntimeMode:   lab.RuntimeModeClassic,
		ExpiresAt:     &expiresAt,
	}
	if err := fixture.auth.db.Create(&existing).Error; err != nil {
		t.Fatalf("seed running session failed: %v", err)
	}

	resp := performJSON(t, fixture.auth.engine, http.MethodPost, "/api/lab/create", map[string]any{
		"sourceType": lab.SourceTypeCourse,
		"sourceId":   courseRecord.ID,
	}, studentToken)
	if resp.Code != http.StatusBadRequest || !strings.Contains(resp.Body.String(), "并发上限") {
		t.Fatalf("expected quota block 400, got %d: %s", resp.Code, resp.Body.String())
	}

	var blockedEvents []operations.RuntimeSessionEvent
	if err := fixture.auth.db.Where("user_id = ? AND event_type = ?", fixture.auth.student.ID, operations.RuntimeEventCreateBlockedQuota).Find(&blockedEvents).Error; err != nil {
		t.Fatalf("load blocked events failed: %v", err)
	}
	if len(blockedEvents) != 1 {
		t.Fatalf("expected one quota blocked event, got %+v", blockedEvents)
	}
}

func TestM6QuotaResolutionPriorityAndDisabledGlobal(t *testing.T) {
	fixture := newM6OperationsFixture(t)
	service := operations.NewService(fixture.auth.db, zap.NewNop())
	if err := service.EnsureDefaultQuota(t.Context()); err != nil {
		t.Fatalf("ensure default quota failed: %v", err)
	}

	term := classroom.Term{Name: "M6 学期", Code: "M6-SPRING", Status: classroom.TermStatusActive, CreatedBy: fixture.auth.admin.ID}
	if err := fixture.auth.db.Create(&term).Error; err != nil {
		t.Fatalf("seed term failed: %v", err)
	}
	classA := classroom.Class{TermID: term.ID, Name: "M6 A 班", Code: "M6-A", OwnerTeacherID: fixture.auth.admin.ID, Status: classroom.ClassStatusActive, CreatedBy: fixture.auth.admin.ID}
	classB := classroom.Class{TermID: term.ID, Name: "M6 B 班", Code: "M6-B", OwnerTeacherID: fixture.auth.admin.ID, Status: classroom.ClassStatusActive, CreatedBy: fixture.auth.admin.ID}
	if err := fixture.auth.db.Create(&[]classroom.Class{classA, classB}).Error; err != nil {
		t.Fatalf("seed classes failed: %v", err)
	}
	if err := fixture.auth.db.First(&classA, "code = ?", "M6-A").Error; err != nil {
		t.Fatalf("reload class A failed: %v", err)
	}
	if err := fixture.auth.db.First(&classB, "code = ?", "M6-B").Error; err != nil {
		t.Fatalf("reload class B failed: %v", err)
	}
	now := time.Now()
	if err := fixture.auth.db.Create(&[]classroom.ClassMember{
		{ClassID: classA.ID, UserID: fixture.auth.student.ID, Status: classroom.ClassMemberStatusActive, JoinedAt: &now},
		{ClassID: classB.ID, UserID: fixture.auth.student.ID, Status: classroom.ClassMemberStatusActive, JoinedAt: &now},
	}).Error; err != nil {
		t.Fatalf("seed class members failed: %v", err)
	}

	enabled := true
	if _, err := service.CreateQuota(t.Context(), fixture.auth.admin.ID, operations.QuotaInput{ScopeType: operations.QuotaScopeClass, ScopeID: classA.ID, Name: "A 班宽松配额", MaxConcurrentSessions: 3, MaxSessionMinutes: 90, Enabled: &enabled}); err != nil {
		t.Fatalf("create class A quota failed: %v", err)
	}
	if _, err := service.CreateQuota(t.Context(), fixture.auth.admin.ID, operations.QuotaInput{ScopeType: operations.QuotaScopeClass, ScopeID: classB.ID, Name: "B 班严格配额", MaxConcurrentSessions: 2, MaxSessionMinutes: 45, Enabled: &enabled}); err != nil {
		t.Fatalf("create class B quota failed: %v", err)
	}
	classResolved, err := service.ResolveQuotaForUser(t.Context(), fixture.auth.student.ID)
	if err != nil {
		t.Fatalf("resolve class quota failed: %v", err)
	}
	if classResolved.Source != operations.QuotaScopeClass || classResolved.MaxConcurrentSessions != 2 || classResolved.MaxSessionMinutes != 45 {
		t.Fatalf("expected strictest class quota, got %+v", classResolved)
	}

	if _, err := service.CreateQuota(t.Context(), fixture.auth.admin.ID, operations.QuotaInput{ScopeType: operations.QuotaScopeUser, ScopeID: fixture.auth.student.ID, Name: "学生个人配额", MaxConcurrentSessions: 5, MaxSessionMinutes: 30, Enabled: &enabled}); err != nil {
		t.Fatalf("create user quota failed: %v", err)
	}
	userResolved, err := service.ResolveQuotaForUser(t.Context(), fixture.auth.student.ID)
	if err != nil {
		t.Fatalf("resolve user quota failed: %v", err)
	}
	if userResolved.Source != operations.QuotaScopeUser || userResolved.MaxConcurrentSessions != 5 {
		t.Fatalf("expected user quota priority, got %+v", userResolved)
	}

	var global operations.ResourceQuota
	if err := fixture.auth.db.Where("scope_type = ? AND scope_id = 0", operations.QuotaScopeGlobal).First(&global).Error; err != nil {
		t.Fatalf("load global quota failed: %v", err)
	}
	if _, err := service.SetQuotaStatus(t.Context(), fixture.auth.admin.ID, global.ID, false); err != nil {
		t.Fatalf("disable global quota failed: %v", err)
	}
	noClassStudent := fixture.auth.admin.ID
	resolvedNoGlobal, err := service.ResolveQuotaForUser(t.Context(), noClassStudent)
	if err != nil {
		t.Fatalf("resolve disabled global failed: %v", err)
	}
	if !resolvedNoGlobal.UnlimitedConcurrent || resolvedNoGlobal.MaxSessionMinutes != operations.DefaultSessionMinutes {
		t.Fatalf("expected disabled global to allow unlimited concurrent with default ttl, got %+v", resolvedNoGlobal)
	}
}

func TestM6RuntimeStopIsIdempotentAndAudited(t *testing.T) {
	fixture := newM6OperationsFixture(t)
	adminToken := mustLogin(t, fixture.auth, fixture.auth.admin.Username, "admin@123")
	courseRecord := seedM6Course(t, fixture)

	expiresAt := time.Now().Add(time.Hour)
	session := lab.UserLabSession{
		ID:            801,
		UserID:        fixture.auth.student.ID,
		SourceType:    lab.SourceTypeCourse,
		SourceID:      courseRecord.ID,
		ContainerName: lab.PodName(801),
		ImageName:     courseRecord.EnvImage,
		Status:        lab.SessionStatusRunning,
		RuntimeMode:   lab.RuntimeModeClassic,
		ExpiresAt:     &expiresAt,
	}
	if err := fixture.auth.db.Create(&session).Error; err != nil {
		t.Fatalf("seed session failed: %v", err)
	}

	stopResp := performJSON(t, fixture.auth.engine, http.MethodPost, "/api/admin/runtime-sessions/801/stop", nil, adminToken)
	assertStopReason(t, stopResp, true, "stopped")
	secondResp := performJSON(t, fixture.auth.engine, http.MethodPost, "/api/admin/runtime-sessions/801/stop", nil, adminToken)
	assertStopReason(t, secondResp, false, "already_stopped")
	missingResp := performJSON(t, fixture.auth.engine, http.MethodPost, "/api/admin/runtime-sessions/999999/stop", nil, adminToken)
	assertStopReason(t, missingResp, false, "not_found")

	var refreshed lab.UserLabSession
	if err := fixture.auth.db.First(&refreshed, 801).Error; err != nil {
		t.Fatalf("reload stopped session failed: %v", err)
	}
	if refreshed.Status != lab.SessionStatusStopped {
		t.Fatalf("expected session stopped, got %+v", refreshed)
	}
	var events []operations.RuntimeSessionEvent
	if err := fixture.auth.db.Where("session_id = ? AND event_type = ?", 801, operations.RuntimeEventStoppedByAdmin).Find(&events).Error; err != nil {
		t.Fatalf("load stop events failed: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected one stopped_by_admin event, got %+v", events)
	}
	var auditCount int64
	if err := fixture.auth.db.Model(&operations.AuditLog{}).Where("action = ?", operations.AuditActionSessionStop).Count(&auditCount).Error; err != nil {
		t.Fatalf("count audit logs failed: %v", err)
	}
	if auditCount < 3 {
		t.Fatalf("expected stop/noop audit logs, got %d", auditCount)
	}
}

func TestM6AdminOperationsRequireAdmin(t *testing.T) {
	fixture := newM6OperationsFixture(t)
	studentToken := mustLogin(t, fixture.auth, fixture.auth.student.Username, "student@123")
	resp := performJSON(t, fixture.auth.engine, http.MethodGet, "/api/admin/resource-quotas", nil, studentToken)
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected student forbidden for quotas, got %d: %s", resp.Code, resp.Body.String())
	}
}

type m6OperationsFixture struct {
	auth *testFixture
	k8s  *fake.Clientset
}

func newM6OperationsFixture(t *testing.T) *m6OperationsFixture {
	t.Helper()
	authFixture := newTestFixture(t)
	if err := authFixture.db.AutoMigrate(
		&course.Course{},
		&lab.UserLabSession{},
		&classroom.Term{},
		&classroom.Class{},
		&classroom.ClassMember{},
		&operations.ResourceQuota{},
		&operations.RuntimeSessionEvent{},
		&operations.AuditLog{},
	); err != nil {
		t.Fatalf("auto migrate m6 models failed: %v", err)
	}

	k8s := fake.NewSimpleClientset(&corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "edu-runtime-dev"}})
	cfg := &config.Config{
		App:    config.AppConfig{Name: "edu-platform-test", Env: "test", Version: "test"},
		JWT:    config.JWTConfig{Secret: "test-secret", Issuer: "edu-platform-test", ExpiresIn: "7d"},
		Upload: config.UploadConfig{Root: filepath.Join(t.TempDir(), "uploads")},
		K8S:    config.K8SConfig{Enabled: true, Namespace: "edu-backend-go-dev", RuntimeNamespace: "edu-runtime-dev"},
	}
	authFixture.engine = router.New(app.Dependencies{
		Config:   cfg,
		Logger:   zap.NewNop(),
		DB:       authFixture.db,
		K8S:      k8s,
		K8SRest:  &rest.Config{Host: "https://example.invalid"},
		Enforcer: mustTestEnforcer(t),
	})
	return &m6OperationsFixture{auth: authFixture, k8s: k8s}
}

func seedM6Course(t *testing.T, fixture *m6OperationsFixture) course.Course {
	t.Helper()
	record := course.Course{
		Title:    "M6 Classic Lab 课",
		Slug:     "m6-classic-lab",
		Status:   course.CourseStatusPublished,
		EnvImage: "registry.cn/edu/m6-classic:v1",
	}
	if err := fixture.auth.db.Create(&record).Error; err != nil {
		t.Fatalf("seed m6 course failed: %v", err)
	}
	return record
}

func assertStopReason(t *testing.T, resp *httptest.ResponseRecorder, stopped bool, reason string) {
	t.Helper()
	if resp.Code != http.StatusOK {
		t.Fatalf("expected stop 200, got %d: %s", resp.Code, resp.Body.String())
	}
	var payload apiResponse
	decodeJSON(t, resp.Body.Bytes(), &payload)
	var data struct {
		Stopped bool   `json:"stopped"`
		Reason  string `json:"reason"`
	}
	decodeJSON(t, payload.Data, &data)
	if data.Stopped != stopped || data.Reason != reason {
		t.Fatalf("expected stopped=%v reason=%s, got %+v", stopped, reason, data)
	}
}
