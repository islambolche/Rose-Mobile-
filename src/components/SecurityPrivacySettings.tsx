import React, { useState, useEffect } from "react";
import { ArrowLeft, Lock, Shield, Eye, EyeOff, Trash2, FileText, AlertCircle, RefreshCw } from "lucide-react";
import { logActivity } from "../lib/activityLog";

const Card = ({ title, desc, icon: Icon, children }: { title: string; desc: string; icon: any; children: React.ReactNode }) => (
  <div className="p-4 mx-4 rounded-[18px] border-[1.5px] border-[#2e2160] bg-[#0f0f23] mb-4">
    <div className="flex items-center gap-3 mb-3">
      <div className="w-[36px] h-[36px] rounded-[10px] bg-gradient-to-br from-[#6d3fd1] to-[#4b27a0] flex items-center justify-center shadow-[0_0_10px_rgba(109,63,209,0.5)]">
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <h3 className="text-[14px] font-bold text-white">{title}</h3>
        <p className="text-[11px] text-gray-400">{desc}</p>
      </div>
    </div>
    {children}
  </div>
);

const Toggle = ({ checked, onChange, disabled }: { checked: boolean; onChange: (c: boolean) => void; disabled?: boolean }) => (
  <button 
    disabled={disabled}
    onClick={() => onChange(!checked)} 
    className={`w-12 h-7 rounded-full p-1 flex transition-colors ${checked ? "bg-purple-600 justify-end" : "bg-gray-700 justify-start"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  >
    <div className="w-5 h-5 bg-white rounded-full shadow-md" />
  </button>
);

export const SecurityPrivacySettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [logs, setLogs] = useState(() => JSON.parse(localStorage.getItem('activity_logs') || '[]'));

  useEffect(() => {
    logActivity("Security", "Opened Security & Privacy settings");
  }, []);

  const deleteAllData = () => {
    if (confirm("Are you sure you want to delete ALL data?")) {
        const confirm2 = prompt("Type DELETE to confirm");
        if (confirm2 === "DELETE") {
            localStorage.clear();
            logActivity("Security", "Deleted all data");
            location.reload();
        }
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col text-white">
      <div className="flex items-center p-4 border-b border-[#2e2160] mb-2">
        <button onClick={onClose} className="p-2"><ArrowLeft size={24} /></button>
        <h2 className="text-xl font-semibold ml-2">Security & Privacy</h2>
      </div>
      <div className="flex-1 overflow-y-auto pb-8">
        <Card title="SECURITY STATUS" desc="Current protection level" icon={Shield}>
          <div className="bg-green-500/20 text-green-400 p-4 rounded-xl text-center font-bold">PROTECTED</div>
        </Card>
        <Card title="APP LOCK" desc="PIN protection" icon={Lock}>
            <div className="flex justify-between items-center">
                <span>Enable App Lock</span>
                <Toggle checked={!!localStorage.getItem('app_lock_enabled')} onChange={(c) => { localStorage.setItem('app_lock_enabled', c.toString()); logActivity("Security", `App lock ${c ? "enabled" : "disabled"}`); }} />
            </div>
        </Card>
        <Card title="ACTIVITY LOG" desc="Recent security events" icon={AlertCircle}>
            <div className="text-xs text-slate-400 max-h-40 overflow-y-auto">
                {logs.slice(0, 10).map((log: any, i: number) => (
                    <div key={i} className="mb-1">{new Date(log.timestamp).toLocaleTimeString()}: {log.type} - {log.detail}</div>
                ))}
            </div>
        </Card>
        <Card title="DATA & PRIVACY" desc="Manage your information" icon={Trash2}>
            <button onClick={deleteAllData} className="w-full p-3 bg-red-900/20 text-red-400 border border-red-500 rounded-xl font-bold">Delete All Data</button>
        </Card>
      </div>
    </div>
  );
};
