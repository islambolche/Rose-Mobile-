import { storage } from './storage';
import { backupKeyToIndexedDB, getKeyFromIndexedDB } from './keyBackup';

let cachedKey: string = '';

export const initGeminiKey = async (): Promise<string> => {
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
