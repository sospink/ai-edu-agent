# 提示词工作台转项目案例

默认只读检查：`go run ./cmd/migrate_workbench_project`。

完成数据库备份并发布支持项目模型网关的后端后，显式执行：

```sh
go run ./cmd/migrate_workbench_project --apply
```

- 仅处理课程slug `prompt-workbench`，要求原课程为两小节、双语资料与十步等已有手册结构完整。无生产AutoMigrate。
- 事务创建同slug项目与一个完整实训单元；理论Markdown转为中英文项目介绍。
- 实验镜像、IDE镜像、Lab模板沿用课程；单元时长和积分沿用实训课时。
- 手册只从课时重新绑定到项目单元，原手册ID、步骤ID、翻译、验证、技能关联和手册进度不变。
- 经现有项目发布检查后发布项目，再归档原课程；任一环节失败回滚。原课程记录、课时、素材、学习记录不删除。
- 项目进度与历史课程完成记录是不同统计，旧课程完成记录不会自动转换成项目完成记录；手册进度按原manual ID继续保留。
- 重复执行已完成迁移只报告现有项目，拒绝覆盖不匹配的已有项目。
- 转换后不要再运行旧的 `seed_prompt_workbench --publish` 恢复课程；后续内容在项目编辑器及对应项目手册中维护。

验证：`go test ./cmd/migrate_workbench_project ./internal/domain/lab`。包含只读预检、重复运行、手册进度保持、发布失败回滚、项目模型鉴权及下架撤销。
