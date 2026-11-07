import { logVoiceEvent } from './voiceLogger';
import { getGeminiKey } from './geminiKey';

export interface GeminiLiveOptions {
  assistantName?: string;
  ownerName?: string;
  voiceName?: string;
  language?: string;
  model?: string;
  personality?: string;
  customPersonalityText?: string;
  responseStyle?: string;
  memoryFacts?: string;
  recentSummary?: string;
  apiKey: string;
  onStateChange?: (state: 'connecting' | 'listening' | 'thinking' | 'speaking' | 'off') => void;
  onTranscription?: (role: 'user' | 'assistant', text: string, isFinal?: boolean) => void;
  onAudio?: (base64: string) => void;
  onVolume?: (volume: number) => void;
  onMicLive?: (isLive: boolean) => void;
  onAction?: (action: string, payload?: any, callId?: string) => void;
  onError?: (friendlyMessage: string, rawError?: any) => void;
  onClose?: (event?: any) => void;
  onTurnComplete?: () => void;
  onInterrupted?: () => void;
  onTiming?: (metricName: string, ms: number) => void;
}

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private micAudioCtx: AudioContext | null = null;
  private playbackAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private isMuted = false;
  private isConnected = false;
  private nextStartTime = 0;
  private scheduledAudioSources: AudioBufferSourceNode[] = [];
  private audioChunksReceived = 0;
  private firstAudioChunkReceivedTime = 0;
  private speechEndTime = 0;
  private currentState: 'connecting' | 'listening' | 'thinking' | 'speaking' | 'off' = 'off';
  private wasStoppedByUser = false;

  constructor(private options: GeminiLiveOptions) {}

  public getMicStream(): MediaStream | null {
    return this.micStream;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public async start() {
    if (this.isConnected || this.ws) return;
    this.wasStoppedByUser = false;
    this.updateState('connecting');
    const micStart = Date.now();
    this.audioChunksReceived = 0;
    this.options.onTiming?.("audioChunksReceived", 0);

    const apiKey = getGeminiKey();
    if (!apiKey) {
      const errMsg = "Gemini API key is missing. Add your key in Connections.";
      logVoiceEvent("Live WS", errMsg, "error");
      this.options.onError?.(errMsg);
      this.stop(true);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const model = localStorage.getItem('voice_model') || 'gemini-2.5-flash-native-audio-preview-09-2025';
    const url = `${protocol}//${window.location.host}/api/live?` +
      `assistantName=${encodeURIComponent(this.options.assistantName || 'ROSE')}&` +
      `ownerName=${encodeURIComponent(this.options.ownerName || 'MD YOUSUF KHAN')}&` +
      `voiceName=${encodeURIComponent(this.options.voiceName || 'Sulafat')}&` +
      `language=${encodeURIComponent(this.options.language || 'bn-BD')}&` +
      `model=${encodeURIComponent(model)}&` +
      `personality=${encodeURIComponent(this.options.personality || 'Normal')}&` +
      `responseStyle=${encodeURIComponent(this.options.responseStyle || 'Balanced')}&` +
      `memoryFacts=${encodeURIComponent(this.options.memoryFacts || '')}&` +
      `recentSummary=${encodeURIComponent(this.options.recentSummary || '')}&` +
      `apiKey=${encodeURIComponent(apiKey)}`;

    logVoiceEvent("Live WS", "Connecting to server live bridge...");
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      logVoiceEvent("Live WS", "[onopen] Connected, awaiting setupComplete...", "success");
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.setupComplete) {
            logVoiceEvent("Live WS", "[onmessage] Setup complete.", "success");
            this.isConnected = true;
            this.updateState('listening');
            this.startMicCapture(micStart);
            return;
        }
        if (msg.error) {
          logVoiceEvent("Live WS", `[onmessage] Server error: ${msg.error}`, "error");
          this.options.onError?.(msg.error, { reason: msg.error });
        }
        if (msg.transcription) {
          this.options.onTranscription?.(msg.transcription.role, msg.transcription.text, msg.transcription.isFinal);
        }
        if (msg.audio) {
          this.audioChunksReceived++;
          if (this.audioChunksReceived === 1) {
            this.firstAudioChunkReceivedTime = Date.now();
            if (this.speechEndTime > 0) {
              this.options.onTiming?.("speechEnd_to_firstAudio", this.firstAudioChunkReceivedTime - this.speechEndTime);
            }
          }
          this.updateState('speaking');
          this.playPcmAudio(msg.audio);
        }
        if (msg.interrupted) {
          this.stopAllAudioPlayback();
          this.updateState('listening');
          this.options.onInterrupted?.();
        }
        if (msg.turnComplete) {
          this.scheduleReturnToListening();
          this.options.onTurnComplete?.();
        }
        if (msg.action) {
          this.options.onAction?.(msg.action, msg.payload, msg.id);
        }
      } catch (e) {}
    };

    this.ws.onclose = (ev) => {
      const reason = ev.reason || "Connection lost";
      console.error(`[Live WS] Closed (code ${ev.code}): ${reason}`);
      logVoiceEvent("Live WS", `[onclose] Code: ${ev.code}, Reason: ${reason}`, ev.code === 1000 ? "info" : "warn");
      this.isConnected = false;
      this.options.onError?.(`সংযোগ বিচ্ছিন্ন (CODE: ${ev.code}): ${reason}`, { code: ev.code, reason });
      this.stop(false);
      this.options.onClose?.(ev);
    };

    try {
      this.playbackAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      await this.playbackAudioCtx.resume();
    } catch (e) {}
  }

  private async startMicCapture(micStart: number) {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true }
      });

      this.micAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      await this.micAudioCtx.resume();

      const source = this.micAudioCtx.createMediaStreamSource(this.micStream);
      this.scriptProcessor = this.micAudioCtx.createScriptProcessor(1024, 1, 1);
      
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN || this.isMuted) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        let sumSq = 0;
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          sumSq += s * s;
        }

        const rms = Math.sqrt(sumSq / inputData.length);
        this.options.onVolume?.(Math.min(100, Math.round(rms * 100)));

        const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
        
        try {
          if (this.audioChunksReceived === 0) console.log("[Live] Sending first audio chunk");
          this.ws.send(JSON.stringify({ 
            realtime_input: { 
              media_chunks: [{ data: base64, mime_type: "audio/pcm;rate=16000" }] 
            } 
          }));
        } catch (err) {}
      };

      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.micAudioCtx.destination);
      this.options.onMicLive?.(true);

      const lat1 = Date.now() - micStart;
      this.options.onTiming?.("micStart_to_firstChunk", lat1);

    } catch (e: any) {
      logVoiceEvent("Live Mic", `Mic failed: ${e.message}`, "error");
      this.options.onError?.("Microphone access failed.");
    }
  }

  private async playPcmAudio(base64Pcm: string) {
    if (!this.playbackAudioCtx) return;
    try {
      const binaryStr = atob(base64Pcm);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      const audioBuffer = this.playbackAudioCtx.createBuffer(1, float32.length, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = this.playbackAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      const gainNode = this.playbackAudioCtx.createGain();
      const vol = localStorage.getItem('rose_prefs') ? JSON.parse(localStorage.getItem('rose_prefs')!).voiceVolume || 80 : 80;
      gainNode.gain.value = vol / 100;
      source.connect(gainNode);
      gainNode.connect(this.playbackAudioCtx.destination);

      const currentTime = this.playbackAudioCtx.currentTime;
      const startTime = Math.max(currentTime, this.nextStartTime);
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

  private stopAllAudioPlayback() {
    for (const source of this.scheduledAudioSources) {
      try { source.stop(); } catch (e) {}
    }
    this.scheduledAudioSources = [];
    this.nextStartTime = 0;
  }

  private scheduleReturnToListening() {
    setTimeout(() => {
      if (this.scheduledAudioSources.length === 0) {
        this.updateState('listening');
      } else {
        this.scheduleReturnToListening();
      }
    }, 200);
  }

  private updateState(newState: 'connecting' | 'listening' | 'thinking' | 'speaking' | 'off') {
    if (this.currentState !== newState) {
      this.currentState = newState;
      this.options.onStateChange?.(newState);
    }
  }

  public stop(userInitiated: boolean = true) {
    if (userInitiated) this.wasStoppedByUser = true;
    this.isConnected = false;
    this.updateState('off');
    this.options.onMicLive?.(false);

    this.stopAllAudioPlayback();

    if (this.scriptProcessor && this.micAudioCtx) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.micAudioCtx) {
      this.micAudioCtx.close();
      this.micAudioCtx = null;
    }
    if (this.playbackAudioCtx) {
      this.playbackAudioCtx.close();
      this.playbackAudioCtx = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
  }

  public sendVideoFrame(base64Jpeg: string) {
    if (!this.isConnected || !this.ws) return;
    try {
      this.ws.send(JSON.stringify({ realtime_input: { media_chunks: [{ data: base64Jpeg, mime_type: "image/jpeg" }] } }));
    } catch (e) {}
  }

  public sendToolResponse(response: any) {
    if (!this.isConnected || !this.ws) return;
    try {
      this.ws.send(JSON.stringify({ toolResponse: response }));
    } catch (e) {}
  }
}
