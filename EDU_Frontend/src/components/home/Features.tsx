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

const BentoCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white/60 backdrop-blur-md border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-8 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 ${className}`}>
    {children}
  </div>
);

export const PainPoints: React.FC = () => {
  const points = [
    { title: "课程体系碎片化", desc: "缺乏系统化的教学体系和配套教材。", icon: BookOpen, details: ["内容零散", "缺乏路径", "理论脱节"] },
    { title: "实训环境搭建难", desc: "GPU算力成本高，环境配置复杂。", icon: Server, details: ["成本高昂", "配置复杂", "资源争抢"] },
    { title: "师资力量薄弱", desc: "缺乏实战经验和教学资源。", icon: Users, details: ["了解不深", "缺少课件", "批改量大"] },
    { title: "就业竞争力不足", desc: "技能与企业需求脱节。", icon: TrendingDown, details: ["技术栈不一", "无项目经验", "只会理论"] }
  ];

  return (
    <Section title="AI专业建设面临的挑战" subtitle="高校在开设AI智能体相关课程时，普遍面临课程体系不完善、实训环境搭建难等问题。">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {points.map((p, i) => (
          <motion.div key={i} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={cardVariants}>
            <BentoCard className="h-full flex flex-col items-center text-center hover:border-danger-200/50 group">
              <div className="p-4 bg-danger-50/50 text-danger-500 rounded-2xl mb-6 group-hover:bg-danger-500 group-hover:text-white transition-colors duration-300 shadow-sm">
                <p.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-3 text-slate-800">{p.title}</h3>
              <p className="text-default-500 text-sm mb-6 leading-relaxed">{p.desc}</p>
              <div className="mt-auto w-full pt-4 border-t border-dashed border-default-200">
                <div className="flex flex-wrap justify-center gap-2">
                  {p.details.map((d, idx) => (
                    <span key={idx} className="text-[10px] px-2 py-1 bg-default-100 rounded-full text-default-500">{d}</span>
                  ))}
                </div>
              </div>
            </BentoCard>
          </motion.div>
        ))}
      </div>
    </Section>
  );
};

export const Solutions: React.FC = () => {
  const values = [
    { title: "完整课程体系", icon: BookOpen, desc: "六层技能树，75+门课程，覆盖基础到Multi-Agent。", colSpan: "md:col-span-2" },
    { title: "云端实训环境", icon: Cloud, desc: "开箱即用，集成VSCode/Jupyter。", colSpan: "md:col-span-1" },
    { title: "教师减负增效", icon: UserCheck, desc: "代码自动批改、数据看板、预警机制。", colSpan: "md:col-span-1" },
    { title: "产教深度融合", icon: Briefcase, desc: "与阿里/字节/华为/腾讯合作，基于真实场景。", colSpan: "md:col-span-1" },
    { title: "配套师资培训", icon: GraduationCap, desc: "完整的教师培训方案，助力快速上手。", colSpan: "md:col-span-1" },
  ];

  return (
    <Section title="核心价值" subtitle="一站式解决方案，降低教学成本，提升教学质量。">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(180px,auto)]">
        {values.map((v, i) => (
          <motion.div key={i} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={cardVariants} className={`${v.colSpan}`}>
            <BentoCard className="h-full relative overflow-hidden group border-white/60">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
                <v.icon className="w-32 h-32 text-primary-500" />
              </div>
              <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                <v.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-800">{v.title}</h3>
              <p className="text-default-500 leading-relaxed relative z-10">{v.desc}</p>
            </BentoCard>
          </motion.div>
        ))}
      </div>
    </Section>
  );
};
