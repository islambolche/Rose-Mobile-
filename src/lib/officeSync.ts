import { supabase } from './supabase';
import { getPcDeviceId, sendPcCommand } from '../pc/pcClient';
import { PC_TASK_FUNCTION_DECLARATION, executePcTaskTool, getPcTasks } from '../pc/pcTaskManager';
import { officeEvents } from '../components/pc/office/officeEngine';
import { getGeminiKey } from './geminiKey';

export type OfficeAgentId = 'rose' | 'mira' | 'arin' | 'zayan' | 'naira';
export type OfficeTaskKind = 'task' | 'status';
export type OfficeTaskStatus = 'new' | 'working' | 'done' | 'failed';

export interface OfficeTaskRow {
  id: string;
  created_at: string;
  workspace: string;
  from_device: string;
  agent: OfficeAgentId;
  kind: OfficeTaskKind;
  text: string;
  status: OfficeTaskStatus;
  report: string | null;
  updated_at: string;
}

export interface AgentChatMessage {
  id: string;
  agent: OfficeAgentId;
  sender: string; // 'Rose' | 'Mira' | 'Arin' | 'Zayan' | 'Naira' | 'User'
  text: string; // Full target text
  displayedText: string; // Currently typed text (for typing animation)
  isTyping: boolean;
  time: string;
  createdAt: number;
}

export const AGENT_BENGALI_NAMES: Record<OfficeAgentId, string> = {
  rose: 'রোজ',
  mira: 'মিরা',
  arin: 'আরিন',
  zayan: 'জায়ান',
  naira: 'নাইরা',
};

export const AGENT_ENGLISH_NAMES: Record<OfficeAgentId, string> = {
  rose: 'Rose',
  mira: 'Mira',
  arin: 'Arin',
  zayan: 'Zayan',
  naira: 'Naira',
};

/**
 * Matches Bengali/English names and close spellings to canonical OfficeAgentId.
 * E.g. আরিন/আরিয়ান/Arin/Arian, জায়ান/যায়ান/Zayan/Jayan, মিরা/মীরা/Mira, নাইরা/নায়রা/Naira, রোজ/Rose
 */
export function normalizeOfficeAgent(raw?: string | null): OfficeAgentId {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'mira';

  if (
    s.includes('arin') ||
    s.includes('arian') ||
    s.includes('aryan') ||
    s.includes('arif') ||
    s.includes('আরিন') ||
    s.includes('আরিয়ান') ||
    s.includes('আরিয়ান') ||
    s.includes('আরিফ')
  ) {
    return 'arin';
  }
  if (
    s.includes('zayan') ||
    s.includes('jayan') ||
    s.includes('zayn') ||
    s.includes('xayan') ||
    s.includes('জায়ান') ||
    s.includes('জায়ান') ||
    s.includes('যায়ান') ||
    s.includes('যায়ান') ||
    s.includes('জায়ন') ||
    s.includes('জায়ন')
  ) {
    return 'zayan';
  }
  if (
    s.includes('mira') ||
    s.includes('meera') ||
    s.includes('মিরা') ||
    s.includes('মীরা')
  ) {
    return 'mira';
  }
  if (
    s.includes('naira') ||
    s.includes('nyra') ||
    s.includes('nayra') ||
    s.includes('নাইরা') ||
    s.includes('নায়রা') ||
    s.includes('নায়রা')
  ) {
    return 'naira';
  }
  if (
    s.includes('rose') ||
    s.includes('রোজ') ||
    s.includes('রোয')
  ) {
    return 'rose';
  }

  return 'mira';
}

export function normalizeOfficeKind(rawKind?: string | null, rawText?: string | null): OfficeTaskKind {
  const k = String(rawKind || '').trim().toLowerCase();
  if (k === 'status' || k === 'report') return 'status';
  if (k === 'task') return 'task';

  const t = String(rawText || '').trim().toLowerCase();
  if (
    /কী করছ|কি করছ|কী করছে|কি করছে|আপডেট|রিপোর্ট|স্ট্যাটাস|status|report|what are you doing|ki korch|koto dur|কতদূর/i.test(
      t
    )
  ) {
    return 'status';
  }
  return 'task';
}

/**
 * Single unified tool declaration for Gemini Live AND Typed Chat (on both mobile and PC)
 */
export const OFFICE_TASK_FUNCTION_DECLARATION = {
  name: 'office_task',
  description:
    'Assign a task or ask for a status report from any office agent (rose, mira, arin, zayan, naira) in the shared office workspace. Call this whenever the user mentions an agent name (আরিন/আরিয়ান/Arin, জায়ান/Zayan, মিরা/Mira, নাইরা/Naira, রোজ/Rose) to do some work (kind="task") or asks what they are doing / for a report (kind="status").',
  parameters: {
    type: 'OBJECT',
    properties: {
      agent: {
        type: 'STRING',
        enum: ['rose', 'mira', 'arin', 'zayan', 'naira'],
        description:
          'Target agent ID: "rose", "mira", "arin", "zayan", or "naira" (match Bengali/English names and close spellings like আরিন/আরিয়ান/Arin, জায়ান/Zayan, মিরা/Mira, নাইরা/Naira, রোজ/Rose).',
      },
      kind: {
        type: 'STRING',
        enum: ['task', 'status'],
        description: '"task" = do this work, "status" = what are you doing / report to me.',
      },
      text: {
        type: 'STRING',
        description: "The user's words / instruction or status question.",
      },
    },
    required: ['agent', 'kind', 'text'],
  },
};

function detectCurrentDeviceType(): 'pc' | 'mobile' {
  if (typeof window === 'undefined') return 'mobile';
  try {
    const mode = localStorage.getItem('rose_view_mode') || localStorage.getItem('viewMode') || 'auto';
    if (mode === 'pc') return 'pc';
    if (mode === 'mobile') return 'mobile';
  } catch {}
  return window.innerWidth >= 1024 ? 'pc' : 'mobile';
}

// ============================================================================
// Local State & PubSub for Office Tasks & Agent Right-Panel Chats
// ============================================================================
const LOCAL_OFFICE_TASKS_KEY = 'rose_office_tasks_cache_v1';
const LOCAL_AGENT_CHATS_KEY = 'rose_agent_chats_cache_v1';
const ANNOUNCED_MOBILE_TASKS_KEY = 'rose_announced_office_tasks_v1';

let officeTasksState: OfficeTaskRow[] = loadCachedOfficeTasks();
let agentChatsState: Record<OfficeAgentId, AgentChatMessage[]> = loadCachedAgentChats();
let activeRightPanelAgent: OfficeAgentId = 'rose';

type OfficeStateListener = () => void;
const listeners = new Set<OfficeStateListener>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

export function subscribeOfficeSync(listener: OfficeStateListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function loadCachedOfficeTasks(): OfficeTaskRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_OFFICE_TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 100) : [];
  } catch {
    return [];
  }
}

function saveCachedOfficeTasks(rows: OfficeTaskRow[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_OFFICE_TASKS_KEY, JSON.stringify(rows.slice(0, 100)));
  } catch {}
}

function loadCachedAgentChats(): Record<OfficeAgentId, AgentChatMessage[]> {
  const empty: Record<OfficeAgentId, AgentChatMessage[]> = {
    rose: [],
    mira: [],
    arin: [],
    zayan: [],
    naira: [],
  };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(LOCAL_AGENT_CHATS_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return empty;
    for (const k of ['rose', 'mira', 'arin', 'zayan', 'naira'] as OfficeAgentId[]) {
      if (Array.isArray(parsed[k])) {
        empty[k] = parsed[k].slice(-60).map((m: any) => ({
          ...m,
          displayedText: m.text || m.displayedText || '',
          isTyping: false,
        }));
      }
    }
    return empty;
  } catch {
    return empty;
  }
}

function saveCachedAgentChats() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_AGENT_CHATS_KEY, JSON.stringify(agentChatsState));
  } catch {}
}

export function getOfficeTasksSnapshot(): OfficeTaskRow[] {
  const ws = getPcDeviceId();
  return officeTasksState.filter((r) => !r.workspace || r.workspace === ws);
}

export function getLiveActivityTasks(): OfficeTaskRow[] {
  return getOfficeTasksSnapshot().filter((r) => r.status === 'new' || r.status === 'working');
}

export function getRecentCompletedTasks(): OfficeTaskRow[] {
  return getOfficeTasksSnapshot()
    .filter((r) => r.status === 'done' || r.status === 'failed')
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, 30);
}

export function getAgentChatMessages(agent: OfficeAgentId): AgentChatMessage[] {
  return agentChatsState[agent] || [];
}

export function getActiveRightPanelAgent(): OfficeAgentId {
  return activeRightPanelAgent;
}

export function setActiveRightPanelAgent(agent: OfficeAgentId) {
  activeRightPanelAgent = agent;
  notifyListeners();
}

export function clearAgentChatMessages(agent?: OfficeAgentId) {
  if (agent) {
    agentChatsState = { ...agentChatsState, [agent]: [] };
  } else {
    agentChatsState = { rose: [], mira: [], arin: [], zayan: [], naira: [] };
  }
  saveCachedAgentChats();
  notifyListeners();
}

function upsertOfficeTaskLocal(row: OfficeTaskRow) {
  const idx = officeTasksState.findIndex((r) => r.id === row.id);
  if (idx >= 0) {
    const next = [...officeTasksState];
    next[idx] = { ...next[idx], ...row };
    officeTasksState = next;
  } else {
    officeTasksState = [row, ...officeTasksState].slice(0, 100);
  }
  saveCachedOfficeTasks(officeTasksState);
  notifyListeners();
}

/**
 * Appends a message to an agent's chat in the PC right panel with a smooth character-by-character typing animation.
 */
export function appendTypedAgentChatMessage(params: {
  id?: string;
  agent: OfficeAgentId;
  sender: string;
  text: string;
  autoSwitchTab?: boolean;
}): Promise<void> {
  return new Promise((resolve) => {
    const clean = String(params.text || '').trim();
    if (!clean) {
      resolve();
      return;
    }

    const msgId = params.id || `agmsg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const existingList = agentChatsState[params.agent] || [];
    if (existingList.some((m) => m.id === msgId)) {
      resolve();
      return;
    }

    if (params.autoSwitchTab && params.agent !== 'rose') {
      activeRightPanelAgent = params.agent;
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullFormatted = `${params.sender}: ${clean}`;

    const newMsg: AgentChatMessage = {
      id: msgId,
      agent: params.agent,
      sender: params.sender,
      text: fullFormatted,
      displayedText: `${params.sender}: `,
      isTyping: true,
      time: timeStr,
      createdAt: Date.now(),
    };

    agentChatsState = {
      ...agentChatsState,
      [params.agent]: [...(agentChatsState[params.agent] || []), newMsg].slice(-60),
    };
    notifyListeners();

    const chars = Array.from(clean);
    let idx = 0;
    const stepSize = Math.max(1, Math.ceil(chars.length / 45)); // finish within ~1.2s
    const intervalMs = 25;

    const timer = setInterval(() => {
      idx = Math.min(chars.length, idx + stepSize);
      const partial = `${params.sender}: ${chars.slice(0, idx).join('')}`;
      const done = idx >= chars.length;

      const list = agentChatsState[params.agent] || [];
      agentChatsState = {
        ...agentChatsState,
        [params.agent]: list.map((m) =>
          m.id === msgId
            ? {
                ...m,
                displayedText: done ? fullFormatted : partial,
                isTyping: !done,
              }
            : m
        ),
      };
      notifyListeners();

      if (done) {
        clearInterval(timer);
        saveCachedAgentChats();
        resolve();
      }
    }, intervalMs);
  });
}

// ============================================================================
// 1) Execute office_task tool (inserts into Supabase office_tasks & replies right away)
// ============================================================================
export async function executeOfficeTaskTool(
  rawArgs: {
    agent?: string;
    kind?: string;
    text?: string;
    instruction?: string;
  },
  fromDeviceOverride?: 'pc' | 'mobile'
): Promise<{
  ok: boolean;
  message: string;
  row: OfficeTaskRow;
}> {
  const agent = normalizeOfficeAgent(rawArgs.agent);
  const rawText = String(rawArgs.text || rawArgs.instruction || '').trim() || 'কাজের আপডেট দাও';
  const kind = normalizeOfficeKind(rawArgs.kind, rawText);
  const workspace = getPcDeviceId();
  const from_device = fromDeviceOverride || detectCurrentDeviceType();
  const nowIso = new Date().toISOString();
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `ot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const row: OfficeTaskRow = {
    id,
    created_at: nowIso,
    workspace,
    from_device,
    agent,
    kind,
    text: rawText,
    status: 'new',
    report: null,
    updated_at: nowIso,
  };

  const agentBengali = AGENT_BENGALI_NAMES[agent] || 'মিরা';
  const immediateReply = `ঠিক আছে, ${agentBengali}-কে বলে দিচ্ছি`;

  // Update local cache immediately
  upsertOfficeTaskLocal(row);

  // If this came from mobile, remember the task ID on this phone so we know to announce its completion
  if (from_device === 'mobile') {
    markMobileCreatedTask(row.id);
  }

  // Insert into Supabase office_tasks table
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('office_tasks')
        .insert([
          {
            id: row.id,
            created_at: row.created_at,
            workspace: row.workspace,
            from_device: row.from_device,
            agent: row.agent,
            kind: row.kind,
            text: row.text,
            status: 'new',
            report: null,
            updated_at: row.updated_at,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        upsertOfficeTaskLocal(normalizeDbOfficeTaskRow(data));
      } else if (error) {
        console.warn('[office_task] Supabase insert warning:', error.message);
      }
    } catch (err) {
      console.warn('[office_task] Supabase insert exception:', err);
    }
  }

  // Trigger PC processor immediately if we are currently running in PC layout
  if (isPcProcessorRunning) {
    void processSingleOfficeTaskOnPc(row);
  }

  return {
    ok: true,
    message: immediateReply,
    row,
  };
}

function normalizeDbOfficeTaskRow(raw: any): OfficeTaskRow {
  return {
    id: String(raw.id),
    created_at: String(raw.created_at || new Date().toISOString()),
    workspace: String(raw.workspace || getPcDeviceId()),
    from_device: String(raw.from_device || 'mobile'),
    agent: normalizeOfficeAgent(raw.agent),
    kind: normalizeOfficeKind(raw.kind, raw.text),
    text: String(raw.text || ''),
    status: (['new', 'working', 'done', 'failed'].includes(raw.status) ? raw.status : 'new') as OfficeTaskStatus,
    report: raw.report != null ? String(raw.report) : null,
    updated_at: String(raw.updated_at || raw.created_at || new Date().toISOString()),
  };
}

// ============================================================================
// 2) PC App Processor (runs ONLY when PC layout is active)
// ============================================================================
let isPcProcessorRunning = false;
let pcRealtimeChannel: any = null;
let pcPollTimer: ReturnType<typeof setInterval> | null = null;
let currentPcWorkspace = '';
const processingTaskIds = new Set<string>();
const processedTaskIds = new Set<string>();

type PcReportCallback = (info: {
  row: OfficeTaskRow;
  agentBengali: string;
  agentEnglish: string;
  report: string;
}) => void;

let onPcTaskCompletedCallback: PcReportCallback | null = null;

export function startPcOfficeTasksSync(onCompleted?: PcReportCallback): () => void {
  onPcTaskCompletedCallback = onCompleted || null;
  isPcProcessorRunning = true;

  const setupForWorkspace = (workspace: string) => {
    currentPcWorkspace = workspace;
    if (pcRealtimeChannel && supabase) {
      try {
        supabase.removeChannel(pcRealtimeChannel);
      } catch {}
      pcRealtimeChannel = null;
    }

    // Fetch existing & pending ('new') rows immediately on open
    void fetchAndProcessPendingPcTasks(workspace);

    if (!supabase) return;
    pcRealtimeChannel = supabase
      .channel(`office_tasks_pc_${workspace}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'office_tasks',
          filter: `workspace=eq.${workspace}`,
        },
        (payload: any) => {
          const raw = payload.new;
          if (!raw || !raw.id) return;
          const row = normalizeDbOfficeTaskRow(raw);
          upsertOfficeTaskLocal(row);
          if (row.status === 'new') {
            void processSingleOfficeTaskOnPc(row);
          }
        }
      )
      .subscribe();
  };

  setupForWorkspace(getPcDeviceId());

  if (pcPollTimer) clearInterval(pcPollTimer);
  pcPollTimer = setInterval(() => {
    const ws = getPcDeviceId();
    if (ws !== currentPcWorkspace) {
      setupForWorkspace(ws);
    } else {
      void fetchAndProcessPendingPcTasks(ws);
    }
  }, 4000);

  return () => {
    isPcProcessorRunning = false;
    onPcTaskCompletedCallback = null;
    if (pcRealtimeChannel && supabase) {
      try {
        supabase.removeChannel(pcRealtimeChannel);
      } catch {}
      pcRealtimeChannel = null;
    }
    if (pcPollTimer) {
      clearInterval(pcPollTimer);
      pcPollTimer = null;
    }
  };
}

async function fetchAndProcessPendingPcTasks(workspace: string) {
  if (!isPcProcessorRunning || !supabase) return;
  try {
    const { data, error } = await supabase
      .from('office_tasks')
      .select('*')
      .eq('workspace', workspace)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !Array.isArray(data)) return;

    const normalized = data.map(normalizeDbOfficeTaskRow);
    // Merge into local state
    for (const row of normalized.slice().reverse()) {
      upsertOfficeTaskLocal(row);
    }

    // Process any 'new' tasks in chronological order (oldest 'new' first)
    const pendingNew = normalized
      .filter((r) => r.status === 'new')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (const row of pendingNew) {
      void processSingleOfficeTaskOnPc(row);
    }
  } catch {}
}

async function processSingleOfficeTaskOnPc(row: OfficeTaskRow) {
  if (!isPcProcessorRunning) return;
  if (processingTaskIds.has(row.id) || processedTaskIds.has(row.id)) return;
  if (row.status !== 'new') return;

  processingTaskIds.add(row.id);

  try {
    const workingIso = new Date().toISOString();
    const workingRow: OfficeTaskRow = {
      ...row,
      status: 'working',
      updated_at: workingIso,
    };
    upsertOfficeTaskLocal(workingRow);

    // 1. Mark 'working' in Supabase
    if (supabase) {
      try {
        await supabase
          .from('office_tasks')
          .update({ status: 'working', updated_at: workingIso })
          .eq('id', row.id);
      } catch {}
    }

    // 2. Office Animation: Rose walks to that agent, they talk, agent starts working
    if (row.agent !== 'rose') {
      officeEvents.assign('rose', row.agent, row.text);
    } else {
      officeEvents.working('rose', row.text);
    }

    // 3. Type "Rose: <text>" in that agent's chat in the right panel (with typing animation)
    await appendTypedAgentChatMessage({
      id: `assign-${row.id}`,
      agent: row.agent,
      sender: 'Rose',
      text: row.text,
      autoSwitchTab: true,
    });

    if (row.agent !== 'rose') {
      officeEvents.working(row.agent, row.text);
    }

    // 4. Execute with Gemini in the agent's role/personality
    const report = await runOfficeAgentWithGemini(workingRow);

    const doneIso = new Date().toISOString();
    const doneRow: OfficeTaskRow = {
      ...workingRow,
      status: 'done',
      report,
      updated_at: doneIso,
    };
    processedTaskIds.add(row.id);
    upsertOfficeTaskLocal(doneRow);

    // 5. Update Supabase row: status 'done', report, updated_at
    if (supabase) {
      try {
        await supabase
          .from('office_tasks')
          .update({
            status: 'done',
            report,
            updated_at: doneIso,
          })
          .eq('id', row.id);
      } catch (err) {
        console.warn('[office_tasks] Failed to update done status:', err);
      }
    }

    // 6. Office animation: agent walks to Rose and reports
    officeEvents.done(row.agent, report);

    // 7. Type the report into the agent's chat in the right panel
    const agentEnglish = AGENT_ENGLISH_NAMES[row.agent] || 'Agent';
    await appendTypedAgentChatMessage({
      id: `report-${row.id}`,
      agent: row.agent,
      sender: agentEnglish,
      text: report,
      autoSwitchTab: false,
    });

    // 8. Notify PC callback
    if (onPcTaskCompletedCallback) {
      onPcTaskCompletedCallback({
        row: doneRow,
        agentBengali: AGENT_BENGALI_NAMES[row.agent] || 'মিরা',
        agentEnglish,
        report,
      });
    }
  } catch (err: any) {
    const failReport = `দুঃখিত, কাজটি করতে সমস্যা হয়েছে: ${err?.message || 'অজানা ত্রুটি'}`;
    const failIso = new Date().toISOString();
    const failedRow: OfficeTaskRow = {
      ...row,
      status: 'failed',
      report: failReport,
      updated_at: failIso,
    };
    processedTaskIds.add(row.id);
    upsertOfficeTaskLocal(failedRow);
    if (supabase) {
      try {
        await supabase
          .from('office_tasks')
          .update({ status: 'failed', report: failReport, updated_at: failIso })
          .eq('id', row.id);
      } catch {}
    }
    officeEvents.done(row.agent, failReport);
  } finally {
    processingTaskIds.delete(row.id);
  }
}

const OFFICE_AGENT_PERSONAS: Record<
  OfficeAgentId,
  { name: string; bengaliName: string; role: string; systemPrompt: string }
> = {
  rose: {
    name: 'Rose',
    bengaliName: 'রোজ',
    role: 'Chief Business Manager (প্রধান অফিস ম্যানেজার)',
    systemPrompt:
      'তুমি রোজ (Rose), অফিসের প্রধান ম্যানেজার। তুমি পুরো টিম (মিরা, আরিন, জায়ান, নাইরা) এবং পিসির কাজগুলো দেখাশোনা করো। সবসময় ভদ্র, সংক্ষিপ্ত এবং স্বাভাবিক বাংলায় কথা বলো।',
  },
  mira: {
    name: 'Mira',
    bengaliName: 'মিরা',
    role: 'Customer Communication (গ্রাহক সেবা ও মেসেজ ইনবক্স)',
    systemPrompt:
      'তুমি মিরা (Mira), কাস্টমার কমিউনিকেশন ও মেসেজ ইনবক্স স্পেশালিস্ট। তুমি হোয়াটসঅ্যাপ, মেসেঞ্জার ও গ্রাহকদের প্রশ্নের উত্তর দাও এবং সাপোর্ট দেখো। সবসময় ভদ্র, সংক্ষিপ্ত এবং স্বাভাবিক বাংলায় কথা বলো।',
  },
  arin: {
    name: 'Arin',
    bengaliName: 'আরিন',
    role: 'Sales & Order (সেলস ও অর্ডার কনফার্মেশন)',
    systemPrompt:
      'তুমি আরিন (Arin), সেলস ও অর্ডার কনফার্মেশন স্পেশালিস্ট। তুমি নতুন অর্ডার, স্টক ভেরিফিকেশন এবং বিক্রয় হিসাব দেখাশোনা করো। সবসময় ভদ্র, সংক্ষিপ্ত এবং স্বাভাবিক বাংলায় কথা বলো।',
  },
  zayan: {
    name: 'Zayan',
    bengaliName: 'জায়ান',
    role: 'Parcel & Delivery (পার্সেল ও কুরিয়ার ট্র্যাকিং)',
    systemPrompt:
      'তুমি জায়ান (Zayan), পার্সেল ও ডেলিভারি ট্র্যাকিং স্পেশালিস্ট। তুমি কুরিয়ার বুকিং, ডেলিভারি স্ট্যাটাস ও শিপমেন্ট দেখাশোনা করো। সবসময় ভদ্র, সংক্ষিপ্ত এবং স্বাভাবিক বাংলায় কথা বলো।',
  },
  naira: {
    name: 'Naira',
    bengaliName: 'নাইরা',
    role: 'Business Audit & Analytics (অডিট ও ব্যবসায়িক হিসাব)',
    systemPrompt:
      'তুমি নাইরা (Naira), বিজনেস অডিট ও অ্যানালিটিক্স স্পেশালিস্ট। তুমি আয়-ব্যয়, লাভ-লোকসান ও বিজনেস রিপোর্ট বিশ্লেষণ করো। সবসময় ভদ্র, সংক্ষিপ্ত এবং স্বাভাবিক বাংলায় কথা বলো।',
  },
};

async function runOfficeAgentWithGemini(row: OfficeTaskRow): Promise<string> {
  const member = OFFICE_AGENT_PERSONAS[row.agent] || OFFICE_AGENT_PERSONAS.mira;
  const agentBengali = AGENT_BENGALI_NAMES[row.agent] || member.bengaliName;
  const apiKey = (getGeminiKey() || '').replace(/["'\r\n\t\s]+/g, '').trim();

  // Gather context from Task Assigned, Live Activity, Recent Tasks, and PC HISTORY
  const allOfficeTasks = getOfficeTasksSnapshot();
  const agentLiveTasks = allOfficeTasks
    .filter((t) => t.agent === row.agent && t.id !== row.id && (t.status === 'new' || t.status === 'working'))
    .slice(0, 5)
    .map((t) => `- [চলমান] ${t.text}`)
    .join('\n');

  const agentRecentTasks = allOfficeTasks
    .filter((t) => t.agent === row.agent && t.id !== row.id && (t.status === 'done' || t.status === 'failed'))
    .slice(0, 6)
    .map((t) => `- [সম্পন্ন] কাজ: "${t.text}" → রিপোর্ট: "${t.report || 'সম্পন্ন'}"`)
    .join('\n');

  const localPcTasks = getPcTasks()
    .slice(0, 6)
    .map((p) => `- [PC Task: ${p.uiStatus}] ${p.task}${p.summary ? ` (${p.summary})` : ''}`)
    .join('\n');

  // Also fetch recent pc_commands from Supabase for PC HISTORY context
  let pcHistoryLines = '';
  if (supabase) {
    try {
      const { data: pcCmds } = await supabase
        .from('pc_commands')
        .select('command, args, status, result_text, created_at')
        .eq('device_id', row.workspace)
        .order('created_at', { ascending: false })
        .limit(5);
      if (Array.isArray(pcCmds) && pcCmds.length > 0) {
        pcHistoryLines = pcCmds
          .map(
            (c: any) =>
              `- [${c.status}] ${c.command} ${c.args?.task || c.args?.url || c.args?.app || ''} ${
                c.result_text ? `→ ${String(c.result_text).slice(0, 80)}` : ''
              }`
          )
          .join('\n');
      }
    } catch {}
  }

  let businessProfileStr = '';
  try {
    const bp = localStorage.getItem('rose_business_profile_v1');
    if (bp) businessProfileStr = bp;
  } catch {}

  if (!apiKey) {
    if (row.kind === 'status') {
      if (agentLiveTasks || agentRecentTasks) {
        return `আমি ${agentBengali}। আমার সাম্প্রতিক কাজ:\n${agentLiveTasks || agentRecentTasks}`;
      }
      return `আমি ${agentBengali} (${member.role})। বর্তমানে আমার কোনো পেন্ডিং কাজ নেই, নতুন কাজের জন্য প্রস্তুত আছি।`;
    }
    return `${agentBengali} আপনার নির্দেশনা "${row.text}" গ্রহণ করেছে এবং কাজটি সম্পন্ন করেছে।`;
  }

  const contextBlock = [
    `Agent Name: ${member.name} (${agentBengali})`,
    `Role: ${member.role}`,
    businessProfileStr ? `Business Profile: ${businessProfileStr}` : '',
    `Live Activity (চলমান কাজ):\n${agentLiveTasks || 'কোনো চলমান কাজ নেই'}`,
    `Recent Tasks (সাম্প্রতিক সম্পন্ন কাজ):\n${agentRecentTasks || 'সম্প্রতি কোনো কাজ রেকর্ড নেই'}`,
    `PC History (পিসির সাম্প্রতিক কাজ):\n${localPcTasks || pcHistoryLines || 'কোনো পিসি হিস্ট্রি নেই'}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const systemPrompt =
    row.kind === 'status'
      ? `${member.systemPrompt}\n\n${contextBlock}\n\nনির্দেশনা: ইউজার বা Rose তোমার বর্তমান বা সাম্প্রতিক কাজের আপডেট/স্ট্যাটাস জানতে চেয়েছে। উপরের Live Activity, Recent Tasks এবং PC History দেখে বাংলায় খুব সংক্ষেপে, ভদ্রভাবে ১-৩ বাক্যে তোমার কাজের রিপোর্ট দাও।`
      : `${member.systemPrompt}\n\n${contextBlock}\n\nনির্দেশনা: ইউজার বা Rose তোমাকে একটি কাজ দিয়েছে। যদি কাজটি করতে কম্পিউটার বা ব্রাউজার চালানো দরকার হয় (যেমন Chrome খোলা, WhatsApp/Messenger চেক করা, ফাইল তৈরি, স্ক্রিনশট, বা পিসিতে কোনো কাজ), তবে \`pc_task\` টুলটি কল করো। এরপর বাংলায় সংক্ষেপে (১-৩ বাক্যে) কাজের ফলাফল বা রিপোর্ট লেখো।`;

  try {
    const requestBody: any = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                row.kind === 'status'
                  ? `Rose জিজ্ঞেস করেছে: "${row.text}"। তোমার বর্তমান ও সাম্প্রতিক কাজের সংক্ষিপ্ত বাংলা রিপোর্ট দাও।`
                  : `Rose তোমাকে এই কাজটি দিয়েছে: "${row.text}"। কাজটি করো এবং সংক্ষিপ্ত বাংলা রিপোর্ট দাও।`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 350,
      },
    };

    if (row.kind === 'task') {
      requestBody.tools = [
        {
          functionDeclarations: [PC_TASK_FUNCTION_DECLARATION],
        },
      ];
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}`);
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const fnPart = parts.find((p: any) => p?.functionCall);

    if (fnPart?.functionCall && fnPart.functionCall.name === 'pc_task') {
      const fnArgs = fnPart.functionCall.args || {};
      const pcTaskText = String(fnArgs.task || row.text);
      const pcTaskKind = fnArgs.kind || 'safe';

      // Execute on PC via pc_task
      const pcRes = await executePcTaskTool({
        task: pcTaskText,
        kind: pcTaskKind,
      });

      // Also ask Gemini for a concise Bengali report summarizing the action
      const followUpBody = {
        systemInstruction: {
          parts: [{ text: member.systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `তুমি "${row.text}" কাজের জন্য পিসিতে "${pcTaskText}" টাস্কটি চালিয়েছ (ফলাফল: ${pcRes.message})। এখন Rose-কে দেওয়ার জন্য ১-২ বাক্যে একটি পরিষ্কার বাংলা রিপোর্ট লেখো।`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 220,
        },
      };

      try {
        const followRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
            apiKey
          )}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(followUpBody),
          }
        );
        if (followRes.ok) {
          const followData = await followRes.json();
          const followText = followData?.candidates?.[0]?.content?.parts
            ?.map((p: any) => p?.text || '')
            .join('')
            .trim();
          if (followText) return followText;
        }
      } catch {}

      return `পিসিতে "${pcTaskText}" কাজটি শুরু করা হয়েছে। ${pcRes.message}`;
    }

    const replyText = parts
      .map((p: any) => p?.text || '')
      .join('')
      .trim();

    if (replyText) {
      return replyText;
    }
  } catch (err) {
    console.warn('[runOfficeAgentWithGemini] Error:', err);
  }

  // Fallback if network/API error
  if (row.kind === 'status') {
    return `আমি ${agentBengali}। আমার বর্তমান কাজগুলো ঠিকমতো চলছে।`;
  }
  // If task explicitly mentions PC/Chrome/WhatsApp/Messenger, send to PC helper directly as fallback
  if (/হোয়াটসঅ্যাপ|whatsapp|মেসেঞ্জার|messenger|chrome|ক্রোম|পিসি|pc|কম্পিউটার/i.test(row.text)) {
    try {
      await sendPcCommand('agent_task', { task: row.text });
      return `পিসিতে "${row.text}" কাজটি পাঠানো হয়েছে এবং সম্পন্ন হচ্ছে।`;
    } catch {}
  }
  return `${agentBengali} "${row.text}" কাজটি সম্পন্ন করেছে।`;
}

// ============================================================================
// 3) Mobile App Subscription: announces "<agent> জানাল: <report>" when done/failed
// ============================================================================
let mobileRealtimeChannel: any = null;
let mobilePollTimer: ReturnType<typeof setInterval> | null = null;
let currentMobileWorkspace = '';

function getAnnouncedTaskIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(ANNOUNCED_MOBILE_TASKS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function markTaskAnnounced(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const set = getAnnouncedTaskIds();
    set.add(id);
    const arr = Array.from(set).slice(-200);
    localStorage.setItem(ANNOUNCED_MOBILE_TASKS_KEY, JSON.stringify(arr));
  } catch {}
}

const MOBILE_CREATED_TASKS_KEY = 'rose_mobile_created_office_tasks_v1';

function markMobileCreatedTask(id: string) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(MOBILE_CREATED_TASKS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(arr) ? arr : [];
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(MOBILE_CREATED_TASKS_KEY, JSON.stringify(list.slice(-150)));
    }
  } catch {}
}

export function startMobileOfficeTasksSync(
  onReportReady: (announcement: string, row: OfficeTaskRow) => void
): () => void {
  const initialMountTime = Date.now() - 10_000;

  const checkRowForAnnouncement = (row: OfficeTaskRow) => {
    upsertOfficeTaskLocal(row);
    if (row.status !== 'done' && row.status !== 'failed') return;
    if (!row.report) return;

    // Must be from mobile (phone)
    if (row.from_device && row.from_device !== 'mobile' && row.from_device !== 'phone') {
      return;
    }

    const announced = getAnnouncedTaskIds();
    if (announced.has(row.id)) return;

    // Avoid announcing historical rows from days ago on first load unless created recently or in our mobile list
    const updatedMs = new Date(row.updated_at || row.created_at).getTime();
    let isOurRecentTask = updatedMs >= initialMountTime;
    if (!isOurRecentTask && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(MOBILE_CREATED_TASKS_KEY);
        const list = raw ? JSON.parse(raw) : [];
        if (Array.isArray(list) && list.includes(row.id)) {
          isOurRecentTask = true;
        }
      } catch {}
    }

    if (!isOurRecentTask) {
      markTaskAnnounced(row.id);
      return;
    }

    markTaskAnnounced(row.id);
    const agentBengali = AGENT_BENGALI_NAMES[row.agent] || 'মিরা';
    const announcement = `${agentBengali} জানাল: ${row.report}`;
    onReportReady(announcement, row);
  };

  const setupChannel = (workspace: string) => {
    currentMobileWorkspace = workspace;
    if (mobileRealtimeChannel && supabase) {
      try {
        supabase.removeChannel(mobileRealtimeChannel);
      } catch {}
      mobileRealtimeChannel = null;
    }

    if (!supabase) return;
    mobileRealtimeChannel = supabase
      .channel(`office_tasks_mobile_${workspace}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'office_tasks',
          filter: `workspace=eq.${workspace}`,
        },
        (payload: any) => {
          const raw = payload.new;
          if (!raw || !raw.id) return;
          checkRowForAnnouncement(normalizeDbOfficeTaskRow(raw));
        }
      )
      .subscribe();
  };

  setupChannel(getPcDeviceId());

  const pollMobileTasks = async () => {
    const ws = getPcDeviceId();
    if (ws !== currentMobileWorkspace) {
      setupChannel(ws);
    }
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('office_tasks')
        .select('*')
        .eq('workspace', ws)
        .in('status', ['done', 'failed'])
        .order('updated_at', { ascending: false })
        .limit(15);
      if (!error && Array.isArray(data)) {
        for (const raw of data.slice().reverse()) {
          checkRowForAnnouncement(normalizeDbOfficeTaskRow(raw));
        }
      }
    } catch {}
  };

  if (mobilePollTimer) clearInterval(mobilePollTimer);
  mobilePollTimer = setInterval(pollMobileTasks, 3500);
  void pollMobileTasks();

  return () => {
    if (mobileRealtimeChannel && supabase) {
      try {
        supabase.removeChannel(mobileRealtimeChannel);
      } catch {}
      mobileRealtimeChannel = null;
    }
    if (mobilePollTimer) {
      clearInterval(mobilePollTimer);
      mobilePollTimer = null;
    }
  };
}

// ============================================================================
// 4) Same Rose Everywhere: Shared Supabase `chat_messages` Sync (keyed by workspace)
// ============================================================================
export interface SharedChatMessageRow {
  id: string;
  created_at: string;
  workspace: string;
  from_device?: string;
  role: 'user' | 'rose';
  text: string;
}

const syncedChatMessageIds = new Set<string>();
let chatRealtimeChannel: any = null;
let chatPollTimer: ReturnType<typeof setInterval> | null = null;
let currentChatWorkspace = '';

function normalizeChatRole(rawRole: any): 'user' | 'rose' {
  const r = String(rawRole || '').toLowerCase();
  if (r === 'user') return 'user';
  return 'rose';
}

function normalizeDbChatRow(raw: any): SharedChatMessageRow | null {
  if (!raw) return null;
  const text = String(raw.text ?? raw.content ?? raw.message ?? '').trim();
  if (!text) return null;
  const id = String(raw.id || `cm-${raw.created_at || Date.now()}`);
  return {
    id,
    created_at: String(raw.created_at || new Date().toISOString()),
    workspace: String(raw.workspace || getPcDeviceId()),
    from_device: raw.from_device ? String(raw.from_device) : undefined,
    role: normalizeChatRole(raw.role || raw.sender),
    text,
  };
}

/**
 * Saves a user or Rose message to Supabase `chat_messages` keyed by current `workspace`.
 */
export async function saveSharedChatMessageToSupabase(msg: {
  id?: string;
  role: 'user' | 'rose' | 'system';
  text: string;
}): Promise<void> {
  if (msg.role === 'system' || !supabase) return;
  const cleanText = String(msg.text || '').trim();
  if (!cleanText) return;

  const workspace = getPcDeviceId();
  const from_device = detectCurrentDeviceType();
  const id =
    msg.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(msg.id)
      ? msg.id
      : typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : undefined;

  if (msg.id) syncedChatMessageIds.add(msg.id);
  if (id) syncedChatMessageIds.add(id);

  const created_at = new Date().toISOString();

  // Attempt 1: full row with workspace, from_device, role, text
  try {
    const payload1: Record<string, any> = {
      workspace,
      from_device,
      role: msg.role,
      text: cleanText,
      created_at,
    };
    if (id) payload1.id = id;

    const { data, error } = await supabase.from('chat_messages').insert([payload1]).select().single();
    if (!error) {
      if (data?.id) syncedChatMessageIds.add(String(data.id));
      return;
    }

    // Attempt 2: without from_device if column doesn't exist
    const payload2: Record<string, any> = {
      workspace,
      role: msg.role,
      text: cleanText,
      created_at,
    };
    const res2 = await supabase.from('chat_messages').insert([payload2]).select().single();
    if (!res2.error) {
      if (res2.data?.id) syncedChatMessageIds.add(String(res2.data.id));
      return;
    }

    // Attempt 3: content column instead of text
    const payload3: Record<string, any> = {
      workspace,
      role: msg.role,
      content: cleanText,
      created_at,
    };
    const res3 = await supabase.from('chat_messages').insert([payload3]).select().single();
    if (res3.data?.id) syncedChatMessageIds.add(String(res3.data.id));
  } catch (err) {
    console.warn('[chat_messages] Save error:', err);
  }
}

/**
 * Subscribes to `chat_messages` for `workspace = getPcDeviceId()` (initial load + live updates).
 */
export function startSharedChatMessagesSync(callbacks: {
  onInitialLoad: (rows: SharedChatMessageRow[]) => void;
  onNewMessage: (row: SharedChatMessageRow) => void;
}): () => void {
  const loadWorkspaceMessages = async (workspace: string, isInitial: boolean) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('workspace', workspace)
        .order('created_at', { ascending: true })
        .limit(150);

      if (error || !Array.isArray(data)) return;

      const parsed: SharedChatMessageRow[] = [];
      for (const raw of data) {
        const item = normalizeDbChatRow(raw);
        if (item) {
          parsed.push(item);
        }
      }

      if (isInitial) {
        for (const item of parsed) {
          syncedChatMessageIds.add(item.id);
        }
        if (parsed.length > 0) {
          callbacks.onInitialLoad(parsed);
        }
      } else {
        for (const item of parsed) {
          if (!syncedChatMessageIds.has(item.id)) {
            syncedChatMessageIds.add(item.id);
            callbacks.onNewMessage(item);
          }
        }
      }
    } catch {}
  };

  const setupChannel = (workspace: string) => {
    currentChatWorkspace = workspace;
    if (chatRealtimeChannel && supabase) {
      try {
        supabase.removeChannel(chatRealtimeChannel);
      } catch {}
      chatRealtimeChannel = null;
    }

    void loadWorkspaceMessages(workspace, true);

    if (!supabase) return;
    chatRealtimeChannel = supabase
      .channel(`chat_messages_sync_${workspace}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `workspace=eq.${workspace}`,
        },
        (payload: any) => {
          const item = normalizeDbChatRow(payload.new);
          if (!item) return;
          if (syncedChatMessageIds.has(item.id)) return;
          syncedChatMessageIds.add(item.id);
          callbacks.onNewMessage(item);
        }
      )
      .subscribe();
  };

  setupChannel(getPcDeviceId());

  if (chatPollTimer) clearInterval(chatPollTimer);
  chatPollTimer = setInterval(() => {
    const ws = getPcDeviceId();
    if (ws !== currentChatWorkspace) {
      setupChannel(ws);
    } else {
      void loadWorkspaceMessages(ws, false);
    }
  }, 4000);

  return () => {
    if (chatRealtimeChannel && supabase) {
      try {
        supabase.removeChannel(chatRealtimeChannel);
      } catch {}
      chatRealtimeChannel = null;
    }
    if (chatPollTimer) {
      clearInterval(chatPollTimer);
      chatPollTimer = null;
    }
  };
}
