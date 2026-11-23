# 大模型服务配置

## 管理入口与生效范围

管理员进入 `/admin/settings` 的“大模型服务”，选择 OpenAI、DeepSeek、MiniMax、GLM、Qwen 或自定义兼容服务，填写 API 基础地址、模型 ID 和 API Key。供应商预设仅填写基础地址，模型 ID 按账户实际可用模型填写；MiniMax 中国站、GLM 国际站等可修改地址。

统一协议为 OpenAI 兼容的 `POST /chat/completions`，支持文本回答及 SSE 流式回答，不代表支持 Anthropic 原生 Messages 或 OpenAI Responses 协议。API 基础地址可以包含 `/v1`、`/api/paas/v4` 等路径；粘贴以 `/chat/completions` 结尾的完整地址时会自动规范化。

“测试连接”会实际请求一次模型，可能产生少量费用，不保存配置。“保存并生效”影响后续学生助手问答、流式辅导、代码解释、验证建议、Prompt Enhance 和教师反馈草稿、摘要、诊断。正在生成的回答使用开始时的配置快照，不会被中途切换打断。

已有密钥不回显；地址和供应商未变时留空可保留密钥，更换地址或供应商必须重新填写。清除密钥需要确认，清除后不会回退到旧环境变量。AI 功能总开关保持独立。知识型课时嵌入的 Dify 应用仍在 Dify 平台配置模型。

## 服务端持久化与运维

- 不需要新增环境变量或数据库迁移。
- 配置目录为上传目录的同级 `.settings/`。默认 `UPLOAD_ROOT=public/uploads` 时，文件为 `public/.settings/llm.json` 和 `public/.settings/llm.key`。
- `llm.json` 中密钥采用 AES-256-GCM 加密，`llm.key` 在首次保存时随机生成。目录权限 0700，文件权限 0600；只有 Go 服务账户应有访问权限。
- 该目录在 `/uploads` 静态服务范围之外，不应被 Nginx 直接映射。Git 已忽略 `.settings`，增量部署脚本保留 `public/.settings`。
- 完整备份和迁移必须同时保留上述两个文件；只迁移数据库不能迁移模型配置。加密主密钥丢失或配置损坏时失败关闭，不静默使用旧凭证。恢复时应由运维从完整备份恢复两个文件。
- 本实现面向当前每台服务器一个 Go 服务进程；35、42 各自保存独立配置。多实例共享同一个配置目录不属于支持的写入模式；扩容为多写实例时应迁移到集中配置存储和共享密钥管理。
- 尚未在管理端保存时兼容 `QWEN_API_KEY` / `DASHSCOPE_API_KEY`、`QWEN_BASE_URL`、`QWEN_MODEL`。第一次保存后管理端配置优先，可移除这些旧环境变量。
- 保存采用文件原子替换和版本检查；遇到 409 表示另一位管理员已更新，刷新后重新编辑。
- 新增网页配置要求公网 HTTPS 地址，连接时校验 DNS 解析结果，禁止内网和元数据地址、重定向。部署环境变量原有的内部服务地址保留兼容。
- 管理页面应通过 HTTPS 或可信 SSH 隧道使用；服务端加密存储不替代浏览器到平台的传输加密。

## 接口

全部接口要求管理员认证和既有 Casbin 权限，保持 `success/data/message/error/code` 格式及中英文响应。

- `GET /api/admin/model-settings`：返回供应商、基础地址、模型、是否有密钥、来源和版本，不含密钥或密文。
- `PUT /api/admin/model-settings`：提交 `provider/baseUrl/model/apiKey/version`；`clearKey=true` 明确清除密钥。
- `POST /api/admin/model-settings/test`：测试同样的表单字段，不写入；单实例同时只运行一次测试，30 秒超时。返回模型 ID 和耗时，不转发供应商原始错误内容。

## 兼容协议参考

- [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat)
- [DeepSeek API](https://api-docs.deepseek.com/en/)
- [MiniMax OpenAI SDK](https://platform.minimax.io/docs/api-reference/text-openai-api)
- [GLM OpenAI 兼容接口](https://docs.bigmodel.cn/cn/guide/develop/openai/introduction)
