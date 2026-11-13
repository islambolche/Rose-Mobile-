import { getGeminiKey, setApiBackendAvailable } from './geminiKey';

export const resolveClientGeminiKey = (explicitKey?: string): string => {
  const cleanExplicit = String(explicitKey || '')
    .replace(/[\r\n\t\s"'`\u200B\u200C\u200D\uFEFF]+/g, '')
    .trim();
  if (cleanExplicit) return cleanExplicit;

  const fromStore = String(getGeminiKey() || '')
    .replace(/[\r\n\t\s"'`\u200B\u200C\u200D\uFEFF]+/g, '')
    .trim();
  if (fromStore) return fromStore;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return String(localStorage.getItem('gemini_api_key') || '')
        .replace(/[\r\n\t\s"'`\u200B\u200C\u200D\uFEFF]+/g, '')
        .trim();
    }
  } catch {}
  return '';
};

const normalizeDirectContents = (contents: any, prompt?: any) => {
  if (!contents && prompt) {
    return [{ role: 'user', parts: [{ text: String(prompt) }] }];
  }
  if (typeof contents === 'string') {
    return [{ role: 'user', parts: [{ text: contents }] }];
  }
  if (!Array.isArray(contents)) return [];

  return contents.map((item: any) => {
    if (typeof item === 'string') {
      return { role: 'user', parts: [{ text: item }] };
    }
    if (item && item.text && !item.parts) {
      return {
        role: item.role === 'assistant' || item.role === 'rose' ? 'model' : item.role || 'user',
        parts: [{ text: String(item.text) }],
      };
    }
    if (item && Array.isArray(item.parts)) {
      const mappedParts = item.parts.map((p: any) => {
        if (p && p.inline_data && !p.inlineData) {
          return {
            inlineData: {
              mimeType: p.inline_data.mime_type || p.inline_data.mimeType || 'audio/webm',
              data: p.inline_data.data,
            },
          };
        }
        return p;
      });
      return {
        ...item,
        role: item.role === 'assistant' || item.role === 'rose' ? 'model' : item.role || 'user',
        parts: mappedParts,
      };
    }
    return item;
  });
};

const normalizeDirectSystemInstruction = (sys: any) => {
  if (!sys) return undefined;
  if (typeof sys === 'string') {
    const clean = sys.trim();
    return clean ? { parts: [{ text: clean }] } : undefined;
  }
  return sys;
};

const normalizeDirectBody = (payload: any) => {
  const body: any = {
    contents: normalizeDirectContents(payload?.contents, payload?.prompt),
  };
  const sys = normalizeDirectSystemInstruction(payload?.systemInstruction);
  if (sys) body.systemInstruction = sys;
  if (payload?.generationConfig) body.generationConfig = payload.generationConfig;
  if (Array.isArray(payload?.tools) && payload.tools.length > 0) body.tools = payload.tools;
  if (payload?.toolConfig) body.toolConfig = payload.toolConfig;
  return body;
};

export async function fetchGeminiModelsWithFallback(
  apiKey?: string,
  signal?: AbortSignal
): Promise<Response> {
  const cleanKey = resolveClientGeminiKey(apiKey);
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
    method: 'GET',
    headers: cleanKey ? { 'x-goog-api-key': cleanKey } : {},
    signal,
  });
  return res;
}

export async function fetchGeminiGenerateWithFallback(
  payload: any,
  signal?: AbortSignal
): Promise<Response> {
  const cleanKey = resolveClientGeminiKey(payload?.apiKey);
  const rawModel = String(payload?.model || 'gemini-1.5-flash').replace(/^models\//, '').trim();
  const directBody = normalizeDirectBody(payload);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cleanKey ? { 'x-goog-api-key': cleanKey } : {}),
    },
    body: JSON.stringify(directBody),
    signal,
  });
  return res;
}

export async function fetchGeminiStreamWithFallback(
  payload: any,
  signal?: AbortSignal
): Promise<Response> {
  const cleanKey = resolveClientGeminiKey(payload?.apiKey);
  const rawModel = String(payload?.model || 'gemini-1.5-flash').replace(/^models\//, '').trim();
  const directBody = normalizeDirectBody(payload);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cleanKey ? { 'x-goog-api-key': cleanKey } : {}),
    },
    body: JSON.stringify(directBody),
    signal,
  });
  return res;
}

export async function fetchGeminiTtsWithFallback(
  payload: any,
  signal?: AbortSignal
): Promise<Response> {
  const cleanKey = resolveClientGeminiKey(payload?.apiKey);
  const rawModel = String(payload?.model || '').replace(/^models\//, '').trim();
  const targetModel =
    rawModel && rawModel.toLowerCase().includes('tts')
      ? rawModel
      : 'gemini-2.5-flash-preview-tts';
  const directBody = {
    ...normalizeDirectBody(payload),
    generationConfig: {
      ...(payload?.generationConfig || {}),
      responseModalities: ["AUDIO"]
    }
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cleanKey ? { 'x-goog-api-key': cleanKey } : {}),
    },
    body: JSON.stringify(directBody),
    signal,
  });
  return res;
}
