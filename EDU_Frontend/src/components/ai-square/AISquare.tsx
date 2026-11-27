import React, { useMemo, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { SplineScene } from '@/components/ui/splite';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Code2,
  Cpu,
  ExternalLink,
  Layers,
  Map as MapIcon,
  MessageSquare,
  Search,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AGENT_HUB_CATEGORIES,
  AGENT_HUB_SKILLS,
  KIND_META,
  MODEL_META,
} from '@/data/agentHubSkills';
import {
  CAPABILITY_LAYERS,
  ECOSYSTEM_TOOLS,
  FOUNDATION_MODEL_GUIDES,
  TOOL_CATEGORIES,
} from '@/data/aiSquareEcosystem';
import type { AgentHubCategory } from '@/types/agentHub';
import type {
  EcosystemTool,
  FoundationModelGuide,
  ToolCategoryId,
} from '@/types/aiSquareEcosystem';
import { ModelApiModal, ToolTeachingDrawer } from './AISquareModals';
import { SkillIcon } from './SkillIcon';

const MODEL_FALLBACK_ICONS: Record<string, React.ElementType> = {
  'deepseek-v3': Search,
  'qwen-max': MessageSquare,
  'glm-4-plus': Brain,
  'doubao-1-5-pro': MessageSquare,
};

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

  const [activeSkillCategory, setActiveSkillCategory] = useState<'all' | AgentHubCategory>('all');
  const [activeEquipTab, setActiveEquipTab] = useState<'models' | 'tools'>('models');
  const [activeToolCategory, setActiveToolCategory] = useState<'all' | ToolCategoryId>('all');
  const [showAllTools, setShowAllTools] = useState(false);
  const [selectedToolForDrawer, setSelectedToolForDrawer] = useState<EcosystemTool | null>(null);
  const [selectedModelForModal, setSelectedModelForModal] = useState<FoundationModelGuide | null>(null);

  const [heroHovered, setHeroHovered] = useState(false);
  const mouseX = useMotionValue(260);
  const mouseY = useMotionValue(180);
  const glowX = useSpring(mouseX, { stiffness: 220, damping: 28, mass: 0.4 });
  const glowY = useSpring(mouseY, { stiffness: 220, damping: 28, mass: 0.4 });

  const handleHeroMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set(event.clientX - rect.left);
    mouseY.set(event.clientY - rect.top);
  };

  const visibleSkills = useMemo(() => {
    if (activeSkillCategory === 'all') {
      return AGENT_HUB_SKILLS.filter((s) => s.isFeaturedOnSquare).slice(0, 6);
    }
    return AGENT_HUB_SKILLS.filter((s) => s.category === activeSkillCategory);
  }, [activeSkillCategory]);

  const filteredTools = useMemo(() => {
    if (activeToolCategory === 'all') return ECOSYSTEM_TOOLS;
    return ECOSYSTEM_TOOLS.filter((tool) => tool.category === activeToolCategory);
  }, [activeToolCategory]);

  const visibleTools =
    activeToolCategory === 'all' && !showAllTools ? filteredTools.slice(0, 8) : filteredTools;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f9fc] pb-24">
      {/* 柔和氛围背景光斑 */}
      <div className="pointer-events-none absolute inset-0 opacity-65">
        <motion.div
          className="absolute left-[12%] top-0 h-72 w-72 rounded-full bg-blue-200/70 blur-3xl"
          animate={{ x: [0, 18, -8, 0], y: [0, -18, 10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[10%] top-10 h-80 w-80 rounded-full bg-violet-200/70 blur-3xl"
          animate={{ x: [0, -14, 10, 0], y: [0, 14, -14, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-20 md:px-12">
        {/* 1. 紧凑型 Hero（保留 3D 机器人，清晰收敛到 DeepSeek Harness 入口） */}
        <section className="mb-14 grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1 text-xs font-semibold text-slate-700 shadow-sm"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Powered by DeepSeek Harness
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="mt-4 text-4xl font-black tracking-tight text-[#1d1d1f] md:text-6xl"
            >
              AI 广场
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg"
            >
              面向智能体教学的 <strong className="font-semibold text-slate-800">DeepSeek Harness 能力装配站</strong>：挑一个感兴趣的 Skill 或国产模型配置，一键带入工作台实操体验。
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="mt-6 flex flex-wrap gap-3"
            >
              <button
                type="button"
                onClick={() => navigate('/ai-square/harness')}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-primary-600"
              >
                <Terminal className="h-4 w-4" />
                启动 DeepSeek Harness
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate('/ai-square/capability-map')}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
              >
                <MapIcon className="h-4 w-4 text-primary-600" />
                查看能力地图
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-slate-500"
            >
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary-500" />
                {AGENT_HUB_SKILLS.length} 个标准 SKILL.md
              </span>
              <span className="text-slate-300">·</span>
              <span>{FOUNDATION_MODEL_GUIDES.length} 款国产模型 Harness 预设</span>
              <span className="text-slate-300">·</span>
              <span>{ECOSYSTEM_TOOLS.length} 款实训生态工具</span>
            </motion.div>
          </div>

          {/* 保留有趣的 3D 互动机器人（高度收紧，让首屏自然露出下方内容） */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="relative h-[320px] w-full lg:col-span-5 lg:h-[380px]"
            onMouseMove={handleHeroMouseMove}
            onMouseEnter={() => setHeroHovered(true)}
            onMouseLeave={() => setHeroHovered(false)}
          >
            <motion.div
              className="pointer-events-none absolute z-10 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.32)_0%,rgba(147,197,253,0.1)_45%,rgba(255,255,255,0)_75%)] blur-lg"
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

        {/* 2. 核心货架 1：DeepSeek Skills（首页直接支持按场景筛选，一键带入 Harness 体验） */}
        <section className="mb-16">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 md:text-3xl">
                热门教学 Skills
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                全部按 <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-slate-700">@deepseek-ai/dsh-skill</code> 规范编写，选中任意 Skill 即可直接带入 DeepSeek Harness 实操。
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/ai-square/hub')}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-primary-300 hover:text-primary-600"
            >
              浏览全部 {AGENT_HUB_SKILLS.length} 个 Skill 目录
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </button>
          </div>

          {/* 首页直接筛选分类 */}
          <div className="mb-6 flex flex-wrap gap-2">
            {AGENT_HUB_CATEGORIES.map((cat) => {
              const isActive = activeSkillCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveSkillCategory(cat.id)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition md:text-sm ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'border border-slate-200 bg-white/85 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  {cat.id === 'all' ? '精选推荐' : cat.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visibleSkills.map((skill, index) => {
              const modelMeta = MODEL_META[skill.recommendedModel];
              const kindMeta = KIND_META[skill.kind];
              return (
                <motion.article
                  key={skill.slug}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.04, 0.2) }}
                  onClick={() => navigate(`/ai-square/harness?skill=${skill.slug}`)}
                  className="group flex cursor-pointer flex-col rounded-3xl border border-white/75 bg-white/85 p-5 shadow-[0_8px_28px_rgba(15,23,42,0.05)] backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${skill.accentClass}`}
                    >
                      <SkillIcon name={skill.iconName} className="h-5 w-5" />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${modelMeta.badgeClass}`}>
                        {modelMeta.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${kindMeta.className}`}>
                        {kindMeta.label}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900 transition-colors group-hover:text-primary-600">
                      {skill.name}
                    </h3>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                      /{skill.slug}
                    </code>
                  </div>

                  <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-600 md:text-sm">
                    {skill.tagline}
                  </p>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3.5 text-xs">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/ai-square/hub/${skill.slug}?tab=anatomy`);
                      }}
                      className="font-semibold text-slate-500 transition hover:text-slate-900"
                    >
                      原理拆解
                    </button>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 font-semibold text-primary-700 transition group-hover:bg-primary-600 group-hover:text-white">
                      在 Harness 中体验
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>

        {/* 3. 核心货架 2：模型配置 & 实训生态工具（双 Tab 合一，清爽高效） */}
        <section className="mb-16 rounded-3xl border border-white/80 bg-white/80 p-6 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur-md md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 md:text-2xl">
                模型配置与实训工具箱
              </h2>
              <p className="mt-1 text-xs text-slate-500 md:text-sm">
                按需切换：一键生成国产模型 Harness 接入配置，或速查实训开发全链路生态工具。
              </p>
            </div>

            <div className="inline-flex rounded-full bg-slate-100 p-1 text-xs font-semibold md:text-sm">
              <button
                type="button"
                onClick={() => setActiveEquipTab('models')}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 transition ${
                  activeEquipTab === 'models'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Cpu className="h-4 w-4 text-primary-600" />
                Harness 模型配置 ({FOUNDATION_MODEL_GUIDES.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveEquipTab('tools')}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 transition ${
                  activeEquipTab === 'tools'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Wrench className="h-4 w-4 text-primary-600" />
                实训生态工具箱 ({ECOSYSTEM_TOOLS.length})
              </button>
            </div>
          </div>

          {activeEquipTab === 'models' ? (
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              {FOUNDATION_MODEL_GUIDES.map((model) => (
                <div
                  key={model.id}
                  className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                >
                  <div className="mx-auto mb-3 flex h-12 w-24 items-center justify-center rounded-xl border border-slate-100 bg-white px-2">
                    <BrandLogo
                      logoUrl={model.logoUrl}
                      alt={model.name}
                      fallbackText={model.logoText}
                      fallbackIcon={MODEL_FALLBACK_ICONS[model.id]}
                      fallbackIconClass={model.iconClass}
                    />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base font-bold text-slate-900">{model.name}</h3>
                    <p className="text-xs text-slate-400">{model.vendor}</p>
                  </div>

                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {model.strengthTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-blue-100 bg-blue-50/70 px-2 py-0.5 text-[10px] font-semibold text-blue-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <p className="mt-3 flex-1 text-center text-xs leading-relaxed text-slate-600">
                    {model.bestForLabs}
                  </p>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3.5">
                    <button
                      type="button"
                      onClick={() => navigate(`/ai-square/harness?model=${model.id}`)}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-600"
                    >
                      去 Harness 配置
                      <ArrowRight className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedModelForModal(model)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                    >
                      <Code2 className="h-3.5 w-3.5" />
                      YAML / 代码
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {TOOL_CATEGORIES.map((cat) => {
                    const isActive = activeToolCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setActiveToolCategory(cat.id);
                          if (cat.id !== 'all') setShowAllTools(false);
                        }}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                          isActive
                            ? 'bg-slate-900 text-white'
                            : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {activeToolCategory === 'all' && (
                  <button
                    type="button"
                    onClick={() => setShowAllTools((v) => !v)}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                  >
                    {showAllTools ? '收起部分工具' : `展开全部 ${ECOSYSTEM_TOOLS.length} 款 →`}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {visibleTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black ${tool.accentClass}`}
                      >
                        {tool.logoText}
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {tool.accessBadge}
                      </span>
                    </div>

                    <h3 className="mt-3 text-sm font-bold text-slate-900">{tool.name}</h3>
                    <p className="text-[11px] text-slate-400">{tool.vendor}</p>
                    <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-slate-600">
                      {tool.tagline}
                    </p>

                    <div className="mt-3 inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
                      <BookOpen className="h-3 w-3 shrink-0 text-primary-500" />
                      <span className="truncate">{tool.courseLinkLabel}</span>
                    </div>

                    <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => setSelectedToolForDrawer(tool)}
                        className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-100"
                      >
                        教学用法
                      </button>
                      <a
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900"
                      >
                        官网
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 4. 底部收口：L1–L5 能力地图导流条 */}
        <section className="rounded-3xl border border-white/80 bg-white/80 p-6 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur-md md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">不知道先练哪一块？看 AI Agent 五层能力地图</h2>
                <p className="text-xs text-slate-500">
                  从提示词工程（L1）到安全护栏（L5），按成长路线一键联动课程、工具与 Harness 实操。
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/ai-square/capability-map')}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-600"
            >
              <MapIcon className="h-3.5 w-3.5" />
              打开完整能力地图
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-5">
            {CAPABILITY_LAYERS.map((layer) => (
              <button
                key={layer.id}
                type="button"
                onClick={() => navigate(`/ai-square/capability-map?layer=${layer.id}`)}
                className="group flex items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-3 text-left transition hover:border-primary-300 hover:bg-white hover:shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-black ${layer.badgeClass}`}>
                      {layer.level}
                    </span>
                    <span className="truncate text-xs font-bold text-slate-800 group-hover:text-primary-600">
                      {layer.title}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-slate-400">{layer.courseTitle}</div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:translate-x-0.5 group-hover:text-primary-600" />
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* 工具教学用法抽屉 & 模型配置弹窗 */}
      <ToolTeachingDrawer
        tool={selectedToolForDrawer}
        onClose={() => setSelectedToolForDrawer(null)}
      />
      <ModelApiModal
        model={selectedModelForModal}
        onClose={() => setSelectedModelForModal(null)}
      />
    </div>
  );
};

export default AISquare;
