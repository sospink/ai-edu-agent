package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

type Config struct {
	App       AppConfig       `mapstructure:"app"`
	Server    ServerConfig    `mapstructure:"server"`
	Database  DatabaseConfig  `mapstructure:"database"`
	Redis     RedisConfig     `mapstructure:"redis"`
	Log       LogConfig       `mapstructure:"log"`
	JWT       JWTConfig       `mapstructure:"jwt"`
	Security  SecurityConfig  `mapstructure:"security"`
	Upload    UploadConfig    `mapstructure:"upload"`
	LabSSH    LabSSHConfig    `mapstructure:"lab_ssh"`
	WebSocket WebSocketConfig `mapstructure:"websocket"`
	Docker    DockerConfig    `mapstructure:"docker"`
	K8S       K8SConfig       `mapstructure:"k8s"`
	Qwen      QwenConfig      `mapstructure:"qwen"`
	OpenClaw  OpenClawConfig  `mapstructure:"openclaw"`
	Feishu    FeishuConfig    `mapstructure:"feishu"`

	LoadedEnvFiles []string `mapstructure:"-"`
}

type AppConfig struct {
	Name    string `mapstructure:"name"`
	Env     string `mapstructure:"env"`
	Version string `mapstructure:"version"`
}

type ServerConfig struct {
	Host                string `mapstructure:"host"`
	Port                int    `mapstructure:"port"`
	ReadTimeoutSeconds  int    `mapstructure:"read_timeout_seconds"`
	WriteTimeoutSeconds int    `mapstructure:"write_timeout_seconds"`
}

func (c ServerConfig) Address() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

func (c ServerConfig) ReadTimeout() time.Duration {
	return time.Duration(c.ReadTimeoutSeconds) * time.Second
}

func (c ServerConfig) WriteTimeout() time.Duration {
	return time.Duration(c.WriteTimeoutSeconds) * time.Second
}

type DatabaseConfig struct {
	Host                   string `mapstructure:"host"`
	Port                   int    `mapstructure:"port"`
	User                   string `mapstructure:"user"`
	Password               string `mapstructure:"password"`
	Name                   string `mapstructure:"name"`
	Charset                string `mapstructure:"charset"`
	MaxOpenConns           int    `mapstructure:"max_open_conns"`
	MaxIdleConns           int    `mapstructure:"max_idle_conns"`
	ConnMaxLifetimeMinutes int    `mapstructure:"conn_max_lifetime_minutes"`
	AutoMigrate            bool   `mapstructure:"auto_migrate"`
}

type RedisConfig struct {
	Addr     string `mapstructure:"addr"`
	Password string `mapstructure:"password"`
	DB       int    `mapstructure:"db"`
	Enabled  bool   `mapstructure:"enabled"`
}

type LogConfig struct {
	Level string `mapstructure:"level"`
	Dir   string `mapstructure:"dir"`
}

type JWTConfig struct {
	Secret    string `mapstructure:"secret"`
	ExpiresIn string `mapstructure:"expires_in"`
	Issuer    string `mapstructure:"issuer"`
}

type SecurityConfig struct {
	AllowedOrigins       []string `mapstructure:"allowed_origins"`
	DefaultAdminPassword string   `mapstructure:"default_admin_password"`
}

type UploadConfig struct {
	Root       string `mapstructure:"root"`
	PublicBase string `mapstructure:"public_base"`
	MaxImageMB int64  `mapstructure:"max_image_mb"`
	MaxFileMB  int64  `mapstructure:"max_file_mb"`
}

type LabSSHConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
}

type WebSocketConfig struct {
	Port          int  `mapstructure:"port"`
	TerminalDebug bool `mapstructure:"terminal_debug"`
}

type DockerConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	TLS      bool   `mapstructure:"tls"`
	CertPath string `mapstructure:"cert_path"`
}

type K8SConfig struct {
	Enabled            bool   `mapstructure:"enabled"`
	InCluster          bool   `mapstructure:"in_cluster"`
	Kubeconfig         string `mapstructure:"kubeconfig"`
	Namespace          string `mapstructure:"namespace"`
	RuntimeNamespace   string `mapstructure:"runtime_namespace"`
	IngressClass       string `mapstructure:"ingress_class"`
	LabImagePullSecret string `mapstructure:"lab_image_pull_secret"`
	MaxActiveLabs      int    `mapstructure:"max_active_labs"`
}

func (c K8SConfig) ResolvedKubeconfig() string {
	if c.Kubeconfig == "" {
		return ""
	}
	if filepath.IsAbs(c.Kubeconfig) {
		return c.Kubeconfig
	}

	wd, err := os.Getwd()
	if err == nil {
		candidate := filepath.Clean(filepath.Join(wd, c.Kubeconfig))
		if _, statErr := os.Stat(candidate); statErr == nil {
			return candidate
		}

		projectRelative := filepath.Clean(filepath.Join(wd, "EDU_Backend_Go", c.Kubeconfig))
		if _, statErr := os.Stat(projectRelative); statErr == nil {
			return projectRelative
		}
	}

	return filepath.Clean(c.Kubeconfig)
}

type QwenConfig struct {
	APIKey  string `mapstructure:"api_key"`
	BaseURL string `mapstructure:"base_url"`
	Model   string `mapstructure:"model"`
}

type OpenClawConfig struct {
	GatewayURL         string `mapstructure:"gateway_url"`
	GatewayToken       string `mapstructure:"gateway_token"`
	GatewayPassword    string `mapstructure:"gateway_password"`
	ModelID            string `mapstructure:"model_id"`
	BaseURL            string `mapstructure:"base_url"`
	APIKey             string `mapstructure:"api_key"`
	APIProtocol        string `mapstructure:"api_protocol"`
	ContextWindow      string `mapstructure:"context_window"`
	MaxTokens          string `mapstructure:"max_tokens"`
	ConnectTimeoutMS   int    `mapstructure:"connect_timeout_ms"`
	RequestTimeoutMS   int    `mapstructure:"request_timeout_ms"`
	RetryTimes         int    `mapstructure:"retry_times"`
	ClientID           string `mapstructure:"client_id"`
	ClientVersion      string `mapstructure:"client_version"`
	ClientMode         string `mapstructure:"client_mode"`
	ClientRole         string `mapstructure:"client_role"`
	ClientScopes       string `mapstructure:"client_scopes"`
	DeviceIdentityPath string `mapstructure:"device_identity_path"`
	ProjectLabRuntime  string `mapstructure:"project_lab_runtime"`
}

type FeishuConfig struct {
	AppID     string `mapstructure:"app_id"`
	AppSecret string `mapstructure:"app_secret"`
	Domain    string `mapstructure:"domain"`
	ChatID    string `mapstructure:"chat_id"`
	BotOpenID string `mapstructure:"bot_open_id"`
}

func Load() (*Config, error) {
	loadedEnvFiles, err := loadDotEnvFiles()
	if err != nil {
		return nil, err
	}

	v := viper.New()
	v.SetConfigName("app")
	v.SetConfigType("yaml")
	v.AddConfigPath("./configs")
	v.AddConfigPath(filepath.Join(".", "EDU_Backend_Go", "configs"))

	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("read config failed: %w", err)
	}

	overrideEnv(v)

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config failed: %w", err)
	}
	cfg.LoadedEnvFiles = loadedEnvFiles
	return &cfg, nil
}

func loadDotEnvFiles() ([]string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("resolve working directory failed: %w", err)
	}

	candidates := dotenvCandidates(wd)
	merged := make(map[string]string)
	loaded := make([]string, 0, len(candidates))

	for _, candidate := range candidates {
		if candidate == "" {
			continue
		}

		resolved := filepath.Clean(candidate)
		if _, statErr := os.Stat(resolved); statErr != nil {
			continue
		}

		envMap, readErr := godotenv.Read(resolved)
		if readErr != nil {
			return nil, fmt.Errorf("read dotenv %s failed: %w", resolved, readErr)
		}

		for key, value := range envMap {
			merged[key] = value
		}
		loaded = append(loaded, resolved)
	}

	for key, value := range merged {
		if _, exists := os.LookupEnv(key); !exists {
			if setErr := os.Setenv(key, value); setErr != nil {
				return nil, fmt.Errorf("set env %s failed: %w", key, setErr)
			}
		}
	}

	return loaded, nil
}

func dotenvCandidates(wd string) []string {
	base := filepath.Base(wd)
	if base == "EDU_Backend_Go" {
		return []string{
			filepath.Join(wd, "..", "EDU_Backend", ".env"),
			filepath.Join(wd, ".env"),
		}
	}

	return []string{
		filepath.Join(wd, "EDU_Backend", ".env"),
		filepath.Join(wd, "EDU_Backend_Go", ".env"),
	}
}

func overrideEnv(v *viper.Viper) {
	setString(v, "app.name", "APP_NAME")
	setString(v, "app.env", "APP_ENV")
	setString(v, "app.version", "APP_VERSION")
	setString(v, "server.host", "SERVER_HOST")
	setInt(v, "server.port", "SERVER_PORT")
	setInt(v, "server.read_timeout_seconds", "SERVER_READ_TIMEOUT_SECONDS")
	setInt(v, "server.write_timeout_seconds", "SERVER_WRITE_TIMEOUT_SECONDS")
	setString(v, "database.host", "DATABASE_HOST")
	setInt(v, "database.port", "DATABASE_PORT")
	setString(v, "database.user", "DATABASE_USER")
	setString(v, "database.password", "DATABASE_PASSWORD")
	setString(v, "database.name", "DATABASE_NAME")
	setString(v, "database.charset", "DATABASE_CHARSET")
	setInt(v, "database.max_open_conns", "DATABASE_MAX_OPEN_CONNS")
	setInt(v, "database.max_idle_conns", "DATABASE_MAX_IDLE_CONNS")
	setInt(v, "database.conn_max_lifetime_minutes", "DATABASE_CONN_MAX_LIFETIME_MINUTES")
	setBool(v, "database.auto_migrate", "DATABASE_AUTO_MIGRATE")
	setString(v, "log.level", "LOG_LEVEL")
	setString(v, "log.dir", "LOG_DIR")
	setString(v, "redis.addr", "REDIS_ADDR")
	setString(v, "redis.password", "REDIS_PASSWORD")
	setInt(v, "redis.db", "REDIS_DB")
	setBool(v, "redis.enabled", "REDIS_ENABLED")
	setString(v, "jwt.secret", "JWT_SECRET")
	setString(v, "jwt.expires_in", "JWT_EXPIRES_IN")
	setString(v, "jwt.issuer", "JWT_ISSUER")
	setStringSlice(v, "security.allowed_origins", "SECURITY_ALLOWED_ORIGINS")
	setString(v, "security.default_admin_password", "DEFAULT_ADMIN_PASSWORD")
	setString(v, "upload.root", "UPLOAD_ROOT")
	setString(v, "upload.public_base", "UPLOAD_PUBLIC_BASE")
	setInt64(v, "upload.max_image_mb", "UPLOAD_MAX_IMAGE_MB")
	setInt64(v, "upload.max_file_mb", "UPLOAD_MAX_FILE_MB")
	setString(v, "lab_ssh.host", "LAB_SSH_HOST")
	setInt(v, "lab_ssh.port", "LAB_SSH_PORT")
	setString(v, "lab_ssh.user", "LAB_SSH_USER")
	setString(v, "lab_ssh.password", "LAB_SSH_PASSWORD")
	setInt(v, "websocket.port", "WS_PORT")
	setBool(v, "websocket.terminal_debug", "TERMINAL_DEBUG")
	setString(v, "docker.host", "DOCKER_HOST")
	setInt(v, "docker.port", "DOCKER_PORT")
	setBool(v, "docker.tls", "DOCKER_TLS")
	setString(v, "docker.cert_path", "DOCKER_CERT_PATH")
	setBool(v, "k8s.enabled", "K8S_ENABLED")
	setBool(v, "k8s.in_cluster", "K8S_IN_CLUSTER")
	setString(v, "k8s.kubeconfig", "K8S_KUBECONFIG")
	setString(v, "k8s.namespace", "K8S_NAMESPACE")
	setString(v, "k8s.runtime_namespace", "K8S_RUNTIME_NAMESPACE")
	setString(v, "k8s.ingress_class", "K8S_INGRESS_CLASS")
	setString(v, "k8s.lab_image_pull_secret", "K8S_LAB_IMAGE_PULL_SECRET")
	setInt(v, "k8s.max_active_labs", "K8S_MAX_ACTIVE_LABS")
	setString(v, "qwen.api_key", "QWEN_API_KEY")
	setString(v, "qwen.api_key", "DASHSCOPE_API_KEY")
	setString(v, "qwen.base_url", "QWEN_BASE_URL")
	setString(v, "qwen.model", "QWEN_MODEL")
	setString(v, "openclaw.gateway_url", "OPENCLAW_GATEWAY_URL")
	setString(v, "openclaw.gateway_token", "OPENCLAW_GATEWAY_TOKEN")
	setString(v, "openclaw.gateway_password", "OPENCLAW_GATEWAY_PASSWORD")
	setString(v, "openclaw.model_id", "OPENCLAW_MODEL_ID")
	setString(v, "openclaw.base_url", "OPENCLAW_BASE_URL")
	setString(v, "openclaw.api_key", "OPENCLAW_API_KEY")
	setString(v, "openclaw.api_protocol", "OPENCLAW_API_PROTOCOL")
	setString(v, "openclaw.context_window", "OPENCLAW_CONTEXT_WINDOW")
	setString(v, "openclaw.max_tokens", "OPENCLAW_MAX_TOKENS")
	setInt(v, "openclaw.connect_timeout_ms", "OPENCLAW_CONNECT_TIMEOUT_MS")
	setInt(v, "openclaw.request_timeout_ms", "OPENCLAW_REQUEST_TIMEOUT_MS")
	setInt(v, "openclaw.retry_times", "OPENCLAW_RETRY_TIMES")
	setString(v, "openclaw.client_id", "OPENCLAW_CLIENT_ID")
	setString(v, "openclaw.client_version", "OPENCLAW_CLIENT_VERSION")
	setString(v, "openclaw.client_mode", "OPENCLAW_CLIENT_MODE")
	setString(v, "openclaw.client_role", "OPENCLAW_CLIENT_ROLE")
	setString(v, "openclaw.client_scopes", "OPENCLAW_CLIENT_SCOPES")
	setString(v, "openclaw.device_identity_path", "OPENCLAW_DEVICE_IDENTITY_PATH")
	setString(v, "openclaw.project_lab_runtime", "PROJECT_LAB_RUNTIME")
	setString(v, "feishu.app_id", "FEISHU_APP_ID")
	setString(v, "feishu.app_secret", "FEISHU_APP_SECRET")
	setString(v, "feishu.domain", "FEISHU_DOMAIN")
	setString(v, "feishu.chat_id", "FEISHU_CHAT_ID")
	setString(v, "feishu.bot_open_id", "FEISHU_BOT_OPEN_ID")

	setString(v, "server.host", "HOST")
	setInt(v, "server.port", "PORT")
	setString(v, "app.env", "NODE_ENV")
	setString(v, "database.host", "MYSQL_HOST")
	setInt(v, "database.port", "MYSQL_PORT")
	setString(v, "database.user", "MYSQL_USER")
	setString(v, "database.password", "MYSQL_PASSWORD")
	setString(v, "database.name", "MYSQL_DATABASE")
}

func setString(v *viper.Viper, key, env string) {
	if value := strings.TrimSpace(v.GetString(env)); value != "" {
		v.Set(key, value)
	}
}

func setInt(v *viper.Viper, key, env string) {
	if raw := strings.TrimSpace(v.GetString(env)); raw != "" {
		if value, err := strconv.Atoi(raw); err == nil {
			v.Set(key, value)
		}
	}
}

func setInt64(v *viper.Viper, key, env string) {
	if raw := strings.TrimSpace(v.GetString(env)); raw != "" {
		if value, err := strconv.ParseInt(raw, 10, 64); err == nil {
			v.Set(key, value)
		}
	}
}

func setBool(v *viper.Viper, key, env string) {
	if raw := strings.TrimSpace(v.GetString(env)); raw != "" {
		if value, err := strconv.ParseBool(raw); err == nil {
			v.Set(key, value)
		}
	}
}

func setStringSlice(v *viper.Viper, key, env string) {
	raw := strings.TrimSpace(v.GetString(env))
	if raw == "" {
		return
	}
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	if len(result) > 0 {
		v.Set(key, result)
	}
}
