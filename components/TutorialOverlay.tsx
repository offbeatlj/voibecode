import React, { useState } from 'react';
import { TUTORIAL_STEPS } from '../constants';

interface TutorialOverlayProps {
  onComplete: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);

  const currentStep = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      
      <div className="relative w-full max-w-md bg-[#0f172a] border border-cyan-500/30 rounded-xl shadow-[0_0_50px_rgba(34,211,238,0.1)] overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-mono text-cyan-400 tracking-widest uppercase">System Training</span>
          </div>
          <h2 className="text-2xl font-bold text-white font-mono">{currentStep.title}</h2>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[200px] flex flex-col justify-between bg-[#0a0e17]">
          <p className="text-slate-300 leading-relaxed whitespace-pre-line font-mono text-sm">
            {currentStep.description}
          </p>

          {/* Step Indicator */}
          <div className="flex gap-1 mt-8 mb-2">
            {TUTORIAL_STEPS.map((_, i) => (
              <div 
                key={i} 
                className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-cyan-500' : 'bg-slate-800'}`}
              />
            ))}
          </div>
        </div>

        {/* Footer / Actions */}
        <div className="p-4 bg-slate-900 border-t border-white/5 flex justify-between items-center">
          <button 
            onClick={onComplete}
            className="text-xs text-slate-500 hover:text-white font-mono px-4 py-2"
          >
            SKIP_INIT
          </button>
          <button 
            onClick={handleNext}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded font-bold font-mono text-sm transition-all shadow-lg shadow-cyan-500/20"
          >
            {isLast ? 'LAUNCH_SYSTEM' : 'NEXT_STEP >>'}
          </button>
        </div>

      </div>
    </div>
  );
};