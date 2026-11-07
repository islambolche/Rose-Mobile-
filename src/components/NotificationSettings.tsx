import React, { useState, useEffect } from "react";
import { ArrowLeft, Bell, Settings, Volume2, Vibrate, MessageSquare, AlertCircle, RefreshCw, Trash2, CheckSquare, Clock, Shield } from "lucide-react";

interface NotificationSettingsProps {
  onClose: () => void;
}

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

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({ onClose }) => {
  const [enabled, setEnabled] = useState(Notification.permission === "granted");
  const [permission, setPermission] = useState(Notification.permission);

  const requestPermission = async () => {
    const res = await Notification.requestPermission();
    setPermission(res);
    setEnabled(res === "granted");
  };

  const sendTest = () => {
    if (enabled) new Notification("Test Notification", { body: "This is a test!" });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#020617] flex flex-col text-white">
      <div className="flex items-center p-4 border-b border-[#2e2160] mb-2">
        <button onClick={onClose} className="p-2"><ArrowLeft size={24} /></button>
        <h2 className="text-xl font-semibold ml-2">Notifications</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto pb-8">
        <Card title="STATUS" desc="Current notification permission" icon={Bell}>
            <div className={`text-center p-3 rounded-xl mb-4 font-bold text-sm ${permission === 'granted' ? 'bg-green-500/20 text-green-400' : permission === 'denied' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {permission.toUpperCase()}
            </div>
            <div className="flex justify-between items-center mb-4">
                <span className="text-sm">Enable Notifications</span>
                <Toggle checked={enabled} onChange={(c) => c ? requestPermission() : setEnabled(false)} />
            </div>
            <div className="flex gap-2">
                <button onClick={sendTest} className="flex-1 h-[48px] bg-gradient-to-r from-[#6d3fd1] to-[#4b27a0] rounded-[16px] font-bold text-sm">Send Test</button>
                <button onClick={() => setPermission(Notification.permission)} className="flex-1 h-[48px] border border-gray-600 rounded-[16px] font-bold text-sm">Refresh</button>
            </div>
        </Card>

        <Card title="CATEGORIES" desc="Configure notification types" icon={MessageSquare}>
            {['General', 'System', 'Updates'].map(cat => (
                <div key={cat} className="flex justify-between items-center mb-2">
                    <span className="text-sm">{cat}</span>
                    <Toggle checked={true} onChange={() => {}} />
                </div>
            ))}
        </Card>

        <Card title="SOUND & VIBRATION" desc="Alert preferences" icon={Volume2}>
            <div className="flex justify-between items-center mb-4">
                <span className="text-sm">Vibration</span>
                <Toggle checked={true} onChange={() => {}} />
            </div>
            <div className="flex justify-between items-center">
                <span className="text-sm">Sound Volume</span>
                <input type="range" className="w-24" />
            </div>
        </Card>

        <Card title="QUIET HOURS" desc="Silence notifications during specific times" icon={Clock}>
            <div className="flex justify-between items-center">
                <span className="text-sm">Enabled</span>
                <Toggle checked={false} onChange={() => {}} />
            </div>
        </Card>

        <Card title="NOTIFICATION CENTER" desc="History and management" icon={AlertCircle}>
            <button className="w-full h-[40px] border border-gray-600 rounded-[12px] text-sm">Clear History</button>
        </Card>

        <Card title="BACKGROUND DELIVERY" desc="App behavior when closed" icon={RefreshCw}>
            <div className="flex justify-between items-center">
                <span className="text-sm">Allow Background</span>
                <Toggle checked={true} onChange={() => {}} />
            </div>
        </Card>

        <Card title="COMMAND SAFETY" desc="Sensitive alert filtering" icon={Shield}>
            <div className="flex justify-between items-center">
                <span className="text-sm">Filter Sensitive</span>
                <Toggle checked={true} onChange={() => {}} />
            </div>
        </Card>
      </div>
    </div>
  );
};
