import { storage } from './storage';
import { backupKeyToIndexedDB, getKeyFromIndexedDB } from './keyBackup';

let cachedKey: string = '';
let serverGeminiConfigured: boolean | null = null;
let serverGeminiMaskedKey: string = '';
let serverStatusPromise: Promise<boolean> | null = null;
let lastServerCheckAt = 0;
let apiBackendAvailable: boolean | null = null;
const SERVER_STATUS_CACHE_TTL_MS = 15000;

export const isApiBackendAvailable = (): boolean | null => apiBackendAvailable;

export const setApiBackendAvailable = (available: boolean): void => {
  apiBackendAvailable = available;
};

export const isServerGeminiConfigured = (): boolean => serverGeminiConfigured === true;

export const getServerGeminiMaskedKey = (): string => serverGeminiMaskedKey;

export const hasUsableGeminiKey = (overrideKey?: string): boolean => {
  const cleanOverride = String(overrideKey || '').replace(/[\r\n\t\s"']+/g, '').trim();
  if (cleanOverride) return true;
  if (getGeminiKey()) return true;
  return serverGeminiConfigured === true;
};

export const fetchServerGeminiStatus = async (forceRefresh = false): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if (!forceRefresh && apiBackendAvailable === false && serverGeminiConfigured === false) {
    return false;
  }
  const now = Date.now();
  if (
    !forceRefresh &&
    serverGeminiConfigured !== null &&
    now - lastServerCheckAt < SERVER_STATUS_CACHE_TTL_MS
  ) {
    return serverGeminiConfigured;
  }
  if (!forceRefresh && serverStatusPromise) {
    return serverStatusPromise;
  }

  serverStatusPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/api/gemini/status', { signal: controller.signal });
      clearTimeout(timer);
      const ct = String(res.headers.get('content-type') || '').toLowerCase();
      if (res.ok && ct.includes('application/json')) {
        const data = await res.json().catch(() => null);
        if (data && typeof data === 'object' && 'configured' in data) {
          apiBackendAvailable = true;
          const configured = Boolean(data?.configured);
          serverGeminiConfigured = configured;
          serverGeminiMaskedKey = typeof data?.maskedKey === 'string' ? data.maskedKey : '';
          lastServerCheckAt = Date.now();
          try {
            window.dispatchEvent(
              new CustomEvent('gemini_server_status_updated', {
                detail: { configured, maskedKey: serverGeminiMaskedKey },
              })
            );
          } catch {}
          return configured;
        }
      }
      if (res.status === 404 || res.status === 405 || (ct.includes('text/html') && !res.ok)) {
        apiBackendAvailable = false;
      }
    } catch {}
    if (serverGeminiConfigured === null) {
      serverGeminiConfigured = false;
    }
    lastServerCheckAt = Date.now();
    return serverGeminiConfigured;
  })().finally(() => {
    serverStatusPromise = null;
  });

  return serverStatusPromise;
};

export const ensureGeminiReady = async (overrideKey?: string): Promise<boolean> => {
  const cleanOverride = String(overrideKey || '').replace(/[\r\n\t\s"']+/g, '').trim();
  if (cleanOverride) return true;
  if (getGeminiKey()) return true;
  if (serverGeminiConfigured === true) return true;
  return await fetchServerGeminiStatus(false);
};

export const initGeminiKey = async (): Promise<string> => {
  // Warm server Gemini availability check immediately without blocking init
  void fetchServerGeminiStatus();
  try {
    let key = await storage.get('gemini_api_key');
    if (!key || !key.trim()) {
      key = await getKeyFromIndexedDB('gemini_api_key');
      if (key && key.trim()) {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('gemini_api_key', key.trim());
          }
        } catch (e) {}
      }
    }
    cachedKey = (key || '').trim();
    return cachedKey;
  } catch (e) {
    return '';
  }
};

export const getGeminiKey = (): string => {
  if (cachedKey) return cachedKey;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const k = localStorage.getItem('gemini_api_key');
      if (k && k.trim()) {
        cachedKey = k.trim();
        return cachedKey;
      }
    }
  } catch (e) {}

  // Async restore from IndexedDB if localStorage was cleared
  getKeyFromIndexedDB('gemini_api_key').then((idbKey) => {
    if (idbKey && idbKey.trim()) {
      cachedKey = idbKey.trim();
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('gemini_api_key', cachedKey);
        }
      } catch (e) {}
    }
  }).catch(() => {});

  return '';
};

export const setGeminiKey = async (key: string): Promise<void> => {
  try {
    const clean = String(key || '').replace(/[\r\n\t\s"']+/g, '').trim();
    if (!clean) return;

    cachedKey = clean;
    await storage.set('gemini_api_key', clean);
    await backupKeyToIndexedDB('gemini_api_key', clean);

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('gemini_cached_chat_models');
        localStorage.removeItem('gemini_cached_live_models');
        localStorage.removeItem('rose_tts_models_cache_v2');
        localStorage.removeItem('rose_voice_models_cache_v2');
        localStorage.removeItem('cached_answer_model');
        localStorage.removeItem('cached_tts_model');
      }
    } catch {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gemini_key_updated', { detail: clean }));
    }
  } catch (e) {
    console.error('Failed saving Gemini key:', e);
  }
};
