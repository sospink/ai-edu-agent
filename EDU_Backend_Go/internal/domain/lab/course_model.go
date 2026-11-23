package lab

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	gjwt "github.com/golang-jwt/jwt/v5"

	"edu-platform/internal/domain/course"
	"edu-platform/internal/domain/llm"
	"edu-platform/internal/domain/operations"
)

const PromptWorkbenchSlug = "prompt-workbench"
const PromptWorkbenchDirectory = "/workspace/prompt-workbench"

type courseModelClaims struct {
	SessionID uint64 `json:"sessionId"`
	UserID    uint64 `json:"userId"`
	gjwt.RegisteredClaims
}

type courseModelBudget struct {
	Window  time.Time
	Count   int
	Total   int
	Active  bool
	Expires time.Time
}

type CourseModelGateway struct {
	lab      *Service
	settings *llm.Store
	client   *http.Client
	mu       sync.Mutex
	budgets  map[uint64]*courseModelBudget
	slots    chan struct{}
}

func NewCourseModelGateway(service *Service, settings *llm.Store) *CourseModelGateway {
	g := &CourseModelGateway{lab: service, settings: settings, client: llm.NewHTTPClient(), budgets: make(map[uint64]*courseModelBudget), slots: make(chan struct{}, 2)}
	service.courseModel = g
	return g
}

func (s *Service) WorkspaceDirectory(session *UserLabSession) string {
	if session == nil || session.SourceType != SourceTypeCourse || s.db == nil {
		return ""
	}
	var count int64
	if s.db.Model(&course.Course{}).Where("id = ? AND slug = ?", session.SourceID, PromptWorkbenchSlug).Count(&count).Error == nil && count == 1 {
		return PromptWorkbenchDirectory
	}
	return ""
}

func (s *Service) WorkspaceExecCommand(session *UserLabSession, command []string) []string {
	if s.WorkspaceDirectory(session) != "" {
		return append([]string{"/usr/sbin/runuser", "-u", "student", "--"}, command...)
	}
	return command
}

func (s *Service) courseProxyAccessToken(session *UserLabSession, target string) (string, error) {
	if target != appPortName("workbench") || s.WorkspaceDirectory(session) == "" {
		return "", nil
	}
	if s.courseModel == nil {
		return "", errors.New("课程访问配置不可用")
	}
	return s.courseModel.token(session)
}

func (g *CourseModelGateway) signingKey() []byte {
	key := sha256.Sum256([]byte("agent-edu/course-model/v1\x00" + g.lab.cfg.JWT.Secret + "\x00" + g.lab.cfg.K8S.RuntimeNamespace))
	return key[:]
}

func (g *CourseModelGateway) token(session *UserLabSession) (string, error) {
	// 使用数据库回读后的时间精度，保证容器初始化和后续代理生成同一凭证。
	var persisted UserLabSession
	if session == nil || g.lab.db.Where("id = ? AND user_id = ?", session.ID, session.UserID).First(&persisted).Error != nil {
		return "", errors.New("课程会话记录不可用")
	}
	session = &persisted
	if session.ExpiresAt == nil || g.lab.cfg.JWT.Secret == "" {
		return "", errors.New("课程模型凭证配置缺失")
	}
	claims := courseModelClaims{SessionID: session.ID, UserID: session.UserID, RegisteredClaims: gjwt.RegisteredClaims{
		Issuer: "agent-edu-course-model", Audience: gjwt.ClaimStrings{"course-model"}, IssuedAt: gjwt.NewNumericDate(session.CreatedAt), ExpiresAt: gjwt.NewNumericDate(*session.ExpiresAt),
	}}
	return gjwt.NewWithClaims(gjwt.SigningMethodHS256, claims).SignedString(g.signingKey())
}

func (g *CourseModelGateway) publicURL() (string, error) {
	if raw := strings.TrimSpace(g.lab.cfg.CourseLab.ModelGatewayURL); raw != "" {
		u, err := url.Parse(raw)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil {
			return "", errors.New("课程模型网关地址无效")
		}
		return strings.TrimRight(raw, "/"), nil
	}
	for _, origin := range g.lab.cfg.Security.AllowedOrigins {
		u, err := url.Parse(origin)
		if err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Hostname() != "localhost" && u.Hostname() != "127.0.0.1" && u.Host != "" {
			return strings.TrimRight(origin, "/") + "/api/course-model/v1", nil
		}
	}
	return "", errors.New("未配置课程模型网关地址")
}

func (g *CourseModelGateway) authenticate(c *gin.Context) (*UserLabSession, error) {
	raw := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
	claims := &courseModelClaims{}
	_, err := gjwt.ParseWithClaims(raw, claims, func(*gjwt.Token) (any, error) { return g.signingKey(), nil }, gjwt.WithValidMethods([]string{"HS256"}), gjwt.WithIssuer("agent-edu-course-model"), gjwt.WithAudience("course-model"), gjwt.WithExpirationRequired())
	if err != nil {
		return nil, errors.New("课程凭证无效或已过期")
	}
	var session UserLabSession
	if err := g.lab.db.WithContext(c.Request.Context()).Where("id = ? AND user_id = ? AND status = ?", claims.SessionID, claims.UserID, SessionStatusRunning).First(&session).Error; err != nil {
		return nil, errors.New("实训会话已结束")
	}
	if session.ExpiresAt == nil || !session.ExpiresAt.After(time.Now()) || g.lab.WorkspaceDirectory(&session) == "" {
		return nil, errors.New("此会话无课程模型权限")
	}
	var activeUsers int64
	if err := g.lab.db.Table("sys_users").Where("id = ? AND status = 1", session.UserID).Count(&activeUsers).Error; err != nil || activeUsers != 1 {
		return nil, errors.New("用户不可用")
	}
	var published int64
	if err := g.lab.db.Model(&course.Course{}).Where("id = ? AND status = ?", session.SourceID, course.CourseStatusPublished).Count(&published).Error; err != nil || published != 1 {
		return nil, errors.New("课程未发布")
	}
	return &session, nil
}

func courseModelError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": gin.H{"type": code, "message": message}})
}

func (g *CourseModelGateway) Models(c *gin.Context) {
	if _, err := g.authenticate(c); err != nil {
		courseModelError(c, 401, "invalid_session", "Lab credentials expired or unavailable")
		return
	}
	if !g.aiEnabled(c.Request.Context()) {
		courseModelError(c, 503, "ai_disabled", "AI assistance is disabled")
		return
	}
	cfg, _, err := g.settings.Snapshot(c.Request.Context())
	if err != nil || cfg.APIKey == "" {
		courseModelError(c, 503, "model_unavailable", "The course model is not configured")
		return
	}
	c.Header("Cache-Control", "no-store")
	c.JSON(200, gin.H{"object": "list", "data": []gin.H{{"id": cfg.Model, "object": "model", "owned_by": "course", "capabilities": gin.H{"temperature": false, "topP": false, "maxTokens": true}, "maxOutputTokens": 4096}}})
}

func (g *CourseModelGateway) aiEnabled(ctx context.Context) bool {
	var setting struct{ Enabled bool }
	return g.lab.db.WithContext(ctx).Table("ai_feature_settings").Where("id = 1").Take(&setting).Error == nil && setting.Enabled
}

func (g *CourseModelGateway) acquire(session *UserLabSession) (func(), bool) {
	g.mu.Lock()
	defer g.mu.Unlock()
	now := time.Now()
	for id, b := range g.budgets {
		if b.Expires.Before(now) && !b.Active {
			delete(g.budgets, id)
		}
	}
	b := g.budgets[session.ID]
	if b == nil {
		b = &courseModelBudget{Window: now, Expires: *session.ExpiresAt}
		g.budgets[session.ID] = b
	}
	if now.Sub(b.Window) >= time.Minute {
		b.Window = now
		b.Count = 0
	}
	if b.Active || b.Count >= 20 || b.Total >= 400 {
		return nil, false
	}
	select {
	case g.slots <- struct{}{}:
	default:
		return nil, false
	}
	b.Active = true
	b.Count++
	b.Total++
	return func() { g.mu.Lock(); b.Active = false; <-g.slots; g.mu.Unlock() }, true
}

func (g *CourseModelGateway) Chat(c *gin.Context) {
	session, err := g.authenticate(c)
	if err != nil {
		courseModelError(c, 401, "invalid_session", "Lab credentials expired or unavailable")
		return
	}
	if !g.aiEnabled(c.Request.Context()) {
		courseModelError(c, 503, "ai_disabled", "AI assistance is disabled")
		return
	}
	release, ok := g.acquire(session)
	if !ok {
		c.Header("Retry-After", "10")
		courseModelError(c, 429, "course_limit", "Course model concurrency or request limit reached")
		return
	}
	defer release()
	// 仅延长本请求连接的写期限，避免全局30秒写超时截断模型生成。
	controller := http.NewResponseController(c.Writer)
	_ = controller.SetWriteDeadline(time.Now().Add(100 * time.Second))
	defer controller.SetWriteDeadline(time.Time{})
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 512*1024)
	var body map[string]json.RawMessage
	if json.NewDecoder(c.Request.Body).Decode(&body) != nil {
		courseModelError(c, 400, "invalid_request", "Invalid or oversized request")
		return
	}
	var messages []json.RawMessage
	if json.Unmarshal(body["messages"], &messages) != nil || len(messages) == 0 || len(messages) > 100 {
		courseModelError(c, 400, "invalid_messages", "Provide between 1 and 100 messages")
		return
	}
	cfg, configuration, err := g.settings.Snapshot(c.Request.Context())
	if err != nil || cfg.APIKey == "" {
		courseModelError(c, 503, "model_unavailable", "The course model is not configured")
		return
	}
	var requested string
	_ = json.Unmarshal(body["model"], &requested)
	if requested != "" && requested != "course-model" && requested != cfg.Model {
		courseModelError(c, 400, "model_not_allowed", "Only the configured course model is allowed")
		return
	}
	allowed := map[string]bool{"model": true, "messages": true, "stream": true, "stream_options": true, "max_tokens": true, "max_completion_tokens": true, "tools": true, "tool_choice": true, "parallel_tool_calls": true, "response_format": true, "reasoning_effort": true}
	for key := range body {
		if !allowed[key] {
			courseModelError(c, 400, "unsupported_parameter", "Unsupported course parameter: "+key)
			return
		}
	}
	for _, key := range []string{"max_tokens", "max_completion_tokens"} {
		if raw, exists := body[key]; exists {
			var n int
			if json.Unmarshal(raw, &n) != nil || n < 1 || n > 8192 {
				courseModelError(c, 400, "output_limit", "Output token limit must be between 1 and 8192")
				return
			}
		}
	}
	if body["max_tokens"] == nil && body["max_completion_tokens"] == nil {
		body["max_tokens"] = json.RawMessage("4096")
	}
	body["model"], _ = json.Marshal(cfg.Model)
	data, _ := json.Marshal(body)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 90*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "POST", strings.TrimRight(cfg.BaseURL, "/")+"/chat/completions", bytes.NewReader(data))
	if err != nil {
		courseModelError(c, 503, "model_unavailable", "Invalid model configuration")
		return
	}
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Agent-EDU-Course/1.0")
	requestBytes := make([]byte, 16)
	if _, err := rand.Read(requestBytes); err != nil {
		courseModelError(c, 500, "request_id_failed", "Unable to start request")
		return
	}
	requestID := "edu-" + hex.EncodeToString(requestBytes)
	c.Header("X-Request-ID", requestID)
	c.Header("X-Model-Config-Version", fmt.Sprint(configuration.Version))
	c.Header("Cache-Control", "no-store")
	c.Header("X-Accel-Buffering", "no")
	started := time.Now()
	status := 502
	defer func() {
		auditContext, stopAudit := context.WithTimeout(context.Background(), 3*time.Second)
		defer stopAudit()
		result := operations.AuditResultFailed
		if status == 200 {
			result = operations.AuditResultSuccess
		}
		_ = g.lab.operations.RecordAudit(auditContext, operations.AuditLog{ActorID: session.UserID, ActorRole: 1, Action: "course_model_call", TargetType: "lab_session", TargetID: session.ID, Result: result, Message: "课程模型调用", Metadata: operations.JSONMap{"requestId": requestID, "model": cfg.Model, "configVersion": configuration.Version, "status": status, "latencyMs": time.Since(started).Milliseconds()}})
	}()
	resp, err := g.client.Do(req)
	if err != nil {
		courseModelError(c, 502, "provider_unavailable", "Model request failed or timed out")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		status = resp.StatusCode
		code, message := "provider_error", "Model provider rejected this request"
		switch status {
		case 401, 403:
			code, message = "provider_auth", "Model credentials or permissions were rejected"
		case 402:
			code, message = "provider_balance", "Model account has insufficient balance"
		case 429:
			code, message = "provider_limit", "Model provider quota or rate limit reached"
		}
		courseModelError(c, 502, code, message)
		return
	}
	var stream bool
	_ = json.Unmarshal(body["stream"], &stream)
	if stream {
		c.Header("Content-Type", "text/event-stream")
		c.Status(200)
		scanner := bufio.NewScanner(resp.Body)
		scanner.Buffer(make([]byte, 8192), 2*1024*1024)
		completed := false
		failStream := func() {
			_, _ = c.Writer.Write([]byte("data: {\"error\":{\"type\":\"stream_incomplete\",\"message\":\"Model stream failed or was interrupted\"}}\n\ndata: [DONE]\n\n"))
			c.Writer.Flush()
		}
		for scanner.Scan() {
			line := scanner.Text()
			if strings.Contains(line, cfg.APIKey) {
				failStream()
				return
			}
			if strings.HasPrefix(line, "data:") && strings.TrimSpace(strings.TrimPrefix(line, "data:")) != "[DONE]" {
				var chunk struct {
					Error json.RawMessage `json:"error"`
				}
				if json.Unmarshal([]byte(strings.TrimSpace(strings.TrimPrefix(line, "data:"))), &chunk) != nil || (len(chunk.Error) > 0 && string(chunk.Error) != "null") {
					failStream()
					return
				}
			}
			if strings.TrimSpace(line) == "data: [DONE]" {
				completed = true
			}
			if _, err = c.Writer.Write([]byte(line + "\n")); err != nil {
				return
			}
			c.Writer.Flush()
		}
		if scanner.Err() == nil && completed {
			status = 200
		} else {
			failStream()
		}
		return
	}
	result, err := io.ReadAll(io.LimitReader(resp.Body, 4*1024*1024+1))
	if err != nil || len(result) > 4*1024*1024 || !json.Valid(result) || bytes.Contains(result, []byte(cfg.APIKey)) {
		courseModelError(c, 502, "invalid_response", "Invalid model response")
		return
	}
	var envelope struct {
		Error json.RawMessage `json:"error"`
	}
	if json.Unmarshal(result, &envelope) != nil || (len(envelope.Error) > 0 && string(envelope.Error) != "null") {
		courseModelError(c, 502, "provider_error", "Model provider returned an error")
		return
	}
	status = 200
	c.Data(200, "application/json", result)
}

func (s *Service) courseModelEnvironment(session *UserLabSession) (map[string]string, error) {
	if s.WorkspaceDirectory(session) == "" {
		return nil, nil
	}
	if s.courseModel == nil {
		return nil, errors.New("课程模型网关未初始化")
	}
	base, err := s.courseModel.publicURL()
	if err != nil {
		return nil, err
	}
	token, err := s.courseModel.token(session)
	if err != nil {
		return nil, err
	}
	return map[string]string{"EDU_PROJECT_DIR": PromptWorkbenchDirectory, "EDU_MODEL_BASE_URL": base, "EDU_MODEL_TOKEN": token, "EDU_MODEL_NAME": "course-model", "EDU_COURSE_SESSION": fmt.Sprint(session.ID)}, nil
}
