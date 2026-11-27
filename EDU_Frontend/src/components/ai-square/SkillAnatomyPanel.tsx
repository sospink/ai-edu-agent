import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { ANATOMY_SECTION_META } from '@/data/agentHubSkills';
import type { AgentHubSkill } from '@/types/agentHub';
import { copyText } from '@/utils/clipboard';

interface SkillAnatomyPanelProps {
  skill: AgentHubSkill;
}

export const SkillAnatomyPanel: React.FC<SkillAnatomyPanelProps> = ({ skill }) => {
  const [activeBlockId, setActiveBlockId] = useState<string>(skill.anatomyBlocks[0]?.id || '');
  const [showRawPrompt, setShowRawPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setActiveBlockId(skill.anatomyBlocks[0]?.id || '');
    setShowRawPrompt(false);
  }, [skill.slug, skill.anatomyBlocks]);

  const activeIndex = Math.max(
    0,
    skill.anatomyBlocks.findIndex((b) => b.id === activeBlockId)
  );
  const activeBlock = skill.anatomyBlocks[activeIndex] || skill.anatomyBlocks[0];

  const handleCopySystemPrompt = async () => {
    const ok = await copyText(skill.systemPrompt);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* 左侧 7 列：分块高亮的 Prompt 源码 */}
      <div className="lg:col-span-7">
        <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.05)] backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">System Prompt / SKILL.md 透视拆解</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                点击任意高亮模块，右侧同步查看设计意图与反面对比
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRawPrompt((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                <Code2 className="h-3.5 w-3.5" />
                {showRawPrompt ? '返回分块拆解' : '查看完整原文'}
              </button>
              <button
                type="button"
                onClick={handleCopySystemPrompt}
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? '已复制' : '复制 System Prompt'}
              </button>
            </div>
          </div>

          {showRawPrompt ? (
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-[#0d1117] p-5 font-mono text-xs leading-relaxed text-slate-100">
              {skill.systemPrompt}
            </pre>
          ) : (
            <div className="mt-5 space-y-3.5">
              {skill.anatomyBlocks.map((block, idx) => {
                const meta = ANATOMY_SECTION_META[block.section];
                const isSelected = activeBlock?.id === block.id;
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => setActiveBlockId(block.id)}
                    className={`w-full rounded-2xl border border-l-4 p-4 text-left transition-all ${meta.borderClass} ${
                      isSelected
                        ? `${meta.bgClass} border-slate-300 shadow-md ring-2 ring-primary-500/20`
                        : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-400">
                          0{idx + 1}
                        </span>
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${meta.badgeClass}`}>
                          {meta.label}
                        </span>
                        <span className="text-sm font-bold text-slate-800">{block.title}</span>
                      </div>
                      <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm">
                        {block.principleTag}
                      </span>
                    </div>

                    <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-slate-900/95 p-3.5 font-mono text-xs leading-relaxed text-slate-100">
                      {block.snippet}
                    </pre>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 右侧 5 列：聚焦教学批注卡片 */}
      <div className="lg:col-span-5">
        {activeBlock && (
          <div className="sticky top-24 rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.06)] backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  ANATOMY_SECTION_META[activeBlock.section].badgeClass
                }`}
              >
                {ANATOMY_SECTION_META[activeBlock.section].label}
              </span>
              <span className="text-xs font-mono font-semibold text-slate-400">
                模块 {activeIndex + 1} / {skill.anatomyBlocks.length}
              </span>
            </div>

            <h4 className="mt-4 text-lg font-bold text-slate-900">{activeBlock.title}</h4>

            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700">
              <Sparkles className="h-3.5 w-3.5" />
              工程知识点：{activeBlock.principleTag}
            </div>

            {/* 为什么这样写 */}
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <Lightbulb className="h-4 w-4 text-emerald-600" />
                为什么这样设计？
              </div>
              <p className="mt-2 text-sm leading-relaxed text-emerald-950/85">
                {activeBlock.whyItWorks}
              </p>
            </div>

            {/* 反面对比 */}
            <div className="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                反面对比：去掉这块会怎样？
              </div>
              <p className="mt-2 text-sm leading-relaxed text-amber-950/85">
                {activeBlock.withoutIt}
              </p>
            </div>

            {/* 上下模块切换 */}
            {skill.anatomyBlocks.length > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={() => setActiveBlockId(skill.anatomyBlocks[activeIndex - 1].id)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一模块
                </button>
                <button
                  type="button"
                  disabled={activeIndex >= skill.anatomyBlocks.length - 1}
                  onClick={() => setActiveBlockId(skill.anatomyBlocks[activeIndex + 1].id)}
                  className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  下一模块
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
