# 学习管理模块 API 接口文档

## 一、课程管理接口

### 1.1 获取课程列表

**GET** `/courses`

**查询参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页数量，默认 10 |
| keyword | string | 否 | 搜索关键词 |
| status | number | 否 | 状态: 0-草稿, 1-已发布, 2-下架 |
| difficulty | number | 否 | 难度: 1-初级, 2-中级, 3-高级 |

**成功响应：**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 1,
        "title": "Shell Programming",
        "slug": "shell-programming",
        "description": "Master the command line...",
        "iconUrl": "/uploads/icons/shell.png",
        "coverColor": "#64748b",
        "difficulty": 1,
        "totalLessons": 45,
        "totalSkills": 26,
        "estimatedHours": 12,
        "status": 1,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 10
  },
  "message": "获取课程列表成功"
}
```

---

### 1.2 获取单个课程 (按ID)

**GET** `/courses/:id`

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Shell Programming",
    "slug": "shell-programming",
    "description": "Master the command line...",
    "iconUrl": "/uploads/icons/shell.png",
    "coverColor": "#64748b",
    "difficulty": 1,
    "totalLessons": 45,
    "totalSkills": 26,
    "estimatedHours": 12,
    "status": 1,
    "stages": [
      {
        "id": 1,
        "courseId": 1,
        "title": "Shell Beginner",
        "description": "掌握基础命令",
        "sortOrder": 0,
        "levelLabel": "BEGINNER",
        "lessons": [
          {
            "id": 1,
            "courseId": 1,
            "stageId": 1,
            "title": "你好, Bash!",
            "type": 1,
            "durationMinutes": 10,
            "labIdentifier": "",
            "points": 10,
            "sortOrder": 0,
            "skills": [
              { "id": 1, "name": "Bash", "category": "Linux" }
            ]
          }
        ]
      }
    ]
  },
  "message": "获取课程成功"
}
```

---

### 1.3 获取单个课程 (按Slug)

**GET** `/courses/slug/:slug`

**成功响应：** 同 1.2

---

### 1.4 创建课程

**POST** `/courses`

**请求头：** `Authorization: Bearer <token>`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| title | string | 是 | 课程名称 |
| slug | string | 是 | URL Slug (唯一) |
| description | string | 否 | 课程简介 |
| iconUrl | string | 否 | 图标URL |
| coverColor | string | 否 | 主题色，默认 #3b82f6 |
| difficulty | number | 否 | 难度: 1-初级(默认), 2-中级, 3-高级 |
| status | number | 否 | 状态: 0-草稿(默认), 1-已发布, 2-下架 |
| estimatedHours | number | 否 | 预计学习时长(小时) |

**成功响应：**
```json
{
  "success": true,
  "data": { ... },
  "message": "课程创建成功"
}
```

---

### 1.5 更新课程

**PUT** `/courses/:id`

**请求头：** `Authorization: Bearer <token>`

**请求参数：** 同 1.4 (所有字段可选)

---

### 1.6 删除课程

**DELETE** `/courses/:id`

**请求头：** `Authorization: Bearer <token>`

---

### 1.7 发布/下架/设为草稿

**POST** `/courses/:id/publish` - 发布课程
**POST** `/courses/:id/archive` - 下架课程
**POST** `/courses/:id/draft` - 设为草稿

**请求头：** `Authorization: Bearer <token>`

---

## 二、阶段管理接口

### 2.1 获取课程阶段列表

**GET** `/courses/:id/stages`

---

### 2.2 创建阶段

**POST** `/courses/:id/stages`

**请求头：** `Authorization: Bearer <token>`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| title | string | 是 | 阶段名称 |
| description | string | 否 | 阶段描述 |
| sortOrder | number | 否 | 排序权重 |
| levelLabel | string | 否 | 难度标签 (如 BEGINNER) |

---

### 2.3 更新阶段

**PUT** `/courses/:id/stages/:stageId`

**请求头：** `Authorization: Bearer <token>`

---

### 2.4 删除阶段

**DELETE** `/courses/:id/stages/:stageId`

**请求头：** `Authorization: Bearer <token>`

---

### 2.5 阶段排序

**POST** `/courses/:id/stages/reorder`

**请求头：** `Authorization: Bearer <token>`

**请求参数：**
```json
{
  "orders": [
    { "id": 1, "sortOrder": 0 },
    { "id": 2, "sortOrder": 1 }
  ]
}
```


---

## 三、课时管理接口

### 3.1 获取课程所有课时

**GET** `/courses/:id/lessons`

---

### 3.2 获取阶段课时列表

**GET** `/courses/:id/stages/:stageId/lessons`

---

### 3.3 创建课时

**POST** `/courses/:id/stages/:stageId/lessons`

**请求头：** `Authorization: Bearer <token>`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| title | string | 是 | 课时标题 |
| type | number | 否 | 类型: 1-实验(默认), 2-挑战, 3-测验, 4-文本 |
| durationMinutes | number | 否 | 预计耗时(分钟)，默认 15 |
| labIdentifier | string | 否 | 关联的实验环境ID |
| points | number | 否 | 完成获得的经验值，默认 10 |
| sortOrder | number | 否 | 排序权重 |
| skillIds | number[] | 否 | 关联的技能ID数组 |

---

### 3.4 更新课时

**PUT** `/courses/:id/lessons/:lessonId`

**请求头：** `Authorization: Bearer <token>`

---

### 3.5 删除课时

**DELETE** `/courses/:id/lessons/:lessonId`

**请求头：** `Authorization: Bearer <token>`

---

### 3.6 课时排序

**POST** `/courses/:id/stages/:stageId/lessons/reorder`

**请求头：** `Authorization: Bearer <token>`

**请求参数：**
```json
{
  "orders": [
    { "id": 1, "sortOrder": 0 },
    { "id": 2, "sortOrder": 1 }
  ]
}
```

---

## 四、技能管理接口

### 4.1 获取所有技能

**GET** `/skills`

**成功响应：**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Bash", "category": "Linux" },
    { "id": 2, "name": "Grep", "category": "Linux" },
    { "id": 3, "name": "HTML", "category": "Frontend" }
  ],
  "message": "获取技能列表成功"
}
```

---

### 4.2 按分类获取技能

**GET** `/skills/category/:category`

---

### 4.3 创建技能

**POST** `/skills`

**请求头：** `Authorization: Bearer <token>`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 技能名称 (唯一) |
| category | string | 否 | 分类，默认 General |

---

### 4.4 更新技能

**PUT** `/skills/:id`

**请求头：** `Authorization: Bearer <token>`

---

### 4.5 删除技能

**DELETE** `/skills/:id`

**请求头：** `Authorization: Bearer <token>`

---

## 五、用户学习进度接口

### 5.1 获取用户所有学习记录

**GET** `/learning/enrollments`

**请求头：** `Authorization: Bearer <token>`

**成功响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 1,
      "courseId": 1,
      "status": 1,
      "progressPercent": 45,
      "completedLessonsCount": 20,
      "lastLessonId": 15,
      "lastActiveAt": "2025-01-09T10:00:00.000Z",
      "joinedAt": "2025-01-01T00:00:00.000Z",
      "completedAt": null,
      "course": {
        "id": 1,
        "title": "Shell Programming",
        "slug": "shell-programming",
        ...
      }
    }
  ],
  "message": "获取学习记录成功"
}
```

---

### 5.2 获取继续学习信息

**GET** `/learning/continue`

**请求头：** `Authorization: Bearer <token>`

**成功响应：**
```json
{
  "success": true,
  "data": {
    "enrollment": { ... },
    "course": { ... },
    "nextLesson": {
      "id": 16,
      "title": "Shell 数组与循环",
      "type": 1,
      "durationMinutes": 30,
      "points": 20
    }
  },
  "message": "获取继续学习信息成功"
}
```

---

### 5.3 加入课程

**POST** `/courses/:id/enroll`

**请求头：** `Authorization: Bearer <token>`

---

### 5.4 获取用户在课程的学习记录

**GET** `/courses/:id/progress`

**请求头：** `Authorization: Bearer <token>`

---

### 5.5 开始学习课时

**POST** `/courses/lessons/:lessonId/start`

**请求头：** `Authorization: Bearer <token>`

---

### 5.6 完成课时

**POST** `/courses/lessons/:lessonId/complete`

**请求头：** `Authorization: Bearer <token>`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| score | number | 否 | 得分 |

---

### 5.7 获取用户活跃度/热力图数据

**GET** `/learning/activity`

**请求头：** `Authorization: Bearer <token>`

**查询参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| days | number | 否 | 查询天数，默认 365 |

**成功响应：**
```json
{
  "success": true,
  "data": [
    { "id": 1, "userId": 1, "activityDate": "2025-01-01", "contributionCount": 3 },
    { "id": 2, "userId": 1, "activityDate": "2025-01-02", "contributionCount": 5 }
  ],
  "message": "获取活跃记录成功"
}
```

---

## 六、枚举值说明

### 课程难度 (difficulty)

| 值 | 说明 |
|----|------|
| 1 | 初级 (Beginner) |
| 2 | 中级 (Intermediate) |
| 3 | 高级 (Advanced) |

### 课程状态 (status)

| 值 | 说明 |
|----|------|
| 0 | 草稿 (Draft) |
| 1 | 已发布 (Published) |
| 2 | 下架 (Archived) |

### 课时类型 (type)

| 值 | 说明 |
|----|------|
| 1 | 实验 (Lab) |
| 2 | 挑战 (Challenge) |
| 3 | 测验 (Quiz) |
| 4 | 文本 (Text) |

### 学习状态 (EnrollmentStatus)

| 值 | 说明 |
|----|------|
| 1 | 进行中 (In Progress) |
| 2 | 已完成 (Completed) |

### 课时学习状态 (LessonRecordStatus)

| 值 | 说明 |
|----|------|
| 0 | 未开始 (Not Started) |
| 1 | 进行中 (In Progress) |
| 2 | 已完成 (Completed) |

### 学习资料类型 (MaterialType)

| 值 | 说明 |
|----|------|
| 1 | Markdown 文档 |
| 2 | PDF 文件 |
| 3 | 思维导图 (XMind, FreeMind 等) |

---

## 七、课时学习资料接口

### 7.1 获取课时学习资料列表

**GET** `/courses/lessons/:lessonId/materials`

**成功响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "lessonId": 10,
      "title": "Shell 基础语法",
      "type": 1,
      "fileUrl": "/uploads/materials/1736582400-abc123.md",
      "fileName": "shell-basics.md",
      "fileSize": 15360,
      "sortOrder": 0,
      "createdAt": "2025-01-11T10:00:00.000Z",
      "updatedAt": "2025-01-11T10:00:00.000Z"
    }
  ],
  "message": "获取学习资料成功"
}
```

---

### 7.2 上传学习资料

**POST** `/courses/lessons/:lessonId/materials`

**请求头：** 
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| material | File | 是 | 上传的文件 (支持 .md, .pdf, .xmind, .mm) |
| title | string | 否 | 资料标题，默认使用文件名 |
| sortOrder | number | 否 | 排序权重 |

**注意：** 只有知识型课时 (type=4) 才能添加学习资料

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "lessonId": 10,
    "title": "Shell 基础语法",
    "type": 1,
    "fileUrl": "/uploads/materials/1736582400-abc123.md",
    "fileName": "shell-basics.md",
    "fileSize": 15360,
    "sortOrder": 0,
    "createdAt": "2025-01-11T10:00:00.000Z",
    "updatedAt": "2025-01-11T10:00:00.000Z"
  },
  "message": "学习资料上传成功"
}
```

---

### 7.3 更新学习资料

**PUT** `/courses/materials/:materialId`

**请求头：** `Authorization: Bearer <token>`

**请求参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| title | string | 否 | 资料标题 |
| sortOrder | number | 否 | 排序权重 |

---

### 7.4 删除学习资料

**DELETE** `/courses/materials/:materialId`

**请求头：** `Authorization: Bearer <token>`

**注意：** 删除资料时会同时删除服务器上的物理文件

---

### 7.5 学习资料排序

**POST** `/courses/lessons/:lessonId/materials/reorder`

**请求头：** `Authorization: Bearer <token>`

**请求参数：**
```json
{
  "orders": [
    { "id": 1, "sortOrder": 0 },
    { "id": 2, "sortOrder": 1 }
  ]
}
```

---

## 八、统一响应格式

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
| 401 | 未授权/认证失败 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
