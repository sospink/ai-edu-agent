import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Layers,
  Map as MapIcon,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { getAgentHubSkillBySlug, MODEL_META } from '@/data/agentHubSkills';
import {
  CAPABILITY_LAYERS,
  CAPABILITY_TRACKS,
  getEcosystemToolById,
} from '@/data/aiSquareEcosystem';
import { api } from '@/services/api';
import { authService } from '@/services/auth';
import type { CapabilityNode, CapabilityTrackId } from '@/types/aiSquareEcosystem';
import { SkillIcon } from './SkillIcon';

const CapabilityMapPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const allNodes = useMemo(
    () => CAPABILITY_LAYERS.flatMap((layer) => layer.nodes),
    []
  );

  const initialLayerId = searchParams.get('layer');
  const initialNode = useMemo(() => {
    if (initialLayerId) {
      const layer = CAPABILITY_LAYERS.find((l) => l.id === initialLayerId);
      if (layer?.nodes[0]) return layer.nodes[0];
    }
    return allNodes[0];
  }, [allNodes, initialLayerId]);

  const [activeTrack, setActiveTrack] = useState<CapabilityTrackId>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string>(initialNode.id);
  const [courseProgressByTitle, setCourseProgressByTitle] = useState<Record<string, number>>({});

  // 若学生已登录，尝试静默拉取真实课程进度以点亮能力层（未登录或后端未启动时自动回退标准路线模式）
  useEffect(() => {
    if (!authService.isLoggedIn()) return;
    let cancelled = false;
    void api
      .get<Array<{ progressPercent?: number; course?: { title?: string } }>>('/courses/enrollments')
      .then((res) => {
        if (cancelled || !res.success || !Array.isArray(res.data)) return;
        const nextMap: Record<string, number> = {};
        res.data.forEach((item) => {
          const title = item.course?.title?.trim();
          if (title) {
            nextMap[title] = item.progressPercent ?? 0;
          }
        });
        setCourseProgressByTitle(nextMap);
      })
      .catch(() => {
        // 离线或无后端时保持静默，不打断浏览
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const selectedNode: CapabilityNode = useMemo(
    () => allNodes.find((n) => n.id === selectedNodeId) || allNodes[0],
    [allNodes, selectedNodeId]
  );

  const selectedLayer = useMemo(
    () => CAPABILITY_LAYERS.find((l) => l.id === selectedNode.layerId) || CAPABILITY_LAYERS[0],
    [selectedNode.layerId]
  );

  const handleSelectNode = (node: CapabilityNode) => {
    setSelectedNodeId(node.id);
    const next = new URLSearchParams(searchParams);
    next.set('layer', node.layerId);
    setSearchParams(next, { replace: true });
  };

  const getLayerProgress = (courseTitle: string): number | null => {
    const exact = courseProgressByTitle[courseTitle];
    if (typeof exact === 'number') return exact;
    const fuzzyEntry = Object.entries(courseProgressByTitle).find(
      ([title]) => title.includes(courseTitle) || courseTitle.includes(title)
    );
    return fuzzyEntry ? fuzzyEntry[1] : null;
  };

  const linkedTools = useMemo(
    () =>
      selectedNode.recommendedToolIds
        .map((id) => getEcosystemToolById(id))
        .filter((tool): tool is NonNullable<typeof tool> => Boolean(tool)),
    [selectedNode.recommendedToolIds]
  );

  const linkedSkills = useMemo(
    () =>
      selectedNode.relatedSkillSlugs
        .map((slug) => getAgentHubSkillBySlug(slug))
        .filter((skill): skill is NonNullable<typeof skill> => Boolean(skill)),
    [selectedNode.relatedSkillSlugs]
  );

  const activeTrackMeta =
    CAPABILITY_TRACKS.find((t) => t.id === activeTrack) || CAPABILITY_TRACKS[0];

  const hasProgressData = Object.keys(courseProgressByTitle).length > 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f7f9fc] pb-24">
      {/* 柔和氛围背景 */}
      <div className="pointer-events-none absolute inset-0 opacity-65">
        <div className="absolute left-[8%] top-0 h-80 w-80 rounded-full bg-blue-200/60 blur-3xl" />
        <div className="absolute right-[10%] top-12 h-96 w-96 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="absolute bottom-10 left-[35%] h-80 w-80 rounded-full bg-violet-200/50 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-24 md:px-12">
        {/* 面包屑 */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link
              to="/ai-square"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/85 px-3.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回 AI 广场
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-800">AI Agent 能力地图</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-3.5 py-1 text-xs font-semibold text-emerald-700">
            <MapIcon className="h-3.5 w-3.5" />
            5 大能力层 · {allNodes.length} 个核心能力节点 · 全站课程与 Skill 联动
          </div>
        </div>

        {/* 顶部标题 + 路线切换卡 */}
        <section className="mb-8 rounded-3xl border border-white/70 bg-white/80 p-7 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur-md md:p-9">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <Layers className="h-3.5 w-3.5 text-primary-600" />
                Agent Engineer Capability Atlas
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
                AI Agent 能力地图
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-base">
                对齐平台 5 门核心实训课程与行业真实技术栈。点击任意能力节点，右侧即刻展开
                <span className="font-semibold text-slate-800"> 掌握标准</span>、
                <span className="font-semibold text-slate-800"> 推荐工具</span>、
                <span className="font-semibold text-slate-800"> 可试玩 Skill</span> 与
                <span className="font-semibold text-slate-800"> 对应课程入口</span>。
              </p>
            </div>

            {hasProgressData && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-800">
                <div className="font-bold">已同步你的个人课程学习进度</div>
                <div className="mt-0.5 text-emerald-700/90">各层级右上角将实时显示对应课程完成度</div>
              </div>
            )}
          </div>

          {/* 成长方向高亮切换器 */}
          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-500">
              <Compass className="h-4 w-4 text-primary-600" />
              按目标方向高亮推荐路径：
            </div>
            <div className="flex flex-wrap gap-2">
              {CAPABILITY_TRACKS.map((track) => {
                const isActive = activeTrack === track.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => setActiveTrack(track.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition md:text-sm ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {track.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2.5 text-xs text-slate-500">{activeTrackMeta.desc}</p>
          </div>
        </section>

        {/* 主体布局：左 8 列五层泳道 + 右 4 列详情面板 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* 左侧 8 列：L1 -> L5 能力层泳道 */}
          <div className="space-y-5 lg:col-span-8">
            {CAPABILITY_LAYERS.map((layer, layerIndex) => {
              const progress = getLayerProgress(layer.courseTitle);
              const isLayerActive = selectedNode.layerId === layer.id;

              return (
                <div key={layer.id} className="relative">
                  {/* 层级间向下连接线 */}
                  {layerIndex < CAPABILITY_LAYERS.length - 1 && (
                    <div
                      className="pointer-events-none absolute -bottom-5 left-9 z-0 hidden h-5 w-0.5 bg-gradient-to-b from-slate-300 to-slate-200 md:block"
                      aria-hidden="true"
                    />
                  )}

                  <motion.section
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: layerIndex * 0.05 }}
                    className={`relative z-10 rounded-3xl border bg-white/85 p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)] backdrop-blur-md transition md:p-6 ${
                      isLayerActive ? `${layer.borderClass} ring-2 ring-primary-500/15` : 'border-white/70'
                    }`}
                  >
                    {/* 泳道标题栏 */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${layer.badgeClass}`}
                        >
                          {layer.level}
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-bold text-slate-900 md:text-lg">
                              {layer.title}
                            </h2>
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                              <BookOpen className="h-3 w-3 text-primary-500" />
                              {layer.courseTitle}
                            </span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            {layer.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {progress !== null ? (
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              progress >= 100
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : progress > 0
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {progress >= 100 ? '已掌握 100%' : progress > 0 ? `学习中 ${progress}%` : '未开始'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                            <Clock className="h-3 w-3" />
                            {layer.estimatedHours}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 节点卡片 3 列矩阵 */}
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {layer.nodes.map((node) => {
                        const isSelected = selectedNode.id === node.id;
                        const isInTrack =
                          activeTrack === 'all' || node.tracks.includes(activeTrack);

                        return (
                          <button
                            key={node.id}
                            type="button"
                            onClick={() => handleSelectNode(node)}
                            className={`group flex flex-col rounded-2xl border p-4 text-left transition-all ${
                              isSelected
                                ? 'border-primary-500 bg-primary-50/60 shadow-md ring-2 ring-primary-500/20'
                                : isInTrack
                                ? 'border-slate-200/80 bg-white hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-sm'
                                : 'border-slate-100 bg-slate-50/70 opacity-45 hover:opacity-80'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`font-mono text-[11px] font-bold ${
                                  isSelected ? 'text-primary-700' : 'text-slate-400'
                                }`}
                              >
                                {node.code}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                {node.relatedSkillSlugs.length} Skill
                              </span>
                            </div>
                            <h3
                              className={`mt-2 text-sm font-bold leading-snug ${
                                isSelected ? 'text-primary-900' : 'text-slate-800 group-hover:text-primary-700'
                              }`}
                            >
                              {node.title}
                            </h3>
                            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                              {node.subtitle}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </motion.section>
                </div>
              );
            })}
          </div>

          {/* 右侧 4 列：固定能力详情抽屉面板 */}
          <aside className="lg:col-span-4">
            <div className="sticky top-24 rounded-3xl border border-white/80 bg-white/95 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.07)] backdrop-blur-md">
              {/* 节点头部 */}
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${selectedLayer.badgeClass}`}>
                  {selectedLayer.level} · {selectedLayer.title}
                </span>
                <span className="font-mono text-xs font-bold text-slate-400">
                  {selectedNode.code}
                </span>
              </div>

              <h3 className="mt-4 text-xl font-black text-slate-900">{selectedNode.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{selectedNode.summary}</p>

              {/* 掌握标准 */}
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  能力掌握标准
                </div>
                <ul className="mt-2.5 space-y-2">
                  {selectedNode.masteryCriteria.map((criterion, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-emerald-950/85">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span>{criterion}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 关联热门 Skills */}
              {linkedSkills.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                    关联 Skills（点击进 DeepSeek Harness 实操）
                  </div>
                  <div className="space-y-2">
                    {linkedSkills.map((skill) => (
                      <button
                        key={skill.slug}
                        type="button"
                        onClick={() => navigate(`/ai-square/harness?skill=${skill.slug}`)}
                        className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 text-left transition hover:border-primary-300 hover:bg-white hover:shadow-sm"
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${skill.accentClass}`}
                        >
                          <SkillIcon name={skill.iconName} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-bold text-slate-900 group-hover:text-primary-600">
                              {skill.name}
                            </span>
                            <span className="shrink-0 text-[10px] font-bold text-slate-400">
                              {MODEL_META[skill.recommendedModel].label}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">{skill.tagline}</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 推荐工具 */}
              {linkedTools.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <Wrench className="h-3.5 w-3.5 text-slate-500" />
                    推荐配套生态工具
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {linkedTools.map((tool) => (
                      <a
                        key={tool.id}
                        href={tool.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-primary-300 hover:text-primary-700"
                      >
                        <span>{tool.name}</span>
                        <ExternalLink className="h-3 w-3 text-slate-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* 底部直达学习中心 CTA */}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => navigate('/study')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-primary-600"
                >
                  <BookOpen className="h-4 w-4" />
                  去学习中心修读《{selectedNode.relatedCourseTitle}》
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CapabilityMapPage;
