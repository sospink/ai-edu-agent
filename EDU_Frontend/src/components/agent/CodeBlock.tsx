import React, { useState } from 'react';
import { Copy, Check, Play, Sparkles, Loader2 } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
  executable?: boolean;
  onRun?: (code: string) => Promise<{ output: string; exitCode: number; error?: string }>;
  onExplain?: (code: string, language: string) => void;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ 
  language, 
  code, 
  executable = false,
  onRun, 
  onExplain 
}) => {
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ output: string; exitCode: number; error?: string } | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handleRun = async () => {
    if (!onRun || isRunning) return;
    
    setIsRunning(true);
    setRunResult(null);
    
    try {
      const result = await onRun(code);
      setRunResult(result);
    } catch (err) {
      setRunResult({
        output: '',
        exitCode: 1,
        error: err instanceof Error ? err.message : '执行失败'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleExplain = () => {
    if (onExplain) {
      onExplain(code, language);
    }
  };

  return (
    <div className="rounded-lg overflow-hidden bg-[#1e293b] text-white my-3 border border-slate-700 shadow-sm group">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#334155] border-b border-slate-600">
        <span className="text-xs font-mono text-slate-300 lowercase">{language}</span>
        <div className="flex items-center gap-1">
          {executable && onRun && (
            <button 
              onClick={handleRun}
              disabled={isRunning}
              className="p-1.5 hover:bg-slate-600 rounded transition-colors text-slate-400 hover:text-emerald-400 disabled:opacity-50"
              title="运行代码"
            >
              {isRunning ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
            </button>
          )}
          <button 
            onClick={handleCopy}
            className="p-1.5 hover:bg-slate-600 rounded transition-colors text-slate-400 hover:text-white"
            title="复制代码"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {/* Code Area */}
      <div className="p-3 overflow-x-auto font-mono text-sm leading-relaxed bg-[#1e293b]">
        <pre>
          <code className="text-[#e2e8f0] block whitespace-pre-wrap break-words">
            {code}
          </code>
        </pre>
      </div>

      {/* Run Result */}
      {runResult && (
        <div className={`px-3 py-2 border-t border-slate-700 text-xs font-mono ${
          runResult.error || runResult.exitCode !== 0 
            ? 'bg-red-900/20 text-red-300' 
            : 'bg-emerald-900/20 text-emerald-300'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">输出:</span>
              {runResult.exitCode !== 0 && (
                <span className="text-red-400 text-[10px]">退出码: {runResult.exitCode}</span>
              )}
            </div>
            <button
              onClick={() => setRunResult(null)}
              className="text-slate-500 hover:text-slate-300 text-[10px]"
            >
              清除
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-words">
            {runResult.error || runResult.output || '(无输出)'}
          </pre>
        </div>
      )}

      {/* Footer Actions */}
      {onExplain && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-[#1e293b] border-t border-slate-700/50">
          <button 
            onClick={handleExplain}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-400 hover:text-white transition-colors rounded hover:bg-slate-700"
          >
            <Sparkles size={12} />
            <span>解释代码</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CodeBlock;
