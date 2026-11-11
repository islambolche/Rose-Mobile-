import React, { useState, useEffect, useRef } from "react";
import {
  OFFICE_AGENTS,
  OfficeAgentConfig,
  AgentPosition,
} from "./officeConfig";
import { officeEngine, AgentVisualState } from "./officeEngine";

// Exact stage percentages for hips anchor (bottom center of top 56% sprite)
export const SEAT_POSITIONS: Record<string, AgentPosition> = {
  arin: { x: 23.9, y: 35.3 },
  zayan: { x: 75.8, y: 35.3 },
  rose: { x: 49.9, y: 52.1 },
  mira: { x: 12.3, y: 57.9 },
  naira: { x: 89.0, y: 59.5 },
};

export interface VirtualOfficeProps {
  className?: string;
  children?: React.ReactNode;
  isEditMode?: boolean;
  editTarget?: "seat" | "stand";
  selectedAgentId?: string;
  onSelectAgent?: (id: string) => void;
  customPositions?: Record<string, AgentPosition>;
  customSeatPositions?: Record<string, AgentPosition>;
  onPositionChange?: (agentId: string, updated: AgentPosition, target: "seat" | "stand") => void;
}

export const VirtualOffice: React.FC<VirtualOfficeProps> = ({
  className = "",
  children,
}) => {
  const [states, setStates] = useState<Record<string, AgentVisualState>>(() =>
    officeEngine.getStates()
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
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

  // Compute exact fixed 1672 / 941 aspect ratio to fill available center space
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth <= 0 || clientHeight <= 0) return;

      const targetRatio = 1672 / 941;
      const currentRatio = clientWidth / clientHeight;

      let width = clientWidth;
      let height = clientHeight;

      if (currentRatio > targetRatio) {
        height = clientHeight;
        width = height * targetRatio;
      } else {
        width = clientWidth;
        height = width / targetRatio;
      }

      setStageDimensions({
        width: Math.floor(width),
        height: Math.floor(height),
      });
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const renderAgent = (agentId: string) => {
    const agent: OfficeAgentConfig = OFFICE_AGENTS[agentId];
    if (!agent) return null;

    const seatPos = SEAT_POSITIONS[agent.id] || { x: 50, y: 60 };
    const state: AgentVisualState = states[agent.id] || {
      id: agent.id,
      x: seatPos.x,
      y: seatPos.y,
      facing: agent.initialFacing,
      isWalking: false,
      isWorking: false,
      isSeated: true,
      bubbleText: null,
    };

    const isSeated = state.isSeated && !state.isWalking;
    const isBackDesk = agent.id === "arin" || agent.id === "zayan";
    const baseStandingHeight = isBackDesk ? 22 : 30; // % of stage height
    const renderHeightPercent = isSeated
      ? baseStandingHeight * 0.56 // top 56% head to hips
      : baseStandingHeight;

    const posX = isSeated ? seatPos.x : state.x;
    const posY = isSeated ? seatPos.y : state.y;
    const isFlipped = state.facing === "left";

    // Depth: seated sprites sit at their natural depth; walking/standing sprites sort by feet Y
    const seatedZIndexMap: Record<string, number> = {
      arin: 10,
      zayan: 30,
      rose: 50,
      mira: 70,
      naira: 90,
    };
    const zIndex = isSeated ? (seatedZIndexMap[agent.id] || 25) : Math.round(posY);

    return (
      <div
        key={`sprite-${agent.id}`}
        className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center justify-end pointer-events-none transition-opacity duration-300"
        style={{
          left: `${posX}%`,
          top: `${posY}%`,
          height: `${renderHeightPercent}%`,
          zIndex,
        }}
      >
        {/* Speech Bubble */}
        {state.bubbleText && (
          <div className="absolute bottom-[110%] left-1/2 -translate-x-1/2 z-50 mb-1 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
            <div className="relative max-w-[210px] px-3 py-1.5 rounded-2xl bg-[#090518]/95 border border-purple-400/50 text-white shadow-[0_4px_24px_rgba(0,0,0,0.85)] backdrop-blur-md">
              <p className="text-[11px] font-semibold leading-snug line-clamp-2 text-center" style={{ color: "#F3E8FF" }}>
                {state.bubbleText}
              </p>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#090518] border-r border-b border-purple-400/50 rotate-45" />
            </div>
          </div>
        )}

        {/* Working / Typing Indicator */}
        {state.isWorking && !state.bubbleText && (
          <div className="absolute bottom-[106%] left-1/2 -translate-x-1/2 mb-1 z-40 pointer-events-none">
            <div className="px-2 py-0.5 rounded-full bg-[#0F172A]/90 border border-emerald-400/50 flex items-center gap-1 shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[8px] font-bold text-emerald-300 uppercase ml-0.5">Working</span>
            </div>
          </div>
        )}

        {/* Small Name Tag Pill just above head */}
        <div className="absolute bottom-[102%] left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/85 border border-white/10 shadow-sm whitespace-nowrap z-30">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              backgroundColor: state.isWorking ? "#10B981" : agent.color,
              boxShadow: `0 0 6px ${state.isWorking ? "#10B981" : agent.color}`,
            }}
          />
          <span className="text-[8.5px] font-black uppercase tracking-wider text-white">
            {agent.name}
          </span>
        </div>

        {/* Sprite Graphic */}
        {isSeated ? (
          /* Seated Sprite: Show top 56% of standing PNG (head to hips) */
          <div
            className="relative w-full h-full overflow-hidden flex items-start justify-center animate-idle-breathe"
            style={{
              transform: isFlipped ? "scaleX(-1)" : "scaleX(1)",
              transformOrigin: "bottom center",
            }}
          >
            <img
              src={agent.image}
              alt={agent.name}
              className="pointer-events-none select-none max-w-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
              style={{
                height: "178.57%", // 100 / 0.56
                width: "auto",
                maxHeight: "none",
                objectFit: "cover",
                objectPosition: "top center",
              }}
            />
          </div>
        ) : (
          /* Standing Sprite: Full body */
          <div
            className={`relative flex items-center justify-center h-full w-auto ${
              state.isWalking ? "animate-walk-bob" : "animate-idle-breathe"
            }`}
            style={{
              transform: isFlipped ? "scaleX(-1)" : "scaleX(1)",
              transformOrigin: "bottom center",
            }}
          >
            <img
              src={agent.image}
              alt={agent.name}
              className="h-full w-auto object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)] pointer-events-none select-none"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex items-center justify-center p-2 sm:p-3 overflow-hidden select-none ${className}`}
    >
      {/* 1) Fixed aspect ratio OfficeStage (1672 / 941), as large as possible */}
      <div
        className="OfficeStage relative rounded-[16px] overflow-hidden border border-purple-500/30 shadow-[0_0_40px_rgba(168,85,247,0.22)] bg-[#070314] select-none"
        style={{
          width: stageDimensions.width > 0 ? `${stageDimensions.width}px` : "100%",
          height: stageDimensions.height > 0 ? `${stageDimensions.height}px` : "auto",
          aspectRatio: "1672 / 941",
        }}
      >
        {/* Layer 0: Full office background */}
        <img
          src="/office/office-bg.jpg"
          alt="Office Background"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-0"
        />

        {/* EXACT Back-to-Front Order:
            Arin seated sprite → desk-arin.png →
            Zayan seated sprite → desk-zayan.png →
            Rose seated sprite → desk-rose.png →
            Mira seated sprite → desk-mira.png →
            Naira seated sprite → desk-naira.png */}

        {/* 1. Arin */}
        {renderAgent("arin")}
        <img
          src="/office/desk-arin.png"
          alt="Desk Arin"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-20"
        />

        {/* 2. Zayan */}
        {renderAgent("zayan")}
        <img
          src="/office/desk-zayan.png"
          alt="Desk Zayan"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-40"
        />

        {/* 3. Rose */}
        {renderAgent("rose")}
        <img
          src="/office/desk-rose.png"
          alt="Desk Rose"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-60"
        />

        {/* 4. Mira */}
        {renderAgent("mira")}
        <img
          src="/office/desk-mira.png"
          alt="Desk Mira"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-80"
        />

        {/* 5. Naira */}
        {renderAgent("naira")}
        <img
          src="/office/desk-naira.png"
          alt="Desk Naira"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-100"
        />

        {/* In-stage Children (Orb at bottom center, Live Camera preview at bottom right) */}
        {children}
      </div>

      <style>{`
        @keyframes walkBob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
        @keyframes idleBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.012); }
        }
        .animate-walk-bob {
          animation: walkBob 0.3s ease-in-out infinite;
        }
        .animate-idle-breathe {
          animation: idleBreathe 3.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
