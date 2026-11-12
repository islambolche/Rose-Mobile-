import { supabase } from './supabase';
import {
  TEAM_MEMBERS,
  TeamAgentId,
  AgentTaskRecord,
  assignTask,
  getTeamStatus,
} from './team';
import { officeEvents } from '../components/pc/office/officeEngine';
import { isAdmin } from './admin';
import { openPage } from './nav';
import { routePhoneActionFromText } from './phone';

export interface RouteTaskResult {
  matched: boolean;
  type?: 'assign' | 'status' | 'clarify' | 'navigation' | 'scroll' | 'clear_chat_prompt' | 'clear_chat_execute' | 'phone';
  agentId?: TeamAgentId;
  roseReply?: string;
  task?: AgentTaskRecord;
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
  pendingNavClarifyState?: any;
  setPendingNavClarifyState?: (st: any) => void;
}

export const TARGET_AGENT_ALIASES: Record<'mira' | 'arin' | 'zayan' | 'naira', string[]> = {
  mira: ['মিরা', 'মীরা', 'মিরাকে', 'মিরার', 'মিরারে', 'মীরাকে', 'মীরার', 'মীরারে', 'মিরু', 'mira', 'meera', 'miraa'],
  arin: ['আরিন', 'আরিনকে', 'আরিনের', 'আরিনরে', 'আরিয়ান', 'আরিফ', 'আরিয়ানকে', 'আরিফকে', 'arin', 'erin', 'arian', 'arif'],
  zayan: ['জায়ান', 'জায়ানকে', 'জায়ানের', 'জায়ানরে', 'যায়ান', 'যায়ানকে', 'যায়ানের', 'যায়ানরে', 'জায়ন', 'জায়া', 'জয়ান', 'zayan', 'jayan', 'zain', 'zaya'],
  naira: ['নাইরা', 'নাইরাকে', 'নাইরার', 'নাইরারে', 'নায়রা', 'নায়রাকে', 'নায়রার', 'নায়রারে', 'naira', 'nyra', 'nira'],
};

export const WORK_WORDS = ['কাজ', 'দাও', 'বল', 'বলো', 'বলে', 'জিজ্ঞেস', 'জানতে', 'দেখো', 'করতে', 'পাঠাও', 'ask', 'tell', 'task', 'order', 'parcel', 'audit'];
export const STATUS_WORDS = ['কি করে', 'কী করে', 'ki kore', 'কি করছে', 'কী করছে', 'করতেছে', 'করতাছে', 'কোথায়', 'কোথায়', 'কেমন আছে', 'status', 'কি অবস্থা', 'কী অবস্থা', 'where'];

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

  // 1b. Phone actions ("phone": call_contact, call_number, open_app, and 15s confirmation / contact choice)
  const phoneRoute = await routePhoneActionFromText(rawText);
  if (phoneRoute.matched && phoneRoute.reply) {
    return {
      matched: true,
      type: 'phone',
      roseReply: phoneRoute.reply,
    };
  }

  // 2. App vs Phone Settings
  const hasAppWord = /(তোমার|রোজের|অ্যাপের|এই\s*অ্যাপ)/i.test(rawText);
  const hasPhoneWord = /(আমার\s*মোবাইলের|আমার\s*ফোনের|ফোনের\s*নিজের|অ্যান্ড্রয়েড|ওয়াইফাই|ব্লুটুথ|ব্রাইটনেস|android|wifi|bluetooth|brightness)/i.test(lower);
  if (hasPhoneWord && !hasAppWord) {
    return {
      matched: true,
      type: 'navigation',
      roseReply: 'ফোনের নিজের সেটিংস এখনো খুলতে পারি না, ফোন-কন্ট্রোল আপডেটে আসবে।',
    };
  }

  // 3. Clear chat intent
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

  // Camera voice commands (Admin only)
  const isCameraSwitchCmd = /(পেছনের\s*ক্যামেরা|সামনের\s*ক্যামেরা|ক্যামেরা\s*ঘোরাও|ক্যামেরা\s*সুইচ|switch\s*camera|flip\s*camera)/i.test(rawText);
  const isCameraOffCmd = /(ক্যামেরা|camera).*(বন্ধ|অফ|off|stop|disable|close)/i.test(rawText) && !isCameraSwitchCmd;
  const isCameraOnCmd = /(ক্যামেরা|camera).*(চালু|অন|open|start|enable)/i.test(rawText) && !isCameraSwitchCmd;

  if (isCameraOnCmd || isCameraOffCmd || isCameraSwitchCmd) {
    if (!isAdmin()) {
      return {
        matched: true,
        roseReply: 'ক্যামেরা সুবিধা শুধু অ্যাডমিনের জন্য।',
      };
    }
    if (typeof window !== 'undefined') {
      const cmd = isCameraOffCmd ? 'off' : isCameraSwitchCmd ? 'switch' : 'on';
      window.dispatchEvent(new CustomEvent('live-camera-command', { detail: { command: cmd } }));
    }
    const reply = isCameraOffCmd
      ? 'ক্যামেরা বন্ধ করলাম।'
      : isCameraSwitchCmd
      ? 'ক্যামেরা পরিবর্তন করলাম।'
      : 'ক্যামেরা চালু করলাম।';
    return {
      matched: true,
      roseReply: reply,
    };
  }

  // Developer Tools voice/typed commands (Admin only)
  const isDevLogCmd = /(ডেভেলপার\s*লগ|error\s*log|এরর\s*লগ)/i.test(rawText);
  const isFindProblemsCmd = /(সমস্যা\s*(খুঁজো|খুজো|খোঁজো|খোজো|বের\s*করো|দেখো)|find\s*problems)/i.test(rawText);
  if (isDevLogCmd || isFindProblemsCmd) {
    if (!isAdmin()) {
      return {
        matched: true,
        roseReply: 'এই ফিচার শুধু অ্যাডমিনের জন্য।',
      };
    }
    const targetId = isDevLogCmd ? 'error_log' : 'find_problems';
    if (typeof window !== 'undefined') {
      openPage(targetId).catch(() => {});
    }
    return {
      matched: true,
      type: 'navigation',
      roseReply: isDevLogCmd ? 'ডেভেলপার লগ দেখাচ্ছি।' : 'সমস্যা খোঁজার পেজ খুলছি।',
    };
  }

  // 4. Team agent or team status detection
  const isTeamGeneralStatus = /(টিম|অফিস|সবাই)/i.test(rawText);
  const detectedAgent = detectAgentInMessage(rawText);
  const isStatusQuery = isTeamGeneralStatus || STATUS_WORDS.some(w => lower.includes(w)) || (detectedAgent && STATUS_WORDS.some(w => lower.includes(w)));

  if (isTeamGeneralStatus || (detectedAgent && isStatusQuery)) {
    const statusRes = await getTeamStatus(detectedAgent || undefined);
    return {
      matched: true,
      type: 'status',
      agentId: detectedAgent || undefined,
      roseReply: statusRes.summary,
    };
  }

  if (detectedAgent) {
    const isWorkRequest = WORK_WORDS.some(w => lower.includes(w)) || rawText.length > 5;
    if (isWorkRequest) {
      const member = TEAM_MEMBERS[detectedAgent];
      const res = await assignTask({ agent: detectedAgent, instruction: rawText, source: options.source });
      return {
        matched: true,
        type: 'assign',
        agentId: detectedAgent,
        roseReply: `${member.bengaliName}-কে কাজটা দিচ্ছি।`,
        task: res.task,
      };
    }
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

  const hasExplicitPc = /(পিসি|পিসিতে|ল্যাপটপ|কম্পিউটার|\bpc\b|\blaptop\b)/i.test(text);

  if ((lower.includes('ক্রোম খোলো') || lower.includes('open chrome')) && hasExplicitPc) {
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
