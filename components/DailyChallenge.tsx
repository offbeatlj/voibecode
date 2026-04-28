import React, { useMemo } from 'react';
import { DAILY_CHALLENGES } from '../constants';

export const DailyChallenge: React.FC = () => {
  const challenge = useMemo(() => {
    const date = new Date();
    // Use day of week (0-6) to pick challenge
    const dayIndex = date.getDay(); 
    // Sunday is 0. We map Monday (1) to index 0 of array.
    // Mon(1) -> 0, Tue(2) -> 1 ... Sun(0) -> 6
    const adjustedIndex = (dayIndex + 6) % 7; 
    
    const selected = DAILY_CHALLENGES[adjustedIndex];
    // Fallback if something goes wrong
    return selected || DAILY_CHALLENGES[0];
  }, []);

  return (
    <div className="bg-[#0a0e17] border border-cyan-500/40 rounded-lg mb-2 relative overflow-hidden group shadow-[0_0_10px_rgba(6,182,212,0.1)]">
      <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
      
      {/* Header */}
      <div className="bg-cyan-950/30 p-2 flex justify-between items-center border-b border-cyan-500/10">
         <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></span>
            Daily Mission
         </span>
         <span className="text-[10px] text-slate-500 font-mono">{new Date().toLocaleDateString(undefined, { weekday: 'long' })}</span>
      </div>
      
      {/* Content */}
      <div className="p-3">
        <h3 className="text-sm font-bold text-white mb-1 group-hover:text-cyan-200 transition-colors">{challenge.title}</h3>
        <p className="text-xs text-slate-400 font-mono leading-tight">
            {challenge.description}
        </p>
      </div>
    </div>
  );
};