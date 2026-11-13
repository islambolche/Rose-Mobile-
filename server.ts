import express from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { GoogleGenAI, Type, Modality, LiveServerMessage, EndSensitivity, StartSensitivity } from "@google/genai";
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json({ limit: '25mb' }));

const httpServer = createServer(app);
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`).pathname;
  if (pathname === '/api/live' || pathname === '/live') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

process.on('uncaughtException', (err) => {
  console.error('Server Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Server Unhandled Rejection:', reason);
});

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

const resolveGeminiApiKey = (customKey?: string): string => {
  const cleanCustom = typeof customKey === 'string' ? customKey.replace(/[\r\n\t\s"']+/g, '').trim() : '';
  const activeServerKey = serverSecretVault.activeProfile === 'paid'
    ? (serverSecretVault.paidKey || serverSecretVault.freeKey)
    : (serverSecretVault.freeKey || serverSecretVault.paidKey);
  const rawEnvKey = (process.env.GEMINI_API_KEY || '').trim();
  const usableEnvKey = rawEnvKey && !rawEnvKey.startsWith('AQ.') && rawEnvKey !== 'placeholder' ? rawEnvKey : '';
  return cleanCustom || activeServerKey || usableEnvKey || '';
};

const getGenAIClient = (customKey?: string, apiVersion?: string) => {
  const key = resolveGeminiApiKey(customKey) || 'placeholder';
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      ...(apiVersion ? { apiVersion } : {}),
    },
  });
};

const ai = getGenAIClient();

const normalizeSdkModelsList = async (client: GoogleGenAI) => {
  const pager = await client.models.list({ config: { pageSize: 200 } });
  const collected: any[] = [];
  for await (const m of pager) {
    const actions = Array.isArray((m as any).supportedActions)
      ? (m as any).supportedActions
      : Array.isArray((m as any).supportedGenerationMethods)
        ? (m as any).supportedGenerationMethods
        : [];
    collected.push({
      ...m,
      supportedActions: actions,
      supportedGenerationMethods: actions,
    });
    if (collected.length >= 400) break;
  }
  return collected;
};

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

const safeCloseCode = (code?: number): number => {
  if (
    typeof code === 'number' &&
    (code === 1000 ||
      (code >= 1001 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006) ||
      (code >= 3000 && code <= 4999))
  ) {
    return code;
  }
  return 1000;
};

const safeCloseReason = (reason?: string): string => String(reason || '').slice(0, 100);

// Gemini Live API Bridge
wss.on('connection', async (clientWs, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const assistantName = url.searchParams.get('assistantName') || 'Rose AI';
  const ownerName = url.searchParams.get('ownerName') || 'MD YOUSUF KHAN';
  const rawVoiceName = url.searchParams.get('voiceName') || 'Sulafat';
  const personality = url.searchParams.get('personality') || 'Normal';
  const isMinimal = url.searchParams.get('minimal') === '1';
  const queryModel = (url.searchParams.get('model') || 'gemini-3.8-live').replace(/^models\//, '').trim();
  const queryApiVersion = url.searchParams.get('apiVersion') || '';
  const userKeyParam = url.searchParams.get('apiKey') || '';

  const apiKey = resolveGeminiApiKey(userKeyParam);
  const isKeyUsable =
    apiKey && apiKey !== 'placeholder' && apiKey !== 'undefined' && !apiKey.startsWith('AQ.');

  if (!isKeyUsable) {
    const errorMsg = 'Gemini API key is missing. Add your API key in Settings > Secrets.';
    console.warn('[Live WS] Missing or invalid API key.');
    if (clientWs.readyState === 1) {
      clientWs.send(
        JSON.stringify({
          error: { code: 4001, message: errorMsg, status: 'UNAUTHENTICATED' },
          closed: true,
          code: 4001,
          reason: 'Missing Gemini API Key',
        })
      );
    }
    setTimeout(() => {
      try {
        clientWs.close(4001, 'Missing Gemini API Key');
      } catch {}
    }, 150);
    return;
  }

  let session: any = null;
  let isClosing = false;
  let setupStarted = false;
  let setupTimeout: ReturnType<typeof setTimeout> | null = null;
  const pendingMessages: any[] = [];

  const cleanupSession = () => {
    if (isClosing) return;
    isClosing = true;
    if (setupTimeout) {
      clearTimeout(setupTimeout);
      setupTimeout = null;
    }
    pendingMessages.length = 0;
    if (session) {
      try {
        session.close();
      } catch {}
      session = null;
    }
  };

  const forwardDownstreamMessage = (activeSession: any, msg: any) => {
    if (!activeSession || !msg || typeof msg !== 'object') return;
    try {
      if (msg.audio) {
        activeSession.sendRealtimeInput({
          audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
        });
        return;
      }

      const rt = msg.realtimeInput || msg.realtime_input;
      if (rt && typeof rt === 'object') {
        const chunks = rt.mediaChunks || rt.media_chunks;
        if (Array.isArray(chunks)) {
          for (const chunk of chunks) {
            if (!chunk?.data) continue;
            const mime = String(chunk.mimeType || chunk.mime_type || 'audio/pcm;rate=16000');
            if (mime.startsWith('image/') || mime.startsWith('video/')) {
              activeSession.sendRealtimeInput({
                video: { data: chunk.data, mimeType: mime },
              });
            } else {
              activeSession.sendRealtimeInput({
                audio: { data: chunk.data, mimeType: mime },
              });
            }
          }
        }
        const textChunks = rt.text_chunks || rt.textChunks;
        if (Array.isArray(textChunks)) {
          for (const tc of textChunks) {
            if (tc?.text) {
              activeSession.sendRealtimeInput({ text: String(tc.text) });
            }
          }
        }
        if (rt.audio) {
          activeSession.sendRealtimeInput({ audio: rt.audio });
        }
        if (rt.video) {
          activeSession.sendRealtimeInput({ video: rt.video });
        }
        if (typeof rt.text === 'string' && rt.text.length > 0) {
          activeSession.sendRealtimeInput({ text: rt.text });
        }
        if (rt.activityStart !== undefined) {
          activeSession.sendRealtimeInput({ activityStart: rt.activityStart });
        }
        if (rt.activityEnd !== undefined) {
          activeSession.sendRealtimeInput({ activityEnd: rt.activityEnd });
        }
        if (rt.audioStreamEnd !== undefined) {
          activeSession.sendRealtimeInput({ audioStreamEnd: rt.audioStreamEnd });
        }
        return;
      }

      const clientContent = msg.clientContent || msg.client_content;
      if (clientContent && typeof activeSession.sendClientContent === 'function') {
        activeSession.sendClientContent(clientContent);
        return;
      }

      const toolResp = msg.toolResponse || msg.tool_response;
      if (toolResp && Array.isArray(toolResp.functionResponses)) {
        activeSession.sendToolResponse(toolResp);
      }
    } catch (e: any) {
      console.error('[Live WS] Error forwarding message to Gemini:', e?.message || e);
    }
  };

  const buildDefaultSetup = () => {
    const FEMALE_VOICES = new Set([
      'Sulafat', 'Vindemiatrix', 'Achernar', 'Leda', 'Aoede', 'Callirrhoe',
      'Despina', 'Laomedeia', 'Zephyr', 'Kore', 'Erinome', 'Autonoe', 'Gacrux', 'Pulcherrima',
    ]);
    const voiceName = FEMALE_VOICES.has(rawVoiceName) ? rawVoiceName : 'Sulafat';
    const sysInst = isMinimal
      ? 'তুমি রোজ। বাংলায় ছোট উত্তর দাও।'
      : `তোমার নাম ${assistantName}। ইউজারের নাম ${ownerName}। (${personality}) শুধু বাংলায় ছোট উত্তর দাও।`;
    return {
      model: queryModel || 'gemini-3.8-live',
      generationConfig: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
      systemInstruction: { parts: [{ text: sysInst }] },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      realtimeInputConfig: {
        automaticActivityDetection: {
          startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
          endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
          prefixPaddingMs: 100,
          silenceDurationMs: 500,
        },
      },
    };
  };

  const openUpstreamSession = async (setupPayload: any, explicitlySentByClient: boolean, explicitApiVersion?: string) => {
    if (setupStarted || isClosing) return;
    setupStarted = true;
    if (setupTimeout) {
      clearTimeout(setupTimeout);
      setupTimeout = null;
    }

    const setup = setupPayload || buildDefaultSetup();
    const modelName = String(setup.model || queryModel || 'gemini-3.8-live')
      .replace(/^models\//, '')
      .trim();

    const genCfg = setup.generationConfig || {};
    const enableAffective = Boolean(genCfg.enableAffectiveDialog || setup.enableAffectiveDialog);
    const apiVersion = explicitApiVersion || queryApiVersion || (enableAffective ? 'v1alpha' : 'v1beta');

    const sdkConfig: any = {
      responseModalities: genCfg.responseModalities || setup.responseModalities || [Modality.AUDIO],
    };
    if (genCfg.speechConfig || setup.speechConfig) {
      const rawSpeechCfg = { ...(genCfg.speechConfig || setup.speechConfig) };
      delete rawSpeechCfg.languageCode;
      sdkConfig.speechConfig = rawSpeechCfg;
    }
    if (enableAffective) {
      sdkConfig.enableAffectiveDialog = true;
    }
    if (genCfg.temperature !== undefined) {
      sdkConfig.temperature = genCfg.temperature;
    }
    if (genCfg.maxOutputTokens !== undefined) {
      sdkConfig.maxOutputTokens = genCfg.maxOutputTokens;
    }
    if (setup.thinkingConfig || genCfg.thinkingConfig) {
      sdkConfig.thinkingConfig = setup.thinkingConfig || genCfg.thinkingConfig;
    }
    const sysInstObj = setup.systemInstruction || setup.system_instruction;
    if (sysInstObj) {
      const sysText =
        typeof sysInstObj === 'string'
          ? sysInstObj
          : Array.isArray(sysInstObj?.parts)
            ? sysInstObj.parts.map((p: any) => p?.text || '').join('\n')
            : '';
      sdkConfig.systemInstruction = { parts: [{ text: sysText }] };
      console.log(`[Live WS] System prompt: OK (${sysText.length} chars)`);
    }
    if (Array.isArray(setup.tools) && setup.tools.length > 0) {
      sdkConfig.tools = setup.tools;
    }
    if (setup.inputAudioTranscription !== undefined) {
      sdkConfig.inputAudioTranscription = setup.inputAudioTranscription;
    }
    if (setup.outputAudioTranscription !== undefined) {
      sdkConfig.outputAudioTranscription = setup.outputAudioTranscription;
    }
    if (setup.realtimeInputConfig !== undefined) {
      sdkConfig.realtimeInputConfig = setup.realtimeInputConfig;
    }
    if (setup.sessionResumption !== undefined) {
      sdkConfig.sessionResumption = setup.sessionResumption;
    }
    if (setup.contextWindowCompression !== undefined) {
      sdkConfig.contextWindowCompression = setup.contextWindowCompression;
    }

    const clientGenAI = getGenAIClient(apiKey, apiVersion);
    console.log(`[Live WS] Connecting to Gemini Live: model=${modelName}, apiVersion=${apiVersion}`);

    try {
      session = await clientGenAI.live.connect({
        model: modelName,
        config: sdkConfig,
        callbacks: {
          onopen: () => {
            console.log(`[Live WS] Upstream WS open for model: ${modelName}`);
            if (!explicitlySentByClient && clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ connected: true, setupComplete: true, model: modelName }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== 1) return;
            clientWs.send(JSON.stringify(message));
          },
          onerror: (err: any) => {
            const msg = String(err?.message || err || 'Live session error');
            console.error(`[Live WS] Gemini error for ${modelName}:`, msg);
            if (clientWs.readyState === 1) {
              clientWs.send(JSON.stringify({ error: { message: msg, code: err?.code || 500 } }));
            }
          },
          onclose: (ev: any) => {
            const code = typeof ev?.code === 'number' ? ev.code : 1000;
            const reason = String(ev?.reason || '');
            console.log(`[Live WS] Upstream closed (${modelName}) code=${code} reason=${reason}`);
            if (clientWs.readyState === 1 && !isClosing) {
              if (reason && code !== 1000) {
                clientWs.send(
                  JSON.stringify({
                    error: { code, message: reason },
                    closed: true,
                    code,
                    reason,
                  })
                );
              }
              setTimeout(() => {
                try {
                  clientWs.close(safeCloseCode(code), safeCloseReason(reason || 'Gemini Closed'));
                } catch {}
              }, 80);
            }
            cleanupSession();
          },
        },
      });

      if (isClosing) {
        try {
          session?.close();
        } catch {}
        session = null;
        return;
      }

      while (pendingMessages.length > 0 && session) {
        const queued = pendingMessages.shift();
        forwardDownstreamMessage(session, queued);
      }
    } catch (err: any) {
      const parsed = parseGeminiError(err);
      console.error(`[Live WS] Live connect failed (${modelName}):`, parsed.message);
      if (clientWs.readyState === 1) {
        clientWs.send(
          JSON.stringify({
            error: { code: parsed.status || 4000, message: parsed.message },
            closed: true,
          })
        );
      }
      setTimeout(() => {
        try {
          clientWs.close(4000, safeCloseReason(parsed.message));
        } catch {}
      }, 100);
      cleanupSession();
    }
  };

  clientWs.on('message', (data) => {
    if (isClosing) return;
    try {
      const msg = JSON.parse(data.toString());
      if (msg && msg.setup && !setupStarted) {
        void openUpstreamSession(msg.setup, true, msg.apiVersion);
        return;
      }
      if (!setupStarted) {
        pendingMessages.push(msg);
        return;
      }
      if (!session) {
        pendingMessages.push(msg);
        return;
      }
      forwardDownstreamMessage(session, msg);
    } catch (e: any) {
      console.error('[Live WS] Error processing client message:', e?.message || e);
    }
  });

  clientWs.on('close', () => {
    cleanupSession();
  });

  clientWs.on('error', (err) => {
    console.error('[Live WS] Client WS error:', err);
    cleanupSession();
  });

  // Fallback if a minimal client opens WS without sending a setup payload
  setupTimeout = setTimeout(() => {
    if (!setupStarted && !isClosing) {
      void openUpstreamSession(buildDefaultSetup(), false, queryApiVersion || 'v1beta');
    }
  }, 1200);
});

app.get('/api/gemini/status', (req, res) => {
  const key = resolveGeminiApiKey();
  const configured = Boolean(key && key !== 'placeholder' && key !== 'undefined');
  res.json({
    configured,
    maskedKey: configured ? maskApiKey(key) : '',
  });
});

app.post('/api/gemini/verify', async (req, res) => {
  try {
    const { apiKey, model } = req.body || {};
    const effectiveKey = resolveGeminiApiKey(apiKey);
    if (!effectiveKey || effectiveKey === 'placeholder') {
      return res.status(401).json({
        ok: false,
        status: 401,
        error: { code: 401, message: 'Gemini API key is not configured on the server.' },
      });
    }
    const client = getGenAIClient(effectiveKey);
    const cleanModel = typeof model === 'string' ? model.replace(/^models\//, '').trim() : '';
    if (cleanModel) {
      await client.models.generateContent({
        model: cleanModel,
        contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
        config: { maxOutputTokens: 2 },
      });
    } else {
      await client.models.list({ config: { pageSize: 10 } });
    }
    return res.json({ ok: true, status: 200, message: 'OK' });
  } catch (err: any) {
    const parsed = parseGeminiError(err);
    const status = parsed.status >= 400 ? parsed.status : 400;
    return res.status(status).json({
      ok: false,
      status,
      error: { code: status, message: parsed.message },
    });
  }
});

app.get('/api/gemini/models', async (req, res) => {
  try {
    const customKey = req.query.apiKey as string | undefined;
    const key = resolveGeminiApiKey(customKey);
    if (!key || key === 'placeholder') {
      return res.status(401).json({ error: { code: 401, message: 'API key not configured' } });
    }
    const client = getGenAIClient(key);
    const models = await normalizeSdkModelsList(client);
    res.json({ models });
  } catch (error: any) {
    const parsed = parseGeminiError(error);
    res.status(parsed.status || 500).json({ error: { code: parsed.status || 500, message: parsed.message } });
  }
});

const normalizeContentsForSdk = (contents: any, prompt?: any) => {
  const mapPart = (p: any) => {
    if (!p || typeof p !== 'object') return p;
    if (p.inline_data && !p.inlineData) {
      return {
        inlineData: {
          mimeType: p.inline_data.mime_type || p.inline_data.mimeType || 'audio/webm',
          data: p.inline_data.data,
        },
      };
    }
    return p;
  };
  let normalizedContents: any = contents;
  if (!normalizedContents && prompt) {
    normalizedContents = [{ role: 'user', parts: [{ text: String(prompt) }] }];
  } else if (typeof normalizedContents === 'string') {
    normalizedContents = [{ role: 'user', parts: [{ text: normalizedContents }] }];
  } else if (Array.isArray(normalizedContents)) {
    normalizedContents = normalizedContents.map((item: any) => {
      if (typeof item === 'string') {
        return { role: 'user', parts: [{ text: item }] };
      }
      if (item && item.text && !item.parts) {
        return {
          role: item.role === 'assistant' ? 'model' : item.role || 'user',
          parts: [{ text: item.text }],
        };
      }
      if (item && Array.isArray(item.parts)) {
        return {
          ...item,
          role: item.role === 'assistant' ? 'model' : item.role || 'user',
          parts: item.parts.map(mapPart),
        };
      }
      return item;
    });
  }
  return normalizedContents;
};

const buildSdkGenerateConfig = (opts: {
  systemInstruction?: any;
  generationConfig?: any;
  tools?: any;
  toolConfig?: any;
  includeThinking?: boolean;
  includeGoogleSearch?: boolean;
}) => {
  const {
    systemInstruction,
    generationConfig,
    tools,
    toolConfig,
    includeThinking = true,
    includeGoogleSearch = true,
  } = opts;
  const config: any = {};
  if (systemInstruction) {
    config.systemInstruction =
      typeof systemInstruction === 'string'
        ? systemInstruction
        : systemInstruction?.parts?.map((p: any) => p?.text || '').join('\n').trim() || systemInstruction;
  }
  if (generationConfig && typeof generationConfig === 'object') {
    if (generationConfig.maxOutputTokens !== undefined) {
      config.maxOutputTokens = generationConfig.maxOutputTokens;
    }
    if (generationConfig.temperature !== undefined) {
      config.temperature = generationConfig.temperature;
    }
    if (generationConfig.topP !== undefined) {
      config.topP = generationConfig.topP;
    }
    if (generationConfig.topK !== undefined) {
      config.topK = generationConfig.topK;
    }
    if (generationConfig.seed !== undefined) {
      config.seed = generationConfig.seed;
    }
    if (generationConfig.responseMimeType) {
      config.responseMimeType = generationConfig.responseMimeType;
    }
    if (generationConfig.responseSchema) {
      config.responseSchema = generationConfig.responseSchema;
    }
    if (includeThinking && generationConfig.thinkingConfig) {
      config.thinkingConfig = generationConfig.thinkingConfig;
    }
  }
  if (Array.isArray(tools) && tools.length > 0) {
    const filteredTools = includeGoogleSearch
      ? tools
      : tools.filter((t: any) => !t?.googleSearch);
    if (filteredTools.length > 0) {
      config.tools = filteredTools;
    }
  }
  if (toolConfig) {
    config.toolConfig = toolConfig;
  }
  return config;
};

const filterNonThoughtCandidates = (candidates: any[] | undefined, fallbackText: string) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return fallbackText
      ? [{ content: { parts: [{ text: fallbackText }], role: 'model' } }]
      : [];
  }
  return candidates.map((cand: any) => {
    const parts = Array.isArray(cand?.content?.parts)
      ? cand.content.parts.filter((p: any) => p && p.thought !== true)
      : [];
    return {
      ...cand,
      content: {
        ...(cand?.content || {}),
        role: cand?.content?.role || 'model',
        parts,
      },
    };
  });
};

app.post('/api/gemini/generate', async (req, res) => {
  try {
    const {
      model,
      contents,
      systemInstruction,
      generationConfig,
      apiKey,
      prompt,
      tools,
      toolConfig,
    } = req.body || {};

    const cleanUserKey =
      typeof apiKey === 'string' ? apiKey.replace(/[\r\n\t\s"']+/g, '').trim() : '';
    const effectiveKey = resolveGeminiApiKey(cleanUserKey);

    if (!effectiveKey || effectiveKey === 'placeholder') {
      return res.status(401).json({
        error: {
          code: 401,
          message: 'Gemini API key is missing on the server.',
          status: 'UNAUTHENTICATED',
        },
      });
    }

    let modelToUse =
      model && typeof model === 'string'
        ? model.replace(/^models\//, '').trim()
        : 'gemini-4-hydrogen';
    if (
      !modelToUse ||
      !modelToUse.startsWith('gemini') ||
      modelToUse.includes('native-audio') ||
      modelToUse.includes('live')
    ) {
      modelToUse = 'gemini-4-hydrogen';
    }

    const client = getGenAIClient(effectiveKey);
    const normalizedContents = normalizeContentsForSdk(contents, prompt);

    const runWithConfig = async (
      targetModel: string,
      includeThinking: boolean,
      includeGoogleSearch: boolean
    ) => {
      const cfg = buildSdkGenerateConfig({
        systemInstruction,
        generationConfig,
        tools,
        toolConfig,
        includeThinking,
        includeGoogleSearch,
      });
      return await client.models.generateContent({
        model: targetModel,
        contents: normalizedContents,
        config: Object.keys(cfg).length > 0 ? cfg : undefined,
      });
    };

    const callModelWith400Retries = async (targetModel: string) => {
      try {
        return await runWithConfig(targetModel, true, true);
      } catch (err1: any) {
        const p1 = parseGeminiError(err1);
        const msg1 = (p1.message || '').toLowerCase();
        if (p1.status === 400 || msg1.includes('thinking') || msg1.includes('google_search') || msg1.includes('tool')) {
          try {
            return await runWithConfig(targetModel, false, true);
          } catch (err2: any) {
            const p2 = parseGeminiError(err2);
            const msg2 = (p2.message || '').toLowerCase();
            if (Array.isArray(tools) && tools.some((t: any) => t?.googleSearch) && (p2.status === 400 || msg2.includes('search') || msg2.includes('tool'))) {
              return await runWithConfig(targetModel, false, false);
            }
            throw err2;
          }
        }
        throw err1;
      }
    };

    let response: any = null;
    let finalModelUsed = modelToUse;

    try {
      response = await callModelWith400Retries(modelToUse);
    } catch (sdkErr: any) {
      const parsedErr = parseGeminiError(sdkErr);
      if (parsedErr.status === 404 || String(sdkErr?.message || '').toLowerCase().includes('not found')) {
        const discovered = await normalizeSdkModelsList(client).catch(() => []);
        const flashCandidates = discovered
          .map((m: any) => String(m.name || '').replace(/^models\//, '').trim())
          .filter((name: string) => {
            const lower = name.toLowerCase();
            return (
              name &&
              name !== modelToUse &&
              lower.includes('flash') &&
              !lower.includes('live') &&
              !lower.includes('native-audio') &&
              !lower.includes('tts') &&
              !lower.includes('image')
            );
          });
        const fallbacks = Array.from(
          new Set([...flashCandidates.slice(0, 3), 'gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'])
        ).filter((m) => m !== modelToUse);

        let succeeded = false;
        let lastFallbackErr = sdkErr;
        for (const fb of fallbacks) {
          try {
            response = await callModelWith400Retries(fb);
            finalModelUsed = fb;
            succeeded = true;
            break;
          } catch (fbErr: any) {
            lastFallbackErr = fbErr;
          }
        }
        if (!succeeded) throw lastFallbackErr;
      } else {
        throw sdkErr;
      }
    }

    const replyText = response?.text || '';
    const filteredCandidates = filterNonThoughtCandidates(response?.candidates, replyText);
    return res.status(200).json({
      text: replyText,
      candidates: filteredCandidates,
      groundingMetadata: filteredCandidates?.[0]?.groundingMetadata,
      usageMetadata: response?.usageMetadata,
      modelUsed: finalModelUsed,
    });
  } catch (error: any) {
    console.error('Gemini generate error:', error?.message || error);
    const parsed = parseGeminiError(error);
    const status = parsed.status >= 400 ? parsed.status : 500;
    return res.status(status).json({
      error: {
        code: status,
        message: parsed.message || error?.message || 'Gemini request failed',
        status: 'FAILED',
      },
    });
  }
});

app.post('/api/gemini/stream', async (req, res) => {
  try {
    const {
      model,
      contents,
      systemInstruction,
      generationConfig,
      apiKey,
      prompt,
      tools,
      toolConfig,
    } = req.body || {};

    const cleanUserKey =
      typeof apiKey === 'string' ? apiKey.replace(/[\r\n\t\s"']+/g, '').trim() : '';
    const effectiveKey = resolveGeminiApiKey(cleanUserKey);

    if (!effectiveKey || effectiveKey === 'placeholder') {
      return res.status(401).json({
        error: {
          code: 401,
          message: 'Gemini API key is missing on the server.',
          status: 'UNAUTHENTICATED',
        },
      });
    }

    let modelToUse =
      model && typeof model === 'string'
        ? model.replace(/^models\//, '').trim()
        : 'gemini-4-hydrogen';
    if (
      !modelToUse ||
      !modelToUse.startsWith('gemini') ||
      modelToUse.includes('native-audio') ||
      modelToUse.includes('live')
    ) {
      modelToUse = 'gemini-4-hydrogen';
    }

    const client = getGenAIClient(effectiveKey);
    const normalizedContents = normalizeContentsForSdk(contents, prompt);

    const openStream = async (
      targetModel: string,
      includeThinking: boolean,
      includeGoogleSearch: boolean
    ) => {
      const cfg = buildSdkGenerateConfig({
        systemInstruction,
        generationConfig,
        tools,
        toolConfig,
        includeThinking,
        includeGoogleSearch,
      });
      return await client.models.generateContentStream({
        model: targetModel,
        contents: normalizedContents,
        config: Object.keys(cfg).length > 0 ? cfg : undefined,
      });
    };

    const openStreamWithRetries = async (targetModel: string) => {
      try {
        return await openStream(targetModel, true, true);
      } catch (err1: any) {
        const p1 = parseGeminiError(err1);
        const msg1 = (p1.message || '').toLowerCase();
        if (p1.status === 400 || msg1.includes('thinking') || msg1.includes('google_search') || msg1.includes('tool')) {
          try {
            return await openStream(targetModel, false, true);
          } catch (err2: any) {
            const p2 = parseGeminiError(err2);
            const msg2 = (p2.message || '').toLowerCase();
            if (Array.isArray(tools) && tools.some((t: any) => t?.googleSearch) && (p2.status === 400 || msg2.includes('search') || msg2.includes('tool'))) {
              return await openStream(targetModel, false, false);
            }
            throw err2;
          }
        }
        throw err1;
      }
    };

    let streamResponse: any = null;
    try {
      streamResponse = await openStreamWithRetries(modelToUse);
    } catch (sdkErr: any) {
      const parsedErr = parseGeminiError(sdkErr);
      if (parsedErr.status === 404 || String(sdkErr?.message || '').toLowerCase().includes('not found')) {
        let opened = false;
        let lastFbErr = sdkErr;
        for (const fb of ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-2.5-flash']) {
          if (fb === modelToUse) continue;
          try {
            streamResponse = await openStreamWithRetries(fb);
            opened = true;
            break;
          } catch (e: any) {
            lastFbErr = e;
          }
        }
        if (!opened) throw lastFbErr;
      } else {
        throw sdkErr;
      }
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of streamResponse) {
      const filteredCandidates = filterNonThoughtCandidates(chunk?.candidates, chunk?.text || '');
      const text = chunk?.text || '';
      res.write(`data: ${JSON.stringify({ text, candidates: filteredCandidates })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Gemini stream error:', error?.message || error);
    const parsed = parseGeminiError(error);
    if (!res.headersSent) {
      res.status(parsed.status || 500).json({ error: { code: parsed.status || 500, message: parsed.message } });
    } else {
      try {
        res.write(`data: ${JSON.stringify({ error: { code: parsed.status || 500, message: parsed.message } })}\n\n`);
      } catch {}
      res.end();
    }
  }
});

function parseGeminiError(err: any): { message: string; status: number } {
  let status = 500;
  let message = 'Gemini request failed';

  if (!err) return { message, status };

  if (typeof err.status === 'number' && err.status > 0) {
    status = err.status;
  }

  const rawStr = typeof err === 'string' ? err : String(err?.message || err?.bodyText || err || '');

  const jsonMatch = rawStr.match(/\{[\s\S]*"error"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error?.message) {
        message = parsed.error.message;
      }
      if (typeof parsed?.error?.code === 'number') {
        status = parsed.error.code;
      }
    } catch {}
  }

  if (message === 'Gemini request failed' && rawStr) {
    message = rawStr
      .replace(/^Error:\s*/i, '')
      .replace(/^\[GoogleGenAI Error\]:\s*/i, '')
      .replace(/^HTTP \d+:\s*/i, '')
      .trim();
  }

  const lower = message.toLowerCase();
  if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
    status = 429;
  } else if (lower.includes('401') || lower.includes('api key not valid') || lower.includes('unauthenticated') || lower.includes('invalid key')) {
    status = 401;
  } else if (lower.includes('403') || lower.includes('permission_denied') || lower.includes('forbidden')) {
    status = 403;
  } else if (lower.includes('404') || lower.includes('not_found') || lower.includes('not found')) {
    status = 404;
  } else if (lower.includes('400') || lower.includes('invalid_argument')) {
    status = 400;
  }

  return { message, status };
}

app.post('/api/gemini/tts', async (req, res) => {
  try {
    const { model, text, voiceName, voices, style, apiKey } = req.body || {};
    const effectiveKey = resolveGeminiApiKey(apiKey);
    if (!effectiveKey || effectiveKey === 'placeholder') {
      return res.status(401).json({
        error: { message: 'Missing Gemini API key', code: 401 },
        exactError: 'Missing Gemini API key',
        status: 401,
      });
    }
    const client = getGenAIClient(effectiveKey);

    const rawText = String(text || '').trim();
    if (!rawText) {
      return res.status(400).json({
        error: { message: 'Empty text for TTS', code: 400 },
        exactError: 'Empty text for TTS',
        status: 400,
      });
    }

    const styleHint = String(style || '').trim();
    const ttsPrompt = styleHint ? `${styleHint} ${rawText}` : rawText;

    const voicesToTry: string[] = Array.isArray(voices) && voices.length > 0
      ? voices.map((v: any) => String(v || '').trim()).filter(Boolean)
      : [String(voiceName || 'Leda').trim() || 'Leda'];

    const requestedClean = model ? String(model).replace(/^models\//, '').trim() : '';
    const candidateTtsModels: string[] = [];
    if (requestedClean && requestedClean.toLowerCase().includes('tts')) {
      candidateTtsModels.push(requestedClean);
    }

    try {
      const discovered = await normalizeSdkModelsList(client);
      for (const m of discovered) {
        const name = String(m?.name || '').replace(/^models\//, '').trim();
        const methods: string[] = m?.supportedActions || m?.supportedGenerationMethods || [];
        if (
          name &&
          name.toLowerCase().includes('tts') &&
          methods.includes('generateContent') &&
          !candidateTtsModels.includes(name)
        ) {
          candidateTtsModels.push(name);
        }
      }
    } catch {}

    for (const fallbackTts of ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts']) {
      if (!candidateTtsModels.includes(fallbackTts)) {
        candidateTtsModels.push(fallbackTts);
      }
    }

    let base64Audio: string | undefined = undefined;
    let workingModelUsed: string | undefined = undefined;
    let workingVoiceUsed: string | undefined = undefined;
    let lastErrorText = '';
    let lastStatus = 500;

    const tryModelAndVoices = async (m: string): Promise<boolean> => {
      if (!m || !m.toLowerCase().includes('tts')) return false;
      for (let vIdx = 0; vIdx < voicesToTry.length; vIdx++) {
        const candidateVoice = voicesToTry[vIdx];
        try {
          const upstreamRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': effectiveKey,
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: ttsPrompt }] }],
                generationConfig: {
                  responseModalities: ['AUDIO'],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: candidateVoice },
                    },
                  },
                },
              }),
            }
          );

          const rawText = await upstreamRes.text().catch(() => '');
          let data: any = null;
          try {
            data = rawText ? JSON.parse(rawText) : null;
          } catch {}

          if (!upstreamRes.ok) {
            lastStatus = upstreamRes.status;
            lastErrorText = data?.error?.message || rawText || `HTTP ${upstreamRes.status}`;
            if (upstreamRes.status === 400 && vIdx + 1 < voicesToTry.length) {
              continue;
            }
            if (upstreamRes.status === 404) {
              return false;
            }
            break;
          }

          const rawB64 = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData)?.inlineData?.data;
          if (rawB64) {
            const buf = Buffer.from(rawB64, 'base64');
            if (buf.length > 44 && buf.toString('ascii', 0, 4) === 'RIFF') {
              base64Audio = buf.subarray(44).toString('base64');
            } else {
              base64Audio = rawB64;
            }
            workingModelUsed = m;
            workingVoiceUsed = candidateVoice;
            return true;
          }
          lastErrorText = `No audio returned from ${m}`;
        } catch (err: any) {
          const parsed = parseGeminiError(err);
          lastErrorText = parsed.message;
          lastStatus = parsed.status;
          if (parsed.status === 400 && vIdx + 1 < voicesToTry.length) {
            continue;
          }
          if (parsed.status === 404) {
            return false;
          }
          break;
        }
      }
      return false;
    };

    for (const m of candidateTtsModels) {
      const ok = await tryModelAndVoices(m);
      if (ok && base64Audio) break;
    }

    if (!base64Audio) {
      const parsed = parseGeminiError({ message: lastErrorText, status: lastStatus });
      return res.status(parsed.status || 500).json({
        error: { message: parsed.message, code: parsed.status },
        exactError: parsed.message,
        status: parsed.status,
      });
    }

    res.json({
      audio: base64Audio,
      modelUsed: workingModelUsed,
      voiceUsed: workingVoiceUsed,
    });
  } catch (error: any) {
    const parsed = parseGeminiError(error);
    res.status(parsed.status || 500).json({
      error: { message: parsed.message, code: parsed.status },
      exactError: parsed.message,
      status: parsed.status,
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

// Vault secrets initialized at top of file

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
          model: "gemini-4-hydrogen",
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
          model: "gemini-4-hydrogen",
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

    // 3. Real server-side API validation request via @google/genai SDK
    try {
      const testClient = getGenAIClient(cleanKey);
      await testClient.models.list({ config: { pageSize: 10 } });

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
        model: model || state.geminiProfiles[targetProfile]?.model || "gemini-4-hydrogen",
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
    } catch (verifyErr: any) {
      const parsed = parseGeminiError(verifyErr);
      const rawMsg = parsed.message || `HTTP ${parsed.status}`;
      let verificationStatus = "INVALID KEY";
      let message = "API key verification failed. Check your key and try again.";
      let errorCategory = "Invalid Key";

      if (parsed.status === 400 || parsed.status === 401) {
        verificationStatus = "INVALID KEY";
        message = "API key verification failed. Check your key and try again.";
        errorCategory = "Invalid Key";
      } else if (parsed.status === 403) {
        if (targetProfile === 'paid' || rawMsg.toLowerCase().includes('billing')) {
          verificationStatus = "BILLING ISSUE";
          message = "A billing issue was detected. Check your Google Cloud billing configuration.";
          errorCategory = "Billing Problem";
        } else {
          verificationStatus = "INVALID KEY";
          message = "API key verification failed. Check your key and try again.";
          errorCategory = "Permission Denied";
        }
      } else if (parsed.status === 429) {
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

      const httpCode = parsed.status >= 400 && parsed.status < 500 ? parsed.status : 400;
      return res.status(httpCode).json({
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

    const keyToTest = (key && typeof key === 'string' && key.trim())
      ? key.trim()
      : resolveGeminiApiKey();

    if (!keyToTest) {
      return res.status(400).json({
        ok: false,
        verificationStatus: "NOT CONFIGURED",
        message: "Please enter your Gemini API key.",
        errorCategory: "Missing Key"
      });
    }

    try {
      const testClient = getGenAIClient(keyToTest);
      await testClient.models.list({ config: { pageSize: 10 } });

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
        model: state.geminiProfiles[targetProfile]?.model || "gemini-4-hydrogen",
        profile: {
          ...state.geminiProfiles[targetProfile],
          key: '',
        }
      });
    } catch (verifyErr: any) {
      const parsed = parseGeminiError(verifyErr);
      const rawMsg = parsed.message || `HTTP ${parsed.status}`;
      let verificationStatus = "INVALID KEY";
      let message = "API key verification failed. Check your key and try again.";
      let errorCategory = "Invalid Key";

      if (parsed.status === 400 || parsed.status === 401) {
        verificationStatus = "INVALID KEY";
        message = "API key verification failed. Check your key and try again.";
        errorCategory = "Invalid Key";
      } else if (parsed.status === 403) {
        if (targetProfile === 'paid' || rawMsg.toLowerCase().includes('billing')) {
          verificationStatus = "BILLING ISSUE";
          message = "A billing issue was detected. Check your Google Cloud billing configuration.";
          errorCategory = "Billing Problem";
        } else {
          verificationStatus = "INVALID KEY";
          message = "API key verification failed. Check your key and try again.";
          errorCategory = "Permission Denied";
        }
      } else if (parsed.status === 429) {
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

      const httpCode = parsed.status >= 400 && parsed.status < 500 ? parsed.status : 400;
      return res.status(httpCode).json({
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
    const { key, profile } = req.body || {};
    const effectiveKey = resolveGeminiApiKey(typeof key === 'string' ? key : '');
    if (!effectiveKey) {
      return res.status(400).json({
        ok: false,
        errorCategory: 'Missing Key',
        errorMessage: 'Please configure your Gemini API key.'
      });
    }

    const testClient = getGenAIClient(effectiveKey);
    await testClient.models.list({ config: { pageSize: 10 } });

    return res.json({
      ok: true,
      status: 200,
      model: 'gemini-4-hydrogen',
      profile: profile || 'free',
      message: 'API key verified successfully.'
    });
  } catch (err: any) {
    const parsed = parseGeminiError(err);
    let errorCategory = 'Authentication Error';
    if (parsed.status === 400 || parsed.status === 401) {
      errorCategory = 'Invalid Key';
    } else if (parsed.status === 403) {
      errorCategory = req.body?.profile === 'paid' ? 'Billing Problem' : 'Permission Denied';
    } else if (parsed.status === 429) {
      errorCategory = 'Quota Exceeded';
    }
    return res.status(parsed.status >= 400 ? parsed.status : 500).json({
      ok: false,
      status: parsed.status,
      errorCategory,
      errorMessage: parsed.message,
    });
  }
});

app.post('/api/iyabd/process', async (req, res) => {
  try {
    const { prompt, assistantName, ownerName, permissions, mode, personality, customPersonalityText, responseStyle } = req.body;
    const activeClient = getGenAIClient();

    const response = await activeClient.models.generateContent({
      model: "gemini-4-hydrogen",
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

/**
 * Termux API Bridge
 * Enables native Android features when the server is running locally on the device via Termux.
 */
app.post('/api/termux/action', (req, res) => {
  const { action, args } = req.body;
  
  if (!action) return res.status(400).json({ error: 'No action specified' });

  let command = '';
  switch (action) {
    case 'call':
      if (args?.number) command = `termux-telephony-call ${args.number}`;
      break;
    case 'sms':
      if (args?.number && args?.text) command = `termux-sms-send -n ${args.number} "${args.text.replace(/"/g, '\\"')}"`;
      break;
    case 'vibrate':
      command = `termux-vibrate -d ${args?.duration || 500}`;
      break;
    case 'toast':
      if (args?.text) command = `termux-toast -c ${args?.color || 'white'} "${args.text.replace(/"/g, '\\"')}"`;
      break;
    case 'brightness':
      if (args?.level !== undefined) command = `termux-brightness ${args.level}`;
      break;
    case 'volume':
      if (args?.level !== undefined) command = `termux-volume music ${args.level}`;
      break;
    case 'battery':
      command = `termux-battery-status`;
      break;
    case 'torch':
      command = `termux-torch ${args?.state === 'on' ? 'on' : 'off'}`;
      break;
    case 'open':
      if (args?.url) command = `termux-open "${args.url}"`;
      break;
    case 'contacts':
      command = `termux-contact-list`;
      if (args?.limit) command += ` | head -n ${args.limit}`;
      break;
    case 'notifications':
      command = `termux-notification-list`;
      if (args?.limit) command += ` | head -n ${args.limit}`;
      break;
    case 'photo':
      const photoPath = args?.path || `~/rose_capture_${Date.now()}.jpg`;
      command = `termux-camera-photo -c ${args?.camera || 0} ${photoPath}`;
      break;
    case 'intent':
      if (args?.url) command = `am start -a android.intent.action.VIEW -d "${args.url}"`;
      break;
    case 'tts':
      if (args?.text) command = `termux-tts-speak -p ${args?.pitch || 1.0} -r ${args?.rate || 1.0} "${args.text.replace(/"/g, '\\"')}"`;
      break;
    default:
      return res.status(400).json({ error: 'Unsupported Termux action' });
  }

  if (!command) return res.status(400).json({ error: 'Missing arguments for command' });

  exec(command, (error, stdout, stderr) => {
    if (error) {
      // Don't log as error if it's just command not found (normal in non-Termux env)
      const isNotFound = error.message.includes('not found') || error.code === 127;
      if (!isNotFound) {
        console.warn(`Termux command failed: ${command} | Error: ${error.message}`);
      }
      
      // Return 200 with success: false so the frontend can handle it without a crash/500
      return res.json({ 
        success: false, 
        error: isNotFound ? 'Termux environment not detected' : error.message,
        command 
      });
    }

    try {
      const output = stdout.trim();
      const jsonOutput = (output.startsWith('{') || output.startsWith('[')) ? JSON.parse(output) : output;
      res.json({ success: true, command, output: jsonOutput });
    } catch (e) {
      res.json({ success: true, command, output: stdout.trim() });
    }
  });
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
