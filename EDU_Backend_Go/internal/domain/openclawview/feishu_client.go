package openclawview

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"

	"edu-platform/internal/config"
)

type FeishuClient struct {
	appID     string
	appSecret string
	domain    string
	http      *http.Client
	logger    *zap.Logger

	mu          sync.Mutex
	accessToken string
	expireAt    time.Time
}

type FeishuMessageBrief struct {
	MessageID    string
	MsgType      string
	SenderType   string
	SenderOpenID string
	CreateTime   int64
	Text         string
	RawContent   string
}

type DownloadedResource struct {
	Data        []byte
	ContentType string
}

func NewFeishuClient(cfg config.FeishuConfig, logger *zap.Logger) *FeishuClient {
	domain := strings.TrimSpace(cfg.Domain)
	if domain == "" {
		domain = "https://open.feishu.cn"
	}
	if !strings.HasPrefix(domain, "http://") && !strings.HasPrefix(domain, "https://") {
		domain = "https://" + domain
	}
	return &FeishuClient{
		appID:     strings.TrimSpace(cfg.AppID),
		appSecret: strings.TrimSpace(cfg.AppSecret),
		domain:    strings.TrimRight(domain, "/"),
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger: logger,
	}
}

func (c *FeishuClient) IsConfigured() bool {
	return c.appID != "" && c.appSecret != ""
}

func (c *FeishuClient) GetHealth(ctx context.Context) (map[string]interface{}, error) {
	token, expireIn, err := c.getTenantAccessToken(ctx, true)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"provider":   "feishu",
		"configured": true,
		"appId":      maskString(c.appID),
		"domain":     c.domain,
		"expiresIn":  expireIn,
		"token":      maskString(token),
	}, nil
}

func (c *FeishuClient) ListRecentBotReplies(ctx context.Context, chatID string, limit int, botOpenID string) ([]FeishuMessageBrief, error) {
	messages, err := c.ListRecentMessages(ctx, chatID, maxInt(limit, 20))
	if err != nil {
		return nil, err
	}
	filtered := make([]FeishuMessageBrief, 0, len(messages))
	for _, message := range messages {
		if message.SenderType == "app" || (botOpenID != "" && message.SenderOpenID == botOpenID) {
			filtered = append(filtered, message)
		}
	}
	if len(filtered) > limit {
		filtered = filtered[len(filtered)-limit:]
	}
	return filtered, nil
}

func (c *FeishuClient) ListRecentMessages(ctx context.Context, chatID string, limit int) ([]FeishuMessageBrief, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("飞书未配置")
	}
	token, _, err := c.getTenantAccessToken(ctx, false)
	if err != nil {
		return nil, err
	}

	maxLimit := minInt(maxInt(limit, 1), 120)
	collected := make([]FeishuMessageBrief, 0, maxLimit)
	pageToken := ""
	for page := 0; page < 5 && len(collected) < maxLimit; page++ {
		query := url.Values{}
		query.Set("container_id_type", "chat")
		query.Set("container_id", chatID)
		query.Set("sort_type", "ByCreateTimeDesc")
		query.Set("page_size", "20")
		if pageToken != "" {
			query.Set("page_token", pageToken)
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.domain+"/open-apis/im/v1/messages?"+query.Encode(), nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+token)

		resp, err := c.http.Do(req)
		if err != nil {
			return nil, err
		}
		body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
		resp.Body.Close()
		if err != nil {
			return nil, err
		}
		if resp.StatusCode >= http.StatusBadRequest {
			return nil, fmt.Errorf("飞书消息查询失败: %s", strings.TrimSpace(string(body)))
		}

		var payload struct {
			Code int    `json:"code"`
			Msg  string `json:"msg"`
			Data struct {
				Items     []map[string]interface{} `json:"items"`
				PageToken string                   `json:"page_token"`
				HasMore   bool                     `json:"has_more"`
			} `json:"data"`
		}
		if err := json.Unmarshal(body, &payload); err != nil {
			return nil, err
		}
		if payload.Code != 0 {
			return nil, fmt.Errorf("飞书消息查询失败: %s", payload.Msg)
		}

		for _, item := range payload.Data.Items {
			collected = append(collected, c.toMessageBrief(item))
		}
		pageToken = payload.Data.PageToken
		if !payload.Data.HasMore || pageToken == "" {
			break
		}
	}

	if len(collected) > maxLimit {
		collected = collected[len(collected)-maxLimit:]
	}
	return collected, nil
}

func (c *FeishuClient) GetMessageResource(ctx context.Context, messageID, fileKey, resourceType string) (*DownloadedResource, error) {
	token, _, err := c.getTenantAccessToken(ctx, false)
	if err != nil {
		return nil, err
	}

	if resourceType == "" {
		resourceType = "file"
	}
	resourceURL := fmt.Sprintf("%s/open-apis/im/v1/messages/%s/resources/%s?type=%s", c.domain, url.PathEscape(messageID), url.PathEscape(fileKey), url.QueryEscape(resourceType))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, resourceURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return nil, fmt.Errorf("飞书文件下载失败: %s", strings.TrimSpace(string(body)))
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	return &DownloadedResource{Data: body, ContentType: contentType}, nil
}

func (c *FeishuClient) ExtractArtifacts(messages []FeishuMessageBrief) []CompletedArtifact {
	artifacts := make([]CompletedArtifact, 0, len(messages))
	for _, message := range messages {
		content := parseJSONObject(message.RawContent)
		switch message.MsgType {
		case "file":
			fileKey := pickString(content["file_key"])
			if fileKey == "" {
				continue
			}
			name := pickString(content["file_name"])
			artifacts = append(artifacts, CompletedArtifact{
				ID:     fmt.Sprintf("feishu-file-%s-%s", message.MessageID, fileKey),
				Name:   defaultString(name, "飞书文件"),
				Type:   "file",
				URL:    fmt.Sprintf("/api/openclaw-view/file/%s/%s?name=%s", url.PathEscape(message.MessageID), url.PathEscape(fileKey), url.QueryEscape(defaultString(name, "download"))),
				Source: "feishu",
			})
		case "image":
			fileKey := pickString(content["image_key"])
			if fileKey == "" {
				continue
			}
			artifacts = append(artifacts, CompletedArtifact{
				ID:     fmt.Sprintf("feishu-image-%s-%s", message.MessageID, fileKey),
				Name:   "飞书图片",
				Type:   "image",
				URL:    fmt.Sprintf("/api/openclaw-view/file/%s/%s?name=%s", url.PathEscape(message.MessageID), url.PathEscape(fileKey), url.QueryEscape("image")),
				Source: "feishu",
			})
		case "audio":
			fileKey := pickString(content["file_key"])
			if fileKey == "" {
				continue
			}
			artifacts = append(artifacts, CompletedArtifact{
				ID:     fmt.Sprintf("feishu-audio-%s-%s", message.MessageID, fileKey),
				Name:   "飞书语音",
				Type:   "audio",
				URL:    fmt.Sprintf("/api/openclaw-view/file/%s/%s?name=%s", url.PathEscape(message.MessageID), url.PathEscape(fileKey), url.QueryEscape("audio")),
				Source: "feishu",
			})
		}
	}
	return artifacts
}

func (c *FeishuClient) toMessageBrief(raw map[string]interface{}) FeishuMessageBrief {
	body, _ := raw["body"].(map[string]interface{})
	sender, _ := raw["sender"].(map[string]interface{})
	senderID, _ := sender["sender_id"].(map[string]interface{})

	content := pickString(body["content"])
	msgType := pickString(raw["msg_type"])
	return FeishuMessageBrief{
		MessageID:    pickString(raw["message_id"]),
		MsgType:      msgType,
		SenderType:   pickString(sender["sender_type"]),
		SenderOpenID: pickString(senderID["open_id"]),
		CreateTime:   pickInt64(raw["create_time"]),
		Text:         c.extractTextByType(msgType, content),
		RawContent:   content,
	}
}

func (c *FeishuClient) extractTextByType(msgType, content string) string {
	parsed := parseJSONObject(content)
	switch msgType {
	case "text":
		return defaultString(pickString(parsed["text"]), "")
	case "file":
		return "[文件] " + defaultString(pickString(parsed["file_name"]), "未命名文件")
	case "image":
		return "[图片消息]"
	case "audio":
		return "[语音消息]"
	case "interactive":
		text := defaultString(pickString(parsed["title"]), "")
		if text == "" {
			return "[卡片消息]"
		}
		return text
	default:
		return content
	}
}

func (c *FeishuClient) getTenantAccessToken(ctx context.Context, force bool) (string, int, error) {
	c.mu.Lock()
	if !force && c.accessToken != "" && time.Now().Before(c.expireAt) {
		token := c.accessToken
		expireIn := int(time.Until(c.expireAt).Seconds())
		c.mu.Unlock()
		return token, expireIn, nil
	}
	c.mu.Unlock()

	payload, _ := json.Marshal(map[string]string{
		"app_id":     c.appID,
		"app_secret": c.appSecret,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.domain+"/open-apis/auth/v3/tenant_access_token/internal", bytes.NewReader(payload))
	if err != nil {
		return "", 0, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return "", 0, err
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return "", 0, fmt.Errorf("飞书鉴权失败: %s", strings.TrimSpace(string(body)))
	}

	var parsed struct {
		Code              int    `json:"code"`
		Msg               string `json:"msg"`
		TenantAccessToken string `json:"tenant_access_token"`
		Expire            int    `json:"expire"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", 0, err
	}
	if parsed.Code != 0 {
		return "", 0, fmt.Errorf("飞书鉴权失败: %s", parsed.Msg)
	}

	c.mu.Lock()
	c.accessToken = parsed.TenantAccessToken
	c.expireAt = time.Now().Add(time.Duration(parsed.Expire-120) * time.Second)
	c.mu.Unlock()

	return parsed.TenantAccessToken, parsed.Expire, nil
}

func maskString(value string) string {
	value = strings.TrimSpace(value)
	if len(value) <= 8 {
		return value
	}
	return value[:4] + "****" + value[len(value)-4:]
}
