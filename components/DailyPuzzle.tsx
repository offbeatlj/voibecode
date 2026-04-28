import React, { useMemo, useState } from 'react';
import { getDailyPuzzle } from '../constants';
import { DailyPuzzle as PuzzleType } from '../types';

interface DailyPuzzleProps {
  onInsert: (code: string) => void;
  onPreview: (puzzle: PuzzleType) => void;
  onSubmit: (puzzle: PuzzleType) => { success: boolean, feedback: string };
  isPreviewing: boolean;
}

export const DailyPuzzle: React.FC<DailyPuzzleProps> = ({ onInsert, onPreview, onSubmit, isPreviewing }) => {
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [gameActive, setGameActive] = useState(false);

  const puzzle = useMemo(() => {
    return getDailyPuzzle(new Date());
  }, []);

  const handleStart = () => {
      setGameActive(true);
      onInsert(puzzle.starterCode);
      setAttempts(0);
      setSolved(false);
      setFeedback("Code loaded. Fill in the blanks.");
  };

  const handleSubmit = () => {
      if (attempts >= 5 && !solved) return;
      
      const result = onSubmit(puzzle);
      if (result.success) {
          setSolved(true);
          setFeedback("SUCCESS! Pattern Matched.");
      } else {
          setAttempts(prev => prev + 1);
          setFeedback(result.feedback || "Incorrect. Try again.");
      }
  };

  return (
    <div className="bg-[#0a0e17] border border-cyan-500/30 rounded-lg mb-4 relative overflow-hidden shadow-[0_0_10px_rgba(6,182,212,0.1)]">
      <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
      
      <div className="bg-cyan-950/30 p-2 flex justify-between items-center border-b border-cyan-500/10">
         <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></span>
            Daily Puzzle #{puzzle.id}
         </span>
         <div className="text-[10px] font-mono text-slate-500">
             {solved ? <span className="text-emerald-400">SOLVED</span> : gameActive ? `Try ${attempts + 1}/5` : ''}
         </div>
      </div>
      
      <div className="p-3">
        <h3 className="text-sm font-bold text-white mb-1">{puzzle.title}</h3>
        <p className="text-xs text-slate-400 font-mono mb-3 leading-tight">{puzzle.description}</p>

        {!gameActive ? (
            <button 
                onClick={handleStart}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold rounded shadow-lg shadow-cyan-500/20 transition-all"
            >
                START PUZZLE
            </button>
        ) : (
            <div className="space-y-3">
                 {/* Game Controls */}
                 <div className="flex gap-2">
                    <button 
                        onClick={() => onPreview(puzzle)}
                        className={`flex-1 py-2 rounded font-mono text-[10px] font-bold border transition-all ${isPreviewing ? 'bg-white text-black border-white' : 'bg-slate-800 text-white border-slate-700 hover:border-white'}`}
                    >
                        {isPreviewing ? 'LISTENING...' : 'LISTEN TO GOAL 🔊'}
                    </button>
                 </div>

                 {/* Feedback Area */}
                 <div className={`p-2 rounded text-[10px] font-mono border ${solved ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-black/50 border-slate-800 text-slate-300'}`}>
                     {feedback || "Listen to the goal and fix the code."}
                 </div>
                 
                 <div className="flex gap-2">
                    <button 
                        onClick={() => onInsert(puzzle.starterCode)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] rounded font-mono"
                        title="Reset Code"
                    >
                        RESET
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={solved || attempts >= 5}
                        className={`flex-1 py-2 rounded font-mono text-xs font-bold transition-all ${solved ? 'bg-emerald-600 text-white' : 'bg-pink-600 hover:bg-pink-500 text-white'}`}
                    >
                        {solved ? 'COMPLETED' : attempts >= 5 ? 'FAILED' : 'CHECK CODE'}
                    </button>
                 </div>
            </div>
        )}
      </div>
    </div>
  );
};