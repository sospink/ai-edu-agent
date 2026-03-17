import React, { useEffect, useState, useRef } from 'react';

export const AnalysisWordSpan: React.FC<{ word: string }> = ({ word }) => {
  const [blur, setBlur] = useState(16);
  const [opacity, setOpacity] = useState(0);
  const [done, setDone] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min((now - start) / 600, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setBlur(16 * (1 - ease));
      setOpacity(ease);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setDone(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span
      className="inline text-slate-900"
      style={{ filter: done ? 'none' : `blur(${blur}px)`, opacity: done ? 1 : opacity }}
    >
      {word}
    </span>
  );
};
