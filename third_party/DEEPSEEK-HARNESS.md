# Harness 上游源码交接

- 上游仓库：`https://github.com/deepseek-ai/deepseek-harness.git`
- 固定提交：`4b399c39a6d1479cd84ca591b4d7c88e24d38a96`
- 源码目录：`third_party/deepseek-harness/`
- 导入方式：从上述提交执行 `git archive`，保留全部已跟踪文件；不复制 `.git`、未跟踪文件、本地配置或运行数据。
- 许可证：源码目录内的 `LICENSE` 和 `THIRD_PARTY_NOTICES.md` 原样保留。

该快照是此前用于研究和集成的上游源码（0.2.3），不代表当前线上二进制的源码版本。当前平台镜像继续安装固定依赖 `deepseek-harness-runtime-bin==0.2.2rc2`；本次源码交接不修改镜像、依赖或线上服务。

平台定制在 `services/course-harness/`，包含品牌插件、课程策略、工作区初始化和 Docker 构建配置；后端接入在 `EDU_Backend_Go/internal/domain/courseharness/`，前端嵌入在 `EDU_Frontend/src/components/study/HarnessFrame.tsx`。

后续若从该上游源码构建新运行时，需要单独完成兼容性测试，再升级固定依赖和镜像摘要。不要将源码快照版本直接当成已通过线上验收的版本。
