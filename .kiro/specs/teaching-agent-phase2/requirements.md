# Requirements Document - 教学 Agent 阶段二

## Introduction

教学 Agent 智能体管理后台和用户体验完善。本阶段目标是让管理员能在后台配置手册，完善代码执行、验证失败提示等用户体验功能。

## Glossary

- **Agent_Manual_Editor**: 手册编辑组件，用于配置步骤内容和验证规则
- **Learning_Management**: 课程管理页面，已存在
- **Project_Management**: 项目管理页面，已存在
- **Code_Execution**: 代码执行功能，在 Agent 中执行代码并显示结果
- **AI_Suggestion**: AI 辅助建议，验证失败时提供排查建议

## Requirements

### Requirement 1: 管理后台 - 手册 CRUD API

**User Story:** As an admin, I want to create and manage agent manuals via API, so that I can configure learning content.

#### Acceptance Criteria

1. THE system SHALL provide POST /api/admin/agent/manual to create a new manual
2. THE system SHALL provide PUT /api/admin/agent/manual/:id to update manual info
3. THE system SHALL provide DELETE /api/admin/agent/manual/:id to delete a manual
4. THE system SHALL provide POST /api/admin/agent/manual/:id/steps to batch update steps
5. WHEN creating a manual, THE system SHALL validate source_type and source_id exist
6. ALL admin agent API endpoints SHALL require admin role authentication

### Requirement 2: 课程管理扩展

**User Story:** As an admin, I want to configure agent manuals in the course lesson detail page, so that I can bind manuals to lessons.

#### Acceptance Criteria

1. THE LearningManagement page SHALL display an "Agent 手册" tab in lesson detail modal
2. WHEN no manual exists for a lesson, THE system SHALL show "创建手册" button
3. WHEN a manual exists, THE system SHALL display the manual editor
4. THE manual editor SHALL allow editing title, description, and is_published status
5. THE manual editor SHALL allow adding, editing, reordering, and deleting steps

### Requirement 3: 项目管理扩展

**User Story:** As an admin, I want to configure agent manuals in the project unit detail page, so that I can bind manuals to project units.

#### Acceptance Criteria

1. THE ProjectManagement page SHALL display an "Agent 手册" tab in unit detail modal
2. WHEN no manual exists for a unit, THE system SHALL show "创建手册" button
3. WHEN a manual exists, THE system SHALL display the manual editor
4. THE manual editor SHALL be the same component used in LearningManagement

### Requirement 4: 步骤编辑器

**User Story:** As an admin, I want to edit step content with a user-friendly interface, so that I can configure learning steps easily.

#### Acceptance Criteria

1. THE step editor SHALL support editing title
2. THE step editor SHALL support editing content blocks (text, heading, code, image, list)
3. THE step editor SHALL support editing quick questions as a string array
4. THE step editor SHALL support configuring verification rules with type selection
5. THE step editor SHALL allow setting verification to null (no verification)
6. THE step editor SHALL provide JSON preview/edit mode for advanced users

### Requirement 5: 代码执行功能

**User Story:** As a learner, I want to execute code blocks directly in the Agent widget, so that I can practice without switching to terminal.

#### Acceptance Criteria

1. WHEN a code block has executable=true, THE CodeBlock component SHALL display an execute button
2. WHEN execute button is clicked, THE system SHALL send the code to the container via existing terminal service
3. THE system SHALL display execution output below the code block
4. THE system SHALL display execution errors with appropriate styling
5. THE execution result SHALL be clearable by the user

### Requirement 6: 验证失败 AI 建议

**User Story:** As a learner, I want to get AI suggestions when verification fails, so that I can understand what went wrong.

#### Acceptance Criteria

1. WHEN verification fails, THE AgentWidget SHALL call AI service for suggestions
2. THE AI suggestion SHALL be displayed below the error message
3. THE AI suggestion SHALL consider the current step context and verification type
4. THE user SHALL be able to dismiss the suggestion

### Requirement 7: 进度恢复优化

**User Story:** As a learner, I want my progress to be automatically restored when I return, so that I can continue from where I left off.

#### Acceptance Criteria

1. WHEN AgentWidget loads, THE system SHALL fetch and restore user progress
2. THE system SHALL restore current step position
3. THE system SHALL restore chat history for the current step
4. WHEN user switches steps, THE system SHALL save progress automatically
