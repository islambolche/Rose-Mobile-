import React, { useState, useEffect } from 'react';
import { ChevronRight, ExternalLink, Loader2, Eye, EyeOff, Lock, Shield, Sparkles, Check, XCircle, AlertTriangle, Key, Mic } from 'lucide-react';
import { motion } from 'framer-motion';
import { getGeminiKey, setGeminiKey } from '../lib/geminiKey';
import { directGeminiGenerate, TEXT_MODELS, getSavedWorkingTextModel } from '../lib/ai-service';

const PROVIDERS = [
  {
    id: 'gemini' as const,
    name: 'Gemini (Voice)',
    subtitle: 'Real-time voice & reasoning',
    link: 'https://aistudio.google.com/apikey',
    storageKey: 'gemini_api_key',
    placeholder: 'AIza...',
    hint: 'Sign in with Google, press Create API key, copy it, come back and paste it above.'
  },
  {
    id: 'groq' as const,
    name: 'Groq (Chat)',
    subtitle: 'Ultra-fast chat completions',
    link: 'https://console.groq.com/keys',
    storageKey: 'groq_api_keys',
    placeholder: 'gsk_...',
    hint: 'Sign in, press Create API Key, copy it, come back and paste it above.'
  },
  {
    id: 'elevenlabs' as const,
    name: 'ELEVENLABS (VOICE STUDIO)',
    subtitle: 'Natural voices in many languages',
    link: 'https://join.elevenlabs.io/api/developer-api',
    storageKey: 'elevenlabs_api_key',
    placeholder: 'xi_api_key...',
    hint: 'Sign up, open Developers > API Keys, create a key, copy it, paste it above.'
  }
];

export const ConnectionsView = ({ 
  onBack,
  apiKeys,
  setApiKeys,
  apiStatus
}: { 
  onBack: () => void;
  apiKeys?: any;
  setApiKeys?: any;
  apiStatus?: any;
}) => {
  const [typedKeys, setTypedKeys] = useState<Record<string, string>>({
    gemini: '',
    groq: '',
    elevenlabs: '',
  });

  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  const [elevenStatus, setElevenStatus] = useState<string>('NOT SET');
  const [elevenLastStatusText, setElevenLastStatusText] = useState<string>('Not verified');
  const [elevenKeyLength, setElevenKeyLength] = useState<number>(0);
  const [isTestingGemini, setIsTestingGemini] = useState<boolean>(false);
  const [geminiTestOutput, setGeminiTestOutput] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    try {
      setTypedKeys({ 
        gemini: getGeminiKey(), 
        groq: localStorage.getItem('groq_api_keys') || '', 
        elevenlabs: (localStorage.getItem('elevenlabs_api_key') || '').trim() 
      });
      const eleven = (localStorage.getItem('elevenlabs_api_key') || '').replace(/[\r\n\t\s]+/g, "").trim();
      setElevenKeyLength(eleven.length);
      if (eleven) {
        verifyElevenLabsKey(eleven);
      }
    } catch (e) {
      console.error('Failed to load keys', e);
    }
  }, []);

  const handleTestGeminiKey = async () => {
    const key = String(typedKeys.gemini || getGeminiKey() || '')
      .replace(/[\r\n\t\s"']+/g, '')
      .trim();
    if (key) {
      localStorage.setItem('gemini_api_key', key);
      setGeminiKey(key);
      if (setApiKeys) {
        setApiKeys((prev: any) => ({ ...prev, gemini: key }));
      }
    }

    setIsTestingGemini(true);
    setGeminiTestOutput(null);

    try {
      const data = await directGeminiGenerate({
        model: TEXT_MODELS[0],
        contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
        apiKey: key,
      });

      const reply =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        data?.text ||
        '';
      const modelUsed =
        data?.modelUsed || getSavedWorkingTextModel() || TEXT_MODELS[0];

      setGeminiTestOutput({
        ok: true,
        text: `OK (${modelUsed}): ${String(reply).trim()}`,
      });
    } catch (err: any) {
      const exactBody =
        err?.bodyText ||
        (err?.message ? String(err.message) : String(err));
      setGeminiTestOutput({
        ok: false,
        text: exactBody,
      });
    } finally {
      setIsTestingGemini(false);
    }
  };

  const verifyElevenLabsKey = async (rawKey: string) => {
    const trimmed = rawKey.replace(/[\r\n\t\s]+/g, "").trim();
    setElevenKeyLength(trimmed.length);
    if (!trimmed) {
      setElevenStatus('NOT SET');
      setElevenLastStatusText('No key provided');
      return;
    }
    setElevenStatus('CHECKING...');
    setElevenLastStatusText('Checking API...');

    try {
      let res = await fetch('https://api.elevenlabs.io/v1/models', {
        headers: { 'xi-api-key': trimmed }
      });
      let status = res.status;
      let text = await res.text().catch(() => '');

      if (status === 401) {
        // Try /v1/user
        res = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': trimmed }
        });
        status = res.status;
        text = await res.text().catch(() => '');
      }

      setElevenLastStatusText(`HTTP ${status} | Key length: ${trimmed.length}`);

      if (status === 200) {
        setElevenStatus('READY');
        // Fetch voices in background
        try {
          const voicesRes = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: { 'xi-api-key': trimmed }
          });
          if (voicesRes.status === 200) {
            const data = await voicesRes.json();
            if (data?.voices) {
              localStorage.setItem('rose_elevenlabs_voices', JSON.stringify(data.voices));
            }
          }
        } catch (e) {}
      } else if (status === 401) {
        setElevenStatus('INVALID');
      } else if (status === 403 || text.includes('missing_permissions')) {
        setElevenStatus('key সঠিক, কিন্তু অনুমতি কম। Text to Speech চালু করুন');
      } else {
        setElevenStatus('INVALID');
      }
    } catch (err) {
      // Network error -> keep previous status and show "ইন্টারনেট সমস্যা"
      setElevenLastStatusText(`ইন্টারনেট সমস্যা | Key length: ${trimmed.length}`);
      setElevenStatus(prev => prev === 'NOT SET' ? 'NOT SET' : prev);
    }
  };

  const handleSave = async (id: 'gemini' | 'groq' | 'elevenlabs') => {
    const key = typedKeys[id].replace(/[\r\n\t\s]+/g, "").trim();
    try {
      localStorage.setItem(PROVIDERS.find(p => p.id === id)?.storageKey || '', key);
      if (id === 'gemini') {
        setGeminiKey(key);
        if (setApiKeys) {
          setApiKeys((prev: any) => ({ ...prev, gemini: key }));
        }
      }
      if (id === 'elevenlabs') {
        await verifyElevenLabsKey(key);
      }
      setSavedStatus(prev => ({ ...prev, [id]: true }));
      setTimeout(() => setSavedStatus(prev => ({ ...prev, [id]: false })), 2000);
    } catch (e) {
      console.error('Failed to save key', e);
    }
  };

  const handlePaste = async (id: 'gemini' | 'groq' | 'elevenlabs') => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const trimmed = text.replace(/[\r\n\t\s]+/g, "").trim();
          setTypedKeys(prev => ({ ...prev, [id]: trimmed }));
          localStorage.setItem(PROVIDERS.find(p => p.id === id)?.storageKey || '', trimmed);
          if (id === 'gemini') {
            setGeminiKey(trimmed);
            if (setApiKeys) {
              setApiKeys((prev: any) => ({ ...prev, gemini: trimmed }));
            }
          }
          if (id === 'elevenlabs') {
            await verifyElevenLabsKey(trimmed);
          }
          return;
        }
      }
      throw new Error("Clipboard unavailable");
    } catch (e) {
      const inputEl = document.getElementById(`key-input-${id}`) as HTMLInputElement;
      if (inputEl) {
        inputEl.focus();
        inputEl.select();
      }
    }
  };

  const getStatusBadge = (id: string) => {
    if (id === 'elevenlabs') {
      if (elevenStatus === 'READY') {
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
            <Check className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Ready</span>
          </div>
        );
      } else if (elevenStatus === 'CHECKING...') {
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full">
            <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Checking...</span>
          </div>
        );
      } else if (elevenStatus === 'INVALID' || elevenStatus === 'Key সঠিক নয়, নতুন key বসান') {
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full">
            <XCircle className="w-3 h-3 text-red-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Key সঠিক নয়, নতুন key বসান</span>
          </div>
        );
      } else if (elevenStatus.includes('অনুমতি')) {
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full max-w-xs">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="text-[9px] font-bold text-amber-300 truncate">{elevenStatus}</span>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Optional</span>
        </div>
      );
    }

    const val = typedKeys[id];
    const key = (typeof val === 'string' ? val : '').trim();
    if (key) {
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
            <Check className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Ready</span>
          </div>
        );
    }
    return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Add a key</span>
        </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed inset-0 z-[130] bg-[#020617] flex flex-col font-sans"
    >
      <header className="px-5 py-4 bg-[#0A1628]/95 border-b border-purple-500/20 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-purple-400 active:scale-90 transition-transform">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-white">Connections</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_5px_rgba(147,51,234,0.8)]" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">API Integrations</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5 pb-32">
        {PROVIDERS.map((p) => (
          <div key={p.id} className="bg-[#0A1628]/80 border border-purple-500/20 rounded-[2rem] p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  {p.id === 'gemini' ? <Sparkles className="w-6 h-6" /> : p.id === 'groq' ? <Shield className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">{p.name}</h3>
                  <p className="text-[10px] text-slate-400 font-medium">{p.subtitle}</p>
                </div>
              </div>
              {getStatusBadge(p.id)}
            </div>

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-500/50">
                <Lock className="w-4 h-4" />
              </div>
              <input 
                id={`key-input-${p.id}`}
                type={showKey[p.id] ? "text" : "password"}
                value={typedKeys[p.id] || ''}
                onChange={async (e) => {
                  const val = e.target.value;
                  const cleaned = val.replace(/[\r\n\t\s]+/g, "").trim();
                  setTypedKeys(prev => ({ ...prev, [p.id]: val }));
                  localStorage.setItem(p.storageKey, cleaned);
                  if (p.id === 'gemini') {
                    setGeminiKey(cleaned);
                    if (setApiKeys) {
                      setApiKeys((prev: any) => ({ ...prev, gemini: cleaned }));
                    }
                  }
                  if (p.id === 'elevenlabs') {
                    await verifyElevenLabsKey(cleaned);
                  }
                }}
                onBlur={async () => {
                  const cleaned = (typedKeys[p.id] || "").replace(/[\r\n\t\s]+/g, "").trim();
                  if (p.id === 'gemini') {
                    setGeminiKey(cleaned);
                    if (setApiKeys) {
                      setApiKeys((prev: any) => ({ ...prev, gemini: cleaned }));
                    }
                  }
                  if (p.id === 'elevenlabs') {
                    await verifyElevenLabsKey(cleaned);
                  }
                }}
                placeholder={p.placeholder}
                className="w-full bg-black/40 border border-white/5 rounded-2xl pl-11 pr-24 py-4 text-xs text-white outline-none focus:border-purple-500/50 font-mono transition-all"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button 
                  onClick={() => handlePaste(p.id)}
                  className="px-2 py-1 text-[9px] font-bold uppercase text-purple-400 bg-purple-500/10 rounded-lg hover:bg-purple-500/20"
                >
                  Paste
                </button>
                <button 
                    onClick={() => setShowKey({ ...showKey, [p.id]: !showKey[p.id] })}
                    className="p-2 text-slate-500"
                >
                    {showKey[p.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {p.id === 'elevenlabs' && (
              <p className="text-[10px] text-slate-400 font-mono px-1">
                Status: {elevenLastStatusText} | Key length: {elevenKeyLength}
              </p>
            )}

            <button 
                onClick={() => window.open(p.link, "_blank", "noopener,noreferrer")}
                className="w-full h-[52px] bg-[#161f33] rounded-full border border-purple-500/30 text-purple-400 font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
                Get Key <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <p className="text-[11px] text-slate-500 px-1">{p.hint}</p>

            <button 
                onClick={() => handleSave(p.id)}
                className="w-full h-[52px] bg-purple-600 rounded-full text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-purple-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
                {savedStatus[p.id] ? 'Saved' : `Save ${p.id === 'gemini' ? 'Gemini' : p.id === 'groq' ? 'Groq' : 'ElevenLabs'} Key`}
            </button>

            {p.id === 'gemini' && (
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={handleTestGeminiKey}
                  disabled={isTestingGemini}
                  className="w-full h-[46px] bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-400/40 rounded-full text-[11px] font-black uppercase tracking-widest text-indigo-300 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isTestingGemini ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'TEST'
                  )}
                </button>

                {geminiTestOutput && (
                  <div
                    className={
                      'w-full rounded-2xl px-4 py-3 text-xs font-mono break-words border ' +
                      (geminiTestOutput.ok
                        ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/80 border-rose-500/40 text-rose-300')
                    }
                  >
                    {geminiTestOutput.text}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
};
