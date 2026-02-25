# Implementation Plan - 教学 Agent 阶段一

## Overview

实现教学 Agent 后端核心功能，包括数据模型、AI 问答、步骤验证，以及前端基础对接。

## Tasks

- [x] 1. 创建数据模型
  - [x] 1.1 创建 AgentManual 实体
    - 文件: `EDU_Backend/src/models/AgentManual.ts`
    - 包含: id, source_type, source_id, title, description, is_published, timestamps
    - 添加 OneToMany 关系到 AgentStep
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 创建 AgentStep 实体
    - 文件: `EDU_Backend/src/models/AgentStep.ts`
    - 包含: id, manual_id, step_order, title, content(JSON), quick_questions(JSON), verification(JSON nullable)
    - 添加 ManyToOne 关系到 AgentManual，设置 CASCADE 删除
    - _Requirements: 1.3, 1.5_

  - [x] 1.3 创建 UserAgentProgress 实体
    - 文件: `EDU_Backend/src/models/UserAgentProgress.ts`
    - 包含: id, user_id, manual_id, current_step, completed_steps(JSON), chat_history(JSON), timestamps
    - _Requirements: 1.4_

  - [x] 1.4 注册实体到 TypeORM 配置
    - 文件: `EDU_Backend/src/config/database.ts`
    - 将三个新实体添加到 entities 数组
    - _Requirements: 1.1-1.4_

- [x] 2. 实现通义千问服务
  - [x] 2.1 安装 openai 依赖
    - 运行: `npm install openai`
    - _Requirements: 2.1_

  - [x] 2.2 创建 QwenService
    - 文件: `EDU_Backend/src/services/QwenService.ts`
    - 实现: chat (非流式), chatStream (流式), explainCode
    - 使用 OpenAI 兼容协议
    - 包含 system prompt 构建逻辑
    - _Requirements: 2.1-2.6_

- [x] 3. 实现验证服务
  - [x] 3.1 创建 VerificationService
    - 文件: `EDU_Backend/src/services/VerificationService.ts`
    - 实现: verify 主函数
    - 实现: verifyFileExists, verifyCommandOutput, verifyServiceRunning, verifyCustomScript
    - 复用现有 docker 工具执行命令
    - _Requirements: 3.1-3.6_

- [x] 4. 实现 Agent 业务服务
  - [x] 4.1 创建 AgentService
    - 文件: `EDU_Backend/src/services/AgentService.ts`
    - 实现: getManual (含 steps 关联查询)
    - 实现: getProgress, updateProgress
    - 实现: verifyStep (调用 VerificationService)
    - _Requirements: 4.1, 4.6, 4.7_

- [x] 5. 实现 API 控制器和路由
  - [x] 5.1 创建 AgentController
    - 文件: `EDU_Backend/src/controllers/AgentController.ts`
    - 实现: getManual, verifyStep, chat, chatStream, explainCode, getProgress, updateProgress
    - _Requirements: 4.1-4.7_

  - [x] 5.2 创建 Agent 路由
    - 文件: `EDU_Backend/src/routes/agentRoutes.ts`
    - 定义所有 Agent API 路由
    - 添加 JWT 认证中间件
    - _Requirements: 4.8_

  - [x] 5.3 注册路由到主应用
    - 文件: `EDU_Backend/src/index.ts`
    - 挂载 /api/agent 路由
    - _Requirements: 4.1-4.8_

- [ ] 6. Checkpoint - 后端测试
  - 确保所有后端代码无语法错误
  - 手动测试 API 接口
  - 确认数据库表已创建

- [x] 7. 前端 AgentWidget 对接
  - [x] 7.1 创建 Agent API 服务
    - 文件: `EDU_Frontend/src/services/agent.ts`
    - 实现: getManual, verifyStep, chat, explainCode, getProgress, updateProgress (复用 api.ts 模式)
    - 实现: chatStream (单独实现 SSE 流式请求，使用 fetch + ReadableStream)
    - 注意: SSE 流式请求需要手动处理 Authorization header 和响应解析
    - _Requirements: 5.1-5.6_

  - [x] 7.2 修改 AgentWidget 加载逻辑
    - 文件: `EDU_Frontend/src/components/agent/AgentWidget.tsx`
    - 添加 props: sourceType, sourceId, containerId
    - 添加 useEffect 从 API 加载手册数据
    - 添加 loading 状态显示
    - _Requirements: 5.1, 5.2_

  - [x] 7.3 修改 AgentWidget 验证逻辑
    - 文件: `EDU_Frontend/src/components/agent/AgentWidget.tsx`
    - handleContinue 改为调用 verifyStep API
    - 显示验证失败错误信息
    - _Requirements: 5.3, 5.6_

  - [x] 7.4 修改 AgentWidget AI 问答
    - 文件: `EDU_Frontend/src/components/agent/AgentWidget.tsx`
    - handleQuestion 改为调用 chatStream API
    - 实现流式显示回答
    - _Requirements: 5.4_

  - [x] 7.5 修改 AgentWidget 进度保存
    - 文件: `EDU_Frontend/src/components/agent/AgentWidget.tsx`
    - 步骤切换时调用 updateProgress API
    - 组件加载时恢复进度
    - _Requirements: 5.5_

- [ ] 8. Final Checkpoint
  - 确保所有代码无语法错误
  - 确保前后端联调正常
  - 确保 AI 问答流式输出正常
  - 确保步骤验证功能正常

## Notes

- 复用现有的 Docker 工具 (`EDU_Backend/src/utils/docker.ts`) 执行容器命令
- 复用现有的 JWT 认证中间件
- 验证只在用户点击 Continue 时触发，verification 为 null 时直接放行
- AI 问答使用 SSE 流式输出，提升用户体验
