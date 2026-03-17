import React, { useState } from 'react';
import {
  Copy,
  Database,
  Download,
  History,
  Lightbulb,
  Maximize2,
  MoreHorizontal,
  Box,
  ShieldCheck,
  Sliders,
  Zap,
  AlertCircle,
  Pencil,
  Eye,
  Check,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API_BASE_URL } from '@/config';

type EngineStatus = 'idle' | 'processing' | 'completed' | 'error';
type OptMode = '通用' | '代码' | '创作';

interface EngineResult {
  content: string;
  score: number;
  tokens: number;
  suggestions: string[];
  latency: string;
}

const PromptEnginePanel: React.FC = () => {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [result, setResult] = useState<EngineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<OptMode>('通用');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [copied, setCopied] = useState(false);

  const handleExecute = async () => {
    if (!input.trim() || status === 'processing') return;

    setStatus('processing');
    setError(null);
    const startTime = Date.now();

    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/agent/prompt-enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ rawPrompt: input, mode: activeMode }),
      });

      const data = await res.json();
      const latency = ((Date.now() - startTime) / 1000).toFixed(1) + 's';

      if (data.success && data.data) {
        setResult({
          content: data.data.content,
          score: data.data.score,
          tokens: data.data.tokens,
          suggestions: data.data.suggestions || [],
          latency,
        });
        setStatus('completed');
      } else {
        setError(data.error || '优化失败，请稍后重试');
        setStatus('error');
      }
    } catch (err: any) {
      setError(err.message || '网络错误，请检查连接');
      setStatus('error');
    }
  };

  const handleCopy = () => {
    const text = isEditing ? editContent : result?.content;
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  const handleToggleEdit = () => {
    if (!isEditing && result) {
      setEditContent(result.content);
    } else if (isEditing && result) {
      // Save edits back
      setResult({ ...result, content: editContent });
    }
    setIsEditing(!isEditing);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  const tokenEstimate = Math.ceil(input.length / 1.5);
  const modes: OptMode[] = ['通用', '代码', '创作'];

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">智能提示词引擎</h3>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50">
            <History className="h-4 w-4" />
          </button>
          <button type="button" className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {/* 优化模式 */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">优化模式</label>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">AI 驱动</span>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setActiveMode(m)}
                className={`rounded-lg py-1.5 text-xs font-bold transition-all ${
                  activeMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* 输入区 */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">原始 Prompt 录入</label>
          <div className="relative">
            <textarea
              className="h-32 w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-800 placeholder:text-slate-300 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/5"
              placeholder="输入原始提示词，AI 将为你优化..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="absolute bottom-2.5 right-3 flex items-center gap-3">
              <span className="font-mono text-[10px] text-slate-300">Token Est: {tokenEstimate}</span>
              <button type="button" className="text-primary hover:text-primary-700">
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 执行参数 */}
        <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Sliders className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">执行参数</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-500">模型引擎</span>
              <div className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
                Qwen3-Max
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-500">响应语言</span>
              <div className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
                简体中文
              </div>
            </div>
          </div>
        </div>

        {/* 执行按钮 */}
        <button
          type="button"
          onClick={handleExecute}
          disabled={!input || status === 'processing'}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all ${
            !input
              ? 'cursor-not-allowed bg-slate-100 text-slate-400'
              : status === 'processing'
                ? 'bg-primary/80 text-white'
                : 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-600'
          }`}
        >
          {status === 'processing' ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span>Qwen 分析优化中...</span>
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 fill-current" />
              <span>执行智能优化</span>
            </>
          )}
        </button>

        {/* 错误提示 */}
        {status === 'error' && error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* 结果区 */}
        {status === 'completed' && result && (
          <div className="animate-[fadeSlideIn_0.3s_ease-out_both] space-y-4">
            {/* 标题 + 分数 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-6 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-bold text-slate-800">优化产出</span>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase leading-none tracking-tighter text-slate-400">Quality Score</p>
                <p className={`mt-1 text-sm font-black leading-none ${result.score >= 90 ? 'text-emerald-500' : result.score >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
                  {result.score}%
                </p>
              </div>
            </div>

            {/* 内容卡片 */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:border-primary hover:shadow-md">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
                <span className="text-[10px] font-medium text-slate-500">{isEditing ? '编辑模式' : 'Markdown 预览'}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-primary"
                    title="复制内容"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    <span>{copied ? '已复制' : '复制'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleEdit}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors hover:bg-slate-100 ${
                      isEditing ? 'text-primary' : 'text-slate-400 hover:text-primary'
                    }`}
                    title={isEditing ? '预览' : '编辑'}
                  >
                    {isEditing ? <Eye className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                    <span>{isEditing ? '预览' : '编辑'}</span>
                  </button>
                  <button type="button" className="text-slate-400 transition-colors hover:text-primary" title="下载">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {isEditing ? (
                <textarea
                  className="w-full resize-none p-4 text-sm leading-relaxed text-slate-700 outline-none min-h-[200px]"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              ) : (
                <div className="prose prose-sm prose-slate max-w-none p-4 text-sm leading-relaxed text-slate-700">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.content}
                  </ReactMarkdown>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Box className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] text-slate-500">
                    耗时: <b className="text-slate-700">{result.latency}</b>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Database className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] text-slate-500">
                    Tokens: <b className="text-slate-700">{result.tokens}</b>
                  </span>
                </div>
              </div>
            </div>

            {/* AI 建议 */}
            {result.suggestions.length > 0 && (
              <div className="rounded-xl border border-blue-100/50 bg-blue-50/50 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-blue-700">
                  <Lightbulb className="h-3.5 w-3.5" /> AI 优化建议
                </p>
                <ul className="ml-1 space-y-1 text-[11px] text-blue-600/80">
                  {result.suggestions.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-slate-100 bg-white px-5 py-2.5">
        <span className="flex items-center gap-1 text-[10px] text-slate-400">
          <kbd className="rounded border border-slate-200 bg-slate-100 px-1 font-sans text-[10px]">⌘</kbd> Enter 快速发送
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-slate-300">Qwen3-Max</span>
          <ShieldCheck className="h-3 w-3 text-slate-300" />
        </div>
      </footer>
    </div>
  );
};

export default PromptEnginePanel;
