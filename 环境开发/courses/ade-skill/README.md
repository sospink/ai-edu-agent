# 课程 3: ADE 配置与智能体开发 - 代码翻译官 Skill

## 课程简介

学习如何使用 ADE (Agent Development Environment) 创建智能体技能，实现代码翻译功能。

## 学习目标

- 理解 ADE 的基本概念
- 学习如何创建自定义 Skill
- 掌握代码翻译的实现方法
- 了解如何集成 AI API

## 示例说明

`example.py` 演示了一个简单的代码翻译器，可以将 Python 代码翻译成 JavaScript 代码。

### 运行示例

```bash
cd /workspace/courses/ade-skill
python3 example.py
```

### 期望输出

```
==================================================
  课程 3: ADE Skill - 代码翻译官
==================================================

原始 Python 代码:
--------------------------------------------------
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))

翻译后的 JavaScript 代码:
--------------------------------------------------
function fibonacci(n) {
    if (n <= 1) {
        return n;
    }
    return fibonacci(n-1) + fibonacci(n-2);
}

console.log(fibonacci(10));

✓ 代码翻译完成！

==================================================
  ADE Skill 示例运行成功！
==================================================
```

## 扩展练习

1. 添加更多编程语言的翻译支持
2. 实现代码优化功能
3. 添加代码注释翻译
4. 集成真实的 AI API 进行翻译

## 相关资源

- ADE 官方文档
- OpenAI API 文档
- 代码翻译最佳实践

## 注意事项

- 示例使用模拟翻译结果
- 配置 API Key 后可使用真实 AI 翻译
- 代码翻译需要理解语言特性差异
