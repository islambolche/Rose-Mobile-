export interface DevLogEntry {
  id: string;
  time: string;
  timestamp: number;
  area: 'chat' | 'live' | 'tts' | 'supabase' | 'nav' | 'other';
  message: string;
  status?: number;
  model?: string;
  details?: string;
}

const STORAGE_KEY = 'iyabd_dev_logs';
const MAX_ENTRIES = 200;

function sanitizeText(input: any): string {
  if (input === null || input === undefined) return '';
  let str = typeof input === 'string' ? input : String(input?.message || JSON.stringify(input));
  // Remove Gemini / Google API keys
  str = str.replace(/AIza[0-9A-Za-z-_]{30,}/g, '[REDACTED_API_KEY]');
  // Remove query param keys
  str = str.replace(/key=[^&\s]+/gi, 'key=[REDACTED]');
  // Remove bearer tokens
  str = str.replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED_TOKEN]');
  // Remove supabase secrets
  str = str.replace(/eyJ[A-Za-z0-9-_.]+/g, '[REDACTED_JWT]');
  return str.slice(0, 1000); // Prevent gigantic strings
}

export function getDevLogs(): DevLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function clearDevLogs(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

export function logDevError(entry: {
  area: 'chat' | 'live' | 'tts' | 'supabase' | 'nav' | 'other';
  message: string;
  status?: number;
  model?: string;
  details?: any;
}): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getDevLogs();
    const now = new Date();
    const newEntry: DevLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestamp: now.getTime(),
      area: entry.area,
      message: sanitizeText(entry.message),
      status: entry.status,
      model: entry.model ? sanitizeText(entry.model) : undefined,
      details: entry.details ? sanitizeText(entry.details) : undefined,
    };

    // Store newest first, max 200
    const updated = [newEntry, ...current].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Dispatch custom event so reactive UI can update
    window.dispatchEvent(new CustomEvent('dev-log-added', { detail: newEntry }));
  } catch (e) {
    // Fail silently to not impact app runtime
  }
}

let isInitialized = false;

export function initDevLogger(): void {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;

  // Window error handler
  window.addEventListener('error', (event) => {
    try {
      const msg = event.message || 'Window script error';
      // Ignore normal browser extension or resize errors
      if (msg.includes('ResizeObserver') || msg.includes('Script error.')) return;
      logDevError({
        area: 'other',
        message: msg,
        details: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      });
    } catch (e) {}
  });

  // Unhandled promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event.reason;
      const msg = typeof reason === 'string' ? reason : reason?.message || 'Unhandled Promise Rejection';
      const stack = reason?.stack || '';
      let area: 'chat' | 'live' | 'tts' | 'supabase' | 'nav' | 'other' = 'other';
      if (msg.toLowerCase().includes('gemini') || msg.toLowerCase().includes('generate')) area = 'chat';
      else if (msg.toLowerCase().includes('live') || msg.toLowerCase().includes('websocket')) area = 'live';
      else if (msg.toLowerCase().includes('tts') || msg.toLowerCase().includes('audio')) area = 'tts';
      else if (msg.toLowerCase().includes('supabase')) area = 'supabase';

      logDevError({
        area,
        message: msg,
        status: reason?.status || reason?.statusCode,
        details: stack || undefined,
      });
    } catch (e) {}
  });

  // Intercept console.error to capture logged errors
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    try {
      const msg = args.map(a => (typeof a === 'string' ? a : a?.message || JSON.stringify(a))).join(' ');
      if (!msg.includes('ResizeObserver') && !msg.includes('WebSocket connection to') && !msg.includes('favicon')) {
        let area: 'chat' | 'live' | 'tts' | 'supabase' | 'nav' | 'other' = 'other';
        if (msg.includes('Gemini') || msg.includes('generateContent')) area = 'chat';
        else if (msg.includes('Live') || msg.includes('audioContext')) area = 'live';
        else if (msg.includes('TTS') || msg.includes('speech')) area = 'tts';
        else if (msg.includes('supabase')) area = 'supabase';

        logDevError({
          area,
          message: msg.slice(0, 300),
          details: args.length > 1 ? args.slice(1).map(sanitizeText).join(' ') : undefined,
        });
      }
    } catch (e) {}
    originalConsoleError.apply(console, args);
  };
}

// Auto-initialize in browser
if (typeof window !== 'undefined') {
  initDevLogger();
}
