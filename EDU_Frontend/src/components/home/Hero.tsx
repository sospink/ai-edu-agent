import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, Code2, MessageSquareText, Cpu, Terminal } from 'lucide-react';

const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ');
};

const ScrambleText = ({ text, className, delay = 0 }: { text: string, className?: string, delay?: number }) => {
  const [display, setDisplay] = useState(text.split('').map(() => '!').join(''));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*';
  const finished = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      let iterations = 0;
      const interval = setInterval(() => {
        if (finished.current) return;
        const next = text.split('').map((char, index) => {
          if (index < iterations) return text[index];
          return chars[Math.floor(Math.random() * chars.length)];
        }).join('');
        setDisplay(next);
        if (iterations >= text.length) {
          clearInterval(interval);
          finished.current = true;
          setDisplay(text);
        }
        iterations += 1/2;
      }, 50);
      return () => clearInterval(interval);
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [text, delay]);

  return <span className={className}>{display}</span>;
};

const Typewriter = ({ text, delay = 0 }: { text: string, delay?: number }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => {
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex <= text.length) {
          setDisplayedText(text.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(interval);
        }
      }, 50);
      return () => clearInterval(interval);
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [text, delay]);

  return (
    <span>
      {displayedText}
      <motion.span 
        animate={{ opacity: [0, 1, 0] }} 
        transition={{ duration: 0.8, repeat: Infinity }}
        className="inline-block w-[2px] h-[1em] bg-primary-500 ml-1 align-middle"
      />
    </span>
  );
};

const MagneticButton = ({ children, className, onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springConfig = { damping: 15, stiffness: 150, mass: 0.1 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    x.set((e.clientX - centerX) * 0.3);
    y.set((e.clientY - centerY) * 0.3);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY }}
      onClick={onClick}
      className={cn("relative group", className)}
    >
      {children}
    </motion.button>
  );
};

const FloatingCard = ({ icon: Icon, title, subtitle, color = "blue", xOffset = 0, yOffset = 0, delay = 0, mouseX, mouseY }: any) => {
  const x = useTransform(mouseX, [-0.5, 0.5], [20, -20]);
  const y = useTransform(mouseY, [-0.5, 0.5], [20, -20]);
  
  return (
    <motion.div
      style={{ x, y, left: `calc(50% + ${xOffset}px)`, top: `calc(50% + ${yOffset}px)` }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5 }}
      className="absolute z-20 hidden lg:block pointer-events-none"
    >
      <motion.div
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 4 + Math.random() * 2, repeat: Infinity, ease: "easeInOut", delay: Math.random() * 2 }}
        className="flex items-center gap-3 p-4 rounded-2xl backdrop-blur-xl border shadow-[0_8px_30px_rgb(0,0,0,0.06)] bg-white/60 border-white/50"
      >
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm", 
          color === "blue" ? "bg-primary-50 text-primary-600" : 
          color === "purple" ? "bg-secondary-50 text-secondary-600" : 
          "bg-success-50 text-success-600"
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-700">{title}</span>
          <span className="text-[10px] text-slate-500 font-mono bg-slate-100/50 px-1 py-0.5 rounded mt-0.5">{subtitle}</span>
        </div>
      </motion.div>
    </motion.div>
  );
};

const Hero: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { damping: 30, stiffness: 100 });
  const springY = useSpring(mouseY, { damping: 30, stiffness: 100 });
  const rotateX = useTransform(springY, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-8, 8]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const { width, height, left, top } = containerRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - left) / width - 0.5);
    mouseY.set((e.clientY - top) / height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section 
      className="relative w-full min-h-[90vh] flex items-center justify-center overflow-hidden bg-slate-50"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      ref={containerRef}
      style={{ perspective: '1000px' }}
    >
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div 
          className="absolute inset-0 opacity-[0.3]"
          style={{
            backgroundImage: `linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)`,
            backgroundSize: '4rem 4rem',
            maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 80%)'
          }}
        />
        <motion.div 
          className="absolute h-[1px] bg-gradient-to-r from-transparent via-primary-400 to-transparent w-[40%] top-[30%]"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 7, repeat: Infinity, ease: "linear", delay: 1 }}
        />
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-primary-200/40 via-purple-200/40 to-cyan-100/40 rounded-full blur-[100px] mix-blend-multiply"
        />
      </div>

      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative z-10 max-w-7xl mx-auto px-6 flex flex-col items-center justify-center text-center"
      >
        <FloatingCard icon={Code2} title="Auto-Coding" subtitle="Generating modules..." color="blue" xOffset={-350} yOffset={-180} delay={0.2} mouseX={springX} mouseY={springY} />
        <FloatingCard icon={Cpu} title="Neural Processing" subtitle="Analyzing context..." color="purple" xOffset={380} yOffset={-120} delay={0.4} mouseX={springX} mouseY={springY} />
        <FloatingCard icon={MessageSquareText} title="Natural Language" subtitle="Human-in-the-loop" color="green" xOffset={-320} yOffset={150} delay={0.6} mouseX={springX} mouseY={springY} />

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="mb-8 relative inline-flex items-center gap-2 px-6 py-2 rounded-full bg-white/50 border border-white/60 backdrop-blur-md shadow-sm"
          style={{ transform: "translateZ(20px)" }}
        >
          <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
          <span className="text-xs font-mono font-medium text-slate-600 tracking-wider">SYSTEM ONLINE: V2.0.4</span>
        </motion.div>

        <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tight mb-6 text-slate-900 leading-[0.9]" style={{ transform: "translateZ(60px)" }}>
          Agent <br className="hidden md:block" /> 
          <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary-600 via-secondary-500 to-primary-600 animate-text-shimmer bg-[length:200%_auto]">
            <ScrambleText text="EDU" delay={0.5} />
          </span> Lab
        </h1>

        <div className="h-8 md:h-12 mb-10" style={{ transform: "translateZ(40px)" }}>
          <h2 className="text-xl md:text-3xl font-light text-slate-500">
            <Typewriter text="探索智能体技术应用新方向" delay={1.5} />
          </h2>
        </div>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 0.8 }}
          className="text-lg md:text-xl text-slate-500 max-w-2xl mb-12 leading-relaxed font-light"
          style={{ transform: "translateZ(30px)" }}
        >
          深度集成 <span className="font-semibold text-slate-800">阿里通义 / 字节豆包</span> 等主流AI生态，构建从基础到 Multi-Agent 系统的全栈实训解决方案。
        </motion.p>

        <div className="flex flex-col sm:flex-row gap-6 items-center" style={{ transform: "translateZ(50px)" }}>
          <MagneticButton className="rounded-2xl">
            <div className="relative overflow-hidden rounded-2xl bg-slate-900 text-white shadow-xl shadow-primary/20 transition-transform active:scale-95">
              <div className="relative px-10 py-5 flex items-center gap-3 bg-slate-900 rounded-2xl z-10 hover:bg-slate-800 transition-colors">
                <span className="font-semibold text-lg tracking-wide">开始探索</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </MagneticButton>

          <MagneticButton className="rounded-2xl">
            <div className="px-10 py-5 rounded-2xl bg-white/60 backdrop-blur-sm border border-white/60 text-slate-700 font-medium shadow-sm hover:bg-white hover:shadow-lg transition-all flex items-center gap-2">
              <Terminal className="w-5 h-5 text-slate-400" />
              <span>预约演示</span>
            </div>
          </MagneticButton>
        </div>
      </motion.div>
      
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none z-20" />
    </section>
  );
};

export default Hero;
