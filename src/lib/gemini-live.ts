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

  private isMuted = false;
  public setMuted(muted: boolean) {
    this.isMuted = muted;
    logVoiceEvent("Mic", muted ? "Muted" : "Unmuted");
  }

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
          // Enable transcriptions
          input_audio_transcription: {},
          output_audio_transcription: {}
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
          
          // Handle User Transcription (check both camel and snake case)
          const inTrans = content.inputAudioTranscription || content.inputTranscription || content.input_audio_transcription;
          if (inTrans) {
            this.options.onTranscription?.('user', inTrans.text, inTrans.isFinal || inTrans.is_final);
          }

          // Handle Assistant Transcription
          const outTrans = content.outputAudioTranscription || content.outputTranscription || content.output_audio_transcription;
          if (outTrans) {
            this.options.onTranscription?.('assistant', outTrans.text, true);
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
          logVoiceEvent("Live WS", `Error: ${msg.error.message}`, "error");
          if (msg.error.message.includes("not found") || msg.error.message.includes("unsupported")) {
             this.ws?.close();
             this.connectWithRetry(apiKey, models, index + 1);
             return;
          }
          this.options.onError?.(`Gemini Live ব্যর্থ। মডেল: ${model}, Google এরর: ${msg.error.message}`);
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
      // 1. Get the mic stream with desired constraints
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { 
          echoCancellation: true, 
          noiseSuppression: true, 
          autoGainControl: true 
        }
      });

      const micTrack = this.micStream.getAudioTracks()[0];
      if (!micTrack || micTrack.readyState !== 'live' || !micTrack.enabled) {
        throw new Error("মাইক ট্র্যাক সচল নয়।");
      }

      // 2. Create the AudioContext (let browser choose native rate for stability)
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      await this.audioCtx.resume();

      if (this.audioCtx.state !== 'running') {
        this.options.onError?.("অডিও সেশন চালু করা যায়নি। মাইক অনুমতি দিন।");
        return;
      }

      const source = this.audioCtx.createMediaStreamSource(this.micStream);
      const sampleRate = this.audioCtx.sampleRate;
      logVoiceEvent("Mic", `Capture started at ${sampleRate}Hz`);
      
      // Mic Analyser (for visuals)
      this.micAnalyser = this.audioCtx.createAnalyser();
      this.micAnalyser.fftSize = 256;
      source.connect(this.micAnalyser);

      // Output Analyser (for visuals)
      this.outputAnalyser = this.audioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 256;

      try {
        // Use inline AudioWorklet with resampling logic
        const processorCode = `
          class AudioProcessor extends AudioWorkletProcessor {
            constructor() { 
              super(); 
              this.targetRate = 16000;
              this.sourceRate = sampleRate; // Will be injected
              this.buffer = [];
            }
            process(inputs) {
              const input = inputs[0];
              if (!input || input.length === 0) return true;
              const channel = input[0];
              
              // Simple linear resampling if sourceRate != targetRate
              if (this.sourceRate === this.targetRate) {
                const pcm16 = new Int16Array(channel.length);
                for (let i = 0; i < channel.length; i++) {
                  const s = Math.max(-1, Math.min(1, channel[i]));
                  pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
              } else {
                // Buffer and resample
                for (let i = 0; i < channel.length; i++) this.buffer.push(channel[i]);
                
                const ratio = this.sourceRate / this.targetRate;
                const outLength = Math.floor(this.buffer.length / ratio);
                
                if (outLength >= 160) { // Send in chunks of ~10ms+
                  const pcm16 = new Int16Array(outLength);
                  for (let i = 0; i < outLength; i++) {
                    const idx = Math.floor(i * ratio);
                    const s = Math.max(-1, Math.min(1, this.buffer[idx]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                  }
                  this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
                  this.buffer = this.buffer.slice(Math.floor(outLength * ratio));
                }
              }
              return true;
            }
          }
          registerProcessor('audio-processor', AudioProcessor);
        `.replace('sampleRate', String(sampleRate));

        const blob = new Blob([processorCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        await this.audioCtx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        
        this.audioWorkletNode = new AudioWorkletNode(this.audioCtx, 'audio-processor');
        this.audioWorkletNode.port.onmessage = (e) => this.sendAudio(e.data);
        source.connect(this.audioWorkletNode);
        logVoiceEvent("Mic", `Inline Worklet resampler active (${sampleRate} -> 16000)`);
      } catch (e) {
        logVoiceEvent("Mic", "Worklet failed, fallback to high-rate ScriptProcessor", "warn");
        this.scriptProcessor = this.audioCtx.createScriptProcessor(4096, 1, 1);
        this.scriptProcessor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          // Very crude downsampling for fallback
          const ratio = Math.round(sampleRate / 16000);
          const outLen = Math.floor(input.length / ratio);
          const pcm16 = new Int16Array(outLen);
          for (let i = 0; i < outLen; i++) {
            const s = Math.max(-1, Math.min(1, input[i * ratio]));
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
      logVoiceEvent("Mic", `Capture Error: ${e.message}`, "error");
      this.options.onError?.(`মাইক্রোফোন সংযোগ করা যায়নি: ${e.message}`);
    }
  }

  private sendAudio(buffer: ArrayBuffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.isMuted) return;
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
