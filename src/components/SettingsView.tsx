import React, { useState, useEffect } from "react";
import { X, ArrowLeft, Key, Globe, Volume2, Database, Check, AlertTriangle, Loader2, Eye, EyeOff, Zap, Plug, ShieldCheck } from "lucide-react";
import { DiagnosticsView } from "./DiagnosticsView";
import { UnifiedSettings, saveUnifiedSettings, loadUnifiedSettings } from "../types/settings";
import { SharedBusinessDatabase } from "../types/business";
import { saveLocalBusinessDb, validateGeminiApiKey } from "../lib/businessSync";
import { openExternal } from "../lib/openExternal";

interface SettingsViewProps {
  db: SharedBusinessDatabase;
  onUpdateDb: (updated: SharedBusinessDatabase) => void;
  unifiedSettings: UnifiedSettings;
  onUpdateUnifiedSettings: (updated: UnifiedSettings) => void;
  onClose: () => void;
  setCurrentView: (view: string) => void;
  liveTimings: any;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ db, onUpdateDb, unifiedSettings, onUpdateUnifiedSettings, onClose, setCurrentView, liveTimings }) => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [form, setForm] = useState<UnifiedSettings>(unifiedSettings);
  const [showKey, setShowKey] = useState(false);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  const handleSave = () => {
    onUpdateUnifiedSettings(form);
    saveUnifiedSettings(form);
    setSavedStatus("Saved");
    setTimeout(() => setSavedStatus(null), 2000);
  };

  const handleSupabaseSave = () => {
    // Supabase logic needs to match what is currently implemented in existing settings. 
    // Based on inspection, existing settings use UnifiedSettings.
    handleSave();
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#020617] text-white flex flex-col font-sans">
      <header className="px-5 py-4 border-b border-green-500/20 flex items-center gap-4 shrink-0 bg-[#020617]/90 backdrop-blur-md">
        <button onClick={onClose} className="p-2.5 bg-green-500/10 rounded-2xl text-green-400 active:scale-95 transition-transform">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">SETTINGS</h2>
      </header>

      {showDiagnostics && (
        <DiagnosticsView 
          liveTimings={liveTimings} 
          unifiedSettings={unifiedSettings} 
          onBack={() => setShowDiagnostics(false)} 
        />
      )}

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8 pb-32">
        {/* Gemini API Key */}
        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-green-400 flex items-center gap-2"><Key className="w-3.5 h-3.5" /> GEMINI API KEY</h3>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={form.geminiApiKey}
              onChange={(e) => setForm({...form, geminiApiKey: e.target.value})}
              placeholder="AIzaSy..."
              className="w-full bg-[#0F172A] border border-green-500/20 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-green-400"
            />
            <button onClick={() => setShowKey(!showKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <a href="https://aistudio.google.com/apikey" onClick={(e) => { e.preventDefault(); openExternal("https://aistudio.google.com/apikey"); }} className="text-[10px] font-bold text-green-500 hover:text-green-400 uppercase tracking-widest block cursor-pointer">Get a free key</a>
          <button onClick={handleSave} className="w-full py-3 bg-green-600 rounded-2xl text-xs font-black uppercase text-white shadow-lg">{savedStatus || "Save"}</button>
        </section>

        {/* Voice & Language */}
        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-green-400 flex items-center gap-2"><Volume2 className="w-3.5 h-3.5" /> VOICE & LANGUAGE</h3>
          <select value={form.voiceName} onChange={(e) => setForm({...form, voiceName: e.target.value})} className="w-full bg-[#0F172A] border border-green-500/20 rounded-2xl px-4 py-3 text-xs text-white">
            <option value="Sulafat">Sulafat</option>
            <option value="Aoede">Aoede</option>
          </select>
          <select value={form.language} onChange={(e) => setForm({...form, language: e.target.value})} className="w-full bg-[#0F172A] border border-green-500/20 rounded-2xl px-4 py-3 text-xs text-white">
            <option value="Bengali">Bangla</option>
            <option value="English">English</option>
            <option value="Hindi">Hindi</option>
          </select>
          <button onClick={handleSave} className="w-full py-3 bg-green-600 rounded-2xl text-xs font-black uppercase text-white">{savedStatus || "Save"}</button>
        </section>
        
        {/* Supabase */}
        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-green-400 flex items-center gap-2"><Database className="w-3.5 h-3.5" /> SUPABASE</h3>
          <input type="text" placeholder="Supabase URL" className="w-full bg-[#0F172A] border border-green-500/20 rounded-2xl px-4 py-3 text-xs text-white outline-none" />
          <input type="password" placeholder="Supabase Anon Key" className="w-full bg-[#0F172A] border border-green-500/20 rounded-2xl px-4 py-3 text-xs text-white outline-none" />
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
             <div className="w-2 h-2 rounded-full bg-red-500" /> Not connected
          </div>
          <button onClick={handleSupabaseSave} className="w-full py-3 bg-green-600 rounded-2xl text-xs font-black uppercase text-white">{savedStatus || "Save"}</button>
        </section>

        {/* Diagnostics Button */}
        <section className="pt-4 border-t border-white/5">
          <button 
            onClick={() => setShowDiagnostics(true)}
            className="w-full bg-[#0A1628] border border-emerald-500/30 rounded-[2rem] p-5 flex items-center justify-between group active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Zap className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">DIAGNOSTICS</h3>
                <p className="text-[10px] text-slate-500 font-medium">Live latency and model info</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-emerald-400">
              <Zap className="w-4 h-4" />
            </div>
          </button>
        </section>

        {/* Integrations and Approvals */}
        <section className="space-y-4 pt-4 border-t border-white/5">
          <button 
              onClick={() => { onClose(); setCurrentView('integrations'); }}
              className="w-full bg-[#0A1628] border border-purple-500/30 rounded-[2rem] p-5 flex items-center justify-between group active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <Plug className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">INTEGRATIONS</h3>
                <p className="text-[10px] text-slate-500 font-medium">Facebook, Phone, PC and more</p>
              </div>
            </div>
          </button>
          <button 
              onClick={() => { onClose(); setCurrentView('approvals'); }}
              className="w-full bg-[#0A1628] border border-purple-500/30 rounded-[2rem] p-5 flex items-center justify-between group active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">APPROVALS</h3>
                <p className="text-[10px] text-slate-500 font-medium">Actions waiting for your OK</p>
              </div>
            </div>
          </button>
        </section>
      </div>
    </div>
  );
};
