# Shell 脚本入门 - 实验手册

> 本实验将指导您编写第一个 Shell 脚本，学习变量、条件判断和循环的基本用法。您将创建一个简单的系统信息查看脚本，掌握 Shell 脚本的核心技能。

## 步骤 1: 创建项目目录

### 创建工作目录

首先，创建项目目录：

```bash
mkdir -p /workspace/projects/shell-intro
```

### 验证目录创建

```bash
ls -la /workspace/projects/
```

您应该看到 `shell-intro` 目录已创建。

<!-- verify: command:ls /workspace/projects/|contains|shell-intro -->
<!-- questions: 什么是工作目录|mkdir -p 是什么意思|/workspace 目录在哪里 -->

## 步骤 2: 创建第一个脚本

### 创建 hello.sh 脚本

使用 `cat` 命令创建脚本文件：

```bash
cat > /workspace/projects/shell-intro/hello.sh << 'EOF'
#!/bin/bash
# 我的第一个 Shell 脚本

echo "Hello, Shell!"
echo "当前时间: $(date)"
echo "当前用户: $USER"
EOF
```

### 添加执行权限

```bash
chmod +x /workspace/projects/shell-intro/hello.sh
```

### 运行脚本

```bash
/workspace/projects/shell-intro/hello.sh
```

您应该看到问候语、当前时间和用户名。

<!-- verify: file_exists:/workspace/projects/shell-intro/hello.sh -->
<!-- verify: command:/workspace/projects/shell-intro/hello.sh|contains|Hello -->
<!-- questions: 什么是 Shebang|为什么需要 chmod +x|$USER 是什么 -->

## 步骤 3: 使用变量

### 创建变量脚本

```bash
cat > /workspace/projects/shell-intro/variables.sh << 'EOF'
#!/bin/bash
# 变量练习

# 定义变量
NAME="Linux"
VERSION=5
MESSAGE="Welcome to $NAME version $VERSION"

# 输出变量
echo "系统名称: $NAME"
echo "版本号: $VERSION"
echo "完整信息: $MESSAGE"

# 命令替换
CURRENT_DIR=$(pwd)
FILE_COUNT=$(ls /workspace/projects/shell-intro | wc -l)

echo "当前目录: $CURRENT_DIR"
echo "文件数量: $FILE_COUNT"
EOF
```

### 添加权限并运行

```bash
chmod +x /workspace/projects/shell-intro/variables.sh
/workspace/projects/shell-intro/variables.sh
```

观察变量是如何定义和使用的。

<!-- verify: file_exists:/workspace/projects/shell-intro/variables.sh -->
<!-- verify: command:/workspace/projects/shell-intro/variables.sh|contains|系统名称 -->
<!-- questions: 变量命名有什么规则|$() 和反引号有什么区别|如何定义只读变量 -->

## 步骤 4: 条件判断

### 创建条件脚本

```bash
cat > /workspace/projects/shell-intro/condition.sh << 'EOF'
#!/bin/bash
# 条件判断练习

# 检查文件是否存在
FILE="/workspace/projects/shell-intro/hello.sh"

if [ -f "$FILE" ]; then
    echo "✓ 文件 $FILE 存在"
else
    echo "✗ 文件 $FILE 不存在"
fi

# 数字比较
NUM=10

if [ $NUM -gt 5 ]; then
    echo "✓ $NUM 大于 5"
fi

# 字符串比较
OS="Linux"

if [ "$OS" = "Linux" ]; then
    echo "✓ 当前系统是 Linux"
fi

echo "条件判断测试完成！"
EOF
```

### 添加权限并运行

```bash
chmod +x /workspace/projects/shell-intro/condition.sh
/workspace/projects/shell-intro/condition.sh
```

<!-- verify: file_exists:/workspace/projects/shell-intro/condition.sh -->
<!-- verify: command:/workspace/projects/shell-intro/condition.sh|contains|条件判断测试完成 -->
<!-- questions: -f 和 -d 有什么区别|字符串比较用什么运算符|如何判断变量是否为空 -->

## 步骤 5: 循环结构

### 创建循环脚本

```bash
cat > /workspace/projects/shell-intro/loop.sh << 'EOF'
#!/bin/bash
# 循环练习

echo "=== for 循环 ==="
for i in 1 2 3; do
    echo "数字: $i"
done

echo ""
echo "=== 遍历文件 ==="
for file in /workspace/projects/shell-intro/*.sh; do
    echo "脚本: $(basename $file)"
done

echo ""
echo "=== while 循环 ==="
count=1
while [ $count -le 3 ]; do
    echo "计数: $count"
    count=$((count + 1))
done

echo "循环测试完成！"
EOF
```

### 添加权限并运行

```bash
chmod +x /workspace/projects/shell-intro/loop.sh
/workspace/projects/shell-intro/loop.sh
```

<!-- verify: file_exists:/workspace/projects/shell-intro/loop.sh -->
<!-- verify: command:/workspace/projects/shell-intro/loop.sh|contains|循环测试完成 -->
<!-- questions: for 和 while 什么时候用|如何跳出循环|{1..10} 是什么语法 -->

## 步骤 6: 挑战任务 - 系统信息脚本

### 任务说明

创建一个实用的系统信息查看脚本，综合运用所学知识。

### 创建系统信息脚本

```bash
cat > /workspace/projects/shell-intro/sysinfo.sh << 'EOF'
#!/bin/bash
# 系统信息查看脚本
# 作者: 学习者

echo "========================================"
echo "        系统信息报告"
echo "========================================"
echo ""

# 基本信息
echo "【基本信息】"
echo "主机名: $(hostname)"
echo "用户名: $USER"
echo "当前目录: $(pwd)"
echo ""

# 系统信息
echo "【系统信息】"
echo "操作系统: $(uname -s)"
echo "内核版本: $(uname -r)"
echo "系统架构: $(uname -m)"
echo ""

# 时间信息
echo "【时间信息】"
echo "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "运行时长: $(uptime -p 2>/dev/null || echo '未知')"
echo ""

# 磁盘信息
echo "【磁盘使用】"
df -h / 2>/dev/null | tail -1 | awk '{print "根目录使用: " $5 " (已用 " $3 " / 总共 " $2 ")"}'
echo ""

# 文件统计
echo "【项目目录统计】"
echo "文件数量: $(ls -1 /workspace/projects/shell-intro | wc -l)"
echo "脚本数量: $(ls -1 /workspace/projects/shell-intro/*.sh 2>/dev/null | wc -l)"
echo ""

echo "========================================"
echo "        报告生成完成！"
echo "========================================"
EOF
```

### 添加权限并运行

```bash
chmod +x /workspace/projects/shell-intro/sysinfo.sh
/workspace/projects/shell-intro/sysinfo.sh
```

您应该看到一份完整的系统信息报告。

<!-- verify: file_exists:/workspace/projects/shell-intro/sysinfo.sh -->
<!-- verify: command:/workspace/projects/shell-intro/sysinfo.sh|contains|报告生成完成 -->
<!-- questions: 如何添加更多系统信息|如何将输出保存到文件|如何定时运行脚本 -->

## 步骤 7: 查看项目成果

### 查看所有创建的脚本

```bash
ls -la /workspace/projects/shell-intro/
```

### 统计代码行数

```bash
wc -l /workspace/projects/shell-intro/*.sh
```

您应该看到创建的所有脚本文件及其行数。

<!-- verify: command:ls /workspace/projects/shell-intro/*.sh|contains|sysinfo.sh -->
<!-- questions: 如何统计代码行数|如何查看文件权限|如何备份脚本 -->

## 步骤 8: 总结与扩展

### 本项目学到了什么

恭喜您完成了 Shell 脚本入门项目！您已掌握：

1. **脚本创建** - 编写和执行 Shell 脚本
2. **变量使用** - 定义和引用变量
3. **条件判断** - if/else 语句
4. **循环结构** - for 和 while 循环
5. **命令替换** - $() 获取命令输出

### 扩展练习

尝试以下练习巩固学习：

1. **添加参数** - 让脚本接受命令行参数
2. **添加函数** - 将重复代码封装成函数
3. **添加日志** - 将输出同时保存到文件
4. **添加颜色** - 使用 ANSI 颜色美化输出

### 实用命令速查

| 命令 | 说明 |
|------|------|
| `chmod +x` | 添加执行权限 |
| `./script.sh` | 执行脚本 |
| `bash -x script.sh` | 调试模式运行 |
| `echo $?` | 查看上条命令返回值 |

继续探索 Shell 脚本的更多可能！🚀

<!-- questions: 如何学习更高级的 Shell 技巧|有什么推荐的 Shell 脚本项目|如何调试 Shell 脚本 -->
