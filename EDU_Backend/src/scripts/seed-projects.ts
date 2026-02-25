/**
 * 项目数据种子脚本
 * 创建三个演示项目：Shell脚本入门、Python数据处理、Vue待办应用
 * 
 * 运行方式：npx ts-node src/scripts/seed-projects.ts
 */

import { AppDataSource } from '../config/database';
import { Project, ProjectDifficulty, ProjectStatus } from '../models/Project';
import { ProjectUnit, UnitType, ModeGroup } from '../models/ProjectUnit';
import { Tag } from '../models/Tag';
import { ProjectTag } from '../models/ProjectTag';

// ==================== 项目数据定义 ====================

const projectsData = [
  {
    // 项目1: Shell脚本入门
    project: {
      title: 'Shell 脚本入门',
      slug: 'shell-intro',
      subtitle: '从零开始学习 Shell 脚本编程，掌握 Linux 自动化技能',
      coverUrl: '/images/projects/shell-intro.png',
      difficulty: ProjectDifficulty.BEGINNER,
      status: ProjectStatus.PUBLISHED,
      description: `## 📖 项目背景

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
- 准备从事运维工作的学习者`,
      learningGoals: [
        '理解 Shell 脚本的基本概念和执行原理',
        '掌握变量定义、条件判断、循环结构的使用',
        '学会编写简单的自动化脚本',
        '理解脚本权限和执行方式',
        '能够独立完成系统信息查看脚本'
      ],
      prerequisites: [
        '基本的计算机操作能力',
        '了解 Linux 基础命令（cd, ls, cat 等）',
        '有一定的逻辑思维能力'
      ],
      envImage: 'ubuntu-desktop:latest',
      ideImage: 'webide-shell:latest'
    },
    units: [
      {
        title: 'Shell 脚本基础知识',
        description: '学习 Shell 脚本的核心概念，包括变量、条件判断、循环和函数',
        type: UnitType.LAB,
        modeGroup: ModeGroup.GUIDED,
        timeLimit: 30,
        points: 100,
        sortOrder: 1
      },
      {
        title: '系统信息脚本挑战',
        description: '综合运用所学知识，创建一个实用的系统信息查看脚本',
        type: UnitType.CHALLENGE,
        modeGroup: ModeGroup.CHALLENGE,
        timeLimit: 45,
        points: 200,
        sortOrder: 2
      }
    ],
    tags: ['Shell', 'Linux', '自动化', '入门']
  },

  {
    // 项目2: Python数据处理
    project: {
      title: 'Python 数据处理',
      slug: 'python-data',
      subtitle: '使用 Python 处理和分析数据，构建成绩统计分析器',
      coverUrl: '/images/projects/python-data.png',
      difficulty: ProjectDifficulty.BEGINNER,
      status: ProjectStatus.PUBLISHED,
      description: `## 📖 项目背景

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
- 想要提升工作效率的职场人士`,
      learningGoals: [
        '掌握 Python 列表和字典的使用',
        '学会文件读写操作',
        '理解 JSON 数据格式及其处理方法',
        '能够编写数据统计和分析脚本',
        '完成一个完整的成绩分析器项目'
      ],
      prerequisites: [
        'Python 基础语法（变量、函数、循环）',
        '基本的编程逻辑思维',
        '了解什么是数据格式'
      ],
      envImage: 'ubuntu-desktop:latest',
      ideImage: 'webide-python:latest'
    },
    units: [
      {
        title: 'Python 数据处理基础',
        description: '学习列表、字典、文件操作和 JSON 处理的核心知识',
        type: UnitType.LAB,
        modeGroup: ModeGroup.GUIDED,
        timeLimit: 30,
        points: 100,
        sortOrder: 1
      },
      {
        title: '成绩分析器挑战',
        description: '综合运用所学知识，创建一个完整的成绩统计分析器',
        type: UnitType.CHALLENGE,
        modeGroup: ModeGroup.CHALLENGE,
        timeLimit: 45,
        points: 200,
        sortOrder: 2
      }
    ],
    tags: ['Python', '数据处理', 'JSON', '入门']
  },

  {
    // 项目3: Vue待办应用
    project: {
      title: 'Vue 待办应用',
      slug: 'vue-todo',
      subtitle: '使用 Vue 3 构建一个功能完整的待办事项应用',
      coverUrl: '/images/projects/vue-todo.png',
      difficulty: ProjectDifficulty.BEGINNER,
      status: ProjectStatus.PUBLISHED,
      description: `## 📖 项目背景

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
- 准备从事前端开发的求职者`,
      learningGoals: [
        '理解 Vue 3 的基本概念和响应式原理',
        '掌握 v-model、v-for、v-if 等常用指令',
        '学会使用计算属性和侦听器',
        '理解组件数据流和事件处理',
        '完成一个带本地存储的待办应用'
      ],
      prerequisites: [
        'HTML/CSS 基础知识',
        'JavaScript 基础语法',
        '了解 DOM 操作的基本概念'
      ],
      envImage: 'ubuntu-desktop:latest',
      ideImage: 'webide-vue:latest'
    },
    units: [
      {
        title: 'Vue 3 基础知识',
        description: '学习 Vue 3 的核心概念，包括响应式数据、指令和事件处理',
        type: UnitType.LAB,
        modeGroup: ModeGroup.GUIDED,
        timeLimit: 30,
        points: 100,
        sortOrder: 1
      },
      {
        title: '待办应用挑战',
        description: '综合运用所学知识，构建一个带本地存储的完整待办应用',
        type: UnitType.CHALLENGE,
        modeGroup: ModeGroup.CHALLENGE,
        timeLimit: 45,
        points: 200,
        sortOrder: 2
      }
    ],
    tags: ['Vue', '前端', 'JavaScript', '入门']
  }
];

// ==================== 种子函数 ====================

async function seedProjects() {
  try {
    // 初始化数据库连接
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    console.log('✓ 数据库连接成功');

    const projectRepo = AppDataSource.getRepository(Project);
    const unitRepo = AppDataSource.getRepository(ProjectUnit);
    const tagRepo = AppDataSource.getRepository(Tag);
    const projectTagRepo = AppDataSource.getRepository(ProjectTag);

    // 创建或获取标签
    const tagMap = new Map<string, Tag>();
    const allTagNames = new Set<string>();
    projectsData.forEach(p => p.tags.forEach(t => allTagNames.add(t)));

    for (const tagName of allTagNames) {
      let tag = await tagRepo.findOne({ where: { name: tagName } });
      if (!tag) {
        tag = tagRepo.create({ 
          name: tagName, 
          styleColor: getTagColor(tagName) 
        });
        tag = await tagRepo.save(tag);
        console.log(`✓ 创建标签: ${tagName}`);
      }
      tagMap.set(tagName, tag);
    }

    // 创建项目
    for (const data of projectsData) {
      // 检查项目是否已存在
      const existing = await projectRepo.findOne({ where: { slug: data.project.slug } });
      if (existing) {
        console.log(`⚠ 项目已存在，跳过: ${data.project.title}`);
        continue;
      }

      // 创建项目
      const project = projectRepo.create(data.project);
      const savedProject = await projectRepo.save(project);
      console.log(`✓ 创建项目: ${savedProject.title} (ID: ${savedProject.id})`);

      // 创建项目单元
      for (const unitData of data.units) {
        const unit = unitRepo.create({
          ...unitData,
          projectId: savedProject.id
        });
        const savedUnit = await unitRepo.save(unit);
        console.log(`  ✓ 创建单元: ${savedUnit.title}`);
      }

      // 更新项目统计
      const labsCount = data.units.filter(u => u.type === UnitType.LAB).length;
      const challengesCount = data.units.filter(u => u.type === UnitType.CHALLENGE).length;
      await projectRepo.update(savedProject.id, { labsCount, challengesCount });

      // 关联标签
      for (const tagName of data.tags) {
        const tag = tagMap.get(tagName);
        if (tag) {
          await projectTagRepo.insert({
            projectId: savedProject.id,
            tagId: tag.id
          });
        }
      }
      console.log(`  ✓ 关联标签: ${data.tags.join(', ')}`);
    }

    console.log('\n✅ 项目数据种子完成！');

  } catch (error) {
    console.error('❌ 种子脚本执行失败:', error);
    throw error;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

// 根据标签名返回颜色
function getTagColor(tagName: string): string {
  const colorMap: Record<string, string> = {
    'Shell': '#4EAA25',
    'Linux': '#FCC624',
    '自动化': '#FF6B6B',
    '入门': '#10B981',
    'Python': '#3776AB',
    '数据处理': '#F59E0B',
    'JSON': '#000000',
    'Vue': '#42B883',
    '前端': '#61DAFB',
    'JavaScript': '#F7DF1E'
  };
  return colorMap[tagName] || '#3B82F6';
}

// 执行种子脚本
seedProjects()
  .then(() => {
    console.log('脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
