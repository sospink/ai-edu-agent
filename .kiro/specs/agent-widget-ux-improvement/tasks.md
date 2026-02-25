# Implementation Plan: Agent Widget UX Improvement

## Overview

本实现计划将 Agent Widget 的用户体验改进分解为可执行的任务。主要包括：按钮文案本地化、悬浮继续按钮、验证结果弹窗化。

## Tasks

- [x] 1. 按钮文案本地化
  - 将 "Continue" 改为 "继续"
  - 保持最后一步显示 "完成"
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 创建 VerificationDialog 验证结果弹窗组件
  - [x] 2.1 创建 VerificationDialog 组件文件
    - 创建 `EDU_Frontend/src/components/agent/VerificationDialog.tsx`
    - 实现弹窗基础结构：标题栏、内容区、操作按钮区
    - 实现检查项列表渲染（状态图标 + 名称 + 说明）
    - 实现错误详情展示区域
    - _Requirements: 3.1, 3.2, 3.5_

  - [x] 2.2 实现弹窗交互逻辑
    - 实现 "跳过" 按钮功能
    - 实现 "重新检查" 按钮功能
    - 点击外部区域不关闭弹窗
    - _Requirements: 3.4, 3.6_

  - [ ]* 2.3 编写 VerificationDialog 组件单元测试
    - 测试弹窗打开/关闭
    - 测试检查项列表渲染
    - 测试按钮点击回调
    - _Requirements: 3.2_

- [x] 3. 创建 FloatingContinueButton 悬浮继续按钮组件
  - [x] 3.1 创建 FloatingContinueButton 组件文件
    - 创建 `EDU_Frontend/src/components/agent/FloatingContinueButton.tsx`
    - 实现悬浮按钮样式（蓝色背景、圆角、阴影）
    - 实现加载状态显示
    - _Requirements: 2.1, 2.4_

  - [ ]* 3.2 编写 FloatingContinueButton 组件单元测试
    - 测试 visible 属性控制显示/隐藏
    - 测试 isLoading 状态下的 UI 变化
    - 测试 onClick 回调触发
    - _Requirements: 2.1, 2.3_

- [x] 4. 实现滚动行为管理 Hook
  - [x] 4.1 创建 useScrollBehavior Hook
    - 创建 `EDU_Frontend/src/components/agent/hooks/useScrollBehavior.ts`
    - 实现滚动位置监听
    - 实现悬浮按钮显示阈值判断（200px）
    - 实现用户手动滚动检测
    - _Requirements: 2.2, 2.5, 5.2_

  - [ ]* 4.2 编写 useScrollBehavior Hook 属性测试
    - **Property 1: 悬浮按钮显示逻辑**
    - **Validates: Requirements 2.1, 2.2, 2.5**

- [x] 5. 集成到 AgentWidget 主组件
  - [x] 5.1 集成 VerificationDialog 组件
    - 在 AgentWidget 中引入 VerificationDialog
    - 修改验证逻辑，使用弹窗显示结果
    - 移除原有的内嵌验证错误显示
    - _Requirements: 3.1, 3.3, 3.4_

  - [x] 5.2 集成 FloatingContinueButton 组件
    - 在 AgentWidget 中引入 FloatingContinueButton
    - 使用 useScrollBehavior Hook 控制显示
    - 绑定与原继续按钮相同的点击处理函数
    - _Requirements: 2.1, 2.3_

  - [x] 5.3 优化滚动行为
    - 实现新消息自动滚动到底部
    - 实现用户手动滚动时暂停自动滚动
    - 添加 "回到底部" 按钮（可选）
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 6. Checkpoint - 功能验证
  - 确保所有组件正常工作
  - 测试完整的验证流程
  - 确保所有测试通过，如有问题请询问用户

- [ ]* 7. 编写集成测试
  - 测试完整的验证流程（点击继续 → 显示弹窗 → 验证 → 结果展示）
  - 测试步骤切换与对话历史保持
  - 测试滚动行为与悬浮按钮联动
  - _Requirements: 2.3, 3.3, 4.4_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 优先实现核心功能：按钮本地化、验证弹窗、悬浮按钮
- 滚动优化和测试可以在后续迭代中完善
- 参考 LabEx Labby 的设计风格，保持 UI 一致性
