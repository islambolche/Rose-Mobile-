import React, { useState, useEffect, useRef } from "react";
import officeBgClean from "../../../assets/images/office_bg_clean_1794564680261.jpg";
import {
  OFFICE_AGENTS,
  OfficeAgentConfig,
  AgentPosition,
  DEFAULT_LABEL_POSITIONS,
  DEFAULT_SEAT_POSITIONS,
  DEFAULT_STAND_POSITIONS,
  DESK_BENGALI_NAMES,
  DESK_GLOW_COLORS,
  calculatePerspectiveHeight,
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

export const VirtualOffice: React.FC<VirtualOfficeProps> = ({
  className = "",
  children,
  isEditMode = false,
  editTarget = "seat",
  selectedAgentId = "rose",
  onSelectAgent,
  customPositions,
  customSeatPositions,
  customLabelPositions,
  onPositionChange,
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

  const [labelPositions, setLabelPositions] = useState<Record<string, AgentPosition & { width?: number }>>(() => ({
    ...DEFAULT_LABEL_POSITIONS,
  }));

  useEffect(() => {
    const unsubscribe = officeEngine.subscribe((updatedStates) => {
      setStates(updatedStates);
    });
    return unsubscribe;
  }, []);

  // Scale fixed 1672 / 941 stage to COVER the container area (no empty gaps on any side)
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (!containerRef.current) return;
      const areaW = containerRef.current.clientWidth;
      const areaH = containerRef.current.clientHeight;
      if (areaW <= 0 || areaH <= 0) return;

      const width = Math.ceil(Math.max(areaW, (areaH * 1672) / 941));
      const height = Math.ceil((width * 941) / 1672);

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

  const handleDragStart = (
    e: React.PointerEvent,
    agentId: string,
    target: "seat" | "stand" | "label",
    currentPos: AgentPosition
  ) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();

    const stage = stageRef.current;
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startPosX = currentPos.x;
    const startPosY = currentPos.y;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startClientX;
      const dy = moveEvent.clientY - startClientY;
      const dxPercent = (dx / rect.width) * 100;
      const dyPercent = (dy / rect.height) * 100;

      const newX = Math.min(98, Math.max(2, Math.round((startPosX + dxPercent) * 10) / 10));
      const newY = Math.min(98, Math.max(5, Math.round((startPosY + dyPercent) * 10) / 10));

      const updated: AgentPosition = { ...currentPos, x: newX, y: newY };
      if (target === "label") {
        setLabelPositions((prev) => ({ ...prev, [agentId]: updated }));
      }
      onPositionChange?.(agentId, updated, target);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  useEffect(() => {
    const agentIds = ["rose", "mira", "arin", "zayan", "naira"];
    agentIds.forEach((id) => {
      const count = document.querySelectorAll(`[data-agent-id="${id}"]`).length;
      if (count > 1) {
        console.error("DUPLICATE AGENT", id);
      }
    });
  });

  /**
   * Render EXACTLY ONE sprite element per agent id.
   * Pose state: "seated" | "standing" | "walking".
   * Seated renders upper-body crop behind the desk; standing/walking renders full sprite on floor.
   */
  const renderAgent = (agentId: string) => {
    const agent: OfficeAgentConfig = OFFICE_AGENTS[agentId];
    if (!agent) return null;

    const seatPos = customSeatPositions?.[agent.id] || DEFAULT_SEAT_POSITIONS[agent.id] || { x: 50, y: 60 };
    const standPos = customPositions?.[agent.id] || DEFAULT_STAND_POSITIONS[agent.id];
    const state: AgentVisualState = states[agent.id] || {
      id: agent.id,
      status: "seated",
      x: seatPos.x,
      y: seatPos.y,
      facing: agent.initialFacing,
      isWalking: false,
      isWorking: false,
      isSeated: true,
      bubbleText: null,
    };

    const isEditingStand = Boolean(isEditMode && editTarget === "stand");
    const effectiveStatus = isEditingStand ? "standing" : state.status;
    const isSeated = effectiveStatus === "seated";
    const isWalking = effectiveStatus === "walking";

    const posX = isSeated ? seatPos.x : (isEditingStand && standPos ? standPos.x : state.x);
    const posY = isSeated ? seatPos.y : (isEditingStand && standPos ? standPos.y : state.y);

    const scaleMultiplier = isSeated
      ? seatPos.scale ?? 1.0
      : isWalking
      ? 1.0
      : standPos?.scale ?? 1.0;

    // Perspective height: smaller further back (smaller y), larger in front (larger y)
    const fullHeightPercent = calculatePerspectiveHeight(posY) * scaleMultiplier;
    const renderHeightPercent = isSeated
      ? agent.id === "rose"
        ? 18 * scaleMultiplier
        : fullHeightPercent * 0.56
      : fullHeightPercent;

    // Depth sorting: zIndex = Math.round(posY * 10)
    const zIndex = isSeated
      ? Math.round(seatPos.y * 10)
      : Math.round(posY * 10);

    const isFlipped = state.facing === "left";
    const isSelected = isEditMode && (editTarget === "seat" || editTarget === "stand") && selectedAgentId === agentId;
    const isSpeaking = Boolean(state.bubbleText);

    const bodyAnimClass = isWalking
      ? "animate-walk-bob"
      : isSpeaking
      ? "animate-talk-nod"
      : "animate-idle-breathe";

    const useDedicatedSeatedSprite = Boolean(isSeated && agent.seatedImage);
    const activeImageSrc = useDedicatedSeatedSprite && agent.seatedImage ? agent.seatedImage : agent.image;

    return (
      <div
        key={`sprite-agent-${agent.id}`}
        data-agent-id={agent.id}
        data-agent-state={effectiveStatus}
        className={`absolute -translate-x-1/2 -translate-y-full flex flex-col items-center justify-end select-none ${
          isEditMode && (editTarget === "seat" || editTarget === "stand")
            ? "cursor-grab active:cursor-grabbing pointer-events-auto"
            : "pointer-events-none"
        }`}
        style={{
          left: `${posX}%`,
          top: `${posY}%`,
          height: `${renderHeightPercent}%`,
          zIndex: isSelected ? 1100 : zIndex,
        }}
        onPointerDown={(e) => {
          if (!isEditMode) return;
          onSelectAgent?.(agentId);
          handleDragStart(
            e,
            agentId,
            editTarget === "seat" ? "seat" : "stand",
            isSeated ? seatPos : (standPos || { x: posX, y: posY })
          );
        }}
      >
        {/* Speech Bubble */}
        {state.bubbleText && (
          <div className="absolute bottom-[108%] left-1/2 -translate-x-1/2 z-[1200] mb-1 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
            <div className="relative w-max max-w-[210px] px-3 py-1.5 rounded-2xl bg-[#080318]/95 border border-purple-400/60 text-white shadow-[0_6px_30px_rgba(0,0,0,0.9)] backdrop-blur-md">
              <p className="text-[11px] font-semibold leading-snug text-center tracking-tight" style={{ color: "#F3E8FF" }}>
                {state.bubbleText}
              </p>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#080318] border-r border-b border-purple-400/60 rotate-45" />
            </div>
          </div>
        )}

        {/* Working / Typing Indicator */}
        {state.isWorking && !state.bubbleText && (
          <div className="absolute bottom-[106%] left-1/2 -translate-x-1/2 mb-1 z-40 pointer-events-none">
            <div className="px-2 py-0.5 rounded-full bg-[#0F172A]/90 border border-emerald-400/60 flex items-center gap-1 shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[8px] font-bold text-emerald-300 uppercase ml-0.5">Working</span>
            </div>
          </div>
        )}

        {/* Edit Selection Indicator Ring */}
        {isSelected && (
          <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-purple-400 pointer-events-none animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
        )}

        {/* Single Image Element per agent: Seated Sprite when isSeated, Standing/Walking Sprite otherwise */}
        <div
          className="h-full w-auto flex justify-center transition-transform duration-200"
          style={{
            transform: isFlipped ? "scaleX(-1)" : "scaleX(1)",
            transformOrigin: "bottom center",
          }}
        >
          <div
            className={`relative flex justify-center h-full w-auto ${
              isSeated && !useDedicatedSeatedSprite
                ? `overflow-hidden items-start ${bodyAnimClass}`
                : `items-end ${bodyAnimClass}`
            }`}
          >
            <img
              src={activeImageSrc}
              alt={agent.name}
              referrerPolicy="no-referrer"
              className={
                isSeated && !useDedicatedSeatedSprite
                  ? "pointer-events-none select-none max-w-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
                  : "h-full w-auto object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)] pointer-events-none select-none"
              }
              style={
                isSeated && !useDedicatedSeatedSprite
                  ? {
                      height: "178.57%", // 100 / 0.56
                      width: "auto",
                      maxHeight: "none",
                      objectFit: "cover",
                      objectPosition: "top center",
                    }
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    );
  };

  /**
   * Render Bengali agent name on the BACK of that agent's laptop/monitor lid.
   * Plain, sharp, flat colour text centered on the lid back.
   */
  const renderDeskLabel = (agentId: string) => {
    const pos = DEFAULT_LABEL_POSITIONS[agentId] || { x: 50, y: 50 };
    const bengaliName = DESK_BENGALI_NAMES[agentId] || agentId;
    const labelColor = DESK_GLOW_COLORS[agentId]?.color || "#FFFFFF";

    return (
      <span
        key={`desk-label-${agentId}`}
        data-agent-label={agentId}
        lang="bn"
        className="pointer-events-none select-none"
        style={{
          position: "absolute",
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          transform: "translate(-50%, -50%)",
          zIndex: 1050,
          pointerEvents: "none",
          fontFamily: '"Noto Sans Bengali", sans-serif',
          fontWeight: 700,
          fontStyle: "normal",
          fontSize: "clamp(12px, 1.15vw, 20px)",
          lineHeight: 1,
          whiteSpace: "nowrap",
          textAlign: "center",
          color: labelColor,
          background: "transparent",
          border: "none",
          boxShadow: "none",
          textShadow: "none",
          filter: "none",
          animation: "none",
        }}
      >
        {bengaliName}
      </span>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full m-0 p-0 border-0 rounded-none shadow-none flex items-center justify-center overflow-hidden bg-[#020617] select-none ${className}`}
    >
      {/* 1) Single inner stage with 1672:941 aspect ratio scaled to cover container */}
      <div
        ref={stageRef}
        className="OfficeStage relative shrink-0 m-0 p-0 border-0 rounded-none shadow-none overflow-hidden bg-[#020617] select-none"
        style={{
          width: stageDimensions.width > 0 ? `${stageDimensions.width}px` : "100%",
          height: stageDimensions.height > 0 ? `${stageDimensions.height}px` : "100%",
          aspectRatio: "1672 / 941",
        }}
      >
        {/* Layer 0: Clean office background (empty chairs, no baked-in people) */}
        <img
          src={officeBgClean}
          alt="Office Background"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-0"
        />

        {/* DESK OVERLAYS sorted by depth:
            Desk Arin: y=53 (z-530)
            Desk Zayan: y=53 (z-530)
            Desk Rose: y=79 (z-790)
            Desk Mira: y=87 (z-870)
            Desk Naira: y=88 (z-880) */}

        <img
          src="/office/desk-arin.png"
          alt="Desk Arin"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-[530]"
        />
        <img
          src="/office/desk-zayan.png"
          alt="Desk Zayan"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-[530]"
        />
        <img
          src="/office/desk-rose.png"
          alt="Desk Rose"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-[790]"
        />
        <img
          src="/office/desk-mira.png"
          alt="Desk Mira"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-[870]"
        />
        <img
          src="/office/desk-naira.png"
          alt="Desk Naira"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-[880]"
        />

        {/* 5 Agent Sprites (Each renders EXACTLY ONE element with dynamic zIndex based on Y) */}
        {renderAgent("arin")}
        {renderAgent("zayan")}
        {renderAgent("rose")}
        {renderAgent("mira")}
        {renderAgent("naira")}

        {/* Laptop/Monitor Back Bengali Name Labels (ABOVE desk overlays and ABOVE characters) */}
        {renderDeskLabel("arin")}
        {renderDeskLabel("zayan")}
        {renderDeskLabel("rose")}
        {renderDeskLabel("mira")}
        {renderDeskLabel("naira")}
      </div>

      {/* Soft ~40px inner vignette on all 4 sides so the office blends naturally into the dark background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none select-none z-[1080]"
        style={{
          background: [
            "linear-gradient(to bottom, #020617 0px, rgba(2, 6, 23, 0) 40px)",
            "linear-gradient(to top, #020617 0px, rgba(2, 6, 23, 0) 40px)",
            "linear-gradient(to right, #020617 0px, rgba(2, 6, 23, 0) 40px)",
            "linear-gradient(to left, #020617 0px, rgba(2, 6, 23, 0) 40px)",
          ].join(", "),
          boxShadow: "inset 0 0 36px 8px #020617",
        }}
      />

      {/* In-area Children (Orb at bottom center, Live Camera preview at bottom right) */}
      {children}

      <style>{`
        @keyframes walkBob {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-2.2%); }
        }
        @keyframes talkNod {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-1%) scale(1.018); }
        }
        @keyframes idleBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.012); }
        }
        .animate-walk-bob {
          animation: walkBob 0.36s ease-in-out infinite;
        }
        .animate-talk-nod {
          animation: talkNod 0.7s ease-in-out infinite;
        }
        .animate-idle-breathe {
          animation: idleBreathe 3.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

