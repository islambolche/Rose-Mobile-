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
const PENDING_TIMEOUT_MS = 30 * 1000; // 30 seconds
const AUTO_EXECUTE_DELAY_MS = 3000; // 3 seconds for calls and whatsapp_send
const DEDUPE_WINDOW_MS = 2000;

export type PhoneActionType =
  | 'phone_call'
  | 'whatsapp_call'
  | 'whatsapp_message'
  | 'messenger_send'
  | 'post_video'
  | 'app_search';

export type PostVideoPlatform = 'youtube' | 'facebook' | 'instagram' | 'tiktok';
export type SearchAppId = 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'google';

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
      platform?: PostVideoPlatform;
      pkg?: string;
      title?: string;
      postText?: string;
      searchApp?: SearchAppId;
      searchQuery?: string;
      timestamp: number;
    }
  | {
      type: 'awaiting_auto_cancel';
      actionType: 'phone_call' | 'whatsapp_call' | 'whatsapp_message';
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
      type: 'awaiting_messenger_recipient';
      messageText: string;
      timestamp: number;
    }
  | {
      type: 'awaiting_post_video_tap';
      platformLabel: string;
      pkg: string;
      title: string;
      text: string;
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
let activeAutoExecuteTimer: ReturnType<typeof setTimeout> | null = null;
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

const POST_VIDEO_PLATFORM_MAP: Record<PostVideoPlatform, { pkg: string; label: string }> = {
  youtube: { pkg: 'com.google.android.youtube', label: 'YouTube' },
  facebook: { pkg: 'com.facebook.katana', label: 'Facebook' },
  instagram: { pkg: 'com.instagram.android', label: 'Instagram' },
  tiktok: { pkg: 'com.zhiliaoapp.musically', label: 'TikTok' },
};

const SEARCH_APP_META: Record<SearchAppId, { label: string; webUrl: (q: string) => string }> = {
  youtube: {
    label: 'YouTube',
    webUrl: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  },
  facebook: {
    label: 'Facebook',
    webUrl: (q) => `https://www.facebook.com/search/top?q=${encodeURIComponent(q)}`,
  },
  instagram: {
    label: 'Instagram',
    webUrl: (q) => `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(q)}`,
  },
  tiktok: {
    label: 'TikTok',
    webUrl: (q) => `https://www.tiktok.com/search?q=${encodeURIComponent(q)}`,
  },
  google: {
    label: 'Google',
    webUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkAccessibilityOn(plugin: any): Promise<boolean> {
  if (!plugin || typeof plugin.isAccessibilityOn !== 'function') return false;
  try {
    const res = await plugin.isAccessibilityOn();
    if (typeof res === 'boolean') return res;
    return Boolean(res?.enabled ?? res?.on ?? res?.isOn ?? res?.active ?? res?.value);
  } catch {
    return false;
  }
}

function didClickTextSucceed(res: any): boolean {
  if (typeof res === 'boolean') return res;
  if (res && typeof res === 'object') {
    if ('clicked' in res) return Boolean(res.clicked);
    if ('success' in res) return Boolean(res.success);
    if ('ok' in res) return Boolean(res.ok);
  }
  return true;
}

const ACCESSIBILITY_NEEDED_MSG = 'অটো-চাপার জন্য Accessibility চালু করো';

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

const WORD_CHAR_RE = /[\p{L}\p{N}\p{M}]/u;

function hasWholePhrase(text: string, phrase: string): boolean {
  const haystack = String(text || '').toLowerCase();
  const needle = String(phrase || '').trim().toLowerCase();
  if (!haystack || !needle) return false;
  let fromIndex = 0;
  while (fromIndex <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, fromIndex);
    if (idx === -1) break;
    const beforeChar = idx > 0 ? haystack[idx - 1] : '';
    const afterIdx = idx + needle.length;
    const afterChar = afterIdx < haystack.length ? haystack[afterIdx] : '';
    const beforeOk = !beforeChar || !WORD_CHAR_RE.test(beforeChar);
    const afterOk = !afterChar || !WORD_CHAR_RE.test(afterChar);
    if (beforeOk && afterOk) {
      return true;
    }
    fromIndex = idx + 1;
  }
  return false;
}

function hasAnyWholePhrase(text: string, phrases: string[]): boolean {
  return phrases.some((p) => hasWholePhrase(text, p));
}

const NON_CONTACT_STOPWORDS = new Set([
  'আমি', 'আমাকে', 'আমার', 'আমরা', 'আমাদের',
  'তুমি', 'তোমাকে', 'তোমার', 'তোমরা', 'তোমাদের', 'তোর', 'তোকে',
  'আপনি', 'আপনাকে', 'আপনার', 'আপনারা',
  'সে', 'তাকে', 'তার', 'তারা', 'ও', 'ওকে', 'ওর', 'উনি', 'উনাকে', 'উনার',
  'এটা', 'ওটা', 'সেটা', 'এইটা', 'ওইটা', 'এগুলো', 'ওগুলো',
  'একটা', 'একটি', 'কিছু', 'কোনো', 'কোন', 'সব', 'সবাই', 'কেউ', 'কারো', 'কাউকে',
  'কী', 'কি', 'কেন', 'কোথায়', 'কখন', 'কেমন', 'কত',
  'হ্যাঁ', 'না', 'নাহ', 'ঠিক', 'ভালো', 'খারাপ', 'নতুন', 'পুরনো',
  'পড়ালেখা', 'পড়াশোনা', 'বই', 'বইটা', 'ছবি', 'ছবিটা', 'ভিডিও', 'ভিডিওটা',
  'ফাইল', 'ইমেইল', 'গান', 'খবর', 'টাকা', 'কাজ', 'অ্যাপ',
  'কল', 'ফোন', 'মেসেজ', 'বার্তা', 'পাঠাও', 'দাও', 'করো', 'কর', 'করুন',
  'লেখা', 'লেখো', 'লিখো', 'হোয়াটসঅ্যাপ', 'হোয়াটসঅ্যাপ', 'whatsapp',
  'call', 'phone', 'message', 'text', 'send', 'this', 'that', 'it', 'me', 'you', 'someone', 'anyone',
]);

function isValidExtractedContactName(candidate: string): boolean {
  const clean = String(candidate || '').trim();
  if (!clean) return false;
  if (extractPhoneNumberFromText(clean)) return true;
  if (clean.length < 2) return false;
  const lower = clean.toLowerCase();
  if (NON_CONTACT_STOPWORDS.has(lower)) return false;
  const tokens = lower.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.every((t) => NON_CONTACT_STOPWORDS.has(t))) return false;
  return true;
}

export function isWhatsAppRequest(text: string): boolean {
  const s = String(text || '');
  return hasAnyWholePhrase(s, [
    'whatsapp',
    'wa',
    'হোয়াটসঅ্যাপ',
    'হোয়াটসঅ্যাপ',
    'হোয়াটসঅ্যাপে',
    'হোয়াটসঅ্যাপে',
  ]);
}

export function isVideoCallRequest(text: string): boolean {
  const s = String(text || '');
  return hasAnyWholePhrase(s, ['ভিডিও কল', 'ভিডিওতে কল', 'video call', 'cam call', 'video']);
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
  s = s.replace(/(?:^|\s)(?:please|প্লিজ|একটু|এখনই|এখন|তাড়াতাড়ি)(?=$|\s)/gi, ' ');
  s = s.replace(
    /(?:^|\s)(?:হোয়াটসঅ্যাপে|হোয়াটসঅ্যাপে|হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ|whatsapp[-\s]*এ|on\s+whatsapp|in\s+whatsapp|via\s+whatsapp|whatsapp|নরমাল|সিমে|সিম|ফোনে|ডায়ালে|ভিডিওতে|ভিডিও|video)(?=$|\s)/gi,
    ' '
  );
  s = s.replace(
    /(?:^|\s)(?:এর\s+নম্বরে\s+|নম্বরে\s+)?(?:একটা\s+|একটি\s+)?(?:কল|ফোন|মেসেজ|call|phone|message|text)\s*(?:দাও|দেও|দে|দেন|দিন|করো|কর|করুন|করে\s*দাও|করে\s*দে|দেব|দিব|করব|করো\s*তো|দাও\s*তো|লিখে\s*পাঠাও|পাঠাও)?.*/i,
    ''
  );
  s = s.replace(/(?:^|\s)(?:call|dial|phone|ring|message|msg|send|text)(?=$|\s)/gi, ' ');
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

function clearAutoExecuteTimer(): void {
  if (activeAutoExecuteTimer) {
    clearTimeout(activeAutoExecuteTimer);
    activeAutoExecuteTimer = null;
  }
}

function getPendingState(): PendingPhoneState | null {
  const now = Date.now();
  const isStateValid = (st: PendingPhoneState | null): boolean => {
    if (!st) return false;
    const ttl = st.type === 'awaiting_auto_cancel' ? AUTO_EXECUTE_DELAY_MS + 1500 : PENDING_TIMEOUT_MS;
    return now - Number(st.timestamp || 0) < ttl;
  };

  if (memoryPendingState && isStateValid(memoryPendingState)) {
    return memoryPendingState;
  }
  memoryPendingState = null;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(PENDING_PHONE_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isStateValid(parsed)) {
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

function isConfirmPromptState(state: PendingPhoneState | null): boolean {
  return Boolean(
    state &&
      ((state.type === 'awaiting_confirm' &&
        state.actionType !== 'phone_call' &&
        state.actionType !== 'whatsapp_call' &&
        state.actionType !== 'whatsapp_message') ||
        state.type === 'awaiting_post_video_tap' ||
        state.type === 'awaiting_fallback_normal_call')
  );
}

function isAutoCancelPromptState(state: PendingPhoneState | null): boolean {
  return Boolean(state && state.type === 'awaiting_auto_cancel');
}

function setPendingState(state: PendingPhoneState | null): void {
  if (!state || state.type !== 'awaiting_auto_cancel') {
    clearAutoExecuteTimer();
  }
  memoryPendingState = state;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      if (state) {
        localStorage.setItem(PENDING_PHONE_STATE_KEY, JSON.stringify(state));
      } else {
        localStorage.removeItem(PENDING_PHONE_STATE_KEY);
      }
    } catch {}
  }
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('rose-pending-phone-state-changed', {
          detail: {
            hasPending: Boolean(state),
            hasPendingConfirm: isConfirmPromptState(state),
            hasPendingCancel: isAutoCancelPromptState(state),
          },
        })
      );
    } catch {}
  }
}

export function hasPendingPhoneInteraction(): boolean {
  return Boolean(getPendingState());
}

export function hasPendingConfirmAction(): boolean {
  return isConfirmPromptState(getPendingState());
}

export function hasPendingCancelAction(): boolean {
  return isAutoCancelPromptState(getPendingState());
}

export function cancelPendingDelayedAction(): { handled: boolean; reply?: string } {
  const pending = getPendingState();
  clearAutoExecuteTimer();
  if (!pending) return { handled: false };
  setPendingState(null);
  return { handled: true, reply: 'ঠিক আছে, দিলাম না।' };
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
    let targetContact: RoseContact = contact;

    // Fetch exact display name & number via RosePhone.searchContacts when available
    if (typeof plugin.searchContacts === 'function' && (contact.name || contact.number)) {
      try {
        const query = contact.name || contact.number;
        const scRes = await plugin.searchContacts({ query });
        const rawMatches: any[] = Array.isArray(scRes?.contacts) ? scRes.contacts : [];
        if (rawMatches.length > 0) {
          const exact =
            rawMatches.find(
              (c) => String(c?.name || '').trim().toLowerCase() === String(contact.name || '').trim().toLowerCase()
            ) || rawMatches[0];
          const exactName = String(exact?.name || contact.name || '').trim();
          const exactNumber = String(exact?.number || contact.number || '').trim();
          if (exactName || exactNumber) {
            targetContact = {
              name: exactName || exactNumber,
              number: exactNumber,
              source: 'device',
            };
          }
        }
      } catch {
        // Use already-resolved contact on searchContacts failure
      }
    }

    const dialNumber =
      formatDialableNumber(targetContact.number) || String(targetContact.number || '').trim();

    try {
      await plugin.whatsappCall({
        name: targetContact.name,
        number: dialNumber,
        video,
      });
      await sleep(1500);
      if (typeof plugin.clickText === 'function' && (await checkAccessibilityOn(plugin))) {
        try {
          await plugin.clickText({ labels: ['Call', 'কল', 'Voice call', 'Video call'] });
        } catch {}
      }
      return `${targetContact.name}-কে WhatsApp-এ ${video ? 'ভিডিও ' : ''}কল দিচ্ছি।`;
    } catch (err: any) {
      const msg = String(err?.message || err || '').trim();
      logDevError({
        area: 'other',
        message: `RosePhone.whatsappCall error (${targetContact.name}, ${dialNumber}, video=${video}): ${msg}`,
      });
      if (targetContact.number) {
        setPendingState({
          type: 'awaiting_fallback_normal_call',
          contact: targetContact,
          timestamp: Date.now(),
        });
      }
      return 'WhatsApp-এ পেলাম না, সাধারণ কল দেব?';
    }
  }

  if (contact.number) {
    return openCallOrWhatsAppLink(contact.number, 'whatsapp');
  }
  return 'WhatsApp-এ পেলাম না, সাধারণ কল দেব?';
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
      await sleep(2000);
      if (typeof plugin.clickText === 'function' && (await checkAccessibilityOn(plugin))) {
        try {
          const clicked = await plugin.clickText({ labels: ['Send', 'পাঠান'] });
          if (didClickTextSucceed(clicked)) {
            return contact.name && contact.name !== contact.number
              ? `${contact.name}-কে WhatsApp-এ মেসেজ পাঠিয়েছি।`
              : 'WhatsApp-এ মেসেজ পাঠিয়েছি।';
          }
        } catch {}
      }
      return 'লেখা রেডি, Send চাপো।';
    } catch (err: any) {
      const msg = String(err?.message || err || '').trim();
      logDevError({ area: 'other', message: `RosePhone.whatsappMessage error (${formatted}): ${msg}` });
      openExternal(`https://wa.me/${formatted}${text ? `?text=${encodeURIComponent(text)}` : ''}`);
      return 'লেখা রেডি, Send চাপো।';
    }
  }

  openExternal(`https://wa.me/${formatted}${text ? `?text=${encodeURIComponent(text)}` : ''}`);
  return 'লেখা রেডি, Send চাপো।';
}

async function performNativeMessengerShare(text: string): Promise<string> {
  const plugin = getRosePhonePlugin();
  if (!isNativeRoseApp() || !plugin || typeof plugin.shareTextTo !== 'function') {
    return ONLY_IN_ROSE_APP_MSG;
  }
  try {
    await plugin.shareTextTo({ package: 'com.facebook.orca', text });
    setPendingState({
      type: 'awaiting_messenger_recipient',
      messageText: text,
      timestamp: Date.now(),
    });
    return 'যাকে পাঠাবে তার নাম বলো';
  } catch (err: any) {
    const msg = String(err?.message || err || '').trim();
    logDevError({ area: 'other', message: `RosePhone.shareTextTo(messenger) error: ${msg}` });
    return 'Messenger খোলা যায়নি।';
  }
}

async function performMessengerRecipientTap(recipientName: string): Promise<string> {
  const cleanName = String(recipientName || '').trim();
  if (!cleanName) {
    return 'যাকে পাঠাবে তার নাম বলো';
  }

  const plugin = getRosePhonePlugin();
  if (!isNativeRoseApp() || !plugin) {
    return ONLY_IN_ROSE_APP_MSG;
  }

  const accOn = await checkAccessibilityOn(plugin);
  if (!accOn) {
    try {
      await plugin.openAccessibilitySettings?.();
    } catch {}
    return ACCESSIBILITY_NEEDED_MSG;
  }

  try {
    await sleep(600);
    await plugin.typeText?.({ text: cleanName });
    await sleep(1000);
    await plugin.clickText?.({ labels: [cleanName] });
    await sleep(1000);
    await plugin.clickText?.({ labels: ['Send', 'পাঠান'] });
    return `${cleanName}-কে Messenger-এ মেসেজ পাঠিয়েছি।`;
  } catch (err: any) {
    const msg = String(err?.message || err || '').trim();
    logDevError({ area: 'other', message: `Messenger auto-tap error (${cleanName}): ${msg}` });
    return 'Messenger-এ নাম নির্বাচন করে Send চাপো।';
  }
}

async function performNativePostVideoShare(params: {
  platform: PostVideoPlatform;
  pkg: string;
  title: string;
  postText: string;
}): Promise<string> {
  const plugin = getRosePhonePlugin();
  const meta = POST_VIDEO_PLATFORM_MAP[params.platform];
  if (!isNativeRoseApp() || !plugin || typeof plugin.pickVideoAndShare !== 'function') {
    return ONLY_IN_ROSE_APP_MSG;
  }

  try {
    if (typeof plugin.copyText === 'function') {
      await plugin.copyText({ text: params.postText });
    } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(params.postText).catch(() => {});
    }
    await plugin.pickVideoAndShare({
      package: params.pkg,
      title: params.title,
      text: params.postText,
    });
    setPendingState({
      type: 'awaiting_post_video_tap',
      platformLabel: meta.label,
      pkg: params.pkg,
      title: params.title,
      text: params.postText,
      timestamp: Date.now(),
    });
    return 'ভিডিও বাছো; লেখা কপি করা আছে। Post/Upload আমি চাপব কি না বলো।';
  } catch (err: any) {
    const msg = String(err?.message || err || '').trim();
    logDevError({ area: 'other', message: `RosePhone.pickVideoAndShare error (${params.pkg}): ${msg}` });
    return `${meta.label}-এ ভিডিও শেয়ার খোলা যায়নি।`;
  }
}

async function performPostVideoAutoTap(platformLabel: string): Promise<string> {
  const plugin = getRosePhonePlugin();
  if (!isNativeRoseApp() || !plugin) {
    return ONLY_IN_ROSE_APP_MSG;
  }

  const accOn = await checkAccessibilityOn(plugin);
  if (!accOn) {
    try {
      await plugin.openAccessibilitySettings?.();
    } catch {}
    return ACCESSIBILITY_NEEDED_MSG;
  }

  const labels = ['Upload', 'Post', 'Share', 'Next', 'পোস্ট', 'শেয়ার', 'আপলোড'];
  try {
    for (let step = 0; step < 4; step++) {
      const res = await plugin.clickText?.({ labels });
      if (!didClickTextSucceed(res)) {
        break;
      }
      if (step < 3) {
        await sleep(2000);
      }
    }
    return `${platformLabel}-এ পোস্ট সম্পন্ন করার চেষ্টা করেছি।`;
  } catch (err: any) {
    const msg = String(err?.message || err || '').trim();
    logDevError({ area: 'other', message: `post_video clickText error: ${msg}` });
    return 'নিজেই Post বা Upload বোতাম চাপো।';
  }
}

async function performNativeAppSearch(app: SearchAppId, query: string): Promise<string> {
  const meta = SEARCH_APP_META[app];
  const plugin = getRosePhonePlugin();
  if (isNativeRoseApp() && plugin && typeof plugin.openSearch === 'function') {
    try {
      await plugin.openSearch({ app, query });
      return `${meta.label}-এ ‘${query}’ খুঁজছি।`;
    } catch (err: any) {
      const msg = String(err?.message || err || '').trim();
      logDevError({ area: 'other', message: `RosePhone.openSearch error (${app}, ${query}): ${msg}` });
    }
  }
  openExternal(meta.webUrl(query));
  return `${meta.label}-এ ‘${query}’ খুঁজছি।`;
}

function emitDelayedPhoneResult(
  reply: string,
  actionType: 'phone_call' | 'whatsapp_call' | 'whatsapp_message',
  isPromptOrError: boolean
): void {
  if (typeof window === 'undefined' || !reply) return;
  try {
    window.dispatchEvent(
      new CustomEvent('rose-delayed-phone-result', {
        detail: { reply, actionType, isPromptOrError },
      })
    );
  } catch {}
}

function scheduleAutoExecuteAction(params: {
  actionType: 'phone_call' | 'whatsapp_call' | 'whatsapp_message';
  contact: RoseContact;
  video?: boolean;
  messageText?: string;
}): void {
  clearAutoExecuteTimer();
  const scheduledTs = Date.now();
  setPendingState({
    type: 'awaiting_auto_cancel',
    actionType: params.actionType,
    contact: params.contact,
    video: Boolean(params.video),
    messageText: params.messageText,
    timestamp: scheduledTs,
  });

  activeAutoExecuteTimer = setTimeout(() => {
    activeAutoExecuteTimer = null;
    const current = getPendingState();
    if (!current || current.type !== 'awaiting_auto_cancel' || current.timestamp !== scheduledTs) {
      return;
    }
    setPendingState(null);
    void (async () => {
      if (params.actionType === 'whatsapp_message') {
        const res = await performNativeWhatsAppMessage(params.contact, params.messageText || '');
        emitDelayedPhoneResult(res, 'whatsapp_message', true);
      } else if (params.actionType === 'whatsapp_call') {
        const res = await performNativeWhatsAppCall(params.contact, Boolean(params.video));
        const needsFollowUp =
          res === ONLY_IN_ROSE_APP_MSG ||
          res.includes('পেলাম না') ||
          res.includes('চাপো') ||
          res.includes('সঠিক ফোন নম্বর') ||
          res.includes('যায়নি');
        if (needsFollowUp) {
          emitDelayedPhoneResult(res, 'whatsapp_call', true);
        }
      } else {
        const res = await performNativePhoneCall(params.contact);
        const needsFollowUp =
          res === ONLY_IN_ROSE_APP_MSG ||
          res.includes('সঠিক ফোন নম্বর') ||
          res.includes('যায়নি') ||
          res.includes('চাপো');
        if (needsFollowUp) {
          emitDelayedPhoneResult(res, 'phone_call', true);
        }
      }
    })();
  }, AUTO_EXECUTE_DELAY_MS);
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
    scheduleAutoExecuteAction({
      actionType: 'whatsapp_message',
      contact,
      messageText: body,
    });
    return `${displayName}-কে এটা পাঠাচ্ছি: '${body}'…`;
  }

  if (actionType === 'whatsapp_call') {
    scheduleAutoExecuteAction({
      actionType: 'whatsapp_call',
      contact,
      video: Boolean(video),
    });
    return `${displayName}-কে WhatsApp-এ ${video ? 'ভিডিও ' : ''}কল দিচ্ছি…`;
  }

  scheduleAutoExecuteAction({
    actionType: 'phone_call',
    contact,
  });
  return `${displayName}-কে কল দিচ্ছি…`;
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

export const whatsapp_send = whatsapp_message;

export async function messenger_send(params: {
  message?: string;
  text?: string;
}): Promise<string> {
  const body = String(params?.message || params?.text || '').trim();
  if (!body) {
    return 'Messenger-এ কী মেসেজ পাঠাবে বলো।';
  }
  setPendingState({
    type: 'awaiting_confirm',
    actionType: 'messenger_send',
    contact: { name: 'Messenger', number: '', source: 'local' },
    messageText: body,
    timestamp: Date.now(),
  });
  return `Messenger-এ এটা পাঠাব: '${body}'। ঠিক আছে?`;
}

export async function messenger_recipient(name: string): Promise<string> {
  const pending = getPendingState();
  if (!pending || pending.type !== 'awaiting_messenger_recipient') {
    return 'আগে Messenger-এ মেসেজ পাঠাতে বলো।';
  }
  setPendingState(null);
  return performMessengerRecipientTap(name);
}

function normalizePostPlatform(raw: string): PostVideoPlatform | null {
  const lower = String(raw || '').trim().toLowerCase();
  if (!lower) return null;
  if (/youtube|ইউটিউব|yt\b/i.test(lower)) return 'youtube';
  if (/facebook|ফেসবুক|ফেইসবুক|\bfb\b/i.test(lower)) return 'facebook';
  if (/instagram|ইনস্টাগ্রাম|ইন্সটাগ্রাম|\binsta\b/i.test(lower)) return 'instagram';
  if (/tiktok|টিকটক/i.test(lower)) return 'tiktok';
  return null;
}

function normalizeSearchApp(raw: string): SearchAppId | null {
  const lower = String(raw || '').trim().toLowerCase();
  if (!lower) return null;
  if (/youtube|ইউটিউব|\byt\b/i.test(lower)) return 'youtube';
  if (/facebook|ফেসবুক|ফেইসবুক|\bfb\b/i.test(lower)) return 'facebook';
  if (/instagram|ইনস্টাগ্রাম|ইন্সটাগ্রাম|\binsta\b/i.test(lower)) return 'instagram';
  if (/tiktok|টিকটক/i.test(lower)) return 'tiktok';
  if (/google|গুগল/i.test(lower)) return 'google';
  return null;
}

async function generatePostVideoCopy(
  platformLabel: string,
  topic: string
): Promise<{ title: string; description: string; hashtags: string }> {
  const cleanTopic = String(topic || '').trim() || 'আমার নতুন ভিডিও';
  const prompt = `Write a catchy short video post for ${platformLabel} about: "${cleanTopic}".
Return ONLY valid JSON with keys "title", "description", "hashtags" (title max 70 chars, description 1-2 short lines in natural Bengali matching topic, hashtags space-separated like "#tag1 #tag2 #tag3").`;

  const geminiKey = (getGeminiKey() || '').replace(/["'\r\n\t\s]+/g, '').trim();
  const groqKey = getStoredGroqKey();

  const tryParse = (raw: string): { title: string; description: string; hashtags: string } | null => {
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return null;
      const obj = JSON.parse(m[0]);
      const title = String(obj?.title || '').trim();
      const description = String(obj?.description || '').trim();
      const hashtags = String(obj?.hashtags || '').trim();
      if (title && description) {
        return {
          title,
          description,
          hashtags: hashtags || `#${platformLabel.toLowerCase()} #video #trending`,
        };
      }
    } catch {}
    return null;
  };

  if (geminiKey && !isGeminiIn429Cooldown(geminiKey)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const model = await resolveChatModel(geminiKey, controller.signal);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 220 },
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.find((p: any) => typeof p?.text === 'string')?.text || '';
        const parsed = tryParse(text);
        if (parsed) return parsed;
      }
    } catch {
    } finally {
      clearTimeout(timer);
    }
  }

  if (groqKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      let groqModel = getSelectedGroqModelFromSettings();
      if (!groqModel) {
        const disc = await getDynamicGroqChatModels(groqKey, false);
        groqModel = disc.models?.[0] || 'llama-3.3-70b-versatile';
      }
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: groqModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 220,
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = tryParse(data?.choices?.[0]?.message?.content || '');
        if (parsed) return parsed;
      }
    } catch {
    } finally {
      clearTimeout(timer);
    }
  }

  const slug = cleanTopic.replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 18) || 'Video';
  return {
    title: cleanTopic.slice(0, 70),
    description: `${cleanTopic} নিয়ে আমার নতুন ভিডিও, দেখুন আর মতামত জানান।`,
    hashtags: `#${slug} #${platformLabel} #Trending`,
  };
}

export async function post_video(params: {
  platform?: string;
  topic?: string;
  title?: string;
  description?: string;
  hashtags?: string;
}): Promise<string> {
  const platform = normalizePostPlatform(params?.platform || '');
  if (!platform) {
    return 'কোন প্ল্যাটফর্মে ভিডিও দেবে বলো: YouTube, Facebook, Instagram নাকি TikTok?';
  }
  const meta = POST_VIDEO_PLATFORM_MAP[platform];
  const topic = String(params?.topic || '').trim();

  let title = String(params?.title || '').trim();
  let description = String(params?.description || '').trim();
  let hashtags = String(params?.hashtags || '').trim();

  if (!title || !description || !hashtags) {
    const generated = await generatePostVideoCopy(meta.label, topic || meta.label);
    if (!title) title = generated.title;
    if (!description) description = generated.description;
    if (!hashtags) hashtags = generated.hashtags;
  }

  const allText = `${title}\n\n${description}\n\n${hashtags}`;
  setPendingState({
    type: 'awaiting_confirm',
    actionType: 'post_video',
    contact: { name: meta.label, number: '', source: 'local' },
    platform,
    pkg: meta.pkg,
    title,
    postText: allText,
    timestamp: Date.now(),
  });

  return `${meta.label}-এর জন্য লিখেছি — শিরোনাম: ${title}। বিবরণ: ${description}। হ্যাশট্যাগ: ${hashtags}। ঠিক আছে? হ্যাঁ বললে কপি করে ভিডিও বাছার পর্দা খুলব।`;
}

export async function app_search(app: string, query: string): Promise<string> {
  const normalizedApp = normalizeSearchApp(app);
  const cleanQuery = String(query || '').trim();
  if (!normalizedApp) {
    return 'কোন অ্যাপে খুঁজব বলো: YouTube, Facebook, Instagram, TikTok নাকি Google?';
  }
  if (!cleanQuery) {
    return `${SEARCH_APP_META[normalizedApp].label}-এ কী খুঁজব বলো।`;
  }

  const meta = SEARCH_APP_META[normalizedApp];
  setPendingState({
    type: 'awaiting_confirm',
    actionType: 'app_search',
    contact: { name: meta.label, number: '', source: 'local' },
    searchApp: normalizedApp,
    searchQuery: cleanQuery,
    timestamp: Date.now(),
  });
  return `${meta.label}-এ '${cleanQuery}' খুঁজব? হ্যাঁ বললে খুলব।`;
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

function normalizeConfirmReplyTokens(text: string): { normalized: string; tokens: string[] } {
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/[।॥.,!?;:'"‘’“”()[\]{}—–\-_/\\|~`@#$%^&*+=<>…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = normalized ? normalized.split(' ') : [];
  return { normalized, tokens };
}

export function isAffirmativeReply(text: string): boolean {
  const { normalized, tokens } = normalizeConfirmReplyTokens(text);
  if (!normalized) return false;
  if (/(?:^|\s)ঠিক\s+আছে(?:\s|$)/.test(normalized)) return true;
  const yesWords = new Set([
    'হ্যাঁ',
    'হ্যা',
    'হা',
    'হাঁ',
    'হুম',
    'হুঁ',
    'হু',
    'জি',
    'জ্বি',
    'দাও',
    'দিন',
    'দে',
    'করো',
    'কর',
    'ওকে',
    'ok',
    'okay',
    'yes',
    'ya',
    'ha',
    'haa',
    'hmm',
  ]);
  return tokens.some((tok) => yesWords.has(tok));
}

export function isAutoCancelReply(text: string): boolean {
  const { normalized, tokens } = normalizeConfirmReplyTokens(text);
  if (!normalized) return false;
  const cancelWords = new Set(['না', 'নাহ', 'থামো', 'থাম', 'থাক', 'বাদ', 'cancel', 'no', 'stop']);
  return tokens.some((tok) => cancelWords.has(tok));
}

export function isNegativeReply(text: string): boolean {
  const { normalized, tokens } = normalizeConfirmReplyTokens(text);
  if (!normalized) return false;
  const noWords = new Set(['না', 'নাহ', 'থামো', 'থাক', 'বাদ', 'no', 'cancel']);
  if (tokens.some((tok) => noWords.has(tok))) return true;
  return /(?:^|\s)(?:দরকার\s+নেই|লাগবে\s+না|চাপতে\s+হবে\s+না|নিজেই?\s+চাপব|বন্ধ\s+করো|করো\s+না|দিও\s+না)(?:\s|$)/.test(
    normalized
  );
}

export async function handlePendingPhoneConfirmation(decision: 'yes' | 'no'): Promise<{
  handled: boolean;
  reply?: string;
}> {
  const pending = getPendingState();
  if (!pending) return { handled: false };

  if (pending.type === 'awaiting_auto_cancel') {
    clearAutoExecuteTimer();
    setPendingState(null);
    if (decision === 'no') {
      return { handled: true, reply: 'ঠিক আছে, দিলাম না।' };
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
    if (pending.actionType === 'messenger_send') {
      const reply = await performNativeMessengerShare(pending.messageText || '');
      return { handled: true, reply };
    }
    if (pending.actionType === 'post_video' && pending.platform && pending.pkg) {
      const reply = await performNativePostVideoShare({
        platform: pending.platform,
        pkg: pending.pkg,
        title: pending.title || '',
        postText: pending.postText || '',
      });
      return { handled: true, reply };
    }
    if (pending.actionType === 'app_search' && pending.searchApp && pending.searchQuery) {
      const reply = await performNativeAppSearch(pending.searchApp, pending.searchQuery);
      return { handled: true, reply };
    }
    const reply = await performNativePhoneCall(pending.contact);
    return { handled: true, reply };
  }

  if (pending.type === 'awaiting_post_video_tap') {
    setPendingState(null);
    if (decision === 'no') {
      return { handled: true, reply: 'ঠিক আছে, ভিডিও বাছার পর নিজেই Post বা Upload চাপো।' };
    }
    const reply = await performPostVideoAutoTap(pending.platformLabel);
    return { handled: true, reply };
  }

  if (pending.type === 'awaiting_fallback_normal_call') {
    setPendingState(null);
    if (decision === 'no') {
      return { handled: true, reply: 'ঠিক আছে, দিলাম না।' };
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

  // 0. 3-second cancelable delay for calls and WhatsApp messages
  if (pending.type === 'awaiting_auto_cancel') {
    if (isAutoCancelReply(raw)) {
      return cancelPendingDelayedAction();
    }
    return { handled: false };
  }

  // 1. Confirmation for Messenger / post_video / app_search
  if (pending.type === 'awaiting_confirm') {
    if (isNegativeReply(raw)) {
      return handlePendingPhoneConfirmation('no');
    }
    if (isAffirmativeReply(raw)) {
      return handlePendingPhoneConfirmation('yes');
    }
    return { handled: false };
  }

  // 1b. Post-video Upload/Post auto-tap confirmation
  if (pending.type === 'awaiting_post_video_tap') {
    if (isNegativeReply(raw)) {
      return handlePendingPhoneConfirmation('no');
    }
    if (isAffirmativeReply(raw)) {
      return handlePendingPhoneConfirmation('yes');
    }
    return { handled: false };
  }

  // 1c. Messenger recipient name after shareTextTo
  if (pending.type === 'awaiting_messenger_recipient') {
    if (isNegativeReply(raw)) {
      setPendingState(null);
      return { handled: true, reply: 'ঠিক আছে, বাতিল করলাম।' };
    }
    const recipient = cleanContactQueryName(raw) || raw;
    setPendingState(null);
    const reply = await performMessengerRecipientTap(recipient);
    return { handled: true, reply };
  }

  // 2. Normal phone call fallback confirmation after WhatsApp call failed
  if (pending.type === 'awaiting_fallback_normal_call') {
    if (isNegativeReply(raw)) {
      return handlePendingPhoneConfirmation('no');
    }
    if (isAffirmativeReply(raw)) {
      return handlePendingPhoneConfirmation('yes');
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

  if (name === 'whatsapp_send' || name === 'whatsapp_message') {
    const person = String(args.person || args.name || args.number || '').trim();
    const message = String(args.message || args.text || '').trim();
    const msg = await whatsapp_message({ person, message });
    return { ok: true, message: msg };
  }

  if (name === 'messenger_send') {
    const message = String(args.message || args.text || '').trim();
    const msg = await messenger_send({ message });
    return { ok: true, message: msg };
  }

  if (name === 'messenger_recipient') {
    const recipient = String(args.name || args.person || args.recipient || '').trim();
    const msg = await messenger_recipient(recipient);
    return { ok: true, message: msg };
  }

  if (name === 'post_video') {
    const msg = await post_video({
      platform: String(args.platform || '').trim(),
      topic: String(args.topic || '').trim(),
      title: args.title ? String(args.title).trim() : undefined,
      description: args.description ? String(args.description).trim() : undefined,
      hashtags: args.hashtags ? String(args.hashtags).trim() : undefined,
    });
    return { ok: true, message: msg };
  }

  if (name === 'app_search') {
    const app = String(args.app || args.platform || '').trim();
    const query = String(args.query || args.text || '').trim();
    const msg = await app_search(app, query);
    return { ok: true, message: msg };
  }

  if (name === 'confirm_action' || name === 'phone_confirm') {
    const rawDec = String(args.answer ?? args.decision ?? '').trim().toLowerCase();
    const decision: 'yes' | 'no' =
      rawDec === 'no' || rawDec === 'false' || rawDec === 'cancel' || isNegativeReply(rawDec)
        ? 'no'
        : 'yes';
    const res = await handlePendingPhoneConfirmation(decision);
    if (res.handled && res.reply) {
      return { ok: true, message: res.reply };
    }
    return { ok: false, message: 'কোনো কাজের অনুমতির অপেক্ষায় নেই।' };
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
  // Strict whole-word trigger check: ONLY মেসেজ, মেসেজ দাও, লিখে পাঠাও, পাঠাও, message, text
  const hasStrictMsgTrigger = hasAnyWholePhrase(text, [
    'মেসেজ দাও',
    'লিখে পাঠাও',
    'মেসেজ',
    'পাঠাও',
    'message',
    'text',
  ]);
  if (!hasStrictMsgTrigger) return { matched: false };

  // Ignore if explicitly Messenger or a call
  if (hasAnyWholePhrase(text, ['messenger', 'মেসেঞ্জার', 'মেসেঞ্জারে'])) {
    return { matched: false };
  }
  if (hasAnyWholePhrase(text, ['কল', 'ফোন', 'call'])) {
    return { matched: false };
  }

  // Bengali pattern: recipient MUST be addressed with কে / এর নম্বরে / নম্বরে (e.g. "আম্মুকে মেসেজ দাও ...")
  const bnMatch = text.match(
    /^(?:(?:হ্যালো|হাই|এই|শোনো)\s+)?(?:(?:রোজ|rose)\s*[,।:!-]?\s*)?(?:(?:whatsapp|হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ)(?:ে|-?এ)?\s+)?(.+?)(?:কে|-কে|\s+এর\s+নম্বরে|\s+নম্বরে)(?:\s+.*?)(?:মেসেজ\s*দাও|লিখে\s*পাঠাও|মেসেজ|পাঠাও)\s*(?:যে|বলে|লিখে|:|-)?\s*(.*)$/i
  );
  if (bnMatch && bnMatch[1]) {
    const rawTarget = bnMatch[1].replace(
      /(?:হোয়াটসঅ্যাপে|হোয়াটসঅ্যাপে|হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ|whatsapp[-\s]*এ?)/gi,
      ' '
    );
    const target = cleanContactQueryName(rawTarget);
    const body = String(bnMatch[2] || '')
      .replace(/^(?:যে|বলে|লিখে|:|-)\s*/i, '')
      .trim();
    if (isValidExtractedContactName(target)) {
      return { matched: true, target, body };
    }
  }

  // English pattern: "(whatsapp )?(message|text) (to )<contact>(: body)"
  const enMatch = text.match(
    /^(?:(?:hey|hi|rose)[,\s]+)?(?:whatsapp\s+)?(?:message|text)\s+(?:to\s+)?([A-Za-z\u0980-\u09FF][A-Za-z\u0980-\u09FF\s]{1,30}?|[+০-৯0-9\-\s]{7,})(?:\s*(?:saying|that|:|-|,|যে)\s*(.*))?$/i
  );
  if (enMatch && enMatch[1]) {
    const target = cleanContactQueryName(enMatch[1]) || enMatch[1].trim();
    const body = String(enMatch[2] || '').trim();
    if (isValidExtractedContactName(target)) {
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

  // 1. Check pending confirmation / 3s cancel / disambiguation / alias or number reply
  const pendingRes = await handlePendingPhoneUserReply(text);
  if (pendingRes.handled && pendingRes.reply) {
    return { matched: true, reply: pendingRes.reply };
  }

  const isPcExplicit = hasAnyWholePhrase(text, ['পিসিতে', 'পিসির', 'ল্যাপটপে', 'কম্পিউটারে', 'pc', 'laptop']);
  if (isPcExplicit) return { matched: false };

  // 2. Teach alias directly: e.g. "আম্মু মানে Ammu Home"
  const teachAlias = parseAliasTeachCommand(text);
  if (teachAlias) {
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

  // 3. Explicit WhatsApp message intent (requires contact name + strict whole-word keyword)
  const waMsgIntent = parseWhatsAppMessageIntent(text);
  if (waMsgIntent.matched && waMsgIntent.target) {
    const reply = await whatsapp_message({
      person: waMsgIntent.target,
      message: waMsgIntent.body || '',
    });
    return { matched: true, reply };
  }

  // 4. Explicit Messenger message intent
  const isMessengerReq = hasAnyWholePhrase(text, ['messenger', 'মেসেঞ্জার', 'মেসেঞ্জারে']);
  const hasMsgSendVerb = hasAnyWholePhrase(text, [
    'মেসেজ দাও',
    'লিখে পাঠাও',
    'মেসেজ',
    'পাঠাও',
    'message',
    'text',
  ]);
  if (isMessengerReq && hasMsgSendVerb) {
    const messengerBodyMatch = text.match(
      /(?:messenger|মেসেঞ্জারে?|মেসেঞ্জার)\s*(?:এ|-?এ)?\s*(?:মেসেজ|message|text)?\s*(?:লিখে\s*পাঠাও|পাঠাও|দাও|করো|send)?\s*(?:যে|বলে|লিখে|:|-)?\s*(.+)$/i
    );
    const extractedBody = String(messengerBodyMatch?.[1] || '')
      .replace(/^(?:যে|বলে|লিখে|হলো|হল|:|-)\s*/i, '')
      .trim();
    if (extractedBody && !/^(?:মেসেজ|পাঠাও|দাও|করো|send)$/i.test(extractedBody)) {
      const reply = await messenger_send({ message: extractedBody });
      return { matched: true, reply };
    }
  }

  // 5. Strict Call / WhatsApp call intent: requires whole-word কল / ফোন / call AND a contact name (or number)
  const extractedNumber = extractPhoneNumberFromText(text);
  const hasStrictCallKeyword = hasAnyWholePhrase(text, ['কল', 'ফোন', 'call']);

  if (hasStrictCallKeyword) {
    const isWa = isWhatsAppRequest(text);
    const video = isVideoCallRequest(text);

    if (extractedNumber) {
      const reply = isWa
        ? await whatsapp_call(extractedNumber, video)
        : await phone_call(extractedNumber);
      return { matched: true, reply };
    }

    // Must not match conversational questions/statements about phones like "ফোন ব্যবহার করলে পড়ালেখা নষ্ট হয়"
    const isQuestionOrStatement =
      hasAnyWholePhrase(text, ['কেন', 'কিভাবে', 'কীভাবে', 'হয়', 'হয়েছে', 'নষ্ট', 'কিনব', 'দাম', 'ভালো', 'খারাপ', 'নেই']) &&
      !/(?:^|\s)\S+(?:কে|-কে)(?:\s|$)/i.test(text);

    if (!isQuestionOrStatement) {
      // Check Bengali explicit recipient `<name>কে ... (কল|ফোন|call)` OR clean contact extraction
      const bnRecipientMatch = text.match(
        /^(?:(?:হ্যালো|হাই|এই|শোনো)\s+)?(?:(?:রোজ|rose)\s*[,।:!-]?\s*)?(?:(?:whatsapp|হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ)(?:ে|-?এ)?\s+)?(.+?)(?:কে|-কে|\s+এর\s+নম্বরে|\s+নম্বরে)\s+/i
      );
      const rawCandidate = bnRecipientMatch?.[1] ? bnRecipientMatch[1] : text;
      const contactName = cleanContactQueryName(rawCandidate);
      if (isValidExtractedContactName(contactName)) {
        const reply = isWa
          ? await whatsapp_call(contactName, video)
          : await phone_call(contactName);
        return { matched: true, reply };
      }
    }
  }

  // 6. Explicit app search intent (YouTube, Facebook, Instagram, TikTok, Google)
  const searchMatch = text.match(
    /(?:^|\s)(youtube|ইউটিউব|ইউটিউবে|facebook|ফেসবুক|ফেসবুকে|instagram|ইনস্টাগ্রাম|ইন্সটাগ্রামে?|tiktok|টিকটক|টিকটকে|google|গুগল|গুগলে)(?:-?এ|তে)?\s+(?:.+?\s+)?(?:খোঁজো|খুজো|সার্চ\s*করো|সার্চ|দেখাও|search|find)(?=$|\s|[:\-])\s*[:\-]?\s*(.*)$/i
  ) || text.match(
    /(?:^|\s)(?:search|খোঁজো|খুজো|সার্চ\s*করো)\s+(.+?)\s+(?:on|in)\s+(youtube|facebook|instagram|tiktok|google)(?=$|\s)/i
  );
  if (searchMatch) {
    let appRaw = '';
    let queryRaw = '';
    if (/youtube|facebook|instagram|tiktok|google|ইউটিউব|ফেসবুক|ইনস্টাগ্রাম|ইন্সটাগ্রাম|টিকটক|গুগল/i.test(searchMatch[1])) {
      appRaw = searchMatch[1];
      queryRaw = searchMatch[2] || '';
      if (!queryRaw) {
        queryRaw = text
          .replace(/(?:^|\s)(?:youtube|ইউটিউব|ইউটিউবে|facebook|ফেসবুক|ফেসবুকে|instagram|ইনস্টাগ্রাম|ইন্সটাগ্রামে?|tiktok|টিকটক|টিকটকে|google|গুগল|গুগলে)(?:-?এ|তে)?(?=$|\s)/gi, ' ')
          .replace(/(?:^|\s)(?:নিয়ে|নিয়ে|সার্চ\s*করো|সার্চ|খোঁজো|খুজো|দেখাও|search|find|রোজ|rose)(?=$|\s)/gi, ' ')
          .trim();
      }
    } else {
      queryRaw = searchMatch[1] || '';
      appRaw = searchMatch[2] || '';
    }
    const normSearchApp = normalizeSearchApp(appRaw);
    if (normSearchApp && queryRaw.trim()) {
      const reply = await app_search(normSearchApp, queryRaw.trim());
      return { matched: true, reply };
    }
  }

  // 7. Video post intent (YouTube, Facebook, Instagram, TikTok)
  const hasVideoPostVerb =
    hasAnyWholePhrase(text, ['ভিডিও', 'রিলস', 'রিল', 'শর্টস', 'শর্ট', 'video', 'reels', 'reel', 'shorts', 'short']) &&
    hasAnyWholePhrase(text, ['পোস্ট', 'আপলোড', 'শেয়ার', 'শেয়ার', 'ছাড়ো', 'ছাড়ো', 'post', 'upload', 'share']);
  if (hasVideoPostVerb) {
    const normPlat = normalizePostPlatform(text);
    if (normPlat) {
      const topic = text
        .replace(/(?:^|\s)(?:youtube|ইউটিউব|ইউটিউবে|facebook|ফেসবুক|ফেসবুকে|instagram|ইনস্টাগ্রাম|ইন্সটাগ্রামে?|tiktok|টিকটক|টিকটকে)(?:-?এ|তে)?(?=$|\s)/gi, ' ')
        .replace(/(?:^|\s)(?:ভিডিও|রিলস?|শর্টস?|পোস্ট|আপলোড|শেয়ার|শেয়ার|ছাড়ো|ছাড়ো|করো|দাও|নিয়ে|নিয়ে|একটা|video|post|upload|share|রোজ|rose)(?=$|\s)/gi, ' ')
        .trim();
      const reply = await post_video({ platform: normPlat, topic: topic || normPlat });
      return { matched: true, reply };
    }
  }

  // 8. Open app intent
  const hasOpenVerb = hasAnyWholePhrase(text, [
    'খোলো',
    'খোল',
    'খুলো',
    'খুলে দাও',
    'চালু করো',
    'চালাও',
    'ওপেন করো',
    'ওপেন',
    'open',
    'launch',
  ]);
  if (hasOpenVerb && !hasStrictCallKeyword) {
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
