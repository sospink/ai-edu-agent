package jwt

import "testing"

func TestManagerGenerateAndParse(t *testing.T) {
	manager, err := NewManager("secret123", "edu", "1h")
	if err != nil {
		t.Fatalf("NewManager() error = %v", err)
	}
	token, err := manager.GenerateToken(1, "admin", 10)
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}
	claims, err := manager.ParseToken(token)
	if err != nil {
		t.Fatalf("ParseToken() error = %v", err)
	}
	if claims.UserID != 1 || claims.Username != "admin" || claims.RoleType != 10 {
		t.Fatalf("unexpected claims: %+v", claims)
	}
	if claims.Portal != "admin" {
		t.Fatalf("expected portal admin, got %q", claims.Portal)
	}
}

func TestNewManagerSupportsNodeStyleTTL(t *testing.T) {
	manager, err := NewManager("secret123", "edu", "7d")
	if err != nil {
		t.Fatalf("NewManager() error = %v", err)
	}
	if manager.ttl.Hours() != 168 {
		t.Fatalf("unexpected ttl: %v", manager.ttl)
	}
}
