import { getGeminiKey, ensureGeminiReady } from './geminiKey';
import {
  fetchGeminiModelsWithFallback,
  fetchGeminiGenerateWithFallback,
  fetchGeminiStreamWithFallback,
} from './geminiDirect';
import { buildRoseSystemInstruction, buildEssentialSystemInstruction } from './roseConfig';
import { getDynamicGroqChatModels, getProviderKey } from './chatEngines';
import { cleanAssistantReplyText } from './ai-service';
import { ROSE_TYPED_CHAT_FUNCTION_DECLARATIONS } from './team';
import { executePcTaskTool } from '../pc/pcTaskManager';
import { executeOfficeTaskTool } from './officeSync';
import {
  discoverModels,
  recordChatModelUsed,
  recordDiagnosticError,
} from './modelDiscovery';
import { isAdmin } from './admin';

export const NO_GEMINI_KEY_MSG = 'Gemini key সেভ করা নেই। Settings → CONNECTIONS-এ কী বসাও।';
export const QUOTA_429_MSG = 'আজকের ফ্রি সীমা শেষ। পরে চেষ্টা করো বা নতুন কী দাও।';

const TOTAL_CHAT_TIMEOUT_MS = 25000; // 25s timeout for normal chat
const WORKING_MODEL_KEY = 'working_gemini_text_model';
const WORKING_MODEL_TIME_KEY = 'working_gemini_text_model_ms';
const WORKING_MODEL_TTL_MS = 60 * 60 * 1000; // 1 hour

const GEMINI_429_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const GEMINI_429_STORAGE_KEY = 'rose_gemini_429_cooldown';

let memoryGemini429Until = 0;
let memoryGemini429KeySig = '';

function getKeySignature(key: string): string {
  const clean = (key || '').trim();
  if (!clean) return '';
  return `${clean.slice(0, 6)}_${clean.slice(-4)}_${clean.length}`;
}

export function markGemini429Cooldown(apiKey: string): void {
  const until = Date.now() + GEMINI_429_COOLDOWN_MS;
  const keySig = getKeySignature(apiKey);
  memoryGemini429Until = until;
  memoryGemini429KeySig = keySig;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(GEMINI_429_STORAGE_KEY, JSON.stringify({ until, keySig }));
    }
  } catch {}
}

export function clearGemini429Cooldown(): void {
  memoryGemini429Until = 0;
  memoryGemini429KeySig = '';
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(GEMINI_429_STORAGE_KEY);
    }
  } catch {}
}

export function isGeminiIn429Cooldown(apiKey: string): boolean {
  const now = Date.now();
  const currentSig = getKeySignature(apiKey);

  if (memoryGemini429Until > now && (!memoryGemini429KeySig || memoryGemini429KeySig === currentSig)) {
    return true;
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(GEMINI_429_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const until = Number(parsed?.until || 0);
        const savedSig = String(parsed?.keySig || '');
        if (until > now && (!savedSig || savedSig === currentSig)) {
          memoryGemini429Until = until;
          memoryGemini429KeySig = savedSig;
          return true;
        } else if (until <= now) {
          localStorage.removeItem(GEMINI_429_STORAGE_KEY);
        }
      }
    }
  } catch {}

  return false;
}

export function getStoredGroqKey(): string {
  try {
    const fromProvider = (getProviderKey('groq') || '').trim();
    let raw = fromProvider;
    if (!raw && typeof window !== 'undefined' && window.localStorage) {
      raw =
        localStorage.getItem('groq_api_keys') ||
        localStorage.getItem('groq_api_key') ||
        '';
      if (!raw) {
        const keysJson = localStorage.getItem('iyabd_api_keys');
        if (keysJson) {
          const parsed = JSON.parse(keysJson);
          if (parsed?.groq) raw = String(parsed.groq);
        }
      }
      if (!raw) {
        const settingsJson = localStorage.getItem('iyabd_settings');
        if (settingsJson) {
          const parsed = JSON.parse(settingsJson);
          if (parsed?.groqApiKeys) raw = String(parsed.groqApiKeys);
        }
      }
    }
    const firstKey = String(raw || '')
      .split(',')
      .map((k) => k.replace(/["'\r\n\t\s]+/g, '').trim())
      .find(Boolean);
    return firstKey || '';
  } catch {
    return '';
  }
}

export function getSelectedGroqModelFromSettings(): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    const candidates = [
      localStorage.getItem('active_model_groq') || '',
      localStorage.getItem('groq_model') || '',
      localStorage.getItem('chat_model_override') || '',
    ];
    for (const c of candidates) {
      const trimmed = c.trim();
      if (
        trimmed &&
        !trimmed.toLowerCase().startsWith('gemini') &&
        !trimmed.toLowerCase().startsWith('models/gemini') &&
        !trimmed.toLowerCase().startsWith('auto ')
      ) {
        return trimmed;
      }
    }
  } catch {}
  return '';
}

function redactSecrets(text: string, keys: string[]): string {
  let out = String(text || '');
  for (const k of keys) {
    const clean = (k || '').trim();
    if (clean && clean.length >= 6) {
      out = out.split(clean).join('[REDACTED]');
    }
  }
  out = out.replace(/AIza[0-9A-Za-z-_]{25,}/g, '[REDACTED_GEMINI_KEY]');
  out = out.replace(/gsk_[0-9A-Za-z-_]{20,}/g, '[REDACTED_GROQ_KEY]');
  return out;
}

export function extractRealErrorDetails(rawInput: any, fallbackStatus?: number): { status: number; message: string; rawJson?: string } {
  let status = Number(fallbackStatus || rawInput?.status || rawInput?.statusCode || 0) || 0;
  let rawText = '';

  if (typeof rawInput === 'string') {
    rawText = rawInput.trim();
  } else if (rawInput instanceof Error) {
    rawText = String((rawInput as any).rawBody || (rawInput as any).googleMessage || rawInput.message || '').trim();
  } else if (rawInput && typeof rawInput === 'object') {
    rawText = String(rawInput.error?.message || rawInput.message || JSON.stringify(rawInput)).trim();
  }

  const httpMatch = rawText.match(/\bHTTP\s+(\d{3})\b/i) || rawText.match(/\bstatus code\s+(\d{3})\b/i);
  if (!status && httpMatch) {
    status = parseInt(httpMatch[1], 10) || 0;
  }

  let cleanMessage = rawText.replace(/^HTTP\s+\d{3}\s*:\s*/i, '').trim();
  let extractedJson = '';

  if (cleanMessage.startsWith('{') || cleanMessage.includes('"error"')) {
    try {
      const jsonMatch = cleanMessage.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedJson = jsonMatch[0];
        const parsed = JSON.parse(jsonMatch[0]);
        const apiErr = parsed?.error || parsed;
        if (!status && apiErr?.code && Number(apiErr.code) >= 100) {
          status = Number(apiErr.code);
        }
        if (typeof apiErr?.message === 'string' && apiErr.message.trim()) {
          cleanMessage = apiErr.message.trim();
        }
      }
    } catch {}
  }

  cleanMessage = cleanMessage.replace(/\{[\s\S]*\}/g, '').replace(/\s+/g, ' ').trim();

  if (!status && /\b429\b|resource_exhausted|quota exceeded|rate limit/i.test(cleanMessage || rawText)) {
    status = 429;
  }

  return {
    status,
    message: cleanMessage.slice(0, 180) || (status ? `HTTP ${status}` : 'Request failed'),
    rawJson: extractedJson || (rawInput?.rawJson ? String(rawInput.rawJson) : undefined),
  };
}

export function formatRealGeminiError(err: any, fallbackStatus?: number): string {
  if (err?.shortBengaliMsg && typeof err.shortBengaliMsg === 'string') {
    return err.shortBengaliMsg;
  }

  const rawMsg = String(err?.message || err || '').trim();
  if (
    err?.isNoKey ||
    rawMsg.includes('Gemini key সেভ করা নেই') ||
    rawMsg.includes('CONNECTIONS-এ Gemini key') ||
    rawMsg.includes('Add your Gemini key')
  ) {
    return NO_GEMINI_KEY_MSG;
  }

  const { status } = extractRealErrorDetails(err, fallbackStatus);

  if (status === 429 || /\b429\b|resource_exhausted|quota/i.test(rawMsg)) {
    return QUOTA_429_MSG;
  }

  if (err?.isTimeout || err?.name === 'AbortError' || /timed?\s*out|abort/i.test(rawMsg)) {
    return 'সময় শেষ (Timeout) — ২৫ সেকেন্ডের মধ্যে উত্তর আসেনি। আবার চেষ্টা করো।';
  }

  if (status === 400 || status === 401 || status === 403) {
    return `Gemini কী সঠিক নয় (HTTP ${status})। Settings → CONNECTIONS-এ কী পরীক্ষা করো।`;
  }

  if (status === 503 || status === 500) {
    return `সার্ভার এখন ব্যস্ত (HTTP ${status})। একটু পরে আবার চেষ্টা করো।`;
  }

  if (status > 0) {
    return `উত্তর পাওয়া যায়নি (HTTP ${status})। আবার চেষ্টা করো।`;
  }

  return 'সংযোগ সমস্যা — উত্তর পাওয়া যায়নি। আবার চেষ্টা করো।';
}

export async function getValidFlashModels(apiKey: string): Promise<string[]> {
  const discovered = await discoverModels(apiKey);
  return discovered.chatModels;
}

export function getOrderedFlashModels(allModels: string[]): string[] {
  const preferredOrder = [
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-lite-latest',
  ];

  const valid = allModels.filter((m) => {
    const lower = m.toLowerCase();
    return (
      lower.includes('flash') &&
      !lower.includes('tts') &&
      !lower.includes('live') &&
      !lower.includes('audio') &&
      !lower.includes('image') &&
      !lower.includes('embedding')
    );
  });

  const ordered: string[] = [];
  for (const p of preferredOrder) {
    if (valid.includes(p) && !ordered.includes(p)) {
      ordered.push(p);
    }
  }

  const remaining = valid.filter((m) => !ordered.includes(m));
  remaining.sort((a, b) => {
    const vA = parseFloat(a.match(/[\d.]+/)?.[0] || '0');
    const vB = parseFloat(b.match(/[\d.]+/)?.[0] || '0');
    if (vA !== vB) return vB - vA;
    return b.localeCompare(a);
  });

  for (const r of remaining) {
    if (!ordered.includes(r)) ordered.push(r);
  }

  if (ordered.length === 0) {
    return ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest'];
  }
  return ordered;
}

export async function resolveChatModel(apiKey: string, _signal?: AbortSignal): Promise<string[]> {
  const discovered = await discoverModels(apiKey);
  const candidateModels = discovered.chatModels.length > 0
    ? [...discovered.chatModels]
    : ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest'];

  // Check working model in localStorage (within 1 hour)
  try {
    const workingModel = localStorage.getItem(WORKING_MODEL_KEY);
    const workingTime = Number(localStorage.getItem(WORKING_MODEL_TIME_KEY) || 0);
    if (workingModel && Date.now() - workingTime < WORKING_MODEL_TTL_MS) {
      const cleanWorking = workingModel.replace(/^models\//, '').trim();
      if (candidateModels.includes(cleanWorking)) {
        return [cleanWorking, ...candidateModels.filter((m) => m !== cleanWorking)];
      }
    }
  } catch {}

  return candidateModels;
}

export function buildShortFallbackSystemPrompt(): string {
  let settings: any = {};
  let prefs: any = {};
  try {
    const s = localStorage.getItem('iyabd_settings');
    if (s) settings = JSON.parse(s);
    const p = localStorage.getItem('iyabd_preferences') || localStorage.getItem('iyabd_prefs');
    if (p) prefs = JSON.parse(p);
  } catch {}

  const name = settings?.assistantName || 'Rose AI';
  const owner = settings?.ownerName || 'MD YOUSUF KHAN';
  const personality = settings?.personality || 'Normal';
  const adminActive = isAdmin();

  return [
    `তুমি ${name} (Rose AI), ${owner}-এর বিশ্বস্ত পার্সোনাল এআই অ্যাসিস্ট্যান্ট।`,
    'ভাষা নীতি (অত্যন্ত কঠোর): তুমি সব সময় শুদ্ধ বাংলায় কথা বলবে। ইংরেজি বা অন্য কোনো ভাষায় কখনোই উত্তর দেবে না।',
    `ব্যক্তিত্ব: ${personality}`,
    adminActive ? 'এডমিন অ্যাক্সেস সক্রিয়।' : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function shouldRetryGeminiError(err: any): boolean {
  const status = Number(err?.status || 0);
  const msg = String(err?.message || err?.rawBody || '').toLowerCase();
  return (
    status === 503 ||
    status === 500 ||
    status === 429 ||
    status === 408 ||
    err?.isTimeout ||
    err?.name === 'AbortError' ||
    /\b429\b|\b503\b|\b500\b|resource_exhausted|quota|rate limit|timed?\s*out|abort|unavailable|overloaded/i.test(msg)
  );
}

function is429Error(err: any): boolean {
  const status = Number(err?.status || 0);
  const msg = String(err?.message || err?.rawBody || '').toLowerCase();
  return status === 429 || /\b429\b|resource_exhausted|quota exceeded|rate limit/i.test(msg);
}

function createStepSignal(masterSignal: AbortSignal, stepTimeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const onMasterAbort = () => controller.abort();
  if (masterSignal.aborted) {
    controller.abort();
  } else {
    masterSignal.addEventListener('abort', onMasterAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), Math.max(500, stepTimeoutMs));
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      masterSignal.removeEventListener('abort', onMasterAbort);
    },
  };
}

export async function sendTypedChat(
  history: Array<{ role: string; content?: string; text?: string; isError?: boolean }>,
  userText: string,
  onToken?: (delta: string, accumulated: string) => void
): Promise<{ text: string; modelUsed: string; provider?: 'gemini' | 'groq' | 'openrouter'; providerLabel?: string; pcTaskId?: string }> {
  const apiKey = (getGeminiKey() || '').replace(/["'\r\n\t\s]+/g, '').trim();
  const groqKey = getStoredGroqKey();
  const hasGemini = await ensureGeminiReady(apiKey);

  if (!hasGemini && !groqKey) {
    const noKeyErr: any = new Error(NO_GEMINI_KEY_MSG);
    noKeyErr.isNoKey = true;
    noKeyErr.shortBengaliMsg = NO_GEMINI_KEY_MSG;
    throw noKeyErr;
  }

  const setWaitingStatus = (msg: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rose_typing_status', { detail: msg }));
    }
  };

  const masterController = new AbortController();
  const startTime = Date.now();
  const deadline = startTime + TOTAL_CHAT_TIMEOUT_MS;

  const errorTrace: Record<string, any> = {};

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      masterController.abort();
      const tErr: any = new Error('HTTP 408: Request timed out after 25 seconds');
      tErr.status = 408;
      tErr.isTimeout = true;
      reject(tErr);
    }, TOTAL_CHAT_TIMEOUT_MS);
  });

  const cleanHistory = history.filter((m) => {
    if (!m || m.role === 'system' || (m as any).isError) return false;
    const t = String(m.content || m.text || '').trim();
    return Boolean(t);
  });

  if (cleanHistory.length > 0) {
    const lastMsg = cleanHistory[cleanHistory.length - 1];
    const lastText = String(lastMsg.content || lastMsg.text || '').trim();
    if (lastMsg.role === 'user' && lastText === userText.trim()) {
      cleanHistory.pop();
    }
  }

  // Send only the last 10 messages
  const last10 = cleanHistory.slice(-10);

  let settings: any = {};
  let prefs: any = {};
  try {
    const s = localStorage.getItem('iyabd_settings');
    if (s) settings = JSON.parse(s);
    const p = localStorage.getItem('iyabd_preferences') || localStorage.getItem('iyabd_prefs');
    if (p) prefs = JSON.parse(p);
  } catch {}

  // Default replies short (1 to 3 sentences) unless the user asks for detail; max output tokens 300
  const userWantsDetail = /বিস্তারিত|ব্যাখ্যা|details?|explain|in-depth|detailed/i.test(userText);
  const maxOutputTokens = userWantsDetail ? 800 : 300;
  const sysInstructionText = buildEssentialSystemInstruction(settings, prefs, userWantsDetail);

  const openRouterKey = (getProviderKey('openrouter') || (typeof window !== 'undefined' ? localStorage.getItem('openrouter_api_key') : '') || '').trim();
  const hasFallbackKey = Boolean(groqKey || openRouterKey);

  const shortFallbackSysPrompt = sysInstructionText;

  const tryFallbackEngine = async (): Promise<{ text: string; modelUsed: string; provider: 'groq' | 'openrouter'; providerLabel: string }> => {
    if (!hasFallbackKey) {
      const noFallbackErr: any = new Error('No fallback key saved');
      noFallbackErr.noFallbackKey = true;
      throw noFallbackErr;
    }

    // 1. Try Groq if groqKey is present
    if (groqKey) {
      let groqModel = getSelectedGroqModelFromSettings();
      if (!groqModel) {
        try {
          const disc = await getDynamicGroqChatModels(groqKey, false);
          const availableGroqModels = disc.models || [];
          groqModel = availableGroqModels[0] || 'llama-3.3-70b-versatile';
        } catch {
          groqModel = 'llama-3.3-70b-versatile';
        }
      }

      const executeGroqCall = async (historySlice: typeof cleanHistory): Promise<string> => {
        const stepTime = Math.min(10000, Math.max(2000, deadline - Date.now() - 200));
        const { signal, cleanup } = createStepSignal(masterController.signal, stepTime);
        try {
          const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: shortFallbackSysPrompt },
            ...historySlice.map((m) => ({
              role: (m.role === 'model' || m.role === 'assistant' || m.role === 'rose' ? 'assistant' : 'user') as 'user' | 'assistant',
              content: String(m.content || m.text || '').trim(),
            })),
            { role: 'user', content: userText.trim() },
          ];

          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${groqKey}`,
            },
            body: JSON.stringify({
              model: groqModel,
              messages: groqMessages,
              temperature: 0.7,
              max_tokens: maxOutputTokens,
              stream: true,
            }),
            signal,
          });

          if (!res.ok) {
            const rawText = await res.text().catch(() => '');
            let parsedJson: any = rawText;
            try {
              parsedJson = rawText ? JSON.parse(rawText) : rawText;
            } catch {}
            const err: any = new Error(`Groq HTTP ${res.status}`);
            err.status = res.status;
            err.rawBody = rawText;
            err.parsedJson = parsedJson;
            err.modelUsed = groqModel;
            throw err;
          }

          if (!res.body) {
            throw new Error('Groq returned empty response stream');
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let accumulated = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;
              const jsonStr = trimmed.slice(5).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                const delta = data?.choices?.[0]?.delta?.content;
                if (typeof delta === 'string' && delta) {
                  accumulated += delta;
                  onToken?.(delta, accumulated);
                }
              } catch {}
            }
          }

          if (accumulated.trim()) {
            return cleanAssistantReplyText(accumulated.trim());
          }
          const emptyErr: any = new Error('Groq returned empty response');
          emptyErr.status = 200;
          throw emptyErr;
        } finally {
          cleanup();
        }
      };

      try {
        const reply = await executeGroqCall(last10);
        try {
          localStorage.setItem('active_model_groq', groqModel);
        } catch {}
        return {
          text: reply,
          modelUsed: groqModel,
          provider: 'groq',
          providerLabel: 'Groq দিয়ে উত্তর',
        };
      } catch (firstGroqErr: any) {
        if (firstGroqErr?.status === 413 && cleanHistory.length > 4) {
          try {
            const retryReply = await executeGroqCall(cleanHistory.slice(-4));
            return {
              text: retryReply,
              modelUsed: groqModel,
              provider: 'groq',
              providerLabel: 'Groq দিয়ে উত্তর',
            };
          } catch {}
        }
        errorTrace.groq_primary = {
          model: groqModel,
          status: firstGroqErr?.status || 0,
          error: firstGroqErr?.parsedJson || firstGroqErr?.rawBody || firstGroqErr?.message || String(firstGroqErr),
        };
      }
    }

    // 2. Try OpenRouter if openRouterKey is present
    if (openRouterKey && deadline - Date.now() > 1500) {
      const openRouterModel = 'meta-llama/llama-3.3-70b-instruct:free';
      const openRouterEndpoint = ['https://openrouter.ai', 'api', 'v1', 'chat', 'completions'].join('/');

      const executeOpenRouterCall = async (historySlice: typeof cleanHistory): Promise<string> => {
        const stepTime = Math.min(10000, Math.max(2000, deadline - Date.now() - 200));
        const { signal, cleanup } = createStepSignal(masterController.signal, stepTime);
        try {
          const orMessages = [
            { role: 'system', content: shortFallbackSysPrompt },
            ...historySlice.map((m) => ({
              role: (m.role === 'model' || m.role === 'assistant' || m.role === 'rose' ? 'assistant' : 'user') as 'user' | 'assistant',
              content: String(m.content || m.text || '').trim(),
            })),
            { role: 'user', content: userText.trim() },
          ];

          const res = await fetch(openRouterEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${openRouterKey}`,
            },
            body: JSON.stringify({
              model: openRouterModel,
              messages: orMessages,
              temperature: 0.7,
              max_tokens: 1024,
            }),
            signal,
          });

          const rawText = await res.text().catch(() => '');
          if (!res.ok) {
            const err: any = new Error(`OpenRouter HTTP ${res.status}`);
            err.status = res.status;
            err.rawBody = rawText;
            err.modelUsed = openRouterModel;
            throw err;
          }

          const data = rawText ? JSON.parse(rawText) : {};
          const content = data?.choices?.[0]?.message?.content;
          if (typeof content === 'string' && content.trim()) {
            return cleanAssistantReplyText(content.trim());
          }
          throw new Error('OpenRouter returned empty response');
        } finally {
          cleanup();
        }
      };

      try {
        const reply = await executeOpenRouterCall(cleanHistory.slice(-6));
        return {
          text: reply,
          modelUsed: openRouterModel,
          provider: 'openrouter',
          providerLabel: 'OpenRouter দিয়ে উত্তর',
        };
      } catch (firstOrErr: any) {
        if (firstOrErr?.status === 413 && cleanHistory.length > 4) {
          try {
            const retryReply = await executeOpenRouterCall(cleanHistory.slice(-4));
            return {
              text: retryReply,
              modelUsed: openRouterModel,
              provider: 'openrouter',
              providerLabel: 'OpenRouter দিয়ে উত্তর',
            };
          } catch {}
        }
        errorTrace.openrouter = {
          model: openRouterModel,
          status: firstOrErr?.status || 0,
          error: firstOrErr?.message || String(firstOrErr),
        };
      }
    }

    throw new Error('All fallback providers failed');
  };

  const runChatFlow = async (): Promise<{ text: string; modelUsed: string; provider?: 'gemini' | 'groq' | 'openrouter'; providerLabel?: string; pcTaskId?: string }> => {
    const geminiCooldownKey = apiKey || 'server';
    const in429Cooldown = hasGemini ? isGeminiIn429Cooldown(geminiCooldownKey) : false;
    if ((!hasGemini || in429Cooldown) && hasFallbackKey) {
      try {
        return await tryFallbackEngine();
      } catch (fallbackErr: any) {
        fallbackErr.geminiHad429 = in429Cooldown;
        throw fallbackErr;
      }
    }

    const candidateModels = hasGemini ? await resolveChatModel(apiKey) : [];
    if (candidateModels.length === 0) {
      candidateModels.push('gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-lite-latest');
    }

    let lastPcTaskId: string | undefined;

    const executeGeminiStreamFetch = async (
      targetModel: string,
      historySlice: typeof cleanHistory,
      maxStepMs: number
    ): Promise<string> => {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 400) {
        const tErr: any = new Error('HTTP 408: Request timed out');
        tErr.status = 408;
        tErr.isTimeout = true;
        tErr.modelUsed = targetModel;
        throw tErr;
      }

      const geminiContents = [
        ...historySlice.map((m) => ({
          role: m.role === 'model' || m.role === 'assistant' || m.role === 'rose' ? 'model' : 'user',
          parts: [{ text: String(m.content || m.text || '').trim() }],
        })),
        { role: 'user', parts: [{ text: userText.trim() }] },
      ];

      const { signal, cleanup } = createStepSignal(masterController.signal, Math.min(maxStepMs, remainingMs));
      try {
        const res = await fetchGeminiStreamWithFallback(
          {
            model: targetModel,
            systemInstruction: { parts: [{ text: sysInstructionText }] },
            contents: geminiContents,
            tools: [{ functionDeclarations: ROSE_TYPED_CHAT_FUNCTION_DECLARATIONS }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens,
            },
            ...(apiKey ? { apiKey } : {}),
          },
          signal
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          let parsedJson: any = errText;
          try {
            parsedJson = errText ? JSON.parse(errText) : errText;
          } catch {}
          const details = extractRealErrorDetails(errText, res.status);
          const errObj: any = new Error(`HTTP ${res.status}: ${details.message}`);
          errObj.status = res.status;
          errObj.rawBody = errText;
          errObj.parsedJson = parsedJson;
          errObj.modelUsed = targetModel;
          throw errObj;
        }

        if (!res.body) {
          const errObj: any = new Error('HTTP 500: Missing stream body');
          errObj.status = 500;
          errObj.modelUsed = targetModel;
          throw errObj;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let receivedFirstChunk = false;
        let accumulatedText = '';
        const pendingFunctionCalls: any[] = [];
        let buffer = '';

        const firstChunkTimeout = setTimeout(() => {
          if (!receivedFirstChunk) {
            const tErr: any = new Error(`HTTP 408: Timeout waiting for first chunk on ${targetModel} (10s)`);
            tErr.status = 408;
            tErr.isTimeout = true;
            tErr.modelUsed = targetModel;
            try {
              reader.cancel();
            } catch {}
          }
        }, 10000);

        try {
          while (true) {
            if (masterController.signal.aborted) {
              const tErr: any = new Error(`HTTP 408: Chat master timeout on ${targetModel}`);
              tErr.status = 408;
              tErr.isTimeout = true;
              tErr.modelUsed = targetModel;
              throw tErr;
            }

            const { done, value } = await reader.read();
            if (done) break;

            if (!receivedFirstChunk) {
              receivedFirstChunk = true;
              clearTimeout(firstChunkTimeout);
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data:')) continue;
              const jsonStr = trimmed.slice(5).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                const parts = data?.candidates?.[0]?.content?.parts || [];
                for (const p of parts) {
                  if (p?.text && typeof p.text === 'string') {
                    accumulatedText += p.text;
                    onToken?.(p.text, accumulatedText);
                  }
                  if (p?.functionCall) {
                    pendingFunctionCalls.push(p.functionCall);
                  }
                }
              } catch {}
            }
          }
        } finally {
          clearTimeout(firstChunkTimeout);
          try {
            reader.releaseLock();
          } catch {}
        }

        if (pendingFunctionCalls.length > 0) {
          const fc = pendingFunctionCalls[0];
          const fcName = String(fc.name || '');
          const fcArgs = fc.args || {};

          if (fcName === 'office_task' || fcName === 'assign_task' || fcName === 'get_team_status') {
            const officeRes = await executeOfficeTaskTool({
              agent: String(fcArgs.agent || 'mira'),
              kind: fcName === 'get_team_status' ? 'status' : String(fcArgs.kind || 'task'),
              text: String(fcArgs.text || fcArgs.instruction || 'কাজের আপডেট দাও'),
            });
            if (officeRes?.message) {
              return officeRes.message;
            }
          } else if (fcName === 'pc_task') {
            const pcRes = await executePcTaskTool(fcArgs);
            lastPcTaskId = pcRes.taskId;
            if (pcRes?.message) {
              return pcRes.message;
            }
          } else {
            const { executePhoneToolActionByName } = await import('./phone');
            const toolRes = await executePhoneToolActionByName(fcName, fcArgs);
            if (toolRes?.message) {
              return toolRes.message;
            }
          }
        }

        if (!accumulatedText.trim()) {
          const errObj: any = new Error('HTTP 200: Empty response from Gemini API');
          errObj.status = 200;
          errObj.modelUsed = targetModel;
          throw errObj;
        }

        return accumulatedText;
      } catch (fetchErr: any) {
        if (fetchErr?.name === 'AbortError') {
          const tErr: any = new Error(`HTTP 408: Timeout on ${targetModel}`);
          tErr.status = 408;
          tErr.isTimeout = true;
          tErr.modelUsed = targetModel;
          throw tErr;
        }
        throw fetchErr;
      } finally {
        cleanup();
      }
    };

    let lastGeminiError: any = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const model = candidateModels[i];
      let attemptCount = 0;
      const maxAttempts = 2; // initial try + 1 retry after 1.5s on 503/500/429/timeout

      while (attemptCount < maxAttempts && deadline - Date.now() > 1000) {
        attemptCount++;
        try {
          if (attemptCount > 1) {
            setWaitingStatus('পুনরায় চেষ্টা করছি…');
            await new Promise((r) => setTimeout(r, 1500));
          } else if (i > 0) {
            setWaitingStatus('অন্য মডেল চেষ্টা করছি…');
          }

          console.log(`[TypedChat] Trying model ${model} (attempt ${attemptCount})`);
          let text: string;
          try {
            text = await executeGeminiStreamFetch(model, last10, 10000);
          } catch (fetchErr: any) {
            // If 413: retry ONCE with last 4 messages only
            if (fetchErr?.status === 413 && last10.length > 4) {
              text = await executeGeminiStreamFetch(model, cleanHistory.slice(-4), 10000);
            } else {
              throw fetchErr;
            }
          }

          // Success! Remember working model
          try {
            localStorage.setItem(WORKING_MODEL_KEY, model);
            localStorage.setItem(WORKING_MODEL_TIME_KEY, String(Date.now()));
          } catch {}

          recordChatModelUsed(model);
          clearGemini429Cooldown();

          return {
            text,
            modelUsed: model,
            provider: 'gemini',
            ...(lastPcTaskId ? { pcTaskId: lastPcTaskId } : {}),
          };
        } catch (err: any) {
          lastGeminiError = err;
          const status = err?.status || (err?.isTimeout ? 408 : 0);
          errorTrace[`gemini_${model}_attempt_${attemptCount}`] = {
            model,
            attempt: attemptCount,
            status,
            error: err?.parsedJson || err?.rawBody || err?.message || String(err),
          };

          // If 404: model not found/deprecated, do not retry same model
          if (status === 404) {
            try {
              if (localStorage.getItem(WORKING_MODEL_KEY) === model) {
                localStorage.removeItem(WORKING_MODEL_KEY);
                localStorage.removeItem(WORKING_MODEL_TIME_KEY);
              }
            } catch {}
            break;
          }

          if (!shouldRetryGeminiError(err)) {
            // Non-retryable error (e.g. 400, 401, 403)
            try {
              if (localStorage.getItem(WORKING_MODEL_KEY) === model) {
                localStorage.removeItem(WORKING_MODEL_KEY);
                localStorage.removeItem(WORKING_MODEL_TIME_KEY);
              }
            } catch {}
            break;
          }

          if (attemptCount >= maxAttempts) {
            try {
              if (localStorage.getItem(WORKING_MODEL_KEY) === model) {
                localStorage.removeItem(WORKING_MODEL_KEY);
                localStorage.removeItem(WORKING_MODEL_TIME_KEY);
              }
            } catch {}
          }
        }
      }

      if (lastGeminiError && !shouldRetryGeminiError(lastGeminiError) && lastGeminiError?.status !== 404) {
        break;
      }
    }

    const geminiHit429 = is429Error(lastGeminiError);
    if (geminiHit429 && hasGemini) {
      markGemini429Cooldown(geminiCooldownKey);
    }

    // All Gemini models failed -> try fallback if user saved a key
    if (hasFallbackKey && deadline - Date.now() > 1200) {
      try {
        setWaitingStatus(groqKey ? 'Groq বিকল্প চেষ্টা করছি…' : 'বিকল্প চেষ্টা করছি…');
        console.log('[TypedChat] All Gemini models failed. Falling back to alternative engine...');
        return await tryFallbackEngine();
      } catch (fallbackErr: any) {
        fallbackErr.geminiHad429 = geminiHit429;
        fallbackErr.lastGeminiError = lastGeminiError;
        throw fallbackErr;
      }
    }

    const finalErr = lastGeminiError || new Error('HTTP 503: All Gemini models busy');
    finalErr.geminiHad429 = geminiHit429;
    throw finalErr;
  };

  try {
    return await Promise.race([runChatFlow(), timeoutPromise]);
  } catch (err: any) {
    const geminiHad429 = Boolean(err?.geminiHad429 || is429Error(err) || is429Error(err?.lastGeminiError));
    const fallbackAttempted = Boolean(errorTrace.groq_primary || errorTrace.openrouter);
    const groqStatus = Number(errorTrace.groq_primary?.status || 0);
    const geminiStatus = Number(err?.status || err?.lastGeminiError?.status || 0);
    const lastFailedModel = err?.modelUsed || err?.lastGeminiError?.modelUsed || 'gemini';

    let shortBengaliMsg = '';
    if (err?.isNoKey) {
      shortBengaliMsg = NO_GEMINI_KEY_MSG;
    } else if (!hasFallbackKey) {
      shortBengaliMsg = 'Gemini সার্ভার এখন ব্যস্ত, একটু পরে আবার চেষ্টা করো';
    } else if (geminiHad429) {
      if (fallbackAttempted) {
        if (groqStatus === 429) {
          shortBengaliMsg = 'আজকের ফ্রি সীমা শেষ, বিকল্পের সীমাও শেষ (HTTP 429)';
        } else if (groqStatus === 401 || groqStatus === 403) {
          shortBengaliMsg = 'আজকের ফ্রি সীমা শেষ, বিকল্প কী-ও কাজ করছে না (Invalid Key)';
        } else {
          shortBengaliMsg = 'আজকের ফ্রি সীমা শেষ, বিকল্পও কাজ করছে না';
        }
      } else {
        shortBengaliMsg = QUOTA_429_MSG;
      }
    } else if (geminiStatus === 400 || geminiStatus === 401 || geminiStatus === 403) {
      if (fallbackAttempted) {
        shortBengaliMsg = `Gemini কী সঠিক নয় (HTTP ${geminiStatus}), বিকল্প কী-ও কাজ করছে না`;
      } else {
        shortBengaliMsg = `Gemini কী সঠিক নয় (HTTP ${geminiStatus})। Settings → CONNECTIONS-এ কী পরীক্ষা করো।`;
      }
    } else if (err?.isTimeout || geminiStatus === 408) {
      if (fallbackAttempted) {
        shortBengaliMsg = 'সময় শেষ (Timeout), বিকল্প কী-ও কাজ করছে না';
      } else {
        shortBengaliMsg = 'সময় শেষ (Timeout) — ২৫ সেকেন্ডের মধ্যে উত্তর আসেনি।';
      }
    } else if (geminiStatus === 503 || geminiStatus === 500) {
      if (fallbackAttempted) {
        shortBengaliMsg = `Gemini সার্ভার ব্যস্ত (HTTP ${geminiStatus}), বিকল্প কী-ও কাজ করছে না`;
      } else {
        shortBengaliMsg = `Gemini সার্ভার এখন ব্যস্ত (HTTP ${geminiStatus})। একটু পরে আবার চেষ্টা করো।`;
      }
    } else {
      shortBengaliMsg = formatRealGeminiError(err, geminiStatus);
    }

    recordDiagnosticError(geminiStatus || err?.status || 503, lastFailedModel, shortBengaliMsg);

    const rawJsonStr = redactSecrets(
      JSON.stringify(
        Object.keys(errorTrace).length > 0
          ? errorTrace
          : { error: err?.parsedJson || err?.rawBody || err?.message || String(err) },
        null,
        2
      ),
      [apiKey, groqKey, openRouterKey]
    );

    const finalErr: any = new Error(shortBengaliMsg);
    finalErr.shortBengaliMsg = shortBengaliMsg;
    finalErr.rawJson = rawJsonStr;
    finalErr.status = err?.status || geminiStatus;
    finalErr.modelUsed = lastFailedModel;
    finalErr.rawError = err;
    throw finalErr;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    masterController.abort();
    setWaitingStatus('');
  }
}
