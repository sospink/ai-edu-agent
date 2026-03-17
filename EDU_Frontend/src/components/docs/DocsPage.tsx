import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import { 
  Cpu, 
  Search, 
  Github, 
  ChevronRight, 
  ArrowLeft, 
  ArrowRight, 
  AlertTriangle, 
  Edit3, 
  ThumbsUp, 
  MessageCircle, 
  Menu, 
  X 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AILogoGif from '@/images/AI logo Foriday.gif';

const sidebarNav = [
  {
      title: '入门指南',
      items: ['快速开始', '核心概念', '开始使用学习中心', '开始使用OpenClaw']
  },
  {
      title: '产品探索',
      items: ['产品结构与功能模块', '智能体实训交互设计']
  },
  {
      title: '技术生态',
      items: ['实训案例详解', '底层技术生态']
  }
];

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    fontFamily: 'Inter, sans-serif',
    primaryColor: '#ffffff',
    primaryTextColor: '#1e293b',
    primaryBorderColor: '#e2e8f0',
    lineColor: '#94a3b8',
    secondaryColor: '#f8fafc',
    tertiaryColor: '#f1f5f9',
    clusterBkg: '#f8fafc',
    clusterBorder: '#e2e8f0',
    nodeBorder: '#e2e8f0',
    nodeTextColor: '#0f172a',
    fontSize: '14px',
    edgeLabelBackground: '#ffffff',
  }
});

const MermaidViewer = React.memo(({ chart }: { chart: string }) => {
  const [svg, setSvg] = useState('');
  
  useEffect(() => {
    let isMounted = true;
    if (chart) {
      const currentId = 'mermaid-' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
      mermaid.render(currentId, chart).then((result) => {
        if (isMounted) {
          setSvg(result.svg);
        }
      }).catch(err => {
        if (isMounted) {
          console.error('Mermaid parsing failed:', err);
          const errorEl = document.getElementById(currentId);
          if (errorEl) errorEl.remove();
          setSvg(`<div class="text-red-500 font-bold p-4 border border-red-200 bg-red-50 rounded-lg text-sm">图表解析失败，请检查语法规范</div>`);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [chart]);
  
  return (
    <div 
      ref={(el) => {
        if (el) {
          if (el.parentElement && el.parentElement.tagName === 'PRE') {
            el.parentElement.style.cssText = 'background:transparent;border:none;box-shadow:none;padding:0;margin:0;width:100%;max-width:100%;';
          }
          const rootSvg = el.querySelector(':scope > svg');
          if (rootSvg) {
            rootSvg.setAttribute('width', '100%');
            rootSvg.removeAttribute('height');
            rootSvg.setAttribute('style', 'max-width:100%;height:auto;');
          }
        }
      }}
      className="my-10 w-full bg-white rounded-2xl p-8 border border-slate-100 shadow-sm overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg || '<div class="text-slate-400 text-sm text-center py-8 animate-pulse">图表渲染中...</div>' }}
    />
  );
});

// Memoized article component — only re-renders when content changes, not on scroll
const MemoizedArticle = React.memo(({ content, headingToId }: { content: string | undefined; headingToId: (t: string) => string }) => {
  return (
    <article className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline prose-code:text-primary-600 prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-slate-900 prose-pre:text-slate-200 prose-img:rounded-xl prose-img:shadow-lg w-full prose-h2:scroll-mt-20">
      {content ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            h2({ children, ...props }) {
              const text = typeof children === 'string' ? children : Array.isArray(children) ? children.map(c => typeof c === 'string' ? c : '').join('') : '';
              const id = headingToId(text);
              return <h2 id={id} {...props}>{children}</h2>;
            },
            code({ node, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              if (match && match[1] === 'mermaid') {
                const codeText = Array.isArray(children) ? children.join('') : String(children);
                return <MermaidViewer chart={codeText.replace(/\n$/, '')} />;
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
          }}
        >
          {content}
        </ReactMarkdown>
      ) : (
        <div className="py-20 text-center text-slate-500 animate-pulse">正在加载或未找到该文档内容...</div>
      )}

      <div className="mt-20 pt-8 border-t border-slate-100 flex justify-between items-center text-slate-400 text-xs">
        <span>最后更新于 2026年3月17日</span>
        <div className="flex gap-4">
          <button className="flex items-center gap-1.5 hover:text-slate-900 transition-colors"><Edit3 className="w-3.5 h-3.5" /> 编辑此页</button>
          <button className="flex items-center gap-1.5 hover:text-slate-900 transition-colors"><ThumbsUp className="w-3.5 h-3.5" /> 有帮助</button>
        </div>
      </div>
    </article>
  );
});

const architectureDocs = import.meta.glob('@/docs/architecture/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

// All pages in order for prev/next navigation
const allPages = sidebarNav.flatMap(s => s.items);

export const DocsPage: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activePage, setActivePage] = useState('产品结构与功能模块');
  const [docContents, setDocContents] = useState<Record<string, string>>({});
  const [contentVisible, setContentVisible] = useState(true);
  const [activeHeading, setActiveHeading] = useState('');
  const activeHeadingRef = useRef('');
  const contentRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const currentContent = docContents[activePage] || '';
  const tocHeadings = Array.from(currentContent.matchAll(/^##\s+(.*)/gm)).map(m => m[1].replace(/<[^>]+>/g, '').trim());

  // Current page index for prev/next
  const currentIdx = allPages.indexOf(activePage);
  const prevPage = currentIdx > 0 ? allPages[currentIdx - 1] : null;
  const nextPage = currentIdx < allPages.length - 1 ? allPages[currentIdx + 1] : null;

  // Generate heading ID from text
  const headingToId = useCallback((text: string) => {
    return text.replace(/\s+/g, '-').replace(/[^\u4e00-\u9fa5a-zA-Z0-9-]/g, '');
  }, []);

  // Page switch with animation
  const switchPage = useCallback((page: string) => {
    if (page === activePage) return;
    setContentVisible(false);
    setTimeout(() => {
      setActivePage(page);
      setActiveHeading('');
      setContentVisible(true);
      // Scroll main content to top
      contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }, 200);
  }, [activePage]);

  // Scroll spy for TOC active heading
  useEffect(() => {
    const container = contentRef.current;
    if (!container || tocHeadings.length === 0) return;

    const handleScroll = () => {
      const headingElements = container.querySelectorAll('h2[id]');
      let current = '';
      headingElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 140) {
          current = el.id;
        }
      });
      // Only update state if the heading actually changed
      if (current !== activeHeadingRef.current) {
        activeHeadingRef.current = current;
        setActiveHeading(current);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [tocHeadings, activePage]);

  // TOC click handler
  const scrollToHeading = useCallback((heading: string) => {
    const id = headingToId(heading);
    const container = contentRef.current;
    if (!container) return;
    const el = container.querySelector(`#${CSS.escape(id)}`);
    if (el) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const scrollTop = container.scrollTop + elRect.top - containerRect.top - 80;
      container.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  }, [headingToId]);

  useEffect(() => {
    const loadDocs = async () => {
      const contents: Record<string, string> = {};
      for (const [path, fetchFn] of Object.entries(architectureDocs)) {
        const name = path.split('/').pop()?.replace('.md', '');
        if (name) contents[name] = await fetchFn();
      }
      setDocContents(contents);
    };
    loadDocs();
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-white text-slate-700">
      <style>{`
        .docs-glass-header {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(226, 232, 240, 0.8);
        }
        
        .docs-nav-active {
            @apply bg-primary-50 text-primary-600 font-semibold border-r-2 border-primary-500;
        }

        @keyframes docsFadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .docs-content-enter {
          animation: docsFadeSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .docs-content-exit {
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.18s ease-out, transform 0.18s ease-out;
        }

        .docs-toc-link {
          position: relative;
          transition: all 0.2s ease;
        }
        .docs-toc-link::before {
          content: '';
          position: absolute;
          left: -17px;
          top: 0;
          bottom: 0;
          width: 2px;
          background: transparent;
          border-radius: 1px;
          transition: background 0.2s ease;
        }
        .docs-toc-active {
          color: var(--color-primary-600) !important;
          font-weight: 700 !important;
        }
        .docs-toc-active::before {
          background: var(--color-primary-500);
        }
      `}</style>
      
      {/* 顶部导航栏 */}
      <header className="docs-glass-header h-16 fixed top-0 w-full z-50 px-6 flex items-center justify-between">
          <div className="flex items-center gap-8">
              <div 
                className="flex items-center gap-2.5 cursor-pointer"
                onClick={() => navigate('/')}
              >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/90">
                      <img src={AILogoGif} alt="Agent EDU" className="h-6 w-6 object-contain" />
                  </div>
                  <span className="font-extrabold text-lg text-slate-900 tracking-tight">Agent EDU Lab <span className="text-primary-600">Docs</span></span>
              </div>
              <nav className="hidden md:flex items-center gap-6">
                  <a href="#" className="text-sm font-semibold text-slate-900">产品</a>
                  <a href="#" className="text-sm font-medium text-slate-500 hover:text-primary-600 transition-colors">定价</a>
              </nav>
          </div>

          <div className="flex items-center gap-4">
              <div className="relative hidden sm:block">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-4 h-4" />
                  </div>
                  <input
                      type="text"
                      className="bg-slate-100 border-none rounded-full pl-10 pr-4 py-1.5 text-sm w-64 focus:ring-2 focus:ring-primary-500/20 focus:bg-white transition-all outline-none"
                      placeholder="搜索文档..."
                  />
                  <div className="absolute right-3 inset-y-0 flex items-center">
                      <span className="text-[10px] font-bold text-slate-400 border border-slate-200 px-1.5 rounded bg-white">K</span>
                  </div>
              </div>
              <div className="h-6 w-px bg-slate-200 mx-1"></div>
              <button className="text-slate-500 hover:text-slate-900"><Github className="w-5 h-5" /></button>
          </div>
      </header>

      <div className="flex flex-1 pt-16">
          {/* 左侧边栏导航 */}
          <aside className={`w-72 fixed left-0 h-[calc(100vh-64px)] overflow-y-auto border-r border-slate-100 bg-white z-40 transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
              <div className="p-6">
                  {sidebarNav.map((section, idx) => (
                      <div key={idx} className="mb-8">
                          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4 px-3">{section.title}</h4>
                          <ul className="space-y-1">
                              {section.items.map((item, i) => (
                                  <li key={i}>
                                      <button
                                          onClick={() => switchPage(item)}
                                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between group ${activePage === item ? 'docs-nav-active' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
                                      >
                                          {item}
                                          {activePage === item && <ChevronRight className="w-3.5 h-3.5" />}
                                      </button>
                                  </li>
                              ))}
                          </ul>
                      </div>
                  ))}
              </div>
          </aside>

          {/* 主内容区域 */}
          <main ref={contentRef} className="flex-1 md:ml-72 flex justify-center overflow-x-hidden overflow-y-auto h-[calc(100vh-64px)]">
              <div className={`max-w-4xl w-full px-8 py-12 ${contentVisible ? 'docs-content-enter' : 'docs-content-exit'}`}
                   key={activePage}>
                  {/* 面包屑导航 */}
                  <nav className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-8 uppercase tracking-widest">
                      <span>文档站</span>
                      <ChevronRight className="w-3 h-3" />
                      <span>架构与引擎</span>
                      <ChevronRight className="w-3 h-3" />
                      <span className="text-primary-600">{activePage}</span>
                  </nav>

                  {/* Markdown 文章渲染内容 */}
                  <MemoizedArticle content={docContents[activePage]} headingToId={headingToId} />

                  {/* 底部翻页组件 */}
                  <div className="mt-12 grid grid-cols-2 gap-4">
                      {prevPage ? (
                        <div onClick={() => switchPage(prevPage)} className="flex flex-col p-4 border border-slate-100 rounded-xl hover:border-primary-300 hover:shadow-sm transition-all group cursor-pointer bg-white">
                          <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">上一篇</span>
                          <span className="text-sm font-bold text-slate-900 group-hover:text-primary-600 transition-colors flex items-center gap-2"><ArrowLeft className="w-3.5 h-3.5" /> {prevPage}</span>
                        </div>
                      ) : <div />}
                      {nextPage ? (
                        <div onClick={() => switchPage(nextPage)} className="flex flex-col p-4 border border-slate-100 rounded-xl hover:border-primary-300 hover:shadow-sm transition-all group cursor-pointer text-right bg-white">
                          <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">下一篇</span>
                          <span className="text-sm font-bold text-slate-900 group-hover:text-primary-600 transition-colors flex items-center justify-end gap-2">{nextPage} <ArrowRight className="w-3.5 h-3.5" /></span>
                        </div>
                      ) : <div />}
                  </div>
              </div>

              {/* 右侧页面大纲 (TOC) */}
              <aside className="hidden lg:block w-64 h-[calc(100vh-64px)] sticky top-16 pt-12 pr-6">
                  <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-4">本页目录</h5>
                  <ul className="space-y-1 border-l border-slate-100 pl-4">
                      {tocHeadings.map((heading, i) => {
                        const hId = headingToId(heading);
                        const isActive = activeHeading === hId || (!activeHeading && i === 0);
                        return (
                          <li key={i}>
                              <button
                                onClick={() => scrollToHeading(heading)}
                                className={`docs-toc-link text-xs text-left w-full px-2 py-1.5 rounded-md transition-all ${isActive ? 'docs-toc-active' : 'font-medium text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
                              >
                                {heading}
                              </button>
                          </li>
                        );
                      })}
                      {tocHeadings.length === 0 && (
                          <li><span className="text-xs font-medium text-slate-400">目前暂无大纲</span></li>
                      )}
                  </ul>
                  <div className="mt-12 p-4 bg-primary-600 rounded-2xl text-white relative overflow-hidden group">
                      <div className="relative z-10">
                          <h6 className="text-xs font-bold mb-1">需要帮助?</h6>
                          <p className="text-[10px] opacity-80 mb-3 leading-relaxed">如果在使用 OpenClaw 过程中遇到困难，请加入我们的社区。</p>
                          <button className="bg-white text-primary-600 text-[10px] font-black px-3 py-1.5 rounded-lg shadow-sm">加入 Slack</button>
                      </div>
                      <MessageCircle className="absolute -bottom-2 -right-2 w-16 h-16 opacity-10 rotate-12 group-hover:scale-110 transition-transform" />
                  </div>
              </aside>
          </main>
      </div>

      {/* 移动端菜单切换按钮 */}
      <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="fixed bottom-6 right-6 w-12 h-12 bg-primary-600 text-white rounded-full shadow-xl flex items-center justify-center z-[60] md:hidden"
      >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>
    </div>
  );
};

export default DocsPage;
