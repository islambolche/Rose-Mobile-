import React, { useState, useEffect } from "react";
import { Zap, ArrowLeft, Key, Check, X, Loader2 } from "lucide-react";
import { UnifiedSettings } from "../types/settings";
import { getGeminiKey } from "../lib/geminiKey";

interface DiagnosticsViewProps {
  liveTimings: {
    micStart_to_firstChunk?: number;
    speechEnd_to_transcript?: number;
    speechEnd_to_firstAudio?: number;
    transcript_to_firstAudio?: number;
    firstAudio_to_soundPlayed?: number;
    audioChunksReceived?: number;
  };
  unifiedSettings: UnifiedSettings;
  onBack: () => void;
}

interface TestStep {
  label: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  details?: string;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  liveTimings,
  unifiedSettings,
  onBack,
}) => {
  const [geminiKey, setLocalGeminiKey] = useState<string>(() => getGeminiKey());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'PASS' | 'FAIL' | null>(null);
  const [testSteps, setTestSteps] = useState<TestStep[]>([]);

  useEffect(() => {
    const updateKey = () => setLocalGeminiKey(getGeminiKey());
    window.addEventListener("gemini_key_updated", updateKey);
    window.addEventListener("storage", updateKey);
    return () => {
      window.removeEventListener("gemini_key_updated", updateKey);
      window.removeEventListener("storage", updateKey);
    };
  }, []);

  const runMinimalTest = async () => {
    if (isTesting) return;
    
    setIsTesting(true);
    setTestResult(null);
    setTestSteps([]);
    
    const key = getGeminiKey();
    if (!key) {
      setTestSteps([{ label: "Gemini key পাওয়া যায়নি", status: "error" }]);
      setTestResult("FAIL");
      setIsTesting(false);
      return;
    }

    const steps: TestStep[] = [
      { label: "কানেক্ট হচ্ছে", status: "loading" },
      { label: "খুলেছে", status: "pending" },
      { label: "মাইক চালু", status: "pending" },
      { label: "অডিও পাঠানো হচ্ছে", status: "pending" },
      { label: "উত্তর এসেছে", status: "pending" },
    ];
    setTestSteps([...steps]);

    let ws: WebSocket | null = null;
    let micStream: MediaStream | null = null;

    const updateStep = (idx: number, status: 'done' | 'error' | 'loading', details?: string) => {
      setTestSteps(prev => {
        const next = [...prev];
        if (next[idx]) {
          next[idx] = { ...next[idx], status, details };
        }
        return next;
      });
    };

    try {
      // 1. Connecting
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/live?minimal=1&apiKey=${encodeURIComponent(key)}`;
      
      ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        if (ws?.readyState !== WebSocket.OPEN) {
          updateStep(0, 'error', 'Timeout');
          setTestResult('FAIL');
          ws?.close();
          setIsTesting(false);
        }
      }, 10000);

      ws.onopen = async () => {
        clearTimeout(timeout);
        updateStep(0, 'done');
        updateStep(1, 'loading');
        
        // 2. Opened
        setTimeout(async () => {
          updateStep(1, 'done');
          updateStep(2, 'loading');

          try {
            // 3. Mic Start
            micStream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });
            updateStep(2, 'done');
            updateStep(3, 'loading');

            // 4. Send dummy audio
            // Just send a small silent buffer to trigger model
            const silentBuffer = new Int16Array(1600).buffer; 
            const base64Audio = btoa(String.fromCharCode(...new Uint8Array(silentBuffer)));
            ws?.send(JSON.stringify({ audio: base64Audio }));
            
            updateStep(3, 'done');
            updateStep(4, 'loading');
          } catch (micErr: any) {
            updateStep(2, 'error', micErr.message || 'Mic Access Denied');
            setTestResult('FAIL');
            ws?.close();
            setIsTesting(false);
          }
        }, 500);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.audio) {
          updateStep(4, 'done');
          setTestResult('PASS');
          ws?.close();
          setIsTesting(false);
        }
        if (data.error) {
          const currentIdx = steps.findIndex(s => s.status === 'loading');
          if (currentIdx !== -1) updateStep(currentIdx, 'error', data.error);
          setTestResult('FAIL');
          ws?.close();
          setIsTesting(false);
        }
      };

      ws.onerror = () => {
        const currentIdx = steps.findIndex(s => s.status === 'loading' || s.status === 'pending');
        if (currentIdx !== -1) updateStep(currentIdx, 'error', 'WS Error');
        setTestResult('FAIL');
        setIsTesting(false);
      };

      ws.onclose = (ev) => {
        if (!testResult && isTesting) {
          const currentIdx = steps.findIndex(s => s.status === 'loading' || s.status === 'pending');
          if (currentIdx !== -1) updateStep(currentIdx, 'error', `Closed ${ev.code}`);
          setTestResult('FAIL');
          setIsTesting(false);
        }
        if (micStream) {
          micStream.getTracks().forEach(t => t.stop());
        }
      };

    } catch (err: any) {
      const currentIdx = steps.findIndex(s => s.status === 'loading' || s.status === 'pending');
      if (currentIdx !== -1) updateStep(currentIdx, 'error', err.message);
      setTestResult('FAIL');
      setIsTesting(false);
    }
  };

  const hasGeminiKey = Boolean(geminiKey && geminiKey.length > 0);
  const geminiKeyLength = geminiKey ? geminiKey.length : 0;

  return (
    <div className="fixed inset-0 z-[210] bg-[#020617] flex flex-col font-sans select-none overflow-hidden">
      <header className="px-5 py-4 bg-[#0A1628]/95 border-b border-emerald-500/20 backdrop-blur-md flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-400 active:scale-90 transition-transform"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-sm font-black uppercase tracking-wider text-white">Diagnostics</h2>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Performance Monitor</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
        {/* MINIMAL LIVE TEST CARD */}
        <div className="bg-[#0A1628]/95 border border-purple-500/40 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-400" />
              <h3 className="font-black text-white uppercase tracking-wider text-xs">Minimal Live Test</h3>
            </div>
            {testResult && (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${testResult === 'PASS' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                {testResult}
              </span>
            )}
          </div>
          
          <div className="space-y-2 py-1">
            {testSteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-3">
                {step.status === 'done' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : step.status === 'error' ? (
                  <X className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                )}
                <span className={`text-[11px] font-bold ${step.status === 'error' ? 'text-rose-300' : step.status === 'done' ? 'text-slate-300' : 'text-white'}`}>
                  {step.label} {step.details && <span className="opacity-60 italic ml-1">({step.details})</span>}
                </span>
              </div>
            ))}
            {!isTesting && testSteps.length === 0 && (
              <p className="text-[10px] text-slate-400 leading-relaxed italic">
                এটি একটি ছোট সেশন খুলে শুধু অডিও কানেকশন পরীক্ষা করবে। এতে কোনো transcription বা অতিরিক্ত ফিল্ড থাকবে না।
              </p>
            )}
          </div>

          <button
            onClick={runMinimalTest}
            disabled={isTesting}
            className={`w-full py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${
              isTesting 
                ? 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/10' 
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/40'
            }`}
          >
            {isTesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Testing...
              </>
            ) : (
              'Run Minimal Test'
            )}
          </button>
        </div>

        {/* MODEL & KEY INFO */}
        <div className="bg-[#0A1628]/95 border border-emerald-500/40 rounded-2xl p-4 text-[11px] text-slate-300 shadow-xl flex flex-col gap-3">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="font-black text-white uppercase tracking-wider">Live Active Config</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Model</span>
              <span className="text-emerald-400 font-mono">gemini-2.5-flash-native-audio-preview-09-2025</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Voice</span>
              <span className="text-emerald-400">{unifiedSettings.voiceName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Assistant Name</span>
              <span className="text-emerald-400">{unifiedSettings.assistantName}</span>
            </div>
            <div className="flex justify-between items-center border-t border-white/5 pt-2">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Gemini key</span>
              <span className={`font-bold ${hasGeminiKey ? 'text-emerald-400' : 'text-rose-400'}`}>
                {hasGeminiKey ? `পাওয়া গেছে (${geminiKeyLength} অক্ষর)` : 'নেই'}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-white/5 pt-2">
              <span className="text-slate-400 uppercase font-bold text-[10px]">Audio Stream</span>
              <span className="text-emerald-400 font-mono font-bold">
                audio chunks received: {liveTimings.audioChunksReceived ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* AUDIO CHUNKS RECEIVED CARD */}
        <div className="bg-[#0A1628]/95 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-slate-400 uppercase font-black text-[9px] tracking-widest block mb-0.5">Live Audio Packets</span>
            <span className="text-sm font-black text-white">audio chunks received: {liveTimings.audioChunksReceived ?? 0}</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-mono font-black ${
            (liveTimings.audioChunksReceived ?? 0) > 0
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
              : 'bg-white/5 text-slate-500 border border-white/10'
          }`}>
            {liveTimings.audioChunksReceived ?? 0} chunks
          </span>
        </div>

        {/* LATENCY CARDS */}
        <div className="grid grid-cols-1 gap-3">
          <LatencyCard 
            label="মাইক চালু → প্রথম chunk" 
            value={liveTimings.micStart_to_firstChunk} 
            description="Time from microphone activation to first data packet."
          />
          <LatencyCard 
            label="কথা শেষ → ট্রান্সক্রিপ্ট" 
            value={liveTimings.speechEnd_to_transcript} 
            description="Processing time for speech-to-text conversion."
          />
          <LatencyCard 
            label="ট্রান্সক্রিপ্ট → প্রথম অডিও" 
            value={liveTimings.transcript_to_firstAudio} 
            description="Model generation time for the first audio response."
          />
          <LatencyCard 
            label="অডিও chunk → সাউন্ড বাজল" 
            value={liveTimings.firstAudio_to_soundPlayed} 
            description="Playback engine latency for the received audio stream."
          />
        </div>

        {liveTimings.speechEnd_to_firstAudio && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex flex-col items-center justify-center gap-1 shadow-lg">
            <span className="text-slate-400 uppercase font-black text-[9px] tracking-widest">Total Roundtrip</span>
            <span className="text-2xl font-black text-white tracking-tight">{liveTimings.speechEnd_to_firstAudio} ms</span>
            <p className="text-[10px] text-emerald-400/80 font-medium italic text-center px-4">
              "কথা শেষ → প্রথম অডিও" - This is the real-world latency you experience.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const LatencyCard: React.FC<{ label: string; value?: number; description: string }> = ({ label, value, description }) => (
  <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex flex-col gap-1 hover:border-emerald-500/30 transition-colors">
    <div className="flex justify-between items-center">
      <span className="text-slate-200 font-black text-[11px] uppercase tracking-wider">{label}</span>
      <span className={`text-base font-black ${value ? 'text-emerald-400' : 'text-slate-600'}`}>
        {value ? `${value} ms` : '—'}
      </span>
    </div>
    <p className="text-[10px] text-slate-500 leading-tight pr-4">{description}</p>
  </div>
);
