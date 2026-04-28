
import { InstrumentType, SoundPack, Track, Scale, Preset, DailyPuzzle } from './types';

export const TOTAL_STEPS = 16;
export const DEFAULT_BPM = 110;

export const DEFAULT_CODE = `# WELCOME TO VOIBECODE
# The easiest way to make music with code.

# 1. Global Speed
bpm = 120

# 2. Scale (Key)
# Options: "Pentatonic Minor", "Cyber Major", "Dorian Void"
scale = "Pentatonic Minor"

# 3. Instruments
# x = Hit, ! = Loud, ? = Soft, ~ = Hold
kick("x...x...x...x...")
snare("....x.......x...")

# Pattern Math ("x." * 8)
hat("x.x." * 4)

# Melody
bass("x..?..x.x..~....")
`;

export const INITIAL_TRACKS: Track[] = [
  {
    id: 't1',
    name: 'kick',
    type: InstrumentType.KICK,
    color: 'bg-cyan-500',
    steps: Array(TOTAL_STEPS).fill(0),
    volume: 0.8,
    muted: false,
    soloed: false,
  },
  {
    id: 't2',
    name: 'snare',
    type: InstrumentType.SNARE,
    color: 'bg-pink-500',
    steps: Array(TOTAL_STEPS).fill(0),
    volume: 0.7,
    muted: false,
    soloed: false,
  },
  {
    id: 't3',
    name: 'hat',
    type: InstrumentType.HIHAT,
    color: 'bg-yellow-400',
    steps: Array(TOTAL_STEPS).fill(0),
    volume: 0.5,
    muted: false,
    soloed: false,
  },
  {
    id: 't4',
    name: 'bass',
    type: InstrumentType.BASS,
    color: 'bg-indigo-500',
    steps: Array(TOTAL_STEPS).fill(0),
    volume: 0.6,
    muted: false,
    soloed: false,
  },
  {
    id: 't5',
    name: 'lead',
    type: InstrumentType.SYNTH_LEAD,
    color: 'bg-emerald-400',
    steps: Array(TOTAL_STEPS).fill(0),
    volume: 0.4,
    muted: false,
    soloed: false,
  },
  {
    id: 't6',
    name: 'openhat',
    type: InstrumentType.OPENHAT,
    color: 'bg-orange-400',
    steps: Array(TOTAL_STEPS).fill(0),
    volume: 0.4,
    muted: false,
    soloed: false,
  }
];

export const SOUND_PACKS: SoundPack[] = [
  {
    id: 'pack_default',
    name: 'Console Log Lo-Fi',
    description: 'The default dusty beats for late night coding.',
    price: 0,
    isLocked: false,
    colorTheme: 'cyan',
  },
  {
    id: 'pack_sydney',
    name: 'Bondi Drift',
    description: 'Sun-soaked pads and ocean-spray noise textures.',
    price: 4.99,
    isLocked: true,
    colorTheme: 'orange',
  },
  {
    id: 'pack_cyber',
    name: 'Null Pointer Exception',
    description: 'Glitch drums and aggressive saw waves.',
    price: 8.99,
    isLocked: true,
    colorTheme: 'red',
  },
];

export const SCALES: Scale[] = [
  { 
    name: 'Pentatonic Minor', 
    frequencies: [330, 392, 440, 494, 523, 587, 659], 
    notes: ['E', 'G', 'A', 'B', 'C'],
    color: '#a855f7' // Purple
  }, 
  { 
    name: 'Cyber Major', 
    frequencies: [261.6, 329.6, 392.0, 523.2, 659.2, 784.0],
    notes: ['C', 'E', 'G', 'C', 'E'],
    color: '#22d3ee' // Cyan
  },
  { 
    name: 'Dorian Void', 
    frequencies: [293.7, 349.2, 440.0, 493.9, 587.3, 698.5],
    notes: ['D', 'F', 'A', 'B', 'D'],
    color: '#3b82f6' // Blue
  },
  { 
    name: 'Hirajoshi', 
    frequencies: [329.6, 349.2, 415.3, 493.9, 523.2],
    notes: ['E', 'F', 'G#', 'B', 'C'],
    color: '#fb923c' // Orange
  },
  { 
    name: 'Lydian Glitch', 
    frequencies: [349.2, 392.0, 440.0, 523.2, 587.3],
    notes: ['F', 'G', 'A', 'C', 'D'],
    color: '#f472b6' // Pink
  },
  {
    name: 'Party Major',
    frequencies: [261.6, 293.7, 329.6, 349.2, 392.0, 440.0, 493.9],
    notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    color: '#eab308' // Yellow
  }
];

export const PRESETS: Preset[] = [
  {
    name: 'Hello World',
    bpm: 100,
    tracks: [
      { id: 't1', steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
      { id: 't2', steps: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] },
      { id: 't3', steps: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
    ]
  },
];

export const TUTORIAL_STEPS = [
  {
    title: "Coding Music",
    description: "VoibeCode: Rhythm defined by syntax. Create music by writing simple commands.\n\n(Fun Fact: 'Voibe' is how Australians say 'Vibe' 🦘)"
  },
  {
    title: "The Syntax",
    description: "1. `bpm = 120` sets speed.\n2. `scale = '...'` sets the key.\n3. `kick('x...x...')` plays a beat."
  },
  {
    title: "Symbols",
    description: "`x` = Hit\n`.` = Silence\n`!` = Loud\n`?` = Soft\n`~` = Hold"
  },
  {
    title: "Ready",
    description: "Click 'RUN_CODE' to play. Solve the Daily Puzzle to earn your stripes."
  }
];

// --- MONTHLY DEMOS ---
const MONTHLY_DEMOS = [
  // JAN (0)
  `# 🧊 GLACIAL DRIFT (January)
bpm = 130
scale = "Dorian Void"
kick("x...x.....x...x.")
snare("....x.......x...")
hat("x.x.x.x.x.x.x.x.")
bass("x...~...x...~...")
pluck("x.x...x.x.x...x.")
lead("..x.......x.....")`,

  // FEB (1)
  `# 💝 LOVE BYTE (February)
bpm = 110
scale = "Lydian Glitch"
kick("x..x.x....x..x..")
snare("....x.......x...")
hat("x.x.x?x.x.x.x?x.")
bass("x.......x.......")
lead("x~......x~......")
pluck("....x.x.....x.x.")`,

  // MAR (2)
  `# 🌿 EQUINOX (March)
bpm = 120
scale = "Cyber Major"
kick("x...x...x...x...")
snare("....x.......x...")
hat("xxx." * 4)
bass("x.x.x.x.x.x.x.x.")
lead("x...~...x...~...")
perc("..x...x...x...x.")`,

  // APR (3)
  `# 🌧️ RAIN DELAY (April)
bpm = 95
scale = "Pentatonic Minor"
kick("x..?.x..x..?.x..")
snare("....x.......x...")
hat("x?x?x?x?x?x?x?x?")
bass("x.......x...x...")
pluck("..x...x...x...x.")
fx("x...............")`,

  // MAY (4)
  `# 🌸 BLOOM (May)
bpm = 128
scale = "Party Major"
kick("x...x...x.x.x...")
snare("....x.......x...")
hat("x.x.x.x.x.x.x.x.")
lead("x.x.x.x.x.x.x.x.")
bass("x...x...x...x...")
clap("....x.......x...")`,

  // JUN (5)
  `# ☀️ SOLSTICE (June)
bpm = 124
scale = "Hirajoshi"
kick("x.x.x.x.x.x.x.x.")
snare("....x.......x...")
hat("..x...x...x...x.")
bass("x...x...x...x...")
lead("x~!.....x~!.....")
fx("x.......x.......")`,

  // JUL (6)
  `# 🔥 HEATWAVE (July)
bpm = 126
scale = "Lydian Glitch"
kick("x..x..x.x..x..x.")
snare("....x.......x...")
hat("xxxx" * 4)
bass("x.......x.......")
lead("..x...x...x...x.")
perc("x.x.x.x.x.x.x.x.")`,

  // AUG (7)
  `# 🐕 DOG DAYS (August)
bpm = 100
scale = "Pentatonic Minor"
kick("x.x.x.x.x.x.x.x.")
snare("....x.......x...")
hat("x.x.x.x.x.x.x.x.")
bass("x...~...x...~...")
lead("x.......x.......")
fx("................")`,

  // SEP (8)
  `# 🍂 AUTUMN GOLD (September)
bpm = 115
scale = "Dorian Void"
kick("x...x...x.x...x.")
snare("....x.......x...")
hat("x.x.x.x.x.x.x.x.")
bass("x...x...x...x...")
pluck("....x.......x...")
lead("x.x.x.x.........")`,

  // OCT (9)
  `# 🎃 CYBER SPOOK (October)
bpm = 98
scale = "Pentatonic Minor"
lofi_kick("x..?.x...!...x..")
lofi_snare("....x.......x...")
hat("x?x?x?x?" * 2)
bass("x.~.....x..!....")
pluck("....x?x?....x?x?")
fx("...............!")`,

  // NOV (10)
  `# 🕵️ NOIR NOVEMBER (November)
bpm = 90
scale = "Hirajoshi"
kick("x.......x.......")
snare("....x.......x...")
hat("x...x...x...x...")
bass("x.......x.......")
lead("....x.......x...")
fx("x...............")`,

  // DEC (11)
  `# ❄️ FROST BYTE (December)
bpm = 135
scale = "Dorian Void"
kick("x...x..!.x...x.!")
snare("....x..*....x...")
hat("x!x.x!x." * 2)
lead("x?~?.?x?~?.?x?~?")
bass("x.......x..!....")
pluck("x.x.x.x.x.x.x.x.")`
];

export const HAPPY_BIRTHDAY_CODE = `# 🎂 HAPPY BIRTHDAY!
bpm = 105
scale = "Party Major"

# A festive rhythm
kick("x...x...x...x...")
snare("....x.......x...")
hat("x.x.x.x.x.x.x.x.")
crash("x...............")
clap("....x.......x...")

# Melody Approximation (G G A G C B)
# Using Lead & Pluck to hit scale degrees
# Scale: C D E F G A B (Party Major)
# Indices: 0 1 2 3 4 5 6

# Lead Synth (Main Melody)
lead("......x...x.x.~.")
pluck("..x.....x.......")

# Bassline (Roots)
bass("x.......x.......")

# Sparkles
fx("x...x...x...x...")
`;

export const getSeasonalDemo = (): string => {
  const month = new Date().getMonth(); // 0-11
  return MONTHLY_DEMOS[month] || MONTHLY_DEMOS[0];
};


// --- PROCEDURAL PUZZLE GENERATOR ---

const PUZZLE_INSTRUMENTS = [
  { cmd: 'kick', name: 'Kick Drum' },
  { cmd: 'snare', name: 'Snare Drum' },
  { cmd: 'hat', name: 'Hi-Hat' },
  { cmd: 'bass', name: 'Bassline' },
  { cmd: 'pluck', name: 'Pluck Synth' },
  { cmd: 'lead', name: 'Lead Synth' },
  { cmd: 'clap', name: 'Clap' },
  { cmd: 'perc', name: 'Percussion' },
  { cmd: 'lofi_kick', name: 'Lo-Fi Kick' },
  { cmd: 'lofi_snare', name: 'Lo-Fi Snare' },
];

const PUZZLE_PATTERNS = [
  { pat: 'x...x...x...x...', desc: 'Four on the floor' },
  { pat: '....x.......x...', desc: 'Backbeat Snare' },
  { pat: 'x.x.x.x.x.x.x.x.', desc: '16th notes' },
  { pat: 'x..x..x.x..x..x.', desc: 'Tresillo Rhythm' },
  { pat: 'x...?.x...?.x...', desc: 'Ghost notes groove' },
  { pat: 'x...~...x...~...', desc: 'Sustained notes' },
  { pat: 'x..!x..!x..!x..!', desc: 'Accented offbeats' },
  { pat: '"x." * 8', desc: 'Multiplication Math' },
  { pat: '"x..." * 4', desc: 'Simple Repeater' },
  { pat: '"xx.." * 4', desc: 'Double Hit' },
  { pat: 'x.x...x.x.x...x.', desc: 'Syncopated funk' },
  { pat: '..x...x...x...x.', desc: 'Upbeat skank' },
];

const PUZZLE_DISTRACTORS = [
  '* 2',
  '* 4',
  'snare("....")', 
  'kick("x")',
  'hat("..")',
  '")"',
  '("',
  'x',
  '.',
  '~',
  '!'
];

// Simple pseudo-random number generator based on date seed
const seededRandom = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

export const getDailyPuzzle = (date: Date): DailyPuzzle => {
  // Use local time components to avoid UTC/Timezone shifts causing "wrong date"
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  
  const seedStr = dateStr.replace(/-/g, '');
  const seed = parseInt(seedStr, 10);
  
  let rngState = seed;
  const rand = () => seededRandom(rngState++);
  
  // Pick Scale
  const scaleIndex = Math.floor(rand() * SCALES.length);
  const scale = SCALES[scaleIndex];
  
  // Pick Instrument
  const instIndex = Math.floor(rand() * PUZZLE_INSTRUMENTS.length);
  const inst = PUZZLE_INSTRUMENTS[instIndex];

  // Pick Pattern
  const patIndex = Math.floor(rand() * PUZZLE_PATTERNS.length);
  const pattern = PUZZLE_PATTERNS[patIndex];
  
  // Pick BPM
  const bpm = 80 + Math.floor(rand() * 60); // 80 - 140 BPM

  // Construct Code
  const targetCode = `${inst.cmd}(${pattern.pat.includes('*') ? pattern.pat : `"${pattern.pat}"`})`;
  const hiddenSetup = `bpm = ${bpm}\nscale = "${scale.name}"`;
  
  // Base Tokens for hints
  const tokens = [inst.cmd + '(', pattern.pat.includes('*') ? pattern.pat : `"${pattern.pat}"`, ')'];

  // Add 1 or 2 Distractors
  const numDistractors = 1 + Math.floor(rand() * 2); // 1 or 2
  for(let i = 0; i < numDistractors; i++) {
      const dIndex = Math.floor(rand() * PUZZLE_DISTRACTORS.length);
      // Avoid duplicates if possible
      const d = PUZZLE_DISTRACTORS[dIndex];
      if (!tokens.includes(d)) tokens.push(d);
  }

  // Fisher-Yates Shuffle for tokens
  for (let i = tokens.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [tokens[i], tokens[j]] = [tokens[j], tokens[i]];
  }

  return {
    id: dateStr,
    title: `Daily Puzzle: ${inst.name}`,
    description: `Recreate this ${pattern.desc.toLowerCase()} pattern.`,
    hiddenSetup,
    targetCode,
    starterCode: '',
    tokens
  };
};

export const DAILY_CHALLENGES = [
    { title: "Daily Mission", description: "Check back tomorrow." }
];

export const DAILY_SNIPPETS = [
  {
    title: "Trap Rolls",
    desc: "Fast hi-hat rolls typical of trap music.",
    code: `bpm = 140\nhat("x.x.x.x.x.x.x.x.")\nhat("xxxx" * 4)`
  }
];
