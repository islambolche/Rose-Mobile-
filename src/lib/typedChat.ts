import { getGeminiKey } from './geminiKey';
import { buildRoseSystemInstruction } from './roseConfig';

export async function getValidFlashModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${apiKey}`, {
      headers: { 'x-goog-api-key': apiKey },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const models = Array.isArray(data?.models) ? data.models : [];

    const valid: string[] = [];
    for (const m of models) {
      const rawName = typeof m?.name === 'string' ? m.name : '';
      const shortName = rawName.replace(/^models\//, '').trim();
      const lower = shortName.toLowerCase();
      const methods: string[] = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [];

      if (
        shortName &&
        methods.includes('generateContent') &&
        !lower.includes('tts') &&
        !lower.includes('live') &&
        !lower.includes('audio') &&
        !lower.includes('image') &&
        !lower.includes('embedding')
      ) {
        valid.push(shortName);
      }
    }

    valid.sort((a, b) => {
      const aFlash = a.toLowerCase().includes('flash') ? 1 : 0;
      const bFlash = b.toLowerCase().includes('flash') ? 1 : 0;
      if (aFlash !== bFlash) return bFlash - aFlash;

      const vA = parseFloat(a.match(/[\d.]+/)?.[0] || '0');
      const vB = parseFloat(b.match(/[\d.]+/)?.[0] || '0');
      if (vA !== vB) return vB - vA;

      return b.localeCompare(a);
    });

    return valid;
  } catch (e) {
    console.warn('[TypedChat] Model discovery failed:', e);
    return [];
  }
}

export async function resolveChatModel(apiKey: string): Promise<string> {
  const validModels = await getValidFlashModels(apiKey);
  const chosen = (localStorage.getItem('chat_model') || '').replace(/^models\//, '').trim();

  // If chosen is gemini-2.5-flash or not in valid list, replace automatically
  if (chosen && validModels.includes(chosen) && !chosen.includes('gemini-2.5')) {
    console.log('[TypedChat] Using chosen chat model:', chosen);
    return chosen;
  }

  if (validModels.length > 0) {
    const best = validModels.find(m => m.toLowerCase().includes('flash')) || validModels[0];
    localStorage.setItem('chat_model', best);
    console.log('[TypedChat] Dynamically selected chat model:', best, '(Valid models:', validModels, ')');
    return best;
  }

  const fallback = 'gemini-3.8-flash';
  console.log('[TypedChat] Using fallback chat model:', fallback);
  return fallback;
}

export async function sendTypedChat(
  history: Array<{ role: string; content?: string; text?: string }>,
  userText: string
): Promise<{ text: string; modelUsed: string }> {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    throw new Error('CONNECTIONS-এ Gemini key সেভ করো');
  }

  let model = await resolveChatModel(apiKey);
  console.log('[TypedChat] Model being used:', model);

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

  const makeRequest = async (withSearch: boolean, currentModel: string, isRetry: boolean = false): Promise<string> => {
    const reqBody = { ...body };
    if (withSearch) {
      reqBody.tools = [{ google_search: {} }];
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
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
      const netErr: any = new Error(`NETWORK: ${err?.message || 'Network request failed'}`);
      netErr.modelUsed = currentModel;
      throw netErr;
    }

    if (!res.ok) {
      const errText = await res.text();
      // Auto-recovery check on 404 with update suggestion
      if (res.status === 404 && errText.includes('Please update your code to use models/')) {
        const match = errText.match(/models\/([a-zA-Z0-9_.-]+)/i);
        if (match && match[1] && !isRetry) {
          const newName = match[1];
          console.log('[TypedChat] Auto-recovery: updating chat model to:', newName);
          localStorage.setItem('chat_model', newName);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('rose_toast', { detail: `চ্যাট মডেল আপডেট হলো: ${newName}` }));
          }
          // Retry once with new model
          return await makeRequest(withSearch, newName, true);
        }
      }

      const httpErr: any = new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`);
      httpErr.modelUsed = currentModel;
      throw httpErr;
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((p: any) => p && typeof p.text === 'string')?.text;
    if (typeof textPart !== 'string') {
      const structErr: any = new Error('Invalid response structure from Gemini API');
      structErr.modelUsed = currentModel;
      throw structErr;
    }
    return textPart;
  };

  try {
    let text = '';
    if (isSearchQuery) {
      try {
        text = await makeRequest(true, model);
      } catch (err: any) {
        console.warn('[TypedChat] Search request failed, retrying without search tool:', err);
        text = await makeRequest(false, model);
      }
    } else {
      text = await makeRequest(false, model);
    }
    return { text, modelUsed: model };
  } catch (err: any) {
    if (!err.modelUsed) err.modelUsed = model;
    throw err;
  }
}
