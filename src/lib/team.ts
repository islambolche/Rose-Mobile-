import { supabase } from './supabase';

export type TeamAgentId = 'rose' | 'mira' | 'arin' | 'zayan' | 'naira';

export interface TeamMemberConfig {
  id: TeamAgentId;
  name: string;
  bengaliName: string;
  role: string;
  bengaliRole: string;
  color: string;
  avatar: string;
  aliases: string[];
  systemPrompt: string;
}

export const TEAM_MEMBERS: Record<TeamAgentId, TeamMemberConfig> = {
  rose: {
    id: 'rose',
    name: 'Rose',
    bengaliName: 'রোজ',
    role: 'Chief Business Manager',
    bengaliRole: 'চিফ বিজনেস ম্যানেজার ও টিম লিডার',
    color: '#EC4899',
    avatar: '/office/avatars/rose.jpg',
    aliases: ['Rose', 'রোজ', 'রোজ আপু', 'আপু', 'ম্যানেজার'],
    systemPrompt: 'You are Rose, Chief Business Manager and team leader of this 5-member AI company.',
  },
  mira: {
    id: 'mira',
    name: 'Mira',
    bengaliName: 'মিরা',
    role: 'Customer Communication',
    bengaliRole: 'কাস্টমার কমিউনিকেশন ও ইনবক্স সাপোর্ট',
    color: '#10B981',
    avatar: '/office/avatars/mira.jpg',
    aliases: ['Mira', 'মিরা', 'মীরা', 'Meera', 'Miraa', 'মিরু'],
    systemPrompt:
      'You are Mira (Customer Communication). You handle customer inquiries, order confirmations, polite client messages, WhatsApp/Facebook message replies, and customer satisfaction in fluent, polite Bengali.',
  },
  arin: {
    id: 'arin',
    name: 'Arin',
    bengaliName: 'আরিন',
    role: 'Sales & Order',
    bengaliRole: 'সেলস, ইনভেন্টরি ও অর্ডার ম্যানেজমেন্ট',
    color: '#3B82F6',
    avatar: '/office/avatars/arin.jpg',
    aliases: ['Arin', 'আরিন', 'Arian', 'Erin', 'আরিফ', 'আরিয়ান', 'Arif'],
    systemPrompt:
      'You are Arin (Sales & Order). You manage customer sales, product stock checks, inventory updates, daily revenue calculations, and discount approvals in concise, business-smart Bengali.',
  },
  zayan: {
    id: 'zayan',
    name: 'Zayan',
    bengaliName: 'জায়ান',
    role: 'Parcel & Delivery',
    bengaliRole: 'পার্সেল, কুরিয়ার ও ডেলিভারি ট্র্যাকিং',
    color: '#F97316',
    avatar: '/office/avatars/zayan.jpg',
    aliases: ['Zayan', 'জায়ান', 'যায়ান', 'Jayan', 'Zain', 'জায়ন', 'জায়া', 'জায়ন', 'জেয়ান'],
    systemPrompt:
      'You are Zayan (Parcel & Delivery). You manage logistics, courier dispatches (Pathao, Steadfast, RedX), package tracking codes, delivery confirmations, and returns in crisp, efficient Bengali.',
  },
  naira: {
    id: 'naira',
    name: 'Naira',
    bengaliName: 'নাইরা',
    role: 'Business Audit & Analytics',
    bengaliRole: 'বিজনেস অডিট, লাভ-লোকসান ও অ্যানালিটিক্স',
    color: '#A855F7',
    avatar: '/office/avatars/naira.jpg',
    aliases: ['Naira', 'নাইরা', 'নায়রা', 'Nyra', 'Nira', 'নায়রা', 'নায়েরা'],
    systemPrompt:
      'You are Naira (Business Audit & Analytics). You inspect company finances, audit expenses, calculate net profit margins, detect financial discrepancies, and generate executive summaries in analytical, clear Bengali.',
  },
};

export const TEAM_MEMBERS_LIST: TeamMemberConfig[] = Object.values(TEAM_MEMBERS);

/**
 * Resolves a spoken or typed name/alias to an exact TeamAgentId
 */
export function resolveAgentId(input: string): TeamAgentId | null {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim();
  const lower = raw.toLowerCase();

  for (const member of TEAM_MEMBERS_LIST) {
    if (member.id.toLowerCase() === lower) return member.id;
    if (member.name.toLowerCase() === lower) return member.id;
    if (member.bengaliName === raw) return member.id;

    for (const alias of member.aliases) {
      const aliasLower = alias.toLowerCase();
      if (aliasLower === lower || lower.includes(aliasLower) || raw.includes(alias)) {
        return member.id;
      }
    }
  }

  // Common keyword fallback
  if (lower.includes('কাস্টমার') || lower.includes('মেসেজ') || lower.includes('customer') || lower.includes('inbox')) {
    return 'mira';
  }
  if (lower.includes('সেলস') || lower.includes('অর্ডার') || lower.includes('sales') || lower.includes('order') || lower.includes('স্টক')) {
    return 'arin';
  }
  if (lower.includes('পার্সেল') || lower.includes('কুরিয়ার') || lower.includes('ডেলিভারি') || lower.includes('parcel') || lower.includes('delivery')) {
    return 'zayan';
  }
  if (lower.includes('অডিট') || lower.includes('হিসাব') || lower.includes('লাভ') || lower.includes('audit') || lower.includes('analytics')) {
    return 'naira';
  }

  return null;
}

export const TEAM_SYSTEM_INSTRUCTION = `
You are Rose, the chief manager of a 5-member AI team: Mira, Arin, Zayan, Naira (roles above). They are your team members inside this app, not phone contacts. Names in speech may be misheard; match them using the aliases. Never ask for a phone number for them.

TEAM STRUCTURE & ROLES:
- Mira: Customer Communication (গ্রাহক সেবা, মেসেজের রিপ্লাই ও ইনবক্স হ্যান্ডলিং)
- Arin: Sales & Order (নতুন সেলস, স্টক যাচাই ও অর্ডার কনফার্মেশন)
- Zayan: Parcel & Delivery (পার্সেল বুকিং, কুরিয়ার ট্র্যাকিং ও ডেলিভারি স্ট্যাটাস)
- Naira: Business Audit & Analytics (অডিট, লাভ-লোকসান ও ব্যবসায়িক আর্থিক হিসাব)
- Rose (You): Chief Business Manager (সবার বস ও সার্বিক সমন্বয়ক)

WORK TASK COMMAND RULE (HIGHEST PRIORITY - OVERRIDES ALL OTHER EMOTION/BREVITY RULES FOR WORK COMMANDS):
When the user asks you to give a task to, ask, or check on Mira, Arin, Zayan or Naira, do NOT ask clarifying questions and do NOT write long emotional text. Immediately call assign_task with a clear instruction (for example, 'ask what tasks you can do' is a valid instruction), then reply in one short warm sentence like 'ঠিক আছে ইউসুফ, জায়ানকে জিজ্ঞেস করছি।' When the result comes back, tell the user the agent's answer briefly.
`.trim();

export const ROSE_TEAM_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'assign_task',
        description: 'Assign a work task to an AI team member (mira, arin, zayan, or naira). They will acknowledge and start executing the task.',
        parameters: {
          type: 'OBJECT',
          properties: {
            agent: {
              type: 'STRING',
              description: 'Target team member ID or name: "mira", "arin", "zayan", or "naira"',
            },
            instruction: {
              type: 'STRING',
              description: 'Clear task instruction or work order for the agent',
            },
          },
          required: ['agent', 'instruction'],
        },
      },
      {
        name: 'get_team_status',
        description: 'Check the status, current task, or recent activities of an AI team member or all team members.',
        parameters: {
          type: 'OBJECT',
          properties: {
            agent: {
              type: 'STRING',
              description: 'Optional agent name or ID ("mira", "arin", "zayan", "naira"). If omitted, checks all team members.',
            },
          },
        },
      },
    ],
  },
];

export interface AgentTaskRecord {
  id: string;
  created_at: string;
  from_agent: string;
  to_agent: string;
  instruction: string;
  status: 'assigned' | 'working' | 'done';
  reply: string | null;
  result: string | null;
  source: 'mobile' | 'pc';
}

// In-memory fallback task store for offline / non-Supabase mode
const fallbackTasks: AgentTaskRecord[] = [];
const taskListeners = new Set<(task: AgentTaskRecord) => void>();

export function subscribeToLocalTasks(listener: (task: AgentTaskRecord) => void): () => void {
  taskListeners.add(listener);
  return () => taskListeners.delete(listener);
}

function notifyLocalTask(task: AgentTaskRecord) {
  taskListeners.forEach((fn) => {
    try {
      fn(task);
    } catch {}
  });
}

export function generateTaskId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

/**
 * Assign a task to an AI team member and insert into public.tasks (or fallback store)
 */
export async function assignTask(params: {
  agent: string;
  instruction: string;
  source?: 'mobile' | 'pc';
}): Promise<{ success: boolean; task: AgentTaskRecord; message: string }> {
  console.log('[ToolCall Received] assign_task:', params);

  const resolvedId = resolveAgentId(params.agent) || 'mira';
  const targetMember = TEAM_MEMBERS[resolvedId] || TEAM_MEMBERS.mira;

  const currentSource: 'mobile' | 'pc' =
    params.source ||
    (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'pc' : 'mobile');

  const newTask: AgentTaskRecord = {
    id: generateTaskId(),
    created_at: new Date().toISOString(),
    from_agent: 'rose',
    to_agent: targetMember.id,
    instruction: params.instruction.trim(),
    status: 'assigned',
    reply: null,
    result: null,
    source: currentSource,
  };

  // Keep in local cache
  fallbackTasks.unshift(newTask);
  if (fallbackTasks.length > 50) fallbackTasks.pop();

  if (supabase) {
    try {
      const { data, error } = await supabase.from('tasks').insert([newTask]).select();
      if (!error && data && data.length > 0) {
        console.log('[Supabase Insert Success] public.tasks row created:', {
          id: data[0].id,
          to_agent: data[0].to_agent,
          status: data[0].status,
        });
        return {
          success: true,
          task: data[0] as AgentTaskRecord,
          message: `ঠিক আছে, ${targetMember.bengaliName}-কে কাজ বুঝিয়ে দেওয়া হয়েছে।`,
        };
      } else if (error) {
        console.error('[Supabase Insert Error] public.tasks insert failed:', error.message);
      }
    } catch (err: any) {
      console.error('[Supabase Insert Error] Exception during tasks insert:', err?.message || err);
    }
  }

  // Fallback notification
  notifyLocalTask(newTask);

  return {
    success: true,
    task: newTask,
    message: `ঠিক আছে, ${targetMember.bengaliName}-কে কাজ বুঝিয়ে দেওয়া হয়েছে।`,
  };
}

/**
 * Retrieve team status or specific agent status from public.tasks (or fallback store)
 */
export async function getTeamStatus(agentNameOrId?: string): Promise<{
  success: boolean;
  agent?: string;
  summary: string;
  tasks: AgentTaskRecord[];
}> {
  console.log('[ToolCall Received] get_team_status:', agentNameOrId);
  const targetId = agentNameOrId ? resolveAgentId(agentNameOrId) : null;

  if (supabase) {
    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (targetId) {
        query = query.eq('to_agent', targetId).limit(5);
      }

      const { data, error } = await query;
      if (!error && data) {
        const records = data as AgentTaskRecord[];
        return formatStatusSummary(targetId, records);
      }
    } catch (err) {
      console.warn('[Team] Supabase getTeamStatus failed, using local cache:', err);
    }
  }

  // Fallback cache
  const filtered = targetId
    ? fallbackTasks.filter((t) => t.to_agent === targetId).slice(0, 5)
    : fallbackTasks.slice(0, 10);

  return formatStatusSummary(targetId, filtered);
}

function formatStatusSummary(
  targetId: TeamAgentId | null,
  tasks: AgentTaskRecord[]
): {
  success: boolean;
  agent?: string;
  summary: string;
  tasks: AgentTaskRecord[];
} {
  if (targetId) {
    const member = TEAM_MEMBERS[targetId];
    const memberTasks = tasks.filter((t) => t.to_agent === targetId);
    const activeTask = memberTasks.find((t) => t.status === 'working' || t.status === 'assigned');

    if (activeTask) {
      return {
        success: true,
        agent: targetId,
        summary: `${member.bengaliName} বর্তমানে "${activeTask.instruction}" নিয়ে কাজ করছেন।`,
        tasks: memberTasks,
      };
    }

    const lastDone = memberTasks.find((t) => t.status === 'done');
    if (lastDone && lastDone.result) {
      return {
        success: true,
        agent: targetId,
        summary: `${member.bengaliName} এখন ফাঁকা আছে। তার শেষ সম্পন্ন কাজ: ${lastDone.result}`,
        tasks: memberTasks,
      };
    }

    return {
      success: true,
      agent: targetId,
      summary: `${member.bengaliName} এখন ফাঁকা আছে, নতুন কাজের জন্য প্রস্তুত।`,
      tasks: memberTasks,
    };
  }

  // Summary of all agents
  const lines: string[] = [];
  const validAgentIds: TeamAgentId[] = ['mira', 'arin', 'zayan', 'naira'];

  for (const id of validAgentIds) {
    const member = TEAM_MEMBERS[id];
    const memberTask = tasks.find((t) => t.to_agent === id && (t.status === 'working' || t.status === 'assigned'));
    if (memberTask) {
      lines.push(`${member.bengaliName}: কর্মরত (${memberTask.instruction})`);
    } else {
      lines.push(`${member.bengaliName}: ফাঁকা আছে`);
    }
  }

  return {
    success: true,
    summary: `টিমের সার্বিক স্ট্যাটাস:\n${lines.join('\n')}`,
    tasks,
  };
}

export function updateLocalTaskState(updated: AgentTaskRecord) {
  const idx = fallbackTasks.findIndex((t) => t.id === updated.id);
  if (idx >= 0) {
    fallbackTasks[idx] = updated;
  } else {
    fallbackTasks.unshift(updated);
  }
  notifyLocalTask(updated);
}
