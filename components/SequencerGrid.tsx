import React from 'react';
import { Track } from '../types';

interface SequencerGridProps {
  tracks: Track[];
  currentStep: number;
  toggleStep: (trackId: string, stepIndex: number) => void;
  updateVolume: (trackId: string, vol: number) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
}

export const SequencerGrid: React.FC<SequencerGridProps> = ({ 
  tracks, 
  currentStep, 
  toggleStep,
  updateVolume,
  toggleMute,
  toggleSolo
}) => {
  return (
    <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
      <div className="min-w-[800px] flex flex-col gap-2 p-4 rounded-xl bg-[#0a0e17] border border-slate-800/50 shadow-2xl shadow-black">
        {tracks.map((track) => (
          <div key={track.id} className={`flex items-center gap-4 p-2 rounded transition-colors ${track.muted ? 'opacity-50 grayscale' : ''} ${track.soloed ? 'bg-indigo-900/20 border border-indigo-500/30' : ''}`}>
            
            {/* Track Controls */}
            <div className="w-48 shrink-0 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-wider truncate">
                    {track.name}
                  </span>
                  <div className="flex gap-1">
                    <button 
                        onClick={() => toggleMute(track.id)}
                        className={`w-6 h-6 text-[10px] font-bold rounded flex items-center justify-center border transition-colors ${track.muted ? 'bg-red-500 border-red-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                        title="Mute"
                    >
                        M
                    </button>
                    <button 
                        onClick={() => toggleSolo(track.id)}
                        className={`w-6 h-6 text-[10px] font-bold rounded flex items-center justify-center border transition-colors ${track.soloed ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                        title="Solo"
                    >
                        S
                    </button>
                  </div>
              </div>
              
              {/* Volume Slider */}
              <div className="flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-slate-500">
                    <path d="M10 3.75a2 2 0 10-4 0 2 2 0 004 0zM17.25 4.5a.75.75 0 00-1.5 0h-2.5a.75.75 0 000 1.5h2.5a.75.75 0 001.5 0zm-10.5 4.5a2 2 0 10-4 0 2 2 0 004 0zM17.25 10.5a.75.75 0 00-1.5 0h-7.5a.75.75 0 000 1.5h7.5a.75.75 0 001.5 0zm-6.5 4.5a2 2 0 10-4 0 2 2 0 004 0zM17.25 16.5a.75.75 0 00-1.5 0h-11.5a.75.75 0 000 1.5h11.5a.75.75 0 001.5 0z" />
                 </svg>
                 <input 
                    type="range" 
                    min="0" max="1" step="0.05"
                    value={track.volume}
                    onChange={(e) => updateVolume(track.id, Number(e.target.value))}
                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-400 hover:accent-cyan-400"
                 />
              </div>
            </div>

            {/* Steps Grid */}
            <div className="flex-1 grid grid-cols-16 gap-1">
              {track.steps.map((isActive, index) => {
                const isCurrent = currentStep === index;
                
                let bgClass = "bg-slate-900";
                let borderClass = "border-slate-800";
                let shadowClass = "";

                if (isActive) {
                  bgClass = track.color;
                  borderClass = "border-transparent";
                  shadowClass = isCurrent 
                    ? "brightness-150 shadow-[0_0_15px_currentColor]" 
                    : "shadow-[0_0_5px_currentColor] opacity-80";
                } else if (isCurrent) {
                  bgClass = "bg-white/10";
                }

                const isBeatMarker = index % 4 === 0;

                return (
                  <button
                    key={`${track.id}-${index}`}
                    onClick={() => toggleStep(track.id, index)}
                    className={`
                      aspect-[3/4] sm:aspect-square rounded-sm transition-all duration-75
                      border ${borderClass} ${bgClass} ${shadowClass}
                      hover:brightness-110 hover:scale-105
                      relative
                      ${isBeatMarker ? 'ml-1' : ''}
                    `}
                  >
                   {isActive && (
                     <div className="absolute inset-0 flex items-center justify-center opacity-50 text-[8px] font-mono text-black font-bold">
                       {`;`}
                     </div>
                   )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
