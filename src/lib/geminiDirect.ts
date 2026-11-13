import { getGeminiKey, isApiBackendAvailable, setApiBackendAvailable } from './geminiKey';

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

const isMissingApiRouteResponse = (res: Response): boolean => {
  if (res.status === 404 || res.status === 405) return true;
  const ct = String(res.headers.get('content-type') || '').toLowerCase();
  // Vercel static fallback often serves index.html (text/html) for unknown paths
  if (ct.includes('text/html') && !res.ok) return true;
  return false;
};

const stripRiffHeaderFromBase64 = (rawB64: string): string => {
  try {
    const bin = atob(rawB64);
    if (
      bin.length > 44 &&
      bin.charCodeAt(0) === 0x52 && // R
      bin.charCodeAt(1) === 0x49 && // I
      bin.charCodeAt(2) === 0x46 && // F
      bin.charCodeAt(3) === 0x46 // F
    ) {
      const stripped = bin.slice(44);
      let out = '';
      const chunk = 0x8000;
      for (let i = 0; i < stripped.length; i += chunk) {
        out += stripped.slice(i, i + chunk);
      }
      return btoa(out);
    }
  } catch {}
  return rawB64;
};

export async function fetchGeminiModelsWithFallback(
  apiKey?: string,
  signal?: AbortSignal
): Promise<Response> {
  const cleanKey = resolveClientGeminiKey(apiKey);
  const proxyUrl = `/api/gemini/models${cleanKey ? `?apiKey=${encodeURIComponent(cleanKey)}` : ''}`;
  const proxyRes = await fetch(proxyUrl, { method: 'GET', signal });
  if (proxyRes.ok) setApiBackendAvailable(true);
  return proxyRes;
}

export async function fetchGeminiGenerateWithFallback(
  payload: any,
  signal?: AbortSignal
): Promise<Response> {
  const cleanKey = resolveClientGeminiKey(payload?.apiKey);
  const bodyPayload = cleanKey ? { ...payload, apiKey: cleanKey } : payload;
  const proxyRes = await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
    signal,
  });
  if (proxyRes.ok) setApiBackendAvailable(true);
  return proxyRes;
}

export async function fetchGeminiStreamWithFallback(
  payload: any,
  signal?: AbortSignal
): Promise<Response> {
  const cleanKey = resolveClientGeminiKey(payload?.apiKey);
  const bodyPayload = cleanKey ? { ...payload, apiKey: cleanKey } : payload;
  const proxyRes = await fetch('/api/gemini/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
    signal,
  });
  if (proxyRes.ok) setApiBackendAvailable(true);
  return proxyRes;
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
  const bodyPayload = cleanKey
    ? { ...payload, model: targetModel, apiKey: cleanKey }
    : { ...payload, model: targetModel };

  const proxyRes = await fetch('/api/gemini/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyPayload),
    signal,
  });
  if (proxyRes.ok) setApiBackendAvailable(true);
  return proxyRes;
}


