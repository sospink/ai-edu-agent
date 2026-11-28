export const name = 'square-policy';
export const inject = ['tools'];

export function apply(ctx) {
  ctx.tools.guard(execution => execution.name === 'skill' ? undefined : '广场工作区仅开放教学 Skill');
}
