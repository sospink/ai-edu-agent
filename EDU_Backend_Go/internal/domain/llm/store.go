// Package llm 管理当前实例的模型配置，密钥仅在后端解密使用。
package llm

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"edu-platform/internal/config"
)

var (
	ErrInvalid     = errors.New("模型配置无效")
	ErrKeyRequired = errors.New("请输入当前服务的密钥")
	ErrConflict    = errors.New("配置已更新，请刷新后重试")
	ErrStorage     = errors.New("模型配置存储不可用")
)

type View struct {
	Provider   string `json:"provider"`
	BaseURL    string `json:"baseUrl"`
	Model      string `json:"model"`
	Configured bool   `json:"configured"`
	Source     string `json:"source"`
	Version    uint64 `json:"version"`
	UpdatedAt  string `json:"updatedAt,omitempty"`
}

type Input struct {
	Provider string `json:"provider"`
	BaseURL  string `json:"baseUrl"`
	Model    string `json:"model"`
	APIKey   string `json:"apiKey"`
	ClearKey bool   `json:"clearKey"`
	Version  uint64 `json:"version"`
}

type record struct {
	View
	Ciphertext string `json:"ciphertext"`
	UpdatedBy  uint64 `json:"updatedBy"`
}

type Store struct {
	mu       sync.Mutex
	dir      string
	fallback config.QwenConfig
}

func NewStore(dir string, fallback config.QwenConfig) *Store {
	return &Store{dir: dir, fallback: fallback}
}

// 每次请求读取一个完整快照；原子替换保证保存不影响进行中的流式回答。
func (s *Store) read() (record, config.QwenConfig, error) {
	data, err := os.ReadFile(filepath.Join(s.dir, "llm.json"))
	if errors.Is(err, os.ErrNotExist) {
		cfg := s.fallback
		provider := "custom"
		if strings.Contains(cfg.BaseURL, "dashscope.aliyuncs.com") {
			provider = "qwen"
		}
		source := "environment"
		if cfg.APIKey == "" {
			source = "none"
		}
		return record{View: View{Provider: provider, BaseURL: cfg.BaseURL, Model: cfg.Model, Configured: cfg.APIKey != "", Source: source}}, cfg, nil
	}
	if err != nil {
		return record{}, config.QwenConfig{}, ErrStorage
	}
	var saved record
	if json.Unmarshal(data, &saved) != nil {
		return record{}, config.QwenConfig{}, ErrStorage
	}
	cfg := config.QwenConfig{BaseURL: saved.BaseURL, Model: saved.Model}
	if saved.Ciphertext != "" {
		key, err := os.ReadFile(filepath.Join(s.dir, "llm.key"))
		if err != nil {
			return record{}, cfg, ErrStorage
		}
		block, err := aes.NewCipher(key)
		if err != nil {
			return record{}, cfg, ErrStorage
		}
		gcm, _ := cipher.NewGCM(block)
		sealed, err := base64.StdEncoding.DecodeString(saved.Ciphertext)
		if err != nil || len(sealed) < gcm.NonceSize() {
			return record{}, cfg, ErrStorage
		}
		plain, err := gcm.Open(nil, sealed[:gcm.NonceSize()], sealed[gcm.NonceSize():], []byte("agent-edu-llm-v1"))
		if err != nil {
			return record{}, cfg, ErrStorage
		}
		cfg.APIKey = string(plain)
	}
	saved.Configured = cfg.APIKey != ""
	saved.Source = "managed"
	return saved, cfg, nil
}

func (s *Store) Get() (View, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, _, err := s.read()
	return r.View, err
}

func (s *Store) Resolve(_ context.Context) (config.QwenConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, cfg, err := s.read()
	return cfg, err
}

func prepare(in Input, old record, previous config.QwenConfig) (config.QwenConfig, error) {
	if in.Version != old.Version {
		return config.QwenConfig{}, ErrConflict
	}
	switch in.Provider {
	case "openai", "deepseek", "minimax", "glm", "qwen", "custom":
	default:
		return config.QwenConfig{}, ErrInvalid
	}
	base, err := ValidateURL(in.BaseURL)
	if err != nil {
		return config.QwenConfig{}, ErrInvalid
	}
	model := strings.TrimSpace(in.Model)
	if model == "" || len(model) > 200 || strings.ContainsAny(model, "\r\n") {
		return config.QwenConfig{}, ErrInvalid
	}
	key := strings.TrimSpace(in.APIKey)
	if len(key) > 8192 || strings.ContainsAny(key, "\r\n") || (in.ClearKey && key != "") {
		return config.QwenConfig{}, ErrInvalid
	}
	if !in.ClearKey && key == "" {
		// 不允许更换供应商或地址时复用旧凭证。
		if old.Provider != in.Provider || strings.TrimRight(previous.BaseURL, "/") != base {
			return config.QwenConfig{}, ErrKeyRequired
		}
		key = previous.APIKey
	}
	if !in.ClearKey && key == "" {
		return config.QwenConfig{}, ErrKeyRequired
	}
	return config.QwenConfig{APIKey: key, BaseURL: base, Model: model}, nil
}

func (s *Store) Preview(in Input) (config.QwenConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, old, err := s.read()
	if err != nil {
		return config.QwenConfig{}, err
	}
	if in.ClearKey {
		return config.QwenConfig{}, ErrKeyRequired
	}
	return prepare(in, r, old)
}

func (s *Store) Save(in Input, actor uint64) (View, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, old, err := s.read()
	if err != nil {
		return View{}, err
	}
	cfg, err := prepare(in, r, old)
	if err != nil {
		return View{}, err
	}
	if os.MkdirAll(s.dir, 0700) != nil {
		return View{}, ErrStorage
	}
	next := record{View: View{Provider: in.Provider, BaseURL: cfg.BaseURL, Model: cfg.Model, Configured: cfg.APIKey != "", Source: "managed", Version: r.Version + 1, UpdatedAt: time.Now().UTC().Format(time.RFC3339)}, UpdatedBy: actor}
	if cfg.APIKey != "" {
		keyPath := filepath.Join(s.dir, "llm.key")
		key, err := os.ReadFile(keyPath)
		if errors.Is(err, os.ErrNotExist) {
			key = make([]byte, 32)
			if _, err = rand.Read(key); err != nil {
				return View{}, ErrStorage
			}
			if err = atomicWrite(keyPath, key); err != nil {
				return View{}, ErrStorage
			}
		} else if err != nil {
			return View{}, ErrStorage
		}
		block, err := aes.NewCipher(key)
		if err != nil {
			return View{}, ErrStorage
		}
		gcm, _ := cipher.NewGCM(block)
		nonce := make([]byte, gcm.NonceSize())
		if _, err := rand.Read(nonce); err != nil {
			return View{}, ErrStorage
		}
		next.Ciphertext = base64.StdEncoding.EncodeToString(gcm.Seal(nonce, nonce, []byte(cfg.APIKey), []byte("agent-edu-llm-v1")))
	}
	data, err := json.Marshal(next)
	if err != nil || atomicWrite(filepath.Join(s.dir, "llm.json"), data) != nil {
		return View{}, ErrStorage
	}
	return next.View, nil
}

func atomicWrite(path string, data []byte) error {
	f, err := os.CreateTemp(filepath.Dir(path), ".llm-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(data); err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(f.Name(), path)
}
