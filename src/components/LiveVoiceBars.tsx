import React, { useEffect, useRef } from "react";

interface LiveVoiceBarsProps {
  inputAnalyserRef: React.RefObject<AnalyserNode | null>;
  outputAnalyserRef: React.RefObject<AnalyserNode | null>;
  sessionState: string;
  isAssistantEnabled?: boolean;
  isBrowserSpeechActive?: () => boolean;
  getNativeMicLevel?: () => number;
}

export const LiveVoiceBars: React.FC<LiveVoiceBarsProps> = ({
  inputAnalyserRef,
  outputAnalyserRef,
  sessionState,
  isAssistantEnabled = true,
  isBrowserSpeechActive,
  getNativeMicLevel,
}) => {
  const sessionStateRef = useRef(sessionState);
  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  const isEnabledRef = useRef(isAssistantEnabled);
  useEffect(() => {
    isEnabledRef.current = isAssistantEnabled;
  }, [isAssistantEnabled]);

  const browserSpeechFnRef = useRef(isBrowserSpeechActive);
  useEffect(() => {
    browserSpeechFnRef.current = isBrowserSpeechActive;
  }, [isBrowserSpeechActive]);

  const nativeMicLevelFnRef = useRef(getNativeMicLevel);
  useEffect(() => {
    nativeMicLevelFnRef.current = getNativeMicLevel;
  }, [getNativeMicLevel]);

  useEffect(() => {
    let animId: number;
    const barsContainer = document.getElementById("voice-bars-container");
    if (!barsContainer) return;

    const barElements: HTMLDivElement[] = [];
    barsContainer.innerHTML = "";
    for (let i = 0; i < 6; i++) {
      const bar = document.createElement("div");
      bar.className = "rounded-full transition-none";
      bar.style.width = "6px";
      bar.style.height = "6px";
      bar.style.backgroundColor = "#14b8a6";
      barsContainer.appendChild(bar);
      barElements.push(bar);
    }

    let smooth = 0;
    const waveFactors = [0.55, 0.85, 1.0, 0.95, 0.8, 0.5];
    const phaseOffsets = [0, 0.9, 1.8, 2.7, 3.6, 4.5];

    const animate = () => {
      const state = sessionStateRef.current;
      const isSpeakingState = state === "SPEAKING" || state === "GREETING";
      const isThinkingState = state === "THINKING";

      const outputAnalyser = outputAnalyserRef.current;
      const inputAnalyser = inputAnalyserRef.current;

      let inLevel = 0;
      if (inputAnalyser && isEnabledRef.current) {
        const data = new Uint8Array(inputAnalyser.frequencyBinCount);
        inputAnalyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        inLevel = sum / (data.length * 255);
      }
      if (isEnabledRef.current && nativeMicLevelFnRef.current) {
        const nativeLevel = nativeMicLevelFnRef.current() || 0;
        if (nativeLevel > inLevel) {
          inLevel = nativeLevel;
        }
      }

      let outLevel = 0;
      if (outputAnalyser) {
        const data = new Uint8Array(outputAnalyser.frequencyBinCount);
        outputAnalyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        outLevel = sum / (data.length * 255);
      }

      const now = performance.now() / 1000;
      const browserSpeaking = browserSpeechFnRef.current ? browserSpeechFnRef.current() : false;

      let rawLevel = Math.max(inLevel, outLevel) * 2.8;
      if (isSpeakingState && outLevel < 0.02 && browserSpeaking) {
        // Gentle organic pulse when browser speechSynthesis is speaking
        rawLevel = 0.35 + 0.25 * Math.sin(now * 8);
      } else if (isThinkingState && rawLevel < 0.1) {
        // Subtle thinking breathing wave
        rawLevel = 0.18 + 0.1 * Math.sin(now * 5);
      }

      const targetLevel = Math.min(1, Math.max(0, rawLevel));
      smooth += (targetLevel - smooth) * 0.35;

      // State colors:
      // Listening = Teal/Cyan (#14b8a6 / #2dd4bf)
      // Thinking = Purple (#a855f7)
      // Speaking = Pink (#ec4899 / #f472b6)
      let activeColor = "#14b8a6";
      if (isSpeakingState || outLevel > 0.04) {
        activeColor = "#ec4899";
      } else if (isThinkingState) {
        activeColor = "#a855f7";
      } else {
        activeColor = "#14b8a6";
      }

      barElements.forEach((bar, i) => {
        const wave = Math.sin(now * 10 + phaseOffsets[i]) * 0.35 + 0.65;
        const dynamicHeight =
          smooth > 0.015
            ? 6 + smooth * 38 * waveFactors[i] * wave
            : 6;
        bar.style.height = `${Math.max(6, Math.round(dynamicHeight))}px`;
        bar.style.backgroundColor = activeColor;
        bar.style.opacity = smooth > 0.015 || isThinkingState ? "1" : "0.75";
        bar.style.boxShadow =
          smooth > 0.03 ? `0 0 10px ${activeColor}` : "none";
      });

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [inputAnalyserRef, outputAnalyserRef]);

  return (
    <div
      id="voice-bars-container"
      className="flex items-center justify-center gap-2 h-[46px] px-2"
    />
  );
};
