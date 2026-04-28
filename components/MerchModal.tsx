
import React, { useState, useEffect } from 'react';
import { SoundPack } from '../types';

interface MerchModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundPacks: SoundPack[];
}

export const MerchModal: React.FC<MerchModalProps> = ({ isOpen, onClose, soundPacks }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('voibe_premium_unlocked');
    if (stored) setIsUnlocked(true);
  }, []);

  const handleUnlock = () => {
      window.open('https://buymeacoffee.com/voibecode', '_blank');
      // Optimistically unlock immediately
      setIsUnlocked(true);
      localStorage.setItem('voibe_premium_unlocked', 'true');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-[#0f172a]/95 backdrop-blur z-10">
          <h2 className="text-2xl font-bold text-white font-mono">
            Voibe<span className="text-pink-500">Store</span>
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Sound Packs Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-mono text-cyan-400 tracking-widest">PREMIUM SOUND PACKS</h3>
                {isUnlocked && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded font-bold border border-emerald-500/30">UNLOCKED</span>}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {soundPacks.filter(p => p.price > 0).map(pack => (
                <div key={pack.id} className={`group relative overflow-hidden rounded-xl bg-slate-900 border transition-all flex flex-col ${isUnlocked ? 'border-cyan-500/50' : 'border-slate-800 hover:border-slate-600'}`}>
                  <div className={`absolute top-0 left-0 w-full h-1 bg-${pack.colorTheme}-500`}></div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-lg text-white">{pack.name}</h4>
                        <span className={`text-xs font-mono px-2 py-1 rounded border ${isUnlocked ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-slate-800 text-white border-slate-700'}`}>
                            {isUnlocked ? 'OWNED' : 'PREMIUM'}
                        </span>
                    </div>
                    <p className="text-slate-400 text-sm mb-4 min-h-[40px] flex-1">{pack.description}</p>
                    
                    <div className="mt-auto">
                        {!isUnlocked ? (
                            <button 
                                onClick={handleUnlock}
                                className="w-full py-3 rounded bg-white text-black font-bold hover:bg-cyan-400 hover:text-black transition-colors font-mono text-sm flex items-center justify-center gap-2 shadow-lg shadow-white/10"
                            >
                                <span>UNLOCK NOW (Free / Donate)</span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                </svg>
                            </button>
                        ) : (
                            <button className="w-full py-2 rounded bg-emerald-600 text-white font-bold font-mono text-sm cursor-default opacity-80">
                            Assets Ready
                            </button>
                        )}
                    </div>
                   
                  </div>
                </div>
              ))}
            </div>
             {!isUnlocked && (
                <div className="flex justify-center mt-6">
                    <p className="text-pink-300 text-xs font-mono italic flex items-center gap-2">
                       <span>✨</span> No Payment Required. Just check out my links!
                    </p>
                </div>
             )}
          </div>

          {/* Merch Section */}
          <div>
            <h3 className="text-sm font-mono text-pink-400 tracking-widest mb-4">OFFICIAL MERCH</h3>
            <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6 border border-white/10">
                <div className="w-32 h-32 bg-black rounded-lg flex items-center justify-center border border-white/20 rotate-3 shadow-xl shrink-0">
                    <span className="font-mono text-2xl font-bold text-white text-center leading-none">
                        Voibe<br/>Code
                    </span>
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h4 className="text-xl font-bold text-white mb-2">Support the Project</h4>
                    <div className="flex gap-3 justify-center md:justify-start">
                        <button 
                            onClick={() => window.open('https://voibecode-shop.fourthwall.com/', '_blank')}
                            className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-2 rounded-lg font-bold transition-all shadow-lg shadow-pink-500/25"
                        >
                            Visit Store
                        </button>
                    </div>
                </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
