import { sendPcCommand, waitResult, isOnline, getPcSecret, PcCommandRow } from "./pcClient";
import { loadLocalBusinessDb } from "../lib/businessSync";
import { BusinessProfile } from "../types/business";

export type BusinessChannel = "whatsapp" | "messenger";
export type BusinessRunKind = "whatsapp" | "messenger" | "facebook_ad";
export type BusinessIntervalMinutes = 5 | 10 | 15 | 30;

export interface BusinessAutoChannelStats {
  lastRunAt: number | null;
  lastSummary: string;
  lastStatus: "idle" | "running" | "done" | "failed" | "awaiting_confirm";
}

export interface BusinessAutoSettings {
  whatsappEnabled: boolean;
  messengerEnabled: boolean;
  intervalMinutes: BusinessIntervalMinutes;
  replyStyle: string;
  whatsappStats: BusinessAutoChannelStats;
  messengerStats: BusinessAutoChannelStats;
}

export interface BusinessRunRecord {
  id: string;
  commandId: string;
  kind: BusinessRunKind;
  title: string;
  trigger: "auto" | "manual" | "voice_chat";
  status: "running" | "done" | "failed" | "awaiting_confirm" | "rejected";
  summary?: string;
  error?: string;
  startedAt: number;
  finishedAt?: number;
}

const SETTINGS_STORAGE_KEY = "rose_pc_business_auto_settings";
const RUNS_STORAGE_KEY = "rose_pc_business_runs";
const MAX_STORED_RUNS = 40;
const BG_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_REPLY_STYLE = "ভদ্র, ছোট, বাংলায়";

const DEFAULT_SETTINGS: BusinessAutoSettings = {
  whatsappEnabled: false,
  messengerEnabled: false,
  intervalMinutes: 10,
  replyStyle: DEFAULT_REPLY_STYLE,
  whatsappStats: {
    lastRunAt: null,
    lastSummary: "",
    lastStatus: "idle",
  },
  messengerStats: {
    lastRunAt: null,
    lastSummary: "",
    lastStatus: "idle",
  },
};

let currentSettings: BusinessAutoSettings = loadSettings();
let businessRuns: BusinessRunRecord[] = loadRuns();
let isRunningBusinessTask = false;
let runningChannel: BusinessChannel | null = null;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let schedulerStarted = false;

const settingsListeners = new Set<() => void>();

function loadSettings(): BusinessAutoSettings {
  if (typeof window === "undefined") return structuredCloneFallback(DEFAULT_SETTINGS);
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return structuredCloneFallback(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    const validInterval: BusinessIntervalMinutes =
      parsed.intervalMinutes === 5 ||
      parsed.intervalMinutes === 10 ||
      parsed.intervalMinutes === 15 ||
      parsed.intervalMinutes === 30
        ? parsed.intervalMinutes
        : 10;
    return {
      whatsappEnabled: Boolean(parsed.whatsappEnabled),
      messengerEnabled: Boolean(parsed.messengerEnabled),
      intervalMinutes: validInterval,
      replyStyle:
        typeof parsed.replyStyle === "string" && parsed.replyStyle.trim()
          ? parsed.replyStyle
          : DEFAULT_REPLY_STYLE,
      whatsappStats: {
        lastRunAt: typeof parsed.whatsappStats?.lastRunAt === "number" ? parsed.whatsappStats.lastRunAt : null,
        lastSummary: String(parsed.whatsappStats?.lastSummary || ""),
        lastStatus: parsed.whatsappStats?.lastStatus || "idle",
      },
      messengerStats: {
        lastRunAt: typeof parsed.messengerStats?.lastRunAt === "number" ? parsed.messengerStats.lastRunAt : null,
        lastSummary: String(parsed.messengerStats?.lastSummary || ""),
        lastStatus: parsed.messengerStats?.lastStatus || "idle",
      },
    };
  } catch {
    return structuredCloneFallback(DEFAULT_SETTINGS);
  }
}

function structuredCloneFallback<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function saveSettings(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(currentSettings));
  } catch {}
}

function loadRuns(): BusinessRunRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RUNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_STORED_RUNS) : [];
  } catch {
    return [];
  }
}

function saveRuns(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(businessRuns.slice(0, MAX_STORED_RUNS)));
  } catch {}
}

function notifyAll(): void {
  saveSettings();
  saveRuns();
  settingsListeners.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

export function getBusinessAutoSettings(): BusinessAutoSettings {
  return structuredCloneFallback(currentSettings);
}

export function getBusinessRuns(): BusinessRunRecord[] {
  return [...businessRuns];
}

export function isBusinessTaskRunning(): { running: boolean; channel: BusinessChannel | null } {
  return { running: isRunningBusinessTask, channel: runningChannel };
}

export function subscribeBusinessAuto(cb: () => void): () => void {
  settingsListeners.add(cb);
  return () => {
    settingsListeners.delete(cb);
  };
}

export function updateBusinessAutoSettings(
  patch: Partial<Pick<BusinessAutoSettings, "whatsappEnabled" | "messengerEnabled" | "intervalMinutes" | "replyStyle">>
): void {
  const intervalChanged =
    patch.intervalMinutes !== undefined && patch.intervalMinutes !== currentSettings.intervalMinutes;
  const toggleTurnedOn =
    (patch.whatsappEnabled === true && !currentSettings.whatsappEnabled) ||
    (patch.messengerEnabled === true && !currentSettings.messengerEnabled);

  currentSettings = {
    ...currentSettings,
    ...patch,
  };
  notifyAll();

  if (schedulerStarted && (intervalChanged || toggleTurnedOn)) {
    restartSchedulerTimer();
  }
}

export function recordBusinessRun(entry: BusinessRunRecord): void {
  const idx = businessRuns.findIndex((r) => r.commandId === entry.commandId);
  if (idx >= 0) {
    businessRuns = businessRuns.map((r, i) => (i === idx ? { ...r, ...entry } : r));
  } else {
    businessRuns = [entry, ...businessRuns].slice(0, MAX_STORED_RUNS);
  }
  notifyAll();
}

export function updateBusinessRunByCommandId(
  commandId: string,
  patch: Partial<BusinessRunRecord>
): void {
  const idx = businessRuns.findIndex((r) => r.commandId === commandId);
  if (idx < 0) return;
  businessRuns = businessRuns.map((r, i) => (i === idx ? { ...r, ...patch } : r));
  notifyAll();
}

export function getCurrentBusinessProfile(): BusinessProfile {
  const dbProfile = loadLocalBusinessDb().businessProfile;
  if (typeof window === "undefined") return dbProfile;
  try {
    const rawOverride = localStorage.getItem("business_profile");
    if (rawOverride) {
      const parsed = JSON.parse(rawOverride);
      if (parsed && typeof parsed === "object") {
        return { ...dbProfile, ...parsed };
      }
    }
  } catch {}
  return dbProfile;
}

export function formatBusinessProfileText(profile: BusinessProfile): string {
  const lines: string[] = [];
  const push = (label: string, val: any) => {
    const clean = String(val || "").trim();
    if (clean) lines.push(`${label}: ${clean}`);
  };
  push("Business Name", profile.businessName);
  push("Category", profile.category);
  push("Owner", profile.ownerName);
  push("About", profile.about);
  push("Products & Prices", profile.products);
  push("Business Hours", profile.hours || profile.operatingHours);
  push("Policies", profile.policies || profile.customerSupportPolicy);
  push("Delivery Policy", profile.deliveryPolicy);
  push("Refund Policy", profile.refundPolicy);
  push("Phone", profile.phone || profile.contactPhone);
  push("WhatsApp", profile.whatsapp);
  push("Email", profile.email || profile.contactEmail);
  push("Address", profile.address);
  push("Website", profile.website);
  push("Facebook Page", profile.facebook);
  return lines.length > 0 ? lines.join(" | ") : "No business details configured yet.";
}

function buildBusinessReplyPrompt(channel: BusinessChannel): string {
  const profile = getCurrentBusinessProfile();
  const businessInfoText = formatBusinessProfileText(profile);
  const style = (currentSettings.replyStyle || DEFAULT_REPLY_STYLE).trim() || DEFAULT_REPLY_STYLE;

  if (channel === "whatsapp") {
    return (
      `Open https://web.whatsapp.com in Chrome (already logged in). Open each chat with unread messages, read the last messages, and reply as the shop using this business info: ${businessInfoText}. Style: ${style}. If a customer asks something not in the business info, reply 'একটু অপেক্ষা করুন, জানিয়ে দিচ্ছি' and list that chat in the summary. Finish with a short Bengali summary of who was replied to.`
    );
  }

  const hasFbPage = Boolean(String(profile.facebook || "").trim());
  const messengerUrl = hasFbPage
    ? "https://business.facebook.com/latest/inbox"
    : "https://www.facebook.com/messages";

  return (
    `Open ${messengerUrl} in Chrome (already logged in). Open each chat with unread messages, read the last messages, and reply as the shop using this business info: ${businessInfoText}. Style: ${style}. If a customer asks something not in the business info, reply 'একটু অপেক্ষা করুন, জানিয়ে দিচ্ছি' and list that chat in the summary. Finish with a short Bengali summary of who was replied to.`
  );
}

function extractSummaryFromRow(row: PcCommandRow): string {
  const res = row?.result;
  if (typeof res === "string" && res.trim()) return res.trim();
  if (res && typeof res === "object") {
    const txt = res.summary ?? res.message ?? res.reply ?? res.text ?? res.output;
    if (typeof txt === "string" && txt.trim()) return txt.trim();
  }
  return "কাজ সম্পন্ন হয়েছে।";
}

function updateChannelStats(
  channel: BusinessChannel,
  patch: Partial<BusinessAutoChannelStats>
): void {
  if (channel === "whatsapp") {
    currentSettings = {
      ...currentSettings,
      whatsappStats: { ...currentSettings.whatsappStats, ...patch },
    };
  } else {
    currentSettings = {
      ...currentSettings,
      messengerStats: { ...currentSettings.messengerStats, ...patch },
    };
  }
  notifyAll();
}

export async function runBusinessChannelNow(
  channel: BusinessChannel,
  trigger: "auto" | "manual" = "manual"
): Promise<{ ok: boolean; message: string; skipped?: boolean }> {
  if (isRunningBusinessTask) {
    return {
      ok: false,
      skipped: true,
      message: "আগের কাজটি এখনো চলছে — অপেক্ষা করো।",
    };
  }

  if (!getPcSecret()) {
    return {
      ok: false,
      message: "PC HELPER-এ Secret বসাও",
    };
  }

  const online = await isOnline();
  if (!online) {
    return {
      ok: false,
      message: "তোমার ল্যাপটপে Rose Helper চালু নেই",
    };
  }

  isRunningBusinessTask = true;
  runningChannel = channel;
  const startedAt = Date.now();
  const title = channel === "whatsapp" ? "WhatsApp Reply" : "Messenger Reply";
  let commandId = "";

  updateChannelStats(channel, { lastStatus: "running" });

  try {
    const task = buildBusinessReplyPrompt(channel);
    commandId = await sendPcCommand("agent_task", { task });

    recordBusinessRun({
      id: `biz_${commandId}`,
      commandId,
      kind: channel,
      title,
      trigger,
      status: "running",
      startedAt,
    });

    const row = await waitResult(commandId, BG_TIMEOUT_MS);
    const finishedAt = Date.now();
    const rawStatus = String(row?.status || "").toLowerCase();

    if (rawStatus === "done") {
      const summary = extractSummaryFromRow(row);
      updateChannelStats(channel, {
        lastRunAt: finishedAt,
        lastSummary: summary,
        lastStatus: "done",
      });
      updateBusinessRunByCommandId(commandId, {
        status: "done",
        summary,
        finishedAt,
      });
      return { ok: true, message: summary };
    }

    if (rawStatus === "awaiting_confirm") {
      const summary = "অনুমতি লাগবে — 4 CONFIRMATIONS দেখো।";
      updateChannelStats(channel, {
        lastRunAt: finishedAt,
        lastSummary: summary,
        lastStatus: "awaiting_confirm",
      });
      updateBusinessRunByCommandId(commandId, {
        status: "awaiting_confirm",
        summary,
        finishedAt,
      });
      return { ok: false, message: summary };
    }

    const errMsg = String(
      row?.error || row?.result?.error || row?.result?.message || `ব্যর্থ (${rawStatus || "failed"})`
    ).trim();
    updateChannelStats(channel, {
      lastRunAt: finishedAt,
      lastSummary: errMsg,
      lastStatus: "failed",
    });
    updateBusinessRunByCommandId(commandId, {
      status: rawStatus === "rejected" ? "rejected" : "failed",
      error: errMsg,
      finishedAt,
    });
    return { ok: false, message: errMsg };
  } catch (err: any) {
    const finishedAt = Date.now();
    const errMsg = String(err?.message || "ব্যর্থ হয়েছে").trim();
    updateChannelStats(channel, {
      lastRunAt: finishedAt,
      lastSummary: errMsg,
      lastStatus: "failed",
    });
    if (commandId) {
      updateBusinessRunByCommandId(commandId, {
        status: "failed",
        error: errMsg,
        finishedAt,
      });
    }
    return { ok: false, message: errMsg };
  } finally {
    isRunningBusinessTask = false;
    runningChannel = null;
    notifyAll();
  }
}

async function runScheduledTick(): Promise<void> {
  const { whatsappEnabled, messengerEnabled } = currentSettings;
  if (!whatsappEnabled && !messengerEnabled) return;
  if (isRunningBusinessTask) return;
  if (!getPcSecret()) return;

  const online = await isOnline();
  if (!online) return;

  if (whatsappEnabled) {
    await runBusinessChannelNow("whatsapp", "auto");
  }
  if (currentSettings.messengerEnabled && !isRunningBusinessTask) {
    await runBusinessChannelNow("messenger", "auto");
  }
}

function restartSchedulerTimer(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
  const minutes = currentSettings.intervalMinutes || 10;
  schedulerTimer = setInterval(() => {
    void runScheduledTick();
  }, minutes * 60 * 1000);
}

export function startBusinessAutoScheduler(): () => void {
  if (schedulerStarted) {
    return () => {};
  }
  schedulerStarted = true;
  restartSchedulerTimer();
  return () => {
    schedulerStarted = false;
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
  };
}
