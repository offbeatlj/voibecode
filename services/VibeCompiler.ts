
import { INITIAL_TRACKS, TOTAL_STEPS, SCALES, HAPPY_BIRTHDAY_CODE } from '../constants';
import { Track, InstrumentType } from '../types';

export interface CompileResult {
  tracks: Track[];
  bpm: number | null;
  swing: number | null;
  filter: number | null;
  scaleName: string | null;
  logs: string[];
  error: string | null;
}

export const compileCode = (code: string): CompileResult => {
  // EASTER EGG CHECK
  if (code.toLowerCase().includes("it's my birthday!")) {
      // If the magic string is found, compile the birthday song instead
      return compileCode(HAPPY_BIRTHDAY_CODE);
  }

  const lines = code.split('\n');
  const tracksMap = new Map<string, number[]>();
  const trackTypesMap = new Map<string, InstrumentType>();
  
  // Global State Defaults (preserved if not set)
  let bpm: number | null = null;
  let swing: number | null = null;
  let filter: number | null = null;
  let scaleName: string | null = null;
  
  const logs: string[] = [];
  let error: string | null = null;

  // Symbol Table for Variables
  const variables: Record<string, any> = {};
  
  const instrumentAliases: Record<string, InstrumentType> = {
    'kick': InstrumentType.KICK, 'bd': InstrumentType.KICK,
    'snare': InstrumentType.SNARE, 'sd': InstrumentType.SNARE,
    'hat': InstrumentType.HIHAT, 'hh': InstrumentType.HIHAT, 'hihat': InstrumentType.HIHAT,
    'bass': InstrumentType.BASS,
    'lead': InstrumentType.SYNTH_LEAD, 'synth': InstrumentType.SYNTH_LEAD,
    // New
    'tom': InstrumentType.TOM,
    'clap': InstrumentType.CLAP,
    'crash': InstrumentType.CRASH,
    'ride': InstrumentType.RIDE,
    'perc': InstrumentType.PERC,
    'openhat': InstrumentType.OPENHAT, 'oh': InstrumentType.OPENHAT,
    'lofi_kick': InstrumentType.LOFI_KICK, 'lk': InstrumentType.LOFI_KICK,
    'lofi_snare': InstrumentType.LOFI_SNARE, 'ls': InstrumentType.LOFI_SNARE,
    'pluck': InstrumentType.PLUCK,
    'fx': InstrumentType.FX
  };

  logs.push(`> Compiling...`);

  const resolveValue = (val: string): any => {
      val = val.trim();
      if (val.includes('*')) {
          const parts = val.split('*');
          if (parts.length === 2) {
              const left = resolveValue(parts[0]);
              const right = resolveValue(parts[1]);
              if (typeof left === 'string' && typeof right === 'number') return left.repeat(right);
              if (typeof left === 'number' && typeof right === 'string') return right.repeat(left);
          }
      }
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          return val.slice(1, -1);
      }
      if (!isNaN(parseFloat(val))) return parseFloat(val);
      if (variables.hasOwnProperty(val)) return variables[val];
      return null;
  };

  // Parse Loop
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return; 

    try {
        if (trimmed.includes('=') && !trimmed.includes('(')) {
            const [keyRaw, valRaw] = trimmed.split('=', 2);
            const key = keyRaw.trim();
            const value = resolveValue(valRaw);

            if (value === null && valRaw) {
                 logs.push(`Line ${index + 1}: Error - Undefined variable '${valRaw.trim()}'`);
                 return;
            }

            if (key === 'bpm') {
                if (typeof value === 'number' && value >= 30 && value <= 300) {
                    bpm = value;
                } else logs.push(`Line ${index + 1}: Invalid BPM.`);
            } else if (key === 'swing') {
                swing = typeof value === 'number' ? value : 0;
            } else if (key === 'filter') {
                filter = typeof value === 'number' ? value : 0;
            } else if (key === 'scale' || key === 'key') {
                const sName = String(value);
                const match = SCALES.find(s => s.name.toLowerCase() === sName.toLowerCase());
                if (match) {
                    scaleName = match.name;
                    logs.push(`> Scale detected: ${scaleName}`);
                }
                else logs.push(`Line ${index + 1}: Scale '${sName}' not found.`);
            } else {
                variables[key] = value;
            }
            return;
        }

        const funcMatch = trimmed.match(/^([a-zA-Z0-9_]+)\((.*)\)$/);
        
        if (funcMatch) {
            const funcName = funcMatch[1].toLowerCase();
            const argsContent = funcMatch[2];
            
            if (instrumentAliases[funcName]) {
                const pattern = resolveValue(argsContent);
                const type = instrumentAliases[funcName];
                const trackId = `track_${funcName}`; 
                
                if (typeof pattern === 'string') {
                    const steps = Array(TOTAL_STEPS).fill(0);
                    const cleanPattern = pattern.substring(0, TOTAL_STEPS);
                    for (let i = 0; i < cleanPattern.length; i++) {
                        const char = cleanPattern[i].toLowerCase();
                        // PARSE VELOCITY / DYNAMICS
                        if (char === 'x' || char === '1') steps[i] = 1;       // Normal
                        else if (char === '!') steps[i] = 1.2;                // Accent
                        else if (char === '?') steps[i] = 0.5;                // Ghost (Changed from *)
                        else if (char === '~' || char === '-') steps[i] = -1; // Sustain (Hold)
                        else steps[i] = 0;                                    // Silence
                    }
                    tracksMap.set(trackId, steps);
                    trackTypesMap.set(trackId, type);
                } else {
                    logs.push(`Line ${index + 1}: ${funcName}() expects a pattern string.`);
                }
                return;
            }
        }
        // Only log unknown commands if they look like function calls to avoid spamming on partial types
        if (trimmed.includes('(')) {
             logs.push(`Line ${index + 1}: Unknown command '${trimmed.split('(')[0]}'.`);
        }
    } catch (e) {
        logs.push(`Line ${index + 1}: Parser Error.`);
    }
  });

  // Construct Result Tracks
  const compiledTracks: Track[] = [];
  tracksMap.forEach((steps, id) => {
      compiledTracks.push({
          id: id,
          name: id.replace('track_', ''),
          type: trackTypesMap.get(id) || InstrumentType.KICK,
          color: 'bg-cyan-500', // Dynamic colors could be added
          steps: steps,
          volume: 0.7,
          muted: false,
          soloed: false
      });
  });

  // REMOVED FALLBACK: If compiledTracks is empty, return empty. 
  // This ensures if the user deletes code, the sound stops.
  return {
      tracks: compiledTracks,
      bpm,
      swing,
      filter,
      scaleName,
      logs,
      error
  };
};
