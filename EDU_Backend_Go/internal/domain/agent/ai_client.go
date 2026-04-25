package agent

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"

	"edu-platform/internal/config"
)

const defaultQwenBaseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"

type AIClient struct {
	apiKey  string
	baseURL string
	model   string
	client  *http.Client
	logger  *zap.Logger
}

type ChatRequest struct {
	Question    string        `json:"question"`
	StepContext string        `json:"stepContext,omitempty"`
	ChatHistory []ChatMessage `json:"chatHistory,omitempty"`
}

type PromptEnhanceRequest struct {
	RawPrompt string `json:"rawPrompt"`
	Mode      string `json:"mode"`
}

type VerificationHelpRequest struct {
	StepTitle        string `json:"stepTitle,omitempty"`
	StepContext      string `json:"stepContext,omitempty"`
	VerificationType string `json:"verificationType,omitempty"`
	ErrorMessage     string `json:"errorMessage"`
	ErrorDetails     string `json:"errorDetails,omitempty"`
}

type chatCompletionRequest struct {
	Model       string             `json:"model"`
	Messages    []chatMessageParam `json:"messages"`
	Stream      bool               `json:"stream,omitempty"`
	Temperature *float64           `json:"temperature,omitempty"`
}

type chatMessageParam struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatCompletionResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Usage struct {
		PromptTokens int `json:"prompt_tokens"`
		TotalTokens  int `json:"total_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type CompletionResult struct {
	Content      string
	Model        string
	PromptTokens int
	TotalTokens  int
	LatencyMS    int64
}

type chatCompletionStreamChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func NewAIClient(cfg config.QwenConfig, logger *zap.Logger) *AIClient {
	baseURL := strings.TrimSpace(cfg.BaseURL)
	if baseURL == "" {
		baseURL = defaultQwenBaseURL
	}

	model := strings.TrimSpace(cfg.Model)
	if model == "" {
		model = "qwen3-max"
	}

	return &AIClient{
		apiKey:  strings.TrimSpace(cfg.APIKey),
		baseURL: strings.TrimRight(baseURL, "/"),
		model:   model,
		client: &http.Client{
			Timeout: 90 * time.Second,
		},
		logger: logger,
	}
}

func (c *AIClient) Enabled() bool {
	return c.apiKey != ""
}

func (c *AIClient) ModelName() string {
	return c.model
}

func (c *AIClient) Complete(ctx context.Context, systemPrompt, userPrompt string) (CompletionResult, error) {
	startedAt := time.Now()
	completion, err := c.createCompletion(ctx, chatCompletionRequest{
		Model: c.model,
		Messages: []chatMessageParam{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	})
	if err != nil {
		return CompletionResult{Model: c.model, LatencyMS: time.Since(startedAt).Milliseconds()}, err
	}
	content := ""
	if len(completion.Choices) > 0 {
		content = strings.TrimSpace(completion.Choices[0].Message.Content)
	}
	totalTokens := completion.Usage.TotalTokens
	if totalTokens == 0 && content != "" {
		totalTokens = int(float64(len([]rune(systemPrompt+userPrompt+content)))/1.5) + 1
	}
	promptTokens := completion.Usage.PromptTokens
	if promptTokens == 0 {
		promptTokens = int(float64(len([]rune(systemPrompt+userPrompt)))/1.5) + 1
	}
	return CompletionResult{
		Content:      content,
		Model:        c.model,
		PromptTokens: promptTokens,
		TotalTokens:  totalTokens,
		LatencyMS:    time.Since(startedAt).Milliseconds(),
	}, nil
}

func (c *AIClient) Chat(ctx context.Context, req ChatRequest) (string, error) {
	messages := c.buildChatMessages(req)
	completion, err := c.createCompletion(ctx, chatCompletionRequest{
		Model:    c.model,
		Messages: messages,
	})
	if err != nil {
		return "", err
	}
	answer := ""
	if len(completion.Choices) > 0 {
		answer = strings.TrimSpace(completion.Choices[0].Message.Content)
	}
	if answer == "" {
		answer = "抱歉，我暂时无法回答这个问题。"
	}
	return answer, nil
}

func (c *AIClient) ChatStream(ctx context.Context, req ChatRequest, onChunk func(string) error) error {
	if !c.Enabled() {
		return fmt.Errorf("AI 服务未配置")
	}

	body, err := json.Marshal(chatCompletionRequest{
		Model:    c.model,
		Messages: c.buildChatMessages(req),
		Stream:   true,
	})
	if err != nil {
		return fmt.Errorf("构建 AI 请求失败: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpointURL("/chat/completions"), bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("创建 AI 请求失败: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("调用 AI 服务失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		message, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("AI 服务异常: %s", strings.TrimSpace(string(message)))
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || !strings.HasPrefix(line, "data:") {
			continue
		}

		payload := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if payload == "[DONE]" {
			return nil
		}

		var chunk chatCompletionStreamChunk
		if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
			continue
		}
		if chunk.Error != nil && strings.TrimSpace(chunk.Error.Message) != "" {
			return errors.New(chunk.Error.Message)
		}
		if len(chunk.Choices) == 0 {
			continue
		}

		content := chunk.Choices[0].Delta.Content
		if strings.TrimSpace(content) == "" {
			continue
		}
		if err := onChunk(content); err != nil {
			return err
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("读取 AI 流失败: %w", err)
	}
	return nil
}

func (c *AIClient) ExplainCode(ctx context.Context, code, language string) (string, error) {
	if strings.TrimSpace(language) == "" {
		language = "text"
	}
	completion, err := c.createCompletion(ctx, chatCompletionRequest{
		Model: c.model,
		Messages: []chatMessageParam{
			{
				Role:    "system",
				Content: "你是一个编程教学助手，请用简洁易懂的语言解释代码，适合初学者理解。",
			},
			{
				Role:    "user",
				Content: fmt.Sprintf("请解释这段 %s 代码：\n```%s\n%s\n```", language, language, code),
			},
		},
	})
	if err != nil {
		return "", err
	}
	if len(completion.Choices) == 0 || strings.TrimSpace(completion.Choices[0].Message.Content) == "" {
		return "无法解释这段代码。", nil
	}
	return completion.Choices[0].Message.Content, nil
}

func (c *AIClient) GetVerificationHelp(ctx context.Context, req VerificationHelpRequest) (string, error) {
	var prompt strings.Builder
	prompt.WriteString("学生在完成编程实验时遇到了验证失败的问题，请帮助分析原因并给出解决建议。\n\n")
	prompt.WriteString("验证错误信息: " + req.ErrorMessage)
	if strings.TrimSpace(req.ErrorDetails) != "" {
		prompt.WriteString("\n详细信息: " + req.ErrorDetails)
	}
	if strings.TrimSpace(req.StepTitle) != "" {
		prompt.WriteString("\n当前步骤: " + req.StepTitle)
	}
	if strings.TrimSpace(req.VerificationType) != "" {
		prompt.WriteString("\n验证类型: " + req.VerificationType)
	}
	if strings.TrimSpace(req.StepContext) != "" {
		prompt.WriteString("\n步骤内容摘要: " + req.StepContext)
	}
	prompt.WriteString("\n\n请用简洁的语言分析可能原因，并给出具体解决步骤。")

	completion, err := c.createCompletion(ctx, chatCompletionRequest{
		Model: c.model,
		Messages: []chatMessageParam{
			{
				Role:    "system",
				Content: "你是一个编程教学助手，帮助学生排查实验中遇到的问题。请给出简洁、实用的建议。",
			},
			{
				Role:    "user",
				Content: prompt.String(),
			},
		},
	})
	if err != nil {
		return "", err
	}
	if len(completion.Choices) == 0 || strings.TrimSpace(completion.Choices[0].Message.Content) == "" {
		return "暂时无法提供建议，请检查当前步骤与验证命令是否正确。", nil
	}
	return completion.Choices[0].Message.Content, nil
}

func (c *AIClient) PromptEnhance(ctx context.Context, req PromptEnhanceRequest) (PromptEnhanceResult, error) {
	mode := strings.TrimSpace(req.Mode)
	if mode == "" {
		mode = "通用"
	}

	modeGuide := map[string]string{
		"通用": "适用于通用任务场景，注重逻辑清晰、角色设定明确、输出约束完整。",
		"代码": "适用于编程开发场景，注重技术精确性、代码规范、错误处理和最佳实践。",
		"创作": "适用于内容创作场景，注重创意表达、风格一致性、结构美感和感染力。",
	}

	systemPrompt := fmt.Sprintf(`你是一位顶级 Prompt Engineering 专家。你的任务是将用户提供的原始提示词优化为高质量的结构化提示词。

当前优化模式：%s — %s

优化时请特别关注：
1. 角色设定清晰
2. 任务拆解具体
3. 输出约束明确
4. 上下文补充充分
5. 如果合适，给出 few-shot 引导

请严格返回 JSON，不要带 markdown 代码块：
{
  "content": "优化后的完整提示词",
  "score": 85,
  "suggestions": ["改进建议1", "改进建议2"]
}`, mode, modeGuide[mode])

	temperature := 0.7
	completion, err := c.createCompletion(ctx, chatCompletionRequest{
		Model:       c.model,
		Messages:    []chatMessageParam{{Role: "system", Content: systemPrompt}, {Role: "user", Content: "请优化以下原始提示词：\n\n" + req.RawPrompt}},
		Temperature: &temperature,
	})
	if err != nil {
		return PromptEnhanceResult{}, err
	}

	raw := ""
	tokens := completion.Usage.TotalTokens
	if len(completion.Choices) > 0 {
		raw = strings.TrimSpace(completion.Choices[0].Message.Content)
	}
	if tokens == 0 {
		tokens = int(float64(len([]rune(raw)))/1.5) + 1
	}

	var payload struct {
		Content     string   `json:"content"`
		Score       int      `json:"score"`
		Suggestions []string `json:"suggestions"`
	}

	cleaned := strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(raw, "```json"), "```"))
	if err := json.Unmarshal([]byte(cleaned), &payload); err != nil {
		return PromptEnhanceResult{
			Content:     raw,
			Score:       85,
			Tokens:      tokens,
			Suggestions: []string{"建议补充更多上下文与结果约束，以获得更稳定的输出。"},
		}, nil
	}

	if payload.Score <= 0 {
		payload.Score = 85
	}
	if payload.Score > 100 {
		payload.Score = 100
	}

	return PromptEnhanceResult{
		Content:     strings.TrimSpace(payload.Content),
		Score:       payload.Score,
		Tokens:      tokens,
		Suggestions: payload.Suggestions,
	}, nil
}

func (c *AIClient) createCompletion(ctx context.Context, reqBody chatCompletionRequest) (*chatCompletionResponse, error) {
	if !c.Enabled() {
		return nil, fmt.Errorf("AI 服务未配置")
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("构建 AI 请求失败: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpointURL("/chat/completions"), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("创建 AI 请求失败: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("调用 AI 服务失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("读取 AI 响应失败: %w", err)
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("AI 服务异常: %s", strings.TrimSpace(string(respBody)))
	}

	var parsed chatCompletionResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("解析 AI 响应失败: %w", err)
	}
	if parsed.Error != nil && strings.TrimSpace(parsed.Error.Message) != "" {
		return nil, errors.New(parsed.Error.Message)
	}
	return &parsed, nil
}

func (c *AIClient) buildChatMessages(req ChatRequest) []chatMessageParam {
	messages := []chatMessageParam{{
		Role:    "system",
		Content: c.buildSystemPrompt(req.StepContext),
	}}

	for _, msg := range req.ChatHistory {
		role := strings.TrimSpace(msg.Role)
		if role != "user" && role != "assistant" {
			continue
		}
		content := strings.TrimSpace(msg.Content)
		if content == "" {
			continue
		}
		messages = append(messages, chatMessageParam{
			Role:    role,
			Content: content,
		})
	}

	messages = append(messages, chatMessageParam{
		Role:    "user",
		Content: req.Question,
	})
	return messages
}

func (c *AIClient) buildSystemPrompt(stepContext string) string {
	prompt := `你是一个专业的编程教学助手，帮助学生学习编程知识。
请用简洁、清晰的语言回答问题，必要时提供代码示例。
回答要有条理，适合初学者理解。`
	if strings.TrimSpace(stepContext) != "" {
		prompt += "\n\n当前学习内容：\n" + stepContext
	}
	return prompt
}

func (c *AIClient) endpointURL(path string) string {
	return c.baseURL + path
}
