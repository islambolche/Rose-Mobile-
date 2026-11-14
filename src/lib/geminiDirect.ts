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

export async function fetchGeminiModelsWithFallback(
  apiKey?: string,
  signal?: AbortSignal
): Promise<Response> {
  const cleanKey = resolveClientGeminiKey(apiKey);
  const url = cleanKey ? `/api/gemini/models?apiKey=${encodeURIComponent(cleanKey)}` : '/api/gemini/models';
  return await fetch(url, { method: 'GET', signal });
}

export async function fetchGeminiGenerateWithFallback(
  payload: any,
  signal?: AbortSignal
): Promise<Response> {
  return await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
}

export async function fetchGeminiStreamWithFallback(
  payload: any,
  signal?: AbortSignal
): Promise<Response> {
  return await fetch('/api/gemini/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
}

export async function fetchGeminiTtsWithFallback(
  payload: any,
  signal?: AbortSignal
): Promise<Response> {
  return await fetch('/api/gemini/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
}
