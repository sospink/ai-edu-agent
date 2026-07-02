import { useMarketingText } from '@/i18n/marketingText';
import React from 'react';
import Section from '@/components/common/Section';
import { Server, Users, TrendingDown, BookOpen, Cloud, UserCheck, Briefcase, GraduationCap } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.1,
            duration: 0.5,
            ease: [0.215, 0.61, 0.355, 1],
        },
    }),
};
const BentoCard = ({ children, className = "" }: {
    children: React.ReactNode;
    className?: string;
}) => (<div className={`bg-white/60 backdrop-blur-md border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-8 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 ${className}`}>
    {children}
  </div>);
export const PainPoints: React.FC = () => {
    const mt = useMarketingText();
    const points = [
        { title: mt("Features.c1"), desc: mt("Features.c2"), icon: BookOpen, details: [mt("Features.c3"), mt("Features.c4"), mt("Features.c5")] },
        { title: mt("Features.c6"), desc: mt("Features.c7"), icon: Server, details: [mt("Features.c8"), mt("Features.c9"), mt("Features.c10")] },
        { title: mt("Features.c11"), desc: mt("Features.c12"), icon: Users, details: [mt("Features.c13"), mt("Features.c14"), mt("Features.c15")] },
        { title: mt("Features.c16"), desc: mt("Features.c17"), icon: TrendingDown, details: [mt("Features.c18"), mt("Features.c19"), mt("Features.c20")] }
    ];
    return (<Section title={mt("Features.c21")} subtitle={mt("Features.c22")}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {points.map((p, i) => (<motion.div key={i} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={cardVariants}>
            <BentoCard className="h-full flex flex-col items-center text-center hover:border-danger-200/50 group">
              <div className="p-4 bg-danger-50/50 text-danger-500 rounded-2xl mb-6 group-hover:bg-danger-500 group-hover:text-white transition-colors duration-300 shadow-sm">
                <p.icon className="w-6 h-6"/>
              </div>
              <h3 className="text-lg font-bold mb-3 text-slate-800">{p.title}</h3>
              <p className="text-default-500 text-sm mb-6 leading-relaxed">{p.desc}</p>
              <div className="mt-auto w-full pt-4 border-t border-dashed border-default-200">
                <div className="flex flex-wrap justify-center gap-2">
                  {p.details.map((d, idx) => (<span key={idx} className="text-[10px] px-2 py-1 bg-default-100 rounded-full text-default-500">{d}</span>))}
                </div>
              </div>
            </BentoCard>
          </motion.div>))}
      </div>
    </Section>);
};
export const Solutions: React.FC = () => {
    const mt = useMarketingText();
    const values = [
        { title: mt("Features.c23"), icon: BookOpen, desc: mt("Features.c24"), colSpan: "md:col-span-2" },
        { title: mt("Features.c25"), icon: Cloud, desc: mt("Features.c26"), colSpan: "md:col-span-1" },
        { title: mt("Features.c27"), icon: UserCheck, desc: mt("Features.c28"), colSpan: "md:col-span-1" },
        { title: mt("Features.c29"), icon: Briefcase, desc: mt("Features.c30"), colSpan: "md:col-span-1" },
        { title: mt("Features.c31"), icon: GraduationCap, desc: mt("Features.c32"), colSpan: "md:col-span-1" },
    ];
    return (<Section title={mt("Features.c33")} subtitle={mt("Features.c34")}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(180px,auto)]">
        {values.map((v, i) => (<motion.div key={i} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={cardVariants} className={`${v.colSpan}`}>
            <BentoCard className="h-full relative overflow-hidden group border-white/60">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                <v.icon className="w-32 h-32 text-primary-500"/>
              </div>
              <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                <v.icon className="w-6 h-6"/>
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-800">{v.title}</h3>
              <p className="text-default-500 leading-relaxed relative z-10">{v.desc}</p>
            </BentoCard>
          </motion.div>))}
      </div>
    </Section>);
};
