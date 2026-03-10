import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate, useAnimationFrame } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Code2, MessageSquareText, Cpu } from 'lucide-react';

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
        className="flex min-w-[190px] items-center gap-3 rounded-2xl border border-white/50 bg-white/60 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-xl"
      >
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-sm", 
          color === "blue" ? "bg-primary-50 text-primary-600" : 
          color === "purple" ? "bg-violet-50 text-violet-600" : 
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

const GridPattern = ({ offsetX, offsetY }: { offsetX: any; offsetY: any }) => {
  return (
    <svg className="h-full w-full">
      <defs>
        <motion.pattern
          id="hero-grid-pattern"
          width="40"
          height="40"
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" className="text-slate-400" />
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hero-grid-pattern)" />
    </svg>
  );
};

const Hero: React.FC = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHoveringHero, setIsHoveringHero] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { damping: 30, stiffness: 100 });
  const springY = useSpring(mouseY, { damping: 30, stiffness: 100 });
  const rotateX = useTransform(springY, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-8, 8]);

  const revealX = useMotionValue(0);
  const revealY = useMotionValue(0);
  const gridOffsetX = useMotionValue(0);
  const gridOffsetY = useMotionValue(0);
  const maskImage = useMotionTemplate`radial-gradient(320px circle at ${revealX}px ${revealY}px, black, transparent)`;

  useAnimationFrame(() => {
    gridOffsetX.set((gridOffsetX.get() + 0.5) % 40);
    gridOffsetY.set((gridOffsetY.get() + 0.5) % 40);
  });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const { width, height, left, top } = containerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - left;
    const offsetY = e.clientY - top;

    revealX.set(offsetX);
    revealY.set(offsetY);

    mouseX.set((e.clientX - left) / width - 0.5);
    mouseY.set((e.clientY - top) / height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section 
      className="relative flex min-h-[90vh] w-full items-center justify-center overflow-hidden bg-[#f7f9fc] pt-16 md:pt-20"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHoveringHero(true)}
      onMouseLeave={handleMouseLeave}
      ref={containerRef}
      style={{ perspective: '1000px' }}
    >
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.07]">
          <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} />
        </div>
        <motion.div
          className="absolute inset-0 opacity-40"
          style={{
            maskImage,
            WebkitMaskImage: maskImage,
          }}
          animate={{ opacity: isHoveringHero ? 0.38 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <GridPattern offsetX={gridOffsetX} offsetY={gridOffsetY} />
        </motion.div>
        <motion.div
          className="absolute -right-[10%] -top-[18%] h-[36%] w-[36%] rounded-full bg-orange-500/25 blur-[120px]"
          animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.32, 0.2] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -left-[12%] -bottom-[22%] h-[42%] w-[42%] rounded-full bg-blue-500/25 blur-[120px]"
          animate={{ scale: [1, 1.06, 1], opacity: [0.18, 0.3, 0.18] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative z-10 mx-auto mt-8 flex max-w-7xl flex-col items-center justify-center px-6 text-center md:mt-10"
      >
        <FloatingCard icon={Code2} title="自动编码" subtitle="模块实时生成" color="blue" xOffset={-350} yOffset={-180} delay={0.2} mouseX={springX} mouseY={springY} />
        <FloatingCard icon={Cpu} title="神经推理" subtitle="上下文智能分析" color="purple" xOffset={380} yOffset={-120} delay={0.4} mouseX={springX} mouseY={springY} />
        <FloatingCard icon={MessageSquareText} title="自然语言交互" subtitle="人机协同决策" color="green" xOffset={-320} yOffset={150} delay={0.6} mouseX={springX} mouseY={springY} />

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
          深度集成 <span className="font-semibold text-slate-800">阿里通义 / 智谱 GLM</span> 等主流 AI 生态，构建从基础到多智能体系统的全栈实训解决方案。
        </motion.p>

        <div className="flex flex-col sm:flex-row gap-6 items-center" style={{ transform: "translateZ(50px)" }}>
          <MagneticButton className="rounded-2xl" onClick={() => navigate('/study')}>
            <div className="relative overflow-hidden rounded-2xl bg-slate-900 text-white shadow-xl shadow-primary/20 transition-transform active:scale-95">
              <div className="relative px-10 py-5 flex items-center gap-3 bg-slate-900 rounded-2xl z-10 hover:bg-slate-800 transition-colors">
                <span className="font-semibold text-lg tracking-wide">开始探索</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </MagneticButton>
        </div>
      </motion.div>
      
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none z-20" />
    </section>
  );
};

export default Hero;
