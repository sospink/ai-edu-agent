# Requirements Document - 教学 Agent 阶段一

## Introduction

教学 Agent 智能体后端核心功能实现，包括数据模型、AI 问答服务、步骤验证服务，以及前端基础对接。本阶段目标是让 Agent 能从数据库加载手册、AI 问答能用、步骤验证能跑通。

## Glossary

- **Agent_Manual**: Agent 教学手册，多态关联课程课时或项目单元
- **Agent_Step**: 手册中的单个步骤，包含内容、快捷问题、验证规则
- **User_Agent_Progress**: 用户学习进度记录
- **Qwen_Service**: 通义千问 API 服务，提供 AI 问答能力
- **Verification_Service**: 步骤验证服务，在用户点击 Continue 时执行
- **Source_Type**: 来源类型，1=课程课时(CourseLesson)，2=项目单元(ProjectUnit)

## Requirements

### Requirement 1: Agent 手册数据模型

**User Story:** As a developer, I want to store agent manuals in the database, so that manuals can be dynamically loaded and managed.

#### Acceptance Criteria

1. THE Agent_Manual entity SHALL support polymorphic association with CourseLesson (source_type=1) and ProjectUnit (source_type=2)
2. THE Agent_Manual entity SHALL contain fields: id, source_type, source_id, title, description, is_published, created_at, updated_at
3. THE Agent_Step entity SHALL contain fields: id, manual_id, step_order, title, content (JSON), quick_questions (JSON), verification (JSON nullable)
4. THE User_Agent_Progress entity SHALL contain fields: id, user_id, manual_id, current_step, completed_steps (JSON), chat_history (JSON), started_at, last_active_at
5. WHEN a manual is deleted, THE system SHALL cascade delete all associated steps

### Requirement 2: 通义千问 AI 问答服务

**User Story:** As a learner, I want to ask questions and get AI-powered answers, so that I can understand the learning content better.

#### Acceptance Criteria

1. THE Qwen_Service SHALL use OpenAI-compatible protocol with DashScope API
2. THE Qwen_Service SHALL support streaming responses via SSE
3. THE Qwen_Service SHALL support non-streaming responses for simple queries
4. THE Qwen_Service SHALL include step context in the system prompt
5. THE Qwen_Service SHALL support code explanation functionality
6. WHEN API errors occur, THE Qwen_Service SHALL return user-friendly error messages

### Requirement 3: 步骤验证服务

**User Story:** As a learner, I want my progress to be verified when I click Continue, so that I know I've completed the step correctly.

#### Acceptance Criteria

1. THE Verification_Service SHALL only execute when user clicks Continue button
2. THE Verification_Service SHALL support verification types: file_exists, command_output, service_running, custom
3. WHEN verification field is null, THE system SHALL allow proceeding to next step without verification
4. THE Verification_Service SHALL execute commands in the user's Docker container via existing TerminalService
5. WHEN verification fails, THE system SHALL return detailed error message
6. THE Verification_Service SHALL support expect modes: not_empty, contains, equals, regex

### Requirement 4: Agent API 接口

**User Story:** As a frontend developer, I want API endpoints to interact with the agent system, so that the frontend can load manuals and submit user actions.

#### Acceptance Criteria

1. THE system SHALL provide GET /api/agent/manual/:sourceType/:sourceId to fetch manual with all steps
2. THE system SHALL provide POST /api/agent/verify to verify current step
3. THE system SHALL provide POST /api/agent/chat for non-streaming AI chat
4. THE system SHALL provide POST /api/agent/chat/stream for streaming AI chat via SSE
5. THE system SHALL provide POST /api/agent/explain for code explanation
6. THE system SHALL provide GET /api/agent/progress/:sourceType/:sourceId to get user progress
7. THE system SHALL provide POST /api/agent/progress to update user progress
8. ALL agent API endpoints SHALL require JWT authentication

### Requirement 5: 前端 AgentWidget 对接

**User Story:** As a learner, I want the Agent widget to load real data from the backend, so that I can follow the actual learning content.

#### Acceptance Criteria

1. THE AgentWidget SHALL fetch manual data from API on mount
2. THE AgentWidget SHALL display loading state while fetching data
3. THE AgentWidget SHALL call verify API when Continue button is clicked
4. THE AgentWidget SHALL call chat/stream API for AI questions with streaming display
5. THE AgentWidget SHALL save and restore user progress via API
6. WHEN verification fails, THE AgentWidget SHALL display error message from API
