import {
  DAY_ONE_MAKER_SEEDS,
  DEFAULT_SYSTEMS_MAXIMS,
  DEFAULT_TECH_LEGENDS,
  FLAGSHIP_HEX,
  MatrixCell,
  OKLCHColor,
  RGBVec3,
  SkyPalette,
  SwatchEntry,
  VoibeManifest,
} from './types.js';

const MATRIX_SIZE = 16;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isValidHex(input: string): boolean {
  const trimmed = input.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(trimmed) || /^[0-9a-fA-F]{3}$/.test(trimmed);
}

export function normalizeHex(input: string, fallback = FLAGSHIP_HEX): string {
  const raw = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const expanded = raw
      .split('')
      .map((ch) => ch + ch)
      .join('')
      .toUpperCase();
    return `#${expanded}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }
  return fallback;
}

export function hexToRgb01(hex: string): RGBVec3 {
  const clean = normalizeHex(hex).slice(1);
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

export function rgb01ToHex(rgb: RGBVec3): string {
  const toByte = (c: number) =>
    Math.round(clamp(c, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${toByte(rgb[0])}${toByte(rgb[1])}${toByte(rgb[2])}`;
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(x: number): number {
  const clamped = clamp(x, 0, 1);
  return clamped <= 0.0031308
    ? 12.92 * clamped
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

export function rgb01ToOklab(rgb: RGBVec3): [number, number, number] {
  const r = srgbToLinear(rgb[0]);
  const g = srgbToLinear(rgb[1]);
  const b = srgbToLinear(rgb[2]);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  return [L, A, B];
}

function oklabToLinearRgb(L: number, a: number, b: number): RGBVec3 {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bOut = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [r, g, bOut];
}

function isInLinearGamut([r, g, b]: RGBVec3): boolean {
  const eps = -1e-4;
  const max = 1 + 1e-4;
  return r >= eps && r <= max && g >= eps && g <= max && b >= eps && b <= max;
}

export function rgb01ToOklch(rgb: RGBVec3): OKLCHColor {
  const [L, a, b] = rgb01ToOklab(rgb);
  const c = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

export function oklchToRgb01(color: OKLCHColor): RGBVec3 {
  const L = clamp(color.l, 0, 1);
  const targetC = Math.max(0, color.c);
  const h = ((color.h % 360) + 360) % 360;
  const rad = (h * Math.PI) / 180;
  const cosH = Math.cos(rad);
  const sinH = Math.sin(rad);

  const testDirect = oklabToLinearRgb(L, targetC * cosH, targetC * sinH);
  if (isInLinearGamut(testDirect)) {
    return [
      linearToSrgb(testDirect[0]),
      linearToSrgb(testDirect[1]),
      linearToSrgb(testDirect[2]),
    ];
  }

  // Binary search chroma downward while preserving lightness L and hue H
  let low = 0;
  let high = targetC;
  for (let i = 0; i < 14; i++) {
    const mid = (low + high) * 0.5;
    const probe = oklabToLinearRgb(L, mid * cosH, mid * sinH);
    if (isInLinearGamut(probe)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const fitted = oklabToLinearRgb(L, low * cosH, low * sinH);
  return [
    linearToSrgb(fitted[0]),
    linearToSrgb(fitted[1]),
    linearToSrgb(fitted[2]),
  ];
}

export function hexToOklch(hex: string): OKLCHColor {
  return rgb01ToOklch(hexToRgb01(hex));
}

export function oklchToHex(color: OKLCHColor): string {
  return rgb01ToHex(oklchToRgb01(color));
}

export function oklabDistance(hexA: string, hexB: string): number {
  const [l1, a1, b1] = rgb01ToOklab(hexToRgb01(hexA));
  const [l2, a2, b2] = rgb01ToOklab(hexToRgb01(hexB));
  const dl = l1 - l2;
  const da = a1 - a2;
  const db = b1 - b2;
  return Math.sqrt(dl * dl + da * da + db * db);
}

/**
 * Derive perceptually safe WebGL twilight palette from any anchor hex:
 * - Lit cloud underbelly: clamp lightness [0.58, 0.78], cap chroma <= 0.16
 * - Zenith upper sky: hue (H + 165) % 360, L = 0.13, C = 0.04
 * - Mid-sky clearing: hue (H + 145) % 360, L = 0.30, C = 0.06
 */
export function derivePalette(anchorHex: string): SkyPalette {
  const cleanAnchor = normalizeHex(anchorHex);
  const rawOklch = hexToOklch(cleanAnchor);

  const clampedL = clamp(rawOklch.l, 0.58, 0.78);
  const clampedC = Math.min(rawOklch.c, 0.16);
  const harmonyHue = rawOklch.c < 0.002 ? 29.4 : rawOklch.h;

  const litOklch: OKLCHColor = {
    l: clampedL,
    c: clampedC,
    h: rawOklch.h,
  };
  const midOklch: OKLCHColor = {
    l: 0.3,
    c: 0.06,
    h: (harmonyHue + 145) % 360,
  };
  const zenithOklch: OKLCHColor = {
    l: 0.13,
    c: 0.04,
    h: (harmonyHue + 165) % 360,
  };

  const lit = oklchToRgb01(litOklch);
  const mid = oklchToRgb01(midOklch);
  const zenith = oklchToRgb01(zenithOklch);

  return {
    anchorHex: cleanAnchor,
    clampedLitHex: rgb01ToHex(lit),
    midHex: rgb01ToHex(mid),
    zenithHex: rgb01ToHex(zenith),
    lit,
    mid,
    zenith,
    oklch: litOklch,
  };
}

export function lerpPalette(
  from: SkyPalette,
  to: SkyPalette,
  progress: number
): SkyPalette {
  const t = clamp(progress, 0, 1);
  const mixVec3 = (a: RGBVec3, b: RGBVec3): RGBVec3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  const lit = mixVec3(from.lit, to.lit);
  const mid = mixVec3(from.mid, to.mid);
  const zenith = mixVec3(from.zenith, to.zenith);

  return {
    anchorHex: t >= 1 ? to.anchorHex : from.anchorHex,
    clampedLitHex: rgb01ToHex(lit),
    midHex: rgb01ToHex(mid),
    zenithHex: rgb01ToHex(zenith),
    lit,
    mid,
    zenith,
    oklch: t >= 1 ? to.oklch : from.oklch,
  };
}

let cachedMatrix: MatrixCell[] | null = null;

/**
 * Generates deterministic 16x16 (256-cell) OKLCH matrix:
 * - col (0..15): 360-degree hue sweep aligned with warm twilight coral near col 1
 * - row (0..15): perceptual lightness (0.775 -> 0.585) and atmospheric chroma curve (<= 0.16)
 */
export function generate256Matrix(): MatrixCell[] {
  if (cachedMatrix) return cachedMatrix;

  const cells: MatrixCell[] = [];
  for (let row = 0; row < MATRIX_SIZE; row++) {
    const rowNorm = row / (MATRIX_SIZE - 1);
    const l = 0.775 - rowNorm * 0.19;
    const c = 0.055 + 0.105 * Math.sin(rowNorm * Math.PI * 0.85 + 0.15);

    for (let col = 0; col < MATRIX_SIZE; col++) {
      const h = (col * 22.5 + 7.5) % 360;
      const oklch: OKLCHColor = { l, c, h };
      const hex = oklchToHex(oklch);
      const isCentral = row >= 6 && row <= 9 && col >= 6 && col <= 9;
      cells.push({
        index: row * MATRIX_SIZE + col,
        row,
        col,
        hex,
        oklch,
        isCentral,
      });
    }
  }

  cachedMatrix = cells;
  return cells;
}

export function findNearestMatrixCell(
  hex: string,
  matrix: MatrixCell[] = generate256Matrix(),
  options: { nonCentralOnly?: boolean; excludeCoords?: Set<string> } = {}
): MatrixCell {
  const cleanHex = normalizeHex(hex);
  const candidates = matrix.filter((cell) => {
    if (options.nonCentralOnly && cell.isCentral) return false;
    if (options.excludeCoords?.has(`${cell.row}:${cell.col}`)) return false;
    return true;
  });

  const pool = candidates.length > 0 ? candidates : matrix;
  let best = pool[0];
  let bestDist = Number.POSITIVE_INFINITY;

  for (const cell of pool) {
    const dist = oklabDistance(cleanHex, cell.hex);
    if (dist < bestDist) {
      bestDist = dist;
      best = cell;
    }
  }

  return best;
}

export function findNearestUnclaimedCell(
  targetRow: number,
  targetCol: number,
  claimedEntries: SwatchEntry[],
  matrix: MatrixCell[] = generate256Matrix()
): MatrixCell | null {
  const claimedHexes = new Set(claimedEntries.map((s) => normalizeHex(s.hex)));
  const claimedCoords = new Set(claimedEntries.map((s) => `${s.row}:${s.col}`));

  const available = matrix.filter(
    (cell) =>
      !claimedCoords.has(`${cell.row}:${cell.col}`) &&
      !claimedHexes.has(normalizeHex(cell.hex)) &&
      normalizeHex(cell.hex) !== FLAGSHIP_HEX
  );

  if (available.length === 0) return null;

  available.sort((a, b) => {
    const distA = (a.row - targetRow) ** 2 + (a.col - targetCol) ** 2;
    const distB = (b.row - targetRow) ** 2 + (b.col - targetCol) ** 2;
    if (distA !== distB) return distA - distB;
    if (a.isCentral !== b.isCentral) return a.isCentral ? 1 : -1;
    return a.index - b.index;
  });

  return available[0];
}

export function buildSeedMakerSwatches(
  matrix: MatrixCell[] = generate256Matrix()
): SwatchEntry[] {
  const usedCoords = new Set<string>();
  return DAY_ONE_MAKER_SEEDS.map((seed) => {
    const cell = findNearestMatrixCell(seed.hex, matrix, {
      nonCentralOnly: true,
      excludeCoords: usedCoords,
    });
    usedCoords.add(`${cell.row}:${cell.col}`);
    return {
      hex: normalizeHex(seed.hex),
      row: cell.row,
      col: cell.col,
      tier: 'maker',
      reclaimable: true,
      brand: seed.brand,
      tagline: seed.tagline.slice(0, 60),
      url: seed.url,
    };
  });
}

export function createDefaultManifest(): VoibeManifest {
  return {
    version: '1.0.0',
    updatedAt: new Date().toISOString(),
    flagshipHex: FLAGSHIP_HEX,
    swatches: buildSeedMakerSwatches(),
    quotes: {
      systems: DEFAULT_SYSTEMS_MAXIMS,
      legends: DEFAULT_TECH_LEGENDS,
    },
  };
}
