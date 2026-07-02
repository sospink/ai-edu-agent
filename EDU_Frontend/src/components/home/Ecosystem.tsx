import { useMarketingText } from '@/i18n/marketingText';
import React from 'react';
import Section from '@/components/common/Section';
import { CheckCircle2 } from 'lucide-react';
const Ecosystem: React.FC = () => {
    const mt = useMarketingText();
    const partners = [
        { name: mt("Ecosystem.c1"), product: mt("Ecosystem.c2") },
        { name: mt("Ecosystem.c3"), product: "GLM" },
        { name: mt("Ecosystem.c4"), product: mt("Ecosystem.c5") },
        { name: mt("Ecosystem.c6"), product: mt("Ecosystem.c7") },
    ];
    const reasons = [
        { title: mt("Ecosystem.c8"), desc: mt("Ecosystem.c9") },
        { title: mt("Ecosystem.c10"), desc: mt("Ecosystem.c11") },
        { title: mt("Ecosystem.c12"), desc: mt("Ecosystem.c13") },
    ];
    return (<Section title={mt("Ecosystem.c14")} subtitle={mt("Ecosystem.c15")}>
      <div className="flex flex-wrap justify-center gap-4 mb-16">
        {partners.map((p, i) => (<div key={i} className="w-40 h-24 bg-white/60 backdrop-blur-sm border border-white/50 rounded-2xl flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow">
            <span className="font-bold text-slate-800">{p.name}</span>
            <span className="text-xs text-default-400 mt-1">{p.product}</span>
          </div>))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {reasons.map((r, i) => (<div key={i} className="flex flex-col items-center text-center p-8 bg-white/40 border border-white/60 rounded-2xl">
            <div className="mb-4 p-3 bg-success-50 text-success-600 rounded-full">
              <CheckCircle2 className="w-6 h-6"/>
            </div>
            <h3 className="font-bold text-lg mb-2 text-slate-800">{r.title}</h3>
            <p className="text-default-500 text-sm leading-relaxed">{r.desc}</p>
          </div>))}
      </div>
    </Section>);
};
export default Ecosystem;
