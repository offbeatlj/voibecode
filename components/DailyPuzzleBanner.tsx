
import React from 'react';

interface DailyPuzzleBannerProps {
  onOpen: () => void;
}

export const DailyPuzzleBanner: React.FC<DailyPuzzleBannerProps> = ({ onOpen }) => {
  return (
    <button 
      onClick={onOpen}
      className="md:hidden w-full bg-gradient-to-r from-cyan-900 to-slate-900 border-b border-cyan-500/30 p-2 flex justify-between items-center sticky top-0 z-[60]"
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">🧩</span>
        <div className="flex flex-col items-start">
            <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider">Daily Puzzle</span>
            <span className="text-[9px] text-slate-400">Earn your rhythm badge</span>
        </div>
      </div>
      <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded border border-cyan-500/30">
          PLAY
      </span>
    </button>
  );
};
