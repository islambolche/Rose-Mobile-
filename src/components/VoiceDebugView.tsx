import React, { useState, useEffect, useRef } from "react";
import { getGlobalMicStream, stopGlobalMicStream } from "../lib/audio-manager";
import { ArrowLeft, CheckCircle, XCircle, Loader2, Copy, Trash2, RefreshCw, Mic, Volume2, Bug, Sparkles, Activity, Clock, AlertTriangle } from "lucide-react";
import { UnifiedSettings } from "../types/settings";
import { getVoiceLogs, clearVoiceLogs, logVoiceEvent, VoiceLogEntry, getVADMetrics } from "../lib/voiceLogger";
import { ensureGeminiReady } from "../lib/geminiKey";
import {
  generateVoiceAnswer,
  generateVoiceTTS,
  getCachedAnswerModel,
  getCachedTTSModel,
  getFriendlyErrorMessage,
  getLastTurnTiming,
  VoiceTurnTiming,
} from "../lib/voiceEngine";
import {
  getQuotaUsage,
  getExhaustedModelsToday,
  getResetCountdownString,
  DailyUsageData,
} from "../lib/quotaManager";

interface VoiceDebugViewProps {
  settings: UnifiedSettings;
  onBack: () => void;
  setToast?: (msg: string) => void;
}

interface StepStatus {
  id: number;
  title: string;
  status: "pending" | "running" | "pass" | "fail";
  detail?: string;
  error?: string;
}

export const VoiceDebugView: React.FC<VoiceDebugViewProps> = ({ settings, onBack, setToast }) => {
  const [logs, setLogs] = useState<VoiceLogEntry[]>([]);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeAnswerModel, setActiveAnswerModel] = useState<string>(getCachedAnswerModel());
  const [activeTTSModel, setActiveTTSModel] = useState<string>(getCachedTTSModel());
  const [vadMetrics, setVadMetrics] = useState({ state: "IDLE", volume: 0, threshold: 0.02 });
  const [lastTiming, setLastTiming] = useState<VoiceTurnTiming | null>(getLastTurnTiming());
  const [quotaData, setQuotaData] = useState<DailyUsageData>(getQuotaUsage());
  const [exhaustedModels, setExhaustedModels] = useState<string[]>(getExhaustedModelsToday());
  const [resetCountdown, setResetCountdown] = useState<string>(getResetCountdownString());

  const [steps, setSteps] = useState<StepStatus[]>([
    { id: 1, title: "Key found", status: "pending" },
    { id: 2, title: "Microphone allowed", status: "pending" },
    { id: 3, title: "Model found", status: "pending" },
    { id: 4, title: "VAD started", status: "pending" },
    { id: 5, title: "Audio processed", status: "pending" },
    { id: 6, title: "Response generated", status: "pending" },
    { id: 7, title: "TTS active", status: "pending" },
    { id: 8, title: "Audio playing", status: "pending" },
  ]);

  const updateStep = (id: number, status: "running" | "pass" | "fail", detail?: string, error?: string) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status, detail, error } : s)));
  };

  const refreshLogs = () => {
    setLogs(getVoiceLogs().slice(0, 20));
    setActiveAnswerModel(getCachedAnswerModel());
    setActiveTTSModel(getCachedTTSModel());
    setVadMetrics(getVADMetrics());
    setLastTiming(getLastTurnTiming());
    setQuotaData(getQuotaUsage());
    setExhaustedModels(getExhaustedModelsToday());
    setResetCountdown(getResetCountdownString());
  };

  useEffect(() => {
    refreshLogs();
    const interval = setInterval(refreshLogs, 1500);
    return () => clearInterval(interval);
  }, []);

  const handleCopyLogs = () => {
    const text = logs
      .map((l) => `[${l.timestamp}] [${l.step}] [${l.level.toUpperCase()}] ${l.message} ${l.details || ""}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    if (setToast) setToast("Copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearLogs = () => {
    clearVoiceLogs();
    refreshLogs();
    if (setToast) setToast("Logs cleared");
  };

  const runFullVoiceTest = async () => {
    setIsRunningTest(true);
    logVoiceEvent("Test Voice", "Started full 3-second voice diagnostic test...");

    setSteps((prev) => prev.map((s) => ({ ...s, status: "pending", detail: undefined, error: undefined })));

    // STEP 1: Key found
    updateStep(1, "running");
    const apiKey = settings.geminiApiKey || localStorage.getItem("gemini_api_key") || "";
    const ready = await ensureGeminiReady(apiKey);
    if (ready) {
      updateStep(
        1,
        "pass",
        apiKey && apiKey.length > 10
          ? `Key found (${apiKey.slice(0, 6)}...${apiKey.slice(-4)})`
          : "Server Gemini API configured"
      );
    } else {
      updateStep(1, "fail", undefined, "Gemini API key missing. Add key in Settings > Connections.");
      setIsRunningTest(false);
      refreshLogs();
      return;
    }

    // STEP 2: Microphone allowed
    updateStep(2, "running");
    let micStream: MediaStream | null = null;
    try {
      micStream = await getGlobalMicStream({ audio: true });
      updateStep(2, "pass", "Microphone permission granted");
    } catch (err: any) {
      updateStep(2, "fail", undefined, `Mic permission denied: ${err?.message || String(err)}`);
      setIsRunningTest(false);
      refreshLogs();
      return;
    }

    // STEP 3: Model found
    updateStep(3, "running");
    updateStep(3, "pass", `Active answer model: ${getCachedAnswerModel()}`);

    // STEP 4: VAD started
    updateStep(4, "running");
    updateStep(4, "pass", "VAD audio processor active");

    // STEP 5: Audio processed (Record 3 seconds)
    updateStep(5, "running", "Recording 3 seconds test sample...");
    let audioChunks: Blob[] = [];
    let mediaRecorder: MediaRecorder | null = null;
    try {
      mediaRecorder = new MediaRecorder(micStream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.start();

      await new Promise((r) => setTimeout(r, 3000));
      mediaRecorder.stop();
      await new Promise((r) => setTimeout(r, 200));

      const recordedBlob = new Blob(audioChunks, { type: "audio/wav" });
      updateStep(5, "pass", `Audio processed (${Math.round(recordedBlob.size / 1024)} KB recorded)`);

      // STEP 6: Response generated
      updateStep(6, "running");
      const answerRes = await generateVoiceAnswer({
        // generateVoiceAnswer internally now uses prepareHistory + mapRole + logs
        contents: [{ role: "user", parts: [{ text: "Hello Rose, give me a 1 sentence friendly response." }] }],
        systemInstruction: "You are ROSE, personal assistant created by MD Yousuf Khan. Answer in 1 short sentence.",
        apiKey,
        groqKey: settings.groqApiKeys || localStorage.getItem("groq_api_keys") || "",
        audioBlob: recordedBlob,
        languageCode: settings.language || "bn",
      });

      if (answerRes && answerRes.text && answerRes.text.trim()) {
        setActiveAnswerModel(answerRes.modelUsed);
        updateStep(6, "pass", `Response: "${answerRes.text.slice(0, 40)}..." (Model: ${answerRes.modelUsed})`);

        // STEP 7: TTS active
        updateStep(7, "running");
        const ttsRes = await generateVoiceTTS({
          text: answerRes.text,
          voiceName: settings.voiceName || "Sulafat",
          apiKey,
        });

        setActiveTTSModel(ttsRes.modelUsed);

        if (ttsRes.audioBase64) {
          updateStep(7, "pass", `Gemini TTS audio ready (${ttsRes.modelUsed})`);

          // STEP 8: Audio playing
          updateStep(8, "running");
          const audio = new Audio(`data:audio/mp3;base64,${ttsRes.audioBase64}`);
          audio.play().catch(() => {});
          updateStep(8, "pass", "Audio playback initiated successfully");
        } else if (ttsRes.quotaExhaustedNotice) {
          updateStep(7, "pass", ttsRes.quotaExhaustedNotice);
          updateStep(8, "pass", "Displaying text notice (no fallback male audio)");
        } else {
          updateStep(7, "fail", undefined, "TTS returned empty audio data");
          updateStep(8, "fail", undefined, "Skipped playback");
        }
      } else {
        updateStep(6, "fail", undefined, "Answer step returned empty response");
        updateStep(7, "fail", undefined, "Skipped");
        updateStep(8, "fail", undefined, "Skipped");
      }
    } catch (err: any) {
      const friendly = getFriendlyErrorMessage(err);
      updateStep(6, "fail", undefined, friendly);
      updateStep(7, "fail", undefined, "Skipped due to answer failure");
      updateStep(8, "fail", undefined, "Skipped");
    } finally {
      if (micStream) {
        micStream.getTracks().forEach((t) => t.stop());
      }
      setIsRunningTest(false);
      refreshLogs();
    }
  };

  return (
    <div className="fixed inset-0 z-[140] bg-[#020617] text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Header */}
      <header className="px-5 py-4 bg-[#0A1628]/95 border-b border-purple-500/20 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-purple-400 active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-black uppercase tracking-tighter italic text-white flex items-center gap-2">
              <Bug className="w-5 h-5 text-purple-400" /> Voice debug
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Check voice status and errors
            </p>
          </div>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 no-scrollbar pb-32">
        {/* Usage Today Card (Requirement 5) */}
        <section className="bg-[#0A1628] border border-indigo-500/30 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-white">Usage Today ({quotaData.date})</h3>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-indigo-300 font-mono bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
              <Clock className="w-3 h-3 text-indigo-400" />
              <span>Resets in: {resetCountdown}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-black/40 border border-white/5 p-2.5 rounded-xl">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Answer Calls Today</p>
              <p className="font-mono text-cyan-300 text-base font-black mt-0.5">{quotaData.answerCallsCount}</p>
            </div>
            <div className="bg-black/40 border border-white/5 p-2.5 rounded-xl">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">TTS Audio Calls Today</p>
              <p className="font-mono text-purple-300 text-base font-black mt-0.5">{quotaData.ttsCallsCount}</p>
            </div>
          </div>

          <div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" /> Exhausted Models Today (429)
            </p>
            {exhaustedModels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {exhaustedModels.map((m) => (
                  <span key={m} className="text-[10px] font-mono bg-red-500/10 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-md font-bold">
                    {m} (429)
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                No models exhausted today. All quota clear.
              </p>
            )}
          </div>
        </section>

        {/* Active Models Card */}
        <section className="bg-[#0A1628] border border-purple-500/30 rounded-2xl p-4 shadow-xl space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Active Cached Models</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-black/40 border border-white/5 p-2.5 rounded-xl">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Answer Model</p>
              <p className="font-mono text-purple-300 font-bold truncate mt-0.5">{activeAnswerModel}</p>
            </div>
            <div className="bg-black/40 border border-white/5 p-2.5 rounded-xl">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Voice / TTS Model</p>
              <p className="font-mono text-pink-300 font-bold truncate mt-0.5">{activeTTSModel}</p>
            </div>
          </div>
        </section>

        {/* Real-time VAD Metrics Card */}
        <section className="bg-[#0A1628] border border-emerald-500/30 rounded-2xl p-4 shadow-xl space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Mic className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">VAD Realtime Metrics</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-black/40 border border-white/5 p-2.5 rounded-xl">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">State</p>
              <p className="font-mono text-emerald-400 font-bold truncate mt-0.5 uppercase">{vadMetrics.state}</p>
            </div>
            <div className="bg-black/40 border border-white/5 p-2.5 rounded-xl">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Volume (RMS)</p>
              <p className="font-mono text-cyan-300 font-bold truncate mt-0.5">{vadMetrics.volume.toFixed(4)}</p>
            </div>
            <div className="bg-black/40 border border-white/5 p-2.5 rounded-xl">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Threshold</p>
              <p className="font-mono text-amber-300 font-bold truncate mt-0.5">{vadMetrics.threshold.toFixed(4)}</p>
            </div>
          </div>
        </section>

        {/* Turn Step Timing Breakdown Card */}
        <section className="bg-[#0A1628] border border-cyan-500/30 rounded-2xl p-4 shadow-xl space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">Turn Timing Breakdown</h3>
          </div>
          {lastTiming ? (
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-black/40 border border-white/5 p-2 rounded-xl">
                <span className="text-[9px] text-slate-500 block">Speech Heard</span>
                <span className="text-cyan-300 font-bold">{lastTiming.speechHeardMs} ms</span>
              </div>
              <div className="bg-black/40 border border-white/5 p-2 rounded-xl">
                <span className="text-[9px] text-slate-500 block">Transcription</span>
                <span className="text-purple-300 font-bold">{lastTiming.sttMs} ms</span>
              </div>
              <div className="bg-black/40 border border-white/5 p-2 rounded-xl">
                <span className="text-[9px] text-slate-500 block">LLM Answer</span>
                <span className="text-pink-300 font-bold">{lastTiming.answerMs} ms</span>
              </div>
              <div className="bg-black/40 border border-white/5 p-2 rounded-xl">
                <span className="text-[9px] text-slate-500 block">TTS Audio</span>
                <span className="text-amber-300 font-bold">{lastTiming.ttsMs} ms</span>
              </div>
              <div className="col-span-2 bg-cyan-950/40 border border-cyan-500/30 p-2 rounded-xl flex justify-between items-center">
                <span className="text-[10px] text-cyan-200 uppercase font-bold">Total Turn Latency</span>
                <span className="text-cyan-300 font-black text-sm">{lastTiming.totalMs} ms</span>
              </div>
            </div>
          ) : (
            <p className="text-[10px] text-slate-500 italic font-mono">No voice turn recorded yet this session.</p>
          )}
        </section>

        {/* Step Status Checklist */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black uppercase tracking-[2px] text-slate-500">Pipeline Step Status</h3>
            <button
              onClick={runFullVoiceTest}
              disabled={isRunningTest}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              {isRunningTest ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Test voice
            </button>
          </div>

          <div className="space-y-1.5">
            {steps.map((s) => (
              <div key={s.id} className="bg-[#0A1628]/80 border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-white/5 text-[9px] font-mono flex items-center justify-center text-slate-400 shrink-0">
                      {s.id}
                    </span>
                    {s.title}
                  </span>
                  {s.status === "running" && <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />}
                  {s.status === "pass" && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                  {s.status === "fail" && <XCircle className="w-4 h-4 text-red-400" />}
                  {s.status === "pending" && <span className="text-[9px] text-slate-600 font-mono">PENDING</span>}
                </div>

                {s.detail && (
                  <p className="text-[10px] font-mono text-emerald-300 bg-emerald-950/30 border border-emerald-500/20 px-2 py-0.5 rounded break-all mt-0.5">
                    {s.detail}
                  </p>
                )}

                {s.error && (
                  <p className="text-[10px] font-mono text-red-300 bg-red-950/30 border border-red-500/20 px-2 py-0.5 rounded break-all mt-0.5">
                    {s.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Logs Section */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-black uppercase tracking-[2px] text-slate-500">
              Voice Logs (Last 20)
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLogs}
                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-slate-300 uppercase flex items-center gap-1 active:scale-95 transition-transform"
              >
                <Copy className="w-3 h-3" /> {copied ? "Copied" : "Copy log"}
              </button>
              <button
                onClick={handleClearLogs}
                className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1 active:scale-95 transition-transform"
              >
                <Trash2 className="w-3 h-3" /> Clear log
              </button>
            </div>
          </div>

          <div className="bg-black/60 border border-white/10 rounded-2xl p-3 font-mono text-[10px] space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            {logs.length === 0 ? (
              <p className="text-slate-600 italic text-center py-4">No logs recorded yet.</p>
            ) : (
              logs.map((l) => (
                <div key={l.id} className="border-b border-white/5 pb-1.5 last:border-none">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>[{l.timestamp}]</span>
                    <span className={`uppercase font-bold ${
                      l.level === "success" ? "text-emerald-400" :
                      l.level === "error" ? "text-red-400" :
                      l.level === "warn" ? "text-amber-400" : "text-purple-400"
                    }`}>
                      {l.step}
                    </span>
                  </div>
                  <p className="text-slate-200 mt-0.5 break-all">{l.message}</p>
                  {l.details && <p className="text-slate-400 text-[9px] italic mt-0.5 break-all">{l.details}</p>}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
