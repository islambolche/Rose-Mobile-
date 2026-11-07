import React, { useState } from "react";
import { LiveModelSettings } from "./SettingsComponents";
import {
  Key,
  Cpu,
  Briefcase,
  Palette,
  Globe,
  Volume2,
  Database,
  Smartphone,
  Bell,
  Shield,
  Radio,
  Code,
  Sliders,
  Gauge,
  X,
  ChevronRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
  Check,
  Trash2,
  RefreshCw,
  Lock,
  Mic,
  ArrowLeft,
  Laptop,
  Zap,
  Plug,
  ShieldCheck,
} from "lucide-react";
import { DiagnosticsView } from "./DiagnosticsView";
import { IntegrationsView } from "./IntegrationsView";
import { ApprovalsView } from "./ApprovalsView";
import { VoiceLanguageSettings } from "./VoiceLanguageSettings";
import { DatabaseSyncSettings } from "./DatabaseSyncSettings";
import { DevicePermissionsSettings } from "./DevicePermissionsSettings";
import { SecurityPrivacySettings } from "./SecurityPrivacySettings";
import { AnalyticsSettings } from "./AnalyticsSettings";
import { PcControlSettings } from "./PcControlSettings";
import { ConnectionsView } from "./Connections";
import { CreatorProfileContent } from "./CreatorProfileContent";
import { VoiceTestModal } from "./VoiceTestModal";
import { UnifiedSettings } from "../types/settings";
import {
  SharedBusinessDatabase,
  GeminiProfileType,
  INITIAL_BUSINESS_PROFILE,
} from "../types/business";
import {
  saveLocalBusinessDb,
  validateGeminiApiKey,
} from "../lib/businessSync";
import { logActivity } from "../lib/activityLog";

interface MobileSettingsViewProps {
  db: SharedBusinessDatabase;
  onUpdateDb: (updated: SharedBusinessDatabase) => void;
  onClose: () => void;
  onOpenLiveCall?: () => void;
  unifiedSettings: UnifiedSettings;
  onUpdateUnifiedSettings: (updated: UnifiedSettings) => void;
  liveTimings: any;
}

type MobileTab =
  | "keys"
  | "live-model"
  | "business"
  | "customization"
  | "language"
  | "voice"
  | "data"
  | "permissions"
  | "pc-control"
  | "notifications"
  | "security"
  | "analytics"
  | "developer"
  | "voice-language"
  | "connections"
  | "diagnostics"
  | "integrations"
  | "approvals";

export const MobileSettingsView: React.FC<MobileSettingsViewProps> = ({
  db,
  onUpdateDb,
  onClose,
  unifiedSettings,
  onUpdateUnifiedSettings,
  liveTimings,
}) => {
  const MOBILE_SECTIONS: { 
    id: MobileTab; 
    label: string; 
    description: string;
    icon: React.FC<{ className?: string }>;
    isConnections?: boolean;
  }[] = [
    { id: "connections", label: "Connections", description: "Gemini and Groq keys", icon: Key, isConnections: true },
    { id: "live-model", label: "LIVE VOICE MODEL", description: unifiedSettings.liveVoiceModel || "Default", icon: Cpu },
    { id: "voice-language", label: "Voice & language", description: `${unifiedSettings.voiceName} · ${unifiedSettings.language === 'Auto detect' ? 'Auto' : unifiedSettings.language} · ${unifiedSettings.speakingSpeed}x`, icon: Mic },
    { id: "business", label: "Business Profile", description: unifiedSettings.businessProfile.businessName || "Not set", icon: Briefcase },
    { id: "customization", label: "Customization", description: `${(() => {
        const p = localStorage.getItem("personality") || "Friendly";
        const s = localStorage.getItem("reply_style") || "Balanced";
        return `${p} · ${s}`;
    })()}`, icon: Palette },
    { id: "language", label: "Language", description: `${localStorage.getItem("language") || "English"}`, icon: Globe },
    { id: "voice", label: "VOICE SETTINGS", description: `${unifiedSettings.voiceName || "Sulafat"} · ${localStorage.getItem("speech_speed") || "1"}X · ${localStorage.getItem("voice_volume") || "80"}%`, icon: Volume2 },
    { id: "data", label: "Database & Sync", description: "Cloud sync, backup and data management", icon: Database },
    { id: "permissions", label: "Device Permissions", description: "Microphone, Camera and Storage access", icon: Smartphone },
    { id: "pc-control", label: "PC CONTROL", description: "Control your PC with voice and AI agents", icon: Laptop },
    { id: "security", label: "Security & Privacy", description: "Encryption, access logs and data privacy", icon: Shield },
    { id: "analytics", label: "Analytics", description: "Usage statistics and performance metrics", icon: Radio },
    { id: "diagnostics", label: "DIAGNOSTICS", description: "Live latency and model info", icon: Zap },
    { id: "integrations", label: "INTEGRATIONS", description: "Facebook, Phone, PC and more", icon: Plug },
    { id: "approvals", label: "APPROVALS", description: "Actions waiting for your OK", icon: ShieldCheck },
    { id: "developer", label: "MD YOUSUF KHAN\nWEB DEVELOPER", description: "", icon: Code },
  ];

  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [activeSection, setActiveSection] = useState<MobileTab>("keys");
  const [showFreeKey, setShowFreeKey] = useState(false);
  const [showPaidKey, setShowPaidKey] = useState(false);
  const [testingProfile, setTestingProfile] = useState<GeminiProfileType | null>(null);
  const [isSaving, setIsSaving] = useState<GeminiProfileType | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [showVoiceTestModal, setShowVoiceTestModal] = useState(false);

  const notify = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3000);
  };

  const updateDatabase = (updater: (prev: SharedBusinessDatabase) => SharedBusinessDatabase) => {
    const next = updater(db);
    onUpdateDb(next);
    saveLocalBusinessDb(next);
  };

  const handleTestKey = async (profile: GeminiProfileType) => {
    const targetProfile = db.geminiProfiles[profile];
    if (!targetProfile.key && !targetProfile.hasKey) {
      notify("Please enter an API key first.");
      return;
    }
    setTestingProfile(profile);
    updateDatabase((prev) => ({
      ...prev,
      geminiProfiles: {
        ...prev.geminiProfiles,
        [profile]: { ...prev.geminiProfiles[profile], status: "testing" },
      },
    }));
    logActivity("Security", `Testing ${profile} API key`);
    const result = await validateGeminiApiKey(targetProfile.key || "", profile);
    updateDatabase((prev) => ({
      ...prev,
      geminiProfiles: {
        ...prev.geminiProfiles,
        [profile]: {
          ...prev.geminiProfiles[profile],
          status: result.ok ? "connected" : "error",
          lastTested: new Date().toISOString(),
          lastError: result.ok ? null : result.errorMessage || "Validation failed",
          errorCategory: result.ok ? null : result.errorCategory || "API Error",
          model: result.model || prev.geminiProfiles[profile].model,
        },
      },
    }));
    setTestingProfile(null);
    notify(result.ok ? "API Key connected successfully!" : `Failed: ${result.errorCategory}`);
  };

  const handleSaveKey = async (profile: GeminiProfileType) => {
    const target = db.geminiProfiles[profile];
    if (!target.key || !target.key.trim()) {
      notify("Please enter an API key.");
      return;
    }
    const cleanKey = target.key.trim();
    if (cleanKey.length < 15) {
      notify("Invalid key format.");
      return;
    }
    setIsSaving(profile);
    try {
      const res = await fetch("/api/business/save-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, key: cleanKey, model: target.model }),
      });
      if (res.ok) {
        const data = await res.json();
        updateDatabase((prev) => ({
          ...prev,
          geminiProfiles: {
            ...prev.geminiProfiles,
            [profile]: { ...prev.geminiProfiles[profile], ...data.profile, key: "" },
          },
        }));
        notify(`${profile === "free" ? "Free" : "Paid"} API key saved securely!`);
      } else {
        const err = await res.json().catch(() => ({}));
        notify(err.message || "Failed to save API key.");
      }
    } catch (e) {
      notify("Network error saving API key.");
    } finally {
      setIsSaving(null);
    }
  };

  const handleClearKey = async (profile: GeminiProfileType) => {
    try {
      const res = await fetch("/api/business/clear-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (res.ok) {
        const data = await res.json();
        updateDatabase((prev) => ({
          ...prev,
          geminiProfiles: {
            ...prev.geminiProfiles,
            [profile]: { ...data.profile, key: "" },
          },
        }));
        notify(`${profile === "free" ? "Free" : "Paid"} API key removed.`);
      }
    } catch (e) {
      notify("Failed to clear key.");
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-[#020617] text-white flex flex-col font-sans select-none overflow-hidden">
      <header className="px-5 py-4 bg-[#0A1628]/95 border-b border-emerald-500/20 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {viewMode === "detail" ? (
            <button onClick={() => setViewMode("list")} className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 active:scale-90 transition-transform">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black italic text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              {(unifiedSettings.assistantName || "R")[0].toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-white">
              {viewMode === "detail" ? MOBILE_SECTIONS.find(s => s.id === activeSection)?.label : "Rose Settings"}
            </h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {viewMode === "detail" ? "Configuration" : "System Panel"}
              </span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 active:scale-90">
          <X className="w-5 h-5" />
        </button>
      </header>

      {actionNotice && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/30 px-5 py-2 text-[11px] font-bold text-emerald-300 flex items-center justify-between shrink-0 animate-in slide-in-from-top">
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" />{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="p-1"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {viewMode === "list" ? (
          <div className="p-5 space-y-3.5">
            {MOBILE_SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isPurple = sec.id === 'voice-language' || sec.id === 'connections';
              return (
                <button
                  key={sec.id}
                  onClick={() => { setActiveSection(sec.id); setViewMode("detail"); }}
                  className="w-full bg-[#0A1628]/80 border border-white/5 rounded-3xl p-4 flex items-center gap-4 transition-all active:scale-[0.98] group text-left"
                >
                <div className={`w-12 h-12 rounded-2xl border border-white/5 flex items-center justify-center shrink-0 transition-colors ${isPurple || sec.id === 'data' || sec.id === 'permissions' || sec.id === 'pc-control' || sec.id === 'security' || sec.id === 'analytics' ? 'bg-purple-600 shadow-[0_0_15px_rgba(147,51,234,0.4)]' : (['model', 'business', 'customization', 'language', 'voice'].includes(sec.id) ? 'bg-gradient-to-br from-[#9b10ff] to-[#6d28d9] shadow-[0_0_15px_rgba(155,16,255,0.4)]' : 'bg-[#1e293b] group-hover:border-emerald-500/40')}`}>
                    <Icon className={`w-6 h-6 transition-colors ${isPurple || sec.id === 'data' || sec.id === 'permissions' || sec.id === 'pc-control' || sec.id === 'security' || sec.id === 'analytics' || ['model', 'business', 'customization', 'language', 'voice'].includes(sec.id) ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-black uppercase tracking-wider text-white mb-0.5 whitespace-pre-line">{sec.label}</h3>
                    {sec.description && <p className="text-[10px] text-slate-400 font-medium line-clamp-1">{sec.description}</p>}
                  </div>
                  {sec.id === 'connections' && (
                    <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase mr-1 transition-transform ${
                      (() => {
                        const keys = JSON.parse(localStorage.getItem('rose_api_keys') || '{}');
                        return (localStorage.getItem('gemini_api_key') || keys.gemini) && (localStorage.getItem('groq_api_keys') || keys.groq);
                      })() 
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                      : 'bg-purple-500/10 border border-purple-500/30 text-purple-400'
                    }`}>
                      {(() => {
                        const keys = JSON.parse(localStorage.getItem('rose_api_keys') || '{}');
                        return (localStorage.getItem('gemini_api_key') || keys.gemini) && (localStorage.getItem('groq_api_keys') || keys.groq) ? 'READY' : 'ADD A KEY';
                      })()}
                    </div>
                  )}
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {activeSection === "keys" && (
              <div className="space-y-5">
                <div className="bg-[#0A1628]/90 border border-emerald-500/30 rounded-[2rem] p-5 space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Profile Selection</span>
                  <div className="grid grid-cols-2 gap-3">
                    {["free", "paid"].map((type) => (
                      <button
                        key={type}
                        onClick={() => { updateDatabase((prev) => ({ ...prev, activeGeminiProfile: type as any })); notify(`Switched to ${type} profile.`); }}
                        className={`py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${db.activeGeminiProfile === type ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-black/40 border-white/5 text-slate-500"}`}
                      >
                        {type} Profile
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="bg-[#0A1628]/90 border border-emerald-500/20 rounded-[2rem] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">Gemini Free Key</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${db.geminiProfiles.free.status === 'connected' ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>{db.geminiProfiles.free.status}</span>
                  </div>
                  <div className="relative">
                    <input 
                      type={showFreeKey ? "text" : "password"} 
                      value={db.geminiProfiles.free.key || db.geminiProfiles.free.maskedKey || ""} 
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDatabase(prev => ({ 
                          ...prev, 
                          geminiProfiles: { 
                            ...prev.geminiProfiles, 
                            free: { ...prev.geminiProfiles.free, key: val }
                          }
                        }));
                      }} 
                      placeholder="Enter Free API Key" 
                      className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-emerald-500/50 font-mono pr-12" 
                    />
                    <button onClick={() => setShowFreeKey(!showFreeKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                      {showFreeKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveKey('free')} className="flex-1 py-3 bg-emerald-600 rounded-2xl text-[10px] font-black uppercase text-white shadow-lg">Save Key</button>
                    <button onClick={() => handleTestKey('free')} className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase text-emerald-400">Test</button>
                  </div>
                </div>

                <div className="bg-[#0A1628]/90 border border-teal-500/20 rounded-[2rem] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">Gemini Paid Key</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${db.geminiProfiles.paid.status === 'connected' ? 'bg-teal-500/10 border-teal-500/40 text-teal-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>{db.geminiProfiles.paid.status}</span>
                  </div>
                  <div className="relative">
                    <input 
                      type={showPaidKey ? "text" : "password"} 
                      value={db.geminiProfiles.paid.key || db.geminiProfiles.paid.maskedKey || ""} 
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDatabase(prev => ({ 
                          ...prev, 
                          geminiProfiles: { 
                            ...prev.geminiProfiles, 
                            paid: { ...prev.geminiProfiles.paid, key: val }
                          }
                        }));
                      }} 
                      placeholder="Enter Paid API Key" 
                      className="w-full bg-black/40 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-teal-500/50 font-mono pr-12" 
                    />
                    <button onClick={() => setShowPaidKey(!showPaidKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
                      {showPaidKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveKey('paid')} className="flex-1 py-3 bg-teal-600 rounded-2xl text-[10px] font-black uppercase text-white shadow-lg">Save Key</button>
                    <button onClick={() => handleTestKey('paid')} className="px-5 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase text-teal-400">Test</button>
                  </div>
                </div>
              </div>
            )}
              {activeSection === "live-model" && (
                <LiveModelSettings setCurrentView={() => setViewMode("list")} />
              )}
             {activeSection === "business" && (
              <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                  {/* Header */}
                  <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0">
                    <button onClick={() => setViewMode("list")} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-[20px] font-semibold text-white">Business Profile</h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto px-[14px] pt-[8px] pb-[120px]">
                      {/* Basic Info */}
                      <h4 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1 mb-2 mt-4">BASIC</h4>
                      <label className="text-[12px] text-slate-400 block mb-1">Business Name</label>
                      <input type="text" value={db.businessProfile.businessName} onChange={(e) => updateDatabase(prev => ({ ...prev, businessProfile: { ...prev.businessProfile, businessName: e.target.value }}))} className="w-full h-[48px] bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[14px] px-4 text-white text-[15px] outline-none mb-3" />
                      <label className="text-[12px] text-slate-400 block mb-1">Owner Name</label>
                      <input type="text" value={db.businessProfile.ownerName} onChange={(e) => updateDatabase(prev => ({ ...prev, businessProfile: { ...prev.businessProfile, ownerName: e.target.value }}))} className="w-full h-[48px] bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[14px] px-4 text-white text-[15px] outline-none mb-3" />

                      {/* Contact */}
                      <h4 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1 mb-2 mt-4">CONTACT</h4>
                      <label className="text-[12px] text-slate-400 block mb-1">Phone</label>
                      <input type="tel" value={db.businessProfile.phone} onChange={(e) => updateDatabase(prev => ({ ...prev, businessProfile: { ...prev.businessProfile, phone: e.target.value }}))} className="w-full h-[48px] bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[14px] px-4 text-white text-[15px] outline-none mb-3" />
                      <label className="text-[12px] text-slate-400 block mb-1">WhatsApp</label>
                      <input type="tel" value={db.businessProfile.whatsapp} onChange={(e) => updateDatabase(prev => ({ ...prev, businessProfile: { ...prev.businessProfile, whatsapp: e.target.value }}))} className="w-full h-[48px] bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[14px] px-4 text-white text-[15px] outline-none mb-3" />
                      <label className="text-[12px] text-slate-400 block mb-1">Email</label>
                      <input type="email" value={db.businessProfile.email} onChange={(e) => updateDatabase(prev => ({ ...prev, businessProfile: { ...prev.businessProfile, email: e.target.value }}))} className="w-full h-[48px] bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[14px] px-4 text-white text-[15px] outline-none mb-3" />
                      <label className="text-[12px] text-slate-400 block mb-1">Address</label>
                      <textarea value={db.businessProfile.address} onChange={(e) => updateDatabase(prev => ({ ...prev, businessProfile: { ...prev.businessProfile, address: e.target.value }}))} className="w-full bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[14px] p-3 text-white text-[15px] outline-none mb-3" rows={2} />
                      <label className="text-[12px] text-slate-400 block mb-1">Website</label>
                      <input type="url" value={db.businessProfile.website} onChange={(e) => updateDatabase(prev => ({ ...prev, businessProfile: { ...prev.businessProfile, website: e.target.value }}))} className="w-full h-[48px] bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[14px] px-4 text-white text-[15px] outline-none mb-3" />
                      <label className="text-[12px] text-slate-400 block mb-1">Facebook Page</label>
                      <input type="url" value={db.businessProfile.facebook} onChange={(e) => updateDatabase(prev => ({ ...prev, businessProfile: { ...prev.businessProfile, facebook: e.target.value }}))} className="w-full h-[48px] bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[14px] px-4 text-white text-[15px] outline-none mb-3" />

                      {/* Business Details */}
                      <h4 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1 mb-2 mt-4">BUSINESS DETAILS</h4>
                      <label className="text-[12px] text-slate-400 block mb-1">Business Hours</label>
                      <textarea value={db.businessProfile.hours} onChange={(e) => updateDatabase(prev => ({ ...prev, businessProfile: { ...prev.businessProfile, hours: e.target.value }}))} className="w-full bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[14px] p-3 text-white text-[15px] outline-none mb-3" rows={2} />
                      <label className="text-[12px] text-slate-400 block mb-1">About the Business</label>
                      <textarea value={db.businessProfile.about} onChange={(e) => updateDatabase(prev => ({ ...prev, businessProfile: { ...prev.businessProfile, about: e.target.value }}))} className="w-full bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[14px] p-3 text-white text-[15px] outline-none mb-3" rows={4} />
                      <label className="text-[12px] text-slate-400 block mb-1">Products and Prices</label>
                      <textarea value={db.businessProfile.products} onChange={(e) => updateDatabase(prev => ({ ...prev, businessProfile: { ...prev.businessProfile, products: e.target.value }}))} placeholder="One per line, e.g. T-shirt - 500 BDT" className="w-full bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[14px] p-3 text-white text-[15px] outline-none mb-3" rows={6} />

                      {/* Policies & Reply */}
                      <h4 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1 mb-2 mt-4">POLICIES & REPLY</h4>
                      <label className="text-[12px] text-slate-400 block mb-1">Return / Delivery / Payment Policy</label>
                      <textarea value={db.businessProfile.policies} onChange={(e) => updateDatabase(prev => ({ ...prev, businessProfile: { ...prev.businessProfile, policies: e.target.value }}))} className="w-full bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[14px] p-3 text-white text-[15px] outline-none mb-3" rows={4} />
                      <label className="text-[12px] text-slate-400 block mb-1">Reply Style</label>
                      <textarea value={db.businessProfile.replyStyle} onChange={(e) => updateDatabase(prev => ({ ...prev, businessProfile: { ...prev.businessProfile, replyStyle: e.target.value }}))} placeholder="e.g. polite, short, friendly" className="w-full bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[14px] p-3 text-white text-[15px] outline-none mb-3" rows={3} />

                      <button onClick={() => { if(window.confirm("Clear all business profile information?")) { updateDatabase(prev => ({...prev, businessProfile: INITIAL_BUSINESS_PROFILE})); } }} className="w-full text-red-400 text-[14px] mt-6 underline">Clear all</button>
                  </div>

                  {/* Sticky Save Button */}
                  <div className="fixed bottom-0 left-0 right-0 p-[12px_14px_calc(12px+env(safe-area-inset-bottom))] bg-[#020617] border-t border-[#2e2160]">
                      <button onClick={() => { localStorage.setItem("business_profile", JSON.stringify(db.businessProfile)); notify("Saved"); }} className="w-full h-[48px] rounded-[16px] bg-gradient-to-r from-[#6d3fd1] to-[#4b27a0] text-white text-[15px] font-bold">SAVE</button>
                  </div>
              </div>
             )}
            {activeSection === "customization" && (
              <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0">
                  <button onClick={() => setViewMode("list")} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white"><ArrowLeft className="w-5 h-5" /></button>
                  <h3 className="text-[20px] font-semibold text-white">Customization</h3>
                </div>
                <div className="flex-1 overflow-y-auto px-[14px] pt-[8px] pb-8 space-y-6">
                    <section>
                      <h4 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1 mb-2">PERSONALITY</h4>
                      <div className="bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[16px]">
                          <button onClick={() => { setActiveSection("voice-language"); setViewMode("detail"); }} className="w-full p-4 border-b border-[#2e2160] flex items-center justify-between">
                            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6d3fd1] to-[#4b27a0] flex items-center justify-center"><Palette className="w-5 h-5 text-white" /></div><div><h3 className="text-sm font-bold text-white">Personality</h3><p className="text-[11px] text-slate-400">{unifiedSettings.personality}</p></div></div>
                          </button>
                          <button onClick={() => { setActiveSection("voice-language"); setViewMode("detail"); }} className="w-full p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6d3fd1] to-[#4b27a0] flex items-center justify-center"><Sliders className="w-5 h-5 text-white" /></div><div><h3 className="text-sm font-bold text-white">Response style</h3><p className="text-[11px] text-slate-400">{unifiedSettings.replyLength}</p></div></div>
                          </button>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1 mb-2">BEHAVIOR</h4>
                      <div className="bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[16px] p-2">
                        {[
                            {id: "beh_short", label: "Short replies"},
                            {id: "beh_emoji", label: "Use emojis in chat"},
                            {id: "beh_followup", label: "Ask follow-up questions"},
                            {id: "beh_callname", label: "Call me by my name"},
                        ].map(t => (
                            <div key={t.id} className="p-3 flex justify-between items-center">
                                <span className="text-sm text-white">{t.label}</span>
                                <input type="checkbox" checked={localStorage.getItem(t.id) === "true"} onChange={(e) => localStorage.setItem(t.id, e.target.checked.toString())} className="w-10 h-6 accent-purple-600" />
                            </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h4 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1 mb-2">HUD STYLE</h4>
                      <div className="grid grid-cols-5 gap-2">
                        {[
                            {name: "Emerald", color: "#22c55e"},
                            {name: "Cyan", color: "#27d8e8"},
                            {name: "Purple", color: "#8b5cf6"},
                            {name: "Orange", color: "#f97316"},
                            {name: "Pink", color: "#ec4899"},
                        ].map(c => (
                            <button key={c.name} onClick={() => { localStorage.setItem("hud_accent", c.color); document.documentElement.style.setProperty("--hud-accent", c.color); }} className="flex flex-col items-center gap-2">
                                <div className="w-12 h-12 rounded-full border-4 border-[#2e2160]" style={{backgroundColor: c.color}} />
                            </button>
                        ))}
                      </div>
                    </section>
                </div>
              </div>
            )}
            {activeSection === "language" && (
              <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0">
                  <button onClick={() => setViewMode("list")} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white"><ArrowLeft className="w-5 h-5" /></button>
                  <h3 className="text-[20px] font-semibold text-white">Language</h3>
                </div>
                <div className="flex-1 overflow-y-auto px-[14px] pt-[8px] pb-8 space-y-6">
                    <section>
                        <h4 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1 mb-2">INTERACTION LANGUAGE</h4>
                        <button onClick={() => { setActiveSection("voice-language"); setViewMode("detail"); }} className="w-full p-4 bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[16px] flex items-center justify-between">
                            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6d3fd1] to-[#4b27a0] flex items-center justify-center"><Globe className="w-5 h-5 text-white" /></div><div><h3 className="text-sm font-bold text-white">Language</h3><p className="text-[11px] text-slate-400">{localStorage.getItem("language") || "English"}</p></div></div>
                        </button>
                    </section>
                    <section>
                        <h4 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1 mb-2">SWITCHING</h4>
                        <div className="bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[16px] p-2">
                            {[
                                {id: "lang_auto", label: "Auto-switch language", sub: "Switch when I ask her to speak another language"},
                                {id: "lang_translate", label: "Translation mode", sub: "Rose repeats what I say in the selected language"},
                            ].map(t => (
                                <div key={t.id} className="p-3 flex justify-between items-center">
                                    <div><span className="text-sm text-white block">{t.label}</span><span className="text-[10px] text-slate-400">{t.sub}</span></div>
                                    <input type="checkbox" checked={localStorage.getItem(t.id) === "true"} onChange={(e) => localStorage.setItem(t.id, e.target.checked.toString())} className="w-10 h-6 accent-purple-600" />
                                </div>
                            ))}
                        </div>
                    </section>
                    <section>
                        <h4 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1 mb-2">REPLY LANGUAGE</h4>
                        {[
                            {id: "same", label: "Same as I speak", sub: "Reply in the language I use"},
                            {id: "always", label: "Always selected language", sub: "Reply only in the language chosen above"},
                        ].map(r => (
                            <div key={r.id} onClick={() => localStorage.setItem("reply_lang_mode", r.id)} className={`p-4 mb-2 rounded-[16px] border-[1.5px] flex items-center justify-between ${localStorage.getItem("reply_lang_mode") === r.id ? 'bg-[#181830] border-[#8b5cf6]' : 'bg-[#0f0f23] border-[#2e2160]'}`}>
                                <div><span className="text-sm text-white font-bold">{r.label}</span><p className="text-[11px] text-slate-400">{r.sub}</p></div>
                                {localStorage.getItem("reply_lang_mode") === r.id && <Check className="text-[#8b5cf6]" />}
                            </div>
                        ))}
                    </section>
                </div>
              </div>
            )}
            {activeSection === "voice-language" && (
              <VoiceLanguageSettings 
                settings={unifiedSettings}
                onUpdate={onUpdateUnifiedSettings}
                onBack={() => setViewMode("list")}
              />
            )}
            {activeSection === "data" && (
              <DatabaseSyncSettings onClose={() => setViewMode("list")} />
            )}
            {activeSection === "permissions" && (
              <DevicePermissionsSettings onClose={() => setViewMode("list")} initialTab="permissions" />
            )}
            {activeSection === "pc-control" && (
              <PcControlSettings onClose={() => setViewMode("list")} />
            )}
            {activeSection === "security" && (
              <SecurityPrivacySettings onClose={() => setViewMode("list")} />
            )}
            {activeSection === "analytics" && (
              <AnalyticsSettings onClose={() => setViewMode("list")} />
            )}
            {activeSection === "diagnostics" && (
              <DiagnosticsView 
                liveTimings={liveTimings} 
                unifiedSettings={unifiedSettings} 
                onBack={() => setViewMode("list")} 
              />
            )}
            {activeSection === "integrations" && (
              <IntegrationsView onBack={() => setViewMode("list")} />
            )}
            {activeSection === "approvals" && (
              <ApprovalsView onBack={() => setViewMode("list")} />
            )}
            {activeSection === "developer" && (
              <div className="bg-[#0A1628]/90 border border-emerald-500/30 rounded-[2rem] p-6">
                <CreatorProfileContent />
              </div>
            )}
            {activeSection === "voice" && (
              <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0">
                  <button onClick={() => setViewMode("list")} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white"><ArrowLeft className="w-5 h-5" /></button>
                  <h3 className="text-[20px] font-semibold text-white">Voice Settings</h3>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar px-[14px] pt-[8px] pb-32 space-y-6">
                  <section>
                    <h4 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1 mb-2">OUTPUT</h4>
                    <div className="bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[16px] overflow-hidden">
                      <button onClick={() => setActiveSection("voice-language")} className="w-full p-4 flex items-center justify-between border-b border-[#2e2160]"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6d3fd1] to-[#4b27a0] flex items-center justify-center"><Volume2 className="w-5 h-5 text-white" /></div><div><h3 className="text-sm font-bold text-white">Voice volume</h3><p className="text-[11px] text-slate-400">{unifiedSettings.voiceVolume || 80}%</p></div></div><ChevronRight className="w-4 h-4 text-slate-600" /></button>
                      <button onClick={() => setActiveSection("voice-language")} className="w-full p-4 flex items-center justify-between border-b border-[#2e2160]"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6d3fd1] to-[#4b27a0] flex items-center justify-center"><Gauge className="w-5 h-5 text-white" /></div><div><h3 className="text-sm font-bold text-white">Speech speed</h3><p className="text-[11px] text-slate-400">{unifiedSettings.speakingSpeed || 1}X</p></div></div><ChevronRight className="w-4 h-4 text-slate-600" /></button>
                      <button onClick={() => setActiveSection("voice-language")} className="w-full p-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6d3fd1] to-[#4b27a0] flex items-center justify-center"><Mic className="w-5 h-5 text-white" /></div><div><h3 className="text-sm font-bold text-white">Voice</h3><p className="text-[11px] text-slate-400">{unifiedSettings.voiceName}</p></div></div><ChevronRight className="w-4 h-4 text-slate-600" /></button>
                    </div>
                  </section>
                  <section>
                    <h4 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1 mb-2">LISTENING</h4>
                    <div className="bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[16px] p-2">
                       <div className="p-3 flex justify-between items-center"><span className="text-sm text-white">Listen when app opens</span><input type="checkbox" checked={unifiedSettings.listenOnAppOpen} onChange={(e) => onUpdateUnifiedSettings({...unifiedSettings, listenOnAppOpen: e.target.checked})} className="w-10 h-6 accent-purple-600" /></div>
                       <div className="p-3 flex justify-between items-center"><span className="text-sm text-white">Auto-stop after silence</span><input type="checkbox" defaultChecked={localStorage.getItem("vs_autostop") !== "false"} onChange={(e) => localStorage.setItem("vs_autostop", e.target.checked.toString())} className="w-10 h-6 accent-purple-600" /></div>
                       <div className="p-3 flex justify-between items-center"><span className="text-sm text-white">Noise reduction</span><input type="checkbox" defaultChecked={localStorage.getItem("vs_noise") !== "false"} onChange={(e) => localStorage.setItem("vs_noise", e.target.checked.toString())} className="w-10 h-6 accent-purple-600" /></div>
                    </div>
                  </section>
                  <section>
                    <h4 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1 mb-2">FEEDBACK</h4>
                    <div className="bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[16px] p-2">
                       <div className="p-3 flex justify-between items-center"><span className="text-sm text-white">Sound effects</span><input type="checkbox" defaultChecked={localStorage.getItem("vs_sfx") !== "false"} onChange={(e) => localStorage.setItem("vs_sfx", e.target.checked.toString())} className="w-10 h-6 accent-purple-600" /></div>
                    </div>
                  </section>
                  <section>
                    <button onClick={() => setShowVoiceTestModal(true)} className="w-full h-[48px] rounded-[16px] bg-gradient-to-r from-[#6d3fd1] to-[#4b27a0] text-white text-[15px] font-bold active:scale-95 transition-transform flex items-center justify-center gap-2">
                      <Mic className="w-5 h-5 text-purple-200" /> RUN VOICE TEST
                    </button>
                  </section>
                </div>
              </div>
            )}
            {showVoiceTestModal && (
              <VoiceTestModal
                settings={unifiedSettings}
                onClose={() => setShowVoiceTestModal(false)}
              />
            )}
            {activeSection === "connections" && (
              <ConnectionsView
                onBack={() => setViewMode("list")}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
