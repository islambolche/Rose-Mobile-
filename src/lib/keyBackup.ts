const DB_NAME = 'RoseKeyBackupDB';
const STORE_NAME = 'api_keys_backup';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openKeyDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });

  return dbPromise;
}

export async function backupKeyToIndexedDB(keyName: string, value: string): Promise<void> {
  try {
    const db = await openKeyDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    if (value) {
      store.put(value, keyName);
    } else {
      store.delete(keyName);
    }
  } catch (e) {
    console.warn('[KeyBackup] Failed to write key to IndexedDB:', e);
  }
}

export async function getKeyFromIndexedDB(keyName: string): Promise<string> {
  try {
    const db = await openKeyDB();
    if (!db) return '';
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(keyName);
      req.onsuccess = () => resolve(String(req.result || '').trim());
      req.onerror = () => resolve('');
    });
  } catch (e) {
    return '';
  }
}

export function requestStoragePersistence(): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then((persisted) => {
        console.log('[Storage] Storage persisted:', persisted);
      }).catch(() => {});
    }
  } catch (e) {}
}
