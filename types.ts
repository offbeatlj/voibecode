
export enum InstrumentType {
  KICK = 'KICK',
  SNARE = 'SNARE',
  HIHAT = 'HIHAT',
  SYNTH_LEAD = 'SYNTH_LEAD',
  SYNTH_PAD = 'SYNTH_PAD',
  BASS = 'BASS',
  TOM = 'TOM',
  CLAP = 'CLAP',
  CRASH = 'CRASH',
  RIDE = 'RIDE',
  OPENHAT = 'OPENHAT',
  PERC = 'PERC',
  LOFI_KICK = 'LOFI_KICK',
  LOFI_SNARE = 'LOFI_SNARE',
  PLUCK = 'PLUCK',
  FX = 'FX'
}

export interface Track {
  id: string;
  name: string;
  type: InstrumentType;
  color: string; 
  steps: number[]; // 0 = off, 1 = normal, >1 = accent, <1 = ghost, -1 = sustain
  volume: number; 
  muted: boolean;
  soloed: boolean;
}

export interface SoundPack {
  id: string;
  name: string;
  description: string;
  price: number;
  isLocked: boolean;
  colorTheme: string;
}

export enum PlayState {
  STOPPED = 'STOPPED',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED'
}

export type Scale = {
  name: string;
  frequencies: number[]; 
  notes: string[]; 
  color: string; 
};

export interface Preset {
  name: string;
  bpm: number;
  tracks: {
    id: string;
    steps: number[];
  }[];
}

export interface VisualizerSettings {
  hue: number; 
  shape: 'polygon' | 'orb' | 'wave';
}

export interface DailyPuzzle {
  id: string; // Changed to string for date-based IDs (e.g. "2023-10-27")
  title: string;
  hiddenSetup?: string; 
  targetCode: string;   
  description: string;
  tokens: string[]; 
  starterCode: string; 
}

export interface UserStats {
  currentStreak: number;
  maxStreak: number;
  lastSolvedDate: string | null; // YYYY-MM-DD
  puzzlesSolved: number;
}
