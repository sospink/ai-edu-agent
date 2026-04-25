package app

import (
	"github.com/casbin/casbin/v2"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
	"gorm.io/gorm"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	"edu-platform/internal/config"
)

type Dependencies struct {
	Config   *config.Config
	Logger   *zap.Logger
	DB       *gorm.DB
	Redis    *redis.Client
	K8S      kubernetes.Interface
	K8SRest  *rest.Config
	Enforcer *casbin.Enforcer
}
