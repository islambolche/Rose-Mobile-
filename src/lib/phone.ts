import { logDevError } from './devLog';
import { openExternal } from './openExternal';

export const ONLY_IN_ROSE_APP_MSG = 'এটা শুধু ROSE অ্যাপে কাজ করে';
export const HONEST_CALL_REPLY = 'হোয়াটসঅ্যাপে খুলে দিয়েছি, কল বাটন চাপো।';

const CONTACTS_STORAGE_KEY = 'rose_contacts';
const LEGACY_CONTACTS_STORAGE_KEY = 'iyabd_saved_contacts';
const PENDING_CONTACT_CALL_KEY = 'rose_pending_contact_call';
const PENDING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEDUPE_WINDOW_MS = 2000;

export interface RoseContact {
  name: string;
  number: string;
}

interface PendingContactNumberState {
  name: string;
  channel: 'whatsapp' | 'tel';
  timestamp: number;
}

let memoryPendingContact: PendingContactNumberState | null = null;
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

function getRosePhonePlugin(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).Capacitor?.Plugins?.RosePhone || null;
}

/**
 * Convert Bangla digits (০-৯) to English digits (0-9) first.
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

/**
 * Extract a phone number from user text (supporting Bangla digits ০-৯, English digits, and spoken digit words).
 */
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

  // Fallback for spoken number words in voice transcripts
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

export function isWhatsAppRequest(text: string): boolean {
  return /(?:whatsapp|হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ|\bwa\b)/i.test(String(text || ''));
}

/**
 * Opens https://wa.me/<number> for WhatsApp or tel:<number> for a normal call,
 * after converting Bangla digits and 01XXXXXXXXX -> 8801XXXXXXXXX.
 * Always returns the honest reply: "হোয়াটসঅ্যাপে খুলে দিয়েছি, কল বাটন চাপো।"
 */
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

/**
 * Read saved in-app contacts from localStorage.
 */
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
          map.set(name.toLowerCase(), { name, number });
        }
      }
    } catch {}
  };

  readKey(LEGACY_CONTACTS_STORAGE_KEY);
  readKey(CONTACTS_STORAGE_KEY);

  return Array.from(map.values());
}

/**
 * Save a contact (name + number) to localStorage in-app contact list.
 */
export function saveInAppContact(name: string, rawNumber: string): RoseContact | null {
  const cleanName = cleanContactQueryName(name) || String(name || '').trim();
  const formattedNumber = formatBangladeshiNumber(rawNumber);
  if (!cleanName || !formattedNumber) return null;

  const current = getSavedInAppContacts();
  const existingIdx = current.findIndex((c) => c.name.toLowerCase() === cleanName.toLowerCase());
  const entry: RoseContact = { name: cleanName, number: formattedNumber };

  if (existingIdx >= 0) {
    current[existingIdx] = entry;
  } else {
    current.push(entry);
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(current));
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
    /(?:হোয়াটসঅ্যাপে|হোয়াটসঅ্যাপে|হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ|whatsapp[-\s]*এ|on\s+whatsapp|in\s+whatsapp|via\s+whatsapp|whatsapp|নরমাল|সিমে|সিম|ফোনে|ডায়ালে)/gi,
    ' '
  );
  s = s.replace(
    /(?:এর\s+নম্বরে\s+|নম্বরে\s+)?(?:একটা\s+|একটি\s+)?(?:কল|ফোন|ডায়াল|call|dial|phone)\s*(?:দাও|দেও|দে|দেন|দিন|করো|কর|করুন|করে\s*দাও|করে\s*দে|দেব|দিব|করব|করো\s*তো|দাও\s*তো)?.*/i,
    ''
  );
  s = s.replace(/\b(?:call|dial|phone|ring)\b/gi, ' ');
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

/**
 * Look up a contact by name in localStorage contacts AND in recent shared chat/voice history.
 */
export function lookupContactByName(rawName: string): RoseContact | null {
  const clean = cleanContactQueryName(rawName);
  const rawTrimmed = String(rawName || '').trim().replace(/[-–—,:।.?!"']/g, '').trim();
  if (!clean && !rawTrimmed) return null;

  const qClean = (clean || rawTrimmed).toLowerCase();
  const qRaw = rawTrimmed.toLowerCase();

  const saved = getSavedInAppContacts();
  const exact = saved.find((c) => {
    const cn = c.name.toLowerCase();
    return cn === qClean || cn === qRaw || `${cn}কে` === qRaw || `${cn} কে` === qRaw;
  });
  if (exact) return exact;

  const partial = saved.find((c) => {
    const cn = c.name.toLowerCase();
    return cn.includes(qClean) || qClean.includes(cn);
  });
  if (partial) return partial;

  // Check shared chat/voice message history (Requirement 4: number given in chat is known in voice and vice versa)
  const history = getSharedRecentMessages();
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const lowerText = msg.text.toLowerCase();
    if (lowerText.includes(qClean)) {
      const extracted = extractPhoneNumberFromText(msg.text);
      if (extracted) {
        const savedEntry = saveInAppContact(clean || rawTrimmed, extracted);
        if (savedEntry) return savedEntry;
      }
      // Also check if this message was Rose asking "<name>-এর নম্বর কত?" and the next user message had the number
      if (msg.role === 'assistant' && /(?:নম্বর|নাম্বার)\s*কত/.test(msg.text)) {
        for (let j = i + 1; j < history.length; j++) {
          if (history[j].role === 'user') {
            const nextNum = extractPhoneNumberFromText(history[j].text);
            if (nextNum) {
              const savedEntry = saveInAppContact(clean || rawTrimmed, nextNum);
              if (savedEntry) return savedEntry;
            }
          }
        }
      }
    }
  }

  return null;
}

function getPendingContactCall(): PendingContactNumberState | null {
  const now = Date.now();
  if (memoryPendingContact && now - memoryPendingContact.timestamp < PENDING_TIMEOUT_MS) {
    return memoryPendingContact;
  }
  memoryPendingContact = null;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(PENDING_CONTACT_CALL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.name === 'string' &&
          parsed.name.trim() &&
          now - Number(parsed.timestamp || 0) < PENDING_TIMEOUT_MS
        ) {
          memoryPendingContact = {
            name: parsed.name.trim(),
            channel: parsed.channel === 'tel' ? 'tel' : 'whatsapp',
            timestamp: Number(parsed.timestamp),
          };
          return memoryPendingContact;
        } else {
          localStorage.removeItem(PENDING_CONTACT_CALL_KEY);
        }
      }
    } catch {}
  }

  // Also check if the last assistant message in shared chat/voice history asked "<name>-এর নম্বর কত?"
  const history = getSharedRecentMessages();
  for (let i = history.length - 1; i >= Math.max(0, history.length - 3); i--) {
    const m = history[i];
    if (m.role === 'assistant') {
      const match = m.text.match(/^(.+?)(?:-এর|\s+এর|ের)\s+(?:ফোন\s+|মোবাইল\s+)?(?:নম্বর|নাম্বার)\s+কত\??/);
      if (match && match[1]) {
        const askedName = cleanContactQueryName(match[1]);
        if (askedName) {
          const prevUser = i > 0 ? history[i - 1]?.text || '' : '';
          return {
            name: askedName,
            channel: isWhatsAppRequest(prevUser) ? 'whatsapp' : 'tel',
            timestamp: now,
          };
        }
      }
      break;
    }
  }

  return null;
}

function setPendingContactCall(state: PendingContactNumberState | null): void {
  memoryPendingContact = state;
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (state) {
      localStorage.setItem(PENDING_CONTACT_CALL_KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(PENDING_CONTACT_CALL_KEY);
    }
  } catch {}
}

export function hasPendingPhoneInteraction(): boolean {
  return Boolean(getPendingContactCall());
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

export async function searchContacts(
  query: string
): Promise<{ ok: boolean; contacts: RoseContact[]; message: string }> {
  const localMatch = lookupContactByName(query);
  if (localMatch) {
    return { ok: true, contacts: [localMatch], message: '' };
  }
  const all = getSavedInAppContacts();
  const q = cleanContactQueryName(query).toLowerCase();
  const filtered = q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  return { ok: true, contacts: filtered, message: '' };
}

/**
 * Call a contact by name:
 * - Look up in saved contacts (localStorage) + shared message history.
 * - If found: open https://wa.me/<number> (for WhatsApp) or tel:<number> (for normal call) and say:
 *   "হোয়াটসঅ্যাপে খুলে দিয়েছি, কল বাটন চাপো।"
 * - If not found: ask once: "<name>-এর নম্বর কত?"
 */
export async function call_contact(
  name: string,
  channel: 'whatsapp' | 'tel' = 'tel'
): Promise<string> {
  const cleanName = cleanContactQueryName(name) || String(name || '').trim();
  if (!cleanName) {
    return 'কার নম্বরে কল দেব নামটা বলো।';
  }

  const sig = `call_contact:${cleanName.toLowerCase()}:${channel}`;
  const deduped = getRecentDedupeReply(sig);
  if (deduped) return deduped;

  // If the "name" passed in actually contains a phone number, call that number directly
  const directNum = extractPhoneNumberFromText(cleanName);
  if (directNum) {
    const reply = openCallOrWhatsAppLink(directNum, channel);
    saveDedupeReply(sig, reply);
    return reply;
  }

  const found = lookupContactByName(cleanName);
  if (found && found.number) {
    setPendingContactCall(null);
    const reply = openCallOrWhatsAppLink(found.number, channel);
    saveDedupeReply(sig, reply);
    return reply;
  }

  setPendingContactCall({
    name: cleanName,
    channel,
    timestamp: Date.now(),
  });
  const askMsg = `${cleanName}-এর নম্বর কত?`;
  saveDedupeReply(sig, askMsg);
  return askMsg;
}

/**
 * Call a phone number directly:
 * - If there was a pending contact waiting for a number, save it under that name too.
 * - Convert Bangla digits (০-৯) -> English digits and 01XXXXXXXXX -> 8801XXXXXXXXX.
 * - Open https://wa.me/<number> (for WhatsApp) or tel:<number> (for normal call).
 * - Say: "হোয়াটসঅ্যাপে খুলে দিয়েছি, কল বাটন চাপো।"
 */
export async function call_number(
  number: string,
  channel?: 'whatsapp' | 'tel',
  contactName?: string
): Promise<string> {
  const extracted = extractPhoneNumberFromText(number) || formatBangladeshiNumber(number);
  if (!extracted) {
    return 'সঠিক ফোন নম্বর বলো।';
  }

  const pending = getPendingContactCall();
  const effectiveChannel: 'whatsapp' | 'tel' = channel || pending?.channel || 'tel';
  const nameToSave = contactName || pending?.name;

  if (nameToSave) {
    saveInAppContact(nameToSave, extracted);
    setPendingContactCall(null);
  }

  const sig = `call_number:${extracted}:${effectiveChannel}`;
  const deduped = getRecentDedupeReply(sig);
  if (deduped) return deduped;

  const reply = openCallOrWhatsAppLink(extracted, effectiveChannel);
  saveDedupeReply(sig, reply);
  return reply;
}

export async function call(params: { number: string; channel?: 'whatsapp' | 'tel' } | string): Promise<string> {
  const rawNum = typeof params === 'string' ? params : params?.number;
  const channel = typeof params === 'object' ? params?.channel : undefined;
  return call_number(String(rawNum || ''), channel);
}

export async function open_app(name: string): Promise<string> {
  const resolved = resolveAppKey(name);
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

  const sig = `open_app:${resolved.key}`;
  const deduped = getRecentDedupeReply(sig);
  if (deduped) return deduped;

  const plugin = getRosePhonePlugin();
  if (!plugin || typeof plugin.openApp !== 'function') {
    const errMsg = 'RosePhone.openApp প্লাগইন পাওয়া যায়নি।';
    logDevError({ area: 'other', message: errMsg });
    return errMsg;
  }

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

export const openApp = open_app;
export const callContact = call_contact;
export const callNumber = call_number;

/**
 * Handles user reply when Rose asked "<name>-এর নম্বর কত?" and the user gives the number.
 */
export async function handlePendingPhoneUserReply(
  userText: string
): Promise<{ handled: boolean; reply?: string }> {
  const raw = String(userText || '').trim();
  if (!raw) return { handled: false };

  const pending = getPendingContactCall();
  if (!pending) return { handled: false };

  const extractedNumber = extractPhoneNumberFromText(raw);
  if (extractedNumber) {
    const channel: 'whatsapp' | 'tel' = isWhatsAppRequest(raw) ? 'whatsapp' : pending.channel;
    saveInAppContact(pending.name, extractedNumber);
    setPendingContactCall(null);
    const reply = openCallOrWhatsAppLink(extractedNumber, channel);
    return { handled: true, reply };
  }

  return { handled: false };
}

/**
 * Executes a "phone" / "call_contact" / "send_whatsapp" tool call from Gemini Live or typed chat.
 */
export async function executePhoneToolAction(args: {
  action?: string;
  name?: string;
  number?: string;
  phone_number?: string;
  name_or_number?: string;
  query?: string;
  app?: string;
  app_name?: string;
  channel?: string;
  via?: string;
}): Promise<{ ok: boolean; message: string }> {
  const action = String(args?.action || '').trim().toLowerCase();
  const rawChannel = String(args?.channel || args?.via || '').trim().toLowerCase();
  const pending = getPendingContactCall();

  const rawNum = String(args?.number || args?.phone_number || '').trim();
  const rawName = String(args?.name || args?.name_or_number || args?.query || '').trim();
  const isWa =
    rawChannel === 'whatsapp' ||
    action.includes('whatsapp') ||
    isWhatsAppRequest(rawName) ||
    Boolean(pending?.channel === 'whatsapp' && rawNum);
  const channel: 'whatsapp' | 'tel' = isWa ? 'whatsapp' : 'tel';

  if (action === 'open_app' || (!action && (args?.app || args?.app_name))) {
    const appName = String(args?.name || args?.app || args?.app_name || '').trim();
    const msg = await open_app(appName);
    return { ok: msg.endsWith('খুললাম।'), message: msg };
  }

  // If a phone number was provided (either in call_number, save_contact, or call_contact with a number)
  const extractedNum = extractPhoneNumberFromText(rawNum) || extractPhoneNumberFromText(rawName);
  if (extractedNum) {
    const contactName = rawNum && rawName ? cleanContactQueryName(rawName) : pending?.name;
    const msg = await call_number(extractedNum, channel, contactName);
    return { ok: true, message: msg };
  }

  if (rawName) {
    const msg = await call_contact(rawName, channel);
    return { ok: true, message: msg };
  }

  return { ok: false, message: 'কার নম্বরে কল দেব নামটা বলো।' };
}

/**
 * Typed/Voice message router for call / WhatsApp / saved contacts.
 */
export async function routePhoneActionFromText(
  rawMessage: string
): Promise<{ matched: boolean; reply?: string }> {
  const text = String(rawMessage || '').trim();
  if (!text) return { matched: false };

  // 1. Check if we were waiting for "<name>-এর নম্বর কত?" and the user just gave the number
  const pendingRes = await handlePendingPhoneUserReply(text);
  if (pendingRes.handled && pendingRes.reply) {
    return { matched: true, reply: pendingRes.reply };
  }

  // 2. Check if user is stating "<name>-এর নম্বর <number>" (save to contacts; if also asking to call, open link)
  const extractedNumber = extractPhoneNumberFromText(text);
  const hasCallVerb =
    /(কল\s*(দাও|দেও|দে|দেন|দিন|করো|কর|করুন|করে\s*দাও|দেব|দিব)|ফোন\s*(দাও|দেও|দে|দেন|দিন|করো|কর|করুন|করে\s*দাও)|ডায়াল\s*করো|হোয়াটসঅ্যাপ\s*করো|হোয়াটসঅ্যাপ\s*করো|\bcall\b|\bdial\b)/i.test(
      text
    );

  if (extractedNumber && !hasCallVerb) {
    const nameAssignMatch = text.match(
      /^(.+?)(?:-এর|\s+এর|ের)?\s+(?:ফোন\s+|মোবাইল\s+|হোয়াটসঅ্যাপ\s+|হোয়াটসঅ্যাপ\s+)?(?:নম্বর|নাম্বার|number|num)\s*(?:হলো|হচ্ছে|হল|:|-)?\s*[+০-৯0-9]/i
    );
    if (nameAssignMatch && nameAssignMatch[1]) {
      const assignedName = cleanContactQueryName(nameAssignMatch[1]);
      if (assignedName && assignedName.length >= 2) {
        saveInAppContact(assignedName, extractedNumber);
      }
    }
  }

  const isPcExplicit = /(পিসিতে|পিসির|ল্যাপটপে|কম্পিউটারে|\bon\s+pc\b|\bpc\b)/i.test(text);
  if (isPcExplicit) return { matched: false };

  // 3. Check call / WhatsApp call intent
  if (hasCallVerb) {
    const channel: 'whatsapp' | 'tel' = isWhatsAppRequest(text) ? 'whatsapp' : 'tel';

    // 3a. Direct number in the command
    if (extractedNumber) {
      const nameCandidate = cleanContactQueryName(
        text.replace(/[+০-৯0-9\s\-()]{6,}/g, ' ').replace(/(?:নম্বরে|নাম্বারে|নম্বর|নাম্বার)/g, ' ')
      );
      const reply = await call_number(
        extractedNumber,
        channel,
        nameCandidate && nameCandidate.length >= 2 ? nameCandidate : undefined
      );
      return { matched: true, reply };
    }

    // 3b. Pronoun reference to a number recently given in chat or voice ("এই নম্বরে কল দাও", "ওই নম্বরে কল দাও", "ওকে কল দাও")
    if (/(?:এই\s*নম্বরে|ওই\s*নম্বরে|নম্বরটাতে|নাম্বারটাতে|এই\s*নাম্বারে|ওকে|তাকে|উনাকে)/i.test(text)) {
      const history = getSharedRecentMessages();
      for (let i = history.length - 1; i >= 0; i--) {
        const recentNum = extractPhoneNumberFromText(history[i].text);
        if (recentNum) {
          const reply = openCallOrWhatsAppLink(recentNum, channel);
          return { matched: true, reply };
        }
      }
    }

    // 3c. Call by contact name: "<name> কে কল দাও"
    const contactName = cleanContactQueryName(text);
    if (contactName) {
      const reply = await call_contact(contactName, channel);
      return { matched: true, reply };
    }
  }

  // 4. Check open_app(name) intent
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

/**
 * Builds a shared context block containing saved contacts and recent chat/voice messages
 * so that both Chat and Live Voice always know the same recent history and contacts.
 */
export function getSharedPhoneAndHistoryContextBlock(): string {
  const contacts = getSavedInAppContacts();
  const history = getSharedRecentMessages().slice(-12);
  const lines: string[] = [];

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
