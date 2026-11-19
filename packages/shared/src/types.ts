export type WatcherState =
  | 'IDLE'
  | 'RUNNING'
  | 'STALLED'
  | 'ERROR'
  | 'COMPLETE'
  | 'SCREENSAVER';

export type AudioMode = 'OFF' | 'SYNTH';

export interface AudioStemMix {
  synth: number;  // 0..1 chords, rhodes, pads, bells, sub-bass
  beats: number;  // 0..1 kick, snare, brushed hats
  rain: number;   // 0..1 procedural stereo rain acoustics
  drone: number;  // 0..1 warm 180Hz brown noise + vinyl warmth + fifth drone
  voice: number;  // 0..1 Australian woman voice callout level
  warmth: number; // 0..1 master filter openness (0 = deep warm 420Hz, 1 = open 16.5kHz)
}

export type QuoteChannel = 'pure' | 'systems' | 'legends';

export type SwatchTier = 'flagship' | 'personal' | 'full' | 'patron' | 'maker';

export type PurchaseTier =
  | 'personal'
  | 'full'
  | 'patron'
  | 'pro_lifetime'
  | 'pro_monthly'
  | 'team';

export interface VoibePlanSpec {
  tier: 'pro_lifetime' | 'pro_monthly' | 'team';
  name: string;
  priceCents: number;
  interval: 'one_time' | 'month';
  badge?: string;
  description: string;
}

export const VOIBE_PLANS: readonly VoibePlanSpec[] = [
  {
    tier: 'pro_lifetime',
    name: 'VoibeCode Pro (Early Founder Lifetime)',
    priceCents: 3900,
    interval: 'one_time',
    badge: 'EARLY FOUNDER',
    description:
      'Unlimited Away Alerts (ntfy phone, Slack, Discord), runaway error-loop guardrails, all 4 studio soundscapes, and lifetime updates.',
  },
  {
    tier: 'pro_monthly',
    name: 'VoibeCode Pro (Monthly)',
    priceCents: 900,
    interval: 'month',
    description:
      'Unlimited Away Alerts (ntfy phone, Slack, Discord), runaway error-loop guardrails, and all 4 studio soundscapes.',
  },
  {
    tier: 'team',
    name: 'VoibeCode Team (Per Seat)',
    priceCents: 1900,
    interval: 'month',
    description:
      'Org-wide AI velocity & stall analytics, automated Slack daily ship digests, and zero-source-code compliance posture.',
  },
] as const;

export type VoibeCartridgeId =
  | 'coding-down-under'
  | 'tape-field'
  | 'eno-airport'
  | 'tokyo-rain';

export interface VoibeCartridgeSpec {
  id: VoibeCartridgeId;
  code: string;
  name: string;
  subtitle: string;
  tier: 'free' | 'pro';
  skyHex: string;
  bpm: number;
}

export type VoiceCalloutKind =
  | 'start'
  | 'working'
  | 'stall'
  | 'complete'
  | 'error'
  | 'cartridge';

export interface TelemetryEventRecord {
  ts: number;
  kind: 'START' | 'TOOL' | 'STALL' | 'COMPLETE' | 'ERROR';
  label: string;
  workspace: string;
  durationMs?: number;
}

export interface WorkspaceAgentStatus {
  name: string;
  state: WatcherState;
  startedAt: number | null;
  lastActivityAt: number;
  elapsedMs: number;
  lastToolCategory: 'command' | 'edit' | 'read' | 'subagent' | 'other';
  lastEventLabel: string;
  toolCalls: number;
  stalls: number;
  errors: number;
  consecutiveErrors: number;
  loopWarning: boolean;
  flowMs: number;
}

export type AlertChannel = 'ntfy' | 'slack' | 'discord' | 'webhook';

export interface AwayAlertConfig {
  awayMode: boolean;
  channel: AlertChannel;
  ntfyTopic: string;
  webhookUrl: string;
  notifyOnStall: boolean;
  notifyOnComplete: boolean;
  notifyOnLoop: boolean;
  stallThresholdSec: number;
  lastAlertSentAt?: number;
  lastAlertSummary?: string;
}

/**
 * Strictly metadata-only local developer & agent flow statistics.
 * Never stores source code, prompts, file paths, command arguments, or terminal text.
 */
export interface VoibeTelemetryStats {
  workspaceName: string;
  workspacesTouched: string[];
  workspaces?: WorkspaceAgentStatus[];
  state: WatcherState;
  startedAt: number | null;
  lastActivityAt: number;
  sessionStartedAt: number;
  totalFlowMs: number;
  invocations: number;
  totalToolCalls: number;
  toolBreakdown: {
    command: number;
    edit: number;
    read: number;
    subagent: number;
    other: number;
  };
  stallsCaught: number;
  totalStallMs: number;
  unblockCount: number;
  avgUnblockMs: number;
  errorCount: number;
  currentStreak: number;
  bestStreak: number;
  lastStepDurationMs: number;
  avgStepDurationMs: number;
  longestStepMs: number;
  voiceCalloutsCount: number;
  hourlyActivity: number[]; // 24 buckets (0..23 local hour)
  recentEvents: TelemetryEventRecord[];
  updatedAt: number;
}

export type RGBVec3 = [number, number, number];

export interface OKLCHColor {
  l: number;
  c: number;
  h: number;
}

export interface SkyPalette {
  anchorHex: string;
  clampedLitHex: string;
  midHex: string;
  zenithHex: string;
  lit: RGBVec3;
  mid: RGBVec3;
  zenith: RGBVec3;
  oklch: OKLCHColor;
}

export interface MatrixCell {
  index: number;
  row: number;
  col: number;
  hex: string;
  oklch: OKLCHColor;
  isCentral: boolean;
}

export interface QuoteItem {
  id: string;
  channel: 'systems' | 'legends';
  text: string;
  author: string;
}

export interface SwatchEntry {
  hex: string;
  row: number;
  col: number;
  tier: 'maker' | 'patron';
  reclaimable: boolean;
  brand: string;
  tagline: string;
  url: string;
  claimedAt?: string;
}

export interface VoibeManifest {
  version: string;
  updatedAt: string;
  flagshipHex: string;
  swatches: SwatchEntry[];
  quotes: {
    systems: QuoteItem[];
    legends: QuoteItem[];
  };
}

export interface LicenseRecord {
  valid: boolean;
  key: string;
  tier: PurchaseTier;
  swatch_hex?: string;
  unlocked_all: boolean;
  fourthwall_promo?: string;
  created_at?: string;
}

export interface ExtensionRuntimeConfig {
  enabled: boolean;
  stallThresholdSeconds: number;
  idleTimeoutSeconds: number;
  allowStallChimeWhenMuted: boolean;
  shufflePatronSkies: boolean;
  showPatronCredits: boolean;
}

export interface LicenseClientState {
  licenseKey?: string;
  tier?: PurchaseTier;
  unlockedHexes: string[];
  fullDropper: boolean;
  fourthwallPromo?: string;
}

export type ExtensionToWebviewMessage =
  | {
      type: 'STATE_CHANGE';
      state: WatcherState;
      exitCode?: number;
      startedAt?: number;
      workspaceName?: string;
      stats?: VoibeTelemetryStats;
    }
  | {
      type: 'MANIFEST';
      manifest: VoibeManifest;
    }
  | {
      type: 'CONFIG';
      config: ExtensionRuntimeConfig;
    }
  | {
      type: 'LICENSE';
      license: LicenseClientState;
    }
  | {
      type: 'SELECT_SWATCH';
      hex: string;
    };

export type WebviewToExtensionMessage =
  | { type: 'READY' }
  | { type: 'DISMISS'; trigger?: string }
  | { type: 'AUDIO_FADED' }
  | { type: 'TOGGLE_AUDIO'; mode: AudioMode }
  | { type: 'SET_CHANNEL'; channel: QuoteChannel }
  | { type: 'SELECT_SWATCH'; hex: string }
  | { type: 'PROMPT_LICENSE' }
  | { type: 'OPEN_URL'; url: string };

export const FLAGSHIP_HEX = '#FF7B6B';
export const VOIBECODE_ORIGIN = 'https://voibecode.com';
export const FOURTHWALL_STORE_URL = 'https://voibecode-shop.fourthwall.com/';

export const VOIBE_CARTRIDGES: VoibeCartridgeSpec[] = [
  {
    id: 'coding-down-under',
    code: '01',
    name: 'CODING DOWN UNDER',
    subtitle: 'Australian Twilight Maj9 Rhodes · Sub Horizon · 94 BPM',
    tier: 'free',
    skyHex: '#FF7B6B',
    bpm: 94,
  },
  {
    id: 'tape-field',
    code: '02',
    name: 'TAPE FIELD OP-1',
    subtitle: '4-Track Cassette Flutter · Spring Echo · 88 BPM',
    tier: 'pro',
    skyHex: '#D8A657',
    bpm: 88,
  },
  {
    id: 'eno-airport',
    code: '03',
    name: 'ENO AIRPORT 1978',
    subtitle: 'Async Polyrhythmic Piano Loops · Shimmer Pad · 72 BPM',
    tier: 'pro',
    skyHex: '#8C82B8',
    bpm: 72,
  },
  {
    id: 'tokyo-rain',
    code: '04',
    name: 'TOKYO RAIN 2AM',
    subtitle: 'Procedural Rain Acoustics · 12-Bit Lo-Fi Pulse · 102 BPM',
    tier: 'pro',
    skyHex: '#5BA8B8',
    bpm: 102,
  },
];

export function createEmptyTelemetryStats(
  workspaceName = 'VoibeCode'
): VoibeTelemetryStats {
  const now = Date.now();
  return {
    workspaceName,
    workspacesTouched: [workspaceName],
    state: 'IDLE',
    startedAt: null,
    lastActivityAt: now,
    sessionStartedAt: now,
    totalFlowMs: 0,
    invocations: 0,
    totalToolCalls: 0,
    toolBreakdown: {
      command: 0,
      edit: 0,
      read: 0,
      subagent: 0,
      other: 0,
    },
    stallsCaught: 0,
    totalStallMs: 0,
    unblockCount: 0,
    avgUnblockMs: 0,
    errorCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastStepDurationMs: 0,
    avgStepDurationMs: 0,
    longestStepMs: 0,
    voiceCalloutsCount: 0,
    hourlyActivity: new Array<number>(24).fill(0),
    recentEvents: [],
    updatedAt: now,
  };
}

export const DEFAULT_SYSTEMS_MAXIMS: QuoteItem[] = [
  {
    id: 'sys-01',
    channel: 'systems',
    text: 'Make each program do one thing well.',
    author: 'Doug McIlroy',
  },
  {
    id: 'sys-02',
    channel: 'systems',
    text: 'Simplicity is prerequisite for reliability.',
    author: 'Edsger W. Dijkstra',
  },
  {
    id: 'sys-03',
    channel: 'systems',
    text: 'Premature optimization is the root of all evil.',
    author: 'Donald Knuth',
  },
  {
    id: 'sys-04',
    channel: 'systems',
    text: 'Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.',
    author: 'Antoine de Saint-Exupery',
  },
  {
    id: 'sys-05',
    channel: 'systems',
    text: 'Controlling complexity is the essence of computer programming.',
    author: 'Brian Kernighan',
  },
  {
    id: 'sys-06',
    channel: 'systems',
    text: 'Data dominates. Choose the right structures and the algorithms become self-evident.',
    author: 'Rob Pike',
  },
  {
    id: 'sys-07',
    channel: 'systems',
    text: 'A complex system that works invariably evolved from a simple system that worked.',
    author: 'John Gall',
  },
  {
    id: 'sys-08',
    channel: 'systems',
    text: 'Fools ignore complexity. Pragmatists suffer it. Geniuses remove it.',
    author: 'Alan Perlis',
  },
  {
    id: 'sys-09',
    channel: 'systems',
    text: 'Before software can be reusable it first has to be usable.',
    author: 'Ralph Johnson',
  },
  {
    id: 'sys-10',
    channel: 'systems',
    text: 'Programs must be written for people to read, and only incidentally for machines to execute.',
    author: 'Harold Abelson',
  },
  {
    id: 'sys-11',
    channel: 'systems',
    text: 'Clear is better than clever. Clear latency beats opaque throughput.',
    author: 'Go Proverbs',
  },
  {
    id: 'sys-12',
    channel: 'systems',
    text: 'Good engineering removes steps between intent and verification.',
    author: 'VoibeCode Notes',
  },
];

export const DEFAULT_TECH_LEGENDS: QuoteItem[] = [
  {
    id: 'leg-01',
    channel: 'legends',
    text: "The most damaging phrase in the language is: We've always done it this way.",
    author: 'Grace Hopper',
  },
  {
    id: 'leg-02',
    channel: 'legends',
    text: 'The best way to predict the future is to invent it.',
    author: 'Alan Kay',
  },
  {
    id: 'leg-03',
    channel: 'legends',
    text: 'One of my most productive days was throwing away 1,000 lines of code.',
    author: 'Ken Thompson',
  },
  {
    id: 'leg-04',
    channel: 'legends',
    text: 'Talk is cheap. Show me the code.',
    author: 'Linus Torvalds',
  },
  {
    id: 'leg-05',
    channel: 'legends',
    text: 'Debugging is twice as hard as writing the code in the first place.',
    author: 'Brian Kernighan',
  },
  {
    id: 'leg-06',
    channel: 'legends',
    text: 'Simplicity is about subtracting the obvious and adding the meaningful.',
    author: 'John Maeda',
  },
  {
    id: 'leg-07',
    channel: 'legends',
    text: 'The function of good software is to make the complex appear to be simple.',
    author: 'Grady Booch',
  },
  {
    id: 'leg-08',
    channel: 'legends',
    text: 'Clean code always looks like it was written by someone who cares.',
    author: 'Robert C. Martin',
  },
  {
    id: 'leg-09',
    channel: 'legends',
    text: 'There are only two hard things in Computer Science: cache invalidation and naming things.',
    author: 'Phil Karlton',
  },
  {
    id: 'leg-10',
    channel: 'legends',
    text: 'What I cannot create, I do not understand.',
    author: 'Richard Feynman',
  },
  {
    id: 'leg-11',
    channel: 'legends',
    text: 'An interface should be an instrument you feel rather than a dashboard you decode.',
    author: 'Bret Victor',
  },
  {
    id: 'leg-12',
    channel: 'legends',
    text: 'Measure twice, ship once, observe continuously.',
    author: 'Systems Folklore',
  },
];

export interface MakerSeedSpec {
  hex: string;
  brand: string;
  tagline: string;
  url: string;
}

export const DAY_ONE_MAKER_SEEDS: MakerSeedSpec[] = [
  {
    hex: '#5BA8B8',
    brand: 'LOOMSTATION',
    tagline: 'Real-time Polymarket orderbook terminal',
    url: 'https://loomstation.com',
  },
  {
    hex: '#74A88E',
    brand: 'HARADA DREAM SHEET',
    tagline: '64-cell digital goal execution grid',
    url: 'https://haradadreamsheet.com',
  },
  {
    hex: '#8C82B8',
    brand: 'JEST INFINITE',
    tagline: 'Literary & algorithmic web experiments',
    url: 'https://jestinfinite.com',
  },
  {
    hex: '#6E85A3',
    brand: 'LEVI HIGGS',
    tagline: 'Builder log, data viz & software tools',
    url: 'https://levihiggs.com',
  },
];
