# Agent 手册模板

本文档说明 Agent 手册的 Markdown 格式规范，按此格式编写可自动解析为教学步骤。

---

## 格式规范

### 基本结构

```markdown
# 手册标题

> 手册描述（可选，使用引用块）

## 步骤 1: 步骤标题

步骤内容...

<!-- verify: file_exists:/path/to/file -->
<!-- questions: 问题1|问题2|问题3 -->

## 步骤 2: 步骤标题

步骤内容...
```

### 解析规则

1. **一级标题 (#)**: 手册标题
2. **引用块 (>)**: 手册描述（紧跟标题后）
3. **二级标题 (## 步骤 N:)**: 步骤分隔，N 为步骤序号
4. **代码块**: 自动识别语言，bash 代码默认可执行
5. **HTML 注释**: 配置验证规则和快捷问题

### 验证规则格式

```html
<!-- verify: 类型:参数 -->
```

支持的验证类型:
- `file_exists:/path/to/file` - 检查文件是否存在
- `command:命令|期望类型|期望值` - 检查命令输出
  - 期望类型: `not_empty`, `contains`, `equals`, `regex`
- `service:端口号` - 检查服务是否运行

### 快捷问题格式

```html
<!-- questions: 问题1|问题2|问题3 -->
```

多个问题用 `|` 分隔。

---

## 示例

```markdown
# Python 入门

> 学习 Python 编程的第一步

## 步骤 1: 创建文件

在终端创建 Python 文件:

\`\`\`bash
touch hello.py
\`\`\`

<!-- verify: file_exists:hello.py -->
<!-- questions: 什么是 .py 文件|touch 命令的作用 -->

## 步骤 2: 编写代码

打开文件，输入以下代码:

\`\`\`python
print("Hello, Python!")
\`\`\`

运行程序:

\`\`\`bash
python3 hello.py
\`\`\`

<!-- verify: command:python3 hello.py|contains|Hello -->
<!-- questions: print 函数怎么用|如何运行 Python 程序 -->
```

---

## 注意事项

1. 步骤标题必须以 `## 步骤 N:` 格式开头
2. 验证规则和快捷问题放在步骤末尾
3. bash 代码块默认设为可执行
4. 不需要验证的步骤可省略 verify 注释
