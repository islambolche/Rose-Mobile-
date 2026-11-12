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
  type?: 'assign' | 'status' | 'clarify' | 'navigation' | 'scroll' | 'clear_chat_prompt' | 'clear_chat_execute';
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
}

export const TARGET_AGENT_ALIASES: Record<'mira' | 'arin' | 'zayan' | 'naira', string[]> = {
  mira: [
    'মিরা', 'মীরা', 'মিরাকে', 'মিরার', 'মিরারে', 'মীরাকে', 'মীরার', 'মীরারে', 'মিরু',
    'mira', 'meera', 'miraa',
  ],
  arin: [
    'আরিন', 'আরিনকে', 'আরিনের', 'আরিনরে', 'আরিয়ান', 'আরিফ', 'আরিয়ানকে', 'আরিফকে',
    'arin', 'erin', 'arian', 'arif',
  ],
  zayan: [
    'জায়ান', 'জায়ানকে', 'জায়ানের', 'জায়ানরে', 'যায়ান', 'যায়ানকে', 'যায়ানের', 'যায়ানরে',
    'জায়ন', 'জায়া', 'জয়ান', 'zayan', 'jayan', 'zain', 'zaya',
  ],
  naira: [
    'নাইরা', 'নাইরাকে', 'নাইরার', 'নাইরারে', 'নায়রা', 'নায়রাকে', 'নায়রার', 'নায়রারে',
    'naira', 'nyra', 'nira',
  ],
};

export const WORK_WORDS = [
  'কাজ', 'দাও', 'বল', 'বলো', 'বলে', 'জিজ্ঞেস', 'জানতে', 'দেখো', 'করতে', 'পাঠাও',
  'ask', 'tell', 'task', 'order', 'parcel', 'audit',
];

export const STATUS_WORDS = [
  'কি করে', 'কী করে', 'কি করছে', 'কী করছে', 'করতেছে', 'করতাছে', 'কোথায়', 'কোথায়', 'কেমন আছে',
  'status', 'কি অবস্থা', 'কী অবস্থা', 'where',
];

export function detectAgentInMessage(text: string): 'mira' | 'arin' | 'zayan' | 'naira' | null {
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (/(?:মিরা|মীরা)(?:কে|র|রে|দের)?/i.test(raw) || /\b(mira|meera|miraa)\b/i.test(lower)) {
    return 'mira';
  }
  if (/(?:আরিন|আরিয়ান|আরিফ)(?:কে|ের|র|রে|দের)?/i.test(raw) || /\b(arin|erin|arian|arif)\b/i.test(lower)) {
    return 'arin';
  }
  if (/(?:জায়ান|যায়ান|জায়ন|জায়া|জয়ান)(?:কে|ের|র|রে|দের)?/i.test(raw) || /\b(zayan|jayan|zain|zaya)\b/i.test(lower)) {
    return 'zayan';
  }
  if (/(?:নাইরা|নায়রা)(?:কে|র|রে|দের)?/i.test(raw) || /\b(naira|nyra|nira)\b/i.test(lower)) {
    return 'naira';
  }

  const targetKeys: Array<'mira' | 'arin' | 'zayan' | 'naira'> = ['mira', 'arin', 'zayan', 'naira'];
  for (const agentId of targetKeys) {
    const aliases = TARGET_AGENT_ALIASES[agentId];
    for (const alias of aliases) {
      if (raw.includes(alias) || lower.includes(alias.toLowerCase())) {
        return agentId;
      }
    }
  }

  return null;
}

export async function routeUserMessageForTeamTask(
  userMessage: string,
  options: RouteMessageOptions = {}
): Promise<RouteTaskResult> {
  if (!userMessage || typeof userMessage !== 'string') {
    return { matched: false };
  }

  const rawText = userMessage.trim();
  if (!rawText) return { matched: false };

  const lower = rawText.toLowerCase();
  const effectiveDisplayName = (options.userName || 'ইউসুফ').trim();

  // Pending clear chat yes/no check (within 15s)
  if (options.pendingClearChatState?.active && (Date.now() - options.pendingClearChatState.timestamp < 15000)) {
    if (/^(হ্যাঁ|হ্যা|yes|sure|ok|অবশ্যই|হাঁ)/i.test(rawText)) {
      if (options.clearChatCallback) {
        options.clearChatCallback();
      }
      if (options.setPendingClearChatState) {
        options.setPendingClearChatState({ active: false, timestamp: 0 });
      }
      return {
        matched: true,
        type: 'clear_chat_execute',
        roseReply: 'সব চ্যাট মুছে দিলাম।',
      };
    } else if (/^(না|no|dont|cancel|থাক)/i.test(rawText)) {
      if (options.setPendingClearChatState) {
        options.setPendingClearChatState({ active: false, timestamp: 0 });
      }
      return {
        matched: true,
        type: 'clear_chat_execute',
        roseReply: 'ঠিক আছে, চ্যাট মুছলাম না।',
      };
    }
  }

  // INTENT PRIORITY (Check in exact order, stop at first match):

  // 1) Android system settings check
  if (/(ওয়াইফাই|ব্লুটুথ|ব্রাইটনেস|অ্যান্ড্রয়েড সেটিং|phone system settings|wi-fi|bluetooth|brightness)/i.test(rawText)) {
    return {
      matched: true,
      type: 'navigation',
      roseReply: 'ফোনের নিজের সেটিংস ফোন-কন্ট্রোল আপডেটে আসবে।',
    };
  }

  // 2) a) Home: (হোম|home) + (যাও|আসো|এসো|ফিরে|নিয়ে|go) OR exact হোম / home
  if (/^হোম$|^home$/i.test(rawText) || (/(হোম|home)/i.test(rawText) && /(যাও|আসো|এসো|ফিরে|নিয়ে|go)/i.test(rawText))) {
    const viewSetter = options.openPage || options.setCurrentView;
    if (viewSetter) {
      viewSetter('home');
    }
    return {
      matched: true,
      type: 'navigation',
      roseReply: 'হোমে এলাম।',
    };
  }

  // 3) b) Back: (পেছনে|পিছনে|ফিরে যাও|ব্যাক|back)
  if (/(পেছনে|পিছনে|ফিরে\s*যাও|ব্যাক|back)/i.test(rawText)) {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
    return {
      matched: true,
      type: 'navigation',
      roseReply: 'পেছনে গেলাম।',
    };
  }

  // 4) c) Open page: an action word (খোল|খুল|যাও|ঢুক|নিয়ে|দেখাও|open|go) + a page alias (or direct page alias)
  const hasOpenKeyword = /(খোলো|খুলো|খোল|খুল|যাও|এ\s*যাও|নিয়ে\s*যাও|নিয়ে\s*যাও|দেখাও|দেখো|ঢুকো|ঢুক|open|go)/i.test(rawText);
  if (hasOpenKeyword) {
    let query = rawText
      .replace(/খোলো|খুলো|খোল|খুল|যাও|এ\s*যাও|নিয়ে\s*যাও|নিয়ে\s*যাও|দেখাও|দেখো|ঢুকো|ঢুক|open|go|to/gi, '')
      .trim();
    if (!query) query = rawText;

    const { page } = findMatchingPage(query || rawText);
    if (page) {
      const viewSetter = options.openPage || options.setCurrentView;
      if (viewSetter) {
        viewSetter(page.path);
      }
      return {
        matched: true,
        type: 'navigation',
        roseReply: `${page.titleBn} খুললাম।`,
      };
    }
  }

  // Direct page alias match (e.g. "সেটিংস", "ভয়েস অ্যান্ড ল্যাঙ্গুয়েজ", "কানেকশনস")
  const { page: directPage } = findMatchingPage(rawText);
  if (directPage) {
    const viewSetter = options.openPage || options.setCurrentView;
    if (viewSetter) {
      viewSetter(directPage.path);
    }
    return {
      matched: true,
      type: 'navigation',
      roseReply: `${directPage.titleBn} খুললাম।`,
    };
  }

  // 5) d) Clear chat: ONLY if the same message contains a delete word AND (চ্যাট|হিস্টরি|হিস্ট্রি|মেসেজ)
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

  // Scroll commands: "নিচে যাও / নিচে নামাও / scroll down" & "উপরে যাও / scroll up"
  if (/নিচে\s*যাও|নিচে\s*নামাও|scroll\s*down/i.test(rawText)) {
    if (typeof window !== 'undefined') {
      window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
    }
    return {
      matched: true,
      type: 'scroll',
      roseReply: 'নিচে নামালাম।',
    };
  }
  if (/উপরে\s*যাও|scroll\s*up/i.test(rawText)) {
    if (typeof window !== 'undefined') {
      window.scrollBy({ top: -window.innerHeight * 0.8, behavior: 'smooth' });
    }
    return {
      matched: true,
      type: 'scroll',
      roseReply: 'উপরে তুললাম।',
    };
  }

  // 6) Team-wide status check: টিম, অফিস, team
  if (/(?:টিম|অফিস|team)/i.test(rawText)) {
    let summary = "আজ কাউকে কোনো কাজ দেওয়া হয়নি, সবাই ফাঁকা।";
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);

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
            const joined = activeStatuses.join(', ');
            summary = `বর্তমানে ${joined}।`;
            if (summary.length > 150) {
              summary = `বর্তমানে ${activeStatuses.slice(0, 2).join(', ')} এবং অন্যরা ডেস্কে আছে।`;
            }
          }
        }
      } catch (err) {
        console.warn('[Team Router] Team status fetch failed:', err);
      }
    }

    return {
      matched: true,
      type: 'status',
      roseReply: summary,
    };
  }

  // 7. Detect target agent anywhere in the message
  const detectedAgent = detectAgentInMessage(rawText);
  if (!detectedAgent) {
    return { matched: false };
  }

  const member = TEAM_MEMBERS[detectedAgent];
  const currentSource: 'mobile' | 'pc' =
    options.source ||
    (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'pc' : 'mobile');

  const isStatusQuery = STATUS_WORDS.some(
    (w) => rawText.includes(w) || lower.includes(w.toLowerCase())
  );

  if (isStatusQuery) {
    let roseReply = `${member.bengaliName} এখন নিজের ডেস্কে বসে আছে, কোনো কাজ নেই।`;

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('to_agent', detectedAgent)
          .order('created_at', { ascending: false })
          .limit(3);

        if (!error && data && data.length > 0) {
          const activeTask = data.find(
            (t: any) => t.status === 'working' || t.status === 'assigned'
          );
          if (activeTask) {
            roseReply = `${member.bengaliName} এখন "${activeTask.instruction}" নিয়ে কাজ করছে।`;
          } else {
            const lastDone = data.find((t: any) => t.status === 'done');
            if (lastDone && lastDone.result) {
              roseReply = `${member.bengaliName} এখন ডেস্কে আছে। কিছুক্ষণ আগেই কাজ সম্পন্ন করেছে: ${lastDone.result}`;
            }
          }
        }
      } catch (err) {
        console.warn('[Router Status Query] Supabase query failed:', err);
      }
    }

    return {
      matched: true,
      type: 'status',
      agentId: detectedAgent,
      roseReply,
    };
  }

  const hasWorkWord = WORK_WORDS.some(
    (w) => rawText.includes(w) || lower.includes(w.toLowerCase())
  );

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
      } catch (err: any) {
        console.error('[Supabase Insert Error]:', err?.message || err);
      }
    }

    officeEvents.assign('rose', detectedAgent, rawText);
    const roseReply = `ঠিক আছে ${effectiveDisplayName}, ${member.bengaliName}কে বলছি।`;

    return {
      matched: true,
      type: 'assign',
      agentId: detectedAgent,
      roseReply,
      task: newTask,
    };
  }

  const roseReply = `${effectiveDisplayName}, ${member.bengaliName}-কে কি কোনো কাজ দেব, নাকি জানতে চাও সে কী করছে?`;
  return {
    matched: true,
    type: 'clarify',
    agentId: detectedAgent,
    roseReply,
  };
}

import { sendPcCommand } from './pcCommand';

export async function routePcCommandMessage(
  userMessage: string,
  options: RouteMessageOptions = {}
): Promise<RouteTaskResult> {
  if (!userMessage || typeof userMessage !== 'string') return { matched: false };
  const text = userMessage.trim();
  const lower = text.toLowerCase();
  const effectiveDisplayName = (options.userName || 'ইউসুফ').trim();

  let pcAction: string | null = null;
  let pcArgs: Record<string, any> = {};
  let confirmNeeded = false;

  if (lower.includes('ক্রোম খোলো') || lower.includes('open chrome') || lower.includes('ল্যাপটপে ক্রোম')) {
    pcAction = 'open_app';
    pcArgs = { name: 'chrome' };
  } else if (lower.includes('লক করো') || lower.includes('lock pc') || lower.includes('ল্যাপটপ লক')) {
    pcAction = 'lock';
    pcArgs = {};
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
    pcArgs = {};
  } else if (lower.includes('শাটডাউন করো') || lower.includes('পিসি বন্ধ করো') || lower.includes('shutdown pc')) {
    pcAction = 'shutdown';
    pcArgs = {};
    confirmNeeded = true;
  }

  if (!pcAction) return { matched: false };

  if (confirmNeeded) {
    await sendPcCommand(pcAction, pcArgs, { source: options.source, onToast: options.onToast });
    return {
      matched: true,
      roseReply: `${effectiveDisplayName}, ফোনে অনুমতি অনুমতি দাও।`,
    };
  }

  const res = await sendPcCommand(pcAction, pcArgs, { source: options.source, onToast: options.onToast });
  const roseReply = res.success
    ? `ঠিক আছে ${effectiveDisplayName}, ${res.message}।`
    : `ইউসুফ, ${res.message}`;

  return {
    matched: true,
    roseReply,
  };
}
