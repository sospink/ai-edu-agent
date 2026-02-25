# 用户管理模块 API 接口文档

> Base URL: `http://localhost:4000/api`

---

## 认证说明

本系统使用 JWT (JSON Web Token) 进行身份认证。

### Token 使用方式

登录成功后会返回 `token`，后续请求需要在 Header 中携带：

```
Authorization: Bearer <token>
```

### Token 有效期

- 默认有效期：7 天
- 过期后需要重新登录或调用刷新接口

---

## 一、认证接口

### 1.1 用户登录

**POST** `/auth/login`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| username | string | 是 | 用户名或邮箱 |
| password | string | 是 | 密码 |

**请求示例：**
```json
{
  "username": "admin",
  "password": "admin@123"
}
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@edu.com",
      "phone": "",
      "studentId": "",
      "fullName": "系统管理员",
      "avatarUrl": "",
      "bio": "",
      "githubLink": "",
      "roleType": 10,
      "status": 1,
      "createdAt": "2026-01-08T10:00:00.000Z",
      "updatedAt": "2026-01-08T10:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "登录成功"
}
```

**错误响应：**
```json
{
  "success": false,
  "error": "用户名或密码错误"
}
```

---

### 1.2 退出登录

**POST** `/auth/logout`

**请求头：**
```
Authorization: Bearer <token>
```

**成功响应：**
```json
{
  "success": true,
  "data": null,
  "message": "退出登录成功"
}
```

---

### 1.3 获取当前用户信息

**GET** `/auth/me`

**请求头：**
```
Authorization: Bearer <token>
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@edu.com",
    "phone": "",
    "studentId": "",
    "fullName": "系统管理员",
    "avatarUrl": "",
    "bio": "",
    "githubLink": "",
    "roleType": 10,
    "status": 1,
    "createdAt": "2026-01-08T10:00:00.000Z",
    "updatedAt": "2026-01-08T10:00:00.000Z"
  },
  "message": "获取用户信息成功"
}
```

---

### 1.4 刷新 Token

**POST** `/auth/refresh`

**请求头：**
```
Authorization: Bearer <token>
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Token 刷新成功"
}
```

---

## 二、用户管理接口

### 2.1 获取用户列表

**GET** `/users`

**请求参数 (Query)：**

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| page | number | 否 | 1 | 页码 |
| pageSize | number | 否 | 10 | 每页数量 |
| keyword | string | 否 | - | 搜索关键词(用户名/邮箱/姓名/学号) |
| roleType | number | 否 | - | 角色筛选: 1-学生, 2-教师, 10-管理员 |
| status | number | 否 | - | 状态筛选: 1-正常, 2-冻结, 3-注销 |

**请求示例：**
```
GET /api/users?page=1&pageSize=10&keyword=张&roleType=1
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 2,
        "username": "zhangsan",
        "email": "zhangsan@edu.com",
        "phone": "13800138000",
        "studentId": "2024001",
        "fullName": "张三",
        "avatarUrl": "",
        "bio": "",
        "githubLink": "",
        "roleType": 1,
        "status": 1,
        "createdAt": "2026-01-08T10:00:00.000Z",
        "updatedAt": "2026-01-08T10:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  },
  "message": "获取用户列表成功"
}
```

---

### 2.2 获取单个用户

**GET** `/users/:id`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 用户ID |

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@edu.com",
    "phone": "",
    "studentId": "",
    "fullName": "系统管理员",
    "avatarUrl": "",
    "bio": "",
    "githubLink": "",
    "roleType": 10,
    "status": 1,
    "createdAt": "2026-01-08T10:00:00.000Z",
    "updatedAt": "2026-01-08T10:00:00.000Z"
  },
  "message": "获取用户成功"
}
```

---

### 2.3 创建用户

**POST** `/users`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| username | string | 是 | 用户名 (唯一) |
| email | string | 是 | 邮箱 (唯一) |
| password | string | 是 | 密码 |
| phone | string | 否 | 手机号 |
| studentId | string | 否 | 学号/工号 |
| fullName | string | 否 | 真实姓名 |
| avatarUrl | string | 否 | 头像URL |
| bio | string | 否 | 个人简介 |
| githubLink | string | 否 | GitHub链接 |
| roleType | number | 否 | 角色: 1-学生(默认), 2-教师, 10-管理员 |

**请求示例：**
```json
{
  "username": "zhangsan",
  "email": "zhangsan@edu.com",
  "password": "123456",
  "phone": "13800138000",
  "studentId": "2024001",
  "fullName": "张三",
  "roleType": 1
}
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "username": "zhangsan",
    "email": "zhangsan@edu.com",
    "roleType": 1,
    "status": 1
  },
  "message": "用户创建成功"
}
```

---

### 2.4 更新用户

**PUT** `/users/:id`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 用户ID |

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| phone | string | 否 | 手机号 |
| studentId | string | 否 | 学号/工号 |
| fullName | string | 否 | 真实姓名 |
| avatarUrl | string | 否 | 头像URL |
| bio | string | 否 | 个人简介 |
| githubLink | string | 否 | GitHub链接 |
| roleType | number | 否 | 角色类型 |
| status | number | 否 | 状态 |

**请求示例：**
```json
{
  "fullName": "张三丰",
  "bio": "热爱编程的学生"
}
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "username": "zhangsan",
    "fullName": "张三丰",
    "bio": "热爱编程的学生"
  },
  "message": "用户更新成功"
}
```

---

### 2.5 删除用户

**DELETE** `/users/:id`

> 软删除，将用户状态设为"注销"

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 用户ID |

**成功响应：**
```json
{
  "success": true,
  "data": null,
  "message": "用户删除成功"
}
```

---

### 2.6 修改密码

**PUT** `/users/:id/password`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 用户ID |

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| oldPassword | string | 是 | 旧密码 |
| newPassword | string | 是 | 新密码 |

**请求示例：**
```json
{
  "oldPassword": "123456",
  "newPassword": "654321"
}
```

**成功响应：**
```json
{
  "success": true,
  "data": null,
  "message": "密码修改成功"
}
```

---

### 2.7 冻结用户

**PUT** `/users/:id/freeze`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 用户ID |

**成功响应：**
```json
{
  "success": true,
  "data": null,
  "message": "用户已冻结"
}
```

---

### 2.8 激活用户

**PUT** `/users/:id/activate`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 用户ID |

**成功响应：**
```json
{
  "success": true,
  "data": null,
  "message": "用户已激活"
}
```

---

## 三、枚举值说明

### 角色类型 (roleType)

| 值 | 说明 |
|----|------|
| 1 | 学生 |
| 2 | 教师 |
| 10 | 管理员 |

### 用户状态 (status)

| 值 | 说明 |
|----|------|
| 1 | 正常 (Active) |
| 2 | 冻结 |
| 3 | 注销 |

---

## 四、统一响应格式

### 成功响应
```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误信息"
}
```

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未授权/认证失败/Token无效 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 五、默认管理员账号

系统启动时会自动初始化默认管理员：

- 用户名：`admin`
- 密码：`admin@123`
- 邮箱：`admin@edu.com`

---

## 六、前端认证流程

### 登录流程

1. 调用 `POST /auth/login` 获取 token
2. 将 token 存储到 localStorage
3. 后续请求在 Header 中携带 `Authorization: Bearer <token>`

### 退出登录流程

1. 调用 `POST /auth/logout`
2. 清除 localStorage 中的 token 和用户信息
3. 跳转到首页或登录页

### Token 过期处理

1. 当接口返回 401 状态码时，清除本地 token
2. 跳转到登录页重新登录
3. 或调用 `POST /auth/refresh` 刷新 token
