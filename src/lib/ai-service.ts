import { prepareHistory } from './ai-utils';
import { getGeminiKey } from './geminiKey';

const TEXT_MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"];
export { TEXT_MODELS };

const WORKING_MODEL_STORAGE_KEY = 'working_gemini_text_model';

const isDeprecatedOrLiveModel = (modelName?: string): boolean => {
  if (!modelName) return true;
  const clean = modelName.replace(/^models\//, '').trim().toLowerCase();
  if (!clean || !clean.startsWith('gemini')) return true;
  if (
    clean.startsWith('gemini-2.5-flash') ||
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

export const discoverAvailableFlashModels = async (
  apiKey: string,
  excludeModels: Set<string> = new Set()
): Promise<string[]> => {
  if (!apiKey) return [];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
        apiKey
      )}`
    );
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

const GEMINI_TEXT_TIMEOUT_MS = 12000;
const GEMINI_TTS_TIMEOUT_MS = 8000;

const fetchWithSignalTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
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
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

const callGeminiTextEndpoint = async (params: {
  model: string;
  contents: any[];
  systemInstruction?: string;
  generationConfig?: any;
  apiKey: string;
  timeoutMs?: number;
}) => {
  const {
    model,
    contents,
    systemInstruction,
    generationConfig,
    apiKey,
    timeoutMs = GEMINI_TEXT_TIMEOUT_MS,
  } = params;

  const mergedGenConfig: any = {
    maxOutputTokens: 150,
    thinkingConfig: { thinkingBudget: 0 },
    ...(generationConfig || {}),
  };

  let res: Response | null = null;
  let usedDirectFallback = false;

  try {
    res = await fetchWithSignalTimeout(
      '/api/gemini/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          contents,
          systemInstruction,
          generationConfig: mergedGenConfig,
          apiKey,
        }),
      },
      timeoutMs
    );

    const contentType = res.headers.get('content-type') || '';
    if (res.status === 404 && contentType.includes('text/html') && apiKey) {
      usedDirectFallback = true;
    }
  } catch (networkErr: any) {
    if (String(networkErr?.message || '').includes('timed out')) {
      throw networkErr;
    }
    if (apiKey) {
      usedDirectFallback = true;
    } else {
      throw networkErr;
    }
  }

  if (usedDirectFallback && apiKey) {
    const directBody: any = {
      contents,
      generationConfig: mergedGenConfig,
    };
    if (systemInstruction && String(systemInstruction).trim().length > 0) {
      directBody.systemInstruction = {
        parts: [{ text: String(systemInstruction).trim() }],
      };
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    res = await fetchWithSignalTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(directBody),
      },
      timeoutMs
    );

    if (res.status === 400 && directBody.generationConfig?.thinkingConfig) {
      const errTxt = await res.clone().text().catch(() => '');
      if (errTxt.toLowerCase().includes('thinking')) {
        const { thinkingConfig, ...restGen } = directBody.generationConfig;
        directBody.generationConfig = restGen;
        res = await fetchWithSignalTimeout(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(directBody),
          },
          timeoutMs
        );
      }
    }
  }

  if (!res) {
    throw new Error('No response from Gemini endpoint');
  }

  const rawBodyText = await res.text().catch(() => '');

  if (!res.ok) {
    const err: any = new Error(
      rawBodyText && rawBodyText.trim()
        ? `HTTP ${res.status}: ${rawBodyText.trim()}`
        : `HTTP ${res.status}`
    );
    err.status = res.status;
    err.bodyText = rawBodyText.trim() || `HTTP ${res.status}`;
    throw err;
  }

  try {
    const parsed = JSON.parse(rawBodyText);
    return { ...parsed, modelUsed: model };
  } catch (parseErr) {
    throw new Error(rawBodyText || 'Invalid JSON response from Gemini');
  }
};

const callGeminiStreamEndpoint = async (params: {
  model: string;
  contents: any[];
  systemInstruction?: string;
  generationConfig?: any;
  apiKey: string;
  onTextChunk: (deltaText: string) => void;
  timeoutMs?: number;
}) => {
  const {
    model,
    contents,
    systemInstruction,
    generationConfig,
    apiKey,
    onTextChunk,
    timeoutMs = GEMINI_TEXT_TIMEOUT_MS,
  } = params;

  const mergedGenConfig: any = {
    maxOutputTokens: 150,
    thinkingConfig: { thinkingBudget: 0 },
    ...(generationConfig || {}),
  };

  let res: Response | null = null;
  let usedDirectFallback = false;

  try {
    res = await fetchWithSignalTimeout(
      '/api/gemini/stream',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          contents,
          systemInstruction,
          generationConfig: mergedGenConfig,
          apiKey,
        }),
      },
      timeoutMs
    );

    const contentType = res.headers.get('content-type') || '';
    if (res.status === 404 && contentType.includes('text/html') && apiKey) {
      usedDirectFallback = true;
    }
  } catch (networkErr: any) {
    if (String(networkErr?.message || '').includes('timed out')) {
      throw networkErr;
    }
    if (apiKey) {
      usedDirectFallback = true;
    } else {
      throw networkErr;
    }
  }

  if (usedDirectFallback && apiKey) {
    const directBody: any = {
      contents,
      generationConfig: mergedGenConfig,
    };
    if (systemInstruction && String(systemInstruction).trim().length > 0) {
      directBody.systemInstruction = {
        parts: [{ text: String(systemInstruction).trim() }],
      };
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    res = await fetchWithSignalTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(directBody),
      },
      timeoutMs
    );

    if (res.status === 400 && directBody.generationConfig?.thinkingConfig) {
      const errTxt = await res.clone().text().catch(() => '');
      if (errTxt.toLowerCase().includes('thinking')) {
        const { thinkingConfig, ...restGen } = directBody.generationConfig;
        directBody.generationConfig = restGen;
        res = await fetchWithSignalTimeout(
          url,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(directBody),
          },
          timeoutMs
        );
      }
    }
  }

  if (!res) {
    throw new Error('No response from Gemini streaming endpoint');
  }

  if (!res.ok) {
    const rawBodyText = await res.text().catch(() => '');
    const err: any = new Error(
      rawBodyText && rawBodyText.trim()
        ? `HTTP ${res.status}: ${rawBodyText.trim()}`
        : `HTTP ${res.status}`
    );
    err.status = res.status;
    err.bodyText = rawBodyText.trim() || `HTTP ${res.status}`;
    throw err;
  }

  let fullText = '';

  const parseSseLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) return;
    const jsonStr = trimmed.slice(5).trim();
    if (!jsonStr || jsonStr === '[DONE]') return;
    try {
      const parsed = JSON.parse(jsonStr);
      const parts = parsed?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        for (const p of parts) {
          if (typeof p?.text === 'string' && p.text) {
            fullText += p.text;
            onTextChunk(p.text);
          }
        }
      }
    } catch (e) {}
  };

  if (res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          parseSseLine(line);
        }
      }
    }
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        parseSseLine(line);
      }
    }
  } else {
    const raw = await res.text().catch(() => '');
    for (const line of raw.split('\n')) {
      parseSseLine(line);
    }
  }

  return {
    text: fullText,
    modelUsed: model,
    candidates: [
      {
        content: {
          parts: [{ text: fullText }],
        },
      },
    ],
  };
};

export const directGeminiGenerate = async (payload: any) => {
  const { contents, systemInstruction, generationConfig, apiKey } = payload;

  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();

  const preparedContents = prepareHistory(
    (contents || []).map((c: any) => ({
      role: c.role,
      text: c?.parts?.[0]?.text ?? c?.text ?? '',
    })),
    systemInstruction || ''
  );

  const deadline = Date.now() + GEMINI_TEXT_TIMEOUT_MS;
  const savedWorkingModel = getSavedWorkingTextModel();
  const initialModels: string[] = [];
  if (savedWorkingModel) {
    initialModels.push(savedWorkingModel);
  }
  for (const m of TEXT_MODELS) {
    if (!initialModels.includes(m)) {
      initialModels.push(m);
    }
  }

  const triedModels = new Set<string>();
  let lastError: any = null;

  for (const candidateModel of initialModels) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error('Gemini text request timed out (12s)');
    }
    triedModels.add(candidateModel);
    try {
      const result = await callGeminiTextEndpoint({
        model: candidateModel,
        contents: preparedContents,
        systemInstruction,
        generationConfig,
        apiKey: cleanKey,
        timeoutMs: remainingMs,
      });
      saveWorkingTextModel(candidateModel);
      return result;
    } catch (err: any) {
      lastError = err;
      clearWorkingTextModelIfMatches(candidateModel);
      if (Date.now() >= deadline) break;
      continue;
    }
  }

  if (Date.now() < deadline) {
    const discoveredModels = await discoverAvailableFlashModels(cleanKey, triedModels);
    for (const discoveredModel of discoveredModels) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;
      triedModels.add(discoveredModel);
      try {
        const result = await callGeminiTextEndpoint({
          model: discoveredModel,
          contents: preparedContents,
          systemInstruction,
          generationConfig,
          apiKey: cleanKey,
          timeoutMs: remainingMs,
        });
        saveWorkingTextModel(discoveredModel);
        return result;
      } catch (err: any) {
        lastError = err;
        if (Date.now() >= deadline) break;
        continue;
      }
    }
  }

  throw lastError || new Error('Gemini API request failed');
};

export const directGeminiStream = async (
  payload: any,
  onTextChunk: (deltaText: string) => void
) => {
  const { contents, systemInstruction, generationConfig, apiKey } = payload;

  const cleanKey = String(apiKey || getGeminiKey() || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();

  const preparedContents = prepareHistory(
    (contents || []).map((c: any) => ({
      role: c.role,
      text: c?.parts?.[0]?.text ?? c?.text ?? '',
    })),
    systemInstruction || ''
  );

  const deadline = Date.now() + GEMINI_TEXT_TIMEOUT_MS;
  const savedWorkingModel = getSavedWorkingTextModel();
  const initialModels: string[] = [];
  if (savedWorkingModel) {
    initialModels.push(savedWorkingModel);
  }
  for (const m of TEXT_MODELS) {
    if (!initialModels.includes(m)) {
      initialModels.push(m);
    }
  }

  const triedModels = new Set<string>();
  let lastError: any = null;

  for (const candidateModel of initialModels) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error('Gemini text request timed out (12s)');
    }
    triedModels.add(candidateModel);
    try {
      const result = await Promise.race([
        callGeminiStreamEndpoint({
          model: candidateModel,
          contents: preparedContents,
          systemInstruction,
          generationConfig,
          apiKey: cleanKey,
          onTextChunk,
          timeoutMs: remainingMs,
        }),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini text request timed out (12s)')), remainingMs)
        ),
      ]);
      saveWorkingTextModel(candidateModel);
      return result;
    } catch (err: any) {
      lastError = err;
      clearWorkingTextModelIfMatches(candidateModel);
      if (Date.now() >= deadline) break;
      continue;
    }
  }

  if (Date.now() < deadline) {
    const discoveredModels = await discoverAvailableFlashModels(cleanKey, triedModels);
    for (const discoveredModel of discoveredModels) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;
      triedModels.add(discoveredModel);
      try {
        const result = await Promise.race([
          callGeminiStreamEndpoint({
            model: discoveredModel,
            contents: preparedContents,
            systemInstruction,
            generationConfig,
            apiKey: cleanKey,
            onTextChunk,
            timeoutMs: remainingMs,
          }),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini text request timed out (12s)')), remainingMs)
          ),
        ]);
        saveWorkingTextModel(discoveredModel);
        return result;
      } catch (err: any) {
        lastError = err;
        if (Date.now() >= deadline) break;
        continue;
      }
    }
  }

  throw lastError || new Error('Gemini streaming API request failed');
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
      3000
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
  const { text, voiceName, style, apiKey, model } = payload;
  const cleanKey = String(apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();
  const preferredModel = getSavedWorkingTtsModel() || model || 'gemini-2.5-flash-preview-tts';
  const deadline = Date.now() + GEMINI_TTS_TIMEOUT_MS;

  const callServerTts = async (targetModel: string) => {
    const remainingMs = Math.max(1000, deadline - Date.now());
    const res = await fetchWithSignalTimeout(
      '/api/gemini/tts',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: targetModel,
          text,
          voiceName: voiceName || 'Leda',
          style,
          apiKey: cleanKey,
        }),
      },
      remainingMs
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.audio) {
      const exactErr =
        data?.exactError ||
        data?.error?.message ||
        (typeof data?.error === 'string' ? data.error : '') ||
        `HTTP ${res.status}`;
      const err: any = new Error(exactErr);
      err.status = res.status;
      throw err;
    }

    if (data.modelUsed) {
      saveWorkingTtsModel(data.modelUsed);
    } else if (targetModel) {
      saveWorkingTtsModel(targetModel);
    }
    return data;
  };

  const runTtsWithRetry = async () => {
    let lastErr: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (Date.now() >= deadline) {
        throw new Error('Gemini TTS request timed out (8s)');
      }
      try {
        return await callServerTts(preferredModel);
      } catch (err: any) {
        lastErr = err;
        if (Date.now() >= deadline) break;
        const errMsg = String(err?.message || '').toLowerCase();
        if (
          err?.status === 404 ||
          errMsg.includes('404') ||
          errMsg.includes('not_found') ||
          errMsg.includes('not found')
        ) {
          const discovered = await discoverAvailableTtsModels(cleanKey);
          for (const dm of discovered) {
            if (Date.now() >= deadline) break;
            try {
              const resData = await callServerTts(dm);
              saveWorkingTtsModel(dm);
              return resData;
            } catch (dErr: any) {
              lastErr = dErr;
            }
          }
        }
        if (attempt === 0 && Date.now() + 250 < deadline) {
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    }
    throw lastErr || new Error('Gemini TTS request failed');
  };

  return await Promise.race([
    runTtsWithRetry(),
    new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini TTS request timed out (8s)')), GEMINI_TTS_TIMEOUT_MS)
    ),
  ]);
};


