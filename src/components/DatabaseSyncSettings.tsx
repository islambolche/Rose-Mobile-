import React, { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Check, X, Eye, EyeOff, Database, Cpu, RefreshCw, Key } from "lucide-react";
import { supabase, DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from "../lib/supabase";
import { createClient } from "@supabase/supabase-js";

interface DatabaseSyncSettingsProps {
  onClose: () => void;
}

const Card = ({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) => (
  <div className="p-4 mx-3 rounded-[16px] border-[1.5px] border-[#2e2160] bg-[#0f0f23] mb-4">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-[42px] h-[42px] rounded-[12px] bg-gradient-to-br from-[#6d3fd1] to-[#4b27a0] flex items-center justify-center shadow-[0_0_15px_rgba(109,63,209,0.4)]">
        <Database className="w-5 h-5 text-white" />
      </div>
      <div>
        <h3 className="text-[15px] font-bold text-white">{title}</h3>
        <p className="text-[12px] text-gray-400">{desc}</p>
      </div>
    </div>
    {children}
  </div>
);

export const DatabaseSyncSettings: React.FC<DatabaseSyncSettingsProps> = ({ onClose }) => {
  const [supabaseUrl, setSupabaseUrl] = useState(localStorage.getItem("supabase_url") || DEFAULT_SUPABASE_URL);
  const [supabaseKey, setSupabaseKey] = useState(localStorage.getItem("supabase_key") || DEFAULT_SUPABASE_ANON_KEY);
  const [showKey, setShowKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        setUser(data.session?.user || null);
        setConnectionStatus("connected");
      });
    }
  }, []);

  const handleTestConnection = async () => {
    if (!supabaseUrl.startsWith("https://")) {
      setErrorMessage("URL must start with https://");
      setConnectionStatus("error");
      return;
    }
    if (supabaseKey.includes("service_role")) {
      setErrorMessage("service_role key কখনও অ্যাপে বসাবে না, শুধু anon key দাও।");
      setConnectionStatus("error");
      return;
    }
    setConnectionStatus("connecting");
    try {
        const tempClient = createClient(supabaseUrl, supabaseKey);
        const { error } = await tempClient.auth.getSession();
        if (error) throw error;
        localStorage.setItem("supabase_url", supabaseUrl);
        localStorage.setItem("supabase_key", supabaseKey);
        setConnectionStatus("connected");
        setErrorMessage("");
        window.location.reload();
    } catch (e: any) {
        setConnectionStatus("error");
        setErrorMessage(e.message || "Failed to connect");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#020617] flex flex-col text-white">
      <div className="flex items-center p-4 border-b border-[#2e2160] mb-2">
        <button onClick={onClose} className="p-2"><ArrowLeft size={24} /></button>
        <h2 className="text-xl font-semibold ml-2">Database & Sync</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto pb-6">
        <Card title="CONNECTION (Supabase)" desc="Manage Supabase connection">
          <input type="text" placeholder="Supabase URL" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} className="w-full h-[48px] p-4 mb-3 bg-[#1a1a35] rounded-[16px] text-white outline-none" />
          <div className="relative mb-4">
            <input type={showKey ? "text" : "password"} placeholder="Anon Key" value={supabaseKey} onChange={e => setSupabaseKey(e.target.value)} className="w-full h-[48px] p-4 bg-[#1a1a35] rounded-[16px] text-white pr-12 outline-none" />
            <button onClick={() => setShowKey(!showKey)} className="absolute right-4 top-3 text-gray-400">{showKey ? <EyeOff size={20} /> : <Eye size={20} />}</button>
          </div>
          <button onClick={handleTestConnection} className="w-full h-[48px] bg-gradient-to-r from-[#6d3fd1] to-[#4b27a0] text-white rounded-[16px] font-bold">
            {connectionStatus === "connecting" ? <Loader2 className="animate-spin mx-auto" /> : "Save & Test Connection"}
          </button>
          <div className="mt-3 text-sm flex items-center gap-2">
            Status: <span className={connectionStatus === "connected" ? "text-green-500" : connectionStatus === "error" ? "text-red-500" : "text-gray-400"}>{connectionStatus}</span>
            {errorMessage && <span className="text-red-500 text-xs">{errorMessage}</span>}
          </div>
        </Card>

        <Card title="ACCOUNT" desc="Manage cloud account">
            {user ? (
              <div className="flex items-center justify-between">
                <span className="text-sm truncate">{user.email}</span>
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">LOGGED IN</span>
              </div>
            ) : <p className="text-gray-400 text-sm">Login required for cloud sync</p>}
        </Card>
        
        <Card title="SYNC" desc="API keys stay only on this phone.">
            <button className="w-full h-[48px] bg-gradient-to-r from-[#6d3fd1] to-[#4b27a0] text-white rounded-[16px] font-bold">Sync Now</button>
        </Card>

        <Card title="DATA MANAGEMENT" desc="Manage local & cloud data">
            <button className="w-full h-[48px] bg-[#1a1a35] border border-[#2e2160] text-white rounded-[16px] mb-3">Copy Setup SQL</button>
            <button className="w-full h-[48px] border border-red-500 text-red-500 rounded-[16px]">Clear Local Chat</button>
        </Card>
      </div>
    </div>
  );
};
