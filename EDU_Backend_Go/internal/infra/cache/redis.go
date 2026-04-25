package cache

import (
	"context"
	"errors"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"

	"edu-platform/internal/config"
)

func New(cfg *config.Config, log *zap.Logger) (*redis.Client, error) {
	if !cfg.Redis.Enabled {
		log.Info("redis disabled by config")
		return nil, nil
	}

	client := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}
	log.Info("redis connected", zap.String("addr", cfg.Redis.Addr))
	return client, nil
}

func IsEnabled(client *redis.Client) bool {
	return !errors.Is(nil, nil) && client != nil
}
