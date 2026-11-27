# GitHub CI/CD 与 42 增量发布

## 发布范围

仓库 `sospink/ai-edu-agent`，工作流 `.github/workflows/edu-backend-go-ci.yml`。

- 前端、Go 后端、发布脚本或工作流变更时，push/PR 执行测试与构建。
- 仅 `main` 的非 PR 构建允许部署到 `production-42`。
- GitHub 环境分支策略只允许 `main`；仓库变量 `DEPLOY_42_ENABLED=true` 才执行发布。
- 支持 Actions 页面手动运行；手动选择其他分支只构建，不部署。
- 35 不在自动部署范围。不会执行数据库迁移、内容入库、镜像构建或 K8S 资源操作。

因此 Git 拉取只更新代码；课程、项目和手册数据并不会随 push 自动迁移。

## 流程

1. 固定提交 SHA 的 checkout、Go/Node setup 和 artifact Actions。
2. Go 版本读取 `EDU_Backend_Go/go.mod`，执行全量测试；Node 22 用 `npm ci` 安装锁定依赖，执行 TypeScript 和前端构建。
3. 发布脚本执行独立 Python 测试，覆盖路径穿越、链接、重复路径、成功切换和健康检查失败回滚。
4. 打包 Linux amd64 后端、前端静态文件和当前提交号，保存 artifact 7 天。
5. 部署任务串行运行，不中断正在发布的任务；开始部署前再次核对 main，跳过已被更新提交取代的旧任务。
6. 上传同一构建产物到 42。服务器备份后端和前端，原子切换后端、重启并检查 API/数据库；前端保留旧哈希资源，最后原子切换 `index.html`。
7. 从 Nginx 回读前端入口核对内容，写入 `/release.json`；再次验证版本和后端健康。
8. 失败恢复原后端和前端，重新检查健康，并使 Actions 失败。不会以回滚成功掩盖发布失败。

## 远程配置

| 项目 | 位置 |
| --- | --- |
| SSH | `ubuntu@42.240.132.79:22` |
| 后端 | `/var/www/edu-backend-go/current/edu-backend-go` |
| systemd | `edu-backend-go` |
| 前端 | `/var/www/edu` |
| 后端健康 | `http://127.0.0.1:4000/api/health` |
| Nginx | `http://42.240.132.79:8080` |
| 版本标记 | `http://42.240.132.79:8080/release.json` |
| 受限发布入口 | `/usr/local/sbin/edu-release-42` |
| 临时发布包与锁 | `/var/lib/edu-release42` |
| 备份 | `/var/www/edu-backups/actions-<UTC时间>-<提交号>` |

`.env`、`.kube`、上传文件、加密模型设置和数据库保持原位置，发布不覆盖它们。新代码若依赖数据库变更，应先按迁移流程处理；生产启动检查拒绝不兼容结构时会回滚应用。

## GitHub 凭据

环境 `production-42` 下有两个 Secret：

- `EDU42_SSH_KEY`：本仓库专用 Ed25519 部署私钥。
- `EDU42_KNOWN_HOSTS`：通过既有可信 SSH 连接读取的服务器主机公钥。

私钥不进入代码、artifact 或日志。服务器 authorized_keys 将此 key 限制为固定发布入口，禁止端口转发和任意 Shell；只接受 `upload/deploy/status` 加 40 位提交号。普通运维 key 保持不变。

首次安装或更新入口，用已有运维身份上传 `scripts/ci/release42.py`、`scripts/ci/install42.sh` 和专用公钥 `deploy-key.pub` 到服务器临时目录，再运行：

```bash
bash /home/ubuntu/edu-actions-setup/install42.sh /home/ubuntu/edu-actions-setup
```

受限 key 无权自行修改发布入口。修改 `release42.py` 后需通过运维身份同步安装，再启用使用新行为的工作流。不要把本机个人 SSH 私钥放进 Actions。

## 日常操作

正常开发提交 PR，合并 main 后自动更新 42。在 GitHub Actions 查看 `Agent EDU CI and Deploy 42`；build 成功但 deploy 跳过时，检查分支、变量和是否已有更新提交。

```bash
gh run list --workflow edu-backend-go-ci.yml
gh workflow run edu-backend-go-ci.yml --ref main
curl -fsS http://42.240.132.79:8080/release.json
```

临时暂停后续自动部署：

```bash
gh variable set DEPLOY_42_ENABLED --body false
```

该变量不取消已经开始的部署。恢复设置为 `true`，必要时手动运行。不要在正常发布中手动取消正在切换版本的任务。

备份保留在服务器，需结合磁盘空间定期维护；当前脚本不会自动删除历史备份。需要人工恢复时，先暂停自动部署，使用对应备份恢复后端及前端，重启 `edu-backend-go` 并验证健康；不要用应用备份替代数据库恢复。
