import { getGeminiKey } from './geminiKey';
import { buildRoseSystemInstruction } from './roseConfig';

export async function resolveChatModel(apiKey: string): Promise<string> {
  const chosen = (localStorage.getItem('chat_model') || '').trim();
  let candidate = chosen.replace(/^models\//, '').trim();

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${apiKey}`, {
      headers: { 'x-goog-api-key': apiKey },
    });
    if (res.ok) {
      const data = await res.json();
      const models = Array.isArray(data?.models) ? data.models : [];

      if (candidate) {
        const found = models.find((m: any) => {
          const name = (m?.name || '').replace(/^models\//, '');
          const methods = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
          return name === candidate && methods.includes('generateContent');
        });
        if (found) {
          console.log('[TypedChat] Using chosen chat model:', candidate);
          return candidate;
        }
      }

      const flash = models.find((m: any) => {
        const name = (m?.name || '').replace(/^models\//, '');
        const lower = name.toLowerCase();
        const methods = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
        return methods.includes('generateContent') && lower.includes('flash') && !lower.includes('image') && !lower.includes('vision');
      });
      if (flash) {
        const mName = (flash.name || '').replace(/^models\//, '');
        console.log('[TypedChat] Using discovered flash model:', mName);
        return mName;
      }
    }
  } catch (e) {
    console.warn('[TypedChat] Model resolution failed:', e);
  }

  const fallback = candidate.startsWith('gemini') ? candidate : 'gemini-1.5-flash';
  console.log('[TypedChat] Using fallback model:', fallback);
  return fallback;
}

export async function sendTypedChat(history: Array<{ role: string; content?: string; text?: string }>, userText: string): Promise<string> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    throw new Error('CONNECTIONS-এ Gemini key সেভ করো');
  }

  const model = await resolveChatModel(apiKey);
  console.log('[TypedChat] Model used:', model);

  const last20 = history.slice(-20).map((m) => {
    const role = (m.role === 'model' || m.role === 'assistant' || m.role === 'rose') ? 'model' : 'user';
    const text = m.content || m.text || '';
    return {
      role,
      parts: [{ text }],
    };
  });

  const contents = [
    ...last20,
    { role: 'user', parts: [{ text: userText }] },
  ];

  let settings: any = {};
  let prefs: any = {};
  try {
    const s = localStorage.getItem('iyabd_settings');
    if (s) settings = JSON.parse(s);
    const p = localStorage.getItem('iyabd_preferences');
    if (p) prefs = JSON.parse(p);
  } catch (e) {}

  const sysInstructionText = buildRoseSystemInstruction(settings, prefs, false);

  const body: any = {
    systemInstruction: { parts: [{ text: sysInstructionText }] },
    contents,
    generationConfig: { temperature: 0.8 },
  };

  const isSearchQuery = /(আজ|আজকের|এখন|বর্তমান|খবর|নিউজ|আপডেট|নতুন|latest|news|today|price|দাম|weather|আবহাওয়া)/i.test(userText);

  const makeRequest = async (withSearch: boolean) => {
    const reqBody = { ...body };
    if (withSearch) {
      reqBody.tools = [{ google_search: {} }];
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(reqBody),
      });
    } catch (err: any) {
      throw new Error(`NETWORK: ${err?.message || 'Network request failed'}`);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((p: any) => p && typeof p.text === 'string')?.text;
    if (typeof textPart !== 'string') {
      throw new Error('Invalid response structure from Gemini API');
    }
    return textPart;
  };

  if (isSearchQuery) {
    try {
      return await makeRequest(true);
    } catch (err) {
      console.warn('[TypedChat] Search request failed, retrying without search tool:', err);
      return await makeRequest(false);
    }
  } else {
    return await makeRequest(false);
  }
}
