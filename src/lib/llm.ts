import { ApiKeys } from '../types';
import { prepareHistory } from './ai-utils';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const PROVIDERS = [
  { id: 'gemini', url: '/api/gemini/generate' },
  { id: 'groq', url: '/api/groq/chat' },
  { id: 'openrouter', url: 'https://openrouter.ai/api/v1/chat/completions' },
  { id: 'github', url: 'https://models.github.io/inference/chat/completions' },
  { id: 'openai', url: 'https://api.openai.com/v1/chat/completions' },
];

import { getModelRoute } from './modelRouter';

export async function askAI(messages: Message[], apiKeys: ApiKeys, modelId?: string): Promise<string> {
  const model = modelId || 'gemini-3.5-flash';
  const provider = getModelRoute(model);
  const key = apiKeys[provider as keyof ApiKeys];
  const providerObj = PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];
  let providerUrl = providerObj.url;

  if (provider === 'gemini') {
    providerUrl = providerObj.url;
  }

  if (!key && provider === 'groq') {
    // Fallback to gemini if groq key is missing
    return (await callProvider('gemini', '/api/gemini/generate', apiKeys.gemini || '', messages, 'gemini-3.5-flash')) || 'Could not answer. Please try again.';
  }

  try {
    return await callProvider(provider, providerUrl, key || '', messages, model) || 'Could not answer. Please try again.';
  } catch (e) {
    console.error('AI Provider error:', e);
    return 'Could not answer. Please try again.';
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function callProvider(providerId: string, baseUrl: string, key: string, messages: Message[], modelId?: string): Promise<string | null> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (providerId !== 'gemini' && providerId !== 'groq') {
    headers['Authorization'] = `Bearer ${key}`;
  }

  if (providerId === 'github') {
    return handleGitHubRequest(baseUrl, headers, messages);
  }

  const payload = formatPayload(providerId, messages, key, modelId);
  const response = await fetchWithTimeout(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    const data = await response.json();
    return parseResponse(providerId, data);
  }

  console.warn(`Provider ${providerId} failed with status ${response.status}`);
  return null;
}

async function handleGitHubRequest(url: string, headers: Record<string, string>, messages: Message[]): Promise<string | null> {
  try {
    // 1. Try full message history
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices[0].message.content;
    }

    const errText = await response.text();
    const isTooLarge = response.status === 400 || response.status === 413 || 
      /too many tokens|request too large|context_length_exceeded|token limit|prompt is too long/i.test(errText);

    // 2. If payload is too large, fallback to last 6 messages
    if (isTooLarge && messages.length > 6) {
      const systemMsg = messages.find(m => m.role === 'system');
      const nonSystem = messages.filter(m => m.role !== 'system');
      const truncated = nonSystem.slice(-6);
      const retryMessages = systemMsg ? [systemMsg, ...truncated] : truncated;

      const retryResponse = await fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: retryMessages,
        }),
      });

      if (retryResponse.ok) {
        const data = await retryResponse.json();
        return data.choices[0].message.content;
      }
    }

    console.warn(`GitHub provider failed with status ${response.status}`);
    return null;
  } catch (err) {
    console.warn(`GitHub provider error:`, err);
    return null;
  }
}

function formatPayload(providerId: string, messages: Message[], key?: string, modelId?: string) {
  if (providerId === 'gemini') {
    const systemInstruction = messages.find(m => m.role === 'system')?.content || "";
    return {
      model: modelId || 'gemini-3.5-flash',
      apiKey: key,
      systemInstruction,
      contents: prepareHistory(messages.map(m => ({ role: m.role, text: m.content })), systemInstruction),
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      }
    };
  }
  
  if (providerId === 'groq') {
    return {
      model: modelId || 'llama-3.1-70b-versatile',
      messages,
      apiKey: key
    };
  }

  let modelName = modelId || 'gpt-4o-mini';
  if (providerId === 'groq' && !modelId) modelName = 'llama-3.1-70b-versatile';
  if (providerId === 'openrouter' && !modelId) modelName = 'meta-llama/llama-3.3-70b-instruct';

  return {
    model: modelName,
    messages,
  };
}

import { extractReplyText } from './ai-utils';

// ... (other code)

function parseResponse(providerId: string, data: any): string {
  if (providerId === 'gemini') {
    console.log("[LLM] Gemini raw response:", data);
    return extractReplyText(data);
  }
  return data.choices[0].message.content;
}


