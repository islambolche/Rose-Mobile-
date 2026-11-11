import React, { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Facebook, Instagram, Youtube, Mail, Check, Loader2, ExternalLink, Cpu, PenTool, Zap, ChevronRight, RotateCw, MessageSquare } from "lucide-react";
import { getGeminiKey } from "../lib/geminiKey";
import { DEVELOPER_INFO } from "../lib/creator-profile";
import {
  getChatModelOverride,
  setChatModelOverride,
  getCurrentlyActiveChatModel,
  getDynamicGroqChatModels,
  getDynamicGeminiChatModels,
  getDynamicGeminiLiveModels,
  getSelectedChatEngine,
  getEffectiveChatEngineKey
} from "../lib/chatEngines";

const WhatsAppBarIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-white">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.67 1.437 5.662 1.437h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
  </svg>
);

const TikTokBarIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-white">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

export const Developer = ({
  setCurrentView,
  backView = "home",
}: {
  setCurrentView: (v: any) => void;
  setToast: (t: string | any | null) => void;
  backView?: string;
}) => {
  const developerBars = [
    {
      id: "whatsapp",
      name: "WhatsApp",
      subtitle: DEVELOPER_INFO.whatsapp,
      link: DEVELOPER_INFO.whatsappLink,
      icon: <WhatsAppBarIcon />,
    },
    {
      id: "gmail",
      name: "Gmail",
      subtitle: DEVELOPER_INFO.gmail,
      link: DEVELOPER_INFO.gmailLink,
      icon: <Mail className="w-6 h-6 text-white" />,
    },
    {
      id: "facebook",
      name: "Facebook",
      subtitle: "Open",
      link: DEVELOPER_INFO.facebook,
      icon: <Facebook className="w-6 h-6 text-white" />,
    },
    {
      id: "instagram",
      name: "Instagram",
      subtitle: "Open",
      link: DEVELOPER_INFO.instagram,
      icon: <Instagram className="w-6 h-6 text-white" />,
    },
    {
      id: "youtube",
      name: "YouTube",
      subtitle: "Open",
      link: DEVELOPER_INFO.youtube,
      icon: <Youtube className="w-6 h-6 text-white" />,
    },
    {
      id: "tiktok",
      name: "TikTok",
      subtitle: "Open",
      link: DEVELOPER_INFO.tiktok,
      icon: <TikTokBarIcon />,
    },
  ];

  return (
    <motion.div
      key="developer"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      className="fixed inset-0 z-[90] h-full bg-[#020617] flex flex-col overflow-hidden"
    >
      <header className="px-6 py-4 flex items-center gap-4 shrink-0 border-b border-white/5">
        <button
          onClick={() => setCurrentView(backView)}
          className="p-2.5 bg-white/5 rounded-full active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">
          DEVELOPER
        </h2>
      </header>

      <div className="flex-1 overflow-y-auto pb-[calc(80px+env(safe-area-inset-bottom,0px)+80px)] no-scrollbar bg-[#020617]">
        {/* Edge-to-Edge Developer Image blended into page background */}
        <div className="relative w-full bg-[#020617] overflow-hidden">
          <img
            src="/developer.jpg"
            alt="MD YOUSUF KHAN"
            className="w-full h-auto object-contain block"
          />
          {/* Left & Right 10% Side Fade Overlay into page background (#020617) */}
          <div
            className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#020617_0%,rgba(2,6,23,0.55)_4%,transparent_10%,transparent_90%,rgba(2,6,23,0.55)_96%,#020617_100%)]"
          />
          {/* Smooth Multi-stop Bottom 50% Fade Overlay into page background (#020617) */}
          <div
            className="absolute inset-x-0 top-0 -bottom-[2px] pointer-events-none bg-[linear-gradient(to_bottom,transparent_0%,transparent_50%,rgba(2,6,23,0.35)_68%,rgba(2,6,23,0.75)_85%,#020617_98%,#020617_100%)]"
          />
        </div>

        {/* Centered Name & Role below collar/tie over blended dark area */}
        <div className="relative z-10 -mt-[15px] mb-[20px] px-4 flex flex-col items-center text-center">
          <h1 className="text-[32px] font-extrabold tracking-[1px] text-white leading-tight [text-shadow:0_2px_18px_rgba(168,85,247,0.55)]">
            {DEVELOPER_INFO.name}
          </h1>
          <p className="text-[16px] text-slate-400 font-medium mt-1">
            {DEVELOPER_INFO.role}
          </p>
        </div>

        {/* Vertical Settings-style Contact & Social Bars */}
        <div className="px-4 space-y-4">
          {developerBars.map((item) => {
            const hasLink = Boolean(item.link && item.link.trim());
            const isMailto = hasLink && item.link.startsWith("mailto:");
            return (
              <a
                key={item.id}
                href={hasLink ? item.link : undefined}
                target={hasLink && !isMailto ? "_blank" : undefined}
                rel={hasLink && !isMailto ? "noopener noreferrer" : undefined}
                onClick={(e) => {
                  if (!hasLink) {
                    e.preventDefault();
                  }
                }}
                className="w-full p-5 bg-[#0F172A]/80 rounded-[2.5rem] border border-purple-500/30 shadow-2xl flex items-center justify-between active:scale-[0.98] transition-all text-left"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-purple-600 border border-purple-400/30 flex items-center justify-center text-white shrink-0 shadow-lg shadow-purple-900/40">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-base text-white leading-tight">
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5 truncate">
                      {item.subtitle}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
              </a>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

const DEFAULT_LIVE_MODEL = "gemini-1.5-flash";

const LIVE_MODEL_CARDS = [
  {
    model: "gemini-2.0-flash-exp",
    badge: "NEW & FAST",
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    description: "Next-gen experimental flash model",
  },
  {
    model: "gemini-1.5-flash",
    badge: "STABLE",
    badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    description: "Reliable production model",
  },
  {
    model: "gemini-1.5-flash-8b",
    badge: "LITE",
    badgeClass: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    description: "Lightweight and cost-effective",
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

  let apiKey = (getGeminiKey() || "").replace(/[\r\n\t\s"']+/g, "").trim();

  if (!apiKey) {
    return { ok: false, error: "Add your Gemini key in Settings > Connections." };
  }

  return new Promise((resolve) => {
    let settled = false;
    const rawModel = trimmed.replace(/^models\//, "").trim();
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
    const wsUrl = `${protocol}//${host}/api/live?model=${encodeURIComponent(rawModel)}&apiKey=${encodeURIComponent(apiKey)}`;

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
        ws?.send(
          JSON.stringify({
            setup: {
              model: `models/${rawModel}`,
              generationConfig: {
                responseModalities: ["AUDIO"],
              },
            },
          })
        );
      };
      ws.onmessage = async (event) => {
        try {
          const text = typeof event.data === "string" ? event.data : await (event.data as Blob).text();
          const msg = JSON.parse(text);
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

  const [chatOverrideInput, setChatOverrideInput] = useState<string>(() => getChatModelOverride());
  const [currentActiveChatModel, setCurrentActiveChatModel] = useState<string>(() => getCurrentlyActiveChatModel());
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [showModelsList, setShowModelsList] = useState<boolean>(false);

  const [isDetectingLive, setIsDetectingLive] = useState<boolean>(false);
  const [availableLiveModels, setAvailableLiveModels] = useState<string[]>([]);

  const handleAutoDetectChatModel = async () => {
    setIsDetecting(true);
    setAvailableModels([]);
    try {
      const engine = getSelectedChatEngine();
      const apiKey = getEffectiveChatEngineKey(engine);
      let detected = "";
      let foundModels: string[] = [];
      
      if (engine === "groq") {
        const res = await getDynamicGroqChatModels(apiKey, true);
        foundModels = res.models || [];
        if (foundModels.length > 0) {
          detected = foundModels[0];
          setAvailableModels(foundModels);
        } else if (res.errorReason) {
          notifyToast(`Groq মডেল শনাক্ত ব্যর্থ: ${res.errorReason}`);
        }
      } else if (engine === "gemini") {
        const res = await getDynamicGeminiChatModels(apiKey, true);
        foundModels = res.models || [];
        if (foundModels.length > 0) {
          detected = foundModels[0];
          setAvailableModels(foundModels);
        } else if (res.errorReason) {
          notifyToast(`Gemini মডেল শনাক্ত ব্যর্থ: ${res.errorReason}`);
        }
      } else {
        detected = getCurrentlyActiveChatModel(engine);
      }

      if (detected) {
        setChatOverrideInput(detected);
        setChatModelOverride(detected);
        setCurrentActiveChatModel(detected);
        notifyToast(`তাজা মডেল সনাক্ত হয়েছে: ${detected} (${foundModels.length}টি পাওয়া গেছে)`);
      } else {
        const fallback = getCurrentlyActiveChatModel(engine);
        setCurrentActiveChatModel(fallback);
        notifyToast(`বর্তমান সক্রিয় মডেল: ${fallback}`);
      }
    } catch (err: any) {
      notifyToast("মডেল শনাক্তকরণে সমস্যা হয়েছে");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleAutoDetectLiveModel = async () => {
    setIsDetectingLive(true);
    try {
      const apiKey = (getGeminiKey() || "").replace(/[\r\n\t\s"']+/g, "").trim();
      if (!apiKey) {
        notifyToast("আগে Gemini Key দিন");
        return;
      }
      const res = await getDynamicGeminiLiveModels(apiKey, true);
      if (res.models && res.models.length > 0) {
        setAvailableLiveModels(res.models);
        selectAndSaveModel(res.models[0]);
        notifyToast(`তাজা Live মডেল পাওয়া গেছে: ${res.models[0]}`);
      } else {
        notifyToast(res.error || "কোনো Live মডেল পাওয়া যায়নি");
      }
    } catch (e) {
      notifyToast("মডেল শনাক্তকরণে সমস্যা হয়েছে");
    } finally {
      setIsDetectingLive(false);
    }
  };

  const handleShowAvailableModels = async () => {
    if (showModelsList) {
      setShowModelsList(false);
      return;
    }
    
    if (availableModels.length === 0) {
      setIsDetecting(true);
      try {
        const engine = getSelectedChatEngine();
        const apiKey = getEffectiveChatEngineKey(engine);
        let foundModels: string[] = [];
        if (engine === "groq") {
          const res = await getDynamicGroqChatModels(apiKey, false);
          foundModels = res.models || [];
        } else if (engine === "gemini") {
          const res = await getDynamicGeminiChatModels(apiKey, false);
          foundModels = res.models || [];
        }
        setAvailableModels(foundModels);
        if (foundModels.length === 0) {
          notifyToast("কোনো মডেল পাওয়া যায়নি। Key পরীক্ষা করুন।");
          return;
        }
      } catch (e) {
        notifyToast("মডেল তালিকা আনতে সমস্যা হয়েছে");
        return;
      } finally {
        setIsDetecting(false);
      }
    }
    setShowModelsList(true);
  };

  const handleSaveChatOverride = () => {
    const trimmed = chatOverrideInput.trim();
    setChatModelOverride(trimmed);
    const active = getCurrentlyActiveChatModel();
    setCurrentActiveChatModel(active);
    if (trimmed) {
      notifyToast(`চ্যাট মডেল ওভাররাইড সেভ হয়েছে: ${trimmed}`);
    } else {
      notifyToast("চ্যাট মডেল অটো বাছাইয়ে ফিরিয়ে আনা হয়েছে");
    }
    setShowModelsList(false);
  };

  const handleClearChatOverride = () => {
    setChatOverrideInput("");
    setChatModelOverride("");
    const active = getCurrentlyActiveChatModel();
    setCurrentActiveChatModel(active);
    notifyToast("ওভাররাইড মোছা হয়েছে (এখন অটো বাছাই চলবে)");
    setShowModelsList(false);
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
        <button
          onClick={handleAutoDetectLiveModel}
          disabled={isDetectingLive}
          className="ml-auto p-2 bg-purple-600/20 border border-purple-500/30 rounded-xl text-purple-200 active:scale-95 transition-all disabled:opacity-50"
          title="Auto detect live models"
        >
          <RotateCw className={`w-5 h-5 ${isDetectingLive ? "animate-spin" : ""}`} />
        </button>
      </header>

      {availableLiveModels.length > 0 && (
        <div className="px-5 pt-3 pb-1">
          <div className="flex flex-wrap gap-2">
            {availableLiveModels.map((m) => (
              <button
                key={m}
                onClick={() => selectAndSaveModel(m)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                  savedModel === m
                    ? "bg-purple-600 border-purple-400 text-white shadow-lg"
                    : "bg-purple-600/10 border-purple-500/20 text-purple-300"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

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

        {/* Chat Model Override Section */}
        <div className="w-full p-4 rounded-2xl bg-[#0F172A] border border-purple-500/25 space-y-3.5 mt-2 shadow-xl shadow-purple-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  CHAT MODEL OVERRIDE
                </h3>
                <p className="text-[10px] text-slate-400">
                  টেক্সট চ্যাটের মডেল (খালি থাকলে অটো বাছাই)
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatOverrideInput}
                onChange={(e) => setChatOverrideInput(e.target.value)}
                placeholder="খালি রাখলে অটো বাছাই..."
                className="flex-1 min-w-0 bg-[#020617] border border-purple-500/30 focus:border-purple-400 rounded-xl px-3.5 py-2.5 font-mono text-xs text-white placeholder:text-slate-500 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={handleAutoDetectChatModel}
                disabled={isDetecting}
                title="তাজা মডেল নাম অটো খুঁজুন"
                className="px-3 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-400/30 rounded-xl text-purple-200 text-[10px] font-bold flex items-center gap-1.5 active:scale-95 transition-all shrink-0 disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isDetecting ? "animate-spin" : ""}`} />
                <span>Auto detect</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShowAvailableModels}
                disabled={isDetecting}
                className="px-3 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-400/30 rounded-xl text-indigo-200 text-[10px] font-bold flex items-center gap-1.5 active:scale-95 transition-all shrink-0 disabled:opacity-50"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>{showModelsList ? "Hide models" : "Show models"}</span>
              </button>
              <button
                type="button"
                onClick={handleSaveChatOverride}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 border border-purple-400/40 rounded-xl font-bold text-xs uppercase tracking-wider text-white active:scale-[0.99] transition-all shadow-md shadow-purple-950/40"
              >
                SAVE
              </button>
              {chatOverrideInput && (
                <button
                  type="button"
                  onClick={handleClearChatOverride}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-300 active:scale-[0.99] transition-all"
                >
                  CLEAR
                </button>
              )}
            </div>

            {showModelsList && availableModels.length > 0 && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="bg-[#020617] border border-purple-500/20 rounded-xl overflow-hidden"
              >
                <div className="max-h-40 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
                  {availableModels.map((m) => (
                    <button
                      key={m}
                      onClick={() => setChatOverrideInput(m)}
                      className={`w-full text-left px-3 py-2 rounded-lg font-mono text-[10px] transition-colors ${
                        chatOverrideInput === m 
                          ? "bg-purple-600/30 text-white border border-purple-500/40" 
                          : "text-slate-400 hover:bg-purple-500/10 hover:text-slate-200"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="pt-1 px-1">
              <p className="text-[11px] text-purple-300/90 leading-tight">
                বর্তমান সক্রিয় চ্যাট মডেল:{" "}
                <span className="font-mono font-bold text-white break-all">
                  {chatOverrideInput.trim() || currentActiveChatModel || "অটো বাছাই (স্বয়ংক্রিয়)"}
                </span>
                {chatOverrideInput.trim() && (
                  <span className="ml-1.5 text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-400/30">
                    ইউজার ওভাররাইড
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {localToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] bg-purple-900/90 border border-purple-400/50 text-white px-4 py-2 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md">
          {localToast}
        </div>
      )}
    </motion.div>
  );
};

