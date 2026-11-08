import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Facebook, Instagram, Youtube, Check, Loader2, ExternalLink, Cpu, PenTool, Zap, ChevronRight } from "lucide-react";
import { getGeminiKey } from "../lib/geminiKey";

const DEVELOPER_INFO = {
  name: "MD YOUSUF KHAN",
  title: "WEB DEVELOPER",
  contacts: {
    whatsapp: { label: "WhatsApp (Personal)", value: "01671060679", link: "https://wa.me/8801671060679" },
    gmail: { label: "Gmail", value: "md.yousuf.khan060@gmail.com", link: "mailto:md.yousuf.khan060@gmail.com" }
  },
  social: {
    facebook: { label: "Facebook", link: "https://www.facebook.com/share/19jLkEGsFv/" },
    instagram: { label: "Instagram", link: "https://www.instagram.com/md_yousuf_khan02" },
    youtube: { label: "YouTube", link: "https://www.youtube.com/@Islamicalo060" },
    tiktok: { label: "TikTok", link: "https://www.tiktok.com/@yousufkhan060" }
  }
};

export const Developer = ({ setCurrentView, setToast, backView = "home" }: { setCurrentView: (v: any) => void, setToast: (t: string | any | null) => void, backView?: string }) => {
  const [copied, setCopied] = useState<string | null>(null);
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
    setToast("Copied");
  };

  return (
    <>
      <motion.div
        key="developer"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        className="fixed inset-0 z-[90] bg-[#020617] flex flex-col"
      >
        <header className="px-6 py-4 flex items-center gap-4 shrink-0 border-b border-white/5">
          <button onClick={() => setCurrentView(backView)} className="p-2.5 bg-white/5 rounded-full active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">DEVELOPER</h2>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 pb-32">
          <div className="flex flex-col items-center py-1">
            <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-900/30">
              <div className="w-full h-full rounded-full bg-[#020617] flex items-center justify-center text-white text-2xl font-black italic">
                MY
              </div>
            </div>
            <h1 className="text-base font-black text-white italic uppercase tracking-wider mt-2.5">
              {DEVELOPER_INFO.name}
            </h1>
            <span className="px-2.5 py-0.5 mt-1 text-[8.5px] font-bold text-white bg-purple-600 rounded-full uppercase tracking-wider">
              {DEVELOPER_INFO.title}
            </span>
          </div>
          
          <div>
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
              Find Me On
            </h3>
            <div className="grid grid-cols-4 gap-2.5">
              {Object.entries(DEVELOPER_INFO.social).map(([key, info]) => (
                <a
                  key={key}
                  href={info.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
                >
                  <div className="w-full h-16 rounded-2xl bg-[#0F172A] border border-white/10 flex items-center justify-center shadow-lg hover:border-purple-500/30 transition-colors">
                    {key === "facebook" && <Facebook className="w-6 h-6 text-blue-500" />}
                    {key === "instagram" && <Instagram className="w-6 h-6 text-pink-500" />}
                    {key === "youtube" && <Youtube className="w-6 h-6 text-red-500" />}
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                    {info.label}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

const DEFAULT_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-09-2025";

const LIVE_MODEL_CARDS = [
  {
    model: "gemini-2.5-flash-native-audio-preview-09-2025",
    badge: "BEST VOICE",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    description: "Natural Bengali voice, audio to audio",
  },
  {
    model: "gemini-live-2.5-flash-preview",
    badge: "STABLE",
    badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    description: "Reliable live voice",
  },
  {
    model: "gemini-2.0-flash-live-001",
    badge: "FALLBACK",
    badgeClass: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    description: "Older backup model",
  },
];

export const testLiveVoiceModelConnection = async (
  targetModel: string
): Promise<{ ok: boolean; error?: string }> => {
  const trimmed = (targetModel || "").trim();
  if (!trimmed) {
    return { ok: false, error: "Please enter a model name" };
  }
  if (!trimmed.startsWith("gemini-")) {
    return { ok: false, error: `Invalid model "${trimmed}"` };
  }

  let apiKey = getGeminiKey();

  if (!apiKey) {
    return { ok: false, error: "Gemini API key is missing. Add your key in Connections." };
  }

  return new Promise((resolve) => {
    let settled = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/live?model=${encodeURIComponent(trimmed)}&apiKey=${encodeURIComponent(apiKey)}&minimal=1`;

    let ws: WebSocket | null = null;
    const finish = (result: { ok: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (ws) {
        try {
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;
          ws.close();
        } catch (e) {}
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ ok: false, error: "Connection timed out" });
    }, 7000);

    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        // Server handles setup
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) {
            finish({ ok: false, error: String(msg.error.message || msg.error) });
            return;
          }
          if (msg.setupComplete) {
            finish({ ok: true });
          }
        } catch (e) {}
      };
      ws.onerror = () => {
        finish({ ok: false, error: "WebSocket connection failed" });
      };
      ws.onclose = (ev) => {
        if (!settled) {
          finish({
            ok: false,
            error: ev.reason || `Connection closed (code ${ev.code || 1006})`,
          });
        }
      };
    } catch (err: any) {
      finish({ ok: false, error: err?.message || "Failed to open connection" });
    }
  });
};

export const LiveModelSettings = ({
  setCurrentView,
  setToast,
}: {
  setCurrentView: (v: any) => void;
  setToast?: (t: string | any | null) => void;
}) => {
  const [savedModel, setSavedModel] = useState<string>(
    () => localStorage.getItem("voice_model") || DEFAULT_LIVE_MODEL
  );
  const [autoFallback, setAutoFallback] = useState<boolean>(() => {
    const stored = localStorage.getItem("voice_model_auto_fallback");
    return stored === null ? true : stored === "true";
  });

  const [showCustomPage, setShowCustomPage] = useState<boolean>(false);
  const [customInput, setCustomInput] = useState<string>(
    () => localStorage.getItem("voice_model") || DEFAULT_LIVE_MODEL
  );
  const [localToast, setLocalToast] = useState<string | null>(null);

  const notifyToast = (msg: string) => {
    if (setToast) {
      setToast(msg);
    } else {
      setLocalToast(msg);
      setTimeout(() => setLocalToast(null), 3000);
    }
  };

  const selectAndSaveModel = (model: string) => {
    const trimmed = model.trim() || DEFAULT_LIVE_MODEL;
    setSavedModel(trimmed);
    setCustomInput(trimmed);
    localStorage.setItem("voice_model", trimmed);

    window.dispatchEvent(new CustomEvent("voice_model_changed", { detail: trimmed }));

    notifyToast(`মডেল বদলে ${trimmed} হয়েছে`);
  };

  const toggleAutoFallback = () => {
    const next = !autoFallback;
    setAutoFallback(next);
    localStorage.setItem("voice_model_auto_fallback", String(next));
  };

  const handlePasteCustom = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCustomInput(text.trim());
      }
    } catch (e) {}
  };

  const handleSaveCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed) {
      selectAndSaveModel(trimmed);
      setShowCustomPage(false);
    }
  };

  if (showCustomPage) {
    return (
      <motion.div
        key="custom-live-model-page"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        className="fixed inset-0 z-[90] bg-[#020617] text-white flex flex-col overflow-hidden"
      >
        <header className="px-5 py-4 flex items-center gap-4 border-b border-purple-500/15 bg-[#020617]/95 backdrop-blur-md shrink-0">
          <button
            onClick={() => setShowCustomPage(false)}
            className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-white active:scale-95 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">
            CUSTOM MODEL
          </h2>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-32 space-y-4 no-scrollbar">
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-purple-300/80 pl-1">
              Model Name
            </label>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              className="w-full bg-[#0F172A] border border-purple-500/30 focus:border-purple-400 rounded-2xl px-4 py-3.5 font-mono text-xs sm:text-sm text-white placeholder:text-slate-500 outline-none transition-colors shadow-inner"
              placeholder="Enter Gemini live model name..."
            />
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handlePasteCustom}
              className="w-full py-3.5 bg-purple-700/80 hover:bg-purple-600 border border-purple-400/30 rounded-2xl font-black text-xs uppercase tracking-wider text-white active:scale-[0.99] transition-all shadow-md"
            >
              PASTE
            </button>

            <button
              type="button"
              onClick={handleSaveCustom}
              disabled={!customInput.trim()}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 border border-purple-400/40 rounded-2xl font-black text-xs uppercase tracking-wider text-white active:scale-[0.99] transition-all shadow-lg shadow-purple-950/50"
            >
              SAVE
            </button>
          </div>
        </div>

        {localToast && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] bg-purple-900/90 border border-purple-400/50 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md">
            {localToast}
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      key="live-model"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      className="fixed inset-0 z-[90] bg-[#020617] text-white flex flex-col overflow-hidden"
    >
      {/* Header */}
      <header className="px-5 py-4 flex items-center gap-4 border-b border-purple-500/15 bg-[#020617]/95 backdrop-blur-md shrink-0">
        <button
          onClick={() => setCurrentView("settings")}
          className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-white active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">
          LIVE VOICE MODEL
        </h2>
      </header>

      {/* Scrollable Page Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-32 space-y-3.5 no-scrollbar">
        {/* Model Cards List */}
        {LIVE_MODEL_CARDS.map((card) => {
          const isSelected = savedModel.trim() === card.model;
          return (
            <button
              key={card.model}
              type="button"
              onClick={() => selectAndSaveModel(card.model)}
              className={
                "w-full p-4 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99] " +
                (isSelected
                  ? "bg-purple-600/15 border-purple-500 shadow-lg shadow-purple-950/40"
                  : "bg-[#0F172A] border-purple-500/20 hover:border-purple-500/40")
              }
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                  <Cpu className="w-4 h-4" />
                </div>
                <span className="font-mono text-xs font-bold text-white break-all leading-snug flex-1">
                  {card.model}
                </span>
              </div>
              {isSelected && (
                <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0 shadow-md">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </button>
          );
        })}

        {/* Auto Fallback Button Card */}
        <div className="w-full p-4 rounded-2xl bg-[#0F172A] border border-purple-500/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider text-white">
              AUTO FALLBACK
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoFallback}
            onClick={toggleAutoFallback}
            className={
              "w-12 h-7 rounded-full p-1 transition-colors shrink-0 flex items-center " +
              (autoFallback
                ? "bg-purple-600 justify-end shadow-[0_0_12px_rgba(147,51,234,0.6)]"
                : "bg-slate-800 justify-start")
            }
          >
            <span className="w-5 h-5 rounded-full bg-white shadow-md" />
          </button>
        </div>

        {/* Custom Model Button Card */}
        <button
          type="button"
          onClick={() => {
            setCustomInput(savedModel);
            setShowCustomPage(true);
          }}
          className="w-full p-4 rounded-2xl bg-[#0F172A] border border-purple-500/20 hover:border-purple-500/40 flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
              <PenTool className="w-4 h-4" />
            </div>
            <span className="text-xs font-black uppercase tracking-wider text-white">
              CUSTOM MODEL
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
        </button>
      </div>

      {localToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] bg-purple-900/90 border border-purple-400/50 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md">
          {localToast}
        </div>
      )}
    </motion.div>
  );
};

