# ADE 智能体开发 - 代码翻译官 Skill

> 本实验将指导您使用 ADE (Agent Development Environment) 开发一个代码翻译 Skill。您将学习如何将一种编程语言的代码翻译成另一种语言，这是 AI 辅助开发中非常实用的功能。通过本实验，您将掌握 Skill 开发的完整流程：从需求分析、接口设计、核心实现到测试验证。代码翻译不仅能帮助开发者学习新语言，还能在项目迁移、代码重构等场景中发挥重要作用。完成本实验后，您将能够开发自己的 Skill，为 AI 应用添加各种能力。

## 步骤 1: 配置 API 环境（可选）

### 关于 ADE Skill 的 API 配置

ADE Skill 开发主要演示技能封装和接口设计，本课程的示例代码使用模拟翻译，**不强制要求真实的 API 调用**。

但是，如果您想体验真实的 AI 代码翻译功能，可以配置 API 环境。

**查看环境配置**：

```bash
cat /workspace/.env
```

您会看到：

```bash
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen-turbo
```

**配置说明**：
- ADE Skill 示例代码会检测 API 配置
- 如果配置了 API Key，可以扩展为真实的翻译功能
- 如果未配置，使用模拟翻译结果（不影响学习）
- 配置方法：`nano /workspace/.env` 或 `vi /workspace/.env`

**本课程重点**：
- 理解 Skill 的标准接口
- 学习输入验证和错误处理
- 掌握模块化设计
- 实现 Skill 组合和工作流

<!-- questions: Skill 必须用 API 吗|如何集成真实 API|Skill 和 Tool 有什么区别 -->

## 步骤 2: 认识实验环境和 Skill 概念

### 什么是 Skill？

在 ADE 中，**Skill** 是一个独立的能力单元，就像一个"技能包"。每个 Skill 专注于完成一个特定的任务。

**Skill 的特点**：
- **单一职责** - 只做一件事
- **标准接口** - 统一的输入输出
- **可复用** - 可以在不同项目中使用
- **可组合** - 多个 Skill 可以组合使用

### 进入课程目录

```bash
cd /workspace/courses/ade-skill
ls -la
```

您会看到：
- `example.py` - 代码翻译 Skill 示例
- `README.md` - 课程说明

### 查看示例代码

```bash
cat /workspace/courses/ade-skill/example.py
```

这是一个简化的代码翻译示例，展示了基本的结构。

<!-- questions: Skill 和普通函数有什么区别|为什么要用 Skill 模式|Skill 可以用在哪些场景 -->

## 步骤 3: 运行示例程序

### 执行示例代码

运行代码翻译示例：

```bash
cd /workspace/courses/ade-skill && python3 example.py
```

### 观察输出

您会看到：
1. **原始 Python 代码** - 斐波那契数列函数
2. **翻译后的 JavaScript 代码** - 对应的 JS 实现
3. **API 配置提示** - 是否配置了真实的 API

### 理解翻译过程

代码翻译需要：
1. **理解源代码** - 分析代码的逻辑和结构
2. **识别语言特性** - 了解两种语言的差异
3. **生成目标代码** - 用目标语言实现相同逻辑
4. **保持语义** - 确保功能一致

<!-- verify: command:cd /workspace/courses/ade-skill && python3 example.py|contains|翻译完成 -->
<!-- questions: 代码翻译的难点是什么|如何保证翻译的准确性|哪些代码难以翻译 -->

## 步骤 4: 创建基础 Skill 结构

### 任务说明

让我们创建一个完整的代码翻译 Skill，包含标准的结构和接口。

### 创建新文件

```bash
cd /workspace/courses/ade-skill && touch code_translator_skill.py
```

### 编写 Skill 基础结构

```bash
cat > /workspace/courses/ade-skill/code_translator_skill.py << 'EOF'
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
代码翻译 Skill
实现标准的 Skill 接口
"""

import os
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv('/workspace/.env')

class CodeTranslatorSkill:
    """
    代码翻译 Skill
    
    功能：将一种编程语言的代码翻译成另一种语言
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        """
        初始化 Skill
        
        Args:
            config: 配置字典，包含 API Key 等信息
        """
        self.config = config or {}
        self.name = "CodeTranslator"
        self.version = "1.0.0"
        self.description = "将代码从一种语言翻译成另一种语言"
        
        # 支持的编程语言
        self.supported_languages = [
            "python", "javascript", "java", "go", 
            "rust", "typescript", "c++", "c#"
        ]
        
        # API 配置
        self.api_key = self.config.get("api_key") or os.getenv("OPENAI_API_KEY")
        self.base_url = self.config.get("base_url") or os.getenv("OPENAI_BASE_URL")
        self.model = self.config.get("model") or os.getenv("OPENAI_MODEL", "gpt-4")
        
        print(f"✓ {self.name} Skill v{self.version} 初始化成功")
        if self.api_key:
            print(f"✓ API 配置: {self.model}")
    
    def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        执行代码翻译（Skill 的核心方法）
        
        Args:
            input_data: 输入数据
                {
                    "code": "源代码",
                    "from_language": "源语言",
                    "to_language": "目标语言"
                }
        
        Returns:
            输出数据
                {
                    "success": True/False,
                    "translated_code": "翻译后的代码",
                    "metadata": {...}
                }
        """
        try:
            # 1. 验证输入
            self.validate_input(input_data)
            
            # 2. 提取参数
            code = input_data["code"]
            from_lang = input_data["from_language"]
            to_lang = input_data["to_language"]
            
            # 3. 执行翻译
            translated_code = self.translate(code, from_lang, to_lang)
            
            # 4. 返回结果
            return {
                "success": True,
                "translated_code": translated_code,
                "metadata": {
                    "from_language": from_lang,
                    "to_language": to_lang,
                    "skill_name": self.name,
                    "skill_version": self.version
                }
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "metadata": {
                    "skill_name": self.name,
                    "skill_version": self.version
                }
            }
    
    def validate_input(self, input_data: Dict[str, Any]):
        """
        验证输入数据
        
        Args:
            input_data: 输入数据
        
        Raises:
            ValueError: 输入数据不合法
        """
        # 检查必需字段
        required_fields = ["code", "from_language", "to_language"]
        for field in required_fields:
            if field not in input_data:
                raise ValueError(f"缺少必需字段: {field}")
        
        # 检查代码不为空
        if not input_data["code"].strip():
            raise ValueError("代码不能为空")
        
        # 检查语言支持
        from_lang = input_data["from_language"].lower()
        to_lang = input_data["to_language"].lower()
        
        if from_lang not in self.supported_languages:
            raise ValueError(f"不支持的源语言: {from_lang}")
        
        if to_lang not in self.supported_languages:
            raise ValueError(f"不支持的目标语言: {to_lang}")
        
        if from_lang == to_lang:
            raise ValueError("源语言和目标语言不能相同")
    
    def translate(self, code: str, from_lang: str, to_lang: str) -> str:
        """
        执行代码翻译
        
        Args:
            code: 源代码
            from_lang: 源语言
            to_lang: 目标语言
        
        Returns:
            翻译后的代码
        """
        # 这里应该调用 LLM API 进行翻译
        # 为了演示，我们返回模拟结果
        
        if self.api_key:
            # TODO: 调用真实的 API
            print(f"[模拟] 调用 {self.model} 进行翻译...")
        
        # 模拟翻译结果
        if from_lang == "python" and to_lang == "javascript":
            # 简单的语法转换示例
            translated = code.replace("def ", "function ")
            translated = translated.replace(":", " {")
            translated = translated.replace("print(", "console.log(")
            translated += "\n}"
            return translated
        else:
            return f"// 翻译自 {from_lang}\n{code}\n// TODO: 实现 {to_lang} 版本"
    
    def get_info(self) -> Dict[str, Any]:
        """
        获取 Skill 信息
        
        Returns:
            Skill 的元数据
        """
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "supported_languages": self.supported_languages,
            "input_schema": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "源代码"},
                    "from_language": {"type": "string", "description": "源语言"},
                    "to_language": {"type": "string", "description": "目标语言"}
                },
                "required": ["code", "from_language", "to_language"]
            }
        }


def main():
    """测试 Skill"""
    print("=" * 60)
    print("代码翻译 Skill 测试")
    print("=" * 60)
    print()
    
    # 创建 Skill 实例
    skill = CodeTranslatorSkill()
    
    # 展示 Skill 信息
    info = skill.get_info()
    print(f"Skill 名称: {info['name']}")
    print(f"版本: {info['version']}")
    print(f"描述: {info['description']}")
    print(f"支持的语言: {', '.join(info['supported_languages'])}")
    print()
    
    # 测试用例 1: Python → JavaScript
    print("=" * 60)
    print("测试 1: Python → JavaScript")
    print("=" * 60)
    
    input_data = {
        "code": "def greet(name):\n    print(f'Hello, {name}!')",
        "from_language": "python",
        "to_language": "javascript"
    }
    
    print("输入代码:")
    print(input_data["code"])
    print()
    
    result = skill.execute(input_data)
    
    if result["success"]:
        print("翻译成功!")
        print("输出代码:")
        print(result["translated_code"])
    else:
        print(f"翻译失败: {result['error']}")
    
    print()
    print("✅ Skill 测试完成！")


if __name__ == "__main__":
    main()
EOF
```

### 运行 Skill

```bash
cd /workspace/courses/ade-skill && python3 code_translator_skill.py
```

观察输出，您应该看到 Skill 的完整执行流程。

<!-- verify: file_exists:/workspace/courses/ade-skill/code_translator_skill.py -->
<!-- verify: command:cd /workspace/courses/ade-skill && python3 code_translator_skill.py|contains|Skill 测试完成 -->
<!-- questions: 为什么要验证输入|如何设计好的接口|元数据有什么用 -->

## 步骤 5: 添加错误处理和测试

### 任务说明

让我们为 Skill 添加完善的错误处理和测试用例。

### 创建测试文件

```bash
cat > /workspace/courses/ade-skill/test_skill.py << 'EOF'
#!/usr/bin/env python3
"""
代码翻译 Skill 测试套件
"""

from code_translator_skill import CodeTranslatorSkill

def test_valid_translation():
    """测试正常的翻译"""
    print("测试 1: 正常翻译")
    print("-" * 60)
    
    skill = CodeTranslatorSkill()
    result = skill.execute({
        "code": "def add(a, b):\n    return a + b",
        "from_language": "python",
        "to_language": "javascript"
    })
    
    assert result["success"] == True
    assert "translated_code" in result
    print("✓ 测试通过")
    print()

def test_missing_field():
    """测试缺少必需字段"""
    print("测试 2: 缺少必需字段")
    print("-" * 60)
    
    skill = CodeTranslatorSkill()
    result = skill.execute({
        "code": "def test(): pass"
        # 缺少 from_language 和 to_language
    })
    
    assert result["success"] == False
    assert "error" in result
    print(f"✓ 正确捕获错误: {result['error']}")
    print()

def test_empty_code():
    """测试空代码"""
    print("测试 3: 空代码")
    print("-" * 60)
    
    skill = CodeTranslatorSkill()
    result = skill.execute({
        "code": "   ",
        "from_language": "python",
        "to_language": "javascript"
    })
    
    assert result["success"] == False
    print(f"✓ 正确捕获错误: {result['error']}")
    print()

def test_unsupported_language():
    """测试不支持的语言"""
    print("测试 4: 不支持的语言")
    print("-" * 60)
    
    skill = CodeTranslatorSkill()
    result = skill.execute({
        "code": "def test(): pass",
        "from_language": "python",
        "to_language": "cobol"  # 不支持的语言
    })
    
    assert result["success"] == False
    print(f"✓ 正确捕获错误: {result['error']}")
    print()

def test_same_language():
    """测试相同的源语言和目标语言"""
    print("测试 5: 相同的语言")
    print("-" * 60)
    
    skill = CodeTranslatorSkill()
    result = skill.execute({
        "code": "def test(): pass",
        "from_language": "python",
        "to_language": "python"
    })
    
    assert result["success"] == False
    print(f"✓ 正确捕获错误: {result['error']}")
    print()

def main():
    """运行所有测试"""
    print("=" * 60)
    print("代码翻译 Skill 测试套件")
    print("=" * 60)
    print()
    
    tests = [
        test_valid_translation,
        test_missing_field,
        test_empty_code,
        test_unsupported_language,
        test_same_language
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"✗ 测试失败: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ 测试错误: {e}")
            failed += 1
    
    print("=" * 60)
    print(f"测试结果: {passed} 通过, {failed} 失败")
    print("=" * 60)

if __name__ == "__main__":
    main()
EOF
```

### 运行测试

```bash
cd /workspace/courses/ade-skill && python3 test_skill.py
```

您应该看到所有测试都通过了。

<!-- verify: command:cd /workspace/courses/ade-skill && python3 test_skill.py|contains|通过 -->
<!-- questions: 为什么要写测试|如何设计测试用例|测试覆盖率是什么 -->

## 步骤 6: 扩展 Skill - 添加代码分析功能

### 任务说明

让我们为 Skill 添加代码分析功能，在翻译前分析代码的复杂度。

### 扩展 Skill

```bash
cat >> /workspace/courses/ade-skill/code_translator_skill.py << 'EOF'

# 添加代码分析功能

class CodeAnalyzer:
    """代码分析器"""
    
    @staticmethod
    def analyze(code: str, language: str) -> Dict[str, Any]:
        """
        分析代码
        
        Args:
            code: 源代码
            language: 编程语言
        
        Returns:
            分析结果
        """
        lines = code.strip().split('\n')
        
        analysis = {
            "lines_count": len(lines),
            "complexity": "simple",
            "has_functions": False,
            "has_classes": False,
            "has_loops": False
        }
        
        # 简单的代码分析
        code_lower = code.lower()
        
        if language == "python":
            analysis["has_functions"] = "def " in code
            analysis["has_classes"] = "class " in code
            analysis["has_loops"] = "for " in code or "while " in code
        elif language == "javascript":
            analysis["has_functions"] = "function " in code
            analysis["has_classes"] = "class " in code
            analysis["has_loops"] = "for " in code_lower or "while " in code_lower
        
        # 判断复杂度
        if analysis["lines_count"] > 50:
            analysis["complexity"] = "complex"
        elif analysis["lines_count"] > 20:
            analysis["complexity"] = "medium"
        
        return analysis


# 测试代码分析
if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("代码分析功能测试")
    print("=" * 60)
    print()
    
    test_code = """
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

for i in range(10):
    print(fibonacci(i))
"""
    
    analyzer = CodeAnalyzer()
    result = analyzer.analyze(test_code, "python")
    
    print("分析结果:")
    print(f"- 代码行数: {result['lines_count']}")
    print(f"- 复杂度: {result['complexity']}")
    print(f"- 包含函数: {result['has_functions']}")
    print(f"- 包含类: {result['has_classes']}")
    print(f"- 包含循环: {result['has_loops']}")
    print()
    print("✅ 代码分析功能添加成功！")
EOF
```

### 运行扩展版本

```bash
cd /workspace/courses/ade-skill && python3 code_translator_skill.py
```

您会看到新增的代码分析功能。

<!-- verify: command:cd /workspace/courses/ade-skill && python3 code_translator_skill.py|contains|代码分析功能 -->
<!-- questions: 代码分析有什么用|如何提高分析的准确性|还可以分析哪些指标 -->

## 步骤 7: Skill 组合使用

### 任务说明

让我们创建一个工作流，组合使用多个 Skill。

### 创建工作流

```bash
cat > /workspace/courses/ade-skill/skill_pipeline.py << 'EOF'
#!/usr/bin/env python3
"""
Skill 工作流示例
演示如何组合使用多个 Skill
"""

from code_translator_skill import CodeTranslatorSkill, CodeAnalyzer

class CodeTranslationPipeline:
    """代码翻译工作流"""
    
    def __init__(self):
        self.translator = CodeTranslatorSkill()
        self.analyzer = CodeAnalyzer()
    
    def process(self, code: str, from_lang: str, to_lang: str):
        """
        完整的翻译流程
        
        1. 分析源代码
        2. 执行翻译
        3. 返回结果
        """
        print("=" * 60)
        print("代码翻译工作流")
        print("=" * 60)
        print()
        
        # 步骤 1: 分析源代码
        print("步骤 1: 分析源代码")
        print("-" * 60)
        analysis = self.analyzer.analyze(code, from_lang)
        print(f"代码行数: {analysis['lines_count']}")
        print(f"复杂度: {analysis['complexity']}")
        print()
        
        # 步骤 2: 执行翻译
        print("步骤 2: 执行翻译")
        print("-" * 60)
        result = self.translator.execute({
            "code": code,
            "from_language": from_lang,
            "to_language": to_lang
        })
        
        if result["success"]:
            print("✓ 翻译成功")
            print()
            print("翻译结果:")
            print(result["translated_code"])
        else:
            print(f"✗ 翻译失败: {result['error']}")
        
        print()
        print("=" * 60)
        print("工作流完成")
        print("=" * 60)
        
        return result


def main():
    """测试工作流"""
    pipeline = CodeTranslationPipeline()
    
    test_code = """def calculate_sum(numbers):
    total = 0
    for num in numbers:
        total += num
    return total"""
    
    pipeline.process(test_code, "python", "javascript")


if __name__ == "__main__":
    main()
EOF
```

### 运行工作流

```bash
cd /workspace/courses/ade-skill && python3 skill_pipeline.py
```

观察完整的工作流执行过程。

<!-- verify: command:cd /workspace/courses/ade-skill && python3 skill_pipeline.py|contains|工作流完成 -->
<!-- questions: 为什么要用工作流|如何设计工作流|工作流有什么优势 -->

## 步骤 8: 实践练习

### 练习任务

创建一个新的 Skill：代码格式化 Skill

**要求**：
1. 实现标准的 Skill 接口
2. 支持多种编程语言
3. 包含输入验证
4. 编写测试用例

### 创建练习文件

```bash
cd /workspace/courses/ade-skill && touch code_formatter_skill.py
```

### 参考结构

```python
class CodeFormatterSkill:
    def __init__(self, config=None):
        # 初始化
        pass
    
    def execute(self, input_data):
        # 执行格式化
        pass
    
    def validate_input(self, input_data):
        # 验证输入
        pass
    
    def format_code(self, code, language, style):
        # 格式化代码
        pass
```

尝试自己实现这个 Skill！

<!-- questions: 如何实现代码格式化|有哪些格式化风格|如何验证格式化结果 -->

## 步骤 9: 总结与实践建议

### 本节课学到了什么

恭喜您完成了 ADE Skill 开发实验！让我们回顾关键知识点：

**Skill 开发流程**：
1. **定义接口** - 设计输入输出格式
2. **实现逻辑** - 编写核心功能
3. **验证输入** - 确保数据合法
4. **错误处理** - 优雅地处理异常
5. **编写测试** - 验证功能正确性

**核心概念**：
- Skill 是独立的能力单元
- 标准化的接口设计
- 模块化和可组合性
- 工程化的开发方式

**实践技能**：
- 创建标准的 Skill 结构
- 实现输入验证和错误处理
- 编写测试用例
- 组合多个 Skill 构建工作流

### Skill 开发最佳实践

1. **单一职责** - 每个 Skill 只做一件事
2. **标准接口** - 使用统一的输入输出格式
3. **完善文档** - 提供清晰的使用说明
4. **充分测试** - 覆盖各种边界情况
5. **版本管理** - 记录 Skill 的版本变化

### 实际应用场景

Skill 可以用于：
- **代码处理** - 翻译、格式化、分析
- **文本处理** - 摘要、翻译、分类
- **数据处理** - 清洗、转换、分析
- **图像处理** - 识别、转换、增强

### 下一步学习

在后续课程中，您将学习：
- 单 Agent 开发 - 构建完整的智能体
- 多 Agent 协作 - 实现复杂的协作任务
- AI 安全与合规 - 确保 AI 应用的安全性

### 扩展练习

尝试以下练习巩固学习：

1. **完善翻译功能** - 连接真实的 LLM API
2. **添加新语言** - 支持更多编程语言
3. **优化分析** - 实现更详细的代码分析
4. **创建新 Skill** - 开发代码审查 Skill
5. **构建应用** - 组合多个 Skill 构建完整应用

继续加油！Skill 开发是 AI 应用的基础！🚀

<!-- questions: 如何发布 Skill|如何维护 Skill|有什么 Skill 开发工具推荐 -->
