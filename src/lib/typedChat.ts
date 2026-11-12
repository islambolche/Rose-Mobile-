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

  if (chosen && validModels.includes(chosen) && !chosen.includes('gemini-2.5')) {
    return chosen;
  }

  if (validModels.length > 0) {
    const best = validModels.find(m => m.toLowerCase().includes('flash')) || validModels[0];
    localStorage.setItem('chat_model', best);
    return best;
  }

  return 'gemini-3.8-flash';
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

  const setWaitingStatus = (msg: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rose_typing_status', { detail: msg }));
    }
  };

  const executeFetch = async (withSearch: boolean, currentModel: string): Promise<string> => {
    const reqBody = { ...body };
    if (withSearch) {
      reqBody.tools = [{ google_search: {} }];
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(reqBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 404 && errText.includes('Please update your code to use models/')) {
        const match = errText.match(/models\/([a-zA-Z0-9_.-]+)/i);
        if (match && match[1]) {
          const newName = match[1];
          localStorage.setItem('chat_model', newName);
          throw Object.assign(new Error(`Model deprecated, switched to ${newName}`), { newModel: newName, is404Update: true });
        }
      }
      const errObj: any = new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`);
      errObj.status = res.status;
      errObj.modelUsed = currentModel;
      throw errObj;
    }

    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((p: any) => p && typeof p.text === 'string')?.text;
    if (typeof textPart !== 'string') {
      throw new Error('Invalid response structure from Gemini API');
    }
    return textPart;
  };

  const isRetryable = (err: any): boolean => {
    const msg = (err?.message || '').toLowerCase();
    const status = err?.status;
    return (
      status === 503 ||
      status === 429 ||
      msg.includes('503') ||
      msg.includes('429') ||
      msg.includes('unavailable') ||
      msg.includes('resource_exhausted') ||
      msg.includes('high demand') ||
      msg.includes('overloaded') ||
      msg.includes('network')
    );
  };

  let currentModel = model;
  let lastError: any = null;

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      if (attempt > 0) {
        const delay = attempt === 1 ? 1000 : 3000;
        setWaitingStatus('একটু অপেক্ষা…');
        await new Promise(r => setTimeout(r, delay));
      }

      if (isSearchQuery) {
        try {
          const text = await executeFetch(true, currentModel);
          setWaitingStatus('');
          return { text, modelUsed: currentModel };
        } catch (searchErr: any) {
          if (isRetryable(searchErr) && attempt === 0) {
            throw searchErr;
          }
          const text = await executeFetch(false, currentModel);
          setWaitingStatus('');
          return { text, modelUsed: currentModel };
        }
      } else {
        const text = await executeFetch(false, currentModel);
        setWaitingStatus('');
        return { text, modelUsed: currentModel };
      }
    } catch (err: any) {
      lastError = err;
      if (err.is404Update && err.newModel) {
        currentModel = err.newModel;
        continue;
      }
      if (!isRetryable(err)) {
        break;
      }
    }
  }

  try {
    setWaitingStatus('একটু অপেক্ষা…');
    const validModels = await getValidFlashModels(apiKey);
    const nextModel = validModels.find(m => m !== currentModel) || validModels[0];
    if (nextModel && nextModel !== currentModel) {
      console.log('[TypedChat] Trying fallback valid model:', nextModel);
      localStorage.setItem('chat_model', nextModel);
      const text = await executeFetch(isSearchQuery, nextModel);
      setWaitingStatus('');
      return { text, modelUsed: nextModel };
    }
  } catch (fallbackErr: any) {
    lastError = fallbackErr;
  }

  setWaitingStatus('');
  if (!lastError) lastError = new Error('Cannot reach Gemini');
  lastError.modelUsed = currentModel;
  throw lastError;
}
