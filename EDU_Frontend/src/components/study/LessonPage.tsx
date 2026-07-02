import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Loader2,
  AlertCircle,
  FileText,
  Download,
  Brain,
  FileType,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { materialApi, type LessonMaterial } from '@/services/course';
import { courseApi } from '@/services/course';
import { getDifyChatbotUrlEncoded, getStaticUrl } from '@/config';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Document, Page, pdfjs } from 'react-pdf';
import { renderAsync } from 'docx-preview';
import CompleteLessonDialog from './CompleteLessonDialog';
import 'highlight.js/styles/vs2015.css';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

// 配置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// 获取资料类型信息
const getMaterialTypeInfo = (type: number, t: TFunction<'lesson'>) => {
  switch (type) {
    case 1: return { icon: FileText, label: 'Markdown', color: 'text-blue-500' };
    case 2: return { icon: FileType, label: 'PDF', color: 'text-red-500' };
    case 3: return { icon: Brain, label: t('mindMap'), color: 'text-purple-500' };
    case 4: return { icon: FileText, label: 'Word', color: 'text-indigo-500' };
    default: return { icon: FileText, label: t('file'), color: 'text-slate-500' };
  }
};

// macOS 风格代码块组件
interface MacCodeBlockProps {
  children: React.ReactNode;
  language?: string;
}

const MacCodeBlock: React.FC<MacCodeBlockProps> = ({ children, language }) => {
  const { t } = useTranslation('lesson');
  const [copied, setCopied] = useState(false);
  const codeContent = extractTextContent(children);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 获取语言显示名称
  const getLanguageLabel = (lang?: string) => {
    if (!lang) return 'Code';
    const langMap: Record<string, string> = {
      js: 'JavaScript',
      javascript: 'JavaScript',
      ts: 'TypeScript',
      typescript: 'TypeScript',
      jsx: 'JSX',
      tsx: 'TSX',
      py: 'Python',
      python: 'Python',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      cs: 'C#',
      go: 'Go',
      rust: 'Rust',
      rb: 'Ruby',
      ruby: 'Ruby',
      php: 'PHP',
      swift: 'Swift',
      kotlin: 'Kotlin',
      sql: 'SQL',
      html: 'HTML',
      css: 'CSS',
      scss: 'SCSS',
      json: 'JSON',
      yaml: 'YAML',
      yml: 'YAML',
      xml: 'XML',
      md: 'Markdown',
      markdown: 'Markdown',
      bash: 'Bash',
      shell: 'Shell',
      sh: 'Shell',
      zsh: 'Zsh',
      powershell: 'PowerShell',
      dockerfile: 'Dockerfile',
      mermaid: 'Mermaid',
    };
    return langMap[lang.toLowerCase()] || lang.toUpperCase();
  };

  return (
    <div className="my-6 rounded-lg overflow-hidden shadow-lg border border-[#3c3c3c] group">
      {/* VS Code 风格标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#323233] border-b border-[#3c3c3c]">
        {/* 红黄绿三个圆点 */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
          <div className="w-3 h-3 rounded-full bg-[#febc2e]"></div>
          <div className="w-3 h-3 rounded-full bg-[#28c840]"></div>
        </div>
        
        {/* 语言标签 */}
        <span className="text-xs font-medium text-[#858585]">
          {getLanguageLabel(language)}
        </span>
        
        {/* 复制按钮 */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#858585] hover:text-[#cccccc] hover:bg-[#3c3c3c] transition-colors opacity-0 group-hover:opacity-100"
          title={t('copyCode')}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#4ec9b0]" />
              <span className="text-[#4ec9b0]">{t('copied')}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>{t('copy')}</span>
            </>
          )}
        </button>
      </div>
      
      {/* 代码内容区域 */}
      <pre className="!m-0 !rounded-none !bg-[#1e1e1e] !text-[#d4d4d4] p-4 overflow-x-auto text-sm font-mono leading-relaxed">
        {children}
      </pre>
    </div>
  );
};

// 提取代码内容的辅助函数
const extractTextContent = (node: React.ReactNode): string => {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractTextContent).join('');
  if (typeof node === 'object' && 'props' in node) {
    return extractTextContent((node as React.ReactElement).props.children);
  }
  return '';
};

// Typora 风格的 Markdown 内容渲染组件
interface MarkdownContentProps {
  content: string;
  lessonTitle: string;
}

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, lessonTitle }) => {
  return (
    <div className="typora-style">
      {/* 标题区域 */}
      <div className="mb-10 pb-6 border-b border-slate-200">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight leading-tight">
          {lessonTitle}
        </h1>
      </div>
      
      {/* Markdown 内容 */}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          // 标题样式
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-slate-800 mt-10 mb-4 pb-2 border-b border-slate-200">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4 pb-2 border-b border-slate-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-3">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-semibold text-slate-700 mt-5 mb-2">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm font-semibold text-slate-700 mt-4 mb-2">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="text-sm font-medium text-slate-600 mt-4 mb-2">
              {children}
            </h6>
          ),
          
          // 段落
          p: ({ children }) => (
            <p className="text-slate-600 leading-relaxed mb-4 text-[15px]">
              {children}
            </p>
          ),
          
          // 链接
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline decoration-blue-300 hover:decoration-blue-500 transition-colors"
            >
              {children}
            </a>
          ),
          
          // 强调
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-800">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-700">{children}</em>
          ),
          
          // 行内代码
          code: ({ className, children, ...props }) => {
            const isCodeBlock = className?.includes('language-') || className?.includes('hljs');
            if (!isCodeBlock) {
              return (
                <code className="px-1.5 py-0.5 mx-0.5 bg-slate-100 text-rose-600 text-sm rounded font-mono">
                  {children}
                </code>
              );
            }
            // 代码块内的 code 标签，保持 highlight.js 的类名
            return (
              <code className={`${className || ''} block`} {...props}>
                {children}
              </code>
            );
          },
          
          // 代码块 - macOS 风格
          pre: ({ children }) => {
            // 尝试从 children 中提取语言类型
            const codeElement = React.Children.toArray(children)[0] as React.ReactElement;
            const className = codeElement?.props?.className || '';
            const languageMatch = className.match(/language-(\w+)/);
            const language = languageMatch ? languageMatch[1] : undefined;
            
            return (
              <MacCodeBlock language={language}>
                {children}
              </MacCodeBlock>
            );
          },
          
          // 引用块
          blockquote: ({ children }) => (
            <blockquote className="my-6 pl-4 border-l-4 border-blue-500 bg-blue-50/50 py-3 pr-4 rounded-r-lg">
              <div className="text-slate-600 italic">{children}</div>
            </blockquote>
          ),
          
          // 无序列表
          ul: ({ children }) => (
            <ul className="my-4 ml-6 space-y-2 list-disc marker:text-slate-400">
              {children}
            </ul>
          ),
          
          // 有序列表
          ol: ({ children }) => (
            <ol className="my-4 ml-6 space-y-2 list-decimal marker:text-slate-500 marker:font-medium">
              {children}
            </ol>
          ),
          
          // 列表项
          li: ({ children }) => (
            <li className="text-slate-600 text-[15px] leading-relaxed pl-1">
              {children}
            </li>
          ),
          
          // 表格
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
              <table className="w-full text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-50 border-b border-slate-200">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left font-semibold text-slate-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-slate-600 border-b border-slate-100">
              {children}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-50 transition-colors">
              {children}
            </tr>
          ),
          
          // 水平线
          hr: () => (
            <hr className="my-8 border-t-2 border-slate-200" />
          ),
          
          // 图片
          img: ({ src, alt }) => (
            <figure className="my-6">
              <img 
                src={src} 
                alt={alt || ''} 
                className="rounded-xl shadow-lg max-w-full h-auto mx-auto"
              />
              {alt && (
                <figcaption className="text-center text-sm text-slate-500 mt-3 italic">
                  {alt}
                </figcaption>
              )}
            </figure>
          ),
          
          // 任务列表（GFM）
          input: ({ type, checked }) => {
            if (type === 'checkbox') {
              return (
                <input 
                  type="checkbox" 
                  checked={checked} 
                  readOnly 
                  className="mr-2 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              );
            }
            return <input type={type} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
      
      {/* 底部留白 */}
      <div className="h-20"></div>
    </div>
  );
};

// PDF 预览组件 - 使用 react-pdf 实现更好的渲染
interface PDFViewerProps {
  url: string;
  title: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ url, title }) => {
  const { t } = useTranslation('lesson');
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [pdfLoading, setPdfLoading] = useState<boolean>(true);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isCompact, setIsCompact] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // 监听工具栏宽度变化
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setIsCompact(entry.contentRect.width < 500);
      }
    });

    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfLoading(false);
    setPdfError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF 加载失败:', error);
    setPdfLoading(false);
    setPdfError(t('pdfFailed'));
  };

  const goToPrevPage = () => setPageNumber(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(numPages, prev + 1));
  const zoomIn = () => setScale(prev => Math.min(2.0, prev + 0.2));
  const zoomOut = () => setScale(prev => Math.max(0.5, prev - 0.2));

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* PDF 工具栏 */}
      <div 
        ref={toolbarRef}
        className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shadow-sm"
      >
        <h2 className="font-bold text-slate-800 text-sm truncate max-w-[200px]" title={title}>
          {title}
        </h2>
        
        <div className="flex items-center gap-2">
          {/* 页码控制 */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1">
            <button
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              className="p-1 rounded hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-xs font-medium text-slate-600 min-w-[60px] text-center">
              {pageNumber} / {numPages || '-'}
            </span>
            <button
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
              className="p-1 rounded hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* 缩放控制 */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1">
            <button onClick={zoomOut} className="p-1 rounded hover:bg-slate-200">
              <ZoomOut className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-xs font-medium text-slate-600 min-w-[40px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={zoomIn} className="p-1 rounded hover:bg-slate-200">
              <ZoomIn className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* 新窗口打开 */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700"
            title={t('openNewWindow')}
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* 下载按钮 - 窄屏只显示图标 */}
          <a
            href={url}
            download
            className={`flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-xs font-medium text-white transition-colors ${
              isCompact ? 'p-2' : 'px-3 py-1.5'
            }`}
            title={t('download')}
          >
            <Download className="w-3.5 h-3.5 flex-shrink-0" />
            {!isCompact && <span>{t('download')}</span>}
          </a>
        </div>
      </div>

      {/* PDF 内容区域 */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center p-4 bg-slate-100"
      >
        {pdfLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}
        
        {pdfError && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <AlertCircle className="w-12 h-12 mb-4" />
            <p className="mb-4">{pdfError}</p>
            <a
              href={url}
              download
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              {t('downloadPdf')}
            </a>
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="shadow-xl rounded-lg overflow-hidden"
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            className="bg-white"
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>
    </div>
  );
};

// DOCX 预览组件 - 固定高保真(docx-preview)
interface DocxViewerProps {
  url: string;
  title: string;
}

const DocxViewer: React.FC<DocxViewerProps> = ({ url, title }) => {
  const { t } = useTranslation('lesson');
  const [docxLoading, setDocxLoading] = useState<boolean>(true);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [fitToWidth, setFitToWidth] = useState<boolean>(true);
  const [docxZoom, setDocxZoom] = useState<number>(1);
  const previewRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const metricsRef = useRef<{ contentMinX: number; contentWidth: number } | null>(null);

  const updateFidelityLayout = useCallback(() => {
    if (!fitToWidth) {
      setDocxZoom(1);
      if (previewRef.current) {
        previewRef.current.style.setProperty('--docx-zoom', '1');
        previewRef.current.style.setProperty('--docx-offset-x', '0px');
      }
      return;
    }

    if (!previewRef.current || !viewportRef.current) return;
    const metrics = metricsRef.current;
    if (!metrics || !metrics.contentWidth) return;

    const availableWidth = Math.max(1, viewportRef.current.clientWidth - 24);
    const nextZoom = Math.min(1, Math.max(0.05, availableWidth / metrics.contentWidth));
    const offsetX = -metrics.contentMinX + Math.max(0, (availableWidth / nextZoom - metrics.contentWidth) / 2);
    setDocxZoom(nextZoom);
    previewRef.current.style.setProperty('--docx-zoom', String(nextZoom));
    previewRef.current.style.setProperty('--docx-offset-x', `${offsetX}px`);
  }, [fitToWidth]);

  const collectDocxMetrics = useCallback((): { contentMinX: number; contentWidth: number } | null => {
    if (!previewRef.current) return null;

    const pages = Array.from(previewRef.current.querySelectorAll('section.docx')) as HTMLElement[];
    if (pages.length === 0) return null;

    const selector = 'h1,h2,h3,h4,h5,h6,p,span,table,img,svg,canvas,a,li,pre,code,blockquote,strong,em';

    let globalMinX = Number.POSITIVE_INFINITY;
    let globalMaxX = 0;
    let maxPageWidth = 0;

    for (const page of pages) {
      const pageWidth = page.offsetWidth || 0;
      maxPageWidth = Math.max(maxPageWidth, pageWidth);
      const pageRect = page.getBoundingClientRect();

      const elements = Array.from(page.querySelectorAll(selector)) as HTMLElement[];
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;

        const left = rect.left - pageRect.left;
        const right = rect.right - pageRect.left;
        if (!Number.isFinite(left) || !Number.isFinite(right)) continue;

        globalMinX = Math.min(globalMinX, left);
        globalMaxX = Math.max(globalMaxX, right);
      }
    }

    if (!Number.isFinite(globalMinX) || globalMaxX <= globalMinX) {
      return { contentMinX: 0, contentWidth: maxPageWidth };
    }

    const contentMinX = Math.max(0, globalMinX - 6);
    const contentWidth = Math.max(1, Math.min(maxPageWidth, globalMaxX - contentMinX + 6));
    return { contentMinX, contentWidth };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDocx = async () => {
      setDocxLoading(true);
      setDocxError(null);
      if (previewRef.current) {
        previewRef.current.innerHTML = '';
      }
      metricsRef.current = null;

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(t('documentFailed', { status: response.status }));
        }

        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;
        if (!previewRef.current) return;

        await renderAsync(arrayBuffer, previewRef.current, undefined, {
          className: 'docx-preview',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: true,
          breakPages: true,
          useBase64URL: true,
          experimental: false,
        });

        if (!cancelled) {
          metricsRef.current = collectDocxMetrics();
          requestAnimationFrame(() => updateFidelityLayout());
          setTimeout(() => {
            metricsRef.current = collectDocxMetrics();
            updateFidelityLayout();
          }, 120);
          setDocxLoading(false);
        }
      } catch (error) {
        console.error('DOCX 加载失败:', error);
        if (!cancelled) {
          setDocxError(t('wordFailed'));
          setDocxLoading(false);
        }
      }
    };

    loadDocx();

    return () => {
      cancelled = true;
      if (previewRef.current) {
        previewRef.current.innerHTML = '';
      }
    };
  }, [url, collectDocxMetrics, updateFidelityLayout]);

  useEffect(() => {
    if (!viewportRef.current) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => updateFidelityLayout());
    });
    observer.observe(viewportRef.current);

    return () => observer.disconnect();
  }, [updateFidelityLayout]);

  useEffect(() => {
    requestAnimationFrame(() => updateFidelityLayout());
  }, [fitToWidth, updateFidelityLayout]);

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shadow-sm">
        <h2 className="font-bold text-slate-800 text-sm truncate max-w-[300px]" title={title}>
          {title}
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFitToWidth((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium"
            title={fitToWidth ? t('originalScale') : t('fitWidth')}
          >
            {fitToWidth ? t('fitWidthValue', { percent: Math.round(docxZoom * 100) }) : t('originalScaleLabel')}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700"
            title={t('openNewWindow')}
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href={url}
            download
            className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
            title={t('download')}
          >
            <Download className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{t('download')}</span>
          </a>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={`flex-1 p-3 bg-slate-100 relative ${
          fitToWidth ? 'overflow-y-auto overflow-x-hidden' : 'overflow-auto'
        }`}
      >
        <div className="docx-fidelity-stage min-h-full">
          <div ref={previewRef} className={`docx-fidelity-root ${fitToWidth ? 'fit' : 'origin'}`} />
        </div>

        {docxLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}

        {docxError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-100">
            <AlertCircle className="w-12 h-12 mb-4" />
            <p className="mb-4">{docxError}</p>
            <a
              href={url}
              download
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              {t('downloadWord')}
            </a>
          </div>
        )}
      </div>

      <style>{`
        .docx-fidelity-stage {
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }
        .docx-fidelity-root .docx-wrapper {
          background: #f1f5f9 !important;
          padding: 12px !important;
          width: max-content !important;
          min-width: max-content !important;
          margin: 0 auto !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }
        .docx-fidelity-root.fit .docx-wrapper {
          transform: translateX(var(--docx-offset-x, 0px)) scale(var(--docx-zoom, 1));
          transform-origin: top left;
        }
        .docx-fidelity-root.origin .docx-wrapper {
          transform: none;
        }
        .docx-fidelity-root .docx-wrapper > section.docx {
          width: fit-content !important;
          margin: 0 auto 14px auto !important;
          box-shadow: 0 2px 10px rgba(15, 23, 42, 0.12) !important;
        }
        .docx-fidelity-root .docx-wrapper table,
        .docx-fidelity-root .docx-wrapper img,
        .docx-fidelity-root .docx-wrapper svg,
        .docx-fidelity-root .docx-wrapper canvas {
          max-width: 100% !important;
          height: auto !important;
        }
      `}</style>
    </div>
  );
};

// 思维导图预览组件 - 更好的 UI 展示
interface MindMapViewerProps {
  url: string;
  title: string;
  fileName: string;
}

const MindMapViewer: React.FC<MindMapViewerProps> = ({ url, title, fileName }) => {
  const { t } = useTranslation('lesson');
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-50 to-indigo-50">
      <div className="text-center max-w-md">
        {/* 动画图标 */}
        <div className="relative mb-6">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-purple-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-xl shadow-purple-500/30 transform rotate-3">
            <Brain className="w-12 h-12 text-white" />
          </div>
          {/* 装饰性圆点 */}
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-pink-400 rounded-full animate-pulse"></div>
          <div className="absolute -bottom-1 -left-3 w-4 h-4 bg-blue-400 rounded-full animate-pulse delay-300"></div>
        </div>

        <h3 className="text-2xl font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-500 mb-2 text-sm">{fileName}</p>
        
        <div className="bg-white/60 backdrop-blur rounded-xl p-4 mb-6 border border-purple-100">
          <p className="text-slate-600 text-sm leading-relaxed">
            {t('mindMapDesc')}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <a
            href={url}
            download={fileName}
            className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-0.5"
          >
            <Download className="w-5 h-5" />
            {t('downloadMindMap')}
          </a>
          
          <p className="text-xs text-slate-400">
            {t('recommended')}
          </p>
        </div>
      </div>
    </div>
  );
};

// Hero UI 风格的 Tab 标签页组件（只显示图标）
interface MaterialTabsProps {
  materials: LessonMaterial[];
  currentIndex: number;
  onSelect: (index: number) => void;
  compact?: boolean;
}

const MaterialTabs: React.FC<MaterialTabsProps> = ({ materials, currentIndex, onSelect, compact = false }) => {
  const { t } = useTranslation('lesson');
  if (compact) {
    return (
      <div className="inline-flex items-center p-1 bg-slate-100/80 rounded-xl">
        {materials.map((material, index) => {
        const typeInfo = getMaterialTypeInfo(material.type, t);
          const TypeIcon = typeInfo.icon;
          const isActive = index === currentIndex;

          return (
            <button
              key={material.id}
              onClick={() => onSelect(index)}
              className={`relative px-2.5 py-1.5 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-white shadow-sm text-slate-800'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title={material.title}
            >
              <TypeIcon className={`w-4 h-4 ${isActive ? typeInfo.color : ''}`} />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="px-6 py-3 border-b border-slate-100 bg-white/50">
      <div className="inline-flex items-center p-1 bg-slate-100/80 rounded-xl">
        {materials.map((material, index) => {
          const typeInfo = getMaterialTypeInfo(material.type, t);
          const TypeIcon = typeInfo.icon;
          const isActive = index === currentIndex;

          return (
            <button
              key={material.id}
              onClick={() => onSelect(index)}
              className={`relative px-4 py-2 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-white shadow-sm text-slate-800'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              title={material.title}
            >
              <TypeIcon className={`w-5 h-5 ${isActive ? typeInfo.color : ''}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

// 主组件
const LessonPage: React.FC = () => {
  const { t } = useTranslation('lesson');
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // 从 URL 参数获取技能名称、课时名称、课程 ID
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const skillName = searchParams.get('skillName') || t('defaultSkill');
  const lessonName = searchParams.get('lessonName') || '';
  const queryCourseId = searchParams.get('courseId');
  const initialCourseId = queryCourseId ? parseInt(queryCourseId, 10) : NaN;

  const [isDocCollapsed, setIsDocCollapsed] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(45);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [materials, setMaterials] = useState<LessonMaterial[]>([]);
  const [currentMaterialIndex, setCurrentMaterialIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [assistantIframeLoaded, setAssistantIframeLoaded] = useState(false);
  const [courseId, setCourseId] = useState<number | null>(Number.isNaN(initialCourseId) ? null : initialCourseId);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [difyIframeSrc, setDifyIframeSrc] = useState('');

  // 完成实验相关状态
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [earnedXP, setEarnedXP] = useState(0);
  
  // 学习时长计时器（从0开始计时）
  const [studySeconds, setStudySeconds] = useState(0);
  
  // 学习时长计时
  useEffect(() => {
    const timer = setInterval(() => {
      setStudySeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  
  // 格式化时间显示
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const navigateBackSafely = useCallback(() => {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.focus();
      }
    } catch (err) {
      console.warn('[LessonPage] 无法访问 opener:', err);
    }

    try {
      window.close();
    } catch (err) {
      console.warn('[LessonPage] 关闭窗口失败，回退路由:', err);
    }

    window.setTimeout(() => {
      if (window.closed) return;
      if (window.history.length > 1) {
        navigate(-1);
        return;
      }
      navigate('/study', { replace: true });
    }, 120);
  }, [navigate]);

  const handleResetLayout = useCallback(() => {
    setIsDocCollapsed(false);
    setLeftPanelWidth(45);
  }, []);

  const handleCompleteDialogClose = useCallback(() => {
    setShowCompleteDialog(false);

    const goStudyPage = () => {
      navigate('/study', { replace: true });
    };

    try {
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.location.assign('/study');
          window.opener.focus();
        } catch (openerErr) {
          console.warn('[LessonPage] 无法控制 opener，回退到当前页跳转:', openerErr);
        }
      }
    } catch (err) {
      console.warn('[LessonPage] 访问 opener 失败:', err);
    }

    try {
      window.close();
    } catch (err) {
      console.warn('[LessonPage] 关闭窗口失败，回退到站内跳转:', err);
    }

    window.setTimeout(() => {
      if (!window.closed) {
        goStudyPage();
      }
    }, 120);
  }, [navigate]);

  // 完成实验
  const handleCompleteLesson = async () => {
    if (!lessonId || completing) return;

    // 检查登录状态
    const token = localStorage.getItem('authToken');
    console.log('[LessonPage] 完成实验 - lessonId:', lessonId);
    console.log('[LessonPage] 完成实验 - token存在:', !!token);
    
    if (!token) {
      alert(t('loginBeforeComplete'));
      return;
    }

    setCompleting(true);
    try {
      const response = await courseApi.completeLesson(parseInt(lessonId));
      console.log('[LessonPage] 完成实验响应:', response);
      
      if (response.success && response.data) {
        setEarnedXP(response.data.earnedXP || 0);
        setShowCompleteDialog(true);
      } else {
        console.error('[LessonPage] 完成实验失败:', response.error);
        alert(response.error || t('completeFailed'));
      }
    } catch (err) {
      console.error('完成实验失败:', err);
      alert(t('networkError'));
    } finally {
      setCompleting(false);
    }
  };

  // 加载课时资料
  useEffect(() => {
    const fetchMaterials = async () => {
      if (!lessonId) return;
      
      try {
        setLoading(true);
        setError(null);
        const response = await materialApi.getList(parseInt(lessonId));
        
        if (response.success && response.data) {
          setMaterials(response.data);
          if (response.data.length === 0) {
            setError(t('noMaterials'));
          }
        } else {
          setError(response.error || t('loadFailed'));
        }
      } catch (err) {
        console.error('加载资料失败:', err);
        setError(t('networkError'));
      } finally {
        setLoading(false);
      }
    };

    fetchMaterials();
  }, [lessonId]);

  // 加载课程上下文（用于 Dify 动态开场）
  useEffect(() => {
    const fetchCourseContext = async () => {
      const lessonNumber = lessonId ? parseInt(lessonId, 10) : NaN;
      if (!lessonId || Number.isNaN(lessonNumber)) return;

      let resolvedCourseId = Number.isNaN(initialCourseId) ? null : initialCourseId;

      try {
        if (!resolvedCourseId) {
          const lessonResponse = await courseApi.getLessonById(lessonNumber);
          if (lessonResponse.success && lessonResponse.data) {
            resolvedCourseId = lessonResponse.data.courseId;
          }
        }

        if (!resolvedCourseId) return;

        const courseResponse = await courseApi.getById(resolvedCourseId);
        if (!courseResponse.success || !courseResponse.data) return;

        setCourseId(resolvedCourseId);
        setCourseTitle(courseResponse.data.title || '');
        setCourseDescription(courseResponse.data.description || '');
      } catch (err) {
        console.warn('[LessonPage] 加载课程上下文失败:', err);
      }
    };

    fetchCourseContext();
  }, [lessonId, initialCourseId]);

  useEffect(() => {
    let cancelled = false;

    const buildDifyUrl = async () => {
      const shortCourseDesc = courseDescription.length > 320
        ? `${courseDescription.slice(0, 320)}...`
        : courseDescription;
      const difyUserId = courseId && lessonId
        ? `course-${courseId}-lesson-${lessonId}`
        : undefined;

      const url = await getDifyChatbotUrlEncoded({
        'sys.user_id': difyUserId,
        course_id: courseId ?? undefined,
        course_title: courseTitle || undefined,
        course_desc: shortCourseDesc || undefined,
        skill_name: skillName || undefined,
        lesson_name: lessonName || undefined,
      });

      if (!cancelled) {
        setDifyIframeSrc(url);
      }
    };

    buildDifyUrl().catch((err) => {
      console.warn('[LessonPage] 生成 Dify URL 失败:', err);
      if (!cancelled) {
        setDifyIframeSrc('');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [courseDescription, courseId, courseTitle, lessonId, lessonName, skillName]);

  useEffect(() => {
    setAssistantIframeLoaded(false);
  }, [difyIframeSrc]);

  // 加载 Markdown 内容
  useEffect(() => {
    const fetchMarkdownContent = async () => {
      const currentMaterial = materials[currentMaterialIndex];
      if (!currentMaterial || currentMaterial.type !== 1) {
        setMarkdownContent('');
        return;
      }

      try {
        setLoadingContent(true);
        const url = getStaticUrl(currentMaterial.fileUrl);
        const response = await fetch(url);
        if (response.ok) {
          const text = await response.text();
          setMarkdownContent(text);
        } else {
          setMarkdownContent(t('markdownFailed'));
        }
      } catch (err) {
        console.error('加载 Markdown 失败:', err);
        setMarkdownContent(t('markdownFailed'));
      } finally {
        setLoadingContent(false);
      }
    };

    fetchMarkdownContent();
  }, [materials, currentMaterialIndex]);

  // 拖拽逻辑
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    if (newWidth >= 25 && newWidth <= 60) {
      setLeftPanelWidth(newWidth);
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, [isDragging]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const currentMaterial = materials[currentMaterialIndex];

  // 渲染左侧内容
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <AlertCircle className="w-12 h-12 mb-4" />
          <p>{error}</p>
        </div>
      );
    }

    if (!currentMaterial) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
          <BookOpen className="w-12 h-12 mb-4" />
          <p>{t('noMaterials')}</p>
        </div>
      );
    }

    // Markdown 类型
    if (currentMaterial.type === 1) {
      if (loadingContent) {
        return (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        );
      }
      return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <MarkdownContent content={markdownContent} lessonTitle={currentMaterial.title} />
        </div>
      );
    }

    // PDF 类型
    if (currentMaterial.type === 2) {
      return (
        <div className="flex-1 overflow-hidden">
          <PDFViewer 
            url={getStaticUrl(currentMaterial.fileUrl)} 
            title={currentMaterial.title} 
          />
        </div>
      );
    }

    // Word 类型
    if (currentMaterial.type === 4) {
      return (
        <div className="flex-1 overflow-hidden">
          <DocxViewer
            url={getStaticUrl(currentMaterial.fileUrl)}
            title={currentMaterial.title}
          />
        </div>
      );
    }

    // 思维导图或其他类型 - 使用新的 MindMapViewer 组件
    return (
      <MindMapViewer
        url={getStaticUrl(currentMaterial.fileUrl)}
        title={currentMaterial.title}
        fileName={currentMaterial.fileName}
      />
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F0F2F5]">
      {/* 顶部 Header - 亮色主题 */}
      <div className="h-10 min-h-[40px] flex items-center justify-between px-4 bg-white border-b border-slate-200 select-none">
        {/* 左侧：技能图标 + 技能名称/课时名称 */}
        <div className="flex items-center gap-3">
          <button
            onClick={navigateBackSafely}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-700"
            title={t('back')}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="text-sm font-semibold">{skillName}</span>
            {lessonName && (
              <>
                <span className="text-slate-300">/</span>
                <span className="text-sm text-slate-500 max-w-[300px] truncate">
                  {lessonName}
                </span>
              </>
            )}
          </div>
        </div>

        {/* 右侧：进度 + 学习时长 + 完成按钮 */}
        <div className="flex items-center gap-4">
          {/* 进度 */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              <span className="text-xs font-medium text-slate-600">
                {materials.length > 0 ? `${currentMaterialIndex + 1}/${materials.length}` : '0/0'}
              </span>
            </div>
          </div>
          
          {/* 学习时长 */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 rounded-full">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-mono font-medium text-blue-600">
              {formatTime(studySeconds)}
            </span>
          </div>

          {/* 完成实验按钮 */}
          <button
            onClick={handleCompleteLesson}
            disabled={completing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
          >
            {completing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t('submitting')}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('completeLab')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 主内容区域 */}
      <div 
        ref={containerRef}
        className="flex flex-1 overflow-hidden relative"
      >

      {/* 左侧面板：学习资料 */}
      <div
        style={{ 
          width: isDocCollapsed ? '0%' : `${leftPanelWidth}%`,
          transition: isDragging ? 'none' : 'width 0.3s ease, opacity 0.3s ease'
        }}
        className={`relative z-10 flex flex-col h-full bg-white/80 backdrop-blur-xl shadow-2xl ${
          isDocCollapsed ? 'opacity-0 overflow-hidden' : 'opacity-100'
        }`}
      >
        {/* Header */}
        <div className="h-14 min-h-[56px] flex items-center justify-between px-6 border-b border-slate-100 bg-white/50">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={navigateBackSafely}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
              title={t('back')}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-slate-600">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider">
                {t('materials')}
              </span>
            </div>
            {materials.length > 1 && (
              <div className="max-w-[240px] overflow-x-auto">
                <MaterialTabs
                  materials={materials}
                  currentIndex={currentMaterialIndex}
                  onSelect={setCurrentMaterialIndex}
                  compact
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetLayout}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
              title={t('resetLayout')}
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsDocCollapsed(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
              title={t('collapsePanel')}
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        {renderContent()}

        {/* Footer */}
        <div className="h-12 min-h-[48px] border-t border-slate-100 bg-white px-6 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400">
            {materials.length > 0 ? t('materialProgress', { current: currentMaterialIndex + 1, total: materials.length }) : t('noMaterialShort')}
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentMaterialIndex(Math.max(0, currentMaterialIndex - 1))}
              disabled={currentMaterialIndex === 0 || materials.length === 0}
              className="p-1.5 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setCurrentMaterialIndex(Math.min(materials.length - 1, currentMaterialIndex + 1))}
              disabled={currentMaterialIndex >= materials.length - 1 || materials.length === 0}
              className="px-4 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('next')} <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 拖拽分割线 */}
      {!isDocCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          className="relative z-20 w-1 bg-slate-200 hover:bg-blue-500 cursor-col-resize group flex items-center justify-center transition-colors"
        >
          <div className="absolute p-1 bg-slate-300 group-hover:bg-blue-500 rounded transition-colors">
            <GripVertical className="w-3 h-3 text-slate-500 group-hover:text-white" />
          </div>
        </div>
      )}

      {/* 收起时的展开按钮 */}
      <AnimatePresence>
        {isDocCollapsed && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            onClick={() => setIsDocCollapsed(false)}
            className="absolute top-4 left-4 z-50 p-2 bg-white shadow-lg rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* 右侧面板：AI 智能体教师 */}
      <div className="flex-1 relative h-full bg-slate-100 overflow-hidden">
        <div className="relative h-full overflow-hidden">
          {!difyIframeSrc && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 px-6 text-center">
              {t('difyMissing')}
            </div>
          )}
          {difyIframeSrc && (
            <>
              {!assistantIframeLoaded && (
                <div className="absolute inset-0 bg-slate-100" />
              )}
              <iframe
                src={difyIframeSrc}
                className="absolute inset-0 block w-full border-0"
                style={{
                  // Dify 在较低 iframe 视口时会裁切首条头像，这里做纵向缩放+高度补偿规避裁切
                  height: '105.26%',
                  transform: 'scaleY(0.95)',
                  transformOrigin: 'top',
                  pointerEvents: isDragging ? 'none' : 'auto',
                  opacity: assistantIframeLoaded ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                  background: '#f1f5f9',
                }}
                onLoad={() => setAssistantIframeLoaded(true)}
                allow="microphone"
                title={t('aiTeacher')}
              />
            </>
          )}
        </div>
      </div>
      </div>

      {/* 完成实验 Dialog */}
      <CompleteLessonDialog
        isOpen={showCompleteDialog}
        onClose={handleCompleteDialogClose}
        lessonName={lessonName}
        earnedXP={earnedXP}
        actionText={t('backLearning')}
        duration={(() => {
          const mins = Math.floor(studySeconds / 60);
          const secs = studySeconds % 60;
          if (mins > 0) return t('durationMinutes', { minutes: mins, seconds: secs });
          return t('durationSeconds', { seconds: secs });
        })()}
      />
    </div>
  );
};

export default LessonPage;
