package llm

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"edu-platform/internal/config"
)

func input() Input {
	return Input{Provider: "openai", BaseURL: "https://api.openai.com/v1", Model: "unit-model", APIKey: "unit-secret-key"}
}

func TestStoreEncryptionRestartRetentionClearAndConflict(t *testing.T) {
	dir := t.TempDir()
	store := NewStore(dir, config.QwenConfig{APIKey: "old-env-key", BaseURL: "https://api.deepseek.com", Model: "old"})
	before, err := store.Get()
	if err != nil || before.Source != "environment" {
		t.Fatalf("initial: %+v %v", before, err)
	}
	in := input()
	saved, err := store.Save(in, 10)
	if err != nil || saved.Version != 1 || !saved.Configured {
		t.Fatalf("save: %+v %v", saved, err)
	}
	data, _ := os.ReadFile(filepath.Join(dir, "llm.json"))
	if strings.Contains(string(data), in.APIKey) {
		t.Fatal("secret leaked to persisted configuration")
	}
	public, _ := json.Marshal(saved)
	if strings.Contains(string(public), in.APIKey) || strings.Contains(string(public), "ciphertext") {
		t.Fatal("secret leaked to view")
	}
	for _, name := range []string{"llm.json", "llm.key"} {
		stat, err := os.Stat(filepath.Join(dir, name))
		if err != nil || stat.Mode().Perm() != 0600 {
			t.Fatalf("permissions: %s %v", name, err)
		}
	}
	restarted := NewStore(dir, config.QwenConfig{})
	cfg, err := restarted.Resolve(context.Background())
	if err != nil || cfg.APIKey != in.APIKey || cfg.Model != in.Model {
		t.Fatalf("restart: %v", err)
	}
	in.APIKey = ""
	in.Version = 1
	in.Model = "updated-model"
	if _, err = store.Save(in, 10); err != nil {
		t.Fatal(err)
	}
	if _, err = store.Save(in, 10); !errors.Is(err, ErrConflict) {
		t.Fatalf("expected conflict: %v", err)
	}
	in.Version = 2
	in.BaseURL = "https://api.deepseek.com"
	if _, err = store.Preview(in); !errors.Is(err, ErrKeyRequired) {
		t.Fatalf("cross-origin key reuse: %v", err)
	}
	in.BaseURL = input().BaseURL
	in.ClearKey = true
	if _, err = store.Save(in, 10); err != nil {
		t.Fatal(err)
	}
	cfg, err = store.Resolve(context.Background())
	if err != nil || cfg.APIKey != "" {
		t.Fatal("clear must not fall back to environment")
	}
}

func TestStoreConcurrentSaveAndMissingKeyFailClosed(t *testing.T) {
	s := NewStore(t.TempDir(), config.QwenConfig{})
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, err := s.Save(input(), 1); results <- err }()
	}
	wg.Wait()
	close(results)
	wins, conflicts := 0, 0
	for err := range results {
		if err == nil {
			wins++
		} else if errors.Is(err, ErrConflict) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if wins != 1 || conflicts != 1 {
		t.Fatalf("wins=%d conflicts=%d", wins, conflicts)
	}
	if err := os.Remove(filepath.Join(s.dir, "llm.key")); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Resolve(context.Background()); !errors.Is(err, ErrStorage) {
		t.Fatalf("must fail closed: %v", err)
	}
	if _, err := s.Save(Input{Provider: "openai", BaseURL: input().BaseURL, Model: "test", APIKey: "replacement", Version: 1}, 1); !errors.Is(err, ErrStorage) {
		t.Fatalf("must not silently replace lost encryption key: %v", err)
	}
}

func TestURLAndPrivateNetworkValidation(t *testing.T) {
	for _, url := range []string{"http://api.example.com/v1", "https://localhost/v1", "https://127.0.0.1/v1", "https://169.254.169.254/latest", "https://10.1.2.3/v1", "https://100.100.100.200/v1", "https://user:pass@api.example.com/v1", "https://api.example.com/v1?key=secret", "https://api.example.com/v1#fragment"} {
		if _, err := ValidateURL(url); err == nil {
			t.Errorf("accepted %s", url)
		}
	}
	for _, ip := range []string{"127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.0.1", "169.254.169.254", "100.100.100.200", "::1", "fc00::1", "::ffff:127.0.0.1", "64:ff9b::7f00:1"} {
		if publicIP(net.ParseIP(ip)) {
			t.Errorf("private IP accepted: %s", ip)
		}
	}
	normalized, err := ValidateURL("https://api.example.com/v1/chat/completions/")
	if err != nil || normalized != "https://api.example.com/v1" {
		t.Fatalf("normalization: %s %v", normalized, err)
	}
	_, err = NewHTTPClient().Get("https://127.0.0.1:1")
	if err == nil {
		t.Fatal("private dial allowed")
	}
}

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestProbeDoesNotSaveOrExposeUpstreamErrors(t *testing.T) {
	s := NewStore(t.TempDir(), config.QwenConfig{})
	for _, tc := range []struct {
		status     int
		body, code string
	}{
		{200, `{"choices":[{"message":{"content":"OK"}}]}`, ""},
		{401, "unit-secret-key", "LLM_AUTH_FAILED"}, {429, "unit-secret-key", "LLM_RATE_LIMITED"},
		{200, `{"choices":[]}`, "LLM_INVALID_RESPONSE"}, {200, "not JSON", "LLM_INVALID_RESPONSE"},
	} {
		client := &http.Client{Transport: roundTrip(func(r *http.Request) (*http.Response, error) {
			if r.Header.Get("Authorization") != "Bearer "+input().APIKey || r.URL.Path != "/v1/chat/completions" {
				t.Fatal("invalid provider request")
			}
			return &http.Response{StatusCode: tc.status, Body: io.NopCloser(strings.NewReader(tc.body)), Header: make(http.Header)}, nil
		})}
		_, err := s.Test(context.Background(), input(), client)
		if tc.code == "" && err != nil {
			t.Fatal(err)
		}
		if tc.code != "" && (err == nil || err.Error() != tc.code) {
			t.Fatalf("unexpected error: %v", err)
		}
	}
	view, err := s.Get()
	if err != nil || view.Configured || view.Version != 0 {
		t.Fatalf("test persisted settings: %+v %v", view, err)
	}
}
