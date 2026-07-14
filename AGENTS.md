# AGENTS.md

## Scope
适用于当前目录及所有子目录。

## 文档目标
本文件用于帮助新会话快速进入 `ai-edu-agent` 当前真实状态，避免重复摸底，并确保后续开发遵循既有架构、运行时边界与 UI / 工程规范。

## 强制规则（Hard Rules）
- 文件编码必须 UTF-8；日志、异常信息、注释、开发说明默认使用中文
- 仅修改与当前需求直接相关的文件；发现无关问题只在最终响应提示，不顺手大改
- 保持现有代码风格与目录边界，不做无关重构
- 禁止编辑项目目录外的文件
- 禁止在前端代码中硬编码任何 API Key、Token、密码或外部服务凭证
- 修改文件时，尽量避免“删除整个文件再重建整个文件”的粗暴方式
- 搜索代码优先用 `rg`；代码编辑优先用最小补丁
- 若为后端代码改动，函数级复杂逻辑可补充简洁中文注释，但不要堆砌空洞注释
- 若需求未明确要求，不要回退到 TS 旧后端或 Docker 旧管理面语义

## 功能完成度与闭环要求（Definition of Done）
### 总原则
- 当前项目默认采用“分层闭环完成标准”，禁止把“能展示数据 / 能调通 GET / 能新增一条记录”直接视为完成
- 每次实现前，必须先判断当前需求属于哪一层：
  - `L1 小功能 / 局部组件`
  - `L2 单页面 / 单工作区`
  - `L3 大模块 / 业务子系统`
- 判断完层级后，必须先列出本次的“最小闭环范围”，再进入实现
- 若未覆盖该层级的最小闭环项，禁止使用“已完成 / 完成了 / 100% 完成 / 模块完成”这类表述
- 若只完成骨架、读取、展示、单条写操作，必须明确说清当前只完成到哪一层，仍缺哪些闭环项

### L1：小功能 / 局部组件
适用范围：
- 单个表单块
- 详情抽屉
- 筛选器
- 排行卡片
- 状态块
- 单一操作弹窗

最小闭环必须包含：
- 数据读取或状态来源接通
- 组件交互完整可用
- `loading / empty / error` 三态齐全
- 文案、禁用态、提交反馈完整
- 与上游触发和下游回写联动正常
- 不产生悬空入口、假按钮、假 Tab、假弹窗

未满足时，只能说：
- 已完成局部实现
- 已完成组件骨架
- 已完成展示层

不能说：
- 该功能已完成

### L2：单页面 / 单工作区
适用范围：
- 学习中心页面
- 项目列表页
- Admin 某个管理页
- Dashboard 某个工作台页面

最小闭环必须包含：
- 读取 + 展示
- 核心筛选 / 搜索 / 刷新
- 至少一条主要写操作链路完整接通
- 若页面存在实体管理语义，必须显式评估是否需要补齐：
  - 新增
  - 编辑
  - 删除 / 停止
  - 查看详情
- `loading / empty / error / unauthorized / success / disabled` 状态完整
- 关键组件交互完整：
  - drawer
  - dialog
  - tabs
  - pagination
  - action buttons
  不能只有外观没有行为
- 页面联动完整：操作后列表、统计、详情需同步刷新或局部更新
- 至少完成一轮页面级冒烟验证

未满足时，只能说：
- 已完成页面主读链路
- 已完成页面首版
- 已完成页面展示层

不能说：
- 该页面已完成

### L3：大模块 / 业务子系统
适用范围：
- Classic Lab
- Admin Dashboard
- 项目管理
- 课程管理
- Agent 手册系统

最小闭环必须包含：
- 主流程端到端可走通
- 关联读写能力完整，不能只有入口页或只读台
- 上下游依赖都纳入 TODO：
  - 接口
  - 页面
  - 状态同步
  - 权限
  - 清理 / 回收
  - 健康检查
  - 关键异常路径
- 至少覆盖一组运维 / 管理视角需求，而不只是用户正向操作
- 必须定义验收标准，不能以“页面能打开”视为完成
- 必须列出明确未完成项；未补齐前不能称“模块完成”

未满足时，只能说：
- 已完成模块首版主链路
- 已完成模块骨架
- 已打通模块核心读写路径的一部分

不能说：
- 该模块已完成

### 默认联想范围（防止伪完成）
- 当需求涉及“页面”时，默认同时检查：
  - 是否需要详情
  - 是否需要编辑
  - 是否需要删除 / 停止
  - 是否需要筛选 / 搜索 / 刷新
  - 是否需要空态 / 错误态 / 权限态
  - 是否需要操作后的状态同步
- 当需求涉及“管理页”时，默认不能只做只读展示
- 当需求涉及“工作台”时，默认要有轻操作，不接受只有列表
- 当需求涉及“业务实体”时，默认评估完整生命周期，不能只做新增
- 当需求涉及“大模块”时，默认要考虑上下游依赖与验收，不能只做当前屏幕

### 实现前的默认流程
- 先列闭环，再实现
- 未列闭环，不得直接宣称完成
- 后续规划默认参考：
  - `docs/START-HERE.md`
  - `docs/PROJECT-STATUS.md`
  - `docs/feature-delivery-checklist.md`

### 最终回复表述规范
- 如果只完成了骨架、读取、静态展示、单条写操作，必须明确说：
  - 已完成首版骨架
  - 已打通读链路
  - 已完成页面展示层
  - 仍缺编辑 / 删除 / 交互闭环
- 只有当对应层级最小闭环项都满足时，才能说：
  - 该功能已完成
  - 该页面已完成
  - 该模块已完成

## 项目概览
当前仓库包含三条主线：

1. `EDU_Frontend/`
   - React 18 + TypeScript + Vite
   - UI 体系：HeroUI + Tailwind + Framer Motion
   - 当前主路由：`/study`、`/projects`、`/lab`、`/teacher/*`、`/admin/*`

2. `EDU_Backend_Go/`
   - 当前主后端，Go + Gin + GORM
   - 已承接认证、课程、项目、学习、Agent、Lab、Dashboard 聚合等主链路
   - 当前默认开发端口：`4000`

3. `EDU_Backend/`
   - TS 旧后端，主要作为历史实现参考
   - 用于对比历史契约和迁移配置
   - 默认不要在这里继续堆新功能，除非用户明确要求对照或迁移

## 当前架构结论（非常重要）
### 1. Go 后端是当前主实现
- 前端当前应优先对接 `EDU_Backend_Go`
- TS 后端主要承担“历史行为参考”和“配置迁移来源”角色

### 2. Lab 运行时已切到 K8S
- Classic Lab 主链路已经不是 Docker 运行时
- 当前后端运行时以 K8S 为准：创建 Pod / Service、noVNC 代理、K8S exec、终端桥接、停止与清理
- `/api/docker/*` 视为遗留旧管理面，不是当前主链路目标

### 3. 项目实训统一使用 Classic Lab
- 项目列表、项目详情和项目单元统一进入 `/lab`
- 当前产品不再存在第二种项目运行时或独立项目类型
- OpenClaw 模块已于 2026-07-14 下架；完整旧实现只保存在归档分支 `codex/archive-openclaw-20260714`
- 历史项目与作业通过 `EDU_Backend_Go/deployments/sql/20260714_retire_openclaw.sql` 下架，禁止恢复为当前产品入口

### 4. Dashboard 已重构为 K8S 工作台方向
- `/admin/dashboard` 不再按 Docker 运维台思路开发
- 当前应围绕 runtime namespace、Lab 会话、Pod / Service、集成健康检查、会话工作台来增强

## 当前已落地的关键能力
### Go 后端主链路
- 认证与用户：`/api/auth/*`、`/api/users/*`
- 课程 / 学习：`/api/courses/*`、`/api/learning/*`、`/api/skills/*`
- 项目：`/api/projects/*`、`/api/tags/*`
- Agent：`/api/agent/*`
- Lab：`/api/lab/create`、`/api/lab/active`、`/api/lab/execute`、`/api/lab/stop/:sessionId`
- 终端：`/ws/terminal`（K8S exec bridge）
- 运维聚合：`/api/integrations/k8s|config|dashboard/*`

### 已确认完成的重要替代
- Classic Lab：create / active / noVNC / terminal / execute / stop 已真实联通
- Agent 自动验证已接到 `/api/lab/execute`
- TTL janitor / 僵尸会话回收已接入
- `/study` 顶部右侧学习者榜单已改为真实接口 `/api/users/student-leaderboard`

## 当前仍需牢记的遗留 / 未完成边界
- `/api/docker/*` 仍属于 TS 遗留接口，不作为 Go 切换阻塞项
- 全量回归尚未完成，尤其是管理端复杂编辑链路仍需逐页验证
- 历史 OpenClaw 数据列和旧 SQL 迁移只用于审计，不得重新暴露为前端字段、API 或业务类型

## 本地开发启动方式
### 前端
工作目录：`EDU_Frontend/`

常用命令：
```bash
npm run dev -- --host 0.0.0.0
```
默认地址：
- `http://localhost:3000`

类型检查：
```bash
npm exec tsc --noEmit
```

### Go 后端
工作目录：`EDU_Backend_Go/`

常用命令：
```bash
go run ./cmd/server
```
默认地址：
- `http://localhost:4000`
- 健康检查：`http://localhost:4000/api/health`

测试：
```bash
go test ./...
```

### 常见本地联调组合
- 前端：`3000`
- Go 后端：`4000`
- 当前前端通过 Vite 代理或 API 基址访问 Go 后端

## 配置与环境约束
### Go 配置来源
优先阅读：
- `EDU_Backend_Go/.env`
- `EDU_Backend_Go/.env.example`
- `EDU_Backend_Go/configs/app.yaml`

### 当前重要配置类别
- MySQL
- JWT
- K8S：`K8S_ENABLED`、`K8S_RUNTIME_NAMESPACE`、`K8S_KUBECONFIG`
- Qwen / DashScope：`QWEN_*`、`DASHSCOPE_API_KEY`

### 配置原则
- 允许在本地 `.env` 中存在真实配置，但绝不能把敏感值写进前端源码、文档示例或最终回复
- 若需同步 TS -> Go 配置，优先同步到 Go 的 `.env` 与 `configs/app.yaml` 的非敏感默认值

## 业务分流规则
### 课程 / Classic Lab
- 课程实验进入 `/lab`
- 运行时是 K8S Classic Lab
- 依赖 `/api/lab/*` + `/ws/terminal`

### 项目实战
- 保持项目详情 / 单元 / Lab 实训链路
- 统一走 K8S Classic Lab，不再按标签、标题或 slug 分流运行时
- 历史下架项目对学生不可见，也不能通过直链启动 Lab；教师不得重新创建或绑定已下架的历史类型标签

## 前端开发规范（结合当前项目）
- 保持现有 HeroUI / Tailwind 风格，不引入突兀的新设计体系
- 管理台与学习页都不要回退成“堆卡片 + 纯列表 + 粗暴告警条”的旧后台风格
- Card / Panel / 统计块 / 列表项等容器默认不使用描边线，优先复用 `card-surface`、`card-surface-muted` 或等价的无边框柔和阴影 / 浅底分层；只有输入框、筛选器、按钮、表格行分隔、空态虚线、状态选中态等需要明确操作边界的控件才保留边框
- 禁止使用 `Alert` 式大横幅作为主要状态反馈
- 优先使用：
  - 主题色状态块
  - Badge / Chip
  - Drawer / Modal
  - Toast
  - Skeleton
  - 内联说明
- 弹层类组件必须使用全局 Portal：
  - Dialog / Modal 统一复用 `EDU_Frontend/src/components/common/PageDialog.tsx`
  - 右侧 / 左侧详情抽屉统一复用 `EDU_Frontend/src/components/common/PageDrawer.tsx`
  - 禁止在页面组件内直接写 `fixed inset-0` 作为弹窗、抽屉或全屏遮罩根节点；页面上层可能存在 `motion` / `transform` / `overflow` 容器，会导致 fixed 被限制在局部内容区，出现顶部露白、遮罩不满屏、滚动穿透等问题
  - 若确有特殊弹层必须自定义，也必须通过 `OverlayPortal` 渲染到 `document.body`，并说明为什么不能复用公共组件
- 表格、列表中的长文本默认优先保持单行，必要时用 `truncate` / `whitespace-nowrap`
- 交互功能不能只做只读列表，若页面定位是工作台，必须有筛选、刷新、详情、轻操作等完整交互

## 后端开发规范（结合当前项目）
- 新能力优先加在 Go 后端，不优先回补 TS
- 路由注册统一看 `EDU_Backend_Go/internal/router/router.go`
- 业务逻辑尽量留在 domain service / repository 边界内，不把复杂逻辑塞进 handler
- 若是聚合型管理接口，优先考虑“后端聚合后返回”，不要让前端自己拼 5~8 个接口
- 对 K8S 和外部集成相关错误，优先返回可消费的中文错误信息
- 删除 / 停止 / 清理类接口要尽量保证幂等，`NotFound` 应作为可接受状态处理

## 新会话进入项目时的推荐顺序
1. 先读本文件 `AGENTS.md`
2. 再读：
   - `docs/START-HERE.md`
   - `docs/PROJECT-STATUS.md`
   - `docs/REPO-MAP.md`
   - `docs/feature-delivery-checklist.md`
3. 再读：
   - `EDU_Backend_Go/docs/development-progress.md`
   - `EDU_Backend_Go/docs/ts-go-parity-matrix.md`
4. 视需求补读：
   - `EDU_Backend_Go/internal/router/router.go`
   - `EDU_Frontend/src/App.tsx`
   - 相关 domain / component 文件
5. 若任务涉及 K8S / Dashboard，不要只看 TS 旧实现，必须以 Go 当前实现为准

## 常见任务处理建议
### 当用户说“启动项目”
默认启动：
- `EDU_Backend_Go` 后端
- `EDU_Frontend` 前端
并检查：
- `3000` / `4000` 端口占用
- `/api/health` 是否正常

### 当用户说“对比 TS 后端缺口”
优先以：
- `EDU_Backend_Go/docs/ts-go-parity-matrix.md`
- Go 当前真实前端主链路
为判断标准，而不是逐路由机械对齐

### 当发现历史 OpenClaw 残留
优先确认：
1. 当前代码是否来自归档分支，而不是 `main`
2. `20260714_retire_openclaw.sql` 是否已执行
3. 历史项目 / 作业是否已归档，旧运行会话是否已由 janitor 回收
4. 不要恢复旧路由、旧标签分流、网关配置或前端入口

### 当用户说“Dashboard 要改”
默认理解为：
- K8S 运行概览工作台
- 不是 Docker 控制台
- 不是只读概览
- 需要前后端联动与轻操作能力

### 当用户说“实现一个页面 / 模块 / 工作台”
默认动作不是直接开始堆页面，而是先回答清楚：
- 当前属于 `L1 / L2 / L3` 哪一层
- 这次最小闭环包含哪些读链路、写链路、交互组件、状态覆盖、联动更新
- 哪些项本轮明确不做，并作为未完成项保留

如果这些问题没有在实现前被列出来，就不能把结果视为完成

## 提交前最低自检
### 改 Go 后端后至少执行
```bash
gofmt -w <改动文件>
go test ./...
```

### 改前端后至少执行
```bash
npm exec tsc --noEmit
```

### 涉及联调时尽量补充
- 本地启动验证
- 关键接口 `curl` / 健康检查
- 页面手动冒烟结论

## 最后提醒
- 当前项目已经从“TS + Docker”过渡到“Go + K8S Classic Lab + 三端教学闭环”阶段
- 不要被旧实现带偏，尤其不要默认把 Docker 管理面当成主目标
- 先确认当前真实链路，再做实现；优先顺着 Go 当前架构继续收口
