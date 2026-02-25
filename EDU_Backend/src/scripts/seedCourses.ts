/**
 * 课程数据初始化脚本
 * 用于初始化学习管理模块的测试数据
 * 
 * 运行方式: npm run seed:courses
 */

import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { Course, CourseDifficulty, CourseStatus } from '../models/Course';
import { CourseStage } from '../models/CourseStage';
import { CourseLesson, LessonType } from '../models/CourseLesson';

// 课时类型映射
const lessonTypeMap: Record<string, LessonType> = {
  'lab': LessonType.LAB,
  'challenge': LessonType.CHALLENGE,
  'quiz': LessonType.QUIZ,
  'text': LessonType.TEXT,
};

// 颜色映射
const colorMap: Record<string, string> = {
  'slate': '#1e293b',
  'blue': '#3b82f6',
  'cyan': '#06b6d4',
  'orange': '#f97316',
  'yellow': '#facc15',
  'rose': '#f43f5e',
  'indigo': '#4f46e5',
  'emerald': '#10b981',
  'purple': '#8b5cf6',
};

// 课程数据定义
interface LessonData {
  title: string;
  type: string;
  time: number; // 分钟
}

interface StageData {
  title: string;
  description: string;
  levelLabel: string;
  lessons: LessonData[];
}

interface CourseData {
  title: string;
  slug: string;
  description: string;
  iconUrl: string;
  coverColor: string;
  difficulty: CourseDifficulty;
  totalSkills: number;
  stages: StageData[];
}

// 所有课程数据 - 中文版本
const coursesData: CourseData[] = [
  // ==================== Shell 编程 ====================
  {
    title: 'Shell 编程',
    slug: 'shell-programming',
    description: '掌握命令行界面和 Shell 脚本编程，学习 Linux 系统管理的核心技能，从基础命令到高级自动化脚本。',
    iconUrl: '/icons/terminal.svg',
    coverColor: colorMap['slate'],
    difficulty: CourseDifficulty.BEGINNER,
    totalSkills: 26,
    stages: [
      {
        title: 'Shell 入门',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'BEGINNER LEVEL',
        lessons: [
          { title: '你好, Bash!', type: 'text', time: 10 },
          { title: '使用 Shell 变量', type: 'lab', time: 15 },
          { title: '字符串与数组操作', type: 'lab', time: 20 },
          { title: '寻找海盗的宝藏', type: 'challenge', time: 30 },
        ],
      },
      {
        title: 'Shell 进阶',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'INTERMEDIATE LEVEL',
        lessons: [
          { title: 'Shell 数组与循环', type: 'lab', time: 30 },
          { title: '条件判断与分支', type: 'lab', time: 25 },
          { title: '文本处理三剑客 (grep, sed, awk)', type: 'lab', time: 45 },
          { title: '自动化脚本实战', type: 'challenge', time: 60 },
        ],
      },
      {
        title: 'Shell 高级',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'ADVANCED LEVEL',
        lessons: [
          { title: '系统进程管理', type: 'lab', time: 40 },
          { title: '编写复杂的 Shell 函数', type: 'lab', time: 50 },
          { title: '日志分析与监控脚本', type: 'lab', time: 45 },
          { title: '综合实战：服务器自动化部署', type: 'challenge', time: 90 },
        ],
      },
    ],
  },

  // ==================== React 开发 ====================
  {
    title: 'React',
    slug: 'react-development',
    description: '通过这个全面的学习路径，掌握 React 的核心概念与实战技巧。本路线到提供了一种系统化的方法，带你从入门到精通。',
    iconUrl: '/icons/code.svg',
    coverColor: colorMap['cyan'],
    difficulty: CourseDifficulty.INTERMEDIATE,
    totalSkills: 12,
    stages: [
      {
        title: 'React Beginner',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'BEGINNER LEVEL',
        lessons: [
          { title: 'React 基础概念与环境搭建', type: 'text', time: 10 },
          { title: '第一个 React 程序', type: 'lab', time: 15 },
          { title: '变量与数据类型', type: 'lab', time: 20 },
          { title: '基础语法挑战', type: 'challenge', time: 30 },
        ],
      },
      {
        title: 'React Intermediate',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'INTERMEDIATE LEVEL',
        lessons: [
          { title: '组件深度解析', type: 'lab', time: 45 },
          { title: '模块化与包管理', type: 'lab', time: 40 },
          { title: '文件 I/O 操作', type: 'lab', time: 35 },
          { title: '综合实战：简易爬虫', type: 'challenge', time: 60 },
        ],
      },
      {
        title: 'React Advanced',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'ADVANCED LEVEL',
        lessons: [
          { title: 'React Hooks 高级用法', type: 'lab', time: 50 },
          { title: '状态管理与 Redux', type: 'lab', time: 55 },
          { title: '性能优化与调试', type: 'text', time: 20 },
        ],
      },
    ],
  },

  // ==================== HTML 基础 ====================
  {
    title: 'HTML',
    slug: 'html-basics',
    description: '学习网页的结构基础，掌握 HTML5 语义化标签、表单、多媒体等核心知识，为前端开发打下坚实基础。',
    iconUrl: '/icons/layout.svg',
    coverColor: colorMap['orange'],
    difficulty: CourseDifficulty.BEGINNER,
    totalSkills: 28,
    stages: [
      {
        title: 'HTML 入门',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'BEGINNER LEVEL',
        lessons: [
          { title: 'HTML 基础概念与环境搭建', type: 'text', time: 10 },
          { title: '第一个 HTML 页面', type: 'lab', time: 15 },
          { title: '常用标签与属性', type: 'lab', time: 20 },
          { title: '页面结构挑战', type: 'challenge', time: 30 },
        ],
      },
      {
        title: 'HTML 进阶',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'INTERMEDIATE LEVEL',
        lessons: [
          { title: '表单与用户输入', type: 'lab', time: 45 },
          { title: '多媒体元素', type: 'lab', time: 40 },
          { title: '语义化标签', type: 'lab', time: 35 },
          { title: '综合实战：个人简历页面', type: 'challenge', time: 60 },
        ],
      },
      {
        title: 'HTML 高级',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'ADVANCED LEVEL',
        lessons: [
          { title: 'HTML5 新特性', type: 'lab', time: 50 },
          { title: 'Canvas 绘图基础', type: 'lab', time: 55 },
          { title: 'Web 无障碍设计', type: 'text', time: 20 },
        ],
      },
    ],
  },

  // ==================== CSS 样式 ====================
  {
    title: 'CSS',
    slug: 'css-styling',
    description: '掌握网页样式设计，从基础选择器到 Flexbox、Grid 布局，再到动画效果，打造精美的用户界面。',
    iconUrl: '/icons/layout.svg',
    coverColor: colorMap['blue'],
    difficulty: CourseDifficulty.BEGINNER,
    totalSkills: 25,
    stages: [
      {
        title: 'CSS 入门',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'BEGINNER LEVEL',
        lessons: [
          { title: 'CSS 基础概念与语法', type: 'text', time: 10 },
          { title: '选择器与优先级', type: 'lab', time: 15 },
          { title: '盒模型详解', type: 'lab', time: 20 },
          { title: '样式挑战：美化按钮', type: 'challenge', time: 30 },
        ],
      },
      {
        title: 'CSS 进阶',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'INTERMEDIATE LEVEL',
        lessons: [
          { title: 'Flexbox 弹性布局', type: 'lab', time: 45 },
          { title: 'Grid 网格布局', type: 'lab', time: 40 },
          { title: '响应式设计', type: 'lab', time: 35 },
          { title: '综合实战：响应式导航栏', type: 'challenge', time: 60 },
        ],
      },
      {
        title: 'CSS 高级',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'ADVANCED LEVEL',
        lessons: [
          { title: 'CSS 动画与过渡', type: 'lab', time: 50 },
          { title: 'CSS 变量与主题切换', type: 'lab', time: 55 },
          { title: '性能优化技巧', type: 'text', time: 20 },
        ],
      },
    ],
  },

  // ==================== JavaScript 编程 ====================
  {
    title: 'JavaScript',
    slug: 'javascript-programming',
    description: '学习 Web 开发的核心编程语言，从基础语法到 ES6+ 新特性，掌握前端交互开发的必备技能。',
    iconUrl: '/icons/code.svg',
    coverColor: colorMap['yellow'],
    difficulty: CourseDifficulty.BEGINNER,
    totalSkills: 34,
    stages: [
      {
        title: 'JavaScript 入门',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'BEGINNER LEVEL',
        lessons: [
          { title: 'JavaScript 基础概念', type: 'text', time: 10 },
          { title: '变量、数据类型与运算符', type: 'lab', time: 15 },
          { title: '条件语句与循环', type: 'lab', time: 20 },
          { title: '基础语法挑战', type: 'challenge', time: 30 },
        ],
      },
      {
        title: 'JavaScript 进阶',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'INTERMEDIATE LEVEL',
        lessons: [
          { title: '函数与作用域', type: 'lab', time: 45 },
          { title: '数组与对象操作', type: 'lab', time: 40 },
          { title: 'DOM 操作与事件', type: 'lab', time: 35 },
          { title: '综合实战：待办事项应用', type: 'challenge', time: 60 },
        ],
      },
      {
        title: 'JavaScript 高级',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'ADVANCED LEVEL',
        lessons: [
          { title: 'ES6+ 新特性', type: 'lab', time: 50 },
          { title: '异步编程与 Promise', type: 'lab', time: 55 },
          { title: '模块化与打包工具', type: 'text', time: 20 },
        ],
      },
    ],
  },

  // ==================== Web 开发 ====================
  {
    title: 'Web 开发',
    slug: 'web-development',
    description: '全栈 Web 开发基础课程，涵盖前端、后端和数据库，构建完整的 Web 应用开发能力。',
    iconUrl: '/icons/globe.svg',
    coverColor: colorMap['blue'],
    difficulty: CourseDifficulty.BEGINNER,
    totalSkills: 99,
    stages: [
      {
        title: 'Web 开发入门',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'BEGINNER LEVEL',
        lessons: [
          { title: 'Web 开发概述', type: 'text', time: 10 },
          { title: '开发环境搭建', type: 'lab', time: 15 },
          { title: '第一个网页项目', type: 'lab', time: 20 },
          { title: '基础挑战：静态页面', type: 'challenge', time: 30 },
        ],
      },
      {
        title: 'Web 开发进阶',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'INTERMEDIATE LEVEL',
        lessons: [
          { title: '前后端交互基础', type: 'lab', time: 45 },
          { title: 'RESTful API 设计', type: 'lab', time: 40 },
          { title: '数据库基础', type: 'lab', time: 35 },
          { title: '综合实战：博客系统', type: 'challenge', time: 60 },
        ],
      },
      {
        title: 'Web 开发高级',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'ADVANCED LEVEL',
        lessons: [
          { title: '身份认证与授权', type: 'lab', time: 50 },
          { title: '部署与运维', type: 'lab', time: 55 },
          { title: '性能优化与安全', type: 'text', time: 20 },
        ],
      },
    ],
  },

  // ==================== Python 编程 ====================
  {
    title: 'Python',
    slug: 'python-programming',
    description: '学习最流行的编程语言之一，适用于 AI、数据分析、后端开发等多个领域，从零基础到实战应用。',
    iconUrl: '/icons/code.svg',
    coverColor: colorMap['blue'],
    difficulty: CourseDifficulty.BEGINNER,
    totalSkills: 60,
    stages: [
      {
        title: 'Python 入门',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'BEGINNER LEVEL',
        lessons: [
          { title: 'Python 环境搭建', type: 'text', time: 10 },
          { title: '第一个 Python 程序', type: 'lab', time: 15 },
          { title: '变量与数据类型', type: 'lab', time: 20 },
          { title: '基础语法挑战', type: 'challenge', time: 30 },
        ],
      },
      {
        title: 'Python 进阶',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'INTERMEDIATE LEVEL',
        lessons: [
          { title: '面向对象编程', type: 'lab', time: 45 },
          { title: '模块与包管理', type: 'lab', time: 40 },
          { title: '文件操作与异常处理', type: 'lab', time: 35 },
          { title: '综合实战：数据处理脚本', type: 'challenge', time: 60 },
        ],
      },
      {
        title: 'Python 高级',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'ADVANCED LEVEL',
        lessons: [
          { title: '装饰器与生成器', type: 'lab', time: 50 },
          { title: '多线程与异步编程', type: 'lab', time: 55 },
          { title: '性能优化技巧', type: 'text', time: 20 },
        ],
      },
    ],
  },

  // ==================== Linux 系统 ====================
  {
    title: 'Linux',
    slug: 'linux-fundamentals',
    description: '掌握云计算时代的核心操作系统，学习 Linux 命令行、系统管理、网络配置等必备技能。',
    iconUrl: '/icons/terminal.svg',
    coverColor: colorMap['slate'],
    difficulty: CourseDifficulty.BEGINNER,
    totalSkills: 118,
    stages: [
      {
        title: 'Linux 入门',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'BEGINNER LEVEL',
        lessons: [
          { title: 'Linux 系统概述', type: 'text', time: 10 },
          { title: '基础命令操作', type: 'lab', time: 15 },
          { title: '文件与目录管理', type: 'lab', time: 20 },
          { title: '命令行挑战', type: 'challenge', time: 30 },
        ],
      },
      {
        title: 'Linux 进阶',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'INTERMEDIATE LEVEL',
        lessons: [
          { title: '用户与权限管理', type: 'lab', time: 45 },
          { title: '软件包管理', type: 'lab', time: 40 },
          { title: '进程与服务管理', type: 'lab', time: 35 },
          { title: '综合实战：服务器配置', type: 'challenge', time: 60 },
        ],
      },
      {
        title: 'Linux 高级',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'ADVANCED LEVEL',
        lessons: [
          { title: '网络配置与防火墙', type: 'lab', time: 50 },
          { title: '系统监控与日志', type: 'lab', time: 55 },
          { title: '性能调优', type: 'text', time: 20 },
        ],
      },
    ],
  },

  // ==================== DevOps 实践 ====================
  {
    title: 'DevOps',
    slug: 'devops-essentials',
    description: '学习开发与运维的桥梁技术，掌握 CI/CD、自动化部署、监控告警等现代软件交付实践。',
    iconUrl: '/icons/cpu.svg',
    coverColor: colorMap['rose'],
    difficulty: CourseDifficulty.INTERMEDIATE,
    totalSkills: 4,
    stages: [
      {
        title: 'DevOps 入门',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'BEGINNER LEVEL',
        lessons: [
          { title: 'DevOps 文化与理念', type: 'text', time: 10 },
          { title: '版本控制与 Git', type: 'lab', time: 15 },
          { title: 'CI/CD 基础概念', type: 'lab', time: 20 },
          { title: '基础挑战：自动化构建', type: 'challenge', time: 30 },
        ],
      },
      {
        title: 'DevOps 进阶',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'INTERMEDIATE LEVEL',
        lessons: [
          { title: 'Jenkins 流水线', type: 'lab', time: 45 },
          { title: 'GitHub Actions 实战', type: 'lab', time: 40 },
          { title: '自动化测试集成', type: 'lab', time: 35 },
          { title: '综合实战：完整 CI/CD 流程', type: 'challenge', time: 60 },
        ],
      },
      {
        title: 'DevOps 高级',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'ADVANCED LEVEL',
        lessons: [
          { title: '基础设施即代码', type: 'lab', time: 50 },
          { title: '监控与告警系统', type: 'lab', time: 55 },
          { title: 'SRE 最佳实践', type: 'text', time: 20 },
        ],
      },
    ],
  },

  // ==================== Docker 容器 ====================
  {
    title: 'Docker',
    slug: 'docker-containers',
    description: '学习容器化技术，掌握 Docker 镜像构建、容器编排、网络配置等核心技能，实现应用的快速部署。',
    iconUrl: '/icons/layers.svg',
    coverColor: colorMap['blue'],
    difficulty: CourseDifficulty.INTERMEDIATE,
    totalSkills: 32,
    stages: [
      {
        title: 'Docker 入门',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'BEGINNER LEVEL',
        lessons: [
          { title: 'Docker 基础概念', type: 'text', time: 10 },
          { title: '安装与配置 Docker', type: 'lab', time: 15 },
          { title: '第一个容器', type: 'lab', time: 20 },
          { title: '容器操作挑战', type: 'challenge', time: 30 },
        ],
      },
      {
        title: 'Docker 进阶',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'INTERMEDIATE LEVEL',
        lessons: [
          { title: 'Dockerfile 编写', type: 'lab', time: 45 },
          { title: '镜像构建与优化', type: 'lab', time: 40 },
          { title: 'Docker Compose 编排', type: 'lab', time: 35 },
          { title: '综合实战：多容器应用', type: 'challenge', time: 60 },
        ],
      },
      {
        title: 'Docker 高级',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'ADVANCED LEVEL',
        lessons: [
          { title: 'Docker 网络详解', type: 'lab', time: 50 },
          { title: '数据卷与持久化', type: 'lab', time: 55 },
          { title: '安全与最佳实践', type: 'text', time: 20 },
        ],
      },
    ],
  },

  // ==================== Kubernetes 编排 ====================
  {
    title: 'Kubernetes',
    slug: 'kubernetes-orchestration',
    description: '掌握容器编排平台，学习 K8s 集群管理、服务部署、自动伸缩等企业级容器管理技能。',
    iconUrl: '/icons/layers.svg',
    coverColor: colorMap['indigo'],
    difficulty: CourseDifficulty.ADVANCED,
    totalSkills: 27,
    stages: [
      {
        title: 'Kubernetes 入门',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'BEGINNER LEVEL',
        lessons: [
          { title: 'Kubernetes 架构概述', type: 'text', time: 10 },
          { title: '集群搭建与配置', type: 'lab', time: 15 },
          { title: 'Pod 与 Deployment', type: 'lab', time: 20 },
          { title: '基础部署挑战', type: 'challenge', time: 30 },
        ],
      },
      {
        title: 'Kubernetes 进阶',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'INTERMEDIATE LEVEL',
        lessons: [
          { title: 'Service 与网络', type: 'lab', time: 45 },
          { title: 'ConfigMap 与 Secret', type: 'lab', time: 40 },
          { title: '存储与持久卷', type: 'lab', time: 35 },
          { title: '综合实战：微服务部署', type: 'challenge', time: 60 },
        ],
      },
      {
        title: 'Kubernetes 高级',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'ADVANCED LEVEL',
        lessons: [
          { title: 'Helm 包管理', type: 'lab', time: 50 },
          { title: '自动伸缩与调度', type: 'lab', time: 55 },
          { title: '集群安全与监控', type: 'text', time: 20 },
        ],
      },
    ],
  },

  // ==================== 网络安全 ====================
  {
    title: '网络安全',
    slug: 'network-security',
    description: '学习网络安全基础知识，掌握渗透测试、漏洞分析、安全防护等技能，保护企业信息资产。',
    iconUrl: '/icons/shield.svg',
    coverColor: colorMap['indigo'],
    difficulty: CourseDifficulty.ADVANCED,
    totalSkills: 229,
    stages: [
      {
        title: '安全基础',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'BEGINNER LEVEL',
        lessons: [
          { title: '网络安全概述', type: 'text', time: 10 },
          { title: '常见攻击类型', type: 'lab', time: 15 },
          { title: '安全工具入门', type: 'lab', time: 20 },
          { title: '安全意识挑战', type: 'challenge', time: 30 },
        ],
      },
      {
        title: '安全进阶',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'INTERMEDIATE LEVEL',
        lessons: [
          { title: 'Web 安全漏洞', type: 'lab', time: 45 },
          { title: '渗透测试基础', type: 'lab', time: 40 },
          { title: '加密与认证', type: 'lab', time: 35 },
          { title: '综合实战：漏洞挖掘', type: 'challenge', time: 60 },
        ],
      },
      {
        title: '安全高级',
        description: '掌握核心语法 · 实战练习 · 获取证书',
        levelLabel: 'ADVANCED LEVEL',
        lessons: [
          { title: '高级渗透技术', type: 'lab', time: 50 },
          { title: '安全架构设计', type: 'lab', time: 55 },
          { title: '应急响应与取证', type: 'text', time: 20 },
        ],
      },
    ],
  },
];


// 解析时间字符串为分钟数
function parseTime(time: number): number {
  return time || 15;
}

async function seedCourses() {
  console.log('🚀 开始初始化课程数据...\n');

  try {
    // 初始化数据库连接
    await AppDataSource.initialize();
    console.log('✅ 数据库连接成功\n');

    const courseRepo = AppDataSource.getRepository(Course);
    const stageRepo = AppDataSource.getRepository(CourseStage);
    const lessonRepo = AppDataSource.getRepository(CourseLesson);

    // 检查是否已有数据
    const existingCount = await courseRepo.count();
    if (existingCount > 0) {
      console.log(`⚠️  数据库中已存在 ${existingCount} 个课程`);
      console.log('   如需重新初始化，请先清空相关表数据\n');
      
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question('是否继续添加数据? (y/N): ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'y') {
        console.log('已取消操作');
        await AppDataSource.destroy();
        return;
      }
    }

    let totalCourses = 0;
    let totalStages = 0;
    let totalLessons = 0;

    for (const courseData of coursesData) {
      console.log(`📚 创建课程: ${courseData.title}`);

      // 检查是否已存在同名课程
      const existing = await courseRepo.findOne({ where: { slug: courseData.slug } });
      if (existing) {
        console.log(`   ⏭️  课程 "${courseData.title}" 已存在，跳过\n`);
        continue;
      }

      // 计算总课时数和预计时长
      let totalLessonCount = 0;
      let totalMinutes = 0;
      for (const stage of courseData.stages) {
        totalLessonCount += stage.lessons.length;
        for (const lesson of stage.lessons) {
          totalMinutes += parseTime(lesson.time);
        }
      }
      const estimatedHours = Math.ceil(totalMinutes / 60);

      // 创建课程
      const course = courseRepo.create({
        title: courseData.title,
        slug: courseData.slug,
        description: courseData.description,
        iconUrl: courseData.iconUrl,
        coverColor: courseData.coverColor,
        difficulty: courseData.difficulty,
        totalLessons: totalLessonCount,
        totalSkills: courseData.totalSkills,
        estimatedHours: estimatedHours,
        status: CourseStatus.PUBLISHED,
      });

      await courseRepo.save(course);
      totalCourses++;
      console.log(`   ✅ 课程创建成功 (ID: ${course.id})`);

      // 创建阶段和课时
      let stageOrder = 0;
      for (const stageData of courseData.stages) {
        // 创建阶段
        const stage = stageRepo.create({
          courseId: course.id,
          title: stageData.title,
          description: stageData.description,
          sortOrder: stageOrder++,
          levelLabel: stageData.levelLabel,
        });

        await stageRepo.save(stage);
        totalStages++;
        console.log(`   📁 阶段: ${stage.title} (ID: ${stage.id})`);

        // 创建课时
        let lessonOrder = 0;
        for (const lessonData of stageData.lessons) {
          const lesson = lessonRepo.create({
            courseId: course.id,
            stageId: stage.id,
            title: lessonData.title,
            type: lessonTypeMap[lessonData.type] || LessonType.LAB,
            durationMinutes: parseTime(lessonData.time),
            points: lessonData.type === 'challenge' ? 20 : 10,
            sortOrder: lessonOrder++,
          });

          await lessonRepo.save(lesson);
          totalLessons++;
        }
        console.log(`      📝 创建了 ${stageData.lessons.length} 个课时`);
      }

      console.log('');
    }

    console.log('═'.repeat(50));
    console.log('🎉 数据初始化完成!');
    console.log(`   📚 课程: ${totalCourses} 个`);
    console.log(`   📁 阶段: ${totalStages} 个`);
    console.log(`   📝 课时: ${totalLessons} 个`);
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('❌ 初始化失败:', error);
  } finally {
    await AppDataSource.destroy();
    console.log('\n数据库连接已关闭');
  }
}

// 运行脚本
seedCourses();
