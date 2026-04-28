import React from 'react';
import { SCALES } from '../constants';

interface CheatSheetProps {
  onInsert: (text: string) => void;
  onClose?: () => void;
}

export const CheatSheet: React.FC<CheatSheetProps> = ({ onInsert, onClose }) => {
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    onInsert(text); 
    if (onClose) onClose();
  };

  const getScaleDesc = (name: string) => {
      if (name.includes('Minor')) return 'Sad / Emotional';
      if (name.includes('Cyber')) return 'Tech / Bright';
      if (name.includes('Dorian')) return 'Epic / Spacey';
      if (name.includes('Hirajoshi')) return 'Dark / Eastern';
      return 'Standard';
  };

  return (
    <div className="flex flex-col bg-[#0f172a]/95 backdrop-blur-xl h-full w-full md:rounded-xl border border-slate-700/50 overflow-hidden relative z-40">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse"></div>
             <span className="text-xs font-mono text-pink-400 tracking-widest uppercase">Reference Manual</span>
          </div>
          {onClose && (
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
              </button>
          )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-8">
        
        {/* 1. Syntax Basics */}
        <section>
           <h3 className="font-bold text-white mb-3 border-b border-white/10 pb-1 text-sm">1. Syntax Basics</h3>
           <div className="space-y-2 font-mono text-xs">
              <div className="bg-white/5 p-2 rounded">
                  <span className="text-slate-500"># Comments</span>
                  <p className="text-[10px] text-slate-400 mt-1">Lines starting with <span className="text-white">#</span> are notes.</p>
              </div>
              <div className="bg-white/5 p-2 rounded">
                  <span className="text-emerald-400">kick</span><span className="text-white">("</span><span className="text-orange-300">x...</span><span className="text-white">")</span>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Use <span className="text-white">""</span> for patterns.<br/>
                    Use <span className="text-white">*</span> for math (e.g. <span className="text-orange-300">"x." * 8</span>).
                  </p>
              </div>
           </div>
        </section>

        {/* 2. Dynamics */}
        <section>
           <h3 className="font-bold text-white mb-3 border-b border-white/10 pb-1 text-sm flex items-center justify-between">
               <span>2. Dynamics & Expression</span>
               <span className="text-[9px] text-cyan-400 font-mono bg-cyan-950 px-2 py-0.5 rounded">NEW</span>
           </h3>
           
           <div className="mb-3 p-2 rounded border border-yellow-500/20 bg-yellow-500/10 text-[10px] text-yellow-200 font-mono">
               <strong>💡 Coding vs Music:</strong><br/>
               Use <span className="text-white font-bold">*</span> for math outside quotes (<span className="text-orange-300">"x" * 4</span>).<br/>
               Use <span className="text-white font-bold">?</span> for ghost notes inside quotes (<span className="text-orange-300">"x..?"</span>).
           </div>

           <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                  <div className="text-pink-400 font-bold text-lg mb-1">!</div>
                  <div className="text-white font-bold">Accent</div>
                  <div className="text-[10px] text-slate-500">Play loud (120%)</div>
              </div>
              <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                  <div className="text-slate-400 font-bold text-lg mb-1">?</div>
                  <div className="text-white font-bold">Ghost Note</div>
                  <div className="text-[10px] text-slate-500">Play soft (50%)</div>
              </div>
              <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                  <div className="text-cyan-400 font-bold text-lg mb-1">~</div>
                  <div className="text-white font-bold">Sustain</div>
                  <div className="text-[10px] text-slate-500">Hold previous note</div>
              </div>
              <div className="bg-slate-900/50 p-2 rounded border border-slate-800 flex flex-col justify-center">
                  <div className="text-[10px] text-slate-400 italic">
                     Example:<br/>
                     <span className="text-orange-300">"x ! . ?"</span>
                  </div>
              </div>
           </div>
        </section>

        {/* 3. Instruments */}
        <section>
          <h3 className="font-bold text-white mb-3 border-b border-white/10 pb-1 text-sm">3. Instruments</h3>
          <div className="grid grid-cols-2 gap-2 mb-2">
             {['kick', 'snare', 'hat', 'bass', 'lead', 'tom', 'clap', 'crash'].map(inst => (
                 <button key={inst} className="text-left p-2 rounded bg-white/5 hover:bg-white/10 text-xs font-mono text-emerald-400 hover:text-white transition-colors" onClick={() => copyToClipboard(`${inst}("x...")`)}>
                     {inst}
                 </button>
             ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
             {['ride', 'perc', 'openhat', 'pluck', 'fx', 'lofi_kick'].map(inst => (
                <button key={inst} className="text-left p-2 rounded bg-white/5 hover:bg-white/10 text-[10px] font-mono text-slate-400 hover:text-cyan-300 transition-colors" onClick={() => copyToClipboard(`${inst}("x...")`)}>
                    {inst}
                </button>
             ))}
          </div>
        </section>

        {/* 4. Scales */}
        <section>
            <h3 className="font-bold text-white mb-3 border-b border-white/10 pb-1 text-sm">4. Scales (Keys)</h3>
            <div className="grid grid-cols-1 gap-2">
            {SCALES.map(scale => (
                <button
                    key={scale.name}
                    onClick={() => copyToClipboard(`scale = "${scale.name}"`)}
                    className="flex flex-col items-start text-[10px] bg-slate-900 hover:bg-pink-500 hover:text-white text-slate-400 p-2 rounded transition-colors border border-slate-700 hover:border-pink-400 group"
                >
                    <div className="flex justify-between w-full">
                         <span className="font-bold text-cyan-300 group-hover:text-white">{scale.name}</span>
                         <span className="italic opacity-75">{getScaleDesc(scale.name)}</span>
                    </div>
                    <div className="mt-1 flex gap-1 flex-wrap">
                        {scale.notes.map((note, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-black/40 rounded text-[9px] font-mono text-slate-300 group-hover:text-white">{note}</span>
                        ))}
                    </div>
                </button>
            ))}
            </div>
        </section>

      </div>
    </div>
  );
};