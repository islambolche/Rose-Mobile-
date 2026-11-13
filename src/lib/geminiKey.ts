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
  return false;
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
