package agent

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"edu-platform/internal/config"
	"go.uber.org/zap"
)

type modelTransport func(*http.Request) (*http.Response, error)

func (f modelTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestModelConfigurationHotReloadAcrossAIFlows(t *testing.T) {
	active := config.QwenConfig{APIKey: "first-key", BaseURL: "https://first.example.com/v1", Model: "first-model"}
	c := NewAIClient(config.QwenConfig{}, zap.NewNop())
	c.SetConfigResolver(func(context.Context) (config.QwenConfig, error) { return active, nil })
	requests := 0
	c.managedClient = &http.Client{Transport: modelTransport(func(r *http.Request) (*http.Response, error) {
		requests++
		var body chatCompletionRequest
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body.Model != active.Model || r.Header.Get("Authorization") != "Bearer "+active.APIKey || r.URL.String() != active.BaseURL+"/chat/completions" {
			t.Fatalf("stale model configuration: %s %s", body.Model, r.URL)
		}
		if body.Temperature != nil {
			t.Fatal("optional temperature must not break reasoning models")
		}
		payload := `{"choices":[{"message":{"content":"answer"}}]}`
		if body.Stream {
			payload = "data: {\"choices\":[{\"delta\":{\"content\":\"one\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"two\"}}]}\n\ndata: [DONE]\n\n"
		}
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(payload))}, nil
	})}
	ctx := context.Background()
	if _, err := c.Chat(ctx, ChatRequest{Question: "question"}); err != nil {
		t.Fatal(err)
	}
	active = config.QwenConfig{APIKey: "second-key", BaseURL: "https://second.example.com/v4", Model: "second-model"}
	if !c.Enabled() || c.ModelName() != active.Model {
		t.Fatal("stale availability/model")
	}
	result, err := c.Complete(ctx, "system", "question")
	if err != nil || result.Model != active.Model {
		t.Fatalf("teacher complete: %+v %v", result, err)
	}
	if _, err := c.ExplainCode(ctx, "code", "go"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.GetVerificationHelp(ctx, VerificationHelpRequest{ErrorMessage: "error"}); err != nil {
		t.Fatal(err)
	}
	if _, err := c.PromptEnhance(ctx, PromptEnhanceRequest{RawPrompt: "prompt"}); err != nil {
		t.Fatal(err)
	}
	text := ""
	if err := c.ChatStream(ctx, ChatRequest{Question: "question"}, func(chunk string) error { text += chunk; active.Model = "changed-during-stream"; return nil }); err != nil || text != "onetwo" {
		t.Fatalf("stream interrupted: %s %v", text, err)
	}
	active.APIKey = ""
	if c.Enabled() {
		t.Fatal("cleared configuration remains enabled")
	}
	if _, err := c.Chat(ctx, ChatRequest{Question: "question"}); err == nil {
		t.Fatal("request allowed without key")
	}
	if requests != 6 {
		t.Fatalf("unexpected provider request count: %d", requests)
	}
}
