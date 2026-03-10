# 镜像升级执行清单（new-course）

## 目标

将镜像课程资源从旧 `courses/` 迁移到 `new-course/Agent`，并保证平台兼容路径可用。

## 阶段 A：目录与镜像主路径切换

- [x] Dockerfile 主资源切换为 `new-course/Agent`
- [x] 容器主目录确定为 `/workspace/new-course/Agent`
- [x] 建立 `/workspace/courses/*` 兼容映射（软链接）
- [x] 生成 `/workspace/courses/README.md` 映射说明

验收标准：
- 容器内存在 5 份新版课程目录
- `/workspace/courses/ade-skill|mcp-server|agent-gordon|multi-agent|guardrails` 均可访问

## 阶段 B：依赖与构建

- [x] Python 核心依赖升级到支持 new-course 的版本集合
- [x] 新版课程 requirements 在镜像构建期安装
- [x] MCP Server 在镜像构建期执行 `npm install && npm run build`
- [x] 新版 `verify-env` 增加课程目录与 zhipuai 检查

验收标准：
- `verify-env` 可看到新课程目录检查项
- `/workspace/new-course/Agent/MCP_Server/dist/index.js` 存在

## 阶段 C：脚本迁移

- [x] `setup-api-keys.sh` 输出统一 `.env`（ZHIPUAI/ZHIPU/OPENAI 兼容）
- [x] `test-courses-quick.sh` 改为 new-course 5 课程 smoke test
- [x] `quick-start-rebuilt.sh` 与 `quick-start.sh` 命令入口改为新路径

验收标准：
- `./setup-api-keys.sh` 能写入新版变量
- `./test-courses-quick.sh` 能完成 5 项 smoke test

## 阶段 D：文档同步

- [x] `README.md` 改为 new-course 结构说明
- [x] `USAGE-GUIDE.md` 改为 new-course 使用流程
- [x] `API-配置说明.md` 改为新版变量说明
- [x] `TESTING-README.md` 改为 new-course 测试说明
- [x] `opencode-config/AGENTS.md` 改为 new-course 目录

验收标准：
- 文档中不再出现旧 `prompt-engineering` 等入口

## 阶段 E：发布前验证（待执行）

- [ ] 在可用 Docker 环境执行镜像重建
- [ ] 启动容器并运行 `verify-env`
- [ ] 执行 `./setup-api-keys.sh`
- [ ] 执行 `./test-courses-quick.sh`
- [ ] 手工抽测：
  - [ ] AgentFramework `python3 main.py --demo`
  - [ ] MultiAgent `python3 main.py --demo`
  - [ ] MCP_Server `node dist/index.js`
  - [ ] Guardrails `python3 main.py --demo`

## 已知风险

1. 当前终端环境无 `docker` 命令，未完成真实容器回归。
2. `new-course/Agent/ADE_Agent/.opencode/opencode.json` 含明文 API Key，建议后续改为环境变量注入。
3. `opencode-config/auth.json` 含预设 token，建议按交付策略决定是否保留。
