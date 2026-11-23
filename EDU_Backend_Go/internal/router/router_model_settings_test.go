package router_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"edu-platform/internal/domain/llm"
)

func TestModelSettingsAuthorizationLocaleAndPersistence(t *testing.T) {
	f := newTestFixture(t)
	admin := mustLogin(t, f, f.admin.Username, "admin@123")
	student := mustLogin(t, f, f.student.Username, "student@123")
	for _, endpoint := range []struct{ method, path string }{{"GET", "/api/admin/model-settings"}, {"PUT", "/api/admin/model-settings"}, {"POST", "/api/admin/model-settings/test"}} {
		for _, auth := range []struct {
			token  string
			status int
		}{{"", 401}, {student, 403}} {
			r := performJSON(t, f.engine, endpoint.method, endpoint.path, nil, auth.token)
			if r.Code != auth.status {
				t.Fatalf("%s %s: %d %s", endpoint.method, endpoint.path, r.Code, r.Body.String())
			}
		}
	}
	for _, locale := range []string{"zh-CN", "en-US"} {
		req := httptest.NewRequest(http.MethodPut, "/api/admin/model-settings", strings.NewReader(`{"provider":"invalid"}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+admin)
		req.Header.Set("X-Locale", locale)
		w := httptest.NewRecorder()
		f.engine.ServeHTTP(w, req)
		if w.Code != 400 || w.Header().Get("Content-Language") != locale || !strings.Contains(w.Body.String(), "LLM_INVALID_CONFIG") {
			t.Fatalf("locale %s: %d %s", locale, w.Code, w.Body.String())
		}
	}
	input := map[string]any{"provider": "deepseek", "baseUrl": "https://api.deepseek.com", "model": "test-model", "apiKey": "route-test-secret", "version": 0}
	saved := performJSON(t, f.engine, "PUT", "/api/admin/model-settings", input, admin)
	if saved.Code != 200 || bytes.Contains(saved.Body.Bytes(), []byte("route-test-secret")) {
		t.Fatalf("save: %d %s", saved.Code, saved.Body.String())
	}
	var envelope struct {
		Data llm.View `json:"data"`
	}
	if err := json.Unmarshal(saved.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if !envelope.Data.Configured || envelope.Data.Version != 1 || envelope.Data.Source != "managed" {
		t.Fatalf("invalid view: %+v", envelope.Data)
	}
	get := performJSON(t, f.engine, "GET", "/api/admin/model-settings", nil, admin)
	if get.Code != 200 || strings.Contains(get.Body.String(), "route-test-secret") {
		t.Fatal("GET leaks secret or failed")
	}
	for _, path := range []string{"/uploads/../.settings/llm.json", "/uploads/../.settings/llm.key", "/api/uploads/../.settings/llm.key"} {
		leak := performJSON(t, f.engine, "GET", path, nil, "")
		if leak.Code == 200 {
			t.Fatalf("private model configuration exposed: %s", path)
		}
	}
	conflict := performJSON(t, f.engine, "PUT", "/api/admin/model-settings", input, admin)
	if conflict.Code != 409 {
		t.Fatalf("expected stale-write conflict, got %d", conflict.Code)
	}
	input["version"] = 1
	input["apiKey"] = ""
	input["clearKey"] = true
	cleared := performJSON(t, f.engine, "PUT", "/api/admin/model-settings", input, admin)
	if cleared.Code != 200 || !strings.Contains(cleared.Body.String(), `"configured":false`) {
		t.Fatalf("clear: %s", cleared.Body.String())
	}
}
