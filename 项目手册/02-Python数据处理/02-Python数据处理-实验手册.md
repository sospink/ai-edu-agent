# Python 数据处理 - 实验手册

> 本实验将指导您使用 Python 处理数据，学习列表、字典、文件读写和 JSON 操作。您将创建一个成绩统计分析器，掌握 Python 数据处理的核心技能。

## 步骤 1: 创建项目目录

### 创建工作目录

首先，创建项目目录：

```bash
mkdir -p /workspace/projects/python-data
```

### 验证目录创建

```bash
ls -la /workspace/projects/
```

您应该看到 `python-data` 目录已创建。

<!-- verify: command:ls /workspace/projects/|contains|python-data -->
<!-- questions: 什么是工作目录|mkdir -p 是什么意思|Python 项目结构是怎样的 -->

## 步骤 2: 创建测试数据

### 创建成绩数据文件

使用 Python 创建 JSON 格式的测试数据：

```bash
cat > /workspace/projects/python-data/grades.json << 'EOF'
{
  "class": "Python 入门班",
  "semester": "2026春季",
  "students": [
    {"name": "张三", "scores": {"语文": 85, "数学": 92, "英语": 78}},
    {"name": "李四", "scores": {"语文": 90, "数学": 88, "英语": 95}},
    {"name": "王五", "scores": {"语文": 78, "数学": 95, "英语": 82}},
    {"name": "赵六", "scores": {"语文": 92, "数学": 76, "英语": 88}},
    {"name": "钱七", "scores": {"语文": 88, "数学": 90, "英语": 85}}
  ]
}
EOF
```

### 验证数据文件

```bash
cat /workspace/projects/python-data/grades.json
```

<!-- verify: file_exists:/workspace/projects/python-data/grades.json -->
<!-- verify: command:cat /workspace/projects/python-data/grades.json|contains|张三 -->
<!-- questions: JSON 格式是什么|为什么用 JSON 存储数据|如何验证 JSON 格式正确 -->

## 步骤 3: 读取 JSON 数据

### 创建数据读取脚本

```bash
cat > /workspace/projects/python-data/read_data.py << 'EOF'
#!/usr/bin/env python3
"""
读取 JSON 数据示例
"""

import json

# 读取 JSON 文件
with open('/workspace/projects/python-data/grades.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 显示基本信息
print("=" * 40)
print(f"班级: {data['class']}")
print(f"学期: {data['semester']}")
print(f"学生人数: {len(data['students'])}")
print("=" * 40)

# 遍历学生
print("\n学生列表:")
for i, student in enumerate(data['students'], 1):
    print(f"  {i}. {student['name']}")

print("\n数据读取成功！")
EOF
```

### 运行脚本

```bash
python3 /workspace/projects/python-data/read_data.py
```

<!-- verify: file_exists:/workspace/projects/python-data/read_data.py -->
<!-- verify: command:python3 /workspace/projects/python-data/read_data.py|contains|数据读取成功 -->
<!-- questions: json.load 和 json.loads 有什么区别|encoding='utf-8' 是什么意思|with 语句有什么好处 -->

## 步骤 4: 计算统计数据

### 创建统计脚本

```bash
cat > /workspace/projects/python-data/statistics.py << 'EOF'
#!/usr/bin/env python3
"""
成绩统计分析
"""

import json

# 读取数据
with open('/workspace/projects/python-data/grades.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

students = data['students']

print("=" * 50)
print("           成绩统计分析")
print("=" * 50)

# 计算每个学生的总分和平均分
print("\n【学生成绩汇总】")
print("-" * 50)
print(f"{'姓名':<8} {'语文':<6} {'数学':<6} {'英语':<6} {'总分':<6} {'平均':<6}")
print("-" * 50)

for student in students:
    name = student['name']
    scores = student['scores']
    total = sum(scores.values())
    avg = total / len(scores)
    print(f"{name:<8} {scores['语文']:<6} {scores['数学']:<6} {scores['英语']:<6} {total:<6} {avg:<6.1f}")

# 计算各科平均分
print("\n【各科平均分】")
subjects = ['语文', '数学', '英语']
for subject in subjects:
    scores = [s['scores'][subject] for s in students]
    avg = sum(scores) / len(scores)
    print(f"  {subject}: {avg:.1f}")

print("\n统计分析完成！")
EOF
```

### 运行统计脚本

```bash
python3 /workspace/projects/python-data/statistics.py
```

<!-- verify: file_exists:/workspace/projects/python-data/statistics.py -->
<!-- verify: command:python3 /workspace/projects/python-data/statistics.py|contains|统计分析完成 -->
<!-- questions: sum() 函数怎么用|列表推导式是什么|如何格式化输出 -->

## 步骤 5: 数据排序和筛选

### 创建排序筛选脚本

```bash
cat > /workspace/projects/python-data/filter_sort.py << 'EOF'
#!/usr/bin/env python3
"""
数据排序和筛选
"""

import json

# 读取数据
with open('/workspace/projects/python-data/grades.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

students = data['students']

# 计算每个学生的总分
for student in students:
    student['total'] = sum(student['scores'].values())
    student['average'] = student['total'] / len(student['scores'])

print("=" * 50)
print("           排序和筛选结果")
print("=" * 50)

# 按总分排序
print("\n【按总分排名】")
sorted_by_total = sorted(students, key=lambda x: x['total'], reverse=True)
for i, student in enumerate(sorted_by_total, 1):
    print(f"  第{i}名: {student['name']} - 总分 {student['total']}")

# 筛选优秀学生（平均分 >= 85）
print("\n【优秀学生（平均分≥85）】")
excellent = [s for s in students if s['average'] >= 85]
for student in excellent:
    print(f"  ✓ {student['name']} - 平均分 {student['average']:.1f}")

# 找出各科最高分
print("\n【各科最高分】")
subjects = ['语文', '数学', '英语']
for subject in subjects:
    top = max(students, key=lambda x: x['scores'][subject])
    print(f"  {subject}: {top['name']} ({top['scores'][subject]}分)")

print("\n排序筛选完成！")
EOF
```

### 运行脚本

```bash
python3 /workspace/projects/python-data/filter_sort.py
```

<!-- verify: file_exists:/workspace/projects/python-data/filter_sort.py -->
<!-- verify: command:python3 /workspace/projects/python-data/filter_sort.py|contains|排序筛选完成 -->
<!-- questions: sorted 和 sort 有什么区别|lambda 表达式是什么|如何筛选多个条件 -->

## 步骤 6: 挑战任务 - 完整分析器

### 任务说明

创建一个完整的成绩分析器，整合所有功能并生成报告。

### 创建完整分析器

```bash
cat > /workspace/projects/python-data/analyzer.py << 'EOF'
#!/usr/bin/env python3
"""
成绩分析器 - 完整版
综合运用列表、字典、文件操作和 JSON
"""

import json
from datetime import datetime

def load_data(filepath):
    """加载 JSON 数据"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def calculate_stats(students):
    """计算统计数据"""
    for student in students:
        scores = student['scores']
        student['total'] = sum(scores.values())
        student['average'] = student['total'] / len(scores)
    return students

def generate_report(data):
    """生成分析报告"""
    students = calculate_stats(data['students'])
    
    report = []
    report.append("=" * 60)
    report.append("              成绩分析报告")
    report.append("=" * 60)
    report.append(f"\n班级: {data['class']}")
    report.append(f"学期: {data['semester']}")
    report.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 成绩汇总表
    report.append("\n" + "-" * 60)
    report.append("【成绩汇总表】")
    report.append("-" * 60)
    report.append(f"{'姓名':<8} {'语文':<6} {'数学':<6} {'英语':<6} {'总分':<6} {'平均':<6} {'等级':<6}")
    report.append("-" * 60)
    
    for student in students:
        name = student['name']
        scores = student['scores']
        total = student['total']
        avg = student['average']
        
        # 确定等级
        if avg >= 90:
            grade = 'A'
        elif avg >= 80:
            grade = 'B'
        elif avg >= 70:
            grade = 'C'
        elif avg >= 60:
            grade = 'D'
        else:
            grade = 'F'
        
        report.append(f"{name:<8} {scores['语文']:<6} {scores['数学']:<6} {scores['英语']:<6} {total:<6} {avg:<6.1f} {grade:<6}")
    
    # 排名
    report.append("\n" + "-" * 60)
    report.append("【成绩排名】")
    report.append("-" * 60)
    sorted_students = sorted(students, key=lambda x: x['total'], reverse=True)
    for i, student in enumerate(sorted_students, 1):
        report.append(f"  第{i}名: {student['name']} (总分: {student['total']}, 平均: {student['average']:.1f})")
    
    # 统计信息
    report.append("\n" + "-" * 60)
    report.append("【统计信息】")
    report.append("-" * 60)
    
    # 各科平均分
    subjects = ['语文', '数学', '英语']
    for subject in subjects:
        scores = [s['scores'][subject] for s in students]
        avg = sum(scores) / len(scores)
        max_score = max(scores)
        min_score = min(scores)
        report.append(f"  {subject}: 平均 {avg:.1f}, 最高 {max_score}, 最低 {min_score}")
    
    # 班级整体
    all_avgs = [s['average'] for s in students]
    report.append(f"\n  班级平均分: {sum(all_avgs)/len(all_avgs):.1f}")
    report.append(f"  优秀率(≥85): {len([a for a in all_avgs if a >= 85])/len(all_avgs)*100:.1f}%")
    report.append(f"  及格率(≥60): {len([a for a in all_avgs if a >= 60])/len(all_avgs)*100:.1f}%")
    
    report.append("\n" + "=" * 60)
    report.append("              报告生成完成！")
    report.append("=" * 60)
    
    return "\n".join(report)

def main():
    """主函数"""
    # 加载数据
    data = load_data('/workspace/projects/python-data/grades.json')
    
    # 生成报告
    report = generate_report(data)
    
    # 输出到控制台
    print(report)
    
    # 保存到文件
    with open('/workspace/projects/python-data/report.txt', 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n📄 报告已保存到: /workspace/projects/python-data/report.txt")

if __name__ == "__main__":
    main()
EOF
```

### 运行分析器

```bash
python3 /workspace/projects/python-data/analyzer.py
```

### 查看生成的报告

```bash
cat /workspace/projects/python-data/report.txt
```

<!-- verify: file_exists:/workspace/projects/python-data/analyzer.py -->
<!-- verify: command:python3 /workspace/projects/python-data/analyzer.py|contains|报告生成完成 -->
<!-- verify: file_exists:/workspace/projects/python-data/report.txt -->
<!-- questions: 如何添加更多统计指标|如何导出为 Excel|如何处理更大的数据集 -->

## 步骤 7: 查看项目成果

### 查看所有创建的文件

```bash
ls -la /workspace/projects/python-data/
```

### 统计代码行数

```bash
wc -l /workspace/projects/python-data/*.py
```

您应该看到创建的所有 Python 文件及其行数。

<!-- verify: command:ls /workspace/projects/python-data/|contains|analyzer.py -->
<!-- questions: 如何统计代码行数|如何组织更大的项目|如何添加单元测试 -->

## 步骤 8: 总结与扩展

### 本项目学到了什么

恭喜您完成了 Python 数据处理项目！您已掌握：

1. **JSON 操作** - 读取和解析 JSON 数据
2. **列表处理** - 遍历、筛选、排序
3. **字典操作** - 访问和修改嵌套数据
4. **文件读写** - 读取和保存文件
5. **函数封装** - 模块化代码设计
6. **格式化输出** - 美化数据展示

### 扩展练习

尝试以下练习巩固学习：

1. **添加新学生** - 实现添加学生功能
2. **修改成绩** - 实现成绩修改功能
3. **导出 CSV** - 将数据导出为 CSV 格式
4. **图表展示** - 使用 matplotlib 绑制图表

### 常用函数速查

| 函数 | 说明 |
|------|------|
| `json.load()` | 从文件读取 JSON |
| `json.dump()` | 写入 JSON 到文件 |
| `sorted()` | 排序列表 |
| `sum()` | 求和 |
| `max()` / `min()` | 最大/最小值 |

继续探索 Python 数据处理的更多可能！🚀

<!-- questions: 如何学习 pandas 库|有什么数据分析项目推荐|如何处理大数据 -->
