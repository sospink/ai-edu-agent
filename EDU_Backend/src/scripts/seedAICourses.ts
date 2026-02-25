import { AppDataSource } from '../config/database';
import { Course, CourseStatus, CourseDifficulty } from '../models/Course';
import { CourseStage } from '../models/CourseStage';
import { CourseLesson, LessonType } from '../models/CourseLesson';

/**
 * AI课程数据初始化脚本
 * 基于课程手册目录的6门AI课程
 */

// 图标映射
const iconMap: Record<string, string> = {
  'prompt': '/icons/edit.svg',
  'mcp': '/icons/server.svg',
  'ade': '/icons/robot.svg',
  'agent': '/icons/user.svg',
  'multi-agent': '/icons/users.svg',
  'security': '/icons/shield.svg',
};

// 颜色映射
const colorMap: Record<string, string> = {
  'blue': '#3b82f6',
  'purple': '#8b5cf6',
  'green': '#10b981',
  'orange': '#f59e0b',
  'pink': '#ec4899',
  'red': '#ef4444',
};

// 课程数据
const aiCoursesData = [
  {
    title: '提示词工程',
    slug: 'prompt-engineering',
    description: '掌握与大语言模型交互的核心技能，学习如何设计高质量的提示词，让AI生成更准确、更有用的内容。通过系统化的方法，理解提示词工程的五大原则：模块化、参数化、版本化、可测试、可观测。学会构建可复用的提示词模板，提高AI应用的准确性、可控性和效率。',
    icon: 'prompt',
    color: 'blue',
    difficulty: 'Beginner',
    manualPrefix: '02-提示词工程',
  },
  {
    title: 'MCP Server开发',
    slug: 'mcp-server-development',
    description: '学习Model Context Protocol (MCP)开放协议，掌握如何开发MCP Server，让AI应用能够访问和使用外部数据源、工具。理解MCP的三大核心能力：Tools（工具）、Resources（资源）、Prompts（提示词模板）。通过实战项目，学会设计标准化的接口，为AI应用提供强大的扩展能力。',
    icon: 'mcp',
    color: 'purple',
    difficulty: 'Intermediate',
    manualPrefix: '03-MCP-Server开发',
  },
  {
    title: 'ADE智能体开发',
    slug: 'ade-agent-development',
    description: '深入学习Agent Development Environment (ADE)智能体开发环境，掌握Skill开发模式。理解ADE与传统开发的区别，学会通过模块化的Skill快速构建AI应用。掌握单一职责、接口标准化、错误处理等设计原则，学会开发代码翻译、文档生成等实用Skill，提升AI应用开发效率。',
    icon: 'ade',
    color: 'green',
    difficulty: 'Intermediate',
    manualPrefix: '04-ADE智能体开发',
  },
  {
    title: '单Agent开发 - Gordon',
    slug: 'single-agent-gordon',
    description: '深入学习单Agent完整架构，掌握PRA Loop（Perception-Reasoning-Action）和ReAct模式（Reasoning + Acting）。通过开发毒舌Gordon美食评论家Agent，学习感知、推理、行动的完整循环，掌握工具调用机制和记忆系统设计。理解Agent如何通过工具注册表扩展能力，如何通过记忆系统维护上下文。',
    icon: 'agent',
    color: 'orange',
    difficulty: 'Advanced',
    manualPrefix: '05-单Agent开发',
  },
  {
    title: '多Agent协作',
    slug: 'multi-agent-collaboration',
    description: '学习多Agent系统（MAS）和LangGraph状态机编排，掌握Agent协作的四种模式：Sequential（顺序）、Parallel（并行）、Conditional（条件）、Loop（循环）。通过创意风暴系统实战，学习如何设计和实现多个Agent的协作工作流，掌握状态管理和消息传递机制，构建复杂的AI应用系统。',
    icon: 'multi-agent',
    color: 'pink',
    difficulty: 'Advanced',
    manualPrefix: '06-多Agent协作',
  },
  {
    title: 'AI安全与合规',
    slug: 'ai-security-compliance',
    description: '深入学习AI安全的重要性和挑战，掌握Guardrails（护栏）框架的设计和实现。学习四种护栏类型：Input Rails（输入护栏）、Output Rails（输出护栏）、Dialog Rails（对话护栏）、Retrieval Rails（检索护栏）。通过AI酒吧调酒师实战项目，学会构建完整的安全检查和合规系统，确保AI应用的安全可靠。',
    icon: 'security',
    color: 'red',
    difficulty: 'Advanced',
    manualPrefix: '07-AI安全与合规',
  },
];

// 课时类型映射
const lessonTypeMap: Record<string, LessonType> = {
  'theory': LessonType.TEXT,  // 理论课使用TEXT类型
  'lab': LessonType.LAB,
  'challenge': LessonType.CHALLENGE,
  'quiz': LessonType.QUIZ,
};

// 难度等级映射
const difficultyMap: Record<string, CourseDifficulty> = {
  'Beginner': CourseDifficulty.BEGINNER,
  'Intermediate': CourseDifficulty.INTERMEDIATE,
  'Advanced': CourseDifficulty.ADVANCED,
};

async function seedAICourses() {
  console.log('🚀 开始初始化AI课程数据...\n');

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
        rl.question('是否继续添加AI课程数据? (y/N): ', resolve);
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

    for (const courseData of aiCoursesData) {
      console.log(`📚 创建课程: ${courseData.title}`);

      // 检查是否已存在同名课程
      const existing = await courseRepo.findOne({ where: { slug: courseData.slug } });
      if (existing) {
        console.log(`   ⏭️  课程 "${courseData.title}" 已存在，跳过\n`);
        continue;
      }

      // 创建课程 - 固定2个课时（知识手册 + 实验手册）
      const totalLessonCount = 2;
      const estimatedHours = 2; // 预计2小时

      // 创建课程
      const course = courseRepo.create({
        title: courseData.title,
        slug: courseData.slug,
        description: courseData.description,
        iconUrl: iconMap[courseData.icon] || '/icons/book.svg',
        coverColor: colorMap[courseData.color] || '#3b82f6',
        difficulty: difficultyMap[courseData.difficulty] || CourseDifficulty.BEGINNER,
        totalLessons: totalLessonCount,
        totalSkills: 2, // 固定2个技能点
        estimatedHours: estimatedHours,
        status: CourseStatus.PUBLISHED,
      });

      await courseRepo.save(course);
      totalCourses++;
      console.log(`   ✅ 课程创建成功 (ID: ${course.id})`);

      // 创建唯一的"入门基础"阶段
      const stage = stageRepo.create({
        courseId: course.id,
        title: '入门基础',
        description: `学习${courseData.title}的核心概念和实践技能`,
        sortOrder: 0,
        levelLabel: 'BEGINNER',
      });

      await stageRepo.save(stage);
      totalStages++;
      console.log(`   📁 阶段: ${stage.title} (ID: ${stage.id})`);

      // 创建两个课时：知识手册 + 实验手册
      const lessons = [
        {
          title: `${courseData.manualPrefix}-知识手册`,
          type: LessonType.TEXT,
          duration: 60,
          points: 10,
        },
        {
          title: `${courseData.manualPrefix}-实验手册`,
          type: LessonType.LAB,
          duration: 60,
          points: 10,
        },
      ];

      for (let i = 0; i < lessons.length; i++) {
        const lessonData = lessons[i];
        const lesson = lessonRepo.create({
          courseId: course.id,
          stageId: stage.id,
          title: lessonData.title,
          type: lessonData.type,
          durationMinutes: lessonData.duration,
          points: lessonData.points,
          sortOrder: i,
        });

        await lessonRepo.save(lesson);
        totalLessons++;
        console.log(`      📝 课时 ${i + 1}: ${lesson.title}`);
      }

      console.log('');
    }

    console.log('═'.repeat(50));
    console.log('🎉 AI课程数据初始化完成!');
    console.log(`   📚 课程: ${totalCourses} 个`);
    console.log(`   📁 阶段: ${totalStages} 个`);
    console.log(`   📝 课时: ${totalLessons} 个`);
    console.log('═'.repeat(50));
    console.log('\n📖 课程列表:');
    aiCoursesData.forEach((course, index) => {
      console.log(`   ${index + 1}. ${course.title} (${course.difficulty})`);
      console.log(`      - ${course.manualPrefix}-知识手册`);
      console.log(`      - ${course.manualPrefix}-实验手册`);
    });

  } catch (error) {
    console.error('❌ 初始化失败:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行初始化
seedAICourses().catch(console.error);
