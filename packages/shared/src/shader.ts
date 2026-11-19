import { FLAGSHIP_HEX } from './types.js';
import { derivePalette, lerpPalette } from './oklch.js';
import type { SkyPalette } from './types.js';

export const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `
#ifdef GL_ES
precision highp float;
#endif

varying vec2 v_uv;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_litColor;
uniform vec3 u_midColor;
uniform vec3 u_zenithColor;
uniform float u_stallPulse;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 6-octave Fractional Brownian Motion with subtle octave rotation
float fbm6(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);

  for (int i = 0; i < 6; i++) {
    sum += amp * valueNoise(p);
    p = rot * p * 2.02 + vec2(17.13, 9.21);
    amp *= 0.5;
  }

  return sum;
}

// Interleaved Gradient Noise to remove 8-bit sky banding
float ign(vec2 coord) {
  vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
  return fract(magic.z * fract(dot(coord, magic.xy)));
}

void main() {
  vec2 res = max(u_resolution, vec2(1.0));
  vec2 uv = gl_FragCoord.xy / res;
  float aspect = res.x / res.y;

  // Aspect-normalized sky coordinates anchored slightly below horizon
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  float slowTime = u_time * 0.022;

  // Domain-warped 6-octave volumetric cloud drift
  vec2 cloudCoord = vec2(p.x * 1.18 + slowTime * 0.45, p.y * 2.15 - slowTime * 0.12);
  vec2 q = vec2(
    fbm6(cloudCoord + vec2(0.0, 0.0)),
    fbm6(cloudCoord + vec2(5.2, 1.3))
  );
  vec2 r = vec2(
    fbm6(cloudCoord + 1.85 * q + vec2(1.7, 9.2) + vec2(slowTime * 0.28, -slowTime * 0.08)),
    fbm6(cloudCoord + 1.85 * q + vec2(8.3, 2.8) + vec2(-slowTime * 0.14, slowTime * 0.06))
  );

  float density = fbm6(cloudCoord + 1.45 * r);

  // Directional below-horizon light source
  vec2 sunOrigin = vec2(0.0, -0.18);
  vec2 toSun = p - sunOrigin;
  float sunDist = length(vec2(toSun.x * 0.68, toSun.y * 1.45));
  float horizonGlow = exp(-sunDist * 2.35);

  // Sample slightly offset toward below-horizon light for underbelly scattering
  vec2 lightDir = normalize(sunOrigin - p);
  float shadowSample = fbm6(cloudCoord + 1.45 * r + lightDir * vec2(0.14, 0.22));
  float underbellyLight = clamp((density - shadowSample) * 2.6 + 0.5, 0.0, 1.0);

  // Vertical twilight clearing curve
  float altitude = clamp(uv.y, 0.0, 1.0);
  float zenithBlend = smoothstep(0.18, 0.96, altitude);
  float horizonBand = pow(clamp(1.0 - altitude * 1.28, 0.0, 1.0), 1.65);

  // Subtle warm coral-amber alert shift when an active terminal task stalls
  vec3 stallCoral = vec3(1.0, 0.47, 0.28);
  float pulseWave = 0.5 + 0.5 * sin(u_time * 1.65);
  float stallStrength = clamp(u_stallPulse, 0.0, 1.0) * (0.55 + 0.45 * pulseWave);

  vec3 litTone = mix(u_litColor, mix(u_litColor, stallCoral, 0.62), stallStrength);
  vec3 midTone = mix(u_midColor, mix(u_midColor, stallCoral * 0.55, 0.22), stallStrength);
  vec3 zenithTone = u_zenithColor;

  // Base unobstructed twilight gradient
  vec3 skyColor = mix(midTone, zenithTone, zenithBlend);
  skyColor = mix(skyColor, litTone * 0.92, horizonBand * 0.58 + horizonGlow * 0.36);

  // Volumetric cloud veil blended smoothly across mid-horizon altitude
  float cloudMask = smoothstep(0.36, 0.78, density) * (1.0 - smoothstep(0.76, 1.0, altitude) * 0.55);
  vec3 cloudShade = mix(zenithTone * 1.15, midTone * 0.96, 0.55 + 0.45 * horizonBand);
  vec3 cloudLit = mix(cloudShade, litTone, clamp(underbellyLight * (0.45 + horizonBand * 0.75 + horizonGlow * 0.5), 0.0, 1.0));

  vec3 color = mix(skyColor, cloudLit, cloudMask * 0.88);

  // Soft below-horizon scatter bloom
  color += litTone * horizonGlow * (0.16 + 0.14 * stallStrength) * (1.0 - cloudMask * 0.42);

  // Interleaved Gradient Noise dithering to eliminate 8-bit quantization banding
  float dither = (ign(gl_FragCoord.xy) - 0.5) / 255.0;
  color = clamp(color + dither, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

export class TwilightShaderController {
  private readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms: {
    time: WebGLUniformLocation | null;
    resolution: WebGLUniformLocation | null;
    litColor: WebGLUniformLocation | null;
    midColor: WebGLUniformLocation | null;
    zenithColor: WebGLUniformLocation | null;
    stallPulse: WebGLUniformLocation | null;
  } | null = null;

  private currentPalette: SkyPalette;
  private transitionFrom: SkyPalette;
  private transitionTo: SkyPalette;
  private transitionStart = 0;
  private transitionDuration = 400;

  private stallTarget = 0;
  private stallCurrent = 0;
  private rafId: number | null = null;
  private startEpoch = performance.now();
  private paused = false;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, initialHex = FLAGSHIP_HEX) {
    this.canvas = canvas;
    const initial = derivePalette(initialHex);
    this.currentPalette = initial;
    this.transitionFrom = initial;
    this.transitionTo = initial;

    this.initWebGL();
    this.handleResize();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.canvas);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleResize);
    }

    this.startLoop();
  }

  public getPalette(): SkyPalette {
    return this.transitionTo;
  }

  public setPalette(hex: string, durationMs = 400): void {
    const next = derivePalette(hex);
    this.transitionFrom = this.currentPalette;
    this.transitionTo = next;
    this.transitionStart = performance.now();
    this.transitionDuration = Math.max(0, durationMs);
    this.applyCssFallback(next);
  }

  public setStalled(isStalled: boolean): void {
    this.stallTarget = isStalled ? 1.0 : 0.0;
  }

  public setPulse(level: number): void {
    this.stallTarget = Math.min(1.0, Math.max(0.0, level));
  }

  public pause(): void {
    this.paused = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public resume(): void {
    if (this.disposed || !this.paused) return;
    this.paused = false;
    this.startLoop();
  }

  public dispose(): void {
    this.disposed = true;
    this.pause();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.handleResize);
    }
    if (this.gl) {
      if (this.buffer) this.gl.deleteBuffer(this.buffer);
      if (this.program) this.gl.deleteProgram(this.program);
      this.gl = null;
    }
  }

  private initWebGL(): void {
    const gl = this.canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power',
    });

    if (!gl) {
      this.applyCssFallback(this.currentPalette);
      return;
    }

    const vs = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) {
      this.applyCssFallback(this.currentPalette);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      this.applyCssFallback(this.currentPalette);
      return;
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      this.applyCssFallback(this.currentPalette);
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    this.gl = gl;
    this.program = program;
    this.buffer = buffer;
    this.uniforms = {
      time: gl.getUniformLocation(program, 'u_time'),
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      litColor: gl.getUniformLocation(program, 'u_litColor'),
      midColor: gl.getUniformLocation(program, 'u_midColor'),
      zenithColor: gl.getUniformLocation(program, 'u_zenithColor'),
      stallPulse: gl.getUniformLocation(program, 'u_stallPulse'),
    };
  }

  private compileShader(
    gl: WebGLRenderingContext,
    type: number,
    source: string
  ): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private applyCssFallback(palette: SkyPalette): void {
    this.canvas.style.background = `linear-gradient(180deg, ${palette.zenithHex} 0%, ${palette.midHex} 58%, ${palette.clampedLitHex} 100%)`;
  }

  private handleResize = (): void => {
    const dpr = Math.min(
      typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      2
    );
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor((rect.width || window.innerWidth) * dpr));
    const height = Math.max(
      1,
      Math.floor((rect.height || window.innerHeight) * dpr)
    );

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  };

  private startLoop(): void {
    const tick = (now: number) => {
      if (this.disposed || this.paused) return;

      if (this.transitionDuration <= 0) {
        this.currentPalette = this.transitionTo;
      } else {
        const elapsed = now - this.transitionStart;
        const t = Math.min(1, Math.max(0, elapsed / this.transitionDuration));
        this.currentPalette = lerpPalette(
          this.transitionFrom,
          this.transitionTo,
          t
        );
      }

      // Smooth stall pulse transition (~300ms settle)
      this.stallCurrent += (this.stallTarget - this.stallCurrent) * 0.08;

      if (this.gl && this.program && this.uniforms) {
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.uniform1f(this.uniforms.time, (now - this.startEpoch) * 0.001);
        gl.uniform2f(
          this.uniforms.resolution,
          this.canvas.width,
          this.canvas.height
        );
        gl.uniform3fv(this.uniforms.litColor, this.currentPalette.lit);
        gl.uniform3fv(this.uniforms.midColor, this.currentPalette.mid);
        gl.uniform3fv(this.uniforms.zenithColor, this.currentPalette.zenith);
        gl.uniform1f(this.uniforms.stallPulse, this.stallCurrent);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }
}
