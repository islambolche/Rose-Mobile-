import { logVoiceEvent } from './voiceLogger';
import { getGeminiKey } from './geminiKey';
import { getDynamicGeminiLiveModels } from './chatEngines';

export interface GeminiLiveOptions {
  assistantName?: string;
  ownerName?: string;
  voiceName?: string;
  language?: string;
  personality?: string;
  customPersonalityText?: string;
  responseStyle?: string;
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
  audioContext?: AudioContext;
  micStream?: MediaStream;
}

export function parseAndFormatGeminiError(status: number | string, rawMsg: string): { bengali: string; original: string } {
  const code = Number(status) || 0;
  const lowerMsg = (rawMsg || '').toLowerCase();

  let bengali = "সমস্যা হয়েছে";
  if (code === 400 || code === 403 || lowerMsg.includes("api key") || lowerMsg.includes("invalid key") || lowerMsg.includes("permission_denied") || lowerMsg.includes("unauthenticated")) {
    bengali = "API key ঠিক নেই";
  } else if (code === 404 || lowerMsg.includes("not found")) {
    bengali = "মডেল পাওয়া যায়নি, অন্য মডেল বেছে নেওয়া হচ্ছে";
  } else if (code === 429 || lowerMsg.includes("quota") || lowerMsg.includes("resource_exhausted")) {
    bengali = "ফ্রি সীমা শেষ, কিছুক্ষণ পরে চেষ্টা করুন";
  } else if (code === 503 || lowerMsg.includes("unavailable") || lowerMsg.includes("overloaded")) {
    bengali = "মডেল ব্যস্ত, আবার চেষ্টা করা হচ্ছে";
  } else if (code === 0 || lowerMsg.includes("fetch") || lowerMsg.includes("network") || lowerMsg.includes("failed to fetch")) {
    bengali = "ইন্টারনেট সমস্যা";
  }

  const original = status ? `[HTTP ${status}] ${rawMsg}` : rawMsg;
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

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private nextStartTime = 0;
  private scheduledAudioSources: AudioBufferSourceNode[] = [];
  private currentState: 'connecting' | 'listening' | 'thinking' | 'speaking' | 'off' = 'off';
  private wasStoppedByUser = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private isMuted = false;
  private isSetupComplete = false;
  private activeModelName = "";

  // Live diagnostics tracking
  public socketStatus: 'open' | 'closed' | 'connecting' = 'closed';
  public chunksSent = 0;
  public messagesReceived = 0;
  public lastHeardText = '';
  public lastError: string | null = null;
  public currentMicLevel = 0;

  constructor(private options: GeminiLiveOptions) {}

  public getMicAnalyser() { return this.micAnalyser; }
  public getOutputAnalyser() { return this.outputAnalyser; }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    logVoiceEvent("Mic", muted ? "Muted" : "Unmuted");
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
    };
  }

  public sendTextMessage(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify({
        realtimeInput: { text }
      }));
    } catch (e) {}
  }

  public async start() {
    if (this.ws) return;
    this.wasStoppedByUser = false;
    this.isSetupComplete = false;
    this.updateState('connecting');
    this.socketStatus = 'connecting';

    const apiKey = (this.options.apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();
    if (!apiKey) {
      const err = parseAndFormatGeminiError(400, 'API key missing');
      this.lastError = `${err.bengali} (${err.original})`;
      this.options.onError?.(err.bengali, err.original);
      this.updateState('off');
      this.socketStatus = 'closed';
      return;
    }

    // Determine model
    let selectedModel = (this.options.model || localStorage.getItem('voice_model') || '').replace(/^models\//, '').trim();
    if (!selectedModel) {
      const liveRes = await getDynamicGeminiLiveModels(apiKey);
      selectedModel = liveRes.models[0] || 'gemini-2.0-flash-exp';
    }
    this.activeModelName = selectedModel;

    // Direct Google Gemini WebSocket URL (No server proxy)
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`;

    logVoiceEvent("Live WS", `Connecting directly to ${selectedModel}...`);

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (e: any) {
      this.socketStatus = 'closed';
      const err = parseAndFormatGeminiError(0, e?.message || 'WebSocket connection failed');
      this.lastError = `${err.bengali} (${err.original})`;
      this.options.onError?.(err.bengali, err.original);
      this.updateState('off');
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.socketStatus = 'open';
      logVoiceEvent("Live WS", `Direct WebSocket connection open. Sending setup...`, "success");

      // Requirement 3: Send setup message on open
      const setupMsg = {
        setup: {
          model: `models/${selectedModel}`,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: this.options.voiceName || 'Sulafat',
                },
              },
            },
          },
          systemInstruction: {
            parts: [{ text: this.options.systemInstruction || "You are Rose, a helpful assistant." }],
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
      };
      this.ws?.send(JSON.stringify(setupMsg));
    };

    this.ws.onmessage = async (event) => {
      this.messagesReceived++;
      try {
        const raw = typeof event.data === 'string' ? event.data : await (event.data as Blob).text();
        const msg = JSON.parse(raw);

        if (msg.setupComplete) {
          this.isSetupComplete = true;
          this.updateState('listening');
          this.startMicCapture();
          return;
        }

        if (msg.serverContent) {
          const content = msg.serverContent;
          
          // User Transcription
          const inTrans = content.inputTranscription || content.inputAudioTranscription || content.input_audio_transcription || content.userTurn?.parts?.find((p: any) => p.text);
          if (inTrans) {
            const textVal = typeof inTrans === 'string' ? inTrans : (inTrans.text || inTrans.parts?.[0]?.text);
            if (textVal) {
              this.lastHeardText = textVal;
              this.options.onTranscription?.('user', textVal, inTrans.isFinal || inTrans.is_final || true);
            }
          }

          // Assistant Transcription
          const outTrans = content.outputTranscription || content.outputAudioTranscription || content.output_audio_transcription;
          if (outTrans) {
            const textVal = typeof outTrans === 'string' ? outTrans : (outTrans.text || outTrans.parts?.[0]?.text);
            if (textVal) {
              this.options.onTranscription?.('assistant', textVal, true);
            }
          }

          if (content.modelTurn) {
            const parts = content.modelTurn.parts || [];
            for (const part of parts) {
              if (part.inlineData) {
                this.updateState('speaking');
                this.playPcmAudio(part.inlineData.data);
              }
              if (part.text) {
                this.options.onTranscription?.('assistant', part.text, false);
              }
            }
          }

          if (content.interrupted) {
            this.stopAllAudioPlayback();
            this.updateState('listening');
            this.options.onInterrupted?.();
          }

          if (content.turnComplete) {
            this.scheduleReturnToListening();
            this.options.onTurnComplete?.();
          }
        }

        if (msg.error) {
          logVoiceEvent("Live WS", `Error: ${msg.error.message || msg.error}`, "error");
          const rawMsg = typeof msg.error === 'string' ? msg.error : (msg.error.message || JSON.stringify(msg.error));
          const code = msg.error?.code || msg.error?.status || 500;
          const formatted = parseAndFormatGeminiError(code, rawMsg);
          this.lastError = `${formatted.bengali} (${formatted.original})`;
          this.options.onError?.(formatted.bengali, formatted.original);

          // Retry on 503 after 2s once
          if (code === 503 && this.reconnectAttempts < 1) {
            this.reconnectAttempts++;
            setTimeout(() => this.start(), 2000);
            return;
          }
        }
      } catch (e) {}
    };

    this.ws.onclose = (ev) => {
      this.ws = null;
      this.socketStatus = 'closed';
      this.isSetupComplete = false;

      if (ev?.code === 1006 || ev?.code === 1008 || ev?.code === 4004) {
        const formatted = parseAndFormatGeminiError(ev?.code || 500, ev?.reason || 'Connection closed');
        this.lastError = `${formatted.bengali} (${formatted.original})`;
        this.options.onError?.(formatted.bengali, formatted.original);
      }

      this.updateState('off');
      this.options.onClose?.(ev);
    };

    this.ws.onerror = (err: any) => {
      this.socketStatus = 'closed';
      const formatted = parseAndFormatGeminiError(0, err?.message || 'WebSocket Error');
      this.lastError = `${formatted.bengali} (${formatted.original})`;
      logVoiceEvent("Live WS", "WebSocket Error", "error");
    };
  }

  private async startMicCapture() {
    logVoiceEvent("Mic", "Starting mic capture...");
    try {
      if (this.options.micStream) {
        this.micStream = this.options.micStream;
      } else {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: { 
            echoCancellation: true, 
            noiseSuppression: true, 
            autoGainControl: true 
          }
        });
      }
      logVoiceEvent("Mic", "Mic stream acquired");

      const micTrack = this.micStream.getAudioTracks()[0];
      if (!micTrack || micTrack.readyState !== 'live' || !micTrack.enabled) {
        throw new Error("মাইক ট্র্যাক সচল নয়।");
      }

      this.audioCtx = this.options.audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.audioCtx.state !== 'running') {
        await this.audioCtx.resume();
      }

      if (this.audioCtx.state !== 'running') {
        const formatted = parseAndFormatGeminiError(0, "AudioContext state is not running");
        this.lastError = `${formatted.bengali} (${formatted.original})`;
        this.options.onError?.(formatted.bengali, formatted.original);
        return;
      }

      const source = this.audioCtx.createMediaStreamSource(this.micStream);
      const sourceSampleRate = this.audioCtx.sampleRate;
      logVoiceEvent("Mic", `Capture started at ${sourceSampleRate}Hz`);

      this.micAnalyser = this.audioCtx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      source.connect(this.micAnalyser);

      this.outputAnalyser = this.audioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 256;

      const processBuffer = (float32Samples: Float32Array) => {
        let sumSq = 0;
        for (let i = 0; i < float32Samples.length; i++) {
          sumSq += float32Samples[i] * float32Samples[i];
        }
        const rms = Math.sqrt(sumSq / float32Samples.length);
        this.currentMicLevel = Math.min(1.0, Math.max(0.0, rms * 4.0));

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.isMuted || !this.isSetupComplete) {
          return;
        }

        const pcm16 = downsampleToPCM16(float32Samples, sourceSampleRate, 16000);
        if (pcm16.length === 0) return;

        const u8 = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
        let binary = '';
        const len = u8.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(u8[i]);
        }
        const base64 = btoa(binary);

        try {
          this.ws.send(JSON.stringify({
            realtimeInput: {
              audio: { data: base64, mimeType: "audio/pcm;rate=16000" }
            }
          }));
          this.chunksSent++;
        } catch (e) {
          // Drop silently if send fails
        }
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
            processBuffer(e.data);
          }
        };
        source.connect(this.audioWorkletNode);
        workletActive = true;
        logVoiceEvent("Mic", "AudioWorklet active");
      } catch (e) {
        logVoiceEvent("Mic", "Worklet failed, fallback to ScriptProcessor", "warn");
      }

      if (!workletActive) {
        this.scriptProcessor = this.audioCtx.createScriptProcessor(4096, 1, 1);
        this.scriptProcessor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          processBuffer(input);
        };
        source.connect(this.scriptProcessor);
        
        const silentGain = this.audioCtx.createGain();
        silentGain.gain.value = 0;
        this.scriptProcessor.connect(silentGain);
        silentGain.connect(this.audioCtx.destination);
      }

      this.options.onMicLive?.(true);
      this.startVisualizer();
    } catch (e: any) {
      logVoiceEvent("Mic", `Capture Error: ${e.message}`, "error");
      const formatted = parseAndFormatGeminiError(0, e?.message || 'Mic error');
      this.lastError = `${formatted.bengali} (${formatted.original})`;
      this.options.onError?.(formatted.bengali, formatted.original);
    }
  }

  private playPcmAudio(base64Pcm: string) {
    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    logVoiceEvent("Audio", `Received audio chunk: ${base64Pcm.length} bytes`);
    try {
      const binaryStr = atob(base64Pcm);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);

      const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(len / 2));
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768.0;

      const audioBuffer = this.audioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      
      const gainNode = this.audioCtx.createGain();
      gainNode.gain.value = 1.0; 

      source.connect(gainNode);
      if (this.outputAnalyser) gainNode.connect(this.outputAnalyser);
      gainNode.connect(this.audioCtx.destination);

      const startTime = Math.max(this.audioCtx.currentTime, this.nextStartTime);
      source.start(startTime);
      this.scheduledAudioSources.push(source);
      source.onended = () => {
        this.scheduledAudioSources = this.scheduledAudioSources.filter(s => s !== source);
      };

      this.nextStartTime = startTime + audioBuffer.duration;
      logVoiceEvent("Audio", "Playing audio chunk");
    } catch (e) {
      logVoiceEvent("Audio", `Playback error: ${e}`, "error");
    }
  }

  private startVisualizer() {
    logVoiceEvent("Visualizer", "Starting visualizer");
    const micData = new Uint8Array(this.micAnalyser?.frequencyBinCount || 0);
    const outData = new Uint8Array(this.outputAnalyser?.frequencyBinCount || 0);
    
    const loop = () => {
      if (this.currentState === 'off') return;
      
      if (this.micAnalyser) {
        this.micAnalyser.getByteFrequencyData(micData);
        const micVol = micData.reduce((a, b) => a + b, 0) / micData.length;
        this.options.onMicVolume?.(micVol);
      }

      if (this.outputAnalyser) {
        this.outputAnalyser.getByteFrequencyData(outData);
        const outVol = outData.reduce((a, b) => a + b, 0) / outData.length;
        this.options.onVolume?.(outVol);
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private stopAllAudioPlayback() {
    this.scheduledAudioSources.forEach(s => { try { s.stop(); } catch (e) {} });
    this.scheduledAudioSources = [];
    this.nextStartTime = 0;
  }

  private scheduleReturnToListening() {
    setTimeout(() => {
      if (this.scheduledAudioSources.length === 0) this.updateState('listening');
      else this.scheduleReturnToListening();
    }, 200);
  }

  private updateState(newState: 'connecting' | 'listening' | 'thinking' | 'speaking' | 'off') {
    if (this.currentState !== newState) {
      this.currentState = newState;
      this.options.onStateChange?.(newState);
    }
  }

  public stop() {
    this.wasStoppedByUser = true;
    this.updateState('off');
    this.socketStatus = 'closed';
    this.isSetupComplete = false;
    this.ws?.close();
    this.ws = null;
    this.stopAllAudioPlayback();
    if (this.scriptProcessor) {
      try { this.scriptProcessor.disconnect(); } catch (e) {}
      this.scriptProcessor = null;
    }
    if (this.audioWorkletNode) {
      try { this.audioWorkletNode.disconnect(); } catch (e) {}
      this.audioWorkletNode = null;
    }
    this.micStream?.getTracks().forEach(t => t.stop());
    this.micStream = null;
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try { this.audioCtx.close(); } catch(e) {}
    }
    this.audioCtx = null;
  }
}
