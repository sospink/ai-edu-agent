import React, { useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { SplineScene } from '@/components/ui/splite';
import {
  ArrowRight,
  Bot,
  Brain,
  Briefcase,
  Bug,
  Code2,
  Image,
  Megaphone,
  MessageSquare,
  Music,
  Search,
  Sparkles,
  Star,
  Video,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type FeaturedTool = {
  id: string;
  name: string;
  vendor: string;
  desc: string;
  icon: React.ElementType;
  logoText: string;
  colorClass: string;
  score: string;
  url: string;
};

type FoundationModel = {
  id: string;
  name: string;
  vendor: string;
  desc: string;
  icon?: React.ElementType;
  logoText: string;
  iconClass?: string;
  logoUrl?: string;
  url: string;
};

const featuredTools: FeaturedTool[] = [
  {
    id: 'banana2',
    name: 'Banana2',
    vendor: 'AI 视频生成',
    desc: '热门视频生成工具，适合用于课程项目中的短片创作与内容展示。',
    icon: Video,
    logoText: 'BN2',
    colorClass: 'bg-yellow-100 text-yellow-700',
    score: '4.9',
    url: '#',
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    vendor: 'Agent Runtime',
    desc: 'Agent 任务执行与控制台能力，适合多步骤自动化实验与实战演练。',
    icon: Bot,
    logoText: 'OC',
    colorClass: 'bg-emerald-100 text-emerald-700',
    score: '4.8',
    url: '#',
  },
  {
    id: 'seedance2',
    name: 'Seedance2',
    vendor: '多模态创作',
    desc: '支持图文到视频的快速生成，适合课堂演示、脚本可视化和创意实践。',
    icon: Image,
    logoText: 'SD2',
    colorClass: 'bg-pink-100 text-pink-700',
    score: '4.8',
    url: '#',
  },
  {
    id: 'dify',
    name: 'Dify',
    vendor: 'LLM 应用平台',
    desc: '工作流与应用编排能力成熟，适合课程中的智能体应用搭建与演示。',
    icon: Code2,
    logoText: 'DF',
    colorClass: 'bg-indigo-100 text-indigo-700',
    score: '4.7',
    url: 'https://dify.ai/',
  },
  {
    id: 'coze',
    name: 'Coze',
    vendor: '智能体平台',
    desc: '快速构建与发布 Bot/Agent，适合教学场景中的低门槛智能体开发。',
    icon: Bot,
    logoText: 'CZ',
    colorClass: 'bg-sky-100 text-sky-700',
    score: '4.7',
    url: 'https://www.coze.cn/',
  },
];

type OpenClawScene = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
  logoText: string;
  dotColor: string;
};

const openClawScenes: OpenClawScene[] = [
  {
    id: 'presales',
    title: '售前工程师',
    subtitle: '方案设计 · 需求分析',
    description: '围绕客户需求梳理、技术路线设计、解决方案书与商务报价进行一体化输出。',
    icon: Briefcase,
    colorClass: 'bg-sky-100 text-sky-700',
    logoText: 'PE',
    dotColor: '#0ea5e9',
  },
  {
    id: 'marketing',
    title: '品牌营销专家',
    subtitle: '品牌定位 · 传播策略',
    description: '聚焦品牌定位、市场洞察、传播策略和年度营销方案的结构化协同产出。',
    icon: Megaphone,
    colorClass: 'bg-emerald-100 text-emerald-700',
    logoText: 'MK',
    dotColor: '#10b981',
  },
  {
    id: 'fullstack',
    title: '全栈开发工程师',
    subtitle: '源码开发 · 部署上线',
    description: '覆盖需求分析、技术选型、架构设计、源码实现、测试与部署全链路交付。',
    icon: Code2,
    colorClass: 'bg-amber-100 text-amber-700',
    logoText: 'FS',
    dotColor: '#f59e0b',
  },
  {
    id: 'qa',
    title: '软件质量工程师',
    subtitle: '缺陷评估 · 回归验证',
    description: '聚焦代码缺陷评估、回归测试、修复方案验证与最终交付质量闭环。',
    icon: Bug,
    colorClass: 'bg-violet-100 text-violet-700',
    logoText: 'QA',
    dotColor: '#8b5cf6',
  },
];

const foundationModels: FoundationModel[] = [
  {
    id: 'qwen-max',
    name: '通义千问',
    vendor: '阿里云',
    desc: '覆盖文本、代码与多模态能力，适合企业级中文场景和教学落地。',
    icon: MessageSquare,
    logoText: 'QW',
    iconClass: 'text-amber-600',
    logoUrl: 'https://img.alicdn.com/imgextra/i4/O1CN01P8z9P91OBXM3D0VOt_!!6000000001667-2-tps-174-60.png',
    url: 'https://tongyi.aliyun.com/',
  },
  {
    id: 'glm-4-plus',
    name: 'GLM-4',
    vendor: '智谱 AI',
    desc: '在中文理解和复杂推理任务上表现稳定，适配教育与开发场景。',
    icon: Brain,
    logoText: 'GLM',
    iconClass: 'text-violet-600',
    logoUrl: 'https://www.zhipuai.cn/logo.svg',
    url: 'https://open.bigmodel.cn/',
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek',
    vendor: '深度求索',
    desc: '代码与推理能力突出，适合实训课程中的编程与问题求解任务。',
    icon: Search,
    logoText: 'DS',
    iconClass: 'text-blue-600',
    logoUrl: 'https://cdn.deepseek.com/logo.png?x-image-process=image%2Fresize%2Cw_1920',
    url: 'https://www.deepseek.com/',
  },
  {
    id: 'doubao-1-5-pro',
    name: '豆包大模型',
    vendor: '字节跳动',
    desc: '面向中文交互与应用集成，适合教育场景的对话和内容生成任务。',
    icon: MessageSquare,
    logoText: 'DB',
    iconClass: 'text-rose-600',
    logoUrl: 'https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/samantha/logo-icon-white-bg.png',
    url: 'https://www.doubao.com/',
  },
];

function BrandLogo({
  logoUrl,
  alt,
  fallbackText,
  fallbackIcon: FallbackIcon,
  fallbackIconClass,
}: {
  logoUrl?: string;
  alt: string;
  fallbackText: string;
  fallbackIcon?: React.ElementType;
  fallbackIconClass?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (logoUrl && !broken) {
    return (
      <img
        src={logoUrl}
        alt={alt}
        className="h-full w-full object-contain"
        onError={() => setBroken(true)}
        loading="lazy"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      {FallbackIcon ? <FallbackIcon className={`h-6 w-6 ${fallbackIconClass || 'text-slate-500'}`} /> : null}
      <span className="mt-1 text-[10px] font-bold text-slate-500">{fallbackText}</span>
    </div>
  );
}

const AISquare: React.FC = () => {
  const navigate = useNavigate();
  const [heroHovered, setHeroHovered] = useState(false);
  const mouseX = useMotionValue(300);
  const mouseY = useMotionValue(220);
  const glowX = useSpring(mouseX, { stiffness: 220, damping: 28, mass: 0.4 });
  const glowY = useSpring(mouseY, { stiffness: 220, damping: 28, mass: 0.4 });

  const handleHeroMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set(event.clientX - rect.left);
    mouseY.set(event.clientY - rect.top);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f9fc] pb-20">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <motion.div
          className="absolute left-[12%] top-0 h-80 w-80 rounded-full bg-blue-200/70 blur-3xl"
          animate={{ x: [0, 18, -8, 0], y: [0, -22, 10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-10 h-96 w-96 rounded-full bg-violet-200/70 blur-3xl"
          animate={{ x: [0, -16, 10, 0], y: [0, 14, -18, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-10 left-[32%] h-80 w-80 rounded-full bg-pink-200/60 blur-3xl"
          animate={{ x: [0, 12, -14, 0], y: [0, -10, 18, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-20 md:px-12">
        <section className="mb-28 grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              全新：Agent Hub 2.0
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mt-6 text-5xl font-black leading-tight text-[#1d1d1f] md:text-7xl"
            >
              Agent Hub
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600"
            >
              统一聚合模型、工具与智能体能力，面向教学、实训与项目协作提供一站式 Agent Hub 入口。
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="mt-8 flex flex-wrap gap-4"
            >
              <button className="rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:bg-blue-600">
                进入 Agent Hub
              </button>
              <button className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300">
                查看能力地图
              </button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative h-[420px] w-full lg:h-[500px]"
            onMouseMove={handleHeroMouseMove}
            onMouseEnter={() => setHeroHovered(true)}
            onMouseLeave={() => setHeroHovered(false)}
          >
            <motion.div
              className="pointer-events-none absolute z-10 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.32)_0%,rgba(147,197,253,0.1)_45%,rgba(255,255,255,0)_75%)] blur-lg"
              style={{ left: glowX, top: glowY }}
              animate={{ opacity: heroHovered ? 1 : 0 }}
              transition={{ duration: 0.22 }}
            />
            <SplineScene
              scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
              className="relative z-0 h-full w-full"
            />
          </motion.div>
        </section>

        <section className="mb-24">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">推荐工具</h2>
              <p className="mt-1 text-sm text-slate-500">专为教学与实训工作流精选。</p>
            </div>
            <button className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700">
              查看全部
              <ArrowRight className="ml-1 h-4 w-4" />
            </button>
          </div>

          <div className="marquee-container relative overflow-hidden">
            {/* 左右淡出遮罩 */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-r from-[#f7f9fc] to-transparent" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-l from-[#f7f9fc] to-transparent" />
            <div className="marquee-track flex gap-5 pb-4">
              {[...featuredTools, ...featuredTools].map((tool, index) => (
                <a
                  key={`${tool.id}-${index}`}
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group w-[240px] flex-shrink-0 rounded-3xl border border-white/60 bg-white/75 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.06)] backdrop-blur transition-all hover:shadow-xl hover:-translate-y-1"
                >
                  <div className={`mb-5 flex h-12 w-12 flex-col items-center justify-center rounded-xl ${tool.colorClass}`}>
                    <tool.icon className="h-4 w-4" />
                    <span className="mt-0.5 text-[9px] font-bold leading-none">{tool.logoText}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">{tool.name}</h3>
                  <p className="mt-1 text-xs font-medium text-slate-400">{tool.vendor}</p>
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">{tool.desc}</p>
                  <div className="mt-4 flex items-center text-xs font-semibold text-slate-400">
                    <Star className="mr-1 h-3.5 w-3.5 fill-current text-amber-400" />
                    {tool.score}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ====== OpenClaw 工作场景 ====== */}
        <section className="mb-24">
          <div className="mb-10 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.06 }}
              className="text-3xl font-bold text-slate-900"
            >
              OpenClaw
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.12 }}
              className="mx-auto mt-3 max-w-2xl text-sm text-slate-500"
            >
              选择一个真实工作场景，体验 OpenClaw 如何通过 Agent 自主完成多步骤任务编排与执行。
            </motion.p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {openClawScenes.map((scene, index) => (
              <motion.div
                key={scene.id}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                onClick={() => navigate('/openclaw')}
                className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-7 shadow-[0_8px_28px_rgba(15,23,42,0.06)] backdrop-blur transition-all hover:shadow-xl hover:-translate-y-1"
              >
                {/* 图标 */}
                <div className={`mb-5 flex h-12 w-12 flex-col items-center justify-center rounded-xl ${scene.colorClass}`}>
                  <scene.icon className="h-4 w-4" />
                  <span className="mt-0.5 text-[9px] font-bold leading-none">{scene.logoText}</span>
                </div>

                {/* 标题 */}
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-slate-900 transition-colors">
                  {scene.title}
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-400">{scene.subtitle}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 line-clamp-2">
                  {scene.description}
                </p>

                {/* 底部操作指示 */}
                <div className="mt-5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: scene.dotColor }} />
                      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: scene.dotColor }} />
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ready</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1">
                    启动场景
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-slate-900">基础模型</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-500">
              驱动下一代应用的核心引擎，可按教学目标灵活组合与接入。
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {foundationModels.map((model, index) => (
              <motion.a
                key={model.id}
                href={model.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col rounded-3xl border border-white/60 bg-white/80 p-7 text-center shadow-[0_8px_28px_rgba(15,23,42,0.06)] backdrop-blur transition hover:bg-white"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
              >
                <div className="mx-auto mb-5 flex h-16 w-28 items-center justify-center rounded-2xl border border-slate-100 bg-white px-3">
                  <BrandLogo
                    logoUrl={model.logoUrl}
                    alt={model.name}
                    fallbackText={model.logoText}
                    fallbackIcon={model.icon}
                    fallbackIconClass={model.iconClass}
                  />
                </div>
                <h3 className="text-lg font-bold text-slate-800">{model.name}</h3>
                <p className="mt-1 text-xs font-medium text-slate-400">{model.vendor}</p>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-600">{model.desc}</p>
                <span className="mt-6 inline-flex items-center justify-center text-sm font-semibold text-blue-600 opacity-0 transition group-hover:opacity-100">
                  探索
                  <ArrowRight className="ml-1 h-4 w-4" />
                </span>
              </motion.a>
            ))}
          </div>
        </section>

      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        @keyframes marqueeScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-track {
          animation: marqueeScroll 30s linear infinite;
        }
        .marquee-container:hover .marquee-track {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default AISquare;
