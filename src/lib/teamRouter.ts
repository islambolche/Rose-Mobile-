import { supabase } from './supabase';
import {
  TEAM_MEMBERS,
  TeamAgentId,
  AgentTaskRecord,
  generateTaskId,
} from './team';
import { officeEvents } from '../components/pc/office/officeEngine';
import { PAGES_REGISTRY, findMatchingPage, PageRegistration } from './navRegistry';
import { goBack } from './navExecutor';

export interface RouteTaskResult {
  matched: boolean;
  type?: 'assign' | 'status' | 'clarify' | 'navigation' | 'scroll' | 'clear_chat_prompt' | 'clear_chat_execute' | 'navigation_clarify';
  agentId?: TeamAgentId;
  roseReply?: string;
  task?: AgentTaskRecord;
  navigationAction?: {
    action: 'goto' | 'back' | 'home' | 'scroll_down' | 'scroll_up' | 'clear_chat';
    pageId?: string;
  };
}

export interface RouteMessageOptions {
  userName?: string;
  source?: 'mobile' | 'pc';
  isVoiceCall?: boolean;
  onToast?: (message: string) => void;
  setCurrentView?: (view: string) => void;
  openPage?: (view: string) => void;
  clearChatCallback?: () => void;
  pendingClearChatState?: { active: boolean; timestamp: number };
  setPendingClearChatState?: (state: { active: boolean; timestamp: number }) => void;
  pendingNavClarifyState?: { active: boolean; timestamp: number; options: PageRegistration[] };
  setPendingNavClarifyState?: (state: { active: boolean; timestamp: number; options: PageRegistration[] }) => void;
}

export const NUMBER_WORDS_MAP: Record<string, number> = {
  '১': 1, 'এক': 1, 'একটা': 1, 'প্রথম': 1, 'one': 1, '1': 1,
  '২': 2, 'দুই': 2, 'দুইটা': 2, 'দ্বিতীয়': 2, 'two': 2, '2': 2,
  '৩': 3, 'তিন': 3, 'তিনটা': 3, 'তৃতীয়': 3, 'three': 3, '3': 3,
};

export const TARGET_AGENT_ALIASES: Record<'mira' | 'arin' | 'zayan' | 'naira', string[]> = {
  mira: ['মিরা', 'মীরা', 'মিরাকে', 'মিরার', 'মিরারে', 'মীরাকে', 'মীরার', 'মীরারে', 'মিরু', 'mira', 'meera', 'miraa'],
  arin: ['আরিন', 'আরিনকে', 'আরিনের', 'আরিনরে', 'আরিয়ান', 'আরিফ', 'আরিয়ানকে', 'আরিফকে', 'arin', 'erin', 'arian', 'arif'],
  zayan: ['জায়ান', 'জায়ানকে', 'জায়ানের', 'জায়ানরে', 'যায়ান', 'যায়ানকে', 'যায়ানের', 'যায়ানরে', 'জায়ন', 'জায়া', 'জয়ান', 'zayan', 'jayan', 'zain', 'zaya'],
  naira: ['নাইরা', 'নাইরাকে', 'নাইরার', 'নাইরারে', 'নায়রা', 'নায়রাকে', 'নায়রার', 'নায়রারে', 'naira', 'nyra', 'nira'],
};

export const WORK_WORDS = ['কাজ', 'দাও', 'বল', 'বলো', 'বলে', 'জিজ্ঞেস', 'জানতে', 'দেখো', 'করতে', 'পাঠাও', 'ask', 'tell', 'task', 'order', 'parcel', 'audit'];
export const STATUS_WORDS = ['কি করে', 'কী করে', 'কি করছে', 'কী করছে', 'করতেছে', 'করতাছে', 'কোথায়', 'কোথায়', 'কেমন আছে', 'status', 'কি অবস্থা', 'কী অবস্থা', 'where'];

export function detectAgentInMessage(text: string): 'mira' | 'arin' | 'zayan' | 'naira' | null {
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (/(?:মিরা|মীরা)(?:কে|র|রে|দের)?/i.test(raw) || /\b(mira|meera|miraa)\b/i.test(lower)) return 'mira';
  if (/(?:আরিন|আরিয়ান|আরিফ)(?:কে|ের|র|রে|দের)?/i.test(raw) || /\b(arin|erin|arian|arif)\b/i.test(lower)) return 'arin';
  if (/(?:জায়ান|যায়ান|জায়ন|জায়া|জয়ান)(?:কে|ের|র|রে|দের)?/i.test(raw) || /\b(zayan|jayan|zain|zaya)\b/i.test(lower)) return 'zayan';
  if (/(?:নাইরা|নায়রা)(?:কে|র|রে|দের)?/i.test(raw) || /\b(naira|nyra|nira)\b/i.test(lower)) return 'naira';

  const targetKeys: Array<'mira' | 'arin' | 'zayan' | 'naira'> = ['mira', 'arin', 'zayan', 'naira'];
  for (const agentId of targetKeys) {
    const aliases = TARGET_AGENT_ALIASES[agentId];
    for (const alias of aliases) {
      if (raw.includes(alias) || lower.includes(alias.toLowerCase())) return agentId;
    }
  }
  return null;
}

export async function routeUserMessageForTeamTask(
  userMessage: string,
  options: RouteMessageOptions = {}
): Promise<RouteTaskResult> {
  if (!userMessage || typeof userMessage !== 'string') return { matched: false };
  const rawText = userMessage.trim();
  if (!rawText) return { matched: false };
  const lower = rawText.toLowerCase();

  // 1. PENDING CHOICE FIRST (30-second expiry)
  if (options.pendingNavClarifyState?.active && (Date.now() - options.pendingNavClarifyState.timestamp < 30000)) {
    const candOpts = options.pendingNavClarifyState.options;

    // Check cancel
    if (/(না|বাদ|cancel)/i.test(rawText)) {
      if (options.setPendingNavClarifyState) {
        options.setPendingNavClarifyState({ active: false, timestamp: 0, options: [] });
      }
      return { matched: true, type: 'navigation', roseReply: 'ঠিক আছে।' };
    }

    // Check number 1-3
    const numKey = rawText.replace(/[^0-9১-৯একদুইতিনএকটাদুইটাতিনটাপ্রথমদ্বিতীয়তৃতীয়one-three]/g, '');
    let chosenIdx = -1;
    for (const [k, v] of Object.entries(NUMBER_WORDS_MAP)) {
      if (numKey.includes(k) || rawText.includes(k)) {
        chosenIdx = v - 1;
        break;
      }
    }
    const directNum = parseInt(numKey, 10);
    if (chosenIdx === -1 && !isNaN(directNum) && directNum >= 1 && directNum <= candOpts.length) {
      chosenIdx = directNum - 1;
    }

    if (options.setPendingNavClarifyState) {
      options.setPendingNavClarifyState({ active: false, timestamp: 0, options: [] });
    }

    if (chosenIdx >= 0 && chosenIdx < candOpts.length) {
      const chosenPage = candOpts[chosenIdx];
      const viewSetter = options.openPage || options.setCurrentView;
      if (viewSetter) viewSetter(chosenPage.path);
      return { matched: true, type: 'navigation', roseReply: `${chosenPage.titleBn} খুললাম।` };
    }
  }

  // Clear pending choice if expired or non-matching message
  if (options.pendingNavClarifyState?.active) {
    if (options.setPendingNavClarifyState) {
      options.setPendingNavClarifyState({ active: false, timestamp: 0, options: [] });
    }
  }

  // 2. Pending Clear Chat check (15s)
  if (options.pendingClearChatState?.active && (Date.now() - options.pendingClearChatState.timestamp < 15000)) {
    if (/^(হ্যাঁ|হ্যা|yes|sure|ok|অবশ্যই|হাঁ)/i.test(rawText)) {
      if (options.clearChatCallback) options.clearChatCallback();
      if (options.setPendingClearChatState) options.setPendingClearChatState({ active: false, timestamp: 0 });
      return { matched: true, type: 'clear_chat_execute', roseReply: 'সব চ্যাট মুছে দিলাম।' };
    } else if (/^(না|no|dont|cancel|থাক)/i.test(rawText)) {
      if (options.setPendingClearChatState) options.setPendingClearChatState({ active: false, timestamp: 0 });
      return { matched: true, type: 'clear_chat_execute', roseReply: 'ঠিক আছে, চ্যাট মুছলাম না।' };
    }
  }

  // 3. App vs Phone Settings
  const hasAppWord = /(তোমার|রোজের|অ্যাপের|এই\s*অ্যাপ)/i.test(rawText);
  const hasPhoneWord = /(আমার\s*মোবাইলের|আমার\s*ফোনের|ফোনের\s*নিজের|অ্যান্ড্রয়েড|ওয়াইফাই|ব্লুটুথ|ব্রাইটনেস|android|wifi|bluetooth|brightness)/i.test(lower);
  if (hasPhoneWord && !hasAppWord) {
    return {
      matched: true,
      type: 'navigation',
      roseReply: 'ফোনের নিজের সেটিংস এখনো খুলতে পারি না, ফোন-কন্ট্রোল আপডেটে আসবে।',
    };
  }

  // 4. ACTION WORD REQUIREMENT: Navigation runs ONLY if message contains an action word
  const hasActionWord = /(খোল|খুল|খোলো|যাও|যা|ঢুক|ঢোকো|নিয়ে\s*যাও|দেখাও|open|go|back|পেছনে|ফিরে|(হোম.*(আসো|যাও))|((আসো|যাও).*হোম))/i.test(rawText);
  const isDirectHome = /^হোম$|^home$/i.test(rawText);
  const isDirectBack = /^ব্যাক$|^back$|পেছনে\s*যাও/i.test(rawText);

  if (!hasActionWord && !isDirectHome && !isDirectBack) {
    return { matched: false };
  }

  // 5. Home
  if (isDirectHome || (/(হোম|home)/i.test(rawText) && /(যাও|আসো|এসো|ফিরে|নিয়ে|go)/i.test(rawText))) {
    const viewSetter = options.openPage || options.setCurrentView;
    if (viewSetter) viewSetter('home');
    return { matched: true, type: 'navigation', roseReply: 'হোমে এলাম।' };
  }

  // 6. Back
  if (isDirectBack || /(পেছনে|পিছনে|ফিরে\s*যাও|ব্যাক|back)/i.test(rawText)) {
    const res = await goBack();
    return {
      matched: true,
      type: 'navigation',
      roseReply: res.ok ? 'পেছনে গেলাম।' : 'পেছনে যাওয়া গেল না।',
    };
  }

  // 7. Remove filler words before fuzzy matching:
  // Filler words: রোজ, রোস, তুমি, তোমার, আমার, আমাকে, এখন, একটু, যে, টা, টি, প্লিজ, please, and action words.
  const fillerRegex = /\b(রোজ|রোস|তুমি|তোমার|আমার|আমাকে|এখন|একটু|যে|টা|টি|প্লিজ|please|খোলো|খুলো|খোল|খুল|যাও|যা|ঢুক|ঢোকো|নিয়ে\s*যাও|দেখাও|open|go|back|পেছনে|ফিরে)\b/gi;
  const cleanedQuery = rawText.replace(fillerRegex, '').trim();

  if (!cleanedQuery) {
    // If nothing remains (e.g. just "খোলো"), ask "কোনটা খুলব?" with the 3 most used pages
    const top3 = [
      PAGES_REGISTRY.find(p => p.id === 'settings')!,
      PAGES_REGISTRY.find(p => p.id === 'connections')!,
      PAGES_REGISTRY.find(p => p.id === 'voice_language')!,
    ].filter(Boolean);

    if (options.setPendingNavClarifyState) {
      options.setPendingNavClarifyState({ active: true, timestamp: Date.now(), options: top3 });
    }
    return {
      matched: true,
      type: 'navigation_clarify',
      roseReply: `কোনটা খুলব? ১. ${top3[0]?.titleBn || 'সেটিংস'} ২. ${top3[1]?.titleBn || 'কানেকশনস'} ৩. ${top3[2]?.titleBn || 'ভয়েস অ্যান্ড ল্যাঙ্গুয়েজ'}`,
    };
  }

  // 8. Fuzzy matching with score thresholds:
  // >= 0.75 -> direct match
  // 0.50 to 0.75 -> low confidence ("কোনটা খুলব? ১. A ২. B ৩. C")
  // < 0.50 -> do nothing (matched: false)
  const { page, lowConfidence, top3 } = findMatchingPage(cleanedQuery);

  if (lowConfidence && top3.length > 0) {
    if (options.setPendingNavClarifyState) {
      options.setPendingNavClarifyState({ active: true, timestamp: Date.now(), options: top3 });
    }
    const t1 = top3[0]?.titleBn || '';
    const t2 = top3[1]?.titleBn || '';
    const t3 = top3[2]?.titleBn || '';
    return {
      matched: true,
      type: 'navigation_clarify',
      roseReply: `কোনটা খুলব? ১. ${t1} ২. ${t2} ৩. ${t3}`,
    };
  }

  if (page) {
    const viewSetter = options.openPage || options.setCurrentView;
    if (viewSetter) viewSetter(page.path);
    return {
      matched: true,
      type: 'navigation',
      roseReply: `${page.titleBn} খুললাম।`,
    };
  }

  // 9. Clear chat
  const isClearIntent = /(মুছ|মুছে|ডিলিট|delete|clear|ক্লিয়ার)/i.test(rawText) && /(চ্যাট|হিস্টরি|হিস্ট্রি|মেসেজ)/i.test(rawText);
  if (isClearIntent) {
    if (options.setPendingClearChatState) {
      options.setPendingClearChatState({ active: true, timestamp: Date.now() });
    }
    return {
      matched: true,
      type: 'clear_chat_prompt',
      roseReply: 'সব চ্যাট মুছে দেব? হ্যাঁ বললে মুছব।',
    };
  }

  return { matched: false };
}

import { sendPcCommand } from './pcCommand';

export async function routePcCommandMessage(
  userMessage: string,
  options: RouteMessageOptions = {}
): Promise<RouteTaskResult> {
  if (!userMessage || typeof userMessage !== 'string') return { matched: false };
  const text = userMessage.trim();
  const lower = text.toLowerCase();
  let pcAction: string | null = null;
  let pcArgs: Record<string, any> = {};
  let confirmNeeded = false;

  if (lower.includes('ক্রোম খোলো') || lower.includes('open chrome')) {
    pcAction = 'open_app';
    pcArgs = { name: 'chrome' };
  } else if (lower.includes('লক করো') || lower.includes('lock pc')) {
    pcAction = 'lock';
  } else if (lower.includes('ভলিউম বাড়াও') || lower.includes('volume up')) {
    pcAction = 'media';
    pcArgs = { key: 'volume_up' };
  } else if (lower.includes('ভলিউম কমাও') || lower.includes('volume down')) {
    pcAction = 'media';
    pcArgs = { key: 'volume_down' };
  } else if (lower.includes('মিউট করো') || lower.includes('mute pc')) {
    pcAction = 'media';
    pcArgs = { key: 'mute' };
  } else if (lower.includes('স্ক্রিনশট নাও') || lower.includes('take screenshot')) {
    pcAction = 'screenshot';
  } else if (lower.includes('শাটডাউন করো') || lower.includes('shutdown pc')) {
    pcAction = 'shutdown';
    confirmNeeded = true;
  }

  if (!pcAction) return { matched: false };
  if (confirmNeeded) {
    await sendPcCommand(pcAction, pcArgs, { source: options.source, onToast: options.onToast });
    return { matched: true, roseReply: 'ফোনে অনুমতি দাও।' };
  }

  const res = await sendPcCommand(pcAction, pcArgs, { source: options.source, onToast: options.onToast });
  return { matched: true, roseReply: res.success ? `ঠিক আছে, ${res.message}።` : res.message };
}
