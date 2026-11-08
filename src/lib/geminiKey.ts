import { storage } from './storage';

let cachedKey: string = '';

export const initGeminiKey = async (): Promise<string> => {
  try {
    const key = await storage.get('gemini_api_key');
    cachedKey = (key || '').trim();
    return cachedKey;
  } catch (e) {
    return '';
  }
};

export const getGeminiKey = (): string => {
  if (cachedKey) return cachedKey;
  
  // Fallback to sync localStorage if init wasn't called yet or failed
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const k = localStorage.getItem('gemini_api_key');
      if (k) {
        cachedKey = k.trim();
        return cachedKey;
      }
    }
  } catch (e) {}
  
  return '';
};

export const setGeminiKey = async (key: string): Promise<void> => {
  try {
    const clean = String(key || "").replace(/[\r\n\t\s"']+/g, "").trim();
    if (!clean) return; // Never overwrite with empty string as per request
    
    cachedKey = clean;
    await storage.set('gemini_api_key', clean);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("gemini_key_updated", { detail: clean }));
    }
  } catch (e) {
    console.error("Failed saving Gemini key:", e);
  }
};




