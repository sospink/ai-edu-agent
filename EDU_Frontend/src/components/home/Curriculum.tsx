import React from 'react';
import Section from '@/components/common/Section';
import { Monitor, Presentation, Settings, CheckCircle2, Terminal, Code2, GitBranch, Layers } from 'lucide-react';
import { motion } from 'framer-motion';

export const Curriculum: React.FC = () => {
  const stages = [
    { label: "Phase 01", title: "基础夯实", time: "4-6周", desc: "Python基础, Prompt Engineering, RAG技术", items: ["Python编程基础", "数据结构与算法", "大模型原理", "Prompt Engineering", "RAG & 向量库"] },
    { label: "Phase 02", title: "Agent 开发", time: "6-8周", desc: "Function Calling, MCP协议, LangChain框架", items: ["Function Calling", "MCP协议实战", "LangChain框架", "LangGraph状态", "Agent设计模式"] },
    { label: "Phase 03", title: "Multi-Agent 系统", time: "8-10周", desc: "协作架构, 复杂任务编排, 企业级实战", items: ["协作架构", "通信协议", "任务编排", "安全防护", "项目实战"] },
  ];

  return (
    <Section title="课程体系进化之路" subtitle="从基础到高阶的科学实训路径">
      <div className="relative">
        <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-primary-100 via-secondary-100 to-primary-100 -translate-y-1/2 rounded-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
          {stages.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.2 }} className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl p-8 hover:shadow-xl hover:shadow-primary/5 transition-all group">
              <div className="mb-6 flex justify-between items-center">
                <span className="text-xs font-bold tracking-widest text-primary-500 uppercase">{s.label}</span>
                <span className="text-xs font-medium text-default-400 bg-default-100 px-2 py-1 rounded-full">{s.time}</span>
              </div>
              <h3 className="text-2xl font-bold mb-2 group-hover:text-primary-600 transition-colors">{s.title}</h3>
              <p className="text-sm text-default-500 mb-6">{s.desc}</p>
              <div className="space-y-3">
                {s.items.map((item, idx) => (
                  <div key={idx} className="flex items-center text-sm text-default-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary-400 mr-3"></div>
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
};

export const Platform: React.FC = () => {
  const roles = [
    { title: "学生端", icon: Monitor, features: ["技能树导航", "云端VSCode", "AI助手", "自动批改"] },
    { title: "教师端", icon: Presentation, features: ["可视化配置", "数据看板", "学习预警", "报告导出"] },
    { title: "管理端", icon: Settings, features: ["算力配额", "预算预警", "日志审计", "系统配置"] },
  ];

  return (
    <Section title="三端协同，教学闭环" subtitle="为不同角色提供极致的数字化体验">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {roles.map((r, i) => (
          <div key={i} className="bg-gradient-to-b from-white to-default-50/50 p-8 rounded-2xl border border-white/60 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="w-14 h-14 bg-white rounded-xl shadow-md flex items-center justify-center mb-6 text-primary-600 border border-default-100">
              <r.icon className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold mb-6">{r.title}</h3>
            <ul className="space-y-4">
              {r.features.map((f, idx) => (
                <li key={idx} className="flex items-center text-default-600 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-success-500 mr-3 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
};

export const LearningModes: React.FC = () => {
  const modes = [
    { name: "AI 辅助学习", icon: Terminal, desc: "Step-by-step guidance", phase: "入门" },
    { name: "Agent Coding", icon: Code2, desc: "Browser-based IDE", phase: "进阶" },
    { name: "任务式学习", icon: GitBranch, desc: "Role-playing tasks", phase: "实战" },
    { name: "工作流搭建", icon: Layers, desc: "Drag & drop builder", phase: "应用" },
  ];

  return (
    <Section title="沉浸式学习形态" subtitle="适配不同阶段的实训模式">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {modes.map((m, i) => (
          <div key={i} className="group relative bg-white/70 backdrop-blur border border-white/50 p-6 rounded-2xl hover:bg-white transition-colors">
            <div className="absolute top-4 right-4 text-xs font-mono text-default-300 group-hover:text-primary-400 transition-colors">{m.phase}</div>
            <div className="w-10 h-10 bg-default-50 rounded-lg flex items-center justify-center text-default-500 mb-4 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
              <m.icon className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-base mb-1">{m.name}</h4>
            <p className="text-xs text-default-400">{m.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
};
