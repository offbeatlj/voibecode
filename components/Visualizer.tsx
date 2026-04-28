
import React, { useEffect, useRef, forwardRef } from 'react';
import { audioEngine } from '../services/AudioEngine';
import { VisualizerSettings } from '../types';

interface VisualizerProps {
  isPlaying: boolean;
  bpm: number;
  settings: VisualizerSettings;
  accentColor?: string; // Hex override from Scale
  className?: string;
}

export const Visualizer = forwardRef<HTMLCanvasElement, VisualizerProps>(({ isPlaying, bpm, settings, accentColor, className }, ref) => {
  const internalRef = useRef<HTMLCanvasElement>(null);
  
  // Combine refs
  useEffect(() => {
      if (typeof ref === 'function') {
          ref(internalRef.current);
      } else if (ref) {
          (ref as React.MutableRefObject<HTMLCanvasElement | null>).current = internalRef.current;
      }
  }, [ref]);
  
  useEffect(() => {
    const canvas = internalRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let rotation = 0;
    let textFloat = 0;
    let waveOffset = 0;

    // Frequency Data Setup
    const analyser = audioEngine.getAnalyser();
    const bufferLength = analyser ? analyser.frequencyBinCount : 0;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Uint8Array(bufferLength);

    const render = (time: number) => {
      // Responsive sizing
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
      
      const width = canvas.width;
      const height = canvas.height;
      const cx = width / 2;
      const cy = height / 2;
      const hue = settings.hue;
      
      // Fix: Prioritize User Hue Settings for main shapes, ignore accentColor unless needed for branding
      const mainColorStyle = `hsl(${hue}, 70%, 60%)`;

      // Get Audio Data
      if (analyser) {
          analyser.getByteFrequencyData(dataArray);
          analyser.getByteTimeDomainData(timeDataArray);
      }

      // Background (slight trail)
      ctx.fillStyle = 'rgba(5, 5, 5, 0.3)';
      ctx.fillRect(0, 0, width, height);

      if (isPlaying) {
        rotation += (bpm / 60) * 0.01;
        textFloat = Math.sin(time * 0.002) * 10;
        waveOffset += 2;
      }

      const bassVal = dataArray[5] || 0; // Kick range
      const intensity = bassVal / 255;

      // --- MODE SPECIFIC DRAWING ---
      ctx.shadowBlur = 15;
      ctx.shadowColor = mainColorStyle;
      ctx.lineWidth = 3;
      ctx.strokeStyle = mainColorStyle;

      if (settings.shape === 'polygon') {
          // Geometric Polygon Mode
          const shapes = 3;
          const baseSize = Math.min(width, height) * 0.2 + (bassVal / 5);

          for (let i = 0; i < shapes; i++) {
            ctx.beginPath();
            const offset = i * (Math.PI / 3);
            const currentRotation = rotation * (i % 2 === 0 ? 1 : -1) + offset;
            
            // Use hue based loop
            const loopHue = (hue + i * 30) % 360;
            ctx.strokeStyle = `hsla(${loopHue}, 70%, 60%, 0.8)`;
            
            const sides = 4 + i;
            const radius = baseSize + (Math.sin(time * 0.002 + i) * 20);
            
            for (let j = 0; j <= sides; j++) {
              const angle = currentRotation + (j * 2 * Math.PI) / sides;
              const x = cx + Math.cos(angle) * radius;
              const y = cy + Math.sin(angle) * radius;
              if (j === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
          }
      } else if (settings.shape === 'orb') {
          // Pulsating Orb Mode
          const radius = (Math.min(width, height) * 0.15) + (bassVal / 2);
          
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${hue}, 70%, 50%, ${0.1 + intensity * 0.4})`;
          ctx.fill();
          ctx.stroke();

          // Outer rings
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 1.5, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(${hue}, 70%, 60%, 0.5)`;
          ctx.stroke();
      } else if (settings.shape === 'wave') {
          // Oscilloscope Wave Mode
          ctx.beginPath();
          const sliceWidth = width / bufferLength;
          let x = 0;
          
          for(let i = 0; i < bufferLength; i++) {
              const v = timeDataArray[i] / 128.0; // 0..2
              const y = (v * height) / 2; // Centered
              
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              x += sliceWidth;
          }
          ctx.stroke();
      }

      // Draw Spectrum Bars (Channels)
      const barWidth = (width / 32);
      ctx.fillStyle = `hsla(${hue}, 80%, 50%, 1)`;
      ctx.globalAlpha = 0.2;
      for(let i = 0; i < 32; i++) {
          const val = dataArray[i * 2] || 0; 
          const barHeight = (val / 255) * height * 0.3;
          ctx.fillRect(i * barWidth, height - barHeight, barWidth - 2, barHeight);
      }
      ctx.globalAlpha = 1.0;

      // Floating Text - Hardcoded Branding
      ctx.font = `bold ${Math.min(width, height) * 0.12}px "Fira Code"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillText('VOIBECODE', cx, cy + textFloat);
      
      // Glitch Text Effect on Beat
      if (bassVal > 200) {
          // Use accentColor here specifically for the branding glitch to keep the theme tie-in
          // BUT allow it to fallback to user hue if not present
          ctx.fillStyle = accentColor || `hsla(${hue}, 100%, 70%, 0.8)`;
          // Random slight offset
          ctx.fillText('VOIBECODE', cx + (Math.random() * 10 - 5), cy + textFloat + (Math.random() * 10 - 5));
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, bpm, settings, accentColor]);

  return (
    <canvas 
      ref={internalRef} 
      className={className || "w-full h-48 md:h-64 rounded-xl border border-slate-800/50 bg-black/50 mt-6 shadow-inner transition-colors duration-500"}
    />
  );
});

Visualizer.displayName = 'Visualizer';
