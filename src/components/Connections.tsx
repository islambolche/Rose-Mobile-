import React, { useState, useEffect } from 'react';
import { ApiKeyCard } from './ApiKeyCard';
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
import { getGeminiKey, setGeminiKey, initGeminiKey, fetchServerGeminiStatus, isServerGeminiConfigured } from '../lib/geminiKey';
import { storage } from '../lib/storage';
import { openExternal } from '../lib/openExternal';
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
      if (!keyVal || !keyVal.trim()) {
        if (id === 'gemini' && isServerGeminiConfigured()) return 'READY';
        return 'NOT SET';
      }
      const saved = readLocalKey(statusKey);
      if (saved === 'READY' || saved === 'CONNECTED') return 'READY';
      if (saved === 'LIMIT REACHED') return 'LIMIT REACHED';
      if (saved === 'INVALID') return 'INVALID';
      if (saved === 'SAVED – NOT TESTED') return 'SAVED – NOT TESTED';
      return 'SAVED – NOT TESTED';
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

  const [testResults, setTestResults] = useState<Record<AllProviderId, string>>({
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

  const handleTestKey = async (id: AllProviderId) => {
    await handleSave(id);
  };

  const notifyToast = (msg: string) => {
    if (setToast) {
      setToast(msg);
    }
    setLocalToast(msg);
    setTimeout(() => {
      setLocalToast((prev) => (prev === msg ? null : prev));
    }, 4500);
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

        const serverGeminiReady = await fetchServerGeminiStatus();
        if (!mounted) return;

        const mapVal = (k: string, s: string, allowServer = false): KeyStatus => {
          if (!k || !k.trim()) return allowServer ? 'READY' : 'NOT SET';
          if (s === 'READY' || s === 'CONNECTED') return 'READY';
          if (s === 'LIMIT REACHED') return 'LIMIT REACHED';
          if (s === 'INVALID') return 'INVALID';
          if (s === 'SAVED – NOT TESTED') return 'SAVED – NOT TESTED';
          return 'SAVED – NOT TESTED';
        };

        setStatusMap({
          gemini: mapVal(g, gStat, serverGeminiReady),
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
      notifyToast('লম্বা চেপে Paste করো');
    }
  };

  const handleGetKey = (url: string) => {
    openExternal(url);
  };

  const verifyElevenLabs = async (
    rawKey: string
  ): Promise<{ ok: boolean; status: KeyStatus; httpStatus?: number; errorText?: string }> => {
    const cleanKey = String(rawKey || '')
      .replace(/^Bearer\s+/i, '')
      .replace(/[\r\n\t\s"'`\u200B\u200C\u200D\uFEFF]+/g, '')
      .trim();
    if (!cleanKey) {
      writeLocalKey('connection_status_elevenlabs', 'NOT SET');
      try { await storage.set('connection_status_elevenlabs', 'NOT SET'); } catch {}
      return { ok: false, status: 'NOT SET', errorText: 'Key দেওয়া হয়নি' };
    }

    const sanitizeReason = (rawMsg: string): string => {
      let text = String(rawMsg || '');
      if (cleanKey) text = text.split(cleanKey).join('[REDACTED]');
      return text.replace(/\s+/g, ' ').trim().slice(0, 120);
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: { 'xi-api-key': cleanKey },
        signal: controller.signal,
      });

      const raw = await res.text().catch(() => '');
      let errJson: any = null;
      try { errJson = raw ? JSON.parse(raw) : null; } catch {}
      const extractedMsg =
        errJson?.detail?.message ||
        (typeof errJson?.detail === 'string' ? errJson.detail : '') ||
        errJson?.error?.message ||
        errJson?.message ||
        raw ||
        res.statusText ||
        '';
      const shortReason = sanitizeReason(extractedMsg);

      if (res.ok) {
        writeLocalKey('connection_status_elevenlabs', 'READY');
        try { await storage.set('connection_status_elevenlabs', 'READY'); } catch {}
        return { ok: true, status: 'READY', httpStatus: res.status, errorText: `HTTP ${res.status} OK` };
      }

      if (res.status === 429) {
        writeLocalKey('connection_status_elevenlabs', 'LIMIT REACHED');
        try { await storage.set('connection_status_elevenlabs', 'LIMIT REACHED'); } catch {}
        return {
          ok: false,
          status: 'LIMIT REACHED',
          httpStatus: 429,
          errorText: `HTTP 429${shortReason ? ': ' + shortReason : ' (Rate limit reached)'}`,
        };
      }

      if (res.status === 400 || res.status === 401 || res.status === 403) {
        writeLocalKey('connection_status_elevenlabs', 'INVALID');
        try { await storage.set('connection_status_elevenlabs', 'INVALID'); } catch {}
        return {
          ok: false,
          status: 'INVALID',
          httpStatus: res.status,
          errorText: `HTTP ${res.status}${shortReason ? ': ' + shortReason : ' (Invalid key)'}`,
        };
      }

      writeLocalKey('connection_status_elevenlabs', 'SAVED – NOT TESTED');
      try { await storage.set('connection_status_elevenlabs', 'SAVED – NOT TESTED'); } catch {}
      return {
        ok: false,
        status: 'SAVED – NOT TESTED',
        httpStatus: res.status,
        errorText: `HTTP ${res.status}${shortReason ? ': ' + shortReason : ''}`,
      };
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      const rawNet = isAbort ? 'Timeout (12s)' : err?.message || String(err || 'Network error');
      const shortNet = sanitizeReason(rawNet);
      writeLocalKey('connection_status_elevenlabs', 'SAVED – NOT TESTED');
      try { await storage.set('connection_status_elevenlabs', 'SAVED – NOT TESTED'); } catch {}
      return {
        ok: false,
        status: 'SAVED – NOT TESTED',
        errorText: `Network error: ${shortNet}`,
      };
    } finally {
      clearTimeout(timer);
    }
  };

  const handleSave = async (id: AllProviderId, passedKey?: string) => {
    const provider = ALL_PROVIDERS.find((p) => p.id === id);
    if (!provider) return;

    const rawVal = passedKey !== undefined ? passedKey : typedKeys[id];
    const cleanKey = String(rawVal || '')
      .replace(/^Bearer\s+/i, '')
      .replace(/[\r\n\t\s"'`\u200B\u200C\u200D\uFEFF]+/g, '')
      .trim();
    setTypedKeys((prev) => ({ ...prev, [id]: cleanKey }));

    if (!cleanKey) {
      setStatusMap((prev) => ({ ...prev, [id]: 'NOT SET' }));
      writeLocalKey(provider.statusStorageKey, 'NOT SET');
      try { await storage.set(provider.statusStorageKey, 'NOT SET'); } catch {}
      notifyToast('আগে API Key বসান');
      return;
    }

    // 1) ALWAYS store the key first (same storage the app reads keys from), even if the test fails
    try {
      writeLocalKey(provider.storageKey, cleanKey);
      await storage.set(provider.storageKey, cleanKey);

      if (id === 'gemini') {
        await setGeminiKey(cleanKey);
        try {
          const existing = JSON.parse(readLocalKey('iyabd_api_keys') || '{}');
          existing.gemini = cleanKey;
          writeLocalKey('iyabd_api_keys', JSON.stringify(existing));
        } catch {}
        if (setApiKeys) {
          setApiKeys((prev: any) => ({ ...prev, gemini: cleanKey }));
        }
      } else if (id === 'groq') {
        try {
          const existing = JSON.parse(readLocalKey('iyabd_api_keys') || '{}');
          existing.groq = cleanKey;
          writeLocalKey('iyabd_api_keys', JSON.stringify(existing));
        } catch {}
        if (setApiKeys) {
          setApiKeys((prev: any) => ({ ...prev, groq: cleanKey }));
        }
      } else if (id !== 'elevenlabs') {
        await setProviderKey(id as ChatEngineId, cleanKey);
      }

      // Immediately mark as SAVED – NOT TESTED so it is never NOT SET when a key is stored
      setStatusMap((prev) => ({ ...prev, [id]: 'SAVED – NOT TESTED' }));
      writeLocalKey(provider.statusStorageKey, 'SAVED – NOT TESTED');
      await storage.set(provider.statusStorageKey, 'SAVED – NOT TESTED');

      console.log('[Connections] SAVE:', {
        provider: id,
        displayName: provider.displayName,
        saved: true,
        storageKey: provider.storageKey,
      });
    } catch (saveErr: any) {
      console.log('[Connections] SAVE ERROR:', {
        provider: id,
        error: String(saveErr?.message || saveErr),
      });
    }

    setVerifyingMap((prev) => ({ ...prev, [id]: true }));
    setErrorDetails((prev) => ({ ...prev, [id]: '' }));
    setTestResults((prev) => ({ ...prev, [id]: '' }));

    // 2) Then test it and set status pill + toast with REAL reason
    try {
      let checkResult: { ok: boolean; status: KeyStatus; httpStatus?: number; errorText?: string };
      if (id === 'elevenlabs') {
        checkResult = await verifyElevenLabs(cleanKey);
      } else {
        checkResult = await verifyProviderKey(id as ChatEngineId, cleanKey);
      }

      const finalStatus: KeyStatus =
        checkResult.status === 'NOT SET' ? 'SAVED – NOT TESTED' : checkResult.status;
      const pillLabel =
        finalStatus === 'READY' ? 'READY ✓' : finalStatus === 'CONNECTED' ? 'CONNECTED' : finalStatus;

      setStatusMap((prev) => ({ ...prev, [id]: finalStatus }));
      writeLocalKey(provider.statusStorageKey, finalStatus);
      try {
        await storage.set(provider.statusStorageKey, finalStatus);
      } catch {}

      const reason = checkResult.errorText || (checkResult.httpStatus ? `HTTP ${checkResult.httpStatus}` : '');
      const fullMsg =
        id === 'gemini' && reason
          ? `${provider.displayName}: ${reason}`
          : reason
            ? `${provider.displayName}: ${pillLabel} (${reason})`
            : `${provider.displayName}: ${pillLabel}`;

      console.log('[Connections] TEST RESULT:', {
        provider: id,
        displayName: provider.displayName,
        status: pillLabel,
        httpStatus: checkResult.httpStatus ?? null,
        reason,
      });

      setErrorDetails((prev) => ({ ...prev, [id]: fullMsg }));
      setTestResults((prev) => ({ ...prev, [id]: fullMsg }));
      notifyToast(fullMsg);
    } catch (err: any) {
      const rawReason = String(err?.message || err || 'Network error')
        .split(cleanKey)
        .join('[REDACTED]')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);

      setStatusMap((prev) => ({ ...prev, [id]: 'SAVED – NOT TESTED' }));
      writeLocalKey(provider.statusStorageKey, 'SAVED – NOT TESTED');
      try {
        await storage.set(provider.statusStorageKey, 'SAVED – NOT TESTED');
      } catch {}

      const fullMsg = `${provider.displayName}: SAVED – NOT TESTED (${rawReason})`;
      console.log('[Connections] TEST RESULT:', {
        provider: id,
        displayName: provider.displayName,
        status: 'SAVED – NOT TESTED',
        httpStatus: null,
        reason: rawReason,
      });

      setErrorDetails((prev) => ({ ...prev, [id]: fullMsg }));
      setTestResults((prev) => ({ ...prev, [id]: fullMsg }));
      notifyToast(fullMsg);
    } finally {
      setVerifyingMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleSelectEngine = (engineId: ChatEngineId) => {
    const stat = statusMap[engineId];
    const key = typedKeys[engineId];
    const serverReady = engineId === 'gemini' && (isServerGeminiConfigured() || stat === 'READY');
    if ((!key && !serverReady) || stat === 'INVALID' || stat === 'NOT SET') {
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
    const hasKey = Boolean(typedKeys[id] && typedKeys[id].trim());
    const rawStatus = statusMap[id] || (hasKey ? 'SAVED – NOT TESTED' : 'NOT SET');
    const currentStatus: KeyStatus = hasKey && rawStatus === 'NOT SET' ? 'SAVED – NOT TESTED' : rawStatus;

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

    if (currentStatus === 'READY' || currentStatus === 'CONNECTED') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/15 border border-emerald-500/40 rounded-full shrink-0">
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
            READY ✓
          </span>
        </div>
      );
    }

    if (currentStatus === 'LIMIT REACHED') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/40 rounded-full shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            LIMIT REACHED
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

    if (currentStatus === 'SAVED – NOT TESTED' || hasKey) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/40 rounded-full shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
            SAVED – NOT TESTED
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

        {localToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] max-w-[92vw] bg-[#0F172A]/95 border border-purple-500/40 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md text-center break-words">
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

        {localToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] max-w-[92vw] bg-[#0F172A]/95 border border-purple-500/40 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md text-center break-words">
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
          <ApiKeyCard
            inputId={`key-input-${selectedItem.id}`}
            displayName={selectedItem.displayName}
            icon={SelectedIconComp}
            status={statusMap[selectedItem.id]}
            apiKey={typedKeys[selectedItem.id]}
            placeholder={selectedItem.placeholder}
            link={selectedItem.link}
            onChange={(val: string) => setTypedKeys((prev) => ({ ...prev, [selectedItem.id]: val }))}
            onSave={(key: string) => handleSave(selectedItem.id, key)}
            onPaste={() => handlePaste(selectedItem.id)}
            onGet={() => handleGetKey(selectedItem.link)}
            isVerifying={verifyingMap[selectedItem.id]}
          />

          {/* Result / Error Box */}
          {(testResults[selectedItem.id] || selectedErrorMsg) && (
            <div className={`p-3.5 border rounded-2xl text-xs font-medium text-center shadow-lg transition-all break-words ${
              (testResults[selectedItem.id] || selectedErrorMsg).includes('limit full') ||
              statusMap[selectedItem.id] === 'LIMIT REACHED' ||
              statusMap[selectedItem.id] === 'SAVED – NOT TESTED'
                ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                : statusMap[selectedItem.id] === 'READY' || statusMap[selectedItem.id] === 'CONNECTED'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-red-950/80 border-red-500/50 text-red-300'
            }`}>
              {testResults[selectedItem.id] || selectedErrorMsg}
            </div>
          )}
        </div>
      </div>

      {/* Toast visible inside ConnectionsView */}
      {localToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] max-w-[92vw] bg-[#0F172A]/95 border border-purple-500/40 text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-2xl backdrop-blur-md text-center break-words">
          {localToast}
        </div>
      )}
    </motion.div>
  );
};
