package authz

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

const tokenBlacklistKeyPrefix = "auth:blacklist:"

type TokenBlacklist struct {
	client *redis.Client
	log    *zap.Logger
}

func NewTokenBlacklist(client *redis.Client, log *zap.Logger) *TokenBlacklist {
	return &TokenBlacklist{
		client: client,
		log:    log,
	}
}

func (b *TokenBlacklist) Enabled() bool {
	return b != nil && b.client != nil
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
