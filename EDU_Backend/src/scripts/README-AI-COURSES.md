# AI课程数据初始化脚本

## 📋 概述

`seedAICourses.ts` 是专门为6门AI课程设计的数据库初始化脚本，基于 `课程手册/` 目录中的课程内容。

**特点**：
- 每门课程只有1个"入门基础"阶段
- 每个阶段包含2个课时：知识手册 + 实验手册
- 课时名称与手册文件名完全对应

## 📚 包含的课程

### 1. 提示词工程 (Prompt Engineering)
- **难度**: Beginner
- **课时**: 2个
- **描述**: 掌握与大语言模型交互的核心技能，学习五大工程化原则
- **手册**:
  - 02-提示词工程-知识手册 (TEXT, 60分钟, 10积分)
  - 02-提示词工程-实验手册 (LAB, 60分钟, 10积分)

### 2. MCP Server开发
- **难度**: Intermediate
- **课时**: 2个
- **描述**: 学习Model Context Protocol开放协议，开发MCP Server
- **手册**:
  - 03-MCP-Server开发-知识手册 (TEXT, 60分钟, 10积分)
  - 03-MCP-Server开发-实验手册 (LAB, 60分钟, 10积分)

### 3. ADE智能体开发
- **难度**: Intermediate
- **课时**: 2个
- **描述**: 掌握Agent Development Environment和Skill开发模式
- **手册**:
  - 04-ADE智能体开发-知识手册 (TEXT, 60分钟, 10积分)
  - 04-ADE智能体开发-实验手册 (LAB, 60分钟, 10积分)

### 4. 单Agent开发 - Gordon
- **难度**: Advanced
- **课时**: 2个
- **描述**: 学习PRA Loop和ReAct模式，开发完整的Agent系统
- **手册**:
  - 05-单Agent开发-知识手册 (TEXT, 60分钟, 10积分)
  - 05-单Agent开发-实验手册 (LAB, 60分钟, 10积分)

### 5. 多Agent协作
- **难度**: Advanced
- **课时**: 2个
- **描述**: 掌握多Agent系统和LangGraph状态机编排
- **手册**:
  - 06-多Agent协作-知识手册 (TEXT, 60分钟, 10积分)
  - 06-多Agent协作-实验手册 (LAB, 60分钟, 10积分)

### 6. AI安全与合规
- **难度**: Advanced
- **课时**: 2个
- **描述**: 学习Guardrails框架，构建安全可靠的AI应用
- **手册**:
  - 07-AI安全与合规-知识手册 (TEXT, 60分钟, 10积分)
  - 07-AI安全与合规-实验手册 (LAB, 60分钟, 10积分)

## 🚀 使用方法

### 1. 确保数据库已配置

检查 `.env` 文件中的数据库配置：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=edu_db
```

### 2. 运行初始化脚本

```bash
cd EDU_Backend
npx ts-node src/scripts/seedAICourses.ts
```

### 3. 查看结果

脚本会输出详细的创建过程：

```
🚀 开始初始化AI课程数据...

✅ 数据库连接成功

📚 创建课程: 提示词工程
   ✅ 课程创建成功 (ID: 1)
   📁 阶段: 入门基础 (ID: 1)
      📝 课时 1: 02-提示词工程-知识手册
      📝 课时 2: 02-提示词工程-实验手册

📚 创建课程: MCP Server开发
   ✅ 课程创建成功 (ID: 2)
   📁 阶段: 入门基础 (ID: 2)
      📝 课时 1: 03-MCP-Server开发-知识手册
      📝 课时 2: 03-MCP-Server开发-实验手册

...

═══════════════════════════════════════════════════
🎉 AI课程数据初始化完成!
   📚 课程: 6 个
   📁 阶段: 6 个
   📝 课时: 12 个
═══════════════════════════════════════════════════

📖 课程列表:
   1. 提示词工程 (Beginner)
      - 02-提示词工程-知识手册
      - 02-提示词工程-实验手册
   2. MCP Server开发 (Intermediate)
      - 03-MCP-Server开发-知识手册
      - 03-MCP-Server开发-实验手册
   ...
```

## 📊 数据结构

### 课程统计

| 课程 | 难度 | 阶段数 | 课时数 | 预计时长 | 技能点 |
|------|------|--------|--------|----------|--------|
| 提示词工程 | Beginner | 1 | 2 | 2小时 | 2 |
| MCP Server开发 | Intermediate | 1 | 2 | 2小时 | 2 |
| ADE智能体开发 | Intermediate | 1 | 2 | 2小时 | 2 |
| 单Agent开发 | Advanced | 1 | 2 | 2小时 | 2 |
| 多Agent协作 | Advanced | 1 | 2 | 2小时 | 2 |
| AI安全与合规 | Advanced | 1 | 2 | 2小时 | 2 |
| **总计** | - | **6** | **12** | **12小时** | **12** |

### 课程阶段

每门课程只包含1个阶段：

- **入门基础** (BEGINNER) - 学习核心概念和实践技能

### 课时类型

- **TEXT** - 知识手册（理论学习）
- **LAB** - 实验手册（动手实践）

## 📁 课时名称与手册文件对应关系

课时名称与 `课程手册/` 目录下的实际手册文件名称完全一致：

```
课程手册/
├── 01-提示词工程/
│   ├── 02-提示词工程-知识手册.md  ← 对应课时1
│   └── 02-提示词工程-实验手册.md  ← 对应课时2
├── 02-MCP-Server开发/
│   ├── 03-MCP-Server开发-知识手册.md
│   └── 03-MCP-Server开发-实验手册.md
├── 03-ADE智能体开发/
│   ├── 04-ADE智能体开发-知识手册.md
│   └── 04-ADE智能体开发-实验手册.md
├── 04-单Agent开发-Gordon/
│   ├── 05-单Agent开发-知识手册.md
│   └── 05-单Agent开发-实验手册.md
├── 05-多Agent协作/
│   ├── 06-多Agent协作-知识手册.md
│   └── 06-多Agent协作-实验手册.md
└── 06-AI安全与合规/
    ├── 07-AI安全与合规-知识手册.md
    └── 07-AI安全与合规-实验手册.md
```

## 🔧 自定义配置

### 修改课程数据

编辑 `seedAICourses.ts` 中的 `aiCoursesData` 数组：

```typescript
{
  title: '提示词工程',
  slug: 'prompt-engineering',
  description: '课程描述...',
  icon: 'prompt',
  color: 'blue',
  difficulty: 'Beginner',
  manualPrefix: '02-提示词工程', // 手册文件名前缀
}
```

### 图标和颜色

可用的图标：
- `prompt` - 编辑图标 (/icons/edit.svg)
- `mcp` - 服务器图标 (/icons/server.svg)
- `ade` - 机器人图标 (/icons/robot.svg)
- `agent` - 用户图标 (/icons/user.svg)
- `multi-agent` - 多用户图标 (/icons/users.svg)
- `security` - 盾牌图标 (/icons/shield.svg)

可用的颜色：
- `blue` - #3b82f6
- `purple` - #8b5cf6
- `green` - #10b981
- `orange` - #f59e0b
- `pink` - #ec4899
- `red` - #ef4444

## ⚠️ 注意事项

1. **数据库备份**: 运行脚本前建议备份数据库
2. **重复运行**: 脚本会检查是否已存在课程（根据slug判断），避免重复创建
3. **依赖关系**: 确保 Course、CourseStage、CourseLesson 模型已正确配置
4. **权限检查**: 确保数据库用户有创建表和插入数据的权限
5. **手册对应**: 课时名称必须与实际手册文件名一致，便于后续关联

## 🐛 故障排除

### 问题1: 数据库连接失败

**解决方案**:
- 检查 `.env` 文件配置
- 确认数据库服务已启动
- 验证用户名和密码

### 问题2: 模型未找到

**错误信息**: `Cannot find module '../entities/Course'`

**解决方案**:
- 检查导入路径是否正确（应该是 `../models/Course`）
- 确认模型文件存在于 `src/models/` 目录

### 问题3: 课程已存在

**解决方案**:
- 脚本会提示是否继续添加
- 输入 `y` 继续，输入 `n` 取消
- 已存在的课程会自动跳过

### 问题4: TypeScript编译错误

**解决方案**:
- 确保导入了正确的枚举类型
- 检查 `CourseDifficulty` 和 `LessonType` 枚举值
- 运行 `npm install` 安装依赖

## 📝 添加到 package.json

在 `package.json` 中添加脚本命令：

```json
{
  "scripts": {
    "seed:ai-courses": "ts-node src/scripts/seedAICourses.ts"
  }
}
```

然后可以使用：

```bash
npm run seed:ai-courses
```

## 🔗 相关文件

- 课程手册目录: `课程手册/`
- 数据库配置: `src/config/database.ts`
- 模型定义: `src/models/Course.ts`, `src/models/CourseStage.ts`, `src/models/CourseLesson.ts`
- 课程手册计划: `课程手册/课程手册开发计划.md`

## 📞 支持

如有问题或建议，请参考：
- 课程手册: `课程手册/README.md`
- 开发计划: `课程手册/课程手册开发计划.md`

---

**创建时间**: 2026-01-16  
**版本**: v2.0.0  
**状态**: ✅ 可用  
**更新**: 简化为每门课程2个课时（知识手册 + 实验手册）
