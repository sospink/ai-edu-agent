export const name = 'course-workspace';
export const inject = ['workspaceRegistry', 'sessions', 'tools'];

export async function apply(ctx) {
  if (typeof ctx.tools.guard !== 'function') throw new Error('当前运行时不支持课程工具守卫');
  const workspace = await ctx.workspaceRegistry.initializeDefault(async () => '/workspace');
  if (workspace) {
    await workspace.setTitle(process.env.EDU_COURSE_TITLE || 'course');
  }
  console.info('[course-harness] 课程工作区已初始化：/workspace');
}
