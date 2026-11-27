import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import { getAgentHubSkillBySlug } from '@/data/agentHubSkills';
import { buildHarnessProviderYaml, buildModelApiSnippet } from '@/data/aiSquareEcosystem';
import type { EcosystemTool, FoundationModelGuide } from '@/types/aiSquareEcosystem';
import { copyText } from '@/utils/clipboard';
import { SkillIcon } from './SkillIcon';

interface ToolTeachingDrawerProps {
  tool: EcosystemTool | null;
  onClose: () => void;
}

export const ToolTeachingDrawer: React.FC<ToolTeachingDrawerProps> = ({ tool, onClose }) => {
  const navigate = useNavigate();
  const [copiedCmd, setCopiedCmd] = useState(false);

  if (typeof document === 'undefined') return null;

  const relatedSkills = tool
    ? tool.teachingUsage.relatedSkillSlugs
        .map((slug) => getAgentHubSkillBySlug(slug))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  const handleCopyCmd = async () => {
    if (!tool?.teachingUsage.commandHint) return;
    const ok = await copyText(tool.teachingUsage.commandHint);
    if (ok) {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    }
  };

  return createPortal(
    <AnimatePresence>
      {tool && (
        <div className="fixed inset-0 z-[10000] flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="relative z-10 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
          >
            {/* 头部 */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
              <div className="flex items-center gap-3.5">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${tool.accentClass}`}
                >
                  {tool.logoText}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">{tool.name}</h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                      {tool.accessBadge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{tool.vendor}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="关闭抽屉"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 内容区 */}
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">教学定位</div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
                  {tool.teachingUsage.summary}
                </p>
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  什么时候用它？（对应：{tool.courseLinkLabel}）
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-blue-950/80">
                  {tool.teachingUsage.whenToUse}
                </p>
              </div>

              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  3 步快速上手实训
                </div>
                <ol className="mt-3 space-y-2.5">
                  {tool.teachingUsage.quickSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {tool.teachingUsage.commandHint && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <Terminal className="h-3.5 w-3.5" />
                      常用启动 / 安装命令
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCmd}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
                    >
                      {copiedCmd ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedCmd ? '已复制' : '复制命令'}
                    </button>
                  </div>
                  <pre className="overflow-x-auto rounded-xl bg-[#0d1117] p-3.5 font-mono text-xs text-slate-100">
                    {tool.teachingUsage.commandHint}
                  </pre>
                </div>
              )}

              {relatedSkills.length > 0 && (
                <div>
                  <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <Sparkles className="h-3.5 w-3.5 text-primary-500" />
                    推荐搭配 Agent Hub Skills
                  </div>
                  <div className="space-y-2">
                    {relatedSkills.map((skill) => (
                      <button
                        key={skill.slug}
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(`/ai-square/hub/${skill.slug}`);
                        }}
                        className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-primary-300 hover:bg-white"
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${skill.accentClass}`}
                        >
                          <SkillIcon name={skill.iconName} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 group-hover:text-primary-600">
                            {skill.name}
                          </div>
                          <div className="truncate text-[11px] text-slate-500">{skill.tagline}</div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-primary-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center gap-3 border-t border-slate-100 p-5">
              <a
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-600"
              >
                打开官方网站
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/study');
                }}
                className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                去学习中心
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

interface ModelApiModalProps {
  model: FoundationModelGuide | null;
  onClose: () => void;
}

export const ModelApiModal: React.FC<ModelApiModalProps> = ({ model, onClose }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'harness' | 'python'>('harness');
  const [copied, setCopied] = useState(false);

  if (typeof document === 'undefined') return null;

  const snippet = model
    ? mode === 'harness'
      ? buildHarnessProviderYaml(model)
      : buildModelApiSnippet(model)
    : '';

  const handleCopy = async () => {
    if (!snippet) return;
    const ok = await copyText(snippet);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return createPortal(
    <AnimatePresence>
      {model && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700">
                  <Code2 className="h-3.5 w-3.5" />
                  DeepSeek Harness & API 接入配置
                </div>
                <h3 className="mt-2.5 text-xl font-bold text-slate-900">
                  {model.name}（{model.vendor}）
                </h3>
                <p className="mt-1 text-xs text-slate-500">适用实训：{model.bestForLabs}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="关闭弹窗"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="inline-flex rounded-full bg-slate-100 p-0.5 font-semibold">
                  <button
                    type="button"
                    onClick={() => setMode('harness')}
                    className={`rounded-full px-3 py-1 transition ${
                      mode === 'harness' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Harness (cordis.patch.yml)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('python')}
                    className={`rounded-full px-3 py-1 transition ${
                      mode === 'python' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Python SDK
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3.5 py-1.5 font-semibold text-white transition hover:bg-primary-700"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? '已复制配置' : mode === 'harness' ? '复制 YAML 配置' : '复制 Python 代码'}
                </button>
              </div>

              <pre className="max-h-80 overflow-auto rounded-2xl bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-slate-100">
                {snippet}
              </pre>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <a
                  href={model.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  前往开放平台申请 Key
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(`/ai-square/harness?model=${model.id}`);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-primary-600"
                >
                  带着此配置打开 DeepSeek Harness
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
