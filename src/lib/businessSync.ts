import {
  SharedBusinessDatabase,
  DEFAULT_SHARED_BUSINESS_DATABASE,
  GeminiProfileType,
  GeminiApiProfile,
  BusinessOrder,
  CustomerMessage,
  ParcelTracking,
  AutomationRule,
  ActivityLog,
  BusinessProfile,
  FirebaseConfig,
} from "../types/business";

const STORAGE_KEY = "rose_shared_business_db";
const BROADCAST_CHANNEL_NAME = "rose_business_sync_channel";

let channel: BroadcastChannel | null = null;
try {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch (e) {
  // BroadcastChannel unavailable
}

export function loadLocalBusinessDb(): SharedBusinessDatabase {
  if (typeof window === "undefined") return DEFAULT_SHARED_BUSINESS_DATABASE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate from unified settings if gemini profile is empty
      const legacyUnified = localStorage.getItem("rose_unified_settings");
      if (legacyUnified) {
        try {
          const u = JSON.parse(legacyUnified);
          if (u.geminiApiKey && !parsed.geminiProfiles?.free?.key && !parsed.geminiProfiles?.paid?.key) {
            if (!parsed.geminiProfiles) parsed.geminiProfiles = { ...DEFAULT_SHARED_BUSINESS_DATABASE.geminiProfiles };
            parsed.geminiProfiles.free.key = u.geminiApiKey;
            parsed.geminiProfiles.free.status = "connected";
          }
        } catch (e) {}
      }

      return {
        ...DEFAULT_SHARED_BUSINESS_DATABASE,
        ...parsed,
        businessProfile: {
          ...DEFAULT_SHARED_BUSINESS_DATABASE.businessProfile,
          ...(parsed.businessProfile || {}),
        },
        geminiProfiles: {
          free: {
            ...DEFAULT_SHARED_BUSINESS_DATABASE.geminiProfiles.free,
            ...(parsed.geminiProfiles?.free || {}),
          },
          paid: {
            ...DEFAULT_SHARED_BUSINESS_DATABASE.geminiProfiles.paid,
            ...(parsed.geminiProfiles?.paid || {}),
          },
        },
        groq: {
          ...DEFAULT_SHARED_BUSINESS_DATABASE.groq,
          ...(parsed.groq || {}),
        },
        agents: {
          ...DEFAULT_SHARED_BUSINESS_DATABASE.agents,
          ...(parsed.agents || {}),
        },
      };
    }
  } catch (e) {
    console.warn("Failed to load local business database:", e);
  }
  return { ...DEFAULT_SHARED_BUSINESS_DATABASE };
}

export function saveLocalBusinessDb(db: SharedBusinessDatabase): void {
  if (typeof window === "undefined") return;
  try {
    const updated: SharedBusinessDatabase = {
      ...db,
      lastSyncedAt: new Date().toISOString(),
      version: (db.version || 0) + 1,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Keep active Gemini key synced to legacy keys so chat & call engine use it
    const activeKey =
      updated.activeGeminiProfile === "paid"
        ? updated.geminiProfiles.paid.key
        : updated.geminiProfiles.free.key;

    if (activeKey) {
      localStorage.setItem("rose_api_keys", JSON.stringify({ gemini: activeKey }));
    }

    // Broadcast change across tabs
    if (channel) {
      channel.postMessage({ type: "BUSINESS_DB_UPDATED", payload: updated });
    }
  } catch (e) {
    console.warn("Failed to save local business database:", e);
  }
}

/**
 * Syncs business database with backend server, merging updates
 */
export async function syncBusinessDbWithServer(currentDb: SharedBusinessDatabase): Promise<SharedBusinessDatabase> {
  try {
    const res = await fetch('/api/business/state');
    if (!res.ok) return currentDb;
    const data = await res.json();
    if (data.success && data.state) {
      // Logic for merging could go here if needed, for now just replace
      return data.state;
    }
  } catch (e) {
    console.warn("Failed to sync business DB:", e);
  }
  return currentDb;
}

/**
 * Fetch latest state from server
 */
export async function fetchServerBusinessState(): Promise<SharedBusinessDatabase | null> {
  try {
    const res = await fetch('/api/business/state');
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.state : null;
  } catch (e) {
    return null;
  }
}

/**
 * Performs actual real API key validation
 */
export async function validateGeminiApiKey(
  key: string,
  profile: GeminiProfileType
): Promise<{
  ok: boolean;
  statusText: string;
  errorCategory?: string;
  errorMessage?: string;
  model: string;
}> {
  if (!key || !key.trim()) {
    return {
      ok: false,
      statusText: "Error",
      errorCategory: "Missing Key",
      errorMessage: "API Key cannot be empty.",
      model: "gemini-3.8-flash",
    };
  }

  const cleanKey = key.trim();

  try {
    const res = await fetch(`/api/gemini/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: cleanKey,
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
        model: "gemini-1.5-flash"
      }),
    });

    if (res.ok) {
      return {
        ok: true,
        statusText: "Connected",
        model: "gemini-1.5-flash",
      };
    } else {
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        statusText: "Error",
        errorCategory: "Authentication Failed",
        errorMessage: data.error?.message || `HTTP ${res.status}`,
        model: "gemini-1.5-flash",
      };
    }
  } catch (e: any) {
    return {
      ok: false,
      statusText: "Error",
      errorCategory: "Network Failure",
      errorMessage: e.message || "Failed to contact Rose AI Server.",
      model: "gemini-1.5-flash",
    };
  }
}

/**
 * Hook to subscribe to cross-tab / device synchronization
 */
export function subscribeToBusinessSync(callback: (db: SharedBusinessDatabase) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === "BUSINESS_DB_UPDATED" && event.data?.payload) {
      callback(event.data.payload);
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        callback(parsed);
      } catch (e) {}
    }
  };

  if (channel) {
    channel.addEventListener("message", handleMessage);
  }
  window.addEventListener("storage", handleStorage);

  return () => {
    if (channel) {
      channel.removeEventListener("message", handleMessage);
    }
    window.removeEventListener("storage", handleStorage);
  };
}
