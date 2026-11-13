import { getGeminiKey, ensureGeminiReady } from './geminiKey';
import { fetchGeminiModelsWithFallback, fetchGeminiGenerateWithFallback } from './geminiDirect';
import { buildRoseSystemInstruction } from './roseConfig';
import { getDynamicGroqChatModels, getProviderKey } from './chatEngines';
import { cleanAssistantReplyText } from './ai-service';
import { ROSE_TYPED_CHAT_FUNCTION_DECLARATIONS } from './team';
import { executePcTaskTool } from '../pc/pcTaskManager';
import { executeOfficeTaskTool } from './officeSync';

export const NO_GEMINI_KEY_MSG = 'Gemini key সেভ করা নেই। Settings → CONNECTIONS-এ কী বসাও।';
export const QUOTA_429_MSG = 'আজকের ফ্রি সীমা শেষ। পরে চেষ্টা করো বা নতুন কী দাও।';

const TOTAL_CHAT_TIMEOUT_MS = 20000;
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
    } catch {
      // keep cleanMessage as-is
    }
  }

  // Strip any lingering JSON block from the short message
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
    return 'সময় শেষ (Timeout) — ২০ সেকেন্ডের মধ্যে উত্তর আসেনি। আবার চেষ্টা করো।';
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

export async function getValidFlashModels(apiKey: string, signal?: AbortSignal): Promise<string[]> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const cachedStr = localStorage.getItem('gemini_cached_chat_models');
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (Array.isArray(cached?.models) && cached.models.length > 0 && Date.now() - Number(cached.timestamp || 0) < 3600000) {
          const flashList = cached.models.filter((m: string) => typeof m === 'string' && m.toLowerCase().includes('flash'));
          if (flashList.length >= 2) return flashList;
        }
      }
    }
  } catch {}

  try {
    const res = await fetchGeminiModelsWithFallback(apiKey, signal);
    if (!res.ok) return ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models : [];

    const valid: string[] = [];
    for (const m of models) {
      const rawName = typeof m?.name === 'string' ? m.name : '';
      const shortName = rawName.replace(/^models\//, '').trim();
      const lower = shortName.toLowerCase();
      const methods: string[] = Array.isArray(m?.supportedGenerationMethods)
        ? m.supportedGenerationMethods
        : Array.isArray(m?.supportedActions)
          ? m.supportedActions
          : [];

      if (
        shortName &&
        methods.includes('generateContent') &&
        !lower.includes('tts') &&
        !lower.includes('live') &&
        !lower.includes('audio') &&
        !lower.includes('image') &&
        !lower.includes('embedding')
      ) {
        valid.push(shortName);
      }
    }

    valid.sort((a, b) => {
      const aFlash = a.toLowerCase().includes('flash') ? 1 : 0;
      const bFlash = b.toLowerCase().includes('flash') ? 1 : 0;
      if (aFlash !== bFlash) return bFlash - aFlash;

      const vA = parseFloat(a.match(/[\d.]+/)?.[0] || '0');
      const vB = parseFloat(b.match(/[\d.]+/)?.[0] || '0');
      if (vA !== vB) return vB - vA;

      return b.localeCompare(a);
    });

    if (valid.length > 0) {
      try {
        localStorage.setItem('gemini_cached_chat_models', JSON.stringify({ models: valid, timestamp: Date.now() }));
      } catch {}
      return valid;
    }
  } catch (e) {
    console.warn('[TypedChat] Model discovery failed:', e);
  }
  return ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
}

export async function resolveChatModel(apiKey: string, signal?: AbortSignal): Promise<string> {
  const chosen = (localStorage.getItem('chat_model') || '').replace(/^models\//, '').trim();
  if (chosen && !chosen.includes('gemini-2.5')) {
    return chosen;
  }

  const validModels = await getValidFlashModels(apiKey, signal);
  if (chosen && validModels.includes(chosen) && !chosen.includes('gemini-2.5')) {
    return chosen;
  }

  if (validModels.length > 0) {
    const best = validModels.find((m) => m.toLowerCase().includes('flash') && !m.includes('gemini-2.5')) || validModels[0];
    localStorage.setItem('chat_model', best);
    return best;
  }

  return chosen || 'gemini-4-hydrogen';
}

function shouldFallbackGeminiError(err: any): boolean {
  const status = Number(err?.status || 0);
  const msg = String(err?.message || err?.rawBody || '').toLowerCase();
  if (
    status === 429 ||
    status === 503 ||
    status === 500 ||
    status === 408 ||
    status === 404 ||
    err?.isTimeout ||
    err?.name === 'AbortError' ||
    /\b429\b|\b503\b|\b500\b|resource_exhausted|quota|rate limit|timed?\s*out|abort|unavailable|overloaded/i.test(msg)
  ) {
    return true;
  }
  return false;
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
  userText: string
): Promise<{ text: string; modelUsed: string; provider?: 'gemini' | 'groq'; providerLabel?: string; pcTaskId?: string }> {
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
  let currentModel = (localStorage.getItem('chat_model') || 'gemini-4-hydrogen').replace(/^models\//, '').trim();

  const errorTrace: Record<string, any> = {};

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      masterController.abort();
      const tErr: any = new Error('HTTP 408: Request timed out after 20 seconds');
      tErr.status = 408;
      tErr.isTimeout = true;
      tErr.modelUsed = currentModel;
      reject(tErr);
    }, TOTAL_CHAT_TIMEOUT_MS);
  });

  // Clean last 20 messages (exclude system/error messages and avoid duplicating trailing userText)
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

  const last20 = cleanHistory.slice(-20);

  let settings: any = {};
  let prefs: any = {};
  try {
    const s = localStorage.getItem('iyabd_settings');
    if (s) settings = JSON.parse(s);
    const p = localStorage.getItem('iyabd_preferences') || localStorage.getItem('iyabd_prefs');
    if (p) prefs = JSON.parse(p);
  } catch {}

  const sysInstructionText = buildRoseSystemInstruction(settings, prefs, false);

  const tryGroqFallback = async (): Promise<{ text: string; modelUsed: string; provider: 'groq'; providerLabel: string }> => {
    if (!groqKey) {
      const noGroqErr: any = new Error('No Groq key saved');
      noGroqErr.noGroqKey = true;
      throw noGroqErr;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 800) {
      const tErr: any = new Error('Groq fallback timed out');
      tErr.status = 408;
      tErr.isTimeout = true;
      throw tErr;
    }

    let groqModel = getSelectedGroqModelFromSettings();
    let availableGroqModels: string[] = [];

    if (!groqModel) {
      const disc = await getDynamicGroqChatModels(groqKey, false);
      availableGroqModels = disc.models || [];
      groqModel = availableGroqModels[0] || 'llama-3.3-70b-versatile';
    }

    const executeGroqCall = async (targetGroqModel: string): Promise<string> => {
      const stepTime = Math.min(9000, Math.max(1500, deadline - Date.now() - 200));
      const { signal, cleanup } = createStepSignal(masterController.signal, stepTime);
      try {
        const groqMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: sysInstructionText },
          ...last20.map((m) => ({
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
            model: targetGroqModel,
            messages: groqMessages,
            temperature: 0.7,
            max_tokens: 1024,
          }),
          signal,
        });

        const rawText = await res.text().catch(() => '');
        if (!res.ok) {
          let parsedJson: any = rawText;
          try {
            parsedJson = rawText ? JSON.parse(rawText) : rawText;
          } catch {}
          const err: any = new Error(`Groq HTTP ${res.status}`);
          err.status = res.status;
          err.rawBody = rawText;
          err.parsedJson = parsedJson;
          err.modelUsed = targetGroqModel;
          throw err;
        }

        const data = rawText ? JSON.parse(rawText) : {};
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content === 'string' && content.trim()) {
          return cleanAssistantReplyText(content.trim());
        }
        const emptyErr: any = new Error('Groq returned empty response');
        emptyErr.status = 200;
        emptyErr.rawBody = rawText;
        throw emptyErr;
      } finally {
        cleanup();
      }
    };

    try {
      const reply = await executeGroqCall(groqModel);
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
      errorTrace.groq_primary = {
        model: groqModel,
        status: firstGroqErr?.status || 0,
        error: firstGroqErr?.parsedJson || firstGroqErr?.rawBody || firstGroqErr?.message || String(firstGroqErr),
      };

      // If the selected Groq model was not found / decommissioned (400/404), try the first available model from Groq's model list
      if ((firstGroqErr?.status === 400 || firstGroqErr?.status === 404) && deadline - Date.now() > 2000) {
        const disc = await getDynamicGroqChatModels(groqKey, true);
        const firstAvailable = disc.models?.find((m) => m !== groqModel) || disc.models?.[0];
        if (firstAvailable && firstAvailable !== groqModel) {
          try {
            const reply = await executeGroqCall(firstAvailable);
            try {
              localStorage.setItem('active_model_groq', firstAvailable);
            } catch {}
            return {
              text: reply,
              modelUsed: firstAvailable,
              provider: 'groq',
              providerLabel: 'Groq দিয়ে উত্তর',
            };
          } catch (secondGroqErr: any) {
            errorTrace.groq_fallback = {
              model: firstAvailable,
              status: secondGroqErr?.status || 0,
              error: secondGroqErr?.parsedJson || secondGroqErr?.rawBody || secondGroqErr?.message || String(secondGroqErr),
            };
            throw secondGroqErr;
          }
        }
      }
      throw firstGroqErr;
    }
  };

  const runChatFlow = async (): Promise<{ text: string; modelUsed: string; provider?: 'gemini' | 'groq'; providerLabel?: string }> => {
    // Requirement 4: Remember for 10 minutes that Gemini returned 429, and go straight to Groq during that time
    const geminiCooldownKey = apiKey || 'server';
    const in429Cooldown = hasGemini ? isGeminiIn429Cooldown(geminiCooldownKey) : false;
    if ((!hasGemini || in429Cooldown) && groqKey) {
      if (in429Cooldown) {
        console.log('[TypedChat] Gemini in 10-min 429 cooldown — going straight to Groq');
        errorTrace.gemini_cooldown = {
          reason: 'Gemini returned HTTP 429 within the last 10 minutes; routed directly to Groq',
        };
      }
      try {
        return await tryGroqFallback();
      } catch (groqErr: any) {
        groqErr.geminiHad429 = in429Cooldown;
        throw groqErr;
      }
    }

    // Step 1: Gemini (current model)
    currentModel = await resolveChatModel(apiKey, masterController.signal);
    console.log('[TypedChat] Trying primary Gemini model:', currentModel);

    const geminiContents = [
      ...last20.map((m) => ({
        role: m.role === 'model' || m.role === 'assistant' || m.role === 'rose' ? 'model' : 'user',
        parts: [{ text: String(m.content || m.text || '').trim() }],
      })),
      { role: 'user', parts: [{ text: userText.trim() }] },
    ];

    let lastPcTaskId: string | undefined;

    const geminiBody: any = {
      systemInstruction: { parts: [{ text: sysInstructionText }] },
      contents: geminiContents,
      tools: [{ functionDeclarations: ROSE_TYPED_CHAT_FUNCTION_DECLARATIONS }],
      generationConfig: { temperature: 0.8 },
    };

    const executeGeminiFetch = async (targetModel: string, maxStepMs: number): Promise<string> => {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 400) {
        const tErr: any = new Error('HTTP 408: Request timed out');
        tErr.status = 408;
        tErr.isTimeout = true;
        tErr.modelUsed = targetModel;
        throw tErr;
      }

      const { signal, cleanup } = createStepSignal(masterController.signal, Math.min(maxStepMs, remainingMs));
      try {
        const res = await fetchGeminiGenerateWithFallback(
          {
            model: targetModel,
            ...geminiBody,
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

        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const fcPart = parts.find((p: any) => p && p.functionCall);
        if (fcPart?.functionCall?.name) {
          const fcName = String(fcPart.functionCall.name);
          const fcArgs = fcPart.functionCall.args || {};
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
        const textPart = parts.find((p: any) => p && typeof p.text === 'string')?.text;
        if (typeof textPart !== 'string' || !textPart.trim()) {
          const blockReason = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason;
          const errObj: any = new Error(
            blockReason ? `HTTP 200: Empty response (${blockReason})` : 'HTTP 200: Empty response from Gemini API'
          );
          errObj.status = 200;
          errObj.rawBody = JSON.stringify(data);
          errObj.parsedJson = data;
          errObj.modelUsed = targetModel;
          throw errObj;
        }
        return textPart;
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

    let primaryGeminiErr: any = null;
    let secondaryGeminiErr: any = null;

    try {
      const text = await executeGeminiFetch(currentModel, 8500);
      return {
        text,
        modelUsed: currentModel,
        provider: 'gemini',
        ...(lastPcTaskId ? { pcTaskId: lastPcTaskId } : {}),
      };
    } catch (err1: any) {
      primaryGeminiErr = err1;
      errorTrace.gemini_primary = {
        model: currentModel,
        status: err1?.status || (err1?.isTimeout ? 408 : 0),
        error: err1?.parsedJson || err1?.rawBody || err1?.message || String(err1),
      };
      console.warn('[TypedChat] Primary Gemini model failed:', currentModel, err1?.status || err1?.message);
    }

    // Step 2: If primary Gemini failed with HTTP 429, 503, 500 or timeout (or 404), try another available Gemini flash model once
    if (shouldFallbackGeminiError(primaryGeminiErr) && deadline - Date.now() > 2500) {
      try {
        setWaitingStatus('একটু অপেক্ষা…');
        const validFlashModels = await getValidFlashModels(apiKey, masterController.signal);
        const fallbackCandidates = [
          ...validFlashModels.filter((m) => m.toLowerCase().includes('flash')),
          'gemini-4-hydrogen',
          'gemini-3.1-flash-lite',
          'gemini-2.5-flash',
        ];
        const altModel = fallbackCandidates.find((m) => m && m !== currentModel && !m.includes('gemini-2.5'));

        if (altModel && altModel !== currentModel) {
          console.log('[TypedChat] Trying secondary Gemini flash model once:', altModel);
          const text = await executeGeminiFetch(altModel, 6000);
          localStorage.setItem('chat_model', altModel);
          return {
            text,
            modelUsed: altModel,
            provider: 'gemini',
            ...(lastPcTaskId ? { pcTaskId: lastPcTaskId } : {}),
          };
        }
      } catch (err2: any) {
        secondaryGeminiErr = err2;
        errorTrace.gemini_fallback = {
          model: err2?.modelUsed || 'gemini-flash-fallback',
          status: err2?.status || (err2?.isTimeout ? 408 : 0),
          error: err2?.parsedJson || err2?.rawBody || err2?.message || String(err2),
        };
        console.warn('[TypedChat] Secondary Gemini flash model also failed:', err2?.status || err2?.message);
      }
    }

    const geminiHit429 = is429Error(primaryGeminiErr) || is429Error(secondaryGeminiErr);
    if (geminiHit429 && hasGemini) {
      markGemini429Cooldown(geminiCooldownKey);
    }

    // Step 3: If Gemini also fails → use Groq (if a Groq key is saved)
    if (groqKey && deadline - Date.now() > 1200) {
      try {
        setWaitingStatus('একটু অপেক্ষা…');
        console.log('[TypedChat] Falling back to Groq...');
        return await tryGroqFallback();
      } catch (groqErr: any) {
        groqErr.geminiHad429 = geminiHit429;
        groqErr.primaryGeminiErr = primaryGeminiErr;
        groqErr.secondaryGeminiErr = secondaryGeminiErr;
        throw groqErr;
      }
    }

    const finalGeminiErr = secondaryGeminiErr || primaryGeminiErr || new Error('HTTP 503: Cannot reach Gemini');
    finalGeminiErr.geminiHad429 = geminiHit429;
    throw finalGeminiErr;
  };

  try {
    return await Promise.race([runChatFlow(), timeoutPromise]);
  } catch (err: any) {
    const geminiHad429 = Boolean(err?.geminiHad429 || is429Error(err) || is429Error(err?.primaryGeminiErr));
    const groqAttempted = Boolean(errorTrace.groq_primary || errorTrace.groq_fallback);
    const groqStatus = Number(errorTrace.groq_fallback?.status || errorTrace.groq_primary?.status || 0);
    const geminiStatus = Number(
      errorTrace.gemini_fallback?.status ||
        errorTrace.gemini_primary?.status ||
        err?.status ||
        0
    );

    let shortBengaliMsg = '';
    if (err?.isNoKey) {
      shortBengaliMsg = NO_GEMINI_KEY_MSG;
    } else if (geminiHad429) {
      if (groqAttempted) {
        if (groqStatus === 429) {
          shortBengaliMsg = 'আজকের ফ্রি সীমা শেষ, Groq-এর সীমাও শেষ (HTTP 429)';
        } else if (groqStatus === 401 || groqStatus === 403) {
          shortBengaliMsg = 'আজকের ফ্রি সীমা শেষ, Groq কী-ও কাজ করছে না (Invalid Key)';
        } else {
          shortBengaliMsg = 'আজকের ফ্রি সীমা শেষ, Groq কী-ও কাজ করছে না';
        }
      } else {
        shortBengaliMsg = QUOTA_429_MSG;
      }
    } else if (geminiStatus === 400 || geminiStatus === 401 || geminiStatus === 403) {
      if (groqAttempted) {
        shortBengaliMsg = `Gemini কী সঠিক নয় (HTTP ${geminiStatus}), Groq কী-ও কাজ করছে না`;
      } else {
        shortBengaliMsg = `Gemini কী সঠিক নয় (HTTP ${geminiStatus})। Settings → CONNECTIONS-এ কী পরীক্ষা করো।`;
      }
    } else if (err?.isTimeout || geminiStatus === 408) {
      if (groqAttempted) {
        shortBengaliMsg = 'সময় শেষ (Timeout), Groq কী-ও কাজ করছে না';
      } else {
        shortBengaliMsg = 'সময় শেষ (Timeout) — ২০ সেকেন্ডের মধ্যে উত্তর আসেনি।';
      }
    } else if (geminiStatus === 503 || geminiStatus === 500) {
      if (groqAttempted) {
        shortBengaliMsg = `Gemini সার্ভার ব্যস্ত (HTTP ${geminiStatus}), Groq কী-ও কাজ করছে না`;
      } else {
        shortBengaliMsg = `Gemini সার্ভার এখন ব্যস্ত (HTTP ${geminiStatus})। পরে চেষ্টা করো।`;
      }
    } else {
      shortBengaliMsg = formatRealGeminiError(err, geminiStatus);
    }

    const rawJsonStr = redactSecrets(
      JSON.stringify(
        Object.keys(errorTrace).length > 0
          ? errorTrace
          : { error: err?.parsedJson || err?.rawBody || err?.message || String(err) },
        null,
        2
      ),
      [apiKey, groqKey]
    );

    const finalErr: any = new Error(shortBengaliMsg);
    finalErr.shortBengaliMsg = shortBengaliMsg;
    finalErr.rawJson = rawJsonStr;
    finalErr.status = err?.status || geminiStatus;
    finalErr.modelUsed = err?.modelUsed || currentModel;
    finalErr.rawError = err;
    throw finalErr;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    masterController.abort();
    setWaitingStatus('');
  }
}
