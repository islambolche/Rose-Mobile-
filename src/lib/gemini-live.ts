import { logVoiceEvent } from './voiceLogger';
import { getGeminiKey, ensureGeminiReady } from './geminiKey';
import {
  fetchGeminiModelsWithFallback,
  fetchGeminiStreamWithFallback,
  fetchGeminiGenerateWithFallback,
} from './geminiDirect';
import {
  discoverModels,
  recordLiveModelUsed,
  recordDiagnosticError,
  removeUnsupportedModel,
  getDiagnosticsState,
} from './modelDiscovery';

const StartSensitivity = { START_SENSITIVITY_HIGH: 'START_SENSITIVITY_HIGH' } as const;
const EndSensitivity = { END_SENSITIVITY_HIGH: 'END_SENSITIVITY_HIGH' } as const;
import {
  directGeminiTTS,
  pickStrictFemaleVoice,
  cleanAssistantReplyText,
  extractNonThoughtTextFromParts,
  ensureNoThoughtSystemInstruction,
  connectBoostedOutputChain,
  configureBoostedOutputRoute,
  getOrCreateBoostedOutputChain,
  resetOutputGainForReply,
  fadeOutAndStopSources,
  decodePcm16ChunkWithCarry,
  volumeSliderToGain,
  isValidVoiceTranscript,
  discoverLightestFlashModel,
  setLastUsedTtsModel,
} from './ai-service';
import { ensureLanguageFirstLineLock } from './roseConfig';
import {
  pauseGlobalMicForSpeech,
  resumeGlobalMicAfterSpeech,
  getGlobalMicStream,
  stopGlobalMicStream,
  setBrowserAudioSessionType,
} from './audio-manager';
import { logDevError } from './devLog';
import { NoiseGateEngine } from './noiseGate';
import type { MicVAD as MicVADType } from '@ricky0123/vad-web';
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
  SMART_VAD_CDN_CONFIG,
  getSmartListenVadOptions,
  updateSmartVadTelemetry,
  getRoseMicPlugin,
  updateNativeMicFilterStatus,
  decodeBase64Pcm16ToFloat32,
  NativeMicMode,
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
import { openPage, goBack, openNumber, currentPage } from './nav';
import { isAndroidApp, voiceDebugStore } from './voiceDebugStore';
import {
  executePhoneToolActionByName,
  routePhoneActionFromText,
  getSharedPhoneAndHistoryContextBlock,
} from './phone';
import { executePcTaskTool } from '../pc/pcTaskManager';
import { executeOfficeTaskTool } from './officeSync';

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
  onEndCall?: () => void;
  onTurnComplete?: () => void;
  onInterrupted?: () => void;
  onToast?: (message: string) => void;
  onReconnectStatus?: (status: 'reconnecting' | 'connected' | 'failed', message?: string) => void;
  audioContext?: AudioContext;
  playbackAudioContext?: AudioContext;
  micStream?: MediaStream;
  backgroundCallEnabled?: boolean;
  floatingCallEnabled?: boolean;
  warmUpOnly?: boolean;
  onWarmReadyChange?: (ready: boolean) => void;
  useNativeMic?: boolean;
}

export function parseAndFormatGeminiError(status: number | string, rawMsg: string): { bengali: string; original: string } {
  let code = Number(status) || 0;
  let cleanRaw = String(rawMsg || '').trim();

  if (cleanRaw.startsWith('{') || cleanRaw.includes('"error"')) {
    try {
      const jsonMatch = cleanRaw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const apiErr = parsed?.error || parsed;
        if (!code && Number(apiErr?.code) >= 100) {
          code = Number(apiErr.code);
        }
        if (typeof apiErr?.message === 'string' && apiErr.message.trim()) {
          cleanRaw = apiErr.message.trim();
        }
      }
    } catch {}
  }

  const httpMatch = cleanRaw.match(/\bHTTP\s+(\d{3})\b/i);
  if (!code && httpMatch) {
    code = parseInt(httpMatch[1], 10) || 0;
  }
  cleanRaw = cleanRaw.replace(/^HTTP\s+\d{3}\s*:\s*/i, '').trim().slice(0, 240);
  const lowerMsg = cleanRaw.toLowerCase();

  let bengali = cleanRaw || 'সমস্যা হয়েছে';
  if (
    lowerMsg.includes('gemini key সেভ করা নেই') ||
    lowerMsg.includes('gemini key নেই')
  ) {
    bengali = 'Gemini key সেভ করা নেই। Settings → CONNECTIONS-এ কী বসাও।';
  } else if (
    code === 429 ||
    lowerMsg.includes('429') ||
    lowerMsg.includes('quota') ||
    lowerMsg.includes('resource_exhausted') ||
    lowerMsg.includes('rate limit')
  ) {
    bengali = cleanRaw
      ? `আজকের ফ্রি সীমা শেষ। পরে চেষ্টা করো বা নতুন কী দাও। (HTTP 429: ${cleanRaw})`
      : 'আজকের ফ্রি সীমা শেষ। পরে চেষ্টা করো বা নতুন কী দাও। (HTTP 429)';
  } else if (
    code === 400 ||
    code === 401 ||
    code === 403 ||
    lowerMsg.includes('api key') ||
    lowerMsg.includes('invalid key') ||
    lowerMsg.includes('permission_denied') ||
    lowerMsg.includes('unauthenticated')
  ) {
    bengali = `HTTP ${code || 400}: ${cleanRaw || 'Invalid API key'}`;
  } else if (code > 0) {
    bengali = `HTTP ${code}: ${cleanRaw || 'Request failed'}`;
  } else if (lowerMsg.includes('fetch') || lowerMsg.includes('network') || lowerMsg.includes('failed to fetch')) {
    bengali = `Network Error: ${cleanRaw}`;
  }

  const original = code ? `HTTP ${code}: ${cleanRaw}` : cleanRaw;
  return { bengali, original };
}

function downsampleToPCM16(
  inputData: Float32Array,
  sourceRate: number,
  targetRate: number = 16000
): Uint8Array {
  const actualSourceRate = sourceRate > 0 ? sourceRate : 48000;
  if (actualSourceRate === targetRate) {
    const buffer = new ArrayBuffer(inputData.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      const int16 = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7FFF);
      view.setInt16(i * 2, int16, true); // little-endian
    }
    return new Uint8Array(buffer);
  }
  const ratio = actualSourceRate / targetRate;
  const newLength = Math.max(1, Math.round(inputData.length / ratio));
  const buffer = new ArrayBuffer(newLength * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < newLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(inputData.length, Math.ceil((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += inputData[j];
      count++;
    }
    const avg = count > 0 ? sum / count : (inputData[Math.min(start, inputData.length - 1)] || 0);
    const s = Math.max(-1, Math.min(1, avg));
    const int16 = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7FFF);
    view.setInt16(i * 2, int16, true); // little-endian
  }
  return new Uint8Array(buffer);
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

const VOICE_MODELS_CACHE_KEY = 'rose_voice_models_cache_v2';
const RESOLVED_LIVE_MODEL_KEY = 'rose_resolved_live_model';
const LIVE_RESUMPTION_HANDLE_KEY = 'rose_live_resumption_handle';
const VOICE_MODELS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let memoryCachedVoiceModels: (DiscoveredVoiceModels & { keyPrefix: string; timestamp: number }) | null = null;
let lastGlobalResumptionHandle: string | null = (() => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem(LIVE_RESUMPTION_HANDLE_KEY) || null;
    }
  } catch {}
  return null;
})();

function saveGlobalResumptionHandle(handle: string | null) {
  lastGlobalResumptionHandle = handle;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (handle) {
        sessionStorage.setItem(LIVE_RESUMPTION_HANDLE_KEY, handle);
      } else {
        sessionStorage.removeItem(LIVE_RESUMPTION_HANDLE_KEY);
      }
    }
  } catch {}
}

export function getCachedResolvedLiveModel(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return (localStorage.getItem(RESOLVED_LIVE_MODEL_KEY) || '').replace(/^models\//, '').trim();
    }
  } catch {}
  return '';
}

export function setCachedResolvedLiveModel(modelName: string) {
  const clean = String(modelName || '').replace(/^models\//, '').trim();
  if (!clean) return;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(RESOLVED_LIVE_MODEL_KEY, clean);
    }
  } catch {}
}

function readCachedVoiceModelsFromStorage(apiKey?: string): DiscoveredVoiceModels | null {
  const cleanKey = String(apiKey || '').replace(/[\r\n\t\s"']+/g, '').trim();
  const keyPrefix = cleanKey ? cleanKey.slice(0, 8) : 'server';
  const now = Date.now();

  if (
    memoryCachedVoiceModels &&
    memoryCachedVoiceModels.keyPrefix === keyPrefix &&
    now - memoryCachedVoiceModels.timestamp < VOICE_MODELS_CACHE_TTL_MS &&
    memoryCachedVoiceModels.liveModels.length > 0
  ) {
    const savedLive = getCachedResolvedLiveModel();
    const orderedLive = savedLive
      ? [savedLive, ...memoryCachedVoiceModels.liveModels.filter((m) => m !== savedLive)]
      : [...memoryCachedVoiceModels.liveModels];
    return {
      liveModels: orderedLive,
      flashModels: [...memoryCachedVoiceModels.flashModels],
      ttsModels: [...memoryCachedVoiceModels.ttsModels],
    };
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(VOICE_MODELS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          parsed.keyPrefix === keyPrefix &&
          typeof parsed.timestamp === 'number' &&
          now - parsed.timestamp < VOICE_MODELS_CACHE_TTL_MS &&
          Array.isArray(parsed.liveModels) &&
          parsed.liveModels.length > 0
        ) {
          const liveModels: string[] = parsed.liveModels;
          const flashModels: string[] = Array.isArray(parsed.flashModels) ? parsed.flashModels : [];
          const ttsModels: string[] = Array.isArray(parsed.ttsModels)
            ? parsed.ttsModels.filter((m: any) => String(m || '').toLowerCase().includes('tts'))
            : [];
          memoryCachedVoiceModels = {
            liveModels,
            flashModels,
            ttsModels,
            keyPrefix,
            timestamp: parsed.timestamp,
          };
          const savedLive = getCachedResolvedLiveModel();
          const orderedLive = savedLive
            ? [savedLive, ...liveModels.filter((m) => m !== savedLive)]
            : [...liveModels];
          return {
            liveModels: orderedLive,
            flashModels,
            ttsModels,
          };
        }
      }
    }
  } catch {}
  return null;
}

export async function discoverVoiceModelsFromListModels(
  apiKey: string,
  forceRefresh = false
): Promise<DiscoveredVoiceModels> {
  const cleanKey = String(apiKey || '').replace(/[\r\n\t\s"']+/g, '').trim();
  const discovered = await discoverModels(cleanKey, forceRefresh);

  const resolvedLiveList = discovered.liveModels;
  const flashCandidates = discovered.chatModels;
  const ttsCandidates = discovered.ttsModels;

  if (resolvedLiveList.length > 0 && !getCachedResolvedLiveModel()) {
    setCachedResolvedLiveModel(resolvedLiveList[0]);
  }
  if (ttsCandidates.length > 0) {
    setLastUsedTtsModel(ttsCandidates[0]);
  }

  const savedLive = getCachedResolvedLiveModel();
  const orderedLive = savedLive && resolvedLiveList.includes(savedLive)
    ? [savedLive, ...resolvedLiveList.filter((m) => m !== savedLive)]
    : resolvedLiveList;

  return {
    liveModels: orderedLive,
    flashModels: flashCandidates,
    ttsModels: ttsCandidates,
  };
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

let activeGlobalLiveSession: GeminiLiveSession | null = null;
let globalLiveSessionCounter = 0;
let globalReconnectLock = false;

export function getActiveLiveSession(): GeminiLiveSession | null {
  return activeGlobalLiveSession;
}

export function isLiveSessionActive(): boolean {
  const s = activeGlobalLiveSession;
  return Boolean(s && !s.isStopped() && s.isSessionRunning());
}

export function stopActiveGlobalLiveSession(): void {
  if (activeGlobalLiveSession) {
    try {
      activeGlobalLiveSession.stop();
    } catch {}
    activeGlobalLiveSession = null;
  }
}

export interface LiveVoiceCheckStatus {
  liveModelName: string;
  voiceName: string;
  systemPromptLength: number;
  lastError: string | null;
}

const VOICE_CHECK_STATUS_STORAGE_KEY = 'rose_voice_check_status_v1';

let latestLiveVoiceCheckStatus: LiveVoiceCheckStatus = {
  liveModelName: '',
  voiceName: '',
  systemPromptLength: 0,
  lastError: null,
};

function updateLiveVoiceCheckStatus(partial: Partial<LiveVoiceCheckStatus>) {
  latestLiveVoiceCheckStatus = {
    ...latestLiveVoiceCheckStatus,
    ...partial,
  };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(VOICE_CHECK_STATUS_STORAGE_KEY, JSON.stringify(latestLiveVoiceCheckStatus));
    }
  } catch {}
}

export function buildFullLiveSystemPrompt(baseInstruction?: string, language?: string): string {
  const STT_LANG_PROMPT =
    'The user speaks Bengali (sometimes English words). Always understand and transcribe as Bengali or English, never Arabic, Thai or other languages. ভয়েস কলে সর্বোচ্চ ২-৩ ছোট বাক্যে উত্তর দাও।';
  const base = (baseInstruction || '').trim() || 'তুমি রোজ। ব্যবহারকারীর ব্যক্তিগত সহকারী।';
  const sharedCtx = getSharedPhoneAndHistoryContextBlock();
  const withTeam = `${base}\n\n${TEAM_SYSTEM_INSTRUCTION}${sharedCtx ? `\n\n${sharedCtx}` : ''}`;
  const overridden = applyAdminSystemInstructionOverride(withTeam, { isLiveVoice: true });
  const rawLiveInst = `${ensureNoThoughtSystemInstruction(overridden)}\n\n${STT_LANG_PROMPT}\n\n${getRoseTechInstruction()}`;
  return ensureLanguageFirstLineLock(
    applyAdminSystemInstructionOverride(rawLiveInst, { isLiveVoice: true }),
    language
  );
}

export function getLiveVoiceCheckStatus(
  fallbackBaseInstruction?: string,
  fallbackLanguage?: string,
  fallbackVoiceName?: string
): LiveVoiceCheckStatus {
  let stored: Partial<LiveVoiceCheckStatus> = {};
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(VOICE_CHECK_STATUS_STORAGE_KEY);
      if (raw) {
        stored = JSON.parse(raw) || {};
      }
    }
  } catch {}

  const active = activeGlobalLiveSession;
  const diag = getDiagnosticsState();
  const resolvedModel =
    (active as any)?.connectedModelName ||
    diag.liveModelUsed ||
    latestLiveVoiceCheckStatus.liveModelName ||
    stored.liveModelName ||
    getCachedResolvedLiveModel() ||
    memoryCachedVoiceModels?.liveModels?.[0] ||
    'Auto (gemini-live)';

  const resolvedVoice =
    latestLiveVoiceCheckStatus.voiceName ||
    stored.voiceName ||
    fallbackVoiceName ||
    (isAdmin() ? ADMIN_PREFERRED_VOICES[0] : 'Leda');

  const computedPromptLen = buildFullLiveSystemPrompt(fallbackBaseInstruction, fallbackLanguage).length;
  const resolvedPromptLen =
    latestLiveVoiceCheckStatus.systemPromptLength > 0
      ? latestLiveVoiceCheckStatus.systemPromptLength
      : typeof stored.systemPromptLength === 'number' && stored.systemPromptLength > 0
        ? stored.systemPromptLength
        : computedPromptLen;

  const resolvedError =
    active?.lastError ??
    latestLiveVoiceCheckStatus.lastError ??
    stored.lastError ??
    voiceDebugStore.getSnapshot().lastError ??
    null;

  return {
    liveModelName: resolvedModel,
    voiceName: resolvedVoice,
    systemPromptLength: resolvedPromptLen,
    lastError: resolvedError,
  };
}

export class GeminiLiveSession {
  public sessionId: string = `live_${++globalLiveSessionCounter}_${Date.now()}`;
  private sessionLifecycleState: 'active' | 'closing' | 'closed' = 'active';
  private currentSocketSeq = 0;
  private activeSocketSeq = 0;
  private activeAudioRoute: 'direct' | 'background' = 'direct';
  private isRoseTurnActive = false;
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
  
  private audioElement: HTMLAudioElement | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private visChangeHandler: (() => void) | null = null;

  // Watchdog & Reconnect timers / state
  private watchdogTimer: any = null;
  private reconnectTimer: any = null;
  private isReconnecting = false;
  private resumptionHandle: string | null = lastGlobalResumptionHandle;
  private connectedModelName: string | null = null;
  private connectedAt = 0;
  private awaitingReplySince = 0;
  private watchdogReconnectedForTurn = false;
  private visualizerRunning = false;

  // ~150ms PCM Jitter Buffer (24000Hz * 0.15s = 3600 samples) + odd leftover byte carry
  private pendingPcmChunks: Float32Array[] = [];
  private pendingPcmSamplesCount = 0;
  private pcmFlushTimer: any = null;
  private liveTurnCompleted = false;
  private leftoverPcmByte: number | null = null;
  private isReplyFirstChunk = true;
  private lastPcmChunkKey = '';
  private pendingMicPcmBase64Queue: Array<{ base64: string; rms: number; chunkMs: number }> = [];

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
  private userStartedSpeakingEmitted = false;
  private skipGrounding = false;

  private flushBufferedInitialMicChunks() {
    if (
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      !this.isSetupComplete ||
      this.wasStoppedByUser ||
      this.isFallbackMode ||
      this.isWarmOnly
    ) {
      return;
    }
    if (this.pendingMicPcmBase64Queue.length === 0) return;
    const queued = this.pendingMicPcmBase64Queue.splice(0, this.pendingMicPcmBase64Queue.length);
    for (const item of queued) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.wasStoppedByUser) break;
      try {
        this.ws.send(
          JSON.stringify({
            realtimeInput: {
              audio: { data: item.base64, mimeType: 'audio/pcm;rate=16000' },
            },
          })
        );
        this.chunksSent++;
        voiceDebugStore.recordChunkSent(item.rms, item.chunkMs);
      } catch {}
    }
  }

  // Smart Listening (@ricky0123/vad-web MicVAD + manual activityStart/End + Warm-up)
  private micVad: MicVADType | null = null;
  private smartVadLoaded = false;
  private smartVadStarted = false;
  private smartVadFailed = false;
  private smartVadSpeaking = false;
  private smartTurnOpen = false;
  private sentSmartVadDisabledConfig = false;
  private preSpeechRing: Float32Array[] = [];
  private preSpeechSamplesCount = 0;
  private readonly PRE_SPEECH_TARGET_SAMPLES = 16000; // 1000 ms at 16 kHz
  private bargeInSpeechMs = 0;
  private isWarmOnly = false;
  private warmReady = false;
  private micSettingsChangedHandler: ((ev: Event) => void) | null = null;

  // Android Native Mic (RoseMic) capture state
  private usingNativeMic = false;
  private nativeMicFailed = false;
  private nativeMicMode: NativeMicMode = 'communication';
  private nativeMicListener: { remove?: () => Promise<void> | void } | null = null;
  private nativeMicGen = 0;
  private nativeMicLevel = 0;
  private nativeVadFallbackToServer = false;
  private nativeVadPending = new Float32Array(0);
  private nativeVadQueue: Float32Array[] = [];
  private nativeVadProcessing = false;
  private nativeEnergySpeechFrames = 0;

  constructor(private options: GeminiLiveOptions) {
    this.isWarmOnly = Boolean(options.warmUpOnly);
  }

  private pipVideoElement: HTMLVideoElement | null = null;
  private pipCanvas: HTMLCanvasElement | null = null;
  private pipStream: MediaStream | null = null;
  
  private roseCallPluginStarted = false;

  private startRoseCallPlugin() {
    if (this.roseCallPluginStarted) return;
    try {
      const plugin = (window as any)?.Capacitor?.Plugins?.RoseCall;
      if (plugin && typeof plugin.start === 'function') {
        this.roseCallPluginStarted = true;
        Promise.resolve(plugin.start()).catch(() => {});
      }
    } catch {}
  }

  private stopRoseCallPlugin() {
    if (!this.roseCallPluginStarted) return;
    this.roseCallPluginStarted = false;
    try {
      const plugin = (window as any)?.Capacitor?.Plugins?.RoseCall;
      if (plugin && typeof plugin.stop === 'function') {
        Promise.resolve(plugin.stop()).catch(() => {});
      }
    } catch {}
  }

  public enterPiP() {
    try {
      if (!this.pipVideoElement) {
        this.pipVideoElement = document.createElement('video');
        this.pipVideoElement.muted = true;
        this.pipVideoElement.playsInline = true;
        this.pipCanvas = document.createElement('canvas');
        this.pipCanvas.width = 320;
        this.pipCanvas.height = 320;
        this.pipStream = (this.pipCanvas as any).captureStream(5);
        this.pipVideoElement.srcObject = this.pipStream;
        Promise.resolve(this.pipVideoElement.play()).catch(() => {});
        this.drawPiP();
      }
      Promise.resolve(this.pipVideoElement.requestPictureInPicture?.()).catch(() => {});
    } catch {}
  }

  public exitPiP() {
    try {
      if (document.pictureInPictureElement) {
        Promise.resolve(document.exitPictureInPicture()).catch(() => {});
      }
    } catch {}
    if (this.pipVideoElement) {
      try {
        this.pipVideoElement.pause();
      } catch {}
      this.pipVideoElement = null;
      this.pipCanvas = null;
      this.pipStream = null;
    }
  }

  private drawPiP() {
    if (!this.pipCanvas || !this.pipVideoElement) return;
    const ctx = this.pipCanvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#4c1d95';
    ctx.fillRect(0, 0, 320, 320);
    ctx.beginPath();
    ctx.arc(160, 160, 80 + (this.currentOutputLevel * 20), 0, 2 * Math.PI);
    ctx.strokeStyle = '#c084fc';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(160, 160, 60, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = '20px sans-serif';
    ctx.fillText('কল চলছে', 120, 280);
    requestAnimationFrame(() => this.drawPiP());
  }

  private setupMediaSession() {
    if ('mediaSession' in navigator && this.options.backgroundCallEnabled) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Rose 🌹 কল চলছে',
        artist: 'ROSE AI',
      });
      navigator.mediaSession.playbackState = 'playing';
      navigator.mediaSession.setActionHandler('stop', () => this.stop());
      // Do NOT stop live session/mic/AudioContext when minimized or transient pause fires
      navigator.mediaSession.setActionHandler('pause', () => {
        try {
          if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
          }
          if (this.playbackAudioCtx && this.playbackAudioCtx.state === 'suspended') {
            this.playbackAudioCtx.resume().catch(() => {});
          }
          navigator.mediaSession.playbackState = 'playing';
        } catch {}
      });
    }
  }

  private clearMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.setActionHandler('stop', null);
      navigator.mediaSession.setActionHandler('pause', null);
    }
  }

  public getMicAnalyser() { return this.micAnalyser; }
  public getOutputAnalyser() { return this.outputAnalyser; }
  public getNativeMicLevel() { return !this.isMuted && this.usingNativeMic ? this.nativeMicLevel : 0; }
  public isUsingNativeMic() { return this.usingNativeMic; }
  public isBrowserSpeechActive() { return this.isBrowserTtsSpeaking; }
  public getSessionId() { return this.sessionId; }
  public getAudioRoute() { return this.activeAudioRoute; }
  public isStopped() { return this.wasStoppedByUser || this.sessionLifecycleState === 'closed'; }
  public isSessionRunning() {
    return !this.wasStoppedByUser && this.sessionLifecycleState !== 'closed' && this.currentState !== 'off';
  }
  public isWarmReadyAndOpen(): boolean {
    return (
      !this.wasStoppedByUser &&
      this.sessionLifecycleState === 'active' &&
      this.warmReady &&
      this.isSetupComplete &&
      Boolean(this.ws && this.ws.readyState === WebSocket.OPEN)
    );
  }

  private isSmartListenLiveActive(): boolean {
    if (this.isFallbackMode || this.smartVadFailed || this.nativeVadFallbackToServer) return false;
    const micCfg = getMicListeningSettings();
    return Boolean(micCfg.smartListen && !micCfg.streetMode);
  }

  private shouldUseNativeMic(): boolean {
    if (this.nativeMicFailed || this.isFallbackMode || !isAndroidApp()) return false;
    const micCfg = getMicListeningSettings();
    return Boolean(micCfg.nativeMic && getRoseMicPlugin());
  }

  private async stopNativeMicCapture() {
    this.nativeMicGen++;
    this.nativeMicLevel = 0;
    this.nativeVadPending = new Float32Array(0);
    this.nativeVadQueue = [];
    this.nativeVadProcessing = false;
    this.nativeEnergySpeechFrames = 0;

    const listener = this.nativeMicListener;
    this.nativeMicListener = null;
    if (listener && typeof listener.remove === 'function') {
      try {
        await Promise.resolve(listener.remove());
      } catch {}
    }

    const plugin = getRoseMicPlugin();
    if (plugin && this.usingNativeMic) {
      try {
        await Promise.resolve(plugin.stop());
      } catch {}
    }
    this.usingNativeMic = false;
    updateNativeMicFilterStatus({ active: false });
  }

  private async initNativeMicCapture(): Promise<boolean> {
    const plugin = getRoseMicPlugin();
    if (!plugin || !this.shouldUseNativeMic()) return false;

    const gen = ++this.nativeMicGen;
    const micCfg = getMicListeningSettings();
    const mode: NativeMicMode = micCfg.nativeMicMode === 'recognition' ? 'recognition' : 'communication';
    this.nativeMicMode = mode;

    try {
      const listenerHandle = await Promise.resolve(
        plugin.addListener('pcm', (ev: { pcm?: string }) => {
          if (gen !== this.nativeMicGen || this.wasStoppedByUser) return;
          if (ev && typeof ev.pcm === 'string' && ev.pcm.length > 0) {
            this.handleNativePcmEvent(ev.pcm);
          }
        })
      );

      if (gen !== this.nativeMicGen || this.wasStoppedByUser) {
        try {
          await Promise.resolve(listenerHandle?.remove?.());
        } catch {}
        return false;
      }

      this.nativeMicListener = listenerHandle || null;

      const startResult = await Promise.resolve(plugin.start({ source: mode }));
      if (gen !== this.nativeMicGen || this.wasStoppedByUser) {
        try {
          await Promise.resolve(this.nativeMicListener?.remove?.());
        } catch {}
        this.nativeMicListener = null;
        try {
          await Promise.resolve(plugin.stop());
        } catch {}
        return false;
      }

      this.usingNativeMic = true;
      updateNativeMicFilterStatus({
        active: true,
        hasStartResult: true,
        ns: Boolean(startResult?.ns),
        aec: Boolean(startResult?.aec),
        agc: Boolean(startResult?.agc),
        rate: Number(startResult?.rate) || 16000,
        mode,
        error: null,
      });
      voiceDebugStore.recordAudioContextInit(Number(startResult?.rate) || 16000, 'RoseMic', 40);
      this.options.onMicLive?.(true);
      return true;
    } catch (err: any) {
      const errMsg = String(err?.message || err || 'RoseMic failed');
      console.warn('[NativeMic] RoseMic failed, falling back to getUserMedia:', errMsg);
      this.nativeMicFailed = true;
      await this.stopNativeMicCapture();
      updateNativeMicFilterStatus({ active: false, error: errMsg });
      this.options.onToast?.('Native mic ব্যর্থ, সাধারণ মাইক চালু করা হচ্ছে');
      return false;
    }
  }

  private handleNativeVadServerFallback(reason: string) {
    if (this.nativeVadFallbackToServer) return;
    console.warn('[NativeMic] VAD raw frame processing unavailable, using server VAD HIGH:', reason);
    this.nativeVadFallbackToServer = true;
    this.nativeVadPending = new Float32Array(0);
    this.nativeVadQueue = [];
    this.nativeVadProcessing = false;
    void this.cleanupSmartMicVad();
    if (
      !this.isWarmOnly &&
      this.isCurrentSession() &&
      this.sentSmartVadDisabledConfig &&
      !this.isFallbackMode &&
      !this.isReconnecting
    ) {
      void this.handleLiveDisconnectAndAutoReconnect(this.cachedApiKey, 'native_vad_server_fallback', 1);
    }
  }

  private feedNativeVadSamples(samples: Float32Array) {
    const vadAny = this.micVad as any;
    if (!vadAny || typeof vadAny.processFrame !== 'function' || !this.smartVadStarted) {
      this.handleNativeVadServerFallback('processFrame unavailable');
      return;
    }

    const FRAME_SIZE = 512;
    const merged = new Float32Array(this.nativeVadPending.length + samples.length);
    merged.set(this.nativeVadPending, 0);
    merged.set(samples, this.nativeVadPending.length);

    let offset = 0;
    while (offset + FRAME_SIZE <= merged.length) {
      const frame = merged.slice(offset, offset + FRAME_SIZE);
      this.nativeVadQueue.push(frame);
      offset += FRAME_SIZE;
    }
    this.nativeVadPending = merged.slice(offset);

    if (this.nativeVadProcessing) return;
    this.nativeVadProcessing = true;

    const drainQueue = async () => {
      try {
        while (
          this.nativeVadQueue.length > 0 &&
          !this.wasStoppedByUser &&
          this.usingNativeMic &&
          this.micVad &&
          !this.nativeVadFallbackToServer
        ) {
          const nextFrame = this.nativeVadQueue.shift();
          if (!nextFrame) break;
          await (this.micVad as any).processFrame(nextFrame);
        }
      } catch (err: any) {
        this.handleNativeVadServerFallback(String(err?.message || err || 'processFrame error'));
      } finally {
        this.nativeVadProcessing = false;
      }
    };
    void drainQueue();
  }

  private handleNativePcmEvent(base64Pcm: string) {
    if (!this.usingNativeMic || this.wasStoppedByUser) return;

    // Mute = stop sending chunks (keep RoseMic running)
    if (this.isMuted) {
      this.nativeMicLevel = 0;
      this.currentMicLevel = 0;
      this.options.onMicVolume?.(0);
      this.nativeVadPending = new Float32Array(0);
      this.nativeVadQueue = [];
      this.nativeEnergySpeechFrames = 0;
      if (this.smartTurnOpen) {
        this.closeSmartTurn();
      }
      return;
    }

    const { float32: float32Samples, rms } = decodeBase64Pcm16ToFloat32(base64Pcm);
    if (float32Samples.length === 0) return;

    const level = Math.min(1.0, rms * 3.8);
    this.nativeMicLevel = level;
    this.currentMicLevel = level;
    this.options.onMicVolume?.(level * 255);
    voiceDebugStore.recordMicLevel(rms);

    if (
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      !this.isSetupComplete ||
      this.isFallbackMode ||
      this.isWarmOnly
    ) {
      return;
    }

    // If Smart Listening VAD is active and accepts raw frames, gate via VAD activityStart/activityEnd
    if (this.isSmartListenLiveActive() && this.smartVadStarted && !this.nativeVadFallbackToServer) {
      this.feedNativeVadSamples(float32Samples);
      return;
    }

    // Server VAD mode: ignore chunks while Rose is speaking to avoid echo
    if (this.currentState === 'speaking') {
      return;
    }

    // Show "শুনছি…" bubble promptly on voice energy when Smart VAD isn't driving activityStart
    if (rms >= 0.032) {
      this.nativeEnergySpeechFrames++;
      if (
        this.nativeEnergySpeechFrames >= 2 &&
        !this.liveUserBuffer.trim() &&
        !this.userStartedSpeakingEmitted
      ) {
        this.userStartedSpeakingEmitted = true;
        this.options.onTranscription?.('user', 'শুনছি…', false);
      }
    } else {
      this.nativeEnergySpeechFrames = 0;
    }

    const chunkMs = Math.max(10, Math.round((float32Samples.length / 16000) * 1000));
    try {
      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: { data: base64Pcm, mimeType: 'audio/pcm;rate=16000' },
          },
        })
      );
      this.chunksSent++;
      voiceDebugStore.recordChunkSent(rms, chunkMs);
    } catch (sendErr: any) {
      voiceDebugStore.recordError(sendErr?.message || String(sendErr));
    }
  }

  private float32ToPcm16Base64(samples: Float32Array): string {
    const len = samples.length;
    const buffer = new ArrayBuffer(len * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < len; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      const int16 = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
      view.setInt16(i * 2, int16, true);
    }
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private sendPcm16kFrame(frame: Float32Array) {
    if (
      this.isWarmOnly ||
      this.isMuted ||
      this.isFallbackMode ||
      !this.smartTurnOpen ||
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      !this.isSetupComplete ||
      frame.length === 0
    ) {
      return;
    }

    let sumSq = 0;
    for (let i = 0; i < frame.length; i++) {
      const v = frame[i];
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / frame.length);
    const base64 = this.float32ToPcm16Base64(frame);
    const chunkMs = Math.round((frame.length / 16000) * 1000);

    try {
      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
          },
        })
      );
      this.chunksSent++;
      voiceDebugStore.recordChunkSent(rms, chunkMs);
    } catch (sendErr: any) {
      voiceDebugStore.recordError(sendErr?.message || String(sendErr));
    }
  }

  private pushPreSpeechFrame(frame: Float32Array) {
    const copy = new Float32Array(frame);
    this.preSpeechRing.push(copy);
    this.preSpeechSamplesCount += copy.length;
    while (
      this.preSpeechRing.length > 1 &&
      this.preSpeechSamplesCount - this.preSpeechRing[0].length >= this.PRE_SPEECH_TARGET_SAMPLES
    ) {
      const removed = this.preSpeechRing.shift();
      if (removed) {
        this.preSpeechSamplesCount -= removed.length;
      }
    }
  }

  private openSmartTurnAndFlushPreSpeech() {
    if (
      this.isWarmOnly ||
      this.isMuted ||
      this.isFallbackMode ||
      this.smartTurnOpen ||
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      !this.isSetupComplete
    ) {
      return;
    }

    try {
      this.ws.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
      this.smartTurnOpen = true;
      this.awaitingReplySince = 0;
    } catch {
      return;
    }

    if (!this.liveUserBuffer.trim() && !this.userStartedSpeakingEmitted) {
      this.userStartedSpeakingEmitted = true;
      this.options.onTranscription?.('user', 'শুনছি…', false);
    }

    if (this.preSpeechRing.length > 0 && this.preSpeechSamplesCount > 0) {
      const combined = new Float32Array(this.preSpeechSamplesCount);
      let offset = 0;
      for (const chunk of this.preSpeechRing) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      this.preSpeechRing = [];
      this.preSpeechSamplesCount = 0;
      this.sendPcm16kFrame(combined);
    } else {
      this.preSpeechRing = [];
      this.preSpeechSamplesCount = 0;
    }
  }

  private closeSmartTurn() {
    if (!this.smartTurnOpen) return;
    this.smartTurnOpen = false;
    if (
      !this.isWarmOnly &&
      !this.isFallbackMode &&
      this.ws &&
      this.ws.readyState === WebSocket.OPEN &&
      this.isSetupComplete
    ) {
      try {
        this.ws.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
      } catch {}
    }
  }

  private attachMicSettingsListener() {
    if (typeof window === 'undefined' || this.micSettingsChangedHandler) return;
    this.micSettingsChangedHandler = (ev: Event) => {
      const next = (ev as CustomEvent)?.detail || getMicListeningSettings();
      if (this.micVad) {
        try {
          this.micVad.setOptions(getSmartListenVadOptions(next.smartListenSensitivity));
        } catch {}
      }
      if (!this.isCurrentSession() || this.isWarmOnly || this.isFallbackMode || this.isReconnecting) {
        return;
      }
      if (isAndroidApp()) {
        const wantNative = Boolean(next.nativeMic && !this.nativeMicFailed && getRoseMicPlugin());
        const nextMode: NativeMicMode = next.nativeMicMode === 'recognition' ? 'recognition' : 'communication';
        if (wantNative !== this.usingNativeMic || (this.usingNativeMic && nextMode !== this.nativeMicMode)) {
          void this.handleLiveDisconnectAndAutoReconnect(this.cachedApiKey, 'native_mic_setting_changed', 1);
          return;
        }
      }
      if (!next.smartListen && this.sentSmartVadDisabledConfig && !this.smartVadFailed) {
        this.smartVadFailed = true;
        this.closeSmartTurn();
        void this.cleanupSmartMicVad();
        void this.handleLiveDisconnectAndAutoReconnect(this.cachedApiKey, 'smart_listen_toggled_off', 1);
      } else if (next.smartListen && !this.sentSmartVadDisabledConfig && !this.smartVadFailed && !next.streetMode) {
        void this.handleLiveDisconnectAndAutoReconnect(this.cachedApiKey, 'smart_listen_toggled_on', 1);
      }
    };
    window.addEventListener('rose-mic-settings-changed', this.micSettingsChangedHandler);
  }

  private detachMicSettingsListener() {
    if (typeof window !== 'undefined' && this.micSettingsChangedHandler) {
      window.removeEventListener('rose-mic-settings-changed', this.micSettingsChangedHandler);
      this.micSettingsChangedHandler = null;
    }
  }

  private async cleanupSmartMicVad() {
    this.closeSmartTurn();
    this.smartVadStarted = false;
    this.smartVadSpeaking = false;
    this.bargeInSpeechMs = 0;
    this.preSpeechRing = [];
    this.preSpeechSamplesCount = 0;
    const vad = this.micVad;
    this.micVad = null;
    this.smartVadLoaded = false;
    if (vad) {
      try {
        (vad as any).frameProcessor?.pause?.(() => {});
      } catch {}
      try {
        await vad.destroy();
      } catch {
        try {
          await (vad as any).model?.release?.();
        } catch {}
      }
      try {
        (vad as any)._mediaStreamAudioSourceNode?.disconnect?.();
      } catch {}
      try {
        (vad as any)._vadNode?.disconnect?.();
      } catch {}
    }
    updateSmartVadTelemetry({ ready: false, loading: false, speechDetected: false, probability: 0 });
  }

  private async handleSmartVadFailure(reason: string, shouldReconnectIfLive: boolean) {
    console.warn('[SmartListening] VAD failed, falling back to old behavior:', reason);
    if (this.usingNativeMic) {
      this.handleNativeVadServerFallback(reason);
      return;
    }
    this.smartVadFailed = true;
    saveMicListeningSettings({ smartListen: false });
    updateSmartVadTelemetry({
      ready: false,
      loading: false,
      speechDetected: false,
      probability: 0,
      error: reason,
    });
    await this.cleanupSmartMicVad();
    this.options.onToast?.(`Smart Listening বন্ধ: ${reason}`);
    if (
      shouldReconnectIfLive &&
      !this.isWarmOnly &&
      this.isCurrentSession() &&
      this.sentSmartVadDisabledConfig &&
      !this.isFallbackMode &&
      !this.isReconnecting
    ) {
      void this.handleLiveDisconnectAndAutoReconnect(this.cachedApiKey, 'smart_vad_fallback', 1);
    }
  }

  private async initSmartMicVad(startImmediately: boolean): Promise<boolean> {
    if (!this.isSmartListenLiveActive()) return false;
    this.attachMicSettingsListener();

    if (this.micVad && this.smartVadLoaded) {
      if (this.usingNativeMic) {
        if (startImmediately && !this.smartVadStarted) {
          const vadAny = this.micVad as any;
          if (typeof vadAny.processFrame === 'function' && vadAny.frameProcessor?.resume) {
            vadAny.frameProcessor.resume();
            this.smartVadStarted = true;
            updateSmartVadTelemetry({ ready: true, loading: false, error: null });
            return true;
          }
          this.handleNativeVadServerFallback('processFrame unsupported on native mic');
          return false;
        }
        return true;
      }
      if (this.audioCtx) {
        this.micVad.options.audioContext = this.audioCtx;
      }
      this.micVad.options.getStream = async () => {
        if (!this.micStream) throw new Error('মাইক স্ট্রিম পাওয়া যায়নি');
        return this.micStream;
      };
      this.micVad.options.resumeStream = async () => {
        if (!this.micStream) throw new Error('মাইক স্ট্রিম পাওয়া যায়নি');
        return this.micStream;
      };
      if (startImmediately && !this.smartVadStarted) {
        try {
          await this.micVad.start();
          this.smartVadStarted = true;
          updateSmartVadTelemetry({ ready: true, loading: false, error: null });
          return true;
        } catch (err: any) {
          const reason = String(err?.message || err || 'MicVAD start ব্যর্থ');
          await this.handleSmartVadFailure(reason, true);
          return false;
        }
      }
      return true;
    }

    updateSmartVadTelemetry({ loading: true, error: null });
    try {
      const vadWeb = await import('@ricky0123/vad-web');
      const MicVADClass = vadWeb?.MicVAD;
      if (!MicVADClass) {
        throw new Error('MicVAD মডিউল পাওয়া যায়নি');
      }
      const micCfg = getMicListeningSettings();
      const vadOpts = getSmartListenVadOptions(micCfg.smartListenSensitivity);
      const captureSessionId = this.sessionId;

      const vad = await MicVADClass.new({
        ...SMART_VAD_CDN_CONFIG,
        ...vadOpts,
        submitUserSpeechOnPause: false,
        startOnLoad: false,
        audioContext: this.audioCtx || undefined,
        getStream: async () => {
          if (!this.micStream) throw new Error('মাইক স্ট্রিম পাওয়া যায়নি');
          return this.micStream;
        },
        pauseStream: async () => {},
        resumeStream: async () => {
          if (!this.micStream) throw new Error('মাইক স্ট্রিম পাওয়া যায়নি');
          return this.micStream;
        },
        ortConfig: (ortInst) => {
          try {
            ortInst.env.wasm.wasmPaths = SMART_VAD_CDN_CONFIG.onnxWASMBasePath;
            ortInst.env.wasm.numThreads = 1;
            ortInst.env.logLevel = 'error';
          } catch {}
        },
        onFrameProcessed: (probs, frame) => {
          if (this.wasStoppedByUser || this.sessionId !== captureSessionId) return;
          const activeCfg = getMicListeningSettings();
          const curOpts = getSmartListenVadOptions(activeCfg.smartListenSensitivity);
          const isProbSpeech = probs.isSpeech >= curOpts.positiveSpeechThreshold;
          updateSmartVadTelemetry({
            ready: true,
            loading: false,
            speechDetected: isProbSpeech,
            probability: probs.isSpeech,
            error: null,
          });

          if (this.isWarmOnly) return;

          if (this.isMuted) {
            this.bargeInSpeechMs = 0;
            this.preSpeechRing = [];
            this.preSpeechSamplesCount = 0;
            if (this.smartTurnOpen) {
              this.closeSmartTurn();
            }
            return;
          }

          if (!this.smartTurnOpen) {
            this.pushPreSpeechFrame(frame);
          }

          const roseSpeaking =
            this.currentState === 'speaking' ||
            this.scheduledAudioSources.length > 0 ||
            this.pendingPcmSamplesCount > 0 ||
            this.isBrowserTtsSpeaking;

          if (roseSpeaking) {
            if (!this.smartTurnOpen) {
              if (isProbSpeech) {
                this.bargeInSpeechMs += 32;
                if (this.bargeInSpeechMs >= 250) {
                  this.bargeInSpeechMs = 0;
                  this.awaitingReplySince = 0;
                  this.liveAssistantBuffer = '';
                  this.phoneToolHandledForTurn = false;
                  this.liveStreetAllowed = true;
                  this.isRoseTurnActive = false;
                  this.interruptPlayback();
                  this.updateState('listening');
                  this.options.onInterrupted?.();
                  this.openSmartTurnAndFlushPreSpeech();
                }
              } else {
                this.bargeInSpeechMs = 0;
              }
            } else {
              this.sendPcm16kFrame(frame);
            }
          } else {
            this.bargeInSpeechMs = 0;
            if (!this.smartTurnOpen && this.smartVadSpeaking && isProbSpeech) {
              this.openSmartTurnAndFlushPreSpeech();
            } else if (this.smartTurnOpen) {
              this.sendPcm16kFrame(frame);
            }
          }
        },
        onSpeechStart: () => {
          if (this.wasStoppedByUser || this.sessionId !== captureSessionId || this.isWarmOnly || this.isMuted) {
            return;
          }
          this.smartVadSpeaking = true;
          const roseSpeaking =
            this.currentState === 'speaking' ||
            this.scheduledAudioSources.length > 0 ||
            this.pendingPcmSamplesCount > 0 ||
            this.isBrowserTtsSpeaking;
          if (!roseSpeaking && !this.smartTurnOpen) {
            this.openSmartTurnAndFlushPreSpeech();
          }
        },
        onVADMisfire: () => {
          if (this.wasStoppedByUser || this.sessionId !== captureSessionId) return;
          this.smartVadSpeaking = false;
          this.bargeInSpeechMs = 0;
          if (this.smartTurnOpen) {
            this.closeSmartTurn();
          }
          if (!this.liveUserBuffer.trim() && this.userStartedSpeakingEmitted) {
            this.userStartedSpeakingEmitted = false;
            this.options.onTranscription?.('user', '', true);
          }
        },
        onSpeechEnd: () => {
          if (this.wasStoppedByUser || this.sessionId !== captureSessionId) return;
          this.smartVadSpeaking = false;
          this.bargeInSpeechMs = 0;
          if (this.smartTurnOpen) {
            this.closeSmartTurn();
            if (!this.isWarmOnly && this.currentState !== 'speaking') {
              this.awaitingReplySince = Date.now();
            }
          }
        },
      });

      if (this.wasStoppedByUser || this.sessionLifecycleState === 'closed') {
        try {
          await (vad as any).model?.release?.();
        } catch {}
        return false;
      }

      this.micVad = vad;
      this.smartVadLoaded = true;

      if (startImmediately) {
        if (this.usingNativeMic) {
          const vadAny = vad as any;
          if (typeof vadAny.processFrame === 'function' && vadAny.frameProcessor?.resume) {
            vadAny.frameProcessor.resume();
            this.smartVadStarted = true;
          } else {
            this.handleNativeVadServerFallback('processFrame unsupported on native mic');
            return false;
          }
        } else {
          await vad.start();
          this.smartVadStarted = true;
        }
      }
      updateSmartVadTelemetry({ ready: true, loading: false, error: null });
      return true;
    } catch (err: any) {
      const reason = String(err?.message || err || 'VAD লোড ব্যর্থ');
      await this.handleSmartVadFailure(reason, startImmediately);
      return false;
    }
  }

  private isCurrentSession(
    socket?: WebSocket | null,
    socketSeq?: number,
    expectedSessionId?: string
  ): boolean {
    if (this.wasStoppedByUser) return false;
    if (this.sessionLifecycleState !== 'active') return false;
    if (!this.isWarmOnly && activeGlobalLiveSession !== this) return false;
    if (expectedSessionId !== undefined && this.sessionId !== expectedSessionId) return false;
    if (socket !== undefined && socket !== null && this.ws !== socket) return false;
    if (socketSeq !== undefined && this.activeSocketSeq !== socketSeq) return false;
    return true;
  }

  private releaseExistingSocketOnly(closeReason: string = 'closing') {
    this.isSetupComplete = false;
    this.activeSocketSeq = 0;
    if (this.ws) {
      const sock = this.ws;
      this.ws = null;
      try {
        sock.onopen = null;
        sock.onmessage = null;
        sock.onerror = null;
        sock.onclose = null;
        if (sock.readyState === WebSocket.OPEN || sock.readyState === WebSocket.CONNECTING) {
          sock.close(1000, closeReason);
        }
      } catch {}
    }
  }

  private disconnectAllMicAndAudioNodes() {
    void this.stopNativeMicCapture();

    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch {}
      this.micSourceNode = null;
    }

    if (this.rnnoiseNode) {
      try {
        this.rnnoiseNode.port.onmessage = null;
        this.rnnoiseNode.disconnect();
      } catch {}
      this.rnnoiseNode = null;
    }

    if (this.audioWorkletNode) {
      try {
        this.audioWorkletNode.port.onmessage = null;
        this.audioWorkletNode.disconnect();
      } catch {}
      this.audioWorkletNode = null;
    }

    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.onaudioprocess = null;
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }

    if (this.cleanDestNode) {
      try {
        this.cleanDestNode.disconnect();
      } catch {}
      this.cleanDestNode = null;
    }

    if (this.micAnalyser) {
      try {
        this.micAnalyser.disconnect();
      } catch {}
      this.micAnalyser = null;
    }

    if (this.outputAnalyser) {
      try {
        this.outputAnalyser.disconnect();
      } catch {}
      this.outputAnalyser = null;
    }

    this.sileroVad.stop();

    for (const s of [this.micStream, this.denoisedStream, this.options.micStream]) {
      if (!s) continue;
      try {
        s.getTracks().forEach((track) => {
          try {
            track.enabled = false;
            track.stop();
          } catch {}
        });
      } catch {}
    }
    pauseGlobalMicForSpeech([this.micStream, this.denoisedStream, this.options.micStream]);
    void stopGlobalMicStream();
    this.micStream = null;
    this.options.micStream = undefined;
    this.denoisedStream = null;
    this.options.onMicLive?.(false);
  }

  private teardownBackgroundAudioElement() {
    if (this.visChangeHandler) {
      try {
        document.removeEventListener('visibilitychange', this.visChangeHandler);
      } catch {}
      this.visChangeHandler = null;
    }
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.srcObject = null;
      } catch {}
      this.audioElement = null;
    }
    if (this.destination) {
      try {
        this.destination.disconnect();
      } catch {}
      this.destination = null;
    }
  }

  private async setupSingleAudioOutputRoute() {
    if (!this.playbackAudioCtx || this.wasStoppedByUser) return;
    this.teardownBackgroundAudioElement();

    this.visChangeHandler = () => {
      if (this.wasStoppedByUser || !this.isCurrentSession()) return;
      // Keep mic, AudioContext, and session alive when minimized or restored
      const keepContextsAlive = () => {
        if (this.wasStoppedByUser || !this.isCurrentSession()) return;
        if (!this.isFallbackMode && this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }
        if (this.playbackAudioCtx && this.playbackAudioCtx.state === 'suspended') {
          this.playbackAudioCtx.resume().catch(() => {});
        }
      };
      keepContextsAlive();
      if (document.visibilityState === 'hidden') {
        setTimeout(keepContextsAlive, 250);
        setTimeout(keepContextsAlive, 800);
        if (this.options.floatingCallEnabled) {
          this.enterPiP();
        }
      }
    };
    document.addEventListener('visibilitychange', this.visChangeHandler);

    let route: 'direct' | 'background' = 'direct';
    if (this.options.backgroundCallEnabled) {
      try {
        const dest = this.playbackAudioCtx.createMediaStreamDestination();
        const audioEl = new Audio();
        audioEl.srcObject = dest.stream;
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', 'true');
        await audioEl.play();
        if (!audioEl.paused && !this.wasStoppedByUser && this.isCurrentSession()) {
          this.destination = dest;
          this.audioElement = audioEl;
          this.setupMediaSession();
          route = 'background';
        } else {
          try {
            audioEl.pause();
            audioEl.srcObject = null;
            dest.disconnect();
          } catch {}
        }
      } catch (e) {
        console.warn('[GeminiLive] Background audio element could not play, using direct route:', e);
        if (this.audioElement) {
          try {
            this.audioElement.pause();
            this.audioElement.srcObject = null;
          } catch {}
          this.audioElement = null;
        }
        if (this.destination) {
          try {
            this.destination.disconnect();
          } catch {}
          this.destination = null;
        }
        route = 'direct';
      }
    }

    const configured = configureBoostedOutputRoute(
      this.playbackAudioCtx,
      route,
      route === 'background' ? this.destination : null,
      this.outputAnalyser,
      this.options.voiceVolume,
      this.sessionId
    );
    this.activeAudioRoute = configured.route;
    console.log('[GeminiLive] Active audio route configured:', {
      sessionId: this.sessionId,
      audioRoute: this.activeAudioRoute,
      backgroundCallEnabled: Boolean(this.options.backgroundCallEnabled),
    });
  }

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

  public sendClientContent(turn: any) {
    this.liveAssistantBuffer = '';
    this.liveUserBuffer = '';
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isSetupComplete) {
      try {
        this.ws.send(JSON.stringify({ clientContent: turn }));
      } catch {}
    }
  }


  public injectSystemInstructionToSpeak(sentence: string): boolean {
    if (
      !this.isFallbackMode &&
      this.ws &&
      this.ws.readyState === WebSocket.OPEN &&
      this.isSetupComplete
    ) {
      try {
        this.interruptPlayback();
        this.liveAssistantBuffer = '';
        this.isRoseTurnActive = false;
        this.ws.send(
          JSON.stringify({
            realtimeInput: {
              text: `Say exactly this to the user: "${sentence}". Do not add anything else and do not give your own answer.`,
            },
          })
        );
        return true;
      } catch {}
    }
    return false;
  }

  public supportsVideo(): boolean {
    return !this.isFallbackMode && this.activeMode === 'live' && this.socketStatus === 'open' && this.isSetupComplete;
  }

  public sendRealtimeVideoFrame(base64DataUrlOrRaw: string): boolean {
    if (!this.supportsVideo() || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      const cleanBase64 = base64DataUrlOrRaw.replace(/^data:image\/[a-z]+;base64,/, '');
      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            video: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  public updateOwnerAndSystemInstruction(ownerName: string, systemInstruction: string) {
    this.options.ownerName = isAdmin() ? ADMIN_DISPLAY_NAME : ownerName;
    this.options.systemInstruction = systemInstruction;
  }

  private phoneToolHandledForTurn = false;
  private pendingEndCallAfterSpeech = false;
  private endCallReceivedAudioAfterTool = false;
  private endCallFallbackTimer: any = null;

  private triggerEndCallCleanup() {
    if (!this.pendingEndCallAfterSpeech) return;
    this.pendingEndCallAfterSpeech = false;
    this.endCallReceivedAudioAfterTool = false;
    if (this.endCallFallbackTimer) {
      clearTimeout(this.endCallFallbackTimer);
      this.endCallFallbackTimer = null;
    }
    this.stop();
    this.options.onEndCall?.();
  }

  public wasPhoneToolHandledInTurn(): boolean {
    return this.phoneToolHandledForTurn || this.pendingEndCallAfterSpeech;
  }

  public didAssistantReplyInTurn(): boolean {
    return (
      Boolean(this.liveAssistantBuffer.trim()) ||
      this.scheduledAudioSources.length > 0 ||
      this.pendingPcmSamplesCount > 0 ||
      this.isFallbackMode
    );
  }

  private getEffectiveSystemInstruction(): string {
    const adminMode = isAdmin();
    if (adminMode) {
      this.options.ownerName = ADMIN_DISPLAY_NAME;
    }
    return buildFullLiveSystemPrompt(this.options.systemInstruction, this.options.language);
  }

  public async start() {
    if (activeGlobalLiveSession && activeGlobalLiveSession !== this) {
      console.log('[GeminiLive] Closing previous live session before start:', {
        closingSessionId: activeGlobalLiveSession.sessionId,
        newSessionId: this.sessionId,
      });
      activeGlobalLiveSession.sessionLifecycleState = 'closing';
      try {
        activeGlobalLiveSession.stop();
      } catch {}
    }
    activeGlobalLiveSession = this;
    this.sessionLifecycleState = 'active';
    this.interruptPlayback();
    this.releaseExistingSocketOnly('new_session_start');
    this.isRoseTurnActive = false;
    console.log('[GeminiLive] Starting live session:', {
      sessionId: this.sessionId,
      backgroundCallEnabled: Boolean(this.options.backgroundCallEnabled),
    });

    this.wasStoppedByUser = false;
    this.isReconnecting = false;
    this.isSetupComplete = false;
    this.isFallbackMode = false;
    this.isProcessingClip = false;
    this.isRecordingClip = false;
    this.isBrowserTtsSpeaking = false;
    // Start a fresh call with a clean session handle so the Bengali system prompt and priming turn always apply
    this.resumptionHandle = null;
    saveGlobalResumptionHandle(null);
    this.connectedModelName = null;
    this.awaitingReplySince = 0;
    this.watchdogReconnectedForTurn = false;
    this.liveUserBuffer = '';
    this.liveAssistantBuffer = '';
    this.suppressedForeignTranscript = false;
    this.pendingMicPcmBase64Queue = [];
    this.phoneToolHandledForTurn = false;
    this.pendingEndCallAfterSpeech = false;
    this.endCallReceivedAudioAfterTool = false;
    if (this.endCallFallbackTimer) {
      clearTimeout(this.endCallFallbackTimer);
      this.endCallFallbackTimer = null;
    }
    this.conversationHistory = [];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const rawHist =
          localStorage.getItem('iyabd_chat_history') || localStorage.getItem('rose_messages');
        if (rawHist) {
          const parsedHist = JSON.parse(rawHist);
          if (Array.isArray(parsedHist)) {
            this.conversationHistory = parsedHist
              .filter((m: any) => m && m.role !== 'system' && !m.isError && (m.text || m.content))
              .slice(-12)
              .map((m: any) => ({
                role:
                  m.role === 'rose' || m.role === 'assistant' || m.role === 'model'
                    ? 'model'
                    : 'user',
                parts: [{ text: String(m.text || m.content || '').trim() }],
              }));
          }
        }
      }
    } catch {}
    this.updateState('connecting');
    this.socketStatus = 'connecting';

    const apiKey = (this.options.apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();
    this.cachedApiKey = apiKey;
    if (!(await ensureGeminiReady(apiKey))) {
      const noKeyMsg = 'Gemini key সেভ করা নেই। Settings → CONNECTIONS-এ কী বসাও।';
      this.lastError = noKeyMsg;
      voiceDebugStore.recordError(noKeyMsg);
      this.options.onError?.(noKeyMsg);
      this.updateState('off');
      this.socketStatus = 'closed';
      return;
    }

    // Background preload of RNNoise WASM and Silero VAD (non-blocking so call starts immediately)
    preloadAudioEnhancementsInBackground();
    const micSettings = getMicListeningSettings();
    let smartVadPromise: Promise<boolean> | null = null;
    if (micSettings.smartListen && !micSettings.streetMode) {
      smartVadPromise = this.initSmartMicVad(false);
    }

    // Notify Android foreground call service plugin (no-op if missing)
    this.startRoseCallPlugin();
    this.startWatchdog();

    // Open the Live socket and the mic AT THE SAME TIME (parallel):
    // Mic audio chunks (20-40ms) are buffered while the socket connects and flushed as soon as setupComplete arrives.
    const connectSocketInParallel = async (): Promise<{
      connectedLive: boolean;
      modelsOk: boolean;
    }> => {
      try {
        const discovered = await discoverVoiceModelsFromListModels(apiKey);
        this.liveModels = discovered.liveModels;
        this.flashModels = discovered.flashModels;
        this.ttsModels = discovered.ttsModels;
      } catch (err: any) {
        const formatted = parseAndFormatGeminiError(err?.status || 0, err?.message || 'ListModels failed');
        this.lastError = formatted.bengali;
        return { connectedLive: false, modelsOk: false };
      }

      if (this.wasStoppedByUser || !this.isCurrentSession()) {
        return { connectedLive: false, modelsOk: true };
      }

      if (this.liveModels.length > 0 && !getMicListeningSettings().streetMode) {
        const connectedLive = await this.tryConnectLiveModels(
          apiKey,
          this.liveModels.slice(0, 3),
          8000
        );
        return { connectedLive, modelsOk: true };
      }
      return { connectedLive: false, modelsOk: true };
    };

    const [audioReady, socketResult] = await Promise.all([
      this.initAudioAndAnalyzers(),
      connectSocketInParallel(),
    ]);

    if (!audioReady || this.wasStoppedByUser) {
      this.releaseExistingSocketOnly('audio_init_failed');
      this.stopRoseCallPlugin();
      return;
    }

    if (!socketResult.modelsOk) {
      if (this.lastError) {
        this.options.onError?.(this.lastError);
      }
      this.updateState('off');
      this.socketStatus = 'closed';
      this.stopRoseCallPlugin();
      return;
    }

    if (micSettings.smartListen && !micSettings.streetMode && !this.smartVadFailed) {
      if (smartVadPromise) {
        await smartVadPromise;
      }
      if (!this.smartVadFailed && !this.wasStoppedByUser) {
        await this.initSmartMicVad(true);
      }
    }

    if (this.wasStoppedByUser) {
      this.stopRoseCallPlugin();
      return;
    }

    if (socketResult.connectedLive && this.isCurrentSession()) {
      this.activeMode = 'live';
      this.socketStatus = 'open';
      this.flushBufferedInitialMicChunks();
      // Show "LISTENING" only when the socket is really open
      this.updateState('listening');
      console.log('[GeminiLive] Live session active:', {
        sessionId: this.sessionId,
        model: this.connectedModelName,
        audioRoute: this.activeAudioRoute,
      });
      return;
    }

    if (!this.wasStoppedByUser && this.isCurrentSession() && this.lastError) {
      this.options.onError?.(this.lastError);
    }

    // 4. Activate Path 2 (Reliable Voice via MediaRecorder + generateContent + TTS/speechSynthesis)
    if (!this.wasStoppedByUser) {
      if (this.flashModels.length === 0) {
        const failMsg = this.lastError || 'HTTP 503: Live voice session failed to connect';
        this.lastError = failMsg;
        voiceDebugStore.recordError(failMsg);
        this.options.onError?.(failMsg);
        this.updateState('off');
        this.stopRoseCallPlugin();
        return;
      }
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
      if (!this.isCurrentSession() || this.currentState === 'off' || globalReconnectLock) return;

      // 10-second reply watchdog: if user's speech was transcribed but no model reply starts within 10s
      if (
        !this.isReconnecting &&
        !globalReconnectLock &&
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
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;

      // Try Android Native Mic (RoseMic) when configured — do NOT call getUserMedia if active
      if (this.shouldUseNativeMic()) {
        const nativeOk = await this.initNativeMicCapture();
        if (nativeOk) {
          this.playbackAudioCtx =
            this.options.playbackAudioContext &&
            this.options.playbackAudioContext.state !== 'closed'
              ? this.options.playbackAudioContext
              : new AudioCtxClass({ sampleRate: 24000, latencyHint: 'interactive' });

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

          if (!this.outputAnalyser || this.outputAnalyser.context !== this.playbackAudioCtx) {
            this.outputAnalyser = this.playbackAudioCtx.createAnalyser();
            this.outputAnalyser.fftSize = 256;
            this.outputAnalyser.smoothingTimeConstant = 0.45;
          }

          this.startVisualizer();
          await this.setupSingleAudioOutputRoute();
          return true;
        }
      }

      setBrowserAudioSessionType('play-and-record');
      const hasLiveOptionStream =
        this.options.micStream &&
        this.options.micStream.active &&
        this.options.micStream.getAudioTracks().some((t) => t.readyState === 'live');

      const isApp = isAndroidApp();
      if (hasLiveOptionStream && this.options.micStream) {
        this.micStream = this.options.micStream;
      } else {
        this.micStream = await getGlobalMicStream({
          audio: isApp
            ? {
                autoGainControl: true,
                noiseSuppression: true,
                echoCancellation: true,
                channelCount: { ideal: 1 },
              }
            : {
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

      // Use shared pre-warmed AudioContext if provided, or create one
      this.audioCtx =
        this.options.audioContext && this.options.audioContext.state !== 'closed'
          ? this.options.audioContext
          : new AudioCtxClass({ sampleRate: 48000, latencyHint: 'interactive' });

      this.playbackAudioCtx =
        this.options.playbackAudioContext &&
        this.options.playbackAudioContext.state !== 'closed'
          ? this.options.playbackAudioContext
          : this.audioCtx;

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
      console.log(`[GeminiLive] AudioContext real sampleRate: ${sourceSampleRate} Hz (platform=${isApp ? 'App' : 'Chrome'})`);

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

      // Target ~30 ms chunk size (strictly within 20-40 ms)
      const targetChunkSamples = Math.max(
        256,
        Math.min(Math.round(sourceSampleRate * 0.04), Math.round(sourceSampleRate * 0.03))
      );
      const actualChunkMs = Math.round((targetChunkSamples / sourceSampleRate) * 1000);

      const captureSessionId = this.sessionId;
      // Attach continuous 20-40ms PCM16 capture for Live WebSocket AND feed Silero VAD for Path 2 fallback
      const sendPcm40msChunk = (float32Samples: Float32Array) => {
        if (
          !this.isCurrentSession(undefined, undefined, captureSessionId) ||
          this.isMuted ||
          this.currentState === 'speaking'
        ) {
          return;
        }

        // Compute RMS level for live debug meter & speech end timestamp tracking
        let sumSq = 0;
        for (let i = 0; i < float32Samples.length; i++) {
          const v = float32Samples[i];
          sumSq += v * v;
        }
        const rms = float32Samples.length > 0 ? Math.sqrt(sumSq / float32Samples.length) : 0;

        const micCfg = getMicListeningSettings();
        // Apply Noise Gate filtering if user explicitly enabled it
        if (micCfg.noiseGate) {
          this.noiseGateEngine.processFrame(float32Samples, micCfg.noiseGate, micCfg.noiseGateSensitivity);
        }

        if (this.isFallbackMode && micCfg.smartListen && this.currentState === 'listening') {
          if (!this.sileroVad.isAvailable()) {
            void this.sileroVad.initInBackground();
          } else {
            void this.sileroVad.feedAudioSamples(float32Samples, sourceSampleRate);
          }
        }

        if (this.isFallbackMode || this.isWarmOnly) {
          voiceDebugStore.recordMicLevel(rms);
          return;
        }

        // When Smart Listening @ricky0123/vad-web MicVAD is active, audio streaming is strictly gated by activityStart..activityEnd
        if (this.isSmartListenLiveActive() && this.smartVadStarted) {
          voiceDebugStore.recordMicLevel(rms);
          return;
        }

        const pcm16Bytes = downsampleToPCM16(float32Samples, sourceSampleRate, 16000);
        if (pcm16Bytes.byteLength === 0) return;

        const view = new DataView(pcm16Bytes.buffer, pcm16Bytes.byteOffset, pcm16Bytes.byteLength);
        const sampleCount = Math.floor(pcm16Bytes.byteLength / 2);
        const float3216k = new Float32Array(sampleCount);
        for (let i = 0; i < sampleCount; i++) {
          float3216k[i] = view.getInt16(i * 2, true) / 32768.0;
        }
        if (!this.smartTurnOpen) {
          this.pushPreSpeechFrame(float3216k);
        }

        let binary = '';
        for (let i = 0; i < pcm16Bytes.byteLength; i++) {
          binary += String.fromCharCode(pcm16Bytes[i]);
        }
        const base64 = btoa(binary);
        const chunkMs = Math.round((float32Samples.length / sourceSampleRate) * 1000);

        // Buffer initial 20-40ms chunks while the Live socket is still opening, then flush once open
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupComplete) {
          voiceDebugStore.recordMicLevel(rms);
          if (this.pendingMicPcmBase64Queue.length < 75) {
            this.pendingMicPcmBase64Queue.push({ base64, rms, chunkMs });
          } else {
            this.pendingMicPcmBase64Queue.shift();
            this.pendingMicPcmBase64Queue.push({ base64, rms, chunkMs });
          }
          return;
        }

        try {
          if (this.pendingMicPcmBase64Queue.length > 0) {
            this.flushBufferedInitialMicChunks();
          }
          this.ws.send(
            JSON.stringify({
              realtimeInput: {
                audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
              },
            })
          );
          this.chunksSent++;
          voiceDebugStore.recordChunkSent(rms, chunkMs);
        } catch (sendErr: any) {
          voiceDebugStore.recordError(sendErr?.message || String(sendErr));
        }
      };

      let workletActive = false;
      if (this.audioCtx.audioWorklet && typeof AudioWorkletNode === 'function') {
        try {
          const processorCode = `
            class RoseLiveCaptureProcessor extends AudioWorkletProcessor {
              constructor() {
                super();
                const sr = typeof sampleRate === 'number' && sampleRate > 0 ? sampleRate : ${sourceSampleRate};
                this.targetSamples = Math.max(256, Math.min(Math.round(sr * 0.04), Math.round(sr * 0.03)));
                this._buf = new Float32Array(this.targetSamples);
                this._offset = 0;
              }
              process(inputs) {
                const input = inputs[0];
                if (input && input.length > 0 && input[0] && input[0].length > 0) {
                  const ch = input[0];
                  let i = 0;
                  while (i < ch.length) {
                    const rem = this.targetSamples - this._offset;
                    const copyCount = Math.min(rem, ch.length - i);
                    this._buf.set(ch.subarray(i, i + copyCount), this._offset);
                    this._offset += copyCount;
                    i += copyCount;
                    if (this._offset >= this.targetSamples) {
                      const chunk = new Float32Array(this._buf);
                      this.port.postMessage(chunk, [chunk.buffer]);
                      this._offset = 0;
                    }
                  }
                }
                return true;
              }
            }
            registerProcessor('rose-live-capture-processor', RoseLiveCaptureProcessor);
          `;
          const blob = new Blob([processorCode], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          await this.audioCtx.audioWorklet.addModule(url);
          URL.revokeObjectURL(url);

          this.audioWorkletNode = new AudioWorkletNode(this.audioCtx, 'rose-live-capture-processor');
          this.audioWorkletNode.port.onmessage = (e) => {
            if (e.data && e.data instanceof Float32Array) {
              sendPcm40msChunk(e.data);
            }
          };
          workletActive = true;
          voiceDebugStore.recordAudioContextInit(sourceSampleRate, 'Worklet', actualChunkMs);
        } catch (workletErr) {
          console.warn('[GeminiLive] AudioWorklet setup failed, falling back to ScriptProcessor(1024):', workletErr);
          workletActive = false;
        }
      }

      if (!workletActive) {
        // Fallback to ScriptProcessor 1024 only if AudioWorklet is missing, batching ~40ms (never > 100ms)
        this.scriptProcessor = this.audioCtx.createScriptProcessor(1024, 1, 1);
        let spBuffer = new Float32Array(targetChunkSamples);
        let spOffset = 0;
        this.scriptProcessor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          let i = 0;
          while (i < input.length) {
            const rem = targetChunkSamples - spOffset;
            const copyCount = Math.min(rem, input.length - i);
            spBuffer.set(input.subarray(i, i + copyCount), spOffset);
            spOffset += copyCount;
            i += copyCount;
            if (spOffset >= targetChunkSamples) {
              sendPcm40msChunk(spBuffer);
              spBuffer = new Float32Array(targetChunkSamples);
              spOffset = 0;
            }
          }
        };
        const silentGain = this.audioCtx.createGain();
        silentGain.gain.value = 0;
        this.scriptProcessor.connect(silentGain);
        silentGain.connect(this.audioCtx.destination);
        voiceDebugStore.recordAudioContextInit(sourceSampleRate, 'ScriptProcessor', actualChunkMs);
      }

      this.attachMicStreamToAudioGraph(this.micStream);
      this.startVisualizer();

      await this.setupSingleAudioOutputRoute();

      return true;
    } catch (e: any) {
      const isDenied =
        e?.name === 'NotAllowedError' ||
        e?.name === 'PermissionDeniedError' ||
        String(e?.message || '').toLowerCase().includes('denied');
      const msg = isDenied ? 'মাইক অনুমতি নেই' : `মাইক ত্রুটি: ${e?.message || e}`;
      this.lastError = msg;
      voiceDebugStore.recordError(msg);
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
    if (!this.isCurrentSession()) return false;
    this.stopAllAudioPlayback();
    this.releaseExistingSocketOnly();
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
          saveGlobalResumptionHandle(null);
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
          this.connectedAt = Date.now();
          setCachedResolvedLiveModel(modelName);
          recordLiveModelUsed(modelName);
          updateLiveVoiceCheckStatus({
            liveModelName: modelName,
            voiceName: candidateVoice,
            lastError: null,
          });
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
      const expectedSessionId = this.sessionId;
      if (!this.isCurrentSession(undefined, undefined, expectedSessionId)) {
        resolve(false);
        return;
      }

      this.releaseExistingSocketOnly('superseded');
      const socketSeq = ++this.currentSocketSeq;
      this.activeSocketSeq = socketSeq;

      let settled = false;
      const useAlphaEndpoint =
        includeAffectiveDialog && isAdmin() && this.modelSupportsAffectiveDialog(modelName);
      const apiVersion = useAlphaEndpoint ? 'v1alpha' : 'v1beta';
      const cleanLiveKey = String(apiKey || '').replace(/[\r\n\t\s"']+/g, '').trim();
      const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
      const wsParams = new URLSearchParams({
        assistantName: this.options.assistantName || 'Rose AI',
        ownerName: this.options.ownerName || 'MD YOUSUF KHAN',
        voiceName: voiceNameOverride || (isAdmin() ? ADMIN_PREFERRED_VOICES[0] : this.options.voiceName || 'Sulafat'),
        personality: this.options.personality || 'Normal',
        language: this.options.language || 'bn-BD',
        responseStyle: this.options.responseStyle || 'Balanced',
        model: modelName,
        apiVersion,
      });
      if (cleanLiveKey) {
        wsParams.set('apiKey', cleanLiveKey);
      }
      const directWsUrl = cleanLiveKey
        ? `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(cleanLiveKey)}`
        : `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`;
      let wsUrl = directWsUrl;
      let triedProxy = false;

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
          if (this.activeSocketSeq === socketSeq) {
            this.activeSocketSeq = 0;
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
        if (!this.isCurrentSession(socket, socketSeq, expectedSessionId)) {
          finish(false);
          return;
        }
        const finalLiveInst = this.getEffectiveSystemInstruction();

        const selectedVoiceName =
          voiceNameOverride ||
          (isAdmin() ? ADMIN_PREFERRED_VOICES[0] : this.options.voiceName || 'Sulafat');

        console.log(`[GeminiLive] System prompt: OK (${finalLiveInst.length} chars)`);
        updateLiveVoiceCheckStatus({
          liveModelName: modelName,
          voiceName: selectedVoiceName,
          systemPromptLength: finalLiveInst.length,
        });

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
        const useSmartVadConfig =
          !this.smartVadFailed &&
          !this.nativeVadFallbackToServer &&
          !this.vadConfigRejected &&
          micSettings.smartListen &&
          !micSettings.streetMode;
        this.sentSmartVadDisabledConfig = useSmartVadConfig;

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
          tools: this.skipGrounding
            ? ROSE_TEAM_TOOLS.filter((t: any) => !t.googleSearch)
            : ROSE_TEAM_TOOLS,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          realtimeInputConfig: useSmartVadConfig
            ? {
                automaticActivityDetection: {
                  disabled: true,
                },
              }
            : {
                automaticActivityDetection: {
                  startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
                  endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
                  prefixPaddingMs: 100,
                  silenceDurationMs: 500,
                },
              },
        };

        if (this.vadConfigRejected) {
          delete setupPayload.realtimeInputConfig;
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
          socket?.send(JSON.stringify({ setup: setupPayload, apiVersion }));
        } catch {
          finish(false);
        }
      };

      socket.onmessage = async (event) => {
        if (!this.isCurrentSession(socket, socketSeq, expectedSessionId)) {
          console.warn('[GeminiLive] Ignoring message from closing/stale session/socket:', {
            messageSessionId: expectedSessionId,
            activeSessionId: activeGlobalLiveSession?.sessionId || null,
            lifecycleState: this.sessionLifecycleState,
          });
          try {
            socket?.close();
          } catch {}
          return;
        }
        this.messagesReceived++;
        try {
          const raw = typeof event.data === 'string' ? event.data : await (event.data as Blob).text();
          if (!this.isCurrentSession(socket, socketSeq, expectedSessionId)) return;
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
              saveGlobalResumptionHandle(newHandle);
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
            if (this.isCurrentSession(socket, socketSeq, expectedSessionId)) {
              void this.handleLiveDisconnectAndAutoReconnect(apiKey, `goAway (timeLeft: ${timeLeft})`);
            }
            return;
          }

          if (msg.error) {
            const rawErrCode = msg.error?.code || msg.error?.status || 0;
            const safeErr = this.sanitizeLogText(
              String(msg.error?.message || msg.error?.status || 'server_error')
            );
            console.log('[GeminiLive] Server error message — reason:', safeErr);
            const formattedErr = parseAndFormatGeminiError(rawErrCode, safeErr);
            this.lastError = formattedErr.bengali;
            voiceDebugStore.recordError(formattedErr.bengali);
            updateLiveVoiceCheckStatus({ lastError: formattedErr.bengali });
            
            // Check if VAD / Smart Listening config was rejected
            const lowerErrForVad = safeErr.toLowerCase();
            if (
              lowerErrForVad.includes('automatic_activity_detection') ||
              lowerErrForVad.includes('automaticactivitydetection') ||
              lowerErrForVad.includes('realtime_input_config') ||
              lowerErrForVad.includes('realtimeinputconfig') ||
              lowerErrForVad.includes('activity_detection') ||
              (this.sentSmartVadDisabledConfig && lowerErrForVad.includes('disabled'))
            ) {
              console.warn('[GeminiLive] Server rejected VAD config. Falling back:', safeErr);
              if (this.sentSmartVadDisabledConfig) {
                this.smartVadFailed = true;
                this.sentSmartVadDisabledConfig = false;
                saveMicListeningSettings({ smartListen: false });
                updateSmartVadTelemetry({ ready: false, loading: false, speechDetected: false, probability: 0, error: safeErr });
                void this.cleanupSmartMicVad();
                this.options.onToast?.(`Smart Listening বন্ধ: ${safeErr || 'সার্ভার এই কনফিগ নেয়নি'}`);
              } else {
                this.vadConfigRejected = true;
                const micSettings = getMicListeningSettings();
                if (micSettings.fastReply) {
                  saveMicListeningSettings({ fastReply: false });
                  this.options.onToast?.("Fast reply এই মডেলে চলে না");
                }
              }
              if (!settled) {
                finish(false);
                return;
              }
              if (this.isCurrentSession(socket, socketSeq, expectedSessionId)) {
                void this.handleLiveDisconnectAndAutoReconnect(apiKey, 'vad_config_rejected', 1);
              }
              return;
            }

            const lowerReason = safeErr.toLowerCase();
            const isFatalQuotaOrAuth =
              Number(rawErrCode) === 429 ||
              Number(rawErrCode) === 401 ||
              Number(rawErrCode) === 403 ||
              lowerReason.includes('quota') ||
              lowerReason.includes('resource_exhausted') ||
              lowerReason.includes('429') ||
              lowerReason.includes('api key') ||
              lowerReason.includes('permission_denied') ||
              lowerReason.includes('unauthenticated');

            if (!settled) {
              if (isFatalQuotaOrAuth) {
                this.options.onError?.(formattedErr.bengali, formattedErr.original);
              }
              finish(false);
              return;
            }
            if (this.isCurrentSession(socket, socketSeq, expectedSessionId)) {
              this.options.onError?.(formattedErr.bengali, formattedErr.original);
              if (isFatalQuotaOrAuth) {
                this.failAndEndSessionCleanly(formattedErr.bengali);
                return;
              }
              if (lowerReason.includes('video') || lowerReason.includes('media_chunk') || lowerReason.includes('mediachunk') || lowerReason.includes('image')) {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('live-camera-unsupported'));
                }
              }
              if (lowerReason.includes('google_search') || lowerReason.includes('grounding')) {
                this.skipGrounding = true;
                void this.handleLiveDisconnectAndAutoReconnect(apiKey, 'grounding_tool_rejected', 1);
              } else {
                void this.handleLiveDisconnectAndAutoReconnect(apiKey, formattedErr.bengali);
              }
            }
            return;
          }

          if (msg.setupComplete) {
            this.isSetupComplete = true;
            updateLiveVoiceCheckStatus({ lastError: null });
            const rawLang = String(this.options.language || '').trim().toLowerCase();
            const primingText =
              !rawLang || rawLang === 'auto' || rawLang.startsWith('bn')
                ? 'মনে রেখো: এই কলে তুমি শুধু বাংলায় কথা বলবে।'
                : rawLang.startsWith('en')
                  ? 'Remember: in this call you will speak only in English.'
                  : rawLang.startsWith('hi')
                    ? 'याद रखो: इस कॉल में तुम केवल हिंदी में बात करोगी।'
                    : rawLang.startsWith('ur')
                      ? 'یاد رکھو: اس کال میں تم صرف اردو میں بات کرو گی۔'
                      : rawLang.startsWith('ar')
                        ? 'تذكري: في هذه المكالمة ستتحدثين باللغة العربية فقط.'
                        : 'মনে রেখো: এই কলে তুমি শুধু বাংলায় কথা বলবে।';
            try {
              socket?.send(
                JSON.stringify({
                  clientContent: {
                    turns: [
                      {
                        role: 'user',
                        parts: [{ text: primingText }],
                      },
                    ],
                    turnComplete: false,
                  },
                })
              );
            } catch {}
            this.flushBufferedInitialMicChunks();
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
        if (!this.isCurrentSession(socket, socketSeq, expectedSessionId)) {
          finish(false);
          return;
        }
        console.log('[GeminiLive] WebSocket error event');
        if (!settled) {
          finish(false);
        } else if (this.isCurrentSession(socket, socketSeq, expectedSessionId)) {
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
        const lowerClose = safeReason.toLowerCase();
        const isQuotaOrAuthClose =
          lowerClose.includes('quota') ||
          lowerClose.includes('resource_exhausted') ||
          lowerClose.includes('429') ||
          lowerClose.includes('api key') ||
          lowerClose.includes('permission_denied') ||
          lowerClose.includes('unauthenticated');

        if (event?.reason && event.reason !== 'no reason') {
          const inferredStatus =
            lowerClose.includes('quota') || lowerClose.includes('resource_exhausted') || lowerClose.includes('429')
              ? 429
              : lowerClose.includes('api key') || lowerClose.includes('permission_denied')
              ? 403
              : event.code || 0;
          const formattedClose = parseAndFormatGeminiError(inferredStatus, safeReason);
          this.lastError = formattedClose.bengali;
          voiceDebugStore.recordError(formattedClose.bengali);
          if (isQuotaOrAuthClose) {
            this.options.onError?.(formattedClose.bengali, formattedClose.original);
          }
        }

        if (!this.isCurrentSession(socket, socketSeq, expectedSessionId)) {
          finish(false);
          return;
        }

        if (!settled) {
          if (
            this.sentSmartVadDisabledConfig &&
            (lowerClose.includes('automatic_activity_detection') ||
              lowerClose.includes('automaticactivitydetection') ||
              lowerClose.includes('realtime_input_config') ||
              lowerClose.includes('realtimeinputconfig') ||
              lowerClose.includes('activity_detection') ||
              lowerClose.includes('disabled'))
          ) {
            this.smartVadFailed = true;
            this.sentSmartVadDisabledConfig = false;
            saveMicListeningSettings({ smartListen: false });
            updateSmartVadTelemetry({ ready: false, loading: false, speechDetected: false, probability: 0, error: safeReason });
            void this.cleanupSmartMicVad();
            this.options.onToast?.(`Smart Listening বন্ধ: ${safeReason || 'সার্ভার এই কনফিগ নেয়নি'}`);
            finish(false);
            return;
          }
          finish(false);
        } else if (this.isCurrentSession(socket, socketSeq, expectedSessionId)) {
          if (isQuotaOrAuthClose && this.lastError) {
            this.failAndEndSessionCleanly(this.lastError);
            return;
          }
          if (this.isWarmOnly) {
            this.warmReady = false;
            this.options.onWarmReadyChange?.(false);
            this.releaseExistingSocketOnly('warm_idle_closed');
            return;
          }
          void this.handleLiveDisconnectAndAutoReconnect(
            apiKey,
            this.lastError || `close (code: ${event?.code ?? 'unknown'}, reason: ${safeReason})`
          );
        }
      };
    });
  }

  private async handleLiveToolCall(socket: WebSocket, toolCall: any) {
    if (!this.isCurrentSession(socket)) return;
    const calls = toolCall?.functionCalls || toolCall?.function_calls || [];
    if (!Array.isArray(calls) || calls.length === 0) return;

    const functionResponses: any[] = [];

    for (const call of calls) {
      const callId = call.id || 'call_' + Date.now();
      const name = call.name;
      const args = call.args || {};

      console.log('[GeminiLive] Executing tool call:', name, args);

      try {
        if (name === 'office_task') {
          this.phoneToolHandledForTurn = true;
          const officeRes = await executeOfficeTaskTool({
            agent: String(args.agent || 'mira'),
            kind: String(args.kind || 'task'),
            text: String(args.text || args.instruction || ''),
          });
          functionResponses.push({
            id: callId,
            name: 'office_task',
            response: {
              output: {
                ok: officeRes.ok,
                taskId: officeRes.row.id,
                message: officeRes.message,
                instruction: `Say ONLY this exact sentence in Bengali right away: "${officeRes.message}". Do not add anything else.`,
              },
            },
          });
        } else if (name === 'assign_task') {
          this.phoneToolHandledForTurn = true;
          const res = await assignTask({
            agent: String(args.agent || 'mira'),
            instruction: String(args.instruction || ''),
            source: typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'pc' : 'mobile',
          });
          functionResponses.push({
            id: callId,
            name: 'assign_task',
            response: {
              output: {
                success: res.success,
                message: res.message,
                taskId: res.task.id,
                instruction: `Say ONLY this exact sentence in Bengali right away: "${res.message}".`,
              },
            },
          });
        } else if (name === 'get_team_status') {
          this.phoneToolHandledForTurn = true;
          const res = await getTeamStatus(args.agent ? String(args.agent) : 'mira');
          functionResponses.push({
            id: callId,
            name: 'get_team_status',
            response: {
              output: {
                success: res.success,
                message: res.summary,
                instruction: `Say ONLY this exact sentence in Bengali right away: "${res.summary}".`,
              },
            },
          });
        } else if (name === 'app_action') {
          try {
            const action = String(args.action || '').toLowerCase();
            const pageId = String(args.page || '');
            const num = typeof args.number === 'number' ? args.number : parseInt(args.number, 10);

            let ok = false;
            let targetPage = pageId;

            if (action === 'open' && pageId) {
              ok = await openPage(pageId);
            } else if (action === 'back') {
              ok = await goBack();
              targetPage = currentPage();
            } else if (action === 'home') {
              ok = await openPage('home');
              targetPage = 'home';
            } else if (action === 'open_number' && !isNaN(num) && num > 0) {
              const res = await openNumber(num);
              ok = res.ok;
              targetPage = res.page || '';
            } else if (action === 'clear_chat') {
              try {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('iyabd_chat_history');
                  localStorage.removeItem('rose_messages');
                  window.dispatchEvent(new CustomEvent('clear-chat-history'));
                }
                ok = true;
                targetPage = currentPage();
              } catch {
                ok = false;
              }
            } else if (action === 'camera_on') {
              if (isAdmin() && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('live-camera-command', { detail: { command: 'on' } }));
                ok = true;
                targetPage = currentPage();
              } else {
                ok = false;
              }
            } else if (action === 'camera_off') {
              if (isAdmin() && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('live-camera-command', { detail: { command: 'off' } }));
                ok = true;
                targetPage = currentPage();
              } else {
                ok = false;
              }
            } else if (action === 'camera_switch') {
              if (isAdmin() && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('live-camera-command', { detail: { command: 'switch' } }));
                ok = true;
                targetPage = currentPage();
              } else {
                ok = false;
              }
            }

            functionResponses.push({
              response: {
                output: {
                  ok,
                  page: targetPage,
                },
              },
              id: callId,
            });
          } catch (err: any) {
            console.warn('[GeminiLive] app_action error:', err);
            functionResponses.push({
              response: {
                output: {
                  ok: false,
                  page: '',
                },
              },
              id: callId,
            });
          }
        } else if (
          name === 'phone' ||
          name === 'phone_call' ||
          name === 'whatsapp_call' ||
          name === 'whatsapp_send' ||
          name === 'whatsapp_message' ||
          name === 'messenger_send' ||
          name === 'messenger_recipient' ||
          name === 'post_video' ||
          name === 'app_search' ||
          name === 'confirm_action' ||
          name === 'phone_confirm' ||
          name === 'save_contact_alias'
        ) {
          this.phoneToolHandledForTurn = true;
          this.liveAssistantBuffer = '';
          this.isRoseTurnActive = false;
          this.interruptPlayback();
          const phoneRes = await executePhoneToolActionByName(name, args || {});
          functionResponses.push({
            id: callId,
            name,
            response: {
              output: {
                ok: phoneRes.ok,
                message: phoneRes.message,
                instruction: `Say exactly this to the user: "${phoneRes.message}". Do not add anything else and do not give your own answer.`,
                ...(phoneRes.contacts ? { contacts: phoneRes.contacts } : {}),
              },
            },
          });
        } else if (name === 'pc_task') {
          this.phoneToolHandledForTurn = true;
          const pcRes = await executePcTaskTool(args || {});
          functionResponses.push({
            id: callId,
            name: 'pc_task',
            response: {
              output: {
                ok: pcRes.ok,
                taskId: pcRes.taskId || null,
                message: pcRes.message,
                instruction: `Say exactly this in Bengali: "${pcRes.message}". Do not pretend the task is done yet; the result will arrive in the background.`,
              },
            },
          });
        } else if (name === 'end_call') {
          this.phoneToolHandledForTurn = true;
          this.pendingEndCallAfterSpeech = true;
          this.endCallReceivedAudioAfterTool = false;
          this.liveTurnCompleted = false;
          if (this.endCallFallbackTimer) {
            clearTimeout(this.endCallFallbackTimer);
          }
          this.endCallFallbackTimer = setTimeout(() => {
            if (
              this.isCurrentSession() &&
              this.pendingEndCallAfterSpeech &&
              this.scheduledAudioSources.length === 0 &&
              this.pendingPcmSamplesCount === 0 &&
              !this.isBrowserTtsSpeaking
            ) {
              this.triggerEndCallCleanup();
            }
          }, 5500);
          functionResponses.push({
            id: callId,
            name: 'end_call',
            response: {
              output: {
                ok: true,
                message: 'ঠিক আছে, রাখছি।',
                instruction: 'Say one short goodbye in Bengali (e.g. "ঠিক আছে, রাখছি।") and nothing else.',
              },
            },
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

    if (this.isCurrentSession(socket) && socket.readyState === WebSocket.OPEN && functionResponses.length > 0) {
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
    this.isRoseTurnActive = false;

    this.releaseExistingSocketOnly('reconnect_cleanup');

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
    void this.cleanupSmartMicVad();
    this.teardownBackgroundAudioElement();
    this.disconnectAllMicAndAudioNodes();
  }

  private failAndEndSessionCleanly(message: string) {
    this.stop();
    this.lastError = message;
    try {
      logDevError({
        area: 'live',
        message: message || 'Live session ended with failure',
        model: this.connectedModelName || undefined,
      });
    } catch (e) {}
    this.options.onReconnectStatus?.('failed', message);
    this.options.onError?.(message);
    this.options.onClose?.({ reason: message });
  }

  public async handleLiveDisconnectAndAutoReconnect(
    apiKey: string,
    reason: string = 'disconnect',
    maxAttempts: number = 3
  ): Promise<void> {
    if (
      this.wasStoppedByUser ||
      this.sessionLifecycleState !== 'active' ||
      activeGlobalLiveSession !== this ||
      this.isReconnecting ||
      globalReconnectLock
    ) {
      return;
    }
    globalReconnectLock = true;
    this.isReconnecting = true;
    this.isRoseTurnActive = false;

    const cleanKey = (apiKey || this.cachedApiKey || getGeminiKey() || '')
      .replace(/[\r\n\t\s"']+/g, '')
      .trim();

    // Close any older session/socket and disconnect all mic streams & audio nodes BEFORE opening the new one
    if (activeGlobalLiveSession && activeGlobalLiveSession !== this) {
      try {
        activeGlobalLiveSession.stop();
      } catch {}
    }
    const oldSessionId = this.sessionId;
    const newSessionId = `live_${++globalLiveSessionCounter}_${Date.now()}`;
    this.sessionLifecycleState = 'closing';
    this.releaseSessionAudioAndSocketForReconnect();
    console.log(`RECONNECT old=${oldSessionId} new=${newSessionId}`);

    // Notify call banner UI to show "Reconnecting…"
    this.options.onReconnectStatus?.('reconnecting', 'Reconnecting…');

    const delays = [500, 1000, 2000];

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (this.wasStoppedByUser || activeGlobalLiveSession !== this) return;
        const delayMs = delays[Math.min(attempt - 1, delays.length - 1)];
        console.log(
          `[GeminiLive] Reconnect attempt ${attempt}/${maxAttempts} in ${delayMs}ms (old=${oldSessionId}, new=${newSessionId}, reason: ${this.sanitizeLogText(reason)}, resumptionHandle: ${
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

        if (this.wasStoppedByUser || activeGlobalLiveSession !== this) return;

        // Promote to the new session ID only after previous socket, mic stream, and audio nodes are disconnected
        this.sessionId = newSessionId;
        this.sessionLifecycleState = 'active';

        // Re-initialize fresh AudioContext, mic stream, audio nodes and Smart VAD after reconnect
        this.closeSmartTurn();
        await this.cleanupSmartMicVad();
        const audioReady = await this.initAudioAndAnalyzers();
        if (!audioReady || this.wasStoppedByUser || activeGlobalLiveSession !== this) {
          this.sessionLifecycleState = 'closing';
          this.releaseSessionAudioAndSocketForReconnect();
          continue;
        }

        if (this.isSmartListenLiveActive()) {
          await this.initSmartMicVad(true);
        }

        const failedEarly = this.connectedAt > 0 && Date.now() - this.connectedAt < 5000;
        if (failedEarly && this.connectedModelName) {
          const badModel = this.connectedModelName;
          console.warn(`[GeminiLive] Model ${badModel} failed/closed within 5s. Removing and trying next LIVE model.`);
          removeUnsupportedModel(badModel);
          this.liveModels = this.liveModels.filter((m) => m !== badModel);
          this.connectedModelName = null;
          this.connectedAt = 0;
          try {
            localStorage.removeItem('rose_resolved_live_model');
          } catch {}
        }

        if (this.liveModels.length === 0 && cleanKey) {
          try {
            const discovered = await discoverVoiceModelsFromListModels(cleanKey, true);
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
          : this.liveModels.slice(0, 4);

        let reconnected = false;
        if (orderedCandidates.length > 0 && !getMicListeningSettings().streetMode) {
          reconnected = await this.tryConnectLiveModels(cleanKey, orderedCandidates, 5500);
        }

        if (reconnected && this.isCurrentSession()) {
          console.log(`[GeminiLive] Reconnect attempt ${attempt}/${maxAttempts} succeeded`, {
            oldSessionId,
            sessionId: this.sessionId,
            audioRoute: this.activeAudioRoute,
          });
          this.isFallbackMode = false;
          this.activeMode = 'live';
          this.socketStatus = 'open';
          this.awaitingReplySince = 0;
          this.isReconnecting = false;
          this.warmReady = true;
          this.options.onWarmReadyChange?.(true);
          this.options.onReconnectStatus?.('connected');
          await this.finishSpeakingAndReturnToListening(0);
          return;
        }

        // Release nodes from failed attempt before next attempt
        this.sessionLifecycleState = 'closing';
        this.releaseSessionAudioAndSocketForReconnect();
      }

      if (!this.wasStoppedByUser && activeGlobalLiveSession === this) {
        console.log(
          `[GeminiLive] All ${maxAttempts} reconnect attempts failed. Ending call cleanly.`
        );
        this.isReconnecting = false;
        this.failAndEndSessionCleanly('Connection lost, tap to start again');
      }
    } finally {
      this.isReconnecting = false;
      globalReconnectLock = false;
      if (this.wasStoppedByUser) {
        this.sessionLifecycleState = 'closed';
      }
    }
  }

  private liveUserBuffer = '';
  private liveAssistantBuffer = '';
  private liveStreetAllowed = true;
  private suppressedForeignTranscript = false;

  private hasDisallowedTranscriptScript(text: string): boolean {
    if (!text) return false;
    try {
      return /[^\p{Script=Bengali}\p{Script=Latin}\p{N}\p{P}\p{Z}\p{S}\s]/u.test(text);
    } catch {
      return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0900-\u097F\u0A00-\u0DFF\u0E00-\u0EFF\u0F00-\u1FFF\u2C00-\uD7FF\uF900-\uFEFF\u0400-\u04FF\u0370-\u03FF\u0590-\u05FF]/.test(
        text
      );
    }
  }

  private handleLiveServerContent(content: any) {
    if (!this.isCurrentSession()) return;

    if (content.inputTranscription?.text) {
      const cleanedChunk = content.inputTranscription.text.replace(/<[^>]*>|\[[^\]]*\]/g, '');
      if (cleanedChunk.length > 0) {
        if (this.hasDisallowedTranscriptScript(cleanedChunk)) {
          this.suppressedForeignTranscript = true;
          if (!this.liveUserBuffer.trim()) {
            this.options.onTranscription?.('user', '…', false);
          }
        } else {
          this.liveUserBuffer += cleanedChunk;
          const combined = this.liveUserBuffer.trim();
          if (combined.length > 0) {
            if (this.hasDisallowedTranscriptScript(combined)) {
              this.suppressedForeignTranscript = true;
              this.options.onTranscription?.('user', '…', false);
            } else {
              this.suppressedForeignTranscript = false;
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
                voiceDebugStore.recordFirstTranscript(combined);
                this.options.onTranscription?.('user', combined, false);
              }
            }
          }
        }
      }
    }

    if (content.outputTranscription?.text) {
      this.awaitingReplySince = 0;
      this.watchdogReconnectedForTurn = false;
      // Flush any buffered user inputTranscription to the USER bubble before starting Rose's bubble
      const pendingUserText = this.liveUserBuffer.trim();
      if (pendingUserText) {
        this.liveUserBuffer = '';
        if (!this.hasDisallowedTranscriptScript(pendingUserText)) {
          this.liveStreetAllowed = passesStreetModeFilter(
            pendingUserText,
            this.options.assistantName,
            consumePushToTalkTurnFlag()
          );
          if (this.liveStreetAllowed) {
            voiceDebugStore.recordFirstTranscript(pendingUserText);
            this.options.onTranscription?.('user', pendingUserText, true);
          }
        } else {
          this.options.onTranscription?.('user', '', true);
        }
      }
      if (!this.liveStreetAllowed) {
        this.stopAllAudioPlayback();
        return;
      }
      if (!this.isRoseTurnActive) {
        this.isRoseTurnActive = true;
        this.interruptPlayback();
        console.log('[GeminiLive] New Rose turn started (outputTranscription) — stopped previous turn audio:', {
          sessionId: this.sessionId,
          audioRoute: this.activeAudioRoute,
        });
      }
      this.liveAssistantBuffer += content.outputTranscription.text;
      const cleanedLive = stripStageCues(this.liveAssistantBuffer).trim();
      if (cleanedLive) {
        this.options.onTranscription?.('assistant', cleanedLive, false);
      }
    }

    if (content.modelTurn) {
      this.awaitingReplySince = 0;
      this.watchdogReconnectedForTurn = false;
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
          if (!this.isRoseTurnActive) {
            this.isRoseTurnActive = true;
            this.interruptPlayback();
            this.needsGainResetForTurn = true;
            console.log('[GeminiLive] New Rose turn started (audio) — stopped previous turn audio:', {
              sessionId: this.sessionId,
              audioRoute: this.activeAudioRoute,
            });
          } else if (this.scheduledAudioSources.length === 0 && this.pendingPcmSamplesCount === 0) {
            this.needsGainResetForTurn = true;
          }
          if (this.pendingEndCallAfterSpeech) {
            this.endCallReceivedAudioAfterTool = true;
          }
          voiceDebugStore.recordFirstRoseAudio();
          this.liveTurnCompleted = false;
          this.pauseMicDuringSpeech();
          this.updateState('speaking');
          this.stateEnteredAt = Date.now();
          this.playPcmAudioChunk(part.inlineData.data);
        }
      }
    }

    if (content.interrupted) {
      this.awaitingReplySince = 0;
      this.liveUserBuffer = '';
      this.liveAssistantBuffer = '';
      this.phoneToolHandledForTurn = false;
      this.liveStreetAllowed = true;
      this.isRoseTurnActive = false;
      this.liveTurnCompleted = true;
      voiceDebugStore.finishTurn();
      this.interruptPlayback();
      this.finishSpeakingAndReturnToListening();
      this.options.onInterrupted?.();
    }

    if (content.turnComplete) {
      this.awaitingReplySince = 0;
      this.watchdogReconnectedForTurn = false;
      const finalUserCandidate = this.liveUserBuffer.trim();
      if (finalUserCandidate && !this.hasDisallowedTranscriptScript(finalUserCandidate)) {
        this.liveStreetAllowed = passesStreetModeFilter(
          finalUserCandidate,
          this.options.assistantName,
          consumePushToTalkTurnFlag()
        );
        if (this.liveStreetAllowed) {
          voiceDebugStore.recordFirstTranscript(finalUserCandidate);
          this.options.onTranscription?.('user', finalUserCandidate, true);
        }
      } else if (this.userStartedSpeakingEmitted || this.suppressedForeignTranscript) {
        this.options.onTranscription?.('user', '', true);
      }
      if (this.liveStreetAllowed && this.liveAssistantBuffer.trim()) {
        const finalCleaned = stripStageCues(
          cleanAssistantReplyText(this.liveAssistantBuffer.trim(), this.options.language)
        );
        if (finalCleaned) {
          this.options.onTranscription?.('assistant', finalCleaned, true);
        }
      }
      const hadAssistantTextInTurn = Boolean(this.liveAssistantBuffer.trim());
      this.liveUserBuffer = '';
      this.liveAssistantBuffer = '';
      this.suppressedForeignTranscript = false;
      this.userStartedSpeakingEmitted = false;
      this.nativeEnergySpeechFrames = 0;
      this.phoneToolHandledForTurn = false;
      this.liveStreetAllowed = true;
      this.isRoseTurnActive = false;
      this.liveTurnCompleted = true;
      voiceDebugStore.finishTurn();
      this.flushPendingPcmChunks(true);
      this.scheduleReplyEndFadeOut();
      if (
        this.pendingEndCallAfterSpeech &&
        !this.endCallReceivedAudioAfterTool &&
        this.scheduledAudioSources.length === 0 &&
        this.pendingPcmSamplesCount === 0
      ) {
        const goodbyeText = 'ঠিক আছে, রাখছি।';
        if (!hadAssistantTextInTurn) {
          this.options.onTranscription?.('assistant', goodbyeText, true);
        }
        this.options.onTurnComplete?.();
        if (this.isFallbackMode && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
          void (async () => {
            try {
              await this.speakReply(this.cachedApiKey, goodbyeText);
            } catch {}
            this.triggerEndCallCleanup();
          })();
        } else {
          this.triggerEndCallCleanup();
        }
        return;
      }
      this.scheduleReturnToListening();
      this.options.onTurnComplete?.();
    }
  }

  // =========================================================================
  // PATH 2: MediaRecorder VAD + Gemini generateContent + TTS/speechSynthesis
  // =========================================================================
  private activateFallbackPath(apiKey: string) {
    if (this.wasStoppedByUser) return;
    this.releaseExistingSocketOnly('fallback_mode');
    this.isFallbackMode = true;
    this.activeMode = 'fallback';
    this.socketStatus = 'open';
    if (this.usingNativeMic) {
      void this.stopNativeMicCapture();
      void this.resumeMicAfterSpeech();
    }
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
    if (!this.isCurrentSession() || this.isProcessingClip) return;
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
              voiceDebugStore.recordFirstTranscript(parsedTrans);
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

      const clipController = new AbortController();
      const clipTimeoutId = setTimeout(() => {
        clipController.abort();
      }, 20000);

      try {
        for (const flashModel of candidates) {
          if (this.wasStoppedByUser) return;
          const cleanClipKey = String(apiKey || '').replace(/[\r\n\t\s"']+/g, '').trim();

          const makeClipPayload = (withThinkingConfig: boolean) => ({
            model: flashModel,
            ...buildClipBody(withThinkingConfig),
            ...(cleanClipKey ? { apiKey: cleanClipKey } : {}),
          });

          try {
            let res = await fetchGeminiStreamWithFallback(makeClipPayload(true), clipController.signal);

            if (res.status === 400 && !this.wasStoppedByUser) {
              res = await fetchGeminiStreamWithFallback(makeClipPayload(false), clipController.signal);
            }

            if (!res.ok) {
              const errRaw = await res.text().catch(() => '');
              const err: any = new Error(errRaw || `HTTP ${res.status}`);
              err.status = res.status;
              lastErr = err;
              if (res.status === 404 || res.status === 503) {
                continue;
              }
              throw err;
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
              const genRes = await fetchGeminiGenerateWithFallback(
                {
                  model: flashModel,
                  ...buildClipBody(false),
                  ...(cleanClipKey ? { apiKey: cleanClipKey } : {}),
                },
                clipController.signal
              );
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
            if (err?.name === 'AbortError') {
              const timeoutErr: any = new Error('HTTP 408: Request timed out after 20s');
              timeoutErr.status = 408;
              lastErr = timeoutErr;
              break;
            }
            lastErr = err;
            if (err?.status && err.status !== 404 && err.status !== 503) {
              break;
            }
          }
        }
      } finally {
        clearTimeout(clipTimeoutId);
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
        const isEndCallVoiceCmd =
          /^(?:হ্যালো\s+|হাই\s+|এই\s+|শোনো\s+)?(?:রোজ\s+|rose\s+)?(?:এখন\s+|প্লিজ\s+|একটু\s+)?(?:ফোন\s*কাটো|ফোনটা\s*কাটো|কল\s*কাটো|কলটা\s*কাটো|কলটা\s*কেটে\s*দাও|ফোনটা\s*কেটে\s*দাও|কল\s*বন্ধ\s*করো|ফোন\s*বন্ধ\s*করো|রাখো|ফোন\s*রাখো|রাখছি|bye|goodbye|end\s*call|hang\s*up|stop\s*call)\s*[।.?!]*$/i.test(
            transcript.trim()
          );
        if (isEndCallVoiceCmd) {
          reply = 'ঠিক আছে, রাখছি।';
          this.pendingEndCallAfterSpeech = true;
          prestartedTtsMap.clear();
        } else {
          const phoneMatch = await routePhoneActionFromText(transcript);
          if (phoneMatch.matched && phoneMatch.reply) {
            reply = phoneMatch.reply;
            prestartedTtsMap.clear();
          }
        }
      }

      if (reply && !this.wasStoppedByUser) {
        const chatCleanReply = stripStageCues(reply);
        if (chatCleanReply) {
          this.conversationHistory.push({ role: 'model', parts: [{ text: chatCleanReply }] });
          this.options.onTranscription?.('assistant', chatCleanReply, true);
        }
        await this.speakReply(apiKey, reply, prestartedTtsMap);
        if (this.pendingEndCallAfterSpeech && !this.wasStoppedByUser) {
          this.options.onTurnComplete?.();
          this.triggerEndCallCleanup();
          return;
        }
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
    if (this.usingNativeMic && !this.isFallbackMode) {
      this.micReleasedAt = 0;
      return;
    }
    if (this.isSmartListenLiveActive() && this.smartVadStarted && !this.isFallbackMode) {
      // Keep micStream & AudioContext running for >=250ms Smart VAD barge-in; zero audio is sent over WS while smartTurnOpen is false
      this.micReleasedAt = 0;
      return;
    }
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
      this.usingNativeMic &&
      !this.isFallbackMode
    ) {
      return;
    }
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
          const isApp = isAndroidApp();
          this.micStream = await getGlobalMicStream({
            audio: isApp
              ? {
                  autoGainControl: true,
                  noiseSuppression: true,
                  echoCancellation: true,
                  channelCount: { ideal: 1 },
                }
              : {
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
    this.userStartedSpeakingEmitted = false;
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
    // Fallback TTS is disabled while a live WebSocket session exists
    if (!this.isFallbackMode || (this.ws && this.ws.readyState === WebSocket.OPEN && this.isSetupComplete)) {
      return;
    }
    const filteredText = cleanAssistantReplyText(text, this.options.language);
    const cleanText = filteredText.replace(/[*#_~`]/g, '').trim();
    if (!cleanText || !this.isCurrentSession()) return;

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
      if (!ctx || !this.isCurrentSession()) {
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

          const { float32 } = decodePcm16ChunkWithCarry(base64Pcm, null);
          if (float32.length <= 0) {
            resolve(false);
            return;
          }

          // SampleRate strictly 24000; browser resamples cleanly to ctx.sampleRate
          voiceDebugStore.recordFirstRoseAudio();
          const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
          audioBuffer.copyToChannel(float32, 0);

          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;

          const speed = Math.min(1.25, Math.max(0.85, this.options.speechSpeed || 1.05));
          source.playbackRate.value = speed;

          const volPercent = this.options.voiceVolume ?? 80;
          const targetGain = volumeSliderToGain(volPercent);

          const { gainNode } = connectBoostedOutputChain(
            ctx,
            source,
            volPercent,
            this.outputAnalyser
          );

          const startTime = Math.max(this.nextStartTime, ctx.currentTime + 0.05);
          const duration = audioBuffer.duration / speed;
          this.nextStartTime = startTime + duration;

          const fadeInSec = Math.min(0.01, duration * 0.35);
          const fadeOutSec = Math.min(0.03, duration * 0.45);
          const fadeOutStart = Math.max(startTime + fadeInSec, startTime + duration - fadeOutSec);

          gainNode.gain.cancelScheduledValues(ctx.currentTime);
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(targetGain, startTime + fadeInSec);
          gainNode.gain.setValueAtTime(targetGain, fadeOutStart);
          gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

          this.stateEnteredAt = Date.now();
          this.scheduledAudioSources.push(source);
          source.onended = () => {
            try {
              source.disconnect();
            } catch {}
            this.scheduledAudioSources = this.scheduledAudioSources.filter((s) => s !== source);
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
      if (
        !this.isFallbackMode ||
        (this.ws && this.ws.readyState === WebSocket.OPEN && this.isSetupComplete) ||
        typeof window === 'undefined' ||
        !('speechSynthesis' in window) ||
        !this.isCurrentSession()
      ) {
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

        // If no matching voice exists (e.g. no bn-BD / bn-IN Bengali voice on device), show the text only — never read Bengali text with an English voice
        if (!chosenVoice || !foundFemale) {
          resolve(false);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(spokenText);
        utterance.voice = chosenVoice;
        utterance.lang = chosenVoice.lang || requestedLang;
        utterance.rate = Math.min(1.25, Math.max(0.85, this.options.speechSpeed || 1.05));
        utterance.pitch = Math.min(1.5, Math.max(0.85, this.options.speechPitch || 1.15));
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
    if (!this.isCurrentSession() || !base64Pcm) return;
    try {
      // Guard against duplicate playback of the exact same chunk
      const chunkKey = `${base64Pcm.length}:${base64Pcm.slice(0, 32)}:${base64Pcm.slice(-32)}`;
      if (chunkKey === this.lastPcmChunkKey) {
        return;
      }
      this.lastPcmChunkKey = chunkKey;

      const { float32, nextLeftoverByte } = decodePcm16ChunkWithCarry(
        base64Pcm,
        this.leftoverPcmByte
      );
      this.leftoverPcmByte = nextLeftoverByte;
      if (float32.length <= 0) return;

      this.pendingPcmChunks.push(float32);
      this.pendingPcmSamplesCount += float32.length;

      // Small jitter buffer: start playing after ~150 ms of audio is queued (3600 samples at 24000 Hz)
      const jitterThresholdSamples = this.isReplyFirstChunk ? 3600 : 1200;
      if (this.pendingPcmSamplesCount >= jitterThresholdSamples) {
        this.flushPendingPcmChunks(false);
      } else {
        if (this.pcmFlushTimer) clearTimeout(this.pcmFlushTimer);
        this.pcmFlushTimer = setTimeout(() => {
          this.flushPendingPcmChunks(true);
        }, 90);
      }
    } catch {}
  }

  private scheduleReplyEndFadeOut() {
    const ctx = this.playbackAudioCtx || this.audioCtx;
    if (!ctx || ctx.state === 'closed') return;
    if (this.scheduledAudioSources.length === 0) return;
    try {
      const volPercent = this.options.voiceVolume ?? 80;
      const targetGain = volumeSliderToGain(volPercent);
      const { gainNode } = getOrCreateBoostedOutputChain(ctx, volPercent, this.outputAnalyser);
      const endTime = Math.max(ctx.currentTime + 0.04, this.nextStartTime);
      const fadeStart = Math.max(ctx.currentTime, endTime - 0.04);
      gainNode.gain.setValueAtTime(targetGain, fadeStart);
      gainNode.gain.linearRampToValueAtTime(0, endTime);
    } catch {}
  }

  private flushPendingPcmChunks(force: boolean) {
    if (this.pcmFlushTimer) {
      clearTimeout(this.pcmFlushTimer);
      this.pcmFlushTimer = null;
    }
    if (!this.isCurrentSession()) {
      this.pendingPcmChunks = [];
      this.pendingPcmSamplesCount = 0;
      this.leftoverPcmByte = null;
      return;
    }
    if (this.pendingPcmSamplesCount <= 0 || this.pendingPcmChunks.length === 0) return;
    const minSamples = this.isReplyFirstChunk ? 3600 : 1200;
    if (!force && this.pendingPcmSamplesCount < minSamples) return;

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
      this.leftoverPcmByte = null;
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

      const startTime = Math.max(this.nextStartTime, ctx.currentTime + 0.05);
      const duration = audioBuffer.duration;
      this.nextStartTime = startTime + duration;

      // Fade-in 10 ms at the start of a reply; keep steady gain across middle chunks
      if (this.needsGainResetForTurn || this.isReplyFirstChunk) {
        this.needsGainResetForTurn = false;
        this.isReplyFirstChunk = false;
        const fadeInSec = Math.min(0.01, duration * 0.4);
        gainNode.gain.cancelScheduledValues(ctx.currentTime);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(targetGain, startTime + fadeInSec);
      }

      // If the turn is already marked complete when flushing the final chunk, schedule 30 ms fade-out
      if (this.liveTurnCompleted) {
        const fadeOutSec = Math.min(0.03, duration * 0.45);
        const fadeOutStart = Math.max(startTime + 0.01, this.nextStartTime - fadeOutSec);
        gainNode.gain.setValueAtTime(targetGain, fadeOutStart);
        gainNode.gain.linearRampToValueAtTime(0, this.nextStartTime);
      }

      this.stateEnteredAt = Date.now();
      this.scheduledAudioSources.push(source);
      source.onended = () => {
        try {
          source.disconnect();
        } catch {}
        this.scheduledAudioSources = this.scheduledAudioSources.filter((s) => s !== source);
        if (
          this.scheduledAudioSources.length === 0 &&
          this.pendingPcmSamplesCount === 0 &&
          this.liveTurnCompleted &&
          !this.wasStoppedByUser
        ) {
          this.isReplyFirstChunk = true;
          this.leftoverPcmByte = null;
          this.lastPcmChunkKey = '';
          if (this.pendingEndCallAfterSpeech) {
            setTimeout(() => {
              this.triggerEndCallCleanup();
            }, 150);
          } else {
            void this.finishSpeakingAndReturnToListening(200);
          }
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

      if (this.usingNativeMic && !this.isMuted && this.currentState !== 'speaking') {
        this.nativeMicLevel *= 0.88;
        this.currentMicLevel = this.nativeMicLevel;
        this.options.onMicVolume?.(this.nativeMicLevel * 255);
      } else if (this.micAnalyser && !this.isMuted && this.currentState !== 'speaking') {
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
    this.leftoverPcmByte = null;
    this.isReplyFirstChunk = true;
    this.lastPcmChunkKey = '';
    const sourcesToStop = this.scheduledAudioSources;
    this.scheduledAudioSources = [];
    this.nextStartTime = 0;
    const ctx = this.playbackAudioCtx || this.audioCtx;
    if (sourcesToStop.length > 0) {
      fadeOutAndStopSources(ctx, sourcesToStop, 0.04);
    } else if (ctx && ctx.state === 'running') {
      try {
        const volPercent = this.options.voiceVolume ?? 80;
        const { gainNode } = getOrCreateBoostedOutputChain(ctx, volPercent, this.outputAnalyser);
        const now = ctx.currentTime;
        const currentVal = Math.min(0.9, Math.max(0, gainNode.gain.value || 0));
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(currentVal, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.04);
      } catch {}
    }
  }

  private scheduleReturnToListening() {
    setTimeout(() => {
      if (!this.isCurrentSession()) return;
      if (
        this.scheduledAudioSources.length === 0 &&
        this.pendingPcmSamplesCount === 0 &&
        !this.isBrowserTtsSpeaking
      ) {
        if (this.pendingEndCallAfterSpeech) {
          this.triggerEndCallCleanup();
        } else {
          this.finishSpeakingAndReturnToListening();
        }
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

  public async startWarmUp(): Promise<boolean> {
    if (this.wasStoppedByUser) return false;
    this.isWarmOnly = true;
    this.warmReady = false;
    this.options.onWarmReadyChange?.(false);
    this.sessionLifecycleState = 'active';
    this.wasStoppedByUser = false;

    const apiKey = (this.options.apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();
    this.cachedApiKey = apiKey;
    if (!(await ensureGeminiReady(apiKey))) return false;

    const micSettings = getMicListeningSettings();
    if (!micSettings.smartListen || micSettings.streetMode) return false;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
          this.audioCtx =
            this.options.audioContext && this.options.audioContext.state !== 'closed'
              ? this.options.audioContext
              : new AudioCtxClass({ sampleRate: 48000, latencyHint: 'interactive' });
        }
        if (!this.playbackAudioCtx || this.playbackAudioCtx.state === 'closed') {
          this.playbackAudioCtx =
            this.options.playbackAudioContext &&
            this.options.playbackAudioContext !== this.audioCtx &&
            this.options.playbackAudioContext.state !== 'closed'
              ? this.options.playbackAudioContext
              : new AudioCtxClass({ sampleRate: 24000, latencyHint: 'interactive' });
        }
      }
    } catch {}

    try {
      const [vadOk, discovered] = await Promise.all([
        this.initSmartMicVad(false),
        discoverVoiceModelsFromListModels(apiKey),
      ]);
      if (this.wasStoppedByUser || !vadOk || this.smartVadFailed) {
        return false;
      }
      this.liveModels = discovered.liveModels;
      this.flashModels = discovered.flashModels;
      this.ttsModels = discovered.ttsModels;
      if (this.liveModels.length === 0) return false;

      const connected = await this.tryConnectLiveModels(apiKey, this.liveModels.slice(0, 3), 8000);
      if (!connected || this.wasStoppedByUser || this.smartVadFailed) {
        return false;
      }

      this.warmReady = true;
      this.options.onWarmReadyChange?.(true);
      updateSmartVadTelemetry({ ready: true, loading: false, error: null });
      return true;
    } catch {
      return false;
    }
  }

  public async activateFromWarmUp(nextOptions: Partial<GeminiLiveOptions>): Promise<boolean> {
    if (!this.isWarmReadyAndOpen()) return false;

    if (activeGlobalLiveSession && activeGlobalLiveSession !== this) {
      activeGlobalLiveSession.sessionLifecycleState = 'closing';
      try {
        activeGlobalLiveSession.stop();
      } catch {}
    }

    this.options = { ...this.options, ...nextOptions, warmUpOnly: false };
    this.isWarmOnly = false;
    this.warmReady = false;
    this.options.onWarmReadyChange?.(false);
    activeGlobalLiveSession = this;
    this.sessionLifecycleState = 'active';
    this.wasStoppedByUser = false;
    this.isFallbackMode = false;
    this.activeMode = 'live';
    this.socketStatus = 'open';
    this.awaitingReplySince = 0;
    this.watchdogReconnectedForTurn = false;
    this.liveUserBuffer = '';
    this.liveAssistantBuffer = '';
    this.suppressedForeignTranscript = false;
    this.phoneToolHandledForTurn = false;
    this.pendingEndCallAfterSpeech = false;
    this.endCallReceivedAudioAfterTool = false;
    this.preSpeechRing = [];
    this.preSpeechSamplesCount = 0;
    this.smartTurnOpen = false;
    this.smartVadSpeaking = false;
    this.bargeInSpeechMs = 0;
    this.updateState('connecting');

    const audioReady = await this.initAudioAndAnalyzers();
    if (!audioReady || this.wasStoppedByUser) {
      this.stopRoseCallPlugin();
      return false;
    }

    if (this.isSmartListenLiveActive()) {
      await this.initSmartMicVad(true);
    }

    this.startRoseCallPlugin();
    this.startWatchdog();
    this.updateState('listening');
    return true;
  }

  public stop() {
    this.stopRoseCallPlugin();
    this.exitPiP();
    this.detachMicSettingsListener();
    this.warmReady = false;
    this.options.onWarmReadyChange?.(false);
    // Drop any audio chunks that arrive after END immediately
    this.sessionLifecycleState = 'closed';
    this.wasStoppedByUser = true;
    this.isReconnecting = false;
    this.visualizerRunning = false;
    this.updateState('off');
    this.socketStatus = 'closed';
    this.isSetupComplete = false;
    this.isFallbackMode = false;
    this.isProcessingClip = false;
    this.isRecordingClip = false;
    this.connectedModelName = null;
    this.awaitingReplySince = 0;
    this.watchdogReconnectedForTurn = false;
    this.liveUserBuffer = '';
    this.liveAssistantBuffer = '';
    this.pendingMicPcmBase64Queue = [];
    this.leftoverPcmByte = null;
    this.pendingEndCallAfterSpeech = false;
    this.endCallReceivedAudioAfterTool = false;
    if (this.endCallFallbackTimer) {
      clearTimeout(this.endCallFallbackTimer);
      this.endCallFallbackTimer = null;
    }
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

    // Detach socket incoming message handlers immediately so any chunks arriving after END are dropped
    const sockToCloseAfterFade = this.ws;
    if (sockToCloseAfterFade) {
      try {
        sockToCloseAfterFade.onopen = null;
        sockToCloseAfterFade.onmessage = null;
        sockToCloseAfterFade.onerror = null;
        sockToCloseAfterFade.onclose = null;
      } catch {}
    }

    const hadScheduledAudio = this.scheduledAudioSources.length > 0;
    this.isRoseTurnActive = false;
    // Ramp output gain to 0 over 40 ms, then stop all scheduled sources, clear queue, disconnect nodes
    this.interruptPlayback();

    void this.cleanupSmartMicVad();

    this.clearMediaSession();
    this.teardownBackgroundAudioElement();
    // Stop mic tracks and mic processor on END so no mic sound loops into the speaker
    this.disconnectAllMicAndAudioNodes();

    if (this.playbackAudioCtx && this.playbackAudioCtx.state !== 'closed') {
      try {
        configureBoostedOutputRoute(
          this.playbackAudioCtx,
          'direct',
          null,
          null,
          this.options.voiceVolume,
          this.sessionId
        );
      } catch {}
    }
    this.activeAudioRoute = 'direct';

    if (activeGlobalLiveSession === this) {
      activeGlobalLiveSession = null;
    }

    // Close the Live socket AFTER the 40 ms fade
    if (hadScheduledAudio && sockToCloseAfterFade) {
      this.ws = null;
      this.activeSocketSeq = 0;
      setTimeout(() => {
        try {
          if (
            sockToCloseAfterFade.readyState === WebSocket.OPEN ||
            sockToCloseAfterFade.readyState === WebSocket.CONNECTING
          ) {
            sockToCloseAfterFade.close(1000, 'stopped');
          }
        } catch {}
      }, 45);
    } else {
      this.releaseExistingSocketOnly('stopped');
    }
  }
}
