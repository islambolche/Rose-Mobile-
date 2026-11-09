import { prepareHistory, extractLastUserText } from './ai-utils';
import { getGeminiKey } from './geminiKey';

const TEXT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash-lite"];
export { TEXT_MODELS };

const WORKING_MODEL_STORAGE_KEY = 'working_gemini_text_model';

export const GEMINI_PER_REQUEST_TIMEOUT_MS = 15000;
export const GEMINI_TOTAL_CHAIN_TIMEOUT_MS = 40000;
const GEMINI_TTS_PER_REQUEST_TIMEOUT_MS = 15000;
const GEMINI_TTS_TOTAL_CHAIN_TIMEOUT_MS = 40000;

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
    err?.modelName || getSavedWorkingTextModel() || TEXT_MODELS[0]
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
        ? '15.0'
        : '0.0';

  let rawGoogleMsg = String(
    err?.googleMessage || err?.bodyText || err?.message || err || 'Gemini request failed'
  ).trim();

  if (err?.errorDetails) {
    try {
      const detailsStr =
        typeof err.errorDetails === 'string'
          ? err.errorDetails
          : JSON.stringify(err.errorDetails);
      if (detailsStr && !rawGoogleMsg.includes(detailsStr)) {
        rawGoogleMsg += ' | details: ' + detailsStr;
      }
    } catch (e) {}
  }

  const sanitizedFullText = sanitizeOutApiKey(rawGoogleMsg, apiKey)
    .replace(/\s+/g, ' ')
    .trim();

  const debugLine = `model: ${modelName} | status: ${statusVal} | time: ${timeSec}s | ${sanitizedFullText}`;

  if (/Add your Gemini key in Settings/i.test(sanitizedFullText)) {
    return {
      bengaliMessage: 'Add your Gemini key in Settings > Connections.',
      debugLine,
    };
  }

  const isKeyError =
    statusVal === '401' ||
    statusVal === '403' ||
    /API key|api_key|key_invalid|invalid_key/i.test(sanitizedFullText);

  if (isKeyError) {
    return {
      bengaliMessage: 'Gemini key ভুল বা বন্ধ, Settings → Connections-এ নতুন key দিন',
      debugLine,
    };
  }

  const numStatus = Number(statusVal);
  if (
    numStatus === 429 ||
    /\b429\b|quota|resource_exhausted|rate\s*limit/i.test(sanitizedFullText)
  ) {
    return {
      bengaliMessage: 'Gemini key-র ফ্রি সীমা শেষ, কিছুক্ষণ পরে চেষ্টা করুন',
      debugLine,
    };
  }

  if (
    numStatus === 400 ||
    /\b400\b|invalid\s*argument|invalid_argument/i.test(sanitizedFullText)
  ) {
    return {
      bengaliMessage: 'অনুরোধের গড়নে সমস্যা, অ্যাপ নিজে ঠিক করার চেষ্টা করছে',
      debugLine,
    };
  }

  if (numStatus === 404 || /\b404\b|not\s*found|not_found/i.test(sanitizedFullText)) {
    return {
      bengaliMessage: 'মডেলের নাম পুরনো, অ্যাপ নতুন মডেল খুঁজছে',
      debugLine,
    };
  }

  if (isTimeout || statusVal === 'timeout') {
    return {
      bengaliMessage: 'নেটওয়ার্ক ধীর বা মডেল ব্যস্ত',
      debugLine,
    };
  }

  return {
    bengaliMessage: 'অনুরোধের গড়নে সমস্যা, অ্যাপ নিজে ঠিক করার চেষ্টা করছে',
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
    const saved = (localStorage.getItem(WORKING_MODEL_STORAGE_KEY) || '')
      .replace(/^models\//, '')
      .trim();
    if (saved && !isDeprecatedOrLiveModel(saved)) {
      return saved;
    }
    if (saved && isDeprecatedOrLiveModel(saved)) {
      localStorage.removeItem(WORKING_MODEL_STORAGE_KEY);
    }
  } catch (e) {}
  return null;
};

export const saveWorkingTextModel = (modelName: string) => {
  try {
    if (typeof window === 'undefined') return;
    const clean = modelName.replace(/^models\//, '').trim();
    if (clean && !isDeprecatedOrLiveModel(clean)) {
      localStorage.setItem(WORKING_MODEL_STORAGE_KEY, clean);
    }
  } catch (e) {}
};

const clearWorkingTextModelIfMatches = (failedModel: string) => {
  try {
    if (typeof window === 'undefined') return;
    const current = localStorage.getItem(WORKING_MODEL_STORAGE_KEY);
    if (current && current.replace(/^models\//, '').trim() === failedModel) {
      localStorage.removeItem(WORKING_MODEL_STORAGE_KEY);
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
  const code = Number(status);
  return (
    code === 400 ||
    code === 404 ||
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
  apiKey: string,
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
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`,
      { signal: controller.signal }
    );
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

const fetchWithSignalTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  modelName = TEXT_MODELS[0],
  reqStartTime = Date.now(),
  cleanKey = ''
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    try {
      controller.abort();
    } catch (e) {}
  }, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err: any) {
    const elapsedSeconds = ((Date.now() - reqStartTime) / 1000).toFixed(1);
    if (err?.name === 'AbortError') {
      const timeoutSec = Math.round(timeoutMs / 1000);
      const tErr: any = new Error(`Request timed out after ${timeoutSec}s`);
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
  }
};

const buildBodyForRequest = (
  contents: any[],
  systemInstruction?: any,
  generationConfig?: any,
  tools?: any[],
  toolConfig?: any,
  isMinimal = false
) => {
  const sysText = typeof systemInstruction === 'string'
    ? systemInstruction
    : (systemInstruction as any)?.parts?.[0]?.text || '';

  if (isMinimal) {
    const lastUserText = extractLastUserText(contents);
    const body: any = {
      contents: [{ role: 'user', parts: [{ text: lastUserText }] }],
      generationConfig: {
        maxOutputTokens: generationConfig?.maxOutputTokens ?? 150,
      },
    };
    if (sysText.trim()) {
      body.systemInstruction = {
        parts: [{ text: sysText.trim() }],
      };
    }
    return body;
  }

  const genConfig: any = {
    maxOutputTokens: generationConfig?.maxOutputTokens ?? 150,
  };
  if (generationConfig?.temperature !== undefined) {
    genConfig.temperature = generationConfig.temperature;
  }

  const body: any = {
    contents: prepareHistory(contents),
    generationConfig: genConfig,
  };

  if (sysText.trim()) {
    body.systemInstruction = {
      parts: [{ text: sysText.trim() }],
    };
  }

  if (tools && Array.isArray(tools) && tools.length > 0) {
    body.tools = tools;
    if (toolConfig) {
      body.toolConfig = toolConfig;
    }
  }

  return body;
};

const callGeminiTextEndpoint = async (params: {
  model: string;
  contents: any[];
  systemInstruction?: string;
  generationConfig?: any;
  apiKey?: string;
  tools?: any[];
  toolConfig?: any;
  timeoutMs?: number;
}) => {
  const {
    model,
    contents,
    systemInstruction,
    generationConfig,
    apiKey,
    tools,
    toolConfig,
    timeoutMs = GEMINI_PER_REQUEST_TIMEOUT_MS,
  } = params;

  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();

  const cleanModel =
    String(model || TEXT_MODELS[0]).replace(/^models\//, '').trim() || TEXT_MODELS[0];

  if (!cleanKey) {
    const missingErr: any = new Error('Add your Gemini key in Settings > Connections.');
    missingErr.bodyText = 'Add your Gemini key in Settings > Connections.';
    missingErr.googleMessage = 'Add your Gemini key in Settings > Connections.';
    missingErr.modelName = cleanModel;
    missingErr.status = 400;
    missingErr.elapsedSeconds = '0.0';
    throw missingErr;
  }

  const startMinimal = isMinimalBodyStoredForModel(cleanModel);
  let directBody = buildBodyForRequest(contents, systemInstruction, generationConfig, tools, toolConfig, startMinimal);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
  const reqStartTime = Date.now();
  const perReqTimeout = Math.min(GEMINI_PER_REQUEST_TIMEOUT_MS, Math.max(1000, timeoutMs));

  let res = await fetchWithSignalTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(directBody),
    },
    perReqTimeout,
    cleanModel,
    reqStartTime,
    cleanKey
  );

  // AUTO-RETRY ON 400: if standard request failed with 400 invalid argument, retry once with minimal body
  if (res.status === 400 && !startMinimal) {
    const minimalBody = buildBodyForRequest(contents, systemInstruction, generationConfig, tools, toolConfig, true);
    const retryRes = await fetchWithSignalTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(minimalBody),
      },
      perReqTimeout,
      cleanModel,
      reqStartTime,
      cleanKey
    );
    if (retryRes.ok) {
      storeMinimalBodyForModel(cleanModel);
      res = retryRes;
    } else {
      res = retryRes;
    }
  }

  const elapsedSeconds = ((Date.now() - reqStartTime) / 1000).toFixed(1);
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

  if (startMinimal || res.ok) {
    storeMinimalBodyForModel(cleanModel);
  }

  return { ...parsed, modelUsed: cleanModel };
};

const callGeminiStreamEndpoint = async (params: {
  model: string;
  contents: any[];
  systemInstruction?: string;
  generationConfig?: any;
  apiKey: string;
  tools?: any[];
  toolConfig?: any;
  onTextChunk: (deltaText: string) => void;
  timeoutMs?: number;
}) => {
  const {
    model,
    contents,
    systemInstruction,
    generationConfig,
    apiKey,
    tools,
    toolConfig,
    onTextChunk,
    timeoutMs = GEMINI_PER_REQUEST_TIMEOUT_MS,
  } = params;

  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();
  const cleanModel =
    String(model || TEXT_MODELS[0]).replace(/^models\//, '').trim() || TEXT_MODELS[0];

  if (!cleanKey) {
    const missingErr: any = new Error('Add your Gemini key in Settings > Connections.');
    missingErr.bodyText = 'Add your Gemini key in Settings > Connections.';
    missingErr.googleMessage = 'Add your Gemini key in Settings > Connections.';
    missingErr.modelName = cleanModel;
    missingErr.status = 400;
    missingErr.elapsedSeconds = '0.0';
    throw missingErr;
  }

  const startMinimal = isMinimalBodyStoredForModel(cleanModel);
  let directBody = buildBodyForRequest(contents, systemInstruction, generationConfig, tools, toolConfig, startMinimal);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(cleanKey)}`;
  const reqStartTime = Date.now();
  const perReqTimeout = Math.min(GEMINI_PER_REQUEST_TIMEOUT_MS, Math.max(1000, timeoutMs));

  let res = await fetchWithSignalTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(directBody),
    },
    perReqTimeout,
    cleanModel,
    reqStartTime,
    cleanKey
  );

  // AUTO-RETRY ON 400: if stream request returned 400, retry once with minimal body
  if (res.status === 400 && !startMinimal) {
    const minimalBody = buildBodyForRequest(contents, systemInstruction, generationConfig, tools, toolConfig, true);
    const retryRes = await fetchWithSignalTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(minimalBody),
      },
      perReqTimeout,
      cleanModel,
      reqStartTime,
      cleanKey
    );
    if (retryRes.ok) {
      storeMinimalBodyForModel(cleanModel);
      res = retryRes;
    } else {
      res = retryRes;
    }
  }

  if (!res.ok) {
    const elapsedSeconds = ((Date.now() - reqStartTime) / 1000).toFixed(1);
    const rawBodyText = await res.text().catch(() => '');
    let parsed: any = null;
    try {
      parsed = rawBodyText ? JSON.parse(rawBodyText) : null;
      if (Array.isArray(parsed) && parsed[0]) parsed = parsed[0];
    } catch {}
    const rawGoogleErr = sanitizeOutApiKey(
      parsed?.error?.message || rawBodyText || `HTTP ${res.status}`,
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

  let fullText = '';
  const collectedParts: any[] = [];

  const processParsedChunk = (chunkObj: any) => {
    const parts = chunkObj?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (typeof p?.text === 'string' && p.text) {
          fullText += p.text;
          collectedParts.push(p);
          onTextChunk(p.text);
        } else if (p?.functionCall) {
          collectedParts.push(p);
        }
      }
    }
  };

  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const readPromise = reader.read();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          try {
            reader.cancel();
          } catch {}
          const tErr: any = new Error('Request timed out after 15s');
          tErr.isTimeout = true;
          tErr.status = 'timeout';
          tErr.modelName = cleanModel;
          tErr.elapsedSeconds = ((Date.now() - reqStartTime) / 1000).toFixed(1);
          tErr.googleMessage = 'Request timed out after 15s';
          tErr.bodyText = 'Request timed out after 15s';
          reject(tErr);
        }, GEMINI_PER_REQUEST_TIMEOUT_MS);
      });

      const { done, value } = await Promise.race([readPromise, timeoutPromise]);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const dataStr = trimmed.slice(5).trim();
        if (!dataStr || dataStr === '[DONE]') continue;
        try {
          const parsedChunk = JSON.parse(dataStr);
          processParsedChunk(parsedChunk);
        } catch {}
      }
    }

    if (buffer.trim().startsWith('data:')) {
      const dataStr = buffer.trim().slice(5).trim();
      if (dataStr && dataStr !== '[DONE]') {
        try {
          processParsedChunk(JSON.parse(dataStr));
        } catch {}
      }
    }
  } else {
    const rawText = await res.text().catch(() => '');
    const lines = rawText.split(/\r?\n/);
    let parsedAny = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data:')) {
        const dataStr = trimmed.slice(5).trim();
        if (dataStr && dataStr !== '[DONE]') {
          try {
            processParsedChunk(JSON.parse(dataStr));
            parsedAny = true;
          } catch {}
        }
      }
    }
    if (!parsedAny && rawText.trim()) {
      try {
        const fallbackJson = JSON.parse(rawText);
        if (Array.isArray(fallbackJson)) {
          fallbackJson.forEach(processParsedChunk);
        } else {
          processParsedChunk(fallbackJson);
        }
      } catch {}
    }
  }

  return {
    text: fullText,
    modelUsed: cleanModel,
    candidates: [
      {
        content: {
          parts:
            collectedParts.length > 0
              ? collectedParts
              : [{ text: fullText }],
        },
      },
    ],
  };
};

export const directGeminiGenerate = async (payload: any) => {
  const { contents, systemInstruction, generationConfig, apiKey, tools, toolConfig, model } =
    payload || {};

  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();

  if (!cleanKey) {
    const missingErr: any = new Error('Add your Gemini key in Settings > Connections.');
    missingErr.bodyText = 'Add your Gemini key in Settings > Connections.';
    missingErr.googleMessage = 'Add your Gemini key in Settings > Connections.';
    missingErr.modelName = getSavedWorkingTextModel() || TEXT_MODELS[0];
    missingErr.status = 400;
    missingErr.elapsedSeconds = '0.0';
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

  const deadline = Date.now() + GEMINI_TOTAL_CHAIN_TIMEOUT_MS;
  const initialModels = buildOrderedModelList(model);

  const triedModels = new Set<string>();
  let lastError: any = null;
  let allFailedWithRetryableStatus = true;

  for (const candidateModel of initialModels) {
    const remainingChainMs = deadline - Date.now();
    if (remainingChainMs <= 0) {
      break;
    }
    const perReqTimeoutMs = Math.min(GEMINI_PER_REQUEST_TIMEOUT_MS, remainingChainMs);
    triedModels.add(candidateModel);
    try {
      const result = await callGeminiTextEndpoint({
        model: candidateModel,
        contents: preparedContents,
        systemInstruction,
        generationConfig,
        apiKey: cleanKey,
        tools,
        toolConfig,
        timeoutMs: perReqTimeoutMs,
      });
      saveWorkingTextModel(candidateModel);
      return result;
    } catch (err: any) {
      lastError = err;
      clearWorkingTextModelIfMatches(candidateModel);
      if (!isRetryableModelStatus(err?.status)) {
        allFailedWithRetryableStatus = false;
        break;
      }
      if (Date.now() >= deadline) break;
    }
  }

  if (allFailedWithRetryableStatus && Date.now() < deadline) {
    const discoveredModels = await discoverAvailableFlashModels(cleanKey, triedModels);
    for (const discoveredModel of discoveredModels) {
      const remainingChainMs = deadline - Date.now();
      if (remainingChainMs <= 0) break;
      const perReqTimeoutMs = Math.min(GEMINI_PER_REQUEST_TIMEOUT_MS, remainingChainMs);
      triedModels.add(discoveredModel);
      try {
        const result = await callGeminiTextEndpoint({
          model: discoveredModel,
          contents: preparedContents,
          systemInstruction,
          generationConfig,
          apiKey: cleanKey,
          tools,
          toolConfig,
          timeoutMs: perReqTimeoutMs,
        });
        saveWorkingTextModel(discoveredModel);
        return result;
      } catch (err: any) {
        lastError = err;
        if (!isRetryableModelStatus(err?.status)) break;
        if (Date.now() >= deadline) break;
      }
    }
  }

  throw lastError || new Error('Cannot reach Gemini. Check your internet and your Gemini key.');
};

export const directGeminiStream = async (
  payload: any,
  onTextChunk: (deltaText: string) => void
) => {
  const { contents, systemInstruction, generationConfig, apiKey, tools, toolConfig, model } =
    payload || {};

  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();

  if (!cleanKey) {
    const missingErr: any = new Error('Add your Gemini key in Settings > Connections.');
    missingErr.bodyText = 'Add your Gemini key in Settings > Connections.';
    missingErr.googleMessage = 'Add your Gemini key in Settings > Connections.';
    missingErr.modelName = getSavedWorkingTextModel() || TEXT_MODELS[0];
    missingErr.status = 400;
    missingErr.elapsedSeconds = '0.0';
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

  const deadline = Date.now() + GEMINI_TOTAL_CHAIN_TIMEOUT_MS;
  const initialModels = buildOrderedModelList(model);

  const triedModels = new Set<string>();
  let lastError: any = null;
  let allFailedWithRetryableStatus = true;

  for (const candidateModel of initialModels) {
    const remainingChainMs = deadline - Date.now();
    if (remainingChainMs <= 0) break;
    const perReqTimeoutMs = Math.min(GEMINI_PER_REQUEST_TIMEOUT_MS, remainingChainMs);
    triedModels.add(candidateModel);
    try {
      const result = await callGeminiStreamEndpoint({
        model: candidateModel,
        contents: preparedContents,
        systemInstruction,
        generationConfig,
        apiKey: cleanKey,
        tools,
        toolConfig,
        onTextChunk,
        timeoutMs: perReqTimeoutMs,
      });
      saveWorkingTextModel(candidateModel);
      return result;
    } catch (err: any) {
      lastError = err;
      clearWorkingTextModelIfMatches(candidateModel);
      if (!isRetryableModelStatus(err?.status)) {
        allFailedWithRetryableStatus = false;
        break;
      }
      if (Date.now() >= deadline) break;
    }
  }

  if (allFailedWithRetryableStatus && Date.now() < deadline) {
    const discoveredModels = await discoverAvailableFlashModels(cleanKey, triedModels);
    for (const discoveredModel of discoveredModels) {
      const remainingChainMs = deadline - Date.now();
      if (remainingChainMs <= 0) break;
      const perReqTimeoutMs = Math.min(GEMINI_PER_REQUEST_TIMEOUT_MS, remainingChainMs);
      triedModels.add(discoveredModel);
      try {
        const result = await callGeminiStreamEndpoint({
          model: discoveredModel,
          contents: preparedContents,
          systemInstruction,
          generationConfig,
          apiKey: cleanKey,
          tools,
          toolConfig,
          onTextChunk,
          timeoutMs: perReqTimeoutMs,
        });
        saveWorkingTextModel(discoveredModel);
        return result;
      } catch (err: any) {
        lastError = err;
        if (!isRetryableModelStatus(err?.status)) break;
        if (Date.now() >= deadline) break;
      }
    }
  }

  throw lastError || new Error('Cannot reach Gemini. Check your internet and your Gemini key.');
};

const WORKING_TTS_MODEL_STORAGE_KEY = 'working_gemini_tts_model';

const getSavedWorkingTtsModel = (): string => {
  try {
    return (localStorage.getItem(WORKING_TTS_MODEL_STORAGE_KEY) || '').trim();
  } catch (e) {
    return '';
  }
};

const saveWorkingTtsModel = (modelName: string) => {
  if (!modelName) return;
  try {
    localStorage.setItem(WORKING_TTS_MODEL_STORAGE_KEY, modelName);
  } catch (e) {}
};

export const discoverAvailableTtsModels = async (apiKey: string): Promise<string[]> => {
  const cleanKey = String(apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();
  if (!cleanKey) return [];
  try {
    const res = await fetchWithSignalTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`,
      { method: 'GET' },
      6000,
      'models-list',
      Date.now(),
      cleanKey
    );
    if (!res.ok) return [];
    const data = await res.json();
    const modelsList: any[] = Array.isArray(data?.models) ? data.models : [];
    const found: string[] = [];
    for (const m of modelsList) {
      const rawName = String(m?.name || '');
      const shortName = rawName.replace(/^models\//, '');
      const methods: string[] = Array.isArray(m?.supportedGenerationMethods)
        ? m.supportedGenerationMethods
        : [];
      if (methods.includes('generateContent') && shortName.toLowerCase().includes('tts')) {
        found.push(shortName);
      }
    }
    return found;
  } catch (e) {
    return [];
  }
};

export const directGeminiTTS = async (payload: any) => {
  const { text, voiceName, style, apiKey, model } = payload || {};
  const cleanKey = String(apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();
  if (!cleanKey) {
    const missingErr: any = new Error('Add your Gemini key in Settings > Connections.');
    missingErr.bodyText = 'Add your Gemini key in Settings > Connections.';
    missingErr.googleMessage = 'Add your Gemini key in Settings > Connections.';
    missingErr.status = 400;
    throw missingErr;
  }

  const savedTts = getSavedWorkingTtsModel();
  const preferredModel = savedTts || model || 'gemini-2.5-flash-preview-tts';
  const deadline = Date.now() + GEMINI_TTS_TOTAL_CHAIN_TIMEOUT_MS;

  const rawText = String(text || '').trim();
  if (!rawText) throw new Error('Empty text for TTS');

  let styleHint = String(style || '').trim();
  let transcript = rawText;
  const prefixMatch = rawText.match(/^Say in [a-zA-Z0-9\s,()'-]+:\s*([\s\S]+)$/i);
  if (prefixMatch && prefixMatch[1]) {
    if (!styleHint) {
      styleHint = rawText.slice(0, rawText.indexOf(':')).replace(/^Say in (a |an )?/i, '').trim();
    }
    transcript = prefixMatch[1].trim();
  }

  const initialModels = Array.from(
    new Set(
      [
        savedTts && savedTts.includes('tts') ? savedTts.replace(/^models\//, '').trim() : null,
        preferredModel && preferredModel.includes('tts')
          ? preferredModel.replace(/^models\//, '').trim()
          : null,
        'gemini-2.5-flash-preview-tts',
        'gemini-2.5-flash-tts',
        'gemini-2.0-flash-preview-tts',
        'gemini-2.0-flash-tts',
      ].filter(Boolean)
    )
  ) as string[];

  const triedModels = new Set<string>();
  let lastError: any = null;

  const callDirectTts = async (m: string) => {
    const remainingChainMs = Math.max(1000, deadline - Date.now());
    const perReqTimeoutMs = Math.min(GEMINI_TTS_PER_REQUEST_TIMEOUT_MS, remainingChainMs);
    const cleanModel = m.replace(/^models\//, '').trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    const reqStartTime = Date.now();

    const res = await fetchWithSignalTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: transcript }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName || 'Leda',
                },
              },
            },
          },
        }),
      },
      perReqTimeoutMs,
      cleanModel,
      reqStartTime,
      cleanKey
    );

    const elapsedSeconds = ((Date.now() - reqStartTime) / 1000).toFixed(1);
    const rawBodyText = await res.text().catch(() => '');
    let data: any = null;
    try {
      data = rawBodyText ? JSON.parse(rawBodyText) : null;
    } catch (parseErr) {
      const msg = `Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`;
      const err: any = new Error(msg);
      err.status = res.status;
      err.modelName = cleanModel;
      err.elapsedSeconds = elapsedSeconds;
      err.googleMessage = sanitizeOutApiKey(rawBodyText || msg, cleanKey);
      err.exactError = msg;
      err.bodyText = msg;
      throw err;
    }

    if (!data || typeof data !== 'object') {
      const msg = `Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`;
      const err: any = new Error(msg);
      err.status = res.status;
      err.modelName = cleanModel;
      err.elapsedSeconds = elapsedSeconds;
      err.googleMessage = msg;
      err.exactError = msg;
      err.bodyText = msg;
      throw err;
    }

    if (!res.ok) {
      const rawGoogleErr = sanitizeOutApiKey(
        data?.error?.message || `HTTP ${res.status}`,
        cleanKey
      );
      const errText = data?.error?.message
        ? `${rawGoogleErr} (HTTP ${res.status})`
        : `Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`;
      const err: any = new Error(errText);
      err.status = res.status;
      err.modelName = cleanModel;
      err.elapsedSeconds = elapsedSeconds;
      err.googleMessage = rawGoogleErr;
      err.errorDetails = data?.error?.details;
      err.exactError = errText;
      err.bodyText = errText;
      throw err;
    }

    const rawB64 =
      data?.audio ||
      data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (!rawB64) throw new Error(`No audio returned from ${cleanModel}`);

    // Strip 44-byte RIFF header if present
    let processedB64 = rawB64;
    try {
      const binary = atob(rawB64);
      if (binary.length > 44 && binary.slice(0, 4) === 'RIFF') {
        const bytes = new Uint8Array(binary.length - 44);
        for (let i = 44; i < binary.length; i++) {
          bytes[i - 44] = binary.charCodeAt(i);
        }
        let binaryString = '';
        for (let i = 0; i < bytes.length; i++) {
          binaryString += String.fromCharCode(bytes[i]);
        }
        processedB64 = btoa(binaryString);
      }
    } catch (e) {}

    saveWorkingTtsModel(cleanModel);
    return { audio: processedB64, modelUsed: cleanModel };
  };

  let allFailedWithRetryable = true;
  for (const m of initialModels) {
    if (Date.now() >= deadline) break;
    if (triedModels.has(m)) continue;
    triedModels.add(m);
    try {
      return await callDirectTts(m);
    } catch (err: any) {
      lastError = err;
      if (!isRetryableModelStatus(err?.status)) {
        allFailedWithRetryable = false;
        break;
      }
    }
  }

  if (allFailedWithRetryable && Date.now() < deadline) {
    const discovered = await discoverAvailableTtsModels(cleanKey);
    for (const dm of discovered) {
      if (Date.now() >= deadline) break;
      if (triedModels.has(dm)) continue;
      triedModels.add(dm);
      try {
        return await callDirectTts(dm);
      } catch (err: any) {
        lastError = err;
        if (!isRetryableModelStatus(err?.status)) break;
      }
    }
  }

  throw lastError || new Error('Cannot reach Gemini. Check your internet and your Gemini key.');
};
