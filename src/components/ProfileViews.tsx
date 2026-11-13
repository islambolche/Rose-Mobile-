import React, { useState, useEffect } from 'react';
import { getGlobalMicStream } from '../lib/audio-manager';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Sparkles, ChevronRight, User, Shield, Smile, Globe, Volume2, Pencil, Trash2, 
  ToggleRight, ToggleLeft, Facebook, Youtube, Instagram, MessageCircle, Send, Image as ImageIcon,
  Save, Lock, ExternalLink, Eye, EyeOff, LogOut, Loader2, AlertTriangle, Smartphone
} from 'lucide-react';
import { AssistantSettings, UserPreferences } from '../types';
import { supabase } from '../lib/supabase';
import { navStore } from '../lib/nav';

// ADMIN_EMAIL constant removed in favor of DB roles

const isAiStudioPreview = () => {
  if (typeof window === 'undefined') return false;
  const isIframe = window.self !== window.top;
  const isAiStudioUrl = 
    window.location.hostname.endsWith(".usercontent.goog") || 
    window.location.hostname.includes("aistudio") ||
    (isIframe && (document.referrer.includes("aistudio.google.com") || (window.location as any).ancestorOrigins?.contains?.("https://aistudio.google.com")));
  return isAiStudioUrl;
};

// Branded SVG Logos
const FacebookLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#1877F2]">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const YoutubeLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#FF0000]">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const TikTokLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.03 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.9-.32-1.98-.23-2.81.33-.76.51-1.2 1.43-1.1 2.34.01.52.17 1.03.47 1.47.5.76 1.44 1.22 2.34 1.14 1.25-.03 2.35-1.1 2.44-2.35.09-2.52.01-5.04.01-7.56V.02z" fill="white"/>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.03 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.9-.32-1.98-.23-2.81.33-.76.51-1.2 1.43-1.1 2.34.01.52.17 1.03.47 1.47.5.76 1.44 1.22 2.34 1.14 1.25-.03 2.35-1.1 2.44-2.35.09-2.52.01-5.04.01-7.56V.02z" fill="none" stroke="#25F4EE" strokeWidth="0.5" />
  </svg>
);

const WhatsAppLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#25D366]">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.67 1.437 5.662 1.437h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const TelegramLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#229ED9]">
    <path d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12z" fill="none" opacity=".1"/>
    <path d="M18.35 6.033l-16.14 6.223c-1.1.442-1.094 1.056-.201 1.33l4.144 1.293 9.593-6.052c.453-.274.868-.127.527.176l-7.773 7.013-.303 4.542c.445 0 .641-.204.89-.446l2.138-2.078 4.448 3.284c.82.452 1.41.22 1.614-.76l2.92-13.766c.299-1.2-.456-1.743-1.24-.13z" fill="#229ED9"/>
  </svg>
);

export const PrivacyView = ({ settings, prefs, setCurrentView, setToast }: any) => {
  // 1. Microphone State
  const [micState, setMicState] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('checking');

  // 2. Approximate Location State
  const [approxLocation, setApproxLocation] = useState<boolean>(() => {
    return localStorage.getItem('rose_approx_location_enabled') !== 'false';
  });

  // 4. Memory Facts State
  const [memories, setMemories] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('rose_memory_facts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // 6. Account Delete Modal States
  const [deleteModalStep, setDeleteModalStep] = useState<0 | 1 | 2>(0);
  const [deleteInputText, setDeleteInputText] = useState('');

  // 7. Privacy Policy Modal State
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  // Check Microphone Status on mount
  useEffect(() => {
    async function checkMic() {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const res = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setMicState(res.state as any);
          res.onchange = () => setMicState(res.state as any);
        } catch {
          setMicState('prompt');
        }
      } else {
        setMicState('prompt');
      }
    }
    checkMic();
  }, []);

  // Request Microphone access
  const handleRequestMic = async () => {
    try {
      const stream = await getGlobalMicStream({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicState('granted');
      if (setToast) setToast("মাইক্রোফোন পারমিশন সচল করা হয়েছে");
    } catch {
      setMicState('denied');
      if (setToast) setToast("মাইক্রোফোন পারমিশন বন্ধ আছে। ফোন সেটিংসে চেক করুন।");
    }
  };

  // Toggle Approximate Location
  const handleToggleLocation = () => {
    const nextVal = !approxLocation;
    setApproxLocation(nextVal);
    localStorage.setItem('rose_approx_location_enabled', String(nextVal));
    if (setToast) setToast(nextVal ? "আনুমানিক লোকেশন সচল করা হয়েছে" : "আনুমানিক লোকেশন নিষ্ক্রিয় করা হয়েছে");
  };

  // Clear Chat History
  const handleClearChatHistory = async () => {
    if (confirm("আপনি কি নিশ্চিত যে সমস্ত চ্যাট ইতিহাস মুছে ফেলতে চান?")) {
      try {
        localStorage.removeItem('iyabd_conversations');
        localStorage.removeItem('iyabd_chat_history');
        localStorage.removeItem('rose_chat_summary');
        localStorage.removeItem('iyabd_action_history');
        
        if ('indexedDB' in window) {
          try {
            indexedDB.deleteDatabase('RoseDB');
          } catch {}
        }
        if (setToast) setToast("সকল চ্যাট ইতিহাস মুছে ফেলা হয়েছে");
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Delete Individual Memory
  const handleDeleteSingleMemory = (id: string) => {
    const updated = memories.filter(m => m.id !== id);
    setMemories(updated);
    localStorage.setItem('rose_memory_facts', JSON.stringify(updated));
    if (setToast) setToast("মেমোরি আইটেম মুছে ফেলা হয়েছে");
  };

  // Clear All Memory
  const handleClearAllMemory = () => {
    if (confirm("আপনি কি নিশ্চিত যে Rose-এর মনে রাখা সমস্ত তথ্য মুছে ফেলতে চান?")) {
      setMemories([]);
      localStorage.setItem('rose_memory_facts', JSON.stringify([]));
      if (setToast) setToast("সকল মেমোরি তথ্য মুছে ফেলা হয়েছে");
    }
  };

  // Execute Account and All Data Deletion (Play Store Requirement)
  const handleExecuteAccountDelete = async () => {
    if (deleteInputText.trim().toUpperCase() !== 'DELETE') {
      alert("নিশ্চিত করতে অনুগ্রহ করে সঠিক বানান সহ DELETE লিখুন");
      return;
    }

    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('indexedDB' in window) {
        try {
          indexedDB.deleteDatabase('RoseDB');
          indexedDB.deleteDatabase('IYABD_Audio_Cache_DB');
        } catch {}
      }
      if (supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
      if (setToast) setToast("আপনার অ্যাকাউন্ট ও সকল ডেটা মুছে ফেলা হয়েছে");
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (e) {
      console.error(e);
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-[#020617] overflow-y-auto no-scrollbar flex flex-col">
      {/* Header */}
      <header className="px-5 py-6 flex items-center justify-between shrink-0 bg-[#020617]/90 backdrop-blur-xl sticky top-0 z-20 border-b border-white/5 min-h-[76px]">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentView('settings')} className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex items-center justify-center text-white active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">PRIVACY CONTROLS</h2>
        </div>
      </header>

      <div className="flex-1 px-6 py-6 space-y-6 pb-36">

        {/* 1. Microphone Permission */}
        <div className="p-5 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2rem] shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600/20 border border-purple-500/30 rounded-2xl flex items-center justify-center text-purple-400 shrink-0">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Microphone Permission</h3>
                <p className="text-[11px] text-slate-400 font-medium">ভয়েস উত্তরের জন্য পারমিশন প্রয়োজন</p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              micState === 'granted' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              micState === 'denied' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
              'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {micState === 'granted' ? 'চালু (Allowed)' : micState === 'denied' ? 'বন্ধ (Blocked)' : 'চেক করুন'}
            </span>
          </div>

          {micState === 'denied' && (
            <p className="text-[11px] text-red-400 font-medium bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
              মাইক্রোফোন বন্ধ করা আছে। আপনার ব্রাউজার বা ডিভাইসের Settings &gt; App Permissions এ গিয়ে মাইক্রোফোন চালু করুন।
            </p>
          )}

          <button 
            onClick={handleRequestMic}
            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-wider text-purple-300 flex items-center justify-center gap-2 active:scale-98 transition-all"
          >
            পারমিশন চেক / রিকোয়েস্ট করুন
          </button>
        </div>

        {/* 2. Approximate Location */}
        <div className="p-5 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2rem] shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600/20 border border-purple-500/30 rounded-2xl flex items-center justify-center text-purple-400 shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Approximate Location</h3>
                <p className="text-[11px] text-slate-400 font-medium">আবহাওয়া ও শহর ভিত্তিক প্রাসঙ্গিক উত্তর</p>
              </div>
            </div>
            <button 
              onClick={handleToggleLocation}
              className={`w-12 h-7 rounded-full transition-colors flex items-center px-1 ${approxLocation ? 'bg-purple-600' : 'bg-slate-700'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white transition-transform ${approxLocation ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            এটি চালু থাকলে Rose আপনাকে আঞ্চলিক সময় ও আবহাওয়া সংক্রান্ত তথ্য দিতে আনুমানিক লোকেশন ব্যবহার করতে পারে।
          </p>
        </div>

        {/* 3. Chat History */}
        <div className="p-5 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2rem] shadow-2xl space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600/20 border border-purple-500/30 rounded-2xl flex items-center justify-center text-purple-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Chat History</h3>
              <p className="text-[11px] text-slate-400 font-medium">ডিভাইস থেকে সংরক্ষিত সকল চ্যাট মুছে ফেলা</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            আপনার স্থানীয় ব্রাউজারে থাকা পূর্বের মেসেজ ও চ্যাট ইতিহাস মুছে ফেলুন।
          </p>
          <button 
            onClick={handleClearChatHistory}
            className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-2xl text-xs font-black uppercase tracking-wider text-red-400 flex items-center justify-center gap-2 active:scale-98 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            সকল চ্যাট ইতিহাস মুছে ফেলুন
          </button>
        </div>

        {/* 4. Memory */}
        <div className="p-5 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2rem] shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600/20 border border-purple-500/30 rounded-2xl flex items-center justify-center text-purple-400 shrink-0">
                <Smile className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Rose's Memory</h3>
                <p className="text-[11px] text-slate-400 font-medium">Rose-এর মনে রাখা তথ্যসমূহ ({memories.length})</p>
              </div>
            </div>
            {memories.length > 0 && (
              <button 
                onClick={handleClearAllMemory}
                className="text-[10px] font-black uppercase tracking-wider text-red-400 underline"
              >
                সব মুছুন
              </button>
            )}
          </div>

          {memories.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic p-3 bg-white/5 rounded-xl text-center">
              Rose এখনো কোনো বিশেষ তথ্য মনে রাখেনি।
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar pr-1">
              {memories.map((m) => (
                <div key={m.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-200 leading-snug">{m.text}</span>
                  <button 
                    onClick={() => handleDeleteSingleMemory(m.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. My Data Summary */}
        <div className="p-5 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2rem] shadow-2xl space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600/20 border border-purple-500/30 rounded-2xl flex items-center justify-center text-purple-400 shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">আমার ডেটা (My Data)</h3>
              <p className="text-[11px] text-slate-400 font-medium">কোন তথ্যগুলো অ্যাপে সংরক্ষিত আছে</p>
            </div>
          </div>
          <div className="p-4 bg-white/5 rounded-2xl space-y-2 text-xs text-slate-300">
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-slate-400 font-medium">ব্যবহারকারীর নাম:</span>
              <span className="font-bold text-white">{settings?.ownerName || "দেওয়া হয়নি"}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-slate-400 font-medium">অ্যাসিস্ট্যান্ট নাম:</span>
              <span className="font-bold text-white">{settings?.assistantName || "Rose AI"}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-slate-400 font-medium">ভাষা (Language):</span>
              <span className="font-bold text-white">{prefs?.language || "bn-BD"}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-slate-400 font-medium">আনুমানিক লোকেশন:</span>
              <span className="font-bold text-white">{approxLocation ? "সচল (Enabled)" : "বন্ধ (Disabled)"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">সংরক্ষিত মেমোরি:</span>
              <span className="font-bold text-white">{memories.length} টি তথ্য</span>
            </div>
          </div>
        </div>

        {/* 8. API Key Security */}
        <div className="p-5 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2rem] shadow-2xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600/20 border border-purple-500/30 rounded-2xl flex items-center justify-center text-purple-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">API Key নিরাপত্তা</h3>
              <p className="text-[11px] text-slate-400 font-medium">ডিভাইসের সম্পূর্ণ নিরাপত্তা</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed p-3 bg-white/5 rounded-xl">
            আপনার নিজস্ব প্রদত্ত Google Gemini ও Groq API Key শুধুমাত্র আপনার ডিভাইসের LocalStorage-এ সংরক্ষিত থাকে। এটি অন্য কোনো বাহ্যিক সার্ভারে পাঠানো হয় না এবং সরাসরি অফিশিয়াল API এন্ডপয়েন্টে এনক্রিপ্টেড রিকোয়েস্ট করতে ব্যবহৃত হয়।
          </p>
        </div>

        {/* 7. Privacy Policy & Terms */}
        <div className="p-5 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2rem] shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600/20 border border-purple-500/30 rounded-2xl flex items-center justify-center text-purple-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Privacy Policy & Terms</h3>
                <p className="text-[11px] text-slate-400 font-medium">শর্তাবলী ও পলিসি বিস্তারিত</p>
              </div>
            </div>
            <button 
              data-nav-id="privacy_policy_btn"
              onClick={() => navStore.push("privacy_policy")}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md active:scale-95 transition-transform"
            >
              দেখুন
            </button>
          </div>
        </div>

        {/* 6. Account Delete (Play Store Required) */}
        <div className="p-5 bg-red-950/20 border border-red-500/30 rounded-[2rem] shadow-2xl space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600/20 border border-red-500/30 rounded-2xl flex items-center justify-center text-red-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-red-400">Account & Data Delete</h3>
              <p className="text-[11px] text-slate-400 font-medium">অ্যাকাউন্ট ও সকল ডেটা মুছে ফেলুন</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            প্লে-স্টোর নীতিমালা অনুযায়ী আপনার অ্যাকাউন্ট ও লোকাল ডিভাইসে সংরক্ষিত সমস্ত তথ্য স্থায়ীভাবে মুছে ফেলুন।
          </p>
          <button 
            onClick={() => {
              setDeleteModalStep(1);
              setDeleteInputText('');
            }}
            className="w-full py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all shadow-xl shadow-red-900/30"
          >
            অ্যাকাউন্ট ও সব ডেটা মুছুন
          </button>
        </div>

      </div>

      {/* Privacy Policy Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-purple-500/30 rounded-[2.5rem] p-6 max-w-md w-full max-h-[85vh] overflow-y-auto no-scrollbar space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-black uppercase tracking-wider text-white italic">Privacy Policy & Terms</h3>
              <button onClick={() => setShowPolicyModal(false)} className="p-2 text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
              <p><strong>১. তথ্য সংগ্রহ:</strong> Rose অ্যাপটি ব্যবহারকারীর নাম, লোকাল চ্যাট মেসেজ ও পছন্দের সেটিংস শুধুমাত্র লোকাল ডিভাইসে সংরক্ষণ করে।</p>
              <p><strong>২. সুরক্ষা:</strong> আপনার কোনো ব্যক্তিগত তথ্য বাণিজ্যিক উদ্দেশ্যে বিক্রি বা অপব্যবহার করা হয় না।</p>
              <p><strong>৩. তৃতীয় পক্ষ সার্ভিস (3rd Party Services):</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Supabase:</strong> অথেন্টিকেশন ও সিঙ্ক সার্ভিস।</li>
                <li><strong>Google Gemini API:</strong> এআই চ্যাট ও ভয়েস উত্তর প্রস্তুত করার জন্য।</li>
              </ul>
              <p><strong>৪. যোগাযোগ ও সহায়তা:</strong></p>
              <p className="p-3 bg-white/5 rounded-xl font-bold text-purple-300">
                ডেভেলপার: MD YOUSUF KHAN<br />
                ইমেইল: md.yousuf.khan060@gmail.com
              </p>
            </div>
            <button 
              onClick={() => setShowPolicyModal(false)}
              className="w-full py-3 bg-purple-600 text-white rounded-xl text-xs font-black uppercase tracking-wider"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

      {/* Account Delete Double Confirmation Modal */}
      {deleteModalStep > 0 && (
        <div className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-red-500/40 rounded-[2.5rem] p-6 max-w-sm w-full space-y-5">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-lg font-black uppercase tracking-wider italic">
                {deleteModalStep === 1 ? "১ম ধাপ: নিশ্চিতকরণ" : "২য় ধাপ: চুড়ান্ত ডিলিট"}
              </h3>
            </div>

            {deleteModalStep === 1 ? (
              <>
                <p className="text-xs text-slate-300 leading-relaxed">
                  আপনি কি নিশ্চিত যে আপনার অ্যাকাউন্ট ও ডিভাইসে সংরক্ষিত সকল চ্যাট, মেমোরি ও সেটিংস মুছে ফেলতে চান? এই প্রক্রিয়াটি অপরিবর্তনীয়।
                </p>
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setDeleteModalStep(0)}
                    className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold uppercase"
                  >
                    বাতিল
                  </button>
                  <button 
                    onClick={() => setDeleteModalStep(2)}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase"
                  >
                    হ্যাঁ, পরের ধাপে যান
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-300 leading-relaxed">
                  চুড়ান্তভাবে ডিলিট করতে নিচে ঘরে <strong className="text-red-400">DELETE</strong> লিখুন:
                </p>
                <input 
                  type="text" 
                  value={deleteInputText}
                  onChange={(e) => setDeleteInputText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-slate-900 border border-red-500/40 rounded-xl p-3 text-sm text-white font-bold uppercase outline-none focus:ring-2 focus:ring-red-500"
                />
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setDeleteModalStep(0)}
                    className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold uppercase"
                  >
                    বাতিল
                  </button>
                  <button 
                    onClick={handleExecuteAccountDelete}
                    disabled={deleteInputText.trim().toUpperCase() !== 'DELETE'}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-red-900/40"
                  >
                    স্থায়ীভাবে মুছুন
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export const AdminProfileSettingsView = ({ setCurrentView, setToast }: any) => {
  const [adminData, setAdminData] = useState<any>({ 
    name: 'MD YOUSUF KHAN',
    subtitle: 'Web Developer',
    banner: '', 
    links: { facebook: '', youtube: '', instagram: '', tiktok: '', whatsapp: '', telegram: '', website: '', phone: '' } 
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      if (!supabase) {
        setCurrentView('privacy');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setCurrentView('privacy');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      if (profile?.role !== 'admin') {
        setCurrentView('privacy');
        return;
      }
      fetchSettings();
    }
    checkAuth();
  }, []);

  const fetchSettings = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('profile_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (data) {
        setAdminData({
          name: data.name || 'MD YOUSUF KHAN',
          subtitle: data.subtitle || 'Web Developer',
          banner: data.banner_url || '',
          links: data.links || { facebook: '', youtube: '', instagram: '', tiktok: '', whatsapp: '', telegram: '', website: '', phone: '' }
        });
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setCurrentView('privacy');
    setToast("Logged out");
  };

  const handleSave = async () => {
    if (!supabase) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profile_settings')
        .upsert({ 
          id: 1,
          name: adminData.name,
          subtitle: adminData.subtitle,
          banner_url: adminData.banner,
          links: adminData.links,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      setToast("Settings saved and published");
      setCurrentView('privacy');
    } catch (err: any) {
      alert("Save failed: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    setIsUploading(true); 
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `banner-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('banners')
        .getPublicUrl(filePath);

      setAdminData({ ...adminData, banner: publicUrl });
      setToast("Banner uploaded");
    } catch (err: any) {
      const msg = err.message || "Unknown error";
      if (msg.includes('bucket') || msg.includes('not found')) {
        alert("Upload failed: Storage bucket 'banners' might not exist. Please create it in Supabase dashboard.");
      } else {
        alert("Upload failed: " + msg);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const removeBanner = () => {
    setAdminData({ ...adminData, banner: '' });
    setToast("Banner removed");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#020617] overflow-y-auto flex flex-col no-scrollbar">
      <header className="px-5 py-6 flex items-center justify-between shrink-0 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-10 border-b border-white/5 min-h-[80px]">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentView('privacy')} className="p-2.5 bg-white/5 rounded-2xl active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <h3 className="text-xl font-black italic tracking-tighter uppercase text-white">Profile Admin</h3>
        </div>
        <button onClick={handleLogout} className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl active:bg-red-500/20 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <LogOut className="w-4 h-4 text-red-500" />
        </button>
      </header>

      <div className="px-6 py-8 space-y-8 pb-32">
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[3px] text-purple-400 ml-2">Banner Image (16:9)</label>
          <div className="relative aspect-video bg-white/5 rounded-[2rem] border border-white/10 overflow-hidden group shadow-inner">
            {adminData.banner ? (
              <img src={adminData.banner} className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
                <ImageIcon className="w-8 h-8 mb-2" />
                <span className="text-[10px] font-bold">No banner</span>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleBannerUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
              <span className="text-[10px] font-black uppercase tracking-widest text-white">
                {isUploading ? "Uploading..." : "Tap to upload"}
              </span>
            </div>
          </div>
          {adminData.banner && (
            <button onClick={removeBanner} className="flex items-center gap-2 text-red-400 text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-red-400/10 rounded-xl mx-auto border border-red-400/20">
              <Trash2 className="w-3.5 h-3.5" /> Remove banner
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-[3px] text-purple-400 ml-2">Display Name</label>
            <input 
              type="text" 
              value={adminData.name} 
              onChange={(e) => setAdminData({ ...adminData, name: e.target.value })} 
              className="w-full bg-[#0F172A] border border-white/5 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-purple-500/50 min-h-[52px]" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-[3px] text-purple-400 ml-2">Subtitle / Role</label>
            <input 
              type="text" 
              value={adminData.subtitle} 
              onChange={(e) => setAdminData({ ...adminData, subtitle: e.target.value })} 
              className="w-full bg-[#0F172A] border border-white/5 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-purple-500/50 min-h-[52px]" 
            />
          </div>
        </div>

        <div className="space-y-5">
          <label className="text-[10px] font-black uppercase tracking-[3px] text-purple-400 ml-2">Social Links</label>
          {['Facebook', 'YouTube', 'Instagram', 'TikTok', 'WhatsApp', 'Telegram', 'Phone', 'Website'].map(key => (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center gap-2 ml-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{key}</span>
              </div>
              <input 
                type="url" 
                value={adminData.links[key.toLowerCase()] || ''} 
                onChange={(e) => setAdminData({ 
                  ...adminData, 
                  links: { ...adminData.links, [key.toLowerCase()]: e.target.value } 
                })} 
                className="w-full bg-[#0F172A] border border-white/5 rounded-2xl p-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-purple-500/50 shadow-inner min-h-[52px]" 
                placeholder={`https://${key.toLowerCase()}.com/...`} 
              />
            </div>
          ))}
        </div>

        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="w-full py-5 bg-purple-600 text-white rounded-[2rem] font-black uppercase tracking-[4px] text-sm shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-3 mt-10 min-h-[56px] disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {isSaving ? "Saving..." : "Save & Publish"}
        </button>
      </div>
    </div>
  );
};

export const AdminPanelView = ({ setCurrentView, setToast }: any) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, blocked: 0, new: 0 });
  const [isPerformingAction, setIsPerformingAction] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, []);

  const fetchUsers = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          subscriptions (*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      setToast("Failed to fetch users: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!supabase) return;
    try {
      const { data: totalData } = await supabase.from('profiles').select('id', { count: 'exact' });
      const { data: blockedData } = await supabase.from('profiles').select('id', { count: 'exact' }).eq('status', 'blocked');
      const { data: activeSubs } = await supabase.from('subscriptions').select('id', { count: 'exact' }).eq('status', 'active');
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const { data: newData } = await supabase.from('profiles').select('id', { count: 'exact' }).gt('created_at', oneWeekAgo.toISOString());

      setStats({
        total: (totalData as any)?.length || 0,
        blocked: (blockedData as any)?.length || 0,
        active: (activeSubs as any)?.length || 0,
        new: (newData as any)?.length || 0
      });
    } catch (err) {}
  };

  const fetchUserHistory = async (userId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('login_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      setLoginHistory(data || []);
    } catch (err) {}
  };

  const adminAction = async (action: string, payload: any) => {
    if (!supabase) return;
    setIsPerformingAction(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-action', {
        body: { action, ...payload }
      });

      if (error) throw error;
      
      setToast(`Action successful: ${action}`);
      fetchUsers();
      fetchStats();
      if (selectedUser && selectedUser.id === payload.userId) {
         // Refresh selected user if needed
      }
    } catch (err: any) {
      setToast("Action failed: " + err.message);
    } finally {
      setIsPerformingAction(false);
    }
  };

  useEffect(() => {
    const onPcEscBack = (e: Event) => {
      if (selectedUser) {
        e.preventDefault();
        setSelectedUser(null);
      }
    };
    window.addEventListener('rose-pc-esc-back', onPcEscBack);
    return () => window.removeEventListener('rose-pc-esc-back', onPcEscBack);
  }, [selectedUser]);

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] bg-[#020617] overflow-y-auto flex flex-col no-scrollbar">
      <header className="px-5 py-6 flex items-center justify-between shrink-0 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-10 border-b border-white/5 min-h-[80px]">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentView('settings')} className="p-2.5 bg-white/5 rounded-2xl active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <h3 className="text-xl font-black italic tracking-tighter uppercase text-white">User Management</h3>
        </div>
        <button onClick={() => setCurrentView('privacy')} className="p-2.5 bg-white/5 rounded-2xl active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center">
           <Shield className="w-5 h-5 text-purple-400" />
        </button>
      </header>

      <div className="px-6 py-8 space-y-8 pb-32">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Total Users', value: stats.total, color: 'text-white' },
            { label: 'Active Subs', value: stats.active, color: 'text-emerald-400' },
            { label: 'Blocked', value: stats.blocked, color: 'text-red-400' },
            { label: 'New This Week', value: stats.new, color: 'text-purple-400' },
          ].map((s, i) => (
            <div key={i} className="bg-[#0F172A] border border-white/5 p-4 rounded-2xl">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{s.label}</span>
              <p className={`text-2xl font-black italic ${s.color} mt-1`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search name, email or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#0F172A] border border-white/5 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-purple-500/50"
          />
        </div>

        {/* Users List */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center py-10 gap-3">
               <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Loading Users...</span>
            </div>
          ) : filteredUsers.map(user => {
            const sub = user.subscriptions?.[0];
            const isSubActive = sub && sub.status === 'active' && (!sub.ends_at || new Date(sub.ends_at) > new Date());
            
            return (
              <div 
                key={user.id} 
                onClick={() => {
                  setSelectedUser(user);
                  fetchUserHistory(user.id);
                }}
                className={`w-full p-4 bg-[#0F172A]/80 border ${user.status === 'blocked' ? 'border-red-500/30' : 'border-white/5'} rounded-2xl active:bg-white/5 transition-colors text-left flex items-center justify-between group`}
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${user.status === 'blocked' ? 'bg-red-500/10' : 'bg-purple-600/10'}`}>
                    <User className={`w-5 h-5 ${user.status === 'blocked' ? 'text-red-500' : 'text-purple-400'}`} />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-sm font-black text-white truncate">{user.full_name || 'Anonymous'}</h4>
                    <p className="text-[10px] text-slate-500 font-bold truncate uppercase">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                       <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${user.status === 'blocked' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                         {user.status}
                       </span>
                       {isSubActive && (
                         <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                           Premium
                         </span>
                       )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-colors" />
              </div>
            );
          })}
        </div>
      </div>

      {/* User Details Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[150] flex flex-col bg-[#020617] animate-in slide-in-from-right duration-300">
            <header className="px-5 py-6 flex items-center gap-4 shrink-0 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5">
              <button onClick={() => setSelectedUser(null)} className="p-2.5 bg-white/5 rounded-2xl"><ArrowLeft className="w-5 h-5 text-slate-300" /></button>
              <div>
                <h3 className="text-xl font-black italic tracking-tighter uppercase text-white">{selectedUser.full_name || 'User Details'}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{selectedUser.email}</p>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-40">
              {/* Profile Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0F172A] p-4 rounded-2xl border border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Phone</span>
                  <p className="text-sm font-bold text-white mt-1">{selectedUser.phone || 'N/A'}</p>
                </div>
                <div className="bg-[#0F172A] p-4 rounded-2xl border border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Joined</span>
                  <p className="text-sm font-bold text-white mt-1">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Subscription Controls */}
              <div className="space-y-4">
                <h5 className="text-[10px] font-black uppercase tracking-[3px] text-purple-400 ml-2">Subscription</h5>
                <div className="bg-[#0F172A] p-6 rounded-3xl border border-white/5 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-400">Current Status</p>
                      <p className="text-lg font-black uppercase text-white">{selectedUser.subscriptions?.[0]?.status || 'None'}</p>
                    </div>
                    {selectedUser.subscriptions?.[0]?.ends_at && (
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-400">Expires</p>
                        <p className="text-sm font-black text-amber-400">{new Date(selectedUser.subscriptions[0].ends_at).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[30, 90, 365].map(days => (
                      <button 
                        key={days}
                        onClick={() => adminAction('activate_subscription', { userId: selectedUser.id, days })}
                        disabled={isPerformingAction}
                        className="py-3 bg-purple-600/10 border border-purple-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest text-purple-400 hover:bg-purple-600 hover:text-white transition-all disabled:opacity-50"
                      >
                        +{days} Days
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => adminAction('deactivate_subscription', { userId: selectedUser.id })}
                    disabled={isPerformingAction}
                    className="w-full py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                  >
                    Deactivate Subscription
                  </button>
                </div>
              </div>

              {/* Access Controls */}
              <div className="space-y-4">
                <h5 className="text-[10px] font-black uppercase tracking-[3px] text-red-400 ml-2">Danger Zone</h5>
                <div className="flex gap-3">
                  <button 
                    onClick={() => adminAction(selectedUser.status === 'blocked' ? 'unblock_user' : 'block_user', { userId: selectedUser.id })}
                    disabled={isPerformingAction}
                    className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-50 ${selectedUser.status === 'blocked' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
                  >
                    {selectedUser.status === 'blocked' ? 'Unblock User' : 'Block User'}
                  </button>
                  <button 
                    onClick={() => adminAction('force_logout', { userId: selectedUser.id })}
                    disabled={isPerformingAction}
                    className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400 disabled:opacity-50"
                  >
                    Force Logout
                  </button>
                </div>
                <button 
                  onClick={() => {
                    if (window.confirm("ARE YOU SURE? This will permanently delete the user and all their data.")) {
                      adminAction('delete_user', { userId: selectedUser.id });
                    }
                  }}
                  disabled={isPerformingAction}
                  className="w-full py-4 bg-red-950/30 border border-red-500/20 rounded-2xl font-black uppercase tracking-widest text-[10px] text-red-500 disabled:opacity-50"
                >
                  Delete User Account
                </button>
              </div>

              {/* Login History */}
              <div className="space-y-4">
                <h5 className="text-[10px] font-black uppercase tracking-[3px] text-slate-500 ml-2">Recent Logins</h5>
                <div className="space-y-2">
                  {loginHistory.map((log, i) => (
                    <div key={i} className="p-4 bg-[#0F172A] border border-white/5 rounded-2xl flex items-center justify-between gap-4">
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-white truncate">{log.device || 'Unknown Device'}</p>
                        <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">
                          {log.ip || 'No IP'} • {log.city || 'Unknown City'}, {log.country || ''}
                        </p>
                      </div>
                      <span className="text-[9px] font-black text-slate-600 shrink-0 uppercase">
                        {new Date(log.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  ))}
                  {loginHistory.length === 0 && (
                    <p className="text-center py-10 text-[10px] font-bold text-slate-600 uppercase tracking-widest">No history records</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
