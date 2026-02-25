# Python 数据处理 - 知识手册

## 📚 项目概述

### 学习目标

- 掌握 Python 文件读写操作
- 学会使用字典和列表处理数据
- 理解 JSON 数据格式
- 编写简单的数据统计脚本

### 适用人群

- Python 初学者
- 需要处理数据的开发者
- 对数据分析感兴趣的学习者

---

## 🎯 核心概念

### 为什么学习数据处理？

在实际工作中，我们经常需要：
- 读取配置文件
- 处理日志数据
- 分析统计信息
- 生成报告

Python 提供了简洁强大的数据处理能力。

---

## 🏗️ 基础语法

### 1. 列表（List）

```python
# 创建列表
fruits = ["apple", "banana", "orange"]

# 访问元素
print(fruits[0])  # apple

# 添加元素
fruits.append("grape")

# 遍历列表
for fruit in fruits:
    print(fruit)

# 列表推导式
numbers = [1, 2, 3, 4, 5]
squares = [n * n for n in numbers]
```

### 2. 字典（Dictionary）

```python
# 创建字典
person = {
    "name": "Alice",
    "age": 25,
    "city": "Beijing"
}

# 访问值
print(person["name"])  # Alice

# 添加/修改
person["email"] = "alice@example.com"

# 遍历字典
for key, value in person.items():
    print(f"{key}: {value}")
```

### 3. 文件操作

```python
# 写入文件
with open("data.txt", "w") as f:
    f.write("Hello, World!\n")
    f.write("Line 2\n")

# 读取文件
with open("data.txt", "r") as f:
    content = f.read()
    print(content)

# 逐行读取
with open("data.txt", "r") as f:
    for line in f:
        print(line.strip())
```

### 4. JSON 处理

```python
import json

# Python 对象转 JSON
data = {"name": "Alice", "scores": [90, 85, 92]}
json_str = json.dumps(data, indent=2)
print(json_str)

# JSON 转 Python 对象
json_str = '{"name": "Bob", "age": 30}'
data = json.loads(json_str)
print(data["name"])

# 读写 JSON 文件
with open("data.json", "w") as f:
    json.dump(data, f, indent=2)

with open("data.json", "r") as f:
    data = json.load(f)
```

---

## 💡 实用技巧

### 1. 数据统计

```python
numbers = [85, 90, 78, 92, 88, 76, 95]

# 基本统计
total = sum(numbers)
count = len(numbers)
average = total / count
maximum = max(numbers)
minimum = min(numbers)

print(f"总和: {total}")
print(f"平均: {average:.2f}")
print(f"最大: {maximum}")
print(f"最小: {minimum}")
```

### 2. 数据过滤

```python
# 使用 filter
numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
evens = list(filter(lambda x: x % 2 == 0, numbers))

# 使用列表推导式
evens = [n for n in numbers if n % 2 == 0]
```

### 3. 数据排序

```python
# 简单排序
numbers = [3, 1, 4, 1, 5, 9, 2, 6]
sorted_numbers = sorted(numbers)

# 按字典的某个键排序
students = [
    {"name": "Alice", "score": 85},
    {"name": "Bob", "score": 92},
    {"name": "Charlie", "score": 78}
]
sorted_students = sorted(students, key=lambda x: x["score"], reverse=True)
```

---

## ⚠️ 常见错误

### 错误 1：文件未关闭

```python
# ❌ 错误 - 可能忘记关闭
f = open("data.txt", "r")
content = f.read()
# 忘记 f.close()

# ✅ 正确 - 使用 with 自动关闭
with open("data.txt", "r") as f:
    content = f.read()
```

### 错误 2：键不存在

```python
data = {"name": "Alice"}

# ❌ 可能报错
# print(data["age"])  # KeyError

# ✅ 安全访问
print(data.get("age", "未知"))
```

### 错误 3：编码问题

```python
# ❌ 可能乱码
# with open("data.txt", "r") as f:

# ✅ 指定编码
with open("data.txt", "r", encoding="utf-8") as f:
    content = f.read()
```

---

## 🎓 总结

### 关键要点

1. **列表** - 有序可变的数据集合
2. **字典** - 键值对数据结构
3. **文件操作** - 使用 with 语句
4. **JSON** - 数据交换格式
5. **统计函数** - sum, len, max, min

### 下一步

完成实验手册中的挑战任务，编写一个成绩统计分析脚本！
