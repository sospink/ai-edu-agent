import React from 'react';
import Section from '@/components/common/Section';
import { CheckCircle2 } from 'lucide-react';

const Ecosystem: React.FC = () => {
  const partners = [
    { name: "阿里云", product: "通义千问" },
    { name: "智谱 AI", product: "GLM" },
    { name: "华为云", product: "盘古" },
    { name: "腾讯云", product: "混元" },
  ];

  const reasons = [
    { title: "国家战略导向", desc: "落实科技自立自强，培养国产技术人才。" },
    { title: "产业真实需求", desc: "掌握企业主流技术栈，提升就业竞争力。" },
    { title: "教学成本优势", desc: "国产API价格优惠，降低50-70%成本。" },
  ];

  return (
    <Section title="深度集成国内 AI 生态" subtitle="连接头部厂商，培养符合中国产业需求的人才">
      <div className="flex flex-wrap justify-center gap-4 mb-16">
        {partners.map((p, i) => (
          <div key={i} className="w-40 h-24 bg-white/60 backdrop-blur-sm border border-white/50 rounded-2xl flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow">
            <span className="font-bold text-slate-800">{p.name}</span>
            <span className="text-xs text-default-400 mt-1">{p.product}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {reasons.map((r, i) => (
          <div key={i} className="flex flex-col items-center text-center p-8 bg-white/40 border border-white/60 rounded-2xl">
            <div className="mb-4 p-3 bg-success-50 text-success-600 rounded-full">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg mb-2 text-slate-800">{r.title}</h3>
            <p className="text-default-500 text-sm leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
};

export default Ecosystem;
