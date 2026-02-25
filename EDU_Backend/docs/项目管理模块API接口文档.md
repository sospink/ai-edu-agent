# 项目管理模块 API 接口文档

> Base URL: `http://localhost:4000/api`

---

## 一、项目管理接口

### 1.1 获取项目列表

**GET** `/projects`

**请求参数 (Query)：**

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| page | number | 否 | 1 | 页码 |
| pageSize | number | 否 | 10 | 每页数量 |
| keyword | string | 否 | - | 搜索关键词(标题/Slug/简介) |
| status | number | 否 | - | 状态筛选: 0-草稿, 1-已发布, 2-下架 |
| difficulty | number | 否 | - | 难度筛选: 1-初级, 2-中级, 3-高级 |
| tagId | number | 否 | - | 标签ID筛选 |

**请求示例：**
```
GET /api/projects?page=1&pageSize=10&status=1&difficulty=2
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 1,
        "title": "Vue.js 基础与响应式原理",
        "slug": "vue-essentials",
        "subtitle": "掌握 Vue 3 核心概念",
        "coverUrl": "/uploads/images/xxx.jpg",
        "difficulty": 1,
        "status": 1,
        "description": "...",
        "learningGoals": ["目标1", "目标2"],
        "prerequisites": ["前置知识1"],
        "labsCount": 5,
        "challengesCount": 2,
        "studentsCount": 1204,
        "createdBy": 1,
        "createdAt": "2026-01-09T10:00:00.000Z",
        "updatedAt": "2026-01-09T10:00:00.000Z",
        "tags": [
          { "id": 1, "name": "Vue.js", "styleColor": "#42B883" },
          { "id": 2, "name": "Frontend", "styleColor": "#3B82F6" }
        ]
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  },
  "message": "获取项目列表成功"
}
```

---

### 1.2 获取单个项目 (按ID)

**GET** `/projects/:id`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 项目ID |

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Vue.js 基础与响应式原理",
    "slug": "vue-essentials",
    "subtitle": "掌握 Vue 3 核心概念",
    "coverUrl": "/uploads/images/xxx.jpg",
    "difficulty": 1,
    "status": 1,
    "description": "项目详细介绍...",
    "learningGoals": ["目标1", "目标2"],
    "prerequisites": ["前置知识1"],
    "labsCount": 5,
    "challengesCount": 2,
    "studentsCount": 1204,
    "createdBy": 1,
    "createdAt": "2026-01-09T10:00:00.000Z",
    "updatedAt": "2026-01-09T10:00:00.000Z",
    "tags": [
      { "id": 1, "name": "Vue.js", "styleColor": "#42B883" }
    ],
    "units": [
      {
        "id": 1,
        "projectId": 1,
        "title": "环境搭建",
        "description": "搭建开发环境",
        "type": 1,
        "modeGroup": 1,
        "envId": "",
        "timeLimit": 15,
        "points": 10,
        "sortOrder": 0,
        "isHidden": 0
      }
    ]
  },
  "message": "获取项目成功"
}
```

---

### 1.3 获取单个项目 (按Slug)

**GET** `/projects/slug/:slug`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| slug | string | 是 | 项目Slug |

**成功响应：** 同 1.2

---

### 1.4 创建项目

**POST** `/projects`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| title | string | 是 | 项目名称 |
| slug | string | 是 | URL Slug (唯一) |
| subtitle | string | 否 | 一句话简介 |
| coverUrl | string | 否 | 封面图URL |
| difficulty | number | 否 | 难度: 1-初级(默认), 2-中级, 3-高级 |
| status | number | 否 | 状态: 0-草稿(默认), 1-已发布, 2-下架 |
| description | string | 否 | 项目详细介绍 |
| learningGoals | string[] | 否 | 学习目标数组 |
| prerequisites | string[] | 否 | 前置知识数组 |
| tagIds | number[] | 否 | 关联标签ID数组 |

**请求示例：**
```json
{
  "title": "Vue.js 基础与响应式原理",
  "slug": "vue-essentials",
  "subtitle": "掌握 Vue 3 核心概念",
  "coverUrl": "/uploads/images/xxx.jpg",
  "difficulty": 1,
  "status": 0,
  "description": "深入浅出讲解 Vue.js 基础...",
  "learningGoals": ["理解响应式原理", "掌握组件通信"],
  "prerequisites": ["HTML/CSS基础", "JavaScript基础"],
  "tagIds": [1, 2]
}
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Vue.js 基础与响应式原理",
    "slug": "vue-essentials",
    ...
  },
  "message": "项目创建成功"
}
```

---

### 1.5 更新项目

**PUT** `/projects/:id`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 项目ID |

**请求参数：** 同创建项目，所有字段均为可选

**成功响应：**
```json
{
  "success": true,
  "data": { ... },
  "message": "项目更新成功"
}
```

---

### 1.6 删除项目

**DELETE** `/projects/:id`

> 软删除，设置 deleted_at 字段

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 项目ID |

**成功响应：**
```json
{
  "success": true,
  "data": null,
  "message": "项目删除成功"
}
```

---

### 1.7 发布项目

**PUT** `/projects/:id/publish`

**成功响应：**
```json
{
  "success": true,
  "data": { ... },
  "message": "项目已发布"
}
```

---

### 1.8 下架项目

**PUT** `/projects/:id/archive`

**成功响应：**
```json
{
  "success": true,
  "data": { ... },
  "message": "项目已下架"
}
```

---

### 1.9 设为草稿

**PUT** `/projects/:id/draft`

**成功响应：**
```json
{
  "success": true,
  "data": { ... },
  "message": "项目已设为草稿"
}
```

---

## 二、项目单元接口

### 2.1 获取项目单元列表

**GET** `/projects/:id/units`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 项目ID |

**成功响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "projectId": 1,
      "title": "环境搭建",
      "description": "搭建开发环境",
      "type": 1,
      "modeGroup": 1,
      "envId": "",
      "timeLimit": 15,
      "points": 10,
      "sortOrder": 0,
      "isHidden": 0,
      "createdAt": "2026-01-09T10:00:00.000Z",
      "updatedAt": "2026-01-09T10:00:00.000Z"
    }
  ],
  "message": "获取单元列表成功"
}
```

---

### 2.2 创建项目单元

**POST** `/projects/:id/units`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 项目ID |

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| title | string | 是 | 单元标题 |
| description | string | 否 | 单元简述 |
| type | number | 否 | 类型: 1-实验(默认), 2-挑战 |
| modeGroup | number | 否 | 分组: 1-Guided(默认), 2-Challenge |
| envId | string | 否 | 实验环境ID |
| timeLimit | number | 否 | 建议时长(分钟)，默认45 |
| points | number | 否 | 完成奖励积分，默认0 |
| sortOrder | number | 否 | 排序权重，默认0 |
| isHidden | number | 否 | 是否隐藏: 0-否(默认), 1-是 |

**请求示例：**
```json
{
  "title": "环境搭建",
  "description": "搭建 Vue.js 开发环境",
  "type": 1,
  "modeGroup": 1,
  "timeLimit": 15,
  "points": 10,
  "sortOrder": 0
}
```

**成功响应：**
```json
{
  "success": true,
  "data": { ... },
  "message": "单元创建成功"
}
```

---

### 2.3 更新项目单元

**PUT** `/projects/:id/units/:unitId`

**路径参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | number | 是 | 项目ID |
| unitId | number | 是 | 单元ID |

**请求参数：** 同创建单元，所有字段均为可选

**成功响应：**
```json
{
  "success": true,
  "data": { ... },
  "message": "单元更新成功"
}
```

---

### 2.4 删除项目单元

**DELETE** `/projects/:id/units/:unitId`

**成功响应：**
```json
{
  "success": true,
  "data": null,
  "message": "单元删除成功"
}
```

---

### 2.5 重新排序单元

**PUT** `/projects/:id/units/reorder`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| orders | array | 是 | 排序数组 |

**请求示例：**
```json
{
  "orders": [
    { "id": 1, "sortOrder": 0 },
    { "id": 2, "sortOrder": 1 },
    { "id": 3, "sortOrder": 2 }
  ]
}
```

**成功响应：**
```json
{
  "success": true,
  "data": [ ... ],
  "message": "单元排序更新成功"
}
```

---

## 三、标签管理接口

### 3.1 获取所有标签

**GET** `/tags`

**成功响应：**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Vue.js", "styleColor": "#42B883", "createdAt": "..." },
    { "id": 2, "name": "React", "styleColor": "#61DAFB", "createdAt": "..." }
  ],
  "message": "获取标签列表成功"
}
```

---

### 3.2 创建标签

**POST** `/tags`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 标签名称 (唯一) |
| styleColor | string | 否 | 标签颜色，默认 #3B82F6 |

**请求示例：**
```json
{
  "name": "Vue.js",
  "styleColor": "#42B883"
}
```

**成功响应：**
```json
{
  "success": true,
  "data": { "id": 1, "name": "Vue.js", "styleColor": "#42B883" },
  "message": "标签创建成功"
}
```

---

### 3.3 更新标签

**PUT** `/tags/:id`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 否 | 标签名称 |
| styleColor | string | 否 | 标签颜色 |

**成功响应：**
```json
{
  "success": true,
  "data": { ... },
  "message": "标签更新成功"
}
```

---

### 3.4 删除标签

**DELETE** `/tags/:id`

> 会同时删除项目与该标签的关联

**成功响应：**
```json
{
  "success": true,
  "data": null,
  "message": "标签删除成功"
}
```

---

## 四、文件上传接口

### 4.1 上传单个图片

**POST** `/upload/image`

**请求格式：** `multipart/form-data`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| image | file | 是 | 图片文件 (JPEG/PNG/GIF/WebP/SVG) |

**限制：**
- 文件大小: 最大 5MB
- 文件类型: image/jpeg, image/png, image/gif, image/webp, image/svg+xml

**成功响应：**
```json
{
  "success": true,
  "data": {
    "url": "/uploads/images/1704787200000-abc123.jpg",
    "filename": "1704787200000-abc123.jpg",
    "originalname": "cover.jpg",
    "size": 102400,
    "mimetype": "image/jpeg"
  },
  "message": "图片上传成功"
}
```

---

### 4.2 上传多个图片

**POST** `/upload/images`

**请求格式：** `multipart/form-data`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| images | file[] | 是 | 图片文件数组 (最多10个) |

**成功响应：**
```json
{
  "success": true,
  "data": [
    { "url": "/uploads/images/xxx.jpg", "filename": "xxx.jpg", ... },
    { "url": "/uploads/images/yyy.jpg", "filename": "yyy.jpg", ... }
  ],
  "message": "图片上传成功"
}
```

---

### 4.3 上传通用文件

**POST** `/upload/file`

**请求格式：** `multipart/form-data`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| file | file | 是 | 任意文件 |

**限制：**
- 文件大小: 最大 50MB

**成功响应：**
```json
{
  "success": true,
  "data": {
    "url": "/uploads/files/1704787200000-abc123.pdf",
    "filename": "1704787200000-abc123.pdf",
    "originalname": "document.pdf",
    "size": 1024000,
    "mimetype": "application/pdf"
  },
  "message": "文件上传成功"
}
```

---

### 4.4 删除文件

**DELETE** `/upload/file`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| filePath | string | 是 | 文件路径 (必须以 /uploads/ 开头) |

**请求示例：**
```json
{
  "filePath": "/uploads/images/1704787200000-abc123.jpg"
}
```

**成功响应：**
```json
{
  "success": true,
  "data": null,
  "message": "文件删除成功"
}
```

---

## 五、枚举值说明

### 项目难度 (difficulty)

| 值 | 说明 |
|----|------|
| 1 | 初级 (Beginner) |
| 2 | 中级 (Intermediate) |
| 3 | 高级 (Advanced) |

### 项目状态 (status)

| 值 | 说明 |
|----|------|
| 0 | 草稿 (Draft) |
| 1 | 已发布 (Published) |
| 2 | 下架 (Archived) |

### 单元类型 (type)

| 值 | 说明 |
|----|------|
| 1 | 实验 (Lab) |
| 2 | 挑战 (Challenge) |

### 模式分组 (modeGroup)

| 值 | 说明 |
|----|------|
| 1 | Guided Mode |
| 2 | Challenge Mode |

---

## 六、文件访问

上传的文件可通过以下 URL 访问：

- 图片: `http://localhost:4000/uploads/images/{filename}`
- 文件: `http://localhost:4000/uploads/files/{filename}`

**注意：** 数据库中存储的是相对路径 `/uploads/images/xxx.jpg`，前端使用时需要拼接完整的服务器地址。
