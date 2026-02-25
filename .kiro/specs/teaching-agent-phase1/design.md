# Design Document - 教学 Agent 阶段一

## Overview

本阶段实现教学 Agent 的后端核心功能，复用现有 EDU_Backend 架构（Express + TypeORM + MySQL），新增 Agent 相关的数据模型、服务和 API。前端 AgentWidget 改为从 API 动态加载数据。

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              AgentWidget.tsx                         │    │
│  │  - 从 API 加载手册数据                               │    │
│  │  - 调用 AI 问答接口（流式）                          │    │
│  │  - 调用验证接口                                      │    │
│  │  - 保存/恢复用户进度                                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (Express)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │AgentController│  │ AgentService │  │ QwenService  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                 │                 │                │
│         ▼                 ▼                 ▼                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │VerifyService │  │  TypeORM     │  │ DashScope API│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│         │                 │                                  │
│         ▼                 ▼                                  │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │Docker/SSH    │  │   MySQL      │                         │
│  │(existing)    │  │              │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Data Models (TypeORM Entities)

#### AgentManual Entity

```typescript
@Entity('agent_manuals')
export class AgentManual {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'source_type', type: 'tinyint', unsigned: true, comment: '1=课程课时, 2=项目单元' })
  sourceType: number;

  @Column({ name: 'source_id', type: 'bigint', unsigned: true })
  sourceId: number;

  @Column({ type: 'varchar', length: 128 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_published', type: 'tinyint', default: 0 })
  isPublished: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => AgentStep, step => step.manual)
  steps: AgentStep[];
}
```

#### AgentStep Entity

```typescript
@Entity('agent_steps')
export class AgentStep {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'manual_id', type: 'bigint', unsigned: true })
  manualId: number;

  @Column({ name: 'step_order', type: 'int', unsigned: true })
  stepOrder: number;

  @Column({ type: 'varchar', length: 128 })
  title: string;

  @Column({ type: 'json', comment: 'ContentBlock[]' })
  content: object;

  @Column({ name: 'quick_questions', type: 'json', nullable: true })
  quickQuestions: string[];

  @Column({ type: 'json', nullable: true, comment: 'Verification rule, null means no verification' })
  verification: object | null;

  @ManyToOne(() => AgentManual, manual => manual.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'manual_id' })
  manual: AgentManual;
}
```

#### UserAgentProgress Entity

```typescript
@Entity('user_agent_progress')
export class UserAgentProgress {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId: number;

  @Column({ name: 'manual_id', type: 'bigint', unsigned: true })
  manualId: number;

  @Column({ name: 'current_step', type: 'int', default: 0 })
  currentStep: number;

  @Column({ name: 'completed_steps', type: 'json', default: '[]' })
  completedSteps: number[];

  @Column({ name: 'chat_history', type: 'json', default: '[]' })
  chatHistory: object[];

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @UpdateDateColumn({ name: 'last_active_at' })
  lastActiveAt: Date;
}
```

### 2. QwenService

```typescript
// services/QwenService.ts
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: process.env.QWEN_BASE_URL,
});

interface ChatRequest {
  question: string;
  stepContext?: string;
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

// 流式问答
async function chatStream(req: ChatRequest, res: Response): Promise<void>;

// 非流式问答
async function chat(req: ChatRequest): Promise<{ answer: string }>;

// 代码解释
async function explainCode(code: string, language: string): Promise<string>;
```

### 3. VerificationService

```typescript
// services/VerificationService.ts
interface Verification {
  type: 'file_exists' | 'command_output' | 'service_running' | 'custom';
  path?: string;
  command?: string;
  expect?: 'not_empty' | 'contains' | 'equals' | 'regex';
  value?: string;
  port?: number;
  script?: string;
}

interface VerifyResult {
  success: boolean;
  message: string;
  details?: string;
}

// 执行验证（复用现有 docker 工具）
async function verify(containerId: string, verification: Verification): Promise<VerifyResult>;
```

### 4. AgentService

```typescript
// services/AgentService.ts

// 获取手册（含所有步骤）
async function getManual(sourceType: number, sourceId: number): Promise<AgentManual | null>;

// 获取用户进度
async function getProgress(userId: number, manualId: number): Promise<UserAgentProgress | null>;

// 更新用户进度
async function updateProgress(userId: number, manualId: number, data: Partial<UserAgentProgress>): Promise<void>;

// 验证步骤
async function verifyStep(userId: number, manualId: number, stepOrder: number, containerId: string): Promise<VerifyResult>;
```

### 5. AgentController

```typescript
// controllers/AgentController.ts

// GET /api/agent/manual/:sourceType/:sourceId
async function getManual(req, res);

// POST /api/agent/verify
// Body: { manualId, stepOrder, containerId }
async function verifyStep(req, res);

// POST /api/agent/chat
// Body: { question, stepContext, chatHistory }
async function chat(req, res);

// POST /api/agent/chat/stream
// Body: { question, stepContext, chatHistory }
// Response: SSE stream
async function chatStream(req, res);

// POST /api/agent/explain
// Body: { code, language }
async function explainCode(req, res);

// GET /api/agent/progress/:sourceType/:sourceId
async function getProgress(req, res);

// POST /api/agent/progress
// Body: { sourceType, sourceId, currentStep, completedSteps, chatHistory }
async function updateProgress(req, res);
```

## Data Models

### Database Schema

```sql
-- Agent 手册表
CREATE TABLE agent_manuals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_type TINYINT UNSIGNED NOT NULL COMMENT '1=课程课时, 2=项目单元',
  source_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(128) NOT NULL,
  description TEXT,
  is_published TINYINT UNSIGNED DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_source (source_type, source_id)
);

-- Agent 步骤表
CREATE TABLE agent_steps (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  manual_id BIGINT UNSIGNED NOT NULL,
  step_order INT UNSIGNED NOT NULL,
  title VARCHAR(128) NOT NULL,
  content JSON NOT NULL COMMENT 'ContentBlock[]',
  quick_questions JSON COMMENT '快捷问题数组',
  verification JSON COMMENT '验证规则，null表示无需验证',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (manual_id) REFERENCES agent_manuals(id) ON DELETE CASCADE,
  UNIQUE KEY uk_manual_step (manual_id, step_order)
);

-- 用户进度表
CREATE TABLE user_agent_progress (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  manual_id BIGINT UNSIGNED NOT NULL,
  current_step INT DEFAULT 0,
  completed_steps JSON DEFAULT '[]',
  chat_history JSON DEFAULT '[]',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (manual_id) REFERENCES agent_manuals(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_manual (user_id, manual_id)
);
```

### Content Block Types

```typescript
interface ContentBlock {
  type: 'text' | 'heading' | 'code' | 'image' | 'list';
  text?: string;
  language?: string;
  code?: string;
  src?: string;
  items?: string[];
  executable?: boolean;
}
```

### Verification Types

```typescript
interface Verification {
  type: 'file_exists' | 'command_output' | 'service_running' | 'custom';
  // file_exists
  path?: string;
  // command_output
  command?: string;
  expect?: 'not_empty' | 'contains' | 'equals' | 'regex';
  value?: string;
  // service_running
  port?: number;
  // custom
  script?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: Manual-Step Relationship Integrity

*For any* AgentManual, all associated AgentSteps should have unique step_order values and be retrievable via the manual_id foreign key.

**Validates: Requirements 1.5**

### Property 2: Verification Optional Behavior

*For any* AgentStep with verification=null, the system should allow proceeding to the next step without executing any verification logic.

**Validates: Requirements 3.3**

### Property 3: Streaming Response Completeness

*For any* streaming chat request, the accumulated chunks should equal the complete response that would be returned by a non-streaming request with the same input.

**Validates: Requirements 2.2, 2.3**

### Property 4: Progress Persistence

*For any* user progress update, subsequent GET requests should return the updated values.

**Validates: Requirements 4.6, 4.7**

## Error Handling

| Error Case | HTTP Status | Response |
|------------|-------------|----------|
| Manual not found | 404 | `{ error: '手册不存在' }` |
| Step not found | 404 | `{ error: '步骤不存在' }` |
| Verification failed | 200 | `{ success: false, message: '...', details: '...' }` |
| AI service error | 500 | `{ error: 'AI 服务暂时不可用' }` |
| Container not found | 400 | `{ error: '实验环境不存在' }` |
| Unauthorized | 401 | `{ error: '请先登录' }` |

## Testing Strategy

### Unit Tests

- QwenService: Mock OpenAI client, test prompt building
- VerificationService: Mock docker exec, test each verification type
- AgentService: Mock repositories, test business logic

### Integration Tests

- API endpoints with test database
- Streaming response handling

### Property-Based Tests

- Verification type handling (generate random verification configs)
- Progress update consistency
