import { prepareHistory, extractLastUserText } from './ai-utils';
import { getGeminiKey } from './geminiKey';

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

  let rawMsg = String(
    err?.googleMessage || err?.message || err?.bodyText || err || ''
  ).trim();

  const sanitizedFullText = sanitizeOutApiKey(rawMsg, apiKey).trim();

  const attempts: GeminiAttemptLog[] = Array.isArray(err?.attempts) ? err.attempts : [];
  const debugLine =
    attempts.length > 0
      ? attempts
          .map((a) => `${a.model} | ${a.status} | ${String(a.seconds).replace(/s$/i, '')}s`)
          .join('\n')
      : `${modelName} | ${statusVal} | ${String(timeSec).replace(/s$/i, '')}s`;

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
  if (!cleanKey) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try {
        controller.abort();
      } catch (e) {}
    }, 6000);
    const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${cleanKey}`;
    const res = await fetch(url, {
      headers: { 'x-goog-api-key': cleanKey },
      signal: controller.signal,
    });
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
  if (typeof durationSec === 'number' && durationSec < 1.0) {
    return false;
  }
  const clean = String(text).trim();
  if (clean.length < 2) return false;

  const lower = clean.toLowerCase();
  if (/^(los|um|uh|ah|er|hm|hmm|ঁ|h|a|o|e|buraya|los\.?)$/i.test(lower)) {
    return false;
  }

  // Allow Bengali script (\u0980-\u09FF), Latin script (a-zA-Z), ASCII & Bengali digits (0-9\u09E6-\u09EF), whitespace, standard punctuation
  const invalidCharRegex = /[^\u0980-\u09FFa-zA-Z0-9\u09E6-\u09EF\s\.,!\?\-'"’`:;()।]/;
  if (invalidCharRegex.test(clean)) {
    return false;
  }

  return true;
};

export const discoverLightestFlashModel = async (apiKey?: string): Promise<string> => {
  const cleanKey = String(apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();
  if (!cleanKey) return '';
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${cleanKey}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      headers: { 'x-goog-api-key': cleanKey },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return '';
    const data = await res.json();
    const models: any[] = Array.isArray(data?.models) ? data.models : [];

    const flashLite: string[] = [];
    const flashStd: string[] = [];

    for (const m of models) {
      const rawName = String(m?.name || '').replace(/^models\//, '').trim();
      const lower = rawName.toLowerCase();
      const methods: string[] = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
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

const fetchWithSignalTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
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
    return await fetch(input, { ...init, signal: controller.signal });
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
  if (!base) return NO_THOUGHT_INSTRUCTION;
  if (base.includes('নিজের ভাবনা, পরিকল্পনা বা কী করবে তা লিখবে না')) {
    return base;
  }
  return `${base}\n\n${NO_THOUGHT_INSTRUCTION}`;
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
 * Converts Settings Volume Slider (0-100, default 80%) to WebAudio Gain (1.0 - 3.0, default 2.5 at 80%).
 */
export const volumeSliderToGain = (volumePercent?: number): number => {
  const v =
    typeof volumePercent === 'number' && !isNaN(volumePercent) && volumePercent > 15
      ? volumePercent
      : 80;
  const clamped = Math.min(100, Math.max(1, v));
  if (clamped <= 80) {
    return 1.0 + (clamped / 80) * 1.5; // 1.0 at min, 2.5 at 80%
  }
  return 2.5 + ((clamped - 80) / 20) * 0.5; // 2.5 at 80%, 3.0 at 100%
};

/**
 * Connects an AudioNode (source) through the unified loud, non-clipping chain:
 * source -> GainNode (1.0..3.0, default 2.5) -> DynamicsCompressorNode (-20dB, knee 20, ratio 8, attack 0.003, release 0.25) -> (AnalyserNode) -> destination
 */
export const connectBoostedOutputChain = (
  ctx: AudioContext,
  source: AudioNode,
  volumePercent?: number,
  analyser?: AnalyserNode | null
): { gainNode: GainNode; compressor: DynamicsCompressorNode } => {
  const gainNode = ctx.createGain();
  const gainVal = volumeSliderToGain(volumePercent);
  gainNode.gain.setValueAtTime(gainVal, ctx.currentTime);

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-20, ctx.currentTime);
  compressor.knee.setValueAtTime(20, ctx.currentTime);
  compressor.ratio.setValueAtTime(8, ctx.currentTime);
  compressor.attack.setValueAtTime(0.003, ctx.currentTime);
  compressor.release.setValueAtTime(0.25, ctx.currentTime);

  source.connect(gainNode);
  gainNode.connect(compressor);

  if (analyser && analyser.context === ctx) {
    compressor.connect(analyser);
    analyser.connect(ctx.destination);
  } else {
    compressor.connect(ctx.destination);
  }

  return { gainNode, compressor };
};

const buildBodyForRequest = (
  contents: any[],
  systemInstruction?: any,
  generationConfig?: any,
  isMinimal = false,
  thinkingMode: 'full' | 'no_budget' | 'none' = 'full'
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
}) => {
  const {
    model,
    contents,
    systemInstruction,
    generationConfig,
    apiKey,
    timeoutMs = GEMINI_PER_REQUEST_TIMEOUT_MS,
    signal,
  } = params;

  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();

  if (!cleanKey) {
    const missingErr: any = new Error('Add your Gemini key in Settings > Connections.');
    missingErr.status = 400;
    missingErr.googleMessage = 'API key ঠিক নেই';
    throw missingErr;
  }

  const cleanModel =
    String(model || getSavedWorkingTextModel() || '').replace(/^models\//, '').trim();
  if (!cleanModel) {
    throw new Error('মডেল পাওয়া যায়নি');
  }

  const startMinimal = isMinimalBodyStoredForModel(cleanModel);
  const directBody = buildBodyForRequest(
    contents,
    systemInstruction,
    generationConfig,
    startMinimal,
    'full'
  );

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${cleanKey}`;
  const reqStartTime = Date.now();
  const perReqTimeout = Math.min(GEMINI_PER_REQUEST_TIMEOUT_MS, Math.max(1000, timeoutMs));

  let res = await fetchWithSignalTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey,
      },
      body: JSON.stringify(directBody),
    },
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
      'none'
    );
    const remainingMs = Math.max(2000, perReqTimeout - (Date.now() - reqStartTime));
    const retryRes = await fetchWithSignalTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey,
        },
        body: JSON.stringify(fallbackBody),
      },
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
        'none'
      );
      const remMs2 = Math.max(2000, perReqTimeout - (Date.now() - reqStartTime));
      const retryRes2 = await fetchWithSignalTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey,
          },
          body: JSON.stringify(minimalBody),
        },
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
    modelUsed: cleanModel,
    elapsedMs,
    elapsedSeconds,
  };
};

export const directGeminiGenerate = async (payload: any) => {
  const { contents, systemInstruction, generationConfig, apiKey, model } = payload || {};

  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();

  if (!cleanKey) {
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
  const initialModels = buildOrderedModelList(model);

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
    // Hedge race between first and second model (5s head start for first model)
    if (initialModels.length >= 2) {
      const firstModel = initialModels[0];
      const secondModel = initialModels[1];

      const ctrl1 = new AbortController();
      const ctrl2 = new AbortController();

      const onOverallAbort = () => {
        try {
          ctrl1.abort('overall_timeout');
        } catch (e) {}
        try {
          ctrl2.abort('overall_timeout');
        } catch (e) {}
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
          // Do not start second model if first failed due to invalid API key (401/403)
          if (lastError && (lastError.status === 401 || lastError.status === 403)) {
            if (pendingCount === 0 && !settled) {
              settled = true;
              reject(lastError);
            }
            return;
          }
          secondStarted = true;
          pendingCount++;
          runSingleAttempt(secondModel, ctrl2.signal)
            .then((res) => {
              if (settled) return;
              settled = true;
              if (hedgeTimer) clearTimeout(hedgeTimer);
              try {
                ctrl1.abort('hedged_winner');
              } catch (e) {}
              resolve(res);
            })
            .catch(() => {
              pendingCount--;
              if (pendingCount === 0 && !settled) {
                settled = true;
                if (hedgeTimer) clearTimeout(hedgeTimer);
                reject(lastError || new Error('Gemini request failed'));
              }
            });
        };

        hedgeTimer = setTimeout(() => {
          startSecond();
        }, GEMINI_HEDGE_DELAY_MS);

        runSingleAttempt(firstModel, ctrl1.signal)
          .then((res) => {
            if (settled) return;
            settled = true;
            if (hedgeTimer) clearTimeout(hedgeTimer);
            try {
              ctrl2.abort('hedged_winner');
            } catch (e) {}
            resolve(res);
          })
          .catch(() => {
            pendingCount--;
            if (hedgeTimer) {
              clearTimeout(hedgeTimer);
              hedgeTimer = null;
            }
            if (!secondStarted) {
              startSecond();
            } else if (pendingCount === 0 && !settled) {
              settled = true;
              reject(lastError || new Error('Gemini request failed'));
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
    // If key is invalid (401/403), do not try further models
    if (lastError && (lastError.status === 401 || lastError.status === 403)) {
      lastError.attempts = attempts;
      throw lastError;
    }

    // Try remaining models sequentially if time remains within 25s
    const remainingModels = initialModels.slice(2);
    for (const nextModel of remainingModels) {
      if (Date.now() >= deadline || overallController.signal.aborted) break;
      try {
        return await runSingleAttempt(nextModel, overallController.signal);
      } catch (err: any) {
        if (!isRetryableModelStatus(err?.status)) break;
      }
    }

    // Only run model discovery if all static models failed and time remains
    if (Date.now() + 2000 < deadline && !overallController.signal.aborted) {
      const discovered = await discoverAvailableFlashModels(cleanKey, triedModels);
      for (const dm of discovered) {
        if (Date.now() >= deadline || overallController.signal.aborted) break;
        try {
          return await runSingleAttempt(dm, overallController.signal);
        } catch (err: any) {
          if (!isRetryableModelStatus(err?.status)) break;
        }
      }
    }
  } finally {
    clearTimeout(overallTimer);
  }

  const finalErr: any =
    lastError || new Error('Cannot reach Gemini. Check your internet and your Gemini key.');
  finalErr.attempts = attempts;
  throw finalErr;
};

// Non-streaming fallback for any legacy callers of directGeminiStream
export const directGeminiStream = async (
  payload: any,
  onTextChunk?: (deltaText: string) => void
) => {
  const res = await directGeminiGenerate(payload);
  const fullText =
    res?.text ||
    res?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text || '')
      .join('')
      .trim() ||
    '';
  if (fullText && typeof onTextChunk === 'function') {
    onTextChunk(fullText);
  }
  return {
    ...res,
    text: fullText,
  };
};

export const runGeminiSpeedTest = async (
  apiKey?: string,
  onProgress?: (results: Array<{ model: string; text: string; ok: boolean; ms?: number }>) => void
): Promise<Array<{ model: string; text: string; ok: boolean; ms?: number }>> => {
  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();

  if (!cleanKey) {
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
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${cleanKey}`;
      const res = await fetchWithSignalTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
        },
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

      if (res.ok && parsed?.candidates?.[0]?.content?.parts?.[0]?.text) {
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
  if (!cleanKey) return [];

  const keyPrefix = cleanKey.slice(0, 8);
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
    const allModels: any[] = [];
    let nextPageToken = '';
    let pageCount = 0;

    while (pageCount < 10) {
      pageCount++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const tokenParam = nextPageToken ? `&pageToken=${encodeURIComponent(nextPageToken)}` : '';
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}&pageSize=200${tokenParam}`;

      const res = await fetch(url, {
        headers: { 'x-goog-api-key': cleanKey },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        break;
      }

      const data = await res.json().catch(() => null);
      const pageList: any[] = Array.isArray(data?.models) ? data.models : [];
      allModels.push(...pageList);

      if (data?.nextPageToken && typeof data.nextPageToken === 'string') {
        nextPageToken = data.nextPageToken;
      } else {
        break;
      }
    }

    const foundSet = new Set<string>();
    for (const m of allModels) {
      const rawName = String(m?.name || '');
      const shortName = rawName.replace(/^models\//, '').trim();
      const methods: string[] = Array.isArray(m?.supportedGenerationMethods)
        ? m.supportedGenerationMethods
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
  if (!cleanKey) {
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

  // Try up to 3 models maximum
  const modelsToTry = candidateModels.slice(0, 3);

  if (modelsToTry.length === 0) {
    const noModelErr: any = new Error('এই API key-তে কোনো Gemini TTS মডেল পাওয়া যায়নি।');
    noModelErr.isNoTtsModel = true;
    noModelErr.status = 404;
    noModelErr.modelTried = 'none';
    noModelErr.googleMessage = 'এই API key-তে কোনো Gemini TTS মডেল পাওয়া যায়নি।';
    throw noModelErr;
  }

  const selectedVoiceName = String(voiceName || 'Leda').trim() || 'Leda';
  const attempts: Array<{ model: string; status: number | string; message: string }> = [];
  let lastError: any = null;

  for (const rawTargetModel of modelsToTry) {
    const targetModel = rawTargetModel.replace(/^models\//, '').trim();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: rawText }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: selectedVoiceName,
                },
              },
            },
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const rawBodyText = await res.text().catch(() => '');
      let data: any = null;
      try {
        data = rawBodyText ? JSON.parse(rawBodyText) : null;
      } catch {}

      const audioPart = data?.candidates?.[0]?.content?.parts?.find(
        (p: any) => p?.inlineData?.data || p?.inline_data?.data
      );
      const audioData = audioPart?.inlineData?.data || audioPart?.inline_data?.data;

      if (!res.ok || !audioData) {
        const googleMsg = sanitizeOutApiKey(
          data?.error?.message || rawBodyText || `HTTP ${res.status}`,
          cleanKey
        ).trim();
        attempts.push({
          model: targetModel,
          status: res.status,
          message: googleMsg,
        });
        const err: any = new Error(`${targetModel} (HTTP ${res.status}): ${googleMsg}`);
        err.status = res.status;
        err.modelTried = targetModel;
        err.googleMessage = googleMsg;
        err.attempts = [...attempts];
        lastError = err;

        // If 404 (or 400/500/503), try the next model in the list (up to 3 total)
        if (res.status === 404 || res.status === 400 || res.status === 500 || res.status === 503) {
          continue;
        }
        break;
      }

      setLastUsedTtsModel(targetModel);

      return {
        audio: audioData,
        modelUsed: targetModel,
      };
    } catch (err: any) {
      clearTimeout(timer);
      const isTimeout = err?.name === 'AbortError';
      const msg = sanitizeOutApiKey(
        isTimeout ? 'Request timed out' : String(err?.message || 'Network error'),
        cleanKey
      );
      attempts.push({
        model: targetModel,
        status: isTimeout ? 'timeout' : 'network_error',
        message: msg,
      });
      const wrappedErr: any = new Error(`${targetModel} (${isTimeout ? 'Timeout' : 'Network'}): ${msg}`);
      wrappedErr.status = isTimeout ? 408 : 0;
      wrappedErr.modelTried = targetModel;
      wrappedErr.googleMessage = msg;
      wrappedErr.attempts = [...attempts];
      lastError = wrappedErr;
    }
  }

  throw lastError || new Error('এই API key-তে কোনো Gemini TTS মডেল পাওয়া যায়নি।');
};


