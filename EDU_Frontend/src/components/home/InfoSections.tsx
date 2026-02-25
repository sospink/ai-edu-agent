import React from 'react';
import Section from '@/components/common/Section';
import { BookOpen, PenTool, Award, Trophy } from 'lucide-react';

export const Scenarios: React.FC = () => {
  const items = [
    { title: "专业核心课", desc: "AI应用开发、智能体技术", icon: BookOpen },
    { title: "实训实验课", desc: "20+项目，自动批改", icon: PenTool },
    { title: "1+X证书", desc: "对标人工智能开发标准", icon: Award },
    { title: "大赛集训", desc: "职业院校大赛真题模拟", icon: Trophy },
  ];

  return (
    <Section title="全场景教学支持" subtitle="覆盖从课堂到竞赛的每一个环节">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {items.map((item, i) => (
          <div key={i} className="bg-white/50 border border-white/60 p-6 rounded-2xl text-center hover:bg-white hover:shadow-lg transition-all">
            <div className="w-12 h-12 mx-auto bg-white shadow-sm rounded-full flex items-center justify-center mb-4 text-default-700">
              <item.icon className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base mb-1 text-slate-800">{item.title}</h3>
            <p className="text-default-500 text-xs">{item.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
};

export const MarketDemand: React.FC = () => {
  const stats = [
    { value: "500+", label: "招聘企业" },
    { value: "2.3x", label: "供需缺口" },
    { value: "600w", label: "人才需求" },
    { value: "60%", label: "薪资涨幅" },
  ];

  return (
    <section className="w-full py-24 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden rounded-[3rem] mx-auto max-w-[95%] shadow-2xl">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/20 blur-[100px] rounded-full"></div>
      <div className="max-w-7xl mx-auto px-8 relative z-10 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">产业需求爆发，人才供不应求</h2>
        <p className="text-slate-300 max-w-2xl mx-auto mb-16 font-light">AI智能体工程师已成为企业争夺的稀缺资源，掌握Agent开发技能将大幅提升就业竞争力。</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {stats.map((s, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="text-5xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">{s.value}</div>
              <div className="text-sm text-slate-400 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const ServiceSupport: React.FC = () => {
  const services = [
    { title: "快速部署", desc: "SaaS/私有化，1周上线。" },
    { title: "师资培训", desc: "线上+线下，配套资料。" },
    { title: "技术支持", desc: "5x8在线，快速响应。" },
    { title: "持续更新", desc: "季度更新，紧跟前沿。" },
    { title: "安全合规", desc: "等保三级，沙箱隔离。" },
    { title: "产教合作", desc: "企业参观，实习推荐。" },
  ];

  return (
    <Section title="服务保障">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {services.map((s, i) => (
          <div key={i} className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/50 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 font-bold text-sm border border-primary-100">{i + 1}</div>
            <div>
              <h3 className="font-bold text-base mb-1 text-slate-800">{s.title}</h3>
              <p className="text-default-500 text-sm">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
};

export const FinalCTA: React.FC = () => {
  return (
    <div className="w-full py-32 text-center px-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-primary-200/20 to-secondary-200/20 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="max-w-3xl mx-auto relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900 tracking-tight">准备好开启 AI 教学变革了吗？</h2>
        <p className="text-default-500 text-lg mb-10 font-light">填写信息，我们的产品专家将在 1 个工作日内与您联系演示。</p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button className="bg-slate-900 hover:bg-slate-800 text-white text-lg font-medium py-3 px-10 rounded-full shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">预约演示</button>
        </div>
      </div>
    </div>
  );
};
