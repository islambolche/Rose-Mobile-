import React, { useState } from "react";
import { X, RotateCcw, Save, Sliders, Move, Armchair, Footprints } from "lucide-react";
import { VirtualOffice } from "./VirtualOffice";
import {
  OFFICE_AGENT_LIST,
  AgentPosition,
  loadOfficePositions,
  saveOfficePositions,
  resetOfficePositions,
  loadOfficeSeatPositions,
  saveOfficeSeatPositions,
  resetOfficeSeatPositions,
} from "./officeConfig";
import { officeEngine } from "./officeEngine";

export interface OfficeLayoutEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const OfficeLayoutEditorModal: React.FC<OfficeLayoutEditorModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [editTarget, setEditTarget] = useState<"seat" | "stand">("seat");
  const [standPositions, setStandPositions] = useState<Record<string, AgentPosition>>(() =>
    loadOfficePositions()
  );
  const [seatPositions, setSeatPositions] = useState<Record<string, AgentPosition>>(() =>
    loadOfficeSeatPositions()
  );
  const [selectedAgentId, setSelectedAgentId] = useState<string>("rose");

  if (!isOpen) return null;

  const selectedAgent = OFFICE_AGENT_LIST.find((a) => a.id === selectedAgentId) || OFFICE_AGENT_LIST[0];
  const currentPositions = editTarget === "seat" ? seatPositions : standPositions;
  const currentPos = currentPositions[selectedAgentId] || { x: 50, y: 66, scale: 1.0 };

  const handlePositionChange = (agentId: string, updated: AgentPosition, target: "stand" | "seat") => {
    if (target === "seat") {
      setSeatPositions((prev) => ({ ...prev, [agentId]: updated }));
    } else {
      setStandPositions((prev) => ({ ...prev, [agentId]: updated }));
    }
  };

  const handleScaleChange = (scaleValue: number) => {
    const rounded = Math.round(scaleValue * 100) / 100;
    if (editTarget === "seat") {
      setSeatPositions((prev) => ({
        ...prev,
        [selectedAgentId]: {
          ...currentPos,
          scale: rounded,
        },
      }));
    } else {
      setStandPositions((prev) => ({
        ...prev,
        [selectedAgentId]: {
          ...currentPos,
          scale: rounded,
        },
      }));
    }
  };

  const handleReset = () => {
    const defStand = resetOfficePositions();
    const defSeat = resetOfficeSeatPositions();
    setStandPositions(defStand);
    setSeatPositions(defSeat);
    officeEngine.reloadPositions();
  };

  const handleSave = () => {
    saveOfficePositions(standPositions);
    saveOfficeSeatPositions(seatPositions);
    officeEngine.reloadPositions();
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none">
      <div className="w-full max-w-5xl bg-[#090518] border border-purple-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-purple-500/20 bg-[#0F0826]/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Move className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                OFFICE LAYOUT EDITOR
                <span className="px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-[8px] font-black uppercase">
                  Admin
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Drag agents to position their seated desk points or standing walk points.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
            aria-label="Close editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode & Agent Selector Tabs */}
        <div className="px-5 py-2.5 bg-[#0B0620] border-b border-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Mode Toggle: Seat vs Stand */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => setEditTarget("seat")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                editTarget === "seat"
                  ? "bg-pink-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Armchair className="w-3.5 h-3.5" />
              <span>Seated Position</span>
            </button>
            <button
              type="button"
              onClick={() => setEditTarget("stand")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                editTarget === "stand"
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>Standing Position</span>
            </button>
          </div>

          {/* Agent Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {OFFICE_AGENT_LIST.map((agent) => {
              const isSelected = agent.id === selectedAgentId;
              const pos = (editTarget === "seat" ? seatPositions : standPositions)[agent.id] || { x: 50, y: 60 };
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedAgentId(agent.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                    isSelected
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-900/50"
                      : "bg-white/5 hover:bg-white/10 text-slate-300"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: agent.color }}
                  />
                  <span>{agent.name}</span>
                  <span className="text-[9px] font-mono opacity-70">
                    ({Math.round(pos.x)},{Math.round(pos.y)})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 min-h-0 p-4 overflow-hidden flex items-center justify-center bg-[#04010A]">
          <div className="w-full max-w-4xl aspect-video relative">
            <VirtualOffice
              isEditMode={true}
              editTarget={editTarget}
              selectedAgentId={selectedAgentId}
              onSelectAgent={(id: string) => setSelectedAgentId(id)}
              customPositions={standPositions}
              customSeatPositions={seatPositions}
              onPositionChange={handlePositionChange}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Controls Footer */}
        <div className="px-5 py-3 border-t border-purple-500/20 bg-[#0F0826]/95 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: selectedAgent.color }}
                />
                {selectedAgent.name} ({editTarget === "seat" ? "Desk Seat" : "Standing Walk"})
              </span>
              <span className="text-[11px] font-mono text-purple-300 bg-black/40 px-2 py-0.5 rounded-lg border border-purple-500/20">
                X: {Math.round(currentPos.x)}% | Y: {Math.round(currentPos.y)}%
              </span>
            </div>

            {/* Scale Slider */}
            <div className="flex items-center gap-2 text-xs">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] uppercase font-bold text-slate-400">Size:</span>
              <input
                type="range"
                min="0.6"
                max="1.8"
                step="0.05"
                value={currentPos.scale ?? 1.0}
                onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                className="w-24 accent-purple-500 cursor-pointer"
              />
              <span className="text-[10px] font-mono text-purple-200">
                {Math.round((currentPos.scale ?? 1.0) * 100)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 border border-white/10"
              title="Reset positions to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-purple-900/40 transition-all active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              Save Layout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
