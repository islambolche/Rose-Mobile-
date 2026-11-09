import {
  SharedBusinessDatabase,
  DEFAULT_SHARED_BUSINESS_DATABASE,
  GeminiProfileType,
} from "../types/business";
import { TEXT_MODELS, discoverAvailableFlashModels, getSavedWorkingTextModel, sanitizeOutApiKey } from "./ai-service";

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

    const activeKey =
      updated.activeGeminiProfile === "paid"
        ? updated.geminiProfiles.paid.key
        : updated.geminiProfiles.free.key;

    if (activeKey) {
      localStorage.setItem("rose_api_keys", JSON.stringify({ gemini: activeKey }));
    }

    if (channel) {
      channel.postMessage({ type: "BUSINESS_DB_UPDATED", payload: updated });
    }
  } catch (e) {
    console.warn("Failed to save local business database:", e);
  }
}

export async function syncBusinessDbWithServer(currentDb: SharedBusinessDatabase): Promise<SharedBusinessDatabase> {
  return loadLocalBusinessDb() || currentDb;
}

export async function fetchServerBusinessState(): Promise<SharedBusinessDatabase | null> {
  return loadLocalBusinessDb();
}

export async function validateGeminiApiKey(
  key: string,
  _profile: GeminiProfileType
): Promise<{
  ok: boolean;
  statusText: string;
  errorCategory?: string;
  errorMessage?: string;
  model: string;
}> {
  const cleanKey = (key || "").replace(/[\r\n\t\s"']+/g, "").trim();
  if (!cleanKey) {
    return {
      ok: false,
      statusText: "Error",
      errorCategory: "Missing Key",
      errorMessage: "Add your Gemini key in Settings > Connections.",
      model: TEXT_MODELS[0],
    };
  }

  const savedWorking = getSavedWorkingTextModel();
  const candidateModels = savedWorking
    ? [savedWorking, ...TEXT_MODELS.filter((m) => m !== savedWorking)]
    : [...TEXT_MODELS];
  const tried = new Set<string>();
  let lastErr = "Cannot reach Gemini. Check your internet and your Gemini key.";

  const testModel = async (m: string) => {
    tried.add(m);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      m
    )}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });

    const rawText = await res.text().catch(() => "");
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      lastErr = `Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`;
      return null;
    }
    if (!data || typeof data !== "object") {
      lastErr = `Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`;
      return null;
    }
    if (res.ok) {
      return {
        ok: true,
        statusText: "Connected",
        model: m,
      };
    }
    lastErr = data?.error?.message
      ? `${data.error.message} (HTTP ${res.status})`
      : `Cannot reach Gemini. Check your internet and your Gemini key. (HTTP ${res.status})`;
    return null;
  };

  try {
    for (const m of candidateModels) {
      const okRes = await testModel(m);
      if (okRes) return okRes;
    }
    const discovered = await discoverAvailableFlashModels(cleanKey, tried);
    for (const dm of discovered) {
      const okRes = await testModel(dm);
      if (okRes) return okRes;
    }
    return {
      ok: false,
      statusText: "Error",
      errorCategory: "Authentication Failed",
      errorMessage: sanitizeOutApiKey(lastErr, cleanKey),
      model: TEXT_MODELS[0],
    };
  } catch (e: any) {
    return {
      ok: false,
      statusText: "Error",
      errorCategory: "Network Failure",
      errorMessage: "Cannot reach Gemini. Check your internet and your Gemini key.",
      model: TEXT_MODELS[0],
    };
  }
}

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
