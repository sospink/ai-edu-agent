---
name: api-route-scaffolder
description: 为 Agent EDU Lab 后端快速生成 Express + TypeORM 的 API 路由、Controller 和 Service 代码。当需要为新功能添加 API 端点、创建新的 Controller 方法、生成符合项目规范的路由文件时触发。遵循 EDU_Backend 项目的 TypeScript + Express 代码规范。
---

# EDU_Backend API 路由脚手架

## 目标

按照 EDU_Backend 项目现有代码规范，快速生成完整的 Route → Controller → Service 三层结构代码。

## 项目技术栈

- **语言**：TypeScript
- **框架**：Express.js
- **ORM**：TypeORM + MySQL
- **认证**：JWT（`authMiddleware` / `optionalAuthMiddleware`）
- **日志**：winston

## 代码参考

阅读模板了解项目规范：
→ `resources/route-pattern.ts` — 路由文件规范
→ `resources/controller-pattern.ts` — Controller 规范
→ `resources/service-pattern.ts` — Service 规范

## 生成步骤

### Step 1：分析需求

确认以下信息：
- 新功能名称（如：`notification`、`progress`）
- 需要哪些 CRUD 端点
- 是否需要认证保护
- 对应的数据库实体（Entity）是否已存在

### Step 2：文件命名规范

| 文件类型 | 命名规范 | 存放路径 |
|---------|---------|---------|
| 路由文件 | `[name]Routes.ts` | `src/routes/` |
| Controller | `[Name]Controller.ts` | `src/controllers/` |
| Service | `[Name]Service.ts` | `src/services/` |
| Entity | `[Name].ts` | `src/models/` |

例如：`notification` → `notificationRoutes.ts` + `NotificationController.ts` + `NotificationService.ts`

### Step 3：生成路由文件

遵循项目路由模式（参见 `resources/route-pattern.ts`）：
- 使用 `Router()` 创建路由实例
- 公开接口无需中间件
- 写操作加 `authMiddleware`
- 路由分区使用注释标记

### Step 4：生成 Controller

遵循项目 Controller 模式：
- 类名使用 `[Name]Controller`
- 方法参数为 `(req: Request, res: Response)`
- 使用 `try/catch` 统一处理错误
- 成功响应格式：`res.json({ success: true, data: ... })`
- 错误响应格式：`res.status(500).json({ success: false, error: message })`

### Step 5：注册路由

在 `src/routes/index.ts` 中添加新路由：

```typescript
import [name]Routes from './[name]Routes';
// 在 router 注册处添加：
router.use('/[name]s', [name]Routes);
```

### Step 6：验证生成的代码

运行以下验证：

```bash
cd EDU_Backend
npm run lint         # 检查 TypeScript 类型和 ESLint 规则
npm run build        # 确认编译无错误
```

## 常见 API 端点模式

| 操作 | HTTP 方法 | 路径 | 认证 |
|------|---------|------|------|
| 获取列表 | GET | `/api/[resources]` | 可选 |
| 获取单个 | GET | `/api/[resources]/:id` | 可选 |
| 创建 | POST | `/api/[resources]` | 必须 |
| 更新 | PUT | `/api/[resources]/:id` | 必须 |
| 删除 | DELETE | `/api/[resources]/:id` | 必须 |
| 特定操作 | POST | `/api/[resources]/:id/[action]` | 必须 |

## 项目特有规范

1. **路由分区注释**：使用 `// ==================== 分区名称 ====================`
2. **Controller 方法绑定**：`router.get('/', (req, res) => controller.getAll(req, res))`（箭头函数包装，避免 `this` 丢失）
3. **认证中间件**：`authMiddleware`（强制登录）或 `optionalAuthMiddleware`（可选登录）
4. **文件上传**：使用 `uploadMaterial` 中间件（参考 `courseRoutes.ts`）

## 注意事项

- 生成代码后务必运行 `npm run lint` 检查
- TypeORM Repository 模式已在项目中统一使用
- 避免在 Controller 中直接写 SQL，业务逻辑放到 Service
- 新增 Entity 后需要在 `src/config/database.ts` 中注册
