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

  if (isApiBackendAvailable() !== false) {
    const proxyUrl = `/api/gemini/models${cleanKey ? `?apiKey=${encodeURIComponent(cleanKey)}` : ''}`;
    try {
      const proxyRes = await fetch(proxyUrl, { method: 'GET', signal });
      if (isMissingApiRouteResponse(proxyRes)) {
        setApiBackendAvailable(false);
        if (!cleanKey) {
          return new Response(JSON.stringify({ error: { code: 401, message: 'Add your Gemini key in Settings > Connections.' } }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } else {
        if (proxyRes.ok) setApiBackendAvailable(true);
        return proxyRes;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || !cleanKey) throw err;
    }
  }

  return await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    method: 'GET',
    headers: {
      'x-goog-api-key': cleanKey,
    },
    signal,
  });
}

export async function fetchGeminiGenerateWithFallback(
  payload: any,
  signal?: AbortSignal
): Promise<Response> {
  const cleanKey = resolveClientGeminiKey(payload?.apiKey);

  if (isApiBackendAvailable() !== false) {
    try {
      const proxyRes = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
      if (isMissingApiRouteResponse(proxyRes)) {
        setApiBackendAvailable(false);
        if (!cleanKey) {
          return new Response(JSON.stringify({ error: { code: 401, message: 'Add your Gemini key in Settings > Connections.' } }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } else {
        if (proxyRes.ok) setApiBackendAvailable(true);
        return proxyRes;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || !cleanKey) throw err;
    }
  }

  let cleanModel = String(payload?.model || 'gemini-4-hydrogen').replace(/^models\//, '').trim();
  if (!cleanModel || !cleanModel.startsWith('gemini') || cleanModel.includes('native-audio') || cleanModel.includes('live')) {
    cleanModel = 'gemini-4-hydrogen';
  }

  return await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey,
      },
      body: JSON.stringify(normalizeDirectBody(payload)),
      signal,
    }
  );
}

export async function fetchGeminiStreamWithFallback(
  payload: any,
  signal?: AbortSignal
): Promise<Response> {
  const cleanKey = resolveClientGeminiKey(payload?.apiKey);

  if (isApiBackendAvailable() !== false) {
    try {
      const proxyRes = await fetch('/api/gemini/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
      if (isMissingApiRouteResponse(proxyRes)) {
        setApiBackendAvailable(false);
        if (!cleanKey) {
          return new Response(JSON.stringify({ error: { code: 401, message: 'Add your Gemini key in Settings > Connections.' } }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } else {
        if (proxyRes.ok) setApiBackendAvailable(true);
        return proxyRes;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || !cleanKey) throw err;
    }
  }

  let cleanModel = String(payload?.model || 'gemini-4-hydrogen').replace(/^models\//, '').trim();
  if (!cleanModel || !cleanModel.startsWith('gemini') || cleanModel.includes('native-audio') || cleanModel.includes('live')) {
    cleanModel = 'gemini-4-hydrogen';
  }

  return await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanModel)}:streamGenerateContent?alt=sse`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey,
      },
      body: JSON.stringify(normalizeDirectBody(payload)),
      signal,
    }
  );
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
  const voicesToTry: string[] =
    Array.isArray(payload?.voices) && payload.voices.length > 0
      ? payload.voices.map((v: any) => String(v || '').trim()).filter(Boolean)
      : [String(payload?.voiceName || 'Leda').trim() || 'Leda'];

  if (cleanKey) {
    let lastRes: Response | null = null;
    for (const voiceName of voicesToTry) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: String(payload?.text || '') }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
            },
          }),
          signal,
        }
      );

      lastRes = res;
      if (!res.ok) {
        if (res.status === 400) continue;
        return res;
      }

      const data = await res.json().catch(() => null);
      const rawB64 = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData)?.inlineData?.data;
      if (rawB64) {
        return new Response(
          JSON.stringify({
            audio: stripRiffHeaderFromBase64(rawB64),
            modelUsed: targetModel,
            voiceUsed: voiceName,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    if (lastRes) {
      return lastRes;
    }
  }

  if (isApiBackendAvailable() !== false) {
    try {
      const proxyRes = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, model: targetModel }),
        signal,
      });
      if (isMissingApiRouteResponse(proxyRes)) {
        setApiBackendAvailable(false);
      } else {
        if (proxyRes.ok) setApiBackendAvailable(true);
        return proxyRes;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }
  }

  return new Response(
    JSON.stringify({ error: { message: 'No audio returned from Gemini TTS', code: 500 } }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

