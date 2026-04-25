package redact

import "regexp"

var (
	reBearerToken = regexp.MustCompile(`(?i)Bearer\s+[A-Za-z0-9._~+/=-]+`)
	reSecretParam = regexp.MustCompile(`(?i)(password|token|api_key|secret)=\S+`)
	rePrivateKey  = regexp.MustCompile(`(?s)-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----`)
)

// SensitiveText 替换常见凭证片段，避免 Agent 与终端摘要持久化敏感内容。
func SensitiveText(value string) string {
	result := value
	for _, re := range []*regexp.Regexp{reBearerToken, reSecretParam, rePrivateKey} {
		result = re.ReplaceAllString(result, "[REDACTED]")
	}
	return result
}
