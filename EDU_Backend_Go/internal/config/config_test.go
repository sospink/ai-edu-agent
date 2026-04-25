package config

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestDotenvCandidates(t *testing.T) {
	repoRoot := "/tmp/ai-edu-agent"
	goRoot := filepath.Join(repoRoot, "EDU_Backend_Go")

	if got, want := dotenvCandidates(repoRoot), []string{
		filepath.Join(repoRoot, "EDU_Backend", ".env"),
		filepath.Join(repoRoot, "EDU_Backend_Go", ".env"),
	}; !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected repo root candidates: got %v want %v", got, want)
	}

	if got, want := dotenvCandidates(goRoot), []string{
		filepath.Join(goRoot, "..", "EDU_Backend", ".env"),
		filepath.Join(goRoot, ".env"),
	}; !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected go root candidates: got %v want %v", got, want)
	}
}

func TestLoadDotEnvFilesUsesTSAsFallbackAndGoAsOverride(t *testing.T) {
	repoRoot := t.TempDir()
	tsDir := filepath.Join(repoRoot, "EDU_Backend")
	goDir := filepath.Join(repoRoot, "EDU_Backend_Go")

	if err := os.MkdirAll(tsDir, 0o755); err != nil {
		t.Fatalf("mkdir ts dir failed: %v", err)
	}
	if err := os.MkdirAll(goDir, 0o755); err != nil {
		t.Fatalf("mkdir go dir failed: %v", err)
	}

	if err := os.WriteFile(filepath.Join(tsDir, ".env"), []byte("PORT=4000\nJWT_SECRET=ts-secret\n"), 0o644); err != nil {
		t.Fatalf("write ts env failed: %v", err)
	}
	if err := os.WriteFile(filepath.Join(goDir, ".env"), []byte("PORT=4002\nLOG_LEVEL=debug\n"), 0o644); err != nil {
		t.Fatalf("write go env failed: %v", err)
	}

	resetEnv(t, "PORT")
	resetEnv(t, "JWT_SECRET")
	resetEnv(t, "LOG_LEVEL")

	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd failed: %v", err)
	}
	if err := os.Chdir(repoRoot); err != nil {
		t.Fatalf("chdir failed: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(oldWD)
	})

	loaded, err := loadDotEnvFiles()
	if err != nil {
		t.Fatalf("loadDotEnvFiles failed: %v", err)
	}

	if got, want := loaded, []string{
		filepath.Join(repoRoot, "EDU_Backend", ".env"),
		filepath.Join(repoRoot, "EDU_Backend_Go", ".env"),
	}; !reflect.DeepEqual(normalizePaths(got), normalizePaths(want)) {
		t.Fatalf("unexpected loaded files: got %v want %v", got, want)
	}

	if got := os.Getenv("PORT"); got != "4002" {
		t.Fatalf("expected go env to override ts env, got PORT=%s", got)
	}
	if got := os.Getenv("JWT_SECRET"); got != "ts-secret" {
		t.Fatalf("expected ts fallback for JWT_SECRET, got %s", got)
	}
	if got := os.Getenv("LOG_LEVEL"); got != "debug" {
		t.Fatalf("expected go-specific value for LOG_LEVEL, got %s", got)
	}
}

func TestLoadDotEnvFilesDoesNotOverrideProcessEnv(t *testing.T) {
	repoRoot := t.TempDir()
	tsDir := filepath.Join(repoRoot, "EDU_Backend")

	if err := os.MkdirAll(tsDir, 0o755); err != nil {
		t.Fatalf("mkdir ts dir failed: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tsDir, ".env"), []byte("PORT=4000\n"), 0o644); err != nil {
		t.Fatalf("write ts env failed: %v", err)
	}

	t.Setenv("PORT", "4999")

	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd failed: %v", err)
	}
	if err := os.Chdir(repoRoot); err != nil {
		t.Fatalf("chdir failed: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Chdir(oldWD)
	})

	if _, err := loadDotEnvFiles(); err != nil {
		t.Fatalf("loadDotEnvFiles failed: %v", err)
	}

	if got := os.Getenv("PORT"); got != "4999" {
		t.Fatalf("expected process env to win, got PORT=%s", got)
	}
}

func resetEnv(t *testing.T, key string) {
	t.Helper()

	original, exists := os.LookupEnv(key)
	if err := os.Unsetenv(key); err != nil {
		t.Fatalf("unset %s failed: %v", key, err)
	}

	t.Cleanup(func() {
		if exists {
			_ = os.Setenv(key, original)
			return
		}
		_ = os.Unsetenv(key)
	})
}

func normalizePaths(paths []string) []string {
	normalized := make([]string, 0, len(paths))
	for _, path := range paths {
		resolved, err := filepath.EvalSymlinks(path)
		if err != nil {
			normalized = append(normalized, filepath.Clean(path))
			continue
		}
		normalized = append(normalized, filepath.Clean(resolved))
	}
	return normalized
}
