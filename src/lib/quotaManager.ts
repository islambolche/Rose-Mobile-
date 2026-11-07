/**
 * Quota and Usage Tracking Manager for Rose AI Assistant
 * Tracks daily API call stats, model quota exhaustion (429), reset countdowns, and rate-limited toasts.
 */

export interface DailyUsageData {
  date: string; // YYYY-MM-DD
  answerCallsCount: number;
  ttsCallsCount: number;
  exhaustedModels: Record<string, string>; // modelName -> YYYY-MM-DD
  lastQuotaToastTime: number; // timestamp ms
}

const STORAGE_KEY = "rose_quota_usage_today";

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getQuotaUsage(): DailyUsageData {
  const today = getTodayDateString();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: DailyUsageData = JSON.parse(raw);
      if (parsed.date === today) {
        return {
          date: today,
          answerCallsCount: parsed.answerCallsCount || 0,
          ttsCallsCount: parsed.ttsCallsCount || 0,
          exhaustedModels: parsed.exhaustedModels || {},
          lastQuotaToastTime: parsed.lastQuotaToastTime || 0,
        };
      }
    }
  } catch (e) {}

  // Reset for new day
  const newData: DailyUsageData = {
    date: today,
    answerCallsCount: 0,
    ttsCallsCount: 0,
    exhaustedModels: {},
    lastQuotaToastTime: 0,
  };
  saveQuotaUsage(newData);
  return newData;
}

function saveQuotaUsage(data: DailyUsageData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}

export function incrementAnswerCalls(): void {
  const usage = getQuotaUsage();
  usage.answerCallsCount += 1;
  saveQuotaUsage(usage);
}

export function incrementTTSCalls(): void {
  const usage = getQuotaUsage();
  usage.ttsCallsCount += 1;
  saveQuotaUsage(usage);
}

export function markModelExhausted(modelName: string): void {
  if (!modelName) return;
  const usage = getQuotaUsage();
  const today = getTodayDateString();
  usage.exhaustedModels[modelName] = today;
  saveQuotaUsage(usage);
}

export function isModelExhausted(modelName: string): boolean {
  if (!modelName) return false;
  const usage = getQuotaUsage();
  const today = getTodayDateString();
  return usage.exhaustedModels[modelName] === today;
}

export function getExhaustedModelsToday(): string[] {
  const usage = getQuotaUsage();
  const today = getTodayDateString();
  return Object.keys(usage.exhaustedModels).filter(
    (m) => usage.exhaustedModels[m] === today
  );
}

export function shouldShowQuotaToast(): boolean {
  const usage = getQuotaUsage();
  const ONE_HOUR = 60 * 60 * 1000;
  return Date.now() - usage.lastQuotaToastTime > ONE_HOUR;
}

export function recordQuotaToastShown(): void {
  const usage = getQuotaUsage();
  usage.lastQuotaToastTime = Date.now();
  saveQuotaUsage(usage);
}

export function getResetCountdownString(): string {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  const diffMs = tomorrow.getTime() - now.getTime();
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}
