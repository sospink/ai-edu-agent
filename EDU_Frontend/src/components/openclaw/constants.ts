import { RunningChatMessage, SessionState } from './types';

export const SESSION_META: Record<SessionState, { label: string; tone: string; dot: string }> = {
  idle: {
    label: '待机状态',
    tone: 'text-slate-500',
    dot: 'bg-slate-300',
  },
  running: {
    label: '思考中',
    tone: 'text-emerald-600',
    dot: 'bg-emerald-500',
  },
  approval: {
    label: '执行中',
    tone: 'text-amber-600',
    dot: 'bg-amber-500',
  },
  completed: {
    label: '已完成',
    tone: 'text-emerald-600',
    dot: 'bg-emerald-500',
  },
};

export const COMPLETED_STEPS = [
  ['步骤 1: 系统初始化', '核心模块已成功加载'],
  ['步骤 2: 需求分析', '用户意图已映射至工作流'],
  ['步骤 3: 源数据提取', '已连接至 4 个外部端点'],
  ['步骤 4: 启发式处理', '模式识别已完成'],
  ['步骤 5: 语义校验', '数据一致性已验证'],
  ['步骤 6: 内容优化', '冗余已清除 (减少 12%)'],
  ['步骤 7: 数据结构化', 'JSON 输出格式已生成'],
  ['步骤 8: 自动化审核', '通过所有合规性检查'],
  ['步骤 9: 最终报告汇编', '正在渲染可视化组件'],
  ['步骤 10: 导出与完成', '输出已保存至工作区'],
] as const;

export const RUNNING_CHAT_SCRIPT: RunningChatMessage[] = [
  { id: 1, role: 'agent', text: '已连接飞书工作台，检测到 15 条待处理财务对账消息。', time: '10:01' },
  { id: 2, role: 'user', text: '按财务模板处理，先标记异常再汇总。', time: '10:01' },
  { id: 3, role: 'agent', text: '收到。正在读取表格连接器数据并匹配汇率接口。', time: '10:02' },
  { id: 4, role: 'agent', text: '发现 3 条异常记录：金额偏差 > 5%，已加入风险标注。', time: '10:02' },
  { id: 5, role: 'user', text: '把异常清单单独发给我，并同步周报草稿。', time: '10:03' },
];

/** 工作场景预设提示词 */
export const WORK_SCENE_PROMPTS: string[] = [
  '请以售前工程师的身份，帮我分析客户需求，梳理技术路线，并输出一份完整的解决方案书。包含需求分析、技术架构、实施计划和报价四个部分。',
  '请以品牌营销专家的身份，帮我进行品牌定位分析，制定传播策略和年度营销方案。包含市场洞察、竞品分析、目标受众画像和渠道策略。',
  '请以全栈开发工程师的身份，帮我完成项目开发的全链路工作。从需求分析、技术选型、架构设计到源码实现、测试和部署方案。',
  '请以高级软件质量工程师的身份，对我桌面上「软件质量工程师工作台」目录中的前端项目执行全流程 Bug 修复——覆盖问题发现、缺陷评估、回归测试、修复实施到部署验证的完整闭环。\n\n具体要求：\n1. 扫描源码并输出缺陷评估报告至 02_评估文档 目录；\n2. 编写并执行回归测试用例，生成测试报告至 03_测试报告 目录；\n3. 针对发现的缺陷制定修复方案并完成代码修复，产物输出至 04_修复方案 目录；\n4. 构建部署产物并验证修复结果，产物输出至 05_部署产物 目录；\n5. 汇编项目交付文档，并使用 feishu-file-transfer Skill 将 02_评估文档、03_测试报告、04_修复方案、05_部署产物 中的全部产物及最终交付文档发送给我。',
];

