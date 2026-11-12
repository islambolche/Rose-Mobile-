import { supabase } from './supabase';
import {
  TEAM_MEMBERS,
  TeamAgentId,
  AgentTaskRecord,
  generateTaskId,
} from './team';
import { officeEvents } from '../components/pc/office/officeEngine';

export interface RouteTaskResult {
  matched: boolean;
  type?: 'assign' | 'status' | 'clarify';
  agentId?: TeamAgentId;
  roseReply?: string;
  task?: AgentTaskRecord;
}

export interface RouteMessageOptions {
  userName?: string;
  source?: 'mobile' | 'pc';
  isVoiceCall?: boolean;
  onToast?: (message: string) => void;
}

/**
 * Exact required aliases with Bengali suffixes (কে/র/এর/রে/দের):
 * mira: মিরা, মীরা, মিরাকে, মিরার, মিরারে, মীরাকে, মীরার
 * arin: আরিন, আরিনকে, আরিনের, আরিনরে, আরিফ, আরিয়ান
 * zayan: জায়ান, জায়ানকে, জায়ানের, জায়ানরে, যায়ান, যায়ানকে, যায়ানের
 * naira: নাইরা, নাইরাকে, নাইরার, নাইরারে, নায়রা, নায়রাকে
 */
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

/**
 * Work words: কাজ, দাও, বল, বলো, বলে, জিজ্ঞেস, জানতে, দেখো, করতে, পাঠাও, ask, tell
 */
export const WORK_WORDS = [
  'কাজ', 'দাও', 'বল', 'বলো', 'বলে', 'জিজ্ঞেস', 'জানতে', 'দেখো', 'করতে', 'পাঠাও',
  'ask', 'tell', 'task', 'order', 'parcel', 'audit',
];

/**
 * Status words: কি করে, কী করে, কি করছে, কী করছে, করতেছে, করতাছে, কোথায়, কেমন আছে, status
 */
export const STATUS_WORDS = [
  'কি করে', 'কী করে', 'কি করছে', 'কী করছে', 'করতেছে', 'করতাছে', 'কোথায়', 'কোথায়', 'কেমন আছে',
  'status', 'কি অবস্থা', 'কী অবস্থা', 'where',
];

/**
 * Helper to detect target team agent even if the sentence is broken by voice transcription
 * or attached to Bengali suffixes (কে/র/এর/রে).
 */
export function detectAgentInMessage(text: string): 'mira' | 'arin' | 'zayan' | 'naira' | null {
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  // 1. Direct Regex with Bengali suffixes (কে/র/এর/রে/দের)
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

  // 2. Full Alias array check
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

/**
 * Checks a user message against local team rules before sending to AI model.
 */
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

  // 0. Team-wide status check: টিম, অফিস, team
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
            // Cap at ~2 sentences roughly by cutting if too long or just keeping it compact
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

  // 1. Detect target agent anywhere in the message (handles broken voice transcription)
  const detectedAgent = detectAgentInMessage(rawText);
  if (!detectedAgent) {
    return { matched: false };
  }

  const member = TEAM_MEMBERS[detectedAgent];
  const effectiveDisplayName = (options.userName || 'ইউসুফ').trim();
  const currentSource: 'mobile' | 'pc' =
    options.source ||
    (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'pc' : 'mobile');

  // 2. Check if asking what they are doing (status words)
  const isStatusQuery = STATUS_WORDS.some(
    (w) => rawText.includes(w) || lower.includes(w.toLowerCase())
  );

  if (isStatusQuery) {
    console.log('[Router Match] Detected agent status query:', {
      agent: detectedAgent,
      text: rawText,
    });

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

  // 3. Check if message contains a work word
  const hasWorkWord = WORK_WORDS.some(
    (w) => rawText.includes(w) || lower.includes(w.toLowerCase())
  );

  if (hasWorkWord) {
    console.log('[Router Match] Detected agent work task assignment:', {
      agent: detectedAgent,
      instruction: rawText,
      source: currentSource,
    });

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

    // Insert into Supabase public.tasks
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .insert([newTask])
          .select();

        if (error) {
          console.error('[Supabase Insert Error] public.tasks insert failed:', error.message);
          if (options.onToast) {
            options.onToast('টাস্ক তৈরিতে সমস্যা: ' + error.message);
          }
        } else {
          console.log('[Supabase Insert Success] public.tasks row created:', {
            id: data?.[0]?.id || newTask.id,
            to_agent: detectedAgent,
            status: 'assigned',
          });
        }
      } catch (err: any) {
        console.error('[Supabase Insert Error] Exception during tasks insert:', err?.message || err);
        if (options.onToast) {
          options.onToast('টাস্ক তৈরিতে সমস্যা: ' + (err?.message || 'Error'));
        }
      }
    }

    // Trigger local office animation
    officeEvents.assign('rose', detectedAgent, rawText);

    // One short sentence response: "ঠিক আছে <display name>, <agent Bengali name>-কে বলছি।"
    const roseReply = `ঠিক আছে ${effectiveDisplayName}, ${member.bengaliName}কে বলছি।`;

    return {
      matched: true,
      type: 'assign',
      agentId: detectedAgent,
      roseReply,
      task: newTask,
    };
  }

  // 4. Otherwise → ask ONE short question: "ইউসুফ, <name>-কে কি কোনো কাজ দেব, নাকি জানতে চাও সে কী করছে?"
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

  // Simple PC command pattern matching
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
    const res = await sendPcCommand(pcAction, pcArgs, { source: options.source, onToast: options.onToast });
    return {
      matched: true,
      roseReply: `${effectiveDisplayName}, ফোনে অনুমতি দাও।`,
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
