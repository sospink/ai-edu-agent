# Shell 脚本入门 - 知识手册

## 📚 项目概述

### 学习目标

- 理解 Shell 脚本的基本概念
- 掌握变量、条件判断、循环的使用
- 学会编写简单的自动化脚本
- 理解脚本权限和执行方式

### 适用人群

- Linux/Mac 用户
- 想要学习自动化的初学者
- 对命令行操作感兴趣的开发者

---

## 🎯 核心概念

### 什么是 Shell？

**Shell** 是用户与操作系统内核之间的接口，它接收用户输入的命令并传递给内核执行。

**常见的 Shell 类型**：
- `bash` - 最常用的 Shell（Bourne Again Shell）
- `zsh` - macOS 默认 Shell
- `sh` - 原始的 Bourne Shell

### Shell 脚本是什么？

**Shell 脚本** 是一系列 Shell 命令的集合，保存在文件中，可以一次性执行。

**脚本的优势**：
- **自动化** - 重复任务一键完成
- **可复用** - 写一次，用多次
- **可维护** - 便于修改和升级

---

## 🏗️ 基础语法

### 1. 脚本结构

```bash
#!/bin/bash
# 这是注释

# 变量定义
NAME="World"

# 输出
echo "Hello, $NAME!"
```

**第一行 `#!/bin/bash`** 称为 Shebang，指定脚本解释器。

### 2. 变量

```bash
# 定义变量（等号两边不能有空格）
NAME="Alice"
AGE=25

# 使用变量
echo "Name: $NAME"
echo "Age: ${AGE} years old"

# 只读变量
readonly PI=3.14

# 删除变量
unset NAME
```

### 3. 条件判断

```bash
#!/bin/bash

NUM=10

if [ $NUM -gt 5 ]; then
    echo "大于5"
elif [ $NUM -eq 5 ]; then
    echo "等于5"
else
    echo "小于5"
fi
```

**常用比较运算符**：
| 运算符 | 含义 |
|--------|------|
| `-eq` | 等于 |
| `-ne` | 不等于 |
| `-gt` | 大于 |
| `-lt` | 小于 |
| `-ge` | 大于等于 |
| `-le` | 小于等于 |

### 4. 循环

**for 循环**：
```bash
# 遍历列表
for i in 1 2 3 4 5; do
    echo "Number: $i"
done

# 遍历范围
for i in {1..5}; do
    echo "Count: $i"
done
```

**while 循环**：
```bash
count=1
while [ $count -le 5 ]; do
    echo "Count: $count"
    count=$((count + 1))
done
```

### 5. 函数

```bash
#!/bin/bash

# 定义函数
greet() {
    local name=$1  # 局部变量
    echo "Hello, $name!"
}

# 调用函数
greet "Alice"
greet "Bob"
```

---

## 💡 实用技巧

### 1. 命令替换

```bash
# 获取当前日期
TODAY=$(date +%Y-%m-%d)
echo "Today is $TODAY"

# 获取文件数量
FILE_COUNT=$(ls | wc -l)
echo "Files: $FILE_COUNT"
```

### 2. 字符串操作

```bash
STR="Hello World"

# 字符串长度
echo ${#STR}  # 输出: 11

# 子字符串
echo ${STR:0:5}  # 输出: Hello

# 替换
echo ${STR/World/Shell}  # 输出: Hello Shell
```

### 3. 数组

```bash
# 定义数组
FRUITS=("apple" "banana" "orange")

# 访问元素
echo ${FRUITS[0]}  # apple

# 所有元素
echo ${FRUITS[@]}

# 数组长度
echo ${#FRUITS[@]}
```

---

## ⚠️ 常见错误

### 错误 1：变量赋值有空格

```bash
# ❌ 错误
NAME = "Alice"

# ✅ 正确
NAME="Alice"
```

### 错误 2：忘记引号

```bash
# ❌ 可能出错（如果有空格）
FILE=$HOME/my file.txt

# ✅ 正确
FILE="$HOME/my file.txt"
```

### 错误 3：条件判断缺少空格

```bash
# ❌ 错误
if [$NUM -gt 5]; then

# ✅ 正确
if [ $NUM -gt 5 ]; then
```

---

## 🎓 总结

### 关键要点

1. **Shebang** - 脚本第一行指定解释器
2. **变量** - 等号两边不能有空格
3. **条件** - 方括号内需要空格
4. **循环** - for 和 while 两种方式
5. **函数** - 使用 local 定义局部变量

### 下一步

完成实验手册中的挑战任务，编写一个实用的自动化脚本！
