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
    startMinimal
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

  // AUTO-RETRY ON 400: if standard request failed with 400 invalid argument, retry once with minimal body
  if (res.status === 400 && !startMinimal && !signal?.aborted) {
    const minimalBody = buildBodyForRequest(
      contents,
      systemInstruction,
      generationConfig,
      true
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
        body: JSON.stringify(minimalBody),
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

const WORKING_TTS_MODEL_STORAGE_KEY = 'working_gemini_tts_model';
let cachedDiscoveredTtsModels: string[] = [];
let lastTtsDiscoveryTime = 0;

function scoreTtsModelVersion(modelName: string): number {
  const lower = modelName.toLowerCase();
  const match = lower.match(/-(\d+)(?:\.(\d+))?/);
  if (!match) return 0;
  const major = parseInt(match[1], 10) || 0;
  const minor = parseInt(match[2] || '0', 10) || 0;
  return major * 1000 + minor * 100;
}

const getSavedWorkingTtsModel = (): string => {
  try {
    const saved = (localStorage.getItem(WORKING_TTS_MODEL_STORAGE_KEY) || '')
      .replace(/^models\//, '')
      .trim();
    if (saved && saved.toLowerCase().includes('tts')) {
      return saved;
    }
    return '';
  } catch (e) {
    return '';
  }
};

const saveWorkingTtsModel = (modelName: string) => {
  if (!modelName || !modelName.toLowerCase().includes('tts')) return;
  try {
    localStorage.setItem(WORKING_TTS_MODEL_STORAGE_KEY, modelName.replace(/^models\//, '').trim());
  } catch (e) {}
};

const clearWorkingTtsModelIfMatches = (failedModel: string) => {
  try {
    const current = localStorage.getItem(WORKING_TTS_MODEL_STORAGE_KEY) || '';
    if (current.replace(/^models\//, '').trim() === failedModel.replace(/^models\//, '').trim()) {
      localStorage.removeItem(WORKING_TTS_MODEL_STORAGE_KEY);
    }
  } catch (e) {}
};

export const discoverAvailableTtsModels = async (
  apiKey?: string,
  forceRefresh = false
): Promise<string[]> => {
  const cleanKey = String(apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();
  if (!cleanKey) return [];

  const now = Date.now();
  if (!forceRefresh && cachedDiscoveredTtsModels.length > 0 && now - lastTtsDiscoveryTime < 120000) {
    return cachedDiscoveredTtsModels;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}&pageSize=200`;
    const res = await fetch(url, {
      headers: { 'x-goog-api-key': cleanKey },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return cachedDiscoveredTtsModels;
    const data = await res.json();
    const modelsList: any[] = Array.isArray(data?.models) ? data.models : [];
    const found: string[] = [];
    for (const m of modelsList) {
      const rawName = String(m?.name || '');
      const shortName = rawName.replace(/^models\//, '').trim();
      const methods: string[] = Array.isArray(m?.supportedGenerationMethods)
        ? m.supportedGenerationMethods
        : [];
      if (shortName && methods.includes('generateContent') && shortName.toLowerCase().includes('tts')) {
        found.push(shortName);
      }
    }
    // Sort newest version first, prefer flash-preview-tts / flash-tts over pro if same version
    found.sort((a, b) => {
      const diff = scoreTtsModelVersion(b) - scoreTtsModelVersion(a);
      if (diff !== 0) return diff;
      const aFlash = a.toLowerCase().includes('flash') ? 1 : 0;
      const bFlash = b.toLowerCase().includes('flash') ? 1 : 0;
      return bFlash - aFlash;
    });
    if (found.length > 0) {
      cachedDiscoveredTtsModels = found;
      lastTtsDiscoveryTime = now;
    }
    return found;
  } catch (e) {
    return cachedDiscoveredTtsModels;
  }
};

export const directGeminiTTS = async (payload: any) => {
  const { text, voiceName, apiKey, model } = payload || {};
  const cleanKey = String(apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();

  const rawText = String(text || '').replace(/[*#_~`]/g, '').trim();
  if (!rawText) throw new Error('Empty text for TTS');
  if (!cleanKey) {
    const err: any = new Error('Gemini key নেই। Settings → Connections-এ key দিন।');
    err.status = 'missing_key';
    throw err;
  }

  const candidateModels: string[] = [];
  if (model && String(model).toLowerCase().includes('tts')) {
    candidateModels.push(String(model).replace(/^models\//, '').trim());
  }
  const savedTts = getSavedWorkingTtsModel();
  if (savedTts && !candidateModels.includes(savedTts)) {
    candidateModels.push(savedTts);
  }
  const discovered = await discoverAvailableTtsModels(cleanKey);
  for (const dm of discovered) {
    if (!candidateModels.includes(dm)) {
      candidateModels.push(dm);
    }
  }

  if (candidateModels.length === 0) {
    const noModelErr: any = new Error('TTS মডেল পাওয়া যায়নি');
    noModelErr.isNoTtsModel = true;
    throw noModelErr;
  }

  let lastError: any = null;

  for (const targetModel of candidateModels) {
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
                  voiceName: voiceName || 'Leda',
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
        clearWorkingTtsModelIfMatches(targetModel);
        const errMsg = data?.error?.message || `TTS ব্যর্থ (HTTP ${res.status})`;
        const err: any = new Error(errMsg);
        err.status = res.status;
        err.googleMessage = errMsg;
        lastError = err;
        continue;
      }

      saveWorkingTtsModel(targetModel);

      return {
        audio: audioData,
        modelUsed: targetModel,
      };
    } catch (err: any) {
      clearTimeout(timer);
      clearWorkingTtsModelIfMatches(targetModel);
      lastError = err;
    }
  }

  throw lastError || new Error('TTS মডেল পাওয়া যায়নি');
};

