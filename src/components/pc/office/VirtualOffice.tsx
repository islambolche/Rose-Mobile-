import React, { useState, useEffect, useRef } from "react";
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
  loadOfficeLabelPositions,
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

  const [labelPositions, setLabelPositions] = useState<Record<string, AgentPosition>>(() =>
    loadOfficeLabelPositions()
  );

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
    // Dev-only check: after each render, count elements with data-agent-id per agent; if > 1, console.error("DUPLICATE AGENT", id)
    const agentIds = ["rose", "mira", "arin", "zayan", "naira"];
    agentIds.forEach((id) => {
      const count = document.querySelectorAll(`[data-agent-id="${id}"]`).length;
      if (count > 1) {
        console.error("DUPLICATE AGENT", id);
      }
    });
  });

  /**
   * Render EXACTLY ONE element per agent id
   * In 'seated' it shows the seated crop; otherwise the standing sprite.
   */
  const renderAgent = (agentId: string) => {
    const agent: OfficeAgentConfig = OFFICE_AGENTS[agentId];
    if (!agent) return null;

    const seatPos = customSeatPositions?.[agent.id] || DEFAULT_SEAT_POSITIONS[agent.id] || { x: 50, y: 60 };
    const standPos = customPositions?.[agent.id] || DEFAULT_STAND_POSITIONS[agent.id];
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

    const isEditingStand = Boolean(isEditMode && editTarget === "stand");
    const isSeated = isEditingStand ? false : (state.isSeated && !state.isWalking);
    const posX = isSeated ? seatPos.x : (isEditingStand && standPos ? standPos.x : state.x);
    const posY = isSeated ? seatPos.y : (isEditingStand && standPos ? standPos.y : state.y);

    // Perspective height calculated linear between 21% at y=52 and 30% at y=96
    const fullHeightPercent = calculatePerspectiveHeight(posY);
    const renderHeightPercent = isSeated ? fullHeightPercent * 0.56 : fullHeightPercent;

    // Depth sorting: zIndex = Math.round(posY * 10)
    const zIndex = isSeated
      ? Math.round(seatPos.y * 10)
      : Math.round(posY * 10);

    const isFlipped = state.facing === "left";
    const isSelected = isEditMode && (editTarget === "seat" || editTarget === "stand") && selectedAgentId === agentId;

    return (
      <div
        key={`sprite-agent-${agent.id}`}
        data-agent-id={agent.id}
        data-agent-sprite={agent.id}
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
          transition: state.isWalking ? "none" : "left 0.25s ease-out, top 0.25s ease-out",
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
          <div className="absolute bottom-[110%] left-1/2 -translate-x-1/2 z-[1200] mb-1 animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
            <div className="relative max-w-[220px] px-3 py-1.5 rounded-2xl bg-[#080318]/95 border border-purple-400/60 text-white shadow-[0_6px_30px_rgba(0,0,0,0.9)] backdrop-blur-md">
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

        {/* Single Image Element per agent: Seated Crop when isSeated, Standing Sprite otherwise */}
        <div
          className={`relative flex justify-center ${
            isSeated
              ? "w-full h-full overflow-hidden items-start animate-idle-breathe"
              : `h-full w-auto items-center ${state.isWalking ? "animate-walk-bob-sway" : "animate-idle-breathe"}`
          }`}
          style={{
            transform: isFlipped ? "scaleX(-1)" : "scaleX(1)",
            transformOrigin: "bottom center",
          }}
        >
          <img
            src={agent.image}
            alt={agent.name}
            className={
              isSeated
                ? "pointer-events-none select-none max-w-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
                : "h-full w-auto object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)] pointer-events-none select-none"
            }
            style={
              isSeated
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
    );
  };

  /**
   * Render Bengali desk name label on thin glowing front border of each desk
   */
  const renderDeskLabel = (agentId: string) => {
    const pos =
      customLabelPositions?.[agentId] ||
      labelPositions[agentId] ||
      DEFAULT_LABEL_POSITIONS[agentId] ||
      { x: 50, y: 50 };
    const bengaliName = DESK_BENGALI_NAMES[agentId] || agentId;
    const glowConfig = DESK_GLOW_COLORS[agentId] || {
      color: "#FFFFFF",
      glow: "#A855F7",
      textShadow: "0 0 8px #A855F7",
    };

    // Label depths match desk depth thresholds + 5
    const labelZIndexMap: Record<string, number> = {
      arin: 535,
      zayan: 535,
      rose: 795,
      mira: 875,
      naira: 885,
    };
    const zIndex = labelZIndexMap[agentId] || 800;
    const isSelected = isEditMode && editTarget === "label" && selectedAgentId === agentId;
    const fontSizePx = Math.max(11, Math.round((stageDimensions.width || 1000) * 0.016));

    return (
      <div
        key={`desk-label-${agentId}`}
        data-agent-label={agentId}
        className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center select-none ${
          isEditMode && editTarget === "label"
            ? "cursor-grab active:cursor-grabbing pointer-events-auto"
            : "pointer-events-none"
        }`}
        style={{
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          zIndex: isSelected ? 1150 : zIndex,
        }}
        onPointerDown={(e) => {
          if (!isEditMode || editTarget !== "label") return;
          onSelectAgent?.(agentId);
          handleDragStart(e, agentId, "label", pos);
        }}
      >
        <span
          style={{
            fontFamily: "'Hind Siliguri', 'Noto Sans Bengali', system-ui, sans-serif",
            fontSize: `${fontSizePx}px`,
            fontWeight: 700,
            color: glowConfig.color,
            textShadow: glowConfig.textShadow,
            letterSpacing: "0.02em",
            lineHeight: 1,
          }}
          className="transition-transform duration-150 inline-block drop-shadow-sm"
        >
          {bengaliName}
        </span>
        {isSelected && (
          <span className="absolute -inset-1.5 rounded-lg border-2 border-dashed border-white/80 pointer-events-none animate-pulse" />
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
        ref={stageRef}
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

        {/* DESK OVERLAYS sorted by depth:
            Desk Arin: y=53 (z-530)
            Desk Zayan: y=53 (z-530)
            Desk Rose: y=79 (z-790)
            Desk Mira: y=87 (z-870)
            Desk Naira: y=88 (z-880) */}

        <img
          src="/office/desk-arin.png"
          alt="Desk Arin"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-[530]"
        />
        <img
          src="/office/desk-zayan.png"
          alt="Desk Zayan"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-[530]"
        />
        <img
          src="/office/desk-rose.png"
          alt="Desk Rose"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-[790]"
        />
        <img
          src="/office/desk-mira.png"
          alt="Desk Mira"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-[870]"
        />
        <img
          src="/office/desk-naira.png"
          alt="Desk Naira"
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-[880]"
        />

        {/* Desk Bengali Name Labels */}
        {renderDeskLabel("arin")}
        {renderDeskLabel("zayan")}
        {renderDeskLabel("rose")}
        {renderDeskLabel("mira")}
        {renderDeskLabel("naira")}

        {/* 5 Agent Sprites (Each renders EXACTLY ONE element with dynamic zIndex based on feet Y) */}
        {renderAgent("arin")}
        {renderAgent("zayan")}
        {renderAgent("rose")}
        {renderAgent("mira")}
        {renderAgent("naira")}

        {/* In-stage Children (Orb at bottom center, Live Camera preview at bottom right) */}
        {children}
      </div>

      <style>{`
        @keyframes walkBobSway {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-1.5%) rotate(-1.5deg); }
          50% { transform: translateY(0px) rotate(0deg); }
          75% { transform: translateY(-1.5%) rotate(1.5deg); }
        }
        @keyframes idleBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.012); }
        }
        .animate-walk-bob-sway {
          animation: walkBobSway 0.5s linear infinite;
        }
        .animate-idle-breathe {
          animation: idleBreathe 3.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

