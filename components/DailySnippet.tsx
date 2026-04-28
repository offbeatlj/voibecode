import React, { useMemo } from 'react';
import { DAILY_SNIPPETS } from '../constants';

interface DailySnippetProps {
  onInsert: (code: string) => void;
}

export const DailySnippet: React.FC<DailySnippetProps> = ({ onInsert }) => {
  const snippet = useMemo(() => {
    const date = new Date();
    const dayIndex = date.getDate() % DAILY_SNIPPETS.length;
    return DAILY_SNIPPETS[dayIndex] || DAILY_SNIPPETS[0];
  }, []);

  return (
    <div className="bg-[#0a0e17] border border-cyan-500/30 rounded-lg mb-4 relative overflow-hidden shadow-[0_0_10px_rgba(6,182,212,0.1)]">
      <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
      
      <div className="bg-cyan-950/30 p-2 flex justify-between items-center border-b border-cyan-500/10">
         <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></span>
            Daily Code Drop
         </span>
      </div>
      
      <div className="p-3">
        <div className="flex justify-between items-center mb-2">
           <h3 className="text-sm font-bold text-white group-hover:text-cyan-200 transition-colors">{snippet.title}</h3>
           <button 
              onClick={() => onInsert(snippet.code)}
              className="text-[9px] bg-cyan-900/50 text-cyan-300 px-3 py-1.5 rounded hover:bg-cyan-500 hover:text-black font-mono transition-colors border border-cyan-500/30 font-bold"
            >
              INSERT
           </button>
        </div>
        <p className="text-xs text-slate-400 font-mono mb-2 italic leading-tight">"{snippet.desc}"</p>
        <pre className="bg-black/50 p-2 rounded text-[10px] text-slate-300 font-mono overflow-x-auto border border-slate-800">
            {snippet.code}
        </pre>
      </div>
    </div>
  );
};