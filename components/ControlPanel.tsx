
import React from 'react';
import { PlayState, VisualizerSettings, DailyPuzzle as PuzzleType } from '../types';

interface ControlPanelProps {
  playState: PlayState;
  bpm: number;
  onPlayPause: () => void;
  onStop: () => void;
  isRecording: boolean;
  onToggleRecord: () => void;
  onQuickClip: () => void;
  recordingProgress: number; // 0 to 100
  onShare: () => void;
  onOpenMerch: () => void;
  visSettings: VisualizerSettings;
  onUpdateVisSettings: (s: Partial<VisualizerSettings>) => void;
  onInsertCode: (code: string) => void;
  accentColor: string;
  onOpenPuzzle: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  playState,
  bpm,
  onPlayPause,
  onStop,
  isRecording,
  onToggleRecord,
  onQuickClip,
  recordingProgress,
  onShare,
  onOpenMerch,
  visSettings,
  onUpdateVisSettings,
  onInsertCode,
  accentColor,
  onOpenPuzzle
}) => {

  const colors = [
      { name: 'Cyan', hue: 180, class: 'bg-cyan-500' },
      { name: 'Pink', hue: 300, class: 'bg-pink-500' },
      { name: 'Lime', hue: 120, class: 'bg-lime-500' },
      { name: 'Purp', hue: 270, class: 'bg-purple-600' },
      { name: 'Orange', hue: 30, class: 'bg-orange-500' },
  ];

  return (
    <div className="flex flex-col gap-4 bg-[#0f172a]/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm min-h-min w-full">
      
      {/* Desktop Puzzle Button */}
      <button 
        onClick={onOpenPuzzle}
        className="hidden md:flex w-full bg-slate-800/50 hover:bg-cyan-900/20 border border-cyan-500/20 rounded-lg p-3 items-center justify-between group transition-all"
      >
         <div className="flex items-center gap-2">
             <span className="text-lg group-hover:scale-110 transition-transform">🧩</span>
             <div className="flex flex-col items-start">
                 <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">Daily Puzzle</span>
             </div>
         </div>
         <span className="text-[10px] text-slate-400 group-hover:text-white">PLAY &gt;</span>
      </button>
      
      <div className="text-xs font-mono text-slate-400 tracking-widest mb-2 mt-2">CONTROLS</div>
      
      {/* Playback */}
      <div className="grid grid-cols-3 gap-2 w-full">
        <button
            onClick={onPlayPause}
            style={{ backgroundColor: playState === PlayState.PLAYING ? accentColor : undefined }}
            className={`col-span-2 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${playState === PlayState.PLAYING ? 'text-white shadow-lg brightness-110' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
        >
            {playState === PlayState.PLAYING ? 'PAUSE' : 'RUN_CODE'}
        </button>
        <button
            onClick={onStop}
            className="py-3 bg-slate-800 rounded-lg text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors"
        >
            ■
        </button>
      </div>

      {/* BPM Display */}
      <div className="flex items-center justify-between bg-black/30 p-3 rounded border border-white/5 w-full">
        <span className="text-xs font-mono text-slate-400">CPU_BPM</span>
        <span className="text-xl font-mono font-bold" style={{ color: accentColor }}>{bpm}</span>
      </div>

      <div className="h-px bg-white/10 my-2"></div>

      {/* Recording Controls */}
      <div className="space-y-2 w-full">
         <div className="grid grid-cols-2 gap-2">
            <button onClick={onToggleRecord} className={`py-2 px-2 rounded border text-xs font-mono flex items-center justify-center gap-2 ${isRecording && recordingProgress === 0 ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-slate-700 hover:border-slate-500 text-slate-400'}`}>
                <div className={`w-2 h-2 rounded-full ${isRecording && recordingProgress === 0 ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`}></div>
                <span>REC</span>
            </button>
            
            <button onClick={onQuickClip} disabled={isRecording} className={`py-2 px-2 rounded border text-xs font-mono flex items-center justify-center gap-2 relative overflow-hidden ${recordingProgress > 0 ? 'border-white text-white' : 'border-slate-700 hover:border-white text-slate-400 hover:text-white'} disabled:opacity-50`}>
                {recordingProgress > 0 && (
                    <div 
                        className="absolute inset-0 transition-all duration-1000 ease-linear opacity-50" 
                        style={{ width: `${recordingProgress}%`, backgroundColor: accentColor }}
                    ></div>
                )}
                <span className="relative z-10">{recordingProgress > 0 ? `${Math.ceil(15 * (1 - recordingProgress/100))}s` : 'SNAP_15s'}</span>
            </button>
         </div>

         <button onClick={onShare} className="w-full py-2 px-4 rounded border border-slate-700 hover:border-emerald-500 hover:text-emerald-400 text-slate-400 text-xs font-mono flex items-center justify-between bg-transparent transition-colors">
            <span>SHARE_URL</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.287.696.345 1.084m0-1.084a9.188 9.188 0 018.319-4.1m0 0c1.797 0 3.504.78 4.718 2.335m-4.718-2.335A9.172 9.172 0 0012.055 2.923c-2.978 0-5.7 1.208-7.773 3.386" />
            </svg>
         </button>
      </div>

      <div className="h-px bg-white/10 my-2"></div>

      {/* Visualizer Config */}
      <div className="space-y-3 bg-slate-900/30 p-3 rounded border border-white/5 w-full">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Visualizer Config</div>
          
          {/* Color Picker */}
          <div className="flex justify-between items-center">
              {colors.map(c => (
                  <button
                    key={c.name}
                    onClick={() => onUpdateVisSettings({ hue: c.hue })}
                    className={`w-5 h-5 rounded-full ${c.class} ${visSettings.hue === c.hue ? 'ring-2 ring-white scale-110' : 'opacity-50 hover:opacity-100'} transition-all`}
                    title={c.name}
                  />
              ))}
          </div>

          {/* Shape Selector */}
          <div className="flex bg-black/50 rounded p-1">
              {(['polygon', 'orb', 'wave'] as const).map(shape => (
                  <button
                    key={shape}
                    onClick={() => onUpdateVisSettings({ shape })}
                    className={`flex-1 text-[10px] py-1 rounded font-mono uppercase transition-colors ${visSettings.shape === shape ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {shape}
                  </button>
              ))}
          </div>
      </div>

      {/* Merch Button */}
      <div className="mt-4 w-full">
         <button onClick={onOpenMerch} className="w-full group relative overflow-hidden rounded-lg bg-gradient-to-r from-indigo-900 to-purple-900 p-4 text-left transition-transform hover:scale-[1.02]">
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="text-[10px] font-mono text-pink-300 mb-1">UNLOCK_ASSETS</div>
            <div className="font-bold text-white">VoibeStore</div>
         </button>
      </div>

    </div>
  );
};
