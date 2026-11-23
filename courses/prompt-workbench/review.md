# 学生证据与人工复核 / Student Evidence and Human Review

**状态 / Status：未填写，未验收 / Unfilled, not accepted.**

这是供学生填写的模板，不是作者已经完成实验的报告。删除说明占位并填写真实证据；无法完成的项目标记“阻塞/未测”并说明原因，不写虚构数据。勿记录凭证、个人敏感信息或完整环境内容。关键证据写在本文件，因为任意 reports/ 文件不在当前导出白名单。

This is an unfilled template, not a completed experiment report. Replace prompts with real evidence. Label blocked/untested items and explain why. Include no credentials or sensitive personal data. Put essential evidence here because arbitrary reports/ files are not allowlisted.

## 1. 身份与环境 / Identity and Environment

课程内标识 / Course pseudonym：

日期、课程版本 / Date and course version：

工作目录、解释器 / Workspace and interpreter：

WebIDE 修改在主 Terminal 可见的证据 / Evidence of shared-file visibility：

health 结果、config 支持参数（不含环境变量）/ Health and supported capabilities：

## 2. 源码链路 / Code Trace

| 环节 / Stage | 实际文件与函数 / File and function | 输入输出、失败边界 / Data and failure boundary |
| --- | --- | --- |
| 请求构造 / Request | 待填写 / To fill | |
| 网关 / Gateway | 待填写 / To fill | |
| 校验 / Validation | 待填写 / To fill | |
| 存储 / Storage | 待填写 / To fill | |
| 导出 / Export | 待填写 / To fill | |

本人源码改动与理由 / My source changes and reasons：

构建命令、真实退出码和界面检查 / Build command, exit code, and UI check：

## 3. 草稿与真实请求 / Draft and Live Request

草稿 ID 与保存/回读/更新结果 / Draft ID and save/reopen/update results：

临时草稿删除及未保存编辑保护 / Disposable draft deletion and unsaved-edit protection：

基线实验 ID、requestId、实际模型、时间、耗时 / Baseline ID, requestId, model, time, latency：

usage（未返回则写未提供）/ Usage (write unavailable if omitted)：

真实失败状态与脱敏信息 / Actual failures and sanitized messages：

教师网关核对状态 / Instructor gateway correlation status：待核对 / Pending.

## 4. Schema 失败与修复 / Schema Failure and Repair

修改前 required 数组 / Original required array：

故意新增 incident_time 后的失败路径、完整校验输出 / Issues and output after intentional fault：

根因解释 / Root-cause explanation：

修复差异（不能放宽类型或证据规则）/ Repair diff without weakening rules：

正例与五类反例结果 / Positive and five counterexamples：

| 用例 / Case | 实际结果及依据 / Actual result and evidence |
| --- | --- |
| 正例 / Positive | 待填写 / To fill |
| 非法 JSON / Malformed JSON | 待填写 / To fill |
| 缺字段 / Missing field | 待填写 / To fill |
| 错误类型 / Wrong type | 待填写 / To fill |
| 额外字段 / Extra field | 待填写 / To fill |
| 伪造引用 / Fabricated evidence | 待填写 / To fill |

重启方式与后续 API 复核 / Restart and later API recheck：

## 5. 单因素对照 / Controlled Comparison

每对只改 outputRequirements；固定其他四要素字段、maxTokens 与实际模型。每条原始响应保留在实验记录，不手工修改。记录失败，不挑选有利样本。

Change only outputRequirements per pair, holding other prompt fields, budget, and actual model constant. Preserve original responses and failures without selecting favorable samples.

| 样例 / Sample | A ID / requestId | B ID / requestId | 唯一改动 / Change | 自动结果 / Automated outcome | 人审与局限 / Human findings and limits |
| --- | --- | --- | --- | --- | --- |
| 1 | 待填写 / To fill | | | | |
| 2 | 待填写 / To fill | | | | |
| 3 | 待填写 / To fill | | | | |

service/symptom 是否忠实，missing_fields 是否合理，引用是否充分 / Semantic faithfulness, missing fields, evidence sufficiency：

实际调用数、失败数、未完成对数、额度限制 / Calls, failures, incomplete pairs, quota limits：

结论（不得由小样本声称普遍提升）/ Conclusion without generalizing small samples：

## 6. OpenCode 真实审查 / Actual OpenCode Review

状态：待执行；不可用则标记阻塞 / Status: pending; mark blocked if unavailable.

会话时间、cwd、实际工具读取文件 / Session time, cwd, files actually read：

只读审查请求与真实回复摘录 / Read-only request and actual response excerpts：

| 文件/函数与发现 / Finding | 依据 / Evidence | 采纳/拒绝与理由 / Decision and reason | 修改与复测 / Change and retest |
| --- | --- | --- | --- |
| 待填写 / To fill | | | |

助手未看到的内容及结论局限 / Unseen content and review limits：

## 7. 最终复测 / Final Retest

check.sh 命令、退出码、覆盖范围 / Check command, exit code, coverage：

npm run build 命令与退出码 / Build command and exit code：

服务健康、真实复跑记录 / Health and live rerun record：

| 页面场景 / UI scenario | 已测/未测、证据与原因 / Tested or untested, evidence and reason |
| --- | --- |
| 空态 / Empty state | 未测 / Untested |
| 运行、禁用、成功 / Running, disabled, success | 未测 / Untested |
| 取消与竞态 / Cancellation and race | 未测 / Untested |
| 失败保留输入 / Input retained after failure | 未测 / Untested |
| 未配置、权限、额度 / Configuration, authorization, quota | 未测 / Untested |
| 删除确认、详情、对照 / Delete confirmation, detail, compare | 未测 / Untested |
| 语言、窄屏 / Language and narrow layout | 未测 / Untested |
| 导出与脱敏 / Export and sanitization | 未测 / Untested |

## 8. 归档与提交 / Archive and Submission

归档名称、生成时间、完整性检查 / Archive name, timestamp, integrity check：

report.json 的数量与 skippedSourceFiles / Counts and skippedSourceFiles：

凭证与敏感内容人工检查 / Human secret and sensitive-content review：

下载至临时卷外的确认 / Download outside temporary volume：

提交入口、实际时间与回执 / Actual submission entry, time, receipt：

注意：回执可能在归档之后产生，应在平台提交说明保留，不伪称先前 ZIP 已包含回执。若重新归档，使用新文件名并核对最终上传版本。

Receipts may be created after export. Retain them in the platform submission notes; do not claim an earlier ZIP contained them. If exporting again, use a new filename and verify the uploaded version.

教师接收与复核：待确认 / Teacher receipt and review: pending.

## 9. 明确限制 / Explicit Limitations

未完成项、阻塞原因与下一步 / Outstanding items, blockers, next actions：

本记录中的自动通过不证明所有事实正确，不证明 OpenCode、网关、平台入口或提交链路已全部验收；分别以真实证据确认。

Automated passes do not prove all facts or establish acceptance of OpenCode, the gateway, platform access, or submission. Verify each with actual evidence.
