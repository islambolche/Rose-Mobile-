export interface VoiceLogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warn" | "error";
  step: string;
  message: string;
  details?: string;
}

const LOG_STORAGE_KEY = "rose_voice_debug_logs";

export const getVoiceLogs = (): VoiceLogEntry[] => {
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

export const logVoiceEvent = (
  step: string,
  message: string,
  level: "info" | "success" | "warn" | "error" = "info",
  details?: string
) => {
  const newEntry: VoiceLogEntry = {
    id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    level,
    step,
    message,
    details,
  };

  const current = getVoiceLogs();
  const next = [newEntry, ...current].slice(0, 100);
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(next));
  } catch (e) {}
  
  // Also log to console
  console.log(`[VoiceEngine::${step}] [${level.toUpperCase()}] ${message}`, details || '');
};

let currentVADState = "IDLE";
let currentVADVolume = 0;
let currentVADThreshold = 0.02;

export const setVADMetrics = (state: string, volume: number, threshold: number) => {
  currentVADState = state;
  currentVADVolume = volume;
  currentVADThreshold = threshold;
  try {
    localStorage.setItem("rose_vad_metrics", JSON.stringify({ state, volume, threshold }));
  } catch (e) {}
};

export const getVADMetrics = () => {
  try {
    const raw = localStorage.getItem("rose_vad_metrics");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        state: parsed.state || currentVADState,
        volume: typeof parsed.volume === "number" ? parsed.volume : currentVADVolume,
        threshold: typeof parsed.threshold === "number" ? parsed.threshold : currentVADThreshold,
      };
    }
  } catch (e) {}
  return { state: currentVADState, volume: currentVADVolume, threshold: currentVADThreshold };
};

export const clearVoiceLogs = () => {
  try {
    localStorage.removeItem(LOG_STORAGE_KEY);
    localStorage.removeItem("rose_vad_metrics");
  } catch (e) {}
};
