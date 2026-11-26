package courseharness

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func modelError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"error": gin.H{"type": "course_harness_error", "message": message}})
}
func (h *Handler) modelInstance(c *gin.Context) (Instance, bool) {
	s, ok := h.get(c.Param("id"))
	if !ok || !same(strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer "), s.ModelKey) || !h.allowed(c.Request.Context(), s) {
		modelError(c, 401, "Course workspace credentials expired or unavailable")
		return Instance{}, false
	}
	var setting struct{ Enabled bool }
	if h.db.WithContext(c.Request.Context()).Table("ai_feature_settings").Where("id = 1").Take(&setting).Error != nil || !setting.Enabled {
		modelError(c, 503, "AI assistance is disabled")
		return Instance{}, false
	}
	return s, true
}
func (h *Handler) Models(c *gin.Context) {
	if _, ok := h.modelInstance(c); !ok {
		return
	}
	c.JSON(200, gin.H{"object": "list", "data": []gin.H{{"id": "course-assistant", "object": "model", "owned_by": "agent-edu"}}})
}
func (h *Handler) modelBudget(id string) (func(), bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	b := h.budgets[id]
	if b == nil {
		b = &budget{Window: time.Now()}
		h.budgets[id] = b
	}
	if time.Since(b.Window) >= time.Minute {
		b.Window = time.Now()
		b.Count = 0
	}
	if b.Active || b.Count >= 15 || b.Total >= 200 {
		return nil, false
	}
	b.Active = true
	b.Count++
	b.Total++
	return func() { h.mu.Lock(); b.Active = false; h.mu.Unlock() }, true
}
func (h *Handler) Chat(c *gin.Context) {
	s, ok := h.modelInstance(c)
	if !ok {
		return
	}
	release, ok := h.modelBudget(s.ID)
	if !ok {
		modelError(c, 429, "Course model request limit reached")
		return
	}
	defer release()
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 256*1024)
	var body map[string]json.RawMessage
	if json.NewDecoder(c.Request.Body).Decode(&body) != nil {
		modelError(c, 400, "Invalid request")
		return
	}
	var messages []json.RawMessage
	if json.Unmarshal(body["messages"], &messages) != nil || len(messages) == 0 || len(messages) > 100 {
		modelError(c, 400, "Invalid messages")
		return
	}
	var model string
	if json.Unmarshal(body["model"], &model) != nil || model != "course-assistant" {
		modelError(c, 400, "Only the course assistant model is allowed")
		return
	}
	allowed := map[string]bool{"model": true, "messages": true, "stream": true, "stream_options": true, "max_tokens": true, "max_completion_tokens": true, "tools": true, "tool_choice": true, "parallel_tool_calls": true, "temperature": true, "top_p": true, "reasoning_effort": true, "response_format": true}
	for key := range body {
		if !allowed[key] {
			delete(body, key)
		}
	}
	for _, key := range []string{"max_tokens", "max_completion_tokens"} {
		if raw, exists := body[key]; exists {
			var value int
			if json.Unmarshal(raw, &value) != nil || value < 1 || value > 4096 {
				body[key] = json.RawMessage("4096")
			}
		}
	}
	if body["max_tokens"] == nil && body["max_completion_tokens"] == nil {
		body["max_tokens"] = json.RawMessage("4096")
	}
	cfg, view, err := h.models.Snapshot(c.Request.Context())
	if err != nil || cfg.APIKey == "" {
		modelError(c, 503, "The course model is not configured")
		return
	}
	body["model"], _ = json.Marshal(cfg.Model)
	data, _ := json.Marshal(body)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 90*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "POST", strings.TrimRight(cfg.BaseURL, "/")+"/chat/completions", bytes.NewReader(data))
	if err != nil {
		modelError(c, 503, "Invalid model configuration")
		return
	}
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Agent-EDU-Harness/1.0")
	_ = http.NewResponseController(c.Writer).SetWriteDeadline(time.Now().Add(100 * time.Second))
	start := time.Now()
	requestID := "harness-" + randomKey()[:24]
	defer func() {
		h.logger.Info("课程Harness模型调用", zap.Uint64("userId", s.UserID), zap.Uint64("lessonId", s.LessonID), zap.String("requestId", requestID), zap.Uint64("configVersion", view.Version), zap.Int64("latencyMs", time.Since(start).Milliseconds()))
	}()
	resp, err := h.client.Do(req)
	if err != nil {
		modelError(c, 502, "Model request failed or timed out")
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		modelError(c, 502, "The configured model provider rejected the request")
		return
	}
	c.Header("Cache-Control", "no-store")
	c.Header("X-Accel-Buffering", "no")
	c.Header("X-Request-ID", requestID)
	var stream bool
	_ = json.Unmarshal(body["stream"], &stream)
	if !stream {
		output, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
		if err != nil || !json.Valid(output) || bytes.Contains(output, []byte(cfg.APIKey)) {
			modelError(c, 502, "Invalid model response")
			return
		}
		c.Data(200, "application/json", output)
		return
	}
	c.Header("Content-Type", "text/event-stream")
	c.Status(200)
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 8192), 512*1024)
	completed := false
	for scanner.Scan() {
		line := scanner.Text()
		if strings.Contains(line, cfg.APIKey) {
			break
		}
		if strings.HasPrefix(line, "data:") {
			content := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			if content == "[DONE]" {
				completed = true
			} else {
				var chunk struct {
					Error json.RawMessage `json:"error"`
				}
				if json.Unmarshal([]byte(content), &chunk) != nil || (len(chunk.Error) > 0 && string(chunk.Error) != "null") {
					break
				}
			}
		}
		if _, err = c.Writer.Write([]byte(line + "\n")); err != nil {
			return
		}
		c.Writer.Flush()
	}
	if !completed {
		_, _ = c.Writer.Write([]byte("data: {\"error\":{\"message\":\"Model stream was interrupted\"}}\n\ndata: [DONE]\n\n"))
		c.Writer.Flush()
	}
}
