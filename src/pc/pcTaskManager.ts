import {
  sendPcCommand,
  waitResult,
  approve,
  reject,
  isOnline,
  PcCommandRow,
} from "./pcClient";
import { supabase } from "../lib/supabase";

export type PcTaskUiStatus = "চলছে" | "শেষ" | "ব্যর্থ" | "অনুমতি লাগবে";

export interface PcTaskRecord {
  id: string;
  task: string;
  action: string;
  rawStatus: string;
  uiStatus: PcTaskUiStatus;
  summary?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  anchorMessageId?: string;
}

export const PC_TASK_FUNCTION_DECLARATION = {
  name: "pc_task",
  description:
    "Do any task on the user's laptop/PC: open apps or websites, write in WordPress, download/install apps, reply to WhatsApp/Messenger on the PC, prepare Facebook ads, files, typing, settings — anything a person does on a computer.",
  parameters: {
    type: "OBJECT",
    properties: {
      task: {
        type: "STRING",
        description: "Full task in the user's words, in detail",
      },
      quick_action: {
        type: "STRING",
        enum: [
          "ping",
          "system_info",
          "open_url",
          "open_app",
          "install_app",
          "lock",
          "shutdown",
          "restart",
          "cancel_shutdown",
          "media",
          "screenshot",
        ],
        description: "Optional quick action when a direct built-in PC action fits",
      },
      args: {
        type: "OBJECT",
        description: "Optional arguments object for quick_action",
      },
    },
    required: ["task"],
  },
};

const STORAGE_KEY = "rose_pc_task_cards";
const MAX_STORED_TASKS = 25;
const BG_WAIT_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

let pcTasks: PcTaskRecord[] = loadStoredTasks();
const listeners = new Set<(tasks: PcTaskRecord[]) => void>();
const activeWaiters = new Set<string>();
const externalConfirmWatchers = new Map<string, ReturnType<typeof setInterval>>();

function loadStoredTasks(): PcTaskRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_STORED_TASKS);
  } catch {
    return [];
  }
}

function saveStoredTasks(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pcTasks.slice(0, MAX_STORED_TASKS)));
  } catch {}
}

function notifyListeners(): void {
  saveStoredTasks();
  const snapshot = [...pcTasks];
  listeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {}
  });
}

export function mapRawStatusToUiStatus(rawStatus: string): PcTaskUiStatus {
  const s = String(rawStatus || "").toLowerCase();
  if (s === "awaiting_confirm") return "অনুমতি লাগবে";
  if (s === "done") return "শেষ";
  if (s === "failed" || s === "error" || s === "rejected") return "ব্যর্থ";
  return "চলছে";
}

export function getPcTasks(): PcTaskRecord[] {
  return [...pcTasks];
}

export function subscribePcTasks(cb: (tasks: PcTaskRecord[]) => void): () => void {
  listeners.add(cb);
  try {
    cb([...pcTasks]);
  } catch {}
  return () => {
    listeners.delete(cb);
  };
}

export function clearPcTasks(): void {
  pcTasks = [];
  externalConfirmWatchers.forEach((timer) => clearInterval(timer));
  externalConfirmWatchers.clear();
  notifyListeners();
}

export function linkPcTaskToMessage(taskId: string, messageId: string): void {
  if (!taskId || !messageId) return;
  let changed = false;
  pcTasks = pcTasks.map((t) => {
    if (t.id === taskId && !t.anchorMessageId) {
      changed = true;
      return { ...t, anchorMessageId: messageId };
    }
    return t;
  });
  if (changed) notifyListeners();
}

function upsertTask(patch: Partial<PcTaskRecord> & { id: string }): void {
  const idx = pcTasks.findIndex((t) => t.id === patch.id);
  if (idx >= 0) {
    const prev = pcTasks[idx];
    const nextRaw = patch.rawStatus ?? prev.rawStatus;
    const nextUi = patch.uiStatus ?? mapRawStatusToUiStatus(nextRaw);
    pcTasks = pcTasks.map((t, i) =>
      i === idx
        ? {
            ...t,
            ...patch,
            rawStatus: nextRaw,
            uiStatus: nextUi,
            updatedAt: Date.now(),
          }
        : t
    );
  } else {
    const rawStatus = patch.rawStatus || "pending";
    const created: PcTaskRecord = {
      id: patch.id,
      task: patch.task || patch.action || "PC task",
      action: patch.action || "agent_task",
      rawStatus,
      uiStatus: patch.uiStatus || mapRawStatusToUiStatus(rawStatus),
      summary: patch.summary,
      error: patch.error,
      createdAt: patch.createdAt || Date.now(),
      updatedAt: Date.now(),
      anchorMessageId: patch.anchorMessageId,
    };
    pcTasks = [...pcTasks, created].slice(-MAX_STORED_TASKS);
  }
  notifyListeners();
}

function stopExternalConfirmWatcher(id: string): void {
  const timer = externalConfirmWatchers.get(id);
  if (timer) {
    clearInterval(timer);
    externalConfirmWatchers.delete(id);
  }
}

function announcePcTaskMessage(message: string, taskId: string, status: string): void {
  if (typeof window === "undefined" || !message.trim()) return;
  try {
    window.dispatchEvent(
      new CustomEvent("rose-pc-task-announce", {
        detail: { message: message.trim(), taskId, status },
      })
    );
  } catch {}
}

export function formatPcTaskResultMessage(row: PcCommandRow): string {
  const res = row?.result;
  const action = String(row?.action || "").toLowerCase();

  if (typeof res === "string" && res.trim() && res.length < 1500) {
    return res.trim();
  }

  if (res && typeof res === "object") {
    const candidate =
      res.summary ?? res.message ?? res.reply ?? res.text ?? res.output;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().slice(0, 500);
    }

    if (res.jpeg_base64 || action === "screenshot") {
      return "ল্যাপটপের স্ক্রিনশট নেওয়া হয়েছে।";
    }

    if (action === "ping") {
      return "ল্যাপটপ অনলাইনে আছে।";
    }

    if (action === "system_info") {
      const parts: string[] = [];
      if (res.cpu !== undefined) parts.push(`CPU ${res.cpu}%`);
      if (res.ram !== undefined) parts.push(`RAM ${res.ram}%`);
      if (res.battery !== undefined) parts.push(`Battery ${res.battery}%`);
      if (parts.length > 0) {
        return `ল্যাপটপের অবস্থা: ${parts.join(", ")}।`;
      }
    }
  }

  if (action === "screenshot") return "ল্যাপটপের স্ক্রিনশট নেওয়া হয়েছে।";
  if (action === "ping") return "ল্যাপটপ অনলাইনে আছে।";
  if (action === "lock") return "ল্যাপটপ লক করা হয়েছে।";
  return "ল্যাপটপের কাজটা শেষ হয়েছে।";
}

function watchAwaitingConfirmExternally(id: string, taskText: string): void {
  if (!supabase || externalConfirmWatchers.has(id)) return;
  const client = supabase;
  const timer = setInterval(async () => {
    const current = pcTasks.find((t) => t.id === id);
    if (!current || current.rawStatus !== "awaiting_confirm") {
      stopExternalConfirmWatcher(id);
      return;
    }
    try {
      const { data, error } = await client
        .from("pc_commands")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return;
      const nextStatus = String(data.status || "").toLowerCase();
      if (nextStatus === "awaiting_confirm") return;

      stopExternalConfirmWatcher(id);
      if (nextStatus === "approved" || nextStatus === "running" || nextStatus === "pending") {
        upsertTask({ id, rawStatus: nextStatus });
        void startBackgroundWaitForTask(id, taskText);
      } else if (nextStatus === "rejected") {
        upsertTask({ id, rawStatus: "rejected", error: "বাতিল করা হয়েছে" });
      } else if (nextStatus === "done") {
        const parsedRow: PcCommandRow = {
          ...(data as any),
          result:
            typeof data.result === "string"
              ? (() => {
                  try {
                    return JSON.parse(data.result);
                  } catch {
                    return data.result;
                  }
                })()
              : data.result,
        };
        const summary = formatPcTaskResultMessage(parsedRow);
        upsertTask({ id, rawStatus: "done", summary });
        announcePcTaskMessage(summary, id, "done");
      } else if (nextStatus === "failed" || nextStatus === "error") {
        const errMsg = String(data.error || "কাজটা করা যায়নি").trim();
        upsertTask({ id, rawStatus: nextStatus, error: errMsg });
        announcePcTaskMessage(`ল্যাপটপের কাজটা ব্যর্থ হয়েছে: ${errMsg}`, id, nextStatus);
      }
    } catch {}
  }, 2000);
  externalConfirmWatchers.set(id, timer);
}

export async function startBackgroundWaitForTask(
  id: string,
  taskText: string
): Promise<void> {
  if (!id || activeWaiters.has(id)) return;
  activeWaiters.add(id);

  try {
    const row = await waitResult(id, BG_WAIT_TIMEOUT_MS, (progressRow) => {
      const s = String(progressRow?.status || "").toLowerCase();
      if (s && s !== "awaiting_confirm") {
        upsertTask({ id, rawStatus: s });
      }
    });

    const finalStatus = String(row?.status || "").toLowerCase();

    if (finalStatus === "done") {
      stopExternalConfirmWatcher(id);
      const summary = formatPcTaskResultMessage(row);
      upsertTask({ id, rawStatus: "done", summary });
      announcePcTaskMessage(summary, id, "done");
      return;
    }

    if (finalStatus === "awaiting_confirm") {
      upsertTask({ id, rawStatus: "awaiting_confirm" });
      announcePcTaskMessage(
        "এটা ব্যাংক/পেমেন্ট/পাসওয়ার্ডের কাজ, করব?",
        id,
        "awaiting_confirm"
      );
      watchAwaitingConfirmExternally(id, taskText);
      return;
    }

    if (finalStatus === "rejected") {
      stopExternalConfirmWatcher(id);
      upsertTask({ id, rawStatus: "rejected", error: "বাতিল করা হয়েছে" });
      announcePcTaskMessage("ঠিক আছে, কাজটা বাতিল করলাম।", id, "rejected");
      return;
    }

    stopExternalConfirmWatcher(id);
    const errMsg = String(
      row?.error || row?.result?.error || row?.result?.message || "কাজটা করা যায়নি"
    ).trim();
    upsertTask({ id, rawStatus: finalStatus || "failed", error: errMsg });
    announcePcTaskMessage(`ল্যাপটপের কাজটা ব্যর্থ হয়েছে: ${errMsg}`, id, "failed");
  } catch (err: any) {
    stopExternalConfirmWatcher(id);
    const errMsg = String(
      err?.message || "সময় শেষ — PC Helper থেকে উত্তর আসেনি"
    ).trim();
    upsertTask({ id, rawStatus: "failed", error: errMsg });
    announcePcTaskMessage(errMsg, id, "failed");
  } finally {
    activeWaiters.delete(id);
  }
}

export async function executePcTaskTool(
  rawArgs: Record<string, any> = {}
): Promise<{ ok: boolean; message: string; taskId?: string }> {
  const task = String(
    rawArgs?.task || rawArgs?.instruction || rawArgs?.command || ""
  ).trim();
  const quickActionRaw =
    typeof rawArgs?.quick_action === "string"
      ? rawArgs.quick_action.trim()
      : "";
  const actionArgs =
    rawArgs?.args && typeof rawArgs.args === "object" ? rawArgs.args : {};

  const online = await isOnline();
  if (!online) {
    return {
      ok: false,
      message: "তোমার ল্যাপটপে Rose Helper চালু নেই",
    };
  }

  const actionName = quickActionRaw || "agent_task";
  const payloadArgs = quickActionRaw
    ? actionArgs
    : { task: task || quickActionRaw || "" };
  const displayTask = task || quickActionRaw || "PC task";

  try {
    const id = await sendPcCommand(actionName, payloadArgs);
    upsertTask({
      id,
      task: displayTask,
      action: actionName,
      rawStatus: "pending",
      uiStatus: "চলছে",
      createdAt: Date.now(),
    });
    void startBackgroundWaitForTask(id, displayTask);
    return {
      ok: true,
      taskId: id,
      message: "ঠিক আছে, ল্যাপটপে করছি",
    };
  } catch (err: any) {
    return {
      ok: false,
      message: String(err?.message || "কমান্ড পাঠানো যায়নি"),
    };
  }
}

export async function approvePcTask(
  id: string
): Promise<{ ok: boolean; message: string }> {
  try {
    stopExternalConfirmWatcher(id);
    await approve(id);
    const existing = pcTasks.find((t) => t.id === id);
    upsertTask({ id, rawStatus: "approved", uiStatus: "চলছে" });
    void startBackgroundWaitForTask(id, existing?.task || "PC task");
    return { ok: true, message: "ঠিক আছে, করছি।" };
  } catch (err: any) {
    const msg = String(err?.message || "অনুমতি দেওয়া যায়নি");
    return { ok: false, message: msg };
  }
}

export async function rejectPcTask(
  id: string
): Promise<{ ok: boolean; message: string }> {
  try {
    stopExternalConfirmWatcher(id);
    await reject(id);
    upsertTask({
      id,
      rawStatus: "rejected",
      uiStatus: "ব্যর্থ",
      error: "বাতিল করা হয়েছে",
    });
    return { ok: true, message: "ঠিক আছে, বাতিল করলাম।" };
  } catch (err: any) {
    const msg = String(err?.message || "বাতিল করা যায়নি");
    return { ok: false, message: msg };
  }
}

export function getLatestAwaitingConfirmPcTask(): PcTaskRecord | null {
  for (let i = pcTasks.length - 1; i >= 0; i--) {
    if (pcTasks[i].rawStatus === "awaiting_confirm") {
      return pcTasks[i];
    }
  }
  return null;
}

export function hasPendingPcTaskConfirm(): boolean {
  return getLatestAwaitingConfirmPcTask() !== null;
}

export async function handlePendingPcTaskDecision(
  decision: "yes" | "no"
): Promise<{ handled: boolean; reply?: string }> {
  const pending = getLatestAwaitingConfirmPcTask();
  if (!pending) return { handled: false };
  if (decision === "no") {
    const res = await rejectPcTask(pending.id);
    return { handled: true, reply: res.message };
  }
  const res = await approvePcTask(pending.id);
  return { handled: true, reply: res.message };
}

function normalizeConfirmText(text: string): { normalized: string; tokens: string[] } {
  const normalized = String(text || "")
    .toLowerCase()
    .replace(/[।॥.,!?;:'"‘’“”()[\]{}—–\-_/\\|~`@#$%^&*+=<>…]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = normalized ? normalized.split(" ") : [];
  return { normalized, tokens };
}

function isPcAffirmative(text: string): boolean {
  const { normalized, tokens } = normalizeConfirmText(text);
  if (!normalized) return false;
  if (/(?:^|\s)ঠিক\s+আছে(?:\s|$)/.test(normalized)) return true;
  const yesWords = new Set([
    "হ্যাঁ",
    "হ্যা",
    "হা",
    "হাঁ",
    "হুম",
    "হুঁ",
    "হু",
    "জি",
    "জ্বি",
    "দাও",
    "দিন",
    "দে",
    "করো",
    "কর",
    "ওকে",
    "ok",
    "okay",
    "yes",
    "ya",
    "ha",
    "haa",
    "hmm",
    "allow",
  ]);
  return tokens.some((tok) => yesWords.has(tok));
}

function isPcNegative(text: string): boolean {
  const { normalized, tokens } = normalizeConfirmText(text);
  if (!normalized) return false;
  const noWords = new Set([
    "না",
    "নাহ",
    "থামো",
    "থাম",
    "থাক",
    "বাদ",
    "no",
    "cancel",
    "stop",
    "deny",
  ]);
  return tokens.some((tok) => noWords.has(tok));
}

export async function handlePendingPcTaskReply(
  userText: string
): Promise<{ handled: boolean; reply?: string }> {
  if (!hasPendingPcTaskConfirm()) return { handled: false };
  if (isPcNegative(userText)) {
    return handlePendingPcTaskDecision("no");
  }
  if (isPcAffirmative(userText)) {
    return handlePendingPcTaskDecision("yes");
  }
  return { handled: false };
}
