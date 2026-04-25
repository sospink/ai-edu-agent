package password

import "testing"

func TestHashAndCompare(t *testing.T) {
	hashed, err := Hash("admin@123")
	if err != nil {
		t.Fatalf("Hash() error = %v", err)
	}

	if !LooksLegacyHash(hashed) {
		t.Fatalf("expected generated hash to use legacy format, got %s", hashed)
	}
	if !Compare("admin@123", hashed) {
		t.Fatalf("expected password compare to succeed")
	}
	if Compare("wrong-pass", hashed) {
		t.Fatalf("expected wrong password compare to fail")
	}
}

func TestLooksLegacyHash(t *testing.T) {
	legacy := "64c4bb41b13512a39c5897f20f2e270a:4e6971b55523ae9ec1296b4757db8e4fe8b4047b367cbf5d8093bf3f4f7f8a48f0b6e5935f6eb20f95b76ec6f35627af154fd2f6ebca8cee29a7f66980957de5"
	if !LooksLegacyHash(legacy) {
		t.Fatalf("expected legacy hash to be recognized")
	}
	if LooksLegacyHash("$2a$10$abcdefghijklmnopqrstuv") {
		t.Fatalf("expected bcrypt hash to be rejected")
	}
}
