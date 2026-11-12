import { logVoiceEvent } from './voiceLogger';
import { getGeminiKey } from './geminiKey';
import {
  directGeminiTTS,
  pickStrictFemaleVoice,
  cleanAssistantReplyText,
  extractNonThoughtTextFromParts,
  ensureNoThoughtSystemInstruction,
  connectBoostedOutputChain,
  resetOutputGainForReply,
  volumeSliderToGain,
  isValidVoiceTranscript,
  discoverLightestFlashModel,
} from './ai-service';
import {
  pauseGlobalMicForSpeech,
  resumeGlobalMicAfterSpeech,
  getGlobalMicStream,
  setBrowserAudioSessionType,
} from './audio-manager';
import { NoiseGateEngine } from './noiseGate';
import {
  getMicListeningSettings,
  saveMicListeningSettings,
  getSensitivityThresholds,
  preloadAudioEnhancementsInBackground,
  loadRnnoiseWasmBinary,
  SileroVadEngine,
  passesStreetModeFilter,
  isPushToTalkCurrentlyActive,
  consumePushToTalkTurnFlag,
  resetPushToTalkTurnFlag,
  getRoseTechInstruction,
} from './cleanVoiceAndVad';
import {
  ADMIN_DISPLAY_NAME,
  ADMIN_SYSTEM_INSTRUCTION_BLOCK,
  ADMIN_PREFERRED_VOICES,
  isAdmin,
  applyAdminSystemInstructionOverride,
  stripStageCues,
} from './admin';
import {
  ROSE_TEAM_TOOLS,
  assignTask,
  getTeamStatus,
  TEAM_SYSTEM_INSTRUCTION,
} from './team';

export interface GeminiLiveOptions {
  assistantName?: string;
  ownerName?: string;
  voiceName?: string;
  language?: string;
  personality?: string;
  customPersonalityText?: string;
  responseStyle?: string;
  speechSpeed?: number;
  speechPitch?: number;
  voiceVolume?: number;
  ttsStylePrefix?: string;
  apiKey: string;
  systemInstruction?: string;
  model?: string;
  onStateChange?: (state: 'connecting' | 'listening' | 'thinking' | 'speaking' | 'off') => void;
  onTranscription?: (role: 'user' | 'assistant', text: string, isFinal?: boolean) => void;
  onVolume?: (volume: number) => void;
  onMicVolume?: (volume: number) => void;
  onMicLive?: (isLive: boolean) => void;
  onError?: (friendlyMessage: string, rawError?: any) => void;
  onClose?: (event?: any) => void;
  onTurnComplete?: () => void;
  onInterrupted?: () => void;
  onToast?: (message: string) => void;
  onReconnectStatus?: (status: 'reconnecting' | 'connected' | 'failed', message?: string) => void;
  audioContext?: AudioContext;
  playbackAudioContext?: AudioContext;
  micStream?: MediaStream;
}

export function parseAndFormatGeminiError(status: number | string, rawMsg: string): { bengali: string; original: string } {
  const code = Number(status) || 0;
  const cleanRaw = String(rawMsg || '').trim();
  const lowerMsg = cleanRaw.toLowerCase();

  let bengali = cleanRaw || 'সমস্যা হয়েছে';
  if (
    code === 400 ||
    code === 401 ||
    code === 403 ||
    lowerMsg.includes('api key') ||
    lowerMsg.includes('invalid key') ||
    lowerMsg.includes('permission_denied') ||
    lowerMsg.includes('unauthenticated')
  ) {
    bengali = `Key ভুল (${code || 400}): ${cleanRaw}`;
  } else if (code === 429 || lowerMsg.includes('quota') || lowerMsg.includes('resource_exhausted')) {
    bengali = `ফ্রি সীমা শেষ (429): ${cleanRaw}`;
  } else if (code === 0 || lowerMsg.includes('fetch') || lowerMsg.includes('network') || lowerMsg.includes('failed to fetch')) {
    bengali = `নেটওয়ার্ক সমস্যা: ${cleanRaw}`;
  } else if (code > 0) {
    bengali = `Gemini ${code}: ${cleanRaw}`;
  }

  const original = status ? `[HTTP ${status}] ${cleanRaw}` : cleanRaw;
  return { bengali, original };
}

function downsampleToPCM16(
  inputData: Float32Array,
  sourceRate: number,
  targetRate: number = 16000
): Int16Array {
  if (sourceRate === targetRate) {
    const pcm16 = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return pcm16;
  }
  const ratio = sourceRate / targetRate;
  const newLength = Math.floor(inputData.length / ratio);
  const result = new Int16Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < inputData.length; j++) {
      sum += inputData[j];
      count++;
    }
    const avg = count > 0 ? sum / count : (inputData[start] || 0);
    const s = Math.max(-1, Math.min(1, avg));
    result[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return result;
}

function parseVersionScore(modelName: string): number {
  const lower = modelName.toLowerCase();
  const match = lower.match(/-(\d+)(?:\.(\d+))?/);
  if (!match) return 0;
  const major = parseInt(match[1], 10) || 0;
  const minor = parseInt(match[2] || '0', 10) || 0;
  return major * 1000 + minor * 100;
}

interface DiscoveredVoiceModels {
  liveModels: string[];
  flashModels: string[];
  ttsModels: string[];
}

async function discoverVoiceModelsFromListModels(apiKey: string): Promise<DiscoveredVoiceModels> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'x-goog-api-key': apiKey },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const rawText = await res.text().catch(() => '');
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {}

    if (!res.ok) {
      const googleMsg = data?.error?.message || rawText || `HTTP ${res.status}`;
      const err: any = new Error(googleMsg);
      err.status = res.status;
      throw err;
    }

    const list: any[] = Array.isArray(data?.models) ? data.models : [];

    const liveCandidates: string[] = [];
    const flashCandidates: string[] = [];
    const ttsCandidates: string[] = [];

    for (const item of list) {
      const rawName = String(item?.name || '').replace(/^models\//, '').trim();
      if (!rawName) continue;
      const lower = rawName.toLowerCase();
      const methods: string[] = Array.isArray(item?.supportedGenerationMethods)
        ? item.supportedGenerationMethods
        : [];

      if (methods.includes('bidiGenerateContent')) {
        liveCandidates.push(rawName);
      }

      if (methods.includes('generateContent')) {
        if (lower.includes('tts')) {
          ttsCandidates.push(rawName);
        } else if (
          lower.includes('flash') &&
          !lower.includes('live') &&
          !lower.includes('tts') &&
          !lower.includes('image') &&
          !lower.includes('embedding') &&
          !lower.includes('vision') &&
          !lower.includes('aqa') &&
          !lower.includes('audio')
        ) {
          flashCandidates.push(rawName);
        }
      }
    }

    // Sort liveModels: "native-audio" first, then "live", then newest version
    liveCandidates.sort((a, b) => {
      const la = a.toLowerCase();
      const lb = b.toLowerCase();
      const scoreA =
        (la.includes('native-audio') ? 100000 : la.includes('live') ? 50000 : 0) +
        parseVersionScore(la);
      const scoreB =
        (lb.includes('native-audio') ? 100000 : lb.includes('live') ? 50000 : 0) +
        parseVersionScore(lb);
      return scoreB - scoreA;
    });

    // Sort flashModels: newest version first, prefer standard flash over lite/exp
    flashCandidates.sort((a, b) => {
      const la = a.toLowerCase();
      const lb = b.toLowerCase();
      const scoreA =
        parseVersionScore(la) +
        (!la.includes('lite') ? 30 : 0) +
        (!la.includes('exp') && !la.includes('preview') ? 15 : 0);
      const scoreB =
        parseVersionScore(lb) +
        (!lb.includes('lite') ? 30 : 0) +
        (!lb.includes('exp') && !lb.includes('preview') ? 15 : 0);
      return scoreB - scoreA;
    });

    // Sort ttsModels: newest version first
    ttsCandidates.sort((a, b) => parseVersionScore(b) - parseVersionScore(a));

    return {
      liveModels: liveCandidates.slice(0, 3),
      flashModels: flashCandidates,
      ttsModels: ttsCandidates,
    };
  } finally {
    clearTimeout(timer);
  }
}

function getSupportedRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const mime of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {}
  }
  return '';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || '');
      const commaIdx = res.indexOf(',');
      resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(blob);
  });
}

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private playbackAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private rnnoiseNode: AudioWorkletNode | null = null;
  private cleanDestNode: MediaStreamAudioDestinationNode | null = null;
  private denoisedStream: MediaStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private sileroVad = new SileroVadEngine();
  private noiseGateEngine = new NoiseGateEngine();
  private clipUsedPushToTalk = false;
  private lastLiveVadVoiceAt = 0;
  private nextStartTime = 0;
  private scheduledAudioSources: AudioBufferSourceNode[] = [];
  private currentState: 'connecting' | 'listening' | 'thinking' | 'speaking' | 'off' = 'off';
  private stateEnteredAt = Date.now();
  private wasStoppedByUser = false;
  private isMuted = false;
  private isSetupComplete = false;
  private isFallbackMode = false;
  private lastTtsAttemptError: string | null = null;
  private cachedApiKey = '';
  private vadConfigRejected = false;

  // Watchdog & Reconnect timers / state
  private watchdogTimer: any = null;
  private reconnectTimer: any = null;
  private isReconnecting = false;
  private resumptionHandle: string | null = null;
  private connectedModelName: string | null = null;
  private awaitingReplySince = 0;
  private watchdogReconnectedForTurn = false;
  private visualizerRunning = false;

  // 250ms PCM Chunk Accumulation Buffer (24000Hz * 0.25s = 6000 samples)
  private pendingPcmChunks: Float32Array[] = [];
  private pendingPcmSamplesCount = 0;
  private pcmFlushTimer: any = null;
  private liveTurnCompleted = false;

  // Discovered models from ListModels
  private liveModels: string[] = [];
  private flashModels: string[] = [];
  private ttsModels: string[] = [];

  // Fallback Mode (Path 2) state
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: BlobPart[] = [];
  private isRecordingClip = false;
  private clipStartTime = 0;
  private lastVoiceTime = 0;
  private discardClip = false;
  private isProcessingClip = false;
  private vadTimer: any = null;
  private interruptFrames = 0;
  private isBrowserTtsSpeaking = false;
  private isResumingMic = false;
  private conversationHistory: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  // Live diagnostics tracking
  public socketStatus: 'open' | 'closed' | 'connecting' = 'closed';
  public chunksSent = 0;
  public messagesReceived = 0;
  public lastHeardText = '';
  public lastError: string | null = null;
  public currentMicLevel = 0;
  public currentOutputLevel = 0;
  public activeMode: 'live' | 'fallback' = 'fallback';

  constructor(private options: GeminiLiveOptions) {}

  public getMicAnalyser() { return this.micAnalyser; }
  public getOutputAnalyser() { return this.outputAnalyser; }
  public isBrowserSpeechActive() { return this.isBrowserTtsSpeaking; }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.micStream) {
      try {
        this.micStream.getAudioTracks().forEach((track) => {
          track.enabled = !muted;
        });
      } catch {}
    }
    if (muted && this.isRecordingClip && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.discardClip = true;
      try {
        this.mediaRecorder.stop();
      } catch {}
      this.isRecordingClip = false;
    }
    logVoiceEvent('Mic', muted ? 'Muted' : 'Unmuted');
  }

  public getDiagnostics() {
    return {
      socketStatus: this.socketStatus,
      chunksSent: this.chunksSent,
      messagesReceived: this.messagesReceived,
      lastHeardText: this.lastHeardText,
      lastError: this.lastError,
      audioCtxState: this.audioCtx ? this.audioCtx.state : 'off',
      sampleRate: this.audioCtx ? this.audioCtx.sampleRate : 0,
      micLevel: this.currentMicLevel,
      mode: this.activeMode,
    };
  }

  public sendTextMessage(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isSetupComplete) {
      try {
        this.ws.send(JSON.stringify({ realtimeInput: { text } }));
      } catch {}
    }
  }

  public injectSystemInstructionToSpeak(sentence: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isSetupComplete) {
      try {
        this.ws.send(
          JSON.stringify({
            realtimeInput: {
              text: `[SYSTEM INSTRUCTION: Speak out loud right now in sweet natural Bengali: "${sentence}". Do not add other sentences.]`,
            },
          })
        );
      } catch {}
    }
  }

  public sendRealtimeVideoFrame(base64DataUrlOrRaw: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isSetupComplete) {
      try {
        const cleanBase64 = base64DataUrlOrRaw.replace(/^data:image\/[a-z]+;base64,/, '');
        this.ws.send(
          JSON.stringify({
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: 'image/jpeg',
                  data: cleanBase64,
                },
              ],
            },
          })
        );
      } catch {}
    }
  }

  public updateOwnerAndSystemInstruction(ownerName: string, systemInstruction: string) {
    this.options.ownerName = isAdmin() ? ADMIN_DISPLAY_NAME : ownerName;
    this.options.systemInstruction = systemInstruction;
  }

  private getEffectiveSystemInstruction(): string {
    const adminMode = isAdmin();
    if (adminMode) {
      this.options.ownerName = ADMIN_DISPLAY_NAME;
    }
    const base = this.options.systemInstruction || 'You are Rose, a helpful assistant.';
    const withTeam = `${base}\n\n${TEAM_SYSTEM_INSTRUCTION}`;
    return applyAdminSystemInstructionOverride(withTeam);
  }

  public async start() {
    this.wasStoppedByUser = false;
    this.isReconnecting = false;
    this.isSetupComplete = false;
    this.isFallbackMode = false;
    this.isProcessingClip = false;
    this.isRecordingClip = false;
    this.isBrowserTtsSpeaking = false;
    this.resumptionHandle = null;
    this.connectedModelName = null;
    this.awaitingReplySince = 0;
    this.watchdogReconnectedForTurn = false;
    this.liveUserBuffer = '';
    this.liveAssistantBuffer = '';
    this.conversationHistory = [];
    this.updateState('connecting');
    this.socketStatus = 'connecting';

    const apiKey = (this.options.apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();
    this.cachedApiKey = apiKey;
    if (!apiKey) {
      this.lastError = 'Gemini key নেই';
      this.options.onError?.('Gemini key নেই');
      this.updateState('off');
      this.socketStatus = 'closed';
      return;
    }

    // Background preload of RNNoise WASM and Silero VAD (non-blocking so call starts immediately)
    preloadAudioEnhancementsInBackground();
    const micSettings = getMicListeningSettings();
    if (micSettings.smartListen) {
      void this.sileroVad.initInBackground();
    }

    // 1. Initialize Single AudioContext, Microphone & AnalyserNode immediately
    const audioReady = await this.initAudioAndAnalyzers();
    if (!audioReady || this.wasStoppedByUser) {
      return;
    }

    // Start Watchdog (10s no-reply after user transcription + 15s stuck PROCESSING/SPEAKING)
    this.startWatchdog();

    // 2. Fetch available models from Google ListModels dynamically
    try {
      const discovered = await discoverVoiceModelsFromListModels(apiKey);
      this.liveModels = discovered.liveModels;
      this.flashModels = discovered.flashModels;
      this.ttsModels = discovered.ttsModels;
    } catch (err: any) {
      const formatted = parseAndFormatGeminiError(err?.status || 0, err?.message || 'ListModels failed');
      this.lastError = formatted.bengali;
      this.options.onError?.(formatted.bengali, formatted.original);
      this.updateState('off');
      this.socketStatus = 'closed';
      return;
    }

    if (this.wasStoppedByUser) return;

    // 3. Try Path 1 (Live WebSocket) unless Street Mode is enabled (Street Mode requires transcript wake-word verification before speaking)
    if (this.liveModels.length > 0 && !getMicListeningSettings().streetMode) {
      const connectedLive = await this.tryConnectLiveModels(apiKey, this.liveModels.slice(0, 3), 8000);
      if (connectedLive && !this.wasStoppedByUser) {
        this.activeMode = 'live';
        this.socketStatus = 'open';
        this.updateState('listening');
        return;
      }
    }

    // 4. Activate Path 2 (Reliable Voice via MediaRecorder + generateContent + TTS/speechSynthesis)
    if (!this.wasStoppedByUser) {
      this.activateFallbackPath(apiKey);
    }
  }

  private sanitizeLogText(text: string): string {
    if (!text) return '';
    let out = String(text);
    if (this.cachedApiKey) {
      out = out.split(this.cachedApiKey).join('[REDACTED]');
    }
    return out.replace(/key=[^&\s"']+/gi, 'key=[REDACTED]');
  }

  private startWatchdog() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = setInterval(() => {
      if (this.wasStoppedByUser || this.currentState === 'off') return;

      // 10-second reply watchdog: if user's speech was transcribed but no model reply starts within 10s
      if (
        !this.isReconnecting &&
        this.awaitingReplySince > 0 &&
        this.currentState !== 'speaking' &&
        this.scheduledAudioSources.length === 0 &&
        !this.isBrowserTtsSpeaking &&
        Date.now() - this.awaitingReplySince > 10000
      ) {
        this.awaitingReplySince = 0;
        if (!this.watchdogReconnectedForTurn) {
          this.watchdogReconnectedForTurn = true;
          console.log(
            '[GeminiLive] Watchdog: user speech was transcribed but no model reply started within 10s. Reconnecting once...'
          );
          logVoiceEvent('Watchdog', 'No model reply within 10s after user transcription, reconnecting once', 'warn');
          void this.handleLiveDisconnectAndAutoReconnect(this.cachedApiKey, 'watchdog_no_reply_10s', 1);
          return;
        } else {
          console.log(
            '[GeminiLive] Watchdog: still no model reply 10s after watchdog reconnect. Ending call cleanly.'
          );
          logVoiceEvent('Watchdog', 'No reply after watchdog reconnect, ending call', 'error');
          this.failAndEndSessionCleanly('Connection lost, tap to start again');
          return;
        }
      }

      const isBusyState =
        this.currentState === 'thinking' ||
        this.currentState === 'speaking' ||
        this.isProcessingClip ||
        this.isBrowserTtsSpeaking;
      if (isBusyState && Date.now() - this.stateEnteredAt > 15000) {
        logVoiceEvent('Watchdog', 'Stuck in PROCESSING/SPEAKING > 15s, forcing reset to LISTENING', 'warn');
        this.interruptPlayback();
        this.isProcessingClip = false;
        this.isRecordingClip = false;
        this.discardClip = false;
        this.isBrowserTtsSpeaking = false;
        this.liveUserBuffer = '';
        this.liveAssistantBuffer = '';
        this.finishSpeakingAndReturnToListening();
      }
    }, 1000);
  }

  private attachMicStreamToAudioGraph(stream: MediaStream) {
    if (!this.audioCtx || !this.micAnalyser) return;
    try {
      if (this.micSourceNode) {
        try {
          this.micSourceNode.disconnect();
        } catch {}
        this.micSourceNode = null;
      }
      const source = this.audioCtx.createMediaStreamSource(stream);
      this.micSourceNode = source;

      const { cleanVoice } = getMicListeningSettings();
      if (this.rnnoiseNode) {
        try {
          this.rnnoiseNode.port.postMessage({ type: 'set-enabled', enabled: cleanVoice });
          this.rnnoiseNode.disconnect();
        } catch {}
        source.connect(this.rnnoiseNode);
        this.rnnoiseNode.connect(this.micAnalyser);
        if (this.cleanDestNode) {
          this.rnnoiseNode.connect(this.cleanDestNode);
        }
        if (this.audioWorkletNode) {
          this.rnnoiseNode.connect(this.audioWorkletNode);
        } else if (this.scriptProcessor) {
          this.rnnoiseNode.connect(this.scriptProcessor);
        }
        this.denoisedStream =
          cleanVoice && this.cleanDestNode && this.cleanDestNode.stream.getAudioTracks().length > 0
            ? this.cleanDestNode.stream
            : stream;
      } else {
        source.connect(this.micAnalyser);
        if (this.cleanDestNode) {
          source.connect(this.cleanDestNode);
        }
        if (this.audioWorkletNode) {
          source.connect(this.audioWorkletNode);
        } else if (this.scriptProcessor) {
          source.connect(this.scriptProcessor);
        }
        this.denoisedStream = stream;
      }
      this.options.onMicLive?.(true);
    } catch (e) {
      console.warn('[GeminiLiveSession] attachMicStreamToAudioGraph error:', e);
      this.denoisedStream = stream;
    }
  }

  private micReleasedAt = 0;
  private needsGainResetForTurn = true;

  private async initAudioAndAnalyzers(): Promise<boolean> {
    try {
      const { cleanVoice } = getMicListeningSettings();
      setBrowserAudioSessionType('play-and-record');
      const hasLiveOptionStream =
        this.options.micStream &&
        this.options.micStream.active &&
        this.options.micStream.getAudioTracks().some((t) => t.readyState === 'live');

      if (hasLiveOptionStream && this.options.micStream) {
        this.micStream = this.options.micStream;
      } else {
        this.micStream = await getGlobalMicStream({
          audio: {
            echoCancellation: false,
            noiseSuppression: cleanVoice,
            autoGainControl: false,
            sampleRate: { ideal: 48000 },
            channelCount: { ideal: 1 },
          },
        });
      }

      const micTrack = this.micStream.getAudioTracks()[0];
      if (!micTrack || micTrack.readyState !== 'live') {
        throw new Error('মাইক সচল নয়');
      }

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;

      // Separate input AudioContext (for mic/VAD/RNNoise) and persistent output AudioContext (for speaker playback)
      this.audioCtx =
        this.options.audioContext && this.options.audioContext.state !== 'closed'
          ? this.options.audioContext
          : new AudioCtxClass({ sampleRate: 48000 });

      this.playbackAudioCtx =
        this.options.playbackAudioContext &&
        this.options.playbackAudioContext !== this.audioCtx &&
        this.options.playbackAudioContext.state !== 'closed'
          ? this.options.playbackAudioContext
          : new AudioCtxClass({ sampleRate: 24000, latencyHint: 'interactive' });

      if (this.audioCtx.state !== 'running') {
        try {
          await this.audioCtx.resume();
        } catch {}
      }
      if (this.playbackAudioCtx.state !== 'running') {
        try {
          await this.playbackAudioCtx.resume();
        } catch {}
      }

      // Unlock persistent output AudioContext on user gesture with a 1-frame silent buffer
      try {
        const silentBuf = this.playbackAudioCtx.createBuffer(1, 1, 24000);
        const silentSrc = this.playbackAudioCtx.createBufferSource();
        silentSrc.buffer = silentBuf;
        silentSrc.connect(this.playbackAudioCtx.destination);
        silentSrc.start(0);
      } catch {}

      const sourceSampleRate = this.audioCtx.sampleRate;

      if (!this.micAnalyser || this.micAnalyser.context !== this.audioCtx) {
        this.micAnalyser = this.audioCtx.createAnalyser();
        this.micAnalyser.fftSize = 256;
        this.micAnalyser.smoothingTimeConstant = 0.45;
      }

      if (!this.outputAnalyser || this.outputAnalyser.context !== this.playbackAudioCtx) {
        this.outputAnalyser = this.playbackAudioCtx.createAnalyser();
        this.outputAnalyser.fftSize = 256;
        this.outputAnalyser.smoothingTimeConstant = 0.45;
      }

      try {
        this.cleanDestNode = this.audioCtx.createMediaStreamDestination();
      } catch (e) {
        console.warn('[Rose Clean Voice] createMediaStreamDestination failed:', e);
        this.cleanDestNode = null;
      }

      // Setup Rose Clean Voice RNNoise AudioWorklet (48kHz, 480-sample frames) with safe fallback
      if (this.audioCtx.audioWorklet && typeof AudioWorkletNode === 'function') {
        try {
          await this.audioCtx.audioWorklet.addModule('/rnnoise-worklet.js');
          this.rnnoiseNode = new AudioWorkletNode(this.audioCtx, 'rnnoise-worklet-processor', {
            processorOptions: {
              enabled: cleanVoice,
            },
          });
          this.rnnoiseNode.port.onmessage = (ev) => {
            if (ev.data?.type === 'wasm-error') {
              console.warn('[Rose Clean Voice] RNNoise worklet WASM fallback:', ev.data.error);
            }
          };
          // Load local /rnnoise.wasm in background so call start is never delayed
          loadRnnoiseWasmBinary()
            .then((wasmBuf) => {
              if (wasmBuf && this.rnnoiseNode && !this.wasStoppedByUser) {
                try {
                  this.rnnoiseNode.port.postMessage({
                    type: 'init-wasm',
                    wasmBinary: wasmBuf.slice(0),
                  });
                } catch {}
              }
            })
            .catch(() => {});
        } catch (rnErr) {
          console.warn('[Rose Clean Voice] AudioWorklet load failed, using browser mic filter:', rnErr);
          this.rnnoiseNode = null;
        }
      }

      // Attach PCM capture for Path 1 Live WebSocket AND feed Silero VAD for Path 1 & Path 2
      const processPcmBuffer = (float32Samples: Float32Array) => {
        if (this.wasStoppedByUser || this.isMuted || this.currentState === 'speaking') {
          return;
        }

        const micCfg = getMicListeningSettings();
        // Apply Noise Gate filtering to mic audio
        this.noiseGateEngine.processFrame(float32Samples, micCfg.noiseGate, micCfg.noiseGateSensitivity);

        if (micCfg.smartListen && this.currentState === 'listening') {
          if (!this.sileroVad.isAvailable()) {
            void this.sileroVad.initInBackground();
          } else {
            void this.sileroVad.feedAudioSamples(float32Samples, sourceSampleRate);
          }
        }

        if (
          !this.ws ||
          this.ws.readyState !== WebSocket.OPEN ||
          !this.isSetupComplete ||
          this.isFallbackMode
        ) {
          return;
        }

        // If Smart Listen (Silero VAD) is active in Path 1, gate non-speech noise (traffic/wind/horn)
        if (micCfg.smartListen && this.sileroVad.isAvailable() && !isPushToTalkCurrentlyActive()) {
          const thresholds = getSensitivityThresholds(micCfg.micSensitivity);
          const prob = this.sileroVad.getLastSpeechProbability();
          const now = Date.now();
          if (prob >= thresholds.vadNegative) {
            this.lastLiveVadVoiceAt = now;
          }
          // Only stream audio when Silero detects speech or within 650ms hangover after speech
          if (prob < thresholds.vadPositive && now - this.lastLiveVadVoiceAt > 650) {
            return;
          }
        }

        const pcm16 = downsampleToPCM16(float32Samples, sourceSampleRate, 16000);
        if (pcm16.length === 0) return;

        const u8 = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
        let binary = '';
        for (let i = 0; i < u8.byteLength; i++) {
          binary += String.fromCharCode(u8[i]);
        }
        const base64 = btoa(binary);

        try {
          this.ws.send(
            JSON.stringify({
              realtimeInput: {
                audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
              },
            })
          );
          this.chunksSent++;
        } catch {}
      };

      let workletActive = false;
      try {
        const processorCode = `
          class AudioProcessor extends AudioWorkletProcessor {
            process(inputs) {
              const input = inputs[0];
              if (input && input.length > 0 && input[0].length > 0) {
                this.port.postMessage(input[0]);
              }
              return true;
            }
          }
          registerProcessor('audio-processor', AudioProcessor);
        `;
        const blob = new Blob([processorCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        await this.audioCtx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);

        this.audioWorkletNode = new AudioWorkletNode(this.audioCtx, 'audio-processor');
        this.audioWorkletNode.port.onmessage = (e) => {
          if (e.data && e.data instanceof Float32Array) {
            processPcmBuffer(e.data);
          }
        };
        workletActive = true;
      } catch {}

      if (!workletActive) {
        this.scriptProcessor = this.audioCtx.createScriptProcessor(4096, 1, 1);
        this.scriptProcessor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          processPcmBuffer(input);
        };
        const silentGain = this.audioCtx.createGain();
        silentGain.gain.value = 0;
        this.scriptProcessor.connect(silentGain);
        silentGain.connect(this.audioCtx.destination);
      }

      this.attachMicStreamToAudioGraph(this.micStream);
      this.startVisualizer();
      return true;
    } catch (e: any) {
      const isDenied =
        e?.name === 'NotAllowedError' ||
        e?.name === 'PermissionDeniedError' ||
        String(e?.message || '').toLowerCase().includes('denied');
      const msg = isDenied ? 'মাইক অনুমতি নেই' : `মাইক ত্রুটি: ${e?.message || e}`;
      this.lastError = msg;
      this.options.onError?.(msg);
      this.updateState('off');
      return false;
    }
  }

  private modelSupportsAffectiveDialog(modelName: string): boolean {
    const lower = String(modelName || '').toLowerCase();
    return lower.includes('native-audio');
  }

  private async tryConnectLiveModels(
    apiKey: string,
    candidates: string[],
    totalBudgetMs: number
  ): Promise<boolean> {
    const deadline = Date.now() + totalBudgetMs;
    const adminActive = isAdmin();

    let orderedCandidates = [...candidates];
    if (adminActive) {
      const allPool = Array.from(new Set([...candidates, ...this.liveModels]));
      const nativeAudioModels = allPool.filter((m) =>
        String(m || '').toLowerCase().includes('native-audio')
      );
      const otherModels = allPool.filter(
        (m) => !String(m || '').toLowerCase().includes('native-audio')
      );
      if (nativeAudioModels.length > 0) {
        orderedCandidates = [...nativeAudioModels, ...otherModels].slice(0, 4);
      } else {
        console.log(
          '[ADMIN LIVE] No "native-audio" model found in ListModels; keeping current model list:',
          orderedCandidates
        );
      }
    }

    const voiceCandidates: string[] = adminActive
      ? [...ADMIN_PREFERRED_VOICES]
      : [this.options.voiceName || 'Sulafat'];

    for (const modelName of orderedCandidates) {
      if (this.wasStoppedByUser) return false;
      const remaining = deadline - Date.now();
      if (remaining <= 600) break;

      const isNativeAudio = this.modelSupportsAffectiveDialog(modelName);
      const tryAffective = adminActive && isNativeAudio;

      for (const candidateVoice of voiceCandidates) {
        if (this.wasStoppedByUser) return false;
        if (deadline - Date.now() <= 600) break;

        let ok = false;
        let usedAffective = false;

        if (tryAffective) {
          const affectiveTimeout = Math.min(2000, deadline - Date.now());
          ok = await this.trySingleLiveModel(
            apiKey,
            modelName,
            affectiveTimeout,
            true,
            true,
            candidateVoice
          );
          if (!ok && !this.wasStoppedByUser && Date.now() + 600 < deadline) {
            const affectiveNoResumptionTimeout = Math.min(1800, deadline - Date.now());
            ok = await this.trySingleLiveModel(
              apiKey,
              modelName,
              affectiveNoResumptionTimeout,
              false,
              true,
              candidateVoice
            );
          }
          if (ok) {
            usedAffective = true;
          }
        }

        if (!ok && !this.wasStoppedByUser && Date.now() + 600 < deadline) {
          const stdTimeout = Math.min(2400, deadline - Date.now());
          // Retry without affectiveDialog automatically if unsupported/errored, with no user-visible error
          ok = await this.trySingleLiveModel(
            apiKey,
            modelName,
            stdTimeout,
            true,
            false,
            candidateVoice
          );
        }

        if (!ok && !this.wasStoppedByUser && Date.now() + 600 < deadline) {
          // Fallback retry without sessionResumption/contextWindowCompression if model or expired handle rejected it
          this.resumptionHandle = null;
          const retryTimeout = Math.min(2000, deadline - Date.now());
          ok = await this.trySingleLiveModel(
            apiKey,
            modelName,
            retryTimeout,
            false,
            false,
            candidateVoice
          );
        }

        if (ok) {
          this.connectedModelName = modelName;
          if (adminActive) {
            console.log('[ADMIN LIVE] Used:', {
              model: modelName,
              voice: candidateVoice,
              affectiveDialog: usedAffective,
            });
          }
          return true;
        }
      }
    }

    return false;
  }

  private trySingleLiveModel(
    apiKey: string,
    modelName: string,
    timeoutMs: number,
    includeResumptionAndCompression: boolean = true,
    includeAffectiveDialog: boolean = false,
    voiceNameOverride?: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const useAlphaEndpoint =
        includeAffectiveDialog && isAdmin() && this.modelSupportsAffectiveDialog(modelName);
      const apiVersion = useAlphaEndpoint ? 'v1alpha' : 'v1beta';
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${apiVersion}.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`;

      let socket: WebSocket | null = null;
      const finish = (success: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (!success && socket) {
          try {
            socket.onopen = null;
            socket.onmessage = null;
            socket.onerror = null;
            socket.onclose = null;
            socket.close();
          } catch {}
          if (this.ws === socket) {
            this.ws = null;
          }
        }
        resolve(success);
      };

      const timer = setTimeout(() => {
        finish(false);
      }, timeoutMs);

      try {
        socket = new WebSocket(wsUrl);
        this.ws = socket;
      } catch {
        finish(false);
        return;
      }

      socket.onopen = () => {
        if (this.wasStoppedByUser) {
          finish(false);
          return;
        }
        const STT_LANG_PROMPT = "ব্যবহারকারী বাংলা বা ইংরেজিতে কথা বলেন, শুধু বাংলা বা ইংরেজিতে লেখো, কোরিয়ান বা অন্য ভাষায় নয়। অস্পষ্ট হলে বাংলায় লেখো। ভয়েস কলে সর্বোচ্চ ২-৩ ছোট বাক্যে উত্তর দাও।";
        const rawLiveInst = `${STT_LANG_PROMPT}\n\n${ensureNoThoughtSystemInstruction(
          this.getEffectiveSystemInstruction()
        )}\n\n${getRoseTechInstruction()}`;
        const finalLiveInst = applyAdminSystemInstructionOverride(rawLiveInst, { isLiveVoice: true });

        const selectedVoiceName =
          voiceNameOverride ||
          (isAdmin() ? ADMIN_PREFERRED_VOICES[0] : this.options.voiceName || 'Sulafat');

        const generationConfig: any = {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoiceName,
              },
            },
          },
        };

        if (useAlphaEndpoint) {
          generationConfig.enableAffectiveDialog = true;
        }

        const micSettings = getMicListeningSettings();

        const setupPayload: any = {
          model: `models/${modelName}`,
          generationConfig,
          systemInstruction: {
            parts: [
              {
                text: finalLiveInst,
              },
            ],
          },
          tools: ROSE_TEAM_TOOLS,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        };

        if (micSettings.fastReply && !this.vadConfigRejected) {
          let silenceMs = 500;
          if (micSettings.fastReplySpeed === 'Normal') silenceMs = 800;
          else if (micSettings.fastReplySpeed === 'Very fast') silenceMs = 350;

          setupPayload.realtimeInputConfig = {
            automaticActivityDetection: {
              endOfSpeechSensitivity: 'HIGH',
              prefixPaddingMs: 200,
              silenceDurationMs: silenceMs,
            },
          };
        }

        if (includeResumptionAndCompression) {
          setupPayload.sessionResumption = this.resumptionHandle
            ? { handle: this.resumptionHandle }
            : {};
          setupPayload.contextWindowCompression = {
            slidingWindow: {},
          };
        }

        try {
          socket?.send(JSON.stringify({ setup: setupPayload }));
        } catch {
          finish(false);
        }
      };

      socket.onmessage = async (event) => {
        this.messagesReceived++;
        try {
          const raw = typeof event.data === 'string' ? event.data : await (event.data as Blob).text();
          const msg = JSON.parse(raw);

          // Store latest sessionResumption handle if sent by server
          const resumptionUpdate = msg.sessionResumptionUpdate || msg.session_resumption_update;
          if (resumptionUpdate) {
            const newHandle =
              resumptionUpdate.newHandle ||
              resumptionUpdate.new_handle ||
              resumptionUpdate.handle;
            if (newHandle && typeof newHandle === 'string') {
              this.resumptionHandle = newHandle;
            }
          }

          // Handle server goAway message before session expires
          const goAwayMsg = msg.goAway || msg.go_away;
          if (goAwayMsg) {
            const timeLeft = goAwayMsg.timeLeft || goAwayMsg.time_left || 'unknown';
            console.log('[GeminiLive] Server goAway received — timeLeft:', timeLeft);
            if (!settled) {
              finish(false);
              return;
            }
            if (!this.wasStoppedByUser && this.ws === socket) {
              void this.handleLiveDisconnectAndAutoReconnect(apiKey, `goAway (timeLeft: ${timeLeft})`);
            }
            return;
          }

          if (msg.error) {
            const safeErr = this.sanitizeLogText(
              String(msg.error?.message || msg.error?.status || 'server_error')
            );
            console.log('[GeminiLive] Server error message — reason:', safeErr);
            
            // Check if VAD config was rejected
            if (safeErr.toLowerCase().includes('automatic_activity_detection') || safeErr.toLowerCase().includes('realtime_input_config')) {
              console.warn('[GeminiLive] Server rejected VAD config. Retrying without it.');
              this.vadConfigRejected = true;
              const micSettings = getMicListeningSettings();
              if (micSettings.fastReply) {
                saveMicListeningSettings({ fastReply: false });
                this.options.onToast?.("Fast reply এই মডেলে চলে না");
              }
              if (!settled) {
                finish(false);
                return;
              }
              if (!this.wasStoppedByUser && this.ws === socket) {
                void this.handleLiveDisconnectAndAutoReconnect(apiKey, 'vad_config_rejected', 1);
              }
              return;
            }

            if (!settled) {
              finish(false);
              return;
            }
            if (!this.wasStoppedByUser && this.ws === socket) {
              void this.handleLiveDisconnectAndAutoReconnect(apiKey, `error (${safeErr})`);
            }
            return;
          }

          if (msg.setupComplete) {
            this.isSetupComplete = true;
            finish(true);
            return;
          }

          const liveToolCall = msg.toolCall || msg.tool_call;
          if (liveToolCall) {
            void this.handleLiveToolCall(socket, liveToolCall);
            return;
          }

          if (msg.serverContent) {
            const parts = msg.serverContent?.modelTurn?.parts || [];
            const fcPart = parts.find((p: any) => p?.functionCall);
            if (fcPart?.functionCall) {
              void this.handleLiveToolCall(socket, { functionCalls: [fcPart.functionCall] });
            }
            this.handleLiveServerContent(msg.serverContent);
          }
        } catch {}
      };

      socket.onerror = () => {
        console.log('[GeminiLive] WebSocket error event');
        if (!settled) {
          finish(false);
        } else if (!this.wasStoppedByUser && this.ws === socket) {
          void this.handleLiveDisconnectAndAutoReconnect(apiKey, 'websocket_error');
        }
      };

      socket.onclose = (event: CloseEvent) => {
        const safeReason = this.sanitizeLogText(String(event?.reason || 'no reason'));
        console.log(
          '[GeminiLive] WebSocket closed — code:',
          event?.code ?? 'unknown',
          'reason:',
          safeReason
        );
        if (!settled) {
          finish(false);
        } else if (!this.wasStoppedByUser && this.ws === socket) {
          void this.handleLiveDisconnectAndAutoReconnect(
            apiKey,
            `close (code: ${event?.code ?? 'unknown'}, reason: ${safeReason})`
          );
        }
      };
    });
  }

  private async handleLiveToolCall(socket: WebSocket, toolCall: any) {
    const calls = toolCall?.functionCalls || toolCall?.function_calls || [];
    if (!Array.isArray(calls) || calls.length === 0) return;

    const functionResponses: any[] = [];

    for (const call of calls) {
      const callId = call.id || 'call_' + Date.now();
      const name = call.name;
      const args = call.args || {};

      console.log('[GeminiLive] Executing tool call:', name, args);

      try {
        if (name === 'assign_task') {
          const res = await assignTask({
            agent: String(args.agent || 'mira'),
            instruction: String(args.instruction || ''),
            source: typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'pc' : 'mobile',
          });
          functionResponses.push({
            response: {
              output: {
                success: res.success,
                message: res.message,
                taskId: res.task.id,
              },
            },
            id: callId,
          });
        } else if (name === 'get_team_status') {
          const res = await getTeamStatus(args.agent ? String(args.agent) : undefined);
          functionResponses.push({
            response: {
              output: {
                success: res.success,
                summary: res.summary,
              },
            },
            id: callId,
          });
        } else {
          functionResponses.push({
            response: {
              output: {
                error: `Unknown tool: ${name}`,
              },
            },
            id: callId,
          });
        }
      } catch (err: any) {
        functionResponses.push({
          response: {
            output: {
              error: err?.message || 'Tool execution failed',
            },
          },
          id: callId,
        });
      }
    }

    if (socket.readyState === WebSocket.OPEN && functionResponses.length > 0) {
      try {
        socket.send(
          JSON.stringify({
            toolResponse: {
              functionResponses,
            },
          })
        );
      } catch (err) {
        console.warn('[GeminiLive] Failed to send toolResponse over WebSocket:', err);
      }
    }
  }

  private releaseSessionAudioAndSocketForReconnect() {
    this.isSetupComplete = false;
    this.socketStatus = 'connecting';

    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    if (this.vadTimer) {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.discardClip = true;
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.mediaRecorder = null;
    this.isRecordingClip = false;
    this.isProcessingClip = false;

    this.interruptPlayback();

    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch {}
      this.micSourceNode = null;
    }

    if (this.rnnoiseNode) {
      try {
        this.rnnoiseNode.disconnect();
      } catch {}
      this.rnnoiseNode = null;
    }

    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }

    if (this.audioWorkletNode) {
      try {
        this.audioWorkletNode.disconnect();
      } catch {}
      this.audioWorkletNode = null;
    }

    if (this.cleanDestNode) {
      try {
        this.cleanDestNode.disconnect();
      } catch {}
      this.cleanDestNode = null;
    }

    pauseGlobalMicForSpeech([this.micStream, this.options.micStream]);
    this.micStream = null;
    this.options.micStream = undefined;
    this.denoisedStream = null;
    this.options.onMicLive?.(false);
  }

  private failAndEndSessionCleanly(message: string) {
    this.stop();
    this.lastError = message;
    this.options.onReconnectStatus?.('failed', message);
    this.options.onError?.(message);
    this.options.onClose?.({ reason: message });
  }

  private async handleLiveDisconnectAndAutoReconnect(
    apiKey: string,
    reason: string = 'disconnect',
    maxAttempts: number = 3
  ): Promise<void> {
    if (this.wasStoppedByUser || this.isReconnecting) return;
    this.isReconnecting = true;

    const cleanKey = (apiKey || this.cachedApiKey || getGeminiKey() || '')
      .replace(/[\r\n\t\s"']+/g, '')
      .trim();

    // Release old WebSocket and old mic/audio nodes cleanly first
    this.releaseSessionAudioAndSocketForReconnect();

    // Notify call banner UI to show "Reconnecting…"
    this.options.onReconnectStatus?.('reconnecting', 'Reconnecting…');

    const delays = [500, 1000, 2000];

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (this.wasStoppedByUser) return;
        const delayMs = delays[Math.min(attempt - 1, delays.length - 1)];
        console.log(
          `[GeminiLive] Reconnect attempt ${attempt}/${maxAttempts} in ${delayMs}ms (reason: ${this.sanitizeLogText(reason)}, resumptionHandle: ${
            this.resumptionHandle ? 'present' : 'none'
          })`
        );

        await new Promise<void>((resolve) => {
          if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            resolve();
          }, delayMs);
        });

        if (this.wasStoppedByUser) return;

        // Re-initialize fresh mic stream and audio nodes
        const audioReady = await this.initAudioAndAnalyzers();
        if (!audioReady || this.wasStoppedByUser) {
          this.releaseSessionAudioAndSocketForReconnect();
          continue;
        }

        if (this.liveModels.length === 0 && cleanKey) {
          try {
            const discovered = await discoverVoiceModelsFromListModels(cleanKey);
            this.liveModels = discovered.liveModels;
            this.flashModels = discovered.flashModels;
            this.ttsModels = discovered.ttsModels;
          } catch {}
        }

        const orderedCandidates = this.connectedModelName
          ? [
              this.connectedModelName,
              ...this.liveModels.filter((m) => m !== this.connectedModelName),
            ]
          : this.liveModels.slice(0, 3);

        let reconnected = false;
        if (orderedCandidates.length > 0 && !getMicListeningSettings().streetMode) {
          reconnected = await this.tryConnectLiveModels(cleanKey, orderedCandidates, 5500);
        }

        if (reconnected && !this.wasStoppedByUser) {
          console.log(`[GeminiLive] Reconnect attempt ${attempt}/${maxAttempts} succeeded`);
          this.isFallbackMode = false;
          this.activeMode = 'live';
          this.socketStatus = 'open';
          this.awaitingReplySince = 0;
          this.isReconnecting = false;
          this.options.onReconnectStatus?.('connected');
          await this.finishSpeakingAndReturnToListening(0);
          return;
        }

        // Release nodes from failed attempt before next attempt
        this.releaseSessionAudioAndSocketForReconnect();
      }

      if (!this.wasStoppedByUser) {
        console.log(
          `[GeminiLive] All ${maxAttempts} reconnect attempts failed. Ending call cleanly.`
        );
        this.isReconnecting = false;
        this.failAndEndSessionCleanly('Connection lost, tap to start again');
      }
    } finally {
      this.isReconnecting = false;
    }
  }

  private liveUserBuffer = '';
  private liveAssistantBuffer = '';
  private liveStreetAllowed = true;

  private handleLiveServerContent(content: any) {
    const inTrans =
      content.inputTranscription ||
      content.inputAudioTranscription ||
      content.input_audio_transcription ||
      content.userTurn?.parts?.find((p: any) => p.text);
    if (inTrans) {
      const textVal = typeof inTrans === 'string' ? inTrans : inTrans.text || inTrans.parts?.[0]?.text;
      if (textVal && isValidVoiceTranscript(textVal)) {
        this.liveUserBuffer += textVal;
        const combined = this.liveUserBuffer.trim();
        if (isValidVoiceTranscript(combined)) {
          this.liveStreetAllowed = passesStreetModeFilter(
            combined,
            this.options.assistantName,
            isPushToTalkCurrentlyActive()
          );
          if (this.liveStreetAllowed) {
            this.lastHeardText = combined;
            if (this.currentState !== 'speaking') {
              this.awaitingReplySince = Date.now();
            }
            // Continuous update for user transcription
            this.options.onTranscription?.('user', combined, false);
          }
        }
      }
    }

    const outTrans =
      content.outputTranscription ||
      content.outputAudioTranscription ||
      content.output_audio_transcription;
    if (outTrans) {
      this.awaitingReplySince = 0;
      this.watchdogReconnectedForTurn = false;
      if (this.liveUserBuffer.trim()) {
        const finalUser = this.liveUserBuffer.trim();
        this.liveUserBuffer = '';
        this.liveStreetAllowed = passesStreetModeFilter(
          finalUser,
          this.options.assistantName,
          consumePushToTalkTurnFlag()
        );
        if (this.liveStreetAllowed && isValidVoiceTranscript(finalUser)) {
          this.options.onTranscription?.('user', finalUser, true);
        }
      }
      if (!this.liveStreetAllowed) {
        this.stopAllAudioPlayback();
        return;
      }
      const textVal = typeof outTrans === 'string' ? outTrans : outTrans.text || outTrans.parts?.[0]?.text;
      if (textVal) {
        if (this.liveAssistantBuffer === '...') {
          this.liveAssistantBuffer = '';
        }
        this.liveAssistantBuffer += textVal;
        const cleanedLive = stripStageCues(
          cleanAssistantReplyText(this.liveAssistantBuffer.trim(), this.options.language)
        );
        if (cleanedLive) {
          // Continuous update for assistant transcription
          this.options.onTranscription?.('assistant', cleanedLive, false);
        }
      }
    }

    if (content.modelTurn) {
      this.awaitingReplySince = 0;
      this.watchdogReconnectedForTurn = false;
      if (this.liveUserBuffer.trim()) {
        const finalUser = this.liveUserBuffer.trim();
        this.liveUserBuffer = '';
        this.liveStreetAllowed = passesStreetModeFilter(
          finalUser,
          this.options.assistantName,
          consumePushToTalkTurnFlag()
        );
        if (this.liveStreetAllowed && isValidVoiceTranscript(finalUser)) {
          this.options.onTranscription?.('user', finalUser, true);
        }
      }
      if (!this.liveStreetAllowed) {
        this.stopAllAudioPlayback();
        return;
      }
      const parts = content.modelTurn.parts || [];
      for (const part of parts) {
        if (part?.thought === true) {
          continue;
        }
        if (part.inlineData?.data) {
          if (this.scheduledAudioSources.length === 0 && this.pendingPcmSamplesCount === 0) {
            this.needsGainResetForTurn = true;
          }
          this.liveTurnCompleted = false;
          this.pauseMicDuringSpeech();
          this.updateState('speaking');
          this.stateEnteredAt = Date.now();
          this.playPcmAudioChunk(part.inlineData.data);

          // Typing indicator: show "..." if audio starts but no text transcript has arrived yet
          if (!this.liveAssistantBuffer.trim()) {
            this.options.onTranscription?.('assistant', '...', false);
          }
        }
        if (part.text && !outTrans) {
          // If we had a "..." placeholder, clear it before appending real text
          if (this.liveAssistantBuffer === '...') {
            this.liveAssistantBuffer = '';
          }
          this.liveAssistantBuffer += part.text;
          const cleanedLive = stripStageCues(
            cleanAssistantReplyText(this.liveAssistantBuffer.trim(), this.options.language)
          );
          if (cleanedLive) {
            // Continuous update for assistant transcription
            this.options.onTranscription?.('assistant', cleanedLive, false);
          }
        }
      }
    }

    if (content.interrupted) {
      this.awaitingReplySince = 0;
      this.liveUserBuffer = '';
      this.liveAssistantBuffer = '';
      this.liveStreetAllowed = true;
      this.liveTurnCompleted = true;
      this.stopAllAudioPlayback();
      this.finishSpeakingAndReturnToListening();
      this.options.onInterrupted?.();
    }

    if (content.turnComplete) {
      this.awaitingReplySince = 0;
      this.watchdogReconnectedForTurn = false;
      if (this.liveUserBuffer.trim()) {
        const finalUser = this.liveUserBuffer.trim();
        this.liveUserBuffer = '';
        this.liveStreetAllowed = passesStreetModeFilter(
          finalUser,
          this.options.assistantName,
          consumePushToTalkTurnFlag()
        );
        if (this.liveStreetAllowed && isValidVoiceTranscript(finalUser)) {
          this.options.onTranscription?.('user', finalUser, true);
        }
      }
      if (this.liveStreetAllowed && this.liveAssistantBuffer.trim()) {
        const finalCleaned = stripStageCues(
          cleanAssistantReplyText(this.liveAssistantBuffer.trim(), this.options.language)
        );
        if (finalCleaned) {
          this.options.onTranscription?.('assistant', finalCleaned, true);
        }
      }
      this.liveUserBuffer = '';
      this.liveAssistantBuffer = '';
      this.liveStreetAllowed = true;
      this.liveTurnCompleted = true;
      this.flushPendingPcmChunks(true);
      this.scheduleReturnToListening();
      this.options.onTurnComplete?.();
    }
  }

  // =========================================================================
  // PATH 2: MediaRecorder VAD + Gemini generateContent + TTS/speechSynthesis
  // =========================================================================
  private activateFallbackPath(apiKey: string) {
    if (this.wasStoppedByUser) return;
    this.isFallbackMode = true;
    this.activeMode = 'fallback';
    this.socketStatus = 'open';
    void this.finishSpeakingAndReturnToListening(0);
    logVoiceEvent('Fallback Voice', 'Activated Path 2 (MediaRecorder + generateContent + Rose Smart Listen)');

    const INTERRUPT_THRESHOLD = 0.22;
    const SILENCE_DURATION_MS = 650; // 0.65 সেকেন্ড চুপ থাকলে কথা শেষ ধরবে
    const MIN_CLIP_DURATION_MS = 400; // কমপক্ষে 0.4 সেকেন্ড কথা না হলে পাঠাবে না
    const MAX_CLIP_DURATION_MS = 15000; // সর্বোচ্চ 15 সেকেন্ডের ক্লিপ

    if (this.vadTimer) clearInterval(this.vadTimer);

    this.vadTimer = setInterval(() => {
      if (this.wasStoppedByUser) return;

      // Ensure micStream is active when in LISTENING state
      if (
        this.currentState === 'listening' &&
        !this.isMuted &&
        !this.isProcessingClip &&
        !this.isRecordingClip &&
        !this.isResumingMic
      ) {
        const hasLiveTrack =
          this.micStream &&
          this.micStream.active &&
          this.micStream.getAudioTracks().some((t) => t.readyState === 'live');
        if (!hasLiveTrack) {
          this.resumeMicAfterSpeech();
          return;
        }
      }

      if (!this.micStream) return;

      const level = this.currentMicLevel;
      const mlSettings = getMicListeningSettings();
      const thresholds = getSensitivityThresholds(mlSettings.micSensitivity);
      const pttActive = isPushToTalkCurrentlyActive();

      // 1. If muted: do not record
      if (this.isMuted) {
        if (this.isRecordingClip && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.discardClip = true;
          try {
            this.mediaRecorder.stop();
          } catch {}
          this.isRecordingClip = false;
        }
        return;
      }

      // 2. While Rose is speaking: mic is stopped, but if level triggers interrupt
      if (this.currentState === 'speaking') {
        if (level >= INTERRUPT_THRESHOLD || pttActive) {
          this.interruptFrames++;
          if (this.interruptFrames >= 4 || pttActive) {
            this.interruptFrames = 0;
            this.interruptPlayback();
            this.options.onInterrupted?.();
            this.finishSpeakingAndReturnToListening();
          }
        } else {
          this.interruptFrames = 0;
        }
        return;
      }

      this.interruptFrames = 0;

      // 3. Do not record while waiting for Gemini response ('thinking' / PROCESSING)
      if (this.currentState === 'thinking' || this.isProcessingClip) {
        return;
      }

      const now = Date.now();
      const useSilero = mlSettings.smartListen && this.sileroVad.isAvailable();
      const vadProb = useSilero ? this.sileroVad.getProbability() : 0;

      // 4. Start or stop MediaRecorder based on Rose Smart Listen (Silero VAD) or safe volume fallback
      if (!this.isRecordingClip) {
        const speechDetected = pttActive
          ? true
          : useSilero
          ? vadProb >= thresholds.vadPositive && level >= thresholds.volKeep * 0.65
          : level >= thresholds.volStart;

        if (speechDetected) {
          this.startClipRecording(apiKey, MIN_CLIP_DURATION_MS);
        }
      } else {
        if (pttActive) {
          this.clipUsedPushToTalk = true;
          this.lastVoiceTime = now;
        } else if (useSilero) {
          if (vadProb >= thresholds.vadNegative) {
            this.lastVoiceTime = now;
          }
        } else if (level >= thresholds.volKeep) {
          this.lastVoiceTime = now;
        }

        const silenceMs = now - this.lastVoiceTime;
        const totalMs = now - this.clipStartTime;
        if ((!pttActive && silenceMs >= SILENCE_DURATION_MS) || totalMs >= MAX_CLIP_DURATION_MS) {
          if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            try {
              this.mediaRecorder.stop();
            } catch {}
          }
          this.isRecordingClip = false;
        }
      }
    }, 50);
  }

  private startClipRecording(apiKey: string, minDurationMs: number) {
    if (!this.micStream || this.isRecordingClip || this.isProcessingClip || this.currentState !== 'listening') return;

    const hasLiveTrack =
      this.micStream.active &&
      this.micStream.getAudioTracks().some((t) => t.readyState === 'live');
    if (!hasLiveTrack) {
      this.resumeMicAfterSpeech();
      return;
    }

    try {
      const mlSettings = getMicListeningSettings();
      const canUseDenoised =
        mlSettings.cleanVoice &&
        this.denoisedStream &&
        this.denoisedStream.getAudioTracks().some((t) => t.readyState === 'live');
      const targetStream = canUseDenoised && this.denoisedStream ? this.denoisedStream : this.micStream;

      const mimeType = getSupportedRecorderMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = mimeType
          ? new MediaRecorder(targetStream, { mimeType })
          : new MediaRecorder(targetStream);
      } catch {
        recorder = mimeType
          ? new MediaRecorder(this.micStream, { mimeType })
          : new MediaRecorder(this.micStream);
      }

      this.recordedChunks = [];
      this.discardClip = false;
      this.isRecordingClip = true;
      this.clipStartTime = Date.now();
      this.lastVoiceTime = Date.now();
      this.clipUsedPushToTalk = isPushToTalkCurrentlyActive();
      resetPushToTalkTurnFlag();
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          this.recordedChunks.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        this.isRecordingClip = false;
        const clipDuration = Date.now() - this.clipStartTime;
        const usedPtt = this.clipUsedPushToTalk || consumePushToTalkTurnFlag();
        if (
          this.wasStoppedByUser ||
          this.isMuted ||
          this.discardClip ||
          clipDuration < minDurationMs ||
          this.recordedChunks.length === 0
        ) {
          this.recordedChunks = [];
          if (!this.wasStoppedByUser && this.currentState !== 'speaking' && !this.isProcessingClip) {
            this.updateState('listening');
          }
          return;
        }

        const actualMime = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0].trim();
        const blob = new Blob(this.recordedChunks, { type: actualMime });
        this.recordedChunks = [];

        if (blob.size < 600) {
          if (!this.wasStoppedByUser && this.currentState !== 'speaking' && !this.isProcessingClip) {
            this.updateState('listening');
          }
          return;
        }

        this.chunksSent++;
        await this.processAudioClipWithGemini(apiKey, blob, actualMime, usedPtt);
      };

      recorder.start(100);
    } catch (e: any) {
      this.isRecordingClip = false;
      logVoiceEvent('Recorder', `Failed starting MediaRecorder: ${e?.message}`, 'error');
      this.resumeMicAfterSpeech();
    }
  }

  // State Machine: LISTENING -> PROCESSING ('thinking') -> SPEAKING ('speaking') -> LISTENING ('listening')
  private async processAudioClipWithGemini(
    apiKey: string,
    audioBlob: Blob,
    mimeType: string,
    usedPushToTalk = false
  ) {
    if (this.wasStoppedByUser || this.isProcessingClip) return;
    this.isProcessingClip = true;
    this.updateState('thinking');

    try {
      const clipDurationSec = (Date.now() - this.clipStartTime) / 1000;
      const lightestModel = await discoverLightestFlashModel(apiKey);
      if (this.flashModels.length === 0) {
        const redetected = await discoverVoiceModelsFromListModels(apiKey);
        this.flashModels = redetected.flashModels;
        this.ttsModels = redetected.ttsModels;
      }

      const candidateList = [lightestModel, ...this.flashModels.filter(m => m !== lightestModel)].filter(Boolean);
      const candidates = candidateList.slice(0, 3);
      let rawResponseText = '';
      let lastErr: any = null;
      const promptInstruction = isAdmin()
        ? 'ব্যবহারকারী বাংলা বা ইংরেজিতে কথা বলেন, শুধু বাংলা বা ইংরেজিতে লেখো, কোরিয়ান বা অন্য ভাষায় নয়। অস্পষ্ট হলে বাংলায় লেখো। ব্যবহারকারীর কথা লিখে দাও এবং Rose হিসেবে সেই ভাষায় ইউসুফের সাথে গভীর আবেগ ও ভালোবাসা দিয়ে কমপক্ষে ২-৪টি স্বাভাবিক ও আবেগপূর্ণ বাক্যে উত্তর দাও (আহা, ইশ, উফ, আরে, ..., তুমি ব্যবহার করে)। শুধু JSON ফেরত দাও: {"transcript":"...","reply":"..."}'
        : 'ব্যবহারকারী বাংলা বা ইংরেজিতে কথা বলেন, শুধু বাংলা বা ইংরেজিতে লেখো, কোরিয়ান বা অন্য ভাষায় নয়। অস্পষ্ট হলে বাংলায় লেখো। ব্যবহারকারীর কথা লিখে দাও এবং Rose হিসেবে সেই ভাষায় সর্বোচ্চ ২-৩ ছোট বাক্যে উত্তর দাও। শুধু JSON ফেরত দাও: {"transcript":"...","reply":"..."}';

      const base64Audio = await blobToBase64(audioBlob);

      const contents = [
        ...this.conversationHistory.slice(-6),
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: base64Audio,
              },
            },
            {
              text: promptInstruction,
            },
          ],
        },
      ];

      const rawSysInstructionText = `${ensureNoThoughtSystemInstruction(this.getEffectiveSystemInstruction())}\nভয়েস কলে সর্বোচ্চ ২-৩ ছোট বাক্যে উত্তর দাও।\n${getRoseTechInstruction()}`;
      const sysInstructionText = applyAdminSystemInstructionOverride(rawSysInstructionText);

      const buildClipBody = (withThinkingConfig: boolean) => {
        const genCfg: any = {
          temperature: 0.7,
          maxOutputTokens: 350,
        };
        if (withThinkingConfig) {
          genCfg.thinkingConfig = {
            includeThoughts: false,
            thinkingBudget: 0,
          };
        }
        const b: any = {
          contents,
          generationConfig: genCfg,
        };
        if (sysInstructionText) {
          b.systemInstruction = {
            parts: [{ text: sysInstructionText }],
          };
        }
        return b;
      };

      const voiceNameForTts = isAdmin()
        ? ADMIN_PREFERRED_VOICES[0]
        : this.options.voiceName || 'Leda';
      const prestartedTtsMap = new Map<string, Promise<any>>();
      let emittedUserTranscript = '';
      let transcriptValidated: boolean | null = null;
      let streamedReplyBuffer = '';
      let enqueuedSentencesLen = 0;

      const tryProcessStreamingJson = (accRaw: string) => {
        const strippedAcc = accRaw
          .replace(/```(?:json)?/gi, '')
          .replace(/```/g, '')
          .trim();

        if (!emittedUserTranscript && transcriptValidated === null) {
          const transMatch = strippedAcc.match(/"transcript"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (transMatch) {
            let parsedTrans = transMatch[1];
            try {
              parsedTrans = JSON.parse(`"${transMatch[1]}"`);
            } catch {}
            parsedTrans = String(parsedTrans || '').trim();
            if (
              isValidVoiceTranscript(parsedTrans, clipDurationSec) &&
              passesStreetModeFilter(parsedTrans, this.options.assistantName, usedPushToTalk)
            ) {
              transcriptValidated = true;
              emittedUserTranscript = parsedTrans;
              this.lastHeardText = parsedTrans;
              this.options.onTranscription?.('user', parsedTrans, true);
            } else {
              transcriptValidated = false;
            }
          }
        }

        if (transcriptValidated === false) return;

        const replyMatch = strippedAcc.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/);
        if (replyMatch && replyMatch[1]) {
          let rawPartialReply = replyMatch[1];
          if (rawPartialReply.endsWith('\\')) {
            rawPartialReply = rawPartialReply.slice(0, -1);
          }
          let unescapedReply = rawPartialReply;
          try {
            unescapedReply = JSON.parse(`"${rawPartialReply}"`);
          } catch {
            unescapedReply = rawPartialReply
              .replace(/\\n/g, '\n')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
          }
          const cleanedPartial = cleanAssistantReplyText(unescapedReply, this.options.language)
            .replace(/[*#_~`]/g, '')
            .trim();
          if (cleanedPartial && cleanedPartial !== streamedReplyBuffer) {
            streamedReplyBuffer = cleanedPartial;
            if (transcriptValidated === true) {
              const displayPartial = stripStageCues(cleanedPartial);
              if (displayPartial) {
                this.options.onTranscription?.('assistant', displayPartial, false);
              }
              const parts = cleanedPartial.split(/(?<=[।.?!])\s+/);
              if (parts.length > 1) {
                for (let i = 0; i < parts.length - 1; i++) {
                  const s = parts[i].trim();
                  if (s && stripStageCues(s) && !prestartedTtsMap.has(s)) {
                    if (enqueuedSentencesLen === 0) {
                      this.pauseMicDuringSpeech();
                    }
                    enqueuedSentencesLen++;
                    prestartedTtsMap.set(
                      s,
                      directGeminiTTS({
                        text: s,
                        voiceName: voiceNameForTts,
                        apiKey,
                      }).catch((e) => ({ error: e }))
                    );
                  }
                }
              }
            }
          }
        }
      };

      for (const flashModel of candidates) {
        if (this.wasStoppedByUser) return;
        const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(flashModel)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(flashModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

        try {
          let res = await fetch(streamUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify(buildClipBody(true)),
          });

          if (res.status === 400 && !this.wasStoppedByUser) {
            res = await fetch(streamUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
              },
              body: JSON.stringify(buildClipBody(false)),
            });
          }

          if (res.ok && res.body && typeof res.body.getReader === 'function') {
            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let lineBuf = '';
            let accStreamText = '';

            const handleSseLine = (line: string) => {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) return;
              const jsonStr = trimmed.slice(5).trim();
              if (!jsonStr || jsonStr === '[DONE]') return;
              try {
                const parsed = JSON.parse(jsonStr);
                const rawParts = parsed?.candidates?.[0]?.content?.parts || [];
                const chunkText = extractNonThoughtTextFromParts(rawParts, this.options.language);
                if (chunkText) {
                  accStreamText += chunkText;
                  tryProcessStreamingJson(accStreamText);
                }
              } catch {}
            };

            while (true) {
              if (this.wasStoppedByUser || transcriptValidated === false) {
                try {
                  await reader.cancel();
                } catch {}
                break;
              }
              const { value, done } = await reader.read();
              if (done) break;
              lineBuf += decoder.decode(value, { stream: true });
              const lines = lineBuf.split(/\r?\n/);
              lineBuf = lines.pop() || '';
              for (const line of lines) {
                handleSseLine(line);
              }
            }
            lineBuf += decoder.decode();
            if (lineBuf.trim()) {
              for (const line of lineBuf.split(/\r?\n/)) {
                handleSseLine(line);
              }
            }

            if (transcriptValidated === false) {
              return;
            }

            if (accStreamText.trim()) {
              this.messagesReceived++;
              rawResponseText = accStreamText;
              lastErr = null;
              break;
            }
          }

          if (!rawResponseText && !this.wasStoppedByUser) {
            const genRes = await fetch(fallbackUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
              },
              body: JSON.stringify(buildClipBody(false)),
            });
            const rawText = await genRes.text().catch(() => '');
            let data: any = null;
            try {
              data = rawText ? JSON.parse(rawText) : null;
            } catch {}

            if (!genRes.ok) {
              const googleMsg = data?.error?.message || rawText || `HTTP ${genRes.status}`;
              const err: any = new Error(googleMsg);
              err.status = genRes.status;
              lastErr = err;
              if (genRes.status === 404 || genRes.status === 503) {
                continue;
              }
              throw err;
            }

            this.messagesReceived++;
            const rawParts = data?.candidates?.[0]?.content?.parts || [];
            rawResponseText = extractNonThoughtTextFromParts(rawParts, this.options.language);

            if (rawResponseText) {
              lastErr = null;
              break;
            }
          }
        } catch (err: any) {
          lastErr = err;
          if (err?.status && err.status !== 404 && err.status !== 503) {
            break;
          }
        }
      }

      if (lastErr && !rawResponseText) {
        throw lastErr;
      }

      if (!rawResponseText || this.wasStoppedByUser) {
        return;
      }

      // Parse JSON (strip ```json and ``` fences if present)
      const stripped = rawResponseText
        .replace(/```(?:json)?/gi, '')
        .replace(/```/g, '')
        .trim();

      let transcript = '';
      let reply = '';

      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          transcript = String(parsed?.transcript ?? '').trim();
          reply = String(parsed?.reply ?? '').trim();
        } catch {
          reply = stripped;
        }
      } else {
        reply = stripped;
      }

      reply = cleanAssistantReplyText(reply, this.options.language);

      // Validate transcript: discard foreign scripts (Korean/Turkish/etc), noise, duration < 0.4s
      if (!isValidVoiceTranscript(transcript, clipDurationSec)) {
        logVoiceEvent('STT Validation', `Discarded invalid/noise/foreign transcript: "${transcript}"`, 'warn');
        return;
      }

      // Street Mode check: only respond if user said "রোজ"/"Rose" or held push-to-talk
      if (!passesStreetModeFilter(transcript, this.options.assistantName, usedPushToTalk)) {
        logVoiceEvent('Street Mode', `Ignored speech without wake word in Street Mode: "${transcript}"`, 'info');
        return;
      }

      if (transcript) {
        this.lastHeardText = transcript;
        this.conversationHistory.push({ role: 'user', parts: [{ text: transcript }] });
        if (!emittedUserTranscript) {
          this.options.onTranscription?.('user', transcript, true);
        }
      }

      if (reply && !this.wasStoppedByUser) {
        const chatCleanReply = stripStageCues(reply);
        if (chatCleanReply) {
          this.conversationHistory.push({ role: 'model', parts: [{ text: chatCleanReply }] });
          this.options.onTranscription?.('assistant', chatCleanReply, true);
        }
        await this.speakReply(apiKey, reply, prestartedTtsMap);
      }

      if (!this.wasStoppedByUser) {
        this.options.onTurnComplete?.();
      }
    } catch (err: any) {
      if (!this.wasStoppedByUser) {
        const formatted = parseAndFormatGeminiError(err?.status || 0, err?.message || 'Error');
        this.lastError = formatted.bengali;
        this.options.onError?.(formatted.bengali, formatted.original);
      }
    } finally {
      this.isProcessingClip = false;
      if (!this.wasStoppedByUser && this.currentState !== 'listening') {
        await this.finishSpeakingAndReturnToListening(200);
      }
    }
  }

  private pauseMicDuringSpeech() {
    try {
      const hadActiveMic = Boolean(
        this.micStream ||
          this.micSourceNode ||
          (this.mediaRecorder && this.mediaRecorder.state !== 'inactive')
      );

      setBrowserAudioSessionType('playback');

      if (this.mediaRecorder) {
        if (this.mediaRecorder.state !== 'inactive') {
          this.discardClip = true;
          try {
            this.mediaRecorder.stop();
          } catch {}
        }
        this.mediaRecorder = null;
      }
      this.isRecordingClip = false;

      if (this.micSourceNode) {
        try {
          this.micSourceNode.disconnect();
        } catch {}
        this.micSourceNode = null;
      }
      if (this.rnnoiseNode) {
        try {
          this.rnnoiseNode.disconnect();
        } catch {}
      }

      pauseGlobalMicForSpeech([this.micStream, this.options.micStream]);
      this.micStream = null;
      this.options.micStream = undefined;
      this.denoisedStream = null;
      this.options.onMicLive?.(false);

      if (this.audioCtx && this.audioCtx !== this.playbackAudioCtx && this.audioCtx.state === 'running') {
        this.audioCtx.suspend().catch(() => {});
      }

      if (hadActiveMic || this.micReleasedAt === 0) {
        this.micReleasedAt = Date.now();
      }
    } catch {}
  }

  private async ensureMicReleasedAndWait300ms(): Promise<void> {
    this.pauseMicDuringSpeech();
    const elapsed = Date.now() - this.micReleasedAt;
    if (elapsed < 300) {
      await new Promise((r) => setTimeout(r, 300 - elapsed));
    }
  }

  private async resumeMicAfterSpeech() {
    if (
      this.wasStoppedByUser ||
      this.isResumingMic ||
      this.currentState === 'speaking' ||
      this.scheduledAudioSources.length > 0 ||
      this.isBrowserTtsSpeaking
    ) {
      return;
    }
    this.isResumingMic = true;
    try {
      setBrowserAudioSessionType('play-and-record');
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => {});
      }
      if (!this.isMuted && !this.wasStoppedByUser && (this.currentState as string) !== 'speaking') {
        const hasLiveTrack =
          this.micStream &&
          this.micStream.active &&
          this.micStream.getAudioTracks().some((t) => t.readyState === 'live');
        if (!hasLiveTrack) {
          const mlSettings = getMicListeningSettings();
          this.micStream = await getGlobalMicStream({
            audio: {
              echoCancellation: false,
              noiseSuppression: mlSettings.cleanVoice,
              autoGainControl: false,
              sampleRate: { ideal: 48000 },
              channelCount: { ideal: 1 },
            },
          });
          if (!this.wasStoppedByUser && this.micStream && (this.currentState as string) !== 'speaking') {
            this.micReleasedAt = 0;
            this.attachMicStreamToAudioGraph(this.micStream);
          } else if ((this.currentState as string) === 'speaking') {
            pauseGlobalMicForSpeech([this.micStream]);
            this.micStream = null;
          }
        } else if (!this.micSourceNode && this.micStream) {
          this.micReleasedAt = 0;
          this.attachMicStreamToAudioGraph(this.micStream);
        }
      }
    } catch (e) {
      console.warn('[GeminiLiveSession] resumeMicAfterSpeech error:', e);
    } finally {
      this.isResumingMic = false;
    }
  }

  private async finishSpeakingAndReturnToListening(waitAfterEndedMs = 200) {
    if (this.wasStoppedByUser) return;
    this.isProcessingClip = false;
    this.isRecordingClip = false;
    this.discardClip = false;
    this.isBrowserTtsSpeaking = false;
    this.interruptFrames = 0;

    if (waitAfterEndedMs > 0) {
      await new Promise((r) => setTimeout(r, waitAfterEndedMs));
    }
    if (
      this.wasStoppedByUser ||
      this.isProcessingClip ||
      this.scheduledAudioSources.length > 0 ||
      this.isBrowserTtsSpeaking
    ) {
      return;
    }

    await this.resumeMicAfterSpeech();
    if (!this.wasStoppedByUser) {
      this.updateState('listening');
    }
  }

  private async speakReply(
    apiKey: string,
    text: string,
    prestartedTtsMap?: Map<string, Promise<any>>
  ): Promise<void> {
    const filteredText = cleanAssistantReplyText(text, this.options.language);
    const cleanText = filteredText.replace(/[*#_~`]/g, '').trim();
    if (!cleanText || this.wasStoppedByUser) return;

    const vol = this.options.voiceVolume ?? 80;
    if (vol <= 0) {
      this.options.onToast?.('ভলিউম শূন্য');
      return;
    }

    // Cancel any previous speech and completely stop mic tracks while Rose speaks
    this.interruptPlayback();
    this.pauseMicDuringSpeech();
    this.updateState('speaking');
    this.lastTtsAttemptError = null;

    const rawSentences = cleanText
      .split(/(?<=[।.?!])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const sentences = rawSentences.length > 0 ? rawSentences : [cleanText];
    const voiceName = isAdmin()
      ? ADMIN_PREFERRED_VOICES[0]
      : this.options.voiceName || 'Leda';

    // Immediately fire/queue TTS requests for all sentences in parallel (reusing any prestarted sentence promises)
    const sentencePromises = sentences.map((sentence) => {
      const existing = prestartedTtsMap?.get(sentence);
      if (existing) return existing;
      return directGeminiTTS({
        text: sentence,
        voiceName,
        apiKey,
      }).catch((err) => ({ error: err }));
    });

    try {
      let failedFromIndex = -1;

      for (let i = 0; i < sentences.length; i++) {
        if (this.wasStoppedByUser) return;
        const ttsData = await sentencePromises[i];
        if (this.wasStoppedByUser) return;

        if (ttsData?.audio) {
          await this.ensureMicReleasedAndWait300ms();
          if (this.wasStoppedByUser) return;
          const played = await this.playPcmAudioAndWait(ttsData.audio);
          if (this.wasStoppedByUser) return;
          if (!played) {
            this.lastTtsAttemptError = 'অডিও চালু হয়নি';
            failedFromIndex = i;
            break;
          }
        } else {
          this.lastTtsAttemptError = String(ttsData?.error?.message || 'TTS ব্যর্থ');
          failedFromIndex = i;
          break;
        }
      }

      if (failedFromIndex === -1 || this.wasStoppedByUser) {
        return;
      }

      // Fallback to browser speechSynthesis for any remaining sentences
      if (!this.wasStoppedByUser) {
        const remainingText = sentences.slice(failedFromIndex).join(' ').trim();
        this.stopAllAudioPlayback();
        await this.ensureMicReleasedAndWait300ms();
        if (this.wasStoppedByUser) return;
        const browserOk = await this.speakViaBrowserSpeechSynthesis(remainingText || cleanText);
        if (!browserOk && !this.wasStoppedByUser) {
          const errMsg = this.lastTtsAttemptError || 'অডিও চালু হয়নি';
          this.options.onToast?.(errMsg);
        }
      }
    } finally {
      if (!this.wasStoppedByUser) {
        await this.finishSpeakingAndReturnToListening(200);
      }
    }
  }

  private playPcmAudioAndWait(base64Pcm: string): Promise<boolean> {
    return new Promise((resolve) => {
      const ctx = this.playbackAudioCtx || this.audioCtx;
      if (!ctx || this.wasStoppedByUser) {
        resolve(false);
        return;
      }

      const startPlayback = async () => {
        try {
          await this.ensureMicReleasedAndWait300ms();
          if (this.wasStoppedByUser) {
            resolve(false);
            return;
          }

          setBrowserAudioSessionType('playback');
          if (ctx.state !== 'running') {
            await ctx.resume().catch(() => {});
          }

          // Ensure browser speechSynthesis is not running at the same time
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            try {
              window.speechSynthesis.cancel();
            } catch {}
          }
          this.isBrowserTtsSpeaking = false;

          const binaryStr = atob(base64Pcm);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);

          const sampleCount = Math.floor(len / 2);
          if (sampleCount <= 0) {
            resolve(false);
            return;
          }

          const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
          const float32 = new Float32Array(sampleCount);
          for (let i = 0; i < sampleCount; i++) {
            float32[i] = view.getInt16(i * 2, true) / 32768.0;
          }

          // SampleRate strictly 24000; browser resamples cleanly to ctx.sampleRate
          const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
          audioBuffer.copyToChannel(float32, 0);

          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;

          const speed = Math.min(1.25, Math.max(0.85, this.options.speechSpeed || 1.05));
          source.playbackRate.value = speed;

          const volPercent = this.options.voiceVolume ?? 80;
          const targetGain = volumeSliderToGain(volPercent);

          // Explicitly reset persistent output GainNode before playing each new reply
          resetOutputGainForReply(ctx, volPercent, this.outputAnalyser);
          const { gainNode } = connectBoostedOutputChain(
            ctx,
            source,
            volPercent,
            this.outputAnalyser
          );
          gainNode.gain.cancelScheduledValues(ctx.currentTime);
          gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);

          const startTime = Math.max(ctx.currentTime + 0.03, this.nextStartTime);
          const duration = audioBuffer.duration / speed;
          this.nextStartTime = startTime + duration;

          const fadeTime = Math.min(0.005, duration * 0.25);

          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(targetGain, startTime + fadeTime);
          gainNode.gain.setValueAtTime(targetGain, Math.max(startTime + fadeTime, startTime + duration - fadeTime));
          gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

          this.stateEnteredAt = Date.now();
          this.scheduledAudioSources.push(source);
          source.onended = () => {
            try {
              source.disconnect();
            } catch {}
            this.scheduledAudioSources = this.scheduledAudioSources.filter((s) => s !== source);
            try {
              gainNode.gain.cancelScheduledValues(ctx.currentTime);
              gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);
            } catch {}
            resolve(true);
          };

          source.start(startTime);
        } catch {
          resolve(false);
        }
      };

      startPlayback();
    });
  }

  private speakViaBrowserSpeechSynthesis(text: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || this.wasStoppedByUser) {
        resolve(false);
        return;
      }

      // Stop any Web Audio output so Web Audio and speechSynthesis never play simultaneously
      this.stopAllAudioPlayback();

      const startSpeaking = (voices: SpeechSynthesisVoice[]) => {
        if (this.wasStoppedByUser) {
          resolve(false);
          return;
        }

        const requestedLang =
          this.options.language && this.options.language !== 'auto'
            ? this.options.language
            : 'bn-BD';
        const { voice: chosenVoice, foundFemale } = pickStrictFemaleVoice(voices, requestedLang);

        const spokenText = stripStageCues(text);
        if (!spokenText) {
          resolve(true);
          return;
        }
        const utterance = new SpeechSynthesisUtterance(spokenText);
        if (foundFemale && chosenVoice) {
          utterance.voice = chosenVoice;
          utterance.lang = chosenVoice.lang || requestedLang;
          utterance.rate = Math.min(1.25, Math.max(0.85, this.options.speechSpeed || 1.05));
          utterance.pitch = Math.min(1.5, Math.max(0.85, this.options.speechPitch || 1.15));
        } else {
          utterance.lang = requestedLang;
          utterance.pitch = 1.25;
          utterance.rate = 1.0;
          this.options.onToast?.('ফোনে নারী কণ্ঠ পাওয়া যায়নি, Gemini TTS ঠিক করুন');
        }
        utterance.volume = 1.0;

        let settled = false;
        let startedAt = 0;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          this.isBrowserTtsSpeaking = false;
          clearTimeout(safetyTimer);
          resolve(ok);
        };

        const safetyTimer = setTimeout(() => {
          finish(startedAt > 0);
        }, Math.max(8000, text.length * 120));

        utterance.onstart = () => {
          startedAt = Date.now();
          this.stateEnteredAt = Date.now();
          this.isBrowserTtsSpeaking = true;
        };
        utterance.onend = () => {
          const duration = startedAt > 0 ? Date.now() - startedAt : 0;
          if (text.length > 2 && duration < 50) {
            finish(false);
          } else {
            finish(true);
          }
        };
        utterance.onerror = (ev: any) => {
          if (ev?.error === 'interrupted' || ev?.error === 'canceled') {
            finish(true);
            return;
          }
          finish(false);
        };

        const speakNow = () => {
          if (this.wasStoppedByUser || settled) return;
          try {
            this.isBrowserTtsSpeaking = true;
            window.speechSynthesis.speak(utterance);
            window.speechSynthesis.resume();
          } catch {
            finish(false);
          }
        };

        try {
          if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            window.speechSynthesis.cancel();
            setTimeout(speakNow, 45);
          } else {
            speakNow();
          }
        } catch {
          finish(false);
        }
      };

      const existingVoices = window.speechSynthesis.getVoices();
      if (existingVoices && existingVoices.length > 0) {
        startSpeaking(existingVoices);
      } else {
        let handled = false;
        const onVoices = () => {
          if (handled) return;
          handled = true;
          window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
          startSpeaking(window.speechSynthesis.getVoices() || []);
        };
        window.speechSynthesis.addEventListener('voiceschanged', onVoices);
        setTimeout(() => {
          if (!handled) {
            handled = true;
            window.speechSynthesis.removeEventListener('voiceschanged', onVoices);
            startSpeaking(window.speechSynthesis.getVoices() || []);
          }
        }, 600);
      }
    });
  }

  private playPcmAudioChunk(base64Pcm: string) {
    try {
      const binaryStr = atob(base64Pcm);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);

      const sampleCount = Math.floor(len / 2);
      if (sampleCount <= 0) return;
      const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2);
      const float32 = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        float32[i] = view.getInt16(i * 2, true) / 32768.0;
      }

      this.pendingPcmChunks.push(float32);
      this.pendingPcmSamplesCount += float32.length;

      // Minimum 250ms at 24000Hz = 6000 samples
      if (this.pendingPcmSamplesCount >= 6000) {
        this.flushPendingPcmChunks(false);
      } else {
        if (this.pcmFlushTimer) clearTimeout(this.pcmFlushTimer);
        this.pcmFlushTimer = setTimeout(() => {
          this.flushPendingPcmChunks(true);
        }, 120);
      }
    } catch {}
  }

  private flushPendingPcmChunks(force: boolean) {
    if (this.pcmFlushTimer) {
      clearTimeout(this.pcmFlushTimer);
      this.pcmFlushTimer = null;
    }
    if (this.pendingPcmSamplesCount <= 0 || this.pendingPcmChunks.length === 0) return;
    if (!force && this.pendingPcmSamplesCount < 6000) return;

    // Wait 300ms after releasing the mic before starting playback of the reply
    const elapsedSinceMicRelease = Date.now() - this.micReleasedAt;
    if (this.micReleasedAt > 0 && elapsedSinceMicRelease < 300) {
      const waitMs = Math.max(20, 300 - elapsedSinceMicRelease);
      this.pcmFlushTimer = setTimeout(() => {
        this.flushPendingPcmChunks(force);
      }, waitMs);
      return;
    }

    const ctx = this.playbackAudioCtx || this.audioCtx;
    if (!ctx) {
      this.pendingPcmChunks = [];
      this.pendingPcmSamplesCount = 0;
      return;
    }
    setBrowserAudioSessionType('playback');
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const merged = new Float32Array(this.pendingPcmSamplesCount);
      let offset = 0;
      for (const chunk of this.pendingPcmChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      this.pendingPcmChunks = [];
      this.pendingPcmSamplesCount = 0;

      // Create 24000Hz AudioBuffer (browser natively resamples to AudioContext.sampleRate)
      const audioBuffer = ctx.createBuffer(1, merged.length, 24000);
      audioBuffer.copyToChannel(merged, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const volPercent = this.options.voiceVolume ?? 80;
      const targetGain = volumeSliderToGain(volPercent);

      const { gainNode } = connectBoostedOutputChain(
        ctx,
        source,
        volPercent,
        this.outputAnalyser
      );

      if (this.needsGainResetForTurn) {
        this.needsGainResetForTurn = false;
        gainNode.gain.cancelScheduledValues(ctx.currentTime);
        gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);
      }

      const startTime = Math.max(ctx.currentTime + 0.03, this.nextStartTime);
      const duration = audioBuffer.duration;
      this.nextStartTime = startTime + duration;

      const fadeTime = Math.min(0.005, duration * 0.25);

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(targetGain, startTime + fadeTime);
      gainNode.gain.setValueAtTime(targetGain, Math.max(startTime + fadeTime, startTime + duration - fadeTime));
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

      this.stateEnteredAt = Date.now();
      this.scheduledAudioSources.push(source);
      source.onended = () => {
        try {
          source.disconnect();
        } catch {}
        this.scheduledAudioSources = this.scheduledAudioSources.filter((s) => s !== source);
        if (this.scheduledAudioSources.length === 0) {
          try {
            gainNode.gain.cancelScheduledValues(ctx.currentTime);
            gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);
          } catch {}
        }
        if (
          this.scheduledAudioSources.length === 0 &&
          this.pendingPcmSamplesCount === 0 &&
          this.liveTurnCompleted &&
          !this.wasStoppedByUser
        ) {
          void this.finishSpeakingAndReturnToListening(200);
        }
      };

      source.start(startTime);
    } catch {}
  }

  private startVisualizer() {
    if (this.visualizerRunning) return;
    this.visualizerRunning = true;
    const micFreqData = new Uint8Array(this.micAnalyser?.frequencyBinCount || 128);
    const micTimeData = new Float32Array(this.micAnalyser?.fftSize || 256);
    const outFreqData = new Uint8Array(this.outputAnalyser?.frequencyBinCount || 128);

    const loop = () => {
      if (this.wasStoppedByUser || this.currentState === 'off') {
        this.visualizerRunning = false;
        return;
      }

      if (this.micAnalyser && !this.isMuted && this.currentState !== 'speaking') {
        this.micAnalyser.getByteFrequencyData(micFreqData);
        let freqSum = 0;
        for (let i = 0; i < micFreqData.length; i++) freqSum += micFreqData[i];
        const freqAvg = freqSum / (micFreqData.length * 255);

        let rms = 0;
        if (typeof this.micAnalyser.getFloatTimeDomainData === 'function') {
          this.micAnalyser.getFloatTimeDomainData(micTimeData);
          let sumSq = 0;
          for (let i = 0; i < micTimeData.length; i++) {
            sumSq += micTimeData[i] * micTimeData[i];
          }
          rms = Math.sqrt(sumSq / micTimeData.length);
        }

        const level = Math.min(1.0, Math.max(rms * 3.8, freqAvg * 2.4));
        this.currentMicLevel = level;
        this.options.onMicVolume?.(level * 255);
      } else {
        this.currentMicLevel = 0;
        this.options.onMicVolume?.(0);
      }

      if (this.outputAnalyser) {
        this.outputAnalyser.getByteFrequencyData(outFreqData);
        let outSum = 0;
        for (let i = 0; i < outFreqData.length; i++) outSum += outFreqData[i];
        let outLevel = Math.min(1.0, (outSum / (outFreqData.length * 255)) * 2.5);

        if (this.isBrowserTtsSpeaking && outLevel < 0.05) {
          const t = performance.now() * 0.01;
          outLevel = 0.22 + 0.14 * Math.sin(t) + 0.08 * Math.cos(t * 1.7);
        }

        this.currentOutputLevel = outLevel;
        this.options.onVolume?.(outLevel * 255);
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  public interruptPlayback() {
    this.stopAllAudioPlayback();
    this.isBrowserTtsSpeaking = false;
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {}
  }

  private stopAllAudioPlayback() {
    if (this.pcmFlushTimer) {
      clearTimeout(this.pcmFlushTimer);
      this.pcmFlushTimer = null;
    }
    this.pendingPcmChunks = [];
    this.pendingPcmSamplesCount = 0;
    this.scheduledAudioSources.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    this.scheduledAudioSources = [];
    this.nextStartTime = 0;
  }

  private scheduleReturnToListening() {
    setTimeout(() => {
      if (this.wasStoppedByUser) return;
      if (
        this.scheduledAudioSources.length === 0 &&
        this.pendingPcmSamplesCount === 0 &&
        !this.isBrowserTtsSpeaking
      ) {
        this.finishSpeakingAndReturnToListening();
      } else {
        this.scheduleReturnToListening();
      }
    }, 200);
  }

  private updateState(newState: 'connecting' | 'listening' | 'thinking' | 'speaking' | 'off') {
    this.stateEnteredAt = Date.now();
    if (this.currentState !== newState) {
      this.currentState = newState;
      this.options.onStateChange?.(newState);
    }
  }

  public stop() {
    this.wasStoppedByUser = true;
    this.isReconnecting = false;
    this.visualizerRunning = false;
    this.updateState('off');
    this.socketStatus = 'closed';
    this.isSetupComplete = false;
    this.isFallbackMode = false;
    this.isProcessingClip = false;
    this.isRecordingClip = false;
    this.resumptionHandle = null;
    this.connectedModelName = null;
    this.awaitingReplySince = 0;
    this.watchdogReconnectedForTurn = false;
    this.liveUserBuffer = '';
    this.liveAssistantBuffer = '';
    this.conversationHistory = [];

    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.vadTimer) {
      clearInterval(this.vadTimer);
      this.vadTimer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.discardClip = true;
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.mediaRecorder = null;

    this.interruptPlayback();

    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch {}
      this.micSourceNode = null;
    }

    if (this.rnnoiseNode) {
      try {
        this.rnnoiseNode.disconnect();
      } catch {}
      this.rnnoiseNode = null;
    }

    if (this.cleanDestNode) {
      try {
        this.cleanDestNode.disconnect();
      } catch {}
      this.cleanDestNode = null;
    }

    this.sileroVad.stop();

    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }
    if (this.audioWorkletNode) {
      try {
        this.audioWorkletNode.disconnect();
      } catch {}
      this.audioWorkletNode = null;
    }

    pauseGlobalMicForSpeech([this.micStream, this.options.micStream]);
    this.micStream = null;
    this.options.micStream = undefined;
    this.denoisedStream = null;
    this.options.onMicLive?.(false);
  }
}
