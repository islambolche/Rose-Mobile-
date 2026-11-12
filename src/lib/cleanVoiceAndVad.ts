import * as ort from 'onnxruntime-web/wasm';

export type MicSensitivityLevel = 'low' | 'medium' | 'high';
export type NoiseGateSensitivity = 'Low' | 'Medium' | 'High';

export interface MicListeningSettings {
  cleanVoice: boolean;
  noiseGate: boolean;
  noiseGateSensitivity: NoiseGateSensitivity;
  fastReply: boolean;
  smartListen: boolean;
  streetMode: boolean;
  micSensitivity: MicSensitivityLevel;
}

const STORAGE_KEY_CLEAN_VOICE = 'rose_clean_voice';
const STORAGE_KEY_NOISE_GATE = 'rose_noise_gate';
const STORAGE_KEY_NOISE_GATE_SENS = 'rose_noise_gate_sens';
const STORAGE_KEY_FAST_REPLY = 'rose_fast_reply';
const STORAGE_KEY_SMART_LISTEN = 'rose_smart_listen';
const STORAGE_KEY_STREET_MODE = 'rose_street_mode';
const STORAGE_KEY_MIC_SENSITIVITY = 'rose_mic_sensitivity';
const STORAGE_KEY_MIGRATION_RESET_V3 = 'rose_audio_defaults_v3_reset';

export function getMicListeningSettings(): MicListeningSettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        cleanVoice: false,
        noiseGate: false,
        noiseGateSensitivity: 'Medium',
        fastReply: false,
        smartListen: true,
        streetMode: false,
        micSensitivity: 'medium',
      };
    }

    // Migration requirement 5: On app start, reset these four to Off once if migration key not set
    if (localStorage.getItem(STORAGE_KEY_MIGRATION_RESET_V3) !== 'true') {
      localStorage.setItem(STORAGE_KEY_CLEAN_VOICE, 'false');
      localStorage.setItem(STORAGE_KEY_NOISE_GATE, 'false');
      localStorage.setItem(STORAGE_KEY_FAST_REPLY, 'false');
      localStorage.setItem(STORAGE_KEY_STREET_MODE, 'false');
      localStorage.setItem(STORAGE_KEY_MIGRATION_RESET_V3, 'true');
    }

    const rawClean = localStorage.getItem(STORAGE_KEY_CLEAN_VOICE);
    const rawGate = localStorage.getItem(STORAGE_KEY_NOISE_GATE);
    const rawGateSens = localStorage.getItem(STORAGE_KEY_NOISE_GATE_SENS);
    const rawFast = localStorage.getItem(STORAGE_KEY_FAST_REPLY);
    const rawSmart = localStorage.getItem(STORAGE_KEY_SMART_LISTEN);
    const rawStreet = localStorage.getItem(STORAGE_KEY_STREET_MODE);
    const rawSens = localStorage.getItem(STORAGE_KEY_MIC_SENSITIVITY);

    const streetMode = rawStreet === 'true';

    // When streetMode is active: automatically Noise Filter ON, Noise Gate ON (High sensitivity)
    const cleanVoice = streetMode ? true : rawClean === 'true';
    const noiseGate = streetMode ? true : rawGate === 'true';
    const noiseGateSensitivity: NoiseGateSensitivity = streetMode
      ? 'High'
      : rawGateSens === 'Low' || rawGateSens === 'Medium' || rawGateSens === 'High'
      ? rawGateSens
      : 'Medium';
    const fastReply = streetMode ? true : rawFast === 'true';
    const smartListen = rawSmart === null ? true : rawSmart === 'true';
    const micSensitivity: MicSensitivityLevel =
      rawSens === 'low' || rawSens === 'medium' || rawSens === 'high' ? rawSens : 'medium';

    return { cleanVoice, noiseGate, noiseGateSensitivity, fastReply, smartListen, streetMode, micSensitivity };
  } catch {
    return {
      cleanVoice: false,
      noiseGate: false,
      noiseGateSensitivity: 'Medium',
      fastReply: false,
      smartListen: true,
      streetMode: false,
      micSensitivity: 'medium',
    };
  }
}

export function saveMicListeningSettings(partial: Partial<MicListeningSettings>): MicListeningSettings {
  const current = getMicListeningSettings();
  let next: MicListeningSettings = {
    ...current,
    ...partial,
  };

  // Preset behavior for Street Mode
  if (partial.streetMode === true) {
    next.cleanVoice = true;
    next.noiseGate = true;
    next.noiseGateSensitivity = 'High';
    next.fastReply = true;
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_CLEAN_VOICE, String(next.cleanVoice));
      localStorage.setItem(STORAGE_KEY_NOISE_GATE, String(next.noiseGate));
      localStorage.setItem(STORAGE_KEY_NOISE_GATE_SENS, next.noiseGateSensitivity);
      localStorage.setItem(STORAGE_KEY_FAST_REPLY, String(next.fastReply));
      localStorage.setItem(STORAGE_KEY_SMART_LISTEN, String(next.smartListen));
      localStorage.setItem(STORAGE_KEY_STREET_MODE, String(next.streetMode));
      localStorage.setItem(STORAGE_KEY_MIC_SENSITIVITY, next.micSensitivity);
    }
  } catch {}
  return next;
}

export function resetAudioSettings(): MicListeningSettings {
  const defaults: MicListeningSettings = {
    cleanVoice: false,
    noiseGate: false,
    noiseGateSensitivity: 'Medium',
    fastReply: false,
    smartListen: true,
    streetMode: false,
    micSensitivity: 'medium',
  };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_CLEAN_VOICE, 'false');
      localStorage.setItem(STORAGE_KEY_NOISE_GATE, 'false');
      localStorage.setItem(STORAGE_KEY_NOISE_GATE_SENS, 'Medium');
      localStorage.setItem(STORAGE_KEY_FAST_REPLY, 'false');
      localStorage.setItem(STORAGE_KEY_SMART_LISTEN, 'true');
      localStorage.setItem(STORAGE_KEY_STREET_MODE, 'false');
      localStorage.setItem(STORAGE_KEY_MIC_SENSITIVITY, 'medium');
    }
  } catch {}
  return defaults;
}

export function getSensitivityThresholds(level: MicSensitivityLevel = 'medium') {
  switch (level) {
    case 'low':
      return {
        vadPositive: 0.68,
        vadNegative: 0.50,
        volStart: 0.058,
        volKeep: 0.040,
        labelBn: 'কম',
      };
    case 'high':
      return {
        vadPositive: 0.35,
        vadNegative: 0.22,
        volStart: 0.024,
        volKeep: 0.017,
        labelBn: 'বেশি',
      };
    case 'medium':
    default:
      return {
        vadPositive: 0.50,
        vadNegative: 0.35,
        volStart: 0.038,
        volKeep: 0.026,
        labelBn: 'মাঝারি',
      };
  }
}

// ============================================================================
// Street Mode (রাস্তা মোড) Wake-Word & Push-to-Talk Check
// ============================================================================
let globalPushToTalkActive = false;
let globalPushToTalkUsedInCurrentTurn = false;

export function setPushToTalkActive(active: boolean) {
  globalPushToTalkActive = active;
  if (active) {
    globalPushToTalkUsedInCurrentTurn = true;
  }
}

export function isPushToTalkCurrentlyActive(): boolean {
  return globalPushToTalkActive;
}

export function consumePushToTalkTurnFlag(): boolean {
  const used = globalPushToTalkActive || globalPushToTalkUsedInCurrentTurn;
  if (!globalPushToTalkActive) {
    globalPushToTalkUsedInCurrentTurn = false;
  }
  return used;
}

export function resetPushToTalkTurnFlag() {
  if (!globalPushToTalkActive) {
    globalPushToTalkUsedInCurrentTurn = false;
  }
}

export function hasRoseWakeName(transcript: string, customAssistantName?: string): boolean {
  if (!transcript) return false;
  const text = String(transcript).trim();
  if (!text) return false;
  if (/\b(rose)\b|রোজ|রোস|রোজা/i.test(text)) {
    return true;
  }
  if (customAssistantName) {
    const cleanCustom = customAssistantName.replace(/\s+AI$/i, '').trim();
    if (cleanCustom && cleanCustom.length >= 2) {
      const escaped = cleanCustom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(escaped, 'i').test(text)) {
        return true;
      }
    }
  }
  return false;
}

export function passesStreetModeFilter(
  transcript: string,
  customAssistantName?: string,
  pushToTalkUsed?: boolean
): boolean {
  const { streetMode } = getMicListeningSettings();
  if (!streetMode) return true;
  if (pushToTalkUsed || globalPushToTalkActive || globalPushToTalkUsedInCurrentTurn) {
    return true;
  }
  return hasRoseWakeName(transcript, customAssistantName);
}

// ============================================================================
// Background Preloading for RNNoise WASM & Silero VAD ONNX
// ============================================================================
let cachedRnnoiseWasmBinary: ArrayBuffer | null = null;
let rnnoiseFetchPromise: Promise<ArrayBuffer | null> | null = null;

export function loadRnnoiseWasmBinary(): Promise<ArrayBuffer | null> {
  if (cachedRnnoiseWasmBinary) {
    return Promise.resolve(cachedRnnoiseWasmBinary);
  }
  if (rnnoiseFetchPromise) {
    return rnnoiseFetchPromise;
  }
  rnnoiseFetchPromise = (async () => {
    try {
      const res = await fetch('/rnnoise.wasm', { credentials: 'same-origin' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const buf = await res.arrayBuffer();
      cachedRnnoiseWasmBinary = buf;
      console.log('[Rose Clean Voice] RNNoise WASM loaded locally (/rnnoise.wasm)');
      return buf;
    } catch (err) {
      console.warn('[Rose Clean Voice] RNNoise WASM load failed, using fallback:', err);
      rnnoiseFetchPromise = null;
      return null;
    }
  })();
  return rnnoiseFetchPromise;
}

let cachedSileroModelBuffer: ArrayBuffer | null = null;
let sileroFetchPromise: Promise<ArrayBuffer | null> | null = null;
let ortConfigured = false;

function ensureOrtConfigured() {
  if (ortConfigured) return;
  try {
    ort.env.wasm.wasmPaths = '/';
    ort.env.wasm.numThreads = 1;
    ort.env.logLevel = 'error';
    ortConfigured = true;
  } catch (err) {
    console.warn('[Rose Smart Listen] Failed configuring onnxruntime-web:', err);
  }
}

export function loadSileroModelBinary(): Promise<ArrayBuffer | null> {
  if (cachedSileroModelBuffer) {
    return Promise.resolve(cachedSileroModelBuffer);
  }
  if (sileroFetchPromise) {
    return sileroFetchPromise;
  }
  sileroFetchPromise = (async () => {
    try {
      ensureOrtConfigured();
      const res = await fetch('/silero_vad_v5.onnx', { credentials: 'same-origin' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const buf = await res.arrayBuffer();
      cachedSileroModelBuffer = buf;
      console.log('[Rose Smart Listen] Silero VAD v5 model loaded locally (/silero_vad_v5.onnx)');
      return buf;
    } catch (err) {
      console.warn('[Rose Smart Listen] Silero VAD model load failed, using fallback:', err);
      sileroFetchPromise = null;
      return null;
    }
  })();
  return sileroFetchPromise;
}

export function preloadAudioEnhancementsInBackground(): void {
  const settings = getMicListeningSettings();
  if (settings.cleanVoice) {
    void loadRnnoiseWasmBinary();
  }
  if (settings.smartListen) {
    void loadSileroModelBinary();
  }
}

// ============================================================================
// Rose Clean Voice Audio Graph Builder:
// Mic -> RNNoise (AudioWorklet, 48kHz, 480 samples) -> AnalyserNode & Recording Stream
// ============================================================================
export interface CleanVoiceChainResult {
  audioCtx: AudioContext;
  sourceNode: MediaStreamAudioSourceNode;
  rnnoiseNode: AudioWorkletNode | null;
  analyserNode: AnalyserNode;
  outputStream: MediaStream;
  setCleanVoiceEnabled: (enabled: boolean) => void;
  cleanup: () => void;
}

export async function createCleanVoiceChain(
  rawStream: MediaStream,
  existingAudioCtx?: AudioContext | null,
  existingAnalyser?: AnalyserNode | null
): Promise<CleanVoiceChainResult> {
  const { cleanVoice } = getMicListeningSettings();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;

  // Use 48kHz AudioContext when creating new so RNNoise operates at native 48kHz (480 samples = 10ms)
  const audioCtx: AudioContext =
    existingAudioCtx && existingAudioCtx.state !== 'closed'
      ? existingAudioCtx
      : new AudioCtx({ sampleRate: 48000 });

  if (audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch {}
  }

  const sourceNode = audioCtx.createMediaStreamSource(rawStream);
  const analyserNode = existingAnalyser || audioCtx.createAnalyser();
  if (!existingAnalyser) {
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.45;
  }

  let destNode: MediaStreamAudioDestinationNode | null = null;
  try {
    destNode = audioCtx.createMediaStreamDestination();
  } catch (err) {
    console.warn('[Rose Clean Voice] createMediaStreamDestination failed, using raw stream:', err);
  }

  let rnnoiseNode: AudioWorkletNode | null = null;
  let connectedViaWorklet = false;

  if (audioCtx.audioWorklet && typeof AudioWorkletNode === 'function') {
    try {
      await audioCtx.audioWorklet.addModule('/rnnoise-worklet.js');
      rnnoiseNode = new AudioWorkletNode(audioCtx, 'rnnoise-worklet-processor', {
        processorOptions: {
          enabled: cleanVoice,
          wasmBinary: cachedRnnoiseWasmBinary || undefined,
        },
      });

      rnnoiseNode.port.onmessage = (ev) => {
        if (ev.data?.type === 'wasm-error') {
          console.warn('[Rose Clean Voice] RNNoise worklet WASM error, passthrough active:', ev.data.error);
        }
      };

      sourceNode.connect(rnnoiseNode);
      rnnoiseNode.connect(analyserNode);
      if (destNode) {
        rnnoiseNode.connect(destNode);
      }
      connectedViaWorklet = true;

      // Load WASM binary in background if not yet cached, without delaying call start
      if (!cachedRnnoiseWasmBinary) {
        loadRnnoiseWasmBinary()
          .then((buf) => {
            if (buf && rnnoiseNode) {
              try {
                rnnoiseNode.port.postMessage({
                  type: 'init-wasm',
                  wasmBinary: buf.slice(0),
                });
              } catch (e) {
                console.warn('[Rose Clean Voice] Failed posting WASM binary to worklet:', e);
              }
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      console.warn('[Rose Clean Voice] AudioWorklet setup failed, falling back to direct mic:', err);
      rnnoiseNode = null;
      connectedViaWorklet = false;
    }
  }

  if (!connectedViaWorklet) {
    sourceNode.connect(analyserNode);
    if (destNode) {
      sourceNode.connect(destNode);
    }
  }

  // Ensure outputStream has live audio tracks; fall back to rawStream if destination stream has no tracks
  const destStream = destNode?.stream;
  const outputStream =
    cleanVoice &&
    connectedViaWorklet &&
    destStream &&
    destStream.getAudioTracks().length > 0
      ? destStream
      : rawStream;

  const setCleanVoiceEnabled = (enabled: boolean) => {
    if (rnnoiseNode) {
      try {
        rnnoiseNode.port.postMessage({ type: 'set-enabled', enabled });
      } catch {}
    }
  };

  const cleanup = () => {
    try {
      if (rnnoiseNode) {
        rnnoiseNode.port.postMessage({ type: 'destroy' });
        rnnoiseNode.disconnect();
      }
    } catch {}
    try {
      sourceNode.disconnect();
    } catch {}
  };

  return {
    audioCtx,
    sourceNode,
    rnnoiseNode,
    analyserNode,
    outputStream,
    setCleanVoiceEnabled,
    cleanup,
  };
}

// ============================================================================
// Rose Smart Listen (Silero VAD v5 on 16kHz 512-sample frames via onnxruntime-web)
// ============================================================================
const SILERO_FRAME_SAMPLES = 512; // 32ms at 16kHz
const SILERO_CONTEXT_SAMPLES = 64;

export class SileroVadEngine {
  private session: ort.InferenceSession | null = null;
  private stateTensor: ort.Tensor | null = null;
  private srTensor: ort.Tensor | null = null;
  private contextBuffer: Float32Array = new Float32Array(SILERO_CONTEXT_SAMPLES);
  private sampleAccumulator: Float32Array = new Float32Array(SILERO_FRAME_SAMPLES * 4);
  private accLength = 0;
  private isReady = false;
  private isInitializing = false;
  private isBrokenOrSlow = false;
  private slowFrameCount = 0;
  private busyProcessing = false;
  private lastSpeechProb = 0;

  public async initInBackground(): Promise<boolean> {
    if (this.isReady) return true;
    if (this.isBrokenOrSlow || this.isInitializing) return false;
    this.isInitializing = true;

    try {
      ensureOrtConfigured();
      const modelBuf = await loadSileroModelBinary();
      if (!modelBuf) {
        this.isBrokenOrSlow = true;
        return false;
      }
      this.session = await ort.InferenceSession.create(modelBuf.slice(0), {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      this.srTensor = new ort.Tensor('int64', [16000n]);
      this.resetState();
      this.isReady = true;
      console.log('[Rose Smart Listen] Silero VAD session initialized');
      return true;
    } catch (err) {
      console.warn('[Rose Smart Listen] Silero VAD session init failed, falling back to volume VAD:', err);
      this.isBrokenOrSlow = true;
      this.isReady = false;
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  public resetState() {
    try {
      if (this.stateTensor) {
        try {
          this.stateTensor.dispose();
        } catch {}
      }
      const zeroes = new Float32Array(2 * 1 * 128);
      this.stateTensor = new ort.Tensor('float32', zeroes, [2, 1, 128]);
      this.contextBuffer = new Float32Array(SILERO_CONTEXT_SAMPLES);
      this.accLength = 0;
      this.lastSpeechProb = 0;
    } catch {}
  }

  public isAvailable(): boolean {
    return this.isReady && !this.isBrokenOrSlow && Boolean(this.session);
  }

  public getLastSpeechProbability(): number {
    return this.lastSpeechProb;
  }

  public getProbability(): number {
    return this.lastSpeechProb;
  }

  public stop(): void {
    void this.destroy();
  }

  /**
   * Feeds arbitrary-rate Float32 PCM samples, downsamples to 16kHz, and runs Silero VAD on 512-sample frames.
   */
  public async feedAudioSamples(
    samples: Float32Array,
    sampleRate: number,
    onProbability?: (prob: number) => void
  ): Promise<number> {
    if (!this.isAvailable()) return -1;

    // Downsample to 16kHz
    let frame16k: Float32Array;
    if (sampleRate === 16000) {
      frame16k = samples;
    } else {
      const ratio = sampleRate / 16000;
      const outLen = Math.floor(samples.length / ratio);
      if (outLen <= 0) return this.lastSpeechProb;
      frame16k = new Float32Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.floor((i + 1) * ratio);
        let sum = 0;
        let cnt = 0;
        for (let j = start; j < end && j < samples.length; j++) {
          sum += samples[j];
          cnt++;
        }
        frame16k[i] = cnt > 0 ? sum / cnt : samples[start] || 0;
      }
    }

    // Append to accumulator
    if (this.accLength + frame16k.length > this.sampleAccumulator.length) {
      const nextAcc = new Float32Array(Math.max(this.sampleAccumulator.length * 2, this.accLength + frame16k.length));
      nextAcc.set(this.sampleAccumulator.subarray(0, this.accLength), 0);
      this.sampleAccumulator = nextAcc;
    }
    this.sampleAccumulator.set(frame16k, this.accLength);
    this.accLength += frame16k.length;

    if (this.busyProcessing || this.accLength < SILERO_FRAME_SAMPLES) {
      return this.lastSpeechProb;
    }

    this.busyProcessing = true;
    try {
      while (this.accLength >= SILERO_FRAME_SAMPLES && this.isAvailable()) {
        const chunk = this.sampleAccumulator.slice(0, SILERO_FRAME_SAMPLES);
        this.sampleAccumulator.copyWithin(0, SILERO_FRAME_SAMPLES, this.accLength);
        this.accLength -= SILERO_FRAME_SAMPLES;

        const t0 = performance.now();
        const prob = await this.runFrame(chunk);
        const elapsed = performance.now() - t0;

        // Device speed check: if a 32ms frame consistently takes > 85ms, fall back gracefully
        if (elapsed > 85) {
          this.slowFrameCount++;
          if (this.slowFrameCount >= 4) {
            console.warn('[Rose Smart Listen] Device too slow for Silero VAD (' + Math.round(elapsed) + 'ms/frame), falling back to volume detection.');
            this.isBrokenOrSlow = true;
            return -1;
          }
        } else {
          this.slowFrameCount = Math.max(0, this.slowFrameCount - 1);
        }

        this.lastSpeechProb = prob;
        onProbability?.(prob);
      }
    } catch (err) {
      console.warn('[Rose Smart Listen] Silero inference error, falling back to volume detection:', err);
      this.isBrokenOrSlow = true;
      return -1;
    } finally {
      this.busyProcessing = false;
    }

    return this.lastSpeechProb;
  }

  private async runFrame(frame512: Float32Array): Promise<number> {
    if (!this.session || !this.stateTensor || !this.srTensor) return 0;

    const withContext = new Float32Array(SILERO_CONTEXT_SAMPLES + SILERO_FRAME_SAMPLES);
    withContext.set(this.contextBuffer, 0);
    withContext.set(frame512, SILERO_CONTEXT_SAMPLES);
    this.contextBuffer = frame512.slice(-SILERO_CONTEXT_SAMPLES);

    const inputTensor = new ort.Tensor('float32', withContext, [1, withContext.length]);
    try {
      const out = await this.session.run({
        input: inputTensor,
        state: this.stateTensor,
        sr: this.srTensor,
      });
      if (out.stateN) {
        if (this.stateTensor && this.stateTensor !== out.stateN) {
          try {
            this.stateTensor.dispose();
          } catch {}
        }
        this.stateTensor = out.stateN;
      }
      const prob = Number(out.output?.data?.[0] ?? 0);
      return isNaN(prob) ? 0 : prob;
    } finally {
      try {
        inputTensor.dispose();
      } catch {}
    }
  }

  public async destroy() {
    this.isReady = false;
    try {
      if (this.session) {
        await this.session.release();
      }
    } catch {}
    try {
      this.stateTensor?.dispose();
      this.srTensor?.dispose();
    } catch {}
    this.session = null;
    this.stateTensor = null;
    this.srTensor = null;
  }
}

// ============================================================================
// ROSE_TECH Constant (Requirement 6: Honest & Brand-Aligned Technical Profile)
// ============================================================================
export const ROSE_TECH = {
  brandLabels: {
    cleanVoice: 'Rose Clean Voice (নয়েজ কমানো)',
    smartListen: 'Rose Smart Listen (কথা চেনা)',
    voice: 'Rose Voice (কণ্ঠ)',
  },
  chatService: {
    providers: ['Google Gemini', 'Groq', 'OpenRouter', 'Cerebras', 'Mistral'],
    modelSelection:
      'ব্যবহারকারীর নির্বাচিত চ্যাট ইঞ্জিন ও API-এর /models তালিকা থেকে স্বয়ংক্রিয়ভাবে সক্রিয় মডেল বেছে নেওয়া হয় (যেমন Gemini Flash/Pro বা Groq Llama/Qwen/Gemma)',
  },
  voiceAndStt: {
    brandName: 'Rose Voice',
    liveVoiceAndStt:
      'Google Gemini Live API (WebSocket BidiGenerateContent native-audio/live মডেল) এবং দ্বিতীয় পথে MediaRecorder অডিও ক্লিপ + Google Gemini generateContent (Flash মডেল) ও Web Speech API (SpeechRecognition)',
    textToSpeech:
      'Google Gemini Audio/TTS মডেল (generateContent AUDIO modality, 24kHz PCM, WebAudio GainNode ও DynamicsCompressorNode সহ) এবং ফলব্যাক হিসেবে ব্রাউজারের speechSynthesis (নারী কণ্ঠ ফিল্টারসহ)',
  },
  noiseSuppression: {
    brandName: 'Rose Clean Voice',
    technology:
      'ব্রাউজারের getUserMedia অডিও ফিল্টার (noiseSuppression: true, echoCancellation: true, autoGainControl: false) এবং ওপেন-সোর্স RNNoise (@jitsi/rnnoise-wasm v0.2.1, WebAssembly ও AudioWorklet দিয়ে 48kHz-এ 480-স্যাম্পলের ফ্রেম ফিল্টারিং)',
  },
  voiceActivityDetection: {
    brandName: 'Rose Smart Listen',
    technology:
      'ওপেন-সোর্স Silero VAD v5 (@ricky0123/vad-web v0.0.31 ও onnxruntime-web v1.31.1, লোকাল ONNX মডেল ও WASM দিয়ে ব্রাউজারে কথা শুরু ও শেষ শনাক্তকরণ; ন্যূনতম কথার দৈর্ঘ্য ০.৪ সেকেন্ড, কথা শেষের নীরবতা ০.৬৫ সেকেন্ড, সর্বোচ্চ ক্লিপ ১৫ সেকেন্ড) এবং ফলব্যাক হিসেবে WebAudio AnalyserNode ভলিউম/নীরবতা শনাক্তকরণ',
  },
  databaseAndStorage: {
    cloudDatabase: 'Supabase (@supabase/supabase-js)',
    localCache: 'ব্রাউজারের localStorage এবং IndexedDB (চ্যাট, সেটিংস ও TTS অডিও ক্যাশ)',
  },
  hostingAndPlatform: {
    webHosting: 'Vercel',
    frontendStack: 'React 19, TypeScript, Vite, Tailwind CSS, Capacitor (Android)',
  },
} as const;

export function getRoseTechInstruction(): string {
  return `[ROSE_TECH - অ্যাপের প্রযুক্তি ও ব্র্যান্ড তথ্য]
- ব্র্যান্ড-নাম:
  * "Rose Clean Voice" (নয়েজ কমানো): ${ROSE_TECH.noiseSuppression.technology}
  * "Rose Smart Listen" (কথা চেনা): ${ROSE_TECH.voiceActivityDetection.technology}
  * "Rose Voice" (কণ্ঠ ও কথা-থেকে-লেখা): ${ROSE_TECH.voiceAndStt.liveVoiceAndStt} এবং কণ্ঠের জন্য ${ROSE_TECH.voiceAndStt.textToSpeech}
- চ্যাটের উত্তর: ${ROSE_TECH.chatService.providers.join(', ')} (${ROSE_TECH.chatService.modelSelection})
- ডেটাবেস: ${ROSE_TECH.databaseAndStorage.cloudDatabase} ও লোকাল স্টোরেজ (${ROSE_TECH.databaseAndStorage.localCache})
- হোস্টিং ও প্ল্যাটফর্ম: ${ROSE_TECH.hostingAndPlatform.webHosting} (${ROSE_TECH.hostingAndPlatform.frontendStack})
- নিয়ম (অবশ্যই মানতে হবে): কেউ জিজ্ঞেস করলে কোথায় কী প্রযুক্তি ব্যবহার হচ্ছে সত্যি বলো। ব্র্যান্ড-নাম অ্যাপের লেবেল, কেউ ভেতরের আসল প্রযুক্তি জানতে চাইলে লুকাবে না। কোনো গোপন চাবি, টোকেন বা key কখনো বলবে না। নিজে থেকে এসব তথ্য বলবে না, শুধু জিজ্ঞেস করলে।`;
}
