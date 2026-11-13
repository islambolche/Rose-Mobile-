import { storage } from './storage';
import { backupKeyToIndexedDB, getKeyFromIndexedDB } from './keyBackup';

let cachedKey: string = '';
let serverGeminiConfigured: boolean | null = null;
let serverGeminiMaskedKey: string = '';
let serverStatusPromise: Promise<boolean> | null = null;
let lastServerCheckAt = 0;
const SERVER_STATUS_CACHE_TTL_MS = 15000;

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
      if (res.ok) {
        const data = await res.json().catch(() => null);
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

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gemini_key_updated', { detail: clean }));
    }
  } catch (e) {
    console.error('Failed saving Gemini key:', e);
  }
};
