import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Cpu,
  Folder,
  ShieldCheck,
  Shield,
  Bot,
  RefreshCw,
  XCircle,
  AlertTriangle,
  Play,
  Volume2,
  VolumeX,
  Volume1,
  Lock,
  Power,
  RotateCcw,
  Camera,
  Search,
  FileText,
  Check,
  X,
  Zap,
  Eye,
  EyeOff,
  ClipboardPaste,
  Save,
  Download,
  Keyboard,
  Globe,
  AppWindow,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  DEFAULT_PC_DEVICE_ID,
  getPcDeviceId,
  setPcDeviceId,
  getPcSecret,
  setPcSecret,
  sendPcCommand,
  waitResult,
  approve,
  reject,
  getDeviceStatus,
  PcCommandRow,
  PcDeviceRow,
} from "../pc/pcClient";

export type PcSetupPageId =
  | "pc-helper"
  | "pc-control"
  | "pc-files"
  | "pc-confirmations"
  | "pc-history"
  | "pc-safety"
  | "pc-local-ai";

interface PcSetupPageProps {
  pageId: PcSetupPageId;
  onBack: () => void;
  onToast: (msg: string) => void;
}

function formatTime(ts?: string | number | null): string {
  if (ts === null || ts === undefined || ts === "") return "কখনো না";
  const ms = typeof ts === "number" ? ts : new Date(String(ts)).getTime();
  if (!Number.isFinite(ms)) return "কখনো না";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "কখনো না";
  }
}

function formatMetric(val: any): string {
  if (val === undefined || val === null || val === "") return "N/A";
  if (typeof val === "number") return `${Math.round(val)}%`;
  const str = String(val).trim();
  return str.endsWith("%") || Number.isNaN(Number(str)) ? str : `${str}%`;
}

function parseJsonSafe(raw: any): any {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

export const PcSetupPage: React.FC<PcSetupPageProps> = ({ pageId, onBack, onToast }) => {
  const [deviceId, setDeviceIdState] = useState<string>(() => getPcDeviceId());
  const [secret, setSecretState] = useState<string>(() => getPcSecret());
  const [deviceRecord, setDeviceRecord] = useState<PcDeviceRow | null>(null);
  const [online, setOnline] = useState<boolean>(false);
  const [loadingDevice, setLoadingDevice] = useState(false);

  const fetchDeviceInfo = useCallback(async () => {
    setLoadingDevice(true);
    try {
      const res = await getDeviceStatus();
      setOnline(res.online);
      setDeviceRecord(res.device);
    } catch (e) {
      console.warn("[PcSetupPage] Device query error:", e);
    } finally {
      setLoadingDevice(false);
    }
  }, []);

  useEffect(() => {
    void fetchDeviceInfo();
    if (pageId === "pc-helper") {
      const timer = setInterval(() => {
        void fetchDeviceInfo();
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [pageId, fetchDeviceInfo]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#020617] text-white overflow-y-auto no-scrollbar flex flex-col">
      {/* Top Header */}
      <header className="px-5 py-5 border-b border-purple-500/20 bg-[#0A051C]/90 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-slate-300 border border-white/10"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-white leading-tight">
              {pageId === "pc-helper" && "1 PC HELPER"}
              {pageId === "pc-control" && "2 PC CONTROL"}
              {pageId === "pc-files" && "3 PC FILES"}
              {pageId === "pc-confirmations" && "4 CONFIRMATIONS"}
              {pageId === "pc-history" && "5 PC HISTORY"}
              {pageId === "pc-safety" && "6 SAFETY"}
              {pageId === "pc-local-ai" && "7 LOCAL AI"}
            </h2>
            <p className="text-[10px] font-semibold uppercase text-purple-300 tracking-wider">
              PC Setup
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void fetchDeviceInfo()}
          className="p-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 active:scale-95 transition-all"
          title="Refresh Status"
          aria-label="Refresh Status"
        >
          <RefreshCw className={`w-4 h-4 ${loadingDevice ? "animate-spin" : ""}`} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-4xl w-full mx-auto space-y-6 pb-24">
        {pageId === "pc-helper" && (
          <PcHelperView
            deviceId={deviceId}
            setDeviceId={setDeviceIdState}
            secret={secret}
            setSecret={setSecretState}
            deviceRecord={deviceRecord}
            isConnected={online}
            onRefreshStatus={fetchDeviceInfo}
            onToast={onToast}
          />
        )}

        {pageId === "pc-control" && <PcControlView onToast={onToast} />}

        {pageId === "pc-files" && <PcFilesView onToast={onToast} />}

        {pageId === "pc-confirmations" && <PcConfirmationsView onToast={onToast} />}

        {pageId === "pc-history" && <PcHistoryView />}

        {pageId === "pc-safety" && <PcSafetyView />}

        {pageId === "pc-local-ai" && <PcLocalAiView />}
      </main>
    </div>
  );
};

/* 1. PC HELPER VIEW */
const PcHelperView: React.FC<{
  deviceId: string;
  setDeviceId: (id: string) => void;
  secret: string;
  setSecret: (sec: string) => void;
  deviceRecord: PcDeviceRow | null;
  isConnected: boolean;
  onRefreshStatus: () => Promise<void>;
  onToast: (msg: string) => void;
}> = ({
  deviceId,
  setDeviceId,
  secret,
  setSecret,
  deviceRecord,
  isConnected,
  onRefreshStatus,
  onToast,
}) => {
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testOutcome, setTestOutcome] = useState<{ ok: boolean; text: string } | null>(null);

  const infoObj = (parseJsonSafe(deviceRecord?.info) || {}) as Record<string, any>;
  const cpuVal = infoObj.cpu ?? infoObj.cpu_usage ?? infoObj.cpu_percent ?? deviceRecord?.cpu_usage;
  const ramVal = infoObj.ram ?? infoObj.ram_usage ?? infoObj.ram_percent ?? deviceRecord?.ram_usage;
  const batteryVal = infoObj.battery ?? infoObj.battery_percent ?? deviceRecord?.battery;

  const handleSave = async () => {
    const cleanId = deviceId.trim() || DEFAULT_PC_DEVICE_ID;
    setDeviceId(cleanId);
    setPcDeviceId(cleanId);
    setPcSecret(secret);
    onToast("Saved");
    await onRefreshStatus();
  };

  const handlePasteSecret = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setSecret(clipText.trim());
        onToast("Secret pasted");
      } else {
        onToast("Clipboard খালি");
      }
    } catch {
      onToast("Clipboard অনুমতি নেই — হাতে পেস্ট করো");
    }
  };

  const handleTestConnection = async () => {
    const cleanId = deviceId.trim() || DEFAULT_PC_DEVICE_ID;
    setPcDeviceId(cleanId);
    setPcSecret(secret);
    setTesting(true);
    setTestOutcome(null);
    try {
      const cmdId = await sendPcCommand("ping", {});
      const row = await waitResult(cmdId, 15000);
      if (row.status === "done") {
        setTestOutcome({ ok: true, text: "✓ CONNECTED" });
        await onRefreshStatus();
      } else {
        setTestOutcome({
          ok: false,
          text: `✗ ${row.error || `Status: ${row.status}`}`,
        });
      }
    } catch (err: any) {
      setTestOutcome({
        ok: false,
        text: `✗ ${err?.message || "Connection failed"}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bengali Guide */}
      <div className="p-4 rounded-2xl bg-purple-600/15 border border-purple-500/30 text-xs font-semibold text-purple-100">
        ল্যাপটপে Rose Helper চালু করো, একই Secret এখানে বসাও
      </div>

      {/* Device Status Card */}
      <div className="p-5 rounded-3xl bg-[#0F172A]/90 border border-purple-500/30 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-white">DEVICE STATUS</h3>
              <p className="text-[11px] text-slate-400">
                Last seen: {formatTime(deviceRecord?.last_seen)}
              </p>
            </div>
          </div>

          <div
            className={`px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1.5 border ${
              isConnected
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-red-500/20 text-red-300 border-red-500/40"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            {isConnected ? "ONLINE" : "OFFLINE"}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">CPU</span>
            <span className="text-base font-black text-white">{formatMetric(cpuVal)}</span>
          </div>
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">RAM</span>
            <span className="text-base font-black text-white">{formatMetric(ramVal)}</span>
          </div>
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Battery</span>
            <span className="text-base font-black text-white">{formatMetric(batteryVal)}</span>
          </div>
        </div>
      </div>

      {/* Device Credentials Form */}
      <div className="p-5 rounded-3xl bg-[#0F172A]/90 border border-purple-500/30 shadow-2xl space-y-4">
        <h3 className="text-sm font-black uppercase text-white">HELPER CONFIGURATION</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              Device ID
            </label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder={DEFAULT_PC_DEVICE_ID}
              className="w-full px-4 py-3 rounded-2xl bg-black/50 border border-white/10 text-white text-xs font-mono focus:border-purple-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              Secret
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showSecret ? "text" : "password"}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Rose Helper Secret"
                  className="w-full pl-4 pr-11 py-3 rounded-2xl bg-black/50 border border-white/10 text-white text-xs font-mono focus:border-purple-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white"
                  aria-label={showSecret ? "Hide secret" : "Show secret"}
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => void handlePasteSecret()}
                className="px-3.5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 flex items-center gap-1.5 shrink-0 active:scale-95 transition-all"
                aria-label="Paste secret"
              >
                <ClipboardPaste className="w-4 h-4 text-purple-300" />
                <span>Paste</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => void handleSave()}
              className="py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4 text-purple-300" />
              SAVE
            </button>

            <button
              type="button"
              onClick={() => void handleTestConnection()}
              disabled={testing}
              className="py-3.5 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {testing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 text-purple-200" />
              )}
              TEST
            </button>
          </div>

          {testOutcome && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-bold font-mono ${
                testOutcome.ok
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-red-500/15 border-red-500/40 text-red-300"
              }`}
            >
              {testOutcome.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* 2. PC CONTROL VIEW */
const PcControlView: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const [linkUrl, setLinkUrl] = useState("https://google.com");
  const [appName, setAppName] = useState("chrome");
  const [installAppName, setInstallAppName] = useState("");
  const [typeTextInput, setTypeTextInput] = useState("");
  const [agentTaskText, setAgentTaskText] = useState("");
  const [lastOutput, setLastOutput] = useState<string | null>(null);
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const [taskRunning, setTaskRunning] = useState(false);
  const [taskProgress, setTaskProgress] = useState<string[]>([]);
  const [taskSummary, setTaskSummary] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  const runControl = async (action: string, args: Record<string, any> = {}) => {
    setExecuting(true);
    try {
      const cmdId = await sendPcCommand(action, args);
      onToast(`পাঠানো হয়েছে: ${action}`);
      const row = await waitResult(cmdId, 30000);
      if (row.status === "done") {
        const res = parseJsonSafe(row.result);
        const b64 = res?.jpeg_base64 || res?.screenshot;
        if (b64 && typeof b64 === "string") {
          setLastScreenshot(b64.startsWith("data:image") ? b64 : `data:image/jpeg;base64,${b64}`);
          setLastOutput(null);
        } else if (res) {
          setLastOutput(typeof res === "string" ? res : JSON.stringify(res, null, 2));
        } else {
          setLastOutput(`${action}: সম্পন্ন`);
        }
      } else if (row.status === "awaiting_confirm") {
        setLastOutput("অনুমতি লাগবে — 4 CONFIRMATIONS-এ গিয়ে ALLOW চাপো।");
        onToast("অনুমতি প্রয়োজন");
      } else if (row.status === "rejected") {
        setLastOutput(`${action}: বাতিল হয়েছে`);
      } else {
        const errTxt = row.error || `Status: ${row.status}`;
        setLastOutput(`ত্রুটি: ${errTxt}`);
        onToast(errTxt);
      }
    } catch (err: any) {
      const msg = err?.message || "Command failed";
      setLastOutput(`ত্রুটি: ${msg}`);
      onToast(msg);
    } finally {
      setExecuting(false);
    }
  };

  const extractSteps = (res: any): string[] => {
    const parsed = parseJsonSafe(res);
    const rawProgress = parsed?.progress;
    if (Array.isArray(rawProgress)) {
      return rawProgress.map((item) =>
        typeof item === "string" ? item : item?.step || item?.text || item?.message || JSON.stringify(item)
      );
    }
    if (typeof rawProgress === "string" && rawProgress.trim()) {
      return [rawProgress.trim()];
    }
    return [];
  };

  const handleRunAgentTask = async () => {
    const task = agentTaskText.trim();
    if (!task) {
      onToast("আগে কাজটি লেখো");
      return;
    }
    setTaskRunning(true);
    setTaskProgress([]);
    setTaskSummary(null);
    setTaskError(null);
    try {
      const cmdId = await sendPcCommand("agent_task", { task });
      const row = await waitResult(cmdId, 180000, (update) => {
        const steps = extractSteps(update.result);
        if (steps.length > 0) {
          setTaskProgress(steps);
        }
      });
      const finalSteps = extractSteps(row.result);
      if (finalSteps.length > 0) {
        setTaskProgress(finalSteps);
      }
      if (row.status === "done") {
        const parsed = parseJsonSafe(row.result);
        setTaskSummary(
          parsed?.summary ||
            (typeof parsed === "string" ? parsed : parsed ? JSON.stringify(parsed, null, 2) : "কাজ সম্পন্ন হয়েছে।")
        );
      } else if (row.status === "awaiting_confirm") {
        const parsed = parseJsonSafe(row.result);
        setTaskSummary(parsed?.summary || "এই কাজের জন্য অনুমতি লাগবে — 4 CONFIRMATIONS দেখো।");
        onToast("অনুমতি প্রয়োজন");
      } else if (row.status === "rejected") {
        setTaskError("কাজটি বাতিল করা হয়েছে।");
      } else {
        setTaskError(row.error || `Status: ${row.status}`);
      }
    } catch (err: any) {
      setTaskError(err?.message || "Agent task failed");
    } finally {
      setTaskRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Launchers & Commands */}
      <div className="p-5 rounded-3xl bg-[#0F172A]/90 border border-purple-500/30 space-y-3">
        <h3 className="text-xs font-black uppercase text-white">INPUT COMMANDS</h3>

        <div className="flex gap-2">
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-xs font-mono text-white outline-none"
          />
          <button
            type="button"
            disabled={executing}
            onClick={() => void runControl("open_url", { url: linkUrl.trim() })}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-xs font-black uppercase text-white shrink-0 flex items-center gap-1.5 disabled:opacity-60"
          >
            <Globe className="w-3.5 h-3.5" />
            open_url
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="App name (e.g. chrome, notepad)"
            className="flex-1 px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-xs font-mono text-white outline-none"
          />
          <button
            type="button"
            disabled={executing}
            onClick={() => void runControl("open_app", { name: appName.trim() })}
            className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-xs font-black uppercase text-white shrink-0 flex items-center gap-1.5 disabled:opacity-60"
          >
            <AppWindow className="w-3.5 h-3.5" />
            open_app
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={installAppName}
            onChange={(e) => setInstallAppName(e.target.value)}
            placeholder="App name to install (e.g. vlc)"
            className="flex-1 px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-xs font-mono text-white outline-none"
          />
          <button
            type="button"
            disabled={executing || !installAppName.trim()}
            onClick={() => void runControl("install_app", { name: installAppName.trim() })}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black uppercase text-white shrink-0 flex items-center gap-1.5 disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            install_app
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={typeTextInput}
            onChange={(e) => setTypeTextInput(e.target.value)}
            placeholder="Text to type on PC"
            className="flex-1 px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-xs font-mono text-white outline-none"
          />
          <button
            type="button"
            disabled={executing || !typeTextInput}
            onClick={() => void runControl("type_text", { text: typeTextInput })}
            className="px-4 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-xs font-black uppercase text-white shrink-0 flex items-center gap-1.5 disabled:opacity-60"
          >
            <Keyboard className="w-3.5 h-3.5" />
            type_text
          </button>
        </div>
      </div>

      {/* Quick Action Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => void runControl("lock")}
          className="p-4 rounded-2xl bg-[#0F172A] border border-purple-500/30 hover:border-purple-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <Lock className="w-6 h-6 text-amber-400" />
          <span className="text-xs font-black uppercase text-white">Lock</span>
        </button>

        <button
          type="button"
          onClick={() => void runControl("media", { key: "volume_up" })}
          className="p-4 rounded-2xl bg-[#0F172A] border border-purple-500/30 hover:border-purple-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <Volume2 className="w-6 h-6 text-emerald-400" />
          <span className="text-xs font-black uppercase text-white">Volume Up</span>
        </button>

        <button
          type="button"
          onClick={() => void runControl("media", { key: "volume_down" })}
          className="p-4 rounded-2xl bg-[#0F172A] border border-purple-500/30 hover:border-purple-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <Volume1 className="w-6 h-6 text-emerald-400" />
          <span className="text-xs font-black uppercase text-white">Volume Down</span>
        </button>

        <button
          type="button"
          onClick={() => void runControl("media", { key: "mute" })}
          className="p-4 rounded-2xl bg-[#0F172A] border border-purple-500/30 hover:border-purple-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <VolumeX className="w-6 h-6 text-red-400" />
          <span className="text-xs font-black uppercase text-white">Mute</span>
        </button>

        <button
          type="button"
          onClick={() => void runControl("media", { key: "play_pause" })}
          className="p-4 rounded-2xl bg-[#0F172A] border border-purple-500/30 hover:border-purple-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <Play className="w-6 h-6 text-indigo-400" />
          <span className="text-xs font-black uppercase text-white">Play / Pause</span>
        </button>

        <button
          type="button"
          onClick={() => void runControl("screenshot")}
          className="p-4 rounded-2xl bg-[#0F172A] border border-purple-500/30 hover:border-purple-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <Camera className="w-6 h-6 text-pink-400" />
          <span className="text-xs font-black uppercase text-white">Screenshot</span>
        </button>

        <button
          type="button"
          onClick={() => void runControl("shutdown")}
          className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 hover:border-red-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <Power className="w-6 h-6 text-red-400" />
          <span className="text-xs font-black uppercase text-red-200">Shutdown</span>
        </button>

        <button
          type="button"
          onClick={() => void runControl("restart")}
          className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 hover:border-amber-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <RotateCcw className="w-6 h-6 text-amber-400" />
          <span className="text-xs font-black uppercase text-amber-200">Restart</span>
        </button>

        <button
          type="button"
          onClick={() => void runControl("cancel_shutdown")}
          className="p-4 rounded-2xl bg-[#0F172A] border border-slate-700 hover:border-slate-500 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg col-span-2 sm:col-span-1"
        >
          <XCircle className="w-6 h-6 text-slate-400" />
          <span className="text-xs font-black uppercase text-slate-300">Cancel Shutdown</span>
        </button>
      </div>

      {/* Results output (Screenshot / Control Result) */}
      {(lastOutput || lastScreenshot) && (
        <div className="p-5 rounded-3xl bg-[#0F172A]/90 border border-purple-500/30 space-y-3">
          <h3 className="text-xs font-black uppercase text-slate-300">RESULT</h3>
          {lastScreenshot && (
            <img src={lastScreenshot} alt="PC Screenshot" className="w-full rounded-2xl border border-purple-500/30 shadow-lg" />
          )}
          {lastOutput && (
            <pre className="p-3 rounded-2xl bg-black/60 border border-white/5 text-[11px] font-mono text-purple-200 overflow-x-auto whitespace-pre-wrap">
              {lastOutput}
            </pre>
          )}
        </div>
      )}

      {/* Agent Task Box */}
      <div className="p-5 rounded-3xl bg-[#0F172A]/90 border border-purple-500/30 space-y-3">
        <h3 className="text-xs font-black uppercase text-white">AGENT TASK</h3>
        <textarea
          rows={4}
          value={agentTaskText}
          onChange={(e) => setAgentTaskText(e.target.value)}
          placeholder="যেকোনো কাজ লেখো"
          className="w-full p-4 rounded-2xl bg-black/50 border border-white/10 text-sm text-white outline-none focus:border-purple-400 resize-y"
        />
        <button
          type="button"
          disabled={taskRunning}
          onClick={() => void handleRunAgentTask()}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {taskRunning ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          RUN
        </button>

        {taskProgress.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-black/50 border border-purple-500/20 space-y-1.5">
            <p className="text-[10px] font-black uppercase text-purple-300">LIVE PROGRESS</p>
            <ul className="space-y-1 text-xs text-slate-200">
              {taskProgress.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-purple-400 font-mono">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {taskSummary && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 whitespace-pre-wrap">
            {taskSummary}
          </div>
        )}

        {taskError && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
            {taskError}
          </div>
        )}
      </div>
    </div>
  );
};

/* 3. PC FILES VIEW */
const PcFilesView: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const [currentPath, setCurrentPath] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const extractListItems = (res: any): any[] => {
    const parsed = parseJsonSafe(res);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.items)) return parsed.items;
    if (Array.isArray(parsed?.files)) return parsed.files;
    if (Array.isArray(parsed?.entries)) return parsed.entries;
    return [];
  };

  const loadFolder = async (path: string) => {
    setLoading(true);
    setCurrentPath(path);
    try {
      const cmdId = await sendPcCommand("list_dir", { path });
      const row = await waitResult(cmdId, 20000);
      if (row.status === "done") {
        setItems(extractListItems(row.result));
      } else {
        setItems([]);
        onToast(row.error || `list_dir: ${row.status}`);
      }
    } catch (err: any) {
      setItems([]);
      onToast(err?.message || "Failed to list files");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const cmdId = await sendPcCommand("search_files", {
        query: searchQuery.trim(),
        root: currentPath || undefined,
      });
      const row = await waitResult(cmdId, 25000);
      if (row.status === "done") {
        setItems(extractListItems(row.result));
      } else {
        setItems([]);
        onToast(row.error || `search_files: ${row.status}`);
      }
    } catch (err: any) {
      setItems([]);
      onToast(err?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFile = async (fullPath: string) => {
    try {
      const cmdId = await sendPcCommand("open_path", { path: fullPath });
      onToast("ফাইল খোলা হচ্ছে...");
      const row = await waitResult(cmdId, 20000);
      if (row.status === "done") {
        onToast("ফাইল খোলা হয়েছে");
      } else {
        onToast(row.error || `open_path: ${row.status}`);
      }
    } catch (err: any) {
      onToast(err?.message || "Failed to open file");
    }
  };

  const joinPath = (base: string, name: string): string => {
    if (!base) return name;
    const sep = base.includes("\\") ? "\\" : "/";
    return base.endsWith("/") || base.endsWith("\\") ? `${base}${name}` : `${base}${sep}${name}`;
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-3xl bg-[#0F172A]/90 border border-purple-500/30 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={currentPath}
            onChange={(e) => setCurrentPath(e.target.value)}
            placeholder="Path (e.g. C:\Users\... or Desktop)"
            className="flex-1 px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-xs font-mono text-white outline-none"
          />
          <button
            type="button"
            onClick={() => void loadFolder(currentPath)}
            className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-xs font-black uppercase text-white shrink-0"
          >
            LIST
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="flex-1 px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-xs font-mono text-white outline-none"
          />
          <button
            type="button"
            onClick={() => void handleSearch()}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-xs font-black uppercase text-white flex items-center gap-1.5 shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            Search
          </button>
        </div>
      </div>

      <div className="p-4 rounded-3xl bg-[#0F172A]/90 border border-purple-500/30 space-y-2">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 font-bold uppercase flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-400" /> Loading files...
          </div>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-400">Path দিয়ে LIST অথবা Search চাপো।</p>
        ) : (
          items.map((item, idx) => {
            const isDir = Boolean(item?.is_dir || item?.type === "directory" || item?.type === "dir" || item?.isDir);
            const itemName = typeof item === "string" ? item : item?.name || item?.path || "";
            const fullPath =
              typeof item === "string"
                ? joinPath(currentPath, item)
                : item?.path || joinPath(currentPath, itemName);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (isDir) {
                    void loadFolder(fullPath);
                  } else {
                    void handleOpenFile(fullPath);
                  }
                }}
                className="w-full p-3 rounded-2xl bg-black/40 border border-white/5 hover:border-purple-500/40 flex items-center justify-between text-left active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isDir ? (
                    <Folder className="w-5 h-5 text-amber-400 shrink-0" />
                  ) : (
                    <FileText className="w-5 h-5 text-purple-400 shrink-0" />
                  )}
                  <span className="text-xs font-mono font-semibold text-slate-200 truncate">
                    {itemName}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">
                  {isDir ? "Folder" : "Open"}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

/* 4. CONFIRMATIONS VIEW */
const PcConfirmationsView: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const [awaitingCmds, setAwaitingCmds] = useState<PcCommandRow[]>([]);

  const fetchConfirmations = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("pc_commands")
      .select("*")
      .eq("status", "awaiting_confirm")
      .order("ts", { ascending: false });

    if (data) setAwaitingCmds(data as PcCommandRow[]);
  }, []);

  useEffect(() => {
    void fetchConfirmations();
    const client = supabase;
    let channel: any = null;
    if (client) {
      try {
        channel = client
          .channel("pc_confirmations_realtime")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "pc_commands" },
            () => {
              void fetchConfirmations();
            }
          )
          .subscribe();
      } catch {}
    }
    const interval = setInterval(() => {
      void fetchConfirmations();
    }, 3000);
    return () => {
      clearInterval(interval);
      if (channel && client) {
        try {
          client.removeChannel(channel);
        } catch {}
      }
    };
  }, [fetchConfirmations]);

  const handleAllow = async (id: string) => {
    try {
      await approve(id);
      onToast("Allowed!");
      void fetchConfirmations();
    } catch (err: any) {
      onToast(err?.message || "Allow failed");
    }
  };

  const handleDeny = async (id: string) => {
    try {
      await reject(id);
      onToast("Denied!");
      void fetchConfirmations();
    } catch (err: any) {
      onToast(err?.message || "Deny failed");
    }
  };

  return (
    <div className="space-y-4">
      {awaitingCmds.length === 0 ? (
        <div className="p-12 rounded-3xl bg-[#0F172A]/80 border border-purple-500/30 text-center space-y-3">
          <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-sm font-black uppercase text-white">No Pending Confirmations</h3>
          <p className="text-xs text-slate-400">
            কোনো কাজে অনুমতি লাগলে এখানে রিয়েলটাইমে দেখাবে।
          </p>
        </div>
      ) : (
        awaitingCmds.map((cmd) => {
          const parsedResult = parseJsonSafe(cmd.result);
          const summary = parsedResult?.summary;
          return (
            <div
              key={cmd.id}
              className="p-5 rounded-3xl bg-[#0F172A] border border-amber-500/40 shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Awaiting Confirmation
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {formatTime(cmd.ts)}
                </span>
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-black text-white">Action: {cmd.action}</p>
                <p className="text-xs font-mono text-purple-300 break-all">Args: {cmd.args_json}</p>
                {summary && (
                  <p className="text-xs text-slate-200 bg-black/40 rounded-xl p-2.5 border border-white/5">
                    {summary}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void handleAllow(cmd.id)}
                  className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                >
                  <Check className="w-4 h-4" /> ALLOW
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeny(cmd.id)}
                  className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                >
                  <X className="w-4 h-4" /> DENY
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

/* 5. PC HISTORY VIEW */
const PcHistoryView: React.FC = () => {
  const [history, setHistory] = useState<PcCommandRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("pc_commands")
      .select("*")
      .order("ts", { ascending: false })
      .limit(50);

    if (data) setHistory(data as PcCommandRow[]);
  }, []);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const statusBadgeClass = (status: string): string => {
    switch (status) {
      case "done":
        return "bg-emerald-500/20 text-emerald-300";
      case "failed":
      case "error":
      case "rejected":
        return "bg-red-500/20 text-red-300";
      case "approved":
      case "running":
        return "bg-indigo-500/20 text-indigo-300";
      case "awaiting_confirm":
        return "bg-amber-500/20 text-amber-300";
      default:
        return "bg-slate-700/60 text-slate-300";
    }
  };

  return (
    <div className="space-y-3">
      {history.length === 0 ? (
        <p className="p-8 text-center text-xs text-slate-400">No command history logged yet.</p>
      ) : (
        history.map((cmd) => {
          const isExpanded = expandedId === cmd.id;
          const parsedResult = parseJsonSafe(cmd.result);
          const summaryText = parsedResult?.summary;
          return (
            <button
              key={cmd.id}
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : cmd.id)}
              className="w-full text-left p-4 rounded-2xl bg-[#0F172A] border border-white/10 hover:border-purple-500/30 space-y-2 transition-all"
            >
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="min-w-0">
                  <span className="font-black text-white uppercase block truncate">{cmd.action}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {formatTime(cmd.ts)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${statusBadgeClass(
                      String(cmd.status)
                    )}`}
                  >
                    {cmd.status}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {cmd.error && <p className="text-[11px] font-mono text-red-400">Error: {cmd.error}</p>}
              {!cmd.error && summaryText && (
                <p className="text-xs text-slate-300 line-clamp-2">{summaryText}</p>
              )}

              {isExpanded && (
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <p className="text-[11px] font-mono text-slate-400 break-all">Args: {cmd.args_json}</p>
                  {parsedResult !== null && parsedResult !== undefined && (
                    <pre className="p-2.5 rounded-xl bg-black/50 text-[10px] font-mono text-purple-300 overflow-x-auto whitespace-pre-wrap">
                      {typeof parsedResult === "string"
                        ? parsedResult
                        : JSON.stringify(parsedResult, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </button>
          );
        })
      )}
    </div>
  );
};

/* 6. SAFETY VIEW */
const PcSafetyView: React.FC = () => {
  return (
    <div className="p-6 rounded-3xl bg-[#0F172A]/90 border border-purple-500/30 space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-white/10">
        <Shield className="w-8 h-8 text-emerald-400" />
        <h3 className="text-base font-black uppercase text-white">6 SAFETY</h3>
      </div>
      <p className="text-sm text-slate-200 leading-relaxed">
        ব্যাংক, পেমেন্ট, পাসওয়ার্ডের কাজে অনুমতি লাগবে। জরুরি বন্ধ: ল্যাপটপে Ctrl+Alt+Q
      </p>
    </div>
  );
};

/* 7. LOCAL AI VIEW */
const PcLocalAiView: React.FC = () => {
  return (
    <div className="p-6 rounded-3xl bg-[#0F172A]/90 border border-purple-500/30 space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-white/10">
        <Bot className="w-8 h-8 text-indigo-400" />
        <div>
          <h3 className="text-base font-black uppercase text-white">LOCAL AI (OpenJarvis)</h3>
          <p className="text-xs text-slate-400">Offline PC Model Endpoint</p>
        </div>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        OpenJarvis is an optional local LLM running directly on your PC hardware. You can ask queries without an internet connection using local GPU models.
      </p>

      <div className="p-4 rounded-2xl bg-black/40 border border-white/5 text-xs font-mono text-purple-300">
        Endpoint: http://localhost:11434 (Default)
      </div>
    </div>
  );
};
