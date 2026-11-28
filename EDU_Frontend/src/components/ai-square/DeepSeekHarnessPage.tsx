import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Cpu,
  Download,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Sliders,
  Sparkles,
  Terminal,
} from 'lucide-react';
import {
  AGENT_HUB_CATEGORIES,
  AGENT_HUB_SKILLS,
  ANATOMY_SECTION_META,
  buildHarnessSlashCommands,
  buildSkillMarkdown,
  getAgentHubSkillBySlug,
  MODEL_META,
} from '@/data/agentHubSkills';
import {
  buildHarnessProviderYaml,
  FOUNDATION_MODEL_GUIDES,
  getFoundationModelById,
} from '@/data/aiSquareEcosystem';
import { copyText } from '@/utils/clipboard';
import { SkillIcon } from './SkillIcon';
import HarnessFrame from '@/components/study/HarnessFrame';

type SidebarTab = 'skill' | 'model' | 'anatomy';

const DeepSeekHarnessPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const skillSlugParam = searchParams.get('skill');
  const modelIdParam = searchParams.get('model');

  const activeSkill = useMemo(
    () => (skillSlugParam ? getAgentHubSkillBySlug(skillSlugParam) : undefined) || AGENT_HUB_SKILLS[0],
    [skillSlugParam]
  );

  const activeModel = useMemo(() => {
    if (modelIdParam) {
      const found = getFoundationModelById(modelIdParam);
      if (found) return found;
    }
    return FOUNDATION_MODEL_GUIDES[0]; // 默认 DeepSeek
  }, [modelIdParam]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(
    modelIdParam && !skillSlugParam ? 'model' : 'skill'
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (key: string, text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
    }
  };

  const handleSelectSkill = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('skill', slug);
    setSearchParams(next, { replace: true });
  };

  const handleSelectModel = (modelId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('model', modelId);
    setSearchParams(next, { replace: true });
  };

  const handleDownloadSkillMd = () => {
    const content = buildSkillMarkdown(activeSkill);
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SKILL.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const slashCommands = useMemo(() => buildHarnessSlashCommands(activeSkill), [activeSkill]);
  const providerYaml = useMemo(() => buildHarnessProviderYaml(activeModel), [activeModel]);

  return (
    <div className="min-h-screen bg-[#f4f7fb] pt-20 pb-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 md:px-6">
        {/* 顶部工作台控制条 */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/ai-square"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回 AI 广场
            </Link>

            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white">
                <Terminal className="h-4 w-4" />
              </span>
              <h1 className="text-sm font-black text-slate-900 md:text-base">DeepSeek Harness 工作台</h1>
            </div>
          </div>

          {/* 装配栏开关 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-3.5 w-3.5" />
              ) : (
                <PanelLeftOpen className="h-3.5 w-3.5" />
              )}
              {sidebarOpen ? '收起装配栏' : '展开装配栏'}
            </button>
          </div>
        </header>

        {/* 主体双栏工作区：左装配侧栏 + 右 DeepSeek Harness 画布 */}
        <div className="flex min-h-[calc(100vh-168px)] flex-col gap-4 lg:flex-row">
          {/* 左侧可折叠教学装配侧栏 */}
          {sidebarOpen && (
            <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm lg:w-[370px]">
              {/* 侧栏 Tab */}
              <div className="grid grid-cols-3 gap-1 border-b border-slate-100 p-2">
                {(
                  [
                    { id: 'skill', label: 'Skill 装配', icon: Sparkles },
                    { id: 'model', label: '模型配置', icon: Sliders },
                    { id: 'anatomy', label: '原理速查', icon: Layers },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = sidebarTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSidebarTab(tab.id)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${
                        active
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* 侧栏正文 */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {sidebarTab === 'skill' && (
                  <>
                    {/* Skill 下拉切换 */}
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        选择教学 Skill
                      </label>
                      <select
                        value={activeSkill.slug}
                        onChange={(e) => handleSelectSkill(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-primary-500 focus:bg-white focus:outline-none"
                      >
                        {AGENT_HUB_CATEGORIES.filter((category) => category.id !== 'all').map((category) => (
                          <optgroup key={category.id} label={category.label}>
                            {AGENT_HUB_SKILLS.filter((item) => item.category === category.id).map((item) => (
                              <option key={item.slug} value={item.slug}>
                                {item.name}（/{item.slug}）
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* 当前 Skill 摘要卡 */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${activeSkill.accentClass}`}
                        >
                          <SkillIcon name={activeSkill.iconName} className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h2 className="truncate text-sm font-bold text-slate-900">
                              {activeSkill.name}
                            </h2>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                MODEL_META[activeSkill.recommendedModel].badgeClass
                              }`}
                            >
                              {MODEL_META[activeSkill.recommendedModel].label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">
                            {activeSkill.tagline}
                          </p>
                        </div>
                      </div>

                      {/* dsh 触发命令 */}
                      <div className="mt-3.5 flex items-center justify-between gap-2 rounded-xl border border-blue-100 bg-white px-3 py-2">
                        <code className="truncate font-mono text-xs font-bold text-primary-700">
                          /{activeSkill.slug}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy('slash', `/${activeSkill.slug}`)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1 text-[11px] font-semibold text-primary-700 hover:bg-primary-100"
                        >
                          {copiedKey === 'slash' ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {copiedKey === 'slash' ? '已复制' : '复制触发词'}
                        </button>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <BookOpen className="h-3 w-3 text-primary-500" />
                          {activeSkill.relatedCourseTitle}
                        </span>
                        <button
                          type="button"
                          onClick={handleDownloadSkillMd}
                          className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-primary-600"
                        >
                          <Download className="h-3 w-3" />
                          下载 SKILL.md
                        </button>
                      </div>
                    </div>

                    {/* 一键测试提问 */}
                    <div>
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        一键复制测试指令（粘贴到右侧 Harness）
                      </div>
                      <div className="space-y-2.5">
                        {slashCommands.map((item, idx) => {
                          const key = `cmd-${idx}`;
                          return (
                            <div
                              key={key}
                              className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-800">{item.label}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(key, item.command)}
                                  className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-primary-600"
                                >
                                  {copiedKey === key ? (
                                    <Check className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                  {copiedKey === key ? '已复制' : '复制'}
                                </button>
                              </div>
                              <pre className="mt-2 max-h-24 overflow-hidden whitespace-pre-wrap rounded-lg bg-slate-50 p-2 font-mono text-[11px] leading-relaxed text-slate-600">
                                {item.command}
                              </pre>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 降级/详情页跳转 */}
                    <div className="border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/ai-square/hub/${activeSkill.slug}`)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-primary-300 hover:bg-white hover:text-primary-700"
                      >
                        <Play className="h-3.5 w-3.5" />
                        打开离线模拟演示与完整拆解页
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}

                {sidebarTab === 'model' && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        查看模型接入示例
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {FOUNDATION_MODEL_GUIDES.map((m) => {
                          const selected = m.id === activeModel.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleSelectModel(m.id)}
                              className={`rounded-xl border p-2.5 text-left transition ${
                                selected
                                  ? 'border-primary-500 bg-primary-50/60 ring-2 ring-primary-500/15'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="text-xs font-bold text-slate-900">{m.name}</div>
                              <div className="mt-0.5 text-[10px] text-slate-500">{m.vendor}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Cpu className="h-3.5 w-3.5 text-primary-600" />
                        {activeModel.name} · 适用实训
                      </div>
                      <p className="mt-1.5 leading-relaxed text-slate-600">{activeModel.bestForLabs}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {activeModel.strengthTags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-primary-700 border border-blue-100"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500">
                          cordis.patch.yml Provider 配置
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy('yaml', providerYaml)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                        >
                          {copiedKey === 'yaml' ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {copiedKey === 'yaml' ? '已复制' : '复制 YAML'}
                        </button>
                      </div>
                      <pre className="overflow-x-auto rounded-xl bg-[#0d1117] p-3 font-mono text-[11px] leading-relaxed text-slate-100">
                        {providerYaml}
                      </pre>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                        此配置供独立部署参考。广场工作区使用平台管理员配置的模型。
                      </p>
                    </div>
                  </>
                )}

                {sidebarTab === 'anatomy' && (
                  <div className="space-y-3">
                    <div className="text-xs text-slate-500">
                      当前 Skill：<strong className="text-slate-800">{activeSkill.name}</strong>
                    </div>
                    {activeSkill.anatomyBlocks.map((block) => {
                      const meta = ANATOMY_SECTION_META[block.section];
                      return (
                        <div
                          key={block.id}
                          className={`rounded-2xl border border-l-4 border-slate-200 bg-white p-3.5 ${meta.borderClass}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}>
                              {meta.label}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {block.principleTag}
                            </span>
                          </div>
                          <h4 className="mt-2 text-xs font-bold text-slate-900">{block.title}</h4>
                          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                            {block.whyItWorks}
                          </p>
                          <p className="mt-1.5 rounded-lg bg-amber-50/70 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-900">
                            <strong>不写会怎样：</strong>
                            {block.withoutIt}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          )}

          <section className="relative h-[calc(100vh-160px)] min-h-[560px] flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <HarnessFrame square />
          </section>
        </div>
      </div>
    </div>
  );
};

export default DeepSeekHarnessPage;
