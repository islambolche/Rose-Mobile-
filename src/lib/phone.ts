import { logDevError } from './devLog';

export const ONLY_IN_ROSE_APP_MSG = 'এটা শুধু ROSE অ্যাপে কাজ করে';
const CALL_CONFIRM_TIMEOUT_MS = 15000;
const CONTACT_SELECT_TIMEOUT_MS = 30000;
const DEDUPE_WINDOW_MS = 2500;
const CONFIRMED_CALL_COOLDOWN_MS = 6000;

export interface RoseContact {
  name: string;
  number: string;
}

interface PendingConfirmCallState {
  mode: 'confirm_call';
  name: string;
  number: string;
  timestamp: number;
}

interface PendingSelectContactState {
  mode: 'select_contact';
  contacts: RoseContact[];
  timestamp: number;
}

type PendingPhoneState = PendingConfirmCallState | PendingSelectContactState | null;

let pendingPhoneState: PendingPhoneState = null;
let lastActionCache: { signature: string; reply: string; timestamp: number } | null = null;
let lastConfirmedCall: { number: string; name: string; reply: string; timestamp: number } | null = null;

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

function normalizeBengaliDigits(input: string): string {
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

function sanitizePhoneNumber(raw: string): string {
  const ascii = normalizeBengaliDigits(raw);
  return ascii.replace(/[^\d+]/g, '').trim();
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

export function hasPendingPhoneInteraction(): boolean {
  if (!pendingPhoneState) return false;
  const now = Date.now();
  const maxAge =
    pendingPhoneState.mode === 'confirm_call' ? CALL_CONFIRM_TIMEOUT_MS : CONTACT_SELECT_TIMEOUT_MS;
  if (now - pendingPhoneState.timestamp > maxAge) {
    pendingPhoneState = null;
    return false;
  }
  return true;
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

/**
 * Raw plugin wrapper: searchContacts({ query })
 */
export async function searchContacts(
  query: string
): Promise<{ ok: boolean; contacts: RoseContact[]; message: string }> {
  if (!isNativeRoseApp()) {
    console.log('[RosePhone] searchContacts blocked: not inside native app');
    return { ok: false, contacts: [], message: ONLY_IN_ROSE_APP_MSG };
  }

  const plugin = getRosePhonePlugin();
  if (!plugin || typeof plugin.searchContacts !== 'function') {
    const errMsg = 'RosePhone.searchContacts প্লাগইন পাওয়া যায়নি।';
    console.error('[RosePhone] searchContacts error:', errMsg);
    logDevError({ area: 'other', message: errMsg });
    return { ok: false, contacts: [], message: errMsg };
  }

  try {
    const res = await plugin.searchContacts({ query: String(query || '').trim() });
    const rawList = Array.isArray(res?.contacts) ? res.contacts : [];
    const contacts: RoseContact[] = rawList
      .map((c: any) => ({
        name: String(c?.name || '').trim(),
        number: String(c?.number || '').trim(),
      }))
      .filter((c: RoseContact) => Boolean(c.name || c.number));

    console.log('[RosePhone] searchContacts result:', { query, count: contacts.length, contacts });
    return { ok: true, contacts, message: '' };
  } catch (err: any) {
    const realErr = String(err?.message || err || 'searchContacts failed').trim();
    console.error('[RosePhone] searchContacts failed:', realErr);
    logDevError({ area: 'other', message: `RosePhone.searchContacts error: ${realErr}` });
    return { ok: false, contacts: [], message: realErr };
  }
}

/**
 * Internal helper that executes window.Capacitor.Plugins.RosePhone.call({ number })
 * ONLY after user confirmation ("হ্যাঁ" / "yes") within 15s.
 */
async function executeConfirmedNativeCall(number: string, displayName?: string): Promise<string> {
  if (!isNativeRoseApp()) {
    console.log('[RosePhone] call blocked: not inside native app');
    return ONLY_IN_ROSE_APP_MSG;
  }

  const plugin = getRosePhonePlugin();
  if (!plugin || typeof plugin.call !== 'function') {
    const errMsg = 'RosePhone.call প্লাগইন পাওয়া যায়নি।';
    console.error('[RosePhone] call error:', errMsg);
    logDevError({ area: 'other', message: errMsg });
    return errMsg;
  }

  const cleanNumber = sanitizePhoneNumber(number) || String(number || '').trim();
  try {
    const res = await plugin.call({ number: cleanNumber });
    console.log('[RosePhone] call result:', { number: cleanNumber, displayName, res });
    const targetLabel = displayName && displayName !== cleanNumber ? `${displayName} (${cleanNumber})` : cleanNumber;
    const reply = `${targetLabel}-কে কল দিচ্ছি।`;
    lastConfirmedCall = {
      number: cleanNumber,
      name: displayName || cleanNumber,
      reply,
      timestamp: Date.now(),
    };
    return reply;
  } catch (err: any) {
    const realErr = String(err?.message || err || 'Call failed').trim();
    console.error('[RosePhone] call error:', realErr);
    logDevError({ area: 'other', message: `RosePhone.call error: ${realErr}` });
    return `কল ব্যর্থ: ${realErr}`;
  }
}

/**
 * 2a) call_contact(name):
 * - 0 results -> "এই নামে কাউকে পেলাম না।"
 * - 1 result -> ask "<name>-কে (<number>) কল দেব? হ্যাঁ বললে দেব।" and call only after হ্যাঁ/yes within 15 s.
 * - Several results -> list up to 3 with numbers, user says a number.
 */
export async function call_contact(name: string): Promise<string> {
  if (!isNativeRoseApp()) {
    console.log('[RosePhone] call_contact blocked: not inside native app');
    return ONLY_IN_ROSE_APP_MSG;
  }

  const cleanName = String(name || '').trim();
  if (!cleanName) {
    return 'কার নম্বরে কল দেব নামটা বলো।';
  }

  if (
    lastConfirmedCall &&
    Date.now() - lastConfirmedCall.timestamp < CONFIRMED_CALL_COOLDOWN_MS &&
    lastConfirmedCall.name.toLowerCase().includes(cleanName.toLowerCase())
  ) {
    return lastConfirmedCall.reply;
  }

  const sig = `call_contact:${cleanName.toLowerCase()}`;
  const deduped = getRecentDedupeReply(sig);
  if (deduped) return deduped;

  const searchRes = await searchContacts(cleanName);
  if (!searchRes.ok) {
    return searchRes.message || ONLY_IN_ROSE_APP_MSG;
  }

  const contacts = searchRes.contacts;
  if (contacts.length === 0) {
    pendingPhoneState = null;
    const msg = 'এই নামে কাউকে পেলাম না।';
    saveDedupeReply(sig, msg);
    return msg;
  }

  if (contacts.length === 1) {
    const c = contacts[0];
    pendingPhoneState = {
      mode: 'confirm_call',
      name: c.name || cleanName,
      number: c.number,
      timestamp: Date.now(),
    };
    console.log('[RosePhone] Staged 15s call confirmation for contact:', pendingPhoneState);
    const msg = `${c.name || cleanName}-কে (${c.number}) কল দেব? হ্যাঁ বললে দেব।`;
    saveDedupeReply(sig, msg);
    return msg;
  }

  const top3 = contacts.slice(0, 3);
  pendingPhoneState = {
    mode: 'select_contact',
    contacts: top3,
    timestamp: Date.now(),
  };
  const bengaliNums = ['১', '২', '৩'];
  const listText = top3
    .map((c, i) => `${bengaliNums[i] || i + 1}) ${c.name} (${c.number})`)
    .join(', ');
  console.log('[RosePhone] Multiple contacts found, waiting for user selection:', top3);
  const msg = `একাধিক নম্বর পাওয়া গেছে: ${listText}। কোন নম্বরটা বলো।`;
  saveDedupeReply(sig, msg);
  return msg;
}

/**
 * 2b) call_number(number):
 * Same confirmation ("<number>-কে (<number>) কল দেব? হ্যাঁ বললে দেব।") and call only after হ্যাঁ/yes within 15 s.
 */
export async function call_number(number: string): Promise<string> {
  if (!isNativeRoseApp()) {
    console.log('[RosePhone] call_number blocked: not inside native app');
    return ONLY_IN_ROSE_APP_MSG;
  }

  const cleanNumber = sanitizePhoneNumber(number);
  if (!cleanNumber) {
    return 'সঠিক ফোন নম্বর বলো।';
  }

  if (
    lastConfirmedCall &&
    Date.now() - lastConfirmedCall.timestamp < CONFIRMED_CALL_COOLDOWN_MS &&
    lastConfirmedCall.number === cleanNumber
  ) {
    return lastConfirmedCall.reply;
  }

  const sig = `call_number:${cleanNumber}`;
  const deduped = getRecentDedupeReply(sig);
  if (deduped) return deduped;

  pendingPhoneState = {
    mode: 'confirm_call',
    name: cleanNumber,
    number: cleanNumber,
    timestamp: Date.now(),
  };
  console.log('[RosePhone] Staged 15s call confirmation for number:', pendingPhoneState);
  const msg = `${cleanNumber}-কে (${cleanNumber}) কল দেব? হ্যাঁ বললে দেব।`;
  saveDedupeReply(sig, msg);
  return msg;
}

/**
 * Direct call({ number }) export: stages confirmation unless already confirmed via user's yes
 */
export async function call(params: { number: string } | string): Promise<string> {
  if (!isNativeRoseApp()) {
    console.log('[RosePhone] call blocked: not inside native app');
    return ONLY_IN_ROSE_APP_MSG;
  }
  const rawNum = typeof params === 'string' ? params : params?.number;
  return call_number(String(rawNum || ''));
}

/**
 * 2c) open_app(name):
 * Map names to packages and say "<app> খুললাম।"
 */
export async function open_app(name: string): Promise<string> {
  if (!isNativeRoseApp()) {
    console.log('[RosePhone] open_app blocked: not inside native app');
    return ONLY_IN_ROSE_APP_MSG;
  }

  const resolved = resolveAppKey(name);
  if (!resolved) {
    return `এই অ্যাপটি তালিকায় নেই (${name})।`;
  }

  const sig = `open_app:${resolved.key}`;
  const deduped = getRecentDedupeReply(sig);
  if (deduped) return deduped;

  const plugin = getRosePhonePlugin();
  if (!plugin || typeof plugin.openApp !== 'function') {
    const errMsg = 'RosePhone.openApp প্লাগইন পাওয়া যায়নি।';
    console.error('[RosePhone] open_app error:', errMsg);
    logDevError({ area: 'other', message: errMsg });
    return errMsg;
  }

  try {
    const res = await plugin.openApp({ package: resolved.pkg });
    console.log('[RosePhone] openApp result:', { app: resolved.key, package: resolved.pkg, res });
    const msg = `${resolved.key} খুললাম।`;
    saveDedupeReply(sig, msg);
    return msg;
  } catch (err: any) {
    const realErr = String(err?.message || err || 'openApp failed').trim();
    console.error('[RosePhone] openApp error:', realErr);
    logDevError({ area: 'other', message: `RosePhone.openApp error (${resolved.pkg}): ${realErr}` });
    return `${resolved.key} খোলা যায়নি: ${realErr}`;
  }
}

export const openApp = open_app;
export const callContact = call_contact;
export const callNumber = call_number;

/**
 * Handles user reply when a call confirmation (15s) or multi-contact selection is pending.
 */
export async function handlePendingPhoneUserReply(
  userText: string
): Promise<{ handled: boolean; reply?: string }> {
  if (!pendingPhoneState) return { handled: false };

  const now = Date.now();
  const raw = String(userText || '').trim();
  if (!raw) return { handled: false };
  const ascii = normalizeBengaliDigits(raw).toLowerCase();

  if (pendingPhoneState.mode === 'confirm_call') {
    if (now - pendingPhoneState.timestamp > CALL_CONFIRM_TIMEOUT_MS) {
      console.log('[RosePhone] 15s call confirmation expired');
      pendingPhoneState = null;
      return { handled: false };
    }

    const isNo =
      /(?:^|[\s,।.!?])(না|নাহ|নো|থাক|দরকার\s*নেই|বাদ\s*দাও|করো\s*না|দিও\s*না)(?:$|[\s,।.!?])/i.test(raw) ||
      /\b(no|nope|cancel|don'?t|stop)\b/i.test(ascii);

    const isYes =
      !isNo &&
      (/(?:^|[\s,।.!?])(হ্যাঁ|হ্যা|হাঁ|হুম|জি|জী|দাও|করো|কল\s*দাও|কল\s*করো|ফোন\s*দাও)(?:$|[\s,।.!?])/i.test(raw) ||
        /\b(yes|yep|yeah|ok|okay|sure|call)\b/i.test(ascii));

    if (isYes) {
      const target = pendingPhoneState;
      pendingPhoneState = null;
      const reply = await executeConfirmedNativeCall(target.number, target.name);
      return { handled: true, reply };
    }

    if (isNo) {
      console.log('[RosePhone] User cancelled pending call');
      pendingPhoneState = null;
      return { handled: true, reply: 'ঠিক আছে, কল দিলাম না।' };
    }

    return { handled: false };
  }

  if (pendingPhoneState.mode === 'select_contact') {
    if (now - pendingPhoneState.timestamp > CONTACT_SELECT_TIMEOUT_MS) {
      pendingPhoneState = null;
      return { handled: false };
    }

    const candidates = pendingPhoneState.contacts;
    let chosen: RoseContact | null = null;

    if (/(?:^|\s)(1|এক|প্রথম|প্রথমটা|এক\s*নম্বর)(?:$|[\s,।.!?])/i.test(ascii) && candidates[0]) {
      chosen = candidates[0];
    } else if (/(?:^|\s)(2|দুই|দ্বিতীয়|দ্বিতীয়|দ্বিতীয়টা|দুই\s*নম্বর)(?:$|[\s,।.!?])/i.test(ascii) && candidates[1]) {
      chosen = candidates[1];
    } else if (/(?:^|\s)(3|তিন|তৃতীয়|তৃতীয়|তৃতীয়টা|তিন\s*নম্বর)(?:$|[\s,।.!?])/i.test(ascii) && candidates[2]) {
      chosen = candidates[2];
    } else {
      const spokenDigits = sanitizePhoneNumber(ascii);
      if (spokenDigits.length >= 3) {
        chosen =
          candidates.find((c) => {
            const cDigits = sanitizePhoneNumber(c.number);
            return cDigits === spokenDigits || cDigits.endsWith(spokenDigits) || spokenDigits.endsWith(cDigits);
          }) || null;
      }
    }

    if (chosen) {
      pendingPhoneState = {
        mode: 'confirm_call',
        name: chosen.name,
        number: chosen.number,
        timestamp: Date.now(),
      };
      console.log('[RosePhone] Contact selected from list, staged 15s confirmation:', pendingPhoneState);
      return {
        handled: true,
        reply: `${chosen.name}-কে (${chosen.number}) কল দেব? হ্যাঁ বললে দেব।`,
      };
    }
  }

  return { handled: false };
}

/**
 * Executes a "phone" tool call from Gemini Live or typed router.
 */
export async function executePhoneToolAction(args: {
  action?: string;
  name?: string;
  number?: string;
  query?: string;
  app?: string;
}): Promise<{ ok: boolean; message: string }> {
  if (!isNativeRoseApp()) {
    console.log('[RosePhone] executePhoneToolAction blocked: not inside native app');
    return { ok: false, message: ONLY_IN_ROSE_APP_MSG };
  }

  const action = String(args?.action || '').trim().toLowerCase();
  if (action === 'call_contact') {
    const contactName = String(args?.name || args?.query || '').trim();
    const msg = await call_contact(contactName);
    return { ok: !msg.startsWith('কল ব্যর্থ'), message: msg };
  }

  if (action === 'call_number') {
    const num = String(args?.number || args?.name || '').trim();
    const msg = await call_number(num);
    return { ok: !msg.startsWith('কল ব্যর্থ'), message: msg };
  }

  if (action === 'open_app') {
    const appName = String(args?.name || args?.app || '').trim();
    const msg = await open_app(appName);
    return { ok: msg.endsWith('খুললাম।'), message: msg };
  }

  return { ok: false, message: `অজানা ফোন অ্যাকশন: ${action}` };
}

/**
 * Typed/Voice message router for "phone" actions (call_contact, call_number, open_app)
 */
export async function routePhoneActionFromText(
  rawMessage: string
): Promise<{ matched: boolean; reply?: string }> {
  const text = String(rawMessage || '').trim();
  if (!text) return { matched: false };

  // 1. Check pending confirmation / contact selection first
  const pendingRes = await handlePendingPhoneUserReply(text);
  if (pendingRes.handled && pendingRes.reply) {
    return { matched: true, reply: pendingRes.reply };
  }

  const isPcExplicit = /(পিসিতে|পিসির|ল্যাপটপে|কম্পিউটারে|\bon\s+pc\b|\bpc\b)/i.test(text);
  if (isPcExplicit) return { matched: false };

  // 2. Check open_app(name) intent
  const hasOpenVerb = /(খোলো|খোল|খুলো|খুলে\s*দাও|চালু\s*করো|চালাও|ওপেন\s*করো|ওপেন|\bopen\b|\blaunch\b)/i.test(text);
  if (hasOpenVerb) {
    const resolvedApp = resolveAppKey(text);
    if (resolvedApp) {
      const reply = await open_app(resolvedApp.key);
      return { matched: true, reply };
    }
  }

  // 3. Check call_number / call_contact intent
  const hasCallVerb =
    /(কল\s*(দাও|দেও|দে|দেন|দিন|করো|কর|করুন|করে\s*দাও|দেব)|ফোন\s*(দাও|দেও|দে|দেন|দিন|করো|কর|করুন|করে\s*দাও)|\bcall\b|\bdial\b)/i.test(text);
  if (hasCallVerb) {
    const ascii = normalizeBengaliDigits(text);
    const numMatch = ascii.match(/(?:\+?88)?01\d{3}[-\s]?\d{6}|\+?\d[\d\s-]{5,14}\d/);
    if (numMatch) {
      const reply = await call_number(numMatch[0]);
      return { matched: true, reply };
    }

    // Extract contact name from Bengali or English call command
    const contactName = text
      .replace(/^(রোজ|rose)\s*[,:-]?\s*/i, '')
      .replace(/\b(please|প্লিজ|একটু)\b/gi, '')
      .replace(/\b(call|dial)\b/gi, '')
      .replace(/(কে\s+|রে\s+|এর\s+নম্বরে\s+|নম্বরে\s+)?(একটা\s+)?(কল|ফোন)\s*(দাও|দেও|দে|দেন|দিন|করো|কর|করুন|করে\s*দাও|দেব).*/i, '')
      .replace(/(কল|ফোন)\s*(দাও|দেও|দে|দেন|দিন|করো|কর|করুন|করে\s*দাও|দেব)/gi, '')
      .replace(/[-–—,:।.?!"']/g, ' ')
      .replace(/(কে|রে)$/i, '')
      .trim();

    if (contactName) {
      const reply = await call_contact(contactName);
      return { matched: true, reply };
    }
  }

  return { matched: false };
}
