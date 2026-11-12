import { supabase } from './supabase';

export type TeamAgentId = 'mira' | 'arin' | 'zayan' | 'naira';

export interface TeamMemberConfig {
  id: TeamAgentId;
  name: string;
  bengaliName: string;
  role: string;
  roleBengali: string;
  bengaliRole: string;
  avatar: string;
  skills: string[];
  color?: string;
}

export const TEAM_MEMBERS: Record<TeamAgentId, TeamMemberConfig> = {
  mira: {
    id: 'mira',
    name: 'Mira',
    bengaliName: 'মিরা',
    role: 'Customer Communication',
    roleBengali: 'গ্রাহক সেবা ও মেসেজ ইনবক্স',
    bengaliRole: 'গ্রাহক সেবা ও মেসেজ ইনবক্স',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    skills: ['Inbox Management', 'Customer Support', 'FAQ Resolution'],
  },
  arin: {
    id: 'arin',
    name: 'Arin',
    bengaliName: 'আরিন',
    role: 'Sales & Order',
    roleBengali: 'সেলস ও অর্ডার কনফার্মেশন',
    bengaliRole: 'সেলস ও অর্ডার কনফার্মেশন',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    skills: ['Order Processing', 'Stock Verification', 'Sales Analytics'],
  },
  zayan: {
    id: 'zayan',
    name: 'Zayan',
    bengaliName: 'জায়ান',
    role: 'Parcel & Delivery',
    roleBengali: 'পার্সেল ও কুরিয়ার ট্র্যাকিং',
    bengaliRole: 'পার্সেল ও কুরিয়ার ট্র্যাকিং',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    skills: ['Courier Dispatch', 'Delivery Tracking', 'Logistics'],
  },
  naira: {
    id: 'naira',
    name: 'Naira',
    bengaliName: 'নাইরা',
    role: 'Business Audit & Analytics',
    roleBengali: 'অডিট ও ব্যবসায়িক হিসাব',
    bengaliRole: 'অডিট ও ব্যবসায়িক হিসাব',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    skills: ['Financial Audit', 'Profit/Loss Tracking', 'Business Reports'],
  },
};

export const TEAM_MEMBERS_LIST = Object.values(TEAM_MEMBERS);

export function updateLocalTaskState(task: any) {
  try {
    const tasks = JSON.parse(localStorage.getItem('local_tasks') || '[]');
    const idx = tasks.findIndex((t: any) => t.id === task.id);
    if (idx >= 0) {
      tasks[idx] = task;
    } else {
      tasks.unshift(task);
    }
    localStorage.setItem('local_tasks', JSON.stringify(tasks));
  } catch (e) {}
}

export function subscribeToLocalTasks(callback: (task: any) => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === 'local_tasks') {
      try {
        const tasks = JSON.parse(e.newValue || '[]');
        if (tasks.length > 0) callback(tasks[0]);
      } catch (err) {}
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handler);
  }
  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handler);
    }
  };
}

export interface AgentTaskRecord {
  id: string;
  created_at: string;
  from_agent: string;
  to_agent: TeamAgentId;
  instruction: string;
  status: 'assigned' | 'working' | 'done' | 'failed';
  reply: string | null;
  result: string | null;
  source: 'mobile' | 'pc';
}

export function generateTaskId(): string {
  return 'task_' + Math.random().toString(36).substring(2, 9);
}

export async function assignTask(params: {
  agent: string;
  instruction: string;
  source?: 'mobile' | 'pc';
}): Promise<{ success: boolean; message: string; task: AgentTaskRecord }> {
  const targetRaw = params.agent.toLowerCase().trim();
  let targetAgent: TeamAgentId = 'mira';

  if (targetRaw.includes('arin') || targetRaw.includes('আরিন')) targetAgent = 'arin';
  else if (targetRaw.includes('zayan') || targetRaw.includes('জায়ান') || targetRaw.includes('যায়ান')) targetAgent = 'zayan';
  else if (targetRaw.includes('naira') || targetRaw.includes('নাইরা') || targetRaw.includes('নায়রা')) targetAgent = 'naira';
  else if (targetRaw.includes('mira') || targetRaw.includes('মিরা') || targetRaw.includes('মীরা')) targetAgent = 'mira';

  const member = TEAM_MEMBERS[targetAgent];
  const taskId = generateTaskId();
  const source = params.source || 'mobile';

  const task: AgentTaskRecord = {
    id: taskId,
    created_at: new Date().toISOString(),
    from_agent: 'rose',
    to_agent: targetAgent,
    instruction: params.instruction,
    status: 'assigned',
    reply: null,
    result: null,
    source,
  };

  if (supabase) {
    try {
      await supabase.from('tasks').insert([task]);
    } catch (err) {
      console.warn('[Team Assign] Supabase insert warning:', err);
    }
  }

  return {
    success: true,
    message: `ঠিক আছে, ${member.bengaliName}কে কাজটি দিলাম: "${params.instruction}"`,
    task,
  };
}

export async function getTeamStatus(agentParam?: string): Promise<{ success: boolean; summary: string }> {
  if (!supabase) {
    return { success: true, summary: 'টিম সিস্টেম অনলাইনে আছে।' };
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);

    if (error) {
      console.error('[getTeamStatus] Supabase error:', error);
      return { success: false, summary: 'টিমের তথ্য এখন আনতে পারছি না।' };
    }

    if (!data || data.length === 0) {
      return { success: true, summary: 'আজ কাউকে কোনো কাজ দেওয়া হয়নি, সবাই ফাঁকা।' };
    }

    if (agentParam) {
      const targetRaw = agentParam.toLowerCase().trim();
      let targetAgent: TeamAgentId = 'mira';
      if (targetRaw.includes('arin') || targetRaw.includes('আরিন')) targetAgent = 'arin';
      else if (targetRaw.includes('zayan') || targetRaw.includes('জায়ান')) targetAgent = 'zayan';
      else if (targetRaw.includes('naira') || targetRaw.includes('নাইরা')) targetAgent = 'naira';
      
      const member = TEAM_MEMBERS[targetAgent];
      const lastTask = data.find((t: any) => t.to_agent === targetAgent);
      if (lastTask && lastTask.instruction) {
        return {
          success: true,
          summary: `${member.bengaliName} এখন "${lastTask.instruction}" নিয়ে কাজ করছে।`,
        };
      }
      return { success: true, summary: `${member.bengaliName} এখন ডেস্কে ফাঁকা আছে।` };
    }

    const statuses: string[] = [];
    const agents: TeamAgentId[] = ['mira', 'arin', 'zayan', 'naira'];
    for (const id of agents) {
      const t = data.find((x: any) => x.to_agent === id);
      if (t && t.instruction) {
        statuses.push(`${TEAM_MEMBERS[id].bengaliName}: "${t.instruction}"`);
      }
    }

    return {
      success: true,
      summary: statuses.length > 0 ? `টিমের বর্তমান অবস্থা: ${statuses.join(', ')}।` : 'আজ কাউকে কোনো কাজ দেওয়া হয়নি, সবাই ফাঁকা।',
    };
  } catch (err) {
    console.error('[getTeamStatus] Exception:', err);
    return { success: false, summary: 'টিমের তথ্য এখন আনতে পারছি না।' };
  }
}

export const TEAM_SYSTEM_INSTRUCTION = `
You are Rose, the chief manager of a 5-member AI team: Mira, Arin, Zayan, Naira.

APP NAVIGATION CONTROL:
To open any page, go back, go home, scroll or clear chat you MUST call the app_action tool. Never say you opened something unless the tool returned ok:true. After ok:true say only one short sentence like 'ভয়েস অ্যান্ড ল্যাঙ্গুয়েজ খুললাম।' If ok:false, say 'পাতাটা খুঁজে পাইনি।'

WORK TASK COMMAND RULE:
When the user asks you to give a task to, ask, or check on Mira, Arin, Zayan or Naira, immediately call assign_task or get_team_status.

CHAT CLEARING RULE:
You CAN clear the chat with app_action clear_chat after the user says yes. Never say you cannot.

PHONE & WHATSAPP CALL RULE (CRITICAL):
1. Tools available:
   - phone_call(person): Start a normal phone call confirmation flow for a contact name or phone number.
   - whatsapp_call(person, video?): Start a WhatsApp audio or video call confirmation flow.
   - whatsapp_message(person, message): Write a short natural message in the user's language, read it back ("<name>-কে এটা পাঠাব: '<text>'। ঠিক আছে?"), and wait for user's yes before opening WhatsApp.
   - phone_confirm(decision): Execute or cancel the pending call/message ONLY after the user says হ্যাঁ/yes/না/no.
   - save_contact_alias(spoken_name, saved_name): Save an alias when user teaches one (e.g. "আম্মু মানে Ammu Home").
   - phone(action): For open_app or search_contacts.
2. ALWAYS require the user's yes before any call or message. Never claim a call or message was placed until phone_confirm("yes") runs.
3. Speak ONLY the exact single message/question returned by the tool (e.g. "<name>-কে ফোন কল দেব? হ্যাঁ বললে দেব।", "কোনটা? ১. ... ২. ...", "এই নামে কাউকে পেলাম না। ফোনে নামটা কীভাবে সেভ করা আছে বলো?", "WhatsApp-এ এই মানুষ পাওয়া যায়নি। নরমাল ফোন কল দেব? হ্যাঁ বললে দেব।", "লেখা রেডি, শুধু Send চাপো।").

END CALL RULE (CRITICAL):
You CAN end the live voice call yourself using the end_call tool. When the user asks to hang up, stop, or end the call (e.g. ফোন কাটো, কল বন্ধ করো, রাখো, bye, end call), call end_call and say one short goodbye (e.g. "ঠিক আছে, রাখছি।"). You must NEVER say "I can't end the call" or "আমি কল কাটতে পারি না".
`.trim();

export const ROSE_PHONE_FUNCTION_DECLARATIONS = [
  {
    name: 'phone_call',
    description: 'Initiate a normal phone call to a contact name or phone number (always confirms with user first before dialing).',
    parameters: {
      type: 'OBJECT',
      properties: {
        person: {
          type: 'STRING',
          description: 'Contact name or phone number spoken by the user',
        },
      },
      required: ['person'],
    },
  },
  {
    name: 'whatsapp_call',
    description: 'Initiate a WhatsApp audio or video call to a contact name or phone number (always confirms with user first).',
    parameters: {
      type: 'OBJECT',
      properties: {
        person: {
          type: 'STRING',
          description: 'Contact name or phone number spoken by the user',
        },
        video: {
          type: 'BOOLEAN',
          description: 'Set true for a WhatsApp video call, false for voice call',
        },
      },
      required: ['person'],
    },
  },
  {
    name: 'whatsapp_message',
    description: 'Prepare a short WhatsApp message in the user language and ask confirmation before opening WhatsApp.',
    parameters: {
      type: 'OBJECT',
      properties: {
        person: {
          type: 'STRING',
          description: 'Recipient contact name or phone number',
        },
        message: {
          type: 'STRING',
          description: 'Short, natural message text written in the user language',
        },
      },
      required: ['person', 'message'],
    },
  },
  {
    name: 'phone_confirm',
    description: 'Confirm or cancel a pending phone call, WhatsApp call, or WhatsApp message ONLY after the user explicitly replies yes/হ্যাঁ or no/না.',
    parameters: {
      type: 'OBJECT',
      properties: {
        decision: {
          type: 'STRING',
          enum: ['yes', 'no'],
          description: '"yes" if user agreed, "no" if user declined',
        },
      },
      required: ['decision'],
    },
  },
  {
    name: 'save_contact_alias',
    description: 'Save a spoken name to phonebook display name alias (e.g. "আম্মু" -> "Ammu Home").',
    parameters: {
      type: 'OBJECT',
      properties: {
        spoken_name: {
          type: 'STRING',
          description: 'Spoken name in Bangla or English',
        },
        saved_name: {
          type: 'STRING',
          description: 'Exact contact name saved in the phone or phone number',
        },
      },
      required: ['spoken_name', 'saved_name'],
    },
  },
];

export const ROSE_TEAM_TOOLS = [
  { googleSearch: {} },
  {
    functionDeclarations: [
      {
        name: 'end_call',
        description: 'End the current voice call when the user asks to hang up, stop, or end the call (e.g. ফোন কাটো, কল বন্ধ করো, রাখো, bye, end call).',
        parameters: {
          type: 'OBJECT',
          properties: {
            reason: {
              type: 'STRING',
              description: 'Optional reason for ending the call',
            },
          },
        },
      },
      ...ROSE_PHONE_FUNCTION_DECLARATIONS,
      {
        name: 'assign_task',
        description: 'Assign a work task to an AI team member (mira, arin, zayan, or naira).',
        parameters: {
          type: 'OBJECT',
          properties: {
            agent: { type: 'STRING', enum: ['mira', 'arin', 'zayan', 'naira'], description: 'Target team member ID: "mira", "arin", "zayan", or "naira"' },
            instruction: { type: 'STRING', description: 'Clear task instruction' },
          },
          required: ['agent', 'instruction'],
        },
      },
      {
        name: 'get_team_status',
        description: 'Check status of AI team members.',
        parameters: {
          type: 'OBJECT',
          properties: {
            agent: { type: 'STRING', enum: ['mira', 'arin', 'zayan', 'naira'], description: 'Optional agent name' },
          },
        },
      },
      {
        name: 'app_action',
        description: 'Control app navigation and admin features: open, back, home, open_number, clear_chat, camera_on, camera_off, camera_switch.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              enum: ['open', 'back', 'home', 'open_number', 'clear_chat', 'camera_on', 'camera_off', 'camera_switch'],
              description: 'Action to perform',
            },
            page: {
              type: 'STRING',
              enum: [
                'home', 'chat', 'history', 'settings',
                'about_guide', 'connections', 'live_voice_model', 'voice_language', 'chats_memory', 'look_feel', 'phone_control', 'pc_setup', 'privacy_controls',
                'tts_model', 'assistant_name', 'your_name', 'personality', 'affection', 'language', 'response_style', 'voice', 'voice_model', 'voice_tuning', 'voice_check', 'mic_listening',
                'theme', 'orb_style', 'rose_alive', 'quick_actions', 'app_permissions',
                'app_perm_camera', 'app_perm_microphone', 'app_perm_location', 'app_perm_notifications', 'app_perm_clipboard', 'app_perm_contacts', 'app_perm_phone_calls', 'app_perm_whatsapp', 'app_perm_messenger', 'app_perm_youtube', 'app_perm_facebook', 'app_perm_tiktok', 'app_perm_instagram',
                'pc_helper', 'pc_control', 'pc_files', 'confirmations', 'pc_history', 'safety', 'local_ai', 'view_mode'
              ],
              description: 'Target page ID (for open)',
            },
            number: {
              type: 'INTEGER',
              description: 'Item number (for open_number)',
            },
          },
          required: ['action'],
        },
      },
      {
        name: 'phone',
        description: 'Open an installed app or search phone contacts.',
        parameters: {
          type: 'OBJECT',
          properties: {
            action: {
              type: 'STRING',
              enum: ['search_contacts', 'get_all_contacts', 'open_app'],
              description: 'Phone action: "search_contacts", "get_all_contacts", or "open_app"',
            },
            name: {
              type: 'STRING',
              description: 'Contact query (for search_contacts) or app name (for open_app)',
            },
          },
          required: ['action'],
        },
      },
      {
        name: 'pc_command',
        description: "Send remote control command to connected PC.",
        parameters: {
          type: 'OBJECT',
          properties: {
            action: { type: 'STRING', description: 'Action name' },
            args: { type: 'OBJECT', description: 'Arguments' },
          },
          required: ['action'],
        },
      },
    ],
  },
];
