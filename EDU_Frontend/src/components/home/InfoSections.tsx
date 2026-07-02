import { useMarketingText } from '@/i18n/marketingText';
import React from 'react';
import Section from '@/components/common/Section';
import { BookOpen, PenTool, Award, Trophy } from 'lucide-react';
export const Scenarios: React.FC = () => {
    const mt = useMarketingText();
    const items = [
        { title: mt("InfoSections.c1"), desc: mt("InfoSections.c2"), icon: BookOpen },
        { title: mt("InfoSections.c3"), desc: mt("InfoSections.c4"), icon: PenTool },
        { title: mt("InfoSections.c5"), desc: mt("InfoSections.c6"), icon: Award },
        { title: mt("InfoSections.c7"), desc: mt("InfoSections.c8"), icon: Trophy },
    ];
    return (<Section title={mt("InfoSections.c9")} subtitle={mt("InfoSections.c10")}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {items.map((item, i) => (<div key={i} className="bg-white/50 border border-white/60 p-6 rounded-2xl text-center hover:bg-white hover:shadow-lg transition-all">
            <div className="w-12 h-12 mx-auto bg-white shadow-sm rounded-full flex items-center justify-center mb-4 text-default-700">
              <item.icon className="w-5 h-5"/>
            </div>
            <h3 className="font-bold text-base mb-1 text-slate-800">{item.title}</h3>
            <p className="text-default-500 text-xs">{item.desc}</p>
          </div>))}
      </div>
    </Section>);
};
export const MarketDemand: React.FC = () => {
    const mt = useMarketingText();
    const stats = [
        { value: "500+", label: mt("InfoSections.c11") },
        { value: "2.3x", label: mt("InfoSections.c12") },
        { value: "600w", label: mt("InfoSections.c13") },
        { value: "60%", label: mt("InfoSections.c14") },
    ];
    return (<section className="w-full py-24 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative overflow-hidden rounded-[3rem] mx-auto max-w-[95%] shadow-2xl">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/20 blur-[100px] rounded-full"></div>
      <div className="max-w-7xl mx-auto px-8 relative z-10 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">{mt("InfoSections.c15")}</h2>
        <p className="text-slate-300 max-w-2xl mx-auto mb-16 font-light">{mt("InfoSections.c16")}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {stats.map((s, i) => (<div key={i} className="flex flex-col items-center">
              <div className="text-5xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">{s.value}</div>
              <div className="text-sm text-slate-400 uppercase tracking-wider">{s.label}</div>
            </div>))}
        </div>
      </div>
    </section>);
};
export const ServiceSupport: React.FC = () => {
    const mt = useMarketingText();
    const services = [
        { title: mt("InfoSections.c17"), desc: mt("InfoSections.c18") },
        { title: mt("InfoSections.c19"), desc: mt("InfoSections.c20") },
        { title: mt("InfoSections.c21"), desc: mt("InfoSections.c22") },
        { title: mt("InfoSections.c23"), desc: mt("InfoSections.c24") },
        { title: mt("InfoSections.c25"), desc: mt("InfoSections.c26") },
        { title: mt("InfoSections.c27"), desc: mt("InfoSections.c28") },
    ];
    return (<Section title={mt("InfoSections.c29")}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {services.map((s, i) => (<div key={i} className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/50 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 font-bold text-sm border border-primary-100">{i + 1}</div>
            <div>
              <h3 className="font-bold text-base mb-1 text-slate-800">{s.title}</h3>
              <p className="text-default-500 text-sm">{s.desc}</p>
            </div>
          </div>))}
      </div>
    </Section>);
};
export const FinalCTA: React.FC = () => {
    const mt = useMarketingText();
    return (<div className="w-full py-32 text-center px-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-primary-200/20 to-secondary-200/20 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="max-w-3xl mx-auto relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900 tracking-tight">{mt("InfoSections.c30")}</h2>
        <p className="text-default-500 text-lg mb-10 font-light">{mt("InfoSections.c31")}</p>
      </div>
    </div>);
};
