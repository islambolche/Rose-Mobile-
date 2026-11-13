import { supabase } from './supabase';
import { PC_TASK_FUNCTION_DECLARATION } from '../pc/pcTaskManager';

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
   - phone_call(person): Match contact name or phone number. After match, tool returns "<name>-কে কল দিচ্ছি…" and automatically dials after 3 seconds unless the user says না/থামো/cancel/no. NO yes-confirmation. If 2+ contacts match, it asks "কোনটা? ১. … ২. …".
   - whatsapp_call(person, video?): Match contact name or phone number. After match, tool returns "<name>-কে WhatsApp-এ কল দিচ্ছি…" and automatically calls after 3 seconds unless cancelled. NO yes-confirmation.
   - whatsapp_send(person, message): Write a short natural message in the user's language; tool reads it once ("<name>-কে এটা পাঠাচ্ছি: '<text>'…"), waits 3 seconds for "না"/cancel, then sends automatically.
   - messenger_send(message): Read back the message and ask confirmation ("Messenger-এ এটা পাঠাব: '<text>'। ঠিক আছে?"). After user says yes, shareTextTo opens Messenger and asks "যাকে পাঠাবে তার নাম বলো".
   - messenger_recipient(name): After messenger_send asked "যাকে পাঠাবে তার নাম বলো", call this with the spoken recipient name to type, select, and send on Messenger.
   - post_video(platform, topic, title?, description?, hashtags?): Write catchy title, description, and hashtags for youtube/facebook/instagram/tiktok, read them back and ask confirmation. After user says yes, copyText & pickVideoAndShare run and say "ভিডিও বাছো; লেখা কপি করা আছে। Post/Upload আমি চাপব কি না বলো।". After user says yes again, phone_confirm("yes") auto-taps Upload/Post/Share/Next.
   - app_search(app, query): Confirm once and open in-app search for youtube, facebook, instagram, tiktok, or google.
   - confirm_action(answer: 'yes'|'no'): Cancel any 3-second delayed call/WhatsApp message (if user says না/থামো/cancel/no -> answer='no'), OR resolve pending Messenger/post_video/app_search confirmation.
   - phone_confirm(decision): Legacy alias for confirm_action.
   - save_contact_alias(spoken_name, saved_name): Save an alias when user teaches one (e.g. "আম্মু মানে Ammu Home").
   - phone(action): For open_app or search_contacts.
2. ALWAYS call the phone/social tool SILENTLY first before speaking a single word. NEVER say "কল করছি", "কল দিচ্ছি", "পাঠাচ্ছি", "খুলছি", or any reply before the tool result returns.
3. For calls and whatsapp_send, NEVER ask "হ্যাঁ বললে দেব" or yes/no questions. Require yes-confirmation only for Messenger, post_video, and app_search.
4. After any phone/social tool or confirm_action returns, speak ONLY one short sentence with the exact result message returned by the tool, with nothing extra before or after.

END CALL RULE (CRITICAL):
You CAN end the live voice call yourself using the end_call tool. When the user asks to hang up, stop, or end the call (e.g. ফোন কাটো, কল বন্ধ করো, রাখো, bye, end call), call end_call and say one short goodbye (e.g. "ঠিক আছে, রাখছি।"). You must NEVER say "I can't end the call" or "আমি কল কাটতে পারি না".

PC / LAPTOP TASK RULE (CRITICAL):
When the user asks for anything on the computer/PC/laptop (পিসি, ল্যাপটপ, কম্পিউটার), call pc_task. Never pretend it is done before the result comes.
`.trim();

export const ROSE_PHONE_FUNCTION_DECLARATIONS = [
  {
    name: 'phone_call',
    description: 'Initiate a normal phone call to a contact name or phone number (announces "<name>-কে কল দিচ্ছি…" and dials automatically after 3 seconds unless cancelled).',
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
    description: 'Initiate a WhatsApp audio or video call to a contact name or phone number (announces and calls automatically after 3 seconds unless cancelled).',
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
    name: 'whatsapp_send',
    description: 'Write a short WhatsApp message in the user language, read it once, wait 3 seconds for "না"/cancel, then open WhatsApp and auto-tap Send if accessibility is enabled.',
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
    name: 'messenger_send',
    description: 'Prepare a Messenger message, read it back for confirmation, then share to Messenger and ask who to send it to.',
    parameters: {
      type: 'OBJECT',
      properties: {
        message: {
          type: 'STRING',
          description: 'Short, natural message text to share to Messenger',
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'messenger_recipient',
    description: 'After messenger_send opened Messenger and asked "যাকে পাঠাবে তার নাম বলো", call this with the recipient name spoken by the user.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: {
          type: 'STRING',
          description: 'Recipient name spoken by the user',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'post_video',
    description: 'Write title, description and hashtags for a video post on youtube, facebook, instagram, or tiktok, read them back for confirmation, copy them and open video share picker.',
    parameters: {
      type: 'OBJECT',
      properties: {
        platform: {
          type: 'STRING',
          enum: ['youtube', 'facebook', 'instagram', 'tiktok'],
          description: 'Target social platform',
        },
        topic: {
          type: 'STRING',
          description: 'Video topic described by the user',
        },
        title: {
          type: 'STRING',
          description: 'Short catchy video title',
        },
        description: {
          type: 'STRING',
          description: 'Video post description in user language',
        },
        hashtags: {
          type: 'STRING',
          description: 'Space-separated relevant hashtags',
        },
      },
      required: ['platform', 'topic'],
    },
  },
  {
    name: 'app_search',
    description: 'Confirm once and search inside youtube, facebook, instagram, tiktok, or google.',
    parameters: {
      type: 'OBJECT',
      properties: {
        app: {
          type: 'STRING',
          enum: ['youtube', 'facebook', 'instagram', 'tiktok', 'google'],
          description: 'Target app to search in',
        },
        query: {
          type: 'STRING',
          description: 'Search query text',
        },
      },
      required: ['app', 'query'],
    },
  },
  {
    name: 'confirm_action',
    description: 'Resolve ANY pending action awaiting confirmation (pending PC task, phone_call, whatsapp_call, whatsapp_send, messenger_send, post_video, app_search) when the user agrees or declines.',
    parameters: {
      type: 'OBJECT',
      properties: {
        answer: {
          type: 'STRING',
          enum: ['yes', 'no'],
          description: '"yes" if user confirmed/agreed, "no" if user declined/cancelled',
        },
      },
      required: ['answer'],
    },
  },
  {
    name: 'phone_confirm',
    description: 'Confirm or cancel ANY pending phone/social action (phone_call, whatsapp_call, whatsapp_send, messenger_send, post_video copy/picker, post_video Upload/Post auto-tap, or app_search) ONLY after user replies yes/হ্যাঁ or no/না.',
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
      PC_TASK_FUNCTION_DECLARATION,
    ],
  },
];

export const ROSE_TYPED_CHAT_FUNCTION_DECLARATIONS = [
  ...ROSE_PHONE_FUNCTION_DECLARATIONS,
  PC_TASK_FUNCTION_DECLARATION,
];
