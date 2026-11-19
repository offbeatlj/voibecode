import { FLAGSHIP_HEX, isValidHex, normalizeHex } from '@voibecode/shared';

export const STUDIO_TOTAL_STEPS = 16;

export type StudioInstrument =
  | 'kick'
  | 'lofi_kick'
  | 'snare'
  | 'lofi_snare'
  | 'hat'
  | 'openhat'
  | 'clap'
  | 'rim'
  | 'tom'
  | 'crash'
  | 'ride'
  | 'bass'
  | 'rhodes'
  | 'pad'
  | 'chime'
  | 'pluck'
  | 'lead'
  | 'fx';

export interface StudioScale {
  name: string;
  frequencies: number[];
  skyHex: string;
}

export interface StudioTrack {
  id: string;
  name: string;
  instrument: StudioInstrument;
  steps: number[]; // 0 = rest, 1 = hit, 1.25 = accent (!), 0.45 = ghost (?), -1 = sustain (~)
  rawPattern: string;
  lineIndex: number;
}

export interface StudioCompileResult {
  tracks: StudioTrack[];
  bpm: number;
  swing: number;
  reverb: number;
  delay: number;
  filter: number;
  drone: boolean;
  scale: StudioScale;
  skyHex: string;
  logs: string[];
}

export const STUDIO_SCALES: StudioScale[] = [
  {
    name: 'Coding Down Under',
    frequencies: [220.0, 277.18, 329.63, 415.3, 493.88, 554.37], // A maj9
    skyHex: FLAGSHIP_HEX,
  },
  {
    name: 'Southern Cross',
    frequencies: [220.0, 261.63, 329.63, 392.0, 493.88, 659.25], // A min9 open
    skyHex: '#8C82B8',
  },
  {
    name: 'Bondi Horizon',
    frequencies: [196.0, 246.94, 293.66, 369.99, 440.0, 587.33], // G maj9
    skyHex: '#5BA8B8',
  },
  {
    name: 'Nullarbor',
    frequencies: [174.61, 220.0, 261.63, 329.63, 392.0, 523.25], // F maj9
    skyHex: '#74A88E',
  },
  {
    name: 'Pentatonic Minor',
    frequencies: [293.66, 349.23, 392.0, 440.0, 523.25, 587.33],
    skyHex: '#A074B8',
  },
  {
    name: 'Cyber Major',
    frequencies: [261.63, 329.63, 392.0, 493.88, 587.33, 659.25],
    skyHex: '#6E85A3',
  },
  {
    name: 'Dorian Void',
    frequencies: [293.66, 349.23, 440.0, 493.88, 587.33, 698.46],
    skyHex: '#637FB8',
  },
  {
    name: 'Hirajoshi',
    frequencies: [329.63, 349.23, 415.3, 493.88, 523.25, 659.25],
    skyHex: '#E07A5F',
  },
  {
    name: 'Party Major',
    frequencies: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25],
    skyHex: '#D8A657',
  },
];

const INSTRUMENT_ALIASES: Record<string, StudioInstrument> = {
  kick: 'kick',
  bd: 'kick',
  lofi_kick: 'lofi_kick',
  lk: 'lofi_kick',
  snare: 'snare',
  sd: 'snare',
  lofi_snare: 'lofi_snare',
  ls: 'lofi_snare',
  hat: 'hat',
  hh: 'hat',
  hihat: 'hat',
  openhat: 'openhat',
  oh: 'openhat',
  clap: 'clap',
  cp: 'clap',
  rim: 'rim',
  perc: 'rim',
  tom: 'tom',
  crash: 'crash',
  ride: 'ride',
  bass: 'bass',
  sub: 'bass',
  rhodes: 'rhodes',
  ep: 'rhodes',
  keys: 'rhodes',
  pad: 'pad',
  chime: 'chime',
  stall: 'chime',
  ping: 'chime',
  pluck: 'pluck',
  arp: 'pluck',
  lead: 'lead',
  synth: 'lead',
  fx: 'fx',
};

export interface StudioPreset {
  id: string;
  label: string;
  code: string;
}

export const STUDIO_PRESETS: StudioPreset[] = [
  {
    id: 'coding-down-under',
    label: '01 // CODING DOWN UNDER',
    code: `# VOIBECODE // CODING DOWN UNDER
bpm = 96
swing = 0.08
reverb = 0.56
delay = 0.28
drone = on
scale = "Coding Down Under"

lofi_kick("x..?.x....x..?..")
lofi_snare("....x.......x...")
hat("x.?.x.?.x.?.x.?!")
bass("x.~.....x..~....")
rhodes("x...~...?.~.....")
pad("x.......~.......")
chime("......x.......?..")`,
  },
  {
    id: 'stall-chime',
    label: '02 // STALL CHIME AMBIENT',
    code: `# VOIBECODE // 528->792HZ WAIT-STATE
bpm = 84
reverb = 0.75
delay = 0.42
drone = on
scale = "Southern Cross"

pad("x.......~.......")
rhodes("..x.....x...~...")
chime("x...........?...")
rim("....?.......?...")
bass("x.......~.......")`,
  },
  {
    id: 'bondi-horizon',
    label: '03 // BONDI HORIZON',
    code: `# VOIBECODE // HORIZON PULSE
bpm = 112
swing = 0.05
reverb = 0.44
delay = 0.24
drone = off
scale = "Bondi Horizon"

kick("x...x...x...x...")
snare("....x.......x...")
hat("x.x!" * 4)
openhat("..x...x...x...x.")
bass("x..x..x.x..x....")
pluck("x.x.?.x.x.x.!...")
chime("........x.......")`,
  },
  {
    id: 'nullarbor-minimal',
    label: '04 // BLANK SKETCH',
    code: `# MINIMAL TWILIGHT SKETCH
bpm = 92
reverb = 0.50
drone = on
scale = "Nullarbor"

kick("x.......x.......")
hat("x...x...x...x...")
chime("....x.......?...")
pad("x...............~")`,
  },
];

const HAPPY_BIRTHDAY_LEGACY = `# HAPPY BIRTHDAY EASTER EGG
bpm = 105
reverb = 0.45
scale = "Party Major"
kick("x...x...x...x...")
snare("....x.......x...")
hat("x.x.x.x.x.x.x.x.")
rhodes("..x.....x.......")
lead("......x...x.x.~.")
bass("x.......x.......")
chime("x...x...x...x...")`;

export function parseSteps(pattern: string): number[] {
  const steps = new Array<number>(STUDIO_TOTAL_STEPS).fill(0);
  const clipped = pattern.slice(0, STUDIO_TOTAL_STEPS);
  for (let i = 0; i < clipped.length; i++) {
    const ch = clipped[i].toLowerCase();
    if (ch === 'x' || ch === '1') steps[i] = 1;
    else if (ch === '!') steps[i] = 1.25;
    else if (ch === '?') steps[i] = 0.45;
    else if (ch === '~' || ch === '-') steps[i] = -1;
    else steps[i] = 0;
  }
  return steps;
}

export function stepsToPattern(steps: number[]): string {
  return steps
    .slice(0, STUDIO_TOTAL_STEPS)
    .map((val) => {
      if (val < 0) return '~';
      if (val >= 1.2) return '!';
      if (val >= 0.8) return 'x';
      if (val > 0) return '?';
      return '.';
    })
    .join('');
}

export function compileStudioCode(source: string): StudioCompileResult {
  if (source.toLowerCase().includes("it's my birthday!")) {
    return compileStudioCode(HAPPY_BIRTHDAY_LEGACY);
  }

  let bpm = 96;
  let swing = 0.06;
  let reverb = 0.5;
  let delay = 0.25;
  let filter = 0;
  let drone = false;
  let scale = STUDIO_SCALES[0];
  let explicitSkyHex: string | null = null;

  const variables: Record<string, string | number> = {};
  const tracks: StudioTrack[] = [];
  const logs: string[] = [];

  const resolveExpr = (raw: string): string | number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    const mulIdx = trimmed.indexOf('*');
    if (mulIdx !== -1) {
      const left = resolveExpr(trimmed.slice(0, mulIdx));
      const right = resolveExpr(trimmed.slice(mulIdx + 1));
      if (typeof left === 'string' && typeof right === 'number') {
        return left.repeat(Math.max(0, Math.min(16, Math.floor(right))));
      }
      if (typeof right === 'string' && typeof left === 'number') {
        return right.repeat(Math.max(0, Math.min(16, Math.floor(left))));
      }
    }

    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }

    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    if (Object.prototype.hasOwnProperty.call(variables, trimmed)) {
      return variables[trimmed];
    }

    return null;
  };

  const lines = source.split(/\r?\n/);

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) return;

    // Key = Value assignments
    if (line.includes('=') && !line.includes('(')) {
      const eqIdx = line.indexOf('=');
      const key = line.slice(0, eqIdx).trim().toLowerCase();
      const valRaw = line.slice(eqIdx + 1).trim();

      if (key === 'drone') {
        const clean = valRaw.replace(/['"]/g, '').toLowerCase();
        drone = clean === 'on' || clean === 'true' || clean === '1' || clean === 'synth';
        return;
      }

      const resolved = resolveExpr(valRaw);
      if (resolved === null) {
        logs.push(`L${lineIndex + 1}: UNRESOLVED '${valRaw}'`);
        return;
      }

      if (key === 'bpm' && typeof resolved === 'number') {
        bpm = Math.min(240, Math.max(30, resolved));
      } else if (key === 'swing' && typeof resolved === 'number') {
        // Support both 0..0.45 and legacy percentage 0..45
        swing = resolved > 1 ? Math.min(0.45, resolved / 100) : Math.min(0.45, Math.max(0, resolved));
      } else if (key === 'reverb' && typeof resolved === 'number') {
        reverb = Math.min(1, Math.max(0, resolved > 1 ? resolved / 100 : resolved));
      } else if (key === 'delay' && typeof resolved === 'number') {
        delay = Math.min(1, Math.max(0, resolved > 1 ? resolved / 100 : resolved));
      } else if (key === 'filter' && typeof resolved === 'number') {
        filter = Math.min(100, Math.max(-100, resolved));
      } else if ((key === 'scale' || key === 'key') && typeof resolved === 'string') {
        const match = STUDIO_SCALES.find(
          (s) => s.name.toLowerCase() === resolved.toLowerCase()
        );
        if (match) scale = match;
        else logs.push(`L${lineIndex + 1}: UNKNOWN SCALE '${resolved}'`);
      } else if (key === 'sky' && typeof resolved === 'string') {
        if (isValidHex(resolved)) explicitSkyHex = normalizeHex(resolved);
        else logs.push(`L${lineIndex + 1}: INVALID HEX '${resolved}'`);
      } else {
        variables[key] = resolved;
      }
      return;
    }

    // Function call: instrument("pattern")
    const callMatch = line.match(/^([a-zA-Z0-9_]+)\((.*)\)$/);
    if (!callMatch) return;

    const fnName = callMatch[1].toLowerCase();
    const argExpr = callMatch[2].trim();
    const instrument = INSTRUMENT_ALIASES[fnName];
    if (!instrument) {
      logs.push(`L${lineIndex + 1}: UNKNOWN VOICE '${fnName}'`);
      return;
    }

    const patternVal = resolveExpr(argExpr);
    if (typeof patternVal !== 'string') {
      logs.push(`L${lineIndex + 1}: ${fnName}() EXPECTS PATTERN STRING`);
      return;
    }

    const steps = parseSteps(patternVal);
    const existingIdx = tracks.findIndex((t) => t.name === fnName);
    const nextTrack: StudioTrack = {
      id: `${fnName}-${lineIndex}`,
      name: fnName,
      instrument,
      steps,
      rawPattern: stepsToPattern(steps),
      lineIndex,
    };

    if (existingIdx !== -1) {
      tracks[existingIdx] = nextTrack;
    } else {
      tracks.push(nextTrack);
    }
  });

  return {
    tracks,
    bpm,
    swing,
    reverb,
    delay,
    filter,
    drone,
    scale,
    skyHex: explicitSkyHex ?? scale.skyHex,
    logs,
  };
}
