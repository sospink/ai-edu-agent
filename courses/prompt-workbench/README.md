# 提示词工作台 / Prompt Workbench

校园云服务报障结构化教学案例。课程只有两个小节：**纯理论 45 分钟 + 完整实训 105 分钟**。不拆成四课时，不沿用旧截图界面。本目录中的 FastAPI 是学生课程应用；平台主后端仍为 Go，不在本课程中修改或部署平台。

Campus cloud incident structuring course: **45 minutes of theory + 105 minutes of practical work**, in exactly two sections. The FastAPI app runs inside the student's Lab; it does not replace the platform Go backend. The interface is redesigned rather than copied from an earlier screenshot.

平台默认 Lab TTL 为120分钟，10步实训共105分钟，额外预留15分钟用于导出、上传重试与提交回执确认；此缓冲不是额外实验时间，也不保证自动延期。实际以平台倒计时为准。理论阅读应在启动 Lab 前完成；提前导出和提交，剩余时间接近15分钟时优先保存已有证据并提交，未完成任务如实标记，不能等到回收前最后一刻。

The platform default Lab TTL is 120 minutes. The ten steps total 105 minutes, leaving 15 minutes for export, upload retries, and submission receipt confirmation. This buffer is not extra experiment time or an automatic extension. Follow the actual platform countdown. Complete theory before starting the Lab, export and submit early, and prioritize saving existing evidence and submitting when about 15 minutes remain. Mark unfinished tasks honestly rather than waiting until reclamation.

时间压缩仅调整指导节奏，10步任务及验收证据不删减。 / Timing changes shorten guidance, not the ten tasks or their evidence requirements.

## 课程材料 / Course Materials

| 小节 / Section | 中文 | English |
| --- | --- | --- |
| 01 理论 / Theory | [完整阅读材料](materials/theory.zh-CN.md) | [Full reading](materials/theory.en-US.md) |
| 02 实训 / Lab | [10步完整手册](manuals/lab.zh-CN.md) | [Complete 10-step manual](manuals/lab.en-US.md) |
| AgentStep 导入 | [中文步骤数组](manuals/steps.zh-CN.json) | [English step array](manuals/steps.en-US.json) |
| 人工证据 / Evidence | [双语 review.md 模板](review.md) | [Bilingual review template](review.md) |

JSON 两语同序、同数量。每项仅含 title、content、quickQuestions、verification；content 使用 text/code，verification 使用 custom 和实际命令。两份数组由课程入库工具按同序关联翻译，不在此处执行入库。导入之后仍需在目标 Lab 验证命令超时、执行环境和失败反馈。

The JSON arrays share order and count. Content blocks use text/code and checks use custom commands. Course-import tooling links translations by position; no import is performed here. Check timeout handling, execution context, and error feedback in the target Lab after import.

## 编辑与运行 / Editing and Execution

**WebIDE 只负责编辑；主容器 Terminal 负责运行。** 两者共享 /workspace 文件，但依赖与进程不共享。项目固定在 /workspace/prompt-workbench，课程 Python 固定为 /opt/venvs/prompt-workbench/bin/python。不要在 IDE 的 Python 中临时安装包，也不要把平台 3000 端口拿来运行课程应用。

**Edit in WebIDE; execute in the main-container Terminal.** Files are shared, processes and dependencies are not. The project and interpreter paths below are fixed course paths. Port 3000 belongs to WebIDE; the course app uses 8000.

~~~bash
cd /workspace/prompt-workbench
bash scripts/start.sh
~~~

课程镜像由 supervisor 以 student（UID1000）启动 workbench API，学生主 Terminal 同样使用 UID1000。start.sh 检测到 health 正常时提示已运行并退出，不会重启服务。Desktop 浏览器访问 http://127.0.0.1:8000。平台代理入口需另外验证，不以 localhost 可访问代替。前端修改后必须重新构建并刷新：

The course image uses supervisor to start the workbench API as student (UID1000); the student main Terminal also runs as UID1000. When health is normal, start.sh reports that the app is running and exits without restarting it. Access http://127.0.0.1:8000 in Desktop; platform proxy access requires separate verification. Rebuild and refresh after frontend edits:

~~~bash
cd /workspace/prompt-workbench/frontend
npm run build
~~~

后端或 Schema 修改保存后，必须执行以下重启命令。它通过 supervisorctl 只重启 workbench 并等待 health 恢复；不要用 start.sh 代替重启。失败时检查命令输出和 /var/log/course/workbench-error.log，修复后重试。

After saving backend or Schema changes, run the following command. It uses supervisorctl to restart only workbench and waits for health recovery. start.sh is not a substitute for restart. On failure, inspect command output and /var/log/course/workbench-error.log, fix the issue, and retry.

~~~bash
cd /workspace/prompt-workbench
bash scripts/restart.sh
~~~

~~~bash
cd /workspace/prompt-workbench
PYTHON=/opt/venvs/prompt-workbench/bin/python bash scripts/check.sh
curl --fail --silent --show-error http://127.0.0.1:8000/api/health
~~~

check.sh 的测试使用本地测试 transport，不消耗模型额度，**不证明真实模型连接成功**。本课程统一使用无参数全量检查。/api/health 证明应用健康；/api/config 会探测 /models 并缓存5秒，configured=true 不证明生成配额或工具调用可用；真实运行仍需 requestId 与教师侧网关证据。

check.sh uses a local test transport and does not spend model quota. **Passing it does not prove a live model connection.** Use the no-argument full suite throughout this course. /api/config probes /models with a five-second cache; configured=true does not establish generation quota or tool support. Health, model discovery, and verified live provenance are distinct checks.

## CLI 审查与 Git 基线 / CLI Review and Git Baseline

镜像首次初始化项目时执行 git init，创建名为 Course Baseline 的初始提交，不配置远程仓库。已有项目不会重新初始化或覆盖。学生先在主 Terminal 确认 pwd，使用 git status 和 git diff HEAD 查看实际源码修改；git diff 不显示未跟踪新文件，须结合 git status 单独阅读。如果自行提交过修改，HEAD 已发生变化，不能再把它当作最初基线。没有基线时联系教师排查，不重新初始化已有项目。

During first project initialization, the image runs git init and creates the Course Baseline initial commit without a remote repository. Existing projects are not reinitialized or overwritten. First confirm pwd in the main Terminal and inspect actual source changes using git status and git diff HEAD. Untracked files are absent from git diff and require separate inspection using git status. If you have committed changes, HEAD has moved and is no longer the initial baseline. Report missing baseline setup to the instructor; do not reinitialize an existing project.

~~~bash
cd /workspace/prompt-workbench
pwd
git log -1 --format=%s
git remote
git status --short -- frontend/src backend schemas tests
git diff HEAD -- frontend/src backend schemas tests
~~~

随后切换**平台 CLI 标签**，该入口自动在 /workspace/prompt-workbench 启动 OpenCode。主要源码审查必须在此入口进行，要求工具实际读取当前项目文件，核对路径与修改，并在 review.md 记录真实会话和人工决定。Terminal 负责运行前置检查，不代替 CLI 入口。

Then switch to the **platform CLI tab**, which automatically starts OpenCode in /workspace/prompt-workbench. Conduct the main source review there, verify actual file reads and project paths, and record the real session and human decisions in review.md. Terminal runs the preliminary checks; it does not replace the CLI entry.

仅在 CLI 异常时，才在 Terminal 手动 cd /workspace/prompt-workbench 后执行 opencode 排查。即使手动启动成功，仍标记平台 CLI 未验收，恢复后回到 CLI 标签复验；不得把排查会话当作平台入口验收证据。审查禁止读取环境、凭证或认证文件，也不需要配置远程仓库或执行推送。

Only when CLI is malfunctioning may you manually cd /workspace/prompt-workbench and run opencode in Terminal for diagnosis. Even a successful manual session leaves platform CLI acceptance pending: return to the CLI tab to reverify after recovery. Troubleshooting is not platform-entry acceptance evidence. Do not inspect environment, credentials, or authentication files, and do not configure remotes or push.

## 实际源码入口 / Source Map

| 路径 / Path | 职责 / Responsibility |
| --- | --- |
| frontend/src/App.tsx、components/ | 编辑、结果、历史、对照 / Editing, results, history, comparison |
| frontend/src/api.ts、types.ts | 相对 API 与契约 / Relative APIs and types |
| backend/main.py | FastAPI 路由与响应 / Routes and responses |
| backend/gateway.py | 服务器端模型请求 / Server-side model calls |
| backend/validation.py | JSON、Schema、直接引用检查 / JSON, Schema, quotations |
| schemas/incident.schema.json | 四字段输出结构 / Four-field output structure |
| backend/store.py | 草稿与实验 / Draft and experiment storage |
| backend/exporter.py | 安全白名单导出 / Whitelist export |
| samples/incidents.json、tests/ | 脱敏样例与离线检查 / Sanitized samples and offline checks |

API 以 [CONTRACT.md](CONTRACT.md) 为准，返回普通 JSON，不是平台 success/data 包装。temperature、topP 当前不支持；maxTokens 支持，上限4096。语义真实性、缺失信息完整性与证据充分性仍需人审。

APIs return plain JSON under [CONTRACT.md](CONTRACT.md), not platform success/data wrappers. Temperature and topP are unsupported; maxTokens is supported up to 4096. Semantics, completeness, and evidence sufficiency remain human-review tasks.

## 导出与临时卷 / Export and Temporary Storage

模板预期从 /opt/courses/prompt-workbench 初始化到共享工作区，已有学生文件不能被覆盖。实际初始化与课程镜像由主代理/教师验收，材料不能证明该流程已部署。共享卷是 **emptyDir 临时卷**：IDE 与主容器共享它，Pod 回收可能删除全部文件。自动重连不等于持久备份。

The template is intended to initialize the shared workspace without overwriting student work. Image/initialization acceptance belongs to the main integration workflow; these materials do not prove deployment. The shared **emptyDir is temporary**: Pod reclamation may remove all files. Reconnection is not durable backup.

~~~bash
cd /workspace/prompt-workbench
PYTHON=/opt/venvs/prompt-workbench/bin/python bash scripts/export.sh --output backend/exports/submission.zip
~~~

目标文件必须尚不存在，不能覆盖原成果。导出包含白名单源码、草稿、实验、report.json、MANUAL_REVIEW.md 与 source/review.md。任意 reports/、本手册生成脚本、运行配置、依赖、dist 和数据库不属于默认成果；不要假设自动包含。把关键失败/修复输出、对照与审查证据写入 review.md，并检查 skippedSourceFiles。检查内容脱敏后下载到临时卷之外，通过实际作业入口提交并保留回执，再结束 Lab。没有可用作业入口时标记提交阻塞并联系教师。

Use a new destination. The archive includes allowlisted source, drafts, experiments, generated reports, and source/review.md. Arbitrary reports/, the manual generator, runtime configuration, dependencies, dist, and the database are not default deliverables. Put essential evidence in review.md and inspect skippedSourceFiles. Review for sensitive content, download outside the temporary volume, submit through the real assignment entry, and retain receipt before ending the Lab. Missing submission entry is a blocker, not a successful submission.

## 交付范围与限制 / Scope and Limits

本次材料交付包括双语理论、完整实训、步骤数组、人工证据模板与文档生成源。文档静态检查不等于课程 L3 端到端验收。真实网关、OpenCode 工具调用、平台步骤执行、双容器共享、代理、隔离、回收、作业提交/教师确认均需目标环境验证；没有证据不得标为完成。材料不部署、不改平台、不申请或披露凭证。

This delivery provides bilingual theory, full lab instructions, step arrays, an evidence template, and generation source. Static checks are not L3 end-to-end acceptance. The live gateway, OpenCode tools, platform step execution, shared files, proxy, isolation, reclamation, submission, and teacher receipt require target-environment evidence. No platform changes or deployment are performed by this documentation work.

维护步骤时编辑 manuals/build_steps.mjs，然后在课程目录执行 node manuals/build_steps.mjs，重新生成双语 JSON 和 Markdown。生成过程只写 manuals/ 下四个交付文件。

To maintain steps, edit manuals/build_steps.mjs and run node manuals/build_steps.mjs from the course directory. It regenerates only the four JSON/Markdown outputs under manuals/.
