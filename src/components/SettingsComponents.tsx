import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Facebook, Instagram, Youtube, Check, Loader2, ExternalLink } from "lucide-react";
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
    try {
      const tokenRes = await fetch("/api/keys/get-live-token");
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        if (tokenData?.token) {
          apiKey = String(tokenData.token).trim();
        }
      }
    } catch (e) {}
  }

  if (!apiKey) {
    return { ok: false, error: "Gemini API key is missing. Add your key in Connections." };
  }

  return new Promise((resolve) => {
    let settled = false;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl =
      `${protocol}//${window.location.host}/api/live?` +
      `model=${encodeURIComponent(trimmed)}&` +
      `apiKey=${encodeURIComponent(apiKey)}&` +
      `minimal=1`;

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
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.error) {
            finish({ ok: false, error: String(msg.error) });
            return;
          }
          if (msg.setupComplete) {
            // If server fell back to default model because targetModel failed
            if (msg.model && msg.model !== trimmed) {
              finish({ ok: false, error: `Model "${trimmed}" failed to connect` });
              return;
            }
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

export const LiveModelSettings = ({ setCurrentView }: { setCurrentView: (v: any) => void }) => {
  const [savedModel, setSavedModel] = useState<string>(
    () => localStorage.getItem("voice_model") || DEFAULT_LIVE_MODEL
  );
  const [modelName, setModelName] = useState<string>(
    () => localStorage.getItem("voice_model") || DEFAULT_LIVE_MODEL
  );
  const [autoFallback, setAutoFallback] = useState<boolean>(() => {
    const stored = localStorage.getItem("voice_model_auto_fallback");
    return stored === null ? true : stored === "true";
  });
  const [saveStatus, setSaveStatus] = useState<"saved" | "error" | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const toggleAutoFallback = () => {
    const next = !autoFallback;
    setAutoFallback(next);
    localStorage.setItem("voice_model_auto_fallback", String(next));
    if (!next) {
      setFallbackMessage(null);
    }
  };

  const tryAutoFallbackFrom = async (failedModel: string): Promise<string | null> => {
    const list = LIVE_MODEL_CARDS.map((c) => c.model);
    const currentIndex = list.indexOf(failedModel.trim());
    const orderedCandidates: string[] = [];

    if (currentIndex >= 0) {
      for (let i = 1; i < list.length; i++) {
        orderedCandidates.push(list[(currentIndex + i) % list.length]);
      }
    } else {
      orderedCandidates.push(...list);
    }

    for (const candidate of orderedCandidates) {
      const res = await testLiveVoiceModelConnection(candidate);
      if (res.ok) {
        setModelName(candidate);
        setSavedModel(candidate);
        localStorage.setItem("voice_model", candidate);
        setFallbackMessage(`Switched to ${candidate}`);
        return candidate;
      }
    }

    // Even if offline/missing key prevented live handshake, still step to the next model in the list
    if (orderedCandidates.length > 0) {
      const nextCandidate = orderedCandidates[0];
      setModelName(nextCandidate);
      setSavedModel(nextCandidate);
      localStorage.setItem("voice_model", nextCandidate);
      setFallbackMessage(`Switched to ${nextCandidate}`);
      return nextCandidate;
    }

    return null;
  };

  const saveModel = async () => {
    const trimmed = modelName.trim() || DEFAULT_LIVE_MODEL;
    setModelName(trimmed);
    setSavedModel(trimmed);
    localStorage.setItem("voice_model", trimmed);
    setFallbackMessage(null);
    setSaveStatus("saved");

    const check = await testLiveVoiceModelConnection(trimmed);
    if (!check.ok) {
      setSaveStatus("error");
      if (autoFallback) {
        await tryAutoFallbackFrom(trimmed);
      }
    } else {
      setSaveStatus("saved");
    }
  };

  const handleTestModel = async () => {
    const trimmed = modelName.trim();
    setIsTesting(true);
    setTestResult(null);
    setFallbackMessage(null);

    const res = await testLiveVoiceModelConnection(trimmed);
    setIsTesting(false);

    if (res.ok) {
      setTestResult({ ok: true, text: "Connected" });
      if (trimmed === savedModel) {
        setSaveStatus("saved");
      }
    } else {
      setTestResult({ ok: false, text: res.error || "Model not working" });
      setSaveStatus("error");
      if (autoFallback) {
        await tryAutoFallbackFrom(trimmed);
      }
    }
  };

  const resetToDefault = () => {
    setModelName(DEFAULT_LIVE_MODEL);
    setSavedModel(DEFAULT_LIVE_MODEL);
    localStorage.setItem("voice_model", DEFAULT_LIVE_MODEL);
    setSaveStatus("saved");
    setFallbackMessage(null);
    setTestResult(null);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setModelName(text.trim());
        setSaveStatus(null);
        setTestResult(null);
      }
    } catch (e) {}
  };

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
          Live Voice Model
        </h2>
      </header>

      {/* Scrollable Page Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-32 space-y-5 no-scrollbar">
        {/* 1. CURRENTLY ACTIVE Card */}
        <div className="bg-[#0F172A]/90 border border-purple-500/30 rounded-2xl p-4 shadow-lg shadow-purple-950/30">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)] shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
              CURRENTLY ACTIVE
            </span>
          </div>
          <p className="font-mono text-xs sm:text-sm font-semibold text-purple-100 break-all">
            {savedModel}
          </p>
        </div>

        {/* 2. Model Input Field */}
        <div className="space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-widest text-purple-300/80 pl-1">
            Model Name
          </label>
          <input
            type="text"
            value={modelName}
            onChange={(e) => {
              setModelName(e.target.value);
              setSaveStatus(null);
            }}
            className="w-full bg-[#0F172A] border border-purple-500/30 focus:border-purple-400 rounded-2xl px-4 py-3.5 font-mono text-xs sm:text-sm text-white placeholder:text-slate-500 outline-none transition-colors shadow-inner"
            placeholder="Enter Gemini live model name..."
          />
        </div>

        {/* 3. Auto Fallback Toggle */}
        <div className="bg-[#0F172A]/80 border border-purple-500/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-white">
                Auto fallback
              </p>
              <p className="text-[11px] text-slate-400">
                Try the next model automatically if connection fails
              </p>
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
          {fallbackMessage && (
            <div className="pt-1">
              <span className="inline-block px-3 py-1 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-200 font-mono text-[11px] font-bold">
                {fallbackMessage}
              </span>
            </div>
          )}
        </div>

        {/* 4. Tappable Model Suggestion Cards */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-black text-purple-300/80 uppercase tracking-widest pl-1">
            Suggestions
          </p>
          <div className="space-y-2.5">
            {LIVE_MODEL_CARDS.map((card) => {
              const isSelected = modelName.trim() === card.model;
              return (
                <button
                  key={card.model}
                  type="button"
                  onClick={() => {
                    setModelName(card.model);
                    setSaveStatus(null);
                    setTestResult(null);
                  }}
                  className={
                    "w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.99] " +
                    (isSelected
                      ? "bg-purple-600/15 border-purple-500 shadow-lg shadow-purple-950/50"
                      : "bg-[#0F172A]/70 border-white/10 hover:border-purple-500/40")
                  }
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-bold text-white break-all leading-snug">
                      {card.model}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={
                          "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border " +
                          card.badgeClass
                        }
                      >
                        {card.badge}
                      </span>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-white shrink-0">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{card.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 5. Uniform Width & Evenly Spaced Action Buttons */}
        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={handlePaste}
            className="w-full py-3.5 bg-purple-700/80 hover:bg-purple-600 border border-purple-400/30 rounded-2xl font-black text-xs uppercase tracking-wider text-white active:scale-[0.99] transition-all shadow-md"
          >
            PASTE
          </button>

          <button
            type="button"
            onClick={saveModel}
            className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 border border-purple-400/40 rounded-2xl font-black text-xs uppercase tracking-wider text-white active:scale-[0.99] transition-all shadow-lg shadow-purple-950/50"
          >
            SAVE MODEL
          </button>

          {/* Status Tag right after SAVE MODEL */}
          {saveStatus && (
            <div className="flex items-center justify-center">
              {saveStatus === "saved" ? (
                <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                  Saved
                </span>
              ) : (
                <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 border border-rose-500/40 text-rose-300">
                  Model not working
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleTestModel}
            disabled={isTesting}
            className="w-full py-3.5 bg-indigo-600/90 hover:bg-indigo-500 disabled:opacity-60 border border-indigo-400/30 rounded-2xl font-black text-xs uppercase tracking-wider text-white active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                TESTING...
              </>
            ) : (
              "TEST MODEL"
            )}
          </button>

          {/* Test Connection Result */}
          {testResult && (
            <div
              className={
                "w-full px-4 py-2.5 rounded-2xl border text-xs font-bold text-center break-words " +
                (testResult.ok
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-rose-500/15 border-rose-500/40 text-rose-300")
              }
            >
              {testResult.text}
            </div>
          )}

          <button
            type="button"
            onClick={resetToDefault}
            className="w-full py-3.5 bg-[#0F172A] hover:bg-white/10 border border-purple-500/25 rounded-2xl font-black text-xs uppercase tracking-wider text-slate-200 active:scale-[0.99] transition-all"
          >
            RESET TO DEFAULT
          </button>

          <a
            href="https://ai.google.dev/gemini-api/docs/models"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 bg-[#0F172A]/80 hover:bg-purple-950/40 border border-purple-500/30 rounded-2xl font-black text-xs uppercase tracking-wider text-purple-300 flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
          >
            <span>GET MODEL NAMES</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </motion.div>
  );
};

