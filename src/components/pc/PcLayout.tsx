import React, { useState, useEffect, useRef } from "react";
import {
  Home,
  MessageSquare,
  Bot,
  CheckSquare,
  History,
  Settings,
  Sparkles,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  RefreshCw,
  X,
} from "lucide-react";
import { OrbSphere } from "../OrbSphere";
import { VirtualOffice } from "./office/VirtualOffice";
import { OFFICE_AGENT_LIST } from "./office/officeConfig";

export type PcNavItem = "home" | "chat" | "agents" | "tasks" | "history" | "settings";

export interface PcLayoutProps {
  activeNav: PcNavItem;
  onSelectNav: (nav: PcNavItem) => void;
  currentView: string;
  masterAccess: boolean;
  userName: string;
  isAdminUser?: boolean;
  geminiConnected: boolean;
  liveModelName: string;
  supabaseConnected: boolean;
  renderRoseFlowerSvg: (className?: string) => React.ReactNode;
  renderChat: (isPcLayout?: boolean) => React.ReactNode;
  renderHistory: () => React.ReactNode;
  renderCenterOverlayViews: () => React.ReactNode;
  renderCallOverlays?: () => React.ReactNode;
  renderVoiceBars?: () => React.ReactNode;
  orbTheme: string;
  reduceMotion?: boolean;
  isAssistantEnabled: boolean;
  isMuted: boolean;
  sessionState: string;
  speakingState: "idle" | "listening" | "thinking" | "speaking";
  liveReconnectStatus: string | null;
  liveBottomError: string | null;
  voiceDiag: { mic: string; recognition: string; mode: string } | null;
  inputVolumeRef: React.MutableRefObject<number>;
  outputVolumeRef: React.MutableRefObject<number>;
  onToggleVoice: () => void;
  onToggleMute: () => void;
  onEndCall: () => void;
  isCallScreenOpen: boolean;
  onSendVideoFrame?: (base64DataUrl: string) => void;
  onActionChat?: () => void;
  onActionCreateImage?: () => void;
  onActionWrite?: () => void;
  onActionDeveloper?: () => void;
}

export const PcLayout: React.FC<PcLayoutProps> = ({
  activeNav,
  onSelectNav,
  currentView,
  masterAccess,
  userName,
  isAdminUser,
  renderChat,
  renderHistory,
  renderCenterOverlayViews,
  renderVoiceBars,
  orbTheme,
  reduceMotion,
  isAssistantEnabled,
  isMuted,
  speakingState,
  inputVolumeRef,
  outputVolumeRef,
  onToggleVoice,
  onToggleMute,
  onSendVideoFrame,
}) => {
  // Toggle for right chat panel (persisted in localStorage)
  const [isChatPanelOpen, setIsChatPanelOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("pc_chat_panel_visible");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const toggleChatPanel = () => {
    setIsChatPanelOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("pc_chat_panel_visible", String(next));
      } catch {}
      return next;
    });
  };

  // Camera State & Streaming
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async (facing: "user" | "environment" = facingMode) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraOn(true);
    } catch (err) {
      console.warn("Camera access denied or unavailable", err);
      setIsCameraOn(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  };

  const toggleCamera = () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  const switchCameraFacing = () => {
    const nextFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextFacing);
    if (isCameraOn) {
      startCamera(nextFacing);
    }
  };

  useEffect(() => {
    if (isCameraOn && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraOn]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const isVoiceActive = isAssistantEnabled;

  // Realtime frame streaming: if isAdmin() is true AND live voice call is active AND camera is ON:
  // send 1 camera frame per second (JPEG, max 640px) to live session as realtime video input.
  useEffect(() => {
    if (!isAdminUser || !isVoiceActive || !isCameraOn || !onSendVideoFrame) {
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const timer = setInterval(() => {
      try {
        const video = videoRef.current;
        if (!video || video.readyState < 2 || !ctx) return;
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 480;
        let targetW = vw;
        let targetH = vh;
        if (targetW > 640) {
          targetH = Math.round((vh * 640) / targetW);
          targetW = 640;
        }
        canvas.width = targetW;
        canvas.height = targetH;
        ctx.drawImage(video, 0, 0, targetW, targetH);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        onSendVideoFrame(dataUrl);
      } catch {
        // Skips silently if unsupported. Never records or saves video.
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isAdminUser, isVoiceActive, isCameraOn, onSendVideoFrame]);

  const navItems: { id: PcNavItem; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "home", label: "Home", icon: Home },
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "agents", label: "Agents", icon: Bot },
    { id: "tasks", label: "Tasks", icon: CheckSquare },
    { id: "history", label: "History", icon: History },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  let statusLabel = "Voice idle";
  if (isVoiceActive) {
    if (speakingState === "listening") statusLabel = "Listening...";
    else if (speakingState === "thinking") statusLabel = "Thinking...";
    else if (speakingState === "speaking") statusLabel = "Speaking...";
    else statusLabel = "Voice active";
  }

  const isSettingsOrSubViewOpen = currentView !== "home";

  return (
    <div
      className={
        "w-screen h-dvh bg-[#020617] text-[var(--text)] font-sans flex overflow-hidden select-none " +
        (!masterAccess ? "grayscale contrast-75" : "")
      }
    >
      {/* 1. CENTER STAGE (Top bar + Expanded Virtual Office / Sub-views) */}
      <div className="relative flex-1 min-w-0 h-full overflow-hidden flex flex-col bg-[#020617] [transform:translateZ(0)]">
        {/* Ambient Backdrop */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-b from-[#090417]/80 via-[#020617]/90 to-[#020617]" />
        </div>

        {/* 2) NEW SLIM TOP BAR (height ~56px, full width of center, glass dark purple, soft bottom glow) */}
        <header className="relative z-30 h-14 px-4 sm:px-6 bg-[#0B061C]/90 border-b border-purple-500/20 backdrop-blur-md shadow-[0_4px_25px_rgba(139,92,246,0.14)] flex items-center justify-between shrink-0">
          {/* Left: Pill-style navigation buttons */}
          <nav className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.id === "settings"
                  ? activeNav === "settings" ||
                    (isSettingsOrSubViewOpen && currentView !== "write" && currentView !== "developer")
                  : !isSettingsOrSubViewOpen && activeNav === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectNav(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all active:scale-95 shrink-0 ${
                    isActive
                      ? "bg-purple-600 text-white border border-purple-400/60 shadow-[0_0_16px_rgba(168,85,247,0.55)] font-black"
                      : "text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10"
                  }`}
                >
                  <Icon className={"w-3.5 h-3.5 " + (isActive ? "text-purple-200" : "text-slate-400")} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Mic, Camera, User display name, Hide chat/Show chat toggle */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-2">
            {/* Mic Toggle Button */}
            <button
              type="button"
              onClick={onToggleMute}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all active:scale-95 border ${
                !isMuted
                  ? "bg-purple-600/30 border-purple-400 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:bg-purple-600/40"
                  : "bg-red-500/20 border-red-500/70 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)] hover:bg-red-500/30"
              }`}
              title={!isMuted ? "Microphone ON (Click to mute)" : "Microphone MUTED (Click to unmute)"}
              aria-label="Toggle Microphone"
            >
              {!isMuted ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>

            {/* Camera Toggle Button */}
            <button
              type="button"
              onClick={toggleCamera}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all active:scale-95 border ${
                isCameraOn
                  ? "bg-purple-600/30 border-purple-400 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:bg-purple-600/40"
                  : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
              }`}
              title={isCameraOn ? "Camera ON (Click to turn off)" : "Camera OFF (Click to turn on)"}
              aria-label="Toggle Camera"
            >
              {isCameraOn ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
            </button>

            <span
              className="text-xs font-bold text-purple-200/90 truncate max-w-[120px] hidden md:inline ml-1"
              title={userName}
            >
              {userName}
            </span>

            <button
              type="button"
              onClick={toggleChatPanel}
              className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
              title={isChatPanelOpen ? "Hide chat panel" : "Show chat panel"}
            >
              <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px] font-black uppercase tracking-wider">
                {isChatPanelOpen ? "Hide chat" : "Show chat"}
              </span>
            </button>
          </div>
        </header>

        {/* 3) MAIN CONTENT AREA (Below Top Bar) */}
        <div className="relative z-10 flex-1 min-h-0 w-full h-full flex flex-col overflow-hidden">
          {/* Sub-views (Settings, Profile, etc.) */}
          {isSettingsOrSubViewOpen ? (
            renderCenterOverlayViews()
          ) : activeNav === "chat" ? (
            /* Standalone Chat view when Chat nav pill is clicked */
            <div className="flex-1 min-h-0 w-full h-full max-w-4xl mx-auto flex flex-col overflow-hidden p-3">
              {renderChat(true)}
            </div>
          ) : activeNav === "agents" ? (
            /* AGENTS PAGE */
            <div className="flex-1 min-h-0 w-full h-full overflow-y-auto no-scrollbar p-6">
              <div className="max-w-4xl mx-auto space-y-5 pb-8">
                <div className="pb-3 border-b border-white/5">
                  <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Bot className="w-6 h-6 text-purple-400" />
                    Autonomous Office Agents
                  </h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Meet the 5 specialized AI team members running your business office.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {OFFICE_AGENT_LIST.map((agent) => (
                    <div
                      key={agent.id}
                      className="p-4 rounded-2xl bg-[#0F172A]/80 border border-purple-500/25 shadow-xl flex items-start gap-4 hover:border-purple-500/50 transition-all"
                    >
                      <div
                        className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center font-black text-white text-lg shrink-0 shadow-lg border-2"
                        style={{
                          borderColor: agent.color,
                          backgroundColor: `${agent.color}25`,
                        }}
                      >
                        <img
                          src={agent.avatar}
                          alt={agent.name}
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                          className="w-full h-full object-cover"
                        />
                        <span className="fallback-initial">{agent.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black text-white">{agent.name}</h4>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                            style={{
                              backgroundColor: `${agent.color}20`,
                              color: agent.color,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: agent.color }}
                            />
                            {agent.id === "rose" ? "Chief Manager" : "Ready"}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-purple-300 mt-0.5">
                          {agent.role}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          Position: {agent.defaultY < 60 ? "Back desk" : "Front desk"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeNav === "tasks" ? (
            /* TASKS PAGE */
            <div className="flex-1 h-full w-full flex flex-col items-center justify-center p-8 text-center bg-[#020617] relative overflow-hidden">
              <div className="relative z-10 max-w-md w-full bg-[#0F172A]/85 border border-purple-500/30 rounded-[20px] p-8 shadow-2xl flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 shadow-lg shadow-purple-900/30">
                  <CheckSquare className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black italic uppercase tracking-wider text-white mb-2">
                  Tasks
                </h2>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-black uppercase tracking-[2px] mb-3">
                  <Sparkles className="w-3 h-3" /> Coming soon
                </span>
                <p className="text-xs font-medium text-slate-400 leading-relaxed">
                  Scheduled tasks and autonomous PC workflows will appear here.
                </p>
              </div>
            </div>
          ) : activeNav === "history" ? (
            /* HISTORY PAGE */
            <div className="flex-1 min-h-0 w-full h-full flex flex-col overflow-hidden max-w-4xl mx-auto p-4">
              {renderHistory()}
            </div>
          ) : (
            /* 3) HOME: Full-size Virtual Office filling the center with fixed 1672/941 aspect ratio stage,
               with the single Orb (~64px) at bottom center and Live Camera preview at bottom right */
            <div className="flex-1 min-h-0 w-full h-full p-2 sm:p-3 flex items-center justify-center overflow-hidden relative">
              <VirtualOffice className="w-full h-full">
                {/* Single Orb at bottom center of the office stage (~64px) with status pill */}
                <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-[120] flex flex-col items-center pointer-events-auto">
                  <button
                    type="button"
                    onClick={onToggleVoice}
                    className="relative group p-0.5 rounded-full cursor-pointer transition-transform hover:scale-105 active:scale-95"
                    title={isVoiceActive ? "Voice Active - Click to stop" : "Voice Idle - Click to talk"}
                  >
                    <div
                      className={
                        "rounded-full p-0.5 border-2 transition-all " +
                        (isVoiceActive
                          ? "border-emerald-400 shadow-[0_0_24px_rgba(34,197,94,0.95)]"
                          : "border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.35)]")
                      }
                    >
                      <OrbSphere
                        styleId={orbTheme}
                        size={64}
                        state={speakingState}
                        reduceMotion={reduceMotion}
                        dimmed={!isVoiceActive || isMuted}
                        inputVolumeRef={inputVolumeRef}
                        outputVolumeRef={outputVolumeRef}
                      />
                    </div>
                  </button>

                  {/* Status pill under orb: "Mic off" when muted, else statusLabel; state dot only inside pill */}
                  <div className="mt-1 px-3 py-0.5 rounded-full bg-black/85 border border-purple-500/30 backdrop-blur-md flex items-center gap-1.5 shadow-lg">
                    <span
                      className={
                        "w-2 h-2 rounded-full " +
                        (isMuted
                          ? "bg-red-400 shadow-[0_0_6px_#f87171]"
                          : isVoiceActive
                          ? "bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]"
                          : "bg-purple-400")
                      }
                    />
                    <span className="text-[10px] font-black uppercase tracking-wider text-white">
                      {isMuted ? "Mic off" : statusLabel}
                    </span>
                  </div>

                  {/* Live waveform bars if voice active */}
                  {renderVoiceBars && isVoiceActive && !isMuted && (
                    <div className="mt-1 scale-75 origin-top">{renderVoiceBars()}</div>
                  )}
                </div>

                {/* Camera Live Preview Card (~200x150) at bottom-right of OfficeStage */}
                {isCameraOn && (
                  <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-[120] w-[200px] h-[150px] rounded-xl overflow-hidden bg-black/95 border border-purple-500/40 shadow-[0_8px_30px_rgba(0,0,0,0.85)] flex flex-col pointer-events-auto">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {/* Overlay Header */}
                    <div className="absolute top-1.5 left-2 right-2 flex items-center justify-between pointer-events-none">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600/90 text-white text-[9px] font-black uppercase tracking-wider shadow">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        LIVE
                      </span>
                      <div className="flex items-center gap-1 pointer-events-auto">
                        <button
                          type="button"
                          onClick={switchCameraFacing}
                          className="p-1 rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/20 transition-all active:scale-95 shadow"
                          title="Switch camera (Front / Back)"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="p-1 rounded-full bg-black/60 hover:bg-black/85 text-white border border-white/20 transition-all active:scale-95 shadow"
                          title="Close camera preview"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </VirtualOffice>
            </div>
          )}
        </div>
      </div>

      {/* 4. RIGHT PANEL (Toggleable width ~360px-380px): Chat Component Reused */}
      {isChatPanelOpen && (
        <section className="w-[360px] xl:w-[380px] shrink-0 h-full border-l border-purple-500/20 bg-[#020617] flex flex-col overflow-hidden relative z-20 [transform:translateZ(0)]">
          {renderChat(true)}
        </section>
      )}
    </div>
  );
};
