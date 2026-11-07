/**
 * Single source of truth for retrieving and setting the Gemini API Key.
 * Reads the key saved by the Connections page (with .trim()).
 * Does NOT read from process.env or any hardcoded token.
 */

let cachedKey: string | null = null;

export const getGeminiKey = (): string => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "";

    const candidates: string[] = [];

    // 1. Check gemini_api_key directly
    candidates.push(localStorage.getItem("gemini_api_key") || "");
    candidates.push(localStorage.getItem("geminiApiKey") || "");
    candidates.push(localStorage.getItem("gemini_key") || "");

    // 2. Check iyabd_api_keys and rose_api_keys JSON storage
    try {
      const iyabdStored = JSON.parse(localStorage.getItem("iyabd_api_keys") || "{}");
      if (iyabdStored?.gemini) candidates.push(String(iyabdStored.gemini));
      if (iyabdStored?.geminiApiKey) candidates.push(String(iyabdStored.geminiApiKey));
    } catch (e) {}

    try {
      const roseStored = JSON.parse(localStorage.getItem("rose_api_keys") || "{}");
      if (roseStored?.gemini) candidates.push(String(roseStored.gemini));
      if (roseStored?.geminiApiKey) candidates.push(String(roseStored.geminiApiKey));
    } catch (e) {}

    // 3. Fallback to VITE_GEMINI_API_KEY if valid
    try {
      if (typeof import.meta !== "undefined" && import.meta.env?.VITE_GEMINI_API_KEY) {
        candidates.push(String(import.meta.env.VITE_GEMINI_API_KEY));
      }
    } catch (e) {}

    for (const raw of candidates) {
      const cleaned = String(raw || "").replace(/[\r\n\t\s"']+/g, "").trim();
      if (
        cleaned &&
        cleaned !== "placeholder" &&
        cleaned !== "undefined" &&
        !cleaned.startsWith("AQ.")
      ) {
        return cleaned;
      }
    }

    return "";
  } catch (e) {
    console.warn("Failed reading Gemini key:", e);
    return "";
  }
};

export const setGeminiKey = (key: string): void => {
  try {
    const clean = String(key || "").replace(/[\r\n\t\s"']+/g, "").trim();
    localStorage.setItem("gemini_api_key", clean);

    // Sync iyabd_api_keys
    try {
      const stored = JSON.parse(localStorage.getItem("iyabd_api_keys") || "{}");
      stored.gemini = clean;
      localStorage.setItem("iyabd_api_keys", JSON.stringify(stored));
    } catch (e) {}

    // Sync rose_api_keys
    try {
      const roseStored = JSON.parse(localStorage.getItem("rose_api_keys") || "{}");
      roseStored.gemini = clean;
      localStorage.setItem("rose_api_keys", JSON.stringify(roseStored));
    } catch (e) {}

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("gemini_key_updated", { detail: clean }));
    }
  } catch (e) {
    console.error("Failed saving Gemini key:", e);
  }
};



