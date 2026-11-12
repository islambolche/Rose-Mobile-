import { supabase } from './supabase';
import {
  TEAM_MEMBERS,
  TeamAgentId,
  AgentTaskRecord,
  generateTaskId,
} from './team';
import { officeEvents } from '../components/pc/office/officeEngine';
import { PAGES_REGISTRY, findMatchingPage, PageRegistration } from './navRegistry';

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

export const MAIN_SETTINGS_BARS = [
  { path: 'about', titleBn: 'এবাউট অ্যান্ড গাইড' },
  { path: 'connections', titleBn: 'কানেকশনস' },
  { path: 'live-model', titleBn: 'লাইভ ভয়েস মডেল' },
  { path: 'voice', titleBn: 'ভয়েস অ্যান্ড ল্যাঙ্গুয়েজ' },
  { path: 'memory', titleBn: 'চ্যাটস অ্যান্ড মেমোরি' },
  { path: 'look', titleBn: 'লুক অ্যান্ড ফিল' },
  { path: 'phone', titleBn: 'ফোন কন্ট্রোল' },
  { path: 'pc-setup', titleBn: 'পিসি সেটআপ' },
  { path: 'privacy', titleBn: 'প্রাইভেসি' },
];

export const VOICE_SETTINGS_BARS = [
  { path: 'tts-model', titleBn: 'টিটিএস মডেল' },
  { path: 'edit-assistant-name', titleBn: 'অ্যাসিস্ট্যান্ট নাম' },
  { path: 'edit-user-name', titleBn: 'তোমার নাম' },
  { path: 'personality', titleBn: 'পার্সোনালিটি' },
  { path: 'affection', titleBn: 'অ্যাফেকশন' },
  { path: 'language-list', titleBn: 'ল্যাঙ্গুয়েজ' },
  { path: 'response-style-list', titleBn: 'রেসপন্স স্টাইল' },
  { path: 'voice-list', titleBn: 'ভয়েস' },
  { path: 'voice-model-list', titleBn: 'ভয়েস মডেল লিস্ট' },
  { path: 'voice-tuning', titleBn: 'ভয়েস টিউনিং' },
  { path: 'voice-debug', titleBn: 'ভয়েস চেক' },
  { path: 'mic-listening', titleBn: 'মাইক অ্যান্ড লিসেনিং' },
];

export const NUMBER_WORDS_MAP: Record<string, number> = {
  '১': 1, 'এক': 1, 'one': 1, '1': 1,
  '২': 2, 'দুই': 2, 'two': 2, '2': 2,
  '৩': 3, 'তিন': 3, 'three': 3, '3': 3,
  '৪': 4, 'চার': 4, 'four': 4, '4': 4,
  '৫': 5, 'পাঁচ': 5, 'five': 5, '5': 5,
  '৬': 6, 'ছয়': 6, 'six': 6, '6': 6,
  '৭': 7, 'সাত': 7, 'seven': 7, '7': 7,
  '৮': 8, 'আট': 8, 'eight': 8, '8': 8,
  '৯': 9, 'নয়': 9, 'nine': 9, '9': 9,
  '১০': 10, 'দশ': 10, 'ten': 10, '10': 10,
  '১১': 11, '11': 11, '১২': 12, '12': 12,
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

  // 1. Pending Clear Chat check (15s)
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

  // 2. Pending Navigation Clarification check (15s)
  if (options.pendingNavClarifyState?.active && (Date.now() - options.pendingNavClarifyState.timestamp < 15000)) {
    const candOpts = options.pendingNavClarifyState.options;
    let chosenPage: PageRegistration | null = null;

    // Check if reply is number 1, 2, 3
    const numKey = rawText.replace(/[^0-9১-৯একদুইতিন]/g, '');
    const num = NUMBER_WORDS_MAP[numKey] || parseInt(numKey, 10);
    if (!isNaN(num) && num >= 1 && num <= candOpts.length) {
      chosenPage = candOpts[num - 1];
    } else {
      // Check if text matches any option
      const { page } = findMatchingPage(rawText);
      if (page && candOpts.some(c => c.id === page.id)) {
        chosenPage = page;
      }
    }

    if (options.setPendingNavClarifyState) {
      options.setPendingNavClarifyState({ active: false, timestamp: 0, options: [] });
    }

    if (chosenPage) {
      const viewSetter = options.openPage || options.setCurrentView;
      if (viewSetter) viewSetter(chosenPage.path);
      return { matched: true, type: 'navigation', roseReply: `${chosenPage.titleBn} খুললাম।` };
    }
  }

  // 3. INTENT PRIORITY:

  // A) App vs Phone Settings
  const hasAppWord = /(তোমার|রোজের|অ্যাপের|এই\s*অ্যাপ)/i.test(rawText);
  const hasPhoneWord = /(আমার\s*মোবাইলের|আমার\s*ফোনের|ফোনের\s*নিজের|অ্যান্ড্রয়েড|ওয়াইফাই|ব্লুটুথ|ব্রাইটনেস|android|wifi|bluetooth|brightness)/i.test(lower);
  if (hasPhoneWord && !hasAppWord) {
    return {
      matched: true,
      type: 'navigation',
      roseReply: 'ফোনের নিজের সেটিংস এখনো খুলতে পারি না, ফোন-কন্ট্রোল আপডেটে আসবে।',
    };
  }

  // B) Home
  if (/^হোম$|^home$/i.test(rawText) || (/(হোম|home)/i.test(rawText) && /(যাও|আসো|এসো|ফিরে|নিয়ে|go)/i.test(rawText))) {
    const viewSetter = options.openPage || options.setCurrentView;
    if (viewSetter) viewSetter('home');
    return { matched: true, type: 'navigation', roseReply: 'হোমে এলাম।' };
  }

  // C) Back
  if (/(পেছনে|পিছনে|ফিরে\s*যাও|ব্যাক|back)/i.test(rawText)) {
    if (typeof window !== 'undefined') window.history.back();
    return { matched: true, type: 'navigation', roseReply: 'পেছনে গেলাম।' };
  }

  // D) Compound commands: "<settings> এ ঢুকে <bar> এ যাও/ঢুকো"
  const compoundMatch = rawText.match(/(?:সেটিংস|settings)\s*(?:এ|তে)?\s*(?:ঢুকে|গিয়ে|গয়ে|র\s*ভিতরে|র\s*মাঝে)?\s*(.+)/i);
  if (compoundMatch && compoundMatch[1]) {
    const subQuery = compoundMatch[1].replace(/(খোলো|খুলো|খোল|খুল|যাও|এ\s*যাও|নিয়ে\s*যাও|নিয়ে\s*যাও|দেখাও|দেখো|ঢুকো|ঢুক|open|go|এ|তে|এতে)/gi, '').trim();
    const { page } = findMatchingPage(subQuery || compoundMatch[1]);
    if (page) {
      const viewSetter = options.openPage || options.setCurrentView;
      if (viewSetter) viewSetter(page.path);
      return { matched: true, type: 'navigation', roseReply: `${page.titleBn} খুললাম।` };
    }
  }

  // E) Bar Number commands: "সেটিংসের ৩ নম্বর খোলো" or "৩ নম্বরে যাও"
  const numBarMatch = rawText.match(/(?:নম্বর|নম্বরে|নাম্বার|number)?\s*([০-৯0-9 একদুইতিনচারপাঁচছয়সাতআটনয়দশ]+)\s*(?:নম্বর|নম্বরে|নাম্বার|নম্বরটা|number)?/i);
  if (numBarMatch && numBarMatch[1]) {
    const nKey = numBarMatch[1].trim();
    const barNum = NUMBER_WORDS_MAP[nKey] || parseInt(nKey, 10);
    if (!isNaN(barNum)) {
      // Check if main settings or voice bars
      const targetBar = MAIN_SETTINGS_BARS[barNum - 1];
      if (targetBar) {
        const viewSetter = options.openPage || options.setCurrentView;
        if (viewSetter) viewSetter(targetBar.path);
        return { matched: true, type: 'navigation', roseReply: `${targetBar.titleBn} খুললাম।` };
      }
    }
  }

  // F) Open page (with fuzzy matching and low confidence fallback)
  const hasOpenKeyword = /(খোলো|খুলো|খোল|খুল|যাও|এ\s*যাও|নিয়ে\s*যাও|নিয়ে\s*যাও|দেখাও|দেখো|ঢুকো|ঢুক|open|go)/i.test(rawText);
  let queryToMatch = rawText;
  if (hasOpenKeyword) {
    queryToMatch = rawText
      .replace(/খোলো|খুলো|খোল|খুল|যাও|এ\s*যাও|নিয়ে\s*যাও|নিয়ে\s*যাও|দেখাও|দেখো|ঢুকো|ঢুক|open|go|to/gi, '')
      .trim();
    if (!queryToMatch) queryToMatch = rawText;
  }

  const { page, lowConfidence, top3 } = findMatchingPage(queryToMatch);
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

  // G) Clear chat
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

  // Scroll commands
  if (/নিচে\s*যাও|নিচে\s*নামাও|scroll\s*down/i.test(rawText)) {
    if (typeof window !== 'undefined') window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
    return { matched: true, type: 'scroll', roseReply: 'নিচে নামালাম।' };
  }
  if (/উপরে\s*যাও|scroll\s*up/i.test(rawText)) {
    if (typeof window !== 'undefined') window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
    return { matched: true, type: 'scroll', roseReply: 'উপরে তুললাম।' };
  }

  // Team status check
  if (/(?:টিম|অফিস|team)/i.test(rawText)) {
    let summary = "আজ কাউকে কোনো কাজ দেওয়া হয়নি, সবাই ফাঁকা।";
    if (supabase) {
      try {
        const { data, error } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(20);
        if (!error && data && data.length > 0) {
          const agents: TeamAgentId[] = ['mira', 'arin', 'zayan', 'naira'];
          const activeStatuses: string[] = [];
          for (const id of agents) {
            const lastTask = data.find((t: any) => t.to_agent === id);
            if (lastTask) {
              const name = TEAM_MEMBERS[id].bengaliName;
              if (lastTask.status === 'working' || lastTask.status === 'assigned') {
                activeStatuses.push(`${name} "${lastTask.instruction}" নিয়ে কাজ করছে`);
              } else if (lastTask.status === 'done' && lastTask.result) {
                activeStatuses.push(`${name} "${lastTask.result}" সম্পন্ন করেছে`);
              }
            }
          }
          if (activeStatuses.length > 0) {
            summary = `বর্তমানে ${activeStatuses.join(', ')}।`;
          }
        }
      } catch (err) {}
    }
    return { matched: true, type: 'status', roseReply: summary };
  }

  // Detect target agent
  const detectedAgent = detectAgentInMessage(rawText);
  if (!detectedAgent) return { matched: false };

  const member = TEAM_MEMBERS[detectedAgent];
  const currentSource: 'mobile' | 'pc' = options.source || (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'pc' : 'mobile');
  const isStatusQuery = STATUS_WORDS.some((w) => rawText.includes(w) || lower.includes(w.toLowerCase()));

  if (isStatusQuery) {
    let roseReply = `${member.bengaliName} এখন নিজের ডেস্কে বসে আছে, কোনো কাজ নেই।`;
    if (supabase) {
      try {
        const { data } = await supabase.from('tasks').select('*').eq('to_agent', detectedAgent).order('created_at', { ascending: false }).limit(3);
        if (data && data.length > 0) {
          const activeTask = data.find((t: any) => t.status === 'working' || t.status === 'assigned');
          if (activeTask) roseReply = `${member.bengaliName} এখন "${activeTask.instruction}" নিয়ে কাজ করছে।`;
        }
      } catch (err) {}
    }
    return { matched: true, type: 'status', agentId: detectedAgent, roseReply };
  }

  const hasWorkWord = WORK_WORDS.some((w) => rawText.includes(w) || lower.includes(w.toLowerCase()));
  if (hasWorkWord) {
    const newTask: AgentTaskRecord = {
      id: generateTaskId(),
      created_at: new Date().toISOString(),
      from_agent: 'rose',
      to_agent: detectedAgent,
      instruction: rawText,
      status: 'assigned',
      reply: null,
      result: null,
      source: currentSource,
    };
    if (supabase) {
      try {
        await supabase.from('tasks').insert([newTask]).select();
      } catch (err) {}
    }
    officeEvents.assign('rose', detectedAgent, rawText);
    const roseReply = `ঠিক আছে, ${member.bengaliName}কে বলছি।`;
    return { matched: true, type: 'assign', agentId: detectedAgent, roseReply, task: newTask };
  }

  const roseReply = `${member.bengaliName}-কে কি কোনো কাজ দেব, নাকি জানতে চাও সে কী করছে?`;
  return { matched: true, type: 'clarify', agentId: detectedAgent, roseReply };
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
  return { matched: true, roseReply: res.success ? `ঠিক আছে, ${res.message}।` : res.message };
}
