import React from 'react';

interface RecordingModalProps {
  isOpen: boolean;
  videoUrl: string | null;
  onSave: () => void;
  onDiscard: () => void;
}

export const RecordingModal: React.FC<RecordingModalProps> = ({ isOpen, videoUrl, onSave, onDiscard }) => {
  if (!isOpen || !videoUrl) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onDiscard}></div>
      <div className="relative bg-[#0f172a] border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        
        <div className="p-4 border-b border-slate-800 bg-slate-900">
          <h2 className="text-lg font-bold text-white font-mono">Recording Finished</h2>
        </div>

        <div className="p-4 flex flex-col gap-4">
           <div className="aspect-video bg-black rounded overflow-hidden border border-slate-800">
               <video src={videoUrl} controls className="w-full h-full object-contain" />
           </div>
           <p className="text-sm text-slate-400 text-center">
               Your visualizer set has been captured. Save to device?
           </p>
        </div>

        <div className="p-4 bg-slate-900 flex gap-3">
           <button 
             onClick={onDiscard}
             className="flex-1 py-3 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 font-mono text-sm"
           >
             DISCARD
           </button>
           <button 
             onClick={onSave}
             className="flex-1 py-3 rounded bg-cyan-600 text-white hover:bg-cyan-500 font-mono text-sm font-bold shadow-lg shadow-cyan-500/20"
           >
             SAVE .WEBM
           </button>
        </div>

      </div>
    </div>
  );
};