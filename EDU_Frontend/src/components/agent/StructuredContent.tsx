import React from 'react';
import { ContentBlock } from './types';
import CodeBlock from './CodeBlock';
import { MarkdownRenderer } from './MarkdownRenderer';

interface StructuredContentProps {
  blocks: ContentBlock[];
  onCodeRun?: (code: string) => Promise<{ output: string; exitCode: number; error?: string }>;
  onCodeExplain?: (code: string, language: string) => void;
}

export const StructuredContent: React.FC<StructuredContentProps> = ({ 
  blocks, 
  onCodeRun,
  onCodeExplain 
}) => {
  if (!blocks || !Array.isArray(blocks)) return null;
  
  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'heading':
            return (
              <h3 key={idx} className="text-base font-bold text-slate-800 mt-3 mb-1">
                {block.text}
              </h3>
            );
          
          case 'text':
            // 使用 MarkdownRenderer 渲染文本，支持粗体、斜体、链接等格式
            return (
              <div key={idx}>
                <MarkdownRenderer content={block.text || ''} />
              </div>
            );
          
          case 'code':
            return (
              <CodeBlock 
                key={idx} 
                language={block.language || 'bash'} 
                code={block.code || ''}
                executable={block.executable}
                onRun={onCodeRun}
                onExplain={onCodeExplain}
              />
            );
          
          case 'image':
            return (
              <div key={idx} className="rounded-lg overflow-hidden border border-slate-200 shadow-sm my-2">
                <img src={block.src} alt="步骤图示" className="w-full h-auto" />
              </div>
            );
          
          case 'list':
            return (
              <ul key={idx} className="list-disc list-inside space-y-1 text-slate-600 text-[15px] pl-2">
                {block.items?.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            );
          
          default:
            return null;
        }
      })}
    </div>
  );
};

export default StructuredContent;
