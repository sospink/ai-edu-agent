package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

type ProbeResult struct {
	Model     string `json:"model"`
	LatencyMS int64  `json:"latencyMs"`
}

type ProbeError struct{ Code string }

func (e *ProbeError) Error() string { return e.Code }

func (s *Store) Test(ctx context.Context, input Input, client *http.Client) (ProbeResult, error) {
	cfg, err := s.Preview(input)
	if err != nil {
		return ProbeResult{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	body, _ := json.Marshal(map[string]any{"model": cfg.Model, "messages": []map[string]string{{"role": "user", "content": "Reply with OK only."}}, "stream": false})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return ProbeResult{}, ErrInvalid
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	started := time.Now()
	resp, err := client.Do(req)
	if err != nil {
		return ProbeResult{}, &ProbeError{Code: "LLM_CONNECTION_FAILED"}
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		code := "LLM_PROVIDER_ERROR"
		switch resp.StatusCode {
		case 401, 403:
			code = "LLM_AUTH_FAILED"
		case 404:
			code = "LLM_MODEL_NOT_FOUND"
		case 429:
			code = "LLM_RATE_LIMITED"
		}
		return ProbeResult{}, &ProbeError{Code: code}
	}
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 1024*1024)).Decode(&result) != nil || len(result.Choices) == 0 || strings.TrimSpace(result.Choices[0].Message.Content) == "" {
		return ProbeResult{}, &ProbeError{Code: "LLM_INVALID_RESPONSE"}
	}
	return ProbeResult{Model: cfg.Model, LatencyMS: time.Since(started).Milliseconds()}, nil
}
