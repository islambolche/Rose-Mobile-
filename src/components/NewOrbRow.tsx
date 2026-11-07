import React, { useEffect, useRef, useState } from 'react';
import { Database, MessageSquare, Smile, Settings, Volume2, VolumeX, Square, Sparkles } from 'lucide-react';

export const NewOrbRow = ({
  sessionState,
  isSessionActive,
  isBackupMode,
  handleVoiceToggle,
  stopListening,
  isMuted,
  setIsMuted,
  setCurrentView,
  setIsSettingsModalOpen,
  userAudioLevel = 0,
  roseAudioLevel = 0,
  isMicLive = false,
  isAssistantEnabled = true,
  toggleMasterAssistant,
}: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [paths, setPaths] = useState<string[]>([]);
  const [dots, setDots] = useState<{ x: number; y: number }[]>([]);
  const particlesRef = useRef(
    Array.from({ length: 220 }, () => ({
      angle: Math.random() * Math.PI * 2,
      distance: Math.random() * 60,
      speed: 0.004 + Math.random() * 0.006,
      color: Math.random() > 0.3 ? '#e8d34a' : '#27d8e8'
    }))
  );

  const colors = {
    MEMORY: '#00b4ff',
    CHAT: '#ff6a00',
    SOUL: '#d8dce6',
    SETTINGS: '#22ff66'
  };

  useEffect(() => {
    const updatePaths = () => {
      if (!containerRef.current || !globeRef.current) return;
      const globeRect = globeRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const newPaths = buttonRefs.current.map((btn, i) => {
        if (!btn) return '';
        const btnRect = btn.getBoundingClientRect();
        const startX = btnRect.right - containerRect.left;
        const startY = btnRect.top + btnRect.height / 2 - containerRect.top;
        const endX = globeRect.left - containerRect.left;
        const endY = globeRect.top + globeRect.height / 2 - containerRect.top + (i - 1.5) * 5;
        return `M${startX} ${startY} H${startX + 10} C${startX + 20} ${startY}, ${endX - 10} ${endY}, ${endX} ${endY}`;
      });
      const newDots = buttonRefs.current.map((btn) => {
        if (!btn) return { x: 0, y: 0 };
        const btnRect = btn.getBoundingClientRect();
        return {
          x: btnRect.right - containerRect.left,
          y: btnRect.top + btnRect.height / 2 - containerRect.top
        };
      });
      setPaths(newPaths);
      setDots(newDots);
    };
    const observer = new ResizeObserver(updatePaths);
    if (containerRef.current) observer.observe(containerRef.current);
    updatePaths();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 160 * dpr;
    canvas.height = 160 * dpr;
    ctx.scale(dpr, dpr);

    let animId: number;
    const particles = particlesRef.current;

    const draw = (t: number) => {
      try {
        ctx.clearRect(0, 0, 160, 160);

        const activeState = sessionState || 'OFF';
        const isOff = activeState === 'OFF' || activeState === 'IDLE' || !isSessionActive;

        // Smooth active level based on who is speaking
        const activeLevel = activeState === 'SPEAKING' ? roseAudioLevel : (activeState === 'LISTENING' ? userAudioLevel : 0);
        const effectiveLevel = activeLevel > 5 ? activeLevel : 0;
        const scaleFactor = isOff ? 1 : (1 + (effectiveLevel / 100) * 0.22); // Reacts to audio level

        ctx.save();
        ctx.translate(80, 80);
        ctx.scale(scaleFactor, scaleFactor);
        ctx.translate(-80, -80);

        // Base Orb Radial Gradient
        const grad = ctx.createRadialGradient(80, 80, 0, 80, 80, 80);
        if (!isAssistantEnabled) {
          grad.addColorStop(0, '#0a0d14');
          grad.addColorStop(1, '#020610');
        } else if (isOff) {
          grad.addColorStop(0, '#0e2638');
          grad.addColorStop(1, '#020e1a');
        } else if (activeState === 'CONNECTING') {
          grad.addColorStop(0, '#713f12');
          grad.addColorStop(1, '#1a1003');
        } else if (activeState === 'THINKING') {
          grad.addColorStop(0, '#581c87');
          grad.addColorStop(1, '#130421');
        } else if (activeState === 'SPEAKING') {
          grad.addColorStop(0, '#831843');
          grad.addColorStop(1, '#0f172a');
        } else {
          // LISTENING
          grad.addColorStop(0, effectiveLevel > 0 ? '#0284c7' : '#0a4f55');
          grad.addColorStop(1, '#031a22');
        }

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(80, 80, 80, 0, Math.PI * 2);
        ctx.fill();

        // Outline
        ctx.strokeStyle = !isAssistantEnabled
          ? '#334155'
          : isOff
          ? 'rgba(39, 216, 232, 0.45)'
          : activeState === 'CONNECTING'
          ? '#eab308'
          : activeState === 'THINKING'
          ? '#c084fc'
          : activeState === 'SPEAKING'
          ? '#ec4899'
          : effectiveLevel > 0 ? '#38bdf8' : '#27d8e8';
        ctx.lineWidth = isOff ? 1.5 : (2 + (effectiveLevel / 100) * 3);
        ctx.stroke();

        // Render Rings & Particles (Full vibrant when ON, static & dimmed ~45% opacity when OFF)
        ctx.save();
        if (isOff || !isAssistantEnabled) {
          ctx.globalAlpha = isAssistantEnabled ? 0.45 : 0.2;
        }

        const timeVal = isOff ? 0 : t;
        const pulse = (!isOff && effectiveLevel > 0) ? (effectiveLevel / 100) * 12 : Math.sin(timeVal * 0.003) * 2;
        const ringRadius = 70 + pulse;

        // Rotating Ring 1
        ctx.strokeStyle = activeState === 'SPEAKING' ? '#f472b6' : '#27d8e8';
        ctx.lineWidth = isOff ? 1.2 : (1.5 + (effectiveLevel / 100) * 2);
        ctx.beginPath();
        ctx.ellipse(80, 80, ringRadius, 20 + pulse, timeVal * 0.002 * (1 + effectiveLevel / 40), 0, Math.PI * 2);
        ctx.stroke();

        // Rotating Ring 2
        ctx.strokeStyle = activeState === 'SPEAKING' ? '#c084fc' : '#e8d34a';
        ctx.lineWidth = isOff ? 1.2 : (1.5 + (effectiveLevel / 100) * 2);
        ctx.beginPath();
        ctx.ellipse(80, 80, ringRadius, 20 + pulse, timeVal * -0.002 * (1 + effectiveLevel / 40), 0, Math.PI * 2);
        ctx.stroke();

        // Particles (220 yellow & cyan dots)
        particles.forEach((p) => {
          if (!isOff && isAssistantEnabled) {
            p.angle += p.speed * (1 + (effectiveLevel / 100) * 2.5);
          }
          const dist = p.distance * (1 + (effectiveLevel / 100) * 0.15);
          const x = 80 + Math.cos(p.angle) * dist;
          const y = 80 + Math.sin(p.angle) * dist;
          ctx.fillStyle = activeState === 'SPEAKING' ? '#f472b6' : p.color;
          ctx.beginPath();
          ctx.arc(x, y, 1 + (effectiveLevel / 100), 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.restore(); // Restore globalAlpha

        ctx.restore(); // Restore transform scale

        // Status Text in Orb Canvas
        ctx.textAlign = 'center';
        ctx.font = 'bold 9px sans-serif';
        if (!isAssistantEnabled) {
          ctx.fillStyle = '#6b7280';
          ctx.fillText('• ASSISTANT OFF •', 80, 140);
        } else if (isOff) {
          ctx.fillStyle = '#27d8e8';
          ctx.fillText('• TAP TO TALK •', 80, 140);
        } else if (activeState === 'CONNECTING') {
          ctx.fillStyle = '#fef08a';
          ctx.fillText('• CONNECTING... •', 80, 140);
        } else if (activeState === 'GREETING') {
          ctx.fillStyle = '#f472b6';
          ctx.fillText('• SPEAKING... •', 80, 140);
        } else if (activeState === 'RECORDING') {
          ctx.fillStyle = '#38bdf8';
          ctx.fillText('• HEARING YOU... •', 80, 140);
        } else if (activeState === 'THINKING') {
          ctx.fillStyle = '#c084fc';
          ctx.fillText('• THINKING... •', 80, 140);
        } else if (activeState === 'SPEAKING') {
          ctx.fillStyle = '#f472b6';
          ctx.fillText('• SPEAKING... •', 80, 140);
        } else if (activeState === 'PAUSED') {
          ctx.fillStyle = '#f59e0b';
          ctx.fillText('• PAUSED •', 80, 140);
        } else {
          ctx.fillStyle = '#27d8e8';
          ctx.fillText('• LISTENING... •', 80, 140);
        }

        if (!isOff && isAssistantEnabled) {
          animId = requestAnimationFrame(draw);
        }
      } catch (e) {}
    };

    if (sessionState !== 'OFF' && isSessionActive && isAssistantEnabled) {
      animId = requestAnimationFrame(draw);
    } else {
      draw(0); // Render single static frame
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [sessionState, isSessionActive, userAudioLevel, roseAudioLevel, isAssistantEnabled]);

  return (
    <div ref={containerRef} className="relative w-full h-[230px] flex items-center justify-between pl-[8px] pr-[0]">
      <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 400 230">
        {paths.map((d, i) => (
          <React.Fragment key={i}>
            <path d={d} stroke={Object.values(colors)[i]} fill="none" strokeWidth="5" opacity="0.25" className="blur-[3px]" />
            <path d={d} stroke={Object.values(colors)[i]} fill="none" strokeWidth="2" strokeLinecap="round" />
          </React.Fragment>
        ))}
        {dots.map((dot, i) => (
          <circle key={i} cx={dot.x} cy={dot.y} r="4" fill={Object.values(colors)[i]} className="drop-shadow-[0_0_6px_currentColor]" style={{ color: Object.values(colors)[i] }} />
        ))}
      </svg>

      {/* Left Navigation Buttons */}
      <div className="flex flex-col gap-[10px] w-[38%] z-10">
        {[
          { label: 'MEMORY', icon: Database, color: colors.MEMORY },
          { label: 'CHAT', icon: MessageSquare, color: colors.CHAT },
          { label: 'SOUL', icon: Smile, color: colors.SOUL },
          { label: 'SETTINGS', icon: Settings, color: colors.SETTINGS }
        ].map((p, i) => (
          <button
            key={p.label}
            ref={(el) => { buttonRefs.current[i] = el; }}
            onClick={() =>
              i === 0
                ? setCurrentView('memory')
                : i === 1
                ? setCurrentView('chat')
                : i === 2
                ? setCurrentView('personality')
                : setIsSettingsModalOpen(true)
            }
            className="h-[38px] w-full rounded-full border-[1.5px] flex items-center gap-[8px] px-[6px] shadow-[0_0_8px_rgba(var(--color-rgb),0.5),inset_0_0_10px_rgba(var(--color-rgb),0.25)]"
            style={{ borderColor: p.color, backgroundColor: `${p.color}1f`, '--color-rgb': p.color.replace('#', '') } as any}
          >
            <div className="w-[24px] h-[24px] rounded-full border-[1.5px] flex items-center justify-center" style={{ borderColor: p.color }}>
              <p.icon className="w-[13px] h-[13px]" style={{ color: p.color }} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.04em]" style={{ color: p.color }}>
              {p.label}
            </span>
          </button>
        ))}
      </div>

      {/* Center Orb & Controls */}
      <div className="flex flex-col items-center z-10 pr-2">
        <div ref={globeRef} className="w-[160px] h-[160px] relative">
          <button onClick={handleVoiceToggle} className="w-full h-full outline-none focus:outline-none" title="Tap orb to toggle voice">
            <canvas ref={canvasRef} className="w-full h-full cursor-pointer" />
          </button>

          {/* Red Mic Indicator Dot */}
          {isMicLive && isAssistantEnabled && (
            <div className="absolute top-1 right-1 flex items-center gap-1 bg-red-950/80 border border-red-500/60 px-1.5 py-0.5 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)] pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[8px] font-black uppercase text-red-200 tracking-wider">MIC</span>
            </div>
          )}
        </div>

        {isBackupMode && isSessionActive && (
          <span className="text-[9px] font-bold text-amber-400 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded-full mt-1">
            Backup voice mode
          </span>
        )}

        {/* Master Assistant Switch Orb Button & STOP/Mute Controls */}
        <div className="flex items-center justify-center gap-2 mt-1">
          <button
            onClick={() => toggleMasterAssistant?.()}
            className={`relative w-8 h-8 rounded-full border-[1.5px] transition-all duration-300 flex items-center justify-center active:scale-95 ${
              isAssistantEnabled
                ? 'border-purple-400 bg-[#0B0F19] shadow-[0_0_12px_rgba(139,92,246,0.8)]'
                : 'border-slate-600 bg-slate-900 grayscale opacity-50 shadow-none'
            }`}
            title={isAssistantEnabled ? "Turn Assistant OFF" : "Turn Assistant ON"}
            aria-label="Master Switch"
          >
            <div className={`w-5 h-5 rounded-full border border-indigo-400/80 flex items-center justify-center transition-all ${
              isAssistantEnabled ? 'bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500' : 'bg-slate-700'
            }`}>
              <div className="w-2 h-2 rounded-full bg-white/40 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-white" />
              </div>
            </div>
            <Sparkles className={`w-2.5 h-2.5 absolute -top-0.5 -right-0.5 ${isAssistantEnabled ? 'text-amber-300 drop-shadow-[0_0_4px_rgba(252,211,77,0.8)]' : 'text-slate-500'}`} />
          </button>

          {isSessionActive && (
            <>
              <button
                onClick={stopListening}
                className="flex items-center gap-1 px-3 h-[28px] border-[1.5px] border-[#ff4d5e] rounded-full text-[#ff4d5e] text-[9px] font-black uppercase shadow-[0_0_8px_#ff4d5e40] active:scale-95 transition-transform"
              >
                <Square className="w-2.5 h-2.5 fill-current" /> STOP
              </button>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-1 h-[28px] w-[28px] rounded-full border-[1.5px] ${
                  isMuted ? 'border-red-500 bg-red-950/80 text-red-400' : 'border-[#2b8cff] bg-[#2b8cff] text-white'
                } flex items-center justify-center active:scale-95 transition-transform`}
                title={isMuted ? 'Unmute Rose' : 'Mute Rose'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
