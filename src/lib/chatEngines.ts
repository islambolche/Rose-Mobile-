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
    defaultModel: 'gemini-1.5-flash-8b',
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
    defaultModel: 'google/gemma-2-9b-it:free',
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
    return getSavedWorkingTextModel() || TEXT_MODELS[0] || 'gemini-1.5-flash-8b';
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
          // Priority list for stable free models
          const stableFreeIds = [
            'google/gemma-2-9b-it:free',
            'mistralai/pixtral-12b:free',
            'huggingfaceh4/zephyr-7b-beta:free',
            'openchat/openchat-7b:free',
            'google/gemma-4-31b-it:free'
          ];
          
          for (const stableId of stableFreeIds) {
            if (list.some(m => m.id === stableId)) {
              writeLocalKey(cachedModelKey, stableId);
              return stableId;
            }
          }

          // Fallback to any :free model
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
    maxTokens = 400,
    temperature = 0.7,
    signal,
  } = params;

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    try {
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

      // Detailed Logging (Redacting Key)
      console.log(`[ChatEngine] ${baseURL} ${model} | Status: ${res.status}`);
      if (!res.ok) {
        console.error(`[ChatEngine] Error Body:`, rawText.slice(0, 500));
        const errorMsg =
          parsed?.error?.message ||
          parsed?.message ||
          parsed?.detail ||
          `HTTP ${res.status}`;
        const err: any = new Error(errorMsg);
        err.status = res.status;
        throw err;
      }

      const choice = parsed?.choices?.[0];
      let reply = choice?.message?.content;
      
      // Handle array content if present (some providers return this)
      if (Array.isArray(reply)) {
        reply = reply.map((part: any) => part.text || part.content || '').join('');
      }

      if (typeof reply === 'string' && reply.trim()) {
        return reply.trim();
      }

      // Requirement: Do NOT use reasoning field, instead retry
      console.warn(`[ChatEngine] Empty content in response. Attempt ${attempts}/${maxAttempts}`);
      if (attempts === maxAttempts) {
        throw new Error('No text reply returned by provider');
      }
      // Wait a bit before retry
      await new Promise(r => setTimeout(r, 1000));

    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      if (attempts === maxAttempts) throw err;
      console.error(`[ChatEngine] Attempt ${attempts} failed:`, err.message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw new Error('All attempts failed');
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
  // Requirement 2: Clean the key including invisible characters
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
  const timer = setTimeout(() => controller.abort(), 12000); // Increased timeout to 12s

  try {
    if (providerId === 'gemini') {
      // Requirement 1: Use direct models list endpoint for Gemini
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      const raw = await res.text().catch(() => '');
      let errJson: any = null;
      try { errJson = JSON.parse(raw); } catch {}
      const msg = errJson?.error?.message || errJson?.message || '';
      const status = res.status;

      if (res.ok) {
        await setProviderStatus('gemini', 'READY');
        return { ok: true, status: 'READY' };
      }

      // Requirement 1: 400/403 হলে INVALID, 429 হলে "সীমা শেষ"
      if (status === 400 || status === 401 || status === 403) {
        await setProviderStatus('gemini', 'INVALID');
        return { ok: false, status: 'INVALID', errorText: `ভুল API Key (${status}): ${msg.slice(0, 50)}` };
      }
      if (status === 429) {
        await setProviderStatus('gemini', 'READY');
        return { ok: true, status: 'READY', errorText: 'সীমা শেষ (429), পরে চেষ্টা করুন' };
      }
      
      const current = getProviderStatus('gemini');
      return { ok: false, status: current, errorText: `ত্রুটি (${status}): ${msg.slice(0, 50)}` };
    }

    // OpenAI-compatible providers (Groq, OpenRouter, Cerebras, Mistral)
    const provider = FREE_CHAT_PROVIDERS.find((p) => p.id === providerId);
    if (!provider) return { ok: false, status: 'INVALID', errorText: 'অজানা সেবা' };

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${cleanKey}`,
      'Content-Type': 'application/json',
    };
    if (providerId === 'openrouter') {
      headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://aistudio.google.com';
      headers['X-Title'] = 'Rose AI Assistant';
    }

    // Requirement 2 & 3: Verify using /models endpoint
    const testUrl = `${provider.baseURL}/models`;
    const res = await fetch(testUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    const raw = await res.text().catch(() => '');
    let errJson: any = null;
    try { errJson = JSON.parse(raw); } catch {}
    const msg = errJson?.error?.message || errJson?.message || errJson?.detail || '';
    const status = res.status;

    if (res.ok) {
      await setProviderStatus(providerId, 'READY');
      return { ok: true, status: 'READY' };
    }

    if (status === 401 || status === 403) {
      await setProviderStatus(providerId, 'INVALID');
      return { ok: false, status: 'INVALID', errorText: `ভুল API Key (${status}): ${msg.slice(0, 50)}` };
    }
    if (status === 429) {
      await setProviderStatus(providerId, 'READY');
      return { ok: true, status: 'READY', errorText: 'সীমা শেষ (429), পরে চেষ্টা করুন' };
    }
    if (status === 404) {
      const current = getProviderStatus(providerId);
      return { ok: false, status: current, errorText: `যাচাইয়ের ঠিকানা ভুল (404)` };
    }

    const current = getProviderStatus(providerId);
    return { ok: false, status: current, errorText: `ত্রুটি (${status}): ${msg.slice(0, 50)}` };

  } catch (netErr: any) {
    const isAbort = netErr?.name === 'AbortError';
    const text = isAbort ? 'সময় শেষ (Timeout)' : 'যাচাই করা যায়নি, ইন্টারনেট দেখুন';
    const current = getProviderStatus(providerId);
    return { ok: false, status: current, errorText: text };
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
  const { userText, systemPrompt, historyWithoutSystem, maxTokens = 400 } = params;

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

