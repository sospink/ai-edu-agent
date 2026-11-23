# 提示词工作台课程入库

在 `EDU_Backend_Go` 下运行，配置使用现有 `config.Load`，连接使用 `database.New`。生产不执行 AutoMigrate，不创建用户、不部署、不连接实验宿主机。

```bash
go run ./cmd/seed_prompt_workbench \
  --assets ../courses/prompt-workbench \
  --image YOUR_WORKBENCH_IMAGE \
  --ide-image YOUR_VERIFIED_IDE_IMAGE \
  --creator-id YOUR_EXISTING_TEACHER_ID \
  --dry-run
```

去掉 `--dry-run` 才会入库。默认课程和手册为草稿；增加 `--publish` 才会依次调用现有 `publishing.UpdateManual` 和 `publishing.PublishCourse`，复用检查、权限及审计。检查失败整笔数据库事务回滚。未提供确定的 IDE 镜像时拒绝运行，不猜测 sha256。

`--dry-run` 只校验本地素材，不加载数据库、不复制文件；不会预测数据库中的 ID，也不代表发布检查已通过。

## 固定结构与枚举

- slug：`prompt-workbench`；模板 code：`prompt-workbench-v1`。
- 一个阶段、两个课时：理论 45 分钟、完整实训 105 分钟。按平台默认 Lab TTL 120 分钟预留 15 分钟用于导出提交；平台整数预计时长 `EstimatedHours` 保持 3。
- **现有真实枚举是 LAB=1、CHALLENGE=2、TEXT=4**，见 `EDU_Frontend/src/types/skill.ts`。理论使用 TEXT=4，实训使用标准 LAB=1；素材的 Markdown 类型也是 1。
- 课程元信息写入现有标题、描述、难度、课时/技能总数、预计小时数、镜像和 `lab_template_id` 字段；模型没有独立 metadata 字段，不新增数据库列。
- 模板默认应用为 `workbench:8000`，路径 `/`，保留教材所用 Desktop/noVNC 6080 入口与 IDE 镜像。
- 通过实训课时的 `lesson_skills` 关联提示词工程、结构化输出、AI辅助审查；复用已有同名技能但不修改其属性。

## 素材契约

必须同时存在四个非空 UTF-8 文件：

```text
materials/theory.zh-CN.md
materials/theory.en-US.md
manuals/steps.zh-CN.json
manuals/steps.en-US.json
```

两个 JSON 均为 8–10 个步骤组成的数组。每步结构如下（示例仅展示一项，不是完整手册）：

```json
{
  "stepOrder": 1,
  "title": "检查服务",
  "content": [{"type": "text", "text": "打开工作台并确认服务健康。"}],
  "quickQuestions": ["如何判断服务已启动？"],
  "verification": {"type": "service_running", "port": 8000}
}
```

顺序必须从 1 连续递增；也支持所有步骤均省略 `stepOrder`（按数组顺序分配），不能部分省略。拒绝未知字段、重复排序、空标题/内容、尾随 JSON。双语数量、内容块类型/语言/可执行标识、列表项数量、快捷问题数量必须一致；验证规则必须完全一致，因为平台只有一份主步骤验证规则。`custom.command` 在没有 `script` 时同步填入 `script`，兼容现有运行时和发布检查。可带 `skillTags`，但当前 CLI 不维护步骤技能标签表，只维护上述课程课时技能关联。

四个文件复制到 `cfg.Upload.Root/prompt-workbench/<内容摘要>/` 下保留相对目录；Markdown 主素材及双语翻译分别指向 `/uploads/prompt-workbench/<内容摘要>/materials/theory.<locale>.md`。内容寻址加单文件原子替换确保失败不破坏旧课程文件；失败可能留下无引用的版本目录，不自动清理。

## 重跑边界

课程 slug、阶段/课时 sort_order、手册 source、步骤 step_order、翻译 entity_id+locale 是稳定键。重跑保留实体 ID，不删除任何记录，不碰用户进度。步骤数量变化、已有结构冲突、重复自然键会报错回滚，需人工迁移；同数量内按顺序更新，调用者应保持步骤语义顺序，避免将已完成进度映射到另一任务。

已有非草稿课程在不带 `--publish` 时拒绝修改，避免隐式下架或绕过发布检查。教师只能更新自己的课程，管理员可更新；专用模板若被其他课程或项目引用则拒绝修改。MySQL 使用同连接命名锁串行化本 CLI 的并发运行，平台编辑器不使用该锁，运行时应避免同时编辑本课程。

成功输出 JSON，含课程、阶段、课时、素材、模板、手册、步骤 ID，以及新建数、更新处理数（包含值未变化的行）、素材摘要、发布状态；不输出凭证或镜像值。

## 验证

```bash
go test ./cmd/seed_prompt_workbench
go test ./...
```

测试只在内存 SQLite 建表，覆盖幂等 ID、双语素材、学习进度保留、步骤变更回滚、权限、共享模板、现有发布服务。真实 MySQL 入库、真实教学素材及平台/Lab 冒烟需由主任务在文件和镜像就绪后执行。
