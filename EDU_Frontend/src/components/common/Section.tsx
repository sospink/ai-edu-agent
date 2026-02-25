import React from 'react';

interface SectionProps {
  id?: string;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}

const Section: React.FC<SectionProps> = ({ id, title, subtitle, children, className = '', dark = false }) => {
  return (
    <section 
      id={id} 
      className={`py-20 md:py-32 px-6 md:px-12 w-full relative z-10 ${className}`}
    >
      <div className="max-w-7xl mx-auto">
        {(title || subtitle) && (
          <div className="mb-16 text-center max-w-3xl mx-auto">
            {title && (
              <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight text-slate-900">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-default-500 text-lg md:text-xl leading-relaxed font-light">
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </section>
  );
};

export default Section;
