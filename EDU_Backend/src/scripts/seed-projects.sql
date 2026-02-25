-- ==========================================
-- 项目数据种子脚本 (SQL 版本)
-- 创建三个演示项目：Shell脚本入门、Python数据处理、Vue待办应用
-- ==========================================

-- 1. 创建标签
INSERT INTO tags (name, style_color, created_at) VALUES
('Shell', '#4EAA25', NOW()),
('Linux', '#FCC624', NOW()),
('自动化', '#FF6B6B', NOW()),
('入门', '#10B981', NOW()),
('Python', '#3776AB', NOW()),
('数据处理', '#F59E0B', NOW()),
('JSON', '#000000', NOW()),
('Vue', '#42B883', NOW()),
('前端', '#61DAFB', NOW()),
('JavaScript', '#F7DF1E', NOW())
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2. 创建项目1: Shell脚本入门
INSERT INTO projects (
  title, slug, subtitle, cover_url, difficulty, status, description,
  learning_goals, prerequisites, labs_count, challenges_count,
  env_image, ide_image, created_by, created_at, updated_at
) VALUES (
  'Shell 脚本入门',
  'shell-intro',
  '从零开始学习 Shell 脚本编程，掌握 Linux 自动化技能',
  '/images/projects/shell-intro.png',
  1, -- BEGINNER
  1, -- PUBLISHED
  '## 📖 项目背景

在现代软件开发和运维工作中，**Shell 脚本**是一项不可或缺的技能。无论是自动化部署、日志分析、系统监控，还是日常的文件批处理，Shell 脚本都能大幅提升工作效率。

### 🎯 为什么要学习 Shell 脚本？

1. **自动化运维** - 服务器管理、定时任务、批量操作
2. **开发效率** - 构建脚本、测试自动化、环境配置
3. **数据处理** - 日志分析、文本处理、数据转换
4. **跨平台** - Linux、macOS、WSL 通用技能

### 🛠️ 项目内容

本项目将带您从零开始学习 Shell 脚本编程：

- **变量与数据类型** - 学习如何定义和使用变量
- **条件判断** - 掌握 if/else 语句的使用
- **循环结构** - 学会 for 和 while 循环
- **函数封装** - 编写可复用的函数
- **实战项目** - 创建一个系统信息查看脚本

### 💡 学习成果

完成本项目后，您将能够：

- 独立编写 Shell 脚本解决实际问题
- 理解 Linux 命令行的工作原理
- 具备自动化运维的基础能力
- 为学习更高级的 DevOps 技能打下基础

### 📋 适合人群

- Linux/Mac 用户
- 想要学习自动化的初学者
- 对命令行操作感兴趣的开发者
- 准备从事运维工作的学习者',
  '["理解 Shell 脚本的基本概念和执行原理", "掌握变量定义、条件判断、循环结构的使用", "学会编写简单的自动化脚本", "理解脚本权限和执行方式", "能够独立完成系统信息查看脚本"]',
  '["基本的计算机操作能力", "了解 Linux 基础命令（cd, ls, cat 等）", "有一定的逻辑思维能力"]',
  1, 1,
  'ubuntu-desktop:latest',
  'webide-shell:latest',
  1, NOW(), NOW()
);

SET @shell_project_id = LAST_INSERT_ID();

-- Shell项目单元
INSERT INTO project_units (project_id, title, description, type, mode_group, time_limit, points, sort_order, created_at, updated_at) VALUES
(@shell_project_id, 'Shell 脚本基础知识', '学习 Shell 脚本的核心概念，包括变量、条件判断、循环和函数', 1, 1, 30, 100, 1, NOW(), NOW()),
(@shell_project_id, '系统信息脚本挑战', '综合运用所学知识，创建一个实用的系统信息查看脚本', 2, 2, 45, 200, 2, NOW(), NOW());

-- Shell项目标签关联
INSERT INTO project_tags (project_id, tag_id) 
SELECT @shell_project_id, id FROM tags WHERE name IN ('Shell', 'Linux', '自动化', '入门');


-- 3. 创建项目2: Python数据处理
INSERT INTO projects (
  title, slug, subtitle, cover_url, difficulty, status, description,
  learning_goals, prerequisites, labs_count, challenges_count,
  env_image, ide_image, created_by, created_at, updated_at
) VALUES (
  'Python 数据处理',
  'python-data',
  '使用 Python 处理和分析数据，构建成绩统计分析器',
  '/images/projects/python-data.png',
  1, -- BEGINNER
  1, -- PUBLISHED
  '## 📖 项目背景

**数据处理**是当今最热门的技能之一。无论是数据分析师、后端开发者还是人工智能工程师，都需要具备扎实的数据处理能力。Python 凭借其简洁的语法和丰富的库，成为数据处理的首选语言。

### 🎯 为什么要学习 Python 数据处理？

1. **职业发展** - 数据分析、机器学习的必备技能
2. **工作效率** - 自动化处理 Excel、CSV、JSON 等数据
3. **决策支持** - 从数据中提取有价值的信息
4. **应用广泛** - 金融、医疗、电商、教育等各行业

### 🛠️ 项目内容

本项目将带您学习 Python 数据处理的核心技能：

- **列表与字典** - 掌握 Python 最常用的数据结构
- **文件读写** - 学习读取和保存数据文件
- **JSON 处理** - 解析和生成 JSON 格式数据
- **数据统计** - 计算平均值、最大值、排序等
- **实战项目** - 创建一个成绩统计分析器

### 💡 学习成果

完成本项目后，您将能够：

- 熟练使用 Python 处理各种数据格式
- 编写数据统计和分析脚本
- 理解数据处理的基本流程
- 为学习 Pandas、NumPy 等高级库打下基础

### 📋 适合人群

- Python 初学者
- 需要处理数据的开发者
- 对数据分析感兴趣的学习者
- 想要提升工作效率的职场人士',
  '["掌握 Python 列表和字典的使用", "学会文件读写操作", "理解 JSON 数据格式及其处理方法", "能够编写数据统计和分析脚本", "完成一个完整的成绩分析器项目"]',
  '["Python 基础语法（变量、函数、循环）", "基本的编程逻辑思维", "了解什么是数据格式"]',
  1, 1,
  'ubuntu-desktop:latest',
  'webide-python:latest',
  1, NOW(), NOW()
);

SET @python_project_id = LAST_INSERT_ID();

-- Python项目单元
INSERT INTO project_units (project_id, title, description, type, mode_group, time_limit, points, sort_order, created_at, updated_at) VALUES
(@python_project_id, 'Python 数据处理基础', '学习列表、字典、文件操作和 JSON 处理的核心知识', 1, 1, 30, 100, 1, NOW(), NOW()),
(@python_project_id, '成绩分析器挑战', '综合运用所学知识，创建一个完整的成绩统计分析器', 2, 2, 45, 200, 2, NOW(), NOW());

-- Python项目标签关联
INSERT INTO project_tags (project_id, tag_id) 
SELECT @python_project_id, id FROM tags WHERE name IN ('Python', '数据处理', 'JSON', '入门');


-- 4. 创建项目3: Vue待办应用
INSERT INTO projects (
  title, slug, subtitle, cover_url, difficulty, status, description,
  learning_goals, prerequisites, labs_count, challenges_count,
  env_image, ide_image, created_by, created_at, updated_at
) VALUES (
  'Vue 待办应用',
  'vue-todo',
  '使用 Vue 3 构建一个功能完整的待办事项应用',
  '/images/projects/vue-todo.png',
  1, -- BEGINNER
  1, -- PUBLISHED
  '## 📖 项目背景

**Vue.js** 是目前最流行的前端框架之一，以其简洁的 API 和渐进式的设计理念深受开发者喜爱。待办事项应用（Todo App）是学习前端框架的经典项目，涵盖了数据绑定、列表渲染、事件处理等核心概念。

### 🎯 为什么要学习 Vue？

1. **市场需求** - 国内外大量公司使用 Vue 开发
2. **易学易用** - 相比 React，Vue 的学习曲线更平缓
3. **生态完善** - Vue Router、Vuex、Vite 等配套工具
4. **性能优秀** - Vue 3 带来了更好的性能和 TypeScript 支持

### 🛠️ 项目内容

本项目将带您从零构建一个 Vue 待办应用：

- **Vue 基础** - 学习 createApp、data、methods
- **模板语法** - 掌握插值、指令、事件绑定
- **列表渲染** - 使用 v-for 渲染待办列表
- **双向绑定** - 使用 v-model 处理表单输入
- **计算属性** - 使用 computed 实现统计功能
- **本地存储** - 使用 localStorage 持久化数据

### 💡 学习成果

完成本项目后，您将能够：

- 理解 Vue 3 的核心概念和工作原理
- 熟练使用 Vue 的常用指令
- 掌握组件数据流和事件处理
- 独立开发简单的 Vue 应用
- 为学习 Vue 组件化开发打下基础

### 📋 适合人群

- 前端开发初学者
- 想要学习 Vue 的开发者
- 有 HTML/CSS/JS 基础的学习者
- 准备从事前端开发的求职者',
  '["理解 Vue 3 的基本概念和响应式原理", "掌握 v-model、v-for、v-if 等常用指令", "学会使用计算属性和侦听器", "理解组件数据流和事件处理", "完成一个带本地存储的待办应用"]',
  '["HTML/CSS 基础知识", "JavaScript 基础语法", "了解 DOM 操作的基本概念"]',
  1, 1,
  'ubuntu-desktop:latest',
  'webide-vue:latest',
  1, NOW(), NOW()
);

SET @vue_project_id = LAST_INSERT_ID();

-- Vue项目单元
INSERT INTO project_units (project_id, title, description, type, mode_group, time_limit, points, sort_order, created_at, updated_at) VALUES
(@vue_project_id, 'Vue 3 基础知识', '学习 Vue 3 的核心概念，包括响应式数据、指令和事件处理', 1, 1, 30, 100, 1, NOW(), NOW()),
(@vue_project_id, '待办应用挑战', '综合运用所学知识，构建一个带本地存储的完整待办应用', 2, 2, 45, 200, 2, NOW(), NOW());

-- Vue项目标签关联
INSERT INTO project_tags (project_id, tag_id) 
SELECT @vue_project_id, id FROM tags WHERE name IN ('Vue', '前端', 'JavaScript', '入门');


-- ==========================================
-- 验证数据
-- ==========================================
SELECT '=== 项目列表 ===' AS info;
SELECT id, title, slug, difficulty, status, labs_count, challenges_count FROM projects WHERE deleted_at IS NULL;

SELECT '=== 项目单元 ===' AS info;
SELECT pu.id, p.title AS project, pu.title, pu.type, pu.mode_group, pu.points 
FROM project_units pu 
JOIN projects p ON pu.project_id = p.id 
WHERE p.deleted_at IS NULL
ORDER BY p.id, pu.sort_order;

SELECT '=== 标签列表 ===' AS info;
SELECT * FROM tags;

SELECT '=== 项目标签关联 ===' AS info;
SELECT p.title AS project, t.name AS tag 
FROM project_tags pt 
JOIN projects p ON pt.project_id = p.id 
JOIN tags t ON pt.tag_id = t.id
WHERE p.deleted_at IS NULL;
