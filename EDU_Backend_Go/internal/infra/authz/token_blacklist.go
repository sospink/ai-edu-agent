package authz

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

const tokenBlacklistKeyPrefix = "auth:blacklist:"

type TokenBlacklist struct {
	client    *redis.Client
	log       *zap.Logger
	mu        sync.Mutex
	localPath string
	local     map[string]time.Time
}

func NewTokenBlacklist(client *redis.Client, log *zap.Logger) *TokenBlacklist {
	return &TokenBlacklist{
		client: client,
		log:    log,
	}
}

func (b *TokenBlacklist) Enabled() bool {
	return b != nil && (b.client != nil || b.localPath != "")
}

// 无Redis的单实例部署使用私有文件保存撤销摘要，重启后仍然生效。
// 多实例部署必须继续使用Redis，不共享此本地缓存。
func (b *TokenBlacklist) SetLocalStore(path string) error {
	if b == nil || b.client != nil {
		return nil
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	values := map[string]time.Time{}
	data, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	if err == nil {
		if err = json.Unmarshal(data, &values); err != nil {
			return err
		}
	}
	if values == nil {
		values = map[string]time.Time{}
	}
	b.localPath = path
	b.local = values
	return nil
}

func (b *TokenBlacklist) revokeLocal(token string, ttl time.Duration) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := time.Now()
	candidate := make(map[string]time.Time, len(b.local)+1)
	for key, expires := range b.local {
		if expires.After(now) {
			candidate[key] = expires
		}
	}
	candidate[blacklistKey(token)] = now.Add(ttl)
	data, err := json.Marshal(candidate)
	if err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(b.localPath), ".revocations-")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	if _, err = file.Write(data); err != nil {
		file.Close()
		return err
	}
	if err = file.Sync(); err != nil {
		file.Close()
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	if err = os.Rename(file.Name(), b.localPath); err != nil {
		return err
	}
	b.local = candidate
	return nil
}

func (b *TokenBlacklist) Revoke(ctx context.Context, token string, ttl time.Duration) error {
	if !b.Enabled() {
		if b != nil && b.log != nil {
			b.log.Info("token blacklist disabled, skip revoke")
		}
		return nil
	}

	trimmed := strings.TrimSpace(token)
	if trimmed == "" || ttl <= 0 {
		return nil
	}
	if b.client == nil {
		return b.revokeLocal(trimmed, ttl)
	}

	if err := b.client.Set(ctx, blacklistKey(trimmed), "1", ttl).Err(); err != nil {
		if b.log != nil {
			b.log.Warn("revoke token failed", zap.Error(err))
		}
		return err
	}
	return nil
}

func (b *TokenBlacklist) IsRevoked(ctx context.Context, token string) (bool, error) {
	if !b.Enabled() {
		return false, nil
	}

	trimmed := strings.TrimSpace(token)
	if trimmed == "" {
		return false, nil
	}
	if b.client == nil {
		b.mu.Lock()
		defer b.mu.Unlock()
		expires, exists := b.local[blacklistKey(trimmed)]
		if exists && !expires.After(time.Now()) {
			delete(b.local, blacklistKey(trimmed))
			return false, nil
		}
		return exists, nil
	}

	exists, err := b.client.Exists(ctx, blacklistKey(trimmed)).Result()
	if err != nil {
		if b.log != nil {
			b.log.Warn("check token blacklist failed", zap.Error(err))
		}
		return false, err
	}
	return exists > 0, nil
}

func blacklistKey(token string) string {
	sum := sha256.Sum256([]byte(token))
	return tokenBlacklistKeyPrefix + hex.EncodeToString(sum[:])
}
