package openclawview

import "testing"

func TestResolveSessionKey(t *testing.T) {
	service := &Service{feishuChatID: "oc_test_group"}

	tests := []struct {
		name      string
		sessionID string
		want      string
	}{
		{
			name:      "explicit session key is kept",
			sessionID: "agent:main:custom:thread:001",
			want:      "agent:main:custom:thread:001",
		},
		{
			name:      "lab session id maps to session namespace",
			sessionID: "146",
			want:      "agent:lab:session:146",
		},
		{
			name:      "session id is sanitized",
			sessionID: "lab/session:146?gateway",
			want:      "agent:lab:session:lab-session-146-gateway",
		},
		{
			name:      "empty id falls back to feishu group",
			sessionID: "",
			want:      "agent:main:feishu:group:oc_test_group",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := service.resolveSessionKey(tc.sessionID)
			if got != tc.want {
				t.Fatalf("resolveSessionKey(%q) = %q, want %q", tc.sessionID, got, tc.want)
			}
		})
	}
}

func TestSanitizeSessionFragmentFallback(t *testing.T) {
	if got := sanitizeSessionFragment("   "); got != "default" {
		t.Fatalf("expected default fragment, got %q", got)
	}
}
