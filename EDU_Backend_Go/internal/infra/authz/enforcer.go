package authz

import (
	"os"
	"path/filepath"

	"github.com/casbin/casbin/v2"
	"go.uber.org/zap"

	"edu-platform/internal/config"
)

func ResolveConfigPath(name string) string {
	candidates := []string{
		filepath.Join("configs", name),
		filepath.Join("..", "..", "configs", name),
		filepath.Join("EDU_Backend_Go", "configs", name),
	}

	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}

	return filepath.Join("configs", name)
}

func New(_ *config.Config, log *zap.Logger) (*casbin.Enforcer, error) {
	modelPath := ResolveConfigPath("rbac_model.conf")
	policyPath := ResolveConfigPath("rbac_policy.csv")
	enforcer, err := casbin.NewEnforcer(modelPath, policyPath)
	if err != nil {
		return nil, err
	}
	log.Info("casbin enforcer initialized")
	return enforcer, nil
}
