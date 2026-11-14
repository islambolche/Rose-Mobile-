import React, { useState, useEffect, useRef } from "react";
import {
  OFFICE_AGENTS,
  OfficeAgentConfig,
  AgentPosition,
} from "./officeConfig";
import { officeEngine, AgentVisualState } from "./officeEngine";

export interface VirtualOfficeProps {
  className?: string;
  children?: React.ReactNode;
  isEditMode?: boolean;
  editTarget?: "seat" | "stand" | "label" | "route";
  selectedAgentId?: string;
  onSelectAgent?: (id: string) => void;
  customPositions?: Record<string, AgentPosition>;
  customSeatPositions?: Record<string, AgentPosition>;
  customLabelPositions?: Record<string, AgentPosition>;
  onPositionChange?: (agentId: string, updated: AgentPosition, target: "seat" | "stand" | "label") => void;
}

const SPEECH_BUBBLE_POSITIONS: Record<string, { x: number; y: number }> = {
  rose: { x: 50, y: 38 },
  arin: { x: 24, y: 22 },
  zayan: { x: 76, y: 22 },
  mira: { x: 13, y: 45 },
  naira: { x: 88, y: 45 },
};

export const VirtualOffice: React.FC<VirtualOfficeProps> = ({
  className = "",
  children,
}) => {
  const [states, setStates] = useState<Record<string, AgentVisualState>>(() =>
    officeEngine.getStates()
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageDimensions, setStageDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const unsubscribe = officeEngine.subscribe((updatedStates) => {
      setStates(updatedStates);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (!containerRef.current) return;
      const areaW = containerRef.current.clientWidth;
      const areaH = containerRef.current.clientHeight;
      if (areaW <= 0 || areaH <= 0) return;

      const imageAspect = 1672 / 941;
      const containerAspect = areaW / areaH;

      let width: number;
      let height: number;

      if (containerAspect > imageAspect) {
        height = areaH;
        width = Math.round(height * imageAspect);
      } else {
        width = areaW;
        height = Math.round(width / imageAspect);
      }

      setStageDimensions({
        width,
        height,
      });
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    window.addEventListener("resize", updateDimensions);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full m-0 p-0 border-0 rounded-none shadow-none flex items-center justify-center overflow-hidden bg-black select-none ${className}`}
    >
      {/* Blurred background filling empty space */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
        <img
          src="/office-robots.png"
          alt=""
          className="w-full h-full object-cover scale-110"
          style={{ filter: "blur(30px) brightness(0.45)" }}
        />
      </div>

      {/* Main stage keeping aspect ratio, showing whole image */}
      <div
        ref={stageRef}
        className="OfficeStage relative z-10 shrink-0 m-0 p-0 border-0 rounded-none shadow-none overflow-hidden bg-transparent select-none flex items-center justify-center"
        style={{
          width: stageDimensions.width > 0 ? `${stageDimensions.width}px` : "100%",
          height: stageDimensions.height > 0 ? `${stageDimensions.height}px` : "100%",
          aspectRatio: "1672 / 941",
        }}
      >
        <img
          src="/office-robots.png"
          alt="Rose AI Office"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none z-0"
        />

        {/* Speech bubbles for talking agents */}
        {Object.entries(OFFICE_AGENTS).map(([agentId]) => {
          const state = states[agentId];
          const pos = SPEECH_BUBBLE_POSITIONS[agentId] || { x: 50, y: 38 };
          if (!state?.bubbleText) return null;

          return (
            <div
              key={`bubble-${agentId}`}
              className="absolute z-[1200] -translate-x-1/2 -translate-y-full pointer-events-none animate-in fade-in zoom-in-95 duration-200"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              }}
            >
              <div className="relative w-max max-w-[210px] px-3 py-1.5 rounded-2xl bg-[#080318]/95 border border-purple-400/60 text-white shadow-[0_6px_30px_rgba(0,0,0,0.9)] backdrop-blur-md">
                <p className="text-[11px] font-semibold leading-snug text-center tracking-tight text-[#F3E8FF]">
                  {state.bubbleText}
                </p>
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#080318] border-r border-b border-purple-400/60 rotate-45" />
              </div>
            </div>
          );
        })}
      </div>

      {/* In-area Children (Orb, Camera preview, etc.) */}
      {children}
    </div>
  );
};
