import React, { useEffect, useRef } from 'react';

export interface OrbStyleInfo {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  glowColor: string;
  accentColor: string;
  fallbackGradient: string;
}

// Exactly the 12 hardcoded styles required
export const ORB_STYLES: OrbStyleInfo[] = [
  {
    id: 'classic',
    name: 'Classic',
    subtitle: 'Deep violet nebula',
    description: 'Deep violet nebula with celestial glow',
    glowColor: 'rgba(168, 85, 247, 0.5)',
    accentColor: '#c084fc',
    fallbackGradient: 'radial-gradient(circle at 35% 32%, #c084fc 0%, #8b5cf6 30%, #4c1d95 70%, #14052b 100%)',
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    subtitle: 'Spiral of stars',
    description: 'Magenta, pink and blue spiral of stars',
    glowColor: 'rgba(236, 72, 153, 0.5)',
    accentColor: '#f472b6',
    fallbackGradient: 'radial-gradient(circle at 35% 32%, #f472b6 0%, #d946ef 30%, #4338ca 70%, #090314 100%)',
  },
  {
    id: 'solar',
    name: 'Solar',
    subtitle: 'Burning sun',
    description: 'Glowing orange-gold burning sun',
    glowColor: 'rgba(245, 158, 11, 0.6)',
    accentColor: '#fbbf24',
    fallbackGradient: 'radial-gradient(circle at 35% 32%, #fffbeb 0%, #fbbf24 30%, #ea580c 70%, #450a0a 100%)',
  },
  {
    id: 'crystal',
    name: 'Crystal',
    subtitle: 'Faceted ice gem',
    description: 'Icy white-cyan faceted gem with sharp reflections',
    glowColor: 'rgba(56, 189, 248, 0.5)',
    accentColor: '#38bdf8',
    fallbackGradient: 'radial-gradient(circle at 35% 32%, #f0f9ff 0%, #38bdf8 30%, #0284c7 70%, #041f33 100%)',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    subtitle: 'Rolling water waves',
    description: 'Deep blue and teal with rolling water waves',
    glowColor: 'rgba(20, 184, 166, 0.5)',
    accentColor: '#2dd4bf',
    fallbackGradient: 'radial-gradient(circle at 35% 32%, #99f6e4 0%, #14b8a6 30%, #0369a1 70%, #021829 100%)',
  },
  {
    id: 'lava',
    name: 'Lava',
    subtitle: 'Molten rock crust',
    description: 'Dark crust with glowing red-orange molten cracks',
    glowColor: 'rgba(239, 68, 68, 0.55)',
    accentColor: '#f97316',
    fallbackGradient: 'radial-gradient(circle at 35% 32%, #fdba74 0%, #ef4444 35%, #991b1b 70%, #18181b 100%)',
  },
  {
    id: 'neon',
    name: 'Neon Ring',
    subtitle: 'Glowing orbits',
    description: 'Dark core with glowing cyan and pink orbiting rings',
    glowColor: 'rgba(6, 182, 212, 0.55)',
    accentColor: '#06b6d4',
    fallbackGradient: 'radial-gradient(circle at 35% 32%, #67e8f9 0%, #a855f7 35%, #ec4899 70%, #070714 100%)',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    subtitle: 'Northern lights',
    description: 'Green, teal and purple northern lights',
    glowColor: 'rgba(16, 185, 129, 0.5)',
    accentColor: '#34d399',
    fallbackGradient: 'radial-gradient(circle at 35% 32%, #a7f3d0 0%, #10b981 30%, #06b6d4 65%, #021324 100%)',
  },
  {
    id: 'rosepetal',
    name: 'Rose Petal',
    subtitle: 'Rose swirls',
    description: 'Deep crimson and pink sphere with layered rose-petal swirls',
    glowColor: 'rgba(244, 63, 94, 0.55)',
    accentColor: '#fb7185',
    fallbackGradient: 'radial-gradient(circle at 35% 32%, #fda4af 0%, #f43f5e 32%, #be123c 65%, #4c0519 100%)',
  },
  {
    id: 'blackhole',
    name: 'Black Hole',
    subtitle: 'Accretion ring',
    description: 'Pure black core with bright orange-white glowing accretion ring',
    glowColor: 'rgba(249, 115, 22, 0.6)',
    accentColor: '#fb923c',
    fallbackGradient: 'radial-gradient(circle at 35% 32%, #fed7aa 0%, #f97316 22%, #9a3412 45%, #000000 68%)',
  },
  {
    id: 'plasma',
    name: 'Plasma',
    subtitle: 'Energy filaments',
    description: 'Electric blue and magenta energy filaments flowing inside glass',
    glowColor: 'rgba(192, 38, 211, 0.6)',
    accentColor: '#e879f9',
    fallbackGradient: 'radial-gradient(circle at 35% 32%, #e879f9 0%, #38bdf8 30%, #9333ea 65%, #070216 100%)',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    subtitle: 'Faceted gem',
    description: 'Deep green faceted gem with bright light reflections',
    glowColor: 'rgba(16, 185, 129, 0.55)',
    accentColor: '#6ee7b7',
    fallbackGradient: 'radial-gradient(circle at 35% 32%, #d1fae5 0%, #34d399 28%, #059669 65%, #022c1b 100%)',
  },
];

export interface OrbSphereProps {
  styleId: string;
  size?: number;
  state?: 'idle' | 'listening' | 'speaking' | 'thinking';
  className?: string;
  reduceMotion?: boolean;
  dimmed?: boolean;
  inputVolume?: number;
  outputVolume?: number;
  inputVolumeRef?: React.RefObject<number>; 
  outputVolumeRef?: React.RefObject<number>;
}

export const OrbSphere: React.FC<OrbSphereProps> = ({
  styleId,
  size = 110,
  state = 'idle',
  className = '',
  reduceMotion = false,
  dimmed = false,
  inputVolumeRef,
  outputVolumeRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animTimeRef = useRef(0);
  const lastTimestampRef = useRef<number | null>(null);

  // Match style or fallback to classic
  const currentStyle = ORB_STYLES.find(s => s.id === styleId) || ORB_STYLES[0];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Retina-ready resolution
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    let animId: number;

    const isIdle = state === 'idle';
    const isListening = state === 'listening';
    const isSpeaking = state === 'speaking';

    const drawOrb = (timestamp: number) => {
      if (lastTimestampRef.current === null) lastTimestampRef.current = timestamp;
      const dt = Math.min(0.1, (timestamp - lastTimestampRef.current) * 0.001);
      lastTimestampRef.current = timestamp;

      // Dynamic speed scaling per state
      const speedMultiplier = isSpeaking ? 3.4 : isListening ? 2.1 : 0.8;
      if (!reduceMotion) {
        animTimeRef.current += dt * speedMultiplier;
      } else {
        // When reduce motion is ON, maintain a fixed offset per state so they never look identical
        animTimeRef.current = isSpeaking ? 3.0 : isListening ? 1.5 : 0.5;
      }
      const t = animTimeRef.current;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const cx = size / 2;
      const cy = size / 2;

      // Allocate space around the core for ripple rings and alert glowing halos
      const margin = Math.max(4, Math.round(size * 0.1));
      const baseR = (size / 2) - margin;

      // State pulse / breathing calculations
      let pulse = 0;
      const volume = (isSpeaking ? outputVolumeRef?.current : inputVolumeRef?.current) || 0;
      if (!reduceMotion) {
        if (isIdle) {
          // Calm, slow soft breathing
          pulse = Math.sin(t * 1.5) * (baseR * 0.025);
        } else if (state === 'thinking') {
          // Slow, hypnotic thinking
          pulse = Math.sin(t * 0.5) * (baseR * 0.05);
        } else {
          // Energetic voice beats and volume reactivity
          const voiceBeat = Math.sin(t * 7.5) * 0.45 + Math.sin(t * 13) * 0.35 + Math.sin(t * 21) * 0.2;
          const volPulse = volume * (baseR * 0.5); // React strongly to volume
          pulse = (voiceBeat + 1) * (baseR * 0.055) + volPulse;
        }
      } else {
        pulse = isSpeaking ? baseR * 0.06 : isListening ? baseR * 0.04 : 0;
      }

      const effectiveR = Math.max(6, baseR + pulse);

      // -------------------------------------------------------------
      // 1. LISTENING RIPPLE RINGS (expanding outward from the orb)
      // -------------------------------------------------------------
      if (isListening) {
        const ringPeriod = reduceMotion ? 1 : 1.2;
        const ringProgress1 = reduceMotion ? 0.4 : ((t / ringPeriod) % 1);
        const ringProgress2 = reduceMotion ? 0.8 : (((t / ringPeriod) + 0.5) % 1);

        [ringProgress1, ringProgress2].forEach((prog) => {
          const ringR = effectiveR + prog * (margin * 0.95);
          const alpha = (1 - prog) * 0.65;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = currentStyle.glowColor.replace(/[\d\.]+\)$/, `${alpha})`);
          ctx.lineWidth = 1.5;
          ctx.shadowColor = currentStyle.accentColor;
          ctx.shadowBlur = 6;
          ctx.stroke();
          ctx.restore();
        });
      }

      // -------------------------------------------------------------
      // 2. OUTER SOFT GLOW (Intensity reacts to state)
      // -------------------------------------------------------------
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, effectiveR, 0, Math.PI * 2);
      ctx.shadowColor = isSpeaking ? currentStyle.accentColor : currentStyle.glowColor;
      ctx.shadowBlur = isSpeaking ? Math.min(26, effectiveR * 0.55) : isListening ? Math.min(22, effectiveR * 0.45) : Math.min(14, effectiveR * 0.3);
      ctx.fillStyle = 'rgba(0,0,0,0.01)';
      ctx.fill();
      ctx.restore();

      // -------------------------------------------------------------
      // 3. CLIP TO SPHERE CIRCLE
      // -------------------------------------------------------------
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, effectiveR, 0, Math.PI * 2);
      ctx.clip();

      // -------------------------------------------------------------
      // 4. BASE BACKGROUND SPHERICAL GRADIENT
      // -------------------------------------------------------------
      const baseGrad = ctx.createRadialGradient(
        cx - effectiveR * 0.32,
        cy - effectiveR * 0.35,
        effectiveR * 0.05,
        cx,
        cy,
        effectiveR
      );

      // State brightness / excitation boost
      const excitation = isSpeaking ? 0.25 : isListening ? 0.12 : 0;

      // Procedural surface rendering by style
      switch (currentStyle.id) {
        case 'classic': {
          baseGrad.addColorStop(0, isSpeaking ? '#e9d5ff' : '#c084fc');
          baseGrad.addColorStop(0.3, isSpeaking ? '#9333ea' : '#7c3aed');
          baseGrad.addColorStop(0.65, '#4c1d95');
          baseGrad.addColorStop(1, '#110324');
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, size, size);

          const rot = t * (isSpeaking ? 0.8 : isListening ? 0.5 : 0.25);
          for (let i = 0; i < 3; i++) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(rot + (i * Math.PI) / 1.5);
            const cloudGrad = ctx.createRadialGradient(
              effectiveR * 0.25,
              effectiveR * 0.1,
              2,
              effectiveR * 0.25,
              effectiveR * 0.1,
              effectiveR * (0.6 + excitation)
            );
            cloudGrad.addColorStop(0, `rgba(216, 180, 254, ${0.45 + excitation})`);
            cloudGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.3)');
            cloudGrad.addColorStop(1, 'rgba(124, 58, 237, 0)');
            ctx.fillStyle = cloudGrad;
            ctx.beginPath();
            ctx.ellipse(effectiveR * 0.2, effectiveR * 0.1, effectiveR * 0.5, effectiveR * 0.3, i, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // Stardust particles
          const starCount = isSpeaking ? 12 : isListening ? 10 : 7;
          for (let i = 0; i < starCount; i++) {
            const angle = (i * 2.39) + t * (isSpeaking ? 0.4 : 0.15);
            const dist = (effectiveR * 0.7) * ((i % 4 + 1) / 4);
            const sx = cx + Math.cos(angle) * dist;
            const sy = cy + Math.sin(angle) * dist * 0.8;
            const starAlpha = 0.4 + 0.5 * Math.sin(t * (isSpeaking ? 6 : 3) + i);
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, starAlpha + excitation)})`;
            ctx.beginPath();
            ctx.arc(sx, sy, isSpeaking ? 1.5 : 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }

        case 'galaxy': {
          baseGrad.addColorStop(0, isSpeaking ? '#fbcfe8' : '#f472b6');
          baseGrad.addColorStop(0.3, isSpeaking ? '#e879f9' : '#c026d3');
          baseGrad.addColorStop(0.65, '#312e81');
          baseGrad.addColorStop(1, '#06020f');
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, size, size);

          const armAngle = t * (isSpeaking ? 1.6 : isListening ? 1.1 : 0.5);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(armAngle);
          for (let arm = 0; arm < 2; arm++) {
            const armOffset = arm * Math.PI;
            for (let step = 0; step < 22; step++) {
              const th = (step / 22) * Math.PI * 1.6 + armOffset;
              const radius = (step / 22) * effectiveR * (0.85 + (isSpeaking ? Math.sin(t * 8) * 0.05 : 0));
              const px = Math.cos(th) * radius;
              const py = Math.sin(th) * radius * 0.6;
              const dotSize = Math.max(1, 2.8 * (1 - step / 25));
              ctx.fillStyle = arm === 0 ? 'rgba(244, 114, 182, 0.8)' : 'rgba(96, 165, 250, 0.8)';
              ctx.fillRect(px, py, dotSize, dotSize);
            }
          }
          const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, effectiveR * (0.35 + excitation));
          coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
          coreGrad.addColorStop(0.4, 'rgba(236, 72, 153, 0.7)');
          coreGrad.addColorStop(1, 'rgba(147, 51, 234, 0)');
          ctx.fillStyle = coreGrad;
          ctx.beginPath();
          ctx.arc(0, 0, effectiveR * (0.35 + excitation), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }

        case 'solar': {
          baseGrad.addColorStop(0, isSpeaking ? '#ffffff' : '#fffbeb');
          baseGrad.addColorStop(0.25, isSpeaking ? '#fde047' : '#f59e0b');
          baseGrad.addColorStop(0.6, '#ea580c');
          baseGrad.addColorStop(1, '#450a0a');
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, size, size);

          const solarAngle = t * (isSpeaking ? 1.2 : isListening ? 0.8 : 0.35);
          const flareCount = isSpeaking ? 6 : 4;
          for (let j = 0; j < flareCount; j++) {
            const flareAngle = solarAngle + (j * Math.PI * 2) / flareCount;
            const fx = cx + Math.cos(flareAngle) * (effectiveR * 0.45);
            const fy = cy + Math.sin(flareAngle) * (effectiveR * 0.45);
            const flareGrad = ctx.createRadialGradient(fx, fy, 2, fx, fy, effectiveR * (0.4 + excitation));
            flareGrad.addColorStop(0, 'rgba(254, 240, 138, 0.75)');
            flareGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.4)');
            flareGrad.addColorStop(1, 'rgba(185, 28, 28, 0)');
            ctx.fillStyle = flareGrad;
            ctx.beginPath();
            ctx.arc(fx, fy, effectiveR * (0.4 + excitation), 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }

        case 'crystal': {
          baseGrad.addColorStop(0, '#ffffff');
          baseGrad.addColorStop(0.25, isSpeaking ? '#bae6fd' : '#7dd3fc');
          baseGrad.addColorStop(0.6, '#0284c7');
          baseGrad.addColorStop(1, '#032030');
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, size, size);

          ctx.save();
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + excitation})`;
          ctx.lineWidth = isSpeaking ? 1.5 : 1;
          const shift = Math.sin(t * (isSpeaking ? 4 : isListening ? 2.5 : 1.2)) * (effectiveR * 0.1);

          ctx.beginPath();
          ctx.moveTo(cx, cy - effectiveR * 0.7);
          ctx.lineTo(cx + effectiveR * 0.6, cy - effectiveR * 0.1 + shift);
          ctx.lineTo(cx, cy + effectiveR * 0.75);
          ctx.lineTo(cx - effectiveR * 0.6, cy - effectiveR * 0.1 - shift);
          ctx.closePath();
          ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + excitation * 0.5})`;
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(cx - effectiveR * 0.5, cy - effectiveR * 0.4);
          ctx.lineTo(cx + effectiveR * 0.5, cy + effectiveR * 0.3);
          ctx.strokeStyle = isSpeaking ? 'rgba(255, 255, 255, 0.8)' : 'rgba(224, 242, 254, 0.5)';
          ctx.stroke();
          ctx.restore();
          break;
        }

        case 'ocean': {
          baseGrad.addColorStop(0, isSpeaking ? '#cffafe' : '#a5f3fc');
          baseGrad.addColorStop(0.3, isSpeaking ? '#14b8a6' : '#0d9488');
          baseGrad.addColorStop(0.65, '#0369a1');
          baseGrad.addColorStop(1, '#021829');
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, size, size);

          const waveSpeed = isSpeaking ? 3.5 : isListening ? 2.2 : 1.0;
          for (let w = 0; w < 3; w++) {
            ctx.save();
            const waveY = cy - effectiveR * 0.3 + (w * effectiveR * 0.35);
            const waveOffset = t * waveSpeed * (w === 1 ? -1.8 : 1.4) + w * 2;
            ctx.beginPath();
            ctx.moveTo(cx - effectiveR, size);
            for (let x = cx - effectiveR; x <= cx + effectiveR; x += 4) {
              const dx = (x - cx) / effectiveR;
              const y = waveY + Math.sin(dx * (4 + (isSpeaking ? 2 : 0)) + waveOffset) * (effectiveR * (0.12 + excitation));
              ctx.lineTo(x, y);
            }
            ctx.lineTo(cx + effectiveR, size);
            ctx.closePath();
            ctx.fillStyle = w === 0 ? 'rgba(20, 184, 166, 0.45)' : w === 1 ? 'rgba(6, 182, 212, 0.4)' : 'rgba(2, 132, 199, 0.45)';
            ctx.fill();
            ctx.restore();
          }
          break;
        }

        case 'lava': {
          baseGrad.addColorStop(0, isSpeaking ? '#ffedd5' : '#fdba74');
          baseGrad.addColorStop(0.25, isSpeaking ? '#f87171' : '#dc2626');
          baseGrad.addColorStop(0.55, '#7f1d1d');
          baseGrad.addColorStop(1, '#18181b');
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, size, size);

          ctx.fillStyle = 'rgba(24, 24, 27, 0.7)';
          ctx.beginPath();
          ctx.arc(cx - effectiveR * 0.2, cy - effectiveR * 0.2, effectiveR * 0.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(cx + effectiveR * 0.3, cy + effectiveR * 0.25, effectiveR * 0.4, 0, Math.PI * 2);
          ctx.fill();

          const crackPulse = 0.7 + 0.3 * Math.sin(t * (isSpeaking ? 7 : isListening ? 4.5 : 2));
          ctx.save();
          ctx.strokeStyle = `rgba(255, 140, 0, ${crackPulse})`;
          ctx.lineWidth = isSpeaking ? 3 : 2;
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = isSpeaking ? 12 : 6;
          ctx.beginPath();
          ctx.moveTo(cx - effectiveR * 0.6, cy);
          ctx.quadraticCurveTo(cx - effectiveR * 0.1, cy + effectiveR * 0.2, cx + effectiveR * 0.1, cy - effectiveR * 0.1);
          ctx.lineTo(cx + effectiveR * 0.65, cy + effectiveR * 0.3);
          ctx.stroke();

          ctx.strokeStyle = `rgba(255, 240, 180, ${crackPulse})`;
          ctx.lineWidth = isSpeaking ? 1.5 : 1;
          ctx.stroke();
          ctx.restore();
          break;
        }

        case 'neon': {
          baseGrad.addColorStop(0, isSpeaking ? '#a5f3fc' : '#67e8f9');
          baseGrad.addColorStop(0.2, '#38bdf8');
          baseGrad.addColorStop(0.5, '#4338ca');
          baseGrad.addColorStop(1, '#070714');
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, size, size);

          const ringAngle = t * (isSpeaking ? 2.5 : isListening ? 1.6 : 0.8);
          ctx.save();
          ctx.translate(cx, cy);

          ctx.save();
          ctx.rotate(0.45);
          ctx.beginPath();
          ctx.ellipse(0, 0, effectiveR * 0.85, effectiveR * 0.28, ringAngle, 0, Math.PI * 2);
          ctx.strokeStyle = isSpeaking ? '#22d3ee' : 'rgba(6, 182, 212, 0.85)';
          ctx.lineWidth = isSpeaking ? 3 : 2;
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = isSpeaking ? 14 : 8;
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.rotate(-0.55);
          ctx.beginPath();
          ctx.ellipse(0, 0, effectiveR * 0.88, effectiveR * 0.3, -ringAngle * 0.8, 0, Math.PI * 2);
          ctx.strokeStyle = isSpeaking ? '#f472b6' : 'rgba(236, 72, 153, 0.85)';
          ctx.lineWidth = isSpeaking ? 3 : 2;
          ctx.shadowColor = '#ec4899';
          ctx.shadowBlur = isSpeaking ? 14 : 8;
          ctx.stroke();
          ctx.restore();

          ctx.restore();
          break;
        }

        case 'aurora': {
          baseGrad.addColorStop(0, isSpeaking ? '#d1fae5' : '#a7f3d0');
          baseGrad.addColorStop(0.25, isSpeaking ? '#34d399' : '#10b981');
          baseGrad.addColorStop(0.6, '#06b6d4');
          baseGrad.addColorStop(1, '#021324');
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, size, size);

          const auroraT = t * (isSpeaking ? 3.0 : isListening ? 2.0 : 1.0);
          for (let a = 0; a < 3; a++) {
            ctx.save();
            ctx.beginPath();
            const startX = cx - effectiveR * 0.8 + (a * effectiveR * 0.6);
            ctx.moveTo(startX, cy - effectiveR * 0.8);
            for (let y = cy - effectiveR * 0.8; y <= cy + effectiveR * 0.8; y += 6) {
              const wave = Math.sin((y - cy) * 0.08 + auroraT + a * 1.5) * (effectiveR * (0.18 + excitation));
              ctx.lineTo(startX + wave, y);
            }
            ctx.lineWidth = effectiveR * (0.25 + excitation);
            ctx.strokeStyle = a === 0 ? 'rgba(52, 211, 153, 0.5)' : a === 1 ? 'rgba(45, 212, 191, 0.45)' : 'rgba(168, 85, 247, 0.4)';
            ctx.shadowColor = a === 0 ? '#10b981' : '#8b5cf6';
            ctx.shadowBlur = isSpeaking ? 16 : 10;
            ctx.stroke();
            ctx.restore();
          }
          break;
        }

        case 'rosepetal': {
          baseGrad.addColorStop(0, isSpeaking ? '#fdf2f8' : '#fbcfe8');
          baseGrad.addColorStop(0.25, isSpeaking ? '#fb7185' : '#f43f5e');
          baseGrad.addColorStop(0.6, '#9f1239');
          baseGrad.addColorStop(1, '#3b0314');
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, size, size);

          const roseAngle = t * (isSpeaking ? 0.9 : isListening ? 0.5 : 0.25);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(roseAngle);

          for (let p = 0; p < 5; p++) {
            ctx.save();
            ctx.rotate((p * Math.PI * 2) / 5);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(
              effectiveR * 0.3,
              -effectiveR * 0.4,
              effectiveR * 0.7,
              -effectiveR * 0.2,
              effectiveR * 0.6,
              effectiveR * 0.4
            );
            ctx.bezierCurveTo(
              effectiveR * 0.4,
              effectiveR * 0.6,
              effectiveR * 0.1,
              effectiveR * 0.3,
              0,
              0
            );
            ctx.fillStyle = p % 2 === 0 ? `rgba(253, 164, 175, ${0.45 + excitation})` : `rgba(244, 63, 94, ${0.35 + excitation})`;
            ctx.fill();
            ctx.strokeStyle = isSpeaking ? 'rgba(255, 241, 242, 0.7)' : 'rgba(255, 228, 230, 0.4)';
            ctx.lineWidth = isSpeaking ? 1.5 : 1;
            ctx.stroke();
            ctx.restore();
          }

          const budGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, effectiveR * (0.25 + excitation));
          budGrad.addColorStop(0, '#ffffff');
          budGrad.addColorStop(0.5, '#fb7185');
          budGrad.addColorStop(1, 'rgba(159, 18, 57, 0)');
          ctx.fillStyle = budGrad;
          ctx.beginPath();
          ctx.arc(0, 0, effectiveR * (0.25 + excitation), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }

        case 'blackhole': {
          baseGrad.addColorStop(0, '#1c1917');
          baseGrad.addColorStop(0.4, '#0c0a09');
          baseGrad.addColorStop(1, '#000000');
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, size, size);

          const bhAngle = t * (isSpeaking ? 3.2 : isListening ? 2.0 : 1.0);
          ctx.save();
          ctx.translate(cx, cy);

          // Back arc of accretion ring
          ctx.save();
          ctx.rotate(0.35);
          ctx.beginPath();
          ctx.ellipse(0, 0, effectiveR * 0.88, effectiveR * 0.32, bhAngle, Math.PI, Math.PI * 2);
          ctx.strokeStyle = isSpeaking ? '#f97316' : 'rgba(234, 88, 12, 0.75)';
          ctx.lineWidth = isSpeaking ? 5 : 4;
          ctx.shadowColor = '#ea580c';
          ctx.shadowBlur = isSpeaking ? 16 : 10;
          ctx.stroke();
          ctx.restore();

          // Black core
          const coreRadius = effectiveR * 0.5;
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
          ctx.fill();

          // Photon sphere ring
          ctx.strokeStyle = isSpeaking ? '#ffffff' : 'rgba(254, 215, 170, 0.85)';
          ctx.lineWidth = isSpeaking ? 2 : 1.5;
          ctx.shadowColor = '#f97316';
          ctx.shadowBlur = isSpeaking ? 10 : 6;
          ctx.stroke();

          // Front arc of accretion ring
          ctx.save();
          ctx.rotate(0.35);
          ctx.beginPath();
          ctx.ellipse(0, 0, effectiveR * 0.88, effectiveR * 0.32, bhAngle, 0, Math.PI);
          ctx.strokeStyle = isSpeaking ? '#ffffff' : 'rgba(255, 237, 213, 0.95)';
          ctx.lineWidth = isSpeaking ? 5.5 : 4.5;
          ctx.shadowColor = '#fdba74';
          ctx.shadowBlur = isSpeaking ? 18 : 12;
          ctx.stroke();
          ctx.restore();

          ctx.restore();
          break;
        }

        case 'plasma': {
          baseGrad.addColorStop(0, isSpeaking ? '#4c1d95' : '#2e1065');
          baseGrad.addColorStop(0.35, '#1e1b4b');
          baseGrad.addColorStop(0.7, '#0f172a');
          baseGrad.addColorStop(1, '#05020c');
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, size, size);

          // Central electrode
          const elecGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, effectiveR * (0.22 + excitation));
          elecGrad.addColorStop(0, '#ffffff');
          elecGrad.addColorStop(0.4, isSpeaking ? '#f472b6' : '#c026d3');
          elecGrad.addColorStop(1, '#4c1d95');
          ctx.fillStyle = elecGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, effectiveR * (0.22 + excitation), 0, Math.PI * 2);
          ctx.fill();

          // Filaments
          const filamentCount = isSpeaking ? 6 : isListening ? 5 : 3;
          for (let f = 0; f < filamentCount; f++) {
            const baseAngle = (f * Math.PI * 2) / filamentCount + (reduceMotion ? 0 : t * (isSpeaking ? 1.6 : 0.8));
            const targetX = cx + Math.cos(baseAngle) * (effectiveR * 0.9);
            const targetY = cy + Math.sin(baseAngle) * (effectiveR * 0.9);

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cx, cy);

            const segments = 6;
            for (let seg = 1; seg <= segments; seg++) {
              const fraction = seg / segments;
              const midX = cx + (targetX - cx) * fraction;
              const midY = cy + (targetY - cy) * fraction;
              const jitter = Math.sin(t * (isSpeaking ? 20 : 10) + f * 5 + seg * 2) * (effectiveR * 0.12 * (1 - fraction * 0.3));
              const perpX = -Math.sin(baseAngle) * jitter;
              const perpY = Math.cos(baseAngle) * jitter;
              ctx.lineTo(midX + perpX, midY + perpY);
            }

            ctx.strokeStyle = f % 2 === 0 ? 'rgba(56, 189, 248, 0.95)' : 'rgba(232, 121, 249, 0.95)';
            ctx.lineWidth = isSpeaking ? 2.2 : 1.5;
            ctx.shadowColor = f % 2 === 0 ? '#38bdf8' : '#e879f9';
            ctx.shadowBlur = isSpeaking ? 12 : 8;
            ctx.stroke();

            // Impact sparks
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(targetX, targetY, isSpeaking ? 3.5 : 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          break;
        }

        case 'emerald': {
          baseGrad.addColorStop(0, '#ffffff');
          baseGrad.addColorStop(0.2, isSpeaking ? '#6ee7b7' : '#34d399');
          baseGrad.addColorStop(0.5, '#059669');
          baseGrad.addColorStop(0.8, '#064e3b');
          baseGrad.addColorStop(1, '#022c1b');
          ctx.fillStyle = baseGrad;
          ctx.fillRect(0, 0, size, size);

          ctx.save();
          const facetRot = reduceMotion ? 0 : Math.sin(t * (isSpeaking ? 2 : 0.8)) * 0.08;
          ctx.translate(cx, cy);
          ctx.rotate(facetRot);

          const octR = effectiveR * 0.45;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const an = (i * Math.PI) / 4;
            const ox = Math.cos(an) * octR;
            const oy = Math.sin(an) * octR;
            if (i === 0) ctx.moveTo(ox, oy);
            else ctx.lineTo(ox, oy);
          }
          ctx.closePath();
          ctx.fillStyle = `rgba(167, 243, 208, ${0.25 + excitation})`;
          ctx.fill();
          ctx.strokeStyle = isSpeaking ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = isSpeaking ? 1.5 : 1;
          ctx.stroke();

          for (let k = 0; k < 8; k++) {
            const an1 = (k * Math.PI) / 4;
            const an2 = ((k + 1) * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(Math.cos(an1) * octR, Math.sin(an1) * octR);
            ctx.lineTo(Math.cos(an2) * octR, Math.sin(an2) * octR);
            ctx.lineTo(Math.cos((an1 + an2) / 2) * (effectiveR * 0.9), Math.sin((an1 + an2) / 2) * (effectiveR * 0.9));
            ctx.closePath();
            ctx.fillStyle = k % 2 === 0 ? 'rgba(5, 150, 105, 0.35)' : 'rgba(52, 211, 153, 0.2)';
            ctx.fill();
            ctx.strokeStyle = isSpeaking ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.35)';
            ctx.stroke();
          }

          const gleamAlpha = 0.5 + 0.4 * Math.sin(t * (isSpeaking ? 6 : 2.5));
          ctx.fillStyle = `rgba(253, 224, 71, ${gleamAlpha})`;
          ctx.beginPath();
          ctx.arc(-octR * 0.5, -octR * 0.5, isSpeaking ? 4.5 : 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          break;
        }
      }

      // -------------------------------------------------------------
      // 5. TOP-LEFT SPECULAR GLOSS HIGHLIGHT
      // -------------------------------------------------------------
      const glossGrad = ctx.createRadialGradient(
        cx - effectiveR * 0.35,
        cy - effectiveR * 0.38,
        1,
        cx - effectiveR * 0.35,
        cy - effectiveR * 0.38,
        effectiveR * 0.55
      );
      glossGrad.addColorStop(0, `rgba(255, 255, 255, ${0.75 + excitation})`);
      glossGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.25)');
      glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = glossGrad;
      ctx.beginPath();
      ctx.ellipse(
        cx - effectiveR * 0.35,
        cy - effectiveR * 0.38,
        effectiveR * 0.42,
        effectiveR * 0.28,
        -Math.PI / 6,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // -------------------------------------------------------------
      // 6. BOTTOM-RIGHT AMBIENT RIM BOUNCE LIGHT
      // -------------------------------------------------------------
      const rimGrad = ctx.createRadialGradient(
        cx + effectiveR * 0.5,
        cy + effectiveR * 0.5,
        effectiveR * 0.2,
        cx,
        cy,
        effectiveR
      );
      rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      rimGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.05)');
      rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
      ctx.fillStyle = rimGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, effectiveR, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore(); // end clip

      // -------------------------------------------------------------
      // 7. ENERGETIC SPEAKING/LISTENING RIM ACCENT
      // -------------------------------------------------------------
      if (isSpeaking || isListening) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, effectiveR, 0, Math.PI * 2);
        ctx.strokeStyle = isSpeaking
          ? currentStyle.accentColor
          : currentStyle.glowColor.replace(/[\d\.]+\)$/, '0.9)');
        ctx.lineWidth = isSpeaking ? 2.5 : 1.5;
        ctx.shadowColor = currentStyle.accentColor;
        ctx.shadowBlur = isSpeaking ? 10 : 5;
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore(); // end canvas transform

      if (!reduceMotion) {
        animId = requestAnimationFrame(drawOrb);
      }
    };

    animId = requestAnimationFrame(drawOrb);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [currentStyle, size, state, reduceMotion, dimmed]);

  // State-specific scale and box-shadow styling with 300ms transition
  const stateTransform = state === 'speaking' ? 'scale(1.05)' : state === 'listening' ? 'scale(1.06)' : 'scale(1.0)';

  const stateShadow = state === 'speaking'
    ? `0 0 ${Math.round(size * 0.35)}px ${currentStyle.glowColor}, 0 0 ${Math.round(size * 0.5)}px ${currentStyle.glowColor}`
    : state === 'listening'
    ? `0 0 ${Math.round(size * 0.3)}px ${currentStyle.glowColor}, 0 0 ${Math.round(size * 0.12)}px rgba(255,255,255,0.4)`
    : `0 0 ${Math.round(size * 0.2)}px ${currentStyle.glowColor}`;

  return (
    <div
      className={`relative rounded-full flex items-center justify-center shrink-0 ${dimmed ? 'grayscale opacity-60' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        background: currentStyle.fallbackGradient,
        boxShadow: stateShadow,
        transform: stateTransform,
        transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 300ms ease-out',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'block',
        }}
      />
    </div>
  );
};
