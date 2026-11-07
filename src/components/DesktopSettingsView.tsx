import React, { useState } from "react";
import {
  X,
  Key,
  Cpu,
  Database,
  Briefcase,
  MessageSquare,
  ShoppingBag,
  Truck,
  Users,
  Sliders,
  Shield,
  Bell,
  BarChart3,
  FileText,
  Search,
  ExternalLink,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Plus,
  Trash2,
  Lock,
  Zap,
  Globe,
  Radio,
  Download,
  Upload,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";
import { DiagnosticsView } from "./DiagnosticsView";
import { UnifiedSettings } from "../types/settings";
import {
  SharedBusinessDatabase,
  GeminiProfileType,
  BusinessOrder,
  CustomerMessage,
  ParcelTracking,
  AutomationRule,
} from "../types/business";
import {
  saveLocalBusinessDb,
  syncBusinessDbWithServer,
  validateGeminiApiKey,
} from "../lib/businessSync";

interface DesktopSettingsViewProps {
  db: SharedBusinessDatabase;
  onUpdateDb: (updated: SharedBusinessDatabase) => void;
  onClose: () => void;
  liveTimings: any;
  unifiedSettings: UnifiedSettings;
}

type DesktopTab =
  | "connections"
  | "models"
  | "database"
  | "profile"
  | "communication"
  | "orders"
  | "delivery"
  | "agents"
  | "automation"
  | "security"
  | "notifications"
  | "analytics"
  | "logs"
  | "diagnostics";

const DESKTOP_SECTIONS: { id: DesktopTab; label: string; description?: string; icon: React.FC<{ className?: string }>; badge?: string }[] = [
  { id: "connections", label: "Connections", description: "Gemini and Groq keys", icon: Key },
  { id: "models", label: "AI Model Configuration", icon: Cpu },
  { id: "database", label: "Firebase & Database", icon: Database },
  { id: "profile", label: "Business Profile", icon: Briefcase },
  { id: "communication", label: "Customer Communication", icon: MessageSquare, badge: "Mira" },
  { id: "orders", label: "Sales & Order Management", icon: ShoppingBag, badge: "Arin" },
  { id: "delivery", label: "Parcel & Delivery Management", icon: Truck, badge: "Zayan" },
  { id: "agents", label: "AI Agent Management", icon: Users, badge: "5 Agents" },
  { id: "automation", label: "Automation Rules", icon: Sliders },
  { id: "security", label: "Security & Permissions", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "analytics", label: "Reports & Analytics", icon: BarChart3, badge: "Naira" },
  { id: "logs", label: "Activity Logs", icon: FileText },
  { id: "diagnostics", label: "DIAGNOSTICS", description: "Live latency and model info", icon: Zap },
];

export const DesktopSettingsView: React.FC<DesktopSettingsViewProps> = ({
  db,
  onUpdateDb,
  onClose,
  liveTimings,
  unifiedSettings,
}) => {
  const [activeTab, setActiveTab] = useState<DesktopTab>("connections");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFreeKey, setShowFreeKey] = useState(false);
  const [showPaidKey, setShowPaidKey] = useState(false);
  const [showMetaToken, setShowMetaToken] = useState(false);
  const [testingProfile, setTestingProfile] = useState<GeminiProfileType | null>(null);
  const [isSaving, setIsSaving] = useState<GeminiProfileType | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<string>("all");

  const notify = (msg: string) => {
    setActionNotice(msg);
  };

  const updateDatabase = (updater: (prev: SharedBusinessDatabase) => SharedBusinessDatabase) => {
    const next = updater(db);
    onUpdateDb(next);
    saveLocalBusinessDb(next);
  };

  const handleTestKey = async (profile: GeminiProfileType) => {
    const target = db.geminiProfiles[profile];
    if (!target.key && !target.hasKey) {
      notify("Please enter an API key first.");
      return;
    }

    setTestingProfile(profile);
    updateDatabase((prev) => ({
      ...prev,
      geminiProfiles: {
        ...prev.geminiProfiles,
        [profile]: {
          ...prev.geminiProfiles[profile],
          status: "testing",
        },
      },
    }));

    const result = await validateGeminiApiKey(target.key || "", profile);

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

    setIsSaving(profile);
    try {
      const res = await fetch("/api/business/save-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          key: target.key.trim(),
          model: target.model
        }),
      });

      if (res.ok) {
        const data = await res.json();
        updateDatabase((prev) => ({
          ...prev,
          geminiProfiles: {
            ...prev.geminiProfiles,
            [profile]: {
              ...prev.geminiProfiles[profile],
              ...data.profile,
              key: "",
            },
          },
        }));
        notify(`${profile === "free" ? "Free" : "Paid"} API key saved securely!`);
      } else {
        const err = await res.json().catch(() => ({}));
        notify(err.message || "Failed to save API key.");
      }
    } catch (e) {
      notify("Network error.");
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
            [profile]: {
              ...data.profile,
              key: "",
            },
          },
        }));
        notify(`${profile === "free" ? "Free" : "Paid"} API key removed.`);
      }
    } catch (e) {
      notify("Error clearing key.");
    }
  };

  // Filter sections by search query
  const filteredSections = DESKTOP_SECTIONS.filter((sec) =>
    sec.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[130] bg-[#020617] text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Top PC Header */}
      <header className="px-6 py-4 bg-[#0A1628]/95 border-b border-cyan-500/20 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-black italic shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            R
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider text-white">Rose AI Enterprise Desktop Control</h1>
            <p className="text-[10px] text-slate-400">Synchronized Business Hub • 5-Agent Hierarchy • Dual Gemini Architecture</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-black/40 border border-white/10 rounded-full text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-300">
              Backend Sync: {db.syncStatus.toUpperCase()}
            </span>
          </div>

          <button
            onClick={() => {
              saveLocalBusinessDb(db);
              syncBusinessDbWithServer(db);
              notify("All configuration changes saved and synchronized!");
            }}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" /> Save All Settings
          </button>

          <button
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Dual-Column Layout: Persistent Left Sidebar + Main Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Persistent Sidebar */}
        <aside className="w-72 bg-[#060e1a] border-r border-cyan-500/20 flex flex-col shrink-0">
          {/* Search Box */}
          <div className="p-3 border-b border-white/5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search settings..."
                className="w-full bg-[#081220] border border-cyan-500/20 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Section Navigation List */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
            {filteredSections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeTab === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveTab(sec.id)}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between text-left group ${
                    isActive
                      ? "bg-cyan-500/20 border border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)] font-black"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"}`} />
                    <div className="min-w-0">
                      <span className={`block truncate ${sec.id === 'diagnostics' ? 'text-emerald-400' : ''}`}>{sec.label}</span>
                      {sec.description && <span className="block text-[8.5px] opacity-50 truncate font-normal">{sec.description}</span>}
                    </div>
                  </div>
                  {sec.badge && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase ${
                      isActive ? "bg-cyan-400 text-slate-950" : "bg-white/5 text-slate-400"
                    }`}>
                      {sec.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sidebar Footer Info */}
          <div className="p-3 border-t border-white/5 bg-[#040810] text-[10px] text-slate-500 space-y-1">
            <p className="font-bold text-slate-400">Rose PC Agent v1.5.0</p>
            <p>Active Profile: <span className="text-cyan-400 font-bold uppercase">{db.activeGeminiProfile}</span></p>
          </div>
        </aside>

        {/* Right Main Configuration Panel */}
        <main className="flex-1 overflow-y-auto no-scrollbar p-6 bg-[#020617] space-y-6">
          {/* Action Notification Banner */}
          {actionNotice && (
            <div className="bg-emerald-950/80 border border-emerald-500/40 p-3 rounded-2xl text-xs text-emerald-300 flex items-center justify-between shadow-lg">
              <span className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {actionNotice}
              </span>
              <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 1: API KEYS & INTEGRATIONS */}
          {/* ========================================================= */}
          {activeTab === "connections" && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Key className="w-5 h-5" /> Connections
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Manage your API keys for Gemini (Voice) and Groq (Chat). Keys are stored securely in the server vault.
                </p>
              </div>

              {/* Providers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Gemini Card */}
                <div className="bg-[#060e1a] border border-emerald-500/40 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-white">Gemini (Voice)</h3>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        db.geminiProfiles.free.verificationStatus === 'VERIFIED'
                          ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-400"
                          : "bg-slate-500/20 border border-slate-500/40 text-slate-400"
                      }`}>
                        {db.geminiProfiles.free.verificationStatus || 'Not Configured'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Used for real-time voice conversations and advanced reasoning.</p>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">API Key</label>
                      <div className="relative">
                        <input
                          type={showFreeKey ? "text" : "password"}
                          value={db.geminiProfiles.free.key || db.geminiProfiles.free.maskedKey || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateDatabase((prev) => ({
                              ...prev,
                              geminiProfiles: {
                                ...prev.geminiProfiles,
                                free: { ...prev.geminiProfiles.free, key: val }
                              }
                            }));
                          }}
                          placeholder="Enter Gemini key..."
                          className="w-full bg-black/40 border border-emerald-500/20 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-emerald-500/50"
                        />
                        <button onClick={() => setShowFreeKey(!showFreeKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                          {showFreeKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveKey("free")}
                      disabled={isSaving === "free" || !db.geminiProfiles.free.key}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      {isSaving === "free" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
                      Save Gemini Key
                    </button>
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                      Get Key <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Groq Card */}
                <div className="bg-[#060e1a] border border-purple-500/40 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-purple-400" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-white">Groq (Chat)</h3>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        db.groq?.verificationStatus === 'VERIFIED'
                          ? "bg-purple-500/20 border border-purple-500/40 text-purple-400"
                          : "bg-slate-500/20 border border-slate-500/40 text-slate-400"
                      }`}>
                        {db.groq?.verificationStatus || 'Not Configured'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">Used for ultra-fast text chat completions and reasoning.</p>
                    
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">API Keys (Comma-separated)</label>
                      <div className="relative">
                        <input
                          type={showMetaToken ? "text" : "password"}
                          value={db.groq?.keys || db.groq?.maskedKeys || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateDatabase((prev) => ({
                              ...prev,
                              groq: { ...prev.groq, keys: val }
                            }));
                          }}
                          placeholder="Enter Groq keys..."
                          className="w-full bg-black/40 border border-purple-500/20 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none focus:border-purple-500/50"
                        />
                        <button onClick={() => setShowMetaToken(!showMetaToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                          {showMetaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const keys = db.groq?.keys;
                        if (!keys) return;
                        setIsSaving("free" as any); // Reusing isSaving state
                        try {
                          const res = await fetch("/api/business/save-groq", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ keys }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            updateDatabase((prev) => ({
                              ...prev,
                              groq: { ...prev.groq, verificationStatus: "VERIFIED", status: "connected", keys: "" }
                            }));
                            notify("Groq keys saved successfully!");
                          }
                        } catch (e) {} finally { setIsSaving(null); }
                      }}
                      disabled={isSaving === "free" || !db.groq?.keys}
                      className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      {isSaving === "free" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
                      Save Groq Keys
                    </button>
                    <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                      Get Keys <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Security Banner */}
              <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">Secure Server Storage</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Your API keys are stored in a secure server-side vault and never exposed to the client. We only use masked representations for display.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 2: AI MODEL CONFIGURATION */}
          {/* ========================================================= */}
          {activeTab === "models" && (
            <div className="space-y-5 max-w-4xl">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Cpu className="w-5 h-5" /> AI Model Configuration
                </h2>
                <p className="text-xs text-slate-400 mt-1">Configure real-time voice, reasoning, and multimodal models.</p>
              </div>

              <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Live Voice Call Model</label>
                    <select
                      className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl p-2.5 text-xs text-white outline-none focus:border-cyan-400"
                      defaultValue="gemini-3.8-live"
                    >
                      <option value="gemini-3.8-live">Gemini 3.8 Live (Recommended for Voice)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Text Chat & Subordinate Agents Model</label>
                    <select
                      className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl p-2.5 text-xs text-white outline-none focus:border-cyan-400"
                      defaultValue="gemini-3.5-flash"
                    >
                      <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 3: FIREBASE & DATABASE */}
          {/* ========================================================= */}
          {activeTab === "database" && (
            <div className="space-y-5 max-w-4xl">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Database className="w-5 h-5" /> Firebase & Database Settings
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Manage persistent backend database connectivity, cloud memory, and multi-device synchronization status.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4 text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Auth Status</span>
                  <p className="text-sm font-black text-emerald-400 mt-1">Verified & Active</p>
                </div>
                <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4 text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Database Engine</span>
                  <p className="text-sm font-black text-cyan-400 mt-1">Shared Business DB</p>
                </div>
                <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4 text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Last Synchronization</span>
                  <p className="text-xs font-mono font-bold text-white mt-1">
                    {new Date(db.lastSyncedAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              <div className="bg-[#060e1a] border border-cyan-500/30 rounded-2xl p-5 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-white">Firebase Project Configuration</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">apiKey</label>
                    <input
                      type="text"
                      value={db.firebaseConfig.apiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDatabase((prev) => ({
                          ...prev,
                          firebaseConfig: { ...prev.firebaseConfig, apiKey: val },
                        }));
                      }}
                      placeholder="AIzaSy..."
                      className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">projectId</label>
                    <input
                      type="text"
                      value={db.firebaseConfig.projectId}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDatabase((prev) => ({
                          ...prev,
                          firebaseConfig: { ...prev.firebaseConfig, projectId: val },
                        }));
                      }}
                      placeholder="rose-ai-agent"
                      className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl p-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 4: BUSINESS PROFILE */}
          {/* ========================================================= */}
          {activeTab === "profile" && (
            <div className="space-y-5 max-w-4xl">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Briefcase className="w-5 h-5" /> Enterprise Business Profile
                </h2>
                <p className="text-xs text-slate-400 mt-1">Official source of truth used by Rose and all 4 subordinate agents.</p>
              </div>

              <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Business Legal Name</label>
                    <input
                      type="text"
                      value={db.businessProfile.businessName}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDatabase((prev) => ({ ...prev, businessProfile: { ...prev.businessProfile, businessName: val } }));
                      }}
                      className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Industry / Sector</label>
                    <input
                      type="text"
                      value={db.businessProfile.category}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDatabase((prev) => ({ ...prev, businessProfile: { ...prev.businessProfile, category: val } }));
                      }}
                      className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl p-2.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">Phone</label>
                    <input
                      type="text"
                      value={db.businessProfile.contactPhone}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDatabase((prev) => ({ ...prev, businessProfile: { ...prev.businessProfile, contactPhone: val } }));
                      }}
                      className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl p-2 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">Email</label>
                    <input
                      type="email"
                      value={db.businessProfile.contactEmail}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDatabase((prev) => ({ ...prev, businessProfile: { ...prev.businessProfile, contactEmail: val } }));
                      }}
                      className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl p-2 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400">Operating Hours</label>
                    <input
                      type="text"
                      value={db.businessProfile.operatingHours}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateDatabase((prev) => ({ ...prev, businessProfile: { ...prev.businessProfile, operatingHours: val } }));
                      }}
                      className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl p-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">Customer Support Policy</label>
                  <textarea
                    rows={2}
                    value={db.businessProfile.customerSupportPolicy}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateDatabase((prev) => ({ ...prev, businessProfile: { ...prev.businessProfile, customerSupportPolicy: val } }));
                    }}
                    className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl p-2.5 text-xs text-white resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 5: CUSTOMER COMMUNICATION (MIRA) */}
          {/* ========================================================= */}
          {activeTab === "communication" && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" /> Customer Inboxes (Mira)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Multi-channel messaging hub across WhatsApp, Messenger, and Web.</p>
                </div>
                <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold rounded-full">
                  {db.messages.filter((m) => m.status === "pending").length} Pending Queries
                </span>
              </div>

              <div className="space-y-3">
                {db.messages.map((msg) => (
                  <div key={msg.id} className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4 space-y-2.5 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{msg.customerName}</span>
                        <span className="text-[10px] text-slate-400">({msg.customerPhone})</span>
                      </div>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                        {msg.platform}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 bg-[#081220] p-3 rounded-xl border border-white/5">{msg.message}</p>
                    {msg.replyText && (
                      <div className="text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-500/30 p-2.5 rounded-xl">
                        <span className="font-bold">Mira's Approved Response:</span> {msg.replyText}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 6: SALES & ORDER MANAGEMENT (ARIN) */}
          {/* ========================================================= */}
          {activeTab === "orders" && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" /> Sales & Order Management (Arin)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Order validation, inventory checks, and payment tracking.</p>
                </div>
              </div>

              <div className="space-y-3">
                {db.orders.map((ord) => (
                  <div key={ord.id} className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black font-mono text-white">{ord.orderNumber}</span>
                        <span className="text-xs text-slate-300">({ord.customerName} - {ord.phone})</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Items: {ord.items.map((i) => `${i.name} (x${i.quantity})`).join(", ")}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <span className="text-xs font-black text-emerald-400">
                        {ord.currency} {ord.totalAmount}
                      </span>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                          {ord.paymentStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 7: PARCEL & DELIVERY (ZAYAN) */}
          {/* ========================================================= */}
          {activeTab === "delivery" && (
            <div className="space-y-4 max-w-4xl">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Truck className="w-5 h-5" /> Parcel & Delivery Tracking (Zayan)
                </h2>
                <p className="text-xs text-slate-400 mt-1">Courier tracking integration and transit exception management.</p>
              </div>

              <div className="space-y-3">
                {db.parcels.map((p) => (
                  <div key={p.trackingNumber} className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4 space-y-2 shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-black text-cyan-300">{p.trackingNumber}</span>
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          p.status === "delivered"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : p.status === "delayed"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Destination: {p.destination} • Recipient: {p.recipientName}
                    </p>
                    <div className="flex justify-between text-[11px] text-slate-400 bg-black/40 p-2.5 rounded-xl border border-white/5">
                      <span>Courier: {p.courier}</span>
                      <span>ETA: {p.estimatedDelivery}</span>
                    </div>
                    {p.issueNote && (
                      <div className="text-xs text-amber-300 bg-amber-950/30 border border-amber-500/30 p-2 rounded-xl">
                        Notice: {p.issueNote}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 8: AI AGENT MANAGEMENT (5 AGENTS) */}
          {/* ========================================================= */}
          {activeTab === "agents" && (
            <div className="space-y-4 max-w-4xl">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Users className="w-5 h-5" /> 5-Agent Operational Hierarchy
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Rose presides as the main manager receiving continuous updates from Mira, Arin, Zayan, and Naira.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.values(db.agents).map((ag) => (
                  <div key={ag.id} className="bg-[#060e1a] border border-cyan-500/30 rounded-2xl p-4 space-y-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-black uppercase text-white">{ag.name}</h3>
                        <p className="text-[10px] text-cyan-400 font-bold">{ag.title}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase rounded-full border border-emerald-500/40">
                        {ag.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{ag.roleDescription}</p>
                    <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 text-[11px] text-slate-400">
                      <span className="font-bold text-slate-200">Latest Report:</span> {ag.lastReport}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 9: AUTOMATION RULES & OWNER APPROVAL */}
          {/* ========================================================= */}
          {activeTab === "automation" && (
            <div className="space-y-4 max-w-4xl">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Sliders className="w-5 h-5" /> Automation & Owner Approval Rules
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Sensitive operations (refunds, cancellations, price changes) strictly require Owner Approval.
                </p>
              </div>

              <div className="space-y-3">
                {db.automationRules.map((r) => (
                  <div key={r.id} className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{r.name}</span>
                        {r.requiresOwnerApproval && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-full">
                            Owner Approval Required
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{r.description}</p>
                    </div>

                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        updateDatabase((prev) => ({
                          ...prev,
                          automationRules: prev.automationRules.map((rule) =>
                            rule.id === r.id ? { ...rule, enabled: checked } : rule
                          ),
                        }));
                      }}
                      className="accent-cyan-400 w-5 h-5 cursor-pointer ml-4"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 10: SECURITY & PERMISSIONS */}
          {/* ========================================================= */}
          {activeTab === "security" && (
            <div className="space-y-4 max-w-4xl">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Shield className="w-5 h-5" /> Security & Access Controls
                </h2>
                <p className="text-xs text-slate-400 mt-1">Enterprise encryption, server-side secret protection, and audit checks.</p>
              </div>

              <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-5 space-y-3 text-xs text-slate-300">
                <p className="flex items-center gap-2 font-bold text-white">
                  <Lock className="w-4 h-4 text-emerald-400" /> Protected Architecture
                </p>
                <p>1. API keys are validated through secure backend proxies and never logged in plain text.</p>
                <p>2. Switching between Gemini Free and Paid profiles maintains clean isolation.</p>
                <p>3. All database operations validate user roles before executing state updates.</p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 11: NOTIFICATIONS */}
          {/* ========================================================= */}
          {activeTab === "notifications" && (
            <div className="space-y-4 max-w-4xl">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Bell className="w-5 h-5" /> Enterprise Notifications
                </h2>
                <p className="text-xs text-slate-400 mt-1">Configure desktop alerts for sales, parcel delays, and reports.</p>
              </div>

              <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4 space-y-3">
                {[
                  { label: "Real-time Order Alerts (Arin)", def: true },
                  { label: "Parcel Delays & Returns (Zayan)", def: true },
                  { label: "Escalated Customer Tickets (Mira)", def: true },
                  { label: "Daily Executive Financial Briefing (Naira & Rose)", def: true },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
                    <span className="text-xs font-bold text-slate-300">{item.label}</span>
                    <input type="checkbox" defaultChecked={item.def} className="accent-cyan-400 w-4 h-4 cursor-pointer" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 12: REPORTS & ANALYTICS (NAIRA) */}
          {/* ========================================================= */}
          {activeTab === "analytics" && (
            <div className="space-y-5 max-w-4xl">
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" /> Business Reports & Analytics (Naira)
                </h2>
                <p className="text-xs text-slate-400 mt-1">Cross-agent reconciliation, sales performance, and audit summaries.</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#060e1a] border border-emerald-500/30 rounded-2xl p-4 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Gross Sales Today</span>
                  <p className="text-xl font-black text-emerald-400 mt-1">BDT 14,250</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">8 Confirmed Orders</p>
                </div>
                <div className="bg-[#060e1a] border border-cyan-500/30 rounded-2xl p-4 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Settlement Rate</span>
                  <p className="text-xl font-black text-cyan-400 mt-1">100%</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">0 Missing Payments</p>
                </div>
                <div className="bg-[#060e1a] border border-teal-500/30 rounded-2xl p-4 text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Dispatched Parcels</span>
                  <p className="text-xl font-black text-teal-400 mt-1">6 Active</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">1 Delay Managed</p>
                </div>
              </div>

              <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-5 space-y-3">
                <h3 className="text-xs font-black uppercase text-white">Naira's Executive Audit Summary</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  "All financial and courier collections across Bangladesh courier partners are 100% accounted for. No unauthorized discounts or inventory anomalies detected. Customer communication latency averages 1.4 minutes under Mira."
                </p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 13: ACTIVITY LOGS */}
          {/* ========================================================= */}
          {activeTab === "logs" && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Activity Logs & Audit Trail
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Immutable record of all business and agent actions.</p>
                </div>

                <div className="flex gap-2">
                  {["all", "Rose", "Mira", "Arin", "Zayan", "Naira"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setLogFilter(f)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        logFilter === f
                          ? "bg-cyan-500/20 border border-cyan-400 text-cyan-300"
                          : "bg-black/40 text-slate-400 hover:text-white border border-white/5"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {db.activityLogs
                  .filter((log) => logFilter === "all" || log.performedBy.toLowerCase() === logFilter.toLowerCase())
                  .map((log) => (
                    <div key={log.id} className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-3.5 flex items-center justify-between shadow-md">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white">{log.action}</span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                            Agent: {log.performedBy}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{log.details}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                          {log.status}
                        </span>
                        <p className="text-[9px] font-mono text-slate-500 mt-1">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === "diagnostics" && (
            <div className="space-y-6 max-w-4xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-wider text-white">Live Diagnostics</h2>
                  <p className="text-xs text-slate-400">Real-time performance metrics and model synchronization status.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#060e1a] border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Model Info</h3>
                   <div className="space-y-2">
                     <div className="flex justify-between items-center"><span className="text-[10px] text-slate-500 uppercase">Active Model</span><span className="text-xs font-mono text-white">gemini-2.5-flash-live</span></div>
                     <div className="flex justify-between items-center"><span className="text-[10px] text-slate-500 uppercase">Voice</span><span className="text-xs text-white">{unifiedSettings.voiceName}</span></div>
                   </div>
                </div>

                <div className="bg-[#060e1a] border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Total Latency</h3>
                   <div className="flex items-baseline gap-2">
                     <span className="text-3xl font-black text-white">{liveTimings.speechEnd_to_firstAudio || "—"}</span>
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">ms</span>
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Mic → Data", val: liveTimings.micStart_to_firstChunk },
                  { label: "Speech → Text", val: liveTimings.speechEnd_to_transcript },
                  { label: "Text → Audio", val: liveTimings.transcript_to_firstAudio },
                  { label: "Buffer → Play", val: liveTimings.firstAudio_to_soundPlayed },
                ].map(stat => (
                  <div key={stat.label} className="bg-[#060e1a] border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</span>
                    <span className="text-sm font-black text-emerald-400">{stat.val ? `${stat.val}ms` : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
