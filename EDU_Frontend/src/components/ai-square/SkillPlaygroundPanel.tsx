import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Play,
  Sparkles,
  Square,
  Terminal,
} from 'lucide-react';
import { assembleUserPrompt, MODEL_META } from '@/data/agentHubSkills';
import type { AgentHubSkill, SkillDemoPreset } from '@/types/agentHub';
import { copyText } from '@/utils/clipboard';

interface SkillPlaygroundPanelProps {
  skill: AgentHubSkill;
  inputValues: Record<string, string>;
  onInputChange: (key: string, value: string) => void;
  onApplyPreset: (preset: SkillDemoPreset) => void;
  onJumpToTab: (tab: 'anatomy' | 'reproduce') => void;
}

const markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  table: ({ children, ...props }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-sm" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="border-b border-slate-200 bg-slate-50" {...props}>{children}</thead>
  ),
  tbody: ({ children, ...props }) => (
    <tbody className="divide-y divide-slate-100" {...props}>{children}</tbody>
  ),
  th: ({ children, ...props }) => (
    <th className="px-3 py-2 text-left text-xs font-bold text-slate-600" {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="px-3 py-2 text-sm text-slate-700" {...props}>{children}</td>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-xl bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-slate-100">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  h3: ({ children }) => <h3 className="mt-4 mb-2 text-base font-bold text-slate-900">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-3 mb-1.5 text-sm font-bold text-slate-800">{children}</h4>,
  p: ({ children }) => <p className="my-2 text-sm leading-relaxed text-slate-700">{children}</p>,
  ul: ({ children }) => <ul className="my-2 ml-5 list-disc space-y-1 text-sm text-slate-700">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 ml-5 list-decimal space-y-1 text-sm text-slate-700">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-4 border-primary-400 bg-primary-50/40 px-4 py-2 text-sm text-slate-700">
      {children}
    </blockquote>
  ),
};

export const SkillPlaygroundPanel: React.FC<SkillPlaygroundPanelProps> = ({
  skill,
  inputValues,
  onInputChange,
  onApplyPreset,
  onJumpToTab,
}) => {
  const modelMeta = MODEL_META[skill.recommendedModel];
  const [showAssembled, setShowAssembled] = useState(false);
  const [reasoningExpanded, setReasoningExpanded] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedReasoning, setStreamedReasoning] = useState('');
  const [streamedOutput, setStreamedOutput] = useState('');
  const [runModeLabel, setRunModeLabel] = useState<'idle' | 'preset-demo' | 'custom-assembly'>('idle');
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const timerRef = useRef<number | null>(null);

  const assembledUserPrompt = useMemo(
    () => assembleUserPrompt(skill, inputValues),
    [skill, inputValues]
  );

  /** 判断当前输入是否精准匹配某条预置演示案例 */
  const matchedPreset = useMemo(() => {
    return skill.demoPresets.find((preset) =>
      skill.inputs.every((field) => {
        const current = (inputValues[field.key] || '').trim();
        const presetVal = (preset.inputs[field.key] || field.defaultValue || '').trim();
        return current === presetVal;
      })
    );
  }, [skill, inputValues]);

  const stopStreaming = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsStreaming(false);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  /** 切换 Skill 时清空上次输出 */
  useEffect(() => {
    stopStreaming();
    setStreamedReasoning('');
    setStreamedOutput('');
    setRunModeLabel('idle');
  }, [skill.slug]);

  const startSimulatedStream = (reasoning: string, output: string, mode: 'preset-demo' | 'custom-assembly') => {
    stopStreaming();
    setRunModeLabel(mode);
    setStreamedReasoning('');
    setStreamedOutput('');
    setReasoningExpanded(true);
    setIsStreaming(true);

    let rIdx = 0;
    let oIdx = 0;
    const rStep = Math.max(4, Math.ceil(reasoning.length / 45));
    const oStep = Math.max(10, Math.ceil(output.length / 70));

    timerRef.current = window.setInterval(() => {
      if (rIdx < reasoning.length) {
        rIdx = Math.min(reasoning.length, rIdx + rStep);
        setStreamedReasoning(reasoning.slice(0, rIdx));
        return;
      }
      if (oIdx < output.length) {
        oIdx = Math.min(output.length, oIdx + oStep);
        setStreamedOutput(output.slice(0, oIdx));
        return;
      }
      stopStreaming();
    }, 22);
  };

  const handleRun = () => {
    if (matchedPreset) {
      startSimulatedStream(
        matchedPreset.sampleReasoning || '',
        matchedPreset.sampleOutput,
        'preset-demo'
      );
      return;
    }

    // 自定义输入：前端尚未绑定在线 DeepSeek API 代理时，透明输出“已拼装的可直接运行提示词包”并指引去复现/演示
    const customOutput = `### 已为你拼装好面向 \`${modelMeta.label}\` 的完整运行请求

> 当前环境处于**零 Token 演示模式**（尚未开启公网 DeepSeek 实时代理）。你刚才修改的自定义输入已实时编译为标准 Prompt，可直接复制去 DeepSeek 官网或本平台 Lab 终端运行。

#### 拼装后的 User Prompt
\`\`\`markdown
${assembledUserPrompt}
\`\`\`

#### 下一步建议
1. 点击右上角 **「复制完整 Prompt」**，直接粘贴到 [DeepSeek 对话页](https://chat.deepseek.com/) 即可获得实时推理结果；
2. 切换到上方 **「复现与扩展」** 标签页，直接获取已填好你刚才输入的 **Python / cURL 调用脚本**；
3. 或点击左侧 **「一键填入示例」**，体验本 Skill 内置的完整 ${modelMeta.label} 演示输出。`;

    startSimulatedStream('', customOutput, 'custom-assembly');
  };

  const handleCopyFullPrompt = async () => {
    const combined = `# System Prompt\n\n${skill.systemPrompt}\n\n---\n\n# User Input\n\n${assembledUserPrompt}`;
    const ok = await copyText(combined);
    if (ok) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const handleCopyOutput = async () => {
    if (!streamedOutput) return;
    const ok = await copyText(streamedOutput);
    if (ok) {
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* 左侧 5 列：参数输入表单 */}
      <div className="lg:col-span-5">
        <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.05)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900">输入参数配置</h3>
            <span className="text-xs font-medium text-slate-400">支持一键填入示例</span>
          </div>

          {/* 预设示例快捷胶囊 */}
          <div className="mt-3 flex flex-wrap gap-2">
            {skill.demoPresets.map((preset) => {
              const isSelected = matchedPreset?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onApplyPreset(preset)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    isSelected
                      ? 'border-primary-300 bg-primary-50 text-primary-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* 动态表单字段 */}
          <div className="mt-5 space-y-4">
            {skill.inputs.map((field) => (
              <div key={field.key}>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  {field.label}
                  {field.required && <span className="ml-1 text-rose-500">*</span>}
                </label>

                {field.type === 'select' && field.options ? (
                  <select
                    value={inputValues[field.key] ?? field.defaultValue ?? ''}
                    onChange={(e) => onInputChange(field.key, e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-800 transition focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10"
                  >
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea
                    rows={5}
                    value={inputValues[field.key] ?? ''}
                    onChange={(e) => onInputChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 font-mono text-xs leading-relaxed text-slate-800 placeholder-slate-400 transition focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10"
                  />
                ) : (
                  <input
                    type="text"
                    value={inputValues[field.key] ?? ''}
                    onChange={(e) => onInputChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary-500/10"
                  />
                )}
              </div>
            ))}
          </div>

          {/* 拼装后 User Prompt 折叠预览 */}
          <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/70">
            <button
              type="button"
              onClick={() => setShowAssembled((v) => !v)}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <span className="inline-flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-slate-400" />
                查看实时拼装后的用户 Prompt
              </span>
              {showAssembled ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {showAssembled && (
              <div className="border-t border-slate-200/80 p-3">
                <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-slate-700">
                  {assembledUserPrompt}
                </pre>
              </div>
            )}
          </div>

          {/* 运行操作行 */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {isStreaming ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/20 transition hover:bg-rose-700"
              >
                <Square className="h-4 w-4 fill-current" />
                停止输出
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRun}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/20 transition hover:bg-primary-700"
              >
                <Play className="h-4 w-4 fill-current" />
                {matchedPreset ? '运行演示 Skill' : '编译并预览运行包'}
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyFullPrompt}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {copiedPrompt ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copiedPrompt ? '已复制' : '复制完整 Prompt'}
            </button>
          </div>
        </div>
      </div>

      {/* 右侧 7 列：思考链 + Markdown 结果展示 */}
      <div className="lg:col-span-7">
        <div className="flex min-h-[540px] flex-col rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_8px_28px_rgba(15,23,42,0.05)] backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${modelMeta.badgeClass}`}>
                {modelMeta.label}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {runModeLabel === 'preset-demo'
                  ? '预置演示模式 · 零 Token 消耗'
                  : runModeLabel === 'custom-assembly'
                  ? '自定义输入 · Prompt 组装预览'
                  : modelMeta.hint}
              </span>
            </div>

            {streamedOutput && (
              <button
                type="button"
                onClick={handleCopyOutput}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                {copiedOutput ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedOutput ? '已复制结果' : '复制结果'}
              </button>
            )}
          </div>

          {/* 主输出区 */}
          {runModeLabel === 'idle' ? (
            <div className="flex flex-1 flex-col items-center justify-center py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                <Sparkles className="h-7 w-7" />
              </div>
              <h4 className="mt-4 text-base font-bold text-slate-800">准备就绪，点击左侧「运行演示 Skill」</h4>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                已自动载入第一组教学示例。点击运行即可查看{' '}
                <strong className="text-slate-700">{modelMeta.label}</strong> 的结构化输出
                {skill.recommendedModel === 'deepseek-r1' ? '与深度推理思考链' : ''}，也可以自由修改参数后一键导出调用代码。
              </p>
              <button
                type="button"
                onClick={handleRun}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-600"
              >
                <Play className="h-4 w-4 fill-current" />
                立即运行示例
              </button>
            </div>
          ) : (
            <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
              {/* DeepSeek-R1 深度思考过程折叠面板 */}
              {streamedReasoning && (
                <div className="rounded-2xl border border-violet-200/80 bg-violet-50/50">
                  <button
                    type="button"
                    onClick={() => setReasoningExpanded((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-bold text-violet-800"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Brain className="h-4 w-4 text-violet-600" />
                      DeepSeek-R1 深度思考过程（Reasoning Trace）
                    </span>
                    {reasoningExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  {reasoningExpanded && (
                    <div className="border-t border-violet-200/60 px-4 py-3 text-xs leading-relaxed whitespace-pre-wrap text-violet-950/80">
                      {streamedReasoning}
                    </div>
                  )}
                </div>
              )}

              {/* 正式 Markdown 结果 */}
              <div className="max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {streamedOutput}
                </ReactMarkdown>
                {isStreaming && (
                  <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-primary-500 align-middle" />
                )}
              </div>
            </div>
          )}

          {/* 底部教学引导栏 */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs">
            <span className="text-slate-500">想看懂它为什么能输出这么稳定？</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onJumpToTab('anatomy')}
                className="rounded-full bg-primary-50 px-3.5 py-1.5 font-semibold text-primary-700 transition hover:bg-primary-100"
              >
                去「原理拆解」逐行学习 →
              </button>
              <button
                type="button"
                onClick={() => onJumpToTab('reproduce')}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 font-semibold text-slate-700 transition hover:border-slate-300"
              >
                拿代码去实训复现
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
