# 提示词工作台课程实施记录

本轮按 L3 实施一门课程、两个小节：45分钟理论资料、105分钟完整实训。课程独立设计工作台 UI，不复刻参考截图。仅部署42，35不动。

## 最小闭环

- [x] 定义课程应用API与工作目录契约
- [x] React工作台首轮功能与浏览器测试
- [x] FastAPI草稿、模型调用、验证、记录、对照数据及导出首轮测试
- [x] 双语理论资料、十步Agent手册与幂等入库CLI
- [x] Go会话受限模型网关与隔离鉴权单测
- [x] 课程专用共享目录与Terminal用户/目录接入
- [x] 干净课程镜像构建与容器功能验收
- [x] 案例程序、OpenCode与右侧Agent分别完成真实模型调用
- [x] 42备份、增量发布、课程入库与发布检查
- [x] 真实Lab五入口及双语理论资料浏览器验收
- [x] 失败/修复、成果导出与教学提交链路验收
- [x] 记录版本、回滚位置和剩余限制

## 目录与部署边界

课程源码与材料：`courses/prompt-workbench`。课程slug `prompt-workbench`，专用模板code `prompt-workbench-v1`，工作目录 `/workspace/prompt-workbench`。专用主镜像构建于本地Colima，目标Linux amd64；WebIDE固定已验证的OpenVSCode Server 1.105.1。

不修改现有课程模板或已有学生文件；新工作区首次初始化项目，后续不覆盖。现有两平台共享K8S容量，验证结束只停止本任务创建的会话。

模型供应商Key留在42后端加密配置中。Lab只持有独立签名、绑定用户/会话/课程且随会话失效的短时凭证；该凭证不能作为平台登录Token。课程网关每会话串行、每分钟20次、每会话400次、全实例2并发；本轮为单实例内存计数，服务重启后计数重置，不等同于账单级持久化额度系统。

## 发布结果（2026-11-24）

- 课程47：`http://42.240.132.79:8080/study?courseId=47`，教师T003（ID26）管理。
- 第一节378：学习资料类型，45分钟，10XP；中文、英文理论资料分别提供。
- 第二节379：完整实训类型，105分钟，30XP；双语手册77，十步共享稳定ID2698至2707。
- 阶段107、素材53、模板3（`prompt-workbench-v1`）。课程在探索课程及直链可见，未擅自加入真实教学班级或发送通知。教师可使用现有班级课程绑定和作业发布功能组织教学。
- 前端部署版本`d194f16`；Go运行程序含`5b61e63`网关/代理修复；入库CLI含`4e82bd0`索引修复；课程镜像源码含`d60c022`。
- 最终镜像：`registry.cn-beijing.aliyuncs.com/svinsight/course@sha256:54a68265048e7a33cfb6c0a28caa36bd3fc57f8c17e117e35e9bb3f6ccaf49e6`，标签`prompt-workbench-20261124-v4`。
- IDE：`docker.io/gitpod/openvscode-server@sha256:5e7b8750749f282940a799ed59ccd02fac698ef6744f9113ac01c0ef8e76485e`。已预拉取到当前K8S节点。
- 资料revision：`e646abaa56944c020a4298d12727972a5058f09a4e3d7ec0098db9094fefdfdd`。

## 实际验收证据

使用独立QA学生27、班级4、作业6，未使用真实学生账号执行写操作。

验收后QA会话311、313及测试页重连产生的314均已回收；两只本任务预拉取Pod已删除。QA作业关闭、班级归档、账号27标记删除，提交与评分记录保留供审计。原有会话312未操作。42健康检查确认API、数据库、K8S正常，35未部署。

1. 会话311完成三组单变量对照，共六次真实Kimi返回，全部通过结构/直接引用检查，六个requestId均匹配网关审计记录。不能据此推断提示词有普遍提升或语义完全正确。
2. 实际注入`incident_time`必填字段导致Schema失败，再恢复并验证反例；不降低字段类型和引用规则。
3. WebIDE实际编辑App.tsx，主容器Terminal看见同一Git差异、构建成功；Desktop Firefox打开本地8000端口展示工作台。CLI页面中的OpenCode实际读取`backend/validation.py`并返回英文分析；右侧Agent回答课程凭证边界问题。
4. 最终会话313从v4镜像干净创建，首步验证通过；IDE默认进入共享项目且依赖可解析，显示No Problems。再次运行155项后端测试和前端生产构建成功，网关配置探测显示可用。应用中英文切换和英文新草稿默认值实测通过。
5. 学习记录378/379均为完成状态；手册进度为`completedSteps=[0..9]`、`currentStep=10`。曾修复旧1起始索引，保留步骤主键及进度；不是删除重建手册。
6. 成果实际下载为`output/prompt-workbench-qa-submission.zip`，SHA256为`4dfd7af670bfffafb6ae5ea9bbfa7d95e899f1bdcd14ef79e5d7fddcb92ffc5c`。上传后下载校验一致；submission1、grade1发布后由学生端回读确认。100分为专用QA技术验收分数，不是正式学生成绩。

最终测试：`go test ./...`、平台`npm exec tsc --noEmit`通过；课程后端155项通过；课程浏览器10项通过（启用真实FastAPI集成，其他UI场景使用受控transport）；资料双语各10步、60段Shell、26段Python静态校验通过。线上真实模型调用与离线测试证据分开记录，不用mock替代线上结论。

本地截图位于`output/playwright/`：`prompt-theory-zh.png`、`prompt-theory-en.png`、`prompt-live-desktop.png`、`prompt-cli-live.png`、`prompt-agent-live.png`、`prompt-final-webide.png`、`prompt-final-english.png`。运行日志在`.runtime/prompt-*.log`，日志和临时认证状态不得提交公开仓库。

## 增量发布与回滚

42前端目录`/var/www/edu`，Go目录`/var/www/edu-backend-go/current`，服务`edu-backend-go`。不覆盖`.env`、`.kube`、用户上传或加密模型配置。

备份位置：

- `/var/www/edu-backend-go/backups/prompt-course-070b5dd`
- `/var/www/edu-backend-go/backups/prompt-before-proxy-5b61e63`
- `/var/www/edu-backups/prompt-lesson-248983e`
- `/var/www/edu-backups/prompt-tabs-d194f16`
- `/var/www/edu-backend-go/db-backups/before-prompt-workbench-20261123T174927.sql.gz`
- `/var/www/edu-backend-go/db-backups/before-prompt-workbench-20261123T193204.sql.gz`

资料与seed工具位于42的`/home/ubuntu/prompt-release-070b5dd`。日后更新镜像，先本地构建推送不可变版本、预拉取，再在Go工作目录运行seed，传`--assets`、`--creator-id 26`、`--image`、`--ide-image`、`--publish`，更新同一组实体。正常更新不要加`--repair-legacy-step-order`；该一次性修复已执行。现有运行会话不会被新镜像配置覆盖。

回滚先下架本课程以阻止新建，恢复所需前后端备份并检查健康；镜像可回退到上一已验证digest。不要直接导入整库旧备份覆盖其他新数据，课程数据应按上述实体ID定向处理。回滚时不修改或终止其他学生会话。

## 保留限制

- 共享集群约8GB，已验证独立会话与现有轻量会话共存，未承诺整班同时开启Desktop/IDE/CLI。默认TTL120分钟，105分钟课程预留15分钟导出。
- 工作目录是会话级共享emptyDir，容器共享而不同会话隔离；停止后不保证恢复。必须提前导出并提交，不是持久云盘。
- 自动校验只判断可程序化条件。报告质量、提示词语义、AI建议采纳理由仍由教师人工复核。
- 构建期间Vite暂时重建dist，页面此时可能404；完成构建、重启workbench并刷新即可，课程手册已要求该顺序。
- 上游noVNC缺少可选package.json、OpenVSCode未安装内置聊天Agent产生控制台诊断，不影响已验证的桌面、编辑和独立OpenCode功能。
- 现有教师作业列表的classId筛选不能单独作为隔离依据，QA脚本逐条核对作业详情，仅操作专用班级；本轮未扩展修复无关列表。
