import React from 'react';

interface MobileNavBarProps {
  activeTab: 'code' | 'controls' | 'docs';
  setActiveTab: (tab: 'code' | 'controls' | 'docs') => void;
  onRunToggle: () => void;
  isPlaying: boolean;
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({ activeTab, setActiveTab, onRunToggle, isPlaying }) => {
  const tabs = [
    { id: 'code', label: 'CODE', icon: '{ }' },
    { id: 'controls', label: 'STUDIO', icon: '●' },
  ] as const;

  return (
    <div className="md:hidden flex items-center justify-around bg-[#050505] border-t border-slate-800 pb-safe pt-2 h-20 shrink-0 z-50 px-4">
      
      {/* Code Tab */}
      <button
          onClick={() => setActiveTab('code')}
          className={`flex flex-col items-center gap-1 py-2 transition-colors flex-1 ${
            activeTab === 'code' ? 'text-cyan-400' : 'text-slate-500'
          }`}
        >
          <div className={`text-lg font-bold ${activeTab === 'code' ? 'glow-text-cyan' : ''}`}>
            {'{ }'}
          </div>
          <span className="text-[10px] font-mono tracking-widest">CODE</span>
      </button>

      {/* Center Run Button */}
      <div className="flex-1 flex justify-center -mt-6">
          <button 
            onClick={onRunToggle}
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl border-4 border-[#050505] transition-all ${isPlaying ? 'bg-pink-500 shadow-pink-500/40' : 'bg-cyan-500 shadow-cyan-500/40'}`}
          >
             {isPlaying ? (
                <div className="w-4 h-4 bg-white rounded-sm"></div>
             ) : (
                <div className="w-0 h-0 border-l-[14px] border-l-white border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent ml-1"></div>
             )}
          </button>
      </div>

      {/* Controls Tab */}
      <button
          onClick={() => setActiveTab('controls')}
          className={`flex flex-col items-center gap-1 py-2 transition-colors flex-1 ${
            activeTab === 'controls' ? 'text-cyan-400' : 'text-slate-500'
          }`}
        >
          <div className={`text-lg font-bold ${activeTab === 'controls' ? 'glow-text-cyan' : ''}`}>
            ●
          </div>
          <span className="text-[10px] font-mono tracking-widest">STUDIO</span>
      </button>

    </div>
  );
};