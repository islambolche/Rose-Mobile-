import React, { useState, useEffect } from "react";
import { ArrowLeft, BarChart2, Zap, Smartphone, AlertCircle } from "lucide-react";
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

export const AnalyticsSettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [stats, setStats] = useState({ messages: 0, sessions: 0 });

  useEffect(() => {
    logActivity("Analytics", "Opened Analytics settings");
    // Simulate fetching stats
    setStats({ messages: parseInt(localStorage.getItem('msg_count') || '0'), sessions: parseInt(localStorage.getItem('session_count') || '0') });
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col text-white">
      <div className="flex items-center p-4 border-b border-[#2e2160] mb-2">
        <button onClick={onClose} className="p-2"><ArrowLeft size={24} /></button>
        <h2 className="text-xl font-semibold ml-2">Analytics</h2>
      </div>
      <div className="flex-1 overflow-y-auto pb-8">
        <Card title="OVERVIEW" desc="Usage statistics" icon={BarChart2}>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1a1a35] p-3 rounded-xl text-center"><div className="text-2xl font-bold">{stats.messages}</div><div className="text-[10px] text-gray-400">Messages</div></div>
                <div className="bg-[#1a1a35] p-3 rounded-xl text-center"><div className="text-2xl font-bold">{stats.sessions}</div><div className="text-[10px] text-gray-400">Sessions</div></div>
            </div>
        </Card>
        <Card title="AI PERFORMANCE" desc="Model latency and usage" icon={Zap}>
            <div className="text-sm">Gemini: 245ms avg</div>
            <div className="text-sm">Groq: 120ms avg</div>
        </Card>
        <Card title="DEVICE INFO" desc="App status" icon={Smartphone}>
            <div className="text-sm">Platform: Web</div>
            <div className="text-sm">Storage: {Math.round(JSON.stringify(localStorage).length / 1024)} KB</div>
        </Card>
      </div>
    </div>
  );
};
