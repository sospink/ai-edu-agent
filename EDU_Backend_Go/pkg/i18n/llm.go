package i18n

func init() {
	translations := map[MessageKey][2]string{
		"llm.loaded":      {"模型配置已读取", "Model configuration loaded"},
		"llm.saved":       {"模型配置已保存并生效", "Model configuration saved and applied"},
		"llm.tested":      {"连接测试成功", "Connection test succeeded"},
		"llm.invalid":     {"请填写有效的供应商、模型名称和公网 HTTPS API 地址", "Enter a valid provider, model name and public HTTPS API URL"},
		"llm.keyRequired": {"请填写密钥；更换供应商或地址后需重新输入", "Enter an API key; a new provider or URL requires re-entering the key"},
		"llm.conflict":    {"配置已被更新，请刷新后重新编辑", "Configuration changed. Refresh before editing again"},
		"llm.storage":     {"模型配置无法读取或保存，请检查服务端配置目录与加密密钥", "Cannot read or save model configuration. Check server storage and encryption key"},
		"llm.busy":        {"已有连接测试正在运行，请稍后重试", "A connection test is running. Try again shortly"},
		"llm.connection":  {"无法连接模型服务，请检查地址和服务器网络", "Cannot reach the model service. Check the URL and server network"},
		"llm.auth":        {"模型服务拒绝认证，请检查密钥及模型权限", "Authentication rejected. Check the API key and model permissions"},
		"llm.model":       {"模型或接口不存在，请检查 API 地址和模型名称", "Model or endpoint not found. Check the API URL and model name"},
		"llm.rate":        {"模型服务限流或额度不足，请检查账户额度", "Model service rate limit or quota exceeded. Check your account"},
		"llm.provider":    {"模型服务拒绝请求，请检查模型、额度和接口兼容性", "Model service rejected the request. Check model, quota and API compatibility"},
		"llm.response":    {"未收到有效回答，请确认模型支持 Chat Completions 文本输出", "No valid answer received. Check Chat Completions text output support"},
	}
	for key, pair := range translations {
		keyedMessages[LocaleZhCN][key] = pair[0]
		keyedMessages[LocaleEnUS][key] = pair[1]
	}
}
