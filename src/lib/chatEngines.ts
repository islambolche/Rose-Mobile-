import { getGeminiKey, setGeminiKey } from './geminiKey';
import {
  directGeminiGenerate,
  TEXT_MODELS,
  getSavedWorkingTextModel,
  cleanAssistantReplyText,
  extractNonThoughtTextFromParts,
  ensureNoThoughtSystemInstruction,
} from './ai-service';
import { storage } from './storage';

export type ChatEngineId = 'gemini' | 'groq' | 'openrouter' | 'cerebras' | 'mistral';
export type KeyStatus = 'READY' | 'INVALID' | 'NOT SET';

export interface ChatProviderConfig {
  id: ChatEngineId;
  name: string;
  displayName?: string;
  badgeLabel: string;
  tier: 'free' | 'paid';
  baseURL: string;
  defaultModel: string;
  storageKey: string;
  statusStorageKey: string;
  getKeyUrl: string;
  placeholder: string;
}

export const FREE_CHAT_PROVIDERS: ChatProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Gemini',
    badgeLabel: 'চ্যাট ও ভয়েস',
    tier: 'free',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: '',
    storageKey: 'gemini_api_key',
    statusStorageKey: 'connection_status_gemini',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIza...',
  },
  {
    id: 'groq',
    name: 'Groq',
    badgeLabel: 'চ্যাট',
    tier: 'free',
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: '',
    storageKey: 'groq_api_keys',
    statusStorageKey: 'connection_status_groq',
    getKeyUrl: 'https://console.groq.com/keys',
    placeholder: 'gsk_...',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    badgeLabel: 'চ্যাট',
    tier: 'free',
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: '',
    storageKey: 'openrouter_api_key',
    statusStorageKey: 'connection_status_openrouter',
    getKeyUrl: 'https://openrouter.ai/keys',
    placeholder: 'sk-or-v1-...',
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    badgeLabel: 'চ্যাট',
    tier: 'free',
    baseURL: 'https://api.cerebras.ai/v1',
    defaultModel: '',
    storageKey: 'cerebras_api_key',
    statusStorageKey: 'connection_status_cerebras',
    getKeyUrl: 'https://cloud.cerebras.ai',
    placeholder: 'csk-...',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    badgeLabel: 'চ্যাট',
    tier: 'free',
    baseURL: 'https://api.mistral.ai/v1',
    defaultModel: '',
    storageKey: 'mistral_api_key',
    statusStorageKey: 'connection_status_mistral',
    getKeyUrl: 'https://console.mistral.ai',
    placeholder: '...',
  },
];

import { backupKeyToIndexedDB, getKeyFromIndexedDB } from './keyBackup';

export const readLocalKey = (key: string): string => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = (localStorage.getItem(key) || '').trim();
      if (val) return val;
    }
  } catch {}

  // Async restore check from IndexedDB
  getKeyFromIndexedDB(key).then((idbVal) => {
    if (idbVal && idbVal.trim()) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(key, idbVal.trim());
        }
      } catch (e) {}
    }
  }).catch(() => {});

  return '';
};

export const writeLocalKey = (key: string, value: string) => {
  try {
    const clean = String(value || '').trim();
    if (typeof window !== 'undefined' && window.localStorage) {
      if (clean) {
        localStorage.setItem(key, clean);
      }
    }
    if (clean) {
      backupKeyToIndexedDB(key, clean).catch(() => {});
    }
  } catch {}
};

export const getSelectedChatEngine = (): ChatEngineId => {
  const saved = readLocalKey('selected_chat_engine') as ChatEngineId;
  if (saved && ['gemini', 'groq', 'openrouter', 'cerebras', 'mistral'].includes(saved)) {
    return saved;
  }
  return 'gemini';
};

export const setSelectedChatEngine = (engine: ChatEngineId) => {
  writeLocalKey('selected_chat_engine', engine);
  try {
    storage.set('selected_chat_engine', engine);
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('chat_engine_changed', { detail: engine }));
  }
};

export const getProviderKey = (id: ChatEngineId): string => {
  if (id === 'gemini') {
    return (getGeminiKey() || readLocalKey('gemini_api_key')).trim();
  }
  const config = FREE_CHAT_PROVIDERS.find((p) => p.id === id);
  if (!config) return '';
  return (readLocalKey(config.storageKey) || readLocalKey(`${id}_api_key`) || readLocalKey(`${id}_api_keys`)).trim();
};

export const getEffectiveChatEngineKey = getProviderKey;

export const setProviderKey = async (id: ChatEngineId, rawKey: string): Promise<void> => {
  const clean = String(rawKey || '').trim();
  if (id === 'gemini') {
    await setGeminiKey(clean);
    writeLocalKey('gemini_api_key', clean);
    return;
  }
  const config = FREE_CHAT_PROVIDERS.find((p) => p.id === id);
  if (!config) return;
  writeLocalKey(config.storageKey, clean);
  try {
    await storage.set(config.storageKey, clean);
  } catch {}
};

export const getProviderStatus = (id: ChatEngineId): KeyStatus => {
  const config = FREE_CHAT_PROVIDERS.find((p) => p.id === id);
  if (!config) return 'NOT SET';
  const key = getProviderKey(id);
  if (!key) return 'NOT SET';
  const saved = readLocalKey(config.statusStorageKey);
  if (saved === 'READY' || saved === 'INVALID') return saved;
  return 'READY';
};

export const setProviderStatus = async (id: ChatEngineId, status: KeyStatus): Promise<void> => {
  const config = FREE_CHAT_PROVIDERS.find((p) => p.id === id);
  if (!config) return;
  writeLocalKey(config.statusStorageKey, status);
  try {
    await storage.set(config.statusStorageKey, status);
  } catch {}
};

/**
 * Chat Model Override support
 */
export const getChatModelOverride = (): string => {
  return readLocalKey('chat_model_override');
};

export const setChatModelOverride = (model: string) => {
  writeLocalKey('chat_model_override', model.trim());
};

export const getCurrentlyActiveChatModel = (engineId?: ChatEngineId): string => {
  const override = getChatModelOverride();
  if (override) return override;
  const engine = engineId || getSelectedChatEngine();
  const saved = readLocalKey(`active_model_${engine}`);
  if (saved) return saved;
  return engine === 'groq' ? 'Auto (Groq)' : 'Auto (Gemini)';
};

export const getDynamicGroqChatModels = async (
  apiKey: string,
  forceFresh = false
): Promise<{ models: string[]; error?: string; errorReason?: string; source?: string }> => {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return { models: [], error: 'Groq key দেওয়া নেই' };

  const cacheKey = 'groq_cached_chat_models';
  if (!forceFresh) {
    try {
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (Array.isArray(cached?.models) && cached.models.length > 0 && Date.now() - cached.timestamp < 3600000) {
          return { models: cached.models, source: 'cache' };
        }
      }
    } catch (e) {}
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      let errMsg = `HTTP ${res.status}`;
      try {
        const j = JSON.parse(raw);
        if (j?.error?.message) errMsg = j.error.message;
      } catch (e) {}
      return { models: [], error: `Groq ত্রুটি (${res.status}): ${errMsg}`, errorReason: errMsg };
    }

    const data = await res.json();
    const list: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

    // Filter: exclude whisper, tts, guard, playai
    const excluded = ['whisper', 'tts', 'guard', 'playai'];
    const filtered = list.filter((m: any) => {
      const id = String(m?.id || '').toLowerCase();
      if (!id) return false;
      return !excluded.some((ex) => id.includes(ex));
    });

    const scoreGroq = (id: string): number => {
      const lower = id.toLowerCase();
      let score = 0;
      if (lower.includes('70b')) score += 1000;
      if (lower.includes('versatile')) score += 500;
      if (lower.includes('llama')) score += 100;
      if (lower.includes('qwen')) score += 80;
      if (lower.includes('mixtral')) score += 70;
      if (lower.includes('gemma')) score += 60;
      return score;
    };

    filtered.sort((a, b) => scoreGroq(b.id) - scoreGroq(a.id));
    const modelIds = filtered.map((m) => String(m.id).trim()).filter(Boolean);

    if (modelIds.length > 0) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ models: modelIds, timestamp: Date.now() }));
      } catch (e) {}
      return { models: modelIds, source: 'network' };
    }

    return { models: [], error: 'কোনো উপযুক্ত Groq চ্যাট মডেল পাওয়া যায়নি', errorReason: 'No chat models found' };
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError';
    const text = isAbort ? 'সময় শেষ (Timeout)' : `নেটওয়ার্ক সমস্যা: ${err.message}`;
    return { models: [], error: text, errorReason: text };
  }
};

/**
 * Dynamic Gemini Chat Model Discovery (Cached for 1 hour)
 * Handles pagination with pageSize=200 and loops through nextPageToken
 * Filters for supportedGenerationMethods: "generateContent"
 * Excludes live, audio, tts, image, embedding, aqa, imagen, veo
 * Sorts Flash models by version (3.x > 2.x) then by model name
 */
export const getDynamicGeminiChatModels = async (
  apiKey: string,
  forceFresh = false
): Promise<{ models: string[]; error?: string; errorReason?: string; source?: string }> => {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return { models: [], error: 'Gemini key দেওয়া নেই' };

  const cacheKey = 'gemini_cached_chat_models';
  if (!forceFresh) {
    try {
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (Array.isArray(cached?.models) && cached.models.length > 0 && Date.now() - cached.timestamp < 3600000) {
          return { models: cached.models, source: 'cache' };
        }
      }
    } catch (e) {}
  }

  let allModels: any[] = [];
  let nextToken = '';
  let attemptCount = 0;

  try {
    do {
      attemptCount++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let url = `/api/gemini/models?apiKey=${encodeURIComponent(cleanKey)}`;

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        let errMsg = `HTTP ${res.status}`;
        try {
          const j = JSON.parse(raw);
          if (j?.error?.message) errMsg = j.error.message;
        } catch (e) {}
        return { models: [], error: `Gemini ত্রুটি (${res.status}): ${errMsg}`, errorReason: errMsg };
      }

      const data = await res.json();
      if (Array.isArray(data.models)) {
        allModels = [...allModels, ...data.models];
      }
      nextToken = data.nextPageToken || '';
      // Safety break to prevent infinite loops
      if (attemptCount > 10) break;
    } while (nextToken);

    const excluded = ['live', 'audio', 'tts', 'image', 'embedding', 'aqa', 'imagen', 'veo'];
    const filtered = allModels.filter((m: any) => {
      const name = String(m?.name || '').replace(/^models\//, '').toLowerCase();
      const methods: string[] = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
      if (!methods.includes('generateContent')) return false;
      if (excluded.some((ex) => name.includes(ex))) return false;
      return true;
    });

    const parseVersion = (name: string): { major: number; minor: number } => {
      const match = name.toLowerCase().match(/gemini-(\d+)(?:\.(\d+))?/);
      if (match) {
        return {
          major: parseInt(match[1], 10),
          minor: parseInt(match[2] || '0', 10),
        };
      }
      return { major: 0, minor: 0 };
    };

    const scoreGemini = (name: string): number => {
      const lower = name.toLowerCase();
      let score = 0;
      const { major, minor } = parseVersion(lower);
      score += major * 1000 + minor * 100;

      if (lower.includes('flash')) score += 500;
      if (lower.includes('pro')) score += 400;
      if (lower.includes('12b')) score += 50;
      if (lower.includes('8b')) score += 30;
      if (lower.includes('exp')) score -= 20;
      if (lower.includes('preview')) score -= 10;
      return score;
    };

    filtered.sort((a, b) => {
      const scoreA = scoreGemini(a.name);
      const scoreB = scoreGemini(b.name);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return String(b.name).localeCompare(String(a.name));
    });

    const modelNames = filtered.map((m) => String(m.name).replace(/^models\//, '').trim()).filter(Boolean);

    if (modelNames.length > 0) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ models: modelNames, timestamp: Date.now() }));
      } catch (e) {}
      return { models: modelNames, source: 'network' };
    }

    return { models: [], error: 'কোনো উপযুক্ত Gemini চ্যাট মডেল পাওয়া যায়নি', errorReason: 'No chat models found' };
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError';
    const text = isAbort ? 'সময় শেষ (Timeout)' : `নেটওয়ার্ক সমস্যা: ${err.message}`;
    return { models: [], error: text, errorReason: text };
  }
};

/**
 * Dynamic Gemini Live Model Discovery (Cached for 1 hour)
 * Filters for supportedGenerationMethods: "bidiGenerateContent"
 * Prioritizes "native-audio", then "live", highest version first.
 */
export const getDynamicGeminiLiveModels = async (
  apiKey: string,
  forceFresh = false
): Promise<{ models: string[]; error?: string; errorReason?: string; source?: string }> => {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return { models: [], error: 'Gemini key দেওয়া নেই' };

  const cacheKey = 'gemini_cached_live_models';
  if (!forceFresh) {
    try {
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (Array.isArray(cached?.models) && cached.models.length > 0 && Date.now() - cached.timestamp < 3600000) {
          return { models: cached.models, source: 'cache' };
        }
      }
    } catch (e) {}
  }

  let allModels: any[] = [];
  let nextToken = '';
  let attemptCount = 0;

  try {
    do {
      attemptCount++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      let url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}&pageSize=200`;
      if (nextToken) url += `&pageToken=${encodeURIComponent(nextToken)}`;

      const res = await fetch(url, {
        headers: { 'x-goog-api-key': cleanKey },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        let errMsg = `HTTP ${res.status}`;
        try {
          const j = JSON.parse(raw);
          if (j?.error?.message) errMsg = j.error.message;
        } catch (e) {}
        return { models: [], error: `Gemini Live ত্রুটি (${res.status}): ${errMsg}`, errorReason: errMsg };
      }

      const data = await res.json();
      if (Array.isArray(data.models)) {
        allModels = [...allModels, ...data.models];
      }
      nextToken = data.nextPageToken || '';
      if (attemptCount > 10) break;
    } while (nextToken);

    const filtered = allModels.filter((m: any) => {
      const methods: string[] = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
      return methods.includes('bidiGenerateContent');
    });

    const parseVersion = (name: string): { major: number; minor: number } => {
      const match = name.toLowerCase().match(/gemini-(\d+)(?:\.(\d+))?/);
      if (match) {
        return {
          major: parseInt(match[1], 10),
          minor: parseInt(match[2] || '0', 10),
        };
      }
      return { major: 0, minor: 0 };
    };

    const scoreGeminiLive = (name: string): number => {
      const lower = name.toLowerCase();
      let score = 0;
      const { major, minor } = parseVersion(lower);
      score += major * 1000 + minor * 100;

      if (lower.includes('native-audio')) score += 500;
      else if (lower.includes('live')) score += 400;
      
      if (lower.includes('exp')) score -= 20;
      if (lower.includes('preview')) score -= 10;
      return score;
    };

    filtered.sort((a, b) => {
      const scoreA = scoreGeminiLive(a.name);
      const scoreB = scoreGeminiLive(b.name);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return String(b.name).localeCompare(String(a.name));
    });

    const modelNames = filtered.map((m) => String(m.name).replace(/^models\//, '').trim()).filter(Boolean);

    if (modelNames.length > 0) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ models: modelNames, timestamp: Date.now() }));
      } catch (e) {}
      return { models: modelNames, source: 'network' };
    }

    return { models: [], error: 'কোনো উপযুক্ত Gemini Live মডেল পাওয়া যায়নি', errorReason: 'No live models found' };
  } catch (err: any) {
    const isAbort = err?.name === 'AbortError';
    const text = isAbort ? 'সময় শেষ (Timeout)' : `নেটওয়ার্ক সমস্যা: ${err.message}`;
    return { models: [], error: text, errorReason: text };
  }
};

/**
 * Direct Gemini Chat Completion caller using Generative Language REST API.
 */
export const callGeminiDirectChat = async (params: {
  apiKey: string;
  model: string;
  systemPrompt?: string;
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
  maxTokens?: number;
}): Promise<string> => {
  const { apiKey, model, systemPrompt, messages, maxTokens = 1024 } = params;
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Gemini key নেই। Settings → Connections-এ key দিন।');
  }

  const cleanModel = model.replace(/^models\//, '').trim();

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));

  const finalSystemPrompt = ensureNoThoughtSystemInstruction(systemPrompt);

  const buildChatBody = (includeThinkingBudget: boolean, includeThinkingConfig: boolean) => {
    const genConfig: any = {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    };
    if (includeThinkingConfig) {
      genConfig.thinkingConfig = includeThinkingBudget
        ? { includeThoughts: false, thinkingBudget: 0 }
        : { includeThoughts: false };
    }
    const b: any = {
      contents,
      generationConfig: genConfig,
    };
    if (finalSystemPrompt) {
      b.systemInstruction = {
        parts: [{ text: finalSystemPrompt }],
      };
    }
    return b;
  };

  const url = '/api/gemini/generate';

  try {
    const bodyObj = buildChatBody(true, true);
    let res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cleanModel,
        contents: bodyObj.contents,
        systemInstruction: bodyObj.systemInstruction,
        generationConfig: bodyObj.generationConfig,
        apiKey: cleanKey,
      }),
    });

    // If model does not support thinkingBudget: 0 or thinkingConfig, retry without it
    if (res.status === 400) {
      const fallbackObj = buildChatBody(false, false);
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: cleanModel,
          contents: fallbackObj.contents,
          systemInstruction: fallbackObj.systemInstruction,
          generationConfig: fallbackObj.generationConfig,
          apiKey: cleanKey,
        }),
      });
    }

    const rawText = await res.text().catch(() => '');
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {}

    if (!res.ok) {
      const googleMsg = data?.error?.message || rawText || `HTTP ${res.status}`;
      const err: any = new Error(`Gemini ${res.status}: ${googleMsg}`);
      err.status = res.status;
      throw err;
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const reply = extractNonThoughtTextFromParts(parts);
    if (reply) return reply;
    throw new Error('Gemini থেকে ফাঁকা উত্তর এসেছে');
  } catch (err: any) {
    if (err.message && (err.message.startsWith('Gemini ') || err.message.includes('key নেই'))) {
      throw err;
    }
    throw new Error(`নেটওয়ার্ক সমস্যা: ${err.message || err}`);
  }
};

/**
 * Fetch available model dynamically from the provider's /models endpoint
 * ensuring we never send an outdated model name.
 */
export const fetchActiveModelForProvider = async (
  provider: ChatProviderConfig,
  key: string
): Promise<string> => {
  const override = getChatModelOverride();
  if (override) return override;

  if (provider.id === 'gemini') {
    const disc = await getDynamicGeminiChatModels(key);
    if (disc.models.length > 0) {
      writeLocalKey('active_model_gemini', disc.models[0]);
      return disc.models[0];
    }
    return getSavedWorkingTextModel() || TEXT_MODELS[0] || 'gemini-1.5-flash';
  }

  if (provider.id === 'groq') {
    const disc = await getDynamicGroqChatModels(key);
    if (disc.models.length > 0) {
      writeLocalKey('active_model_groq', disc.models[0]);
      return disc.models[0];
    }
    return provider.defaultModel;
  }

  const cachedModelKey = `active_model_${provider.id}`;
  const cachedModel = readLocalKey(cachedModelKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${key}`,
    };
    if (provider.id === 'openrouter') {
      headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://aistudio.google.com';
      headers['X-Title'] = 'Rose AI Assistant';
    }

    const res = await fetch(`${provider.baseURL}/models`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      const list: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      if (list.length > 0) {
        if (provider.id === 'openrouter') {
          const stableFreeIds = [
            'google/gemma-2-9b-it:free',
            'mistralai/pixtral-12b:free',
            'huggingfaceh4/zephyr-7b-beta:free',
            'openchat/openchat-7b:free',
            'google/gemma-4-31b-it:free',
          ];
          for (const stableId of stableFreeIds) {
            if (list.some((m) => m.id === stableId)) {
              writeLocalKey(cachedModelKey, stableId);
              return stableId;
            }
          }
          const freeModel = list.find((m) => typeof m.id === 'string' && m.id.endsWith(':free'));
          if (freeModel?.id) {
            writeLocalKey(cachedModelKey, freeModel.id);
            return freeModel.id;
          }
        } else if (provider.id === 'cerebras') {
          const match = list.find(
            (m) => typeof m.id === 'string' && (m.id.includes('llama3.1-8b') || m.id.includes('llama-3.3-70b') || m.id.includes('llama'))
          );
          if (match?.id) {
            writeLocalKey(cachedModelKey, match.id);
            return match.id;
          }
        } else if (provider.id === 'mistral') {
          const match = list.find(
            (m) => typeof m.id === 'string' && (m.id.includes('mistral-small') || m.id.includes('open-mistral') || m.id.includes('mistral-tiny'))
          );
          if (match?.id) {
            writeLocalKey(cachedModelKey, match.id);
            return match.id;
          }
        }
      }
    }
  } catch {} finally {
    clearTimeout(timer);
  }

  return cachedModel || provider.defaultModel;
};

/**
 * Universal OpenAI-compatible chat completion caller.
 * Used by Groq, OpenRouter, Cerebras, and Mistral.
 */
export const callOpenAiCompatibleChat = async (params: {
  baseURL: string;
  apiKey: string;
  model: string;
  systemPrompt?: string;
  messages: Array<{ role: 'user' | 'assistant'; text: string }>;
  maxTokens?: number;
  temperature?: number;
  providerName?: string;
  signal?: AbortSignal;
}): Promise<string> => {
  const {
    baseURL,
    apiKey,
    model,
    systemPrompt,
    messages,
    maxTokens = 400,
    temperature = 0.7,
    providerName = 'Groq',
    signal,
  } = params;

  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) {
    throw new Error(`${providerName} key নেই। Settings → Connections-এ key দিন।`);
  }

  const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  const finalSys = ensureNoThoughtSystemInstruction(systemPrompt);
  if (finalSys) {
    formattedMessages.push({ role: 'system', content: finalSys });
  }

  for (const msg of messages) {
    if (!msg.text || !msg.text.trim()) continue;
    formattedMessages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.text.trim(),
    });
  }

  if (formattedMessages.length === 0 || formattedMessages[formattedMessages.length - 1].role !== 'user') {
    throw new Error('No user message provided to chat');
  }

  const cleanBase = baseURL.replace(/\/+$/, '');
  const url = `${cleanBase}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cleanKey}`,
  };

  if (baseURL.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://aistudio.google.com';
    headers['X-Title'] = 'Rose AI Assistant';
  }

  const body = {
    model,
    messages: formattedMessages,
    max_tokens: maxTokens,
    temperature,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    const rawText = await res.text().catch(() => '');
    let parsed: any = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {}

    if (!res.ok) {
      const errorMsg =
        parsed?.error?.message ||
        parsed?.message ||
        parsed?.detail ||
        rawText ||
        `HTTP ${res.status}`;
      const err: any = new Error(`${providerName} ${res.status}: ${errorMsg}`);
      err.status = res.status;
      throw err;
    }

    const choice = parsed?.choices?.[0];
    let reply = choice?.message?.content;

    if (Array.isArray(reply)) {
      reply = reply
        .filter((part: any) => part && part.thought !== true)
        .map((part: any) => part.text || part.content || '')
        .join('');
    }

    if (typeof reply === 'string' && reply.trim()) {
      return cleanAssistantReplyText(reply.trim());
    }

    throw new Error(`${providerName} থেকে ফাঁকা উত্তর এসেছে`);
  } catch (err: any) {
    if (err.message && (err.message.startsWith(`${providerName} `) || err.message.includes('key নেই'))) {
      throw err;
    }
    throw new Error(`নেটওয়ার্ক সমস্যা: ${err.message || err}`);
  }
};

/**
 * Verification test call on SAVE.
 */
export const verifyProviderKey = async (
  providerId: ChatEngineId,
  rawKey: string
): Promise<{ ok: boolean; status: KeyStatus; errorText?: string; model?: string }> => {
  const cleanKey = String(rawKey || '')
    .replace(/[\r\n\t\s\u200B\u200C\u200D\uFEFF]+/g, '')
    .trim();

  if (!cleanKey) {
    await setProviderStatus(providerId, 'NOT SET');
    return { ok: false, status: 'NOT SET', errorText: 'Key দেওয়া হয়নি' };
  }

  const provider = FREE_CHAT_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) {
    return { ok: false, status: 'INVALID', errorText: 'অজানা সেবা' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    if (providerId === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      const raw = await res.text().catch(() => '');
      let errJson: any = null;
      try { errJson = JSON.parse(raw); } catch {}
      const msg = errJson?.error?.message || errJson?.message || raw || '';

      if (res.ok) {
        await setProviderStatus('gemini', 'READY');
        return { ok: true, status: 'READY', errorText: 'Gemini ঠিক আছে' };
      }

      await setProviderStatus('gemini', 'INVALID');
      return { ok: false, status: 'INVALID', errorText: `Gemini ${res.status}: ${msg}` };
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${cleanKey}`,
      'Content-Type': 'application/json',
    };
    if (providerId === 'openrouter') {
      headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://aistudio.google.com';
      headers['X-Title'] = 'Rose AI Assistant';
    }

    const testUrl = `${provider.baseURL}/models`;
    const res = await fetch(testUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    const raw = await res.text().catch(() => '');
    let errJson: any = null;
    try { errJson = JSON.parse(raw); } catch {}
    const msg = errJson?.error?.message || errJson?.message || errJson?.detail || raw || '';

    if (res.ok) {
      await setProviderStatus(providerId, 'READY');
      return { ok: true, status: 'READY', errorText: `${provider.name} ঠিক আছে` };
    }

    await setProviderStatus(providerId, 'INVALID');
    return { ok: false, status: 'INVALID', errorText: `${provider.name} ${res.status}: ${msg}` };
  } catch (netErr: any) {
    const isAbort = netErr?.name === 'AbortError';
    const text = isAbort ? 'সময় শেষ (Timeout)' : `নেটওয়ার্ক সমস্যা: ${netErr.message || netErr}`;
    const current = getProviderStatus(providerId);
    return { ok: false, status: current, errorText: text };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Text chat generation with Dynamic Model Selection, Auto-Retry across models on 404,
 * and clear distinct error labeling for Groq and Gemini.
 */
export const generateTextWithSelectedEngine = async (params: {
  userText: string;
  systemPrompt: string;
  historyWithoutSystem: Array<{ role: 'user' | 'assistant'; text: string }>;
  maxTokens?: number;
}): Promise<{ text: string; usedEngine: ChatEngineId; modelUsed?: string }> => {
  const { userText, systemPrompt, historyWithoutSystem, maxTokens = 1024 } = params;

  const currentEngine = getSelectedChatEngine();
  const groqKey = getProviderKey('groq');
  const geminiKey = getProviderKey('gemini');
  const overrideModel = getChatModelOverride();

  if (currentEngine === 'gemini' && !geminiKey) {
    throw new Error('Gemini key নেই। Settings → Connections-এ key দিন।');
  }

  if (currentEngine === 'groq' && !groqKey) {
    throw new Error('Groq key নেই। Settings → Connections-এ key দিন।');
  }

  if (!groqKey && !geminiKey) {
    throw new Error('Gemini key নেই। Settings → Connections-এ key দিন।');
  }

  const filteredHistory = historyWithoutSystem
    .filter((m) => {
      const t = String(m.text || '').toLowerCase();
      return (
        t.trim() &&
        !t.includes('error') &&
        !t.includes('ত্রুটি') &&
        !t.includes('failed') &&
        !t.includes('ব্যর্থ') &&
        !t.includes('cannot reach')
      );
    })
    .slice(-10);

  if (filteredHistory.length === 0 || filteredHistory[filteredHistory.length - 1].role !== 'user') {
    filteredHistory.push({ role: 'user', text: userText });
  }

  let truncatedSystemPrompt = systemPrompt;
  if (truncatedSystemPrompt.length > 3000) {
    truncatedSystemPrompt = systemPrompt.slice(0, 1200) + '\n...[context trimmed]...\n' + systemPrompt.slice(-1750);
  }

  // 1. IF CURRENT ENGINE IS GROQ
  if (currentEngine === 'groq' && groqKey) {
    let candidateGroqModels: string[] = [];
    if (overrideModel) {
      candidateGroqModels = [overrideModel];
    } else {
      const discovery = await getDynamicGroqChatModels(groqKey);
      if (discovery.models.length > 0) {
        candidateGroqModels = discovery.models.slice(0, 3);
      } else if (discovery.error) {
        throw new Error(discovery.error.startsWith('Groq ') ? discovery.error : `Groq 400: ${discovery.error}`);
      }
    }

    let lastGroqErr = '';
    for (const modelCandidate of candidateGroqModels) {
      try {
        const reply = await callOpenAiCompatibleChat({
          baseURL: 'https://api.groq.com/openai/v1',
          apiKey: groqKey,
          model: modelCandidate,
          systemPrompt: truncatedSystemPrompt,
          messages: filteredHistory,
          maxTokens: Math.min(maxTokens, 1024),
          temperature: 0.7,
          providerName: 'Groq',
        });

        if (reply) {
          writeLocalKey('active_model_groq', modelCandidate);
          return { text: reply, usedEngine: 'groq', modelUsed: modelCandidate };
        }
      } catch (err: any) {
        lastGroqErr = err?.message || String(err);
        if (lastGroqErr.includes('404') || lastGroqErr.toLowerCase().includes('not found')) {
          continue;
        }
        throw new Error(lastGroqErr);
      }
    }
    if (lastGroqErr) throw new Error(lastGroqErr);
  }

  // 2. IF CURRENT ENGINE IS GEMINI (OR FALLBACK TO GEMINI)
  if (geminiKey) {
    let candidateGeminiModels: string[] = [];
    if (overrideModel) {
      candidateGeminiModels = [overrideModel];
    } else {
      const discovery = await getDynamicGeminiChatModels(geminiKey);
      if (discovery.models.length > 0) {
        candidateGeminiModels = discovery.models.slice(0, 3);
      } else if (discovery.error) {
        throw new Error(discovery.error.startsWith('Gemini ') ? discovery.error : `Gemini 400: ${discovery.error}`);
      }
    }

    let lastGeminiErr = '';
    for (const modelCandidate of candidateGeminiModels) {
      try {
        const reply = await callGeminiDirectChat({
          apiKey: geminiKey,
          model: modelCandidate,
          systemPrompt: truncatedSystemPrompt,
          messages: filteredHistory,
          maxTokens: Math.min(maxTokens, 1024),
        });

        if (reply) {
          writeLocalKey('active_model_gemini', modelCandidate);
          return { text: reply, usedEngine: 'gemini', modelUsed: modelCandidate };
        }
      } catch (err: any) {
        lastGeminiErr = err?.message || String(err);
        if (lastGeminiErr.includes('404') || lastGeminiErr.toLowerCase().includes('not found')) {
          continue;
        }
        throw new Error(lastGeminiErr);
      }
    }
    if (lastGeminiErr) throw new Error(lastGeminiErr);
  }

  throw new Error('Gemini key নেই। Settings → Connections-এ key দিন।');
};

export const generateTextWithEngineFallback = generateTextWithSelectedEngine;

