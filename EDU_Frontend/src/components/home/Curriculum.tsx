import { useMarketingText } from '@/i18n/marketingText';
import React from 'react';
import Section from '@/components/common/Section';
import { Monitor, Presentation, Settings, CheckCircle2, Terminal, Code2, GitBranch, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
export const Curriculum: React.FC = () => {
    const mt = useMarketingText();
    const stages = [
        { label: "Phase 01", title: mt("Curriculum.c1"), time: mt("Curriculum.c2"), desc: mt("Curriculum.c3"), items: [mt("Curriculum.c4"), mt("Curriculum.c5"), mt("Curriculum.c6"), "Prompt Engineering", mt("Curriculum.c7")] },
        { label: "Phase 02", title: mt("Curriculum.c8"), time: mt("Curriculum.c9"), desc: mt("Curriculum.c10"), items: ["Function Calling", mt("Curriculum.c11"), mt("Curriculum.c12"), mt("Curriculum.c13"), mt("Curriculum.c14")] },
        { label: "Phase 03", title: mt("Curriculum.c15"), time: mt("Curriculum.c16"), desc: mt("Curriculum.c17"), items: [mt("Curriculum.c18"), mt("Curriculum.c19"), mt("Curriculum.c20"), mt("Curriculum.c21"), mt("Curriculum.c22")] },
    ];
    return (<Section title={mt("Curriculum.c23")} subtitle={mt("Curriculum.c24")}>
      <div className="relative">
        <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-primary-100 via-secondary-100 to-primary-100 -translate-y-1/2 rounded-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
          {stages.map((s, i) => (<motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.2 }} className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl p-8 hover:shadow-xl hover:shadow-primary/5 transition-all group">
              <div className="mb-6 flex justify-between items-center">
                <span className="text-xs font-bold tracking-widest text-primary-500 uppercase">{s.label}</span>
                <span className="text-xs font-medium text-default-400 bg-default-100 px-2 py-1 rounded-full">{s.time}</span>
              </div>
              <h3 className="text-2xl font-bold mb-2 group-hover:text-primary-600 transition-colors">{s.title}</h3>
              <p className="text-sm text-default-500 mb-6">{s.desc}</p>
              <div className="space-y-3">
                {s.items.map((item, idx) => (<div key={idx} className="flex items-center text-sm text-default-600">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary-400 mr-3"></div>
                    {item}
                  </div>))}
              </div>
            </motion.div>))}
        </div>
      </div>
    </Section>);
};
export const Platform: React.FC = () => {
    const mt = useMarketingText();
    const roles = [
        { title: mt("Curriculum.c25"), icon: Monitor, features: [mt("Curriculum.c26"), mt("Curriculum.c27"), mt("Curriculum.c28"), mt("Curriculum.c29")] },
        { title: mt("Curriculum.c30"), icon: Presentation, features: [mt("Curriculum.c31"), mt("Curriculum.c32"), mt("Curriculum.c33"), mt("Curriculum.c34")] },
        { title: mt("Curriculum.c35"), icon: Settings, features: [mt("Curriculum.c36"), mt("Curriculum.c37"), mt("Curriculum.c38"), mt("Curriculum.c39")] },
    ];
    return (<Section title={mt("Curriculum.c40")} subtitle={mt("Curriculum.c41")}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {roles.map((r, i) => (<div key={i} className="bg-gradient-to-b from-white to-default-50/50 p-8 rounded-2xl border border-white/60 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="w-14 h-14 bg-white rounded-xl shadow-md flex items-center justify-center mb-6 text-primary-600 border border-default-100">
              <r.icon className="w-7 h-7"/>
            </div>
            <h3 className="text-xl font-bold mb-6">{r.title}</h3>
            <ul className="space-y-4">
              {r.features.map((f, idx) => (<li key={idx} className="flex items-center text-default-600 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-success-500 mr-3 shrink-0"/>
                  <span>{f}</span>
                </li>))}
            </ul>
          </div>))}
      </div>
    </Section>);
};
export const LearningModes: React.FC = () => {
    const mt = useMarketingText();
    const modes = [
        { name: mt("Curriculum.c42"), icon: Terminal, desc: "Step-by-step guidance", phase: mt("Curriculum.c43") },
        { name: "Agent Coding", icon: Code2, desc: "Browser-based IDE", phase: mt("Curriculum.c44") },
        { name: mt("Curriculum.c45"), icon: GitBranch, desc: "Role-playing tasks", phase: mt("Curriculum.c46") },
        { name: mt("Curriculum.c47"), icon: Layers, desc: "Drag & drop builder", phase: mt("Curriculum.c48") },
    ];
    return (<Section title={mt("Curriculum.c49")} subtitle={mt("Curriculum.c50")}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {modes.map((m, i) => (<div key={i} className="group relative bg-white/70 backdrop-blur border border-white/50 p-6 rounded-2xl hover:bg-white transition-colors">
            <div className="absolute top-4 right-4 text-xs font-mono text-default-300 group-hover:text-primary-400 transition-colors">{m.phase}</div>
            <div className="w-10 h-10 bg-default-50 rounded-lg flex items-center justify-center text-default-500 mb-4 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
              <m.icon className="w-5 h-5"/>
            </div>
            <h4 className="font-bold text-base mb-1">{m.name}</h4>
            <p className="text-xs text-default-400">{m.desc}</p>
          </div>))}
      </div>
    </Section>);
};
