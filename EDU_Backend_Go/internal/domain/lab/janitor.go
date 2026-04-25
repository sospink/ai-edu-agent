package lab

import (
	"context"
	"time"

	"go.uber.org/zap"
)

const defaultJanitorInterval = 30 * time.Second

type Janitor struct {
	service  *Service
	logger   *zap.Logger
	interval time.Duration
}

func NewJanitor(service *Service, logger *zap.Logger) *Janitor {
	return &Janitor{
		service:  service,
		logger:   logger,
		interval: defaultJanitorInterval,
	}
}

func (j *Janitor) Run(ctx context.Context) {
	if j == nil || j.service == nil {
		return
	}

	j.runOnce(ctx)

	ticker := time.NewTicker(j.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			j.runOnce(ctx)
		}
	}
}

func (j *Janitor) runOnce(ctx context.Context) {
	runCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()

	if err := j.service.SweepSessions(runCtx); err != nil && j.logger != nil {
		j.logger.Warn("lab janitor sweep failed", zap.Error(err))
	}
}
