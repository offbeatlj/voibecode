
import React, { useState } from 'react';

interface HeaderProps {
    accentColor: string;
    onLogoClick: () => void;
    onLoadDemo: () => void;
}

export const Header: React.FC<HeaderProps> = ({ accentColor, onLogoClick, onLoadDemo }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleDemoClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onLoadDemo();
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <header className="w-full py-2 px-4 md:py-4 md:px-8 flex justify-between items-center border-b border-white/10 bg-black/40 backdrop-blur-md shrink-0 z-50 pointer-events-auto relative">
      <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto" onClick={onLogoClick}>
        <div 
            className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center shadow-lg transition-colors duration-500 relative overflow-hidden bg-black"
            style={{ boxShadow: `0 0 20px ${accentColor}40` }}
        >
           {/* Logo Icon: Drum + Brackets */}
           <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 md:w-8 md:h-8">
              <circle cx="12" cy="12" r="9" stroke={accentColor} strokeWidth="2" />
              <path d="M12 6V18" stroke={accentColor} strokeWidth="1" strokeDasharray="2 2" opacity="0.5"/>
              {/* Brackets */}
              <path d="M9 10C8 10 7 11 7 12C7 13 8 14 9 14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <path d="M15 10C16 10 17 11 17 12C17 13 16 14 15 14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
           </svg>
        </div>
        <h1 className="text-lg md:text-2xl font-bold tracking-tight font-mono flex flex-col md:flex-row md:items-baseline md:gap-2">
          <div className="flex">
             <span className="text-white">Voibe</span>
             <span style={{ color: accentColor }} className="transition-colors duration-500">Code</span>
          </div>
          <span className="text-[10px] text-slate-500 font-normal hidden md:inline-block">Coding Music</span>
        </h1>
      </div>
      
      <div className="flex items-center gap-4 pointer-events-auto relative z-50">
        <button 
            type="button"
            onClick={handleDemoClick}
            className={`text-[10px] md:text-xs px-3 py-1.5 rounded-full transition-all font-mono border flex items-center gap-1 group cursor-pointer relative z-50 select-none ${
                isCopied 
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' 
                : 'bg-white/10 hover:bg-white/20 border-white/10 text-white'
            }`}
        >
          <span className={`w-2 h-2 rounded-full pointer-events-none ${isCopied ? 'bg-emerald-400' : 'bg-purple-500 animate-pulse group-hover:bg-purple-400'}`}></span>
          {isCopied ? 'COPIED!' : 'DEMO_MODE'}
        </button>
      </div>
    </header>
  );
};
