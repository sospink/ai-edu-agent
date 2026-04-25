# M7 AI 助教辅助闭环交付记录

最后更新：2026-04-24

## 本轮层级

- 层级：`L3 大模块 / 业务子系统`
- 本轮完成度：已完成 M7 首版主链路
- 最小闭环范围：AI 建议生成与追溯、教师确认门禁、评分 / 退回采纳联动、admin AI 开关、教师端与管理端入口、专项测试。

## 已完成闭环项

- 后端新增 `ai_requests / ai_suggestions / ai_feature_settings`，并补生产 SQL 迁移 `EDU_Backend_Go/deployments/sql/20260424_m7_ai_assistant.sql` 与 AutoMigrate 注册。
- 教师端新增三类 AI 建议接口：
  - `POST /api/teacher/submissions/:id/ai/suggest-feedback`
  - `POST /api/teacher/assignments/:id/ai/summary`
  - `POST /api/teacher/students/:id/ai/weakness`
- 教师端新增 AI 状态与建议状态接口：
  - `GET /api/teacher/ai/status`
  - `PATCH /api/teacher/ai-suggestions/:id`
- 管理端新增 AI 能力开关：
  - `GET /api/admin/ai-settings`
  - `PATCH /api/admin/ai-settings`
- `grade / return` 支持可选 `aiSuggestionId`；只有当前教师创建、当前提交、pending 状态的 `feedback_draft` 可被采用，采用后写入 `adopted_content` 并置为 `confirmed`。
- 重复生成同一 `source_type + source_id + suggestion_type` 时，旧 pending 自动 `dismissed`，新建议保持 `pending`。
- admin 关闭 AI 后，教师三类生成接口返回 `503 AI 辅助能力已关闭`，并记录 failed `ai_requests`；开关变更写入 M6 `audit_logs`。
- 前端已补：
  - `/teacher/submissions/:id` AI 反馈草稿、预览、填入评分反馈 / 退回意见、忽略
  - `/teacher/dashboard` 风险学生 AI 诊断与作业进度 AI 摘要
  - `/admin/settings` AI 辅助能力开关

## 安全边界

- AI 只生成教师助手草稿，不自动评分、不自动发布成绩、不直接通知学生。
- 学生侧仍只看 M4/M5 中教师确认后的评分、退回反馈和成绩发布结果。
- `evidence_json` 仅保存证据 ID、状态、摘要和截断标记，不保存完整超长日志。
- 输出 prompt 固定要求中文结构：`主要问题 / 建议反馈 / 依据`，并禁止给最终分数。

## 验证

- `cd EDU_Backend_Go && go test ./internal/router -run TestM7 -count=1`
  - 通过
- `cd EDU_Backend_Go && go test ./...`
  - 通过
- `cd EDU_Frontend && npm exec tsc --noEmit`
  - 通过

## 明确未完成项

- 未做学生侧 AI 对话、AI 摘要发布给学生或流式生成。
- 未做自动评分、分数建议入库、成本账单或 AI 运维面板。
- 未补浏览器级真实冒烟截图 / 录屏附件。
- AI 生成质量仍依赖当前 Qwen / DashScope 配置与提交证据质量；后续可补模型运维、成本追踪和更细粒度 prompt 版本管理。
