import { prepareHistory, extractLastUserText } from './ai-utils';
import { getGeminiKey, ensureGeminiReady } from './geminiKey';
import {
  fetchGeminiModelsWithFallback,
  fetchGeminiGenerateWithFallback,
  fetchGeminiStreamWithFallback,
  fetchGeminiTtsWithFallback,
} from './geminiDirect';
import {
  isAdmin,
  ADMIN_PREFERRED_VOICES,
  formatAdminTtsPrompt,
  applyAdminSystemInstructionOverride,
} from './admin';
import { logDevError } from './devLog';

const TEXT_MODELS: string[] = [];
export { TEXT_MODELS };

const WORKING_MODEL_STORAGE_KEY = 'working_gemini_text_model';
const WORKING_MODEL_TIME_STORAGE_KEY = 'working_gemini_text_model_ms';
const WORKING_MODEL_RESET_FLAG = 'working_gemini_text_model_reset_v3';

export const MAX_FAST_WORKING_MODEL_MS = 8000;
export const GEMINI_HEDGE_DELAY_MS = 5000;
export const GEMINI_PER_REQUEST_TIMEOUT_MS = 25000;
export const GEMINI_TOTAL_CHAIN_TIMEOUT_MS = 25000;
const GEMINI_TTS_PER_REQUEST_TIMEOUT_MS = 15000;
const GEMINI_TTS_TOTAL_CHAIN_TIMEOUT_MS = 40000;

export interface GeminiAttemptLog {
  model: string;
  status: string | number;
  seconds: string;
  error?: string;
}

const ensureOneTimeWorkingModelReset = () => {
  try {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(WORKING_MODEL_RESET_FLAG) !== 'true') {
      localStorage.removeItem(WORKING_MODEL_STORAGE_KEY);
      localStorage.removeItem(WORKING_MODEL_TIME_STORAGE_KEY);
      localStorage.setItem(WORKING_MODEL_RESET_FLAG, 'true');
    }
  } catch (e) {}
};

ensureOneTimeWorkingModelReset();

export const sanitizeOutApiKey = (text: string, apiKey?: string): string => {
  if (!text) return '';
  let out = String(text);
  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();
  if (cleanKey && cleanKey.length > 4) {
    out = out.split(cleanKey).join('[REDACTED]');
  }
  out = out.replace(/AIza[0-9A-Za-z\-_]+/g, '[REDACTED]');
  out = out.replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED]');
  return out;
};

export const formatGeminiErrorForUI = (
  err: any,
  apiKey?: string
): { bengaliMessage: string; debugLine: string } => {
  const modelName = String(
    err?.modelName || getSavedWorkingTextModel() || TEXT_MODELS[0] || 'gemini'
  )
    .replace(/^models\//, '')
    .trim();

  const isTimeout =
    Boolean(err?.isTimeout) ||
    err?.status === 'timeout' ||
    /timed?\s*out|timeout|aborted/i.test(
      String(err?.googleMessage || err?.message || '')
    );

  const statusVal = isTimeout
    ? 'timeout'
    : err?.status !== undefined && err?.status !== null && err?.status !== ''
      ? String(err.status)
      : 'error';

  const timeSec =
    err?.elapsedSeconds !== undefined
      ? String(err.elapsedSeconds)
      : isTimeout
        ? '25.0'
        : '0.0';

  const errName = String(err?.name || 'Error');
  const errMessage = String(err?.googleMessage || err?.message || err || 'Unknown error');
  const httpStatus = err?.status || err?.statusCode || '';
  const bodySnippet = String(err?.bodyText || err?.responseBody || '').slice(0, 200);

  const originalDetail = `${errName}: ${errMessage}${httpStatus ? ` (HTTP ${httpStatus})` : ''}${bodySnippet ? ` | Body: ${bodySnippet}` : ''}`;
  const sanitizedFullText = sanitizeOutApiKey(originalDetail, apiKey).trim();

  const attempts: GeminiAttemptLog[] = Array.isArray(err?.attempts) ? err.attempts : [];
  const baseDebug =
    attempts.length > 0
      ? attempts
          .map((a) => `${a.model} | ${a.status} | ${String(a.seconds).replace(/s$/i, '')}s`)
          .join('\n')
      : `${modelName} | ${statusVal} | ${String(timeSec).replace(/s$/i, '')}s`;

  const debugLine = `${baseDebug}\n${sanitizedFullText}`;

  if (/key নেই|Add your Gemini key|missing_key/i.test(sanitizedFullText) || statusVal === 'missing_key') {
    return {
      bengaliMessage: 'Gemini key নেই। Settings → Connections-এ key দিন।',
      debugLine,
    };
  }

  if (sanitizedFullText.startsWith('Gemini ') || sanitizedFullText.startsWith('Groq ')) {
    return {
      bengaliMessage: sanitizedFullText,
      debugLine,
    };
  }

  if (sanitizedFullText.startsWith('নেটওয়ার্ক সমস্যা') || statusVal === 'network_error') {
    return {
      bengaliMessage: sanitizedFullText.startsWith('নেটওয়ার্ক সমস্যা:')
        ? sanitizedFullText
        : `নেটওয়ার্ক সমস্যা: ${sanitizedFullText}`,
      debugLine,
    };
  }

  const numStatus = Number(statusVal);
  if (!isNaN(numStatus) && numStatus > 0) {
    return {
      bengaliMessage: `Gemini ${numStatus}: ${sanitizedFullText}`,
      debugLine,
    };
  }

  return {
    bengaliMessage: `Gemini error: ${sanitizedFullText}`,
    debugLine,
  };
};

const isDeprecatedOrLiveModel = (modelName?: string): boolean => {
  if (!modelName) return true;
  const clean = modelName.replace(/^models\//, '').trim().toLowerCase();
  if (!clean || !clean.startsWith('gemini')) return true;
  if (
    clean.includes('native-audio') ||
    clean.includes('live') ||
    clean.includes('tts')
  ) {
    return true;
  }
  return false;
};

export const getSavedWorkingTextModel = (): string | null => {
  try {
    if (typeof window === 'undefined') return null;
    ensureOneTimeWorkingModelReset();
    const saved = (localStorage.getItem(WORKING_MODEL_STORAGE_KEY) || '')
      .replace(/^models\//, '')
      .trim();
    if (!saved) return null;

    if (isDeprecatedOrLiveModel(saved)) {
      localStorage.removeItem(WORKING_MODEL_STORAGE_KEY);
      localStorage.removeItem(WORKING_MODEL_TIME_STORAGE_KEY);
      return null;
    }

    const savedMsRaw = localStorage.getItem(WORKING_MODEL_TIME_STORAGE_KEY);
    const savedMs = savedMsRaw !== null ? Number(savedMsRaw) : NaN;
    if (isNaN(savedMs) || savedMs >= MAX_FAST_WORKING_MODEL_MS) {
      localStorage.removeItem(WORKING_MODEL_STORAGE_KEY);
      localStorage.removeItem(WORKING_MODEL_TIME_STORAGE_KEY);
      return null;
    }

    return saved;
  } catch (e) {}
  return null;
};

export const saveWorkingTextModel = (modelName: string, elapsedMs?: number) => {
  try {
    if (typeof window === 'undefined') return;
    ensureOneTimeWorkingModelReset();
    const clean = modelName.replace(/^models\//, '').trim();
    if (!clean || isDeprecatedOrLiveModel(clean)) return;

    if (elapsedMs !== undefined) {
      if (elapsedMs < MAX_FAST_WORKING_MODEL_MS) {
        localStorage.setItem(WORKING_MODEL_STORAGE_KEY, clean);
        localStorage.setItem(WORKING_MODEL_TIME_STORAGE_KEY, String(Math.round(elapsedMs)));
      } else {
        clearWorkingTextModelIfMatches(clean);
      }
    }
  } catch (e) {}
};

const clearWorkingTextModelIfMatches = (failedModel: string) => {
  try {
    if (typeof window === 'undefined') return;
    const current = localStorage.getItem(WORKING_MODEL_STORAGE_KEY);
    if (current && current.replace(/^models\//, '').trim() === failedModel.replace(/^models\//, '').trim()) {
      localStorage.removeItem(WORKING_MODEL_STORAGE_KEY);
      localStorage.removeItem(WORKING_MODEL_TIME_STORAGE_KEY);
    }
  } catch (e) {}
};

const isMinimalBodyStoredForModel = (modelName: string): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    const clean = modelName.replace(/^models\//, '').trim();
    return localStorage.getItem(`use_minimal_body_${clean}`) === 'true';
  } catch (e) {
    return false;
  }
};

const storeMinimalBodyForModel = (modelName: string) => {
  try {
    if (typeof window === 'undefined') return;
    const clean = modelName.replace(/^models\//, '').trim();
    localStorage.setItem(`use_minimal_body_${clean}`, 'true');
  } catch (e) {}
};

const isRetryableModelStatus = (status: any): boolean => {
  if (status === 'timeout' || status === 'network_error') return true;
  const code = Number(status);
  return (
    code === 400 ||
    code === 404 ||
    code === 408 ||
    code === 429 ||
    code === 500 ||
    code === 502 ||
    code === 503 ||
    code === 504
  );
};

const buildOrderedModelList = (requestedModel?: string): string[] => {
  const ordered: string[] = [];
  const savedWorkingModel = getSavedWorkingTextModel();
  if (savedWorkingModel) {
    ordered.push(savedWorkingModel);
  }
  for (const m of TEXT_MODELS) {
    if (!ordered.includes(m)) {
      ordered.push(m);
    }
  }
  if (requestedModel && !isDeprecatedOrLiveModel(requestedModel)) {
    const cleanReq = String(requestedModel).replace(/^models\//, '').trim();
    if (cleanReq && !ordered.includes(cleanReq)) {
      ordered.push(cleanReq);
    }
  }
  return ordered;
};

export const discoverAvailableFlashModels = async (
  apiKey?: string,
  excludeModels: Set<string> = new Set()
): Promise<string[]> => {
  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();
  if (!(await ensureGeminiReady(cleanKey))) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try {
        controller.abort();
      } catch (e) {}
    }, 6000);
    const res = await fetchGeminiModelsWithFallback(cleanKey, controller.signal);
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models : [];

    const discovered: string[] = [];
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
        lower.includes('flash') &&
        !isDeprecatedOrLiveModel(shortName) &&
        !lower.includes('image') &&
        !lower.includes('vision') &&
        !excludeModels.has(shortName)
      ) {
        discovered.push(shortName);
      }
    }
    return discovered;
  } catch (e) {
    console.warn('[Gemini] Automatic model discovery failed:', e);
    return [];
  }
};

export const isValidVoiceTranscript = (text?: string, durationSec?: number): boolean => {
  if (!text) return false;
  if (typeof durationSec === 'number' && durationSec < 0.4) {
    return false;
  }
  const clean = String(text).trim();
  if (!clean || clean.length < 2) return false;

  // Reject timer-like strings (e.g., "00:00", "01:23"), placeholder strings like "(user audio)"
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(clean) || clean === '(user audio)') {
    return false;
  }

  const lower = clean.toLowerCase();
  if (/^(los|um|uh|ah|er|hm|hmm|ঁ|h|a|o|e|buraya|los\.?)$/i.test(lower)) {
    return false;
  }

  // Allow Bengali script (\u0980-\u09FF), Latin script (a-zA-Z), ASCII & Bengali digits (0-9\u09E6-\u09EF), whitespace, standard punctuation
  const invalidCharRegex = /[^\u0980-\u09FFa-zA-Z0-9\u09E6-\u09EF\s\.,!\?\-'"’`:;()।]/;
  if (invalidCharRegex.test(clean)) {
    return false;
  }

  // Must contain at least one Bengali or Latin letter
  if (!/[\u0980-\u09FFa-zA-Z]/.test(clean)) {
    return false;
  }

  return true;
};

export const discoverLightestFlashModel = async (apiKey?: string): Promise<string> => {
  const cleanKey = String(apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();
  if (!(await ensureGeminiReady(cleanKey))) return '';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetchGeminiModelsWithFallback(cleanKey, controller.signal);
    clearTimeout(timer);
    if (!res.ok) return '';
    const data = await res.json();
    const models: any[] = Array.isArray(data?.models) ? data.models : [];

    const flashLite: string[] = [];
    const flashStd: string[] = [];

    for (const m of models) {
      const rawName = String(m?.name || '').replace(/^models\//, '').trim();
      const lower = rawName.toLowerCase();
      const methods: string[] = Array.isArray(m?.supportedGenerationMethods)
        ? m.supportedGenerationMethods
        : Array.isArray(m?.supportedActions)
          ? m.supportedActions
          : [];
      if (
        rawName &&
        methods.includes('generateContent') &&
        lower.includes('flash') &&
        !isDeprecatedOrLiveModel(rawName) &&
        !lower.includes('image') &&
        !lower.includes('vision')
      ) {
        if (lower.includes('flash-lite') || lower.includes('lite')) {
          flashLite.push(rawName);
        } else {
          flashStd.push(rawName);
        }
      }
    }

    if (flashLite.length > 0) return flashLite[0];
    if (flashStd.length > 0) return flashStd[0];
  } catch {}
  return '';
};

const execGeminiWithSignalTimeout = async (
  runner: (signal: AbortSignal) => Promise<Response>,
  timeoutMs: number,
  modelName = TEXT_MODELS[0] || 'gemini',
  reqStartTime = Date.now(),
  cleanKey = '',
  externalSignal?: AbortSignal
): Promise<Response> => {
  const controller = new AbortController();
  const onExternalAbort = () => {
    try {
      controller.abort(externalSignal?.reason || 'aborted');
    } catch (e) {
      controller.abort();
    }
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      onExternalAbort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  const timer = setTimeout(() => {
    try {
      controller.abort('timeout');
    } catch (e) {
      controller.abort();
    }
  }, timeoutMs);

  try {
    return await runner(controller.signal);
  } catch (err: any) {
    const elapsedSeconds = ((Date.now() - reqStartTime) / 1000).toFixed(1);
    const reason = controller.signal.reason || externalSignal?.reason;
    if (reason === 'hedged_winner') {
      const cancelErr: any = new Error('Cancelled because another model replied first');
      cancelErr.isHedgedCancel = true;
      cancelErr.modelName = modelName;
      cancelErr.elapsedSeconds = elapsedSeconds;
      throw cancelErr;
    }
    if (err?.name === 'AbortError' || reason === 'timeout' || reason === 'overall_timeout') {
      const timeoutSec = Math.round(timeoutMs / 1000);
      const tErr: any = new Error(`Request timed out after ${elapsedSeconds}s`);
      tErr.isTimeout = true;
      tErr.status = 'timeout';
      tErr.modelName = modelName;
      tErr.elapsedSeconds = elapsedSeconds;
      tErr.googleMessage = `Request timed out after ${timeoutSec}s`;
      tErr.bodyText = tErr.googleMessage;
      throw tErr;
    }
    const rawMsg = sanitizeOutApiKey(
      String(err?.message || 'Cannot reach Gemini. Check your internet and your Gemini key.'),
      cleanKey
    );
    const netErr: any = new Error('Cannot reach Gemini. Check your internet and your Gemini key.');
    netErr.status = 'network_error';
    netErr.modelName = modelName;
    netErr.elapsedSeconds = elapsedSeconds;
    netErr.googleMessage = rawMsg;
    netErr.bodyText = 'Cannot reach Gemini. Check your internet and your Gemini key.';
    throw netErr;
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
};

export const NO_THOUGHT_INSTRUCTION =
  'নিজের ভাবনা, পরিকল্পনা বা কী করবে তা লিখবে না। শুধু সরাসরি উত্তর দাও, ব্যবহারকারীর ভাষায়।';

export const ensureNoThoughtSystemInstruction = (sysText?: string): string => {
  const base = String(sysText || '').trim();
  if (!base) return applyAdminSystemInstructionOverride(NO_THOUGHT_INSTRUCTION);
  if (base.includes('নিজের ভাবনা, পরিকল্পনা বা কী করবে তা লিখবে না')) {
    return applyAdminSystemInstructionOverride(base);
  }
  return applyAdminSystemInstructionOverride(`${base}\n\n${NO_THOUGHT_INSTRUCTION}`);
};

const ENGLISH_THOUGHT_PATTERNS =
  /\b(i'm working on|i am working on|i'll make sure|i will make sure|the user|since '|since "|since the user|my goal is|i need to|i should|let's|let me|thinking about|crafting a|formulating a|responding to|addressing the|in bengali|in bangla|i'll respond|i will respond|i'll reply|i will reply|keeping it|make it sweet|affectionate tone|as rose|user asked|boss asked)\b/i;

const isMostlyEnglishParagraph = (para: string): boolean => {
  const trimmed = para.trim();
  if (!trimmed) return false;
  // If it contains any Bengali characters, it is NOT a pure-English paragraph
  if (/[\u0980-\u09FF]/.test(trimmed)) return false;
  const latinLetters = (trimmed.match(/[A-Za-z]/g) || []).length;
  return latinLetters >= 3;
};

/**
 * Safety filter that runs on all assistant reply paths:
 * (a) Removes one-line **Heading** titles (e.g. **Crafting a Response**) and any English thought paragraph immediately following it.
 * (b) If the user's language is Bengali (or the reply contains Bengali), removes pure-English paragraphs that appear before the Bengali reply.
 * Never returns an empty string if the input was non-empty (falls back to original text).
 */
export const cleanAssistantReplyText = (
  rawText: string,
  preferredLang: string = 'bn'
): string => {
  const original = String(rawText || '').trim();
  if (!original) return '';

  let working = original;

  // Remove <think>...</think> blocks if any model emits them
  working = working.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // (a1) Handle inline "**Heading** English thought... <Bengali text>" on the same line/paragraph
  working = working.replace(
    /^\s*\*\*[^*\n]{2,80}\*\*\s*([^\u0980-\u09FF\n]+)(?=[\u0980-\u09FF])/g,
    (fullMatch, englishMiddle) => {
      if (ENGLISH_THOUGHT_PATTERNS.test(englishMiddle) || isMostlyEnglishParagraph(englishMiddle)) {
        return '';
      }
      return fullMatch;
    }
  ).trim();

  // (a2) Split into paragraphs/lines to strip **Heading** and the following English thought paragraph(s)
  const paragraphs = working.split(/\n\s*\n/);
  const filteredParagraphs: string[] = [];
  let skipNextIfEnglishThought = false;

  for (let i = 0; i < paragraphs.length; i++) {
    let p = paragraphs[i].trim();
    if (!p) continue;

    // Check if paragraph starts with a **Heading** line followed by a newline inside the same block
    const lines = p.split('\n');
    if (lines.length >= 2 && /^\*\*[^*\n]{2,80}\*\*$/.test(lines[0].trim())) {
      const restOfBlock = lines.slice(1).join('\n').trim();
      if (
        !restOfBlock ||
        ENGLISH_THOUGHT_PATTERNS.test(restOfBlock) ||
        isMostlyEnglishParagraph(restOfBlock)
      ) {
        // Check if restOfBlock has Bengali at the end after English sentences
        const firstBengaliIdx = restOfBlock.search(/[\u0980-\u09FF]/);
        if (firstBengaliIdx > 0) {
          const beforeBn = restOfBlock.slice(0, firstBengaliIdx);
          if (ENGLISH_THOUGHT_PATTERNS.test(beforeBn) || !/[\u0980-\u09FF]/.test(beforeBn)) {
            p = restOfBlock.slice(firstBengaliIdx).trim();
          } else {
            p = restOfBlock;
          }
        } else {
          skipNextIfEnglishThought = true;
          continue;
        }
      } else {
        p = restOfBlock;
      }
    } else if (/^\*\*[^*\n]{2,80}\*\*$/.test(p)) {
      // Single-line **Heading** paragraph
      skipNextIfEnglishThought = true;
      continue;
    } else if (/^\*\*[^*\n]{2,80}\*\*\s+/.test(p)) {
      // Paragraph starts with "**Heading** ..." on the same line
      const withoutHeading = p.replace(/^\*\*[^*\n]{2,80}\*\*\s+/, '').trim();
      const firstBengaliIdx = withoutHeading.search(/[\u0980-\u09FF]/);
      if (firstBengaliIdx === -1) {
        if (ENGLISH_THOUGHT_PATTERNS.test(withoutHeading) || isMostlyEnglishParagraph(withoutHeading)) {
          skipNextIfEnglishThought = true;
          continue;
        }
      } else if (firstBengaliIdx > 0) {
        const englishPrefix = withoutHeading.slice(0, firstBengaliIdx);
        if (ENGLISH_THOUGHT_PATTERNS.test(englishPrefix) || isMostlyEnglishParagraph(englishPrefix)) {
          p = withoutHeading.slice(firstBengaliIdx).trim();
        }
      }
    }

    if (skipNextIfEnglishThought) {
      skipNextIfEnglishThought = false;
      if (ENGLISH_THOUGHT_PATTERNS.test(p) || isMostlyEnglishParagraph(p)) {
        const firstBengaliIdx = p.search(/[\u0980-\u09FF]/);
        if (firstBengaliIdx > 0) {
          p = p.slice(firstBengaliIdx).trim();
        } else {
          continue;
        }
      }
    }

    // Also strip standalone English meta-thought paragraphs that match thought patterns
    if (!/[\u0980-\u09FF]/.test(p) && ENGLISH_THOUGHT_PATTERNS.test(p)) {
      continue;
    }

    filteredParagraphs.push(p);
  }

  working = filteredParagraphs.join('\n\n').trim();

  // (b) If user's language is Bengali (or reply contains Bengali), remove pure-English paragraphs appearing BEFORE Bengali paragraphs
  const isBengaliContext =
    !preferredLang ||
    preferredLang === 'auto' ||
    preferredLang.toLowerCase().startsWith('bn') ||
    /[\u0980-\u09FF]/.test(working);

  if (isBengaliContext && /[\u0980-\u09FF]/.test(working)) {
    const blocks = working.split(/\n+/).map((b) => b.trim()).filter(Boolean);
    const firstBnBlockIdx = blocks.findIndex((b) => /[\u0980-\u09FF]/.test(b));
    if (firstBnBlockIdx > 0) {
      const leadingBlocks = blocks.slice(0, firstBnBlockIdx);
      const allLeadingAreEnglish = leadingBlocks.every((b) => isMostlyEnglishParagraph(b));
      if (allLeadingAreEnglish) {
        working = blocks.slice(firstBnBlockIdx).join('\n\n').trim();
      }
    }

    // Also if the first Bengali block itself starts with an English thought sentence (e.g. "I'm working on a sweet reply! আসসালামু আলাইকুম...")
    const firstBnCharIdx = working.search(/[\u0980-\u09FF]/);
    if (firstBnCharIdx > 0) {
      const leadingSlice = working.slice(0, firstBnCharIdx).trim();
      if (
        ENGLISH_THOUGHT_PATTERNS.test(leadingSlice) ||
        (leadingSlice.length > 20 && /^[A-Za-z0-9\s,.'":;!?()\-*]+$/.test(leadingSlice))
      ) {
        working = working.slice(firstBnCharIdx).trim();
      }
    }
  }

  return working.trim() || original;
};

/**
 * Extracts text from Gemini response parts while strictly skipping any part with `thought === true`.
 */
export const extractNonThoughtTextFromParts = (
  parts: any[],
  preferredLang: string = 'bn'
): string => {
  if (!Array.isArray(parts) || parts.length === 0) return '';
  const nonThoughtParts = parts.filter((p: any) => p && p.thought !== true);
  const joined = nonThoughtParts
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();
  if (!joined) return '';
  return cleanAssistantReplyText(joined, preferredLang);
};

/**
 * Converts Settings Volume Slider (0-100, default 80%) to clean WebAudio Gain (0.9 default/max, never above 1.0).
 */
export const volumeSliderToGain = (volumePercent?: number): number => {
  if (typeof volumePercent === 'number' && !isNaN(volumePercent) && volumePercent <= 0) {
    return 0;
  }
  const v =
    typeof volumePercent === 'number' && !isNaN(volumePercent) && volumePercent > 0
      ? volumePercent
      : 80;
  const clamped = Math.min(100, Math.max(1, v));
  if (clamped >= 80) {
    return 0.9; // 0.9 at 80%-100%, never above 1.0
  }
  return Math.min(0.9, Math.max(0.1, (clamped / 80) * 0.9));
};

/**
 * Decodes base64 16-bit little-endian PCM into Float32Array (value / 32768) while carrying any odd leftover byte to the next chunk.
 */
export const decodePcm16ChunkWithCarry = (
  base64Pcm: string,
  leftoverByte: number | null
): { float32: Float32Array<ArrayBuffer>; nextLeftoverByte: number | null } => {
  const binaryStr = atob(base64Pcm);
  const rawLen = binaryStr.length;
  const hasCarry = leftoverByte !== null && leftoverByte !== undefined;
  const totalBytesLen = rawLen + (hasCarry ? 1 : 0);
  if (totalBytesLen <= 0) {
    return { float32: new Float32Array(0), nextLeftoverByte: null };
  }

  const bytes = new Uint8Array(totalBytesLen);
  let writeIdx = 0;
  if (hasCarry) {
    bytes[writeIdx++] = leftoverByte & 0xff;
  }
  for (let i = 0; i < rawLen; i++) {
    bytes[writeIdx++] = binaryStr.charCodeAt(i) & 0xff;
  }

  const nextLeftoverByte = totalBytesLen % 2 === 1 ? bytes[totalBytesLen - 1] : null;
  const sampleCount = Math.floor(totalBytesLen / 2);
  if (sampleCount <= 0) {
    return { float32: new Float32Array(0), nextLeftoverByte };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }

  return { float32, nextLeftoverByte };
};

interface PersistentOutputChain {
  gainNode: GainNode;
  compressor: DynamicsCompressorNode;
  connectedAnalyser: AnalyserNode | null;
  route: 'direct' | 'background';
  backgroundDest: AudioNode | null;
}

const persistentOutputChains = new WeakMap<AudioContext, PersistentOutputChain>();

const wireExclusiveChainTarget = (
  ctx: AudioContext,
  chain: PersistentOutputChain,
  route: 'direct' | 'background',
  backgroundDest: AudioNode | null,
  analyser: AnalyserNode | null
) => {
  const validAnalyser = analyser && analyser.context === ctx ? analyser : null;
  const effectiveRoute: 'direct' | 'background' =
    route === 'background' && backgroundDest ? 'background' : 'direct';
  const targetNode: AudioNode = effectiveRoute === 'background' ? backgroundDest! : ctx.destination;

  try {
    chain.compressor.disconnect();
  } catch {}
  if (chain.connectedAnalyser) {
    try {
      chain.connectedAnalyser.disconnect();
    } catch {}
  }
  if (validAnalyser && validAnalyser !== chain.connectedAnalyser) {
    try {
      validAnalyser.disconnect();
    } catch {}
  }

  if (validAnalyser) {
    chain.compressor.connect(validAnalyser);
    validAnalyser.connect(targetNode);
  } else {
    chain.compressor.connect(targetNode);
  }

  chain.connectedAnalyser = validAnalyser;
  chain.route = effectiveRoute;
  chain.backgroundDest = effectiveRoute === 'background' ? backgroundDest : null;
};

export const getOrCreateBoostedOutputChain = (
  ctx: AudioContext,
  volumePercent?: number,
  analyser?: AnalyserNode | null
): { gainNode: GainNode; compressor: DynamicsCompressorNode } => {
  let chain = persistentOutputChains.get(ctx);
  const validAnalyser = analyser && analyser.context === ctx ? analyser : null;

  if (!chain) {
    const gainNode = ctx.createGain();
    const targetGain = volumeSliderToGain(volumePercent);
    gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-6, ctx.currentTime);
    compressor.knee.setValueAtTime(10, ctx.currentTime);
    compressor.ratio.setValueAtTime(4, ctx.currentTime);
    compressor.attack.setValueAtTime(0.01, ctx.currentTime);
    compressor.release.setValueAtTime(0.15, ctx.currentTime);

    gainNode.connect(compressor);

    chain = {
      gainNode,
      compressor,
      connectedAnalyser: null,
      route: 'direct',
      backgroundDest: null,
    };
    persistentOutputChains.set(ctx, chain);
    wireExclusiveChainTarget(ctx, chain, 'direct', null, validAnalyser);
  } else if (chain.connectedAnalyser !== validAnalyser) {
    wireExclusiveChainTarget(ctx, chain, chain.route, chain.backgroundDest, validAnalyser);
  }

  return { gainNode: chain.gainNode, compressor: chain.compressor };
};

export const configureBoostedOutputRoute = (
  ctx: AudioContext,
  route: 'direct' | 'background',
  backgroundDest: AudioNode | null,
  analyser?: AnalyserNode | null,
  volumePercent?: number,
  sessionId?: string
): { route: 'direct' | 'background'; gainNode: GainNode; compressor: DynamicsCompressorNode } => {
  const { gainNode, compressor } = getOrCreateBoostedOutputChain(ctx, volumePercent, analyser);
  const chain = persistentOutputChains.get(ctx)!;
  wireExclusiveChainTarget(ctx, chain, route, backgroundDest, analyser || null);
  console.log(
    `[AudioRoute] session=${sessionId || 'app'} route=${
      chain.route === 'background' ? 'background(<audio>)' : 'direct(AudioContext.destination)'
    }`
  );
  return { route: chain.route, gainNode, compressor };
};

export const resetOutputGainForReply = (
  ctx: AudioContext,
  volumePercent?: number,
  analyser?: AnalyserNode | null
): { gainNode: GainNode; compressor: DynamicsCompressorNode; targetGain: number } => {
  const { gainNode, compressor } = getOrCreateBoostedOutputChain(ctx, volumePercent, analyser);
  const targetGain = volumeSliderToGain(volumePercent);
  gainNode.gain.cancelScheduledValues(ctx.currentTime);
  gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);
  return { gainNode, compressor, targetGain };
};

/**
 * Ramps the output GainNode down over 30ms (fade-out) and then stops & disconnects the given sources
 * so sources are never stopped abruptly (preventing clicks/pops on end, interrupt, or END button).
 */
export const fadeOutAndStopSources = (
  ctx: AudioContext | null | undefined,
  sources: Iterable<AudioBufferSourceNode>,
  fadeSec = 0.03
): void => {
  const list = Array.from(sources);
  for (const s of list) {
    try {
      s.onended = null;
    } catch {}
  }
  if (list.length === 0) return;

  if (!ctx || ctx.state === 'closed') {
    for (const s of list) {
      try {
        s.stop();
      } catch {}
      try {
        s.disconnect();
      } catch {}
    }
    return;
  }

  const chain = persistentOutputChains.get(ctx);
  if (chain && ctx.state === 'running') {
    try {
      const now = ctx.currentTime;
      const currentVal = Math.min(0.9, Math.max(0, chain.gainNode.gain.value || 0.9));
      chain.gainNode.gain.cancelScheduledValues(now);
      chain.gainNode.gain.setValueAtTime(currentVal, now);
      chain.gainNode.gain.linearRampToValueAtTime(0, now + fadeSec);
    } catch {}
  }

  const delayMs = Math.max(10, Math.round(fadeSec * 1000) + 4);
  setTimeout(() => {
    for (const s of list) {
      try {
        s.stop();
      } catch {}
      try {
        s.disconnect();
      } catch {}
    }
  }, delayMs);
};

/**
 * Connects an AudioNode (source) through the persistent clean output chain:
 * source -> GainNode (gain 0.9, never > 1.0) -> DynamicsCompressorNode (threshold -6, ratio 4, gentle) -> (AnalyserNode) -> destination
 */
export const connectBoostedOutputChain = (
  ctx: AudioContext,
  source: AudioNode,
  volumePercent?: number,
  analyser?: AnalyserNode | null
): { gainNode: GainNode; compressor: DynamicsCompressorNode } => {
  const { gainNode, compressor } = getOrCreateBoostedOutputChain(ctx, volumePercent, analyser);
  source.connect(gainNode);
  return { gainNode, compressor };
};

const buildBodyForRequest = (
  contents: any[],
  systemInstruction?: any,
  generationConfig?: any,
  isMinimal = false,
  thinkingMode: 'full' | 'no_budget' | 'none' = 'full',
  tools?: any[]
) => {
  const rawSysText =
    typeof systemInstruction === 'string'
      ? systemInstruction
      : (systemInstruction as any)?.parts?.[0]?.text || '';
  const sysText = ensureNoThoughtSystemInstruction(rawSysText);

  const applyThinkingConfig = (cfg: any) => {
    if (thinkingMode === 'full') {
      cfg.thinkingConfig = {
        includeThoughts: false,
        thinkingBudget: 0,
      };
    } else if (thinkingMode === 'no_budget') {
      cfg.thinkingConfig = {
        includeThoughts: false,
      };
    }
    return cfg;
  };

  const hasRichParts =
    Array.isArray(contents) &&
    contents.some(
      (c: any) =>
        Array.isArray(c?.parts) &&
        c.parts.some((p: any) => p?.inlineData || p?.inline_data || p?.fileData)
    );

  if (isMinimal) {
    if (hasRichParts) {
      const lastItem = contents[contents.length - 1] || contents[0];
      const body: any = {
        contents: [
          {
            role: 'user',
            parts: Array.isArray(lastItem?.parts) ? lastItem.parts : [{ text: extractLastUserText(contents) }],
          },
        ],
        generationConfig: applyThinkingConfig({
          maxOutputTokens: generationConfig?.maxOutputTokens ?? 150,
        }),
      };
      if (sysText.trim()) {
        body.systemInstruction = {
          parts: [{ text: sysText.trim() }],
        };
      }
      if (tools && Array.isArray(tools) && tools.length > 0) {
        body.tools = tools;
      }
      return body;
    }

    const lastUserText = extractLastUserText(contents);
    const body: any = {
      contents: [{ role: 'user', parts: [{ text: lastUserText }] }],
      generationConfig: applyThinkingConfig({
        maxOutputTokens: generationConfig?.maxOutputTokens ?? 150,
      }),
    };
    if (sysText.trim()) {
      body.systemInstruction = {
        parts: [{ text: sysText.trim() }],
      };
    }
    if (tools && Array.isArray(tools) && tools.length > 0) {
      body.tools = tools;
    }
    return body;
  }

  const genConfig: any = applyThinkingConfig({
    maxOutputTokens: generationConfig?.maxOutputTokens ?? 150,
  });
  if (generationConfig?.temperature !== undefined) {
    genConfig.temperature = generationConfig.temperature;
  }

  const body: any = {
    contents: hasRichParts ? contents : prepareHistory(contents),
    generationConfig: genConfig,
  };

  if (sysText.trim()) {
    body.systemInstruction = {
      parts: [{ text: sysText.trim() }],
    };
  }

  if (tools && Array.isArray(tools) && tools.length > 0) {
    body.tools = tools;
  }

  return body;
};

const callGeminiTextEndpoint = async (params: {
  model: string;
  contents: any[];
  systemInstruction?: string;
  generationConfig?: any;
  apiKey?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  tools?: any[];
}) => {
  const {
    model,
    contents,
    systemInstruction,
    generationConfig,
    apiKey,
    timeoutMs = GEMINI_PER_REQUEST_TIMEOUT_MS,
    signal,
    tools,
  } = params;

  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();

  if (!(await ensureGeminiReady(cleanKey))) {
    const missingErr: any = new Error('Add your Gemini key in Settings > Connections.');
    missingErr.status = 400;
    missingErr.googleMessage = 'API key ঠিক নেই';
    throw missingErr;
  }

  const cleanModel =
    String(model || getSavedWorkingTextModel() || 'gemini-4-hydrogen').replace(/^models\//, '').trim();
  if (!cleanModel) {
    throw new Error('মডেল পাওয়া যায়নি');
  }

  const startMinimal = isMinimalBodyStoredForModel(cleanModel);
  const directBody = buildBodyForRequest(
    contents,
    systemInstruction,
    generationConfig,
    startMinimal,
    'full',
    tools || [{ googleSearch: {} }]
  );

  const reqStartTime = Date.now();
  const perReqTimeout = Math.min(GEMINI_PER_REQUEST_TIMEOUT_MS, Math.max(1000, timeoutMs));

  const buildProxyPayload = (bodyObj: any) => ({
    model: cleanModel,
    contents: bodyObj.contents,
    systemInstruction: bodyObj.systemInstruction,
    generationConfig: bodyObj.generationConfig,
    tools: bodyObj.tools,
    ...(cleanKey ? { apiKey: cleanKey } : {}),
  });

  let res = await execGeminiWithSignalTimeout(
    (sig) => fetchGeminiGenerateWithFallback(buildProxyPayload(directBody), sig),
    perReqTimeout,
    cleanModel,
    reqStartTime,
    cleanKey,
    signal
  );

  // AUTO-RETRY ON 400: if model doesn't accept thinkingBudget: 0 or thinkingConfig, retry without it
  if (res.status === 400 && !signal?.aborted) {
    const fallbackBody = buildBodyForRequest(
      contents,
      systemInstruction,
      generationConfig,
      startMinimal,
      'none',
      tools || [{ googleSearch: {} }]
    );
    const remainingMs = Math.max(2000, perReqTimeout - (Date.now() - reqStartTime));
    const retryRes = await execGeminiWithSignalTimeout(
      (sig) => fetchGeminiGenerateWithFallback(buildProxyPayload(fallbackBody), sig),
      remainingMs,
      cleanModel,
      reqStartTime,
      cleanKey,
      signal
    );
    res = retryRes;

    if (res.status === 400 && !startMinimal && !signal?.aborted) {
      const minimalBody = buildBodyForRequest(
        contents,
        systemInstruction,
        generationConfig,
        true,
        'none',
        tools || [{ googleSearch: {} }]
      );
      const remMs2 = Math.max(2000, perReqTimeout - (Date.now() - reqStartTime));
      const retryRes2 = await execGeminiWithSignalTimeout(
        (sig) => fetchGeminiGenerateWithFallback(buildProxyPayload(minimalBody), sig),
        remMs2,
        cleanModel,
        reqStartTime,
        cleanKey,
        signal
      );
      if (retryRes2.ok) {
        storeMinimalBodyForModel(cleanModel);
      }
      res = retryRes2;
    }
  }

  const elapsedMs = Date.now() - reqStartTime;
  const elapsedSeconds = (elapsedMs / 1000).toFixed(1);
  const rawBodyText = await res.text().catch(() => '');

  let parsed: any = null;
  try {
    parsed = rawBodyText ? JSON.parse(rawBodyText) : null;
  } catch (parseErr) {
    const msg = `Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.modelName = cleanModel;
    err.elapsedSeconds = elapsedSeconds;
    err.googleMessage = sanitizeOutApiKey(rawBodyText || msg, cleanKey);
    err.bodyText = msg;
    throw err;
  }

  if (!parsed || typeof parsed !== 'object') {
    const msg = `Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.modelName = cleanModel;
    err.elapsedSeconds = elapsedSeconds;
    err.googleMessage = msg;
    err.bodyText = msg;
    throw err;
  }

  if (!res.ok) {
    const rawGoogleErr = sanitizeOutApiKey(
      parsed?.error?.message || `HTTP ${res.status}`,
      cleanKey
    );
    const googleErrMsg = parsed?.error?.message
      ? `${rawGoogleErr} (HTTP ${res.status})`
      : `Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`;
    
    const err: any = new Error(googleErrMsg);
    err.status = res.status;
    err.modelName = cleanModel;
    err.elapsedSeconds = elapsedSeconds;
    err.googleMessage = rawGoogleErr;
    err.errorDetails = parsed?.error?.details;
    err.bodyText = googleErrMsg;
    
    // Log the real error for debugging
    console.error('[Gemini API Error]', {
      status: res.status,
      message: parsed?.error?.message,
      reason: parsed?.error?.status,
      model: cleanModel
    });
    
    throw err;
  }

  const rawParts = parsed?.candidates?.[0]?.content?.parts || [];
  const nonThoughtParts = rawParts.filter((p: any) => p && p.thought !== true);
  if (parsed?.candidates?.[0]?.content) {
    parsed.candidates[0].content.parts = nonThoughtParts.map((p: any) =>
      typeof p?.text === 'string' ? { ...p, text: cleanAssistantReplyText(p.text) } : p
    );
  }

  const replyText = extractNonThoughtTextFromParts(rawParts);

  if (!replyText && !nonThoughtParts.some((p: any) => p?.functionCall)) {
    const emptyErr: any = new Error(`Empty reply from ${cleanModel}`);
    emptyErr.status = 'empty';
    emptyErr.modelName = cleanModel;
    emptyErr.elapsedSeconds = elapsedSeconds;
    emptyErr.googleMessage = 'Empty reply received from Gemini';
    throw emptyErr;
  }

  return {
    ...parsed,
    text: replyText,
    groundingMetadata: parsed?.candidates?.[0]?.groundingMetadata,
    modelUsed: cleanModel,
    elapsedMs,
    elapsedSeconds,
  };
};

export const directGeminiGenerate = async (payload: any) => {
  const { contents, systemInstruction, generationConfig, apiKey, model, tools } = payload || {};

  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();

  if (!(await ensureGeminiReady(cleanKey))) {
    const missingErr: any = new Error('Gemini key নেই। Settings → Connections-এ key দিন।');
    missingErr.bodyText = 'Gemini key নেই। Settings → Connections-এ key দিন।';
    missingErr.googleMessage = 'Gemini key নেই। Settings → Connections-এ key দিন।';
    missingErr.modelName = getSavedWorkingTextModel() || 'gemini';
    missingErr.status = 'missing_key';
    missingErr.elapsedSeconds = '0.0';
    missingErr.attempts = [
      {
        model: missingErr.modelName,
        status: 'missing_key',
        seconds: '0.0',
      },
    ];
    throw missingErr;
  }

  const normalizedContents = Array.isArray(contents) ? contents : [];
  const hasRichParts = normalizedContents.some(
    (c: any) =>
      Array.isArray(c?.parts) &&
      c.parts.some(
        (p: any) => p?.inlineData || p?.inline_data || p?.functionCall || p?.functionResponse
      )
  );

  const preparedContents = hasRichParts
    ? normalizedContents
    : prepareHistory(normalizedContents);

  const overallStart = Date.now();
  const deadline = overallStart + GEMINI_TOTAL_CHAIN_TIMEOUT_MS;
  let initialModels = buildOrderedModelList(model);
  if (initialModels.length === 0) {
    const discoveredInitial = await discoverAvailableFlashModels(cleanKey);
    initialModels = discoveredInitial.length > 0 ? discoveredInitial.slice(0, 3) : ['gemini-4-hydrogen'];
  }

  const runAllAttempts = async (currentTools?: any[]): Promise<any> => {
    const triedModels = new Set<string>();
    const attempts: GeminiAttemptLog[] = [];
    let lastError: any = null;

    const overallController = new AbortController();
    const overallTimer = setTimeout(() => {
      try {
        overallController.abort('overall_timeout');
      } catch (e) {
        overallController.abort();
      }
    }, GEMINI_TOTAL_CHAIN_TIMEOUT_MS);

    const runSingleAttempt = async (
      candidateModel: string,
      parentSignal: AbortSignal
    ): Promise<any> => {
      const remainingMs = Math.max(1000, deadline - Date.now());
      const attemptStart = Date.now();
      triedModels.add(candidateModel);
      try {
        const result = await callGeminiTextEndpoint({
          model: candidateModel,
          contents: preparedContents,
          systemInstruction,
          generationConfig,
          apiKey: cleanKey,
          timeoutMs: remainingMs,
          signal: parentSignal,
          tools: currentTools,
        });
        saveWorkingTextModel(candidateModel, result.elapsedMs);
        return result;
      } catch (err: any) {
        if (err?.isHedgedCancel) {
          throw err;
        }
        const elapsedSec =
          err?.elapsedSeconds || ((Date.now() - attemptStart) / 1000).toFixed(1);
        const statusStr = err?.isTimeout
          ? 'timeout'
          : err?.status !== undefined
            ? String(err.status)
            : 'error';
        attempts.push({
          model: candidateModel,
          status: statusStr,
          seconds: String(elapsedSec).replace(/s$/i, ''),
          error: err?.googleMessage || err?.message,
        });
        lastError = err;
        clearWorkingTextModelIfMatches(candidateModel);
        throw err;
      }
    };

    try {
      if (initialModels.length >= 2) {
        const firstModel = initialModels[0];
        const secondModel = initialModels[1];
        const ctrl1 = new AbortController();
        const ctrl2 = new AbortController();
        const onOverallAbort = () => {
          try { ctrl1.abort('overall_timeout'); } catch (e) {}
          try { ctrl2.abort('overall_timeout'); } catch (e) {}
        };
        overallController.signal.addEventListener('abort', onOverallAbort, { once: true });

        const raceResult = await new Promise<any>((resolve, reject) => {
          let settled = false;
          let secondStarted = false;
          let pendingCount = 1;
          let hedgeTimer: any = null;
          const startSecond = () => {
            if (settled || secondStarted || Date.now() >= deadline || overallController.signal.aborted) {
              if (pendingCount === 0 && !settled) {
                settled = true;
                reject(lastError || new Error('Gemini request failed'));
              }
              return;
            }
            if (lastError && (lastError.status === 401 || lastError.status === 403)) {
              if (pendingCount === 0 && !settled) { settled = true; reject(lastError); }
              return;
            }
            secondStarted = true;
            pendingCount++;
            runSingleAttempt(secondModel, ctrl2.signal)
              .then((res) => {
                if (settled) return; settled = true;
                if (hedgeTimer) clearTimeout(hedgeTimer);
                try { ctrl1.abort('hedged_winner'); } catch (e) {}
                resolve(res);
              })
              .catch(() => {
                pendingCount--;
                if (pendingCount === 0 && !settled) {
                  settled = true; if (hedgeTimer) clearTimeout(hedgeTimer);
                  reject(lastError || new Error('Gemini request failed'));
                }
              });
          };
          hedgeTimer = setTimeout(() => { startSecond(); }, GEMINI_HEDGE_DELAY_MS);
          runSingleAttempt(firstModel, ctrl1.signal)
            .then((res) => {
              if (settled) return; settled = true;
              if (hedgeTimer) clearTimeout(hedgeTimer);
              try { ctrl2.abort('hedged_winner'); } catch (e) {}
              resolve(res);
            })
            .catch(() => {
              pendingCount--;
              if (hedgeTimer) { clearTimeout(hedgeTimer); hedgeTimer = null; }
              if (!secondStarted) { startSecond(); }
              else if (pendingCount === 0 && !settled) {
                settled = true; reject(lastError || new Error('Gemini request failed'));
              }
            });
        }).finally(() => {
          overallController.signal.removeEventListener('abort', onOverallAbort);
        });
        return raceResult;
      } else if (initialModels.length === 1) {
        return await runSingleAttempt(initialModels[0], overallController.signal);
      }
    } catch (raceErr: any) {
      if (lastError && (lastError.status === 401 || lastError.status === 403)) {
        lastError.attempts = attempts; throw lastError;
      }
      const remainingModels = initialModels.slice(2);
      for (const nextModel of remainingModels) {
        if (Date.now() >= deadline || overallController.signal.aborted) break;
        try { return await runSingleAttempt(nextModel, overallController.signal); }
        catch (err: any) { if (!isRetryableModelStatus(err?.status)) break; }
      }
      if (Date.now() + 2000 < deadline && !overallController.signal.aborted) {
        const discovered = await discoverAvailableFlashModels(cleanKey, triedModels);
        for (const dm of discovered) {
          if (Date.now() >= deadline || overallController.signal.aborted) break;
          try { return await runSingleAttempt(dm, overallController.signal); }
          catch (err: any) { if (!isRetryableModelStatus(err?.status)) break; }
        }
      }
    } finally {
      clearTimeout(overallTimer);
    }
    const finalErr: any = lastError || new Error('Cannot reach Gemini. Check your internet and your Gemini key.');
    finalErr.attempts = attempts;
    throw finalErr;
  };

  // Main execution with retry logic
  let currentTools = tools;
  let retryCount = 0;
  const maxRetries = 1;

  while (true) {
    try {
      return await runAllAttempts(currentTools);
    } catch (err: any) {
      const errMsg = String(err?.googleMessage || err?.message || '').toLowerCase();
      const isSearchToolError = errMsg.includes('google_search') || errMsg.includes('googlesearch') || errMsg.includes('tool');
      
      if (isSearchToolError && currentTools && currentTools.some((t: any) => t.googleSearch)) {
        console.warn('[Gemini] Retrying without googleSearch tool...');
        currentTools = currentTools.filter((t: any) => !t.googleSearch);
        continue; // Immediate retry without tool
      }

      if (retryCount < maxRetries) {
        console.warn(`[Gemini] Request failed, retrying in 500ms... (Attempt ${retryCount + 1})`, err);
        retryCount++;
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      // Final failure: attach short real reason to message
      if (err && !errMsg.includes('key')) {
        const shortReason = errMsg.length > 60 ? errMsg.slice(0, 60) + '...' : errMsg;
        err.googleMessage = `${err.googleMessage || 'Request failed'}\nReason: ${shortReason}`;
      }
      try {
        logDevError({
          area: 'chat',
          message: err?.message || 'Gemini generate failed',
          status: typeof err?.status === 'number' ? err.status : undefined,
          model: err?.modelName || model,
          details: err?.googleMessage || err?.stack,
        });
      } catch (e) {}
      throw err;
    }
  }
};

// Stream Gemini replies via SSE (:streamGenerateContent?alt=sse) and fall back to directGeminiGenerate if needed
export const directGeminiStream = async (
  payload: any,
  onTextChunk?: (deltaText: string) => void
) => {
  const { contents, systemInstruction, generationConfig, apiKey, model, tools, signal } = payload || {};

  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();

  if (!(await ensureGeminiReady(cleanKey))) {
    return await directGeminiGenerate(payload);
  }

  const runStreamAttempt = async (currentTools?: any[]): Promise<any> => {
    const normalizedContents = Array.isArray(contents) ? contents : [];
    const hasRichParts = normalizedContents.some(
      (c: any) =>
        Array.isArray(c?.parts) &&
        c.parts.some(
          (p: any) => p?.inlineData || p?.inline_data || p?.functionCall || p?.functionResponse
        )
    );
    const preparedContents = hasRichParts
      ? normalizedContents
      : prepareHistory(normalizedContents);
    const orderedModels = buildOrderedModelList(model);
    let primaryModel = String(orderedModels[0] || '').replace(/^models\//, '').trim();
    if (!primaryModel) {
      const discovered = await discoverAvailableFlashModels(cleanKey);
      primaryModel = discovered[0] || 'gemini-4-hydrogen';
    }

    const reqStartTime = Date.now();
    const startMinimal = isMinimalBodyStoredForModel(primaryModel);

    let accumulatedRawText = '';
    let emittedAnyChunk = false;
    let lastGroundingMetadata: any = null;
    const functionCallParts: any[] = [];

    const toProxyStreamPayload = (bodyObj: any) => ({
      model: primaryModel,
      contents: bodyObj.contents,
      systemInstruction: bodyObj.systemInstruction,
      generationConfig: bodyObj.generationConfig,
      tools: bodyObj.tools,
      ...(cleanKey ? { apiKey: cleanKey } : {}),
    });

    try {
      const directBody = buildBodyForRequest(
        preparedContents,
        systemInstruction,
        generationConfig,
        startMinimal,
        'full',
        currentTools || [{ googleSearch: {} }]
      );

      let res = await execGeminiWithSignalTimeout(
        (sig) => fetchGeminiStreamWithFallback(toProxyStreamPayload(directBody), sig),
        GEMINI_PER_REQUEST_TIMEOUT_MS,
        primaryModel,
        reqStartTime,
        cleanKey,
        signal
      );

      if (res.status === 400) {
        const fallbackBody = buildBodyForRequest(
          preparedContents,
          systemInstruction,
          generationConfig,
          startMinimal,
          'none',
          currentTools || [{ googleSearch: {} }]
        );
        const remainingMs = Math.max(2000, GEMINI_PER_REQUEST_TIMEOUT_MS - (Date.now() - reqStartTime));
        res = await execGeminiWithSignalTimeout(
          (sig) => fetchGeminiStreamWithFallback(toProxyStreamPayload(fallbackBody), sig),
          remainingMs,
          primaryModel,
          reqStartTime,
          cleanKey,
          signal
        );
      }

      if (!res.ok) {
        const rawBody = await res.text().catch(() => '');
        let parsed: any = null;
        try { parsed = JSON.parse(rawBody); } catch {}
        const rawGoogleErr = sanitizeOutApiKey(parsed?.error?.message || `HTTP ${res.status}`, cleanKey);
        const err: any = new Error(rawGoogleErr);
        err.status = res.status;
        err.googleMessage = rawGoogleErr;
        throw err;
      }

      if (res.body && typeof res.body.getReader === 'function') {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let lineBuffer = '';

        const processSseLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) return;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') return;
          try {
            const parsed = JSON.parse(jsonStr);
            const groundingMetadata = parsed?.candidates?.[0]?.groundingMetadata;
            if (groundingMetadata) { lastGroundingMetadata = groundingMetadata; }
            const parts = parsed?.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (!part || part.thought === true) continue;
              if (part.functionCall) { functionCallParts.push(part); }
              if (typeof part.text === 'string' && part.text.length > 0) {
                accumulatedRawText += part.text;
                emittedAnyChunk = true;
                if (typeof onTextChunk === 'function') { onTextChunk(part.text); }
              }
            }
          } catch {}
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split(/\r?\n/);
          lineBuffer = lines.pop() || '';
          for (const line of lines) { processSseLine(line); }
        }
        lineBuffer += decoder.decode();
        if (lineBuffer.trim()) {
          for (const line of lineBuffer.split(/\r?\n/)) { processSseLine(line); }
        }

        const finalCleaned = cleanAssistantReplyText(accumulatedRawText);
        if (finalCleaned || functionCallParts.length > 0) {
          const elapsedMs = Date.now() - reqStartTime;
          saveWorkingTextModel(primaryModel, elapsedMs);
          const resultParts: any[] = [];
          if (finalCleaned) { resultParts.push({ text: finalCleaned }); }
          return {
            candidates: [
              {
                content: { role: 'model', parts: resultParts },
                groundingMetadata: lastGroundingMetadata,
              },
            ],
            text: finalCleaned,
            groundingMetadata: lastGroundingMetadata,
            modelUsed: primaryModel,
            elapsedMs,
            elapsedSeconds: (elapsedMs / 1000).toFixed(1),
          };
        }
      }
    } catch (streamErr: any) {
      if (emittedAnyChunk && accumulatedRawText.trim()) {
        const partialCleaned = cleanAssistantReplyText(accumulatedRawText);
        if (partialCleaned) {
          return {
            candidates: [{ content: { role: 'model', parts: [{ text: partialCleaned }] } }],
            text: partialCleaned,
            modelUsed: primaryModel,
          };
        }
      }
      throw streamErr;
    }
    return await directGeminiGenerate(payload);
  };

  // Main stream execution with retry
  let currentTools = tools;
  let retryCount = 0;
  const maxRetries = 1;

  while (true) {
    try {
      return await runStreamAttempt(currentTools);
    } catch (err: any) {
      const errMsg = String(err?.googleMessage || err?.message || '').toLowerCase();
      const isSearchToolError = errMsg.includes('google_search') || errMsg.includes('googlesearch') || errMsg.includes('tool');

      if (isSearchToolError && currentTools && currentTools.some((t: any) => t.googleSearch)) {
        console.warn('[Gemini Stream] Retrying without googleSearch tool...');
        currentTools = currentTools.filter((t: any) => !t.googleSearch);
        continue;
      }

      if (retryCount < maxRetries) {
        console.warn(`[Gemini Stream] Request failed, retrying in 500ms...`, err);
        retryCount++;
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      
      if (err && !errMsg.includes('key')) {
        const shortReason = errMsg.length > 60 ? errMsg.slice(0, 60) + '...' : errMsg;
        err.googleMessage = `${err.googleMessage || 'Request failed'}\nReason: ${shortReason}`;
      }
      throw err;
    }
  }
};

export const runGeminiSpeedTest = async (
  apiKey?: string,
  onProgress?: (results: Array<{ model: string; text: string; ok: boolean; ms?: number }>) => void
): Promise<Array<{ model: string; text: string; ok: boolean; ms?: number }>> => {
  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();

  if (!(await ensureGeminiReady(cleanKey))) {
    return [{ model: 'gemini', text: 'Add your key first', ok: false }];
  }

  const results: Array<{ model: string; text: string; ok: boolean; ms?: number }> = [];
  let fastestModel: string | null = null;
  let fastestMs = Infinity;

  const discoveredFlash = await discoverAvailableFlashModels(cleanKey);
  const testModels = TEXT_MODELS.length > 0 ? TEXT_MODELS : discoveredFlash.slice(0, 4);

  for (const model of testModels) {
    const start = Date.now();
    try {
      const res = await execGeminiWithSignalTimeout(
        (sig) =>
          fetchGeminiGenerateWithFallback(
            {
              model,
              contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
              generationConfig: { maxOutputTokens: 10 },
              ...(cleanKey ? { apiKey: cleanKey } : {}),
            },
            sig
          ),
        12000,
        model,
        start,
        cleanKey
      );
      const elapsedMs = Date.now() - start;
      const sec = (elapsedMs / 1000).toFixed(2);
      const rawText = await res.text().catch(() => '');
      let parsed: any = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {}

      if (res.ok && (parsed?.text || parsed?.candidates?.[0]?.content?.parts?.[0]?.text)) {
        results.push({
          model,
          text: `${model}: ${sec} seconds`,
          ok: true,
          ms: elapsedMs,
        });
        if (elapsedMs < fastestMs) {
          fastestMs = elapsedMs;
          fastestModel = model;
        }
      } else {
        const errMsg = parsed?.error?.message
          ? `${parsed.error.message} (HTTP ${res.status})`
          : `HTTP ${res.status}`;
        results.push({
          model,
          text: `${model}: ${sanitizeOutApiKey(errMsg, cleanKey)}`,
          ok: false,
        });
      }
    } catch (err: any) {
      const sec = ((Date.now() - start) / 1000).toFixed(1);
      const msg = err?.isTimeout
        ? `timeout (${sec}s)`
        : sanitizeOutApiKey(err?.message || 'error', cleanKey);
      results.push({
        model,
        text: `${model}: ${msg}`,
        ok: false,
      });
    }
    if (onProgress) {
      onProgress([...results]);
    }
  }

  if (fastestModel && fastestMs < MAX_FAST_WORKING_MODEL_MS) {
    saveWorkingTextModel(fastestModel, fastestMs);
  }

  return results;
};

const CUSTOM_TTS_MODEL_STORAGE_KEY = 'rose_custom_tts_model';
const TTS_MODELS_CACHE_STORAGE_KEY = 'rose_tts_models_cache_v2';
const LAST_ACTIVE_TTS_MODEL_KEY = 'rose_last_active_tts_model';
const TTS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Clean up any stale legacy TTS model keys once on module load
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('working_gemini_tts_model');
    localStorage.removeItem('iyabd_tts_model');
  }
} catch {}

let cachedDiscoveredTtsModels: string[] = [];
let lastTtsDiscoveryTime = 0;
let lastTtsDiscoveryKeyPrefix = '';
let lastActiveTtsModelMemory = '';

function scoreTtsModelVersion(modelName: string): number {
  const lower = modelName.toLowerCase();
  const matches = Array.from(lower.matchAll(/(\d+)(?:\.(\d+))?/g));
  if (matches.length === 0) return 0;
  let best = 0;
  for (const m of matches) {
    const major = parseInt(m[1], 10) || 0;
    const minor = parseInt(m[2] || '0', 10) || 0;
    if (major <= 20) {
      const score = major * 1000 + minor * 100;
      if (score > best) best = score;
    }
  }
  return best;
}

export const getCustomTtsModel = (): string => {
  try {
    if (typeof window === 'undefined') return '';
    return (localStorage.getItem(CUSTOM_TTS_MODEL_STORAGE_KEY) || '')
      .replace(/^models\//, '')
      .trim();
  } catch {
    return '';
  }
};

export const setCustomTtsModel = (modelName: string): string => {
  const clean = String(modelName || '').replace(/^models\//, '').trim();
  try {
    if (typeof window !== 'undefined') {
      if (clean) {
        localStorage.setItem(CUSTOM_TTS_MODEL_STORAGE_KEY, clean);
      } else {
        localStorage.removeItem(CUSTOM_TTS_MODEL_STORAGE_KEY);
      }
    }
  } catch {}
  return clean;
};

export const getLastUsedTtsModel = (): string => {
  const custom = getCustomTtsModel();
  if (custom) return custom;
  if (lastActiveTtsModelMemory) return lastActiveTtsModelMemory;
  try {
    if (typeof window !== 'undefined') {
      const saved = (localStorage.getItem(LAST_ACTIVE_TTS_MODEL_KEY) || '')
        .replace(/^models\//, '')
        .trim();
      if (saved) return saved;
    }
  } catch {}
  if (cachedDiscoveredTtsModels.length > 0) return cachedDiscoveredTtsModels[0];
  return '';
};

const setLastUsedTtsModel = (modelName: string) => {
  const clean = String(modelName || '').replace(/^models\//, '').trim();
  if (!clean) return;
  lastActiveTtsModelMemory = clean;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAST_ACTIVE_TTS_MODEL_KEY, clean);
    }
  } catch {}
};

export const getCachedTtsModelsList = (): string[] => {
  if (cachedDiscoveredTtsModels.length > 0) return [...cachedDiscoveredTtsModels];
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(TTS_MODELS_CACHE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          Array.isArray(parsed.models) &&
          typeof parsed.timestamp === 'number' &&
          Date.now() - parsed.timestamp < TTS_CACHE_TTL_MS
        ) {
          cachedDiscoveredTtsModels = parsed.models;
          lastTtsDiscoveryTime = parsed.timestamp;
          lastTtsDiscoveryKeyPrefix = String(parsed.keyPrefix || '');
          return [...cachedDiscoveredTtsModels];
        }
      }
    }
  } catch {}
  return [];
};

export const discoverAvailableTtsModels = async (
  apiKey?: string,
  forceRefresh = false
): Promise<string[]> => {
  const cleanKey = String(apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();
  if (!(await ensureGeminiReady(cleanKey))) return [];

  const keyPrefix = cleanKey ? cleanKey.slice(0, 8) : 'server';
  const now = Date.now();

  if (!forceRefresh) {
    if (
      cachedDiscoveredTtsModels.length > 0 &&
      lastTtsDiscoveryKeyPrefix === keyPrefix &&
      now - lastTtsDiscoveryTime < TTS_CACHE_TTL_MS
    ) {
      return [...cachedDiscoveredTtsModels];
    }
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(TTS_MODELS_CACHE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            parsed &&
            Array.isArray(parsed.models) &&
            parsed.models.length > 0 &&
            parsed.keyPrefix === keyPrefix &&
            typeof parsed.timestamp === 'number' &&
            now - parsed.timestamp < TTS_CACHE_TTL_MS
          ) {
            cachedDiscoveredTtsModels = parsed.models;
            lastTtsDiscoveryTime = parsed.timestamp;
            lastTtsDiscoveryKeyPrefix = keyPrefix;
            return [...cachedDiscoveredTtsModels];
          }
        }
      }
    } catch {}
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetchGeminiModelsWithFallback(cleanKey, controller.signal);
    clearTimeout(timer);

    const data = res.ok ? await res.json().catch(() => null) : null;
    const allModels: any[] = Array.isArray(data?.models) ? data.models : [];

    const foundSet = new Set<string>();
    for (const m of allModels) {
      const rawName = String(m?.name || '');
      const shortName = rawName.replace(/^models\//, '').trim();
      const methods: string[] = Array.isArray(m?.supportedGenerationMethods)
        ? m.supportedGenerationMethods
        : Array.isArray(m?.supportedActions)
          ? m.supportedActions
          : [];
      if (shortName && methods.includes('generateContent') && shortName.toLowerCase().includes('tts')) {
        foundSet.add(shortName);
      }
    }

    const found = Array.from(foundSet);
    // Highest version number first; prefer flash over pro if same version
    found.sort((a, b) => {
      const diff = scoreTtsModelVersion(b) - scoreTtsModelVersion(a);
      if (diff !== 0) return diff;
      const aFlash = a.toLowerCase().includes('flash') ? 1 : 0;
      const bFlash = b.toLowerCase().includes('flash') ? 1 : 0;
      return bFlash - aFlash;
    });

    cachedDiscoveredTtsModels = found;
    lastTtsDiscoveryTime = now;
    lastTtsDiscoveryKeyPrefix = keyPrefix;

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          TTS_MODELS_CACHE_STORAGE_KEY,
          JSON.stringify({
            models: found,
            timestamp: now,
            keyPrefix,
          })
        );
      }
    } catch {}

    if (found.length > 0 && !lastActiveTtsModelMemory) {
      setLastUsedTtsModel(found[0]);
    }

    return found;
  } catch {
    return cachedDiscoveredTtsModels;
  }
};

export interface StrictFemaleVoiceSelection {
  voice: SpeechSynthesisVoice | null;
  foundFemale: boolean;
}

export const pickStrictFemaleVoice = (
  voices: SpeechSynthesisVoice[],
  preferredLang?: string
): StrictFemaleVoiceSelection => {
  if (!Array.isArray(voices) || voices.length === 0) {
    return { voice: null, foundFemale: false };
  }

  const isMaleVoice = (v: SpeechSynthesisVoice): boolean => {
    const s = `${v.name || ''} ${v.voiceURI || ''}`.toLowerCase();
    return /\b(male|man|men|boy|david|mark|daniel|alex|james|ravi|prabhat|hemant|guy|fred|george|richard|paul|sean|thomas|rishi|pradeep|madhur|subir|karthik|valluvar|niraj|arjun)\b/i.test(
      s
    );
  };

  const isFemaleVoice = (v: SpeechSynthesisVoice): boolean => {
    if (isMaleVoice(v)) return false;
    const s = `${v.name || ''} ${v.voiceURI || ''}`.toLowerCase();
    return (
      /\b(female|woman|women|girl|zira|samantha|aria|jenny|nova|ava|susan|sara|victoria|karen|tessa|moira|lekha|veena|hazel|heera|neerja|swara|kalpana|raveena|aditi|priya|tanishaa|nabanita|sangeeta|uma|pallavi|shruti|ananya|divya|kajal)\b/i.test(
        s
      ) ||
      s.includes('female') ||
      s.includes('woman')
    );
  };

  const rawLang = String(preferredLang || 'bn-BD').toLowerCase();
  const langPrefix = rawLang === 'auto' || !rawLang ? 'bn' : rawLang.split(/[-_]/)[0];

  const allFemaleVoices = voices.filter((v) => isFemaleVoice(v));

  // 1. Female voice matching Settings' Language (e.g. bn)
  const matchingLangFemale = allFemaleVoices.find((v) =>
    String(v.lang || '')
      .toLowerCase()
      .replace('_', '-')
      .startsWith(langPrefix)
  );
  if (matchingLangFemale) {
    return { voice: matchingLangFemale, foundFemale: true };
  }

  // 2. Language-mismatched female voice (prefer hi-IN, en-IN first, then any female voice)
  const hiInFemale = allFemaleVoices.find((v) =>
    String(v.lang || '').toLowerCase().replace('_', '-').startsWith('hi')
  );
  if (hiInFemale) {
    return { voice: hiInFemale, foundFemale: true };
  }

  const enInFemale = allFemaleVoices.find(
    (v) => String(v.lang || '').toLowerCase().replace('_', '-') === 'en-in'
  );
  if (enInFemale) {
    return { voice: enInFemale, foundFemale: true };
  }

  if (allFemaleVoices.length > 0) {
    return { voice: allFemaleVoices[0], foundFemale: true };
  }

  // 3. No female voice found at all: NEVER pick a male voice
  return { voice: null, foundFemale: false };
};

export const directGeminiTTS = async (payload: any) => {
  const { text, voiceName, apiKey, model } = payload || {};
  const cleanKey = String(apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();

  const rawText = String(text || '').replace(/[*#_~`]/g, '').trim();
  if (!rawText) throw new Error('Empty text for TTS');
  const ttsPromptText = formatAdminTtsPrompt(rawText);
  if (!(await ensureGeminiReady(cleanKey))) {
    const err: any = new Error('Gemini key নেই। Settings → Connections-এ key দিন।');
    err.status = 'missing_key';
    err.modelTried = 'none';
    throw err;
  }

  const candidateModels: string[] = [];

  // 1. User's custom saved TTS model in localStorage takes top priority if non-empty
  const customSaved = getCustomTtsModel();
  if (customSaved) {
    candidateModels.push(customSaved);
  }

  // 2. Explicit model in payload if passed
  if (model && String(model).trim()) {
    const cleanExplicit = String(model).replace(/^models\//, '').trim();
    if (cleanExplicit && !candidateModels.includes(cleanExplicit)) {
      candidateModels.push(cleanExplicit);
    }
  }

  // 3. Auto-discovered TTS models from ListModels (cached 1 hour, highest version first)
  const discovered = await discoverAvailableTtsModels(cleanKey);
  for (const dm of discovered) {
    const cleanDm = dm.replace(/^models\//, '').trim();
    if (cleanDm && !candidateModels.includes(cleanDm)) {
      candidateModels.push(cleanDm);
    }
  }

  const adminActive = isAdmin();
  const selectedVoiceName = String(voiceName || 'Leda').trim() || 'Leda';
  const voicesToTry: string[] = adminActive
    ? [...ADMIN_PREFERRED_VOICES]
    : [selectedVoiceName];

  const modelsToTry = candidateModels.length > 0 ? candidateModels.slice(0, 3) : [''];
  const attempts: Array<{ model: string; status: number | string; message: string }> = [];
  let lastError: any = null;

  for (const rawTargetModel of modelsToTry) {
    const targetModel = rawTargetModel ? rawTargetModel.replace(/^models\//, '').trim() : '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TTS_PER_REQUEST_TIMEOUT_MS);
    try {
      const res = await fetchGeminiTtsWithFallback(
        {
          model: targetModel || undefined,
          text: ttsPromptText,
          voiceName: selectedVoiceName,
          voices: voicesToTry,
          ...(cleanKey ? { apiKey: cleanKey } : {}),
        },
        controller.signal
      );
      clearTimeout(timer);

      const rawBodyText = await res.text().catch(() => '');
      let data: any = null;
      try {
        data = rawBodyText ? JSON.parse(rawBodyText) : null;
      } catch {}

      if (!res.ok || !data?.audio) {
        const googleMsg = sanitizeOutApiKey(
          data?.exactError || data?.error?.message || rawBodyText || `HTTP ${res.status}`,
          cleanKey
        ).trim();
        const usedModelLabel = targetModel || 'gemini-tts';
        attempts.push({
          model: usedModelLabel,
          status: res.status,
          message: googleMsg,
        });
        const err: any = new Error(`${usedModelLabel} (HTTP ${res.status}): ${googleMsg}`);
        err.status = res.status;
        err.modelTried = usedModelLabel;
        err.googleMessage = googleMsg;
        err.attempts = [...attempts];
        lastError = err;
        continue;
      }

      const finalModel = data.modelUsed || targetModel || 'gemini-3.8-flash-lite-tts';
      const finalVoice = data.voiceUsed || selectedVoiceName;
      setLastUsedTtsModel(finalModel);
      if (adminActive) {
        console.log('[ADMIN TTS] Used:', {
          model: finalModel,
          voice: finalVoice,
          affectiveDialog: false,
        });
      }

      return {
        audio: data.audio,
        modelUsed: finalModel,
        voiceUsed: finalVoice,
      };
    } catch (err: any) {
      clearTimeout(timer);
      const isTimeout = err?.name === 'AbortError';
      const msg = sanitizeOutApiKey(
        isTimeout ? 'Request timed out' : String(err?.message || 'Network error'),
        cleanKey
      );
      const usedModelLabel = targetModel || 'gemini-tts';
      attempts.push({
        model: usedModelLabel,
        status: isTimeout ? 'timeout' : 'network_error',
        message: msg,
      });
      const wrappedErr: any = new Error(`${usedModelLabel} (${isTimeout ? 'Timeout' : 'Network'}): ${msg}`);
      wrappedErr.status = isTimeout ? 408 : 0;
      wrappedErr.modelTried = usedModelLabel;
      wrappedErr.googleMessage = msg;
      wrappedErr.attempts = [...attempts];
      lastError = wrappedErr;
    }
  }

  try {
    logDevError({
      area: 'tts',
      message: lastError?.message || 'Gemini TTS failed',
      status: typeof lastError?.status === 'number' ? lastError.status : undefined,
      model: lastError?.modelTried,
      details: lastError?.googleMessage,
    });
  } catch (e) {}

  throw lastError || new Error('এই API key-তে কোনো Gemini TTS মডেল পাওয়া যায়নি।');
};


