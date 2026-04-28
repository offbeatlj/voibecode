import React, { useEffect, useRef } from 'react';

interface ConsoleProps {
  logs: string[];
}

export const Console: React.FC<ConsoleProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="bg-black border border-slate-800 rounded-lg p-3 font-mono text-xs h-32 overflow-y-auto shadow-inner">
      <div className="text-slate-500 mb-2">--- SYSTEM OUTPUT ---</div>
      {logs.map((log, i) => (
        <div key={i} className={`${log.includes('Warning') ? 'text-yellow-400' : log.includes('Error') ? 'text-red-400' : 'text-emerald-400/80'}`}>
          {log}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};