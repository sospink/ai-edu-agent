import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { AnalysisWordSpan } from './AnalysisWordSpan';

interface Props {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

/**
 * ChatMarkdownRenderer
 *
 * 使用 react-markdown + remark-gfm 实现完整的 Markdown 渲染，
 * 包括表格、列表、标题、分隔线、代码块等。
 * 保留流式打字动画效果。
 */
export const ChatMarkdownRenderer: React.FC<Props> = ({ content, className, isStreaming = false }) => {
  const [staticContent, setStaticContent] = useState('');
  const [animatingContent, setAnimatingContent] = useState('');

  useEffect(() => {
    if (isStreaming) {
      setAnimatingContent(content.slice(staticContent.length));
    } else {
      setStaticContent(content);
      setAnimatingContent('');
    }
  }, [content, isStreaming, staticContent.length]);

  useEffect(() => {
    if (animatingContent.length > 200) {
      const cut = animatingContent.lastIndexOf(' ', 150);
      if (cut > 50) {
        setStaticContent((p) => p + animatingContent.slice(0, cut + 1));
        setAnimatingContent(animatingContent.slice(cut + 1));
      }
    }
  }, [animatingContent]);

  /** 自定义 Markdown 组件映射 */
  const markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
    // 表格
    table: ({ children, ...props }) => (
      <div className="my-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm" {...props}>{children}</table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead className="bg-slate-50 border-b border-slate-200" {...props}>{children}</thead>
    ),
    tbody: ({ children, ...props }) => (
      <tbody className="divide-y divide-slate-100" {...props}>{children}</tbody>
    ),
    tr: ({ children, ...props }) => (
      <tr className="hover:bg-slate-50/50 transition-colors" {...props}>{children}</tr>
    ),
    th: ({ children, ...props }) => (
      <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-slate-600" {...props}>{children}</th>
    ),
    td: ({ children, ...props }) => (
      <td className="px-3 py-2 text-sm text-slate-700" {...props}>{children}</td>
    ),

    // 代码块
    pre: ({ children }) => (
      <pre
        className="my-2 p-3 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-sm font-mono"
        style={{ boxShadow: 'rgba(14,63,126,0.04) 0 0 0 1px, rgba(42,51,69,0.04) 0 1px 1px -0.5px, rgba(42,51,70,0.04) 0 3px 3px -1.5px' }}
      >
        {children}
      </pre>
    ),
    code: ({ className: codeClassName, children, ...props }) => {
      const isInline = !codeClassName;
      if (isInline) {
        return (
          <code className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-sm font-mono" {...props}>
            {children}
          </code>
        );
      }
      const lang = codeClassName?.replace('language-', '') || '';
      return (
        <>
          {lang && <span className="text-xs text-slate-400 block mb-2">{lang}</span>}
          <code className={codeClassName} {...props}>{children}</code>
        </>
      );
    },

    // 标题
    h1: ({ children }) => <h1 className="text-lg font-bold text-slate-900 mt-4 mb-2">{children}</h1>,
    h2: ({ children }) => <h2 className="text-base font-bold text-slate-800 mt-3 mb-2">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-bold text-slate-800 mt-2 mb-1">{children}</h3>,
    h4: ({ children }) => <h4 className="text-sm font-semibold text-slate-700 mt-2 mb-1">{children}</h4>,

    // 列表
    ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc space-y-0.5 marker:text-slate-400">{children}</ul>,
    ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal space-y-0.5 marker:text-slate-400">{children}</ol>,
    li: ({ children }) => <li className="text-sm text-slate-700 pl-0.5">{children}</li>,

    // 分隔线
    hr: () => <hr className="my-3 border-slate-200" />,

    // 段落
    p: ({ children }) => <p className="my-1">{children}</p>,

    // 链接
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:text-primary-600 underline underline-offset-2 transition-colors"
      >
        {children}
      </a>
    ),

    // 加粗
    strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,

    // 斜体
    em: ({ children }) => <em className="italic">{children}</em>,

    // 引用
    blockquote: ({ children }) => (
      <blockquote className="my-2 border-l-3 border-primary-300 bg-primary-50/30 pl-3 py-1 text-sm text-slate-600 italic rounded-r-md">
        {children}
      </blockquote>
    ),
  };

  /** 流式内容 — 用 AnalysisWordSpan 动画展示 */
  const renderAnimated = (text: string) => {
    if (!text) return null;
    return text.split(/(\s+)/).map((w, i) =>
      w.match(/\s+/) ? w : w ? <AnalysisWordSpan key={`a${i}`} word={w} /> : null,
    );
  };

  return (
    <div className={cn('text-sm break-words chat-markdown', className)}>
      {staticContent && (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {staticContent}
        </ReactMarkdown>
      )}
      {animatingContent && (
        <span className="whitespace-pre-wrap">{renderAnimated(animatingContent)}</span>
      )}
    </div>
  );
};
