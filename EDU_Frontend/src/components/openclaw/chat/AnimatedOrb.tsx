import React from 'react';

export const AnimatedOrb: React.FC<{
  className?: string;
  variant?: 'default' | 'red';
  size?: number;
}> = ({ className, variant = 'default', size = 32 }) => {
  const colors =
    variant === 'red'
      ? { bg: '#fef2f2', c1: '#ef4444', c2: '#f87171', c3: '#dc2626', c4: '#fca5a5', c5: '#fb7185' }
      : { bg: '#cff1f4', c1: '#9e9fef', c2: '#c471ec', c3: '#9bc761', c4: '#ccd4f2', c5: '#f472b6' };

  const blur = Math.max(6, size * 0.15);
  const s = (r: number) => size * r;

  return (
    <div
      className={`relative rounded-full overflow-hidden ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        backgroundColor: colors.bg,
        animation: 'orb-hue-rotate 8s linear infinite',
        boxShadow: 'rgba(17,12,46,0.15) 0 48px 100px 0',
      }}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ '--orb-blur': `${blur}px`, animation: 'orb-hue-rotate-blur 6s linear infinite reverse' } as React.CSSProperties}
      >
        {[
          { cls: 'orb-circle-1', sz: s(0.45), color: colors.c1, op: 0.9 },
          { cls: 'orb-circle-2', sz: s(0.35), color: colors.c2, op: 0.85 },
          { cls: 'orb-circle-3', sz: s(0.50), color: colors.c3, op: 0.9 },
          { cls: 'orb-circle-4', sz: s(0.25), color: colors.c4, op: 0.8 },
          { cls: 'orb-circle-5', sz: s(0.30), color: colors.c5, op: 0.85 },
        ].map((c) => (
          <div
            key={c.cls}
            className={`${c.cls} absolute rounded-full`}
            style={{ width: c.sz, height: c.sz, opacity: c.op, backgroundColor: c.color }}
          />
        ))}
      </div>
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.4) 0%, transparent 100%)' }}
      />
    </div>
  );
};
