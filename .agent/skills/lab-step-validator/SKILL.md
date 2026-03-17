---
name: lab-step-validator
description: 验证 Agent EDU Lab 实训步骤的完成情况，生成步骤验证脚本，检查学生操作结果。当需要编写实训步骤验证逻辑、检查 Docker 容器内命令执行结果、判断某个实训步骤是否成功完成、生成步骤检查脚本时触发。
---

# 实训步骤验证技能

## 目标

为 Agent EDU Lab 的 AI 教师引导模式生成可执行的步骤验证脚本，确保学生操作结果能被准确检查。

## 参考示例

查看 `examples/` 目录了解不同类型步骤的验证示例：
- `examples/file-check/` — 文件存在性检查
- `examples/process-check/` — 进程运行状态检查
- `examples/api-check/` — API 接口响应检查

## 步骤验证流程

### Step 1：确认步骤类型

首先识别要验证的步骤类型：

| 步骤类型 | 检查方法 | 脚本模板 |
|---------|---------|---------|
| 文件/目录创建 | 检查路径是否存在 | `file_check.sh` |
| 命令执行 | 检查进程或日志输出 | `process_check.sh` |
| 代码编写 | 检查文件内容 | `content_check.sh` |
| 服务启动 | HTTP 健康检查 | `api_check.sh` |
| Docker 操作 | 容器状态检查 | `docker_check.sh` |
| 数据库操作 | 查询结果验证 | `db_check.sh` |

### Step 2：生成验证脚本

根据步骤描述，生成对应的 bash 验证脚本。脚本规范：
- 成功时退出码为 `0`，失败时为非零
- 输出 JSON 格式结果：`{"success": true, "message": "说明"}`
- 不使用交互式命令

### Step 3：集成到后端 API

验证结果通过 EDU_Backend 的步骤验证接口返回：

```typescript
// 验证步骤的 API 端点（EDU_Backend/src/routes/）
POST /api/lab/steps/:stepId/validate
Body: { containerId: string, userId: string }
Response: { success: boolean, message: string, nextStep?: number }
```

执行脚本的后端逻辑位于：`EDU_Backend/src/services/`

## 脚本生成规则

生成脚本时遵循以下规则：

1. **幂等性**：脚本可多次执行，结果一致
2. **超时保护**：命令执行设置合理超时（默认 10s）
3. **错误信息清晰**：失败时说明具体原因
4. **路径使用绝对路径**：避免工作目录依赖
5. **输出标准化**：始终输出 JSON

## 调用验证脚本

在后端通过 `run_command` 工具在容器内执行：

```typescript
import { exec } from 'child_process';

const validateStep = async (containerId: string, scriptPath: string) => {
  return new Promise((resolve) => {
    exec(
      `docker exec ${containerId} bash ${scriptPath}`,
      { timeout: 10000 },
      (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, message: stderr || error.message });
        } else {
          resolve(JSON.parse(stdout));
        }
      }
    );
  });
};
```

## 验证结果处理

验证通过（`success: true`）→ AI 教师展示下一步骤，更新进度
验证失败（`success: false`）→ AI 教师返回具体失败原因，引导重试

## 注意事项

- 验证脚本在学生的 Docker 容器内执行，注意安全边界
- 避免在验证脚本中执行破坏性操作
- 文件检查使用 `-f` 或 `-d` 而不是直接 `cat`
- 进程检查优先使用 `pgrep` 而非 `ps | grep`
