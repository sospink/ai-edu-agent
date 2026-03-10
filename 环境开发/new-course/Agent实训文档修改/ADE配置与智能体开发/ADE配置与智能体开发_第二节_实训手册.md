# ADE配置与智能体开发 —— 代码翻译官Skill开发实训

> 本实训手册指导你完成OpenCode环境搭建、Skills机制理解、代码翻译官Skill开发及DAE流程验证。建议时长45分钟，需要Node.js 18+，OpenCode版本1.1.38+（课程默认使用镜像内置配置，个人API Key可选）。

## 步骤 0: 进入课程目录并确认环境

```bash
cd /root/ADE_Agent
pwd
ls
```

<!-- verify: command:cd /root/ADE_Agent && pwd|contains|/root/ADE_Agent -->
<!-- questions: 为什么先进入/root/ADE_Agent目录|全局Skill和项目Skill分别放在哪 -->

## 步骤 1: 了解实训目标与最终成果

本节实训包含四个阶段：

| 阶段 | 目标 | 预计时间 |
|:---:|:---|:---:|
| **环境搭建** | 安装OpenCode并验证镜像内置模型配置 | 10分钟 |
| **机制理解** | 掌握OpenCode原生Skills机制 | 10分钟 |
| **Skill开发** | 创建代码翻译官SKILL.md | 15分钟 |
| **测试验证** | 验证DAE流程完整运行 | 10分钟 |

完成本实训后，你将拥有以下目录结构：

```
/root/.config/opencode/
├── opencode.json                    # 全局配置（含默认模型、MCP、权限）
└── skills/
    └── code-translator/
        └── SKILL.md                 # 代码翻译官Skill
```

**使用效果示例：**

当Agent检测到代码翻译相关任务时，会自动调用`skill`工具加载技能：

```
用户: 把这段Python代码翻译成Rust

def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Agent内部调用: skill({ name: "code-translator" })

Agent响应:
🔄 代码翻译官已激活...

📝 源语言: Python
🎯 目标语言: Rust

✅ 翻译结果:

fn fibonacci(n: u32) -> u32 {
    if n <= 1 {
        return n;
    }
    fibonacci(n - 1) + fibonacci(n - 2)
}

💡 关键转换:
- def → fn 函数声明
- 动态类型 → 显式类型 u32
- return 可省略（Rust表达式返回）
```

<!-- questions: 本实训的四个阶段分别是什么|DAE流程指的是什么|代码翻译官Skill的作用是什么 -->

## 步骤 2: 安装OpenCode

选择以下任一方式安装OpenCode：

```bash
# 方式1：官方安装脚本（推荐）
curl -fsSL https://opencode.ai/install | bash

# 方式2：npm全局安装
npm install -g opencode-ai
```

安装完成后验证版本：

```bash
opencode --version
# 预期输出: 1.1.38 或更高版本
```

<!-- verify: command:opencode --version|not_empty -->
<!-- questions: 安装OpenCode有哪几种方式|如何验证OpenCode安装成功 -->

## 步骤 3: （可选）准备个人API Key

如果你需要使用自己的模型账号，可准备个人 API Key：
1. 访问 [智谱AI开放平台](https://open.bigmodel.cn/)
2. 注册/登录账号
3. 进入「API密钥」页面，创建并复制 API Key

> ⚠️ **注意**：课程默认可直接使用镜像内置 OpenCode 配置；个人 API Key 是可选项。

<!-- questions: 如何获取智谱API Key|API Key的作用是什么 -->

## 步骤 4: 检查镜像内置OpenCode配置（不要覆盖）

检查镜像内置配置是否存在：

```bash
test -f /root/.config/opencode/opencode.json && echo "FOUND"
head -n 40 /root/.config/opencode/opencode.json
```

> ⚠️ **注意**：请不要用 `cat > /root/.config/opencode/opencode.json` 覆盖整份配置。镜像内置配置包含 `permission`、`watcher`、`mcp`、`instructions` 等教学运行所需项。

<!-- verify: command:test -f /root/.config/opencode/opencode.json && echo OK|contains|OK -->
<!-- questions: opencode.json配置文件的作用是什么|为什么不建议覆盖镜像默认配置 -->

## 步骤 5: 启动OpenCode并验证默认可用

启动 OpenCode 并验证默认配置可用：

```bash
# 启动OpenCode
cd /root/ADE_Agent
opencode
```

可选（仅当你要切换到个人账号）：
- 输入 `/connect`，选择对应 Provider，粘贴你自己的 API Key
- 输入 `/models`，选择你有权限使用的模型

检查要点：
- 界面底部应显示可用模型（默认一般为 `zai/*`）
- 测试对话：输入 `你好，请用一句话介绍自己`，确认模型正常响应

<!-- verify: command:cat /root/.config/opencode/opencode.json|contains|zai/ -->
<!-- questions: 如何确认默认模型加载成功|启动OpenCode后如何测试对话 -->

## 步骤 6: 理解Agent Skills机制

**Agent Skills** 是OpenCode的原生能力扩展机制，让Agent能够发现并按需加载可重用的指令集。

核心特点：
- **按需加载**：Agent通过`skill`工具在需要时加载技能内容
- **渐进式披露**：启动时只加载名称和描述，完整内容按需读取
- **兼容Claude**：支持`.claude/skills/`目录，与Claude Code规范兼容

### DAE流程映射

| DAE阶段 | OpenCode Skills实现 |
|:---:|:---|
| **Discovery** | 启动时扫描`skills/*/SKILL.md`，提取`name`和`description` |
| **Activation** | Agent分析任务，调用`skill({ name: "xxx" })`加载完整内容 |
| **Execution** | SKILL.md指令注入上下文，指导Agent执行任务 |

### Skills文件位置

OpenCode按以下顺序搜索Skills：

| 优先级 | 位置 | 作用域 |
|:---:|:---|:---:|
| 1 | `.opencode/skills/<n>/SKILL.md` | 项目级 |
| 2 | `/root/.config/opencode/skills/<n>/SKILL.md` | 全局 |
| 3 | `.claude/skills/<n>/SKILL.md` | 项目级(兼容) |
| 4 | `/root/.claude/skills/<n>/SKILL.md` | 全局(兼容) |

<!-- questions: 什么是Agent Skills|DAE流程的三个阶段分别是什么|Skills文件的搜索顺序是怎样的 -->

## 步骤 7: 了解SKILL.md结构规范

SKILL.md的标准结构如下：

```markdown
---
name: skill-name              # 必填：1-64字符，小写字母数字+连字符
description: 技能描述          # 必填：1-1024字符
license: MIT                  # 可选
compatibility: opencode       # 可选
metadata:                     # 可选：字符串键值对
  author: your-name
  version: "1.0"
---

# 技能标题

技能的详细说明和指令...
```

**name命名规则：**
- 仅限小写字母、数字、连字符
- 不能以连字符开头或结尾
- 不能包含连续连字符 `--`
- 必须与目录名一致
- 正则表达式：`^[a-z0-9]+(-[a-z0-9]+)*$`

### Agent发现和使用Skills的流程

**1. Discovery阶段** —— OpenCode启动时，将所有Skills的名称和描述注入到`skill`工具的描述中：

```xml
<available_skills>
  <skill>
    <n>code-translator</n>
    <description>智能代码语言转换工具</description>
  </skill>
</available_skills>
```

**2. Activation阶段** —— 当Agent判断任务需要某个Skill时，调用skill工具：

```javascript
skill({ name: "code-translator" })
```

**3. Execution阶段** —— Skill的完整内容被加载到上下文，Agent按照指令执行任务。

<!-- questions: SKILL.md的必填字段有哪些|name命名规则有哪些约束|Agent是如何发现Skills的 -->

## 步骤 8: 创建代码翻译官Skill目录

创建skills目录结构：

```bash
mkdir -p /root/.config/opencode/skills/code-translator
ls -ld /root/.config/opencode/skills/code-translator
```

<!-- verify: command:test -d /root/.config/opencode/skills/code-translator && echo OK|contains|OK -->
<!-- questions: 为什么目录名要和skill的name一致 -->

## 步骤 9: 编写代码翻译官SKILL.md

将以下内容写入SKILL.md文件：

```bash
cat > /root/.config/opencode/skills/code-translator/SKILL.md << 'SKILLEOF'
---
name: code-translator
description: 智能代码语言转换工具，支持主流编程语言间的精准翻译，保持代码逻辑一致性并提供语法差异说明
license: MIT
compatibility: opencode
metadata:
  author: student
  version: "1.0.0"
  category: development
---

# 🔄 代码翻译官

你是一个专业的代码翻译专家，专门负责将代码从一种编程语言准确翻译为另一种语言。

## 何时使用此技能

当用户请求以下任务时激活此技能：
- 将代码从一种语言翻译/转换到另一种语言
- 询问不同编程语言间的语法对照
- 需要代码迁移或重写到其他语言

**触发关键词示例：**
- "翻译代码"、"转换成XX语言"、"代码转换"
- "translate to"、"convert to"、"port to"
- "Python转JavaScript"、"改写成Go"

## 支持的语言

| 类别 | 语言 |
|:---|:---|
| 系统编程 | C, C++, Rust, Go |
| 应用开发 | Java, C#, Kotlin, Swift |
| 脚本语言 | Python, JavaScript, TypeScript, Ruby, PHP |
| 函数式 | Haskell, Scala, Elixir |

## 工作流程

### 步骤1：分析输入

1. **识别源语言**：如果用户未指定，自动检测代码语言
2. **确认目标语言**：如果用户未指定，主动询问
3. **分析代码结构**：识别函数、类、模块等主要结构

### 步骤2：执行翻译

1. **逐结构翻译**：保持代码逻辑完全一致
2. **处理语法差异**：正确转换语言特有语法
3. **应用命名规范**：遵循目标语言惯例（如snake_case vs camelCase）
4. **保留注释**：翻译或保留原有注释

### 步骤3：格式化输出

使用以下标准格式输出结果：

🔄 代码翻译官已激活...

📝 源语言: {检测到的语言}
🎯 目标语言: {目标语言}

✅ 翻译结果:
{目标语言代码块}

💡 关键转换:
- {转换点1的说明}
- {转换点2的说明}

⚠️ 注意事项:
- {需要注意的兼容性问题或手动调整项}

## 语言转换规则速查

### Python → JavaScript

| Python | JavaScript | 说明 |
|:---|:---|:---|
| def func(): | function func() {} | 函数定义 |
| self.x | this.x | 实例属性 |
| None | null | 空值 |
| True/False | true/false | 布尔值（大小写） |
| f"Hello {x}" | \`Hello ${x}\` | 字符串模板 |
| list.append(x) | array.push(x) | 添加元素 |
| len(list) | array.length | 获取长度 |
| for x in list: | for (const x of array) | 遍历 |
| dict.get(k, d) | obj[k] ?? d | 默认值获取 |
| try/except | try/catch | 异常处理 |

### Python → Go

| Python | Go | 说明 |
|:---|:---|:---|
| def func(x): | func name(x Type) ReturnType {} | 需要类型声明 |
| class Foo: | type Foo struct {} | 结构体替代类 |
| self.x | f.x | 接收者方法 |
| None | nil | 空值 |
| list = [] | slice := []Type{} | 切片 |
| dict = {} | m := make(map[K]V) | 映射 |
| try/except | if err != nil {} | 错误处理 |
| import x | import "x" | 导入语法 |

### Python → Rust

| Python | Rust | 说明 |
|:---|:---|:---|
| def func(x): | fn func(x: Type) -> ReturnType {} | 强类型签名 |
| class Foo: | struct Foo {} + impl Foo {} | 结构体+实现分离 |
| None | None (Option类型) | 需要Option包装 |
| list = [] | let vec: Vec<T> = Vec::new() | Vector |
| dict = {} | HashMap::new() | 需要显式导入 |
| try/except | Result<T, E> + ? | Result类型 |
| x = 5 | let x = 5; 或 let mut x = 5; | 不可变/可变 |

### Python → TypeScript

| Python | TypeScript | 说明 |
|:---|:---|:---|
| def func(x): | function func(x: Type): ReturnType {} | 类型注解 |
| class Foo: | class Foo {} | 类似但有访问修饰符 |
| __init__ | constructor | 构造函数 |
| self.x | this.x | 实例属性 |
| Optional[X] | X | null 或 X? | 可选类型 |
| List[X] | X[] 或 Array<X> | 数组类型 |
| Dict[K,V] | Record<K, V> 或 Map<K,V> | 字典类型 |

## 特殊情况处理

### 1. 语言特性不兼容
如果源语言特性在目标语言中没有直接对应：
- 提供最接近的替代实现
- 在"注意事项"中说明差异
- 必要时提供多种替代方案

### 2. 框架/库特定代码
如果代码涉及特定框架（如Django、React）：
- 提醒用户需要目标语言的对应框架
- 仅翻译通用逻辑部分
- 标注需要手动适配的部分

### 3. 代码量过大
如果代码超过100行：
- 建议分模块/函数逐个翻译
- 优先翻译核心逻辑
- 提供翻译进度指示

## 错误处理

如果无法完成翻译，使用以下格式：

❌ 翻译失败
原因: {具体原因}
建议:
- {建议1}
- {建议2}

常见失败原因：
1. 源代码存在语法错误
2. 目标语言不支持某些特性（如Python多重继承→Go）
3. 涉及特定库/框架的深度绑定
4. 代码不完整，缺少上下文

## 交互提示

- 如果用户只提供代码没指定目标语言，**主动询问**
- 翻译完成后，询问是否需要进一步优化或解释
- 对于复杂翻译，可以先展示翻译计划再执行
SKILLEOF
```

<!-- verify: file_exists:/root/.config/opencode/skills/code-translator/SKILL.md -->
<!-- questions: SKILL.md中description的作用是什么|为什么需要定义触发关键词|代码翻译官支持哪些编程语言 -->

## 步骤 10: 验证Skill文件创建

执行以下命令确认文件创建成功：

```bash
# 检查文件是否存在
ls -la /root/.config/opencode/skills/code-translator/
```

```bash
# 检查SKILL.md内容（前20行）
head -20 /root/.config/opencode/skills/code-translator/SKILL.md
```

```bash
# 验证YAML frontmatter格式
head -12 /root/.config/opencode/skills/code-translator/SKILL.md
```

确认输出中包含 `name: code-translator` 和 `description:` 字段。

<!-- verify: command:head -12 /root/.config/opencode/skills/code-translator/SKILL.md|contains|name: code-translator -->
<!-- questions: 如何验证SKILL.md文件格式正确|YAML frontmatter是什么 -->

## 步骤 11: 重启OpenCode加载Skill

```bash
# 退出当前OpenCode会话（如果有）
# Ctrl+C 或输入 exit

# 重新启动OpenCode
opencode
```

<!-- questions: 为什么需要重启OpenCode|Skill是在什么时候被加载的 -->

## 步骤 12: 验证Discovery阶段

Skill被正确发现后，Agent的`skill`工具描述中会包含：

```xml
<available_skills>
  <skill>
    <n>code-translator</n>
    <description>智能代码语言转换工具，支持主流编程语言间的精准翻译...</description>
  </skill>
</available_skills>
```

**验证方法：** 在OpenCode中直接询问Agent：

```bash
> 你有哪些可用的skills？
```

Agent应该能列出`code-translator`技能。

<!-- verify: command:ls /root/.config/opencode/skills/code-translator/SKILL.md|not_empty -->
<!-- questions: 如何确认Skill被Agent发现|Discovery阶段做了什么 -->

## 步骤 13: 验证Activation阶段

输入一个代码翻译请求，观察Agent是否调用skill工具：

```bash
> 把这段Python代码翻译成JavaScript:

def greet(name):
    return f"Hello, {name}!"
```

如果Skill被正确激活，你会在Agent的工具调用日志中看到：

```
Tool: skill
Input: { "name": "code-translator" }
```

<!-- questions: Activation阶段的触发条件是什么|如何确认skill工具被调用 -->

## 步骤 14: 验证Execution阶段

使用以下测试用例验证Skill的执行效果：

**测试用例1：简单函数翻译**

```bash
> 翻译成JavaScript:

def add(a, b):
    return a + b
```

预期输出应包含：`🔄 代码翻译官已激活...`、源语言/目标语言标识、翻译结果和关键转换说明。

**测试用例2：类翻译**

```bash
> 把这个Python类转换成TypeScript:

class Calculator:
    def __init__(self):
        self.result = 0
    
    def add(self, x):
        self.result += x
        return self
    
    def get_result(self):
        return self.result
```

**测试用例3：复杂算法翻译**

```bash
> 翻译成Rust:

def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
```

**测试用例4：语言对照查询**

```bash
> Python和Go的语法有什么主要区别？
```

<!-- questions: 测试用例1预期输出的格式是什么|为什么要测试多种类型的翻译任务 -->

## 步骤 15: 完成测试检查清单

对照以下清单确认所有测试项通过：

| 测试项 | 测试方法 | 预期结果 |
|:---|:---|:---|
| 目录结构 | `ls /root/.config/opencode/skills/` | 显示code-translator目录 |
| SKILL.md存在 | `ls /root/.config/opencode/skills/code-translator/` | 显示SKILL.md |
| YAML格式正确 | `head -12 SKILL.md` | 包含name和description |
| Skill被发现 | 询问Agent可用skills | 列出code-translator |
| 简单翻译 | Python函数→JS | 语法正确+格式化输出 |
| 类翻译 | Python类→TS | 结构完整+类型注解 |
| 算法翻译 | Python→Rust | 处理类型+错误处理 |
| 输出格式 | 检查emoji和结构 | 符合SKILL.md定义的模板 |

<!-- verify: command:ls /root/.config/opencode/skills/code-translator/SKILL.md|not_empty -->
<!-- questions: 如果某个测试项未通过该怎么排查|输出格式有哪些要素 -->

## 步骤 16: 进阶配置 - Skill权限控制

在`opencode.json`中可以配置Skill访问权限：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "skill": {
      "*": "allow",
      "code-translator": "allow",
      "internal-*": "deny",
      "experimental-*": "ask"
    }
  }
}
```

| 权限值 | 行为 |
|:---:|:---|
| `allow` | 立即加载，无需确认 |
| `deny` | 对Agent隐藏，拒绝访问 |
| `ask` | 加载前询问用户确认 |

### 为特定Agent配置Skills

```json
{
  "agent": {
    "build": {
      "permission": {
        "skill": {
          "code-translator": "allow"
        }
      }
    },
    "plan": {
      "tools": {
        "skill": false
      }
    }
  }
}
```

<!-- questions: Skill权限有哪几种|如何为不同Agent配置不同的Skill权限 -->

## 步骤 17: 进阶配置 - 创建项目级Skill

在项目目录下创建项目级Skill：

```bash
mkdir -p /root/ADE_Agent/.opencode/skills/project-translator
cat > /root/ADE_Agent/.opencode/skills/project-translator/SKILL.md << 'EOF'
---
name: project-translator
description: 项目专用代码翻译规则，遵循团队编码规范
---

# 项目专用翻译规则

继承code-translator的基础能力，但应用以下项目特定规则：

## 命名规范
- Python: snake_case
- TypeScript: camelCase
- 类名: PascalCase

## 项目偏好
- 优先使用async/await
- 使用项目内部的工具函数
- 保留所有TODO注释
EOF
```

<!-- verify: file_exists:/root/ADE_Agent/.opencode/skills/project-translator/SKILL.md -->
<!-- questions: 项目级Skill和全局Skill的区别是什么|为什么需要项目级Skill -->

## 步骤 18: 调试与常见问题排查

### 问题1：Skill未被发现

```bash
# 检查文件位置和名称
ls -la /root/.config/opencode/skills/code-translator/SKILL.md

# 确认SKILL.md是大写（错误: skill.md, Skill.md，正确: SKILL.md）

# 检查name是否与目录名一致
grep "^name:" /root/.config/opencode/skills/code-translator/SKILL.md
# 应输出: name: code-translator
```

### 问题2：Skill未被激活

```bash
# 检查description是否足够描述性
grep "^description:" /root/.config/opencode/skills/code-translator/SKILL.md
# description应清晰描述用途，便于Agent判断是否使用
```

### 问题3：权限被拒绝

```bash
# 检查opencode.json中的permission配置
cat /root/.config/opencode/opencode.json | grep -A5 "skill"
# 确保没有deny规则阻止该skill
```

### 优化建议

1. **description要精准**：好的description帮助Agent准确判断何时使用Skill
2. **指令要具体**：在SKILL.md中提供清晰的步骤和格式要求
3. **覆盖边界情况**：说明如何处理不支持的场景
4. **渐进式复杂度**：从简单案例开始，逐步展示高级用法

<!-- questions: Skill未被发现最常见的原因是什么|如何优化Skill的description -->

## 步骤 19: 实训总结与回顾

### 本节完成内容

1. ✅ **环境搭建**：验证镜像内置OpenCode配置并成功启动
2. ✅ **理解机制**：掌握OpenCode原生Skills的DAE工作流程
3. ✅ **Skill开发**：创建完整的代码翻译官SKILL.md
4. ✅ **DAE验证**：验证Discovery-Activation-Execution完整流程

### DAE流程总结

| DAE阶段 | 理论概念 | OpenCode Skills实现 |
|:---:|:---|:---|
| **Discovery** | 扫描、索引、注册 | 启动时扫描`skills/*/SKILL.md`，提取name+description |
| **Activation** | 意图识别、条件匹配 | Agent分析任务→调用`skill({ name: "xxx" })` |
| **Execution** | 上下文注入、执行 | SKILL.md完整内容加载→指导Agent执行 |

### 渐进式披露体现

| 层级 | 实现 | 说明 |
|:---:|:---|:---|
| **L1** | name + description | 启动时只加载简要信息 |
| **L2** | 完整SKILL.md | 按需加载详细指令 |
| **L3** | 权限控制 + Agent定制 | 高级用户配置 |

### 文件结构总结

```
/root/.config/opencode/
├── opencode.json                          # 全局配置
│   ├── model                              # 默认模型配置
│   ├── permission                         # 工具权限控制
│   ├── watcher                            # 文件监听忽略配置
│   └── mcp                                # 预置MCP服务配置
└── skills/
    └── code-translator/
        └── SKILL.md                       # 代码翻译官技能定义
            ├── YAML frontmatter          # name, description, metadata
            ├── 触发条件说明               # 何时使用此技能
            ├── 工作流程                   # 步骤化执行指南
            ├── 语言转换规则               # 具体翻译对照表
            └── 输出格式模板               # 标准化输出结构
```

<!-- questions: DAE三个阶段分别对应Skills的哪些实现|渐进式披露的三个层级分别是什么 -->

## 步骤 20: 作业与拓展

### 基础作业

1. 为code-translator添加Java→Kotlin的转换规则
2. 创建一个新Skill：`code-explainer`，用于解释代码功能
3. 测试并记录5个不同类型代码的翻译效果

### 进阶挑战

1. 创建`code-reviewer` Skill，专门用于代码审查
2. 实现项目级`.opencode/skills/`，定制团队翻译规范
3. 探索Skill之间的组合使用场景

### 参考资源

- [OpenCode官方文档](https://opencode.ai/docs/)
- [OpenCode Agent Skills](https://opencode.ai/docs/skills/)
- [Agent Skills开放标准](https://agentskills.io/)
- [GLM-4 API文档](https://open.bigmodel.cn/dev/api)

### 镜像默认 opencode.json 配置参考（节选）

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "zai/glm-4-flash-250414",
  "permission": {
    "bash": "allow",
    "write": "allow",
    "edit": "allow",
    "read": "allow"
  },
  "watcher": {
    "ignore": [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/__pycache__/**",
      "**/*.pyc"
    ]
  },
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/root"],
      "enabled": true
    }
  },
  "instructions": [
    "/workspace/AGENTS.md"
  ]
}
```

> 如需使用个人 API Key，请在 OpenCode 内使用 `/connect`，不要直接覆盖整份 `opencode.json`。

### 个人API Key接入（可选）

```json
{
  "provider": {
    "zai": {
      "options": {
        "apiKey": "{env:ZAI_API_KEY}"
      }
    }
  }
}
```

<!-- questions: 基础作业中创建code-explainer需要哪些要素|如何实现Skill之间的组合使用 -->
