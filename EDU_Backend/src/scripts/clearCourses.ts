/**
 * 清空课程数据脚本
 * 用于清空学习管理模块的所有数据
 * 
 * 运行方式: npm run clear:courses
 */

import 'reflect-metadata';
import { AppDataSource } from '../config/database';
import { Course } from '../models/Course';
import { CourseStage } from '../models/CourseStage';
import { CourseLesson } from '../models/CourseLesson';

async function clearCourses() {
  console.log('🗑️  开始清空课程数据...\n');

  try {
    // 初始化数据库连接
    await AppDataSource.initialize();
    console.log('✅ 数据库连接成功\n');

    const courseRepo = AppDataSource.getRepository(Course);
    const stageRepo = AppDataSource.getRepository(CourseStage);
    const lessonRepo = AppDataSource.getRepository(CourseLesson);

    // 统计现有数据
    const courseCount = await courseRepo.count();
    const stageCount = await stageRepo.count();
    const lessonCount = await lessonRepo.count();

    console.log('📊 当前数据统计:');
    console.log(`   📚 课程: ${courseCount} 个`);
    console.log(`   📁 阶段: ${stageCount} 个`);
    console.log(`   📝 课时: ${lessonCount} 个\n`);

    if (courseCount === 0 && stageCount === 0 && lessonCount === 0) {
      console.log('数据库已经是空的，无需清空');
      await AppDataSource.destroy();
      return;
    }

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('⚠️  确定要清空所有课程数据吗？此操作不可恢复！(yes/N): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('已取消操作');
      await AppDataSource.destroy();
      return;
    }

    console.log('\n正在清空数据...');

    // 按顺序删除（先删除子表）
    await lessonRepo.clear();
    console.log('   ✅ 课时数据已清空');

    await stageRepo.clear();
    console.log('   ✅ 阶段数据已清空');

    await courseRepo.clear();
    console.log('   ✅ 课程数据已清空');

    console.log('\n🎉 所有课程数据已清空！');
    console.log('   现在可以运行 npm run seed:courses 重新初始化数据');

  } catch (error) {
    console.error('❌ 清空失败:', error);
  } finally {
    await AppDataSource.destroy();
    console.log('\n数据库连接已关闭');
  }
}

// 运行脚本
clearCourses();
