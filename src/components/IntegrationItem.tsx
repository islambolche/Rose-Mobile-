import { ShieldCheck, Plug, Facebook, Smartphone, Monitor, Lock, AlertTriangle } from "lucide-react";

export const IntegrationItem = ({ title, subtitle, icon: Icon, connected, onToggle, locked }: any) => (
  <div className="bg-[#0A1628]/80 border border-purple-500/20 rounded-[2rem] p-6 space-y-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-white">{title}</h3>
          <p className="text-[10px] text-slate-400 font-medium">{subtitle}</p>
        </div>
      </div>
      <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${connected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'}`}>
        {connected ? 'CONNECTED' : 'NOT SET'}
      </div>
    </div>
    <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5">
      <span className="text-xs text-slate-300">Always ask before acting</span>
      <div className="relative">
        <input type="checkbox" checked={true} disabled className="opacity-0 w-10 h-6 cursor-not-allowed" />
        <div className="absolute inset-0 bg-purple-600 rounded-full flex items-center justify-center">
            <Lock className="w-3 h-3 text-white" />
        </div>
      </div>
    </div>
  </div>
);
