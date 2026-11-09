import { logVoiceEvent } from './voiceLogger';
import { getGeminiKey } from './geminiKey';
import { getGlobalMicStream } from './audio-manager';
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
  onStateChange?: (state: 'connecting' | 'listening' | 'thinking' | 'speaking' | 'off') => void;
  onTranscription?: (role: 'user' | 'assistant', text: string, isFinal?: boolean) => void;
  onVolume?: (volume: number) => void;
  onMicVolume?: (volume: number) => void;
  onMicLive?: (isLive: boolean) => void;
  onError?: (friendlyMessage: string, rawError?: any) => void;
  onClose?: (event?: any) => void;
  onTurnComplete?: () => void;
  onInterrupted?: () => void;
}

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;

  public getMicAnalyser() { return this.micAnalyser; }
  public getOutputAnalyser() { return this.outputAnalyser; }
  private nextStartTime = 0;
  private scheduledAudioSources: AudioBufferSourceNode[] = [];
  private currentState: 'connecting' | 'listening' | 'thinking' | 'speaking' | 'off' = 'off';
  private wasStoppedByUser = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private activeModel = "";

  constructor(private options: GeminiLiveOptions) {}

  public async start() {
    if (this.ws) return;
    this.wasStoppedByUser = false;
    this.updateState('connecting');

    const apiKey = (this.options.apiKey || getGeminiKey() || '').replace(/[\r\n\t\s"']+/g, '').trim();
    if (!apiKey) {
      this.options.onError?.("Gemini Key খুঁজে পাওয়া যায়নি। Connections-এ Key দিন।");
      this.updateState('off');
      return;
    }

    // 1. Get Models (Override or Dynamic)
    let models: string[] = [];
    const override = localStorage.getItem('voice_model');
    if (override) {
      models = [override];
    } else {
      const res = await getDynamicGeminiLiveModels(apiKey);
      models = res.models.slice(0, 3);
      if (models.length === 0) {
        this.options.onError?.(`Live মডেল পাওয়া যায়নি। ${res.error || ""}`, res);
        this.updateState('off');
        return;
      }
    }

    this.connectWithRetry(apiKey, models, 0);
  }

  private connectWithRetry(apiKey: string, models: string[], index: number) {
    if (index >= models.length) {
      this.options.onError?.("সবচেয়ে আধুনিক ৩টি মডেলেও সংযোগ ব্যর্থ হয়েছে। পরে চেষ্টা করুন।");
      this.updateState('off');
      return;
    }

    const model = models[index].replace(/^models\//, '').trim();
    this.activeModel = model;
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

    logVoiceEvent("Live WS", `Connecting to ${model}...`);
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      logVoiceEvent("Live WS", `Connected to ${model}`, "success");
      
      const setupMsg = {
        setup: {
          model: `models/${model}`,
          generation_config: {
            response_modalities: ["AUDIO"],
            speech_config: {
              voice_config: {
                prebuilt_voice_config: {
                  voice_name: this.options.voiceName || 'Sulafat',
                },
              },
            },
          },
          system_instruction: {
            parts: [{ text: this.options.systemInstruction || "You are Rose, a helpful assistant." }],
          },
        },
      };
      this.ws?.send(JSON.stringify(setupMsg));
    };

    this.ws.onmessage = async (event) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : await (event.data as Blob).text();
        const msg = JSON.parse(raw);

        if (msg.setupComplete) {
          this.updateState('listening');
          this.startMicCapture();
          return;
        }

        if (msg.serverContent) {
          const content = msg.serverContent;
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
          logVoiceEvent("Live WS", `Error: ${msg.error.message}`, "error");
          // If unsupported or not found, try next model
          if (msg.error.message.includes("not found") || msg.error.message.includes("unsupported")) {
             this.ws?.close();
             this.connectWithRetry(apiKey, models, index + 1);
             return;
          }
          this.options.onError?.(`Gemini Live ব্যর্থ। মডেল: ${model}, মোট Live মডেল: ${models.length}টি। Google এরর: ${msg.error.message}`);
        }
      } catch (e) {}
    };

    this.ws.onclose = (ev) => {
      this.ws = null;
      if (!this.wasStoppedByUser && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.start(), 2000);
      } else {
        this.updateState('off');
        this.options.onClose?.(ev);
      }
    };

    this.ws.onerror = () => {
      logVoiceEvent("Live WS", "WebSocket Error", "error");
    };
  }

  private async startMicCapture() {
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      await this.audioCtx.resume();

      this.micStream = await getGlobalMicStream({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true }
      });

      const source = this.audioCtx.createMediaStreamSource(this.micStream);
      
      // Mic Analyser
      this.micAnalyser = this.audioCtx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      source.connect(this.micAnalyser);

      // Output Analyser (dummy gain node to tap into output)
      this.outputAnalyser = this.audioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 256;

      try {
        await this.audioCtx.audioWorklet.addModule('/audio-processor.js');
        this.audioWorkletNode = new AudioWorkletNode(this.audioCtx, 'audio-processor');
        this.audioWorkletNode.port.onmessage = (e) => this.sendAudio(e.data);
        source.connect(this.audioWorkletNode);
        logVoiceEvent("Mic", "AudioWorklet active");
      } catch (e) {
        logVoiceEvent("Mic", "AudioWorklet failed, falling back to ScriptProcessor", "warn");
        this.scriptProcessor = this.audioCtx.createScriptProcessor(1024, 1, 1);
        this.scriptProcessor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          this.sendAudio(pcm16.buffer);
        };
        source.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioCtx.destination);
      }

      this.options.onMicLive?.(true);
      this.startVisualizer();
    } catch (e: any) {
      this.options.onError?.("মাইক্রোফোন সংযোগ করা যায়নি।");
    }
  }

  private sendAudio(buffer: ArrayBuffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    this.ws.send(JSON.stringify({
      realtime_input: {
        media_chunks: [{ data: base64, mime_type: "audio/pcm;rate=16000" }]
      }
    }));
  }

  private playPcmAudio(base64Pcm: string) {
    if (!this.audioCtx) return;
    try {
      const binaryStr = atob(base64Pcm);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768.0;

      const audioBuffer = this.audioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      
      const gainNode = this.audioCtx.createGain();
      const prefs = localStorage.getItem('rose_prefs') ? JSON.parse(localStorage.getItem('rose_prefs')!) : {};
      gainNode.gain.value = (prefs.voiceVolume || 80) / 100;

      source.connect(gainNode);
      gainNode.connect(this.outputAnalyser!);
      gainNode.connect(this.audioCtx.destination);

      const startTime = Math.max(this.audioCtx.currentTime, this.nextStartTime);
      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;

      this.scheduledAudioSources.push(source);
      source.onended = () => {
        this.scheduledAudioSources = this.scheduledAudioSources.filter(s => s !== source);
        if (this.scheduledAudioSources.length === 0 && this.currentState === 'speaking') {
          this.updateState('listening');
        }
      };
    } catch (e) {}
  }

  private startVisualizer() {
    const micData = new Uint8Array(this.micAnalyser?.frequencyBinCount || 0);
    const outData = new Uint8Array(this.outputAnalyser?.frequencyBinCount || 0);
    
    const loop = () => {
      if (this.currentState === 'off') return;
      
      let micVol = 0;
      if (this.micAnalyser) {
        this.micAnalyser.getByteFrequencyData(micData);
        micVol = micData.reduce((a, b) => a + b, 0) / micData.length;
        this.options.onMicVolume?.(micVol);
      }

      let outVol = 0;
      if (this.outputAnalyser) {
        this.outputAnalyser.getByteFrequencyData(outData);
        outVol = outData.reduce((a, b) => a + b, 0) / outData.length;
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
    this.ws?.close();
    this.ws = null;
    this.stopAllAudioPlayback();
    this.micStream?.getTracks().forEach(t => t.stop());
    this.micStream = null;
    this.audioCtx?.close();
    this.audioCtx = null;
  }
}
