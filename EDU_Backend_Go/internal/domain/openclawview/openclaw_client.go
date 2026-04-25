package openclawview

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"edu-platform/internal/config"
)

type OpenClawClient struct {
	gatewayURL      string
	gatewayToken    string
	gatewayPassword string
	connectTimeout  time.Duration
	requestTimeout  time.Duration
	clientID        string
	clientVersion   string
	clientMode      string
	role            string
	scopes          []string
	deviceIdentity  string
	logger          *zap.Logger
}

type gatewayEventMessage struct {
	Type    string                 `json:"type"`
	Event   string                 `json:"event"`
	Payload map[string]interface{} `json:"payload"`
}

type gatewayResponseMessage struct {
	Type    string      `json:"type"`
	ID      string      `json:"id"`
	OK      bool        `json:"ok"`
	Payload interface{} `json:"payload"`
	Error   *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type pendingGatewayRequest struct {
	resp chan gatewayResponseMessage
}

type gatewayConnection struct {
	ws           *websocket.Conn
	logger       *zap.Logger
	pendingMu    sync.Mutex
	pending      map[string]pendingGatewayRequest
	readErr      chan error
	challengeCh  chan string
	closed       chan struct{}
	connectNonce string
}

type deviceIdentity struct {
	DeviceID          string `json:"deviceId"`
	PublicKeyBase64   string `json:"publicKeyBase64"`
	PrivateSeedBase64 string `json:"privateKeySeedBase64"`
}

func NewOpenClawClient(cfg config.OpenClawConfig, logger *zap.Logger) *OpenClawClient {
	connectTimeout := time.Duration(cfg.ConnectTimeoutMS) * time.Millisecond
	if connectTimeout <= 0 {
		connectTimeout = 12 * time.Second
	}
	requestTimeout := time.Duration(cfg.RequestTimeoutMS) * time.Millisecond
	if requestTimeout <= 0 {
		requestTimeout = 15 * time.Second
	}

	scopes := strings.Split(strings.TrimSpace(cfg.ClientScopes), ",")
	filteredScopes := make([]string, 0, len(scopes))
	for _, scope := range scopes {
		scope = strings.TrimSpace(scope)
		if scope == "" {
			continue
		}
		filteredScopes = append(filteredScopes, scope)
	}
	if len(filteredScopes) == 0 {
		filteredScopes = []string{"operator.admin", "operator.approvals", "operator.pairing"}
	}

	devicePath := strings.TrimSpace(cfg.DeviceIdentityPath)
	if devicePath == "" {
		devicePath = ".openclaw-device-identity.json"
	}

	clientID := strings.TrimSpace(cfg.ClientID)
	if clientID == "" {
		clientID = "gateway-client"
	}
	clientVersion := strings.TrimSpace(cfg.ClientVersion)
	if clientVersion == "" {
		clientVersion = "ai-edu-agent"
	}
	clientMode := strings.TrimSpace(cfg.ClientMode)
	if clientMode == "" {
		clientMode = "backend"
	}
	role := strings.TrimSpace(cfg.ClientRole)
	if role == "" {
		role = "operator"
	}

	return &OpenClawClient{
		gatewayURL:      strings.TrimSpace(cfg.GatewayURL),
		gatewayToken:    strings.TrimSpace(cfg.GatewayToken),
		gatewayPassword: strings.TrimSpace(cfg.GatewayPassword),
		connectTimeout:  connectTimeout,
		requestTimeout:  requestTimeout,
		clientID:        clientID,
		clientVersion:   clientVersion,
		clientMode:      clientMode,
		role:            role,
		scopes:          filteredScopes,
		deviceIdentity:  devicePath,
		logger:          logger,
	}
}

func (c *OpenClawClient) IsConfigured() bool {
	return strings.TrimSpace(c.gatewayURL) != ""
}

func (c *OpenClawClient) GetHealth(ctx context.Context) (map[string]interface{}, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("OPENCLAW_GATEWAY_URL 未配置")
	}

	status, err := c.Invoke(ctx, "status", map[string]interface{}{})
	if err != nil {
		return nil, err
	}
	sessions, err := c.Invoke(ctx, "sessions.list", map[string]interface{}{
		"includeGlobal":  true,
		"includeUnknown": true,
		"limit":          5,
	})
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"provider":   "openclaw",
		"configured": true,
		"gateway":    c.gatewayURL,
		"status":     status,
	}
	if items, ok := sessions["sessions"].([]interface{}); ok {
		result["sessionsCount"] = len(items)
	}
	return result, nil
}

func (c *OpenClawClient) GetChatHistory(ctx context.Context, sessionKey string, limit int) (map[string]interface{}, error) {
	return c.Invoke(ctx, "chat.history", map[string]interface{}{
		"sessionKey": sessionKey,
		"limit":      limit,
	})
}

func (c *OpenClawClient) GetSkillsStatus(ctx context.Context) (map[string]interface{}, error) {
	return c.Invoke(ctx, "skills.status", map[string]interface{}{})
}

func (c *OpenClawClient) SendChatMessage(ctx context.Context, sessionKey, text string) (map[string]interface{}, error) {
	return c.Invoke(ctx, "chat.send", map[string]interface{}{
		"sessionKey":     sessionKey,
		"message":        strings.TrimSpace(text),
		"deliver":        false,
		"idempotencyKey": randomID(),
	})
}

func (c *OpenClawClient) Invoke(ctx context.Context, method string, params map[string]interface{}) (map[string]interface{}, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("OPENCLAW_GATEWAY_URL 未配置")
	}

	return c.withConnection(ctx, func(conn *gatewayConnection) (map[string]interface{}, error) {
		payload, err := c.requestRaw(ctx, conn, method, params, c.requestTimeout)
		if err != nil {
			return nil, err
		}
		return payload, nil
	})
}

func (c *OpenClawClient) withConnection(ctx context.Context, fn func(*gatewayConnection) (map[string]interface{}, error)) (map[string]interface{}, error) {
	wsURL, err := c.resolveWebSocketURL()
	if err != nil {
		return nil, err
	}

	dialer := websocket.Dialer{
		HandshakeTimeout: c.connectTimeout,
		Proxy:            http.ProxyFromEnvironment,
	}

	ws, _, err := dialer.DialContext(ctx, wsURL, nil)
	if err != nil {
		return nil, err
	}

	conn := &gatewayConnection{
		ws:          ws,
		logger:      c.logger,
		pending:     map[string]pendingGatewayRequest{},
		readErr:     make(chan error, 1),
		challengeCh: make(chan string, 1),
		closed:      make(chan struct{}),
	}
	defer conn.close()

	go conn.readLoop()

	select {
	case nonce := <-conn.challengeCh:
		conn.connectNonce = nonce
	case <-time.After(600 * time.Millisecond):
	case err := <-conn.readErr:
		return nil, err
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	if _, err := c.requestRaw(ctx, conn, "connect", c.connectParams(conn.connectNonce), c.connectTimeout); err != nil {
		return nil, err
	}
	return fn(conn)
}

func (c *OpenClawClient) requestRaw(ctx context.Context, conn *gatewayConnection, method string, params map[string]interface{}, timeout time.Duration) (map[string]interface{}, error) {
	requestID := randomID()
	respCh := make(chan gatewayResponseMessage, 1)

	conn.pendingMu.Lock()
	conn.pending[requestID] = pendingGatewayRequest{resp: respCh}
	conn.pendingMu.Unlock()
	defer func() {
		conn.pendingMu.Lock()
		delete(conn.pending, requestID)
		conn.pendingMu.Unlock()
	}()

	if err := conn.ws.WriteJSON(map[string]interface{}{
		"type":   "req",
		"id":     requestID,
		"method": method,
		"params": params,
	}); err != nil {
		return nil, err
	}

	timer := time.NewTimer(timeout)
	defer timer.Stop()

	select {
	case response := <-respCh:
		if !response.OK {
			if response.Error != nil && response.Error.Message != "" {
				return nil, errors.New(response.Error.Message)
			}
			return nil, fmt.Errorf("OpenClaw request failed")
		}
		payload, ok := response.Payload.(map[string]interface{})
		if ok {
			return payload, nil
		}
		if response.Payload == nil {
			return map[string]interface{}{}, nil
		}
		raw, _ := json.Marshal(response.Payload)
		result := map[string]interface{}{}
		if err := json.Unmarshal(raw, &result); err != nil {
			return map[string]interface{}{"value": response.Payload}, nil
		}
		return result, nil
	case err := <-conn.readErr:
		return nil, err
	case <-timer.C:
		return nil, fmt.Errorf("OpenClaw request timeout: %s", method)
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (c *OpenClawClient) resolveWebSocketURL() (string, error) {
	raw := strings.TrimSpace(c.gatewayURL)
	if raw == "" {
		return "", fmt.Errorf("OPENCLAW_GATEWAY_URL 未配置")
	}
	if strings.HasPrefix(raw, "ws://") || strings.HasPrefix(raw, "wss://") {
		return raw, nil
	}
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		parsed, err := url.Parse(raw)
		if err != nil {
			return "", err
		}
		if parsed.Scheme == "https" {
			parsed.Scheme = "wss"
		} else {
			parsed.Scheme = "ws"
		}
		return parsed.String(), nil
	}
	return "ws://" + raw, nil
}

func (c *OpenClawClient) connectParams(nonce string) map[string]interface{} {
	identity, err := c.getOrCreateIdentity()
	if err != nil {
		c.logger.Warn("openclaw identity init failed", zap.Error(err))
	}

	signedAt := time.Now().UnixMilli()
	signature := ""
	deviceID := ""
	publicKey := ""
	if identity != nil {
		deviceID = identity.DeviceID
		publicKey = identity.PublicKeyBase64
		signature = c.signPayload(identity, nonce, signedAt)
	}

	auth := map[string]interface{}{}
	if c.gatewayToken != "" {
		auth["token"] = c.gatewayToken
	}
	if c.gatewayPassword != "" {
		auth["password"] = c.gatewayPassword
	}

	device := map[string]interface{}{}
	if deviceID != "" {
		device["id"] = deviceID
		device["publicKey"] = publicKey
		device["signature"] = signature
		device["signedAt"] = signedAt
		if nonce != "" {
			device["nonce"] = nonce
		}
	}

	params := map[string]interface{}{
		"minProtocol": 3,
		"maxProtocol": 3,
		"client": map[string]interface{}{
			"id":         c.clientID,
			"version":    c.clientVersion,
			"platform":   runtime.GOOS,
			"mode":       c.clientMode,
			"instanceId": randomID(),
		},
		"role":      c.role,
		"scopes":    c.scopes,
		"device":    device,
		"caps":      []string{},
		"userAgent": "ai-edu-agent-backend",
		"locale":    "zh-CN",
	}
	if len(auth) > 0 {
		params["auth"] = auth
	}
	return params
}

func (c *OpenClawClient) getOrCreateIdentity() (*deviceIdentity, error) {
	if _, err := os.Stat(c.deviceIdentity); err == nil {
		content, readErr := os.ReadFile(c.deviceIdentity)
		if readErr != nil {
			return nil, readErr
		}
		var identity deviceIdentity
		if err := json.Unmarshal(content, &identity); err != nil {
			return nil, err
		}
		return &identity, nil
	}

	seed := make([]byte, ed25519.SeedSize)
	if _, err := rand.Read(seed); err != nil {
		return nil, err
	}
	privateKey := ed25519.NewKeyFromSeed(seed)
	publicKey := privateKey.Public().(ed25519.PublicKey)
	sum := sha256.Sum256(publicKey)

	identity := &deviceIdentity{
		DeviceID:          hex.EncodeToString(sum[:]),
		PublicKeyBase64:   base64.StdEncoding.EncodeToString(publicKey),
		PrivateSeedBase64: base64.StdEncoding.EncodeToString(seed),
	}

	if err := os.MkdirAll(filepath.Dir(c.deviceIdentity), 0o755); err != nil && !errors.Is(err, os.ErrExist) {
		return identity, err
	}
	content, _ := json.MarshalIndent(identity, "", "  ")
	if err := os.WriteFile(c.deviceIdentity, content, 0o600); err != nil {
		return identity, err
	}
	return identity, nil
}

func (c *OpenClawClient) signPayload(identity *deviceIdentity, nonce string, signedAt int64) string {
	if identity == nil {
		return ""
	}
	seed, err := base64.StdEncoding.DecodeString(identity.PrivateSeedBase64)
	if err != nil || len(seed) != ed25519.SeedSize {
		return ""
	}
	plainText := strings.Join([]string{
		func() string {
			if nonce != "" {
				return "v2"
			}
			return "v1"
		}(),
		identity.DeviceID,
		c.clientID,
		c.clientMode,
		c.role,
		strings.Join(c.scopes, ","),
		fmt.Sprintf("%d", signedAt),
		c.gatewayToken,
		nonce,
	}, "|")
	privateKey := ed25519.NewKeyFromSeed(seed)
	signature := ed25519.Sign(privateKey, []byte(plainText))
	return base64.StdEncoding.EncodeToString(signature)
}

func (conn *gatewayConnection) readLoop() {
	defer close(conn.closed)

	for {
		_, data, err := conn.ws.ReadMessage()
		if err != nil {
			select {
			case conn.readErr <- err:
			default:
			}
			return
		}

		var envelope struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(data, &envelope); err != nil {
			continue
		}

		switch envelope.Type {
		case "event":
			var event gatewayEventMessage
			if err := json.Unmarshal(data, &event); err != nil {
				continue
			}
			if event.Event == "connect.challenge" {
				nonce := pickString(event.Payload["nonce"])
				select {
				case conn.challengeCh <- nonce:
				default:
				}
			}
		case "res":
			var response gatewayResponseMessage
			if err := json.Unmarshal(data, &response); err != nil {
				continue
			}
			conn.pendingMu.Lock()
			pending, ok := conn.pending[response.ID]
			conn.pendingMu.Unlock()
			if ok {
				pending.resp <- response
			}
		}
	}
}

func (conn *gatewayConnection) close() {
	_ = conn.ws.Close()
	select {
	case <-conn.closed:
	case <-time.After(2 * time.Second):
	}
}

func randomID() string {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(value)
}
