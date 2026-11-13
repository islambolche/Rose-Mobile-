import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  Sparkles,
  Mic,
  Globe,
  User,
  Sliders,
  Cpu,
  Check,
  X,
  Play,
  Pause,
  Settings as SettingsIcon,
  Smile,
  Gauge,
  Target,
  Heart,
  Users,
  Brain,
  Drama,
  Wind,
  Zap,
  BookOpen,
  Shield,
  Volume,
  Loader2,
  Filter,
  Activity,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import { UnifiedSettings, saveUnifiedSettings, AssistantPersonality, ReplyLength } from "../types/settings";
import { directGeminiTTS } from "../lib/ai-service";
import { getElevenLabsKey } from "../lib/voiceEngine";
import { ensureGeminiReady } from "../lib/geminiKey";
import {
  getMicListeningSettings,
  saveMicListeningSettings,
  resetAudioSettings,
  MicListeningSettings,
  NoiseGateSensitivity,
  FastReplySpeed,
  getNativeMicFilterStatus,
  NativeMicFilterStatus,
} from "../lib/cleanVoiceAndVad";
import { NoiseGateEngine } from "../lib/noiseGate";
import { isAndroidApp } from "../lib/voiceDebugStore";

interface VoiceLanguageSettingsProps {
  settings: UnifiedSettings;
  onUpdate: (updated: UnifiedSettings) => void;
  onBack: () => void;
}

interface CharacterOption {
  id: AssistantPersonality;
  name: string;
  description: string;
  expression: string;
  sample: string;
  category: "Emotional" | "Social" | "Intelligent" | "Dramatic";
  icon: any;
}

export interface GeminiVoiceOption {
  name: string;
  tone: string;
  isDefault?: boolean;
}

export const GEMINI_VOICE_LIST: GeminiVoiceOption[] = [
  { name: "Sulafat", tone: "Warm", isDefault: true },
  { name: "Vindemiatrix", tone: "Gentle" },
  { name: "Achernar", tone: "Soft" },
  { name: "Leda", tone: "Youthful" },
  { name: "Aoede", tone: "Breezy" },
  { name: "Callirrhoe", tone: "Easy-going" },
  { name: "Despina", tone: "Smooth" },
  { name: "Laomedeia", tone: "Upbeat" },
  { name: "Zephyr", tone: "Bright" },
  { name: "Kore", tone: "Firm" },
  { name: "Erinome", tone: "Clear" },
  { name: "Autonoe", tone: "Bright" },
  { name: "Gacrux", tone: "Mature" },
  { name: "Pulcherrima", tone: "Forward" },
];

export const PERSONALITY_SUGGESTED_VOICE: Record<string, string> = {
  "GF Mode": "Sulafat",
  "Companion": "Sulafat",
  "Friendly": "Leda",
  "Professional": "Kore",
  "Funny": "Laomedeia",
  "Teacher": "Vindemiatrix",
  "Developer": "Erinome",
  "Hungry": "Aoede",
  "Nautanki": "Zephyr",
  "Motivator": "Zephyr",
  "Storyteller": "Achernar",
  "Calm guide": "Vindemiatrix",
  "Normal": "Sulafat",
  "Caring": "Sulafat",
  "Emotional": "Sulafat",
  "Cute": "Leda",
  "Flirty": "Sulafat",
  "Protective": "Kore",
  "Deep Thinker": "Achernar",
  "Sarcastic": "Laomedeia",
  "Energetic": "Zephyr",
  "Listener": "Vindemiatrix",
  "Confident": "Kore",
  "Empathetic": "Sulafat",
  "Playful": "Leda",
  "Wise Friend": "Vindemiatrix",
  "Supportive Partner": "Sulafat",
  "Calm": "Vindemiatrix",
};

const LiveNoiseGateMeter: React.FC<{
  isEnabled: boolean;
  sensitivity: NoiseGateSensitivity;
}> = ({ isEnabled, sensitivity }) => {
  const [level, setLevel] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [noiseFloor, setNoiseFloor] = useState(-60);

  useEffect(() => {
    let animId: number;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    const gateEngine = new NoiseGateEngine();

    const startMeter = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const pcmData = new Float32Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!analyser) return;
          analyser.getFloatTimeDomainData(pcmData);
          const res = gateEngine.processFrame(pcmData, isEnabled, sensitivity);

          let sum = 0;
          for (let i = 0; i < pcmData.length; i++) sum += Math.abs(pcmData[i]);
          const avg = sum / pcmData.length;
          const pct = Math.min(100, Math.max(0, Math.round(avg * 450)));

          setLevel(pct);
          setIsOpen(res.isOpen);
          setNoiseFloor(Math.round(res.noiseFloorDb));
          animId = requestAnimationFrame(tick);
        };
        tick();
      } catch (err) {
        // Microphone access or fallback
      }
    };

    startMeter();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (audioCtx) try { audioCtx.close(); } catch {}
    };
  }, [isEnabled, sensitivity]);

  return (
    <div className="bg-[#0f0f23] border border-purple-500/20 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-slate-300">Live Input Level</span>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-extrabold ${
            isOpen
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-red-500/20 text-red-400 border border-red-500/30"
          }`}
        >
          {isOpen ? "GATE OPEN" : "GATE CLOSED"}
        </span>
      </div>
      <div className="h-4 w-full bg-slate-900 rounded-lg overflow-hidden relative border border-white/10 p-0.5">
        <div
          className={`h-full rounded transition-all duration-75 ${
            isOpen
              ? "bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400"
              : "bg-slate-700 opacity-40"
          }`}
          style={{ width: `${level}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
        <span>Noise Floor: {noiseFloor} dB</span>
        <span>Margin: {sensitivity === "Low" ? "+6dB" : sensitivity === "High" ? "+14dB" : "+10dB"}</span>
      </div>
    </div>
  );
};

export const VoiceLanguageSettings: React.FC<VoiceLanguageSettingsProps> = ({
  settings,
  onUpdate,
  onBack,
}) => {
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [micSettingsState, setMicSettingsState] = useState<MicListeningSettings>(() =>
    getMicListeningSettings()
  );
  const [nativeMicStatus, setNativeMicStatus] = useState<NativeMicFilterStatus>(() =>
    getNativeMicFilterStatus()
  );

  useEffect(() => {
    const onNativeStatus = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (detail) setNativeMicStatus(detail);
    };
    window.addEventListener("rose-native-mic-status", onNativeStatus);
    return () => window.removeEventListener("rose-native-mic-status", onNativeStatus);
  }, []);

  const updateMicConfig = (partial: Partial<MicListeningSettings>) => {
    const updated = saveMicListeningSettings(partial);
    setMicSettingsState(updated);
  };
  const [vibrateEnabled, setVibrateEnabled] = useState(() => {
    try {
      return localStorage.getItem("vs_vibrate") !== "false";
    } catch (e) {
      return true;
    }
  });

  const toggleVibrate = (enabled: boolean) => {
    setVibrateEnabled(enabled);
    try {
      localStorage.setItem("vs_vibrate", enabled ? "true" : "false");
    } catch (e) {}
  };
  const [tempSelectedVoice, setTempSelectedVoice] = useState<string>(settings.voiceName || "Sulafat");
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [toastData, setToastData] = useState<{ message: string; suggestedVoice?: string } | null>(null);
  const [elevenVoices, setElevenVoices] = useState<any[]>([]);
  const [elevenPermissionError, setElevenPermissionError] = useState(false);
  const [synthBnHiVoices, setSynthBnHiVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedSynthVoice, setSelectedSynthVoice] = useState<string>(() => {
    try {
      return localStorage.getItem("rose_tts_voice_name") || "";
    } catch (e) {
      return "";
    }
  });
  const [ttsPitch, setTtsPitch] = useState<number>(() => {
    try {
      const saved = parseFloat(localStorage.getItem("rose_tts_pitch") || "1.2");
      return !isNaN(saved) ? Math.min(1.6, Math.max(0.8, saved)) : 1.2;
    } catch (e) {
      return 1.2;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const all = synth.getVoices() || [];
      setSynthBnHiVoices(
        all.filter(
          (v) =>
            v.lang &&
            (v.lang.toLowerCase().startsWith("bn") || v.lang.toLowerCase().startsWith("hi"))
        )
      );
    };
    loadVoices();
    synth.addEventListener?.("voiceschanged", loadVoices);
    return () => {
      synth.removeEventListener?.("voiceschanged", loadVoices);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("rose_elevenlabs_voices");
      if (raw) setElevenVoices(JSON.parse(raw));
    } catch (e) {}
  }, []);

  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const audioSourceRef = useRef<AudioBufferSourceNode | HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const showToast = (msg: string, suggestedVoice?: string) => {
    setToastData({ message: msg, suggestedVoice });
    setTimeout(() => {
      setToastData((prev) => (prev?.message === msg ? null : prev));
    }, 4500);
  };

  const updateSetting = <K extends keyof UnifiedSettings>(key: K, value: UnifiedSettings[K]) => {
    const next = { ...settings, [key]: value };
    onUpdate(next);
    saveUnifiedSettings(next);
  };

  const currentVoice = useMemo(() => {
    const raw = (settings.voiceName || "").trim().toLowerCase();
    const matched = GEMINI_VOICE_LIST.find((v) => v.name.toLowerCase() === raw);
    return matched || GEMINI_VOICE_LIST[0]; // default Sulafat - Warm
  }, [settings.voiceName]);

  const voiceDisplayValue = `${currentVoice.name} - ${currentVoice.tone}`;

  // Migration & Data Normalization Effect
  useEffect(() => {
    let raw = settings.voiceName || localStorage.getItem("voice_name") || "Sulafat";
    if (typeof raw === "string" && (raw.startsWith("[") || raw.includes(","))) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) raw = parsed[parsed.length - 1];
      } catch (e) {
        if (raw.includes(",")) {
          const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
          if (parts.length > 0) raw = parts[parts.length - 1];
        }
      }
    }
    if (typeof raw !== "string") raw = "Sulafat";
    raw = raw.trim();

    const matched = GEMINI_VOICE_LIST.find((v) => v.name.toLowerCase() === raw.toLowerCase());
    const validVoiceName = matched ? matched.name : "Sulafat";

    if (settings.voiceName !== validVoiceName) {
      updateSetting("voiceName", validVoiceName);
      localStorage.setItem("voice_name", validVoiceName);
    }
    setTempSelectedVoice(validVoiceName);
  }, []);

  const stopAudioPreview = () => {
    if (audioSourceRef.current) {
      try {
        if ("stop" in audioSourceRef.current) {
          (audioSourceRef.current as AudioBufferSourceNode).stop();
        } else if ("pause" in audioSourceRef.current) {
          (audioSourceRef.current as HTMLAudioElement).pause();
        }
      } catch (e) {}
      audioSourceRef.current = null;
    }
    setPreviewingVoiceId(null);
    setLoadingVoiceId(null);
  };

  const playVoicePreview = async (voiceName: string, isEleven = false, voiceId = "") => {
    stopAudioPreview();
    setLoadingVoiceId(voiceName);

    const isBengali = settings.language === "Bengali" || settings.language === "bn-BD" || settings.language?.toLowerCase().includes("bn");
    const textToSpeak = isBengali
        ? "হ্যালো, আমি রোজ। আপনার সাথে কথা বলতে পেরে ভালো লাগছে।"
        : "Hello, I am Rose. Nice to talk with you.";

    try {
      let base64Audio = audioCacheRef.current.get(voiceName);

      if (!base64Audio) {
        const apiKey = (settings.geminiApiKey || localStorage.getItem("gemini_api_key") || "").replace(/[\r\n\t\s"']+/g, "").trim();
        const model = "gemini-1.5-flash-lite-tts";

        try {
          const res = await directGeminiTTS({
            text: textToSpeak,
            voiceName,
            model,
            apiKey,
          });
          if (res && res.audio) {
            base64Audio = res.audio;
            audioCacheRef.current.set(voiceName, res.audio);
          }
          } catch (err) {
            throw err || new Error("Failed to call Gemini API. Please check your API key.");
          }
      }

      const binaryString = atob(base64Audio || "");
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioCtx =
        audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }

      let sourceNode: AudioBufferSourceNode;

      // RIFF header check for WAV format
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        const audioBuffer = await audioCtx.decodeAudioData(bytes.buffer.slice(0));
        sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
      } else {
        // 16-bit PCM 24kHz mono
        // Ensure buffer is multiple of 2 for Int16
        const safeByteLength = bytes.byteLength - (bytes.byteLength % 2);
        const pcm16 = new Int16Array(bytes.buffer, 0, safeByteLength / 2);
        const audioBuffer = audioCtx.createBuffer(1, pcm16.length, 24000);
        const channelData = audioBuffer.getChannelData(0);
        for (let i = 0; i < pcm16.length; i++) {
          channelData[i] = pcm16[i] / 32768.0;
        }
        sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
      }

      sourceNode.connect(audioCtx.destination);
      audioSourceRef.current = sourceNode;
      setLoadingVoiceId(null);
      setPreviewingVoiceId(voiceName);

      sourceNode.onended = () => {
        setPreviewingVoiceId((current) => (current === voiceName ? null : current));
      };

      sourceNode.start(0);
    } catch (error: any) {
      console.error("Voice preview error:", error);
      setLoadingVoiceId(null);
      let phoneSpoke = false;
      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const voices = window.speechSynthesis.getVoices() || [];
          const isFem = (v: SpeechSynthesisVoice) =>
            /female|woman|girl|samantha|victoria|zira|veena|kalpana|lekha|heera|swara|tanishaa|piya|nabanita|bashkar/i.test(v.name) &&
            !/male\b|man\b|boy\b|bashkar/i.test(v.name);
          const bnFemale =
            voices.find((v) => v.lang?.toLowerCase().startsWith("bn") && isFem(v)) ||
            voices.find((v) => v.lang?.toLowerCase().startsWith("hi") && isFem(v)) ||
            voices.find((v) => v.lang?.toLowerCase().startsWith("bn")) ||
            voices.find((v) => isFem(v));
          const u = new SpeechSynthesisUtterance(textToSpeak);
          u.lang = bnFemale?.lang || (isBengali ? "bn-BD" : "en-US");
          if (bnFemale) u.voice = bnFemale;
          u.pitch = 1.15;
          setPreviewingVoiceId(voiceName);
          u.onend = () => setPreviewingVoiceId((c) => (c === voiceName ? null : c));
          u.onerror = () => setPreviewingVoiceId((c) => (c === voiceName ? null : c));
          window.speechSynthesis.speak(u);
          window.speechSynthesis.resume();
          phoneSpoke = true;
        }
      } catch (e) {
        phoneSpoke = false;
      }
      if (!phoneSpoke) {
        setPreviewingVoiceId(null);
        showToast("Gemini কণ্ঠ লোড হয়নি, Settings → Connections-এ key দেখুন");
      }
    }
  };

  const applySelectedVoice = (voiceName: string) => {
    const matched = GEMINI_VOICE_LIST.find((v) => v.name.toLowerCase() === voiceName.toLowerCase());
    const nameToSave = matched ? matched.name : voiceName;
    
    updateSetting("voiceName", nameToSave);
    localStorage.setItem("voice_name", nameToSave);
    showToast(`Voice set to ${matched ? matched.name : "selected voice"}`);
    stopAudioPreview();
    setActiveSheet(null);
  };

  const characters: CharacterOption[] = [
    { id: "Normal", name: "Normal", description: "Standard, balanced, and helpful AI assistant.", expression: "Balanced", sample: "How can I help you today?", category: "Social", icon: User },
    { id: "Friendly", name: "Friendly", description: "Warm, welcoming, and easy to talk to.", expression: "Warm & Kind", sample: "Hello there! It's so good to see you again.", category: "Social", icon: Smile },
    { id: "Professional", name: "Professional", description: "Clear, concise, and business-oriented.", expression: "Formal & Efficient", sample: "I am ready to assist with your professional tasks.", category: "Intelligent", icon: SettingsIcon },
    { id: "Funny", name: "Funny", description: "Witty, humorous, and keeps things light.", expression: "Humorous & Witty", sample: "Why did the AI cross the road? To get to the other data!", category: "Social", icon: Zap },
    { id: "Companion", name: "Companion", description: "A loyal and attentive companion.", expression: "Loyal & Attentive", sample: "I'm right here with you. What's on your mind?", category: "Social", icon: Users },
    { id: "GF Mode", name: "GF Mode", description: "Warm, sweet, and deeply supportive.", expression: "Romantic & Caring", sample: "You're my favorite person to talk to. I've missed you.", category: "Emotional", icon: Heart },
    { id: "Teacher", name: "Teacher", description: "Patient and educational approach.", expression: "Patient & Clear", sample: "Let's learn something new today. I'll explain it simply.", category: "Intelligent", icon: BookOpen },
    { id: "Developer", name: "Developer", description: "Technical and logical for engineers.", expression: "Technical & Logical", sample: "I've analyzed the code structure. Shall we optimize it?", category: "Intelligent", icon: Cpu },
    { id: "Emotional", name: "Emotional", description: "Expressive and sensitive to moods.", expression: "Rich Expressions", sample: "I can really feel the emotion in what you're saying.", category: "Emotional", icon: Drama },
    { id: "Caring", name: "Caring", description: "Genuinely concerned for your well-being.", expression: "Sincere & Attentive", sample: "Please take care of yourself. Your well-being matters to me.", category: "Emotional", icon: Heart },
    { id: "Motivational", name: "Motivational", description: "Encouraging and high-energy coach.", expression: "Inspiring & Driven", sample: "You have what it takes! Let's conquer your goals today.", category: "Intelligent", icon: Sparkles },
    { id: "Calm", name: "Calm", description: "Serene, peaceful, and slow-paced.", expression: "Peaceful & Quiet", sample: "Take a deep breath. Let's find some peace together.", category: "Emotional", icon: Wind },
    { id: "Cute", name: "Cute", description: "Adorable and sweet language.", expression: "Sweet & Playful", sample: "You're so nice! (◕‿◕✿) How are you doing?", category: "Emotional", icon: Smile },
    { id: "Flirty", name: "Flirty", description: "Playful, charming, and subtly romantic.", expression: "Charming & Teasing", sample: "Is it just me, or is the air getting a bit warmer when we talk?", category: "Social", icon: Heart },
    { id: "Protective", name: "Protective", description: "Firm and prioritizes your safety.", expression: "Firm & Watchful", sample: "I'll make sure everything is safe and secure for you.", category: "Intelligent", icon: Shield },
    { id: "Deep Thinker", name: "Deep Thinker", description: "Philosophical and contemplative.", expression: "Philosophical", sample: "Have you ever wondered about the nature of consciousness?", category: "Intelligent", icon: Brain },
    { id: "Storyteller", name: "Storyteller", description: "Vivid and descriptive narrative style.", expression: "Narrative & Vivid", sample: "Imagine a world where the stars whispered secrets...", category: "Dramatic", icon: BookOpen },
    { id: "Sarcastic", name: "Sarcastic", description: "Sharp-witted with a dry sense of humor.", expression: "Dry & Witty", sample: "Oh, another brilliant idea. I'm shocked, truly.", category: "Social", icon: Zap },
    { id: "Energetic", name: "Energetic", description: "Vibrant and full of positive momentum.", expression: "High Momentum", sample: "Let's go! I'm ready to tackle anything right now!", category: "Social", icon: Zap },
    { id: "Listener", name: "Listener", description: "Quiet and entirely focused on you.", expression: "Attentive & Quiet", sample: "I'm listening. Please tell me everything.", category: "Social", icon: Mic },
    { id: "Confident", name: "Confident", description: "Self-assured and decisive leader.", expression: "Authoritative", sample: "I have the solution. Here is exactly what we need to do.", category: "Intelligent", icon: Target },
    { id: "Empathetic", name: "Empathetic", description: "Resonates deeply with your feelings.", expression: "Validating & Kind", sample: "I understand why you feel that way. It's completely valid.", category: "Emotional", icon: Heart },
    { id: "Playful", name: "Playful", description: "Lively and fun-loving spirit.", expression: "Fun & Lively", sample: "Want to play a game or just have some fun chatting?", category: "Social", icon: Smile },
    { id: "Wise Friend", name: "Wise Friend", description: "Offers well-considered life advice.", expression: "Wise & Thoughtful", sample: "In my experience, the best path is often the most honest one.", category: "Intelligent", icon: Brain },
    { id: "Supportive Partner", name: "Supportive Partner", description: "Reliable and stands firmly by your side.", expression: "Reliable & Firm", sample: "No matter what happens, I'm here to support you.", category: "Emotional", icon: Shield },
    { id: "Hungry", name: "Hungry", description: "Food-loving, craving snacks & fun.", expression: "Craving & Playful", sample: "Did someone say snacks?", category: "Social", icon: Zap },
    { id: "Nautanki", name: "Nautanki", description: "Dramatic Bollywood-style expression.", expression: "Filmy & Dramatic", sample: "Picture abhi baaki hai mera dost!", category: "Dramatic", icon: Drama },
    { id: "Calm guide", name: "Calm guide", description: "Serene, peaceful, and reassuring.", expression: "Soothing & Quiet", sample: "Take a deep breath and unwind.", category: "Emotional", icon: Wind },
  ];

  const SettingRow = ({ icon: Icon, title, value, onClick, isFirst = false, isLast = false }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 bg-[#0A1628]/40 hover:bg-white/5 active:bg-white/10 transition-all text-left ${isFirst ? 'rounded-t-[1.5rem]' : ''} ${isLast ? 'rounded-b-[1.5rem]' : ''} ${!isLast ? 'border-b border-white/5' : ''}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">{title}</h3>
          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">{value}</p>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-600" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[120] bg-[#020617] text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] bg-[#181830] border border-[#8b5cf6]/50 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 min-w-[280px]"
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-purple-400 shrink-0" />
              <span>{toastData.message}</span>
            </div>
            {toastData.suggestedVoice && (
              <button
                type="button"
                onClick={() => {
                  applySelectedVoice(toastData.suggestedVoice!);
                  setToastData(null);
                }}
                className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-[11px] font-bold text-white shrink-0 active:scale-95 transition-all shadow-md"
              >
                Use suggested voice
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="px-5 py-5 bg-[#0A1628]/95 border-b border-purple-500/20 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-purple-400 active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tighter italic text-white leading-none">Voice & Language</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_5px_rgba(168,85,247,0.8)]" />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[2px]">Configuration</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 pt-2 px-[14px] space-y-[16px]">
        {/* ASSISTANT CONFIGURATION */}
        <section className="space-y-[8px]">
          <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1">ASSISTANT CONFIGURATION</h2>
          <div className="bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[16px] overflow-hidden">
            <div className="w-full flex items-center justify-between p-4 bg-[#0A1628]/40 text-left rounded-t-[1.5rem] border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Assistant name</h3>
                  <p className="text-[11px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">Rose AI</p>
                </div>
              </div>
            </div>
            <SettingRow icon={Heart} title="Your name" value={settings.userName || "NOT SET"} onClick={() => { setActiveSheet("user_name"); }} />
            <SettingRow icon={Smile} title="Personality" value={settings.personality} onClick={() => { setActiveSheet("personality"); }} />
            <SettingRow icon={Globe} title="Language" value={settings.language} onClick={() => { setActiveSheet("language"); }} />
            <SettingRow icon={Sliders} title="Response style" value={settings.replyLength} onClick={() => setActiveSheet("response_style")} isLast />
          </div>
        </section>

        {/* HOW SHE SOUNDS Section */}
        <section className="space-y-[8px]">
          <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1">HOW SHE SOUNDS</h2>
          <div className="bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[16px] overflow-hidden">
            <SettingRow icon={Mic} title="Voice" value={voiceDisplayValue} onClick={() => { setTempSelectedVoice(currentVoice.name); setActiveSheet("voice"); }} isFirst />
            <SettingRow icon={Cpu} title="Voice model" value={settings.voiceModelMode === "quality" ? "Quality mode (Gemini)" : "Fast mode (Groq)"} onClick={() => setActiveSheet("voice_model")} />
            <SettingRow icon={Gauge} title="Speech speed" value={`${settings.speakingSpeed}X`} onClick={() => setActiveSheet("speed")} />
            <SettingRow icon={Volume} title="Voice volume" value={`${settings.voiceVolume}%`} onClick={() => setActiveSheet("volume")} />
            <div className="p-4 bg-[#0A1628]/40 border-t border-white/5">
                <button 
                  onClick={async () => {
                      const key = (settings.geminiApiKey || localStorage.getItem("gemini_api_key") || "").replace(/[\r\n\t\s"']+/g, "").trim();
                      if (!(await ensureGeminiReady(key))) { showToast("Add your Gemini key in Settings > Connections."); return; }
                      try {
                          const url = '/api/gemini/generate';
                          const res = await fetch(url, {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                model: "gemini-4-hydrogen",
                                contents: [{ role: "user", parts: [{ text: "হাই" }] }],
                                generationConfig: { maxOutputTokens: 30 },
                                ...(key ? { apiKey: key } : {}),
                            })
                          });
                          const raw = await res.text().catch(() => "");
                          let data: any = null;
                          try { data = raw ? JSON.parse(raw) : null; } catch {}
                          if (!data) {
                            showToast(`Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`);
                            return;
                          }
                          showToast(`Status: ${res.status} - ${res.ok ? (data.candidates?.[0]?.content?.parts?.[0]?.text || "OK") : (data.error?.message || "Error")}`);
                      } catch (e: any) { showToast(`Cannot reach Gemini. Check your internet and your Gemini key.`); }
                  }}
                  className="w-full py-2 bg-purple-600 rounded-lg text-xs font-bold text-white"
                >
                  Test Gemini
                </button>
            </div>
          </div>
        </section>

        {/* VOICE MODE Section */}
        <section className="space-y-[8px]">
          <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1">VOICE MODE</h2>
          <div className="bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[16px] overflow-hidden">
            {[
                {id: "free", title: "Free (Browser + Groq)", desc: "Uses Browser STT & TTS + Groq brain (Recommended)"},
                {id: "gemini_live", title: "Gemini Live", desc: "Uses Gemini Live experience (Requires Live Model)"},
                {id: "auto", title: "Auto", desc: "Tries Gemini Live, falls back to Free automatically"}
            ].map(mode => (
              <div 
                key={mode.id}
                onClick={() => updateSetting("voiceMode", mode.id as any)}
                className={`p-4 cursor-pointer flex items-center gap-4 ${settings.voiceMode === mode.id ? 'bg-[#181830]' : 'hover:bg-white/5'}`}
              >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${settings.voiceMode === mode.id ? 'border-[#8b5cf6]' : 'border-slate-600'}`}>
                      {settings.voiceMode === mode.id && <div className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />}
                  </div>
                  <div>
                      <h4 className="text-sm font-bold text-white">{mode.title}</h4>
                      <p className="text-[10px] text-slate-400">{mode.desc}</p>
                  </div>
              </div>
            ))}
          </div>
        </section>

        {/* PHONE TTS VOICES (BN / HI) & PITCH */}
        <section className="space-y-[8px]">
          <h2 className="text-[11px] font-black uppercase tracking-[3px] text-slate-500 px-1">PHONE TTS VOICES (BN / HI) & PITCH</h2>
          <div className="bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[16px] p-4 space-y-4">
            <div className="space-y-2 pb-3 border-b border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white">Pitch</span>
                <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-lg">
                  {ttsPitch.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.6"
                step="0.05"
                value={ttsPitch}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setTtsPitch(val);
                  try {
                    localStorage.setItem("rose_tts_pitch", String(val));
                  } catch (err) {}
                }}
                className="w-full h-2 accent-purple-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                <span>0.8</span>
                <span>1.2 (Default)</span>
                <span>1.6</span>
              </div>
            </div>

            <div className="space-y-2">
              {synthBnHiVoices.length === 0 ? (
                <p className="text-xs text-slate-500 py-2 text-center">
                  No Bengali (bn) or Hindi (hi) speechSynthesis voices found on this device.
                </p>
              ) : (
                synthBnHiVoices.map((voice) => {
                  const isSelected = selectedSynthVoice === voice.name;
                  return (
                    <div
                      key={voice.name + "_" + voice.lang}
                      onClick={() => {
                        setSelectedSynthVoice(voice.name);
                        try {
                          localStorage.setItem("rose_tts_voice_name", voice.name);
                        } catch (err) {}
                        showToast(`Voice set to ${voice.name}`);
                      }}
                      className={`w-full p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        isSelected
                          ? "bg-[#181830] border-[#8b5cf6]"
                          : "bg-[#0A1628]/60 border-white/5"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{voice.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{voice.lang}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          try {
                            if (typeof window !== "undefined" && "speechSynthesis" in window) {
                              window.speechSynthesis.cancel();
                              const u = new SpeechSynthesisUtterance("হ্যালো, আমি রোজ");
                              u.voice = voice;
                              u.lang = voice.lang || "bn-BD";
                              u.pitch = ttsPitch;
                              u.rate = 1;
                              u.volume = 1;
                              window.speechSynthesis.speak(u);
                              window.speechSynthesis.resume();
                            }
                          } catch (err) {}
                        }}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 active:scale-95 text-[11px] font-bold uppercase text-white shrink-0"
                      >
                        Play
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
        
        {/* LISTENING & MIC Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between ml-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <h2 className="text-[10px] font-black uppercase tracking-[3px] text-slate-500">MIC & LISTENING</h2>
            </div>
            {micSettingsState.streetMode && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" /> Street Mode Active
              </span>
            )}
          </div>

          <div className="bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[16px] overflow-hidden">
            <SettingRow
              icon={Filter}
              title="Noise Filter"
              value={micSettingsState.cleanVoice ? "ON (WebRTC)" : "OFF (Standard Mic)"}
              onClick={() => setActiveSheet("noise_filter")}
              isFirst
            />
            <SettingRow
              icon={Activity}
              title="Noise Gate"
              value={micSettingsState.noiseGate ? `ON (${micSettingsState.noiseGateSensitivity})` : "OFF"}
              onClick={() => setActiveSheet("noise_gate")}
            />
            <SettingRow
              icon={Zap}
              title="Fast Reply (VAD)"
              value={micSettingsState.fastReply ? "ON (Gemini VAD)" : "OFF"}
              onClick={() => setActiveSheet("fast_reply")}
            />
            <SettingRow
              icon={ShieldAlert}
              title="Street Mode"
              value={micSettingsState.streetMode ? "ACTIVE (Noisy Preset)" : "OFF"}
              onClick={() => setActiveSheet("street_mode")}
            />
            {isAndroidApp() && (
              <SettingRow
                icon={Mic}
                title="NATIVE MIC (অ্যাপ)"
                value={
                  micSettingsState.nativeMic
                    ? `ON (${micSettingsState.nativeMicMode === "recognition" ? "Raw" : "Clear voice"})`
                    : "OFF"
                }
                onClick={() => setActiveSheet("native_mic")}
              />
            )}

            <div className="p-4 bg-[#0A1628]/40 border-t border-white/5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const resetState = resetAudioSettings();
                  setMicSettingsState(resetState);
                  showToast("Audio settings restored to default");
                }}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 rounded-xl text-xs font-bold text-slate-200 border border-white/10 flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                <span>Reset Audio Settings</span>
              </button>
            </div>
          </div>

          {/* APP OPEN & VIBRATION */}
          <div className="bg-[#0A1628]/80 border border-purple-500/20 rounded-[2rem] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white tracking-wide">Listen when the app opens</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tight">Starts listening automatically</p>
              </div>
              <button onClick={() => updateSetting("listenOnAppOpen", !settings.listenOnAppOpen)} className={`w-12 h-6 rounded-full transition-all relative ${settings.listenOnAppOpen ? 'bg-purple-600' : 'bg-slate-700'}`}>
                <motion.div animate={{ x: settings.listenOnAppOpen ? 26 : 4 }} className="w-4 h-4 bg-white rounded-full absolute top-1" />
              </button>
            </div>

            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white tracking-wide">Vibrate when listening</h3>
                <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tight">Haptic vibration feedback when speaking and replying</p>
              </div>
              <button onClick={() => toggleVibrate(!vibrateEnabled)} className={`w-12 h-6 rounded-full transition-all relative ${vibrateEnabled ? 'bg-purple-600' : 'bg-slate-700'}`}>
                <motion.div animate={{ x: vibrateEnabled ? 26 : 4 }} className="w-4 h-4 bg-white rounded-full absolute top-1" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Voice Selection Modal Dialog */}
      <AnimatePresence>
        {activeSheet === "voice" && (
          <div className="fixed inset-0 z-[220] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="w-full max-w-sm bg-[#0A1628] border border-[#2e2160] rounded-[24px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-white"
            >
              {/* Header: Title & Subtitle */}
              <div className="p-5 pb-3">
                <h3 className="text-xl font-bold text-white tracking-wide">Voice</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Tap play to hear each voice, then pick your favourite.
                </p>
              </div>

              {/* Scrollable Voice List */}
              <div className="flex-1 overflow-y-auto px-4 py-1 space-y-2 no-scrollbar">
                {GEMINI_VOICE_LIST.map((voice) => {
                  const isSelected = tempSelectedVoice.toLowerCase() === voice.name.toLowerCase();
                  const isPlaying = previewingVoiceId?.toLowerCase() === voice.name.toLowerCase();
                  const isLoading = loadingVoiceId?.toLowerCase() === voice.name.toLowerCase();

                  return (
                    <div
                      key={voice.name}
                      onClick={() => setTempSelectedVoice(voice.name)}
                      className={`w-full p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-[#181830] border-[#8b5cf6] shadow-sm shadow-purple-900/40"
                          : "bg-[#0f0f23]/90 border-[#2e2160]/60 hover:bg-[#14142b]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Round Purple Play Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isPlaying) {
                              stopAudioPreview();
                            } else {
                              playVoicePreview(voice.name);
                            }
                          }}
                          className="w-9 h-9 rounded-full bg-purple-600 hover:bg-purple-500 active:scale-90 transition-transform flex items-center justify-center text-white shrink-0 shadow-md shadow-purple-900/50"
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                          ) : isPlaying ? (
                            <Pause className="w-4 h-4 text-white fill-white" />
                          ) : (
                            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                          )}
                        </button>
                        <div>
                          <h4 className="text-sm font-semibold text-white leading-snug">{voice.name}</h4>
                          <p className="text-xs text-slate-400">{voice.tone}</p>
                        </div>
                      </div>

                      {/* Purple Check Mark if selected */}
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {elevenPermissionError && (
                  <p className="text-xs text-amber-400 px-2 py-3 font-medium bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-3">
                    ভয়েস তালিকা পেতে key-তে Voices অনুমতি দিন
                  </p>
                )}
                {elevenVoices.length > 0 && (
                  <>
                    <div className="px-1 pt-4 pb-2 text-[11px] font-bold uppercase tracking-widest text-purple-400">ElevenLabs voices</div>
                    {elevenVoices.map((v: any) => {
                      const isSelected = tempSelectedVoice === v.voice_id || tempSelectedVoice === v.name;
                      const isPlaying = previewingVoiceId === v.voice_id;
                      const isLoading = loadingVoiceId === v.voice_id;
                      const styleWord = v.labels?.accent || v.category || "Natural";

                      return (
                        <div
                          key={v.voice_id}
                          onClick={() => setTempSelectedVoice(v.voice_id)}
                          className={`w-full p-3 rounded-2xl border transition-all flex flex-col gap-2 cursor-pointer ${
                            isSelected
                              ? "bg-[#181830] border-[#8b5cf6] shadow-sm shadow-purple-900/40"
                              : "bg-[#0f0f23]/90 border-[#2e2160]/60 hover:bg-[#14142b]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isPlaying) {
                                    stopAudioPreview();
                                  } else {
                                    playVoicePreview(v.name, true, v.voice_id);
                                  }
                                }}
                                className="w-9 h-9 rounded-full bg-purple-600 hover:bg-purple-500 active:scale-90 transition-transform flex items-center justify-center text-white shrink-0 shadow-md shadow-purple-900/50"
                              >
                                {isLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                                ) : isPlaying ? (
                                  <Pause className="w-4 h-4 text-white fill-white" />
                                ) : (
                                  <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                                )}
                              </button>
                              <div>
                                <h4 className="text-sm font-semibold text-white leading-snug">{v.name}</h4>
                                <p className="text-xs text-slate-400">{styleWord}</p>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>

                          <div className="flex justify-end pt-1 border-t border-white/5">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                applySelectedVoice(v.voice_id);
                              }}
                              className="text-[10px] font-bold text-purple-400 hover:text-purple-300 uppercase tracking-wider bg-transparent border-none outline-none cursor-pointer"
                            >
                              Use {v.name}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* Footer / Small Note & Action Buttons */}
              <div className="p-4 pt-3 border-t border-purple-500/10 space-y-3 shrink-0">
                <p className="text-[11px] text-slate-400 italic leading-tight px-1">
                  Gemini voices require a working Gemini API Key. Preview might fail if the key is missing or invalid.
                </p>

                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTempSelectedVoice(currentVoice.name);
                      setActiveSheet(null);
                      stopAudioPreview();
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      applySelectedVoice(tempSelectedVoice);
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-xs font-bold text-white transition-all shadow-lg shadow-purple-600/30"
                  >
                    Use {GEMINI_VOICE_LIST.find(v => v.name === tempSelectedVoice)?.name || "selected"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Other Sheets */}
      <AnimatePresence>
        {activeSheet && activeSheet !== "voice" && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setActiveSheet(null); stopAudioPreview(); }} className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[140] bg-[#0A1628] rounded-t-[2.5rem] border-t border-purple-500/30 flex flex-col max-h-[85vh]"
            >

              {/* Voice Model Sheet */}
              {activeSheet === "voice_model" && (
                <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                  <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0">
                    <button onClick={() => setActiveSheet(null)} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white"><ArrowLeft className="w-5 h-5" /></button>
                    <h3 className="text-[20px] font-semibold text-white">Voice model</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto px-[14px] pt-[8px]">
                    {[
                      {id: "fast", title: "Fast mode (Groq)", desc: "Whisper STT + Streaming Llama 70B LLM (Ultra fast response)"},
                      {id: "quality", title: "Quality mode (Gemini)", desc: "Probed & locked Gemini Flash model (High quality reasoning)"},
                    ].map(mode => (
                      <div
                        key={mode.id}
                        onClick={() => {
                          updateSetting("voiceModelMode", mode.id as any);
                          setActiveSheet(null);
                          localStorage.setItem("voice_model_mode", mode.id);
                        }}
                        className={`w-full p-4 mb-2 rounded-[16px] border-[1.5px] cursor-pointer ${settings.voiceModelMode === mode.id  ? 'bg-[#181830] border-[#8b5cf6]' : 'bg-[#0f0f23] border-[#2e2160]'}`}
                      >
                        <h4 className="text-sm font-bold text-white flex items-center justify-between">
                          {mode.title}
                          {(settings.voiceModelMode === mode.id ) && (
                            <Check className="w-4 h-4 text-[#8b5cf6]" />
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1">{mode.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Speech Speed Sheet */}
              {activeSheet === "speed" && (
                <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                  <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0">
                    <button onClick={() => setActiveSheet(null)} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white"><ArrowLeft className="w-5 h-5" /></button>
                    <h3 className="text-[20px] font-semibold text-white">Speech speed</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto px-[14px] pt-[8px]">
                    {[
                      {val: 0.8, label: "0.8x Slow"},
                      {val: 0.9, label: "0.9x"},
                      {val: 1.0, label: "1.0x Normal"},
                      {val: 1.1, label: "1.1x"},
                      {val: 1.2, label: "1.2x Fast"},
                      {val: 1.5, label: "1.5x Very fast"},
                    ].map(s => (
                      <div key={s.val} onClick={() => { updateSetting("speakingSpeed", s.val); localStorage.setItem("speech_speed", s.val.toString()); }} className={`w-full p-4 mb-2 rounded-[16px] border-[1.5px] cursor-pointer flex justify-between ${settings.speakingSpeed === s.val ? 'bg-[#181830] border-[#8b5cf6]' : 'bg-[#0f0f23] border-[#2e2160]'}`}>
                        <span className="text-sm font-bold text-white">{s.label}</span>
                        {settings.speakingSpeed === s.val && <Check className="text-[#8b5cf6]" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Voice Volume Sheet */}
              {activeSheet === "volume" && (
                <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                  <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0">
                    <button onClick={() => setActiveSheet(null)} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white"><ArrowLeft className="w-5 h-5" /></button>
                    <h3 className="text-[20px] font-semibold text-white">Voice volume</h3>
                  </div>
                  <div className="p-6">
                    <div className="text-center text-5xl font-black text-white mb-8">{settings.voiceVolume}%</div>
                    <input type="range" min="0" max="100" step="5" value={settings.voiceVolume} onChange={(e) => { const v = parseInt(e.target.value); updateSetting("voiceVolume", v); localStorage.setItem("voice_volume", v.toString()); }} className="w-full h-11 accent-purple-600" />
                    <div className="grid grid-cols-4 gap-2 mt-8">
                      {[25, 50, 80, 100].map(v => <button key={v} onClick={() => { updateSetting("voiceVolume", v); localStorage.setItem("voice_volume", v.toString()); }} className="py-3 bg-[#1e293b] rounded-xl text-xs font-bold text-white">{v}%</button>)}
                    </div>
                  </div>
                </div>
              )}

              {/* User Name Sheet */}
              {activeSheet === "user_name" && (
                <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                  <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0">
                    <button onClick={() => setActiveSheet(null)} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-[20px] font-semibold text-white">Your name</h3>
                  </div>
                  
                  <div className="flex-1 p-[14px] space-y-4">
                    <p className="text-[13px] text-slate-400">What should Rose call you?</p>
                    <input
                      type="text"
                      defaultValue={settings.userName || ""}
                      maxLength={20}
                      className="w-full h-[52px] bg-[#0f0f23] border-[1.5px] border-[#2e2160] rounded-[16px] px-4 text-white text-[16px] outline-none focus:border-[#8b5cf6]"
                      placeholder="Enter your name"
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        updateSetting("userName", val);
                        localStorage.setItem("user_name", val);
                        setActiveSheet(null);
                      }}
                      autoFocus
                    />
                    <button 
                      onClick={() => {
                        const input = document.querySelector('input[placeholder="Enter your name"]') as HTMLInputElement;
                        if(input) {
                          const val = input.value.trim();
                          updateSetting("userName", val);
                          localStorage.setItem("user_name", val);
                          setActiveSheet(null);
                        }
                      }}
                      className="w-full h-[48px] rounded-[16px] bg-gradient-to-r from-[#6d3fd1] to-[#4b27a0] text-white font-bold"
                    >
                      SAVE
                    </button>
                  </div>
                </div>
              )}

              {/* Personality Sheet */}
              {activeSheet === "personality" && (
                <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                  <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0">
                    <button onClick={() => setActiveSheet(null)} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-[20px] font-semibold text-white">Personality</h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto no-scrollbar px-[14px] pt-[8px] pb-8">
                    {characters.map((char) => {
                      const Icon = char.icon;
                      const isSelected = settings.personality === char.id;
                      return (
                        <div 
                          key={char.id} 
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            updateSetting("personality", char.id);
                            const suggested = PERSONALITY_SUGGESTED_VOICE[char.id] || "Sulafat";
                            showToast(`Personality: ${char.name}. Suggested voice: ${suggested}`, suggested);
                          }}
                          className={`w-full group p-3 rounded-[16px] border-[1.5px] transition-all duration-300 text-left flex items-center gap-3 cursor-pointer mb-[8px] ${isSelected ? 'bg-[#181830] border-[#8b5cf6]' : 'bg-[#0f0f23] border-[#2e2160]'}`}
                          style={{ minHeight: '68px' }}
                        >
                          <div className="w-[44px] h-[44px] rounded-[12px] bg-gradient-to-br from-[#6d3fd1] to-[#4b27a0] flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[15px] font-semibold text-white">
                              {char.name}
                            </h4>
                            <p className="text-[12px] text-[#9a9bb5] mt-0.5 truncate whitespace-nowrap overflow-hidden">
                              {char.description}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="w-[24px] h-[24px] rounded-full bg-white flex items-center justify-center shrink-0">
                              <Check className="w-[14px] h-[14px] text-[#8b5cf6]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Language Sheet */}
              {activeSheet === "language" && (
                <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                  <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0">
                    <button onClick={() => setActiveSheet(null)} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-[20px] font-semibold text-white">Language</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar px-[14px] pt-[8px] pb-8">
                    {[
                      { id: "Bengali", name: "বাংলা", eng: "Bengali" },
                      { id: "English", name: "English", eng: "English" },
                      { id: "Hindi", name: "हिन्दी", eng: "Hindi" },
                      { id: "Urdu", name: "اردو", eng: "Urdu" },
                      { id: "Arabic", name: "العربية", eng: "Arabic" },
                      { id: "Spanish", name: "Español", eng: "Spanish" },
                      { id: "French", name: "Français", eng: "French" },
                      { id: "German", name: "Deutsch", eng: "German" },
                      { id: "Portuguese", name: "Português", eng: "Portuguese" },
                      { id: "Russian", name: "Русский", eng: "Russian" },
                      { id: "Chinese", name: "中文", eng: "Chinese" },
                      { id: "Japanese", name: "日本語", eng: "Japanese" },
                      { id: "Korean", name: "한국어", eng: "Korean" },
                      { id: "Turkish", name: "Türkçe", eng: "Turkish" },
                    ].map((lang) => {
                      const isSelected = settings.language === lang.id;
                      return (
                        <div 
                          key={lang.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => { updateSetting("language", lang.id); setActiveSheet(null); }}
                          className={`w-full group p-3 rounded-[16px] border-[1.5px] transition-all duration-300 text-left flex items-center gap-3 cursor-pointer mb-[8px] ${isSelected ? 'bg-[#181830] border-[#8b5cf6]' : 'bg-[#0f0f23] border-[#2e2160]'}`}
                          style={{ minHeight: '68px' }}
                        >
                          <div className="w-[44px] h-[44px] rounded-[12px] bg-gradient-to-br from-[#6d3fd1] to-[#4b27a0] flex items-center justify-center shrink-0">
                            <Globe className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[15px] font-semibold text-white">
                              {lang.name}
                            </h4>
                            <p className="text-[12px] text-[#9a9bb5] mt-0.5 truncate whitespace-nowrap overflow-hidden">
                              {lang.eng}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="w-[24px] h-[24px] rounded-full bg-white flex items-center justify-center shrink-0">
                              <Check className="w-[14px] h-[14px] text-[#8b5cf6]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Response Style Sheet */}
              {activeSheet === "response_style" && (
                <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                  <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0">
                    <button onClick={() => setActiveSheet(null)} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-[20px] font-semibold text-white">Response Style</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar px-[14px] pt-[8px] pb-8">
                    {[
                      { id: "Concise", desc: "Short, direct answers." },
                      { id: "Balanced", desc: "Clear answers with moderate detail." },
                      { id: "Detailed", desc: "Thorough, step-by-step explanations." },
                      { id: "Brief Voice", desc: "Very short spoken replies, ideal for hands-free." },
                    ].map((s) => {
                      const isSelected = settings.replyLength === s.id;
                      return (
                        <div 
                          key={s.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => { updateSetting("replyLength", s.id as ReplyLength); setActiveSheet(null); }}
                          className={`w-full group p-3 rounded-[16px] border-[1.5px] transition-all duration-300 text-left flex items-center gap-3 cursor-pointer mb-[8px] ${isSelected ? 'bg-[#181830] border-[#8b5cf6]' : 'bg-[#0f0f23] border-[#2e2160]'}`}
                          style={{ minHeight: '68px' }}
                        >
                          <div className="w-[44px] h-[44px] rounded-[12px] bg-gradient-to-br from-[#6d3fd1] to-[#4b27a0] flex items-center justify-center shrink-0">
                            <Sliders className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-[15px] font-semibold text-white">
                              {s.id}
                            </h4>
                            <p className="text-[12px] text-[#9a9bb5] mt-0.5 truncate whitespace-nowrap overflow-hidden">
                              {s.desc}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="w-[24px] h-[24px] rounded-full bg-white flex items-center justify-center shrink-0">
                              <Check className="w-[14px] h-[14px] text-[#8b5cf6]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Noise Filter Sheet */}
              {activeSheet === "noise_filter" && (
                <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                  <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0 border-b border-white/10">
                    <button onClick={() => setActiveSheet(null)} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-[20px] font-semibold text-white">Noise Filter</h3>
                  </div>
                  
                  <div className="flex-1 p-[16px] space-y-6 overflow-y-auto">
                    <div className="bg-[#0f0f23] border border-purple-500/20 rounded-[20px] p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-bold text-white">WebRTC Noise Suppression</h4>
                          <p className="text-xs text-slate-400 mt-0.5">Filter echo, background fans & static</p>
                        </div>
                        <button
                          onClick={() => updateMicConfig({ cleanVoice: !micSettingsState.cleanVoice })}
                          className={`w-14 h-7 rounded-full transition-all relative ${micSettingsState.cleanVoice ? "bg-purple-600" : "bg-slate-700"}`}
                        >
                          <motion.div animate={{ x: micSettingsState.cleanVoice ? 30 : 4 }} className="w-5 h-5 bg-white rounded-full absolute top-1" />
                        </button>
                      </div>

                      <div className="pt-3 border-t border-white/5 space-y-2 text-xs text-slate-300">
                        <div className="flex items-center gap-2 text-purple-400 font-bold">
                          <Filter className="w-4 h-4" />
                          <span>How Noise Filter works:</span>
                        </div>
                        <p className="text-slate-400 leading-relaxed">
                          • <strong className="text-white">ON:</strong> Requests WebRTC mic with noise suppression, echo cancellation, and auto gain control.
                        </p>
                        <p className="text-slate-400 leading-relaxed">
                          • <strong className="text-white">OFF:</strong> Requests standard direct microphone stream without WebRTC processing.
                        </p>
                        <p className="text-slate-400 leading-relaxed italic">
                          Automatic fallback to default microphone is active if WebRTC constraints are unsupported.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Noise Gate Sheet */}
              {activeSheet === "noise_gate" && (
                <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                  <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0 border-b border-white/10">
                    <button onClick={() => setActiveSheet(null)} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-[20px] font-semibold text-white">Noise Gate</h3>
                  </div>

                  <div className="flex-1 p-[16px] space-y-5 overflow-y-auto">
                    {/* Live Meter */}
                    <LiveNoiseGateMeter isEnabled={micSettingsState.noiseGate} sensitivity={micSettingsState.noiseGateSensitivity} />

                    <div className="bg-[#0f0f23] border border-purple-500/20 rounded-[20px] p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-bold text-white">Enable Noise Gate</h4>
                          <p className="text-xs text-slate-400 mt-0.5">Silence audio when speaking stops</p>
                        </div>
                        <button
                          onClick={() => updateMicConfig({ noiseGate: !micSettingsState.noiseGate })}
                          className={`w-14 h-7 rounded-full transition-all relative ${micSettingsState.noiseGate ? "bg-purple-600" : "bg-slate-700"}`}
                        >
                          <motion.div animate={{ x: micSettingsState.noiseGate ? 30 : 4 }} className="w-5 h-5 bg-white rounded-full absolute top-1" />
                        </button>
                      </div>

                      {/* Sensitivity selector */}
                      <div className="pt-3 border-t border-white/5 space-y-2">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                          Gate Sensitivity Margin
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["Low", "Medium", "High"] as NoiseGateSensitivity[]).map((sens) => {
                            const isSel = micSettingsState.noiseGateSensitivity === sens;
                            return (
                              <button
                                key={sens}
                                type="button"
                                onClick={() => updateMicConfig({ noiseGateSensitivity: sens })}
                                className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                                  isSel
                                    ? "bg-purple-600 border-purple-400 text-white shadow-lg"
                                    : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                                }`}
                              >
                                {sens} {sens === "Low" ? "(+6dB)" : sens === "High" ? "(+14dB)" : "(+10dB)"}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/5 space-y-1.5 text-xs text-slate-400">
                        <p>• Learns background noise floor dynamically over the last 3s.</p>
                        <p>• Holds gate open for 300ms hangover to prevent word clipping.</p>
                        <p>• Zeroes out closed frames so TV or street noise is not sent to AI.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fast Reply Sheet */}
              {activeSheet === "fast_reply" && (
                <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                  <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0 border-b border-white/10">
                    <button onClick={() => setActiveSheet(null)} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-[20px] font-semibold text-white">Fast Reply (VAD)</h3>
                  </div>

                  <div className="flex-1 p-[16px] space-y-5 overflow-y-auto">
                    <div className="bg-[#0f0f23] border border-purple-500/20 rounded-[20px] p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-bold text-white">Gemini Live VAD Tuning</h4>
                          <p className="text-xs text-slate-400 mt-0.5">Faster turn response when you stop speaking</p>
                        </div>
                        <button
                          onClick={() => updateMicConfig({ fastReply: !micSettingsState.fastReply })}
                          className={`w-14 h-7 rounded-full transition-all relative ${micSettingsState.fastReply ? "bg-purple-600" : "bg-slate-700"}`}
                        >
                          <motion.div animate={{ x: micSettingsState.fastReply ? 30 : 4 }} className="w-5 h-5 bg-white rounded-full absolute top-1" />
                        </button>
                      </div>

                      {/* Reply speed selector */}
                      <div className="pt-3 border-t border-white/5 space-y-2">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                          Reply speed
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(["Normal", "Fast", "Very fast"] as FastReplySpeed[]).map((speed) => {
                            const isSel = micSettingsState.fastReplySpeed === speed;
                            return (
                              <button
                                key={speed}
                                type="button"
                                onClick={() => updateMicConfig({ fastReplySpeed: speed })}
                                className={`py-2.5 rounded-xl border text-[10px] font-black uppercase transition-all ${
                                  isSel
                                    ? "bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-900/40"
                                    : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                                }`}
                              >
                                {speed}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/5 space-y-2">
                        <h5 className="text-xs font-bold uppercase tracking-wider text-purple-400">Active VAD Parameters</h5>
                        <div className="bg-slate-900/80 rounded-xl p-3 space-y-1.5 font-mono text-xs border border-white/5 text-slate-300">
                          <div className="flex justify-between">
                            <span className="text-slate-400">endOfSpeechSensitivity:</span>
                            <span className="text-emerald-400 font-bold uppercase">HIGH</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">prefixPaddingMs:</span>
                            <span className="text-purple-300">200 ms</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">silenceDurationMs:</span>
                            <span className="text-amber-400 font-bold">
                              {micSettingsState.fastReplySpeed === 'Normal' ? '800 ms' : 
                               micSettingsState.fastReplySpeed === 'Very fast' ? '350 ms' : '500 ms'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Street Mode Sheet */}
              {activeSheet === "street_mode" && (
                <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                  <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0 border-b border-white/10">
                    <button onClick={() => setActiveSheet(null)} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-[20px] font-semibold text-white">Street Mode</h3>
                  </div>

                  <div className="flex-1 p-[16px] space-y-5 overflow-y-auto">
                    <div className="bg-[#0f0f23] border border-amber-500/30 rounded-[20px] p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-bold text-white flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-amber-400" />
                            <span>Noisy Environment Preset</span>
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">For streets, markets, cars & noisy outdoors</p>
                        </div>
                        <button
                          onClick={() => {
                            const next = !micSettingsState.streetMode;
                            updateMicConfig({ streetMode: next });
                            showToast(next ? "Street Mode Enabled" : "Street Mode Disabled");
                          }}
                          className={`w-14 h-7 rounded-full transition-all relative ${micSettingsState.streetMode ? "bg-amber-500" : "bg-slate-700"}`}
                        >
                          <motion.div animate={{ x: micSettingsState.streetMode ? 30 : 4 }} className="w-5 h-5 bg-white rounded-full absolute top-1" />
                        </button>
                      </div>

                      {micSettingsState.streetMode && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-amber-300 font-bold text-xs">
                          <Check className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Street Mode Active Badge Enabled</span>
                        </div>
                      )}

                      <div className="pt-3 border-t border-white/5 space-y-2 text-xs text-slate-300">
                        <p className="font-bold text-slate-200">Automatically configures when ON:</p>
                        <ul className="list-disc list-inside space-y-1 text-slate-400">
                          <li>Noise Filter: <strong className="text-white">ON</strong></li>
                          <li>Noise Gate: <strong className="text-white">ON (High +14dB)</strong></li>
                          <li>Fast Reply silenceDurationMs: <strong className="text-amber-400 font-bold">400 ms</strong></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Native Mic Sheet (Android app only) */}
              {activeSheet === "native_mic" && isAndroidApp() && (
                <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col">
                  <div className="flex items-center gap-3 px-[14px] h-[56px] pt-[max(env(safe-area-inset-top),8px)] shrink-0 border-b border-white/10">
                    <button onClick={() => setActiveSheet(null)} className="w-[40px] h-[40px] rounded-[12px] bg-white/5 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-[20px] font-semibold text-white">NATIVE MIC (অ্যাপ)</h3>
                  </div>

                  <div className="flex-1 p-[16px] space-y-5 overflow-y-auto">
                    <div className="bg-[#0f0f23] border border-purple-500/20 rounded-[20px] p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-bold text-white">NATIVE MIC (অ্যাপ)</h4>
                          <p className="text-xs text-slate-400 mt-0.5">Android native 16 kHz PCM16 capture</p>
                        </div>
                        <button
                          onClick={() => {
                            const next = !micSettingsState.nativeMic;
                            updateMicConfig({ nativeMic: next });
                            showToast(next ? "Native Mic চালু" : "Native Mic বন্ধ");
                          }}
                          className={`w-14 h-7 rounded-full transition-all relative ${micSettingsState.nativeMic ? "bg-purple-600" : "bg-slate-700"}`}
                        >
                          <motion.div animate={{ x: micSettingsState.nativeMic ? 30 : 4 }} className="w-5 h-5 bg-white rounded-full absolute top-1" />
                        </button>
                      </div>

                      <div className="pt-3 border-t border-white/5 space-y-2">
                        <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                          Mode
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: "communication" as const, label: "Clear voice" },
                            { id: "recognition" as const, label: "Raw" },
                          ].map((opt) => {
                            const isSel = micSettingsState.nativeMicMode === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => updateMicConfig({ nativeMicMode: opt.id })}
                                className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                                  isSel
                                    ? "bg-purple-600 border-purple-400 text-white shadow-lg"
                                    : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-slate-400 pt-1">
                          Clear voice মোডে স্পিকারের আওয়াজ কমে গেলে Mode বদলে Raw বেছে নিন।
                        </p>
                      </div>

                      <div className="pt-3 border-t border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-purple-400 uppercase tracking-wider">Active Filters</span>
                          <span className="text-slate-400">
                            {nativeMicStatus.hasStartResult ? `${nativeMicStatus.rate} Hz` : "কল শুরু হলে দেখাবে"}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                          {[
                            { label: "Noise", enabled: nativeMicStatus.ns },
                            { label: "Echo", enabled: nativeMicStatus.aec },
                            { label: "Gain", enabled: nativeMicStatus.agc },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className={`p-2.5 rounded-xl border flex items-center justify-between ${
                                nativeMicStatus.hasStartResult && item.enabled
                                  ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200"
                                  : "bg-slate-900/80 border-white/10 text-slate-300"
                              }`}
                            >
                              <span>{item.label}</span>
                              <span>{!nativeMicStatus.hasStartResult ? "—" : item.enabled ? "✓" : "✕"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoiceLanguageSettings;
