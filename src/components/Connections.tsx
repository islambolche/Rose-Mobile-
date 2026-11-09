import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  Shield,
  Sparkles,
  Check,
  XCircle,
  Mic,
  ClipboardPaste,
  Save,
  Globe,
  Cpu,
  Flame,
  Bot,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getGeminiKey, setGeminiKey, initGeminiKey } from '../lib/geminiKey';
import { storage } from '../lib/storage';
import { openInExternalBrowser } from '../lib/phoneActions';
import { PhoneControl } from '../lib/phoneControl';
import {
  ChatEngineId,
  KeyStatus,
  FREE_CHAT_PROVIDERS,
  getSelectedChatEngine,
  setSelectedChatEngine,
  getProviderKey,
  setProviderKey,
  getProviderStatus,
  setProviderStatus,
  verifyProviderKey,
  readLocalKey,
  writeLocalKey,
} from '../lib/chatEngines';

type AllProviderId = ChatEngineId | 'elevenlabs';

interface ProviderItem {
  id: AllProviderId;
  tier: 'free' | 'paid';
  displayName: string;
  badgeLabel?: string;
  link: string;
  storageKey: string;
  statusStorageKey: string;
  placeholder: string;
  icon: any;
}

const ALL_PROVIDERS: ProviderItem[] = [
  {
    id: 'gemini',
    tier: 'free',
    displayName: 'Gemini',
    badgeLabel: 'চ্যাট ও ভয়েস',
    link: 'https://aistudio.google.com/app/apikey',
    storageKey: 'gemini_api_key',
    statusStorageKey: 'connection_status_gemini',
    placeholder: 'AIza...',
    icon: Sparkles,
  },
  {
    id: 'groq',
    tier: 'free',
    displayName: 'Groq',
    badgeLabel: 'চ্যাট',
    link: 'https://console.groq.com/keys',
    storageKey: 'groq_api_keys',
    statusStorageKey: 'connection_status_groq',
    placeholder: 'gsk_...',
    icon: Shield,
  },
  {
    id: 'openrouter',
    tier: 'free',
    displayName: 'OpenRouter',
    badgeLabel: 'চ্যাট',
    link: 'https://openrouter.ai/keys',
    storageKey: 'openrouter_api_key',
    statusStorageKey: 'connection_status_openrouter',
    placeholder: 'sk-or-v1-...',
    icon: Globe,
  },
  {
    id: 'cerebras',
    tier: 'free',
    displayName: 'Cerebras',
    badgeLabel: 'চ্যাট',
    link: 'https://cloud.cerebras.ai',
    storageKey: 'cerebras_api_key',
    statusStorageKey: 'connection_status_cerebras',
    placeholder: 'csk-...',
    icon: Cpu,
  },
  {
    id: 'mistral',
    tier: 'free',
    displayName: 'Mistral',
    badgeLabel: 'চ্যাট',
    link: 'https://console.mistral.ai',
    storageKey: 'mistral_api_key',
    statusStorageKey: 'connection_status_mistral',
    placeholder: '...',
    icon: Flame,
  },
  {
    id: 'elevenlabs',
    tier: 'paid',
    displayName: 'ElevenLabs',
    badgeLabel: 'ভয়েস স্টুডিও',
    link: 'https://join.elevenlabs.io/api/developer-api',
    storageKey: 'elevenlabs_api_key',
    statusStorageKey: 'connection_status_elevenlabs',
    placeholder: 'xi_api_key...',
    icon: Mic,
  },
];

export const ConnectionsView = ({
  onBack,
  apiKeys,
  setApiKeys,
  apiStatus,
  setToast,
}: {
  onBack: () => void;
  apiKeys?: any;
  setApiKeys?: any;
  apiStatus?: any;
  setToast?: (msg: string | null) => void;
}) => {
  const [subPage, setSubPage] = useState<'free' | 'paid' | null>(null);
  const [selectedEngine, setLocalSelectedEngine] = useState<ChatEngineId>(() => getSelectedChatEngine());
  const [selectedProviderId, setSelectedProviderId] = useState<AllProviderId>(() => getSelectedChatEngine() || 'gemini');

  const [typedKeys, setTypedKeys] = useState<Record<AllProviderId, string>>(() => {
    return {
      gemini: getGeminiKey() || readLocalKey('gemini_api_key') || (apiKeys?.gemini || '').trim(),
      groq: readLocalKey('groq_api_keys') || (apiKeys?.groq || '').trim(),
      openrouter: readLocalKey('openrouter_api_key'),
      cerebras: readLocalKey('cerebras_api_key'),
      mistral: readLocalKey('mistral_api_key'),
      elevenlabs: readLocalKey('elevenlabs_api_key'),
    };
  });

  const [statusMap, setStatusMap] = useState<Record<AllProviderId, KeyStatus>>(() => {
    const resolveStatus = (id: AllProviderId, keyVal: string, statusKey: string): KeyStatus => {
      if (!keyVal.trim()) return 'NOT SET';
      const saved = readLocalKey(statusKey);
      if (saved === 'READY' || saved === 'INVALID') return saved;
      return 'READY';
    };
    return {
      gemini: resolveStatus('gemini', getGeminiKey() || readLocalKey('gemini_api_key'), 'connection_status_gemini'),
      groq: resolveStatus('groq', readLocalKey('groq_api_keys'), 'connection_status_groq'),
      openrouter: resolveStatus('openrouter', readLocalKey('openrouter_api_key'), 'connection_status_openrouter'),
      cerebras: resolveStatus('cerebras', readLocalKey('cerebras_api_key'), 'connection_status_cerebras'),
      mistral: resolveStatus('mistral', readLocalKey('mistral_api_key'), 'connection_status_mistral'),
      elevenlabs: resolveStatus('elevenlabs', readLocalKey('elevenlabs_api_key'), 'connection_status_elevenlabs'),
    };
  });

  const [errorDetails, setErrorDetails] = useState<Record<AllProviderId, string>>({
    gemini: '',
    groq: '',
    openrouter: '',
    cerebras: '',
    mistral: '',
    elevenlabs: '',
  });

  const [verifyingMap, setVerifyingMap] = useState<Record<AllProviderId, boolean>>({
    gemini: false,
    groq: false,
    openrouter: false,
    cerebras: false,
    mistral: false,
    elevenlabs: false,
  });

  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [localToast, setLocalToast] = useState<string | null>(null);

  const notifyToast = (msg: string) => {
    if (setToast) {
      setToast(msg);
    }
    setLocalToast(msg);
    setTimeout(() => {
      setLocalToast((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      try {
        const g = (await initGeminiKey()) || readLocalKey('gemini_api_key');
        const gr = ((await storage.get('groq_api_keys')) || readLocalKey('groq_api_keys')).trim();
        const or = ((await storage.get('openrouter_api_key')) || readLocalKey('openrouter_api_key')).trim();
        const cr = ((await storage.get('cerebras_api_key')) || readLocalKey('cerebras_api_key')).trim();
        const ms = ((await storage.get('mistral_api_key')) || readLocalKey('mistral_api_key')).trim();
        const el = ((await storage.get('elevenlabs_api_key')) || readLocalKey('elevenlabs_api_key')).trim();

        if (!mounted) return;

        setTypedKeys({
          gemini: g,
          groq: gr,
          openrouter: or,
          cerebras: cr,
          mistral: ms,
          elevenlabs: el,
        });

        const gStat = (await storage.get('connection_status_gemini')) || readLocalKey('connection_status_gemini');
        const grStat = (await storage.get('connection_status_groq')) || readLocalKey('connection_status_groq');
        const orStat = (await storage.get('connection_status_openrouter')) || readLocalKey('connection_status_openrouter');
        const crStat = (await storage.get('connection_status_cerebras')) || readLocalKey('connection_status_cerebras');
        const msStat = (await storage.get('connection_status_mistral')) || readLocalKey('connection_status_mistral');
        const elStat = (await storage.get('connection_status_elevenlabs')) || readLocalKey('connection_status_elevenlabs');

        const mapVal = (k: string, s: string): KeyStatus => {
          if (!k) return 'NOT SET';
          if (s === 'READY' || s === 'INVALID') return s;
          return 'READY';
        };

        setStatusMap({
          gemini: mapVal(g, gStat),
          groq: mapVal(gr, grStat),
          openrouter: mapVal(or, orStat),
          cerebras: mapVal(cr, crStat),
          mistral: mapVal(ms, msStat),
          elevenlabs: mapVal(el, elStat),
        });

        const activeEngine = getSelectedChatEngine();
        setLocalSelectedEngine(activeEngine);
        setSelectedProviderId(activeEngine);
      } catch {}
    };
    loadAll();
    return () => {
      mounted = false;
    };
  }, []);

  const handlePaste = async (id: AllProviderId) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const text = await navigator.clipboard.readText();
        if (typeof text === 'string' && text.trim()) {
          const trimmed = text.trim();
          setTypedKeys((prev) => ({ ...prev, [id]: trimmed }));
          notifyToast('ক্লিপবোর্ড থেকে পেস্ট করা হয়েছে');
          return;
        }
      }
      throw new Error('Clipboard permission denied or empty');
    } catch {
      const inputEl = document.getElementById(`key-input-${id}`) as HTMLInputElement | null;
      if (inputEl) {
        inputEl.focus();
      }
      notifyToast('হাতে পেস্ট করুন');
    }
  };

  const handleGetKey = async (url: string) => {
    // Try native intent via PhoneControl first
    const result = await PhoneControl.openUrl({ url });
    if (result && result.opened) {
      return;
    }
    // Fallback
    openInExternalBrowser(url);
  };

  const verifyElevenLabs = async (rawKey: string): Promise<{ ok: boolean; status: KeyStatus; errorText?: string }> => {
    // Requirement 2: Clean invisible characters
    const cleanKey = String(rawKey || '').replace(/[\r\n\t\s\u200B\u200C\u200D\uFEFF]+/g, '').trim();
    if (!cleanKey) {
      writeLocalKey('connection_status_elevenlabs', 'NOT SET');
      return { ok: false, status: 'NOT SET', errorText: 'Key দেওয়া হয়নি' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: { 'xi-api-key': cleanKey },
        signal: controller.signal,
      });
      if (res.ok) {
        writeLocalKey('connection_status_elevenlabs', 'READY');
        return { ok: true, status: 'READY' };
      }
      
      const raw = await res.text().catch(() => '');
      let errJson: any = null;
      try { errJson = JSON.parse(raw); } catch {}
      const msg = errJson?.error?.message || errJson?.message || errJson?.detail || '';
      const status = res.status;

      if (status === 401 || status === 403) {
        writeLocalKey('connection_status_elevenlabs', 'INVALID');
        return { ok: false, status: 'INVALID', errorText: `ভুল API Key (${status}): ${msg.slice(0, 50)}` };
      }
      if (status === 429) {
        writeLocalKey('connection_status_elevenlabs', 'READY');
        return { ok: true, status: 'READY', errorText: 'সীমা শেষ (429), পরে চেষ্টা করুন' };
      }

      const current = getProviderStatus('elevenlabs' as any);
      return { ok: false, status: current, errorText: `ত্রুটি (${status}): ${msg.slice(0, 50)}` };
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      const text = isAbort ? 'সময় শেষ (Timeout)' : 'যাচাই করা যায়নি, ইন্টারনেট দেখুন';
      const current = getProviderStatus('elevenlabs' as any);
      return { ok: false, status: current, errorText: text };
    } finally {
      clearTimeout(timer);
    }
  };

  const handleSave = async (id: AllProviderId) => {
    const provider = ALL_PROVIDERS.find((p) => p.id === id);
    if (!provider) return;

    // Requirement 2: Clean invisible characters
    const cleanKey = String(typedKeys[id] || '').replace(/[\r\n\t\s\u200B\u200C\u200D\uFEFF]+/g, '').trim();
    setTypedKeys((prev) => ({ ...prev, [id]: cleanKey }));

    if (!cleanKey) {
      setStatusMap((prev) => ({ ...prev, [id]: 'NOT SET' }));
      writeLocalKey(provider.statusStorageKey, 'NOT SET');
      notifyToast('আগে API Key বসান');
      return;
    }

    setVerifyingMap((prev) => ({ ...prev, [id]: true }));
    setErrorDetails((prev) => ({ ...prev, [id]: '' }));

    try {
      if (id === 'gemini') {
        await setGeminiKey(cleanKey);
        writeLocalKey('gemini_api_key', cleanKey);
        try {
          const existing = JSON.parse(readLocalKey('iyabd_api_keys') || '{}');
          existing.gemini = cleanKey;
          writeLocalKey('iyabd_api_keys', JSON.stringify(existing));
        } catch {}
        if (setApiKeys) {
          setApiKeys((prev: any) => ({ ...prev, gemini: cleanKey }));
        }
      } else if (id === 'groq') {
        await storage.set('groq_api_keys', cleanKey);
        writeLocalKey('groq_api_keys', cleanKey);
        try {
          const existing = JSON.parse(readLocalKey('iyabd_api_keys') || '{}');
          existing.groq = cleanKey;
          writeLocalKey('iyabd_api_keys', JSON.stringify(existing));
        } catch {}
        if (setApiKeys) {
          setApiKeys((prev: any) => ({ ...prev, groq: cleanKey }));
        }
      } else if (id === 'elevenlabs') {
        await storage.set('elevenlabs_api_key', cleanKey);
        writeLocalKey('elevenlabs_api_key', cleanKey);
      } else {
        await setProviderKey(id as ChatEngineId, cleanKey);
      }

      let checkResult: { ok: boolean; status: KeyStatus; errorText?: string };
      if (id === 'elevenlabs') {
        checkResult = await verifyElevenLabs(cleanKey);
      } else {
        checkResult = await verifyProviderKey(id as ChatEngineId, cleanKey);
      }

      setStatusMap((prev) => ({ ...prev, [id]: checkResult.status }));
      if (checkResult.ok && checkResult.status === 'READY') {
        const warning = checkResult.errorText;
        setErrorDetails((prev) => ({ ...prev, [id]: warning || '' }));
        if (warning) {
          notifyToast(`${provider.displayName} Key সেভ হয়েছে কিন্তু: ${warning}`);
        } else {
          notifyToast(`${provider.displayName} Key যাচাই সম্পন্ন: CONNECTED`);
        }
      } else {
        const reason = checkResult.errorText || 'যাচাই ব্যর্থ';
        setErrorDetails((prev) => ({ ...prev, [id]: reason }));
        notifyToast(`${provider.displayName} Key সঠিক নয়: ${reason}`);
      }
    } catch (err: any) {
      setStatusMap((prev) => ({ ...prev, [id]: 'INVALID' }));
      const reason = err?.message || 'যাচাই ব্যর্থ';
      setErrorDetails((prev) => ({ ...prev, [id]: reason }));
      notifyToast(`${provider.displayName} Key যাচাই ব্যর্থ: INVALID`);
    } finally {
      setVerifyingMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleSelectEngine = (engineId: ChatEngineId) => {
    const stat = statusMap[engineId];
    const key = typedKeys[engineId];
    if (!key || stat !== 'READY') {
      notifyToast(`আগে Connections-এ ${engineId.toUpperCase()}-এর Key যোগ করে SAVE করুন`);
      return;
    }
    setSelectedChatEngine(engineId);
    setLocalSelectedEngine(engineId);
    const config = ALL_PROVIDERS.find((p) => p.id === engineId);
    notifyToast(`চ্যাট ইঞ্জিন বদলে ${config?.displayName || engineId} হয়েছে`);
    setSubPage(null);
  };

  const renderStatusBadge = (id: AllProviderId) => {
    const isChecking = verifyingMap[id];
    const currentStatus = statusMap[id] || 'NOT SET';

    if (isChecking) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/15 border border-purple-400/40 rounded-full shrink-0">
          <Loader2 className="w-3 h-3 text-purple-300 animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">
            ...
          </span>
        </div>
      );
    }

    if (currentStatus === 'READY') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/15 border border-emerald-500/40 rounded-full shrink-0">
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
            CONNECTED
          </span>
        </div>
      );
    }

    if (currentStatus === 'INVALID') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/15 border border-red-500/40 rounded-full shrink-0">
          <XCircle className="w-3 h-3 text-red-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-red-400">
            INVALID
          </span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 border border-slate-600/40 rounded-full shrink-0">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          NOT SET
        </span>
      </div>
    );
  };

  // Full-page FREE Services Selection View (Requirement 2)
  if (subPage === 'free') {
    const freeList = ALL_PROVIDERS.filter((p) => p.tier === 'free');
    return (
      <motion.div
        key="connections-free-page"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="fixed inset-0 z-[90] bg-[#020617] text-white flex flex-col overflow-hidden font-sans"
      >
        <header className="px-5 py-4 flex items-center gap-4 border-b border-purple-500/15 bg-[#020617]/95 backdrop-blur-md shrink-0">
          <button
            type="button"
            onClick={() => setSubPage(null)}
            className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-white active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">
            FREE
          </h2>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pt-4 pb-32 space-y-3.5">
          {freeList.map((p) => {
            const isSelected = selectedProviderId === p.id;
            const IconComp = p.icon;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedProviderId(p.id);
                  setSelectedChatEngine(p.id as ChatEngineId);
                  setLocalSelectedEngine(p.id as ChatEngineId);
                  notifyToast(`${p.displayName} বাছা হয়েছে`);
                  setSubPage(null);
                }}
                className={
                  'w-full p-4 sm:p-5 rounded-[2rem] border shadow-xl flex items-center justify-between gap-4 active:scale-[0.98] transition-all text-left ' +
                  (isSelected
                    ? 'bg-purple-600/20 border-purple-400 shadow-purple-950/60'
                    : 'bg-[#0F172A]/80 border-purple-500/30 hover:border-purple-400/50')
                }
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={
                      'w-12 h-12 rounded-full border flex items-center justify-center shrink-0 shadow-lg ' +
                      (isSelected
                        ? 'bg-purple-600 border-purple-300 text-white shadow-purple-900/60'
                        : 'bg-purple-900/40 border-purple-500/30 text-purple-300')
                    }
                  >
                    <IconComp className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-lg tracking-wider text-white truncate">
                    {p.displayName}
                  </h4>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {renderStatusBadge(p.id)}
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-purple-600 border border-purple-300 flex items-center justify-center text-white shrink-0 shadow-md">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {!setToast && localToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] bg-[#0F172A]/95 border border-purple-500/40 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md">
            {localToast}
          </div>
        )}
      </motion.div>
    );
  }

  // Full-page PAID Services Selection View (Requirement 2)
  if (subPage === 'paid') {
    const paidList = ALL_PROVIDERS.filter((p) => p.tier === 'paid');
    return (
      <motion.div
        key="connections-paid-page"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="fixed inset-0 z-[90] bg-[#020617] text-white flex flex-col overflow-hidden font-sans"
      >
        <header className="px-5 py-4 flex items-center gap-4 border-b border-purple-500/15 bg-[#020617]/95 backdrop-blur-md shrink-0">
          <button
            type="button"
            onClick={() => setSubPage(null)}
            className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-white active:scale-95 transition-transform"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">
            PAID
          </h2>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pt-4 pb-32 space-y-3.5">
          {paidList.map((p) => {
            const isSelected = selectedProviderId === p.id;
            const IconComp = p.icon;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedProviderId(p.id);
                  notifyToast(`${p.displayName} বাছা হয়েছে`);
                  setSubPage(null);
                }}
                className={
                  'w-full p-4 sm:p-5 rounded-[2rem] border shadow-xl flex items-center justify-between gap-4 active:scale-[0.98] transition-all text-left ' +
                  (isSelected
                    ? 'bg-purple-600/20 border-purple-400 shadow-purple-950/60'
                    : 'bg-[#0F172A]/80 border-purple-500/30 hover:border-purple-400/50')
                }
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className={
                      'w-12 h-12 rounded-full border flex items-center justify-center shrink-0 shadow-lg ' +
                      (isSelected
                        ? 'bg-purple-600 border-purple-300 text-white shadow-purple-900/60'
                        : 'bg-purple-900/40 border-purple-500/30 text-purple-300')
                    }
                  >
                    <IconComp className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-lg tracking-wider text-white truncate">
                    {p.displayName}
                  </h4>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {renderStatusBadge(p.id)}
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-purple-600 border border-purple-300 flex items-center justify-center text-white shrink-0 shadow-md">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {!setToast && localToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] bg-[#0F172A]/95 border border-purple-500/40 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md">
            {localToast}
          </div>
        )}
      </motion.div>
    );
  }

  const selectedFreeProvider =
    ALL_PROVIDERS.find((p) => p.id === selectedEngine) || ALL_PROVIDERS[0];
  const isFreeActive = selectedProviderId !== 'elevenlabs';
  const isPaidActive = selectedProviderId === 'elevenlabs';

  const selectedItem =
    ALL_PROVIDERS.find((item) => item.id === selectedProviderId) || ALL_PROVIDERS[0];
  const SelectedIconComp = selectedItem.icon;
  const isSelectedInvalid = statusMap[selectedItem.id] === 'INVALID';
  const selectedErrorMsg = errorDetails[selectedItem.id];

  return (
    <motion.div
      key="connections-page"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-[90] bg-[#020617] text-white flex flex-col overflow-hidden font-sans"
    >
      {/* Top Header: Back (<-) & CONNECTIONS Title */}
      <header className="px-5 py-4 flex items-center gap-4 border-b border-purple-500/15 bg-[#020617]/95 backdrop-blur-md shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-white active:scale-95 transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">
          CONNECTIONS
        </h2>
      </header>

      {/* Scrollable Content (pb-32 so bottom navigation bar remains visible and unobstructed) */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pt-4 pb-32 space-y-4">
        {/* Two equal-width side-by-side buttons: FREE (left) & PAID (right) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSubPage('free')}
            className={
              'w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] border flex items-center justify-between ' +
              (isFreeActive
                ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-900/50'
                : 'bg-[#0F172A]/85 border-purple-500/30 text-slate-300 hover:text-white')
            }
          >
            <span className="truncate">FREE · {selectedFreeProvider.displayName}</span>
            <ChevronRight className="w-4 h-4 shrink-0 ml-1 text-inherit opacity-80" />
          </button>

          <button
            type="button"
            onClick={() => setSubPage('paid')}
            className={
              'w-full py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] border flex items-center justify-between ' +
              (isPaidActive
                ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-900/50'
                : 'bg-[#0F172A]/85 border-purple-500/30 text-slate-300 hover:text-white')
            }
          >
            <span className="truncate">{isPaidActive ? 'PAID · ElevenLabs' : 'PAID'}</span>
            <ChevronRight className="w-4 h-4 shrink-0 ml-1 text-inherit opacity-80" />
          </button>
        </div>

        {/* Single Selected Service Configuration Section (Requirement 3) */}
        <div key={selectedItem.id} className="space-y-3 pt-1">
          {/* Service Name & Status Header (Shown once, no duplicate card) */}
          <div className="w-full p-4 sm:p-5 bg-[#0F172A]/85 rounded-[2rem] border border-purple-500/30 shadow-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-full bg-purple-600 border border-purple-400/30 flex items-center justify-center text-white shrink-0 shadow-md">
                <SelectedIconComp className="w-5 h-5" />
              </div>
              <h3 className="font-black text-lg tracking-wider text-white truncate">
                {selectedItem.displayName}
              </h3>
            </div>
            {renderStatusBadge(selectedItem.id)}
          </div>

          {/* 1. Key Input (masked with eye icon toggle) */}
          <div className="relative w-full">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id={`key-input-${selectedItem.id}`}
              type={showKey[selectedItem.id] ? 'text' : 'password'}
              value={typedKeys[selectedItem.id] || ''}
              onChange={(e) => {
                const val = e.target.value;
                setTypedKeys((prev) => ({ ...prev, [selectedItem.id]: val }));
              }}
              placeholder={selectedItem.placeholder}
              autoComplete="off"
              spellCheck={false}
              className="w-full p-4 pl-11 pr-12 bg-[#0F172A]/90 rounded-2xl border border-purple-500/30 focus:border-purple-400 text-xs sm:text-sm text-white font-mono outline-none shadow-lg transition-colors"
            />
            <button
              type="button"
              onClick={() =>
                setShowKey((prev) => ({ ...prev, [selectedItem.id]: !prev[selectedItem.id] }))
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white active:scale-95 transition-transform"
              aria-label={showKey[selectedItem.id] ? 'Hide key' : 'Show key'}
            >
              {showKey[selectedItem.id] ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* 2. PASTE Button */}
          <button
            type="button"
            onClick={() => handlePaste(selectedItem.id)}
            className="w-full p-4 bg-[#0F172A]/85 hover:bg-[#0F172A] rounded-2xl border border-purple-500/30 shadow-xl flex items-center justify-center gap-2.5 text-xs font-black uppercase tracking-widest text-white active:scale-[0.98] transition-all"
          >
            <ClipboardPaste className="w-4 h-4 text-purple-400" />
            <span>PASTE</span>
          </button>

          {/* 3. GET KEY Button */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleGetKey(selectedItem.link)}
              className="w-full p-4 bg-[#0F172A]/85 hover:bg-[#0F172A] rounded-2xl border border-purple-500/30 shadow-xl flex items-center justify-center gap-2.5 text-xs font-black uppercase tracking-widest text-white active:scale-[0.98] transition-all"
            >
              <ExternalLink className="w-4 h-4 text-purple-400" />
              <span>GET KEY</span>
            </button>
            <div className="p-3 bg-purple-950/30 border border-purple-500/20 rounded-2xl text-[10px] text-purple-200/80 space-y-2">
              <p>যদি লগইন করার পর মূল পেজে না যান:</p>
              <button
                type="button"
                onClick={() => window.open(selectedItem.link, '_blank')}
                className="w-full p-2 bg-purple-600/50 hover:bg-purple-600 rounded-lg text-white font-bold"
              >
                OPEN API KEYS DIRECTLY
              </button>
              <p className="text-[9px] opacity-70">লগইন করার পর এই বাটনটি চাপ দিন এবং API Key কপি করে নিচে পেস্ট করুন।</p>
            </div>
          </div>

          {/* 4. SAVE KEY Button */}
          <button
            type="button"
            onClick={() => handleSave(selectedItem.id)}
            disabled={verifyingMap[selectedItem.id]}
            className="w-full p-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 rounded-2xl border border-purple-400/40 shadow-xl shadow-purple-950/50 flex items-center justify-center gap-2.5 text-xs font-black uppercase tracking-widest text-white active:scale-[0.98] transition-all"
          >
            {verifyingMap[selectedItem.id] ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Save className="w-4 h-4 text-white" />
            )}
            <span>SAVE KEY</span>
          </button>

          {/* Brief error line if present */}
          {selectedErrorMsg && (
            <div className={`p-3 border rounded-2xl text-[11px] font-medium text-center ${
              isSelectedInvalid ? 'bg-red-950/70 border-red-500/40 text-red-300' : 'bg-amber-950/70 border-amber-500/40 text-amber-300'
            }`}>
              {selectedErrorMsg}
            </div>
          )}
        </div>
      </div>

      {/* Fallback Toast if parent setToast is not provided */}
      {!setToast && localToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] bg-[#0F172A]/95 border border-purple-500/40 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md">
          {localToast}
        </div>
      )}
    </motion.div>
  );
};
