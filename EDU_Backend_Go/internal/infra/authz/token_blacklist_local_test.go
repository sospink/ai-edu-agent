package authz

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"go.uber.org/zap"
)

func TestLocalBlacklistSurvivesRestartWithoutSavingTokens(t *testing.T) {
	path := filepath.Join(t.TempDir(), "private", "revocations.json")
	b := NewTokenBlacklist(nil, zap.NewNop())
	if err := b.SetLocalStore(path); err != nil {
		t.Fatal(err)
	}
	if !b.Enabled() {
		t.Fatal("local blacklist not enabled")
	}
	if err := b.Revoke(context.Background(), "private-test-token", time.Hour); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), "private-test-token") {
		t.Fatal("plaintext token stored")
	}
	info, _ := os.Stat(path)
	if info.Mode().Perm() != 0600 {
		t.Fatal("unexpected file permissions")
	}
	restarted := NewTokenBlacklist(nil, zap.NewNop())
	if err = restarted.SetLocalStore(path); err != nil {
		t.Fatal(err)
	}
	revoked, err := restarted.IsRevoked(context.Background(), "private-test-token")
	if err != nil || !revoked {
		t.Fatal("revocation lost on restart")
	}
	revoked, err = restarted.IsRevoked(context.Background(), "different-token")
	if err != nil || revoked {
		t.Fatal("unrelated token affected")
	}
}
func TestLocalBlacklistExpiryAndMalformedStorage(t *testing.T) {
	path := filepath.Join(t.TempDir(), "revocations.json")
	b := NewTokenBlacklist(nil, zap.NewNop())
	if err := b.SetLocalStore(path); err != nil {
		t.Fatal(err)
	}
	if err := b.Revoke(context.Background(), "expired", time.Millisecond); err != nil {
		t.Fatal(err)
	}
	time.Sleep(5 * time.Millisecond)
	revoked, err := b.IsRevoked(context.Background(), "expired")
	if err != nil || revoked {
		t.Fatal("expired revocation retained")
	}
	if err = os.WriteFile(path, []byte("broken"), 0600); err != nil {
		t.Fatal(err)
	}
	if err = NewTokenBlacklist(nil, zap.NewNop()).SetLocalStore(path); err == nil {
		t.Fatal("invalid revocation store silently accepted")
	}
}

func TestLocalBlacklistFailedWriteCanRetry(t *testing.T) {
	path := filepath.Join(t.TempDir(), "revocations.json")
	b := NewTokenBlacklist(nil, zap.NewNop())
	if err := b.SetLocalStore(path); err != nil {
		t.Fatal(err)
	}
	// 使用目录阻止原子替换，避免root环境中chmod不能稳定模拟写盘失败。
	if err := os.Mkdir(path, 0700); err != nil {
		t.Fatal(err)
	}
	if err := b.Revoke(context.Background(), "retry-token", time.Hour); err == nil {
		t.Fatal("expected persistence failure")
	}
	if revoked, _ := b.IsRevoked(context.Background(), "retry-token"); revoked {
		t.Fatal("failed write committed memory state")
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := b.Revoke(context.Background(), "retry-token", time.Hour); err != nil {
		t.Fatal(err)
	}
	restarted := NewTokenBlacklist(nil, zap.NewNop())
	if err := restarted.SetLocalStore(path); err != nil {
		t.Fatal(err)
	}
	if revoked, _ := restarted.IsRevoked(context.Background(), "retry-token"); !revoked {
		t.Fatal("successful retry did not persist")
	}
}
