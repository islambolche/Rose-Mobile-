import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  AlertTriangle,
  Activity,
  Sparkles,
  Cpu,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  Shield,
  Code,
  Globe,
  Wifi,
  Volume2,
  X,
} from 'lucide-react';
import { getDevLogs, clearDevLogs, DevLogEntry } from '../lib/devLog';
import { APP_STATUS, AppStatusItem } from '../lib/appStatus';
import { directGeminiGenerate, TEXT_MODELS, getSavedWorkingTextModel } from '../lib/ai-service';
import { getGeminiKey } from '../lib/geminiKey';

interface DeveloperToolsProps {
  currentView: string;
  setCurrentView: (view: any) => void;
  setToast: (msg: string) => void;
  apiKeys: { gemini?: string };
  settings: any;
  liveModelName?: string;
  chatModelName?: string;
  ttsModelName?: string;
}

export const DeveloperToolsViews: React.FC<DeveloperToolsProps> = ({
  currentView,
  setCurrentView,
  setToast,
  apiKeys,
  settings,
  liveModelName,
  chatModelName,
  ttsModelName,
}) => {
  // Common states
  const [logs, setLogs] = useState<DevLogEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<DevLogEntry | null>(null);

  // Find Problems states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    causes: string;
    priority: string;
    prompt: string;
  } | null>(null);

  useEffect(() => {
    setLogs(getDevLogs());
    const onDevLogAdded = () => {
      setLogs(getDevLogs());
    };
    window.addEventListener('dev-log-added', onDevLogAdded);
    return () => {
      window.removeEventListener('dev-log-added', onDevLogAdded);
    };
  }, []);

  const copyToClipboard = (text: string, successMsg: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setToast(successMsg);
    } catch (e) {
      setToast('কপি করতে ব্যর্থ হয়েছে');
    }
  };

  // 1. DEVELOPER TOOLS MAIN MENU
  if (currentView === 'developer_tools') {
    return (
      <div data-current-view={currentView} data-nav-id={currentView} className="flex-1 flex flex-col overflow-hidden w-full relative bg-[#020617] text-white">
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#020617]/85 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('settings')}
              className="p-2 -ml-2 rounded-xl text-slate-300 hover:text-white active:scale-95 transition-transform"
              aria-label="Back to Settings"
            >
              <ArrowLeft className="w-5 h-5 text-purple-400" />
            </button>
            <div>
              <h2 className="text-lg font-black italic tracking-tight text-white uppercase flex items-center gap-2">
                <span>10 DEVELOPER TOOLS</span>
                <span className="text-[9px] bg-indigo-500/20 text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                  ADMIN ONLY
                </span>
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">সিস্টেম ডায়াগনস্টিক ও ট্রাবলশুটিং</p>
            </div>
          </div>
        </div>

        {/* 4 Separate Bar-Buttons */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-28">
          {/* 1 ERROR LOG */}
          <button
            data-nav-id="error_log"
            onClick={() => setCurrentView('error_log')}
            className="w-full bg-[#0F172A]/80 hover:bg-[#0F172A] border border-white/5 hover:border-purple-500/30 rounded-2xl p-4 flex items-center justify-between active:scale-[0.99] transition-all text-left group shadow-lg"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center shrink-0 shadow">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-[13px] font-black uppercase tracking-wider text-white">
                    1 ERROR LOG
                  </h4>
                  {logs.length > 0 && (
                    <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                      {logs.length}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  সিস্টেম ও API এরর লগ (সর্বশেষ ২০০টি)
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* 2 APP STATUS */}
          <button
            data-nav-id="app_status"
            onClick={() => setCurrentView('app_status')}
            className="w-full bg-[#0F172A]/80 hover:bg-[#0F172A] border border-white/5 hover:border-purple-500/30 rounded-2xl p-4 flex items-center justify-between active:scale-[0.99] transition-all text-left group shadow-lg"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-2xl flex items-center justify-center shrink-0 shadow">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[13px] font-black uppercase tracking-wider text-white">
                  2 APP STATUS
                </h4>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  সব ফিচার ও মডিউলের বর্তমান অবস্থা (Done / In progress)
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* 3 FIND PROBLEMS */}
          <button
            data-nav-id="find_problems"
            onClick={() => setCurrentView('find_problems')}
            className="w-full bg-[#0F172A]/80 hover:bg-[#0F172A] border border-white/5 hover:border-purple-500/30 rounded-2xl p-4 flex items-center justify-between active:scale-[0.99] transition-all text-left group shadow-lg"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center shrink-0 shadow">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[13px] font-black uppercase tracking-wider text-white">
                  3 FIND PROBLEMS
                </h4>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  জেমিনাই দিয়ে সমস্যা বিশ্লেষণ ও সমাধান প্রম্পট জেনারেটর
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* 4 SYSTEM INFO */}
          <button
            data-nav-id="system_info"
            onClick={() => setCurrentView('system_info')}
            className="w-full bg-[#0F172A]/80 hover:bg-[#0F172A] border border-white/5 hover:border-purple-500/30 rounded-2xl p-4 flex items-center justify-between active:scale-[0.99] transition-all text-left group shadow-lg"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center shrink-0 shadow">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[13px] font-black uppercase tracking-wider text-white">
                  4 SYSTEM INFO
                </h4>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                  অ্যাপ ভার্সন, মডেল, ব্রাউজার ও নেটওয়ার্ক স্থিতি
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    );
  }

  // 2. ERROR LOG VIEW
  if (currentView === 'error_log') {
    const handleCopyAllLogs = () => {
      if (logs.length === 0) {
        setToast('কোনো এরর লগ নেই');
        return;
      }
      const text = JSON.stringify(logs, null, 2);
      copyToClipboard(text, `${logs.length}টি এরর লগ কপি করা হয়েছে`);
    };

    const handleClearAllLogs = () => {
      if (window.confirm('নিশ্চিত? সব এরর লগ মুছে ফেলবেন?')) {
        clearDevLogs();
        setLogs([]);
        setSelectedEntry(null);
        setToast('সব এরর লগ মুছে ফেলা হয়েছে');
      }
    };

    const getAreaColor = (area: string) => {
      switch (area) {
        case 'chat':
          return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
        case 'live':
          return 'bg-teal-500/10 text-teal-400 border-teal-500/30';
        case 'tts':
          return 'bg-pink-500/10 text-pink-400 border-pink-500/30';
        case 'supabase':
          return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
        case 'nav':
          return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        default:
          return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
      }
    };

    return (
      <div data-current-view={currentView} data-nav-id={currentView} className="flex-1 flex flex-col overflow-hidden w-full relative bg-[#020617] text-white">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#020617]/85 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView('developer_tools')}
              className="p-2 -ml-2 rounded-xl text-slate-300 hover:text-white active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-purple-400" />
            </button>
            <div>
              <h2 className="text-lg font-black italic tracking-tight text-white uppercase flex items-center gap-2">
                <span>ERROR LOG</span>
                <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                  {logs.length}
                </span>
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAllLogs}
              className="px-3 py-1.5 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-purple-300 text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> কপি
            </button>
            <button
              onClick={handleClearAllLogs}
              className="px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600/25 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> সব মুছো
            </button>
          </div>
        </div>

        {/* Logs List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar pb-28">
          {logs.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center opacity-70">
              <Terminal className="w-12 h-12 text-slate-700 mb-3" />
              <p className="text-sm font-black uppercase text-white tracking-wider">কোনো এরর নেই</p>
              <p className="text-[10px] text-slate-500 font-medium">অ্যাপে কোনো সমস্যা রেকর্ড হয়নি। সব ঠিক আছে!</p>
            </div>
          ) : (
            logs.map((entry) => (
              <div
                key={entry.id}
                onClick={() => setSelectedEntry(entry)}
                className="w-full p-3.5 bg-[#0F172A]/70 hover:bg-[#0F172A] border border-white/5 hover:border-purple-500/30 rounded-2xl flex flex-col gap-2 active:scale-[0.99] transition-all cursor-pointer shadow-sm group"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full border ${getAreaColor(
                        entry.area
                      )}`}
                    >
                      {entry.area}
                    </span>
                    {entry.status && (
                      <span className="text-[9px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                        HTTP {entry.status}
                      </span>
                    )}
                    {entry.model && (
                      <span className="text-[9px] font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                        {entry.model}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-500 font-mono text-[9px]">{entry.time}</span>
                </div>
                <p className="text-xs font-medium text-slate-200 line-clamp-2 leading-relaxed">
                  {entry.message}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Details Modal */}
        {selectedEntry && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0F172A] border border-white/10 rounded-3xl p-5 max-w-lg w-full max-h-[80vh] flex flex-col justify-between shadow-2xl">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${getAreaColor(
                        selectedEntry.area
                      )}`}
                    >
                      {selectedEntry.area}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{selectedEntry.time}</span>
                  </div>
                  <button
                    onClick={() => setSelectedEntry(null)}
                    className="p-1 rounded-full text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="mt-3 overflow-y-auto max-h-[50vh] space-y-3 pr-1 text-xs text-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                      Message
                    </span>
                    <p className="p-3 bg-black/40 rounded-xl font-mono text-[11px] break-all border border-white/5">
                      {selectedEntry.message}
                    </p>
                  </div>
                  {selectedEntry.status && (
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                        HTTP Status
                      </span>
                      <p className="font-mono text-amber-400">{selectedEntry.status}</p>
                    </div>
                  )}
                  {selectedEntry.model && (
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                        Model Name
                      </span>
                      <p className="font-mono text-indigo-400">{selectedEntry.model}</p>
                    </div>
                  )}
                  {selectedEntry.details && (
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">
                        Details / Stack
                      </span>
                      <pre className="p-3 bg-black/40 rounded-xl font-mono text-[10px] text-slate-300 overflow-x-auto whitespace-pre-wrap break-all border border-white/5 max-h-40">
                        {selectedEntry.details}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-4 mt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  onClick={() => {
                    copyToClipboard(JSON.stringify(selectedEntry, null, 2), 'এরর বিবরণ কপি করা হয়েছে');
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" /> কপি বিবরণ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. APP STATUS VIEW
  if (currentView === 'app_status') {
    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'done':
          return (
            <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
              <Check className="w-2.5 h-2.5" /> সম্পন্ন (Done)
            </span>
          );
        case 'in progress':
          return (
            <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/25 flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> চলমান (In Progress)
            </span>
          );
        default:
          return (
            <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/25">
              অপেক্ষমান (Pending)
            </span>
          );
      }
    };

    return (
      <div data-current-view={currentView} data-nav-id={currentView} className="flex-1 flex flex-col overflow-hidden w-full relative bg-[#020617] text-white">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#020617]/85 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView('developer_tools')}
              className="p-2 -ml-2 rounded-xl text-slate-300 hover:text-white active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-purple-400" />
            </button>
            <div>
              <h2 className="text-lg font-black italic tracking-tight text-white uppercase">
                APP STATUS
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">ফিচার ও মডিউল রোডম্যাপ স্ট্যাটাস</p>
            </div>
          </div>
        </div>

        {/* Status Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-28">
          {APP_STATUS.map((item) => (
            <div
              key={item.id}
              className="w-full p-4 bg-[#0F172A]/75 border border-white/5 rounded-2xl flex flex-col gap-2 shadow-sm"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-[13px] font-bold text-white leading-tight">
                    {item.nameBn}
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                    {item.name} • {item.category}
                  </span>
                </div>
                {getStatusBadge(item.status)}
              </div>
              <p className="text-[11px] text-slate-300 font-medium leading-relaxed bg-black/30 p-2.5 rounded-xl border border-white/5">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 4. FIND PROBLEMS VIEW
  if (currentView === 'find_problems') {
    const handleRunAnalysis = async () => {
      setIsAnalyzing(true);
      setAnalysisResult(null);

      try {
        const last30Errors = logs.slice(0, 30).map((l) => ({
          time: l.time,
          area: l.area,
          message: l.message,
          status: l.status,
          model: l.model,
        }));

        const prompt = `You are a senior full-stack AI engineer inspecting an AI assistant web application (Rose 🌹).
Here is the current APP_STATUS:
${JSON.stringify(APP_STATUS, null, 2)}

Here are the last recent error logs (keys/secrets already sanitized):
${JSON.stringify(last30Errors, null, 2)}

Analyze these logs and current status. Return your analysis in EXACTLY this format with these three headers:

### সমস্যার কারণ
(Explain in simple, clear, concise Bengali why the errors happened or what is wrong. If there are no errors, explain that the system is running smoothly without recorded faults.)

### কোনটা আগে ঠিক করতে হবে
(Numbered priority list in Bengali of what needs to be fixed first, second, third, or maintained.)

### AI Studio Prompt
(Provide a ready-to-run English prompt starting exactly with "Change ONLY...". It must specify exact fixes and remind the engineer not to break audio, mic, live session, or existing UI.)`;

        const geminiApiKey = apiKeys.gemini || getGeminiKey() || '';
        const workingModel = getSavedWorkingTextModel() || TEXT_MODELS[0] || 'gemini-2.0-flash';

        const response = await directGeminiGenerate({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          apiKey: geminiApiKey,
          model: workingModel,
        });

        const reply = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse 3 sections
        let causes = '';
        let priority = '';
        let generatedPrompt = '';

        const causesMatch = reply.match(/### সমস্যার কারণ([\s\S]*?)(?=### কোনটা আগে ঠিক করতে হবে|$)/i);
        const priorityMatch = reply.match(/### কোনটা আগে ঠিক করতে হবে([\s\S]*?)(?=### AI Studio Prompt|$)/i);
        const promptMatch = reply.match(/### AI Studio Prompt([\s\S]*?)$/i);

        causes = causesMatch ? causesMatch[1].trim() : 'কোনো নির্দিষ্ট সমস্যা পাওয়া যায়নি। সিস্টেম স্বাভাবিকভাবে চলছে।';
        priority = priorityMatch ? priorityMatch[1].trim() : '১. রিয়েলটাইম সংযোগ বজায় রাখুন।';
        generatedPrompt = promptMatch ? promptMatch[1].trim() : 'Change ONLY the identified issue. Do not touch audio, mic, reconnect, chat, or page designs.';

        // Ensure prompt starts with "Change ONLY..."
        if (!generatedPrompt.toLowerCase().startsWith('change only')) {
          generatedPrompt = `Change ONLY the problematic components:\n${generatedPrompt}`;
        }

        setAnalysisResult({
          causes,
          priority,
          prompt: generatedPrompt,
        });
      } catch (err: any) {
        setAnalysisResult({
          causes: 'বিশ্লেষণ করার সময় ত্রুটি হয়েছে। আপনার জেমিনাই এপিআই কী সক্রিয় আছে কিনা দেখুন।',
          priority: '১. Settings → Connections থেকে Gemini Free Key যাচাই করুন।',
          prompt: 'Change ONLY the network connection and Gemini API error handling. Do not touch audio or call logic.',
        });
      } finally {
        setIsAnalyzing(false);
      }
    };

    return (
      <div data-current-view={currentView} data-nav-id={currentView} className="flex-1 flex flex-col overflow-hidden w-full relative bg-[#020617] text-white">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#020617]/85 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView('developer_tools')}
              className="p-2 -ml-2 rounded-xl text-slate-300 hover:text-white active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-purple-400" />
            </button>
            <div>
              <h2 className="text-lg font-black italic tracking-tight text-white uppercase flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>FIND PROBLEMS</span>
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">এরর লগ ও অ্যাপ বিশ্লেষণ</p>
            </div>
          </div>
          <button
            onClick={handleRunAnalysis}
            disabled={isAnalyzing}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-orange-950/40 flex items-center gap-1.5 disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>খোঁজা হচ্ছে...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>সমস্যা খুঁজো</span>
              </>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-28">
          {!analysisResult && !isAnalyzing && (
            <div className="p-6 bg-[#0F172A]/70 border border-white/5 rounded-3xl text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">স্বয়ংক্রিয় সমস্যা শনাক্তকারী</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                উপরের <strong>"সমস্যা খুঁজো"</strong> বাটনে ট্যাপ করলে Rose সর্বশেষ ৩০টি এরর ও বর্তমান স্ট্যাটাস
                বিশ্লেষণ করে সহজ বাংলায় কারণ ও Google AI Studio-এর জন্য প্রস্তুত প্রম্পট তৈরি করে দেবে।
              </p>
              <div className="pt-2">
                <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-3 py-1 rounded-full">
                  মোট সংরক্ষিত এরর: {logs.length}টি
                </span>
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="p-8 bg-[#0F172A]/70 border border-amber-500/20 rounded-3xl text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
              <p className="text-xs font-bold text-white">জেমিনাই এরর ও সিস্টেম বিশ্লেষণ করছে...</p>
              <p className="text-[10px] text-slate-400">একটু অপেক্ষা করুন, বাংলায় রিপোর্ট প্রস্তুত হচ্ছে।</p>
            </div>
          )}

          {analysisResult && (
            <div className="space-y-4">
              {/* (a) সমস্যার কারণ */}
              <div className="p-4 bg-[#0F172A]/85 border border-purple-500/20 rounded-2xl space-y-2 shadow-lg">
                <h4 className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  (ক) সমস্যার কারণ
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line bg-black/30 p-3 rounded-xl border border-white/5">
                  {analysisResult.causes}
                </p>
              </div>

              {/* (b) কোনটা আগে ঠিক করতে হবে */}
              <div className="p-4 bg-[#0F172A]/85 border border-amber-500/20 rounded-2xl space-y-2 shadow-lg">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  (খ) কোনটা আগে ঠিক করতে হবে
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line bg-black/30 p-3 rounded-xl border border-white/5">
                  {analysisResult.priority}
                </p>
              </div>

              {/* (c) AI Studio Prompt */}
              <div className="p-4 bg-[#0F172A]/85 border border-teal-500/20 rounded-2xl space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-400" />
                    (গ) Google AI Studio Prompt
                  </h4>
                  <button
                    onClick={() => {
                      copyToClipboard(analysisResult.prompt, 'প্রম্পট কপি করা হয়েছে!');
                    }}
                    className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1 shadow-md shadow-teal-950/40"
                  >
                    <Copy className="w-3 h-3" /> প্রম্পট কপি করো
                  </button>
                </div>
                <pre className="p-3 bg-black/50 rounded-xl text-[11px] font-mono text-teal-200 leading-relaxed whitespace-pre-wrap break-words border border-teal-500/20 max-h-60 overflow-y-auto">
                  {analysisResult.prompt}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 5. SYSTEM INFO VIEW
  if (currentView === 'system_info') {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
    const appVersion = 'v1.4.0';

    return (
      <div data-current-view={currentView} data-nav-id={currentView} className="flex-1 flex flex-col overflow-hidden w-full relative bg-[#020617] text-white">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#020617]/85 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView('developer_tools')}
              className="p-2 -ml-2 rounded-xl text-slate-300 hover:text-white active:scale-95 transition-transform"
            >
              <ArrowLeft className="w-5 h-5 text-purple-400" />
            </button>
            <div>
              <h2 className="text-lg font-black italic tracking-tight text-white uppercase">
                SYSTEM INFO
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">সিস্টেম, ব্রাউজার ও মডেল স্থিতি</p>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-28">
          {/* App & Build */}
          <div className="p-4 bg-[#0F172A]/75 border border-white/5 rounded-2xl space-y-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-purple-400 block">
              Application & Deployment
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                <span className="text-[9px] text-slate-500 block">Version</span>
                <span className="font-bold text-white">{appVersion}</span>
              </div>
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                <span className="text-[9px] text-slate-500 block">Online Status</span>
                <span className={`font-bold flex items-center gap-1.5 ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  {isOnline ? 'অনলাইন (Connected)' : 'অফলাইন'}
                </span>
              </div>
            </div>
          </div>

          {/* Active AI Models */}
          <div className="p-4 bg-[#0F172A]/75 border border-white/5 rounded-2xl space-y-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-teal-400 block">
              Configured AI Models
            </span>
            <div className="space-y-2 text-xs">
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-500 block">Live Voice Model</span>
                  <span className="font-mono text-teal-300 font-bold">
                    {liveModelName || settings?.voiceModel || 'Gemini 2.0 Flash'}
                  </span>
                </div>
                <Globe className="w-4 h-4 text-teal-500" />
              </div>
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-500 block">Chat Text Model</span>
                  <span className="font-mono text-purple-300 font-bold">
                    {chatModelName || 'Gemini 2.5 Flash (Auto)'}
                  </span>
                </div>
                <Code className="w-4 h-4 text-purple-500" />
              </div>
              <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-500 block">Bengali TTS Model</span>
                  <span className="font-mono text-pink-300 font-bold">
                    {ttsModelName || 'Gemini 2.5 Flash TTS'}
                  </span>
                </div>
                <Volume2 className="w-4 h-4 text-pink-500" />
              </div>
            </div>
          </div>

          {/* Browser / Environment */}
          <div className="p-4 bg-[#0F172A]/75 border border-white/5 rounded-2xl space-y-2">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
              Browser & Environment
            </span>
            <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-xs text-slate-300 font-mono break-all leading-relaxed">
              {userAgent}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
