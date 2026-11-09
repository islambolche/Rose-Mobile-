import { logVoiceEvent } from "./voiceLogger";
import { prepareHistory } from "./ai-utils";
import { getCachedAudio, saveCachedAudio } from "./ttsCache";
import {
  incrementAnswerCalls,
  incrementTTSCalls,
  markModelExhausted,
  isModelExhausted,
} from "./quotaManager";
import { getGeminiKey } from "./geminiKey";
import {
  TEXT_MODELS,
  discoverAvailableFlashModels,
  discoverAvailableTtsModels,
} from "./ai-service";

export const ANSWER_MODELS_PRIORITY = TEXT_MODELS;

export const TTS_MODELS_PRIORITY = [
  "gemini-1.5-flash-lite-tts",
  "gemini-1.5-flash-tts",
  "gemini-2.0-flash-exp-tts",
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

let activeCachedAnswerModel = TEXT_MODELS[0];
let activeCachedTTSModel = "gemini-1.5-flash-lite-tts";

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
    return "Cannot reach Gemini. Check your internet and your Gemini key.";
  }

  if (
    errStr.includes("add your gemini key") ||
    errStr.includes("missing key") ||
    errStr.includes("connections")
  ) {
    return "Add your Gemini key in Settings > Connections.";
  }

  if (errStr.includes("cannot reach gemini")) {
    return String(rawError?.message || rawError);
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

  return "Add your Gemini key in Settings > Connections.";
};

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
  } = payload;

  const userKey = String(rawApiKey || getGeminiKey() || localStorage.getItem("gemini_api_key") || "")
    .replace(/[\r\n\t\s"']+/g, "")
    .trim();

  const strictSystemInstruction =
    (systemInstruction || "") +
    "\n\nIMPORTANT CONSTRAINTS: Reply in 1 to 2 short sentences. Never use lists or markdown in voice. Only give a longer answer if I ask for details.";

  const safeContents = (contents || []).map((c: any) => ({
    role: c.role,
    text: c.parts?.[0]?.text || c.text || c.content || "",
  }));
  const history = prepareHistory(safeContents, strictSystemInstruction);

  if (history.length === 0) {
    return { text: "দুঃখিত, আপনার কথা বুঝতে পারিনি। আবার বলুন।", modelUsed: "none", engine: "none" };
  }

  const triedModels = new Set<string>();
  const allCandidates = [...ANSWER_MODELS_PRIORITY];

  const tryAnswerModel = async (modelCandidate: string): Promise<AnswerResult | null> => {
    if (isModelExhausted(modelCandidate)) return null;
    triedModels.add(modelCandidate);
    const answerStartTime = Date.now();
    const cleanModel = modelCandidate.replace(/^models\//, "").trim();
    const url = `/api/gemini/generate`;

    const body: any = {
      model: cleanModel,
      contents: history,
      generationConfig: {
        maxOutputTokens: 150,
      },
      apiKey: userKey || undefined,
    };
    if (strictSystemInstruction.trim()) {
      body.systemInstruction = strictSystemInstruction.trim();
    }

    const res = await fetchWithTimeoutAndRetry(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      7000
    );

    const rawText = await res.text().catch(() => "");
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      throw new Error(`Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`);
    }
    if (!data || typeof data !== "object") {
      throw new Error(`Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`);
    }

    if (res.status === 429) {
      markModelExhausted(modelCandidate);
      return null;
    }

    if (!res.ok) {
      const msg = data?.error?.message
        ? `${data.error.message} (HTTP ${res.status})`
        : `Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`;
      throw new Error(msg);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      incrementAnswerCalls();
      activeCachedAnswerModel = cleanModel;
      localStorage.setItem("cached_answer_model", cleanModel);
      return {
        text,
        modelUsed: cleanModel,
        engine: "gemini",
        sttMs: 0,
        answerMs: Date.now() - answerStartTime,
      };
    }
    return null;
  };

  let lastErrorMsg = "";
  for (const modelCandidate of allCandidates) {
    try {
      const ans = await tryAnswerModel(modelCandidate);
      if (ans) return ans;
    } catch (err: any) {
      lastErrorMsg = err?.message || String(err);
    }
  }

  const discovered = await discoverAvailableFlashModels(userKey, triedModels);
  for (const dm of discovered) {
    try {
      const ans = await tryAnswerModel(dm);
      if (ans) return ans;
    } catch (err: any) {
      lastErrorMsg = err?.message || String(err);
    }
  }

  return {
    text: lastErrorMsg || "Cannot reach Gemini. Check your internet and your Gemini key.",
    modelUsed: "none",
    engine: "none",
  };
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

export async function generateVoiceTTS(payload: {
  text: string;
  voiceName: string;
  apiKey: string;
  personality?: string;
  ttsStylePrefix?: string;
}): Promise<TTSResult> {
  const { text, voiceName, apiKey: rawApiKey, personality, ttsStylePrefix } = payload;
  const userKey = String(rawApiKey || getGeminiKey() || localStorage.getItem("gemini_api_key") || "")
    .replace(/[\r\n\t\s"']+/g, "")
    .trim();


  const ttsStartTime = Date.now();
  const prefix = ttsStylePrefix || (personality ? PERSONALITY_TTS_PROMPT_PREFIX[personality] : "");
  const formattedText = prefix ? `${prefix}${text}` : text;

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

  const candidateTTSModels = TTS_MODELS_PRIORITY.filter((m) => !isModelExhausted(m));
  const triedTts = new Set<string>();

  const tryTtsModel = async (ttsModelCandidate: string): Promise<TTSResult | null> => {
    triedTts.add(ttsModelCandidate);
    const cleanModel = ttsModelCandidate.replace(/^models\//, "").trim();
    const url = `/api/gemini/tts`;

    const res = await fetchWithTimeoutAndRetry(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: cleanModel,
          text: String(text || "").trim(),
          voiceName: voiceName || "Sulafat",
          apiKey: userKey || undefined,
        }),
      },
      10000
    );

    const rawText = await res.text().catch(() => "");
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      return null;
    }

    if (!res.ok) {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      if (
        res.status === 429 ||
        errMsg.toLowerCase().includes("quota") ||
        errMsg.toLowerCase().includes("limit") ||
        errMsg.toLowerCase().includes("resource_exhausted")
      ) {
        logVoiceEvent(
          "TTS Step",
          `TTS candidate ${cleanModel} quota exhausted (429). Marking as exhausted...`,
          "warn"
        );
        markModelExhausted(cleanModel);
      }
      return null;
    }

    const ttsMs = Date.now() - ttsStartTime;
    const rawAudio = data?.audio || data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;

    if (rawAudio) {
      let processedB64 = rawAudio;
      try {
        const binary = atob(rawAudio);
        if (binary.length > 44 && binary.slice(0, 4) === "RIFF") {
          const bytes = new Uint8Array(binary.length - 44);
          for (let i = 44; i < binary.length; i++) bytes[i - 44] = binary.charCodeAt(i);
          let binaryString = "";
          for (let i = 0; i < bytes.length; i++) binaryString += String.fromCharCode(bytes[i]);
          processedB64 = btoa(binaryString);
        }
      } catch (e) {}

      incrementTTSCalls();
      activeCachedTTSModel = cleanModel;
      localStorage.setItem("cached_tts_model", cleanModel);

      await saveCachedAudio(formattedText, voiceName, processedB64);
      logVoiceEvent("TTS Active", `Generated TTS in ${ttsMs}ms using ${cleanModel}`, "success");
      return {
        audioBase64: processedB64,
        modelUsed: cleanModel,
        useBrowserSynth: false,
        ttsMs,
      };
    }
    return null;
  };

  for (const ttsModelCandidate of candidateTTSModels) {
    try {
      const res = await tryTtsModel(ttsModelCandidate);
      if (res) return res;
    } catch (e: any) {
      logVoiceEvent("TTS Step", `TTS candidate ${ttsModelCandidate} failed: ${e?.message || String(e)}`, "warn");
    }
  }

  const discoveredTts = await discoverAvailableTtsModels(userKey);
  for (const dm of discoveredTts) {
    if (triedTts.has(dm)) continue;
    try {
      const res = await tryTtsModel(dm);
      if (res) return res;
    } catch {}
  }

  const ttsMs = Date.now() - ttsStartTime;
  return {
    audioBase64: "",
    modelUsed: "none",
    useBrowserSynth: false,
    ttsMs,
  };
}
