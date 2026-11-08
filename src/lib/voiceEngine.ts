import { logVoiceEvent } from "./voiceLogger";
import { extractReplyText, prepareHistory } from "./ai-utils";
import { getCachedAudio, saveCachedAudio } from "./ttsCache";
import {
  incrementAnswerCalls,
  incrementTTSCalls,
  markModelExhausted,
  isModelExhausted,
  getQuotaUsage,
} from "./quotaManager";

export const ANSWER_MODELS_PRIORITY = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-latest",
];

export const TTS_MODELS_PRIORITY = [
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
  "gemini-3.8-flash",
];

export function getElevenLabsKey(): string {
  try {
    return (localStorage.getItem("elevenlabs_api_key") || "").trim();
  } catch (e) {
    return "";
  }
}

export interface AnswerResult {
  text: string;
  modelUsed: string;
  engine: "gemini" | "groq" | "none";
  sttMs?: number;
  answerMs?: number;
}

export interface TTSResult {
  audioBase64?: string;
  modelUsed: string;
  useBrowserSynth: boolean;
  quotaExhaustedNotice?: string;
  ttsMs?: number;
}

export interface VoiceTurnTiming {
  speechHeardMs: number;
  sttMs: number;
  answerMs: number;
  ttsMs: number;
  totalMs: number;
}

let activeCachedAnswerModel = "gemini-3.5-flash";
let activeCachedTTSModel = "gemini-2.5-flash-preview-tts";

export const getCachedAnswerModel = (): string => {
  return localStorage.getItem("cached_answer_model") || activeCachedAnswerModel;
};

export const getCachedTTSModel = (): string => {
  return localStorage.getItem("cached_tts_model") || activeCachedTTSModel;
};

export const getLastTurnTiming = (): VoiceTurnTiming | null => {
  try {
    const raw = localStorage.getItem("rose_last_turn_timing");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
};

export const saveLastTurnTiming = (timing: VoiceTurnTiming) => {
  try {
    localStorage.setItem("rose_last_turn_timing", JSON.stringify(timing));
  } catch (e) {}
};

export const getFriendlyErrorMessage = (rawError: any): string => {
  const errStr = String(rawError?.message || rawError || "").toLowerCase();
  
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "No internet";
  }

  if (
    errStr.includes("add your gemini key") ||
    errStr.includes("missing key") ||
    errStr.includes("connections")
  ) {
    return "Add your Gemini key in Settings > Connections";
  }

  if (
    errStr.includes("429") ||
    errStr.includes("quota") ||
    errStr.includes("resource_exhausted") ||
    errStr.includes("rate limit") ||
    errStr.includes("limit reached") ||
    errStr.includes("exhausted")
  ) {
    return "Gemini limit reached, wait a minute";
  }

  if (
    errStr.includes("400") ||
    errStr.includes("401") ||
    errStr.includes("403") ||
    errStr.includes("404") ||
    errStr.includes("permission denied") ||
    errStr.includes("not found") ||
    errStr.includes("invalid key") ||
    errStr.includes("unauthorized")
  ) {
    return "Gemini key invalid";
  }

  if (
    errStr.includes("500") ||
    errStr.includes("503") ||
    errStr.includes("timeout") ||
    errStr.includes("server busy") ||
    errStr.includes("busy")
  ) {
    return "Server busy, retrying";
  }

  return "Add your Gemini key in Settings";
};

// Helper: Fetch with 7s timeout and 1-time retry for transient errors
async function fetchWithTimeoutAndRetry(
  url: string,
  options: RequestInit,
  timeoutMs: number = 7000
): Promise<Response> {
  const executeCall = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  };

  try {
    const res = await executeCall();
    if (res.status === 500 || res.status === 503) {
      logVoiceEvent("Network Call", `HTTP ${res.status} received. Retrying once after 500ms...`, "warn");
      await new Promise((r) => setTimeout(r, 500));
      return await executeCall();
    }
    return res;
  } catch (err: any) {
    logVoiceEvent("Network Call", `Call failed (${err?.message || "Timeout"}). Retrying once after 500ms...`, "warn");
    await new Promise((r) => setTimeout(r, 500));
    return await executeCall();
  }
}

export function getFirstSentence(text: string): string {
  if (!text) return "";
  const match = text.match(/[^.!?।\n]+[.!?।\n]?/);
  return match ? match[0].trim() : text.trim();
}

let geminiQuotaExhausted = false;

const getBengaliError = (raw: string, provider: 'Groq' | 'Gemini'): string => {
    const msg = raw.toLowerCase();
    if (msg.includes('401')) return `${provider}: কী নেই বা ভুল`;
    if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) return `${provider}: লিমিট শেষ`;
    if (msg.includes('timeout')) return `${provider}: নেটওয়ার্ক বা সময় শেষ`;
    return `${provider}: ${raw}`;
};

// Generate Voice Answer Step
export async function generateVoiceAnswer(payload: {
  contents: any[];
  systemInstruction?: string;
  apiKey: string;
  groqKey?: string;
  audioBlob?: Blob;
  languageCode?: string;
  voiceModelMode?: "fast" | "quality";
  onFirstSentenceReceived?: (sentence: string) => void;
}): Promise<AnswerResult> {
  const {
    contents,
    systemInstruction,
    apiKey: rawApiKey,
    groqKey: rawGroqKey,
    audioBlob,
    languageCode,
    voiceModelMode = "fast",
    onFirstSentenceReceived,
  } = payload;

  const userKey = rawApiKey || localStorage.getItem("gemini_api_key") || "";
  const groqKeys = ["groq_api_keys", "groq_api_key", "groqKey", "GROQ_API_KEY"];
  let groqKeyVal: string | undefined = rawGroqKey;
  for (const k of groqKeys) {
      if (!groqKeyVal) groqKeyVal = localStorage.getItem(k) || undefined;
  }
  const groqKey = (groqKeyVal || "").trim();
  console.log("GROQ KEY EXISTS:", !!groqKey);
  if (!groqKey) console.log("GROQ KEY MISSING");

  if (!userKey || !userKey.trim()) {
    const errorMsg = "Add your Gemini key in Settings";
    logVoiceEvent("Answer Step", errorMsg, "error");
    throw new Error(errorMsg);
  }

  const apiKey = userKey.trim();

  const strictSystemInstruction =
    (systemInstruction || "") +
    "\n\nIMPORTANT CONSTRAINTS: Reply in 1 to 2 short sentences. Never use lists or markdown in voice. Only give a longer answer if I ask for details.";

  const sttStartTime = Date.now();
  let sttMs = 0;
  let userSpeechText = "";

  // Prepare contents once
  console.log("RAW CONTENTS:", JSON.stringify(contents));
  const safeContents = contents.map((c: any) => ({ 
      role: c.role, 
      text: c.parts?.[0]?.text || c.text || c.content || "" 
  }));
  let history = prepareHistory(safeContents, strictSystemInstruction);
  
  if (history.length === 0) {
      return { text: "দুঃখিত, আপনার কথা বুঝতে পারিনি। আবার বলুন।", modelUsed: "none", engine: "none" };
  }
  console.log("SENDING CONTENTS:", history.length, history.map(h => h.role));

  const voiceMode = localStorage.getItem("voice_mode") || "free";
  console.log("VOICE MODE:", voiceMode);
  
  // 1. Try Groq first
  let groqError = "";
  if (groqKey) {
     console.log("VOICE PROVIDER: groq");
     try {
       const controller = new AbortController();
       const timeoutId = setTimeout(() => controller.abort(), 15000);
       const res = await fetch("/api/groq/chat", {
         method: "POST",
         headers: { "Authorization": `Bearer ${groqKey.trim().split(',')[0]}`, "Content-Type": "application/json" },
         body: JSON.stringify({
           model: "llama-3.3-70b-versatile",
           messages: [{ role: "system", content: strictSystemInstruction }, ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.parts[0].text }))],
           stream: false
         }),
         signal: controller.signal
       });
       clearTimeout(timeoutId);
       
       const data = await res.json();
       console.log(`Groq Result: ${res.status}`);
       if (!res.ok) throw new Error(`${res.status}`);
       return { text: data.choices[0].message.content, modelUsed: "llama-3.3-70b-versatile", engine: "groq" };
     } catch (e: any) { 
        groqError = getBengaliError(e.name === 'AbortError' ? "Timeout" : e.message, 'Groq');
        console.error("Groq fallback", groqError);
     }
  } else {
      groqError = "Groq: কী নেই";
  }

  // 2. Fallback to Gemini pipeline
  if (voiceMode === "free") {
      return { text: "Groq কী বা কানেকশন নেই।", modelUsed: "none", engine: "none" };
  }
  
  console.log("VOICE PROVIDER: gemini");
  for (const modelCandidate of ANSWER_MODELS_PRIORITY) {
    if (isModelExhausted(modelCandidate)) continue;
    
    const answerStartTime = Date.now();
    let attempts = 0;
    let maxAttempts = 1;
    while (attempts < maxAttempts) {
      attempts++;
      try {
        if (attempts > 1) await new Promise(r => setTimeout(r, 1000));
        
        const url = `/api/gemini/generate`;
        
        const body = {
          contents: history,
          systemInstruction: strictSystemInstruction,
          model: modelCandidate,
          apiKey: apiKey
        };

        const res = await fetchWithTimeoutAndRetry(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }, 7000);

        const data = await res.json();
        console.log(`Gemini ${modelCandidate} Result: ${res.status}`);
        
        if (res.status === 429) {
            markModelExhausted(modelCandidate);
            break;
        }
        
        if (res.status === 503) maxAttempts = 2;
        
        if (!res.ok) throw new Error(`Gemini: ${res.status}`);
        
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
             incrementAnswerCalls();
             activeCachedAnswerModel = modelCandidate;
             localStorage.setItem("cached_answer_model", modelCandidate);
             return { text, modelUsed: modelCandidate, engine: "gemini", sttMs: 0, answerMs: Date.now() - answerStartTime };
        }
        throw new Error("Gemini: Empty response");
      } catch (err: any) { 
        console.error("Gemini attempt failed", err);
        // Only return final error if no more attempts
        if (attempts >= maxAttempts) {
            if (err.message.includes("429")) return { text: "Gemini-র ফ্রি সীমা শেষ", modelUsed: "none", engine: "none" };
            return { text: `Gemini: ${err.message}`, modelUsed: "none", engine: "none" };
        }
      }
    }
  }

  return { text: "আজকের ফ্রি সীমা শেষ। Groq কী ঠিক আছে কি না দেখুন।", modelUsed: "none", engine: "none" };
}

export const PERSONALITY_TTS_PROMPT_PREFIX: Record<string, string> = {
  "GF Mode": "Say in a very sweet, soft, loving voice with a gentle smile: ",
  "Companion": "Say in a warm, caring, friendly tone: ",
  "Friendly": "Say in a cheerful, friendly, lighthearted voice: ",
  "Professional": "Say in a clear, polite, professional voice: ",
  "Funny": "Say in a funny, playful, laughing voice: ",
  "Teacher": "Say in a patient, clear, encouraging voice: ",
  "Developer": "Say in a precise, logical, clear tone: ",
  "Hungry": "Say in an excited, cheerful, hungry tone: ",
  "Nautanki": "Say in a dramatic, expressive, theatrical voice: ",
  "Motivator": "Say in an energetic, inspiring, confident voice: ",
  "Storyteller": "Say in a captivating, soft, storytelling voice: ",
  "Calm guide": "Say in a calm, peaceful, soothing voice: ",
  "Normal": "Say in a sweet, soft, natural voice: ",
};

async function discoverTtsModelsDirect(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/gemini/models?apiKey=${encodeURIComponent(apiKey)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.models || [])
      .filter((m: any) => {
        const name = String(m?.name || '').replace(/^models\//, '');
        const methods: string[] = m?.supportedGenerationMethods || [];
        return name.toLowerCase().includes('tts') && methods.includes('generateContent');
      })
      .map((m: any) => String(m.name).replace(/^models\//, ''));
  } catch (e) {
    return [];
  }
}

// Generate Voice TTS Step with IndexedDB Caching and Quota Fallbacks
export async function generateVoiceTTS(payload: {
  text: string;
  voiceName: string;
  apiKey: string;
  personality?: string;
  ttsStylePrefix?: string;
}): Promise<TTSResult> {
  const { text, voiceName, apiKey: rawApiKey, personality, ttsStylePrefix } = payload;
  const userKey = rawApiKey || localStorage.getItem("gemini_api_key") || "";

  const elevenKey = getElevenLabsKey();
  let elevenVoices: any[] = [];
  try {
    const raw = localStorage.getItem("rose_elevenlabs_voices");
    if (raw) elevenVoices = JSON.parse(raw);
  } catch (e) {}

  const isElevenVoice = elevenVoices.some((v: any) => v.voice_id === voiceName || v.name === voiceName) || voiceName.length > 20;

  if (elevenKey && isElevenVoice) {
    const ttsStartTime = Date.now();
    const prefix = ttsStylePrefix || (personality ? PERSONALITY_TTS_PROMPT_PREFIX[personality] : "");
    const formattedText = prefix ? `${prefix}${text}` : text;

    const cachedAudio = await getCachedAudio(formattedText, voiceName);
    if (cachedAudio) {
      return { audioBase64: cachedAudio, modelUsed: "IndexedDB Cache", useBrowserSynth: false, ttsMs: Date.now() - ttsStartTime };
    }

    try {
      const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceName}`, {
        method: "POST",
        headers: {
          "xi-api-key": elevenKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: formattedText,
          model_id: "eleven_multilingual_v2",
        }),
      });

      if (elevenRes.ok) {
        const arrayBuf = await elevenRes.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        await saveCachedAudio(formattedText, voiceName, base64);
        return {
          audioBase64: base64,
          modelUsed: "ElevenLabs",
          useBrowserSynth: false,
          ttsMs: Date.now() - ttsStartTime,
        };
      } else {
        console.warn("ElevenLabs failed, falling back to Gemini voice");
        typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent('rose-toast', { detail: 'ElevenLabs ব্যর্থ, Gemini ভয়েস ব্যবহার করছি' }));
      }
    } catch (e) {
      console.warn("ElevenLabs network error, falling back to Gemini");
      typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent('rose-toast', { detail: 'ElevenLabs ব্যর্থ, Gemini ভয়েস ব্যবহার করছি' }));
    }
  }

  if (!userKey || !userKey.trim()) {
    logVoiceEvent("TTS Step", "No Gemini API key available for TTS", "error");
    return {
      modelUsed: "none",
      useBrowserSynth: false,
      quotaExhaustedNotice: "Add your Gemini key in Settings",
    };
  }

  const apiKey = userKey.trim();
  const ttsStartTime = Date.now();

  const prefix = ttsStylePrefix || (personality ? PERSONALITY_TTS_PROMPT_PREFIX[personality] : "");
  const formattedText = prefix ? `${prefix}${text}` : text;

  // 1. CHECK INDEXEDDB CACHE FIRST
  const cachedAudio = await getCachedAudio(formattedText, voiceName);
  if (cachedAudio) {
    const ttsMs = Date.now() - ttsStartTime;
    logVoiceEvent("TTS Cache", `Loaded TTS audio from IndexedDB cache in ${ttsMs}ms`, "success");
    return {
      audioBase64: cachedAudio,
      modelUsed: "IndexedDB Cache",
      useBrowserSynth: false,
      ttsMs,
    };
  }

  logVoiceEvent("TTS Step", `Generating TTS audio for text: "${formattedText.slice(0, 40)}..."`);

  // 2. TTS MODEL FALLBACK CHAIN
  const candidateTTSModels = TTS_MODELS_PRIORITY.filter((m) => !isModelExhausted(m));

  for (const ttsModelCandidate of candidateTTSModels) {
    try {
      const url = `/api/gemini/tts`;
      
      const res = await fetchWithTimeoutAndRetry(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: formattedText,
          voiceName: voiceName || "Leda",
          apiKey: apiKey,
          model: ttsModelCandidate
        }),
      }, 5000);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error?.message || errData.error || `HTTP ${res.status}`;
        if (res.status === 429 || errData.quotaExhausted || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("limit") || errMsg.toLowerCase().includes("resource_exhausted")) {
          logVoiceEvent("TTS Step", `TTS candidate ${ttsModelCandidate} quota exhausted (429). Marking as exhausted...`, "warn");
          markModelExhausted(ttsModelCandidate);
        }
        continue;
      }

      const data = await res.json();
      const ttsMs = Date.now() - ttsStartTime;

      const rawAudio = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;

      if (rawAudio) {
        // Strip RIFF header if present
        let processedB64 = rawAudio;
        try {
          const binary = atob(rawAudio);
          if (binary.length > 44 && binary.slice(0, 4) === 'RIFF') {
            const bytes = new Uint8Array(binary.length - 44);
            for (let i = 44; i < binary.length; i++) bytes[i - 44] = binary.charCodeAt(i);
            let binaryString = '';
            for (let i = 0; i < bytes.length; i++) binaryString += String.fromCharCode(bytes[i]);
            processedB64 = btoa(binaryString);
          }
        } catch (e) {}

        incrementTTSCalls();
        activeCachedTTSModel = ttsModelCandidate;
        localStorage.setItem("cached_tts_model", ttsModelCandidate);
        
        await saveCachedAudio(formattedText, voiceName, processedB64);
        logVoiceEvent("TTS Active", `Generated TTS in ${ttsMs}ms using ${ttsModelCandidate}`, "success");
        return {
          audioBase64: processedB64,
          modelUsed: ttsModelCandidate,
          useBrowserSynth: false,
          ttsMs,
        };
      }
    } catch (e: any) {
      logVoiceEvent("TTS Step", `TTS candidate ${ttsModelCandidate} failed: ${e?.message || String(e)}`, "warn");
    }
  }

  // 3. ALL TTS MODELS EXHAUSTED: DO NOT FALLBACK TO MALE PHONE VOICE
  const ttsMs = Date.now() - ttsStartTime;
  return {
    audioBase64: "",
    modelUsed: "none",
    useBrowserSynth: false,
    ttsMs,
  };
}
export async function runContinuousVoiceLoop(
  onStateChange: (state: string) => void,
  onReply: (text: string) => void,
  stopRef: React.MutableRefObject<boolean>
) {
  let wakeLock: any = null;
  try {
    wakeLock = await (navigator as any).wakeLock.request('screen');
  } catch (e) { console.error(e); }

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  while (!stopRef.current) {
    onStateChange("LISTENING");
    const mode = localStorage.getItem("voice_mode") || "free";
    
    // 1. Hear
    let speech = "";
    if (mode === "free") {
        // Use browser STT logic
        speech = await captureSpeech();
    } else {
        speech = await captureSpeech();
    }

    if (stopRef.current) break;
    
    // 2. Think
    onStateChange("THINKING");
    try {
      const reply = await generateVoiceAnswerWithTimeout(speech);
      if (stopRef.current) break;
      
      // 3. Speak
      onStateChange("SPEAKING");
      if (mode === "free") {
          // Use Browser Speech Synthesis
          const utterance = new SpeechSynthesisUtterance(reply);
          utterance.lang = "bn-BD";
          window.speechSynthesis.speak(utterance);
      } else {
          await playVoiceAnswer(reply, audioCtx);
      }
    } catch (e) {
      console.error(e);
      onReply("দুঃখিত, আবার বলুন।");
    }
  }

  if (wakeLock) wakeLock.release();
  onStateChange("OFF");
}

async function captureSpeech(): Promise<string> {
    // Existing speech capture logic...
    return "Dummy transcription"; 
}

async function generateVoiceAnswerWithTimeout(text: string): Promise<string> {
    return Promise.race([
        generateVoiceAnswer({ /* payload */ } as any).then(r => r.text),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 20000))
    ]) as Promise<string>;
}


async function playVoiceAnswer(text: string, ctx: AudioContext) {
    // Existing TTS + GainNode + Compressor logic...
}


