# AI 广场的服务端 Harness

学生从 AI 广场打开 DeepSeek Harness，平台用当前登录账号创建个人工作区。教学 Skill 随镜像从前端目录生成。课程和广场分别保存会话和历史，广场按账号及语言复用工作区。两者共享现有的两个并发容器名额、模型网关及代理。

## 更新 42 服务器

在运行课程助教 Docker 的 Linux 主机上，从待发布的 Git 提交构建广场镜像。以下命令在仓库根目录执行，将 `COURSE_IMAGE` 设为该环境实际使用的 `COURSE_HARNESS_IMAGE` 完整镜像引用。

```bash
: "${COURSE_IMAGE:?请先设置已部署的课程助教镜像引用}"
square_image="edu-ai-square-harness:$(git rev-parse --short=12 HEAD)"
docker build --build-arg COURSE_IMAGE="$COURSE_IMAGE" \
  -f services/ai-square-harness/Dockerfile -t "$square_image" .
docker image inspect "$square_image" --format '{{.Id}}'
printf 'AI_SQUARE_HARNESS_IMAGE=%s\n' "$square_image"
```

在运行 Go 后端的环境文件中添加上面输出的 `AI_SQUARE_HARNESS_IMAGE`。42 的课程部署脚本使用 `/var/www/edu-backend-go/current/.env`。沿用课程助教的 `COURSE_HARNESS_PUBLIC_ORIGIN`、Nginx 的 `/api/course-harness/` 转发和平台已有模型配置。此变更没有数据库迁移。按现有发布流程更新前端、后端并重启 Go 服务，让它读取新配置。主分支 CI 的发布包只包含前后端，镜像与环境变量需要在发布前就绪。

## 上线验收

1. 学生登录后打开 `/ai-square/harness?skill=utxo-balance`。浏览器应向同站的 `/api/course-harness/ai-square/session` 发起 POST，随后加载受会话保护的工作区。
2. 在输入框中使用 `/utxo-balance` 和一组示例数据，核对模型给出的计算结果。侧栏的模型接入示例用于独立部署，服务端工作区使用平台配置的模型。
3. 同一账号和语言重新打开广场，应能找到原会话。换另一个账号，历史应独立。打开知识课，课程助教仍应加载该课时的资料。
4. 未部署广场镜像时应提示管理员配置，容量满时应提示稍后重试。Linux Docker 联调测试可以通过设置 `EDU_TEST_SQUARE_IMAGE` 并以有权创建和 chown 工作目录的用户运行 `go test -run TestSquareDockerSession ./internal/domain/courseharness` 验证登录交换与代理。

## 42 已部署版本与验证

2026-11-28 已在 42 启用：

```text
AI_SQUARE_HARNESS_IMAGE=registry.cn-beijing.aliyuncs.com/svinsight/course@sha256:12d438373cc92f18dca4a51c8a065408ba83e18268417ed38603697a5004d672
```

镜像标签为 `harness-square-1d705588-v2`，包含 30 个教学 Skill。原 `COURSE_HARNESS_IMAGE` 未修改；35 未更新。环境文件备份位于 42 的 `/home/ubuntu/square-release-20261128/env.before-square`，不提交备份或凭据。

首次独立容器验收发现入口把广场 `--patch` 放到了 Web 内层参数之后，导致 `unknown option '--patch'`。已将全部覆盖参数移至 `--host` 等 Web 参数前，补充课程/广场两种入口的回归测试；有问题的首版镜像未启用到线上。

修正版验证：

- 非 root、只读根目录和工作区；官方登录交换 303、Web HTML 200，Skill 文件数量为 30。
- 线上匿名创建返回 401，同账号同语言复用工作区，其他账号停止工作区返回 403，无 Cookie 访问代理返回 401。
- 浏览器实际使用 `/utxo-balance` 进行教学算术：输入 12000、输出 11700、手续费 300，返回正确守恒关系；刷新后会话与回答保留。
- 第二个测试账号成功建立独立英文工作区；容量满时实际返回 429，未为测试终止其他用户的工作区。
- 测试工作区已停止、两个测试账号已停用、登录令牌已退出撤销；当前服务健康检查正常。

以上是启动及一条代表性 Skill 对话验证，不代表逐一验收了所有 30 个 Skill。侧栏模型示例仍不改变服务端模型，真实调用继续由平台配置的模型网关处理。课程助教和广场仍共享两个并发工作区名额。
