export interface VoiceDebugTurn {
  id: string;
  timestamp: number;
  timeLabel: string;
  speechToTranscriptMs: number | null;
  speechToRoseAudioMs: number | null;
  transcriptPreview: string;
}

export interface VoiceDebugSnapshot {
  platform: 'App' | 'Chrome';
  sampleRate: number;
  captureMethod: 'Worklet' | 'ScriptProcessor' | 'RoseMic' | 'Idle';
  chunkSizeMs: number;
  chunksSentPerSecond: number;
  micLevel: number; // 0 to 100
  speechToFirstTranscriptMs: number | null;
  speechToFirstRoseAudioMs: number | null;
  lastError: string;
  turns: VoiceDebugTurn[];
}

const TURNS_STORAGE_KEY = 'rose_voice_debug_turns_v1';

export function isAndroidApp(): boolean {
  return typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.() === true;
}

function loadSavedTurns(): VoiceDebugTurn[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TURNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveTurns(turns: VoiceDebugTurn[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TURNS_STORAGE_KEY, JSON.stringify(turns.slice(0, 5)));
  } catch {
    // ignore storage errors
  }
}

class VoiceDebugStore {
  private sampleRate = 0;
  private captureMethod: 'Worklet' | 'ScriptProcessor' | 'RoseMic' | 'Idle' = 'Idle';
  private chunkSizeMs = 40;
  private chunkTimestamps: number[] = [];
  private micLevel = 0;
  private speechToFirstTranscriptMs: number | null = null;
  private speechToFirstRoseAudioMs: number | null = null;
  private lastError = '';
  private turns: VoiceDebugTurn[] = loadSavedTurns();

  // Turn timing tracking
  private lastSpeechActiveAt = 0;
  private currentTurnId: string | null = null;
  private currentTurnSpeechRefAt = 0;
  private currentTurnHasTranscript = false;
  private currentTurnHasAudio = false;
  private currentTurnTranscript = '';

  private listeners = new Set<() => void>();
  private lastNotifyAt = 0;

  private notify(force = false) {
    const now = Date.now();
    if (!force && now - this.lastNotifyAt < 80) return;
    this.lastNotifyAt = now;
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore listener error
      }
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  recordAudioContextInit(
    sampleRate: number,
    captureMethod: 'Worklet' | 'ScriptProcessor' | 'RoseMic',
    chunkSizeMs = 40
  ) {
    this.sampleRate = sampleRate;
    this.captureMethod = captureMethod;
    this.chunkSizeMs = Math.round(chunkSizeMs);
    this.notify(true);
  }

  recordChunkSent(rms: number, chunkSizeMs?: number) {
    const now = Date.now();
    this.chunkTimestamps.push(now);
    const cutoff = now - 1000;
    while (this.chunkTimestamps.length > 0 && this.chunkTimestamps[0] < cutoff) {
      this.chunkTimestamps.shift();
    }
    if (typeof chunkSizeMs === 'number' && chunkSizeMs > 0) {
      this.chunkSizeMs = Math.round(chunkSizeMs);
    }
    // Convert float RMS (typically 0..0.35) to 0..100 meter level
    const scaledLevel = Math.min(100, Math.round(Math.pow(Math.min(1, rms * 4.5), 0.75) * 100));
    this.micLevel = scaledLevel;

    // Track end of user speech (whenever mic RMS exceeds speech floor)
    if (rms > 0.012) {
      this.lastSpeechActiveAt = now;
      if (this.currentTurnHasAudio) {
        // User started speaking a new turn after previous Rose response
        this.currentTurnId = null;
        this.currentTurnHasTranscript = false;
        this.currentTurnHasAudio = false;
        this.currentTurnTranscript = '';
      }
    }

    this.notify(false);
  }

  recordMicLevel(rms: number) {
    const now = Date.now();
    const scaledLevel = Math.min(100, Math.round(Math.pow(Math.min(1, rms * 4.5), 0.75) * 100));
    this.micLevel = scaledLevel;
    if (rms > 0.012) {
      this.lastSpeechActiveAt = now;
    }
    this.notify(false);
  }

  private ensureCurrentTurn(now: number): VoiceDebugTurn {
    if (!this.currentTurnId) {
      this.currentTurnId = `turn-${now}`;
      this.currentTurnSpeechRefAt = this.lastSpeechActiveAt > 0 && now - this.lastSpeechActiveAt < 15000
        ? this.lastSpeechActiveAt
        : now;
      this.currentTurnHasTranscript = false;
      this.currentTurnHasAudio = false;
      this.currentTurnTranscript = '';
      const newTurn: VoiceDebugTurn = {
        id: this.currentTurnId,
        timestamp: now,
        timeLabel: new Date(now).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        speechToTranscriptMs: null,
        speechToRoseAudioMs: null,
        transcriptPreview: '',
      };
      this.turns = [newTurn, ...this.turns].slice(0, 5);
      saveTurns(this.turns);
      return newTurn;
    }
    return this.turns[0];
  }

  recordFirstTranscript(text: string) {
    const clean = (text || '').trim();
    if (!clean || clean === 'শুনছি...' || clean === 'শুনছি…') return;
    const now = Date.now();
    const turn = this.ensureCurrentTurn(now);
    this.currentTurnTranscript = clean;
    turn.transcriptPreview = clean.slice(0, 60);

    if (!this.currentTurnHasTranscript) {
      this.currentTurnHasTranscript = true;
      const refTime = this.lastSpeechActiveAt > 0 && now - this.lastSpeechActiveAt < 15000
        ? this.lastSpeechActiveAt
        : this.currentTurnSpeechRefAt || now;
      const deltaMs = Math.max(0, now - refTime);
      this.speechToFirstTranscriptMs = deltaMs;
      turn.speechToTranscriptMs = deltaMs;
    }
    saveTurns(this.turns);
    this.notify(true);
  }

  recordFirstRoseAudio() {
    const now = Date.now();
    const turn = this.ensureCurrentTurn(now);
    if (!this.currentTurnHasAudio) {
      this.currentTurnHasAudio = true;
      const refTime = this.lastSpeechActiveAt > 0 && now - this.lastSpeechActiveAt < 20000
        ? this.lastSpeechActiveAt
        : this.currentTurnSpeechRefAt || now;
      const deltaMs = Math.max(0, now - refTime);
      this.speechToFirstRoseAudioMs = deltaMs;
      turn.speechToRoseAudioMs = deltaMs;
      saveTurns(this.turns);
      this.notify(true);
    }
  }

  finishTurn() {
    this.currentTurnId = null;
    this.currentTurnHasTranscript = false;
    this.currentTurnHasAudio = false;
    this.currentTurnTranscript = '';
  }

  recordError(err: string) {
    if (!err) return;
    this.lastError = String(err).slice(0, 200);
    this.notify(true);
  }

  clearTurns() {
    this.turns = [];
    this.speechToFirstTranscriptMs = null;
    this.speechToFirstRoseAudioMs = null;
    this.lastError = '';
    saveTurns([]);
    this.notify(true);
  }

  getSnapshot(): VoiceDebugSnapshot {
    const now = Date.now();
    const cutoff = now - 1000;
    while (this.chunkTimestamps.length > 0 && this.chunkTimestamps[0] < cutoff) {
      this.chunkTimestamps.shift();
    }
    return {
      platform: isAndroidApp() ? 'App' : 'Chrome',
      sampleRate: this.sampleRate,
      captureMethod: this.captureMethod,
      chunkSizeMs: this.chunkSizeMs,
      chunksSentPerSecond: this.chunkTimestamps.length,
      micLevel: this.micLevel,
      speechToFirstTranscriptMs: this.speechToFirstTranscriptMs,
      speechToFirstRoseAudioMs: this.speechToFirstRoseAudioMs,
      lastError: this.lastError,
      turns: [...this.turns],
    };
  }
}

export const voiceDebugStore = new VoiceDebugStore();
