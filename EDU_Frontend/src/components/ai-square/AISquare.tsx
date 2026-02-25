import React, { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { 
  ExternalLink, Zap, Search, Command, Cpu, Layers, Network, Code2, Sparkles
} from 'lucide-react';

// --- Types ---

interface Tool {
  id: string;
  name: string;
  desc: string;
  url: string;
  imageUrl?: string;
  logoText?: string;
  color?: string;
  hot?: boolean;
  featured?: boolean;
}

interface Category {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  tools: Tool[];
  gradient: string;
}

// --- Data ---

const categories: Category[] = [
  {
    id: "agents",
    title: "智能体平台",
    subtitle: "Agent Orchestration",
    icon: Network,
    gradient: "from-violet-500 to-fuchsia-500",
    tools: [
      { id: "coze", name: "Coze 扣子", desc: "新一代 AI Bot 构建平台", color: "bg-gradient-to-br from-blue-500 to-purple-600", url: "https://www.coze.cn/", logoText: "Co", featured: true },
      { id: "dify", name: "Dify", desc: "开源 LLM 应用开发平台", color: "bg-gradient-to-br from-indigo-500 to-blue-600", url: "https://dify.ai/", logoText: "Di", featured: true },
    ]
  },
  {
    id: "models",
    title: "基座大模型",
    subtitle: "Foundation Models",
    icon: Cpu,
    gradient: "from-blue-500 to-cyan-500",
    tools: [
      { id: "chatgpt", name: "ChatGPT", desc: "开创 AI 对话新时代", color: "bg-gradient-to-br from-emerald-500 to-teal-600", url: "https://chat.openai.com/", logoText: "GPT" },
      { id: "claude", name: "Claude 3.5", desc: "最接近人类的智能助手", color: "bg-gradient-to-br from-orange-400 to-amber-500", url: "https://claude.ai/", logoText: "Cl" },
      { id: "gemini", name: "Gemini", desc: "Google 多模态 AI 模型", color: "bg-gradient-to-br from-blue-400 to-indigo-500", url: "https://gemini.google.com/", logoText: "Ge" },
      { id: "deepseek", name: "DeepSeek", desc: "顶级代码推理能力", color: "bg-blue-700", url: "https://www.deepseek.com/", logoText: "DS", hot: true },
    ]
  },
  {
    id: "creation",
    title: "多模态创作",
    subtitle: "Creative Matrix",
    icon: Layers,
    gradient: "from-rose-500 to-orange-500",
    tools: [
      { id: "midjourney", name: "Midjourney", desc: "超写实图像生成", color: "bg-gradient-to-br from-slate-700 to-slate-900", url: "https://www.midjourney.com/", logoText: "MJ" },
      { id: "runway", name: "Runway", desc: "Gen-3 视频合成引擎", color: "bg-gradient-to-br from-purple-500 to-pink-500", url: "https://runwayml.com/", logoText: "Rw", hot: true },
      { id: "suno", name: "Suno", desc: "文字生成音乐", color: "bg-gradient-to-br from-rose-500 to-red-600", url: "https://suno.ai/", logoText: "Sn" },
      { id: "gamma", name: "Gamma", desc: "AI 驱动的演示文稿", color: "bg-gradient-to-br from-violet-500 to-purple-600", url: "https://gamma.app/", logoText: "Gm" },
    ]
  },
  {
    id: "dev",
    title: "开发与科研",
    subtitle: "Dev & Research",
    icon: Code2,
    gradient: "from-emerald-500 to-teal-500",
    tools: [
      { id: "cursor", name: "Cursor", desc: "AI 代码编辑器", color: "bg-gradient-to-br from-slate-800 to-slate-900", url: "https://cursor.sh/", logoText: "Cu", hot: true },
      { id: "perplexity", name: "Perplexity", desc: "实时答案搜索引擎", color: "bg-gradient-to-br from-cyan-500 to-blue-600", url: "https://www.perplexity.ai/", logoText: "Px" },
      { id: "v0", name: "v0.dev", desc: "用提示词生成 UI", color: "bg-gradient-to-br from-slate-900 to-black", url: "https://v0.dev/", logoText: "v0" },
    ]
  }
];

// --- Visual Components ---

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

// 3D Tilt Card Component
const TiltCard: React.FC<TiltCardProps> = ({ children, className = "", onClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 150, damping: 15 });
  const mouseY = useSpring(y, { stiffness: 150, damping: 15 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      const width = rect.width;
      const height = rect.height;
      const mouseXVal = e.clientX - rect.left;
      const mouseYVal = e.clientY - rect.top;
      const xPct = mouseXVal / width - 0.5;
      const yPct = mouseYVal / height - 0.5;
      x.set(xPct);
      y.set(yPct);
    }
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  const rotateX = useTransform(mouseY, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], [-8, 8]);
  const brightness = useTransform(mouseY, [-0.5, 0.5], [1.1, 0.9]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        filter: useMotionTemplate`brightness(${brightness})`,
        transformStyle: "preserve-3d",
      }}
      onClick={onClick}
      className={`relative transition-all duration-200 ease-linear ${className}`}
    >
      {children}
    </motion.div>
  );
};


// High-Fidelity Tool Card
const ToolCard = ({ tool, featured = false }: { tool: Tool; featured?: boolean }) => (
  <a
    href={tool.url}
    target="_blank"
    rel="noopener noreferrer"
    className={`block h-full relative group rounded-2xl transition-all duration-300 overflow-hidden ${
      featured
        ? 'bg-white shadow-lg hover:shadow-xl'
        : 'bg-white shadow-md hover:shadow-lg'
    }`}
  >
    {/* Inner Glow on Hover */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-50 to-transparent opacity-0 group-hover:opacity-100 translate-x-[-100%] group-hover:translate-x-[100%] transition-all duration-1000 pointer-events-none z-10" />

    <div className={`flex ${featured ? 'flex-row items-center p-6 gap-6' : 'flex-row items-center p-4 gap-4'} h-full`}>
      {/* Logo - 统一使用文字 logo */}
      <div
        className={`relative shrink-0 flex items-center justify-center rounded-xl shadow-md overflow-hidden ${featured ? 'w-16 h-16' : 'w-12 h-12'} ${tool.color || 'bg-slate-900'}`}
      >
        <span className={`text-white font-bold ${featured ? 'text-xl' : 'text-sm'}`}>{tool.logoText}</span>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 className={`font-bold text-slate-800 ${featured ? 'text-xl' : 'text-base'} truncate pr-2`}>
            {tool.name}
          </h3>
          {tool.hot && (
            <div className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-50 text-[10px] font-bold text-rose-600">
              <Zap className="w-3 h-3 mr-0.5 fill-current" />
              热门
            </div>
          )}
        </div>
        <p className={`text-slate-500 leading-relaxed line-clamp-2 ${featured ? 'text-sm' : 'text-xs'}`}>
          {tool.desc}
        </p>
      </div>

      {/* Arrow */}
      <ExternalLink
        className={`shrink-0 text-slate-300 group-hover:text-primary-500 transition-colors ${featured ? 'w-5 h-5' : 'w-4 h-4'}`}
      />
    </div>
  </a>
);

// --- Main Component ---

const AISquare: React.FC = () => {
  return (
    <div className="relative w-full min-h-screen bg-slate-50 selection:bg-blue-500 selection:text-white overflow-hidden pb-32">
      
      {/* Dynamic Background - Beams only, no grid */}
      <div className="absolute inset-0 pointer-events-none">
          {/* Top Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-400/20 rounded-full blur-[120px] mix-blend-multiply opacity-60" />
          
          {/* Animated Beams */}
          <motion.div 
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-20%] left-[-10%] w-[100vh] h-[100vh] bg-gradient-to-r from-transparent via-blue-100/30 to-transparent blur-3xl opacity-50"
          />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 pt-24">
        
        {/* Hero Header */}
        <div className="text-center mb-24 relative">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ duration: 0.8 }}
               className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/20 mb-8 border border-slate-700"
            >
                <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-xs font-bold tracking-widest uppercase">Agent EDU • AI 广场</span>
            </motion.div>
            
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight mb-6">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">Agent</span> 生态探索中心
            </h1>
            
            <p className="text-xl text-slate-500 max-w-2xl mx-auto font-light leading-relaxed">
                连接全球最强大的<span className="font-semibold text-slate-800">大语言模型</span>和<span className="font-semibold text-slate-800">智能体平台</span>，<br/>助力你的 AI 学习与创作之旅
            </p>

            {/* Search Bar (Floating Glass) */}
            <motion.div 
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               transition={{ delay: 0.3 }}
               className="max-w-2xl mx-auto mt-12 relative group"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative flex items-center bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl hover:shadow-2xl transition-all h-14 px-6">
                    <Search className="w-5 h-5 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="搜索 AI 工具、模型或平台..."
                        className="flex-1 bg-transparent border-none outline-none px-4 text-slate-800 placeholder-slate-400 font-medium h-full"
                    />
                    <div className="flex items-center gap-1 text-slate-400 text-xs font-mono bg-slate-100 px-2 py-1 rounded-lg">
                        <Command className="w-3 h-3" /> K
                    </div>
                </div>
            </motion.div>
        </div>

        {/* The Grid Layout */}
        <div className="space-y-16">
            
            {/* SECTION: Agent Platforms (Featured) */}
            <section>
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center text-violet-600 shadow-inner">
                        <Network className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">智能体平台</h2>
                        <p className="text-xs text-slate-400">Agent Orchestration</p>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent ml-4"></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {categories.find(c => c.id === 'agents')?.tools.map((tool) => (
                        <TiltCard key={tool.id}>
                            <ToolCard tool={tool} featured={true} />
                        </TiltCard>
                    ))}
                </div>
            </section>

            {/* SECTION: The Rest of the Tools (Masonry/Bento) */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {categories.filter(c => c.id !== 'agents').map((category) => (
                    <div key={category.id} className="flex flex-col gap-6">
                         {/* Category Header */}
                        <div className="flex items-center gap-3">
                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br ${category.gradient} shadow-md`}>
                                 <category.icon className="w-4 h-4" />
                             </div>
                             <div>
                                 <h3 className="font-bold text-slate-800">{category.title}</h3>
                                 <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{category.subtitle}</p>
                             </div>
                        </div>

                        {/* Tools Stack */}
                        <div className="space-y-3">
                            {category.tools.map((tool) => (
                                <TiltCard key={tool.id} onClick={() => window.open(tool.url, '_blank')}>
                                    <ToolCard tool={tool} />
                                </TiltCard>
                            ))}
                        </div>
                    </div>
                ))}
            </section>

        </div>
      </div>
      
      {/* Footer Decoration */}
      <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-white to-transparent pointer-events-none" />
    </div>
  );
};

export default AISquare;
