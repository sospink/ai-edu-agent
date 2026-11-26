# 课程助教 Harness Web 试用部署

## 范围与实现

2026-11-26，仅更新42（`42.240.132.79:8080`）的Agent EDU。课程学习页右侧直接嵌入**官方 DeepSeek Harness Web 原版页面**；没有自写聊天、历史、模型选择或消息渲染界面。平台仅提供加载/重试外壳、授权代理、运行时隔离、课程快照和模型网关。Dify其他应用、35及K8S运行环境不在此次发布范围。

本次按L3交付试用闭环：登录进入、课程资料读取、中英文、真实模型回答、历史恢复、停止生成、隔离与回收。不是通用多租户Harness管理产品；高级运维UI、整班容量验收、PDF/OCR统一解析不在本轮完成范围。

## 固定版本

- 官方运行时：`deepseek-harness-runtime-bin==0.2.2rc2`，CLI版本`0.2.2-rc.2`。
- 镜像：`registry.cn-beijing.aliyuncs.com/svinsight/course@sha256:2f0862658947e26e9f82f8cbb939edb86bbae9c0fe4ebc1fe7e091b7fe3dece9`。
- 镜像封装与插件：`services/course-harness/`；官方客户端资源未修改。
- 官方框架仍为预览版；此处固定版本，不运行无人值守的latest升级。

## 访问与隔离

1. `POST /api/course-harness/lessons/:lessonId/session`使用平台Bearer认证和`X-Locale`。
2. 用户必须启用、课程必须发布。服务按用户、课时、语言准备独立home与只读课程快照。
3. 返回一分钟有效的一次性票据。票据与登录代次绑定，兑换后设置HttpOnly、SameSite及工作区路径范围的Cookie。
4. Go代理剥离路径前缀，转发原始插件批量查询、WebSocket、流式内容和官方Cookie。供应商凭证不转发到浏览器或容器。
5. 现有连接每15秒复核平台登录；源JWT过期、退出登录或账号禁用后关闭连接。普通请求立即校验；失效容器由分钟级回收器清理。

42未开启Redis，原退出接口会跳过撤销。本次补充单实例持久化撤销兜底：
`current/public/.settings/auth-revocations.json`仅保存Token摘要与到期时间，文件0600，重启后继续生效；开启Redis的部署继续使用原Redis实现。多实例部署必须使用Redis，不能共用这份单机缓存。工作区实例登记也包含敏感会话凭证，应保持私有目录权限，不复制到前端或公开备份。

容器使用UID1000、只读根、cap-drop、no-new-privileges，限0.75 CPU、768MiB、160进程。`/tmp`为128MiB tmpfs，必须显式带`exec`，官方原生模块需从此加载。内部网络`edu-course-harness`关闭外网出口和容器间通信，不发布宿主或公网端口；Go从宿主机直接访问容器私网3080端口。

当前最多两个同时运行的工作区，最长两小时；无活动连接并空闲十分钟时回收。回收容器保留历史，重新打开同一用户/课时/语言可恢复。不同课时不会强制终止用户另一个仍在使用的工作区；满额返回可重试提示。模型限制为每实例串行、每分钟15次、每实例200次，计数为内存实现，重启会重置，并非账单级配额。

## 模型与资料

- 模型沿用后台现有配置，本轮实测为Kimi；Harness是执行框架，不代表已经改成DeepSeek模型。管理员更换兼容供应商后，下一次模型请求读取新配置。
- 容器仅有当前实例的受限网关凭证，网关强制模型别名与输出上限，并遵守平台AI总开关。
- 课程preset仅开放`read/glob/grep`，执行守卫限制在`/workspace`内，不开放终端、写文件、外部网络工具和插件安装。
- 本次从Dify的Agent开发、学习路径、技术栈三个教学知识库只读迁移六份资料。智慧家居等其他知识库不迁移。
- 迁移资料保存在私有目录，随后复制到授权工作区；不新增公开知识库下载入口。当前课时译文优先，旧参考资料明确标为可能较旧。
- Markdown、文本和JSON可直接读取。PDF/Word原件保留，但尚未统一做文本提取/OCR；优先使用同课时的Markdown版本。
- 原Dify会话没有转换成Harness历史；Dify原记录仍保留，新对话使用独立Harness历史。

## 目录与部署

- 前端：`/var/www/edu`。
- Go：`/var/www/edu-backend-go/current/edu-backend-go`，systemd服务`edu-backend-go`。
- 状态与历史：`current/public/.settings/course-harness/`，包含私有实例登记、`users/<用户>/<课时>/<语言>/home`和课程快照。
- 迁移知识资料：上述私有目录的`reference/`。
- Nginx片段：`/etc/nginx/snippets/edu-course-harness.conf`。
- `.env`仅增加`COURSE_HARNESS_IMAGE`与`COURSE_HARNESS_PUBLIC_ORIGIN`；未覆盖模型配置、K8S凭证或原有环境变量。
- 不增加数据库表、不执行生产AutoMigrate。

增量部署脚本：`scripts/deploy-course-harness-42.sh`。先构建/测试并推送不可变镜像，在42拉取，再发布backend；真实运行验证通过后发布frontend。脚本固定42目标，不接受35地址。前端保留旧哈希资源，最后原子替换index，避免正在访问的用户加载旧资源失败。

后端备份起点：`/var/www/edu-backend-go/backups/harness-20261126T041140`（切换前版本）。
前端备份：`/var/www/edu-backups/harness-20261126T043115/frontend.tar.gz`。
后续修复批次分别保留时间戳备份，可在同目录查询。

功能回滚优先先停止本模块容器、恢复前端备份并清空`COURSE_HARNESS_IMAGE`，保留新的Go认证撤销修复及私有撤销文件，再检查`/api/health`。不能直接用未支持本地撤销的旧Go程序忽略已有撤销记录。不删除Dify，不清理K8S，不覆盖上传文件，不恢复整库备份。

运维主动停止接口：`POST /api/course-harness/sessions/:id/stop`，仅工作区本人或管理员可操作；已不存在视为已释放。容器标签`edu.course-harness=true`只用于本模块识别，不能执行全机Docker清理。启动失败的脱敏诊断保存在私有目录`startup-<id>.log`。

## 已执行验收

- 平台Go全量测试、前端类型检查和生产构建通过。
- 单测覆盖匿名/跨用户访问、跨站Origin、票据单次兑换和代次失效、Cookie范围、原版`/plugins/??...`查询不变、账户/课程撤销、长连接撤销、资料目录穿越/符号链接、并发限额及模型别名/凭证边界。
- 42上用独立QA学生28、29加载官方原版Web；中英文课程页面均成功嵌入，真实读取README和主资料并给出相应语言的带文件引用回答。
- 原版历史菜单能恢复已完成英文问答；中文页面刷新后恢复同一对话。
- 原版“停止生成”实测返回“已停止”。第一次尝试时回答先于点击完成，未误记为取消成功；第二次在运行状态立即停止，通过。
- 实际匿名访问401、A凭证访问B工作区401、跨站Origin403。
- 真实退出并重新登录后，旧启动票据和旧工作区Cookie均返回401；另增加了无Redis撤销的重启持久性与过期单测。
- 无Redis的真实退出验证：退出成功后原Token返回401，随后部署重启Go后仍为401；写盘失败可重试并持久化的异常路径单测通过。
- QA学生28、29已停用，本任务测试工作区剩余0；现有用户、Dify应用、35及K8S实例未清理。最后健康检查确认API、数据库、K8S正常。
- 截图：`output/playwright/harness-embedded-zh.png`与`harness-embedded-en.png`。
- 运行日志与QA认证文件不提交仓库。试用入口可用`/lesson/378?courseId=47`，所有使用LessonPage的课程资料页均已替换。

首次进入可能出现官方预览说明；按原版交互继续，并选择当前课时工作区即可开始。原版设置和高级面板中未启用的能力不属于课程助教开放范围。
