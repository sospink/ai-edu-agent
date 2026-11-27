import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Cpu,
  Layers,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AGENT_HUB_CATEGORIES,
  AGENT_HUB_SKILLS,
  DIFFICULTY_META,
  KIND_META,
  MODEL_META,
} from '@/data/agentHubSkills';
import type { AgentHubCategory, RecommendedModel, SkillKind } from '@/types/agentHub';
import { SkillIcon } from './SkillIcon';

const AgentHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCategory = (searchParams.get('category') as 'all' | AgentHubCategory) || 'all';
  const [activeCategory, setActiveCategory] = useState<'all' | AgentHubCategory>(
    AGENT_HUB_CATEGORIES.some((c) => c.id === initialCategory) ? initialCategory : 'all'
  );
  const [activeModel, setActiveModel] = useState<'all' | RecommendedModel>('all');
  const [activeKind, setActiveKind] = useState<'all' | SkillKind>('all');
  const [query, setQuery] = useState('');

  const handleCategoryChange = (cat: 'all' | AgentHubCategory) => {
    setActiveCategory(cat);
    const next = new URLSearchParams(searchParams);
    if (cat === 'all') {
      next.delete('category');
    } else {
      next.set('category', cat);
    }
    setSearchParams(next, { replace: true });
  };

  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AGENT_HUB_SKILLS.filter((skill) => {
      if (activeCategory !== 'all' && skill.category !== activeCategory) return false;
      if (activeModel !== 'all' && skill.recommendedModel !== activeModel) return false;
      if (activeKind !== 'all' && skill.kind !== activeKind) return false;
      if (!q) return true;
      const haystack = [
        skill.name,
        skill.slug,
        skill.tagline,
        skill.description,
        skill.relatedCourseTitle,
        ...skill.tags,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [activeCategory, activeModel, activeKind, query]);

  const hasActiveFilters =
    activeCategory !== 'all' || activeModel !== 'all' || activeKind !== 'all' || query.trim() !== '';

  const resetFilters = () => {
    handleCategoryChange('all');
    setActiveModel('all');
    setActiveKind('all');
    setQuery('');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f9fc] pb-24">
      {/* 柔和氛围背景光斑 */}
      <div className="pointer-events-none absolute inset-0 opacity-65">
        <div className="absolute left-[8%] top-0 h-80 w-80 rounded-full bg-blue-200/60 blur-3xl" />
        <div className="absolute right-[10%] top-12 h-96 w-96 rounded-full bg-violet-200/60 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-24 md:px-12">
        {/* 面包屑与返回 */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link
              to="/ai-square"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回 AI 广场
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-800">Agent Hub</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-3.5 py-1 text-xs font-semibold text-blue-700">
            <Sparkles className="h-3.5 w-3.5" />
            {AGENT_HUB_CATEGORIES.length - 1} 类场景 · {AGENT_HUB_SKILLS.length} 个教学 Skill
          </div>
        </div>

        {/* 顶部标题 + 搜索区 */}
        <section className="mb-8 rounded-3xl border border-white/70 bg-white/75 p-7 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur-md md:p-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                DeepSeek Skill Workshop
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
                Agent Hub
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-base">
                面向教学与实训的标准化 AI Skill 工坊：每个 Skill 都支持
                <span className="font-semibold text-slate-800"> 一键试玩演示</span>、
                <span className="font-semibold text-slate-800"> System Prompt 透明拆解</span> 与
                <span className="font-semibold text-slate-800"> 导出 SKILL.md / Python 代码复现</span>。
              </p>
            </div>

            {/* 搜索框 */}
            <div className="w-full lg:w-[380px]">
              <div className="relative flex h-12 items-center rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(248,250,252,0.97))] shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_rgba(15,23,42,0.06)] transition focus-within:border-primary-500 focus-within:ring-4 focus-within:ring-primary-500/10">
                <Search className="ml-4 h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索 Skill、场景、标签或关联课程…"
                  className="h-full w-full bg-transparent px-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="mr-3 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    aria-label="清空搜索"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 分类 Tab */}
          <div className="mt-7 flex flex-wrap gap-2 border-t border-slate-100 pt-6">
            {AGENT_HUB_CATEGORIES.map((cat) => {
              const count =
                cat.id === 'all'
                  ? AGENT_HUB_SKILLS.length
                  : AGENT_HUB_SKILLS.filter((s) => s.category === cat.id).length;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15'
                      : 'border border-slate-200 bg-white/90 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 模型 & 形态二次筛选 */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                <Cpu className="h-3.5 w-3.5" />
                推荐模型：
              </span>
              {(['all', 'deepseek-r1', 'deepseek-v3'] as const).map((modelKey) => {
                const active = activeModel === modelKey;
                const label =
                  modelKey === 'all'
                    ? '全部'
                    : `${MODEL_META[modelKey].label}（${modelKey === 'deepseek-r1' ? '深度推理' : '极速'}）`;
                return (
                  <button
                    key={modelKey}
                    type="button"
                    onClick={() => setActiveModel(modelKey)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      active
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}

              <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
                <Layers className="h-3.5 w-3.5" />
                形态：
              </span>
              {(['all', 'prompt', 'workflow', 'mcp'] as const).map((kindKey) => {
                const active = activeKind === kindKey;
                const label = kindKey === 'all' ? '全部' : KIND_META[kindKey].label;
                return (
                  <button
                    key={kindKey}
                    type="button"
                    onClick={() => setActiveKind(kindKey)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      active
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>
                共 <strong className="text-slate-800">{filteredSkills.length}</strong> 个结果
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  重置筛选
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Skill 卡片列表 */}
        {filteredSkills.length === 0 ? (
          <div className="rounded-3xl border border-slate-200/80 bg-white/80 py-16 text-center shadow-sm backdrop-blur">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-800">没有找到匹配的 Skill</h3>
            <p className="mt-1.5 text-sm text-slate-500">试试切换分类、模型筛选，或清空搜索关键词</p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" />
              查看全部 Skill
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredSkills.map((skill, index) => {
              const modelMeta = MODEL_META[skill.recommendedModel];
              const kindMeta = KIND_META[skill.kind];
              const diffMeta = DIFFICULTY_META[skill.difficulty];

              return (
                <motion.article
                  key={skill.slug}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.24) }}
                  onClick={() => navigate(`/ai-square/hub/${skill.slug}`)}
                  className="group flex cursor-pointer flex-col rounded-3xl border border-white/70 bg-white/80 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.05)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-blue-200/80 hover:bg-white hover:shadow-[0_14px_34px_rgba(15,23,42,0.09)]"
                >
                  {/* 顶部图标与徽章 */}
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${skill.accentClass}`}
                    >
                      <SkillIcon name={skill.iconName} className="h-5 w-5" />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${modelMeta.badgeClass}`}>
                        {modelMeta.label}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${diffMeta.className}`}>
                        {diffMeta.label}
                      </span>
                    </div>
                  </div>

                  {/* 标题与一句话说明 */}
                  <h2 className="mt-5 text-lg font-bold text-slate-900 transition-colors group-hover:text-primary-600">
                    {skill.name}
                  </h2>
                  <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-600">
                    {skill.tagline}
                  </p>

                  {/* 标签组 */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${kindMeta.className}`}>
                      {kindMeta.label}
                    </span>
                    {skill.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* 课程关联条 */}
                  <div className="mt-4 flex items-center gap-1.5 rounded-xl bg-slate-50/90 px-3 py-2 text-xs text-slate-500">
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary-500" />
                    <span className="truncate">
                      关联课程：<strong className="font-semibold text-slate-700">{skill.relatedCourseTitle}</strong>
                    </span>
                  </div>

                  {/* 底部操作按钮 */}
                  <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/ai-square/hub/${skill.slug}?tab=anatomy`);
                      }}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      原理拆解
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/ai-square/hub/${skill.slug}?tab=playground`);
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white transition group-hover:bg-primary-600"
                    >
                      立即试玩
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentHubPage;
