/**
 * IndexedDB TTS Caching for Rose AI Assistant
 * Caches generated audio base64 for repeated phrases (greetings, voice samples)
 */

const DB_NAME = 'rose_tts_cache_db';
const STORE_NAME = 'audio_cache';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;
const memoryCache = new Map<string, string>();

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'cacheKey' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
  });

  return dbPromise;
}

function makeCacheKey(text: string, voiceName: string): string {
  const cleanText = text.trim().toLowerCase();
  const cleanVoice = voiceName.trim().toLowerCase();
  return `${cleanVoice}:::${cleanText}`;
}

export async function getCachedAudio(text: string, voiceName: string): Promise<string | null> {
  const key = makeCacheKey(text, voiceName);

  if (memoryCache.has(key)) {
    return memoryCache.get(key) || null;
  }

  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        if (req.result && req.result.audioBase64) {
          memoryCache.set(key, req.result.audioBase64);
          resolve(req.result.audioBase64);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return memoryCache.get(key) || null;
  }
}

export async function saveCachedAudio(text: string, voiceName: string, audioBase64: string): Promise<void> {
  if (!text || !audioBase64) return;
  const key = makeCacheKey(text, voiceName);
  memoryCache.set(key, audioBase64);

  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({
      cacheKey: key,
      text: text.trim(),
      voiceName: voiceName.trim(),
      audioBase64,
      createdAt: Date.now(),
    });
  } catch (e) {
    // Memory cache remains
  }
}

export async function clearTTSCache(): Promise<void> {
  memoryCache.clear();
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  } catch (e) {}
}
