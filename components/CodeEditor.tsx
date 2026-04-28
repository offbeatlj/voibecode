import React, { useRef, useState } from 'react';

interface CodeEditorProps {
  code: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, readOnly = false }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Sync scroll exactly
  const handleScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleCopyAll = () => {
      navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
  };

  const highlightCode = (input: string) => {
    const regex = /([#].*)|(['"][^'"]*['"])|(\b(?:kick|snare|hat|bass|lead|tom|clap|crash|ride|perc|openhat|lofi_kick|lofi_snare|pluck|fx)\b)|(\b(?:bpm|swing|filter|scale|key)\b)|(\b\d+\b)|([=*?])/g;
    
    let match;
    let lastIndex = 0;
    let result = '';
    
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    while ((match = regex.exec(input)) !== null) {
        if (match.index > lastIndex) {
            result += escape(input.slice(lastIndex, match.index));
        }
        const [fullMatch, comment, string, func, keyword, number, operator] = match;
        const safeContent = escape(fullMatch);
        
        if (comment) result += `<span class="text-slate-500 italic">${safeContent}</span>`;
        else if (string) result += `<span class="text-orange-300">${safeContent}</span>`;
        else if (func) result += `<span class="text-pink-500 font-bold">${safeContent}</span>`;
        else if (keyword) result += `<span class="text-cyan-400 italic">${safeContent}</span>`;
        else if (number) result += `<span class="text-purple-400">${safeContent}</span>`;
        else if (operator) result += `<span class="text-white font-bold">${safeContent}</span>`;
        else result += safeContent;
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < input.length) result += escape(input.slice(lastIndex));
    if (input.endsWith('\n')) result += '<br />'; 
    return result;
  };

  // Updated Layout CSS: Enforce wrapping to keep text on screen
  const sharedStyle: React.CSSProperties = {
    fontFamily: '"Fira Code", monospace',
    fontSize: '14px', 
    lineHeight: '24px',
    letterSpacing: '0px',
    padding: '20px',
    margin: 0,
    border: 'none',
    whiteSpace: 'pre-wrap', // Enable wrapping
    wordBreak: 'break-word',
    overflowY: 'auto',
    overflowX: 'hidden',
    tabSize: 2,
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    fontVariantLigatures: 'none',
    WebkitTextSizeAdjust: 'none',
    MozTextSizeAdjust: 'none',
  };

  const LINE_NUMBER_WIDTH = '3rem'; 

  return (
    <div className="relative w-full h-full bg-[#0a0e17] md:rounded-xl border-y md:border border-slate-800 overflow-hidden group font-mono shadow-inner text-sm isolate flex">
      <style>{`
        .code-editor-textarea::selection {
          background-color: rgba(34, 211, 238, 0.2); 
          color: transparent;
        }
        .no-scroll::-webkit-scrollbar {
            display: none;
        }
        .no-scroll {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>

      {!readOnly && (
        <button 
            onClick={handleCopyAll}
            className="absolute top-2 right-4 z-50 text-[10px] px-2 py-1 rounded border backdrop-blur transition-all bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-cyan-500 hover:text-black"
        >
            {isCopied ? 'COPIED!' : 'COPY ALL'}
        </button>
      )}

      {/* Line Numbers Column - Separated from text area to prevent overlap */}
      <div 
        className="flex-shrink-0 bg-[#05070a] border-r border-slate-800 flex flex-col items-end text-slate-600 select-none z-20 font-mono text-xs overflow-hidden"
        style={{ width: LINE_NUMBER_WIDTH, paddingTop: '20px', paddingRight: '10px' }}
      >
        <div style={{ transform: `translateY(-${textareaRef.current?.scrollTop || 0}px)` }}>
            {code.split('\n').map((_, i) => (
            <div key={i} className="h-[24px] leading-[24px]">{i + 1}</div>
            ))}
        </div>
      </div>

      {/* Editor Area Container */}
      <div className="relative flex-1 h-full min-w-0">
          
          {/* Syntax Highlighting Layer */}
          <pre
            ref={preRef}
            className="absolute inset-0 pointer-events-none z-10 text-slate-300 no-scroll"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: highlightCode(code) }}
            style={{...sharedStyle, color: '#cbd5e1' }} 
          />
          
          <style>{`pre span { opacity: 1; }`}</style>

          {/* Editing Layer */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            readOnly={readOnly}
            className="code-editor-textarea absolute inset-0 bg-transparent text-transparent caret-cyan-400 focus:outline-none resize-none z-20"
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            inputMode="text"
            style={{...sharedStyle, color: 'transparent', background: 'transparent'}} 
          />
      </div>
      
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500/20 to-pink-500/20 pointer-events-none z-40"></div>
    </div>
  );
};