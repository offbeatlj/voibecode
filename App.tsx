
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { CodeEditor } from './components/CodeEditor';
import { ControlPanel } from './components/ControlPanel';
import { Visualizer } from './components/Visualizer';
import { Console } from './components/Console';
import { MerchModal } from './components/MerchModal';
import { TutorialOverlay } from './components/TutorialOverlay';
import { CheatSheet } from './components/CheatSheet';
import { MobileNavBar } from './components/MobileNavBar';
import { RecordingModal } from './components/RecordingModal';
import { DailyPuzzleBanner } from './components/DailyPuzzleBanner';
import { PuzzleInterface } from './components/PuzzleInterface';
import { ShopSidebar } from './components/ShopSidebar';
import { FloatingShopPromo } from './components/InlineShopAd';

import { AdTickerStrip } from './components/AdTickerStrip';
import { INITIAL_TRACKS, DEFAULT_BPM, TOTAL_STEPS, SOUND_PACKS, SCALES, DEFAULT_CODE, getDailyPuzzle, getSeasonalDemo } from './constants';
import { Track, PlayState, Scale, VisualizerSettings, DailyPuzzle, UserStats } from './types';
import { audioEngine } from './services/AudioEngine';
import { compileCode } from './services/VibeCompiler';

const App: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [bpm, setBpm] = useState<number>(DEFAULT_BPM);
  const [swing, setSwing] = useState<number>(0);
  const [playState, setPlayState] = useState<PlayState>(PlayState.STOPPED);
  const [isMerchOpen, setIsMerchOpen] = useState(false);
  const [filter, setFilter] = useState(0);
  const [currentScale, setCurrentScale] = useState<Scale>(SCALES[0]);
  
  // Project State
  const [projectName, setProjectName] = useState("MAIN.py");
  
  // Puzzle State
  const [isPuzzleOpen, setIsPuzzleOpen] = useState(false);
  const [previewTracks, setPreviewTracks] = useState<Track[] | null>(null);
  const [isPuzzlePreviewing, setIsPuzzlePreviewing] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>({
      currentStreak: 0,
      maxStreak: 0,
      lastSolvedDate: null,
      puzzlesSolved: 0
  });

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0); // 0-100
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  // Visualizer State
  const [visSettings, setVisSettings] = useState<VisualizerSettings>({
      hue: 180,
      shape: 'polygon'
  });
  
  // UI State
  const [showTutorial, setShowTutorial] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'code' | 'controls'>('code');

  // Code State
  const [code, setCode] = useState(DEFAULT_CODE);
  const [logs, setLogs] = useState<string[]>(['> System Boot...', '> Python Mode Active...']);

  // Refs for timing loop
  const tracksRef = useRef(tracks);
  const stepRef = useRef(-1);
  const timerRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const swingRef = useRef(swing);
  const scaleRef = useRef(currentScale);
  const playStateRef = useRef(playState);
  
  // Puzzle Refs
  const previewTracksRef = useRef<Track[] | null>(null);
  const isPuzzlePreviewingRef = useRef(false);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clipTimerRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { previewTracksRef.current = previewTracks; }, [previewTracks]);
  useEffect(() => { isPuzzlePreviewingRef.current = isPuzzlePreviewing; }, [isPuzzlePreviewing]);
  
  useEffect(() => { swingRef.current = swing; }, [swing]);
  useEffect(() => { scaleRef.current = currentScale; }, [currentScale]);
  useEffect(() => { playStateRef.current = playState; }, [playState]);
  useEffect(() => { audioEngine.setMasterFilter(filter); }, [filter]);
  
  useEffect(() => { document.title = `VoibeCode | ${projectName}`; }, [projectName]);

  const ensureScaleInCode = (inputCode: string): string => {
      if (!inputCode.includes('scale =') && !inputCode.includes('key =')) {
          const lines = inputCode.split('\n');
          const bpmIndex = lines.findIndex(l => l.includes('bpm ='));
          if (bpmIndex !== -1) {
             lines.splice(bpmIndex + 1, 0, '', '# 2. Scale (Key)', 'scale = "Pentatonic Minor"', '');
             return lines.join('\n');
          }
          return `scale = "Pentatonic Minor"\n\n` + inputCode;
      }
      return inputCode;
  };

  useEffect(() => {
    // Random hint chance on startup (10%)
    if (Math.random() > 0.9) {
        setTimeout(() => {
            setLogs(prev => [...prev, '> Hint: Try telling the system "It\'s my birthday!"']);
        }, 1000);
    }

    const hasSeenTutorial = localStorage.getItem('voibe_tutorial_complete_v2');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }

    const savedName = localStorage.getItem('voibe_project_name');
    if (savedName) setProjectName(savedName);

    const savedStats = localStorage.getItem('voibe_user_stats');
    if (savedStats) {
        try {
            const parsed = JSON.parse(savedStats);
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            
            if (parsed.lastSolvedDate) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];
                
                if (parsed.lastSolvedDate !== todayStr && parsed.lastSolvedDate !== yesterdayStr) {
                    parsed.currentStreak = 0;
                }
            }
            setUserStats(parsed);
        } catch (e) { console.error("Stats load error", e); }
    }

    const hash = window.location.hash.slice(1);
    if (hash) {
      try {
        const decoded = JSON.parse(atob(hash));
        if (decoded.code) {
            setCode(ensureScaleInCode(decoded.code));
            setLogs(prev => [...prev, '> Loaded shared code from URL']);
        }
        if (decoded.name) setProjectName(decoded.name);
      } catch (e) {
        console.error("Failed to load state from URL");
      }
    } else {
      const saved = localStorage.getItem('voibe_autosave_v4');
      if (saved) {
        setCode(ensureScaleInCode(saved));
        setLogs(prev => [...prev, '> Restored previous session']);
      } else {
        setCode(DEFAULT_CODE);
      }
    }
  }, []);

  useEffect(() => {
    if (code) localStorage.setItem('voibe_autosave_v4', code);
    localStorage.setItem('voibe_project_name', projectName);
  }, [code, projectName]);

  useEffect(() => {
      localStorage.setItem('voibe_user_stats', JSON.stringify(userStats));
  }, [userStats]);

  const handleTutorialComplete = () => {
    setShowTutorial(false);
    localStorage.setItem('voibe_tutorial_complete_v2', 'true');
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
        const result = compileCode(code);
        
        setTracks(result.tracks);
        if (result.bpm) setBpm(result.bpm);
        if (result.swing !== null) setSwing(result.swing);
        if (result.filter !== null) setFilter(result.filter);
        if (result.scaleName) {
            const s = SCALES.find(sc => sc.name === result.scaleName);
            if (s) setCurrentScale(s);
        }
        
        if (result.error) {
            setLogs(prev => [...prev.slice(-5), result.error!]);
        } else if (result.logs.length > 1) { 
             const meaningful = result.logs.filter(l => l.includes('Warning') || l.includes('Error'));
             if (meaningful.length > 0) setLogs(prev => [...prev.slice(-5), ...meaningful]);
        }
    }, 250);
    return () => clearTimeout(timeout);
  }, [code]);

  const lookahead = 25.0; 
  const scheduleAheadTime = 0.1; 

  const nextNote = useCallback(() => {
    const secondsPerBeat = 60.0 / bpm;
    const baseStepTime = 0.25 * secondsPerBeat; 
    stepRef.current = (stepRef.current + 1) % TOTAL_STEPS;
    const currentIsEven = stepRef.current % 2 === 0; 
    const swingOffset = (swingRef.current / 100) * (baseStepTime * 0.33); 
    
    if (currentIsEven) nextNoteTimeRef.current += (baseStepTime + swingOffset);
    else nextNoteTimeRef.current += (baseStepTime - swingOffset);
  }, [bpm]);

  const scheduleNote = useCallback((stepNumber: number, time: number) => {
    const activeTracks = isPuzzlePreviewingRef.current && previewTracksRef.current 
        ? previewTracksRef.current 
        : tracksRef.current;

    activeTracks.forEach(track => {
      if (!track.muted) {
          const stepVal = track.steps[stepNumber];
          if (stepVal === -1) {
          } else if (stepVal > 0) {
              audioEngine.playSound(track.type, time, track.volume, stepNumber, scaleRef.current, stepVal);
          }
      }
    });
  }, []);

  const scheduler = useCallback(() => {
    const currentTime = audioEngine.getCurrentTime();
    while (nextNoteTimeRef.current < currentTime + scheduleAheadTime) {
      scheduleNote(stepRef.current === -1 ? 0 : (stepRef.current + 1) % TOTAL_STEPS, nextNoteTimeRef.current);
      nextNote();
    }
    timerRef.current = window.setTimeout(scheduler, lookahead);
  }, [nextNote, scheduleNote]);

  const handlePlayPause = async () => {
    if (isPuzzlePreviewing) {
        handleStopPreview();
    }

    if (playState === PlayState.PLAYING) {
      setPlayState(PlayState.PAUSED);
      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      await audioEngine.resume();
      const ctxTime = audioEngine.getCurrentTime();
      if (playState === PlayState.STOPPED) {
        nextNoteTimeRef.current = ctxTime + 0.1;
        stepRef.current = -1;
      } else {
        nextNoteTimeRef.current = ctxTime + 0.1;
      }
      setPlayState(PlayState.PLAYING);
      scheduler();
    }
  };

  const togglePlayRef = useRef(handlePlayPause);
  useEffect(() => { togglePlayRef.current = handlePlayPause; }, [handlePlayPause]);

  const handleStop = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPlayState(PlayState.STOPPED);
    stepRef.current = -1;
    handleStopPreview();
  };
  const handleStopRef = useRef(handleStop);
  useEffect(() => { handleStopRef.current = handleStop; }, [handleStop]);

  const activePuzzle = useMemo(() => {
      return getDailyPuzzle(new Date());
  }, []);

  const handlePuzzlePreview = async (puzzle: DailyPuzzle) => {
      const fullCode = (puzzle.hiddenSetup || '') + '\n' + puzzle.targetCode;
      const res = compileCode(fullCode);
      
      if (res.tracks.length > 0) {
          setPreviewTracks(res.tracks);
          if (res.bpm) setBpm(res.bpm);
          
          setIsPuzzlePreviewing(true);
          
          await audioEngine.resume();
          const ctxTime = audioEngine.getCurrentTime();
          nextNoteTimeRef.current = ctxTime + 0.1;
          stepRef.current = -1;
          
          setPlayState(PlayState.PLAYING); 
          scheduler(); 
          
          setTimeout(() => {
             if (isPuzzlePreviewingRef.current) handleStop(); 
          }, 4000);
      }
  };

  const handleStopPreview = () => {
      setIsPuzzlePreviewing(false);
      setPreviewTracks(null);
      setPlayState(PlayState.STOPPED);
  };

  const handlePuzzleSubmit = (puzzle: DailyPuzzle, userCodeFragment: string): { success: boolean, feedback: string } => {
      const solutionFull = (puzzle.hiddenSetup || '') + '\n' + puzzle.targetCode;
      const userFull = (puzzle.hiddenSetup || '') + '\n' + userCodeFragment;
      
      const solution = compileCode(solutionFull);
      const userAttempt = compileCode(userFull);
      
      if (solution.bpm && userAttempt.bpm && Math.abs((userAttempt.bpm) - solution.bpm) > 5) {
          return { success: false, feedback: `Speed incorrect.` };
      }

      for (const solTrack of solution.tracks) {
          const userTrack = userAttempt.tracks.find(t => t.type === solTrack.type);
          
          if (!userTrack) {
              const hasNotes = solTrack.steps.some(s => s > 0);
              if (hasNotes) return { success: false, feedback: `Missing Instrument: ${solTrack.name}` };
              continue;
          }

          const stringify = (s: number[]) => s.map(v => v > 0 ? '1' : '0').join('');
          if (stringify(solTrack.steps) !== stringify(userTrack.steps)) {
               return { success: false, feedback: `${solTrack.name} pattern incorrect.` };
          }
      }
      
      const todayStr = new Date().toISOString().split('T')[0];
      if (userStats.lastSolvedDate !== todayStr) {
          let newStreak = userStats.currentStreak;
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          if (userStats.lastSolvedDate === yesterdayStr) {
              newStreak += 1;
          } else {
              newStreak = 1;
          }
          
          setUserStats(prev => ({
              ...prev,
              lastSolvedDate: todayStr,
              currentStreak: newStreak,
              maxStreak: Math.max(prev.maxStreak, newStreak),
              puzzlesSolved: prev.puzzlesSolved + 1
          }));
      }
      
      return { success: true, feedback: "Success!" };
  };

  const handleLoadDemo = useCallback(() => {
      const demoCode = getSeasonalDemo();
      navigator.clipboard.writeText(demoCode).then(() => {
          setLogs(prev => [...prev, '> Seasonal Demo copied to clipboard! 📋']);
          alert("Seasonal Demo Code Copied!\n\nPaste it into the main code editor to play.");
      }).catch(err => {
          console.error("Clipboard error", err);
          setLogs(prev => [...prev, '> Error copying demo code']);
      });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        togglePlayRef.current();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleStopRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const startRecording = async () => {
      let videoStream: MediaStream | undefined;
      if (canvasRef.current) {
          videoStream = canvasRef.current.captureStream(30);
      }
      audioEngine.startRecording(videoStream);
      setIsRecording(true);
  };

  const stopRecording = async () => {
      try {
        const blob = await audioEngine.stopRecording();
        setIsRecording(false);
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        if (clipTimerRef.current) { clearTimeout(clipTimerRef.current); clipTimerRef.current = null; }
        if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
        setRecordingProgress(0);
      } catch (e) {
          console.error("Stop recording failed", e);
          setIsRecording(false);
      }
  };

  const handleToggleRecord = () => {
      if (isRecording) stopRecording();
      else startRecording();
  };

  const handleQuickClip = () => {
      if (isRecording) return;
      startRecording();
      setRecordingProgress(1);
      clipTimerRef.current = window.setTimeout(() => stopRecording(), 15000);
      let p = 0;
      progressIntervalRef.current = window.setInterval(() => {
          p += 100 / 150; 
          setRecordingProgress(Math.min(p, 100));
      }, 100);
  };

  const handleSaveRecording = () => {
      if (recordedUrl && recordedBlob) {
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = recordedUrl;
          const type = recordedBlob.type;
          const ext = type.includes('mp4') ? 'mp4' : 'webm';
          a.download = `${projectName.replace(/\s+/g, '_')}_clip.${ext}`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
             window.URL.revokeObjectURL(recordedUrl);
             setRecordedUrl(null);
             setRecordedBlob(null);
          }, 100);
      }
  };

  const handleShare = () => {
      const state = { code, name: projectName };
      const str = btoa(JSON.stringify(state));
      window.location.hash = str;
      setLogs(prev => [...prev, '> URL copied to clipboard']);
      navigator.clipboard.writeText(window.location.href);
  };
  
  const handleInsertSnippet = (text: string) => {
      setCode(prev => prev + "\n" + text);
      setLogs(prev => [...prev, '> Snippet inserted']);
  };

  const renderControlPanel = () => (
     <div className="h-full overflow-y-auto custom-scrollbar pb-safe">
        <div className="relative">
            <Visualizer 
                ref={canvasRef} 
                isPlaying={playState === PlayState.PLAYING} 
                bpm={bpm}
                settings={visSettings}
                accentColor={currentScale.color}
                className="w-full h-48 md:h-64 rounded-xl border border-slate-800/50 bg-black/50 mt-6 shadow-inner transition-colors duration-500"
            />
            {isPuzzlePreviewing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black z-10 rounded-xl mt-6">
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-3xl animate-bounce">👂</span>
                        <span className="text-cyan-400 font-mono text-xs animate-pulse">LISTENING TO TARGET...</span>
                    </div>
                </div>
            )}
        </div>
        <div className="mt-4">
          <ControlPanel 
            playState={playState}
            bpm={bpm}
            onPlayPause={handlePlayPause}
            onStop={handleStop}
            isRecording={isRecording}
            onToggleRecord={handleToggleRecord}
            onQuickClip={handleQuickClip}
            recordingProgress={recordingProgress}
            onShare={handleShare}
            onOpenMerch={() => setIsMerchOpen(true)}
            visSettings={visSettings}
            onUpdateVisSettings={(s) => setVisSettings(prev => ({ ...prev, ...s }))}
            onInsertCode={handleInsertSnippet}
            accentColor={currentScale.color}
            onOpenPuzzle={() => setIsPuzzleOpen(true)}
          />
        </div>
        <div className="mt-4 pb-4">
            <Console logs={logs} />
        </div>
        
        {/* Authentic store ads */}
        <ShopSidebar />
     </div>
  );

  return (
    <div className="fixed inset-0 h-[100dvh] bg-[#050505] text-white overflow-hidden flex flex-col font-inter">
      {showTutorial && <TutorialOverlay onComplete={handleTutorialComplete} />}
      
      {/* Subtle ad ticker */}
      <AdTickerStrip />
      
      <DailyPuzzleBanner onOpen={() => setIsPuzzleOpen(true)} />

      {/* Main Container */}
      <div className="flex-1 flex flex-col max-w-[1600px] mx-auto w-full overflow-hidden relative min-h-0">
          
        {/* Header strictly separate from main content */}
        <div className="shrink-0 z-50 relative">
             <Header 
                accentColor={currentScale.color} 
                onLogoClick={() => setShowTutorial(true)}
                onLoadDemo={handleLoadDemo}
            />
        </div>
        
        {/* Main Content Area - Fills remaining space, handles scrolling internally */}
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0">
          
          {/* LEFT PANEL (CODE) */}
          <div className={`
              flex-1 md:flex-[3] flex flex-col min-h-0 h-full
              ${mobileTab === 'code' ? 'flex' : 'hidden md:flex'}
              md:pl-4 md:py-4 md:pr-2
          `}>
              <div className="flex justify-between items-center px-4 md:px-0 pb-2 pt-2 md:mb-2 border-b md:border-none border-white/5 shrink-0">
                  <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: currentScale.color }}></span>
                      <input 
                        type="text" 
                        value={projectName} 
                        onChange={(e) => setProjectName(e.target.value)}
                        className="bg-transparent border-none text-xs md:text-sm font-mono font-bold tracking-wider focus:ring-0 text-white w-48"
                      />
                  </div>
                  
                  <button 
                      onClick={() => setIsDocsOpen(!isDocsOpen)}
                      className={`flex items-center gap-2 px-3 py-1 rounded border text-xs font-mono transition-all ${isDocsOpen ? 'bg-pink-500/20 border-pink-500 text-pink-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                  >
                      <span>{isDocsOpen ? 'CLOSE_DOCS' : 'REFERENCE'}</span>
                      <span className="bg-white/10 rounded px-1.5 text-[10px]">?</span>
                  </button>
              </div>
              
              <div className="flex-1 relative shadow-2xl shadow-black md:rounded-xl overflow-hidden border-b md:border border-slate-800 min-h-0">
                  <CodeEditor code={code} onChange={setCode} />
                  {isDocsOpen && (
                      <div className="absolute inset-0 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200 bg-[#0f172a]">
                          <CheatSheet onInsert={(s) => { handleInsertSnippet(s); setIsDocsOpen(false); }} onClose={() => setIsDocsOpen(false)} />
                      </div>
                  )}
              </div>
          </div>

          {/* RIGHT PANEL (CONTROLS) */}
          <div className={`
              flex-1 md:w-[350px] lg:w-[400px] flex-col gap-4 h-full overflow-hidden shrink-0 bg-[#050505] md:bg-transparent
              ${mobileTab !== 'code' ? 'flex' : 'hidden md:flex'}
              p-4 md:pr-4 md:py-4 md:pl-2
          `}>
              <div className="hidden md:flex border-b border-slate-800 shrink-0">
                  <div className="flex-1 py-2 text-xs font-mono font-bold tracking-wider text-white border-b-2" style={{ borderColor: currentScale.color }}>
                      CONTROLS
                  </div>
              </div>
              <div className="flex-1 overflow-hidden relative min-h-0">
                  {renderControlPanel()}
              </div>
          </div>

        </main>
      </div>

      <MobileNavBar 
        activeTab={mobileTab} 
        setActiveTab={setMobileTab as any} 
        onRunToggle={handlePlayPause}
        isPlaying={playState === PlayState.PLAYING}
      />

      {/* Overlays */}
      <PuzzleInterface 
          isOpen={isPuzzleOpen} 
          puzzle={activePuzzle}
          onClose={() => setIsPuzzleOpen(false)}
          onPreview={handlePuzzlePreview}
          onSubmit={handlePuzzleSubmit}
          isPreviewing={isPuzzlePreviewing}
          accentColor={currentScale.color}
          bpm={bpm}
          stats={userStats}
      />

      <MerchModal isOpen={isMerchOpen} onClose={() => setIsMerchOpen(false)} soundPacks={SOUND_PACKS} />
      <RecordingModal isOpen={!!recordedUrl} videoUrl={recordedUrl} onSave={handleSaveRecording} onDiscard={() => { if(recordedUrl) window.URL.revokeObjectURL(recordedUrl); setRecordedUrl(null); setRecordedBlob(null); }} />
      
      {/* Floating Shop Promo - appears after 30s */}
      <FloatingShopPromo />
    </div>
  );
};

export default App;
