# Requirements Document

## Introduction

本需求文档描述了 Agent Widget 教学智能体组件的用户体验改进。主要解决以下问题：
1. 用户在长对话后需要滚动很久才能找到 "Continue" 按钮继续下一步
2. 验证结果嵌入对话中，不够醒目，用户体验不佳
3. 按钮文案为英文，需要本地化为中文

参考 LabEx Labby AI 助手的交互设计，优化验证结果的展示方式。

## Glossary

- **Agent_Widget**: 教学智能体组件，用于引导学员完成实验手册的步骤
- **Manual_Panel**: 手册内容面板，显示当前步骤的教学内容
- **Chat_Panel**: 对话面板，显示用户与 AI 的对话记录
- **Verification_Dialog**: 验证结果弹窗，以独立卡片形式显示环境检查结果
- **Step_Continue_Button**: 步骤继续按钮，位于每个步骤内容的右下角
- **Floating_Continue_Button**: 悬浮继续按钮，固定在对话区域底部，方便用户快速操作

## Requirements

### Requirement 1: 按钮文案本地化

**User Story:** 作为学员，我希望界面按钮显示中文，方便理解操作含义。

#### Acceptance Criteria

1. THE Agent_Widget SHALL 将 "Continue" 按钮文案改为 "继续"
2. THE Agent_Widget SHALL 将最后一步的 "完成" 按钮保持中文
3. THE Agent_Widget SHALL 保持按钮样式和交互行为不变

### Requirement 2: 悬浮继续按钮

**User Story:** 作为学员，我希望在长对话后能快速找到继续按钮，而不需要滚动到顶部。

#### Acceptance Criteria

1. WHEN 用户在教学模式下滚动对话区域时，THE Agent_Widget SHALL 在对话区域右下角显示悬浮的 "继续" 按钮
2. THE 悬浮继续按钮 SHALL 仅在用户向下滚动超过一定距离（如 200px）时显示
3. WHEN 用户点击悬浮继续按钮时，THE Agent_Widget SHALL 触发与原 "继续" 按钮相同的验证和步骤切换逻辑
4. THE 悬浮继续按钮 SHALL 使用醒目的样式（如蓝色背景、圆角、阴影）
5. WHEN 用户滚动回顶部时，THE 悬浮继续按钮 SHALL 自动隐藏

### Requirement 3: 验证结果弹窗化

**User Story:** 作为学员，我希望验证结果以醒目的弹窗形式显示，方便我快速了解检查状态并采取行动。

#### Acceptance Criteria

1. WHEN 用户点击 "继续" 按钮触发验证时，THE Agent_Widget SHALL 以独立弹窗/卡片形式显示验证结果
2. THE Verification_Dialog SHALL 包含以下元素：
   - 标题："检查结果"
   - 检查项列表（显示每个检查项的状态：通过/失败）
   - 错误详情（如果有）
   - "跳过" 按钮（可选，允许用户跳过当前步骤）
   - "重新检查" 按钮（允许用户重新执行验证）
3. WHEN 验证通过时，THE Verification_Dialog SHALL 显示成功状态并自动关闭，进入下一步
4. WHEN 验证失败时，THE Verification_Dialog SHALL 保持显示，等待用户操作
5. THE Verification_Dialog SHALL 使用与 LabEx 类似的卡片样式（白色背景、圆角、阴影）
6. WHEN 用户点击弹窗外部区域时，THE Verification_Dialog SHALL 保持显示（防止误关闭）

### Requirement 4: 步骤快速导航

**User Story:** 作为学员，我希望能够快速跳转到手册的任意步骤，方便回顾之前的内容或预览后续步骤。

#### Acceptance Criteria

1. THE Agent_Widget SHALL 在 Manual_Panel 顶部显示步骤进度指示器
2. WHEN 用户点击进度指示器中的某个步骤时，THE Manual_Panel SHALL 跳转显示该步骤内容
3. THE 进度指示器 SHALL 清晰标识已完成、当前和未完成的步骤状态
4. WHEN 用户跳转到非当前步骤时，THE Agent_Widget SHALL 保持对话上下文不变

### Requirement 5: 对话区域优化

**User Story:** 作为学员，我希望对话区域能够自动滚动到最新消息，同时支持查看历史对话。

#### Acceptance Criteria

1. WHEN 新消息出现时，THE Chat_Panel SHALL 自动滚动到最新消息位置
2. WHEN 用户手动向上滚动查看历史消息时，THE Chat_Panel SHALL 暂停自动滚动
3. WHEN 用户滚动到底部时，THE Chat_Panel SHALL 恢复自动滚动行为
4. THE Chat_Panel SHALL 在用户手动滚动时显示 "回到底部" 按钮

### Requirement 6: 验证状态视觉反馈

**User Story:** 作为学员，我希望在验证过程中能看到清晰的状态反馈。

#### Acceptance Criteria

1. WHEN 验证正在进行时，THE Agent_Widget SHALL 显示加载动画和 "正在检查环境..." 提示
2. WHEN 验证完成时，THE Verification_Dialog SHALL 使用不同颜色区分成功（绿色）和失败（红色）状态
3. THE Verification_Dialog SHALL 为每个检查项显示独立的状态图标（✓ 或 ✗）
4. IF 验证失败，THEN THE Verification_Dialog SHALL 显示具体的错误信息和修复建议
