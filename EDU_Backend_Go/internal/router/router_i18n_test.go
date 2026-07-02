package router_test

import (
	"net/http"
	"testing"
)

func TestLocaleHeaderTranslatesAuthError(t *testing.T) {
	fixture := newTestFixture(t)

	resp := performJSONWithLocale(t, fixture.engine, http.MethodGet, "/api/users/1", nil, "", "en-US")
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", resp.Code, resp.Body.String())
	}
	if got := resp.Header().Get("Content-Language"); got != "en-US" {
		t.Fatalf("expected Content-Language en-US, got %q", got)
	}

	var payload apiResponse
	decodeJSON(t, resp.Body.Bytes(), &payload)
	if payload.Success {
		t.Fatalf("expected failure payload, got %+v", payload)
	}
	if payload.Code != "UNAUTHORIZED" {
		t.Fatalf("expected stable code UNAUTHORIZED, got %+v", payload)
	}
	if payload.Error != "Authentication token is required" {
		t.Fatalf("expected translated auth error, got %+v", payload)
	}
}

func TestLocaleQueryTranslatesWebSocketStyleHandshakeError(t *testing.T) {
	fixture := newTestFixture(t)

	resp := performJSON(t, fixture.engine, http.MethodGet, "/api/users/1?locale=en-US", nil, "")
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", resp.Code, resp.Body.String())
	}
	if got := resp.Header().Get("Content-Language"); got != "en-US" {
		t.Fatalf("expected Content-Language en-US, got %q", got)
	}

	var payload apiResponse
	decodeJSON(t, resp.Body.Bytes(), &payload)
	if payload.Error != "Authentication token is required" {
		t.Fatalf("expected translated auth error, got %+v", payload)
	}
}
