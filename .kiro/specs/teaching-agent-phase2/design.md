# Design Document - 教学 Agent 阶段二

## Overview

本阶段实现管理后台功能和用户体验完善。在现有的课程管理和项目管理页面中添加 Agent 手册配置功能，完善代码执行和验证失败提示。

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Admin Frontend                            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  LearningManagement / ProjectManagement              │    │
│  │  └── AgentManualEditor (新组件)                      │    │
│  │      └── StepEditor (新组件)                         │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    User Frontend                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  AgentWidget (增强)                                  │    │
│  │  ├── CodeBlock (增强: 执行功能)                      │    │
│  │  └── VerificationError (新: AI 建议)                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  AgentController (扩展 admin 接口)                    │   │
│  │  - POST /api/admin/agent/manual                       │   │
│  │  - PUT /api/admin/agent/manual/:id                    │   │
│  │  - DELETE /api/admin/agent/manual/:id                 │   │
│  │  - POST /api/admin/agent/manual/:id/steps             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Admin API Extensions

```typescript
// controllers/AgentController.ts (扩展)

// POST /api/admin/agent/manual
// Body: { sourceType, sourceId, title, description }
async function createManual(req, res);

// PUT /api/admin/agent/manual/:id
// Body: { title?, description?, isPublished? }
async function updateManual(req, res);

// DELETE /api/admin/agent/manual/:id
async function deleteManual(req, res);

// POST /api/admin/agent/manual/:id/steps
// Body: { steps: AgentStep[] } - 批量更新步骤
async function updateSteps(req, res);
```

### 2. AgentManualEditor Component

```typescript
// components/admin/AgentManualEditor.tsx

interface AgentManualEditorProps {
  sourceType: 1 | 2;  // 1=课程课时, 2=项目单元
  sourceId: number;
  onClose: () => void;
}

// 功能:
// - 加载或创建手册
// - 编辑手册基本信息
// - 管理步骤列表 (添加/编辑/删除/排序)
// - 保存手册和步骤
```

### 3. StepEditor Component

```typescript
// components/admin/StepEditor.tsx

interface StepEditorProps {
  step: AgentStep;
  onChange: (step: AgentStep) => void;
  onDelete: () => void;
}

// 功能:
// - 编辑步骤标题
// - 编辑内容块 (可视化 + JSON 模式)
// - 编辑快捷问题
// - 配置验证规则
```

### 4. CodeBlock Enhancement

```typescript
// components/agent/CodeBlock.tsx (增强)

interface CodeBlockProps {
  language: string;
  code: string;
  executable?: boolean;
  onExecute?: (code: string) => Promise<{ output: string; exitCode: number; error?: string }>;
  onExplain?: (code: string, language: string) => void;
}

// 新增:
// - 执行按钮 (executable=true 时显示)
// - 执行结果显示区域
// - 执行状态 (loading/success/error)
// - 清除结果按钮
```

### 5. VerificationError Component

```typescript
// components/agent/VerificationError.tsx

interface VerificationErrorProps {
  message: string;
  details?: string;
  onGetSuggestion: () => Promise<string>;
  onDismiss: () => void;
}

// 功能:
// - 显示验证失败信息
// - "获取 AI 建议" 按钮
// - 显示 AI 建议内容
// - 关闭按钮
```

## Data Models

### Step Content Block Schema (for editor)

```typescript
// 内容块类型定义 (用于编辑器)
type ContentBlockType = 'text' | 'heading' | 'code' | 'image' | 'list';

interface ContentBlockConfig {
  type: ContentBlockType;
  label: string;
  fields: {
    name: string;
    type: 'text' | 'textarea' | 'select' | 'boolean';
    label: string;
    options?: string[];
  }[];
}

const CONTENT_BLOCK_CONFIGS: ContentBlockConfig[] = [
  {
    type: 'text',
    label: '文本',
    fields: [{ name: 'text', type: 'textarea', label: '内容' }]
  },
  {
    type: 'heading',
    label: '标题',
    fields: [{ name: 'text', type: 'text', label: '标题文字' }]
  },
  {
    type: 'code',
    label: '代码块',
    fields: [
      { name: 'language', type: 'select', label: '语言', options: ['bash', 'sql', 'python', 'javascript'] },
      { name: 'code', type: 'textarea', label: '代码' },
      { name: 'executable', type: 'boolean', label: '可执行' }
    ]
  },
  // ...
];
```

### Verification Config Schema (for editor)

```typescript
// 验证规则配置 (用于编辑器)
interface VerificationConfig {
  type: 'file_exists' | 'command_output' | 'service_running' | 'custom' | 'none';
  // 根据 type 显示不同字段
}

const VERIFICATION_FIELDS = {
  file_exists: [{ name: 'path', type: 'text', label: '文件路径' }],
  command_output: [
    { name: 'command', type: 'text', label: '命令' },
    { name: 'expect', type: 'select', label: '期望', options: ['not_empty', 'contains', 'equals', 'regex'] },
    { name: 'value', type: 'text', label: '期望值 (可选)' }
  ],
  service_running: [{ name: 'port', type: 'number', label: '端口号' }],
  custom: [{ name: 'script', type: 'textarea', label: '自定义脚本' }],
  none: []
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: Manual CRUD Consistency

*For any* manual created via admin API, it should be retrievable via the user API with the same data.

**Validates: Requirements 1.1, 1.2**

### Property 2: Step Order Integrity

*For any* batch step update, the resulting steps should maintain unique step_order values starting from 0.

**Validates: Requirements 1.4**

### Property 3: Code Execution Isolation

*For any* code execution request, the execution should only affect the user's own container.

**Validates: Requirements 5.2**

### Property 4: AI Suggestion Relevance

*For any* verification failure, the AI suggestion should reference the specific verification type and error message.

**Validates: Requirements 6.3**

## Error Handling

| Error Case | HTTP Status | Response |
|------------|-------------|----------|
| Source not found | 404 | `{ error: '课时/单元不存在' }` |
| Manual already exists | 409 | `{ error: '手册已存在' }` |
| Invalid step data | 400 | `{ error: '步骤数据格式错误' }` |
| Not admin | 403 | `{ error: '需要管理员权限' }` |
| Execution timeout | 408 | `{ error: '执行超时' }` |

## Testing Strategy

### Unit Tests

- StepEditor: Test content block rendering and editing
- VerificationError: Test AI suggestion flow

### Integration Tests

- Admin API CRUD operations
- Code execution with mock container

### E2E Tests

- Create manual → Add steps → Publish → User access flow
