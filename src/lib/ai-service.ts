import { prepareHistory, extractLastUserText } from './ai-utils';
import { getGeminiKey } from './geminiKey';

const TEXT_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];
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
        ? '25.0'
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

  const attempts: GeminiAttemptLog[] = Array.isArray(err?.attempts) ? err.attempts : [];
  const debugLine =
    attempts.length > 0
      ? attempts
          .map((a) => `${a.model} | ${a.status} | ${String(a.seconds).replace(/s$/i, '')}s`)
          .join('\n')
      : `${modelName} | ${statusVal} | ${String(timeSec).replace(/s$/i, '')}s`;

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
    bengaliMessage: 'নেটওয়ার্ক ধীর বা মডেল ব্যস্ত',
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
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try {
        controller.abort();
      } catch (e) {}
    }, 6000);
    const query = cleanKey ? `?apiKey=${encodeURIComponent(cleanKey)}` : '';
    const res = await fetch(`/api/gemini/models${query}`, { signal: controller.signal });
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

const buildBodyForRequest = (
  contents: any[],
  systemInstruction?: any,
  generationConfig?: any,
  isMinimal = false
) => {
  const sysText =
    typeof systemInstruction === 'string'
      ? systemInstruction
      : (systemInstruction as any)?.parts?.[0]?.text || '';

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

  const cleanModel =
    String(model || TEXT_MODELS[0]).replace(/^models\//, '').trim() || TEXT_MODELS[0];

  const startMinimal = isMinimalBodyStoredForModel(cleanModel);
  const directBody = buildBodyForRequest(
    contents,
    systemInstruction,
    generationConfig,
    startMinimal
  );

  const payload: any = {
    model: cleanModel,
    contents: directBody.contents,
    systemInstruction: directBody.systemInstruction?.parts?.[0]?.text,
    generationConfig: directBody.generationConfig,
    apiKey: cleanKey || undefined,
  };

  const url = `/api/gemini/generate`;
  const reqStartTime = Date.now();
  const perReqTimeout = Math.min(GEMINI_PER_REQUEST_TIMEOUT_MS, Math.max(1000, timeoutMs));

  let res = await fetchWithSignalTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    perReqTimeout,
    cleanModel,
    reqStartTime,
    cleanKey,
    signal
  );

  // AUTO-RETRY ON 400: if standard request failed with 400 invalid argument, retry once with minimal body
  if (res.status === 400 && !startMinimal && !signal?.aborted) {
    const minimalBody = buildBodyForRequest(
      contents,
      systemInstruction,
      generationConfig,
      true
    );
    const minimalPayload: any = {
      model: cleanModel,
      contents: minimalBody.contents,
      systemInstruction: minimalBody.systemInstruction?.parts?.[0]?.text,
      generationConfig: minimalBody.generationConfig,
      apiKey: cleanKey || undefined,
    };
    const remainingMs = Math.max(2000, perReqTimeout - (Date.now() - reqStartTime));
    const retryRes = await fetchWithSignalTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(minimalPayload),
      },
      remainingMs,
      cleanModel,
      reqStartTime,
      cleanKey,
      signal
    );
    if (retryRes.ok) {
      storeMinimalBodyForModel(cleanModel);
    }
    res = retryRes;
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

  const replyText =
    parsed?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text || '')
      .join('')
      .trim() || '';

  if (!replyText && !parsed?.candidates?.[0]?.content?.parts?.some((p: any) => p?.functionCall)) {
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
    const missingErr: any = new Error('Add your Gemini key in Settings > Connections.');
    missingErr.bodyText = 'Add your Gemini key in Settings > Connections.';
    missingErr.googleMessage = 'Add your Gemini key in Settings > Connections.';
    missingErr.modelName = getSavedWorkingTextModel() || TEXT_MODELS[0];
    missingErr.status = 400;
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

  for (const model of TEXT_MODELS) {
    const start = Date.now();
    try {
      const url = `/api/gemini/generate`;
      const res = await fetchWithSignalTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            generationConfig: { maxOutputTokens: 10 },
            apiKey: cleanKey || undefined,
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

export const discoverAvailableTtsModels = async (apiKey?: string): Promise<string[]> => {
  const cleanKey = String(apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();
  try {
    const query = cleanKey ? `?apiKey=${encodeURIComponent(cleanKey)}` : '';
    const res = await fetch(`/api/gemini/models${query}`);
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

  const rawText = String(text || '').trim();
  if (!rawText) throw new Error('Empty text for TTS');

  const res = await fetch('/api/gemini/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: rawText,
      voiceName: voiceName || 'Sulafat',
      style: style || '',
      apiKey: cleanKey || undefined,
      model: model || undefined,
    }),
  });

  const rawBodyText = await res.text().catch(() => '');
  let data: any = null;
  try {
    data = rawBodyText ? JSON.parse(rawBodyText) : null;
  } catch {}

  if (!res.ok || !data?.audio) {
    const errMsg = data?.error?.message || data?.exactError || `TTS failed (HTTP ${res.status})`;
    const err: any = new Error(errMsg);
    err.status = res.status;
    err.googleMessage = errMsg;
    throw err;
  }

  if (data.modelUsed) {
    saveWorkingTtsModel(data.modelUsed);
  }

  return {
    audio: data.audio,
    modelUsed: data.modelUsed || 'gemini-3.8-flash-lite-tts',
  };
};
