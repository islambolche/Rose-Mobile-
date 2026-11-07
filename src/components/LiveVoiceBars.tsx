import React, { useEffect, useRef } from "react";

interface LiveVoiceBarsProps {
  inputAnalyserRef: React.RefObject<AnalyserNode | null>;
  outputAnalyserRef: React.RefObject<AnalyserNode | null>;
  sessionState: string;
  isAssistantEnabled?: boolean;
}

export const LiveVoiceBars: React.FC<LiveVoiceBarsProps> = ({
  inputAnalyserRef,
  outputAnalyserRef,
  sessionState,
  isAssistantEnabled = true,
}) => {
  const bar0Ref = useRef<HTMLDivElement>(null);
  const bar1Ref = useRef<HTMLDivElement>(null);
  const bar2Ref = useRef<HTMLDivElement>(null);
  const bar3Ref = useRef<HTMLDivElement>(null);
  const bar4Ref = useRef<HTMLDivElement>(null);
  const bar5Ref = useRef<HTMLDivElement>(null);

  const barsRef = [bar0Ref, bar1Ref, bar2Ref, bar3Ref, bar4Ref, bar5Ref];

  useEffect(() => {
    let animId: number;
    const colors = [
      "#a855f7", // purple
      "#ec4899", // pink
      "#38bdf8", // cyan
      "#10b981", // emerald
      "#f59e0b", // amber
      "#6366f1", // indigo
    ];

    const animate = (timestamp: number) => {
      const outputAnalyser = outputAnalyserRef.current;
      const inputAnalyser = inputAnalyserRef.current;

      let activeAnalyser: AnalyserNode | null = null;
      if (outputAnalyser) {
        activeAnalyser = outputAnalyser;
      } else if (inputAnalyser) {
        activeAnalyser = inputAnalyser;
      }

      let frequencies = [0, 0, 0, 0, 0, 0];
      let overallVol = 0;

      if (activeAnalyser && isAssistantEnabled) {
        const bufferLength = activeAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        activeAnalyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        overallVol = sum / (bufferLength * 255);

        // Sample 6 frequency bands across the spectrum
        const step = Math.max(1, Math.floor(bufferLength / 8));
        for (let i = 0; i < 6; i++) {
          const idx = Math.min(bufferLength - 1, (i + 1) * step);
          frequencies[i] = dataArray[idx] / 255;
        }
      }

      const isVoiceActive = overallVol > 0.02 || sessionState === "RECORDING" || sessionState === "SPEAKING" || sessionState === "LISTENING";

      barsRef.forEach((ref, i) => {
        const el = ref.current;
        if (!el) return;

        if (!isAssistantEnabled) {
          el.style.height = "6px";
          el.style.backgroundColor = "#334155";
          el.style.boxShadow = "none";
          el.style.opacity = "0.4";
          return;
        }

        if (isVoiceActive) {
          // Wave phase offset for organic ripple
          const wavePhase = Math.sin(timestamp * 0.007 + i * 0.85) * 0.22;
          const rawVal = Math.max(frequencies[i], overallVol * 0.85) + Math.max(0, wavePhase);
          const clampedVal = Math.min(1, Math.max(0, rawVal));

          const height = Math.round(6 + clampedVal * 28); // 6px to 34px
          const color = colors[i];

          el.style.height = `${height}px`;
          el.style.backgroundColor = color;
          el.style.boxShadow = clampedVal > 0.08
            ? `0 0 ${Math.round(6 + clampedVal * 12)}px ${color}`
            : `0 0 3px ${color}`;
          el.style.opacity = "1";
        } else {
          // Silent state: small 6px dots with subtle idle breath
          const idleWave = Math.sin(timestamp * 0.003 + i * 0.6) * 1.2;
          const height = Math.round(Math.max(5, 6 + idleWave));
          el.style.height = `${height}px`;
          el.style.backgroundColor = "#64748b";
          el.style.boxShadow = "none";
          el.style.opacity = "0.6";
        }
      });

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [inputAnalyserRef, outputAnalyserRef, sessionState, isAssistantEnabled]);

  return (
    <div className="mt-2 flex items-center justify-center gap-1.5 h-9 px-2">
      {barsRef.map((ref, i) => (
        <div
          key={i}
          ref={ref}
          className="w-1.5 rounded-full transition-all duration-75 ease-out"
          style={{ height: "6px", backgroundColor: "#64748b" }}
        />
      ))}
    </div>
  );
};
