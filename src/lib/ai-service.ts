import { prepareHistory } from './ai-utils';
import { getGeminiKey } from './geminiKey';

const TEXT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash-lite"];
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
      `/api/gemini/models?apiKey=${encodeURIComponent(apiKey)}`
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
const GEMINI_TTS_TIMEOUT_MS = 25000;

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
    timeoutMs = GEMINI_TEXT_TIMEOUT_MS,
  } = params;

  if (!apiKey) throw new Error('Add your Gemini key in Settings');

  const mergedGenConfig: any = {
    maxOutputTokens: 150,
    thinkingConfig: { thinkingBudget: 0 },
    ...(generationConfig || {}),
  };

  const directBody: any = {
    contents,
    generationConfig: mergedGenConfig,
  };
  if (systemInstruction && String(systemInstruction).trim().length > 0) {
    directBody.systemInstruction = {
      parts: [{ text: String(systemInstruction).trim() }],
    };
  }
  if (tools && Array.isArray(tools) && tools.length > 0) {
    directBody.tools = tools;
    if (toolConfig) {
      directBody.toolConfig = toolConfig;
    }
  }

  const url = `/api/gemini/generate`;

  let res = await fetchWithSignalTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...directBody, model, apiKey }),
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
          body: JSON.stringify({ ...directBody, model, apiKey }),
        },
        timeoutMs
      );
    }
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

  if (!apiKey) throw new Error('Add your Gemini key in Settings');

  const mergedGenConfig: any = {
    maxOutputTokens: 150,
    thinkingConfig: { thinkingBudget: 0 },
    ...(generationConfig || {}),
  };

  const directBody: any = {
    contents,
    generationConfig: mergedGenConfig,
  };
  if (systemInstruction && String(systemInstruction).trim().length > 0) {
    directBody.systemInstruction = {
      parts: [{ text: String(systemInstruction).trim() }],
    };
  }

  const url = `/api/gemini/stream`;

  let res = await fetchWithSignalTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...directBody, model, apiKey }),
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
          body: JSON.stringify({ ...directBody, model, apiKey }),
        },
        timeoutMs
      );
    }
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
      `/api/gemini/models?apiKey=${encodeURIComponent(cleanKey)}`,
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

  const ttsPrompt = styleHint
    ? `Read the following text aloud verbatim in a ${styleHint} tone. Do not answer or generate new text, only speak the exact transcript: "${transcript}"`
    : `Read the following text aloud verbatim. Do not answer or generate new text, only speak the exact transcript: "${transcript}"`;

  const initialModels = Array.from(new Set([
    preferredModel && preferredModel.includes('tts') ? preferredModel : null,
    'gemini-2.5-flash-preview-tts',
    'gemini-2.5-flash-tts',
    'gemini-2.0-flash-preview-tts',
    'gemini-2.0-flash-tts',
  ].filter(Boolean))) as string[];

  const triedModels = new Set<string>();
  let lastErrorText = '';
  let lastStatus = 500;

  const callDirectTts = async (m: string) => {
    const remainingMs = Math.max(1000, deadline - Date.now());
    const url = `/api/gemini/tts`;
    
    console.log(`[Gemini TTS Client] Calling /api/gemini/tts with model: ${m}, voice: ${voiceName || "Leda"}, text: "${transcript.slice(0, 30)}..."`);

    const res = await fetchWithSignalTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcript,
          voiceName: voiceName || "Leda",
          style: styleHint,
          apiKey: cleanKey,
          model: m
        }),
      },
      remainingMs
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      lastStatus = res.status;
      lastErrorText = data?.error?.message || data?.exactError || `HTTP ${res.status}`;
      const err: any = new Error(lastErrorText);
      err.status = res.status;
      err.exactError = lastErrorText;
      err.bodyText = lastErrorText;
      throw err;
    }

    const rawB64 =
      data?.audio ||
      data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (!rawB64) throw new Error(`No audio returned from ${m}`);

    // Ported RIFF header stripping logic
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

    saveWorkingTtsModel(m);
    return { audio: processedB64, modelUsed: m };
  };

  const runTtsWithRetry = async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const m of initialModels) {
        if (Date.now() >= deadline) throw new Error('Gemini TTS request timed out (25s)');
        if (triedModels.has(m)) continue;
        triedModels.add(m);
        try {
          return await callDirectTts(m);
        } catch (err: any) {
          if (err.message.includes('404')) {
             // Continue to next model or discovery
          } else {
             // For other errors, maybe retry same model or move on
          }
        }
      }

      // If we are here, initial models failed, try discovery
      const discovered = await discoverAvailableTtsModels(cleanKey);
      for (const dm of discovered) {
        if (Date.now() >= deadline) break;
        if (triedModels.has(dm)) continue;
        triedModels.add(dm);
        try {
          return await callDirectTts(dm);
        } catch (e) {}
      }

      if (attempt === 0 && Date.now() + 250 < deadline) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    throw new Error(lastErrorText || 'Gemini TTS request failed');
  };

  return await Promise.race([
    runTtsWithRetry(),
    new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini TTS request timed out (25s)')), GEMINI_TTS_TIMEOUT_MS)
    ),
  ]);
};



