import { getGeminiKey, setGeminiKey } from './geminiKey';
import { directGeminiGenerate, TEXT_MODELS, getSavedWorkingTextModel } from './ai-service';
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
    baseURL: '/api/gemini',
    defaultModel: 'gemini-flash-lite-latest',
    storageKey: 'gemini_api_key',
    statusStorageKey: 'connection_status_gemini',
    getKeyUrl: 'https://aistudio.google.com/apikey',
    placeholder: 'AIza...',
  },
  {
    id: 'groq',
    name: 'Groq',
    badgeLabel: 'চ্যাট',
    tier: 'free',
    baseURL: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
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
    defaultModel: 'google/gemma-4-31b-it:free',
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
    defaultModel: 'llama3.1-8b',
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
    defaultModel: 'mistral-small-latest',
    storageKey: 'mistral_api_key',
    statusStorageKey: 'connection_status_mistral',
    getKeyUrl: 'https://console.mistral.ai',
    placeholder: '...',
  },
];

export const readLocalKey = (key: string): string => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return (localStorage.getItem(key) || '').trim();
    }
  } catch {}
  return '';
};

export const writeLocalKey = (key: string, value: string) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, value);
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
    return getGeminiKey() || readLocalKey('gemini_api_key');
  }
  const config = FREE_CHAT_PROVIDERS.find((p) => p.id === id);
  if (!config) return '';
  return readLocalKey(config.storageKey);
};

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
 * Fetch available model dynamically from the provider's /models endpoint
 * ensuring we never send an outdated model name.
 */
export const fetchActiveModelForProvider = async (
  provider: ChatProviderConfig,
  key: string
): Promise<string> => {
  if (provider.id === 'gemini') {
    return getSavedWorkingTextModel() || TEXT_MODELS[0] || 'gemini-flash-lite-latest';
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
          // Find any model with :free
          const freeModel = list.find((m) => typeof m.id === 'string' && m.id.endsWith(':free'));
          if (freeModel?.id) {
            writeLocalKey(cachedModelKey, freeModel.id);
            return freeModel.id;
          }
        } else if (provider.id === 'groq') {
          // Check for llama-3.3-70b-versatile or first chat-capable model
          const hasDefault = list.some((m) => m.id === 'llama-3.3-70b-versatile');
          if (hasDefault) {
            writeLocalKey(cachedModelKey, 'llama-3.3-70b-versatile');
            return 'llama-3.3-70b-versatile';
          }
          const alt = list.find((m) => typeof m.id === 'string' && m.id.includes('llama'));
          if (alt?.id) {
            writeLocalKey(cachedModelKey, alt.id);
            return alt.id;
          }
        } else if (provider.id === 'cerebras') {
          // Check for llama3.1-8b or llama-3.3-70b
          const match = list.find(
            (m) => typeof m.id === 'string' && (m.id.includes('llama3.1-8b') || m.id.includes('llama-3.3-70b') || m.id.includes('llama'))
          );
          if (match?.id) {
            writeLocalKey(cachedModelKey, match.id);
            return match.id;
          }
        } else if (provider.id === 'mistral') {
          // Check for mistral-small-latest or open-mistral
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
  signal?: AbortSignal;
}): Promise<string> => {
  const {
    baseURL,
    apiKey,
    model,
    systemPrompt,
    messages,
    maxTokens = 280,
    temperature = 0.7,
    signal,
  } = params;

  const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (systemPrompt && systemPrompt.trim()) {
    formattedMessages.push({ role: 'system', content: systemPrompt.trim() });
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
    Authorization: `Bearer ${apiKey.trim()}`,
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
      `HTTP ${res.status}`;
    const err: any = new Error(errorMsg);
    err.status = res.status;
    throw err;
  }

  const reply = parsed?.choices?.[0]?.message?.content;
  if (typeof reply === 'string') {
    return reply.trim();
  }

  throw new Error('No text reply returned by provider');
};

/**
 * Verification test call on SAVE.
 * Checks key validity against models endpoint or a 2-token completion.
 * Returns { ok, status, errorText }
 */
export const verifyProviderKey = async (
  providerId: ChatEngineId,
  rawKey: string
): Promise<{ ok: boolean; status: KeyStatus; errorText?: string; model?: string }> => {
  const cleanKey = String(rawKey || '').trim();
  if (!cleanKey) {
    await setProviderStatus(providerId, 'NOT SET');
    return { ok: false, status: 'NOT SET', errorText: 'Key দেওয়া হয়নি' };
  }

  const provider = FREE_CHAT_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) {
    return { ok: false, status: 'INVALID', errorText: 'অজানা সেবা' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    if (providerId === 'gemini') {
      const testModel = getSavedWorkingTextModel() || TEXT_MODELS[0] || 'gemini-flash-lite-latest';
      const url = `/api/gemini/generate`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: testModel,
          contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
          generationConfig: { maxOutputTokens: 5 },
          apiKey: cleanKey,
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        await setProviderStatus('gemini', 'READY');
        return { ok: true, status: 'READY', model: testModel };
      }

      if (res.status === 400 || res.status === 401 || res.status === 403) {
        const errJson = await res.json().catch(() => null);
        const errStr = JSON.stringify(errJson || {}).toLowerCase();
        if (
          res.status === 401 ||
          res.status === 403 ||
          errStr.includes('api_key_invalid') ||
          errStr.includes('api key not valid') ||
          errStr.includes('invalid api key')
        ) {
          await setProviderStatus('gemini', 'INVALID');
          return { ok: false, status: 'INVALID', errorText: 'ভুল API Key (401)' };
        }
      }

      const listRes = await fetch(
        `/api/gemini/models?apiKey=${encodeURIComponent(cleanKey)}`,
        { method: 'GET', signal: controller.signal }
      );
      if (listRes.ok) {
        await setProviderStatus('gemini', 'READY');
        return { ok: true, status: 'READY', model: testModel };
      }
      if (listRes.status === 429) {
        await setProviderStatus('gemini', 'READY');
        return { ok: true, status: 'READY', errorText: 'কোটাসীমা শেষ (429)' };
      }

      await setProviderStatus('gemini', 'INVALID');
      return { ok: false, status: 'INVALID', errorText: `ত্রুটি (${listRes.status || res.status})` };
    }

    // OpenAI-compatible providers: test /models endpoint first
    const activeModel = await fetchActiveModelForProvider(provider, cleanKey);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${cleanKey}`,
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

    if (res.ok) {
      await setProviderStatus(providerId, 'READY');
      return { ok: true, status: 'READY', model: activeModel };
    }

    const raw = await res.text().catch(() => '');
    let errJson: any = null;
    try {
      errJson = JSON.parse(raw);
    } catch {}

    const errDetail = errJson?.error?.message || errJson?.detail || errJson?.message || '';

    if (res.status === 401 || res.status === 403) {
      await setProviderStatus(providerId, 'INVALID');
      return { ok: false, status: 'INVALID', errorText: 'ভুল API Key (401)' };
    }

    if (res.status === 429) {
      // 429 means key is valid but quota exceeded
      await setProviderStatus(providerId, 'READY');
      return { ok: true, status: 'READY', errorText: 'কোটাসীমা শেষ (429)', model: activeModel };
    }

    // Try a small chat completion as fallback check
    try {
      await callOpenAiCompatibleChat({
        baseURL: provider.baseURL,
        apiKey: cleanKey,
        model: activeModel,
        messages: [{ role: 'user', text: 'hi' }],
        maxTokens: 2,
        signal: controller.signal,
      });
      await setProviderStatus(providerId, 'READY');
      return { ok: true, status: 'READY', model: activeModel };
    } catch (chatErr: any) {
      const code = chatErr?.status || res.status;
      const text = code === 401 ? 'ভুল API Key (401)' : code === 429 ? 'কোটাসীমা শেষ (429)' : errDetail || `ত্রুটি (${code})`;
      await setProviderStatus(providerId, 'INVALID');
      return { ok: false, status: 'INVALID', errorText: text };
    }
  } catch (netErr: any) {
    const isAbort = netErr?.name === 'AbortError';
    const text = isAbort ? 'সময় শেষ (Timeout)' : 'সংযোগ ব্যর্থ বা CORS সমস্যা';
    await setProviderStatus(providerId, 'INVALID');
    return { ok: false, status: 'INVALID', errorText: text };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Text chat generation strictly using the selected engine!
 * - Strictly executes the user's selected engine.
 * - If key is missing or INVALID, throws clear message: "<Name>-এর key দিন বা অন্য সেবা বাছুন"
 * - Automatic fallback across engines is removed as requested.
 */
export const generateTextWithSelectedEngine = async (params: {
  userText: string;
  systemPrompt: string;
  historyWithoutSystem: Array<{ role: 'user' | 'assistant'; text: string }>;
  maxTokens?: number;
}): Promise<{ text: string; usedEngine: ChatEngineId }> => {
  const { userText, systemPrompt, historyWithoutSystem, maxTokens = 280 } = params;

  const currentEngine = getSelectedChatEngine();
  const providerConfig = FREE_CHAT_PROVIDERS.find((p) => p.id === currentEngine) || FREE_CHAT_PROVIDERS[0];
  const key = getProviderKey(currentEngine);
  const status = getProviderStatus(currentEngine);

  if (!key || status === 'INVALID') {
    const errorMsg = `${providerConfig.name}-এর key দিন বা অন্য সেবা বাছুন`;
    const err: any = new Error(errorMsg);
    err.isKeyMissingOrInvalid = true;
    err.engineName = providerConfig.name;
    throw err;
  }

  if (currentEngine === 'gemini') {
    const geminiHistory = historyWithoutSystem.slice(-8).map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.text }],
    }));
    if (geminiHistory.length === 0 || geminiHistory[geminiHistory.length - 1].role !== 'user') {
      geminiHistory.push({ role: 'user', parts: [{ text: userText }] });
    }

    const res: any = await directGeminiGenerate({
      contents: geminiHistory,
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      },
      apiKey: key,
    });

    const reply =
      res?.text ||
      res?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('').trim() ||
      '';

    if (reply) {
      return { text: reply, usedEngine: 'gemini' };
    }
    throw new Error('Gemini থেকে উত্তর পাওয়া যায়নি');
  }

  // OpenAI-compatible engines (Groq, OpenRouter, Cerebras, Mistral)
  const activeModel = await fetchActiveModelForProvider(providerConfig, key);
  const messages = [...historyWithoutSystem.slice(-8)];
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    messages.push({ role: 'user', text: userText });
  }

  const reply = await callOpenAiCompatibleChat({
    baseURL: providerConfig.baseURL,
    apiKey: key,
    model: activeModel,
    systemPrompt,
    messages,
    maxTokens,
    temperature: 0.7,
  });

  if (reply) {
    return { text: reply, usedEngine: currentEngine };
  }
  throw new Error(`${providerConfig.name} থেকে উত্তর পাওয়া যায়নি`);
};

export const generateTextWithEngineFallback = generateTextWithSelectedEngine;

