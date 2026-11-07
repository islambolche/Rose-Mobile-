import { MemoryFact, MemoryCategory, Message } from '../types';
import { askAI } from './llm';

const MEMORY_KEY = "rose_memory_facts";
const SUMMARY_KEY = "rose_chat_summary";
const INDEXED_DB_NAME = "RoseDB";
const STORE_NAME = "chat_history";

// Sensitive data pattern detection
const SENSITIVE_PATTERNS = [
  /password/i, /পাসওয়ার্ড/i, /পাসওয়ার্ড/i,
  /pin\s*code/i, /পিন/i,
  /credit\s*card/i, /debit\s*card/i, /কার্ড\s*নম্বর/i, /cvv/i, /card\s*number/i,
  /nid/i, /national\s*id/i, /জাতীয়\s*পরিচয়/i, /জাতীয়\s*পরিচয়/i,
  /api[_\s]*key/i, /secret[_\s]*key/i, /private[_\s]*key/i,
  /passport/i, /পাসপোর্ট/i
];

export function isSensitiveInfo(text: string): boolean {
  if (!text) return false;
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(text));
}

export function loadMemoryFacts(): MemoryFact[] {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not load memory facts from localStorage", e);
  }
  return [];
}

export function saveMemoryFacts(facts: MemoryFact[]): void {
  try {
    // Cap at 200 items max
    const trimmed = facts.slice(0, 200);
    localStorage.setItem(MEMORY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn("Could not save memory facts to localStorage", e);
  }
}

export function addMemoryFact(factText: string, category: MemoryCategory = 'other', source: 'voice' | 'chat' = 'chat'): { success: boolean; message: string; fact?: MemoryFact } {
  if (isSensitiveInfo(factText)) {
    return { success: false, message: "এটা আমি সেভ করব না।" };
  }

  const existing = loadMemoryFacts();
  // Check for duplicates or updates
  const cleanedText = factText.trim();
  const duplicateIdx = existing.findIndex(f => f.text.toLowerCase() === cleanedText.toLowerCase());
  
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const newFact: MemoryFact = {
    id: Date.now().toString(),
    text: cleanedText,
    category,
    timestamp: now,
    source
  };

  if (duplicateIdx !== -1) {
    existing[duplicateIdx] = newFact;
  } else {
    existing.unshift(newFact);
  }

  saveMemoryFacts(existing);
  return { success: true, message: "মনে রাখলাম।", fact: newFact };
}

export function forgetMemoryFact(query: string): { success: boolean; count: number } {
  const existing = loadMemoryFacts();
  const lowerQuery = query.toLowerCase().trim();
  const filtered = existing.filter(f => !f.text.toLowerCase().includes(lowerQuery));
  const count = existing.length - filtered.length;
  if (count > 0) {
    saveMemoryFacts(filtered);
  }
  return { success: count > 0, count };
}

// Background AI Fact Extraction
export async function extractMemoryFactsBackground(
  recentMessages: Message[],
  apiKey: string
): Promise<MemoryFact[]> {
  try {
    const userTexts = recentMessages
      .filter(m => (m.role === 'user' || m.sender === 'user') && m.content || m.text)
      .map(m => m.content || m.text || '')
      .join('\n');

    if (!userTexts || userTexts.trim().length < 10) return loadMemoryFacts();

    const currentFacts = loadMemoryFacts();
    const currentFactsFormatted = currentFacts.map(f => `- ${f.text} (${f.category})`).join('\n');

    const prompt = `You are Rose's internal memory analyzer.
Extract permanent long-term facts about the USER from the following user statements:
${userTexts}

Existing facts:
${currentFactsFormatted || 'None'}

Instructions:
1. ONLY extract long-term user facts (user's name, preferences, work, business, family, future plans, or explicit "remember that...").
2. DO NOT extract temporary states (e.g. "I'm tired", "hello"), Rose's responses, or guesses.
3. Ignore passwords, credit cards, or API keys.
4. Output JSON array of objects with keys "text" and "category" (category must be one of: 'name', 'preference', 'work', 'family', 'plan', 'other').
Example JSON output:
[{"text": "User lives in Dhaka", "category": "work"}]

If no new long-term facts are found, return empty array [].
Return strictly valid JSON array only.`;

    const res = await askAI([{ role: 'user', content: prompt }], { gemini: apiKey });
    const jsonMatch = res.match(/\[.*\]/s);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        let updated = false;
        parsed.forEach((item: any) => {
          if (item.text && typeof item.text === 'string' && !isSensitiveInfo(item.text)) {
            const added = addMemoryFact(item.text, item.category || 'other');
            if (added.success) updated = true;
          }
        });
        if (updated) {
          console.log("Memory facts updated in background");
        }
      }
    }
  } catch (e) {
    console.warn("Background fact extraction failed", e);
  }
  return loadMemoryFacts();
}

// IndexedDB Helper for large chat persistence
export async function initIndexedDB(): Promise<IDBDatabase | null> {
  if (!('indexedDB' in window)) return null;
  return new Promise((resolve) => {
    const req = indexedDB.open(INDEXED_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function saveMessagesToIndexedDB(messages: Message[]): Promise<void> {
  try {
    const db = await initIndexedDB();
    if (!db) return;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    messages.forEach(m => {
      if (m.id) store.put(m);
    });
  } catch (e) {
    console.warn("IndexedDB save failed", e);
  }
}

export async function loadMessagesFromIndexedDB(): Promise<Message[]> {
  try {
    const db = await initIndexedDB();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    return [];
  }
}

export function loadStoredChatSummary(): string {
  try {
    return localStorage.getItem(SUMMARY_KEY) || "";
  } catch (e) {
    return "";
  }
}

export function saveStoredChatSummary(summary: string): void {
  try {
    localStorage.setItem(SUMMARY_KEY, summary);
  } catch (e) {}
}
