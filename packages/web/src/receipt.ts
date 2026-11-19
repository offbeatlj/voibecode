import { VoibeTelemetryStats } from '@voibecode/shared';

export function formatFlowDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  }
  if (mins > 0) {
    return `${mins}m ${String(secs).padStart(2, '0')}s`;
  }
  return `${secs}s`;
}

export function formatShipLogText(stats: VoibeTelemetryStats): string {
  const totalOps = Math.max(1, stats.totalToolCalls);
  const greenPct = Math.max(
    0,
    Math.min(100, ((totalOps - stats.errorCount) / totalOps) * 100)
  ).toFixed(0);
  const wsList = (stats.workspacesTouched || [stats.workspaceName]).slice(0, 4).join(', ');
  return [
    `VoibeCode · AI Engineering Receipt (${new Date().toISOString().slice(0, 10)})`,
    `Flow Time: ${formatFlowDuration(stats.totalFlowMs)} · ${stats.totalToolCalls} agent steps across ${wsList}`,
    `Reliability: ${greenPct}% green · ${stats.stallsCaught} stalls rescued · Best streak: ${stats.bestStreak} steps`,
    `Monitored locally via voibecode.com`,
  ].join('\n');
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function renderSessionReceipt(
  canvas: HTMLCanvasElement,
  stats: VoibeTelemetryStats
): void {
  const W = 1200;
  const H = 675;
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Deep Obsidian Base + Subtle Living Twilight Horizon
  const baseGrad = ctx.createLinearGradient(0, 0, W, H);
  baseGrad.addColorStop(0, '#090B10');
  baseGrad.addColorStop(0.55, '#0D111A');
  baseGrad.addColorStop(1, '#12151E');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, W, H);

  // Warm understated twilight horizon aura bottom-right
  const warmGlow = ctx.createRadialGradient(W * 0.85, H * 1.05, 30, W * 0.85, H * 1.05, 580);
  warmGlow.addColorStop(0, 'rgba(255, 123, 107, 0.24)');
  warmGlow.addColorStop(0.45, 'rgba(255, 123, 107, 0.07)');
  warmGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = warmGlow;
  ctx.fillRect(0, 0, W, H);

  // Subtle cool emerald zenith bloom top-left
  const coolGlow = ctx.createRadialGradient(W * 0.14, H * 0.08, 10, W * 0.14, H * 0.08, 460);
  coolGlow.addColorStop(0, 'rgba(74, 222, 168, 0.09)');
  coolGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = coolGlow;
  ctx.fillRect(0, 0, W, H);

  // Inner refined card frame
  drawRoundedRect(ctx, 28, 28, W - 56, H - 56, 18);
  ctx.fillStyle = 'rgba(13, 16, 24, 0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const sans = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const mono = '"JetBrains Mono", "SF Mono", Consolas, monospace';

  const padX = 72;

  // Header
  ctx.beginPath();
  ctx.arc(padX + 6, 76, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#34D399';
  ctx.fill();

  ctx.font = `600 17px ${sans}`;
  ctx.fillStyle = '#F8FAFC';
  ctx.fillText('VoibeCode', padX + 22, 82);

  ctx.font = `400 14px ${sans}`;
  ctx.fillStyle = 'rgba(248, 250, 252, 0.45)';
  ctx.fillText('·  AI Agent Ship Receipt', padX + 122, 82);

  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  ctx.font = `400 14px ${mono}`;
  ctx.fillStyle = 'rgba(248, 250, 252, 0.5)';
  ctx.textAlign = 'right';
  ctx.fillText(dateStr, W - padX, 82);
  ctx.textAlign = 'left';

  // Divider
  ctx.beginPath();
  ctx.moveTo(padX, 112);
  ctx.lineTo(W - padX, 112);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();

  // Hero Metric: Total AI Flow Time
  ctx.font = `500 13px ${sans}`;
  ctx.fillStyle = 'rgba(248, 250, 252, 0.48)';
  ctx.fillText('AI AGENT FLOW TIME', padX, 164);

  ctx.font = `600 76px ${mono}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(formatFlowDuration(stats.totalFlowMs), padX, 248);

  // Right Hero: Workspaces pill stack (always prioritize active workspace first)
  const rawWs = [
    stats.workspaceName || 'Voibcode',
    ...(Array.isArray(stats.workspacesTouched) ? stats.workspacesTouched : []),
  ];
  const wsList = Array.from(new Set(rawWs.filter(Boolean))).slice(0, 4);
  ctx.font = `500 13px ${sans}`;
  ctx.fillStyle = 'rgba(248, 250, 252, 0.48)';
  ctx.fillText('WORKSPACES MONITORED', 680, 164);

  let pillX = 680;
  let pillY = 186;
  ctx.font = `500 13px ${mono}`;
  for (const ws of wsList) {
    const label = ws.slice(0, 18);
    const w = ctx.measureText(label).width + 26;
    if (pillX + w > W - padX) {
      pillX = 680;
      pillY += 38;
    }
    drawRoundedRect(ctx, pillX, pillY, w, 30, 8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.fillText(label, pillX + 13, pillY + 20);
    pillX += w + 10;
  }

  // 4-column metric strip
  const totalOps = Math.max(1, stats.totalToolCalls);
  const greenPct = Math.max(
    0,
    Math.min(100, ((totalOps - stats.errorCount) / totalOps) * 100)
  ).toFixed(0);
  const b = stats.toolBreakdown || { command: 0, edit: 0, read: 0, subagent: 0, other: 0 };

  const cards = [
    {
      label: 'Agent Steps',
      value: String(stats.totalToolCalls),
      sub: `${stats.invocations} turns · avg ${(stats.avgStepDurationMs / 1000).toFixed(1)}s`,
    },
    {
      label: 'Stalls Rescued',
      value: String(stats.stallsCaught),
      sub: `avg unblock ${(stats.avgUnblockMs / 1000).toFixed(1)}s`,
    },
    {
      label: 'Green Rate',
      value: `${greenPct}%`,
      sub: `${stats.errorCount} errors caught`,
    },
    {
      label: 'Best Streak',
      value: `${stats.bestStreak}`,
      sub: `${b.edit} edits · ${b.command} cmds`,
    },
  ];

  const cardTop = 294;
  const cardGap = 16;
  const cardW = (W - padX * 2 - cardGap * 3) / 4;
  const cardH = 114;

  cards.forEach((c, idx) => {
    const cx = padX + idx * (cardW + cardGap);
    drawRoundedRect(ctx, cx, cardTop, cardW, cardH, 12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.stroke();

    ctx.font = `500 12px ${sans}`;
    ctx.fillStyle = 'rgba(248, 250, 252, 0.48)';
    ctx.fillText(c.label.toUpperCase(), cx + 20, cardTop + 30);

    ctx.font = `600 32px ${mono}`;
    ctx.fillStyle = idx === 2 ? '#34D399' : '#F8FAFC';
    ctx.fillText(c.value, cx + 20, cardTop + 72);

    ctx.font = `400 12px ${mono}`;
    ctx.fillStyle = 'rgba(248, 250, 252, 0.44)';
    ctx.fillText(c.sub, cx + 20, cardTop + 98);
  });

  // 24-Hour Activity Cadence
  const chartTop = 456;
  ctx.font = `500 12px ${sans}`;
  ctx.fillStyle = 'rgba(248, 250, 252, 0.48)';
  ctx.fillText('24-HOUR AGENT CADENCE', padX, chartTop);

  const buckets =
    Array.isArray(stats.hourlyActivity) && stats.hourlyActivity.length === 24
      ? stats.hourlyActivity
      : new Array<number>(24).fill(0);
  const maxBucket = Math.max(1, ...buckets);
  const barGap = 8;
  const barW = (W - padX * 2 - barGap * 23) / 24;
  const barMaxH = 88;
  const barBaseY = chartTop + 106;

  buckets.forEach((count, hr) => {
    const bx = padX + hr * (barW + barGap);
    const bh = count === 0 ? 4 : Math.max(12, Math.round((count / maxBucket) * barMaxH));
    drawRoundedRect(ctx, bx, barBaseY - bh, barW, bh, 4);
    ctx.fillStyle =
      count === 0 ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 138, 122, 0.85)';
    ctx.fill();
  });

  // Footer
  ctx.font = `500 13px ${mono}`;
  ctx.fillStyle = 'rgba(248, 250, 252, 0.65)';
  ctx.fillText('voibecode.com', padX, H - 54);

  ctx.font = `400 12px ${sans}`;
  ctx.fillStyle = 'rgba(248, 250, 252, 0.42)';
  ctx.textAlign = 'right';
  ctx.fillText('100% Local Metadata · Zero Source Code Stored', W - padX, H - 54);
  ctx.textAlign = 'left';
}

export function downloadSessionReceiptPng(
  canvas: HTMLCanvasElement,
  workspaceName: string
): void {
  const slug = (workspaceName || 'voibecode').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `voibecode-receipt-${slug}-${dateStr}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
