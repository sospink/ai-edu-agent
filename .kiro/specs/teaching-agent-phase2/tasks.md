# Implementation Plan - 教学 Agent 阶段二

## Overview

实现管理后台功能和用户体验完善，包括手册 CRUD、步骤编辑器、代码执行、AI 建议等功能。

## Tasks

- [x] 1. 管理后台 API
  - [x] 1.1 扩展 AgentController - 创建手册
    - 文件: `EDU_Backend/src/controllers/AgentController.ts`
    - 添加: createManual 方法
    - 验证 sourceType 和 sourceId 对应的课时/单元存在
    - _Requirements: 1.1, 1.5_

  - [x] 1.2 扩展 AgentController - 更新/删除手册
    - 文件: `EDU_Backend/src/controllers/AgentController.ts`
    - 添加: updateManual, deleteManual 方法
    - _Requirements: 1.2, 1.3_

  - [x] 1.3 扩展 AgentController - 批量更新步骤
    - 文件: `EDU_Backend/src/controllers/AgentController.ts`
    - 添加: updateSteps 方法
    - 实现: 删除旧步骤，插入新步骤，保持 step_order 顺序
    - _Requirements: 1.4_

  - [x] 1.4 添加管理路由
    - 文件: `EDU_Backend/src/routes/agentRoutes.ts`
    - 添加 /api/admin/agent/* 路由
    - 添加 admin 角色验证中间件
    - _Requirements: 1.6_

- [x] 2. Checkpoint - 管理 API 测试
  - 确保管理 API 无语法错误
  - 手动测试 CRUD 接口

- [x] 3. 手册编辑器组件
  - [x] 3.1 创建 AgentManualEditor 组件
    - 文件: `EDU_Frontend/src/components/admin/AgentManualEditor.tsx`
    - 实现: 加载/创建手册
    - 实现: 编辑标题、描述、发布状态
    - 实现: 步骤列表管理 (添加/删除/排序)
    - _Requirements: 2.2, 2.3, 2.4, 3.2, 3.3_

  - [x] 3.2 创建 StepEditor 组件
    - 文件: `EDU_Frontend/src/components/admin/StepEditor.tsx`
    - 实现: 编辑步骤标题
    - 实现: 内容块编辑 (可视化模式)
    - 实现: 快捷问题编辑
    - 实现: 验证规则配置
    - 实现: JSON 预览/编辑模式
    - _Requirements: 4.1-4.6_

  - [x] 3.3 创建 Admin Agent API 服务
    - 文件: `EDU_Frontend/src/services/adminAgent.ts`
    - 实现: createManual, updateManual, deleteManual, updateSteps
    - _Requirements: 1.1-1.4_

- [x] 4. 集成到课程管理
  - [x] 4.1 修改 LearningManagement
    - 文件: `EDU_Frontend/src/components/admin/LessonMaterialsModal.tsx`
    - 在课时详情 Modal 中添加 "Agent 手册" Tab
    - 集成 AgentManualEditor 组件
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. 集成到项目管理
  - [x] 5.1 修改 ProjectManagement
    - 文件: `EDU_Frontend/src/components/admin/ProjectManagement.tsx`
    - 创建 UnitAgentModal 组件
    - 在单元列表中添加 Agent 手册配置按钮
    - 集成 AgentManualEditor 组件
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Checkpoint - 管理后台测试
  - 确保手册编辑器功能正常
  - 测试创建、编辑、删除手册流程

- [x] 7. 代码执行功能
  - [x] 7.1 增强 CodeBlock 组件
    - 文件: `EDU_Frontend/src/components/agent/CodeBlock.tsx`
    - 添加: 执行按钮 (executable=true 时显示)
    - 添加: 执行状态 (loading/success/error)
    - 添加: 执行结果显示区域
    - 添加: 清除结果按钮
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

  - [x] 7.2 实现代码执行 API 调用
    - 文件: `EDU_Frontend/src/components/agent/AgentWidget.tsx`
    - 实现 onExecuteCommand 回调
    - 通过现有 TerminalService 执行命令
    - _Requirements: 5.2_

- [x] 8. 验证失败 AI 建议
  - [x] 8.1 创建 VerificationError 组件
    - 文件: `EDU_Frontend/src/components/agent/VerificationError.tsx`
    - 显示验证失败信息
    - "获取 AI 建议" 按钮
    - 显示 AI 建议内容
    - 关闭按钮
    - _Requirements: 6.1, 6.2, 6.4_

  - [x] 8.2 添加 AI 建议 API
    - 文件: `EDU_Backend/src/services/QwenService.ts`
    - 添加: getVerificationHelp 方法
    - 包含步骤上下文和验证类型
    - _Requirements: 6.3_

  - [x] 8.3 集成到 AgentWidget
    - 文件: `EDU_Frontend/src/components/agent/AgentWidget.tsx`
    - 验证失败时显示 VerificationError 组件
    - 调用 AI 建议 API
    - _Requirements: 6.1, 6.2_

- [x] 9. 进度恢复优化
  - [x] 9.1 优化 AgentWidget 进度恢复
    - 文件: `EDU_Frontend/src/components/agent/AgentWidget.tsx`
    - 组件加载时获取并恢复进度
    - 恢复当前步骤位置
    - 恢复当前步骤的聊天历史
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 9.2 优化进度自动保存
    - 文件: `EDU_Frontend/src/components/agent/AgentWidget.tsx`
    - 步骤切换时自动保存进度
    - 使用 debounce 避免频繁保存
    - _Requirements: 7.4_

- [x] 10. Final Checkpoint
  - 确保所有代码无语法错误 ✓
  - 测试完整的管理后台流程
  - 测试代码执行功能
  - 测试验证失败 AI 建议
  - 测试进度恢复功能

## Notes

- AgentManualEditor 组件在课程管理和项目管理中复用
- 代码执行复用现有的 TerminalService WebSocket 连接
- AI 建议使用非流式 API，因为内容较短
- 进度保存使用 debounce 避免频繁请求
