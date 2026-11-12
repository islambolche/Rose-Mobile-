import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Cpu,
  Monitor,
  Folder,
  ShieldCheck,
  History,
  Shield,
  Bot,
  RefreshCw,
  CheckCircle2,
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
  ExternalLink,
  Search,
  FileText,
  Check,
  X,
  Copy,
  Zap,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import {
  getStoredPcSecret,
  setStoredPcSecret,
  getStoredDeviceId,
  setStoredDeviceId,
  sendPcCommand,
  approvePcCommand,
  rejectPcCommand,
  PcCommandRecord,
  PcDeviceRecord,
} from "../lib/pcCommand";

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

export const PcSetupPage: React.FC<PcSetupPageProps> = ({ pageId, onBack, onToast }) => {
  const [deviceId, setDeviceIdState] = useState(getStoredDeviceId());
  const [secret, setSecretState] = useState(getStoredPcSecret());
  const [deviceRecord, setDeviceRecord] = useState<PcDeviceRecord | null>(null);
  const [loadingDevice, setLoadingDevice] = useState(false);

  // Load device info from pc_devices table
  const fetchDeviceInfo = async () => {
    if (!supabase) return;
    setLoadingDevice(true);
    try {
      const curId = getStoredDeviceId();
      const { data, error } = await supabase
        .from("pc_devices")
        .select("*")
        .eq("id", curId)
        .maybeSingle();

      if (!error && data) {
        setDeviceRecord(data);
      }
    } catch (e) {
      console.warn("[PcSetupPage] Device query error:", e);
    } finally {
      setLoadingDevice(false);
    }
  };

  useEffect(() => {
    fetchDeviceInfo();
  }, [pageId]);

  // Compute connected status (< 40s ago)
  const isConnected = Boolean(
    deviceRecord?.last_seen &&
      (typeof deviceRecord.last_seen === "number"
        ? Date.now() - deviceRecord.last_seen < 40000
        : Date.now() - new Date(deviceRecord.last_seen).getTime() < 40000)
  );

  return (
    <div className="fixed inset-0 z-[100] bg-[#020617] text-white overflow-y-auto no-scrollbar flex flex-col">
      {/* Top Header */}
      <header className="px-5 py-5 border-b border-purple-500/20 bg-[#0A051C]/90 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-slate-300 border border-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-white leading-tight">
              {pageId === "pc-helper" && "1. PC HELPER"}
              {pageId === "pc-control" && "2. PC CONTROL"}
              {pageId === "pc-files" && "3. PC FILES"}
              {pageId === "pc-confirmations" && "4. CONFIRMATIONS"}
              {pageId === "pc-history" && "5. PC HISTORY"}
              {pageId === "pc-safety" && "6. SAFETY"}
              {pageId === "pc-local-ai" && "7. LOCAL AI"}
            </h2>
            <p className="text-[10px] font-semibold uppercase text-purple-300 tracking-wider">
              PC Setup Subsystem
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchDeviceInfo}
          className="p-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 active:scale-95 transition-all"
          title="Refresh Status"
        >
          <RefreshCw className={`w-4 h-4 ${loadingDevice ? "animate-spin" : ""}`} />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-4xl w-full mx-auto space-y-6 pb-24">
        {pageId === "pc-helper" && (
          <PcHelperView
            deviceId={deviceId}
            setDeviceId={(id) => {
              setDeviceIdState(id);
              setStoredDeviceId(id);
            }}
            secret={secret}
            setSecret={(sec) => {
              setSecretState(sec);
              setStoredPcSecret(sec);
            }}
            deviceRecord={deviceRecord}
            isConnected={isConnected}
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
  deviceRecord: PcDeviceRecord | null;
  isConnected: boolean;
  onToast: (msg: string) => void;
}> = ({ deviceId, setDeviceId, secret, setSecret, deviceRecord, isConnected, onToast }) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await sendPcCommand("ping", {}, { onToast });
    setTesting(false);
    if (res.success) {
      setTestResult("Ping successful! PC Helper is responsive.");
    } else {
      setTestResult(`Ping failed: ${res.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Device Status Card */}
      <div className="p-5 rounded-3xl bg-[#0F172A]/90 border border-purple-500/30 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-white">DEVICE STATUS</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Live Helper Connection</p>
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
            {isConnected ? "Connected" : "Offline"}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">CPU</span>
            <span className="text-base font-black text-white">
              {deviceRecord?.cpu_usage !== undefined ? `${deviceRecord.cpu_usage}%` : "N/A"}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">RAM</span>
            <span className="text-base font-black text-white">
              {deviceRecord?.ram_usage !== undefined ? `${deviceRecord.ram_usage}%` : "N/A"}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Battery</span>
            <span className="text-base font-black text-white">
              {deviceRecord?.battery !== undefined ? `${deviceRecord.battery}%` : "N/A"}
            </span>
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
              placeholder="default_pc"
              className="w-full px-4 py-3 rounded-2xl bg-black/50 border border-white/10 text-white text-xs font-mono focus:border-purple-400 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
              SECRET (Saved ONLY locally in localStorage)
            </label>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter PC Helper password/secret"
              className="w-full px-4 py-3 rounded-2xl bg-black/50 border border-white/10 text-white text-xs font-mono focus:border-purple-400 outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              This secret is never transmitted to Supabase or the AI model. It is used exclusively to generate HMAC signatures locally.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 text-purple-200" />
            )}
            Test Connection (Ping)
          </button>

          {testResult && (
            <div className="p-3 rounded-2xl bg-black/50 border border-purple-500/30 text-xs font-mono text-purple-300">
              {testResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* 2. PC CONTROL VIEW */
const PcControlView: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const [appName, setAppName] = useState("chrome");
  const [linkUrl, setLinkUrl] = useState("https://google.com");
  const [lastOutput, setLastOutput] = useState<string | null>(null);
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const runControl = async (action: string, args: any = {}) => {
    setExecuting(true);
    const res = await sendPcCommand(action, args, { onToast });
    setExecuting(false);

    if (res.result) {
      if (res.result.screenshot) {
        setLastScreenshot(res.result.screenshot);
      } else {
        setLastOutput(JSON.stringify(res.result, null, 2));
      }
    } else if (res.message) {
      setLastOutput(res.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Big Action Tiles */}
        <button
          onClick={() => runControl("lock")}
          className="p-4 rounded-2xl bg-[#0F172A] border border-purple-500/30 hover:border-purple-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <Lock className="w-6 h-6 text-amber-400" />
          <span className="text-xs font-black uppercase text-white">Lock PC</span>
        </button>

        <button
          onClick={() => runControl("media", { key: "volume_up" })}
          className="p-4 rounded-2xl bg-[#0F172A] border border-purple-500/30 hover:border-purple-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <Volume2 className="w-6 h-6 text-emerald-400" />
          <span className="text-xs font-black uppercase text-white">Volume Up</span>
        </button>

        <button
          onClick={() => runControl("media", { key: "volume_down" })}
          className="p-4 rounded-2xl bg-[#0F172A] border border-purple-500/30 hover:border-purple-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <Volume1 className="w-6 h-6 text-emerald-400" />
          <span className="text-xs font-black uppercase text-white">Volume Down</span>
        </button>

        <button
          onClick={() => runControl("media", { key: "mute" })}
          className="p-4 rounded-2xl bg-[#0F172A] border border-purple-500/30 hover:border-purple-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <VolumeX className="w-6 h-6 text-red-400" />
          <span className="text-xs font-black uppercase text-white">Mute</span>
        </button>

        <button
          onClick={() => runControl("media", { key: "play_pause" })}
          className="p-4 rounded-2xl bg-[#0F172A] border border-purple-500/30 hover:border-purple-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <Play className="w-6 h-6 text-indigo-400" />
          <span className="text-xs font-black uppercase text-white">Play / Pause</span>
        </button>

        <button
          onClick={() => runControl("system_info")}
          className="p-4 rounded-2xl bg-[#0F172A] border border-purple-500/30 hover:border-purple-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <Cpu className="w-6 h-6 text-cyan-400" />
          <span className="text-xs font-black uppercase text-white">System Info</span>
        </button>

        <button
          onClick={() => runControl("screenshot")}
          className="p-4 rounded-2xl bg-[#0F172A] border border-purple-500/30 hover:border-purple-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <Camera className="w-6 h-6 text-pink-400" />
          <span className="text-xs font-black uppercase text-white">Screenshot</span>
        </button>

        <button
          onClick={() => runControl("shutdown")}
          className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 hover:border-red-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <Power className="w-6 h-6 text-red-400" />
          <span className="text-xs font-black uppercase text-red-200">Shutdown</span>
        </button>

        <button
          onClick={() => runControl("restart")}
          className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 hover:border-amber-400 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
        >
          <RotateCcw className="w-6 h-6 text-amber-400" />
          <span className="text-xs font-black uppercase text-amber-200">Restart</span>
        </button>

        <button
          onClick={() => runControl("cancel_shutdown")}
          className="p-4 rounded-2xl bg-[#0F172A] border border-slate-700 hover:border-slate-500 flex flex-col items-center justify-center gap-2 active:scale-95 transition-all shadow-lg col-span-2 sm:col-span-1"
        >
          <XCircle className="w-6 h-6 text-slate-400" />
          <span className="text-xs font-black uppercase text-slate-300">Cancel Shutdown</span>
        </button>
      </div>

      {/* Input controls */}
      <div className="p-5 rounded-3xl bg-[#0F172A]/90 border border-purple-500/30 space-y-4">
        <h3 className="text-xs font-black uppercase text-white">LAUNCHERS</h3>

        <div className="flex gap-2">
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder="App name e.g. chrome, notepad"
            className="flex-1 px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-xs font-mono text-white outline-none"
          />
          <button
            onClick={() => runControl("open_app", { name: appName })}
            className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-xs font-black uppercase text-white shrink-0"
          >
            Open App
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="URL e.g. https://google.com"
            className="flex-1 px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-xs font-mono text-white outline-none"
          />
          <button
            onClick={() => runControl("open_url", { url: linkUrl })}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-xs font-black uppercase text-white shrink-0"
          >
            Open Link
          </button>
        </div>
      </div>

      {/* Results output */}
      {(lastOutput || lastScreenshot) && (
        <div className="p-5 rounded-3xl bg-[#0F172A]/90 border border-purple-500/30 space-y-3">
          <h3 className="text-xs font-black uppercase text-slate-300">CONTROL RESULT</h3>
          {lastScreenshot && (
            <img src={lastScreenshot} alt="Screenshot" className="w-full rounded-2xl border border-purple-500/30 shadow-lg" />
          )}
          {lastOutput && (
            <pre className="p-3 rounded-2xl bg-black/60 border border-white/5 text-[11px] font-mono text-purple-200 overflow-x-auto">
              {lastOutput}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

/* 3. PC FILES VIEW */
const PcFilesView: React.FC<{ onToast: (msg: string) => void }> = ({ onToast }) => {
  const [currentPath, setCurrentPath] = useState("/");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFolder = async (path: string) => {
    setLoading(true);
    setCurrentPath(path);
    const res = await sendPcCommand("list_dir", { path }, { onToast });
    setLoading(false);
    if (res.result && Array.isArray(res.result.items)) {
      setItems(res.result.items);
    } else if (res.result && Array.isArray(res.result)) {
      setItems(res.result);
    } else {
      setItems([]);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    const res = await sendPcCommand("search_files", { query: searchQuery, root: currentPath }, { onToast });
    setLoading(false);
    if (res.result && Array.isArray(res.result.items)) {
      setItems(res.result.items);
    } else if (res.result && Array.isArray(res.result)) {
      setItems(res.result);
    } else {
      setItems([]);
    }
  };

  useEffect(() => {
    loadFolder("/");
  }, []);

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-3xl bg-[#0F172A]/90 border border-purple-500/30 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={currentPath}
            onChange={(e) => setCurrentPath(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-xs font-mono text-white outline-none"
          />
          <button
            onClick={() => loadFolder(currentPath)}
            className="px-4 py-2.5 rounded-2xl bg-purple-600 text-xs font-black uppercase text-white"
          >
            Go
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search query in allowed folders..."
            className="flex-1 px-4 py-2.5 rounded-2xl bg-black/50 border border-white/10 text-xs font-mono text-white outline-none"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600 text-xs font-black uppercase text-white flex items-center gap-1.5"
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
          <p className="p-8 text-center text-xs text-slate-400">No items found or path restricted.</p>
        ) : (
          items.map((item, idx) => {
            const isDir = item.is_dir || item.type === "directory" || item.isDir;
            const fullPath = item.path || `${currentPath}/${item.name}`.replace(/\/+/g, "/");

            return (
              <button
                key={idx}
                onClick={() => {
                  if (isDir) {
                    loadFolder(fullPath);
                  } else {
                    sendPcCommand("open_path", { path: fullPath }, { onToast });
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
                    {item.name || item.path}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">
                  {isDir ? "Folder" : "Open on PC"}
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
  const [awaitingCmds, setAwaitingCmds] = useState<PcCommandRecord[]>([]);

  const fetchConfirmations = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("pc_commands")
      .select("*")
      .eq("status", "awaiting_confirm")
      .order("ts", { ascending: false });

    if (data) setAwaitingCmds(data);
  };

  useEffect(() => {
    fetchConfirmations();
    const interval = setInterval(fetchConfirmations, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (id: string) => {
    const ok = await approvePcCommand(id);
    if (ok) {
      onToast("Command approved!");
      fetchConfirmations();
    }
  };

  const handleReject = async (id: string) => {
    const ok = await rejectPcCommand(id);
    if (ok) {
      onToast("Command rejected!");
      fetchConfirmations();
    }
  };

  return (
    <div className="space-y-4">
      {awaitingCmds.length === 0 ? (
        <div className="p-12 rounded-3xl bg-[#0F172A]/80 border border-purple-500/30 text-center space-y-3">
          <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-sm font-black uppercase text-white">No Pending Confirmations</h3>
          <p className="text-xs text-slate-400">
            When a sensitive action requires approval, it will appear here in real-time.
          </p>
        </div>
      ) : (
        awaitingCmds.map((cmd) => (
          <div
            key={cmd.id}
            className="p-5 rounded-3xl bg-[#0F172A] border border-amber-500/40 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Awaiting Confirmation
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {new Date(cmd.ts).toLocaleTimeString()}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-black text-white">Action: {cmd.action}</p>
              <p className="text-xs font-mono text-purple-300">Args: {cmd.args_json}</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleApprove(cmd.id)}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
              >
                <Check className="w-4 h-4" /> Approve
              </button>
              <button
                onClick={() => handleReject(cmd.id)}
                className="flex-1 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
              >
                <X className="w-4 h-4" /> Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

/* 5. PC HISTORY VIEW */
const PcHistoryView: React.FC = () => {
  const [history, setHistory] = useState<PcCommandRecord[]>([]);

  const fetchHistory = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from("pc_commands")
      .select("*")
      .order("ts", { ascending: false })
      .limit(50);

    if (data) setHistory(data);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="space-y-3">
      {history.length === 0 ? (
        <p className="p-8 text-center text-xs text-slate-400">No command history logged yet.</p>
      ) : (
        history.map((cmd) => (
          <div key={cmd.id} className="p-4 rounded-2xl bg-[#0F172A] border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-white uppercase">{cmd.action}</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                  cmd.status === "done"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : cmd.status === "error"
                    ? "bg-red-500/20 text-red-300"
                    : cmd.status === "approved"
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "bg-amber-500/20 text-amber-300"
                }`}
              >
                {cmd.status}
              </span>
            </div>

            <p className="text-[11px] font-mono text-slate-400">Args: {cmd.args_json}</p>

            {cmd.result && (
              <pre className="p-2 rounded-xl bg-black/50 text-[10px] font-mono text-purple-300 overflow-x-auto">
                {typeof cmd.result === "string" ? cmd.result : JSON.stringify(cmd.result)}
              </pre>
            )}
            {cmd.error && <p className="text-[11px] font-mono text-red-400">Error: {cmd.error}</p>}
          </div>
        ))
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
        <div>
          <h3 className="text-base font-black uppercase text-white">SAFETY & SECURITY</h3>
          <p className="text-xs text-slate-400">Read-Only Safety Reference</p>
        </div>
      </div>

      <div className="space-y-3 text-xs leading-relaxed text-slate-300">
        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
          <span className="font-black text-white uppercase block">Emergency Stop Shortcut</span>
          <p>
            Press <code className="px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 font-mono">Ctrl + Alt + Q</code> on the PC to instantly kill the PC Helper daemon process.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
          <span className="font-black text-white uppercase block">PC Helper Permissions</span>
          <p>
            Remote shell execution (`run_shell`) and screenshot capture are configured in the PC's local <code className="px-2 py-0.5 rounded bg-purple-900/60 text-purple-200 font-mono">config.json</code> file.
          </p>
        </div>
      </div>
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
