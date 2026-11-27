import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  Copy,
  Layers,
  Play,
  Sparkles,
} from 'lucide-react';
import {
  AGENT_HUB_SKILLS,
  buildSkillMarkdown,
  DIFFICULTY_META,
  getAgentHubSkillBySlug,
  KIND_META,
  MODEL_META,
} from '@/data/agentHubSkills';
import type { AgentHubSkill, SkillDemoPreset } from '@/types/agentHub';
import { copyText } from '@/utils/clipboard';
import { SkillAnatomyPanel } from './SkillAnatomyPanel';
import { SkillIcon } from './SkillIcon';
import { SkillPlaygroundPanel } from './SkillPlaygroundPanel';
import { SkillReproducePanel } from './SkillReproducePanel';

type DetailTab = 'playground' | 'anatomy' | 'reproduce';

function buildInitialInputs(skill: AgentHubSkill): Record<string, string> {
  const firstPreset = skill.demoPresets[0];
  const values: Record<string, string> = {};
  skill.inputs.forEach((field) => {
    values[field.key] = firstPreset?.inputs[field.key] ?? field.defaultValue ?? '';
  });
  return values;
}

const AgentHubDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const skill = slug ? getAgentHubSkillBySlug(slug) : undefined;

  const tabParam = searchParams.get('tab') as DetailTab | null;
  const activeTab: DetailTab =
    tabParam === 'anatomy' || tabParam === 'reproduce' ? tabParam : 'playground';

  const [inputValues, setInputValues] = useState<Record<string, string>>(() =>
    skill ? buildInitialInputs(skill) : {}
  );
  const [copiedSkillMd, setCopiedSkillMd] = useState(false);

  useEffect(() => {
    if (skill) {
      setInputValues(buildInitialInputs(skill));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [skill?.slug]);

  const setActiveTab = (tab: DetailTab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const relatedSkills = useMemo(() => {
    if (!skill) return [];
    const sameCategory = AGENT_HUB_SKILLS.filter(
      (item) => item.slug !== skill.slug && item.category === skill.category
    );
    const others = AGENT_HUB_SKILLS.filter(
      (item) => item.slug !== skill.slug && item.category !== skill.category
    );
    return [...sameCategory, ...others].slice(0, 3);
  }, [skill]);

  if (!skill) {
    return (
      <div className="min-h-screen bg-[#f7f9fc] px-6 py-24 text-center">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">未找到对应的 Agent Skill</h2>
          <p className="mt-2 text-sm text-slate-500">该 Skill 可能已下线或链接有误，请返回 Agent Hub 重新选择。</p>
          <button
            type="button"
            onClick={() => navigate('/ai-square/hub')}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600"
          >
            <ArrowLeft className="h-4 w-4" />
            返回 Agent Hub
          </button>
        </div>
      </div>
    );
  }

  const modelMeta = MODEL_META[skill.recommendedModel];
  const kindMeta = KIND_META[skill.kind];
  const diffMeta = DIFFICULTY_META[skill.difficulty];

  const handleInputChange = (key: string, value: string) => {
    setInputValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleApplyPreset = (preset: SkillDemoPreset) => {
    const next: Record<string, string> = {};
    skill.inputs.forEach((field) => {
      next[field.key] = preset.inputs[field.key] ?? field.defaultValue ?? '';
    });
    setInputValues(next);
  };

  const handleCopySkillMd = async () => {
    const ok = await copyText(buildSkillMarkdown(skill));
    if (ok) {
      setCopiedSkillMd(true);
      setTimeout(() => setCopiedSkillMd(false), 2000);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f9fc] pb-24">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute left-[10%] top-0 h-80 w-80 rounded-full bg-blue-200/60 blur-3xl" />
        <div className="absolute right-[8%] top-16 h-96 w-96 rounded-full bg-violet-200/60 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-24 md:px-12">
        {/* 面包屑 */}
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Link
            to="/ai-square/hub"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/85 px-3.5 py-1.5 font-semibold text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回 Agent Hub
          </Link>
          <span className="text-slate-300">/</span>
          <Link to="/ai-square" className="hover:text-slate-800">
            AI 广场
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-800">{skill.name}</span>
        </div>

        {/* 顶部概览卡片 */}
        <header className="mb-6 rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur-md md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${skill.accentClass}`}
              >
                <SkillIcon name={skill.iconName} className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${modelMeta.badgeClass}`}>
                    {modelMeta.label}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${kindMeta.className}`}>
                    {kindMeta.label}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${diffMeta.className}`}>
                    难度：{diffMeta.label}
                  </span>
                </div>
                <h1 className="mt-2.5 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
                  {skill.name}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                  {skill.description}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleCopySkillMd}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                {copiedSkillMd ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedSkillMd ? '已复制 SKILL.md' : '复制 SKILL.md'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/study')}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-100"
              >
                <BookOpen className="h-3.5 w-3.5" />
                关联课程：{skill.relatedCourseTitle}
              </button>
            </div>
          </div>

          {/* 三视角 Tab 切换条 */}
          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
            {(
              [
                { id: 'playground', label: '1. 立即试玩 Playground', icon: Play },
                { id: 'anatomy', label: '2. 原理拆解 X-Ray', icon: Layers },
                { id: 'reproduce', label: '3. 复现与导出', icon: Code2 },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* 主工作区 */}
        <main>
          {activeTab === 'playground' && (
            <SkillPlaygroundPanel
              skill={skill}
              inputValues={inputValues}
              onInputChange={handleInputChange}
              onApplyPreset={handleApplyPreset}
              onJumpToTab={(tab) => setActiveTab(tab)}
            />
          )}
          {activeTab === 'anatomy' && <SkillAnatomyPanel skill={skill} />}
          {activeTab === 'reproduce' && (
            <SkillReproducePanel skill={skill} inputValues={inputValues} />
          )}
        </main>

        {/* 底部同方向推荐 */}
        {relatedSkills.length > 0 && (
          <section className="mt-14">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary-600" />
                <h2 className="text-lg font-bold text-slate-900">继续探索其他热门 Skill</h2>
              </div>
              <Link
                to="/ai-square/hub"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
              >
                查看全部 {AGENT_HUB_SKILLS.length} 个
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {relatedSkills.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => navigate(`/ai-square/hub/${item.slug}`)}
                  className="group flex items-start gap-3.5 rounded-2xl border border-white/70 bg-white/80 p-4 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:shadow-md"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.accentClass}`}
                  >
                    <SkillIcon name={item.iconName} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-slate-900 group-hover:text-primary-600">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold text-slate-400">
                        {MODEL_META[item.recommendedModel].label}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {item.tagline}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default AgentHubDetailPage;
