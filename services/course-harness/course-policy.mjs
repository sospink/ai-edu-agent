import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

export const name = 'course-policy';
export const inject = ['tools'];

// 最终执行守卫不受后续审批插件放行影响；拒绝快照外路径和符号链接。
export function apply(ctx) {
  ctx.tools.guard((execution) => {
    if (!['read', 'glob', 'grep'].includes(execution.name)) return '课程助教只允许读取和搜索课程资料';
    const args = execution.arguments;
    if (!args || typeof args !== 'object') return '无效的课程文件参数';
    const path = execution.name === 'read' ? args.file_path : args.path;
    if (typeof path !== 'string' || !path.startsWith('/workspace/')) {
      if (path !== '/workspace') return '请使用 /workspace 下的绝对路径';
    }
    try {
      const canonical = realpathSync(resolve(path));
      if (canonical !== '/workspace' && !canonical.startsWith('/workspace/')) return '禁止访问课程快照之外的文件';
    } catch {
      return '课程文件不存在或不可读取';
    }
    return undefined;
  });
}
