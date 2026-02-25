import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// 预处理内联代码，将 `code` 转换为 <code>code</code>
const preprocessInlineCode = (content: string): string => {
  // 匹配单反引号包裹的内联代码 `code`，但不匹配代码块 ```
  return content.replace(/(?<!`)`([^`\n]+)`(?!`)/g, '<code class="inline-code">$1</code>');
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  // 预处理内容
  const processedContent = preprocessInlineCode(content);
  
  return (
    <div className={`markdown-content prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={{
          // 自定义代码块样式
          code({ node, className, children, inline, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const isInlineCodeClass = className === 'inline-code';
            
            // 判断是否为内联代码
            const isInlineCode = isInlineCodeClass || inline === true || (inline !== false && !language);
            
            if (isInlineCode) {
              return (
                <code 
                  className="bg-blue-50 text-primary px-1.5 py-0.5 rounded text-[13px] font-mono font-medium mx-0.5 border border-blue-100"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            
            return (
              <div className="rounded-lg overflow-hidden bg-[#1e293b] my-3 border border-slate-700">
                {language && (
                  <div className="px-3 py-1.5 bg-[#334155] border-b border-slate-600">
                    <span className="text-xs font-mono text-slate-300 lowercase">{language}</span>
                  </div>
                )}
                <pre className="p-3 overflow-x-auto">
                  <code className="text-[#e2e8f0] text-sm font-mono" {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },
          // 处理 pre 标签，避免重复包装
          pre({ children }) {
            return <>{children}</>;
          },
          // 自定义段落样式
          p({ children }) {
            return <p className="text-[15px] text-slate-600 leading-relaxed mb-2 last:mb-0">{children}</p>;
          },
          // 自定义标题样式
          h1({ children }) {
            return <h1 className="text-xl font-bold text-slate-800 mt-4 mb-2">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-bold text-slate-800 mt-3 mb-2">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-bold text-slate-800 mt-3 mb-1">{children}</h3>;
          },
          // 自定义列表样式 - 使用 list-outside 避免块级元素换行问题
          ul({ children }) {
            return <ul className="list-disc list-outside space-y-2 text-slate-600 text-[15px] pl-5 mb-2">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-outside space-y-2 text-slate-600 text-[15px] pl-5 mb-2">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-[15px] pl-1">{children}</li>;
          },
          // 自定义链接样式
          a({ href, children }) {
            return (
              <a 
                href={href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {children}
              </a>
            );
          },
          // 自定义引用块样式
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-primary/30 pl-4 py-1 my-2 text-slate-500 italic">
                {children}
              </blockquote>
            );
          },
          // 自定义表格样式
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2">
                <table className="min-w-full border-collapse border border-slate-200 text-sm">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return <th className="border border-slate-200 px-3 py-2 bg-slate-50 font-semibold text-left">{children}</th>;
          },
          td({ children }) {
            return <td className="border border-slate-200 px-3 py-2">{children}</td>;
          },
          // 自定义强调样式
          strong({ children }) {
            return <strong className="font-semibold text-slate-800">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic">{children}</em>;
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
