import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';

const phase = process.argv[2] || 'tool';
const statePath = join(homedir(), '.gemini', 'voibecode-state.json');

let payload = {};
try {
  const raw = readFileSync(0, 'utf8');
  if (raw) {
    payload = JSON.parse(raw);
  }
} catch {
  // Ignore empty or malformed stdin
}

function extractSafeWorkspaceName(input) {
  const candidates = [
    typeof input?.cwd === 'string' ? input.cwd : '',
    ...(Array.isArray(input?.workspacePaths) ? input.workspacePaths : []),
  ];
  for (const c of candidates) {
    if (!c || typeof c !== 'string') continue;
    const clean = c.replace(/[\\/]+$/, '');
    const base = basename(clean);
    if (base && base !== '.' && base !== '/') {
      return base.slice(0, 36);
    }
  }
  return '';
}

function classifyToolCategory(toolNameRaw) {
  const name = String(toolNameRaw || '').toLowerCase();
  if (!name) return 'other';
  if (name.includes('command') || name.includes('task') || name.includes('shell')) {
    return 'command';
  }
  if (name.includes('edit') || name.includes('write') || name.includes('create')) {
    return 'edit';
  }
  if (
    name.includes('read') ||
    name.includes('view') ||
    name.includes('grep') ||
    name.includes('find') ||
    name.includes('list')
  ) {
    return 'read';
  }
  if (
    name.includes('subagent') ||
    name.includes('swarm') ||
    name.includes('message') ||
    name.includes('workflow')
  ) {
    return 'subagent';
  }
  return 'other';
}

function formatCategoryLabel(cat) {
  if (cat === 'command') return 'Running command';
  if (cat === 'edit') return 'Editing files';
  if (cat === 'read') return 'Reading context';
  if (cat === 'subagent') return 'Coordinating subagent';
  return 'Working';
}

const now = Date.now();
const currentHour = new Date(now).getHours();

let prev = {};
try {
  prev = JSON.parse(readFileSync(statePath, 'utf8'));
} catch {
  prev = {};
}

const detectedWs = extractSafeWorkspaceName(payload);
const workspaceName = detectedWs || prev.workspaceName || 'VoibeCode';

const workspacesTouched = Array.isArray(prev.workspacesTouched)
  ? [...prev.workspacesTouched]
  : [];
if (workspaceName && !workspacesTouched.includes(workspaceName)) {
  workspacesTouched.unshift(workspaceName);
  if (workspacesTouched.length > 12) workspacesTouched.length = 12;
}

const workspacesMap =
  prev.workspacesMap && typeof prev.workspacesMap === 'object'
    ? { ...prev.workspacesMap }
    : {};

const prevWs = workspacesMap[workspaceName] || {
  name: workspaceName,
  state: 'IDLE',
  startedAt: null,
  lastActivityAt: now,
  lastToolCategory: 'other',
  lastEventLabel: 'Standby',
  toolCalls: 0,
  stalls: 0,
  errors: 0,
  consecutiveErrors: 0,
  flowMs: 0,
};

const hourlyActivity =
  Array.isArray(prev.hourlyActivity) && prev.hourlyActivity.length === 24
    ? [...prev.hourlyActivity]
    : new Array(24).fill(0);

const toolBreakdown = {
  command: Number(prev.toolBreakdown?.command) || 0,
  edit: Number(prev.toolBreakdown?.edit) || 0,
  read: Number(prev.toolBreakdown?.read) || 0,
  subagent: Number(prev.toolBreakdown?.subagent) || 0,
  other: Number(prev.toolBreakdown?.other) || 0,
};

let totalFlowMs = Number(prev.totalFlowMs) || 0;
let invocations = Number(prev.invocations) || 0;
let totalToolCalls = Number(prev.totalToolCalls) || 0;
let stallsCaught = Number(prev.stallsCaught) || 0;
let totalStallMs = Number(prev.totalStallMs) || 0;
let unblockCount = Number(prev.unblockCount) || 0;
let avgUnblockMs = Number(prev.avgUnblockMs) || 0;
let errorCount = Number(prev.errorCount) || 0;
let currentStreak = Number(prev.currentStreak) || 0;
let bestStreak = Number(prev.bestStreak) || 0;
let lastStepDurationMs = Number(prev.lastStepDurationMs) || 0;
let avgStepDurationMs = Number(prev.avgStepDurationMs) || 0;
let longestStepMs = Number(prev.longestStepMs) || 0;
let voiceCalloutsCount = Number(prev.voiceCalloutsCount) || 0;
const recentEvents = Array.isArray(prev.recentEvents)
  ? prev.recentEvents.slice(0, 11)
  : [];

const wsPrevLastActivity = Number(prevWs.lastActivityAt) || Number(prev.lastActivityAt) || now;
const stepElapsed = Math.max(0, now - wsPrevLastActivity);

if (prevWs.state === 'RUNNING' && stepElapsed > 0 && stepElapsed < 300_000) {
  totalFlowMs += stepElapsed;
  prevWs.flowMs = (Number(prevWs.flowMs) || 0) + stepElapsed;
}

const wasStalled =
  prevWs.state === 'STALLED' || (prevWs.state === 'RUNNING' && stepElapsed >= 10_000);
if (wasStalled && phase !== 'pre') {
  if (!prev.stallCountedForCurrentStep) {
    stallsCaught += 1;
    prevWs.stalls = (Number(prevWs.stalls) || 0) + 1;
  }
  const stallOverrun = Math.max(0, stepElapsed - 10_000);
  totalStallMs += stallOverrun;
  unblockCount += 1;
  avgUnblockMs = Math.round(
    (avgUnblockMs * (unblockCount - 1) + stallOverrun) / unblockCount
  );
}

let state = 'IDLE';
let startedAt = prevWs.startedAt || null;
let hadError = false;
let lastToolCategory = prevWs.lastToolCategory || 'other';
let lastEventLabel = prevWs.lastEventLabel || 'Standby';
let consecutiveErrors = Number(prevWs.consecutiveErrors) || 0;

if (phase === 'pre') {
  state = 'RUNNING';
  startedAt = prevWs.state === 'RUNNING' && prevWs.startedAt ? prevWs.startedAt : now;
  invocations += 1;
  voiceCalloutsCount += 1;
  lastEventLabel = 'Starting turn';
  hourlyActivity[currentHour] = (hourlyActivity[currentHour] || 0) + 1;
  recentEvents.unshift({
    ts: now,
    kind: 'START',
    label: 'Turn started',
    workspace: workspaceName,
  });
} else if (phase === 'tool') {
  state = 'RUNNING';
  startedAt = prevWs.startedAt || now;
  totalToolCalls += 1;
  prevWs.toolCalls = (Number(prevWs.toolCalls) || 0) + 1;
  hourlyActivity[currentHour] = (hourlyActivity[currentHour] || 0) + 1;

  const cat = classifyToolCategory(payload?.toolCall?.name);
  lastToolCategory = cat;
  lastEventLabel = formatCategoryLabel(cat);
  toolBreakdown[cat] = (toolBreakdown[cat] || 0) + 1;

  if (stepElapsed > 0 && stepElapsed < 600_000) {
    lastStepDurationMs = stepElapsed;
    avgStepDurationMs = Math.round(
      (avgStepDurationMs * (totalToolCalls - 1) + stepElapsed) / totalToolCalls
    );
    if (stepElapsed > longestStepMs) {
      longestStepMs = stepElapsed;
    }
  }

  hadError = Boolean(payload?.error);
  if (hadError) {
    errorCount += 1;
    prevWs.errors = (Number(prevWs.errors) || 0) + 1;
    consecutiveErrors += 1;
    currentStreak = 0;
    lastEventLabel = consecutiveErrors >= 3 ? `Loop warning (${consecutiveErrors} errors)` : 'Tool error';
  } else if (wasStalled) {
    consecutiveErrors = 0;
    currentStreak = 1;
  } else {
    consecutiveErrors = 0;
    currentStreak += 1;
    if (currentStreak > bestStreak) {
      bestStreak = currentStreak;
    }
  }

  recentEvents.unshift({
    ts: now,
    kind: hadError ? 'ERROR' : 'TOOL',
    label: hadError ? `Error (${cat})` : formatCategoryLabel(cat),
    workspace: workspaceName,
    durationMs: lastStepDurationMs,
  });
} else if (phase === 'stop') {
  const isErr = payload?.terminationReason === 'ERROR' || Boolean(payload?.error);
  state = isErr ? 'ERROR' : 'IDLE';
  startedAt = null;
  hadError = isErr;
  voiceCalloutsCount += 1;
  if (isErr) {
    errorCount += 1;
    prevWs.errors = (Number(prevWs.errors) || 0) + 1;
    consecutiveErrors += 1;
    currentStreak = 0;
    lastEventLabel = 'Stopped with error';
  } else {
    consecutiveErrors = 0;
    lastEventLabel = 'Turn complete';
  }
  recentEvents.unshift({
    ts: now,
    kind: isErr ? 'ERROR' : 'COMPLETE',
    label: isErr ? 'Turn failed' : 'Turn complete',
    workspace: workspaceName,
    durationMs: stepElapsed,
  });
}

workspacesMap[workspaceName] = {
  name: workspaceName,
  state,
  startedAt,
  lastActivityAt: now,
  lastToolCategory,
  lastEventLabel,
  toolCalls: Number(prevWs.toolCalls) || 0,
  stalls: Number(prevWs.stalls) || 0,
  errors: Number(prevWs.errors) || 0,
  consecutiveErrors,
  flowMs: Number(prevWs.flowMs) || 0,
};

// Keep at most 10 most recent workspaces
const sortedEntries = Object.entries(workspacesMap)
  .sort((a, b) => (b[1].lastActivityAt || 0) - (a[1].lastActivityAt || 0))
  .slice(0, 10);
const trimmedMap = Object.fromEntries(sortedEntries);

const nextRecord = {
  workspaceName,
  workspacesTouched,
  workspacesMap: trimmedMap,
  state,
  startedAt,
  lastActivityAt: now,
  sessionStartedAt: prev.sessionStartedAt || now,
  totalFlowMs,
  invocations,
  totalToolCalls,
  toolBreakdown,
  stallsCaught,
  totalStallMs,
  unblockCount,
  avgUnblockMs,
  errorCount,
  currentStreak,
  bestStreak,
  lastStepDurationMs,
  avgStepDurationMs,
  longestStepMs,
  voiceCalloutsCount,
  hourlyActivity,
  recentEvents: recentEvents.slice(0, 12),
  stallCountedForCurrentStep: false,
  hadError,
  updatedAt: now,
};

try {
  mkdirSync(dirname(statePath), { recursive: true });
  const tmp = `${statePath}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(nextRecord), 'utf8');
  renameSync(tmp, statePath);
} catch {
  // Never block agent execution on local state write error
}

process.stdout.write('{}\n');
