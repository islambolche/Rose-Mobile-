/**
 * Shared Model Discovery & Diagnostics for static Vercel deployment
 * Connects directly to Google Gemini REST endpoint with header x-goog-api-key
 */

export interface DiscoveredModels {
  liveModels: string[];
  chatModels: string[];
  ttsModels: string[];
  timestamp: number;
  keySignature: string;
}

const CACHE_KEY = 'rose_discovered_gemini_models_v3';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours cache

export function computeKeySignature(key: string): string {
  const clean = String(key || '').trim();
  if (!clean) return 'no-key';
  return `${clean.slice(0, 6)}_${clean.slice(-4)}_${clean.length}`;
}

export function parseVersionScore(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes('latest')) return 999999;
  const match = lower.match(/-(\d+)(?:\.(\d+))?/);
  if (!match) return 0;
  const major = parseInt(match[1], 10) || 0;
  const minor = parseInt(match[2] || '0', 10) || 0;
  return major * 1000 + minor * 100;
}

function getLiveModelScore(name: string): number {
  const l = name.toLowerCase();
  let score = 0;
  if (l.includes('native-audio')) score += 100000;
  else if (l.includes('live')) score += 50000;
  score += parseVersionScore(l);
  return score;
}

function getChatModelScore(name: string): number {
  const l = name.toLowerCase();
  if (l === 'gemini-flash-latest') return 2000000;
  let score = 0;
  const isLite = l.includes('lite');
  if (!isLite) score += 500000; // Prefer standard flash over flash-lite
  score += parseVersionScore(l);
  if (l === 'gemini-flash-lite-latest') score += 100000;
  return score;
}

export const FALLBACK_DISCOVERED_MODELS: DiscoveredModels = {
  liveModels: [
    'gemini-2.5-flash-native-audio-preview-12-2025',
    'gemini-2.5-flash',
    'gemini-2.0-flash-exp',
  ],
  chatModels: [
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-lite-latest',
  ],
  ttsModels: [
    'gemini-2.5-flash-preview-tts',
    'gemini-2.5-pro-preview-tts',
  ],
  timestamp: Date.now(),
  keySignature: '',
};

let inMemoryCache: DiscoveredModels | null = null;

export function sanitizeSavedModelOverrides(discovered: DiscoveredModels): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    // 1. Check chat_model_override
    const chatOverride = localStorage.getItem('chat_model_override');
    if (chatOverride && !discovered.chatModels.includes(chatOverride.replace(/^models\//, '').trim())) {
      localStorage.removeItem('chat_model_override');
    }

    // 2. Check chat_model
    const chatModel = localStorage.getItem('chat_model');
    if (chatModel && !discovered.chatModels.includes(chatModel.replace(/^models\//, '').trim())) {
      if (discovered.chatModels.length > 0) {
        localStorage.setItem('chat_model', discovered.chatModels[0]);
      } else {
        localStorage.removeItem('chat_model');
      }
    }

    // 3. Check active_model_gemini
    const activeModel = localStorage.getItem('active_model_gemini');
    if (activeModel && !discovered.chatModels.includes(activeModel.replace(/^models\//, '').trim())) {
      if (discovered.chatModels.length > 0) {
        localStorage.setItem('active_model_gemini', discovered.chatModels[0]);
      } else {
        localStorage.removeItem('active_model_gemini');
      }
    }

    // 4. Check working_gemini_text_model
    const workingModel = localStorage.getItem('working_gemini_text_model');
    if (workingModel && !discovered.chatModels.includes(workingModel.replace(/^models\//, '').trim())) {
      localStorage.removeItem('working_gemini_text_model');
      localStorage.removeItem('working_gemini_text_model_ms');
    }

    // 5. Check rose_resolved_live_model
    const resolvedLive = localStorage.getItem('rose_resolved_live_model');
    if (resolvedLive && !discovered.liveModels.includes(resolvedLive.replace(/^models\//, '').trim())) {
      if (discovered.liveModels.length > 0) {
        localStorage.setItem('rose_resolved_live_model', discovered.liveModels[0]);
      } else {
        localStorage.removeItem('rose_resolved_live_model');
      }
    }

    // 6. Check iyabd_settings.liveVoiceModel
    const rawSettings = localStorage.getItem('iyabd_settings');
    if (rawSettings) {
      try {
        const parsed = JSON.parse(rawSettings);
        if (parsed?.liveVoiceModel) {
          const clean = String(parsed.liveVoiceModel).replace(/^models\//, '').trim();
          if (!discovered.liveModels.includes(clean)) {
            parsed.liveVoiceModel = discovered.liveModels[0] || 'gemini-2.5-flash-native-audio-preview-12-2025';
            localStorage.setItem('iyabd_settings', JSON.stringify(parsed));
          }
        }
      } catch {}
    }
  } catch (e) {
    console.warn('[ModelDiscovery] Error sanitizing overrides:', e);
  }
}

export function readCachedModels(apiKey: string): DiscoveredModels | null {
  const currentSig = computeKeySignature(apiKey);
  const now = Date.now();

  if (
    inMemoryCache &&
    inMemoryCache.keySignature === currentSig &&
    now - inMemoryCache.timestamp < CACHE_TTL_MS &&
    inMemoryCache.liveModels.length > 0 &&
    inMemoryCache.chatModels.length > 0
  ) {
    return inMemoryCache;
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed: DiscoveredModels = JSON.parse(raw);
        if (
          parsed &&
          parsed.keySignature === currentSig &&
          typeof parsed.timestamp === 'number' &&
          now - parsed.timestamp < CACHE_TTL_MS &&
          Array.isArray(parsed.liveModels) &&
          parsed.liveModels.length > 0 &&
          Array.isArray(parsed.chatModels) &&
          parsed.chatModels.length > 0
        ) {
          inMemoryCache = parsed;
          return parsed;
        }
      }
    }
  } catch {}

  return null;
}

export async function discoverModels(apiKey: string, forceRefresh = false): Promise<DiscoveredModels> {
  const cleanKey = String(apiKey || '').replace(/[\r\n\t\s"']+/g, '').trim();
  if (!cleanKey) {
    return FALLBACK_DISCOVERED_MODELS;
  }

  const currentSig = computeKeySignature(cleanKey);

  if (!forceRefresh) {
    const cached = readCachedModels(cleanKey);
    if (cached) {
      sanitizeSavedModelOverrides(cached);
      return cached;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const modelsUrl = cleanKey ? `/api/gemini/models?pageSize=200&apiKey=${encodeURIComponent(cleanKey)}` : '/api/gemini/models?pageSize=200';
    const res = await fetch(modelsUrl, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errStatus = res.status;
      const rawText = await res.text().catch(() => '');
      recordDiagnosticError(errStatus, 'models.list', rawText.slice(0, 100));
      const fallback = inMemoryCache || FALLBACK_DISCOVERED_MODELS;
      return fallback;
    }

    const data = await res.json().catch(() => null);
    const list: any[] = Array.isArray(data?.models) ? data.models : [];

    const liveModels: string[] = [];
    const chatModels: string[] = [];
    const ttsModels: string[] = [];

    for (const item of list) {
      const rawName = String(item?.name || '').replace(/^models\//, '').trim();
      if (!rawName) continue;
      const lower = rawName.toLowerCase();
      const methods: string[] = Array.isArray(item?.supportedGenerationMethods)
        ? item.supportedGenerationMethods
        : Array.isArray(item?.supportedActions)
          ? item.supportedActions
          : [];

      // 1. LIVE models: supportedGenerationMethods include "bidiGenerateContent"
      if (methods.includes('bidiGenerateContent')) {
        if (!liveModels.includes(rawName)) {
          liveModels.push(rawName);
        }
      }

      // 2. CHAT models: "generateContent", contains "flash", NOT tts/live/audio/image/embedding/vision
      if (
        methods.includes('generateContent') &&
        lower.includes('flash') &&
        !lower.includes('tts') &&
        !lower.includes('live') &&
        !lower.includes('audio') &&
        !lower.includes('image') &&
        !lower.includes('embedding') &&
        !lower.includes('vision')
      ) {
        if (!chatModels.includes(rawName)) {
          chatModels.push(rawName);
        }
      }

      // 3. TTS models: name contains "tts"
      if (lower.includes('tts')) {
        if (!ttsModels.includes(rawName)) {
          ttsModels.push(rawName);
        }
      }
    }

    // Sort LIVE models: prefer "native-audio", then "live", newest first
    liveModels.sort((a, b) => getLiveModelScore(b) - getLiveModelScore(a));

    // Sort CHAT models: prefer "gemini-flash-latest", then newest flash, then flash-lite
    chatModels.sort((a, b) => getChatModelScore(b) - getChatModelScore(a));

    // Sort TTS models: newest first
    ttsModels.sort((a, b) => parseVersionScore(b) - parseVersionScore(a));

    const finalResult: DiscoveredModels = {
      liveModels: liveModels.length > 0 ? liveModels : FALLBACK_DISCOVERED_MODELS.liveModels,
      chatModels: chatModels.length > 0 ? chatModels : FALLBACK_DISCOVERED_MODELS.chatModels,
      ttsModels: ttsModels.length > 0 ? ttsModels : FALLBACK_DISCOVERED_MODELS.ttsModels,
      timestamp: Date.now(),
      keySignature: currentSig,
    };

    inMemoryCache = finalResult;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(finalResult));
        // Keep backwards compatible keys updated
        localStorage.setItem('rose_voice_models_cache_v2', JSON.stringify({
          liveModels: finalResult.liveModels,
          flashModels: finalResult.chatModels,
          ttsModels: finalResult.ttsModels,
          keyPrefix: cleanKey.slice(0, 8),
          timestamp: Date.now(),
        }));
        localStorage.setItem('gemini_cached_chat_models', JSON.stringify({
          models: finalResult.chatModels,
          timestamp: Date.now(),
        }));
      }
    } catch {}

    sanitizeSavedModelOverrides(finalResult);
    return finalResult;
  } catch (err: any) {
    clearTimeout(timer);
    console.warn('[ModelDiscovery] Request error:', err);
    return inMemoryCache || FALLBACK_DISCOVERED_MODELS;
  }
}

export function removeUnsupportedModel(modelName: string): void {
  const clean = String(modelName || '').replace(/^models\//, '').trim();
  if (!clean) return;

  if (inMemoryCache) {
    inMemoryCache.liveModels = inMemoryCache.liveModels.filter((m) => m !== clean);
    inMemoryCache.chatModels = inMemoryCache.chatModels.filter((m) => m !== clean);
    inMemoryCache.ttsModels = inMemoryCache.ttsModels.filter((m) => m !== clean);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(inMemoryCache));
      }
    } catch {}
  }
}

export function resetCachedModelNames(): void {
  inMemoryCache = null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem('rose_voice_models_cache_v2');
      localStorage.removeItem('gemini_cached_chat_models');
      localStorage.removeItem('gemini_cached_live_models');
      localStorage.removeItem('rose_tts_models_cache_v2');
      localStorage.removeItem('cached_answer_model');
      localStorage.removeItem('cached_tts_model');
      localStorage.removeItem('chat_model_override');
      localStorage.removeItem('chat_model');
      localStorage.removeItem('active_model_gemini');
      localStorage.removeItem('working_gemini_text_model');
      localStorage.removeItem('working_gemini_text_model_ms');
      localStorage.removeItem('rose_resolved_live_model');

      const rawSettings = localStorage.getItem('iyabd_settings');
      if (rawSettings) {
        try {
          const parsed = JSON.parse(rawSettings);
          delete parsed.liveVoiceModel;
          delete parsed.chatModel;
          localStorage.setItem('iyabd_settings', JSON.stringify(parsed));
        } catch {}
      }
    }
  } catch {}
}

// Diagnostics state tracking for VOICE CHECK
export interface DiagnosticsState {
  keyStatus: string;
  liveModelUsed: string;
  chatModelUsed: string;
  lastError: string | null;
}

const DIAGNOSTICS_STORAGE_KEY = 'rose_diagnostics_state_v1';

let currentDiagnostics: DiagnosticsState = {
  keyStatus: 'Checking...',
  liveModelUsed: '',
  chatModelUsed: '',
  lastError: null,
};

export function getDiagnosticsState(): DiagnosticsState {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(DIAGNOSTICS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          currentDiagnostics = { ...currentDiagnostics, ...parsed };
        }
      }
    }
  } catch {}
  return currentDiagnostics;
}

export function saveDiagnosticsState(partial: Partial<DiagnosticsState>): void {
  currentDiagnostics = { ...currentDiagnostics, ...partial };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(DIAGNOSTICS_STORAGE_KEY, JSON.stringify(currentDiagnostics));
      window.dispatchEvent(new CustomEvent('rose_diagnostics_updated', { detail: currentDiagnostics }));
    }
  } catch {}
}

export function recordLiveModelUsed(model: string): void {
  const clean = String(model || '').replace(/^models\//, '').trim();
  if (clean) {
    saveDiagnosticsState({ liveModelUsed: clean });
  }
}

export function recordChatModelUsed(model: string): void {
  const clean = String(model || '').replace(/^models\//, '').trim();
  if (clean) {
    saveDiagnosticsState({ chatModelUsed: clean });
  }
}

export function recordKeyStatus(status: string): void {
  saveDiagnosticsState({ keyStatus: status });
}

export function recordDiagnosticError(status: number | string, model: string, message: string): void {
  const cleanModel = String(model || '').replace(/^models\//, '').trim() || 'unknown-model';
  const cleanMsg = String(message || '').slice(0, 140);
  const errStr = `HTTP ${status} on ${cleanModel}: ${cleanMsg}`;
  saveDiagnosticsState({ lastError: errStr });
}
