
import React, { useState, useEffect } from 'react';
import { DailyPuzzle, VisualizerSettings, UserStats } from '../types';
import { Visualizer } from './Visualizer';

interface PuzzleInterfaceProps {
  puzzle: DailyPuzzle;
  isOpen: boolean;
  onClose: () => void;
  onPreview: (puzzle: DailyPuzzle) => void;
  onSubmit: (puzzle: DailyPuzzle, userCode: string) => { success: boolean, feedback: string };
  isPreviewing: boolean;
  accentColor: string;
  bpm: number;
  stats: UserStats;
}

export const PuzzleInterface: React.FC<PuzzleInterfaceProps> = ({ 
  puzzle, 
  isOpen, 
  onClose, 
  onPreview, 
  onSubmit, 
  isPreviewing,
  accentColor,
  bpm,
  stats
}) => {
  const [userCode, setUserCode] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [justShared, setJustShared] = useState(false);

  useEffect(() => {
      if (isOpen) {
        if (stats.lastSolvedDate === puzzle.id) {
            setSolved(true);
            setFeedback("You've already solved today's puzzle!");
            setUserCode(puzzle.targetCode);
        } else {
            setUserCode('');
            setAttempts(0);
            setSolved(false);
            setFeedback(null);
        }
      }
  }, [isOpen, puzzle, stats]);

  const checkSolution = () => {
      if (attempts >= 5 && !solved) return;
      
      const normalizedUser = userCode.trim().replace(/\s+/g, '');
      const normalizedTarget = puzzle.targetCode.replace(/\s+/g, '');

      if (normalizedUser === normalizedTarget) {
          setSolved(true);
          setFeedback("SUCCESS! Sequence Compiled.");
          onSubmit(puzzle, userCode);
      } else {
          const res = onSubmit(puzzle, userCode); 
          if (res.success) {
              setSolved(true);
              setFeedback("SUCCESS! Pattern Matched.");
          } else {
              setAttempts(prev => prev + 1);
              setFeedback(res.feedback || "Sequence Mismatch. Listen and try again.");
          }
      }
  };

  const handleReveal = () => {
      setSolved(true);
      setFeedback("Answer Revealed.");
      setUserCode(puzzle.targetCode);
  };
  
  const handleShare = () => {
      const squares = Array(5).fill('⬜').map((_, i) => i < attempts ? '🟥' : (i === attempts && solved) ? '🟩' : '⬜').join('');
      const text = `VoibeCode Puzzle ${puzzle.id}\n${squares}\nTry it: https://voibecode.com`;
      navigator.clipboard.writeText(text);
      setJustShared(true);
      setTimeout(() => setJustShared(false), 2000);
  };

  if (!isOpen) return null;

  const visSettings: VisualizerSettings = { hue: 180, shape: 'orb' };

  return (
    <div className="fixed inset-0 z-[100] bg-[#050505] flex flex-col font-inter animate-in slide-in-from-bottom-10 duration-300">
       {/* Header */}
       <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur">
           <div>
               <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                   <span>🧩</span> {puzzle.id}
               </h2>
               <div className="flex gap-2 text-xs font-mono text-slate-500">
                   <span>Streak: <span className="text-cyan-400">{stats.currentStreak}</span></span>
                   <span>Max: {stats.maxStreak}</span>
               </div>
           </div>
           <button onClick={onClose} className="text-slate-400 hover:text-white p-2 font-mono text-xs">
               EXIT
           </button>
       </div>

       {/* Game Area */}
       <div className="flex-1 flex flex-col p-4 gap-6 overflow-y-auto">
           
           {/* Visualizer & Instructions */}
           <div className="flex flex-col items-center space-y-4 mt-2">
               {/* Simplified Container to ensure visibility */}
               <div className="w-full max-w-md relative shrink-0">
                   <Visualizer 
                       isPlaying={isPreviewing} 
                       bpm={bpm} 
                       settings={visSettings} 
                       accentColor={accentColor}
                       className="w-full h-48 rounded-xl border border-slate-800 bg-black shadow-inner"
                   />
                   {isPreviewing && (
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                           <span className="text-xs font-mono bg-black/50 px-2 py-1 rounded text-cyan-300 animate-pulse z-10">PLAYING TARGET</span>
                       </div>
                   )}
               </div>
               
               <p className="text-sm text-slate-300 max-w-md mx-auto text-center">{puzzle.description}</p>
               
               <button 
                   onClick={() => onPreview(puzzle)}
                   className={`px-6 py-3 rounded-full font-bold font-mono text-sm transition-all shadow-lg flex items-center gap-2 ${isPreviewing ? 'bg-white text-black scale-105' : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-cyan-500/30'}`}
               >
                   <span>{isPreviewing ? '🔊 LISTENING...' : '🔊 LISTEN TO TARGET'}</span>
               </button>
           </div>

           {/* Available Hints (Text Only) */}
           <div className="space-y-2 max-w-lg mx-auto w-full">
               <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider text-center">Available Commands</p>
               <div className="flex flex-wrap gap-2 justify-center bg-slate-900/50 p-3 rounded border border-slate-800">
                   {puzzle.tokens.map((token, i) => (
                       <span
                           key={i}
                           className="text-cyan-300 font-mono text-sm select-all"
                       >
                           {token}
                       </span>
                   ))}
               </div>
           </div>

           {/* Code Input (Manual Typing) */}
           <div className="w-full max-w-lg mx-auto">
               <input 
                  type="text"
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value)}
                  placeholder="Type solution here..."
                  disabled={solved}
                  autoFocus
                  className="w-full bg-[#0a0e17] border border-slate-600 focus:border-cyan-500 rounded p-4 font-mono text-white text-sm outline-none placeholder:text-slate-700 transition-colors"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
               />
           </div>

           {/* Feedback */}
           {feedback && (
               <div className={`p-3 rounded text-center font-mono text-xs border max-w-lg mx-auto w-full ${solved ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' : 'bg-red-900/20 border-red-500/50 text-red-400'}`}>
                   {feedback}
               </div>
           )}
           
           {attempts >= 5 && !solved && (
               <button 
                  onClick={handleReveal}
                  className="text-xs text-pink-500 underline decoration-dashed font-mono hover:text-pink-400 text-center"
               >
                   Give Up? Reveal Answer
               </button>
           )}

           {solved && (
               <button 
                  onClick={handleShare}
                  className="w-full max-w-xs mx-auto py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all"
               >
                   {justShared ? 'COPIED TO CLIPBOARD!' : 'SHARE RESULTS 📋'}
               </button>
           )}
       </div>

       {/* Footer */}
       <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex gap-3 pb-safe">
           <button 
             onClick={() => {
                 setUserCode('');
                 setFeedback(null);
             }}
             disabled={solved}
             className="flex-1 py-3 bg-slate-800 rounded text-slate-400 font-mono text-xs font-bold hover:bg-slate-700 transition-colors disabled:opacity-50"
           >
               CLEAR
           </button>
           <button 
             onClick={checkSolution}
             disabled={solved || attempts >= 5 || !userCode.trim()}
             className={`flex-[2] py-3 rounded text-white font-mono text-sm font-bold shadow-lg transition-all ${solved ? 'bg-emerald-600 cursor-default' : 'bg-pink-600 hover:bg-pink-500 shadow-pink-500/20 disabled:opacity-50 disabled:cursor-not-allowed'}`}
           >
               {solved ? 'COMPLETED' : attempts >= 5 ? 'FAILED' : 'COMPILE & CHECK'}
           </button>
       </div>
    </div>
  );
};
