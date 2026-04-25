package router_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/casbin/casbin/v2"
)

func mustTestEnforcer(t *testing.T) *casbin.Enforcer {
	t.Helper()

	resolve := func(rel string) string {
		candidates := []string{
			filepath.Join("configs", rel),
			filepath.Join("..", "..", "configs", rel),
			filepath.Join("EDU_Backend_Go", "configs", rel),
		}
		for _, candidate := range candidates {
			if _, err := os.Stat(candidate); err == nil {
				return candidate
			}
		}
		t.Fatalf("resolve test enforcer path failed: %s", rel)
		return ""
	}

	enforcer, err := casbin.NewEnforcer(resolve("rbac_model.conf"), resolve("rbac_policy.csv"))
	if err != nil {
		t.Fatalf("init test enforcer failed: %v", err)
	}
	return enforcer
}
