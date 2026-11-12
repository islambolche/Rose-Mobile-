import { logDevError } from './devLog';
import { openExternal } from './openExternal';
import { getGeminiKey } from './geminiKey';
import { getStoredGroqKey, getSelectedGroqModelFromSettings, isGeminiIn429Cooldown, resolveChatModel } from './typedChat';
import { getDynamicGroqChatModels } from './chatEngines';

export const ONLY_IN_ROSE_APP_MSG = 'এটা শুধু ROSE অ্যাপে কাজ করে';
export const HONEST_CALL_REPLY = 'হোয়াটসঅ্যাপে খুলে দিয়েছি, কল বাটন চাপো।';

const CONTACTS_STORAGE_KEY = 'rose_contacts';
const LEGACY_CONTACTS_STORAGE_KEY = 'iyabd_saved_contacts';
const CONTACT_ALIAS_STORAGE_KEY = 'rose_contact_alias';
const PENDING_PHONE_STATE_KEY = 'rose_pending_phone_state';
const PENDING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEDUPE_WINDOW_MS = 2000;

export type PhoneActionType = 'phone_call' | 'whatsapp_call' | 'whatsapp_message';

export interface RoseContact {
  name: string;
  number: string;
  source?: 'device' | 'local';
}

type PendingPhoneState =
  | {
      type: 'awaiting_confirm';
      actionType: PhoneActionType;
      contact: RoseContact;
      video?: boolean;
      messageText?: string;
      timestamp: number;
    }
  | {
      type: 'awaiting_choice';
      actionType: PhoneActionType;
      contacts: RoseContact[];
      spokenName?: string;
      video?: boolean;
      messageText?: string;
      timestamp: number;
    }
  | {
      type: 'awaiting_alias_or_number';
      actionType: PhoneActionType;
      spokenName: string;
      video?: boolean;
      messageText?: string;
      timestamp: number;
    }
  | {
      type: 'awaiting_message_text';
      contact: RoseContact;
      timestamp: number;
    }
  | {
      type: 'awaiting_fallback_normal_call';
      contact: RoseContact;
      timestamp: number;
    };

let sessionDeviceContacts: RoseContact[] | null = null;
const aiSpellingCache = new Map<string, string[]>();
let memoryPendingState: PendingPhoneState | null = null;
let lastActionCache: { signature: string; reply: string; timestamp: number } | null = null;

export const APP_PACKAGE_MAP: Record<string, { pkg: string; label: string }> = {
  whatsapp: { pkg: 'com.whatsapp', label: 'WhatsApp' },
  facebook: { pkg: 'com.facebook.katana', label: 'Facebook' },
  messenger: { pkg: 'com.facebook.orca', label: 'Messenger' },
  youtube: { pkg: 'com.google.android.youtube', label: 'YouTube' },
  instagram: { pkg: 'com.instagram.android', label: 'Instagram' },
  tiktok: { pkg: 'com.zhiliaoapp.musically', label: 'TikTok' },
  chrome: { pkg: 'com.android.chrome', label: 'Chrome' },
  gmail: { pkg: 'com.google.android.gm', label: 'Gmail' },
  maps: { pkg: 'com.google.android.apps.maps', label: 'Maps' },
};

const APP_ALIASES: Array<{ key: keyof typeof APP_PACKAGE_MAP; patterns: RegExp[] }> = [
  { key: 'whatsapp', patterns: [/whatsapp/i, /হোয়াটসঅ্যাপ/, /হোয়াটসঅ্যাপ/, /হোয়াটসঅ্যাপে/, /হোয়াটসঅ্যাপে/] },
  { key: 'messenger', patterns: [/messenger/i, /মেসেঞ্জার/, /মেসেঞ্জারে/] },
  { key: 'facebook', patterns: [/facebook/i, /\bfb\b/i, /ফেসবুক/, /ফেসবুকে/, /ফেইসবুক/] },
  { key: 'youtube', patterns: [/youtube/i, /ইউটিউব/, /ইউটিউবে/] },
  { key: 'instagram', patterns: [/instagram/i, /\binsta\b/i, /ইনস্টাগ্রাম/, /ইন্সটাগ্রাম/] },
  { key: 'tiktok', patterns: [/tiktok/i, /টিকটক/, /টিকটকে/] },
  { key: 'chrome', patterns: [/chrome/i, /ক্রোম/, /ক্রোমে/] },
  { key: 'gmail', patterns: [/gmail/i, /জিমেইল/, /জিমেইলে/] },
  { key: 'maps', patterns: [/\bmaps?\b/i, /google\s*maps?/i, /গুগল\s*ম্যাপস?/, /ম্যাপস/, /ম্যাপে?/] },
];

export function isNativeRoseApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).Capacitor?.isNativePlatform?.());
}

export function getRosePhonePlugin(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).Capacitor?.Plugins?.RosePhone || null;
}

/**
 * Convert Bangla digits (০-৯) to English digits (0-9).
 */
export function normalizeBengaliDigits(input: string): string {
  const map: Record<string, string> = {
    '০': '0',
    '১': '1',
    '২': '2',
    '৩': '3',
    '৪': '4',
    '৫': '5',
    '৬': '6',
    '৭': '7',
    '৮': '8',
    '৯': '9',
  };
  return String(input || '').replace(/[০-৯]/g, (d) => map[d] || d);
}

function replaceSpokenDigitWords(input: string): string {
  const wordPairs: Array<[RegExp, string]> = [
    [/(?:শূন্য|জিরো|zero)/gi, '0'],
    [/(?:এক|ওয়ান|ওয়ান|one)/gi, '1'],
    [/(?:দুই|টু|two)/gi, '2'],
    [/(?:তিন|থ্রি|three)/gi, '3'],
    [/(?:চার|ফোর|four)/gi, '4'],
    [/(?:পাঁচ|পাচ|ফাইভ|five)/gi, '5'],
    [/(?:ছয়|ছয়|সিক্স|six)/gi, '6'],
    [/(?:সাত|সেভেন|seven)/gi, '7'],
    [/(?:আট|এইট|eight)/gi, '8'],
    [/(?:নয়|নয়|নাইন|nine)/gi, '9'],
  ];
  let out = String(input || '');
  for (const [re, digit] of wordPairs) {
    out = out.replace(re, digit);
  }
  return out;
}

/**
 * Convert Bangla digits (০-৯) to English digits first, then convert Bangladeshi numbers:
 * 01XXXXXXXXX -> 8801XXXXXXXXX
 */
export function formatBangladeshiNumber(raw: string): string {
  const en = normalizeBengaliDigits(raw);
  const digits = en.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (/^01\d{9}$/.test(digits)) {
    return `88${digits}`;
  }
  if (digits.startsWith('01') && digits.length >= 10) {
    return `88${digits}`;
  }
  return digits;
}

export function formatDialableNumber(raw: string): string {
  const en = normalizeBengaliDigits(raw).trim();
  const hasPlus = en.startsWith('+');
  const digits = en.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('8801') && digits.length === 13) {
    return `+${digits}`;
  }
  return hasPlus ? `+${digits}` : digits;
}

export function extractPhoneNumberFromText(raw: string): string | null {
  if (!raw) return null;
  const en = normalizeBengaliDigits(raw);
  const directMatches = en.match(/(?:\+?88)?01[\d\s\-]{8,13}|\+?\d[\d\s\-()]{6,16}\d/g);
  if (directMatches) {
    for (const m of directMatches) {
      const digits = m.replace(/[^\d]/g, '');
      if (digits.length >= 7 && digits.length <= 15) {
        return formatBangladeshiNumber(digits);
      }
    }
  }

  const spokenConverted = normalizeBengaliDigits(replaceSpokenDigitWords(raw));
  const spokenMatches = spokenConverted.match(/(?:\+?88)?01[\d\s\-]{8,13}|\d[\d\s\-]{7,15}\d/g);
  if (spokenMatches) {
    for (const m of spokenMatches) {
      const digits = m.replace(/[^\d]/g, '');
      if (digits.length >= 8 && digits.length <= 15) {
        return formatBangladeshiNumber(digits);
      }
    }
  }

  return null;
}

function isStandalonePhoneNumber(raw: string): string | null {
  const cleaned = normalizeBengaliDigits(
    String(raw || '')
      .replace(/^(?:হ্যালো\s+|হাই\s+|এই\s+|শোনো\s+)?(?:রোজ|rose)\s*[,।:!-]?\s*/i, '')
      .trim()
  );
  if (!cleaned) return null;
  // Must contain mostly digits/phone separators and have no letters
  if (/[a-zA-Z\u0980-\u09E5\u09F0-\u09FF]/.test(cleaned)) {
    return null;
  }
  const digits = cleaned.replace(/[^\d]/g, '');
  if (digits.length >= 7 && digits.length <= 15) {
    return formatBangladeshiNumber(digits);
  }
  return null;
}

export function isWhatsAppRequest(text: string): boolean {
  return /(?:whatsapp|হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ|\bwa\b)/i.test(String(text || ''));
}

export function isVideoCallRequest(text: string): boolean {
  return /(?:ভিডিও\s*কল|ভিডিওতে\s*কল|video\s*call|cam\s*call|\bvideo\b)/i.test(String(text || ''));
}

export function openCallOrWhatsAppLink(rawNumber: string, channel: 'whatsapp' | 'tel' = 'whatsapp'): string {
  const formatted = formatBangladeshiNumber(rawNumber);
  if (!formatted) {
    return 'সঠিক ফোন নম্বর বলো।';
  }
  const url = channel === 'whatsapp' ? `https://wa.me/${formatted}` : `tel:${formatted}`;
  console.log(`[RosePhone] Opening ${channel} URL:`, url);
  openExternal(url);
  return HONEST_CALL_REPLY;
}

// ============================================================================
// Alias Map ("rose_contact_alias" in localStorage) & In-App Contacts
// ============================================================================

export function getContactAliasMap(): Record<string, string> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(CONTACT_ALIAS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {}
  return {};
}

export function saveContactAlias(spokenName: string, savedTarget: string): boolean {
  const key = cleanContactQueryName(spokenName) || String(spokenName || '').trim();
  const val = String(savedTarget || '').trim();
  if (!key || !val || typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const map = getContactAliasMap();
    // Replace case-insensitive duplicate keys
    for (const existingKey of Object.keys(map)) {
      if (existingKey.toLowerCase() === key.toLowerCase()) {
        delete map[existingKey];
      }
    }
    map[key] = val;
    localStorage.setItem(CONTACT_ALIAS_STORAGE_KEY, JSON.stringify(map));
    console.log('[RosePhone] Saved alias:', key, '->', val);
    return true;
  } catch {
    return false;
  }
}

export function lookupContactAlias(spokenName: string): string | null {
  const raw = String(spokenName || '').trim();
  const clean = cleanContactQueryName(raw) || raw;
  if (!clean) return null;
  const map = getContactAliasMap();
  const candidates = [raw.toLowerCase(), clean.toLowerCase()];
  for (const [k, v] of Object.entries(map)) {
    if (candidates.includes(k.trim().toLowerCase()) && typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return null;
}

export function getSavedInAppContacts(): RoseContact[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const map = new Map<string, RoseContact>();

  const readKey = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      for (const item of parsed) {
        const name = String(item?.name || '').trim();
        const rawNum = String(item?.number || item?.tel || '').trim();
        const number = formatBangladeshiNumber(rawNum);
        if (name && number) {
          map.set(name.toLowerCase(), { name, number, source: 'local' });
        }
      }
    } catch {}
  };

  readKey(LEGACY_CONTACTS_STORAGE_KEY);
  readKey(CONTACTS_STORAGE_KEY);

  return Array.from(map.values());
}

export function saveInAppContact(name: string, rawNumber: string): RoseContact | null {
  const cleanName = cleanContactQueryName(name) || String(name || '').trim();
  const formattedNumber = formatBangladeshiNumber(rawNumber);
  if (!cleanName || !formattedNumber) return null;

  const current = getSavedInAppContacts();
  const existingIdx = current.findIndex((c) => c.name.toLowerCase() === cleanName.toLowerCase());
  const entry: RoseContact = { name: cleanName, number: formattedNumber, source: 'local' };

  if (existingIdx >= 0) {
    current[existingIdx] = entry;
  } else {
    current.push(entry);
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(
        CONTACTS_STORAGE_KEY,
        JSON.stringify(current.map((c) => ({ name: c.name, number: c.number })))
      );
      localStorage.setItem(
        LEGACY_CONTACTS_STORAGE_KEY,
        JSON.stringify(current.map((c) => ({ name: c.name, number: c.number, tel: c.number })))
      );
    }
  } catch {}

  console.log('[RosePhone] Saved contact in localStorage:', entry);
  return entry;
}

export function cleanContactQueryName(raw: string): string {
  let s = String(raw || '').trim();
  if (!s) return '';

  s = s.replace(/^(?:হ্যালো\s+|হাই\s+|এই\s+|শোনো\s+)?(?:রোজ|rose)\s*[,।:!-]?\s*/i, '');
  s = s.replace(/\b(?:please|প্লিজ|একটু|এখনই|এখন|তাড়াতাড়ি)\b/gi, ' ');
  s = s.replace(
    /(?:হোয়াটসঅ্যাপে|হোয়াটসঅ্যাপে|হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ|whatsapp[-\s]*এ|on\s+whatsapp|in\s+whatsapp|via\s+whatsapp|whatsapp|নরমাল|সিমে|সিম|ফোনে|ডায়ালে|ভিডিওতে|ভিডিও|video)/gi,
    ' '
  );
  s = s.replace(
    /(?:এর\s+নম্বরে\s+|নম্বরে\s+)?(?:একটা\s+|একটি\s+)?(?:কল|ফোন|ডায়াল|মেসেজ|ম্যাসেজ|বার্তা|call|dial|phone|message|msg)\s*(?:দাও|দেও|দে|দেন|দিন|করো|কর|করুন|করে\s*দাও|করে\s*দে|দেব|দিব|করব|করো\s*তো|দাও\s*তো|লেখো|লিখো|পাঠাও)?.*/i,
    ''
  );
  s = s.replace(/\b(?:call|dial|phone|ring|message|msg|send|text)\b/gi, ' ');
  s = s.replace(/[-–—,:।.?!"'()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/\s+(?:কে|রে|এর|তে|এ)$/i, '').trim();
  if (s.endsWith('কে') && s.length > 2) {
    s = s.slice(0, -2).trim();
  } else if (s.endsWith('রে') && s.length > 3) {
    s = s.slice(0, -2).trim();
  }
  return s.trim();
}

function getSharedRecentMessages(): Array<{ role: string; text: string }> {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem('iyabd_chat_history') || localStorage.getItem('rose_messages');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m: any) => m && m.role !== 'system' && !m.isError && (m.text || m.content))
      .slice(-20)
      .map((m: any) => ({
        role: m.role === 'rose' || m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
        text: String(m.text || m.content || '').trim(),
      }));
  } catch {
    return [];
  }
}

// ============================================================================
// Session Contact Cache (getAllContacts once & cache for session)
// ============================================================================

function mergeContacts(primary: RoseContact[], secondary: RoseContact[]): RoseContact[] {
  const out: RoseContact[] = [];
  const seen = new Set<string>();
  const add = (c: RoseContact) => {
    const key = `${c.name.toLowerCase()}::${formatBangladeshiNumber(c.number) || c.number}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  };
  primary.forEach(add);
  secondary.forEach(add);
  return out;
}

/**
 * Loads all contacts once via RosePhone.getAllContacts() and caches them for the session.
 * Pass forceRefresh = true to refresh on demand.
 */
export async function getAllContacts(forceRefresh = false): Promise<{
  ok: boolean;
  contacts: RoseContact[];
  error?: string;
}> {
  const local = getSavedInAppContacts();
  const plugin = getRosePhonePlugin();

  if (!isNativeRoseApp() || !plugin || typeof plugin.getAllContacts !== 'function') {
    return { ok: true, contacts: local };
  }

  if (sessionDeviceContacts !== null && !forceRefresh) {
    return { ok: true, contacts: mergeContacts(sessionDeviceContacts, local) };
  }

  try {
    const res = await plugin.getAllContacts();
    const rawList: any[] = Array.isArray(res?.contacts) ? res.contacts : [];
    const deviceContacts: RoseContact[] = [];
    for (const item of rawList) {
      const name = String(item?.name || '').trim();
      const rawNum = String(item?.number || '').trim();
      if (name && rawNum) {
        deviceContacts.push({
          name,
          number: rawNum,
          source: 'device',
        });
      }
    }
    sessionDeviceContacts = deviceContacts;
    return { ok: true, contacts: mergeContacts(deviceContacts, local) };
  } catch (err: any) {
    const msg = String(err?.message || err || 'কন্টাক্ট আনা যায়নি').trim();
    logDevError({ area: 'other', message: `RosePhone.getAllContacts error: ${msg}` });
    return { ok: false, contacts: local, error: msg };
  }
}

export async function refreshContactsCache(): Promise<{
  ok: boolean;
  contacts: RoseContact[];
  error?: string;
}> {
  return getAllContacts(true);
}

// ============================================================================
// Bengali Speech -> English Spellings via Short JSON-Only Chat Model + Fuzzy Match
// ============================================================================

function bengaliToLatinApprox(input: string): string {
  const map: Record<string, string> = {
    অ: 'o', আ: 'a', ই: 'i', ঈ: 'i', উ: 'u', ঊ: 'u', ঋ: 'ri', এ: 'e', ঐ: 'oi', ও: 'o', ঔ: 'ou',
    'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
    '্': '', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n',
    ক: 'k', খ: 'kh', গ: 'g', ঘ: 'gh', ঙ: 'ng',
    চ: 'ch', ছ: 'ch', জ: 'j', ঝ: 'jh', ঞ: 'n',
    ট: 't', ঠ: 'th', ড: 'd', ঢ: 'dh', ণ: 'n',
    ত: 't', থ: 'th', দ: 'd', ধ: 'dh', ন: 'n',
    প: 'p', ফ: 'f', ব: 'b', ভ: 'bh', ম: 'm',
    য: 'j', র: 'r', ল: 'l', শ: 's', ষ: 's', স: 's', হ: 'h',
    ড়: 'r', ঢ়: 'r', য়: 'y', ৎ: 't',
  };
  let out = '';
  for (const ch of String(input || '').toLowerCase()) {
    out += map[ch] !== undefined ? map[ch] : ch;
  }
  return out;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/**
 * Similarity score between two strings (case-insensitive, ignore spaces, includes "contains" match).
 */
export function computeNameSimilarity(queryVariant: string, contactName: string): number {
  const qRaw = String(queryVariant || '').trim().toLowerCase();
  const cRaw = String(contactName || '').trim().toLowerCase();
  const qNoSpace = qRaw.replace(/[^a-z0-9\u0980-\u09FF]/g, '');
  const cNoSpace = cRaw.replace(/[^a-z0-9\u0980-\u09FF]/g, '');

  if (!qNoSpace || !cNoSpace) return 0;
  if (qNoSpace === cNoSpace) return 1.0;

  // Contains match (ignore spaces & case)
  const shorterLen = Math.min(qNoSpace.length, cNoSpace.length);
  const longerLen = Math.max(qNoSpace.length, cNoSpace.length);
  if (shorterLen >= 2 && (cNoSpace.includes(qNoSpace) || qNoSpace.includes(cNoSpace))) {
    // Reward closer length matches while keeping >= 0.78 for clear contains
    return Math.min(0.95, 0.78 + 0.17 * (shorterLen / longerLen));
  }

  // Full-string Levenshtein similarity (ignore spaces)
  const fullDist = levenshteinDistance(qNoSpace, cNoSpace);
  let best = 1 - fullDist / longerLen;

  // Also check individual words in contactName (e.g. "Rahim Mia" vs "Rahim")
  const words = cRaw.split(/\s+/).filter(Boolean);
  for (const w of words) {
    const wClean = w.replace(/[^a-z0-9\u0980-\u09FF]/g, '');
    if (!wClean) continue;
    if (wClean === qNoSpace) {
      best = Math.max(best, 0.92);
      continue;
    }
    const wDist = levenshteinDistance(qNoSpace, wClean);
    const wSim = 1 - wDist / Math.max(qNoSpace.length, wClean.length);
    if (wSim >= 0.7) {
      best = Math.max(best, Math.min(0.89, wSim));
    }
  }

  return best;
}

function parseJsonStringArray(rawText: string): string[] {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return [];
  try {
    const cleaned = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 5);
    }
    if (parsed && typeof parsed === 'object') {
      const arr = parsed.spellings || parsed.names || parsed.variants || parsed.results;
      if (Array.isArray(arr)) {
        return arr.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 5);
      }
    }
  } catch {
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const arr = JSON.parse(match[0]);
        if (Array.isArray(arr)) {
          return arr.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 5);
        }
      } catch {}
    }
  }
  return [];
}

/**
 * Ask the chat model (short, JSON only) for up to 5 likely English/Latin spellings & nicknames
 * for the spoken name (never sends the contact list to the model).
 */
async function getAiSpellingVariants(spokenName: string): Promise<string[]> {
  const key = spokenName.trim().toLowerCase();
  if (!key) return [];
  if (aiSpellingCache.has(key)) {
    return aiSpellingCache.get(key) || [];
  }

  const prompt = `Spoken contact name: "${spokenName}".
Give up to 5 likely English/Latin spellings and common Bangladeshi phonebook nicknames for this spoken name (e.g. "আম্মু" -> ["Ammu","Ammi","Amma","Mom","Mother"]).
Return ONLY a JSON array of strings, nothing else.`;

  const geminiKey = (getGeminiKey() || '').replace(/["'\r\n\t\s]+/g, '').trim();
  const groqKey = getStoredGroqKey();

  // Try Gemini first if available and not in 429 cooldown
  if (geminiKey && !isGeminiIn429Cooldown(geminiKey)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const model = await resolveChatModel(geminiKey, controller.signal);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 120,
          },
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.find((p: any) => typeof p?.text === 'string')?.text || '';
        const list = parseJsonStringArray(text);
        if (list.length > 0) {
          aiSpellingCache.set(key, list);
          return list;
        }
      }
    } catch {
    } finally {
      clearTimeout(timer);
    }
  }

  // Fallback to Groq if available
  if (groqKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      let groqModel = getSelectedGroqModelFromSettings();
      if (!groqModel) {
        const disc = await getDynamicGroqChatModels(groqKey, false);
        groqModel = disc.models?.[0] || 'llama-3.3-70b-versatile';
      }
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 120,
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || '';
        const list = parseJsonStringArray(text);
        if (list.length > 0) {
          aiSpellingCache.set(key, list);
          return list;
        }
      }
    } catch {
    } finally {
      clearTimeout(timer);
    }
  }

  return [];
}

function matchSpellingsAgainstContacts(
  spellings: string[],
  allContacts: RoseContact[]
): Array<{ contact: RoseContact; score: number }> {
  const uniqueMap = new Map<string, { contact: RoseContact; score: number }>();

  for (const c of allContacts) {
    let bestScore = 0;
    for (const sp of spellings) {
      const s = computeNameSimilarity(sp, c.name);
      if (s > bestScore) bestScore = s;
    }
    if (bestScore >= 0.7) {
      const normNum = formatBangladeshiNumber(c.number) || c.number.replace(/[^\d+]/g, '');
      const key = `${c.name.toLowerCase()}::${normNum}`;
      const existing = uniqueMap.get(key);
      if (!existing || bestScore > existing.score) {
        uniqueMap.set(key, { contact: c, score: bestScore });
      }
    }
  }

  return Array.from(uniqueMap.values()).sort((a, b) => b.score - a.score);
}

/**
 * Resolves a spoken person name against:
 * 1) Saved alias map ("rose_contact_alias")
 * 2) Cached contacts from getAllContacts() + localStorage
 * 3) If no immediate high-confidence match, asks chat model (short JSON-only) for up to 5 Latin spellings
 *    and fuzzy matches (>= 0.7 similarity, case-insensitive, ignore spaces, contains) against cached contacts.
 */
async function resolvePersonToContact(spokenPerson: string): Promise<{
  status: 'found' | 'ambiguous' | 'not_found';
  contact?: RoseContact;
  matches?: RoseContact[];
  permissionError?: string;
}> {
  const raw = String(spokenPerson || '').trim();
  const cleanName = cleanContactQueryName(raw) || raw;
  if (!cleanName) return { status: 'not_found' };

  const allRes = await getAllContacts(false);
  const allContacts = allRes.contacts;

  // 1. Check saved alias map ("rose_contact_alias")
  const aliased = lookupContactAlias(cleanName);
  if (aliased) {
    const aliasNum = extractPhoneNumberFromText(aliased);
    if (aliasNum) {
      return {
        status: 'found',
        contact: { name: cleanName, number: aliasNum, source: 'local' },
      };
    }
    const aliasMatches = matchSpellingsAgainstContacts(
      [aliased, bengaliToLatinApprox(aliased)],
      allContacts
    );
    if (aliasMatches.length === 1 || (aliasMatches.length > 1 && aliasMatches[0].score >= 0.96)) {
      return { status: 'found', contact: aliasMatches[0].contact };
    }
    if (aliasMatches.length > 1) {
      return {
        status: 'ambiguous',
        matches: aliasMatches.slice(0, 3).map((m) => m.contact),
      };
    }
  }

  // 2. Direct & local transliteration match first (fast path)
  const localVariants = Array.from(
    new Set([raw, cleanName, bengaliToLatinApprox(cleanName)].map((s) => s.trim()).filter(Boolean))
  );
  const fastMatches = matchSpellingsAgainstContacts(localVariants, allContacts);

  // If there's a clear exact/single fast match, use it without extra latency
  if (fastMatches.length === 1 && fastMatches[0].score >= 0.85) {
    return { status: 'found', contact: fastMatches[0].contact };
  }
  if (fastMatches.length > 1 && fastMatches[0].score >= 0.97 && fastMatches[1].score < 0.9) {
    return { status: 'found', contact: fastMatches[0].contact };
  }

  // 3. Ask chat model (short, JSON only) for up to 5 likely English/Latin spellings & nicknames
  const aiVariants = await getAiSpellingVariants(cleanName);
  const allSpellings = Array.from(new Set([...localVariants, ...aiVariants].filter(Boolean)));
  const finalMatches = matchSpellingsAgainstContacts(allSpellings, allContacts);

  if (finalMatches.length === 0) {
    // Also check shared recent message history (if a number was mentioned in chat/voice)
    const histNum = lookupNumberInSharedHistory(cleanName);
    if (histNum) {
      return {
        status: 'found',
        contact: { name: cleanName, number: histNum, source: 'local' },
      };
    }
    return { status: 'not_found', permissionError: allRes.error };
  }

  if (finalMatches.length === 1) {
    return { status: 'found', contact: finalMatches[0].contact };
  }

  // If top result is an exact full-name match (score === 1.0) while second is strictly lower (< 0.96)
  if (finalMatches[0].score >= 0.98 && finalMatches[1].score < 0.95) {
    return { status: 'found', contact: finalMatches[0].contact };
  }

  return {
    status: 'ambiguous',
    matches: finalMatches.slice(0, 3).map((m) => m.contact),
  };
}

function lookupNumberInSharedHistory(nameQuery: string): string | null {
  const qLower = nameQuery.trim().toLowerCase();
  if (!qLower) return null;
  const history = getSharedRecentMessages();
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.text.toLowerCase().includes(qLower)) {
      const extracted = extractPhoneNumberFromText(msg.text);
      if (extracted) return extracted;
    }
  }
  return null;
}

/**
 * Legacy helper kept exported for compatibility.
 */
export function lookupContactByName(rawName: string): RoseContact | null {
  const clean = cleanContactQueryName(rawName) || String(rawName || '').trim();
  if (!clean) return null;
  const aliased = lookupContactAlias(clean);
  const queryTerms = [clean, aliased || '', bengaliToLatinApprox(clean)].filter(Boolean);
  const local = getSavedInAppContacts();
  const matches = matchSpellingsAgainstContacts(queryTerms, local);
  return matches[0]?.contact || null;
}

export async function searchContacts(
  query: string
): Promise<{ ok: boolean; contacts: RoseContact[]; message: string; permissionError?: string }> {
  const q = cleanContactQueryName(query) || String(query || '').trim();
  const allRes = await getAllContacts(false);
  const aliased = lookupContactAlias(q);
  const aiVariants = q ? await getAiSpellingVariants(q) : [];
  const spellings = Array.from(
    new Set([q, aliased || '', bengaliToLatinApprox(q), ...aiVariants].filter(Boolean))
  );

  const matched = q
    ? matchSpellingsAgainstContacts(spellings, allRes.contacts).map((m) => m.contact)
    : allRes.contacts;

  return {
    ok: !allRes.error || matched.length > 0,
    contacts: matched,
    message: allRes.error || '',
    permissionError: allRes.error,
  };
}

// ============================================================================
// Pending State Management (Confirmations, Disambiguation, Alias Learning)
// ============================================================================

function getPendingState(): PendingPhoneState | null {
  const now = Date.now();
  if (memoryPendingState && now - memoryPendingState.timestamp < PENDING_TIMEOUT_MS) {
    return memoryPendingState;
  }
  memoryPendingState = null;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(PENDING_PHONE_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && now - Number(parsed.timestamp || 0) < PENDING_TIMEOUT_MS) {
          memoryPendingState = parsed;
          return memoryPendingState;
        } else {
          localStorage.removeItem(PENDING_PHONE_STATE_KEY);
        }
      }
    } catch {}
  }
  return null;
}

function setPendingState(state: PendingPhoneState | null): void {
  memoryPendingState = state;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (state) {
      localStorage.setItem(PENDING_PHONE_STATE_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(PENDING_PHONE_STATE_KEY);
    }
  } catch {}
}

export function hasPendingPhoneInteraction(): boolean {
  return Boolean(getPendingState());
}

function getRecentDedupeReply(signature: string): string | null {
  if (!lastActionCache) return null;
  if (lastActionCache.signature === signature && Date.now() - lastActionCache.timestamp < DEDUPE_WINDOW_MS) {
    return lastActionCache.reply;
  }
  return null;
}

function saveDedupeReply(signature: string, reply: string): void {
  lastActionCache = {
    signature,
    reply,
    timestamp: Date.now(),
  };
}

// ============================================================================
// Native Action Execution (ONLY called AFTER user confirms yes)
// ============================================================================

async function performNativePhoneCall(contact: RoseContact): Promise<string> {
  const plugin = getRosePhonePlugin();
  const dialNum = formatDialableNumber(contact.number);
  if (!dialNum) {
    return 'সঠিক ফোন নম্বর নেই।';
  }

  if (isNativeRoseApp() && plugin && typeof plugin.call === 'function') {
    try {
      await plugin.call({ number: dialNum });
      return contact.name && contact.name !== contact.number
        ? `${contact.name}-কে কল দিচ্ছি।`
        : 'কল দিচ্ছি।';
    } catch (err: any) {
      const msg = String(err?.message || err || '').trim();
      logDevError({ area: 'other', message: `RosePhone.call error (${dialNum}): ${msg}` });
      return msg || 'কল দেওয়া যায়নি।';
    }
  }

  return openCallOrWhatsAppLink(contact.number, 'tel');
}

async function performNativeWhatsAppCall(contact: RoseContact, video: boolean): Promise<string> {
  const plugin = getRosePhonePlugin();

  if (isNativeRoseApp() && plugin && typeof plugin.whatsappCall === 'function') {
    try {
      await plugin.whatsappCall({ name: contact.name, video });
      return `${contact.name}-কে হোয়াটসঅ্যাপে ${video ? 'ভিডিও ' : ''}কল দিচ্ছি।`;
    } catch (err: any) {
      const msg = String(err?.message || err || '').trim();
      logDevError({ area: 'other', message: `RosePhone.whatsappCall error (${contact.name}, video=${video}): ${msg}` });
      // Requirement: If whatsappCall fails, say "WhatsApp-এ এই মানুষ পাওয়া যায়নি" and offer a normal phone call.
      if (contact.number) {
        setPendingState({
          type: 'awaiting_fallback_normal_call',
          contact,
          timestamp: Date.now(),
        });
        return 'WhatsApp-এ এই মানুষ পাওয়া যায়নি। নরমাল ফোন কল দেব? হ্যাঁ বললে দেব।';
      }
      return 'WhatsApp-এ এই মানুষ পাওয়া যায়নি।';
    }
  }

  if (contact.number) {
    return openCallOrWhatsAppLink(contact.number, 'whatsapp');
  }
  return 'WhatsApp-এ এই মানুষ পাওয়া যায়নি।';
}

async function performNativeWhatsAppMessage(contact: RoseContact, text: string): Promise<string> {
  const formatted = formatBangladeshiNumber(contact.number);
  if (!formatted) {
    return 'সঠিক ফোন নম্বর নেই।';
  }

  const plugin = getRosePhonePlugin();
  if (isNativeRoseApp() && plugin && typeof plugin.whatsappMessage === 'function') {
    try {
      await plugin.whatsappMessage({ number: formatted, text });
      return 'লেখা রেডি, শুধু Send চাপো।';
    } catch (err: any) {
      const msg = String(err?.message || err || '').trim();
      logDevError({ area: 'other', message: `RosePhone.whatsappMessage error (${formatted}): ${msg}` });
      openExternal(`https://wa.me/${formatted}${text ? `?text=${encodeURIComponent(text)}` : ''}`);
      return 'লেখা রেডি, শুধু Send চাপো।';
    }
  }

  openExternal(`https://wa.me/${formatted}${text ? `?text=${encodeURIComponent(text)}` : ''}`);
  return 'লেখা রেডি, শুধু Send চাপো।';
}

function buildConfirmationPrompt(
  actionType: PhoneActionType,
  contact: RoseContact,
  video?: boolean,
  messageText?: string
): string {
  const displayName = contact.name || contact.number;
  if (actionType === 'whatsapp_message') {
    const body = String(messageText || '').trim();
    if (!body) {
      setPendingState({
        type: 'awaiting_message_text',
        contact,
        timestamp: Date.now(),
      });
      return `${displayName}-কে কী মেসেজ পাঠাব?`;
    }
    setPendingState({
      type: 'awaiting_confirm',
      actionType: 'whatsapp_message',
      contact,
      messageText: body,
      timestamp: Date.now(),
    });
    return `${displayName}-কে এটা পাঠাব: '${body}'। ঠিক আছে?`;
  }

  if (actionType === 'whatsapp_call') {
    setPendingState({
      type: 'awaiting_confirm',
      actionType: 'whatsapp_call',
      contact,
      video: Boolean(video),
      timestamp: Date.now(),
    });
    return `${displayName}-কে হোয়াটসঅ্যাপে ${video ? 'ভিডিও ' : ''}কল দেব? হ্যাঁ বললে দেব।`;
  }

  setPendingState({
    type: 'awaiting_confirm',
    actionType: 'phone_call',
    contact,
    timestamp: Date.now(),
  });
  return `${displayName}-কে ফোন কল দেব? হ্যাঁ বললে দেব।`;
}

function formatAmbiguousPrompt(matches: RoseContact[]): string {
  const bnNums = ['১', '২', '৩'];
  return (
    'কোনটা? ' +
    matches
      .slice(0, 3)
      .map((c, idx) => `${bnNums[idx] || idx + 1}. ${c.name}`)
      .join(' ')
  );
}

// ============================================================================
// Public Phone Tools: phone_call, whatsapp_call, whatsapp_message, open_app
// ============================================================================

async function initiatePhoneAction(params: {
  actionType: PhoneActionType;
  person: string;
  video?: boolean;
  messageText?: string;
}): Promise<string> {
  const rawPerson = String(params.person || '').trim();
  if (!rawPerson) {
    return params.actionType === 'whatsapp_message'
      ? 'কাকে হোয়াটসঅ্যাপ মেসেজ পাঠাব নাম বা নম্বর বলো।'
      : 'কাকে কল দেব নাম বা নম্বর বলো।';
  }

  // Requirement 3: If person is already a phone number, use it directly (still confirm!)
  const directNumber = extractPhoneNumberFromText(rawPerson);
  if (directNumber) {
    const numberContact: RoseContact = {
      name: directNumber,
      number: directNumber,
      source: 'local',
    };
    return buildConfirmationPrompt(params.actionType, numberContact, params.video, params.messageText);
  }

  const res = await resolvePersonToContact(rawPerson);
  if (res.status === 'found' && res.contact) {
    return buildConfirmationPrompt(params.actionType, res.contact, params.video, params.messageText);
  }

  if (res.status === 'ambiguous' && res.matches && res.matches.length > 0) {
    setPendingState({
      type: 'awaiting_choice',
      actionType: params.actionType,
      contacts: res.matches.slice(0, 3),
      spokenName: cleanContactQueryName(rawPerson) || rawPerson,
      video: params.video,
      messageText: params.messageText,
      timestamp: Date.now(),
    });
    return formatAmbiguousPrompt(res.matches);
  }

  if (res.permissionError) {
    return res.permissionError;
  }

  const spokenClean = cleanContactQueryName(rawPerson) || rawPerson;
  setPendingState({
    type: 'awaiting_alias_or_number',
    actionType: params.actionType,
    spokenName: spokenClean,
    video: params.video,
    messageText: params.messageText,
    timestamp: Date.now(),
  });
  return 'এই নামে কাউকে পেলাম না। ফোনে নামটা কীভাবে সেভ করা আছে বলো?';
}

export async function phone_call(person: string): Promise<string> {
  return initiatePhoneAction({ actionType: 'phone_call', person });
}

export async function whatsapp_call(person: string, video: boolean = false): Promise<string> {
  return initiatePhoneAction({ actionType: 'whatsapp_call', person, video });
}

export async function whatsapp_message(params: {
  person?: string;
  name?: string;
  number?: string;
  message?: string;
  text?: string;
}): Promise<string> {
  const person = String(params?.person || params?.name || params?.number || '').trim();
  const messageText = String(params?.message || params?.text || '').trim();
  return initiatePhoneAction({ actionType: 'whatsapp_message', person, messageText });
}

export async function call_contact(
  name: string,
  channel: 'whatsapp' | 'tel' = 'tel',
  video: boolean = false
): Promise<string> {
  return channel === 'whatsapp' ? whatsapp_call(name, video) : phone_call(name);
}

export async function call_number(
  number: string,
  channel?: 'whatsapp' | 'tel',
  _contactName?: string,
  video: boolean = false
): Promise<string> {
  return channel === 'whatsapp' ? whatsapp_call(number, video) : phone_call(number);
}

export async function call(params: { number: string; channel?: 'whatsapp' | 'tel' } | string): Promise<string> {
  const rawNum = typeof params === 'string' ? params : params?.number;
  const channel = typeof params === 'object' ? params?.channel : undefined;
  return call_number(String(rawNum || ''), channel);
}

export function resolveAppKey(rawName: string): { key: string; pkg: string; label: string } | null {
  const clean = String(rawName || '').trim().toLowerCase();
  if (!clean) return null;

  if (APP_PACKAGE_MAP[clean]) {
    return { key: clean, ...APP_PACKAGE_MAP[clean] };
  }

  for (const entry of APP_ALIASES) {
    if (entry.patterns.some((re) => re.test(clean))) {
      return { key: entry.key, ...APP_PACKAGE_MAP[entry.key] };
    }
  }

  return null;
}

export async function open_app(name: string): Promise<string> {
  const resolved = resolveAppKey(name);
  const plugin = getRosePhonePlugin();

  if (isNativeRoseApp() && plugin && typeof plugin.openApp === 'function' && resolved) {
    const sig = `open_app:${resolved.key}`;
    const deduped = getRecentDedupeReply(sig);
    if (deduped) return deduped;

    try {
      await plugin.openApp({ package: resolved.pkg });
      const msg = `${resolved.key} খুললাম।`;
      saveDedupeReply(sig, msg);
      return msg;
    } catch (err: any) {
      const realErr = String(err?.message || err || 'openApp failed').trim();
      logDevError({ area: 'other', message: `RosePhone.openApp error (${resolved.pkg}): ${realErr}` });
      return `${resolved.key} খোলা যায়নি: ${realErr}`;
    }
  }

  if (resolved?.key === 'whatsapp') {
    openExternal('https://wa.me/');
    return 'whatsapp খুললাম।';
  }

  if (!isNativeRoseApp()) {
    return ONLY_IN_ROSE_APP_MSG;
  }

  if (!resolved) {
    return `এই অ্যাপটি তালিকায় নেই (${name})।`;
  }

  const errMsg = 'RosePhone.openApp প্লাগইন পাওয়া যায়নি।';
  logDevError({ area: 'other', message: errMsg });
  return errMsg;
}

export const openApp = open_app;
export const callContact = call_contact;
export const callNumber = call_number;
export const whatsappCall = whatsapp_call;
export const whatsappMessage = whatsapp_message;

// ============================================================================
// Confirmation & Multi-Turn Pending Replies
// ============================================================================

function isAffirmativeReply(text: string): boolean {
  return /^(?:হ্যাঁ|হ্যা|হাঁ|হুঁ|হু|জি|জ্বি|yes|yeah|yep|yup|sure|ok|okay|আচ্ছা|ঠিক\s*আছে|ঠিক|অবশ্যই|দাও|দিন|দে|করো|কর|পাঠাও|পাঠিয়ে\s*দাও|কল\s*দাও|একদম|চলবে)[।.!\s]*$/i.test(
    text.trim()
  );
}

function isNegativeReply(text: string): boolean {
  return /^(?:না|নাহ|no|nope|nah|cancel|stop|থাক|বাদ\s*দাও|দরকার\s*নেই|লাগবে\s*না|ক্যানসেল|বন্ধ\s*করো|করো\s*না|দিও\s*না)[।.!\s]*$/i.test(
    text.trim()
  );
}

export async function handlePendingPhoneConfirmation(decision: 'yes' | 'no'): Promise<{
  handled: boolean;
  reply?: string;
}> {
  const pending = getPendingState();
  if (!pending) return { handled: false };

  if (pending.type === 'awaiting_confirm') {
    setPendingState(null);
    if (decision === 'no') {
      return { handled: true, reply: 'ঠিক আছে, বাতিল করলাম।' };
    }
    if (pending.actionType === 'whatsapp_message') {
      const reply = await performNativeWhatsAppMessage(pending.contact, pending.messageText || '');
      return { handled: true, reply };
    }
    if (pending.actionType === 'whatsapp_call') {
      const reply = await performNativeWhatsAppCall(pending.contact, Boolean(pending.video));
      return { handled: true, reply };
    }
    const reply = await performNativePhoneCall(pending.contact);
    return { handled: true, reply };
  }

  if (pending.type === 'awaiting_fallback_normal_call') {
    setPendingState(null);
    if (decision === 'no') {
      return { handled: true, reply: 'ঠিক আছে, কল দিচ্ছি না।' };
    }
    const reply = await performNativePhoneCall(pending.contact);
    return { handled: true, reply };
  }

  return { handled: false };
}

export async function handlePendingPhoneUserReply(
  userText: string
): Promise<{ handled: boolean; reply?: string }> {
  const raw = String(userText || '').trim();
  if (!raw) return { handled: false };

  const pending = getPendingState();
  if (!pending) return { handled: false };

  // 1. Confirmation for call / WhatsApp call / WhatsApp message
  if (pending.type === 'awaiting_confirm') {
    if (isAffirmativeReply(raw)) {
      return handlePendingPhoneConfirmation('yes');
    }
    if (isNegativeReply(raw)) {
      return handlePendingPhoneConfirmation('no');
    }
    // If they gave edited message text while confirming a WhatsApp message (e.g. "না, লিখো আমি বের হচ্ছি")
    if (pending.actionType === 'whatsapp_message') {
      const editMatch = raw.match(/(?:লিখো|লেখো|পাঠাও|বদলিয়ে|বদলে|change\s*to)\s*[:\-]?\s*(.+)$/i);
      if (editMatch && editMatch[1]) {
        const newBody = editMatch[1].trim();
        return {
          handled: true,
          reply: buildConfirmationPrompt('whatsapp_message', pending.contact, false, newBody),
        };
      }
    }
    return { handled: false };
  }

  // 2. Normal phone call fallback confirmation after WhatsApp call failed
  if (pending.type === 'awaiting_fallback_normal_call') {
    if (isAffirmativeReply(raw)) {
      return handlePendingPhoneConfirmation('yes');
    }
    if (isNegativeReply(raw)) {
      return handlePendingPhoneConfirmation('no');
    }
    return { handled: false };
  }

  // 3. Disambiguation choice (1, 2, 3, or name)
  if (pending.type === 'awaiting_choice') {
    if (isNegativeReply(raw)) {
      setPendingState(null);
      return { handled: true, reply: 'ঠিক আছে, বাতিল করলাম।' };
    }
    const normDigits = normalizeBengaliDigits(raw).replace(/[^\d]/g, '');
    let chosen: RoseContact | null = null;
    if (/^[123]$/.test(normDigits)) {
      chosen = pending.contacts[parseInt(normDigits, 10) - 1] || null;
    } else if (/^(?:প্রথম|এক|first)/i.test(raw)) {
      chosen = pending.contacts[0] || null;
    } else if (/^(?:দ্বিতীয়|দুই|second)/i.test(raw)) {
      chosen = pending.contacts[1] || null;
    } else if (/^(?:তৃতীয়|তিন|third)/i.test(raw)) {
      chosen = pending.contacts[2] || null;
    } else {
      const scored = matchSpellingsAgainstContacts([raw, bengaliToLatinApprox(raw)], pending.contacts);
      chosen = scored[0]?.contact || null;
    }

    if (chosen) {
      return {
        handled: true,
        reply: buildConfirmationPrompt(pending.actionType, chosen, pending.video, pending.messageText),
      };
    }
    return { handled: false };
  }

  // 4. Waiting for saved contact name or phone number after 0 matches
  if (pending.type === 'awaiting_alias_or_number') {
    if (isNegativeReply(raw)) {
      setPendingState(null);
      return { handled: true, reply: 'ঠিক আছে, বাতিল করলাম।' };
    }
    const cleanedAnswer = raw
      .replace(/^(?:ফোনে\s*)?(?:নামটা|নাম)?\s*(?:হলো|হল|হচ্ছে|আছে|সেভ\s*করা\s*আছে)?\s*/i, '')
      .replace(/(?:নামে\s*সেভ\s*করা\s*আছে|সেভ\s*করা\s*আছে|বলে\s*সেভ\s*করা)$/i, '')
      .trim();

    if (!cleanedAnswer) return { handled: false };

    const num = extractPhoneNumberFromText(cleanedAnswer);
    if (num) {
      saveInAppContact(pending.spokenName, num);
      saveContactAlias(pending.spokenName, num);
      const contact: RoseContact = { name: pending.spokenName, number: num, source: 'local' };
      return {
        handled: true,
        reply: buildConfirmationPrompt(pending.actionType, contact, pending.video, pending.messageText),
      };
    }

    // Save the alias in rose_contact_alias and look up the newly named contact
    saveContactAlias(pending.spokenName, cleanedAnswer);
    const allRes = await getAllContacts(false);
    const aliasMatches = matchSpellingsAgainstContacts(
      [cleanedAnswer, bengaliToLatinApprox(cleanedAnswer)],
      allRes.contacts
    );

    if (aliasMatches.length === 1 || (aliasMatches.length > 1 && aliasMatches[0].score >= 0.96)) {
      const matched = aliasMatches[0].contact;
      saveContactAlias(pending.spokenName, matched.name);
      return {
        handled: true,
        reply: buildConfirmationPrompt(pending.actionType, matched, pending.video, pending.messageText),
      };
    }

    if (aliasMatches.length > 1) {
      setPendingState({
        type: 'awaiting_choice',
        actionType: pending.actionType,
        contacts: aliasMatches.slice(0, 3).map((m) => m.contact),
        spokenName: pending.spokenName,
        video: pending.video,
        messageText: pending.messageText,
        timestamp: Date.now(),
      });
      return {
        handled: true,
        reply: formatAmbiguousPrompt(aliasMatches.slice(0, 3).map((m) => m.contact)),
      };
    }

    // Still 0 matches — keep spokenName and offer to take raw number next
    return {
      handled: true,
      reply: `‘${cleanedAnswer}’ নামেও ফোনে পেলাম না। সরাসরি নম্বরটা বলো?`,
    };
  }

  // 5. Waiting for WhatsApp message text when user didn't provide body yet
  if (pending.type === 'awaiting_message_text') {
    if (isNegativeReply(raw)) {
      setPendingState(null);
      return { handled: true, reply: 'ঠিক আছে, বাতিল করলাম।' };
    }
    return {
      handled: true,
      reply: buildConfirmationPrompt('whatsapp_message', pending.contact, false, raw),
    };
  }

  return { handled: false };
}

// ============================================================================
// Tool Execution Dispatchers (Gemini Live & Typed Chat)
// ============================================================================

export async function executePhoneToolActionByName(
  toolName: string,
  args: Record<string, any> = {}
): Promise<{ ok: boolean; message: string; contacts?: RoseContact[] }> {
  const name = String(toolName || '').trim().toLowerCase();

  if (name === 'phone_call') {
    const person = String(args.person || args.name || args.number || '').trim();
    const msg = await phone_call(person);
    return { ok: true, message: msg };
  }

  if (name === 'whatsapp_call') {
    const person = String(args.person || args.name || args.number || '').trim();
    const video = Boolean(args.video);
    const msg = await whatsapp_call(person, video);
    return { ok: true, message: msg };
  }

  if (name === 'whatsapp_message') {
    const person = String(args.person || args.name || args.number || '').trim();
    const message = String(args.message || args.text || '').trim();
    const msg = await whatsapp_message({ person, message });
    return { ok: true, message: msg };
  }

  if (name === 'phone_confirm') {
    const rawDec = String(args.decision || '').trim().toLowerCase();
    const decision: 'yes' | 'no' =
      rawDec === 'no' || rawDec === 'false' || rawDec === 'cancel' ? 'no' : 'yes';
    const res = await handlePendingPhoneConfirmation(decision);
    if (res.handled && res.reply) {
      return { ok: true, message: res.reply };
    }
    return { ok: false, message: 'কোনো কল বা মেসেজ অনুমতির অপেক্ষায় নেই।' };
  }

  if (name === 'save_contact_alias') {
    const spoken = String(args.spoken_name || args.alias || '').trim();
    const target = String(args.saved_name || args.target || '').trim();
    if (spoken && target && saveContactAlias(spoken, target)) {
      return { ok: true, message: `মনে রাখলাম, ‘${spoken}’ মানে ‘${target}’।` };
    }
    return { ok: false, message: 'নামটা ঠিকমতো বোঝা যায়নি।' };
  }

  return executePhoneToolAction(args);
}

export async function executePhoneToolAction(args: {
  action?: string;
  person?: string;
  name?: string;
  number?: string;
  phone_number?: string;
  name_or_number?: string;
  query?: string;
  app?: string;
  app_name?: string;
  channel?: string;
  via?: string;
  video?: boolean;
  text?: string;
  message?: string;
}): Promise<{ ok: boolean; message: string; contacts?: RoseContact[] }> {
  const action = String(args?.action || '').trim().toLowerCase();
  const rawChannel = String(args?.channel || args?.via || '').trim().toLowerCase();
  const rawNum = String(args?.number || args?.phone_number || '').trim();
  const rawPerson = String(args?.person || args?.name || args?.name_or_number || args?.query || '').trim();
  const msgText = String(args?.text || args?.message || '').trim();
  const video = Boolean(args?.video) || isVideoCallRequest(action) || isVideoCallRequest(rawPerson);

  if (action === 'open_app' || (!action && (args?.app || args?.app_name))) {
    const appName = String(args?.name || args?.app || args?.app_name || '').trim();
    const msg = await open_app(appName);
    return { ok: msg.endsWith('খুললাম।'), message: msg };
  }

  if (action === 'search_contacts') {
    const res = await searchContacts(rawPerson);
    if (res.permissionError && res.contacts.length === 0) {
      return { ok: false, message: res.permissionError, contacts: [] };
    }
    if (res.contacts.length === 0) {
      return { ok: true, message: 'এই নামে কোনো কন্টাক্ট পেলাম না।', contacts: [] };
    }
    const top = res.contacts.slice(0, 5);
    return {
      ok: true,
      contacts: top,
      message: top.map((c) => `${c.name}: ${c.number}`).join(', '),
    };
  }

  if (action === 'get_all_contacts') {
    const res = await getAllContacts(Boolean((args as any)?.refresh));
    if (res.error && res.contacts.length === 0) {
      return { ok: false, message: res.error, contacts: [] };
    }
    return {
      ok: true,
      contacts: res.contacts.slice(0, 20),
      message: `মোট ${res.contacts.length}টি কন্টাক্ট আছে।`,
    };
  }

  if (action === 'whatsapp_message') {
    const msg = await whatsapp_message({
      person: rawPerson || rawNum,
      message: msgText,
    });
    return { ok: true, message: msg };
  }

  const isWa =
    action === 'whatsapp_call' ||
    rawChannel === 'whatsapp' ||
    action.includes('whatsapp') ||
    isWhatsAppRequest(rawPerson);

  if (action === 'whatsapp_call' || isWa) {
    const msg = await whatsapp_call(rawPerson || rawNum, video);
    return { ok: true, message: msg };
  }

  if (rawPerson || rawNum) {
    const msg = await phone_call(rawPerson || rawNum);
    return { ok: true, message: msg };
  }

  return { ok: false, message: 'কার নম্বরে কল দেব নামটা বলো।' };
}

// ============================================================================
// Text & Voice Intent Router
// ============================================================================

function parseAliasTeachCommand(text: string): { spoken: string; target: string } | null {
  const m = text.match(/^(?:(?:রোজ|rose)\s*[,।:!-]?\s*)?(.{2,30}?)\s*(?:মানে|=)\s*(.{2,45}?)[।.!]*$/i);
  if (!m || !m[1] || !m[2]) return null;
  const spoken = cleanContactQueryName(m[1]) || m[1].trim();
  const target = m[2].trim();
  if (!spoken || !target) return null;
  // Ignore questions like "এর মানে কী"
  if (/(?:\?|কী|কি|কেন|কোথায়|কোনটা|কখন|\bwhat\b|\bwhy\b|\bhow\b|\bmean\b)/i.test(target)) {
    return null;
  }
  const hasLatinOrNumber = /[A-Za-z]/.test(target) || Boolean(extractPhoneNumberFromText(target));
  const hasContactCue = /(?:কন্টাক্ট|ফোনে|নামে|সেভ)/i.test(text);
  if (!hasLatinOrNumber && !hasContactCue) {
    return null;
  }
  return { spoken, target };
}

function parseWhatsAppMessageIntent(text: string): {
  matched: boolean;
  target?: string;
  body?: string;
} {
  if (!isWhatsAppRequest(text)) return { matched: false };

  const hasMsgVerb =
    /(?:মেসেজ|ম্যাসেজ|বার্তা|লেখো|লিখো|লিখে\s*দাও|পাঠাও|পাঠিয়ে\s*দাও|সেন্ড|\bmessage\b|\bmsg\b|\bsend\b|\btext\b)/i.test(
      text
    );
  if (!hasMsgVerb) return { matched: false };

  const isPureCall = /(?:কল\s*দাও|কল\s*করো|ফোন\s*দাও|\bcall\b)/i.test(text);
  if (isPureCall) return { matched: false };

  const bnMatch = text.match(
    /^(?:(?:হ্যালো|হাই|এই|শোনো)\s+)?(?:(?:রোজ|rose)\s*[,।:!-]?\s*)?(.+?)(?:কে|কে\s+|এর\s+নম্বরে|নম্বরে|এ)\s+.*?(?:মেসেজ|ম্যাসেজ|বার্তা|লেখো|লিখো|পাঠাও|পাঠিয়ে\s*দাও|দাও|করো)\s*(?:যে|বলে|লিখে|:|-)?\s*(.*)$/i
  );
  if (bnMatch && bnMatch[1]) {
    const target = cleanContactQueryName(
      bnMatch[1].replace(/(?:হোয়াটসঅ্যাপে|হোয়াটসঅ্যাপে|হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ|whatsapp[-\s]*এ?)/gi, ' ')
    );
    const body = String(bnMatch[2] || '')
      .replace(/^(?:যে|বলে|লিখে|:|-)\s*/i, '')
      .trim();
    if (target) {
      return { matched: true, target, body };
    }
  }

  const enMatch = text.match(
    /(?:whatsapp|হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ)\s*(?:message|msg|text|মেসেজ)?\s*(?:to\s+)?([^\d:+]+?|[+০-৯0-9\-\s]{7,})(?:\s*(?:saying|that|:|-|,|যে)\s*(.*))?$/i
  );
  if (enMatch && enMatch[1]) {
    const target = cleanContactQueryName(enMatch[1]) || enMatch[1].trim();
    const body = String(enMatch[2] || '').trim();
    if (target) {
      return { matched: true, target, body };
    }
  }

  return { matched: false };
}

export async function routePhoneActionFromText(
  rawMessage: string
): Promise<{ matched: boolean; reply?: string }> {
  const text = String(rawMessage || '').trim();
  if (!text) return { matched: false };

  // 1. Check pending confirmation / disambiguation / alias or number reply
  const pendingRes = await handlePendingPhoneUserReply(text);
  if (pendingRes.handled && pendingRes.reply) {
    return { matched: true, reply: pendingRes.reply };
  }

  const isPcExplicit = /(পিসিতে|পিসির|ল্যাপটপে|কম্পিউটারে|\bon\s+pc\b|\bpc\b)/i.test(text);
  if (isPcExplicit) return { matched: false };

  // 2. Teach alias directly: e.g. "আম্মু মানে Ammu Home"
  const teachAlias = parseAliasTeachCommand(text);
  if (teachAlias) {
    // Try resolving target against cached contacts so we store the exact display name if found
    const allRes = await getAllContacts(false);
    const targetMatches = matchSpellingsAgainstContacts([teachAlias.target], allRes.contacts);
    const canonicalTarget =
      targetMatches.length === 1 || (targetMatches.length > 1 && targetMatches[0].score >= 0.95)
        ? targetMatches[0].contact.name
        : teachAlias.target;
    saveContactAlias(teachAlias.spoken, canonicalTarget);
    return {
      matched: true,
      reply: `মনে রাখলাম, ‘${teachAlias.spoken}’ মানে ‘${canonicalTarget}’।`,
    };
  }

  // 3. Standalone number only ("01712345678") -> use directly (still confirm)
  const standaloneNum = isStandalonePhoneNumber(text);
  if (standaloneNum) {
    const reply = await phone_call(standaloneNum);
    return { matched: true, reply };
  }

  // 4. Explicit WhatsApp message intent
  const waMsgIntent = parseWhatsAppMessageIntent(text);
  if (waMsgIntent.matched && waMsgIntent.target) {
    // If the user explicitly gave message text, route & confirm directly;
    // if they wrote a high-level instruction without quoted text (e.g. "রহিমকে জানাও আসতে দেরি হবে"),
    // let's only intercept when body text was extracted or person was parsed cleanly
    const reply = await whatsapp_message({
      person: waMsgIntent.target,
      message: waMsgIntent.body || '',
    });
    return { matched: true, reply };
  }

  // 5. Call / WhatsApp call intent (always confirms before dialing)
  const extractedNumber = extractPhoneNumberFromText(text);
  const hasCallVerb =
    /(কল\s*(দাও|দেও|দে|দেন|দিন|করো|কর|করুন|করে\s*দাও|দেব|দিব)|ফোন\s*(দাও|দেও|দে|দেন|দিন|করো|কর|করুন|করে\s*দাও)|ডায়াল\s*করো|হোয়াটসঅ্যাপ\s*করো|হোয়াটসঅ্যাপ\s*করো|\bcall\b|\bdial\b)/i.test(
      text
    );

  if (hasCallVerb) {
    const isWa = isWhatsAppRequest(text);
    const video = isVideoCallRequest(text);

    if (extractedNumber) {
      const reply = isWa
        ? await whatsapp_call(extractedNumber, video)
        : await phone_call(extractedNumber);
      return { matched: true, reply };
    }

    if (/(?:এই\s*নম্বরে|ওই\s*নম্বরে|নম্বরটাতে|নাম্বারটাতে|এই\s*নাম্বারে|ওকে|তাকে|উনাকে)/i.test(text)) {
      const history = getSharedRecentMessages();
      for (let i = history.length - 1; i >= 0; i--) {
        const recentNum = extractPhoneNumberFromText(history[i].text);
        if (recentNum) {
          const reply = isWa ? await whatsapp_call(recentNum, video) : await phone_call(recentNum);
          return { matched: true, reply };
        }
      }
    }

    const contactName = cleanContactQueryName(text);
    if (contactName) {
      const reply = isWa
        ? await whatsapp_call(contactName, video)
        : await phone_call(contactName);
      return { matched: true, reply };
    }
  }

  // 6. Open app intent
  const hasOpenVerb = /(খোলো|খোল|খুলো|খুলে\s*দাও|চালু\s*করো|চালাও|ওপেন\s*করো|ওপেন|\bopen\b|\blaunch\b)/i.test(text);
  if (hasOpenVerb && !hasCallVerb) {
    const resolvedApp = resolveAppKey(text);
    if (resolvedApp) {
      const reply = await open_app(resolvedApp.key);
      return { matched: true, reply };
    }
  }

  return { matched: false };
}

export function getSharedPhoneAndHistoryContextBlock(): string {
  const aliases = getContactAliasMap();
  const contacts = getSavedInAppContacts();
  const history = getSharedRecentMessages().slice(-12);
  const lines: string[] = [];

  if (Object.keys(aliases).length > 0) {
    lines.push(
      `SAVED CONTACT ALIASES: ${Object.entries(aliases)
        .map(([k, v]) => `${k} -> ${v}`)
        .join(', ')}`
    );
  }

  if (contacts.length > 0) {
    lines.push(
      `SAVED CONTACTS (localStorage): ${contacts.map((c) => `${c.name}: ${c.number}`).join(', ')}`
    );
  }

  if (history.length > 0) {
    lines.push(
      `RECENT SHARED MESSAGE HISTORY (Chat & Voice):\n` +
        history.map((m) => `${m.role === 'assistant' ? 'Rose' : 'User'}: ${m.text}`).join('\n')
    );
  }

  return lines.join('\n\n');
}
