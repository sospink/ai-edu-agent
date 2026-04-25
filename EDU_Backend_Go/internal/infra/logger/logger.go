package logger

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"

	"edu-platform/internal/config"
)

func New(cfg *config.Config) (*zap.Logger, error) {
	level := zap.InfoLevel
	switch cfg.Log.Level {
	case "debug":
		level = zap.DebugLevel
	case "warn":
		level = zap.WarnLevel
	case "error":
		level = zap.ErrorLevel
	default:
		if cfg.App.Env == "development" {
			level = zap.DebugLevel
		}
	}
	zapCfg := zap.NewProductionConfig()
	zapCfg.Level = zap.NewAtomicLevelAt(level)
	zapCfg.EncoderConfig.TimeKey = "timestamp"
	zapCfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	if cfg.App.Env == "development" {
		zapCfg.Encoding = "console"
	}
	return zapCfg.Build()
}

func String(key, value string) zap.Field               { return zap.String(key, value) }
func Int(key string, value int) zap.Field              { return zap.Int(key, value) }
func Int64(key string, value int64) zap.Field          { return zap.Int64(key, value) }
func Uint64(key string, value uint64) zap.Field        { return zap.Uint64(key, value) }
func Bool(key string, value bool) zap.Field            { return zap.Bool(key, value) }
func Duration(key string, value interface{}) zap.Field { return zap.Any(key, value) }
func Error(err error) zap.Field                        { return zap.Error(err) }
