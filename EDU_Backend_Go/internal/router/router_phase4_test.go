package router_test

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"edu-platform/internal/app"
	"edu-platform/internal/config"
	"edu-platform/internal/domain/agent"
	"edu-platform/internal/domain/lab"
	"edu-platform/internal/domain/project"
	"edu-platform/internal/domain/publishing"
	"edu-platform/internal/domain/user"
	"edu-platform/internal/router"
)

func TestAgentManualAdminAndProgressRoutes(t *testing.T) {
	fixture := newPhase4Fixture(t, "")
	adminToken := mustLogin(t, fixture, fixture.admin.Username, "admin@123")
	studentToken := mustLogin(t, fixture, fixture.student.Username, "student@123")

	createResp := performJSON(t, fixture.engine, http.MethodPost, "/api/agent/admin/manual", map[string]any{
		"sourceType":  1,
		"sourceId":    101,
		"title":       "Go Lab 手册",
		"description": "课程实验说明",
	}, adminToken)
	if createResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for manual create, got %d: %s", createResp.Code, createResp.Body.String())
	}

	var createPayload map[string]any
	decodeJSON(t, createResp.Body.Bytes(), &createPayload)
	manualID := uint64(createPayload["id"].(float64))

	stepsResp := performJSON(t, fixture.engine, http.MethodPost, fmt.Sprintf("/api/agent/admin/manual/%d/steps", manualID), map[string]any{
		"steps": []map[string]any{
			{
				"title": "准备环境",
				"content": []map[string]any{
					{"type": "text", "text": "先检查当前目录"},
				},
				"quickQuestions": []string{"当前目录怎么查看？"},
				"verification": map[string]any{
					"type": "file_exists",
					"path": "/workspace",
				},
			},
			{
				"title": "运行命令",
				"content": []map[string]any{
					{"type": "code", "language": "bash", "code": "ls -la", "executable": true},
				},
				"quickQuestions": []string{"为什么要执行 ls？"},
			},
		},
	}, adminToken)
	if stepsResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for update steps, got %d: %s", stepsResp.Code, stepsResp.Body.String())
	}

	updateResp := performJSON(t, fixture.engine, http.MethodPut, fmt.Sprintf("/api/agent/admin/manual/%d", manualID), map[string]any{
		"title":       "Go Lab 手册 v2",
		"description": "课程实验说明更新版",
		"isPublished": 1,
	}, adminToken)
	if updateResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for update manual, got %d: %s", updateResp.Code, updateResp.Body.String())
	}

	publicResp := performJSON(t, fixture.engine, http.MethodGet, "/api/agent/manual/1/101", nil, studentToken)
	if publicResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for public manual, got %d: %s", publicResp.Code, publicResp.Body.String())
	}

	var manualPayload struct {
		Title string `json:"title"`
		Steps []struct {
			ID             int                     `json:"id"`
			Title          string                  `json:"title"`
			QuickQuestions []string                `json:"quickQuestions"`
			Verification   *agent.VerificationRule `json:"verification"`
		} `json:"steps"`
	}
	decodeJSON(t, publicResp.Body.Bytes(), &manualPayload)
	if manualPayload.Title != "Go Lab 手册 v2" || len(manualPayload.Steps) != 2 {
		t.Fatalf("unexpected manual payload: %+v", manualPayload)
	}
	if manualPayload.Steps[0].ID != 0 || manualPayload.Steps[0].Verification == nil {
		t.Fatalf("unexpected public step mapping: %+v", manualPayload.Steps[0])
	}

	progressResp := performJSON(t, fixture.engine, http.MethodPost, "/api/agent/progress", map[string]any{
		"sourceType":     1,
		"sourceId":       101,
		"currentStep":    1,
		"completedSteps": []int{0},
		"chatHistory": []map[string]any{
			{"role": "user", "content": "我已经执行了命令"},
			{"role": "assistant", "content": "继续下一步"},
		},
	}, studentToken)
	if progressResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for progress update, got %d: %s", progressResp.Code, progressResp.Body.String())
	}

	getProgressResp := performJSON(t, fixture.engine, http.MethodGet, "/api/agent/progress/1/101", nil, studentToken)
	if getProgressResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for progress get, got %d: %s", getProgressResp.Code, getProgressResp.Body.String())
	}

	var progressPayload struct {
		CurrentStep    int                 `json:"currentStep"`
		CompletedSteps []int               `json:"completedSteps"`
		ChatHistory    []agent.ChatMessage `json:"chatHistory"`
	}
	decodeJSON(t, getProgressResp.Body.Bytes(), &progressPayload)
	if progressPayload.CurrentStep != 1 || len(progressPayload.CompletedSteps) != 1 || len(progressPayload.ChatHistory) != 2 {
		t.Fatalf("unexpected progress payload: %+v", progressPayload)
	}
}

func TestAgentAIEndpointsAndPromptEnhance(t *testing.T) {
	mockAI := newMockQwenServer()
	defer mockAI.Close()

	fixture := newPhase4Fixture(t, mockAI.URL)
	token := mustLogin(t, fixture, fixture.student.Username, "student@123")

	chatResp := performJSON(t, fixture.engine, http.MethodPost, "/api/agent/chat", map[string]any{
		"question":    "请解释 Go interface",
		"stepContext": "Go 基础",
	}, token)
	if chatResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for chat, got %d: %s", chatResp.Code, chatResp.Body.String())
	}
	var chatPayload map[string]string
	decodeJSON(t, chatResp.Body.Bytes(), &chatPayload)
	if !strings.Contains(chatPayload["answer"], "Mock AI") {
		t.Fatalf("unexpected chat answer: %+v", chatPayload)
	}

	explainResp := performJSON(t, fixture.engine, http.MethodPost, "/api/agent/explain", map[string]any{
		"code":     "fmt.Println(\"hello\")",
		"language": "go",
	}, token)
	if explainResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for explain, got %d: %s", explainResp.Code, explainResp.Body.String())
	}

	suggestionResp := performJSON(t, fixture.engine, http.MethodPost, "/api/agent/suggestion", map[string]any{
		"errorMessage": "命令执行失败",
		"stepTitle":    "运行 ls",
	}, token)
	if suggestionResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for suggestion, got %d: %s", suggestionResp.Code, suggestionResp.Body.String())
	}
	var suggestionPayload map[string]string
	decodeJSON(t, suggestionResp.Body.Bytes(), &suggestionPayload)
	if !strings.Contains(suggestionPayload["suggestion"], "Mock Suggestion") {
		t.Fatalf("unexpected suggestion: %+v", suggestionPayload)
	}

	promptResp := performJSON(t, fixture.engine, http.MethodPost, "/api/agent/prompt-enhance", map[string]any{
		"rawPrompt": "帮我优化这段提示词",
		"mode":      "通用",
	}, token)
	if promptResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for prompt enhance, got %d: %s", promptResp.Code, promptResp.Body.String())
	}
	var promptPayload apiResponse
	decodeJSON(t, promptResp.Body.Bytes(), &promptPayload)
	if !promptPayload.Success {
		t.Fatalf("expected wrapped success payload, got %+v", promptPayload)
	}
	var enhanced agent.PromptEnhanceResult
	decodeJSON(t, promptPayload.Data, &enhanced)
	if !strings.Contains(enhanced.Content, "优化后提示词") || enhanced.Score != 92 {
		t.Fatalf("unexpected prompt enhance payload: %+v", enhanced)
	}

	streamResp := performJSON(t, fixture.engine, http.MethodPost, "/api/agent/chat/stream", map[string]any{
		"question": "流式输出测试",
	}, token)
	if streamResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for chat stream, got %d: %s", streamResp.Code, streamResp.Body.String())
	}
	body := streamResp.Body.String()
	if !strings.Contains(body, `data: {"content":"第一段回答"}`) || !strings.Contains(body, "data: [DONE]") {
		t.Fatalf("unexpected stream body: %s", body)
	}
}

func TestAgentMarkdownImportAndOpenclawRequiresProjectEntry(t *testing.T) {
	fixture := newPhase4Fixture(t, "")
	adminToken := mustLogin(t, fixture, fixture.admin.Username, "admin@123")
	studentToken := mustLogin(t, fixture, fixture.student.Username, "student@123")

	markdown := "# Docker 实训手册\n\n> 通过 Markdown 导入\n\n## 步骤 1: 检查目录\n\n执行以下命令。\n\n```bash\npwd\n```\n\n<!-- questions: 当前目录在哪里？|为什么要查看目录？ -->\n<!-- verify:file_exists:/workspace -->\n"

	parseResp := performJSON(t, fixture.engine, http.MethodPost, "/api/agent/admin/parse-preview", map[string]any{
		"markdown": markdown,
	}, adminToken)
	if parseResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for parse preview, got %d: %s", parseResp.Code, parseResp.Body.String())
	}
	var parsePayload struct {
		Title string `json:"title"`
		Steps []struct {
			Title          string                  `json:"title"`
			Verification   *agent.VerificationRule `json:"verification"`
			QuickQuestions []string                `json:"quickQuestions"`
		} `json:"steps"`
	}
	decodeJSON(t, parseResp.Body.Bytes(), &parsePayload)
	if parsePayload.Title != "Docker 实训手册" || len(parsePayload.Steps) != 1 || parsePayload.Steps[0].Verification == nil {
		t.Fatalf("unexpected parse payload: %+v", parsePayload)
	}

	importResp := performJSON(t, fixture.engine, http.MethodPost, "/api/agent/admin/import", map[string]any{
		"sourceType": 2,
		"sourceId":   501,
		"markdown":   markdown,
	}, adminToken)
	if importResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for import markdown, got %d: %s", importResp.Code, importResp.Body.String())
	}

	openclawResp := performJSON(t, fixture.engine, http.MethodGet, "/api/openclaw-view/default/phase", nil, studentToken)
	if openclawResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for naked openclaw phase, got %d: %s", openclawResp.Code, openclawResp.Body.String())
	}
}

func TestOpenClawProjectSessionRequiresOpenClawTag(t *testing.T) {
	fixture := newPhase4Fixture(t, "")
	studentToken := mustLogin(t, fixture, fixture.student.Username, "student@123")

	openClawProject := &project.Project{
		Title:      "OpenClaw 场景项目",
		Slug:       "openclaw-scene",
		Status:     project.ProjectStatusPublished,
		Difficulty: 2,
		EnvImage:   "external-openclaw",
	}
	normalProject := &project.Project{
		Title:      "普通项目",
		Slug:       "normal-project",
		Status:     project.ProjectStatusPublished,
		Difficulty: 1,
		EnvImage:   "classic:v1",
	}
	if err := fixture.db.Create(openClawProject).Error; err != nil {
		t.Fatalf("seed openclaw project failed: %v", err)
	}
	if err := fixture.db.Create(normalProject).Error; err != nil {
		t.Fatalf("seed normal project failed: %v", err)
	}
	tag := &project.Tag{Name: "OpenClaw", StyleColor: "#3B82F6"}
	if err := fixture.db.Create(tag).Error; err != nil {
		t.Fatalf("seed openclaw tag failed: %v", err)
	}
	if err := fixture.db.Create(&project.ProjectTag{ProjectID: openClawProject.ID, TagID: tag.ID}).Error; err != nil {
		t.Fatalf("seed project tag failed: %v", err)
	}

	okResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/openclaw-view/project:%d:unit:7/phase", openClawProject.ID), nil, studentToken)
	if okResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for openclaw project session, got %d: %s", okResp.Code, okResp.Body.String())
	}

	normalResp := performJSON(t, fixture.engine, http.MethodGet, fmt.Sprintf("/api/openclaw-view/project:%d/phase", normalProject.ID), nil, studentToken)
	if normalResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for normal project session, got %d: %s", normalResp.Code, normalResp.Body.String())
	}

	spoofResp := performJSON(t, fixture.engine, http.MethodPost, "/api/openclaw-view/chat/send", map[string]any{
		"text":       "hello",
		"sessionId":  fmt.Sprintf("project:%d", openClawProject.ID),
		"sessionKey": "agent:main:default",
	}, studentToken)
	if spoofResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for spoofed sessionKey, got %d: %s", spoofResp.Code, spoofResp.Body.String())
	}
}

func TestOpenClawViewRequiresOwnedOpenClawSession(t *testing.T) {
	fixture := newPhase4Fixture(t, "")
	adminToken := mustLogin(t, fixture, fixture.admin.Username, "admin@123")
	studentToken := mustLogin(t, fixture, fixture.student.Username, "student@123")

	ownedOpenClaw := &lab.UserLabSession{
		ID:            101,
		UserID:        fixture.student.ID,
		RuntimeMode:   lab.RuntimeModeOpenClaw,
		Status:        lab.SessionStatusRunning,
		ContainerName: "lab-session-101",
	}
	foreignOpenClaw := &lab.UserLabSession{
		ID:            102,
		UserID:        fixture.admin.ID,
		RuntimeMode:   lab.RuntimeModeOpenClaw,
		Status:        lab.SessionStatusRunning,
		ContainerName: "lab-session-102",
	}
	classicSession := &lab.UserLabSession{
		ID:            103,
		UserID:        fixture.student.ID,
		RuntimeMode:   lab.RuntimeModeClassic,
		Status:        lab.SessionStatusRunning,
		ContainerName: "lab-session-103",
	}
	for _, session := range []*lab.UserLabSession{ownedOpenClaw, foreignOpenClaw, classicSession} {
		if err := fixture.db.Create(session).Error; err != nil {
			t.Fatalf("seed lab session failed: %v", err)
		}
	}

	ownedResp := performJSON(t, fixture.engine, http.MethodGet, "/api/openclaw-view/101/phase", nil, studentToken)
	if ownedResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for owned openclaw session, got %d: %s", ownedResp.Code, ownedResp.Body.String())
	}

	foreignResp := performJSON(t, fixture.engine, http.MethodGet, "/api/openclaw-view/102/phase", nil, studentToken)
	if foreignResp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for foreign openclaw session, got %d: %s", foreignResp.Code, foreignResp.Body.String())
	}

	classicResp := performJSON(t, fixture.engine, http.MethodGet, "/api/openclaw-view/103/phase", nil, studentToken)
	if classicResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for classic session, got %d: %s", classicResp.Code, classicResp.Body.String())
	}

	adminOwnedResp := performJSON(t, fixture.engine, http.MethodGet, "/api/openclaw-view/102/phase", nil, adminToken)
	if adminOwnedResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin-owned openclaw session, got %d: %s", adminOwnedResp.Code, adminOwnedResp.Body.String())
	}
}

func TestTeacherAndAdminPortalRoutes(t *testing.T) {
	fixture := newPhase4Fixture(t, "")
	teacher, err := fixture.service.Create(user.CreateParams{
		Username: "teacher01",
		Email:    "teacher01@example.com",
		Password: "teacher@123",
		FullName: "测试教师",
		RoleType: user.RoleTeacher,
	})
	if err != nil {
		t.Fatalf("seed teacher failed: %v", err)
	}

	studentToken := mustLogin(t, fixture, fixture.student.Username, "student@123")
	teacherToken := mustLogin(t, fixture, teacher.Username, "teacher@123")
	adminToken := mustLogin(t, fixture, fixture.admin.Username, "admin@123")

	studentTeacherResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/manuals?page=1&pageSize=10", nil, studentToken)
	if studentTeacherResp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for student teacher portal access, got %d", studentTeacherResp.Code)
	}

	teacherResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/manuals?page=1&pageSize=10", nil, teacherToken)
	if teacherResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for teacher manual list, got %d: %s", teacherResp.Code, teacherResp.Body.String())
	}

	adminTeacherResp := performJSON(t, fixture.engine, http.MethodGet, "/api/teacher/manuals?page=1&pageSize=10", nil, adminToken)
	if adminTeacherResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin teacher portal access, got %d: %s", adminTeacherResp.Code, adminTeacherResp.Body.String())
	}

	teacherAdminResp := performJSON(t, fixture.engine, http.MethodGet, "/api/admin/rbac/policies", nil, teacherToken)
	if teacherAdminResp.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for teacher admin portal access, got %d", teacherAdminResp.Code)
	}

	adminRbacResp := performJSON(t, fixture.engine, http.MethodGet, "/api/admin/rbac/policies", nil, adminToken)
	if adminRbacResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin rbac policies, got %d: %s", adminRbacResp.Code, adminRbacResp.Body.String())
	}

	adminSettingsResp := performJSON(t, fixture.engine, http.MethodGet, "/api/admin/settings", nil, adminToken)
	if adminSettingsResp.Code != http.StatusOK {
		t.Fatalf("expected 200 for admin settings, got %d: %s", adminSettingsResp.Code, adminSettingsResp.Body.String())
	}
}

func newPhase4Fixture(t *testing.T, aiBaseURL string) *testFixture {
	t.Helper()

	gin.SetMode(gin.TestMode)

	dbPath := filepath.Join(t.TempDir(), "phase4-test.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	if err := db.AutoMigrate(
		&user.User{},
		&agent.AgentManual{},
		&agent.AgentStep{},
		&agent.UserAgentProgress{},
		&lab.UserLabSession{},
		&project.Project{},
		&project.ProjectUnit{},
		&project.Tag{},
		&project.ProjectTag{},
		&publishing.LabTemplate{},
		&publishing.ContentPublishCheck{},
		&publishing.PublishAuditLog{},
	); err != nil {
		t.Fatalf("auto migrate phase4 models failed: %v", err)
	}

	userService := user.NewService(db, zap.NewNop())
	admin, err := userService.Create(user.CreateParams{
		Username: "admin",
		Email:    "admin@example.com",
		Password: "admin@123",
		FullName: "系统管理员",
		RoleType: user.RoleAdmin,
	})
	if err != nil {
		t.Fatalf("seed admin failed: %v", err)
	}
	student, err := userService.Create(user.CreateParams{
		Username:  "student01",
		Email:     "student01@example.com",
		Password:  "student@123",
		FullName:  "测试学生",
		StudentID: "S1001",
		RoleType:  user.RoleStudent,
	})
	if err != nil {
		t.Fatalf("seed student failed: %v", err)
	}

	cfg := &config.Config{
		App: config.AppConfig{
			Name:    "edu-platform-test",
			Env:     "test",
			Version: "test",
		},
		JWT: config.JWTConfig{
			Secret:    "test-secret",
			Issuer:    "edu-platform-test",
			ExpiresIn: "7d",
		},
		Upload: config.UploadConfig{
			Root: filepath.Join(t.TempDir(), "uploads"),
		},
		Qwen: config.QwenConfig{
			APIKey:  "mock-key",
			BaseURL: aiBaseURL,
			Model:   "qwen-test",
		},
	}

	engine := router.New(app.Dependencies{
		Config:   cfg,
		Logger:   zap.NewNop(),
		DB:       db,
		Enforcer: mustTestEnforcer(t),
	})

	return &testFixture{
		engine:  engine,
		db:      db,
		service: userService,
		admin:   admin,
		student: student,
	}
}

func newMockQwenServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		raw, _ := io.ReadAll(r.Body)

		var req struct {
			Stream   bool `json:"stream"`
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		_ = json.Unmarshal(raw, &req)

		if req.Stream {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"content\":\"第一段回答\"}}]}\n\n")
			_, _ = io.WriteString(w, "data: {\"choices\":[{\"delta\":{\"content\":\"第二段回答\"}}]}\n\n")
			_, _ = io.WriteString(w, "data: [DONE]\n\n")
			return
		}

		lastUser := ""
		for i := len(req.Messages) - 1; i >= 0; i-- {
			if req.Messages[i].Role == "user" {
				lastUser = req.Messages[i].Content
				break
			}
		}

		content := "Mock AI 回答"
		switch {
		case strings.Contains(lastUser, "请解释这段"):
			content = "Mock Explanation: 这段代码会输出 hello"
		case strings.Contains(lastUser, "验证错误信息"):
			content = "Mock Suggestion: 请检查命令执行目录与文件路径。"
		case strings.Contains(lastUser, "请优化以下原始提示词"):
			content = `{"content":"# 优化后提示词\n请作为高级助手执行任务。","score":92,"suggestions":["补充输出格式","增加边界条件"]}`
		default:
			content = "Mock AI 回答: " + lastUser
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{
				{
					"message": map[string]any{
						"content": content,
					},
				},
			},
			"usage": map[string]any{
				"total_tokens": 321,
			},
		})
	}))
}
