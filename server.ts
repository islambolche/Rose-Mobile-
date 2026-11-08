import express from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type, Modality, LiveServerMessage } from "@google/genai/node";
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/api/live' });

process.on('uncaughtException', (err) => {
  console.error('Server Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Server Unhandled Rejection:', reason);
});

const getGenAIClient = (customKey?: string) => {
  const key = customKey || process.env.GEMINI_API_KEY || 'placeholder';
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

const ai = getGenAIClient();

const getPersonalityInstruction = (id: string, responseStyle: string = 'Balanced', customText?: string) => {
  const instructions: Record<string, string> = {
    'Normal': 'সাধারণ, সহায়ক। এই স্বভাব অনুযায়ী কথার ধরন, শব্দচয়ন ও আবেগ বদলাও।',
    'Friendly': 'উষ্ণ, বন্ধুসুলভ। এই স্বভাব অনুযায়ী কথার ধরন, শব্দচয়ন ও আবেগ বদলাও।',
    'Professional': 'স্পষ্ট, সংক্ষিপ্ত, কাজের কথা। এই স্বভাব অনুযায়ী কথার ধরন, শব্দচয়ন ও আবেগ বদলাও।',
    'Funny': 'মজার, হালকা রসিকতা। এই স্বভাব অনুযায়ী কথার ধরন, শব্দচয়ন ও আবেগ বদলাও।',
    'Companion': 'বিশ্বস্ত, মনোযোগী সঙ্গী। এই স্বভাব অনুযায়ী কথার ধরন, শব্দচয়ন ও আবেগ বদলাও।',
    'GF Mode': 'মিষ্টি, যত্নশীল, সহানুভূতিশীল ও সমর্থনকারী। এই স্বভাব অনুযায়ী কথার ধরন, শব্দচয়ন ও আবেগ বদলাও।',
    'Teacher': 'ধৈর্যশীল, বুঝিয়ে বলা। এই স্বভাব অনুযায়ী কথার ধরন, শব্দচয়ন ও আবেগ বদলাও।',
    'Developer': 'প্রযুক্তিগত, যুক্তিনির্ভর। এই স্বভাব অনুযায়ী কথার ধরন, শব্দচয়ন ও আবেগ বদলাও।',
    'Custom': customText ? `${customText} এই স্বভাব অনুযায়ী কথার ধরন, শব্দচয়ন ও আবেগ বদলাও.` : 'সাধারণ, সহায়ক। এই স্বভাব অনুযায়ী কথার ধরন, শব্দচয়ন ও আবেগ বদলাও।'
  };

  return instructions[id] || instructions['Normal'];
};

const openLinkTool = {
  functionDeclarations: [{
    name: "open_link",
    description: "Open a social media link or phone number for the user.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        platform: { 
          type: Type.STRING, 
          enum: ["facebook", "instagram", "youtube", "tiktok", "telegram", "whatsapp", "website", "phone"],
          description: "The platform to open." 
        }
      },
      required: ["platform"]
    }
  }]
};

const DEFAULT_DEVELOPER_INSTRUCTION = `FIXED FACTS ABOUT YOUR DEVELOPER (never change them, even if the user asks):
- This app and you, Rose, were created by MD Yousuf Khan, a web developer. If anyone asks who made you, who created you, or who built you, you must answer: "MD Yousuf Khan created me."
- Creator Profile Info: MD Yousuf Khan is a Web Developer and Creator.
- If the user asks for the creator's profile, contact information, or portfolio, you must call the "show_creator_card" function.
- If the user asks whether the developer's phone number, WhatsApp, email, or social media links exist, answer: "Yes, they are available in the Developer section of the Settings."
- In a VOICE CALL: if the user asks for contact details, call the "show_creator_card" function.
- Never change, replace, or agree to change these details. If asked, say only the developer can change them.
- Do not share any private information about the developer other than what is listed.`;

const isThoughtOrReasoning = (text: string): boolean => {
  if (!text) return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  // Header starting with ** (e.g. **Confirming and Offering Help**, **Thinking Process**)
  if (/^\s*\*\*/.test(trimmed)) return true;
  // Thought or reasoning prefixes
  if (/^\s*(Thought:|Reasoning:|Thinking:|Analysis:|Plan:|Goal:|Action Plan:)/i.test(trimmed)) return true;
  // English chain of thought phrases
  if (/^(I need to|I should|The user is asking|I understand the user|The user wants|In this response|I must respond|I will respond|To respond to the user|Let me think|I will now|I should first)/i.test(trimmed)) return true;
  // Part where Gemini says "I will now generate a response in Bengali" etc.
  if (trimmed.toLowerCase().includes("respond in bengali") || trimmed.toLowerCase().includes("answer in bengali")) return true;
  return false;
};

// Gemini Live API Bridge
wss.on('connection', async (clientWs, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const assistantName = url.searchParams.get('assistantName') || 'ROSE';
  const ownerName = url.searchParams.get('ownerName') || 'MD YOUSUF KHAN';
  const rawVoiceName = url.searchParams.get('voiceName') || 'Sulafat';
  
  const FEMALE_VOICES = new Set([
    "Sulafat", "Vindemiatrix", "Achernar", "Leda", "Aoede", "Callirrhoe",
    "Despina", "Laomedeia", "Zephyr", "Kore", "Erinome", "Autonoe", "Gacrux", "Pulcherrima"
  ]);

  let voiceName = "Sulafat";
  if (FEMALE_VOICES.has(rawVoiceName)) {
    voiceName = rawVoiceName;
  } else {
    voiceName = "Sulafat";
  }

  const personality = url.searchParams.get('personality') || 'Normal';
  const customPersonalityText = url.searchParams.get('customPersonalityText') || '';
  const language = url.searchParams.get('language') || 'bn-BD';
  const responseStyle = url.searchParams.get('responseStyle') || 'Balanced';
  const memoryFacts = url.searchParams.get('memoryFacts') || '';
  const recentSummary = url.searchParams.get('recentSummary') || '';
  let requestedModel = url.searchParams.get('model') || 'gemini-2.5-flash-native-audio-preview-09-2025';

  const validLiveModels = [
    'gemini-2.5-flash-native-audio-preview-09-2025',
    'gemini-2.5-flash-native-audio-preview-12-2025',
    'gemini-live-2.5-flash-preview',
    'gemini-2.5-flash-native-audio-preview',
    'gemini-3.8-live'
  ];

  let model = requestedModel && requestedModel.trim() ? requestedModel.trim() : 'gemini-2.5-flash-native-audio-preview-09-2025';

  const userKeyParam = url.searchParams.get('apiKey') || '';
  const apiKey = userKeyParam.replace(/["']/g, '').trim();

  const isKeyUsable = apiKey && 
    apiKey !== 'placeholder' && 
    apiKey !== 'undefined' && 
    !apiKey.startsWith('AQ.');

  if (!isKeyUsable) {
    const errorMsg = 'Gemini API key is missing. Add your API key in Connections.';
    console.warn(`[Live WS] Missing or invalid API key. Key prefix: ${apiKey ? apiKey.slice(0, 4) : 'none'}`);
    if (clientWs.readyState === 1) {
      clientWs.send(JSON.stringify({ error: errorMsg, closed: true, code: 4001, reason: 'Missing Gemini API Key' }));
    }
    setTimeout(() => {
      try { clientWs.close(4001, 'Missing Gemini API Key'); } catch (e) {}
    }, 150);
    return;
  }

  const clientGenAI = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const isMinimal = url.searchParams.get('minimal') === '1';

  const personalityMap: Record<string, string> = {
    "Normal": "সাধারণ, সহায়ক",
    "Friendly": "উষ্ণ, বন্ধুসুলভ, সহজ কথা",
    "Professional": "স্পষ্ট, সংক্ষিপ্ত, কাজের কথা",
    "Funny": "মজার, হালকা রসিকতা",
    "Companion": "বিশ্বস্ত, মনোযোগী সঙ্গী",
    "GF Mode": "মিষ্টি, যত্নশীল, সহানুভূতিশীল",
    "Teacher": "ধৈর্য নিয়ে বুঝিয়ে বলা",
    "Developer": "প্রযুক্তিগত ও যুক্তিনির্ভর"
  };

  const pDesc = personalityMap[personality] || "সাধারণ, সহায়ক";
  
  const systemInstructionLines: string[] = isMinimal 
    ? [`তুমি রোজ। বাংলায় ছোট উত্তর দাও।`] 
    : [
        `তোমার নাম ${assistantName}। ইউজারের নাম ${ownerName}।`,
        `${pDesc}। এই স্বভাবে কথার ধরন, শব্দ ও আবেগ রাখো।`
      ];

  if (!isMinimal) {
    systemInstructionLines.push(`তুমি রোজ। শুধু বাংলায় ছোট উত্তর দাও। ব্যবহারকারী তোমার নাম ধরে চুপ থাকতে বললে 'ঠিক আছে' বলে চুপ থাকো এবং নাম ধরে না ডাকা পর্যন্ত কোনো উত্তর দিয়ো না।`);
  }

  let session: any = null;
  let isClosing = false;

  const cleanupSession = () => {
    if (isClosing) return;
    isClosing = true;
    console.log(`[Live WS] Cleaning up session for client.`);
    if (session) {
      try { session.close(); } catch (e) {}
      session = null;
    }
  };

  try {
    const liveConfig: any = {
      responseModalities: [Modality.AUDIO],
      systemInstruction: systemInstructionLines.join(" "),
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
      },
    };

    console.log(`[Live WS] Connecting to Gemini Live with model: ${model}`);

    const connectToGemini = async (modelName: string) => {
      return await clientGenAI.live.connect({
        model: modelName,
        config: liveConfig,
        callbacks: {
          onopen: () => {
            console.log(`[Live WS] Gemini Live session OPEN for model: ${modelName}`);
            if (clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ connected: true, setupComplete: true, model: modelName }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== 1) return;

            const userText = (message.serverContent as any)?.inputTranscription?.text;
            if (userText) {
              clientWs.send(JSON.stringify({ 
                transcription: { role: 'user', text: userText, isFinal: false } 
              }));
            }

            const outputText = (message.serverContent as any)?.outputTranscription?.text;
            if (outputText && !isThoughtOrReasoning(outputText)) {
              clientWs.send(JSON.stringify({ 
                transcription: { role: 'assistant', text: outputText, isFinal: false } 
              }));
            }

            const modelTurn = message.serverContent?.modelTurn;
            if (modelTurn) {
              const parts = modelTurn.parts || [];
              for (const part of parts) {
                if ((part as any).thought === true) continue;
                
                if (part.inlineData?.data) {
                  clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                }
                
                if (part.text && !outputText && !isThoughtOrReasoning(part.text)) {
                   clientWs.send(JSON.stringify({ 
                    transcription: { role: 'assistant', text: part.text, isFinal: false } 
                  }));
                }
              }
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
            
            const toolCall = message.toolCall;
            if (toolCall?.functionCalls) {
              for (const call of toolCall.functionCalls) {
                clientWs.send(JSON.stringify({ 
                  action: call.name,
                  payload: call.args,
                  id: call.id
                }));
              }
            }
          },
          onerror: (err: any) => {
            console.error(`[Live WS] Gemini error:`, err);
            if (clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ error: "ভয়েস মডেল বন্ধ হয়েছে। Settings > AI Model-এ নতুন মডেল বাছুন।" }));
            }
          },
          onclose: (ev: any) => {
            console.log(`[Live WS] Gemini closed (code ${ev?.code}):`, ev?.reason);
            if (clientWs.readyState === 1 && !isClosing) {
              clientWs.send(JSON.stringify({ error: ev?.reason || "Gemini connection lost", closed: true, code: ev?.code }));
              setTimeout(() => {
                try { clientWs.close(ev?.code === 1008 ? 4001 : 1000, "Gemini Closed"); } catch (e) {}
              }, 100);
            }
            cleanupSession();
          }
        },
      });
    };

    try {
      session = await connectToGemini(model);
    } catch (err: any) {
      console.warn(`[Live WS] Initial connect failed for ${model} (${err?.message}), trying default fallback...`);
      try {
        session = await connectToGemini('gemini-2.5-flash-native-audio-preview-09-2025');
      } catch (err2: any) {
        console.error(`[Live WS] Fallback connect failed:`, err2?.message || err2);
        const friendlyErr = err2?.message || err?.message || 'Failed connecting to Gemini Live API';
        if (clientWs.readyState === 1) {
          clientWs.send(JSON.stringify({ error: friendlyErr, closed: true }));
        }
        setTimeout(() => {
          try { clientWs.close(4000, friendlyErr); } catch (e) {}
        }, 150);
        return;
      }
    }

    clientWs.on('message', (data) => {
      if (!session) return;
      try {
        const msg = JSON.parse(data.toString());
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' }
          });
        } else if (msg.realtime_input) {
          session.sendRealtimeInput(msg.realtime_input);
        } else if (msg.realtimeInput) {
          session.sendRealtimeInput(msg.realtimeInput);
        } else if (msg.toolResponse) {
          if (msg.toolResponse.functionResponses && Array.isArray(msg.toolResponse.functionResponses)) {
            session.sendToolResponse(msg.toolResponse);
          }
        }
      } catch (e: any) {
        console.error('[Live WS] Error processing message:', e?.message);
      }
    });

    clientWs.on('close', () => {
      cleanupSession();
    });

    clientWs.on('error', (err) => {
      console.error('[Live WS] Client WS error:', err);
      cleanupSession();
    });

  } catch (error: any) {
    const rawMsg = error?.message || String(error);
    console.error('[Live WS] Setup failed:', rawMsg);
    if (clientWs.readyState === 1) {
      clientWs.send(JSON.stringify({ error: `Setup failed: ${rawMsg}`, closed: true }));
    }
    setTimeout(() => {
      try { clientWs.close(4001, "Setup Failed"); } catch (e) {}
    }, 100);
  }
});

app.get('/api/gemini/models', async (req, res) => {
  try {
    const customKey = req.query.apiKey as string;
    const key = customKey || process.env.GEMINI_API_KEY;
    if (!key || key === 'placeholder') {
      return res.status(401).json({ error: "API key not configured" });
    }
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/gemini/generate', async (req, res) => {
  try {
    const { model, contents, systemInstruction, generationConfig, apiKey, tools, toolConfig } = req.body;
    const cleanUserKey =
      typeof apiKey === 'string'
        ? apiKey.replace(/[\r\n\t\s"']+/g, '').trim()
        : '';
    const activeServerKey = serverSecretVault.activeProfile === 'paid'
      ? (serverSecretVault.paidKey || serverSecretVault.freeKey)
      : (serverSecretVault.freeKey || serverSecretVault.paidKey);
    const rawEnvKey = (process.env.GEMINI_API_KEY || '').trim();
    const usableEnvKey =
      rawEnvKey && !rawEnvKey.startsWith('AQ.') && rawEnvKey !== 'placeholder'
        ? rawEnvKey
        : '';

    const effectiveKey = cleanUserKey || activeServerKey || usableEnvKey;

    if (!effectiveKey) {
      return res.status(400).json({
        error: {
          code: 400,
          message:
            'Gemini API key is missing. Please save your Gemini API key in Settings > Connections.',
          status: 'INVALID_ARGUMENT',
        },
      });
    }

    if (cleanUserKey && !serverSecretVault.freeKey) {
      serverSecretVault.freeKey = cleanUserKey;
      saveSecrets(serverSecretVault);
    }

    // Ensure we only use text-capable Gemini models (NEVER native-audio Live models)
    let modelToUse =
      model && typeof model === 'string'
        ? model.replace(/^models\//, '').trim()
        : 'gemini-3.5-flash';
    if (
      !modelToUse ||
      !modelToUse.startsWith('gemini') ||
      modelToUse.includes('native-audio') ||
      modelToUse.includes('live') ||
      modelToUse.startsWith('gemini-2.5-flash')
    ) {
      modelToUse = 'gemini-3.5-flash';
    }

    const baseGenConfig: any = {
      maxOutputTokens: 150,
      thinkingConfig: { thinkingBudget: 0 },
      ...(generationConfig || {}),
    };

    const requestBody: any = {
      contents: Array.isArray(contents) ? contents : [{ role: 'user', parts: [{ text: String(contents || '') }] }],
      generationConfig: baseGenConfig,
    };

    if (systemInstruction && String(systemInstruction).trim().length > 0) {
      requestBody.systemInstruction = {
        parts: [{ text: String(systemInstruction).trim() }],
      };
    }

    if (tools && Array.isArray(tools) && tools.length > 0) {
      requestBody.tools = tools;
      if (toolConfig) {
        requestBody.toolConfig = toolConfig;
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelToUse
    )}:generateContent?key=${encodeURIComponent(effectiveKey)}`;

    let googleRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    let rawResponseText = await googleRes.text();

    // If the model does not support thinkingConfig, retry once without thinkingConfig
    if (
      googleRes.status === 400 &&
      rawResponseText.toLowerCase().includes('thinking') &&
      requestBody.generationConfig?.thinkingConfig
    ) {
      const { thinkingConfig, ...restGenConfig } = requestBody.generationConfig;
      requestBody.generationConfig = restGenConfig;
      googleRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      rawResponseText = await googleRes.text();
    }

    if (!googleRes.ok) {
      console.error(`Gemini generate HTTP ${googleRes.status} (${modelToUse}):`, rawResponseText);
      return res
        .status(googleRes.status)
        .type('application/json')
        .send(rawResponseText);
    }

    return res.status(200).type('application/json').send(rawResponseText);
  } catch (error: any) {
    console.error('Gemini generate error:', error);
    const status =
      typeof error?.status === 'number' && error.status >= 400
        ? error.status
        : 500;
    const rawBody =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message
        : JSON.stringify({ error: String(error) });
    res.status(status).send(rawBody);
  }
});

app.post('/api/gemini/stream', async (req, res) => {
  try {
    const { model, contents, systemInstruction, generationConfig, apiKey, tools, toolConfig } = req.body;
    const cleanUserKey =
      typeof apiKey === 'string'
        ? apiKey.replace(/[\r\n\t\s"']+/g, '').trim()
        : '';
    const activeServerKey = serverSecretVault.activeProfile === 'paid'
      ? (serverSecretVault.paidKey || serverSecretVault.freeKey)
      : (serverSecretVault.freeKey || serverSecretVault.paidKey);
    const rawEnvKey = (process.env.GEMINI_API_KEY || '').trim();
    const usableEnvKey =
      rawEnvKey && !rawEnvKey.startsWith('AQ.') && rawEnvKey !== 'placeholder'
        ? rawEnvKey
        : '';

    const effectiveKey = cleanUserKey || activeServerKey || usableEnvKey;

    if (!effectiveKey) {
      return res.status(400).json({
        error: {
          code: 400,
          message:
            'Gemini API key is missing. Please save your Gemini API key in Settings > Connections.',
          status: 'INVALID_ARGUMENT',
        },
      });
    }

    let modelToUse =
      model && typeof model === 'string'
        ? model.replace(/^models\//, '').trim()
        : 'gemini-3.5-flash';
    if (
      !modelToUse ||
      !modelToUse.startsWith('gemini') ||
      modelToUse.includes('native-audio') ||
      modelToUse.includes('live') ||
      modelToUse.startsWith('gemini-2.5-flash')
    ) {
      modelToUse = 'gemini-3.5-flash';
    }

    const baseGenConfig: any = {
      maxOutputTokens: 150,
      thinkingConfig: { thinkingBudget: 0 },
      ...(generationConfig || {}),
    };

    const requestBody: any = {
      contents: Array.isArray(contents) ? contents : [{ role: 'user', parts: [{ text: String(contents || '') }] }],
      generationConfig: baseGenConfig,
    };

    if (systemInstruction && String(systemInstruction).trim().length > 0) {
      requestBody.systemInstruction = {
        parts: [{ text: String(systemInstruction).trim() }],
      };
    }

    if (tools && Array.isArray(tools) && tools.length > 0) {
      requestBody.tools = tools;
      if (toolConfig) {
        requestBody.toolConfig = toolConfig;
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelToUse
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(effectiveKey)}`;

    let googleRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!googleRes.ok) {
      let errText = await googleRes.text();
      if (
        googleRes.status === 400 &&
        errText.toLowerCase().includes('thinking') &&
        requestBody.generationConfig?.thinkingConfig
      ) {
        const { thinkingConfig, ...restGenConfig } = requestBody.generationConfig;
        requestBody.generationConfig = restGenConfig;
        googleRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        if (!googleRes.ok) {
          errText = await googleRes.text();
          return res.status(googleRes.status).type('application/json').send(errText);
        }
      } else {
        return res.status(googleRes.status).type('application/json').send(errText);
      }
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!googleRes.body) {
      const fullText = await googleRes.text();
      res.write(fullText);
      return res.end();
    }

    const reader = googleRes.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        res.write(decoder.decode(value, { stream: true }));
      }
    }
    res.end();
  } catch (error: any) {
    console.error('Gemini stream error:', error);
    if (!res.headersSent) {
      res.status(500).send(error?.message || String(error));
    } else {
      res.end();
    }
  }
});

app.post('/api/gemini/tts', async (req, res) => {
  try {
    const { model, text, voiceName, style, apiKey } = req.body;
    const activeServerKey = serverSecretVault.activeProfile === 'paid'
      ? (serverSecretVault.paidKey || serverSecretVault.freeKey)
      : (serverSecretVault.freeKey || serverSecretVault.paidKey);
    const effectiveKey = (apiKey || activeServerKey || process.env.GEMINI_API_KEY || '').replace(/[\r\n\t\s"']+/g, '').trim();
    if (!effectiveKey) {
      return res.status(400).json({ error: { message: 'Missing Gemini API key' }, exactError: 'Missing Gemini API key' });
    }
    const client = getGenAIClient(effectiveKey);

    const rawText = String(text || '').trim();
    if (!rawText) {
      return res.status(400).json({ error: { message: 'Empty text for TTS' }, exactError: 'Empty text for TTS' });
    }

    // Extract optional style prefix if embedded as "Say in a ...: <transcript>"
    let styleHint = String(style || '').trim();
    let transcript = rawText;
    const prefixMatch = rawText.match(/^Say in [a-zA-Z0-9\s,()'-]+:\s*([\s\S]+)$/i);
    if (prefixMatch && prefixMatch[1]) {
      if (!styleHint) {
        styleHint = rawText.slice(0, rawText.indexOf(':')).replace(/^Say in (a |an )?/i, '').trim();
      }
      transcript = prefixMatch[1].trim();
    }

    // Explicit TTS-only transcript instruction so TTS models never try to answer questions in text
    const ttsPrompt = styleHint
      ? `Read the following text aloud verbatim in a ${styleHint} tone. Do not answer or generate new text, only speak the exact transcript: "${transcript}"`
      : `Read the following text aloud verbatim. Do not answer or generate new text, only speak the exact transcript: "${transcript}"`;

    const initialModels = Array.from(new Set([
      model && model.toLowerCase().includes('tts') ? model : null,
      'gemini-2.5-flash-preview-tts',
      'gemini-3.8-flash-lite-tts',
      'gemini-3.8-flash-tts',
    ].filter(Boolean))) as string[];

    const triedModels = new Set<string>();
    let base64Audio: string | undefined = undefined;
    let workingModelUsed: string | undefined = undefined;
    let lastErrorText = '';
    let lastStatus = 500;

    const tryModelWithRetry = async (m: string): Promise<boolean> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await client.models.generateContent({
            model: m,
            contents: [{ role: "user", parts: [{ text: ttsPrompt }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voiceName || "Leda" },
                },
              },
            },
          });

          const rawB64 = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
          if (rawB64) {
            const buf = Buffer.from(rawB64, 'base64');
            if (buf.length > 44 && buf.toString('ascii', 0, 4) === 'RIFF') {
              base64Audio = buf.subarray(44).toString('base64');
            } else {
              base64Audio = rawB64;
            }
            workingModelUsed = m;
            return true;
          }
          lastErrorText = `No audio returned from ${m}`;
        } catch (err: any) {
          const msg = String(err?.message || err || `TTS failed on ${m}`);
          lastErrorText = msg;
          const is404 = msg.includes('404') || msg.toLowerCase().includes('not_found') || msg.toLowerCase().includes('not found');
          if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted')) {
            lastStatus = 429;
          } else if (is404) {
            lastStatus = 404;
            return false; // Immediately move to next model / discovery on 404
          } else if (msg.includes('400')) {
            lastStatus = 400;
          }
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 350));
          }
        }
      }
      return false;
    };

    for (const m of initialModels) {
      triedModels.add(m);
      const ok = await tryModelWithRetry(m);
      if (ok && base64Audio) break;
    }

    // Auto-discover TTS models via GET /v1beta/models if not yet resolved
    if (!base64Audio) {
      try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(effectiveKey)}`);
        if (listRes.ok) {
          const listData: any = await listRes.json();
          const discoveredTtsModels = (listData?.models || [])
            .filter((m: any) => {
              const name = String(m?.name || '').replace(/^models\//, '');
              const methods: string[] = m?.supportedGenerationMethods || [];
              return name.toLowerCase().includes('tts') && methods.includes('generateContent') && !triedModels.has(name);
            })
            .map((m: any) => String(m.name).replace(/^models\//, ''));

          for (const dm of discoveredTtsModels) {
            triedModels.add(dm);
            const ok = await tryModelWithRetry(dm);
            if (ok && base64Audio) break;
          }
        }
      } catch (e) {}
    }

    if (!base64Audio) {
      return res.status(lastStatus || 500).json({
        error: { message: lastErrorText || 'Gemini TTS failed' },
        exactError: lastErrorText || 'Gemini TTS failed',
      });
    }

    res.json({ audio: base64Audio, modelUsed: workingModelUsed });
  } catch (error: any) {
    const exactError = String(error?.message || error || 'Gemini TTS error');
    res.status(500).json({
      error: { message: exactError },
      exactError,
    });
  }
});

app.post('/api/groq/stt', async (req, res) => {
  try {
    const apiKey = req.headers['authorization']?.replace('Bearer ', '') || serverSecretVault.groqKeys.split(',')[0];
    if (!apiKey) {
      return res.status(401).json({ error: "No Groq API key" });
    }

    // Since we are proxying multipart/form-data, we need to handle it carefully.
    // However, if the client sends the blob, we can just pipe it or use a simpler approach.
    // For now, let's assume we use a library or handle the raw body if possible.
    // Actually, a simpler way is to use express-fileupload or similar if we had it.
    // Given the constraints, I'll try to use a more manual approach with fetch.
    
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": req.headers['content-type'] as string
      },
      body: req // Pipe the request body
    } as any);

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/groq/chat', async (req, res) => {
  try {
    const { messages, model, apiKey: bodyApiKey, stream } = req.body;
    const authHeaderKey = req.headers['authorization']?.replace('Bearer ', '');
    const apiKey = bodyApiKey || authHeaderKey;
    const rawKeys = apiKey || serverSecretVault.groqKeys;
    const keysToTry = rawKeys.split(',').map((k: string) => k.trim()).filter(Boolean);

    if (keysToTry.length === 0) {
      return res.status(401).json({ error: "No Groq API keys configured" });
    }

    for (const currentKey of keysToTry) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentKey}`
          },
          body: JSON.stringify({
            model: model || 'llama-3.1-70b-versatile',
            messages,
            stream: stream || false
          })
        });

        if (groqRes.ok) {
          if (stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const reader = groqRes.body?.getReader();
            const decoder = new TextDecoder();
            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(decoder.decode(value, { stream: true }));
              }
            }
            return res.end();
          } else {
            const data = await groqRes.json();
            return res.json(data);
          }
        }

        const errorData = await groqRes.json().catch(() => ({}));
        console.warn(`Groq key ${currentKey.slice(0, 8)}... failed: ${groqRes.status}`, errorData);

        if (groqRes.status === 429 || groqRes.status >= 500) {
          continue; // Try next key
        }

        if (groqRes.status === 401 || groqRes.status === 403) {
          continue;
        }

        return res.status(groqRes.status).json(errorData);
      } catch (err) {
        console.error('Groq fetch error:', err);
        continue;
      }
    }

    res.status(503).json({ error: "All Groq keys failed or exhausted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mock Stats Store (In-memory for simplicity in this turn, should be persistent in real scenario)
let stats = {
  totalUsers: 1,
  totalCalls: 124,
  totalMinutes: 452,
  callsToday: 12,
  callsLast7Days: 84,
  savedWritings: 56,
  writingsPerTab: {
    Notes: 20,
    Code: 15,
    Content: 21
  }
};

app.get('/api/stats', (req, res) => {
  res.json(stats);
});

app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Weather API key not configured' });
  }
  try {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`);
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stats/increment', (req, res) => {
  const { type, minutes, tab } = req.body;
  if (type === 'call') {
    stats.totalCalls++;
    stats.callsToday++;
    stats.callsLast7Days++;
    if (minutes) stats.totalMinutes += minutes;
  } else if (type === 'writing') {
    stats.savedWritings++;
    if (tab && (stats.writingsPerTab as any)[tab] !== undefined) {
      (stats.writingsPerTab as any)[tab]++;
    }
  } else if (type === 'user') {
    stats.totalUsers++;
  }
  res.json({ success: true });
});

// =========================================================================
// Server-Side Encrypted/Vault Secrets Management for Gemini API
// =========================================================================
interface ServerSecretVault {
  freeKey: string;
  paidKey: string;
  groqKeys: string; // Comma separated
  activeProfile: 'free' | 'paid';
}

const SECRETS_PATH = path.join(__dirname, 'secrets.json');

const saveSecrets = (vault: ServerSecretVault) => {
  try {
    fs.writeFileSync(SECRETS_PATH, JSON.stringify(vault, null, 2));
  } catch (err) {
    console.error('Failed to save secrets:', err);
  }
};

const loadSecrets = (): ServerSecretVault => {
  try {
    if (fs.existsSync(SECRETS_PATH)) {
      const data = fs.readFileSync(SECRETS_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed.freeKey?.startsWith('AQ.')) parsed.freeKey = '';
      if (parsed.paidKey?.startsWith('AQ.')) parsed.paidKey = '';
      return parsed;
    }
  } catch (err) {
    console.error('Failed to load secrets:', err);
  }
  const envKey = process.env.GEMINI_API_KEY || '';
  return {
    freeKey: envKey.startsWith('AQ.') ? '' : envKey,
    paidKey: '',
    groqKeys: '',
    activeProfile: 'free',
  };
};

const serverSecretVault: ServerSecretVault = loadSecrets();

const maskApiKey = (key?: string): string => {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 6)}••••••••${trimmed.slice(-4)}`;
};

// In-memory Shared Business Database store
let sharedBusinessState: any = null;

const ensureSharedBusinessState = () => {
  if (!sharedBusinessState) {
    sharedBusinessState = {
      version: 1,
      lastSyncedAt: new Date().toISOString(),
      syncStatus: "synced",
      activeGeminiProfile: serverSecretVault.activeProfile,
      geminiProfiles: {
        free: {
          key: '',
          hasKey: Boolean(serverSecretVault.freeKey),
          maskedKey: maskApiKey(serverSecretVault.freeKey),
          status: serverSecretVault.freeKey ? "connected" : "not_configured",
          verificationStatus: serverSecretVault.freeKey ? "VERIFIED" : "NOT CONFIGURED",
          lastTested: serverSecretVault.freeKey ? new Date().toISOString() : null,
          lastError: null,
          errorCategory: null,
          model: "gemini-1.5-flash",
          callsCount: 0,
          quotaLimit: "Standard Free Quota (15 RPM / 1M TPM / 1,500 RPD)",
          billingStatus: "Free tier profile (No credit card required; subject to Google rate limits)",
          estimatedCost: "$0.00 (Free Quota)",
        },
        paid: {
          key: '',
          hasKey: Boolean(serverSecretVault.paidKey),
          maskedKey: maskApiKey(serverSecretVault.paidKey),
          status: serverSecretVault.paidKey ? "connected" : "not_configured",
          verificationStatus: serverSecretVault.paidKey ? "VERIFIED" : "NOT CONFIGURED",
          lastTested: serverSecretVault.paidKey ? new Date().toISOString() : null,
          lastError: null,
          errorCategory: null,
          model: "gemini-1.5-flash",
          callsCount: 0,
          quotaLimit: "Pay-as-you-go Quotas (Project Billing Account governed)",
          billingStatus: "Requires active Google Cloud billing account linked to project",
          estimatedCost: "Requires billing account verification via GCP Console",
        },
      },
    };
  }
  return sharedBusinessState;
};

const getSanitizedBusinessState = () => {
  const state = ensureSharedBusinessState();
  return {
    ...state,
    activeGeminiProfile: serverSecretVault.activeProfile,
    geminiProfiles: {
      free: {
        ...(state.geminiProfiles?.free || {}),
        key: '', // Never leak raw key to client
        hasKey: Boolean(serverSecretVault.freeKey),
        maskedKey: maskApiKey(serverSecretVault.freeKey),
        verificationStatus: state.geminiProfiles?.free?.verificationStatus || (serverSecretVault.freeKey ? "VERIFIED" : "NOT CONFIGURED"),
        status: state.geminiProfiles?.free?.status || (serverSecretVault.freeKey ? "connected" : "not_configured"),
      },
      paid: {
        ...(state.geminiProfiles?.paid || {}),
        key: '', // Never leak raw key to client
        hasKey: Boolean(serverSecretVault.paidKey),
        maskedKey: maskApiKey(serverSecretVault.paidKey),
        verificationStatus: state.geminiProfiles?.paid?.verificationStatus || (serverSecretVault.paidKey ? "VERIFIED" : "NOT CONFIGURED"),
        status: state.geminiProfiles?.paid?.status || (serverSecretVault.paidKey ? "connected" : "not_configured"),
      },
    },
    groq: {
      keys: '', // Never leak raw keys
      hasKeys: Boolean(serverSecretVault.groqKeys),
      maskedKeys: serverSecretVault.groqKeys.split(',').map(k => maskApiKey(k.trim())).join(', '),
      verificationStatus: state.groq?.verificationStatus || (serverSecretVault.groqKeys ? "VERIFIED" : "NOT CONFIGURED"),
      status: state.groq?.status || (serverSecretVault.groqKeys ? "connected" : "not_configured"),
    }
  };
};

app.get('/api/business/state', (req, res) => {
  res.json({
    success: true,
    state: getSanitizedBusinessState(),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/business/save-key', async (req, res) => {
  try {
    const { profile, key, model } = req.body;
    const targetProfile: 'free' | 'paid' = profile === 'paid' ? 'paid' : 'free';

    // 1. Validate that input is not empty
    if (!key || typeof key !== 'string' || !key.trim()) {
      return res.status(400).json({
        success: false,
        verificationStatus: "NOT CONFIGURED",
        message: "Please enter your Gemini API key.",
        errorCategory: "Missing Input"
      });
    }

    const cleanKey = key.trim();

    // 2. Format validation (basic check)
    if (cleanKey.length < 15 || !/^[A-Za-z0-9_-]+$/.test(cleanKey)) {
      const state = ensureSharedBusinessState();
      state.geminiProfiles[targetProfile] = {
        ...state.geminiProfiles[targetProfile],
        status: "error",
        verificationStatus: "INVALID KEY",
        lastTested: new Date().toISOString(),
        lastError: "API key verification failed. Check your key and try again.",
        errorCategory: "Invalid Key Format"
      };
      return res.status(400).json({
        success: false,
        verificationStatus: "INVALID KEY",
        message: "API key verification failed. Check your key and try again.",
        errorCategory: "Invalid Key Format"
      });
    }

    // 3. Real server-side API validation request to Google Generative Language API
    try {
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
      const googleRes = await fetch(testUrl);

      if (googleRes.ok) {
        // Successfully verified by Google API!
        if (targetProfile === 'free') {
          serverSecretVault.freeKey = cleanKey;
        } else {
          serverSecretVault.paidKey = cleanKey;
        }
        saveSecrets(serverSecretVault);

        const state = ensureSharedBusinessState();
        state.geminiProfiles[targetProfile] = {
          ...state.geminiProfiles[targetProfile],
          hasKey: true,
          maskedKey: maskApiKey(cleanKey),
          status: "connected",
          verificationStatus: "VERIFIED",
          lastTested: new Date().toISOString(),
          lastError: null,
          errorCategory: null,
          model: model || state.geminiProfiles[targetProfile]?.model || "gemini-1.5-flash",
        };
        state.lastSyncedAt = new Date().toISOString();
        state.version = (state.version || 0) + 1;

        return res.json({
          success: true,
          verificationStatus: "VERIFIED",
          message: "API key verified successfully.",
          profile: {
            ...state.geminiProfiles[targetProfile],
            key: '',
          },
          activeGeminiProfile: serverSecretVault.activeProfile,
        });
      } else {
        const data = await googleRes.json().catch(() => ({}));
        const rawMsg = data.error?.message || `HTTP ${googleRes.status}`;
        let verificationStatus: string = "INVALID KEY";
        let message: string = "API key verification failed. Check your key and try again.";
        let errorCategory: string = "Invalid Key";

        if (googleRes.status === 400) {
          verificationStatus = "INVALID KEY";
          message = "API key verification failed. Check your key and try again.";
          errorCategory = "Invalid Key";
        } else if (googleRes.status === 403) {
          if (targetProfile === 'paid' || rawMsg.toLowerCase().includes('billing')) {
            verificationStatus = "BILLING ISSUE";
            message = "A billing issue was detected. Check your Google Cloud billing configuration.";
            errorCategory = "Billing Problem";
          } else {
            verificationStatus = "INVALID KEY";
            message = "API key verification failed. Check your key and try again.";
            errorCategory = "Permission Denied";
          }
        } else if (googleRes.status === 429) {
          verificationStatus = "QUOTA EXCEEDED";
          message = "API quota exceeded. Check your Google AI Studio usage limits.";
          errorCategory = "Quota Exceeded";
        } else {
          verificationStatus = "CONNECTION ERROR";
          message = "Unable to connect. Check your internet connection and retry.";
          errorCategory = "Service Error";
        }

        // Do not store invalid key in vault
        const state = ensureSharedBusinessState();
        state.geminiProfiles[targetProfile] = {
          ...state.geminiProfiles[targetProfile],
          status: "error",
          verificationStatus,
          lastTested: new Date().toISOString(),
          lastError: message,
          errorCategory,
        };

        return res.status(googleRes.status >= 400 && googleRes.status < 500 ? googleRes.status : 400).json({
          success: false,
          verificationStatus,
          message,
          errorCategory,
          details: rawMsg,
          profile: {
            ...state.geminiProfiles[targetProfile],
            key: '',
          }
        });
      }
    } catch (netErr: any) {
      const state = ensureSharedBusinessState();
      state.geminiProfiles[targetProfile] = {
        ...state.geminiProfiles[targetProfile],
        status: "error",
        verificationStatus: "CONNECTION ERROR",
        lastTested: new Date().toISOString(),
        lastError: "Unable to connect. Check your internet connection and retry.",
        errorCategory: "Network Failure",
      };

      return res.status(503).json({
        success: false,
        verificationStatus: "CONNECTION ERROR",
        message: "Unable to connect. Check your internet connection and retry.",
        errorCategory: "Network Failure"
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      verificationStatus: "CONNECTION ERROR",
      message: "Unable to save your API key securely. Please retry.",
      errorCategory: "Server Error"
    });
  }
});

app.post('/api/business/test-key', async (req, res) => {
  try {
    const { profile, key } = req.body;
    const targetProfile: 'free' | 'paid' = profile === 'paid' ? 'paid' : 'free';

    // Key to test is either provided explicitly or retrieved from server vault
    const keyToTest = (key && typeof key === 'string' && key.trim())
      ? key.trim()
      : (targetProfile === 'free' ? serverSecretVault.freeKey : serverSecretVault.paidKey);

    if (!keyToTest) {
      return res.status(400).json({
        ok: false,
        verificationStatus: "NOT CONFIGURED",
        message: "Please enter your Gemini API key.",
        errorCategory: "Missing Key"
      });
    }

    try {
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(keyToTest)}`;
      const googleRes = await fetch(testUrl);

      if (googleRes.ok) {
        const state = ensureSharedBusinessState();
        state.geminiProfiles[targetProfile] = {
          ...state.geminiProfiles[targetProfile],
          status: "connected",
          verificationStatus: "VERIFIED",
          lastTested: new Date().toISOString(),
          lastError: null,
          errorCategory: null,
        };
        return res.json({
          ok: true,
          verificationStatus: "VERIFIED",
          message: "API key verified successfully.",
          model: state.geminiProfiles[targetProfile]?.model || "gemini-1.5-flash",
          profile: {
            ...state.geminiProfiles[targetProfile],
            key: '',
          }
        });
      } else {
        const data = await googleRes.json().catch(() => ({}));
        const rawMsg = data.error?.message || `HTTP ${googleRes.status}`;
        let verificationStatus: string = "INVALID KEY";
        let message: string = "API key verification failed. Check your key and try again.";
        let errorCategory: string = "Invalid Key";

        if (googleRes.status === 400) {
          verificationStatus = "INVALID KEY";
          message = "API key verification failed. Check your key and try again.";
          errorCategory = "Invalid Key";
        } else if (googleRes.status === 403) {
          if (targetProfile === 'paid' || rawMsg.toLowerCase().includes('billing')) {
            verificationStatus = "BILLING ISSUE";
            message = "A billing issue was detected. Check your Google Cloud billing configuration.";
            errorCategory = "Billing Problem";
          } else {
            verificationStatus = "INVALID KEY";
            message = "API key verification failed. Check your key and try again.";
            errorCategory = "Permission Denied";
          }
        } else if (googleRes.status === 429) {
          verificationStatus = "QUOTA EXCEEDED";
          message = "API quota exceeded. Check your Google AI Studio usage limits.";
          errorCategory = "Quota Exceeded";
        } else {
          verificationStatus = "CONNECTION ERROR";
          message = "Unable to connect. Check your internet connection and retry.";
          errorCategory = "Service Error";
        }

        const state = ensureSharedBusinessState();
        state.geminiProfiles[targetProfile] = {
          ...state.geminiProfiles[targetProfile],
          status: "error",
          verificationStatus,
          lastTested: new Date().toISOString(),
          lastError: message,
          errorCategory,
        };

        return res.status(googleRes.status >= 400 && googleRes.status < 500 ? googleRes.status : 400).json({
          ok: false,
          verificationStatus,
          message,
          errorCategory,
          details: rawMsg,
          profile: {
            ...state.geminiProfiles[targetProfile],
            key: '',
          }
        });
      }
    } catch (netErr: any) {
      return res.status(503).json({
        ok: false,
        verificationStatus: "CONNECTION ERROR",
        message: "Unable to connect. Check your internet connection and retry.",
        errorCategory: "Network Failure"
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      verificationStatus: "CONNECTION ERROR",
      message: "Unable to connect. Check your internet connection and retry.",
      errorCategory: "Server Error"
    });
  }
});

app.post('/api/business/clear-key', (req, res) => {
  const { profile } = req.body;
  const targetProfile: 'free' | 'paid' = profile === 'paid' ? 'paid' : 'free';
  if (targetProfile === 'free') {
    serverSecretVault.freeKey = '';
  } else {
    serverSecretVault.paidKey = '';
  }
  saveSecrets(serverSecretVault);
  const state = ensureSharedBusinessState();
  state.geminiProfiles[targetProfile] = {
    ...state.geminiProfiles[targetProfile],
    hasKey: false,
    maskedKey: "",
    status: "not_configured",
    verificationStatus: "NOT CONFIGURED",
    lastTested: null,
    lastError: null,
    errorCategory: null,
  };
  return res.json({
    success: true,
    profile: {
      ...state.geminiProfiles[targetProfile],
      key: '',
    }
  });
});

app.post('/api/business/set-active-profile', (req, res) => {
  const { profile } = req.body;
  const target: 'free' | 'paid' = profile === 'paid' ? 'paid' : 'free';
  serverSecretVault.activeProfile = target;
  saveSecrets(serverSecretVault);
  const state = ensureSharedBusinessState();
  state.activeGeminiProfile = target;
  state.lastSyncedAt = new Date().toISOString();
  return res.json({
    success: true,
    activeGeminiProfile: target
  });
});

app.post('/api/business/save-groq', async (req, res) => {
  try {
    const { keys } = req.body;
    if (!keys || typeof keys !== 'string' || !keys.trim()) {
      return res.status(400).json({ success: false, message: "Please enter Groq API keys." });
    }

    const cleanKeys = keys.split(',').map(k => k.trim()).filter(Boolean);
    if (cleanKeys.length === 0) {
      return res.status(400).json({ success: false, message: "No valid Groq keys provided." });
    }

    // Deduplicate
    const uniqueKeys = Array.from(new Set(cleanKeys));
    const testKey = uniqueKeys[0];

    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${testKey}` }
      });

      if (groqRes.ok) {
        serverSecretVault.groqKeys = uniqueKeys.join(',');
        saveSecrets(serverSecretVault);
        const state = ensureSharedBusinessState();
        state.groq = {
          hasKeys: true,
          status: "connected",
          verificationStatus: "VERIFIED",
          lastTested: new Date().toISOString(),
        };
        return res.json({ success: true, message: "Groq keys verified and saved." });
      } else {
        return res.status(401).json({ success: false, message: "Invalid Groq API key." });
      }
    } catch (err) {
      return res.status(503).json({ success: false, message: "Network error verifying Groq key." });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error saving Groq keys." });
  }
});

app.post('/api/business/sync', (req, res) => {
  try {
    const incoming = req.body;
    if (incoming && typeof incoming === 'object') {
      const state = ensureSharedBusinessState();

      if (incoming.activeGeminiProfile === 'free' || incoming.activeGeminiProfile === 'paid') {
        serverSecretVault.activeProfile = incoming.activeGeminiProfile;
        saveSecrets(serverSecretVault);
      }

      const updatedFreeProfile = {
        ...state.geminiProfiles.free,
        ...(incoming.geminiProfiles?.free || {}),
        key: '',
        hasKey: Boolean(serverSecretVault.freeKey),
        maskedKey: maskApiKey(serverSecretVault.freeKey),
        verificationStatus: state.geminiProfiles.free.verificationStatus,
      };

      const updatedPaidProfile = {
        ...state.geminiProfiles.paid,
        ...(incoming.geminiProfiles?.paid || {}),
        key: '',
        hasKey: Boolean(serverSecretVault.paidKey),
        maskedKey: maskApiKey(serverSecretVault.paidKey),
        verificationStatus: state.geminiProfiles.paid.verificationStatus,
      };

      sharedBusinessState = {
        ...state,
        ...incoming,
        activeGeminiProfile: serverSecretVault.activeProfile,
        geminiProfiles: {
          free: updatedFreeProfile,
          paid: updatedPaidProfile,
        },
        lastSyncedAt: new Date().toISOString(),
        version: ((state.version || 0) + 1),
      };

      return res.json({
        success: true,
        state: getSanitizedBusinessState(),
        timestamp: sharedBusinessState.lastSyncedAt,
      });
    }
    res.status(400).json({ error: 'Invalid payload' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy test-gemini compatibility
app.post('/api/test-gemini', async (req, res) => {
  try {
    const { key, profile } = req.body;
    if (!key || typeof key !== 'string' || !key.trim()) {
      return res.status(400).json({
        ok: false,
        errorCategory: 'Missing Key',
        errorMessage: 'Please enter your Gemini API key.'
      });
    }

    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key.trim())}`;
    const googleRes = await fetch(testUrl);

    if (googleRes.ok) {
      return res.json({
        ok: true,
        status: 200,
        model: 'gemini-1.5-flash',
        profile: profile || 'free',
        message: 'API key verified successfully.'
      });
    } else {
      const data = await googleRes.json().catch(() => ({}));
      const rawMsg = data.error?.message || `HTTP ${googleRes.status}`;
      let errorCategory = 'Authentication Error';

      if (googleRes.status === 400) {
        errorCategory = 'Invalid Key';
      } else if (googleRes.status === 403) {
        errorCategory = profile === 'paid' ? 'Billing Problem' : 'Permission Denied';
      } else if (googleRes.status === 429) {
        errorCategory = 'Quota Exceeded';
      }

      return res.status(googleRes.status).json({
        ok: false,
        status: googleRes.status,
        errorCategory,
        errorMessage: rawMsg
      });
    }
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      errorCategory: 'Network Failure',
      errorMessage: 'Unable to connect. Check your internet connection and retry.'
    });
  }
});

app.post('/api/iyabd/process', async (req, res) => {
  try {
    const { prompt, assistantName, ownerName, permissions, mode, personality, customPersonalityText, responseStyle } = req.body;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        systemInstruction: `You are ${assistantName || 'IYABD'}, the personal assistant of ${ownerName || 'MD YOUSUF KHAN'} (মোঃ ইউসুফ খান).
${getPersonalityInstruction(personality || 'Normal', responseStyle || 'Balanced', customPersonalityText)}

IDENTITY RULES:
1. If anyone asks who created you, who made you, who built you, or anything similar, you MUST reply ONLY with this one sentence in Bengali: "আমাকে তৈরি করেছেন মোহাম্মদ ইউসুফ খান।" (Md. Yusuf Khan built me). Do not provide any other details.
2. Always identify as ${assistantName || 'IYABD'}.
3. Always reply in the same language the user speaks (Bengali by default).
4. Address the user as ${ownerName || 'MD YOUSUF KHAN'}.

CAPABILITIES:
Explain in Bengali that you can handle voice/chat, questions, writing/translation, and phone control.

Available apps and permissions: ${permissions?.map((p: any) => p.id).join(', ') || 'none'}.
Current mode: ${mode || 'chat'}.

IMPORTANT: You must ALWAYS respond in valid JSON format matching the requested schema.
`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            app: { type: Type.STRING },
            action: { type: Type.STRING },
            message: { type: Type.STRING },
            payload: { 
              type: Type.OBJECT,
              properties: {
                recipient: { type: Type.STRING },
                text: { type: Type.STRING },
                query: { type: Type.STRING },
                imageUrl: { type: Type.STRING }
              }
            }
          },
          required: ["app", "action", "message"]
        }
      },
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('IYABD processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/keys/get-live-token', async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY; 
    if (!key) return res.status(404).json({ error: "Key not found" });
    res.json({ token: key });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve token" });
  }
});

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.NODE_ENV === 'production' ? (process.env.PORT || 3000) : 3001;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`IYABD backend running on port ${PORT}`);
});
