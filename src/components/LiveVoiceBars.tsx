import React, { useEffect } from "react";

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
  useEffect(() => {
    let animId: number;
    const barsContainer = document.getElementById("voice-bars-container");
    if (!barsContainer) return;

    // Create 6 bar elements
    const barElements: HTMLDivElement[] = [];
    barsContainer.innerHTML = '';
    for(let i=0; i<6; i++) {
        const bar = document.createElement('div');
        bar.className = 'rounded-full transition-none';
        bar.style.width = '6px';
        bar.style.height = '6px';
        bar.style.backgroundColor = '#64748b';
        barsContainer.appendChild(bar);
        barElements.push(bar);
    }

    const orb = document.getElementById("live-orb-element");

    let smooth = 0;
    const factors = [0.6, 0.85, 1, 1, 0.85, 0.6];

    const animate = () => {
      const outputAnalyser = outputAnalyserRef.current;
      const inputAnalyser = inputAnalyserRef.current;
      
      let inLevel = 0;
      if (inputAnalyser) {
        const data = new Uint8Array(inputAnalyser.frequencyBinCount);
        inputAnalyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i=0; i<data.length; i++) sum += data[i];
        inLevel = sum / (data.length * 255);
      }
      
      let outLevel = 0;
      if (outputAnalyser) {
        const data = new Uint8Array(outputAnalyser.frequencyBinCount);
        outputAnalyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i=0; i<data.length; i++) sum += data[i];
        outLevel = sum / (data.length * 255);
      }

      const rawLevel = Math.max(inLevel, outLevel) * 2.5;
      const targetLevel = Math.min(1, rawLevel);
      smooth += (targetLevel - smooth) * 0.35;

      // Update Orb
      if (orb) {
        orb.style.transform = `scale(${1 + smooth * 0.3})`;
        orb.style.boxShadow = `0 0 ${20 + smooth * 60}px ${sessionState === 'SPEAKING' ? '#ec4899' : '#8b5cf6'}`;
        orb.style.filter = `brightness(${1 + smooth * 0.6})`;
      }

      // Update Bars
      const isSpeaking = outLevel > 0.05;
      const isUserSpeaking = inLevel > 0.05;
      
      barElements.forEach((bar, i) => {
        const wobble = (Math.random() - 0.5) * 0.3;
        const height = 6 + (smooth * 38 * factors[i]) + (wobble * 5);
        bar.style.height = `${Math.max(6, height)}px`;
        
        let color = '#64748b';
        if (smooth > 0.01) {
            color = isSpeaking ? '#f472b6' : (isUserSpeaking ? '#60a5fa' : '#8b5cf6');
        }
        bar.style.backgroundColor = color;
        bar.style.boxShadow = smooth > 0.05 ? `0 0 10px ${color}` : 'none';
      });

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [inputAnalyserRef, outputAnalyserRef, sessionState]);

  return (
    <div id="voice-bars-container" className="mt-2 flex items-center justify-center gap-1.5 h-[50px] px-2">
      {/* Bars injected by useEffect */}
    </div>
  );
};
