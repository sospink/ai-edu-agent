import React from 'react';

export const Background: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30" />
      
      {/* Animated blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-[100px] animate-blob" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-100/30 rounded-full blur-[100px] animate-blob animation-delay-2000" />
      <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] bg-cyan-100/20 rounded-full blur-[80px] animate-blob animation-delay-4000" />
      
      {/* Grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
};

export default Background;
