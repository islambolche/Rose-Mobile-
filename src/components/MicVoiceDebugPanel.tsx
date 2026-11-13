import React, { useEffect, useState } from 'react';
import { ArrowLeft, Activity, Trash2, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { voiceDebugStore, VoiceDebugSnapshot } from '../lib/voiceDebugStore';

interface MicVoiceDebugPanelProps {
  onBack: () => void;
  setToast?: (msg: string) => void;
}

export const MicVoiceDebugPanel: React.FC<MicVoiceDebugPanelProps> = ({ onBack, setToast }) => {
  const [snap, setSnap] = useState<VoiceDebugSnapshot>(() => voiceDebugStore.getSnapshot());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const update = () => setSnap(voiceDebugStore.getSnapshot());
    const unsub = voiceDebugStore.subscribe(update);
    const interval = setInterval(update, 250);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const handleCopyReport = async () => {
    const lines = [
      `=== ROSE VOICE DEBUG ===`,
      `Platform: ${snap.platform}`,
      `AudioContext sampleRate: ${snap.sampleRate ? `${snap.sampleRate} Hz` : 'Not started'}`,
      `Capture Method: ${snap.captureMethod}`,
      `Chunk Size: ${snap.chunkSizeMs} ms`,
      `Chunks Sent/sec: ${snap.chunksSentPerSecond}`,
      `Mic Level: ${snap.micLevel}%`,
      `Speech End -> First Transcript: ${snap.speechToFirstTranscriptMs !== null ? `${snap.speechToFirstTranscriptMs} ms` : '—'}`,
      `Speech End -> First Rose Audio: ${snap.speechToFirstRoseAudioMs !== null ? `${snap.speechToFirstRoseAudioMs} ms` : '—'}`,
      `Last Error: ${snap.lastError || 'None'}`,
      ``,
      `--- Last ${snap.turns.length} Turns ---`,
      ...snap.turns.map(
        (t, idx) =>
          `${idx + 1}. [${t.timeLabel}] Transcript: ${t.speechToTranscriptMs !== null ? `${t.speechToTranscriptMs}ms` : '—'} | Rose Audio: ${t.speechToRoseAudioMs !== null ? `${t.speechToRoseAudioMs}ms` : '—'} | "${t.transcriptPreview || '...'}"`
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setToast?.('Voice Debug কপি হয়েছে');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setToast?.('কপি করা যায়নি');
    }
  };

  return (
    <motion.div
      key="mic-voice-debug"
      data-current-view="voice_debug"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-[95] bg-[#020617] overflow-y-auto no-scrollbar flex flex-col"
    >
      <header className="sticky top-0 z-20 px-5 py-5 bg-[#020617]/95 backdrop-blur-md border-b border-white/5 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <button
            data-nav-id="back"
            onClick={onBack}
            className="p-2.5 bg-white/5 rounded-xl active:scale-95 transition-transform border border-white/5 text-slate-300 hover:text-white"
            aria-label="Back to Mic & Listening"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-tight">
            VOICE DEBUG
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyReport}
            className="px-3 py-2 bg-purple-600/20 border border-purple-500/40 rounded-xl text-[10px] font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5 active:scale-95 transition-transform"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>কপি</span>
          </button>
          <button
            type="button"
            onClick={() => {
              voiceDebugStore.clearTurns();
              setToast?.('Voice Debug পরিষ্কার করা হয়েছে');
            }}
            className="p-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-rose-400 active:scale-95 transition-transform"
            title="Clear history"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="px-5 py-5 flex flex-col flex-1">
        <div className="space-y-4 pb-36 flex-1">
          {/* Live Metrics Grid */}
          <div className="w-full p-5 bg-[#0F172A]/80 rounded-[2.5rem] border border-purple-500/30 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Activity className="w-5 h-5 text-purple-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  LIVE CAPTURE TELEMETRY
                </span>
              </div>
              <span
                className={
                  'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ' +
                  (snap.platform === 'App'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-purple-500/15 text-purple-300 border-purple-500/30')
                }
              >
                {snap.platform}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  PLATFORM
                </p>
                <p className="text-base font-mono font-black text-white mt-0.5">
                  {snap.platform}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  AUDIOCONTEXT RATE
                </p>
                <p className="text-base font-mono font-black text-purple-300 mt-0.5">
                  {snap.sampleRate > 0 ? `${snap.sampleRate} Hz → 16000 Hz` : 'Idle (→ 16000 Hz)'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  CAPTURE METHOD
                </p>
                <p className="text-base font-mono font-black text-teal-300 mt-0.5">
                  {snap.captureMethod}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  CHUNK SIZE
                </p>
                <p className="text-base font-mono font-black text-white mt-0.5">
                  {snap.chunkSizeMs} ms
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 col-span-2 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    CHUNKS SENT PER SECOND
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    Continuous ~40ms PCM16 (16kHz mono LE)
                  </p>
                </div>
                <p className="text-2xl font-mono font-black text-emerald-400">
                  {snap.chunksSentPerSecond} <span className="text-xs font-bold text-slate-400">/s</span>
                </p>
              </div>
            </div>

            {/* Mic Level Meter */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  MIC LEVEL METER
                </span>
                <span className="text-xs font-mono font-black text-purple-300">
                  {snap.micLevel}%
                </span>
              </div>
              <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 via-purple-500 to-pink-500 transition-all duration-75"
                  style={{ width: `${Math.max(2, Math.min(100, snap.micLevel))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Latency Card */}
          <div className="w-full p-5 bg-[#0F172A]/80 rounded-[2.5rem] border border-purple-500/30 shadow-2xl space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-white">
              RESPONSE LATENCY (CURRENT / LAST TURN)
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  END OF SPEECH → 1ST TRANSCRIPT
                </p>
                <p className="text-lg font-mono font-black text-teal-300 mt-1">
                  {snap.speechToFirstTranscriptMs !== null
                    ? `${snap.speechToFirstTranscriptMs} ms`
                    : '—'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  END OF SPEECH → 1ST ROSE AUDIO
                </p>
                <p className="text-lg font-mono font-black text-pink-300 mt-1">
                  {snap.speechToFirstRoseAudioMs !== null
                    ? `${snap.speechToFirstRoseAudioMs} ms`
                    : '—'}
                </p>
              </div>
            </div>

            {/* Last Error */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                LAST ERROR
              </p>
              <p
                className={
                  'text-xs font-mono break-words ' +
                  (snap.lastError ? 'text-rose-400 font-bold' : 'text-slate-500')
                }
              >
                {snap.lastError || 'None'}
              </p>
            </div>
          </div>

          {/* Last 5 Turns History */}
          <div className="w-full p-5 bg-[#0F172A]/80 rounded-[2.5rem] border border-purple-500/30 shadow-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-white">
                LAST 5 TURNS
              </h4>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {snap.turns.length} / 5
              </span>
            </div>

            {snap.turns.length === 0 ? (
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 text-center text-xs text-slate-500 font-bold">
                এখনো কোনো ভয়েস টার্ন রেকর্ড হয়নি
              </div>
            ) : (
              <div className="space-y-2.5">
                {snap.turns.map((turn, idx) => (
                  <div
                    key={turn.id || idx}
                    className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span>TURN #{idx + 1} · {turn.timeLabel}</span>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-teal-300">
                          TXT: {turn.speechToTranscriptMs !== null ? `${turn.speechToTranscriptMs}ms` : '—'}
                        </span>
                        <span className="text-pink-300">
                          AUD: {turn.speechToRoseAudioMs !== null ? `${turn.speechToRoseAudioMs}ms` : '—'}
                        </span>
                      </div>
                    </div>
                    {turn.transcriptPreview && (
                      <p className="text-xs text-slate-200 font-medium truncate">
                        “{turn.transcriptPreview}”
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
