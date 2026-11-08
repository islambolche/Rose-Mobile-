import React, { useState, useEffect, useRef } from "react";
import {
  X,
  User,
  Globe,
  Volume2,
  Key,
  Code,
  Briefcase,
  Database,
  Check,
  RotateCcw,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  Play,
  Loader2,
  Sliders,
  CheckCircle2,
  Mic,
  Speaker,
  ExternalLink,
  Smartphone,
} from "lucide-react";
import { DevicePermissionsSettings } from "./DevicePermissionsSettings";
import {
  UnifiedSettings,
  FirebaseConfig,
  DEFAULT_UNIFIED_SETTINGS,
  loadUnifiedSettings,
  saveUnifiedSettings,
  AssistantPersonality,
  ReplyLength,
  FormalityStyle,
  EmotionStyle,
} from "../types/settings";
import { CREATOR_PROFILE } from "../lib/creator-profile";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (settings: UnifiedSettings) => void;
  onShowCreatorCard: () => void;
}

type TabType =
  | "character"
  | "language"
  | "voice"
  | "keys"
  | "developer"
  | "business"
  | "data"
  | "device";

const TABS: { id: TabType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: "character", label: "Character", icon: User },
  { id: "language", label: "Language & Style", icon: Globe },
  { id: "voice", label: "Voice & Model", icon: Volume2 },
  { id: "keys", label: "API Keys", icon: Key },
  { id: "developer", label: "MD YOUSUF KHAN\nWEB DEVELOPER", icon: Code },
  { id: "business", label: "Business Info", icon: Briefcase },
  { id: "data", label: "Data", icon: Database },
  { id: "device", label: "Device Permissions", icon: Smartphone },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [activeTab, setActiveTab] = useState<TabType>("character");
  const [form, setForm] = useState<UnifiedSettings>(loadUnifiedSettings);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  // API Key show/hide and testing
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [keyTestState, setKeyTestState] = useState<{ loading: boolean; result: string | null; isOk: boolean }>({
    loading: false,
    result: null,
    isOk: false,
  });
  const [visibleExtraKeys, setVisibleExtraKeys] = useState<Record<string, boolean>>({});
  const [showMetaToken, setShowMetaToken] = useState(false);
  const [firebasePasteText, setFirebasePasteText] = useState("");
  const [firebasePasteMsg, setFirebasePasteMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [cardSavedFeedback, setCardSavedFeedback] = useState<Record<string, boolean>>({});

  // Voice test state
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  // Audio devices
  const [audioInputDevices, setAudioInputDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<{ deviceId: string; label: string }[]>([]);

  // Clear data modal confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // File import ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load devices on mount/open once
  useEffect(() => {
    if (isOpen) {
      const current = loadUnifiedSettings();
      setForm(current);
      setSavedStatus(null);
      setKeyTestState({ loading: false, result: null, isOk: false });

      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices
          .enumerateDevices()
          .then((devices) => {
            const inputs = devices
              .filter((d) => d.kind === "audioinput")
              .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
            const outputs = devices
              .filter((d) => d.kind === "audiooutput")
              .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${i + 1}` }));
            setAudioInputDevices(inputs);
            setAudioOutputDevices(outputs);
          })
          .catch(() => {});
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFieldChange = <K extends keyof UnifiedSettings>(field: K, value: UnifiedSettings[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSavedStatus(null);
  };

  const handleSave = () => {
    saveUnifiedSettings(form);
    setSavedStatus("Saved");
    if (onSaved) onSaved(form);
  };

  const handleSaveCard = (cardName: string) => {
    saveUnifiedSettings(form);
    setSavedStatus("Saved");
    setCardSavedFeedback((prev) => ({ ...prev, [cardName]: true }));
    if (onSaved) onSaved(form);
  };

  const handleFirebaseFieldChange = (key: keyof FirebaseConfig, value: string) => {
    setForm((prev) => ({
      ...prev,
      firebaseConfig: {
        ...prev.firebaseConfig,
        [key]: value,
      },
    }));
    setSavedStatus(null);
    setCardSavedFeedback((prev) => ({ ...prev, firebase: false }));
  };

  const parseFirebaseConfigText = (raw: string): Partial<FirebaseConfig> | null => {
    if (!raw || !raw.trim()) return null;
    const trimmed = raw.trim();

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object") {
        return {
          apiKey: parsed.apiKey ? String(parsed.apiKey) : undefined,
          authDomain: parsed.authDomain ? String(parsed.authDomain) : undefined,
          projectId: parsed.projectId ? String(parsed.projectId) : undefined,
          storageBucket: parsed.storageBucket ? String(parsed.storageBucket) : undefined,
          messagingSenderId: parsed.messagingSenderId ? String(parsed.messagingSenderId) : undefined,
          appId: parsed.appId ? String(parsed.appId) : undefined,
        };
      }
    } catch (e) {
      // not direct JSON, continue to regex parsing
    }

    const extract = (field: string): string => {
      const regex = new RegExp(`['"]?${field}['"]?\\s*:\\s*['"\`]([^'"\`]+)['"\`]`, "i");
      const m = trimmed.match(regex);
      return m ? m[1].trim() : "";
    };

    const apiKey = extract("apiKey");
    const authDomain = extract("authDomain");
    const projectId = extract("projectId");
    const storageBucket = extract("storageBucket");
    const messagingSenderId = extract("messagingSenderId");
    const appId = extract("appId");

    if (apiKey || authDomain || projectId || storageBucket || messagingSenderId || appId) {
      return {
        apiKey,
        authDomain,
        projectId,
        storageBucket,
        messagingSenderId,
        appId,
      };
    }

    return null;
  };

  const handleAutoFillFirebase = (textToParse?: string) => {
    const text = textToParse !== undefined ? textToParse : firebasePasteText;
    const parsed = parseFirebaseConfigText(text);
    if (parsed && (parsed.apiKey || parsed.projectId)) {
      setForm((prev) => ({
        ...prev,
        firebaseConfig: {
          apiKey: parsed.apiKey || prev.firebaseConfig.apiKey,
          authDomain: parsed.authDomain || prev.firebaseConfig.authDomain,
          projectId: parsed.projectId || prev.firebaseConfig.projectId,
          storageBucket: parsed.storageBucket || prev.firebaseConfig.storageBucket,
          messagingSenderId: parsed.messagingSenderId || prev.firebaseConfig.messagingSenderId,
          appId: parsed.appId || prev.firebaseConfig.appId,
        },
      }));
      setFirebasePasteMsg({ text: "Firebase config auto-filled into the 6 fields below!", isError: false });
      setSavedStatus(null);
      setCardSavedFeedback((prev) => ({ ...prev, firebase: false }));
    } else {
      setFirebasePasteMsg({ text: "Could not detect Firebase keys. Please check format or fill fields manually.", isError: true });
    }
  };

  // Reset Character to default
  const handleResetCharacter = () => {
    setForm((prev) => ({
      ...prev,
      assistantName: DEFAULT_UNIFIED_SETTINGS.assistantName,
      personality: DEFAULT_UNIFIED_SETTINGS.personality,
      customPersonalityText: DEFAULT_UNIFIED_SETTINGS.customPersonalityText,
      toneWarmth: DEFAULT_UNIFIED_SETTINGS.toneWarmth,
      toneFormality: DEFAULT_UNIFIED_SETTINGS.toneFormality,
      toneHumor: DEFAULT_UNIFIED_SETTINGS.toneHumor,
    }));
    setSavedStatus(null);
  };

  // Test Voice
  const handleTestVoice = () => {
    setIsTestingVoice(true);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const text =
        form.language === "Bengali"
          ? `নমস্কার! আমি ${form.assistantName}। আপনার ব্যক্তিগত সহকারী।`
          : `Hello! I am ${form.assistantName}, your personal AI voice assistant.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = form.speakingSpeed || 1.0;
      utterance.onend = () => setIsTestingVoice(false);
      utterance.onerror = () => setIsTestingVoice(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsTestingVoice(false);
    }
  };

  // Test Key
  const handleTestKey = async () => {
    const key = (form.geminiApiKey || "").replace(/[\r\n\t\s"']+/g, "").trim();
    if (!key) {
      setKeyTestState({ loading: false, result: "Add your Gemini key in Settings > Connections.", isOk: false });
      return;
    }
    setKeyTestState({ loading: true, result: null, isOk: false });
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "hi" }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });
      const rawText = await res.text().catch(() => "");
      let data: any = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        setKeyTestState({
          loading: false,
          result: `Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`,
          isOk: false,
        });
        return;
      }
      if (!data || typeof data !== "object") {
        setKeyTestState({
          loading: false,
          result: `Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`,
          isOk: false,
        });
        return;
      }
      if (res.ok) {
        setKeyTestState({ loading: false, result: "Key is valid and active!", isOk: true });
      } else {
        const msg = data?.error?.message
          ? `${data.error.message} (HTTP ${res.status})`
          : `Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`;
        setKeyTestState({ loading: false, result: `Failed: ${msg}`, isOk: false });
      }
    } catch (err: any) {
      setKeyTestState({
        loading: false,
        result: "Cannot reach Gemini. Check your internet and your Gemini key.",
        isOk: false,
      });
    }
  };

  // Extra API keys handlers
  const handleAddExtraKey = () => {
    const newKey = { id: Date.now().toString(), name: "", key: "" };
    setForm((prev) => ({ ...prev, extraApiKeys: [...prev.extraApiKeys, newKey] }));
    setSavedStatus(null);
  };

  const handleUpdateExtraKey = (id: string, name: string, key: string) => {
    setForm((prev) => ({
      ...prev,
      extraApiKeys: prev.extraApiKeys.map((k) => (k.id === id ? { ...k, name, key } : k)),
    }));
    setSavedStatus(null);
  };

  const handleDeleteExtraKey = (id: string) => {
    setForm((prev) => ({
      ...prev,
      extraApiKeys: prev.extraApiKeys.filter((k) => k.id !== id),
    }));
    setSavedStatus(null);
  };

  // Export Settings
  const handleExportData = () => {
    const dataStr = JSON.stringify(form, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rose_settings_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import Settings
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const merged: UnifiedSettings = { ...DEFAULT_UNIFIED_SETTINGS, ...parsed };
        setForm(merged);
        saveUnifiedSettings(merged);
        if (onSaved) onSaved(merged);
        setSavedStatus("Imported & Saved");
      } catch (err) {
        alert("Invalid settings file format.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Clear all data
  const handleClearAllData = () => {
    localStorage.removeItem("rose_unified_settings");
    localStorage.removeItem("rose_api_keys");
    localStorage.removeItem("rose_settings");
    localStorage.removeItem("rose_prefs");
    localStorage.removeItem("rose_chat_history");
    const fresh = { ...DEFAULT_UNIFIED_SETTINGS };
    setForm(fresh);
    saveUnifiedSettings(fresh);
    if (onSaved) onSaved(fresh);
    setShowClearConfirm(false);
    setSavedStatus("All Data Reset");
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Modal Container */}
      <div className="w-full max-w-4xl h-[92vh] sm:h-[84vh] bg-[#0A1628] border border-cyan-500/40 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden text-slate-100 relative">
        {/* Header */}
        <div className="px-5 py-4 border-b border-cyan-500/20 bg-[#081220] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wider uppercase text-white flex items-center gap-2">
                Settings
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">Rose AI Configuration & Personalization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-300 border border-white/10 flex items-center justify-center text-slate-400 active:scale-95 transition-all"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Left vertical list + Right content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Vertical List */}
          <div className="w-28 sm:w-56 border-r border-cyan-500/15 bg-[#060e1a]/95 flex flex-col p-2 space-y-1.5 shrink-0 overflow-y-auto no-scrollbar">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSavedStatus(null);
                  }}
                  className={`w-full py-2.5 px-2.5 sm:px-3 rounded-2xl flex items-center gap-2.5 text-left transition-all active:scale-95 ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/20 to-teal-500/10 border border-cyan-400/60 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                      : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive ? "bg-cyan-500/20 text-cyan-300" : "bg-white/5 text-slate-400"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold truncate leading-tight whitespace-pre-line">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col bg-[#0A1628]/95 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
              {/* TAB 1: CHARACTER */}
              {activeTab === "character" && (
                <div className="space-y-4">
                  <div className="border-b border-white/5 pb-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400">Character Settings</h3>
                    <p className="text-xs text-slate-400">Define Rose's name, personality profile, tone, and guidelines.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Name of the assistant</label>
                    <input
                      type="text"
                      value={form.assistantName}
                      onChange={(e) => handleFieldChange("assistantName", e.target.value)}
                      placeholder="Rose"
                      className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Personality</label>
                    <select
                      value={form.personality}
                      onChange={(e) => handleFieldChange("personality", e.target.value as AssistantPersonality)}
                      className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Friendly">Friendly</option>
                      <option value="Professional">Professional</option>
                      <option value="Funny">Funny</option>
                      <option value="Companion">Companion</option>
                      <option value="GF Mode">GF Mode</option>
                      <option value="Teacher">Teacher</option>
                      <option value="Developer">Developer</option>
                      <option value="Emotional">Emotional</option>
                      <option value="Caring">Caring</option>
                      <option value="Motivational">Motivational</option>
                      <option value="Calm">Calm</option>
                      <option value="Cute">Cute</option>
                      <option value="Flirty">Flirty</option>
                      <option value="Protective">Protective</option>
                      <option value="Deep Thinker">Deep Thinker</option>
                      <option value="Storyteller">Storyteller</option>
                      <option value="Sarcastic">Sarcastic</option>
                      <option value="Energetic">Energetic</option>
                      <option value="Listener">Listener</option>
                      <option value="Confident">Confident</option>
                      <option value="Empathetic">Empathetic</option>
                      <option value="Playful">Playful</option>
                      <option value="Wise Friend">Wise Friend</option>
                      <option value="Supportive Partner">Supportive Partner</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Custom personality and rules</label>
                    <textarea
                      value={form.customPersonalityText}
                      onChange={(e) => handleFieldChange("customPersonalityText", e.target.value)}
                      rows={3}
                      placeholder="e.g. Always address me as Boss. Be playful yet sharp. Remind me to take breaks."
                      className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] resize-none"
                    />
                  </div>

                  {/* Tone Sliders */}
                  <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4 space-y-3.5">
                    <span className="text-xs font-black uppercase tracking-wider text-cyan-300">Tone Sliders</span>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-300">Warmth</span>
                        <span className="text-cyan-400">{form.toneWarmth}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={form.toneWarmth}
                        onChange={(e) => handleFieldChange("toneWarmth", Number(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-300">Formality</span>
                        <span className="text-cyan-400">{form.toneFormality}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={form.toneFormality}
                        onChange={(e) => handleFieldChange("toneFormality", Number(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-300">Humor</span>
                        <span className="text-cyan-400">{form.toneHumor}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={form.toneHumor}
                        onChange={(e) => handleFieldChange("toneHumor", Number(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleResetCharacter}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-slate-300 active:scale-95 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                    Reset to default
                  </button>
                </div>
              )}

              {/* TAB 2: LANGUAGE & SPEAKING STYLE */}
              {activeTab === "language" && (
                <div className="space-y-4">
                  <div className="border-b border-white/5 pb-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400">Language & Speaking Style</h3>
                    <p className="text-xs text-slate-400">Configure language, pacing, and conversational tone.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Language</label>
                    <select
                      value={form.language}
                      onChange={(e) => handleFieldChange("language", e.target.value)}
                      className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400"
                    >
                      <option value="Bengali">Bengali (বাংলা) (default)</option>
                      <option value="English">English</option>
                      <option value="Hindi">Hindi (हिन्दी)</option>
                      <option value="Arabic">Arabic (العربية)</option>
                      <option value="Mixed Bangla-English">Mixed Bangla-English (Banglish)</option>
                    </select>
                  </div>

                  {/* How to speak selectors */}
                  <div className="space-y-3 bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4">
                    <span className="text-xs font-black uppercase tracking-wider text-cyan-300">How to speak</span>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">Reply Length</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["Short replies", "Detailed replies"] as ReplyLength[]).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handleFieldChange("replyLength", opt)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                              form.replyLength === opt
                                ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                                : "bg-black/30 border-white/10 text-slate-400 hover:text-white"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">Formality</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["Formal", "Casual"] as FormalityStyle[]).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handleFieldChange("formalityStyle", opt)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                              form.formalityStyle === opt
                                ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                                : "bg-black/30 border-white/10 text-slate-400 hover:text-white"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">Emotion</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["Emotional", "Neutral"] as EmotionStyle[]).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handleFieldChange("emotionStyle", opt)}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                              form.emotionStyle === opt
                                ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                                : "bg-black/30 border-white/10 text-slate-400 hover:text-white"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Speaking Speed Slider */}
                  <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-300">Speaking Speed</span>
                      <span className="text-cyan-400">{form.speakingSpeed.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      value={form.speakingSpeed}
                      onChange={(e) => handleFieldChange("speakingSpeed", parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                      <span>0.5x (Slow)</span>
                      <span>1.0x (Normal)</span>
                      <span>2.0x (Fast)</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Extra speaking instructions</label>
                    <textarea
                      value={form.extraSpeakingInstructions}
                      onChange={(e) => handleFieldChange("extraSpeakingInstructions", e.target.value)}
                      rows={2}
                      placeholder="e.g. Keep greetings brief. Avoid saying 'Sure, I can help with that'."
                      className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: VOICE & MODEL */}
              {activeTab === "voice" && (
                <div className="space-y-4">
                  <div className="border-b border-white/5 pb-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400">Voice & Model</h3>
                    <p className="text-xs text-slate-400">Select voice model, audio hardware devices, and Gemini models.</p>
                  </div>

                  {/* Voice Dropdown & Test voice */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Voice</label>
                    <div className="flex gap-2">
                      <select
                        value={form.voiceName}
                        onChange={(e) => handleFieldChange("voiceName", e.target.value)}
                        className="flex-1 bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400"
                      >
                        <option value="Sulafat">Sulafat (Warm, gentle & clear - Default)</option>
                        <option value="Aoede">Aoede (Bright & lively)</option>
                        <option value="Charon">Charon (Deep & measured)</option>
                        <option value="Fenrir">Fenrir (Authoritative & strong)</option>
                        <option value="Kore">Kore (Soft & calm)</option>
                        <option value="Puck">Puck (Playful & energetic)</option>
                        <option value="Leda">Leda (Empathetic & friendly)</option>
                        <option value="Zephyr">Zephyr (Breezy & modern)</option>
                      </select>
                      <button
                        onClick={handleTestVoice}
                        disabled={isTestingVoice}
                        className="px-3.5 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 rounded-xl text-xs font-black uppercase tracking-wider text-cyan-300 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                      >
                        {isTestingVoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Test voice
                      </button>
                    </div>
                  </div>

                  {/* Voice Model Mode Selector */}
                  <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4 space-y-2">
                    <label className="text-xs font-bold text-slate-300 block">Voice Engine Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleFieldChange("voiceModelMode", "fast")}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 ${
                          form.voiceModelMode !== "quality"
                            ? "bg-purple-500/20 border-purple-400 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                            : "bg-black/30 border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        <span className="font-black text-[13px]">Fast mode (Groq)</span>
                        <span className="text-[10px] opacity-75 font-normal">Whisper STT + Fast Llama LLM</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFieldChange("voiceModelMode", "quality")}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center gap-1 ${
                          form.voiceModelMode === "quality"
                            ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                            : "bg-black/30 border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        <span className="font-black text-[13px]">Quality mode (Gemini)</span>
                        <span className="text-[10px] opacity-75 font-normal">Probed locked Gemini Flash model</span>
                      </button>
                    </div>
                  </div>

                  {/* Model Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">Live Voice Model</label>
                      <select
                        value={form.liveVoiceModel}
                        onChange={(e) => handleFieldChange("liveVoiceModel", e.target.value)}
                        className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400"
                      >
                        <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                        <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option>
                        <option value="gemini-flash-latest">Gemini Flash Latest</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">Text Chat Model</label>
                      <select
                        value={form.textChatModel}
                        onChange={(e) => handleFieldChange("textChatModel", e.target.value)}
                        className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-400"
                      >
                        <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                        <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option>
                        <option value="gemini-flash-latest">Gemini Flash Latest</option>
                      </select>
                    </div>
                  </div>

                  {/* Hardware Device Selection */}
                  <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4 space-y-3">
                    <span className="text-xs font-black uppercase tracking-wider text-cyan-300">Hardware Devices</span>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5 text-cyan-400" />
                        Microphone Input
                      </label>
                      <select
                        value={form.selectedMicDeviceId}
                        onChange={(e) => handleFieldChange("selectedMicDeviceId", e.target.value)}
                        className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                      >
                        <option value="">Default Microphone</option>
                        {audioInputDevices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Speaker className="w-3.5 h-3.5 text-cyan-400" />
                        Speaker Output
                      </label>
                      <select
                        value={form.selectedSpeakerDeviceId}
                        onChange={(e) => handleFieldChange("selectedSpeakerDeviceId", e.target.value)}
                        className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-400"
                      >
                        <option value="">Default Speaker / Headphones</option>
                        {audioOutputDevices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: API KEYS */}
              {activeTab === "keys" && (
                <div className="space-y-4">
                  <div className="border-b border-white/5 pb-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400">API Keys & Integrations</h3>
                    <p className="text-xs text-slate-400">Manage required credentials for Gemini, Firebase, and external services.</p>
                  </div>

                  {/* CARD 1 — GEMINI API KEY (required) */}
                  <div className="bg-[#060e1a] border border-cyan-500/30 rounded-2xl p-4 space-y-3.5 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-white">
                          CARD 1 — GEMINI API KEY <span className="text-cyan-400 font-bold">(required)</span>
                        </h4>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                          form.geminiApiKey?.trim()
                            ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400"
                            : "bg-amber-500/15 border border-amber-500/40 text-amber-400"
                        }`}
                      >
                        {form.geminiApiKey?.trim() ? (
                          <>
                            <Check className="w-3 h-3" /> Saved
                          </>
                        ) : (
                          "Missing"
                        )}
                      </span>
                    </div>

                    <div>
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 rounded-xl text-xs font-black uppercase tracking-wider text-cyan-300 active:scale-95 transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                      >
                        Get Gemini API Key <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>



                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showGeminiKey ? "text" : "password"}
                            value={form.geminiApiKey}
                            onChange={(e) => {
                              handleFieldChange("geminiApiKey", e.target.value);
                              setKeyTestState({ loading: false, result: null, isOk: false });
                              setCardSavedFeedback((prev) => ({ ...prev, gemini: false }));
                            }}
                            placeholder="AIzaSy..."
                            className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowGeminiKey(!showGeminiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          >
                            {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleSaveCard("gemini")}
                            className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" /> Save
                          </button>
                        </div>
                      </div>

                      {keyTestState.result && (
                        <div
                          className={`text-xs font-bold px-3 py-2 rounded-xl border flex items-center gap-1.5 ${
                            keyTestState.isOk
                              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                              : "bg-red-500/10 border-red-500/40 text-red-400"
                          }`}
                        >
                          {keyTestState.isOk ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                          {keyTestState.result}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CARD 2 — FIREBASE CONFIG (required for admin login, device approval and cloud memory) */}
                  <div className="bg-[#060e1a] border border-cyan-500/30 rounded-2xl p-4 space-y-3.5 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-cyan-400" />
                          <h4 className="text-xs font-black uppercase tracking-wider text-white">CARD 2 — FIREBASE CONFIG</h4>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">
                          (required for admin login, device approval and cloud memory)
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                          form.firebaseConfig?.apiKey?.trim() && form.firebaseConfig?.projectId?.trim()
                            ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400"
                            : "bg-amber-500/15 border border-amber-500/40 text-amber-400"
                        }`}
                      >
                        {form.firebaseConfig?.apiKey?.trim() && form.firebaseConfig?.projectId?.trim() ? (
                          <>
                            <Check className="w-3 h-3" /> Saved
                          </>
                        ) : (
                          "Missing"
                        )}
                      </span>
                    </div>

                    <div>
                      <a
                        href="https://console.firebase.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 rounded-xl text-xs font-black uppercase tracking-wider text-cyan-300 active:scale-95 transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                      >
                        Open Firebase Console <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>

                    <div className="text-xs text-slate-300 bg-black/40 border border-cyan-500/20 rounded-xl p-3 leading-relaxed font-medium">
                      <p className="text-[11px] font-bold text-cyan-400 mb-0.5">১. নতুন প্রজেক্ট বানান ২. Web app (&lt;/&gt;) যোগ করুন ৩. config-এর মানগুলো নিচে বসান</p>
                    </div>

                    {/* Paste full config box */}
                    <div className="space-y-1.5 bg-[#081220] border border-cyan-500/20 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300">Paste full config</label>
                        <span className="text-[10px] text-cyan-400/80 font-medium">Auto-fills the 6 fields below</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <textarea
                          value={firebasePasteText}
                          onChange={(e) => {
                            setFirebasePasteText(e.target.value);
                            handleAutoFillFirebase(e.target.value);
                          }}
                          placeholder='Paste Firebase snippet (const firebaseConfig = { apiKey: "...", projectId: "...", ... } or JSON)...'
                          rows={2}
                          className="flex-1 bg-[#060e1a] border border-cyan-500/30 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 font-mono resize-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleAutoFillFirebase()}
                          className="px-3.5 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 rounded-xl text-xs font-black uppercase tracking-wider text-cyan-300 active:scale-95 transition-all self-stretch sm:self-auto flex items-center justify-center shrink-0"
                        >
                          Auto-fill
                        </button>
                      </div>
                      {firebasePasteMsg && (
                        <p className={`text-[11px] font-bold ${firebasePasteMsg.isError ? "text-amber-400" : "text-emerald-400"}`}>
                          {firebasePasteMsg.text}
                        </p>
                      )}
                    </div>

                    {/* 6 input fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400">apiKey</label>
                        <input
                          type="text"
                          value={form.firebaseConfig?.apiKey || ""}
                          onChange={(e) => handleFirebaseFieldChange("apiKey", e.target.value)}
                          placeholder="AIzaSy..."
                          className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400">authDomain</label>
                        <input
                          type="text"
                          value={form.firebaseConfig?.authDomain || ""}
                          onChange={(e) => handleFirebaseFieldChange("authDomain", e.target.value)}
                          placeholder="your-project.firebaseapp.com"
                          className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400">projectId</label>
                        <input
                          type="text"
                          value={form.firebaseConfig?.projectId || ""}
                          onChange={(e) => handleFirebaseFieldChange("projectId", e.target.value)}
                          placeholder="your-project-id"
                          className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400">storageBucket</label>
                        <input
                          type="text"
                          value={form.firebaseConfig?.storageBucket || ""}
                          onChange={(e) => handleFirebaseFieldChange("storageBucket", e.target.value)}
                          placeholder="your-project.appspot.com"
                          className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400">messagingSenderId</label>
                        <input
                          type="text"
                          value={form.firebaseConfig?.messagingSenderId || ""}
                          onChange={(e) => handleFirebaseFieldChange("messagingSenderId", e.target.value)}
                          placeholder="1234567890"
                          className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-400">appId</label>
                        <input
                          type="text"
                          value={form.firebaseConfig?.appId || ""}
                          onChange={(e) => handleFirebaseFieldChange("appId", e.target.value)}
                          placeholder="1:1234567890:web:abcdef..."
                          className="w-full bg-[#081220] border border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[11px]">
                        {cardSavedFeedback.firebase && (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Firebase config saved!
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleSaveCard("firebase")}
                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Save Firebase Config
                      </button>
                    </div>
                  </div>

                  {/* CARD 3 — OTHER KEYS (later) */}
                  <div className="bg-[#060e1a] border border-cyan-500/30 rounded-2xl p-4 space-y-3.5 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-white">CARD 3 — OTHER KEYS (later)</h4>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                          form.metaAccessToken?.trim() || form.extraApiKeys.some((k) => k.key.trim())
                            ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400"
                            : "bg-slate-500/20 border border-slate-500/40 text-slate-400"
                        }`}
                      >
                        {form.metaAccessToken?.trim() || form.extraApiKeys.some((k) => k.key.trim()) ? (
                          <>
                            <Check className="w-3 h-3" /> Saved
                          </>
                        ) : (
                          "Missing"
                        )}
                      </span>
                    </div>

                    {/* Meta Access Token */}
                    <div className="space-y-1.5 bg-[#081220] border border-cyan-500/20 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-200">
                          Meta Access Token (Messenger / WhatsApp / Instagram)
                        </label>
                        <span className="text-[9px] font-black uppercase tracking-wider text-cyan-400 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
                          Needed later
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showMetaToken ? "text" : "password"}
                            value={form.metaAccessToken || ""}
                            onChange={(e) => {
                              handleFieldChange("metaAccessToken", e.target.value);
                              setCardSavedFeedback((prev) => ({ ...prev, other: false }));
                            }}
                            placeholder="EAAG..."
                            className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowMetaToken(!showMetaToken)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          >
                            {showMetaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button
                          onClick={() => handleSaveCard("other")}
                          className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                      </div>
                    </div>

                    {/* Extra Name + Value Keys */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-300">Custom Provider Keys</span>
                        <button
                          onClick={handleAddExtraKey}
                          className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 active:scale-95 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          + Add another key
                        </button>
                      </div>

                      {form.extraApiKeys.length === 0 ? (
                        <p className="text-xs text-slate-500 italic bg-[#081220] p-3 rounded-xl border border-white/5">
                          No custom keys added yet. Tap "+ Add another key" to store custom API tokens.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {form.extraApiKeys.map((item) => {
                            const isVisible = !!visibleExtraKeys[item.id];
                            return (
                              <div
                                key={item.id}
                                className="bg-[#081220] border border-cyan-500/20 rounded-xl p-3 flex flex-col sm:flex-row gap-2 items-center"
                              >
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleUpdateExtraKey(item.id, e.target.value, item.key)}
                                  placeholder="Key name (e.g. OpenAI / Groq)"
                                  className="w-full sm:w-1/3 bg-[#060e1a] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400"
                                />
                                <div className="relative flex-1 w-full">
                                  <input
                                    type={isVisible ? "text" : "password"}
                                    value={item.key}
                                    onChange={(e) => handleUpdateExtraKey(item.id, item.name, e.target.value)}
                                    placeholder="Key value..."
                                    className="w-full bg-[#060e1a] border border-white/10 rounded-lg px-3 py-2 pr-9 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVisibleExtraKeys((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                                    }
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                  >
                                    {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                                <button
                                  onClick={() => handleDeleteExtraKey(item.id)}
                                  className="p-2 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                                  title="Delete key"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Note Banner */}
                  <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-3.5 text-xs text-cyan-200 flex items-center gap-2.5 shadow-sm">
                    <Key className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Keys are saved only in this browser. Never share them or paste them in chat.</span>
                  </div>
                </div>
              )}

              {/* TAB 5: DEVELOPER PROFILE */}
              {activeTab === "developer" && (
                <div className="space-y-6">
                  <div className="border-b border-white/5 pb-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400">Creator Profile</h3>
                    <p className="text-xs text-slate-400">Fixed information about the creator.</p>
                  </div>

                  <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-6 text-center space-y-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-full mx-auto shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center text-white text-2xl font-black">
                      YK
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white">{CREATOR_PROFILE.name}</h4>
                      <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest">{CREATOR_PROFILE.role}</p>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                      {CREATOR_PROFILE.bio}
                    </p>
                    <div className="flex justify-center gap-3 pt-2">
                      {CREATOR_PROFILE.socials.map(social => (
                        <a 
                          key={social.label}
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold text-slate-300 transition-colors"
                        >
                          {social.label}
                        </a>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">Email</label>
                      <input
                        type="email"
                        value={form.developerEmail}
                        onChange={(e) => handleFieldChange("developerEmail", e.target.value)}
                        placeholder="md.yousuf.khan060@gmail.com"
                        className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">Phone</label>
                      <input
                        type="tel"
                        value={form.developerPhone}
                        onChange={(e) => handleFieldChange("developerPhone", e.target.value)}
                        placeholder="01671060679"
                        className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">Website</label>
                      <input
                        type="url"
                        value={form.developerWebsite}
                        onChange={(e) => handleFieldChange("developerWebsite", e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">GitHub</label>
                      <input
                        type="url"
                        value={form.developerGithub}
                        onChange={(e) => handleFieldChange("developerGithub", e.target.value)}
                        placeholder="https://github.com/..."
                        className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Company / Business name</label>
                    <input
                      type="text"
                      value={form.developerCompany}
                      onChange={(e) => handleFieldChange("developerCompany", e.target.value)}
                      placeholder="Company name"
                      className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Short bio</label>
                    <input
                      type="text"
                      value={form.developerBio}
                      onChange={(e) => handleFieldChange("developerBio", e.target.value)}
                      placeholder="Creator and developer of Rose AI"
                      className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">About me and my business</label>
                    <textarea
                      value={form.developerAboutBusiness}
                      onChange={(e) => handleFieldChange("developerAboutBusiness", e.target.value)}
                      rows={3}
                      placeholder="Tell Rose about your projects, goals, preferred coding frameworks, and client work..."
                      className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 6: BUSINESS INFO */}
              {activeTab === "business" && (
                <div className="space-y-4">
                  <div className="border-b border-white/5 pb-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400">Business Info</h3>
                    <p className="text-xs text-slate-400">Information Rose will use when acting on behalf of your business.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Business name</label>
                    <input
                      type="text"
                      value={form.businessName}
                      onChange={(e) => handleFieldChange("businessName", e.target.value)}
                      placeholder="My Business Ltd"
                      className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Product list</label>
                    <textarea
                      value={form.productList}
                      onChange={(e) => handleFieldChange("productList", e.target.value)}
                      rows={2}
                      placeholder="List products or services with pricing and descriptions..."
                      className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">Delivery policy</label>
                      <textarea
                        value={form.deliveryPolicy}
                        onChange={(e) => handleFieldChange("deliveryPolicy", e.target.value)}
                        rows={2}
                        placeholder="Estimated delivery timelines and shipping methods..."
                        className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300">Return / Refund policy</label>
                      <textarea
                        value={form.returnPolicy}
                        onChange={(e) => handleFieldChange("returnPolicy", e.target.value)}
                        rows={2}
                        placeholder="Return window, refund requirements, and conditions..."
                        className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 resize-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Working hours</label>
                    <input
                      type="text"
                      value={form.workingHours}
                      onChange={(e) => handleFieldChange("workingHours", e.target.value)}
                      placeholder="e.g. 9:00 AM - 10:00 PM (Everyday)"
                      className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Notes for agents</label>
                    <textarea
                      value={form.agentNotes}
                      onChange={(e) => handleFieldChange("agentNotes", e.target.value)}
                      rows={2}
                      placeholder="Instructions for how Rose handles inquiries, escalations, or discounts..."
                      className="w-full bg-[#060e1a] border border-cyan-500/30 rounded-xl p-3 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-400 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 7: DATA */}
              {activeTab === "data" && (
                <div className="space-y-5">
                  <div className="border-b border-white/5 pb-2">
                    <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400">Data Management</h3>
                    <p className="text-xs text-slate-400">Export, import, or reset all application data stored in this browser.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Export */}
                    <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                          <Download className="w-4 h-4 text-cyan-400" />
                          Export Settings
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Download a complete JSON backup of all preferences, developer profile, and custom rules.
                        </p>
                      </div>
                      <button
                        onClick={handleExportData}
                        className="w-full py-2.5 px-4 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 rounded-xl text-xs font-black uppercase tracking-wider text-cyan-300 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download JSON
                      </button>
                    </div>

                    {/* Import */}
                    <div className="bg-[#060e1a] border border-cyan-500/20 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                          <Upload className="w-4 h-4 text-cyan-400" />
                          Import Settings
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">
                          Restore settings and preferences from a previously downloaded JSON file.
                        </p>
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".json"
                        onChange={handleImportFile}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl text-xs font-black uppercase tracking-wider text-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        Upload JSON File
                      </button>
                    </div>
                  </div>

                  {/* Clear All Data */}
                  <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <h4 className="text-xs font-black uppercase tracking-wider">Clear All Local Data</h4>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Permanently wipes all local preferences, API keys, chat history, and developer details from this browser.
                    </p>
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear all data
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Footer: Save Button + "Saved" confirmation on every tab */}
            <div className="px-5 py-3 border-t border-cyan-500/20 bg-[#060e1a] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                {savedStatus && (
                  <span className="text-cyan-300 text-xs font-bold flex items-center gap-1 bg-cyan-950/80 border border-cyan-500/40 px-3 py-1 rounded-full animate-in fade-in zoom-in-95 duration-150">
                    <Check className="w-3.5 h-3.5 text-cyan-400" /> {savedStatus}
                  </span>
                )}
              </div>
              <button
                onClick={handleSave}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 rounded-xl font-black uppercase text-xs tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-95 transition-all flex items-center gap-2"
              >
                <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                Save Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Clear All Data */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#0A1628] border border-red-500/50 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black uppercase text-white tracking-wider">Reset Everything?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to clear all settings? This will reset all preferences and keys to defaults.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black uppercase tracking-wider text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllData}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-900/40"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
