# ADE配置与智能体开发

## 第二节：实训课程 —— 代码翻译官Skill开发

> **建议时长**：45分钟  
> **实训环境**：Windows/Mac/Linux终端  
> **前置要求**：Node.js 18+（课程默认使用镜像内置OpenCode配置，个人API Key可选）  
> **OpenCode版本**：1.1.38+

---

## 一、实训目标

通过本节实训，你将完成以下任务：

| 阶段 | 目标 | 预计时间 |
|:---:|:---|:---:|
| **环境搭建** | 安装OpenCode并验证镜像内置配置 | 10分钟 |
| **机制理解** | 掌握OpenCode原生Skills机制 | 10分钟 |
| **Skill开发** | 创建代码翻译官SKILL.md | 15分钟 |
| **测试验证** | 验证DAE流程完整运行 | 10分钟 |

### 最终成果预览

完成本实训后，你将拥有：

```
~/.config/opencode/
├── opencode.json                    # 全局配置（含模型、MCP、权限）
└── skills/
    └── code-translator/
        └── SKILL.md                 # 代码翻译官Skill
```

**使用效果：**

当Agent检测到代码翻译相关任务时，会自动调用`skill`工具加载技能：

```bash
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

---

## 二、环境搭建

### 2.1 安装OpenCode

```bash
# 方式1：官方安装脚本（推荐）
curl -fsSL https://opencode.ai/install | bash

# 方式2：npm全局安装
npm install -g opencode-ai

# 验证安装
opencode --version
# 预期输出: 1.1.38 或更高版本
```

### 2.2 使用镜像默认配置（推荐）

#### 步骤1：检查镜像默认配置是否存在

```bash
# 不要覆盖此文件，只做检查
test -f ~/.config/opencode/opencode.json && echo "FOUND"
head -n 40 ~/.config/opencode/opencode.json
```

> ⚠️ **注意**：请不要使用 `cat > ~/.config/opencode/opencode.json` 覆盖整份配置。镜像内置配置包含 `permission`、`watcher`、`mcp`、`instructions` 等运行必需项。

#### 步骤2：启动并验证

```bash
# 启动OpenCode
cd ~
opencode

# 检查模型是否正确加载（默认一般为 zai/*）
# 测试对话：你好，请用一句话介绍自己
```

#### 步骤3：（可选）切换到个人API Key

在 OpenCode 内执行：
- `/connect`：绑定你自己的 Provider/API Key
- `/models`：切换你有权限使用的模型

---

## 三、OpenCode Skills机制详解

### 3.1 什么是Agent Skills

**Agent Skills** 是OpenCode的原生能力扩展机制，让Agent能够发现并按需加载可重用的指令集。

核心特点：
- **按需加载**：Agent通过`skill`工具在需要时加载技能内容
- **渐进式披露**：启动时只加载名称和描述，完整内容按需读取
- **兼容Claude**：支持`.claude/skills/`目录，与Claude Code规范兼容

### 3.2 DAE流程映射

| DAE阶段 | OpenCode Skills实现 |
|:---:|:---|
| **Discovery** | 启动时扫描`skills/*/SKILL.md`，提取`name`和`description` |
| **Activation** | Agent分析任务，调用`skill({ name: "xxx" })`加载完整内容 |
| **Execution** | SKILL.md指令注入上下文，指导Agent执行任务 |

### 3.3 Skills文件位置

OpenCode按以下顺序搜索Skills：

| 优先级 | 位置 | 作用域 |
|:---:|:---|:---:|
| 1 | `.opencode/skills/<name>/SKILL.md` | 项目级 |
| 2 | `~/.config/opencode/skills/<name>/SKILL.md` | 全局 |
| 3 | `.claude/skills/<name>/SKILL.md` | 项目级(兼容) |
| 4 | `~/.claude/skills/<name>/SKILL.md` | 全局(兼容) |

### 3.4 SKILL.md结构规范

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

正则表达式：`^[a-z0-9]+(-[a-z0-9]+)*$`

### 3.5 Agent如何发现和使用Skills

**1. Discovery阶段**

OpenCode启动时，将所有Skills的名称和描述注入到`skill`工具的描述中：

```xml
<available_skills>
  <skill>
    <n>code-translator</n>
    <description>智能代码语言转换工具</description>
  </skill>
  <skill>
    <n>git-release</n>
    <description>Create consistent releases and changelogs</description>
  </skill>
</available_skills>
```

**2. Activation阶段**

当Agent判断任务需要某个Skill时，调用skill工具：

```javascript
skill({ name: "code-translator" })
```

**3. Execution阶段**

Skill的完整内容被加载到上下文，Agent按照指令执行任务。

---

## 四、创建代码翻译官Skill

### 4.1 创建目录结构

```bash
# 创建skills目录
mkdir -p ~/.config/opencode/skills/code-translator
```

### 4.2 编写SKILL.md

```bash
cat > ~/.config/opencode/skills/code-translator/SKILL.md << 'EOF'
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

```
🔄 代码翻译官已激活...

📝 源语言: {检测到的语言}
🎯 目标语言: {目标语言}

✅ 翻译结果:

```{目标语言}
{翻译后的代码}
```

💡 关键转换:
- {转换点1的说明}
- {转换点2的说明}
- {转换点3的说明}

⚠️ 注意事项:
- {需要注意的兼容性问题或手动调整项}
```

## 语言转换规则速查

### Python → JavaScript

| Python | JavaScript | 说明 |
|:---|:---|:---|
| `def func():` | `function func() {}` | 函数定义 |
| `self.x` | `this.x` | 实例属性 |
| `None` | `null` | 空值 |
| `True/False` | `true/false` | 布尔值（大小写） |
| `f"Hello {x}"` | `` `Hello ${x}` `` | 字符串模板 |
| `list.append(x)` | `array.push(x)` | 添加元素 |
| `len(list)` | `array.length` | 获取长度 |
| `for x in list:` | `for (const x of array)` | 遍历 |
| `dict.get(k, d)` | `obj[k] ?? d` | 默认值获取 |
| `try/except` | `try/catch` | 异常处理 |

### Python → Go

| Python | Go | 说明 |
|:---|:---|:---|
| `def func(x):` | `func name(x Type) ReturnType {}` | 需要类型声明 |
| `class Foo:` | `type Foo struct {}` | 结构体替代类 |
| `self.x` | `f.x` | 接收者方法 |
| `None` | `nil` | 空值 |
| `list = []` | `slice := []Type{}` | 切片 |
| `dict = {}` | `m := make(map[K]V)` | 映射 |
| `try/except` | `if err != nil {}` | 错误处理 |
| `import x` | `import "x"` | 导入语法 |

### Python → Rust

| Python | Rust | 说明 |
|:---|:---|:---|
| `def func(x):` | `fn func(x: Type) -> ReturnType {}` | 强类型签名 |
| `class Foo:` | `struct Foo {}` + `impl Foo {}` | 结构体+实现分离 |
| `None` | `None` (Option类型) | 需要Option包装 |
| `list = []` | `let vec: Vec<T> = Vec::new()` | Vector |
| `dict = {}` | `HashMap::new()` | 需要显式导入 |
| `try/except` | `Result<T, E>` + `?` | Result类型 |
| `x = 5` | `let x = 5;` 或 `let mut x = 5;` | 不可变/可变 |

### Python → TypeScript

| Python | TypeScript | 说明 |
|:---|:---|:---|
| `def func(x):` | `function func(x: Type): ReturnType {}` | 类型注解 |
| `class Foo:` | `class Foo {}` | 类似但有访问修饰符 |
| `__init__` | `constructor` | 构造函数 |
| `self.x` | `this.x` | 实例属性 |
| `Optional[X]` | `X \| null` 或 `X?` | 可选类型 |
| `List[X]` | `X[]` 或 `Array<X>` | 数组类型 |
| `Dict[K,V]` | `Record<K, V>` 或 `Map<K,V>` | 字典类型 |

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

```
❌ 翻译失败

原因: {具体原因}

建议:
- {建议1}
- {建议2}
```

常见失败原因：
1. 源代码存在语法错误
2. 目标语言不支持某些特性（如Python多重继承→Go）
3. 涉及特定库/框架的深度绑定
4. 代码不完整，缺少上下文

## 交互提示

- 如果用户只提供代码没指定目标语言，**主动询问**
- 翻译完成后，询问是否需要进一步优化或解释
- 对于复杂翻译，可以先展示翻译计划再执行
EOF
```

### 4.3 验证文件创建

```bash
# 检查文件是否存在
ls -la ~/.config/opencode/skills/code-translator/

# 检查SKILL.md内容（前20行）
head -20 ~/.config/opencode/skills/code-translator/SKILL.md

# 验证YAML frontmatter格式
head -12 ~/.config/opencode/skills/code-translator/SKILL.md
```

---

## 五、DAE流程验证

### 5.1 重启OpenCode加载Skill

```bash
# 退出当前OpenCode会话（如果有）
# Ctrl+C 或输入 exit

# 重新启动OpenCode
opencode
```

### 5.2 验证Discovery阶段

Skill被正确发现后，Agent的`skill`工具描述中会包含：

```xml
<available_skills>
  <skill>
    <n>code-translator</n>
    <description>智能代码语言转换工具，支持主流编程语言间的精准翻译...</description>
  </skill>
</available_skills>
```

**验证方法：** 直接询问Agent

```bash
> 你有哪些可用的skills？
```

Agent应该能列出`code-translator`技能。

### 5.3 验证Activation阶段

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

### 5.4 验证Execution阶段

**测试用例1：简单函数**

```bash
> 翻译成JavaScript:

def add(a, b):
    return a + b
```

**预期输出：**
```
🔄 代码翻译官已激活...

📝 源语言: Python
🎯 目标语言: JavaScript

✅ 翻译结果:

```javascript
function add(a, b) {
    return a + b;
}
```

💡 关键转换:
- def → function
- Python动态类型与JavaScript相同，无需额外处理
```

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

**测试用例3：复杂算法**

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

### 5.5 测试检查清单

| 测试项 | 测试方法 | 预期结果 | ✓/✗ |
|:---|:---|:---|:---:|
| 目录结构 | `ls ~/.config/opencode/skills/` | 显示code-translator目录 | ☐ |
| SKILL.md存在 | `ls ~/.config/opencode/skills/code-translator/` | 显示SKILL.md | ☐ |
| YAML格式正确 | `head -12 SKILL.md` | 包含name和description | ☐ |
| Skill被发现 | 询问Agent可用skills | 列出code-translator | ☐ |
| 简单翻译 | Python函数→JS | 语法正确+格式化输出 | ☐ |
| 类翻译 | Python类→TS | 结构完整+类型注解 | ☐ |
| 算法翻译 | Python→Rust | 处理类型+错误处理 | ☐ |
| 输出格式 | 检查emoji和结构 | 符合SKILL.md定义的模板 | ☐ |

---

## 六、进阶配置

### 6.1 Skill权限控制

在`opencode.json`中配置Skill访问权限：

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

### 6.2 为特定Agent配置Skills

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

### 6.3 创建项目级Skill

在项目目录下创建：

```bash
mkdir -p .opencode/skills/project-translator
cat > .opencode/skills/project-translator/SKILL.md << 'EOF'
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

---

## 七、调试与优化

### 7.1 常见问题排查

#### 问题1：Skill未被发现

```bash
# 检查文件位置和名称
ls -la ~/.config/opencode/skills/code-translator/SKILL.md

# 确认SKILL.md是大写
# 错误: skill.md, Skill.md
# 正确: SKILL.md

# 检查name是否与目录名一致
grep "^name:" ~/.config/opencode/skills/code-translator/SKILL.md
# 应输出: name: code-translator
```

#### 问题2：Skill未被激活

```bash
# 检查description是否足够描述性
grep "^description:" ~/.config/opencode/skills/code-translator/SKILL.md

# description应清晰描述用途，便于Agent判断是否使用
```

#### 问题3：权限被拒绝

```bash
# 检查opencode.json中的permission配置
cat ~/.config/opencode/opencode.json | grep -A5 "skill"

# 确保没有deny规则阻止该skill
```

### 7.2 优化建议

1. **description要精准**：好的description帮助Agent准确判断何时使用Skill
2. **指令要具体**：在SKILL.md中提供清晰的步骤和格式要求
3. **覆盖边界情况**：说明如何处理不支持的场景
4. **渐进式复杂度**：从简单案例开始，逐步展示高级用法

---

## 八、实训总结

### 8.1 本节完成内容

1. ✅ **环境搭建**：验证镜像默认配置并成功启动OpenCode
2. ✅ **理解机制**：掌握OpenCode原生Skills的DAE工作流程
3. ✅ **Skill开发**：创建完整的代码翻译官SKILL.md
4. ✅ **DAE验证**：验证Discovery-Activation-Execution完整流程

### 8.2 DAE流程总结

| DAE阶段 | 理论概念 | OpenCode Skills实现 |
|:---:|:---|:---|
| **Discovery** | 扫描、索引、注册 | 启动时扫描`skills/*/SKILL.md`，提取name+description |
| **Activation** | 意图识别、条件匹配 | Agent分析任务→调用`skill({ name: "xxx" })` |
| **Execution** | 上下文注入、执行 | SKILL.md完整内容加载→指导Agent执行 |

### 8.3 渐进式披露体现

| 层级 | 实现 | 说明 |
|:---:|:---|:---|
| **L1** | name + description | 启动时只加载简要信息 |
| **L2** | 完整SKILL.md | 按需加载详细指令 |
| **L3** | 权限控制 + Agent定制 | 高级用户配置 |

### 8.4 文件结构总结

```
~/.config/opencode/
├── opencode.json                          # 全局配置
│   ├── model                              # 默认模型配置
│   ├── permission                         # 权限控制
│   ├── watcher                            # 文件监听忽略规则
│   └── mcp                                # 预置MCP服务
└── skills/
    └── code-translator/
        └── SKILL.md                       # 代码翻译官技能定义
            ├── YAML frontmatter          # name, description, metadata
            ├── 触发条件说明               # 何时使用此技能
            ├── 工作流程                   # 步骤化执行指南
            ├── 语言转换规则               # 具体翻译对照表
            └── 输出格式模板               # 标准化输出结构
```

### 8.5 作业与拓展

#### 基础作业

1. 为code-translator添加Java→Kotlin的转换规则
2. 创建一个新Skill：`code-explainer`，用于解释代码功能
3. 测试并记录5个不同类型代码的翻译效果

#### 进阶挑战

1. 创建`code-reviewer` Skill，专门用于代码审查
2. 实现项目级`.opencode/skills/`，定制团队翻译规范
3. 探索Skill之间的组合使用场景

### 8.6 参考资源

- [OpenCode官方文档](https://opencode.ai/docs/)
- [OpenCode Agent Skills](https://opencode.ai/docs/skills/)
- [Agent Skills开放标准](https://agentskills.io/)
- [GLM-4 API文档](https://open.bigmodel.cn/dev/api)

---

## 附录A：完整SKILL.md文件

<details>
<summary>点击展开完整的code-translator/SKILL.md</summary>

```markdown
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

你是一个专业的代码翻译专家...

[完整内容见第四节]
```

</details>

---

## 附录B：镜像默认opencode.json配置（节选）

```json
{
  "$schema": "https://opencode.ai/config.json",
  "autoupdate": false,
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

### 个人API Key配置（可选）

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

---

*实训完成！你已经掌握了基于OpenCode原生Skills机制开发智能体能力的完整流程。*

*Skills是OpenCode推荐的能力扩展方式，它完美体现了DAE（Discovery-Activation-Execution）的设计理念，也是与Claude Code兼容的开放标准。*
