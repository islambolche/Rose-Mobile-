import { useRef, useState } from "react";
import { getGeminiKey, ensureGeminiReady } from "./geminiKey";
import { getGlobalMicStream, stopGlobalMicStream } from "./audio-manager";

const StartSensitivity = { START_SENSITIVITY_HIGH: "START_SENSITIVITY_HIGH" } as const;
const EndSensitivity = { END_SENSITIVITY_HIGH: "END_SENSITIVITY_HIGH" } as const;

type Opts = {
  apiKey: string; model: string; voiceName: string; systemInstruction: string;
  assistantName?: string; ownerName?: string; personality?: string; language?: string; responseStyle?: string;
  onUserText?: (t: string) => void; onRoseText?: (t: string) => void;
  onTurnComplete?: () => void;
};

const b64FromBytes = (u8: Uint8Array) => {
  let s = "";
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const bytesFromB64 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

export function useRoseLive(getOpts: () => Opts) {
  const [on, setOn] = useState(false);
  const [status, setStatus] = useState("off");
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const [sent, setSent] = useState(0);
  const [recv, setRecv] = useState(0);
  const R = useRef<any>({ active: false, sources: new Set(), next: 0, session: null, retry: 0 });

  const stopPlayback = () => {
    const s = R.current;
    s.sources.forEach((x: any) => { try { x.stop(); } catch {} });
    s.sources.clear();
    s.next = 0;
  };

  const play = (b64: string) => {
    const s = R.current;
    if (!s.ctxOut) return;
    const i16 = new Int16Array(bytesFromB64(b64).buffer);
    const f = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 32768;
    const buf = s.ctxOut.createBuffer(1, f.length, 24000);
    buf.copyToChannel(f, 0);
    const src = s.ctxOut.createBufferSource();
    src.buffer = buf;
    src.connect(s.gain);
    const at = Math.max(s.next, s.ctxOut.currentTime);
    src.start(at);
    s.next = at + buf.duration;
    s.sources.add(src);
    src.onended = () => s.sources.delete(src);
  };

  const connectSession = () =>
    new Promise<void>((resolve, reject) => {
      const s = R.current;
      const o = getOpts();
      const apiKey = String(o.apiKey || getGeminiKey() || "").replace(/[\r\n\t\s"']+/g, "").trim();
      const rawModel = (o.model || "gemini-1.5-flash").replace(/^models\//, "").trim();
      const fullModel = `models/${rawModel}`;
      const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
      const wsUrl = `${protocol}//${host}/api/live?assistantName=${encodeURIComponent(o.assistantName || 'Rose AI')}&ownerName=${encodeURIComponent(o.ownerName || 'MD YOUSUF KHAN')}&voiceName=${encodeURIComponent(o.voiceName || 'Sulafat')}&personality=${encodeURIComponent(o.personality || 'Normal')}&language=${encodeURIComponent(o.language || 'bn-BD')}&responseStyle=${encodeURIComponent(o.responseStyle || 'Balanced')}&model=${encodeURIComponent(rawModel)}&apiKey=${encodeURIComponent(apiKey || '')}`;

      const ws = new WebSocket(wsUrl);
      let ready = false;

      const wrapper = {
        sendRealtimeInput: (x: any) => {
          if (ready && ws.readyState === 1) ws.send(JSON.stringify(x));
        },
        sendText: (t: string) => {
          if (ready && ws.readyState === 1) ws.send(JSON.stringify({ realtime_input: { text_chunks: [{ text: t }] } }));
        },
        close: () => { try { ws.close(); } catch {} },
      };

      ws.onopen = () => {
        ws.send(JSON.stringify({
          setup: {
            model: fullModel,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: o.voiceName || "Sulafat",
                  },
                },
              },
            },
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
            ...(o.systemInstruction
              ? { systemInstruction: { parts: [{ text: o.systemInstruction }] } }
              : {}),
          },
        }));
      };

      ws.onmessage = async (ev: MessageEvent) => {
        try {
          const m = JSON.parse(typeof ev.data === "string" ? ev.data : await (ev.data as Blob).text());

          if (m.setupComplete) {
            ready = true; s.session = wrapper; s.retry = 0;
            setStatus("listening"); resolve(); return;
          }

          if (m.serverContent) {
            const content = m.serverContent;
            if (content.modelTurn) {
              for (const part of content.modelTurn.parts || []) {
                if (part.inlineData) { s.recvN++; setRecv(s.recvN); play(part.inlineData.data); }
              }
            }
            if (content.inputTranscription?.text) {
              o.onUserText?.(content.inputTranscription.text);
            }
            if (content.outputTranscription?.text) {
              o.onRoseText?.(content.outputTranscription.text);
            }
            if (content.turnComplete) o.onTurnComplete?.();
          }

          if (m.error) setError(m.error.message || JSON.stringify(m.error));
        } catch (err: any) { setError("Parse error: " + String(err?.message || err)); }
      };

      ws.onerror = () => { setError("Cannot reach Gemini. Check your internet and your Gemini key."); if (!ready) reject(new Error("ws error")); };

      ws.onclose = (ev: CloseEvent) => {
        if (!s.active) return;
        const msg = `Closed ${ev.code} ${ev.reason || ""}`;
        setError(msg);
        s.retry = (s.retry || 0) + 1;
        if (!ready || s.retry > 3) { stop(); return; }
        setStatus("reconnecting");
        setTimeout(() => { if (s.active) connectSession().catch(() => stop()); }, 1000);
      };
    });

  const start = async () => {
    const s = R.current;
    const o = getOpts();
    const apiKey = String(o.apiKey || getGeminiKey() || "").replace(/[\r\n\t\s"']+/g, "").trim();
    if (s.active || !(await ensureGeminiReady(apiKey))) return;
    setError(""); setStatus("connecting"); R.current.retries = 0;
    try {
      s.active = true; s.sentN = 0; s.recvN = 0; setSent(0); setRecv(0);
      s.ctxIn = new AudioContext({ latencyHint: 'interactive' });
      s.ctxOut = new AudioContext({ sampleRate: 24000, latencyHint: 'interactive' });
      await s.ctxIn.resume(); await s.ctxOut.resume();
      s.stream = await getGlobalMicStream({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      s.gain = s.ctxOut.createGain();
      s.anOut = s.ctxOut.createAnalyser(); s.anOut.fftSize = 256;
      s.gain.connect(s.anOut); s.gain.connect(s.ctxOut.destination);
      s.source = s.ctxIn.createMediaStreamSource(s.stream);
      s.anIn = s.ctxIn.createAnalyser(); s.anIn.fftSize = 256;
      s.source.connect(s.anIn);
      s.proc = s.ctxIn.createScriptProcessor(4096, 1, 1);
      s.source.connect(s.proc);
      s.proc.connect(s.ctxIn.destination);
      s.proc.onaudioprocess = (e: any) => {
        if (!s.active || !s.session) return;
        const inp = e.inputBuffer.getChannelData(0);
        const ratio = s.ctxIn.sampleRate / 16000;
        const n = Math.floor(inp.length / ratio);
        const out = new Int16Array(n);
        for (let i = 0; i < n; i++) {
          const v = Math.max(-1, Math.min(1, inp[Math.floor(i * ratio)]));
          out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
        }
        try {
          s.session.sendRealtimeInput({
            realtime_input: {
              media_chunks: [{ data: b64FromBytes(new Uint8Array(out.buffer)), mime_type: "audio/pcm;rate=16000" }]
            }
          });
          s.sentN++; if (s.sentN % 5 === 0) setSent(s.sentN);
        } catch (err: any) { setError(String(err?.message || err)); }
      };
      const aIn = new Uint8Array(s.anIn.frequencyBinCount);
      const aOut = new Uint8Array(s.anOut.frequencyBinCount);
      const avg = (a: Uint8Array) => a.reduce((x, y) => x + y, 0) / a.length / 255;
      const tick = () => {
        if (!s.active) return;
        s.anIn.getByteFrequencyData(aIn); s.anOut.getByteFrequencyData(aOut);
        setLevel(Math.min(1, Math.max(avg(aIn), avg(aOut)) * 2.5));
        s.raf = requestAnimationFrame(tick);
      };
      tick();
      setOn(true);
      await connectSession();
    } catch (e: any) {
      setError(String(e?.message || e));
      stop();
    }
  };

  const stop = () => {
    const s = R.current;
    s.active = false;
    if (s.raf) cancelAnimationFrame(s.raf);
    try { s.proc && (s.proc.onaudioprocess = null, s.proc.disconnect()); } catch {}
    try { s.source?.disconnect(); } catch {}
    stopGlobalMicStream();
    try { s.session?.close(); } catch {}
    stopPlayback();
    try { s.ctxIn?.close(); } catch {}
    try { s.ctxOut?.close(); } catch {}
    s.session = null; s.stream = null; s.ctxIn = null; s.ctxOut = null;
    setOn(false); setLevel(0); setStatus("off");
  };

  const toggle = () => (R.current.active ? stop() : start());
  return { on, status, error, level, sent, recv, start, stop, toggle, session: R.current.session };
}
