import { ApiKeys } from '../types';
import { extractReplyText } from './ai-utils';
import { directGeminiGenerate, TEXT_MODELS } from './ai-service';
import { getGeminiKey, ensureGeminiReady } from './geminiKey';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function askAI(messages: Message[], apiKeys: ApiKeys, modelId?: string): Promise<string> {
  const cleanKey = String(getGeminiKey() || apiKeys?.gemini || '')
    .replace(/[\r\n\t\s"']+/g, '')
    .trim();

  if (!(await ensureGeminiReady(cleanKey))) {
    return 'Add your Gemini key in Settings > Connections.';
  }

  const systemInstruction = messages.find((m) => m.role === 'system')?.content || '';
  const nonSystem = messages.filter((m) => m.role !== 'system');

  try {
    const data = await directGeminiGenerate({
      model: modelId && modelId.startsWith('gemini') ? modelId : TEXT_MODELS[0],
      contents: nonSystem.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      systemInstruction,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
      apiKey: cleanKey,
    });
    return extractReplyText(data) || 'Could not answer. Please try again.';
  } catch (e: any) {
    console.error('Gemini error:', e);
    return e?.message || 'Cannot reach Gemini. Check your internet and your Gemini key.';
  }
}
