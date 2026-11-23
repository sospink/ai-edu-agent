# 课程项目协作规则 / Course Project Instructions

本文件用于学生与 OpenCode 在 /workspace/prompt-workbench 中进行课程编码和审查，也适用于仓库中的课程副本。遵守适用的上级规则；以 CONTRACT.md 的 API、数据结构和安全约束为技术依据，其中内部开发人员分工不限制学生修改课程前后端。最新用户要求优先。课程固定为两个小节：理论45分钟、完整实训105分钟。

These instructions guide students and OpenCode when coding and reviewing /workspace/prompt-workbench and its repository copy. Follow applicable parent rules and use CONTRACT.md for APIs, data structures, and safety constraints. Its internal development assignments do not restrict students from changing course frontend or backend code. Latest user instructions take precedence. Exactly two sections: 45-minute theory and 105-minute lab.

平台默认 Lab TTL 为120分钟，10步实训共105分钟，额外预留15分钟用于导出、上传重试与提交回执确认；此缓冲不是额外实验时间，也不保证自动延期。实际以平台倒计时为准。理论阅读应在启动 Lab 前完成；提前导出和提交，剩余时间接近15分钟时优先保存已有证据并提交，未完成任务如实标记，不能等到回收前最后一刻。

The platform default Lab TTL is 120 minutes. The ten steps total 105 minutes, leaving 15 minutes for export, upload retries, and submission receipt confirmation. This buffer is not extra experiment time or an automatic extension. Follow the actual platform countdown. Complete theory before starting the Lab, export and submit early, and prioritize saving existing evidence and submitting when about 15 minutes remain. Mark unfinished tasks honestly rather than waiting until reclamation.

时间压缩仅调整指导节奏，10步任务及验收证据不删减。 / Timing changes shorten guidance, not the ten tasks or their evidence requirements.

## 编码与审查边界 / Coding and Review Scope

- 学生可以按实训任务正常修改本项目 frontend/、backend/、schemas/、samples/、tests/ 及相关项目脚本、依赖声明和说明文件。只修改与当前任务直接相关的内容，保留已有学生改动，不做无关重构。
- OpenCode 首轮先读取当前任务涉及的项目源码和 CONTRACT.md 的接口约定，再给出建议。每条发现注明实际文件、函数、依据、风险及最小验证方式；未读取的内容明确标记为未核实，不凭描述假称已审查。
- 首轮审查只读，不修改文件或执行项目命令。提出具体修改范围及测试计划，由学生确认后再实施；学生已经明确授权的范围无需重复确认，超出范围的修改须另行确认。
- API 变更应核对 CONTRACT.md 中请求/响应字段、普通 JSON 格式、非 2xx 错误及 Schema 约束，同时检查前后端调用方与测试。不要通过删除检查、伪造响应或修改成功标记使验证通过。
- 操作限于本课程项目源码、公开脱敏样例和本次学习成果。不修改教学平台、系统服务配置或其他学生项目，不部署生产服务；通过已提供的课程脚本启动、重启和检查应用。

Students may edit the course frontend, backend, schemas, samples, tests, and related project scripts, dependency declarations, and documentation. Keep edits relevant and preserve existing work. OpenCode first reads relevant source and the API contract, then provides file/function references, evidence, risks, and a minimal verification plan. Mark unread content as unverified. Initial review is read-only: no edits or project command execution. Obtain student confirmation of the concrete change scope and test plan before implementation; do not ask again for an already authorized scope. Confirm additional scope separately. Check API consumers and tests against CONTRACT.md; never bypass checks or fabricate success. Stay within this course project and sanitized learning artifacts; do not modify platform or system configuration, access other students' work, or deploy production services.

## 运行与安全 / Runtime and Safety

- WebIDE 编辑，主 Terminal 执行；固定工作目录 /workspace/prompt-workbench。
- Python 使用 /opt/venvs/prompt-workbench/bin/python；启动 bash scripts/start.sh；前端在 frontend/ 执行 npm run build；测试使用 PYTHON=/opt/venvs/prompt-workbench/bin/python bash scripts/check.sh。
- 后端或 Schema 修改后执行 bash scripts/restart.sh，只重启 workbench 并等待健康恢复。start.sh 在应用健康时提示已运行并退出，不会加载修改。
- 不读取或输出运行凭证、鉴权头、环境内容；不把密钥写进源码、前端、文档、提示词、截图或归档。不要让 OpenCode 审查认证文件。
- 不访问生产资源、其他学生会话或修改平台；只用脱敏案例。新增命令或参数需先核对真实实现，不虚构 CLI 或 API。

Edit in WebIDE, execute in the main Terminal, use the fixed paths and commands above. Never expose runtime credentials or inspect authentication files during assistant review. Use sanitized examples and stay inside the current Lab.

After backend or Schema edits, run bash scripts/restart.sh to restart only workbench and wait for health recovery. start.sh exits when the application is healthy; it does not reload changes.

## 修改后的验证 / Verification After Changes

- 在确认的修改范围内运行相关测试；交付前执行无参数 scripts/check.sh，前端改动另执行 npm run build。记录真实命令、退出码、失败原因和修复后复测结果；无法运行时明确说明，不预测或虚构通过。
- 人工复核源码差异、页面行为、service/symptom 语义及 missing_fields 合理性。将 OpenCode 建议、学生采纳或拒绝理由、复测和剩余限制写入 review.md；工具建议和自动通过都不能替代人工判断。

Run relevant tests within the approved scope, then the no-argument scripts/check.sh before delivery; also run npm run build for frontend changes. Record actual commands, exit codes, failures, and retests. Report unavailable checks honestly. Manually review source changes, UI behavior, semantic faithfulness, and missing information. Record suggestions, student decisions, test evidence, and remaining limits in review.md; neither assistant advice nor automated passes replace human judgment.

## 教学与证据 / Teaching and Evidence

- 理论必须完整可读、无环境操作；实训两语同序，固定 theory.zh-CN.md/theory.en-US.md 与 steps.zh-CN.json/steps.en-US.json 文件名。
- 每步含目标、动作、准确命令、预期、验证、排错与问题；custom 检查必须真实执行，不能用学生填写的 passed=true 代替证据。
- check.sh 离线通过不能当 live 调用证据；请求 ID 应与教师侧网关记录关联。usage 缺失不能填零。
- Schema 故障练习必须修复后交付。直接引用匹配不证明语义真实；人工复核结论与自动结果分开。
- OpenCode 先只读建议，再由学生决定修改；没有真实会话不能声称完成源码审查。
- 自动验证文档存在不等于学习完成。教师核对源码、真实实验、审查、复测、提交回执后才能判定课程闭环。
- 导出白名单未涵盖的材料不可宣称已包含；关键证据写 review.md。下载和真实作业回执之后才结束临时 emptyDir 会话。

Preserve truthful evidence: offline tests are not live calls; missing usage is unknown, not zero; quotation matching is not semantic proof. Require real OpenCode review, human decisions, retesting, and submission receipt. File-presence checks do not establish learning or acceptance.
