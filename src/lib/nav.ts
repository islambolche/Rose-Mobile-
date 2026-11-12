export interface PageDef {
  id: string;
  parent: string | null;
}

export const PAGES: PageDef[] = [
  { id: 'home', parent: null },
  { id: 'chat', parent: null },
  { id: 'history', parent: null },
  { id: 'settings', parent: null },

  { id: 'about_guide', parent: 'settings' },
  { id: 'connections', parent: 'settings' },
  { id: 'live_voice_model', parent: 'settings' },
  { id: 'voice_language', parent: 'settings' },
  { id: 'chats_memory', parent: 'settings' },
  { id: 'look_feel', parent: 'settings' },
  { id: 'phone_control', parent: 'settings' },
  { id: 'pc_setup', parent: 'settings' },
  { id: 'privacy_controls', parent: 'settings' },

  { id: 'tts_model', parent: 'voice_language' },
  { id: 'assistant_name', parent: 'voice_language' },
  { id: 'your_name', parent: 'voice_language' },
  { id: 'personality', parent: 'voice_language' },
  { id: 'affection', parent: 'voice_language' },
  { id: 'language', parent: 'voice_language' },
  { id: 'response_style', parent: 'voice_language' },
  { id: 'voice', parent: 'voice_language' },
  { id: 'voice_model', parent: 'voice_language' },
  { id: 'voice_tuning', parent: 'voice_language' },
  { id: 'voice_check', parent: 'voice_language' },
  { id: 'mic_listening', parent: 'voice_language' },

  { id: 'theme', parent: 'look_feel' },
  { id: 'orb_style', parent: 'look_feel' },
  { id: 'rose_alive', parent: 'look_feel' },

  { id: 'quick_actions', parent: 'phone_control' },
  { id: 'app_permissions', parent: 'phone_control' },

  { id: 'pc_helper', parent: 'pc_setup' },
  { id: 'pc_control', parent: 'pc_setup' },
  { id: 'pc_files', parent: 'pc_setup' },
  { id: 'confirmations', parent: 'pc_setup' },
  { id: 'pc_history', parent: 'pc_setup' },
  { id: 'safety', parent: 'pc_setup' },
  { id: 'local_ai', parent: 'pc_setup' },
  { id: 'view_mode', parent: 'pc_setup' },
];

const PAGE_TO_NAV_ID: Record<string, string> = {
  home: 'home',
  chat: 'chat',
  history: 'history',
  settings: 'settings',
  about_guide: 'about',
  connections: 'connections',
  live_voice_model: 'live_voice_model',
  voice_language: 'voice_language',
  chats_memory: 'chats_memory',
  look_feel: 'look_feel',
  phone_control: 'phone_control',
  pc_setup: 'pc_setup',
  privacy_controls: 'privacy',
  tts_model: 'tts_model',
  assistant_name: 'assistant_name',
  your_name: 'owner_name',
  personality: 'personality',
  affection: 'affection',
  language: 'language_page',
  response_style: 'response_style',
  voice: 'voice_page',
  voice_model: 'voice_model_list',
  voice_tuning: 'voice_tuning',
  voice_check: 'voice_check',
  mic_listening: 'mic_listening',
  theme: 'theme',
  orb_style: 'orb',
  rose_alive: 'rose_alive',
  quick_actions: 'quick_actions',
  app_permissions: 'app_permissions',
  pc_helper: 'pc_helper',
  pc_control: 'pc_control',
  pc_files: 'pc_files',
  confirmations: 'confirmations',
  pc_history: 'pc_history',
  safety: 'safety',
  local_ai: 'local_ai',
  view_mode: 'view_mode',
};

const NAV_ID_TO_PAGE: Record<string, string> = Object.fromEntries(
  Object.entries(PAGE_TO_NAV_ID).map(([k, v]) => [v, k])
);

export function currentPage(): string {
  if (typeof document === 'undefined') return 'home';
  const win = window as any;
  if (win.__currentAppView && PAGES.some(p => p.id === win.__currentAppView)) {
    return win.__currentAppView;
  }
  const viewEl = document.querySelector('[data-current-view]');
  if (viewEl) {
    const v = viewEl.getAttribute('data-current-view');
    if (v && NAV_ID_TO_PAGE[v]) return NAV_ID_TO_PAGE[v];
    if (v && PAGES.some(p => p.id === v)) return v;
  }
  for (const p of PAGES) {
    const navId = PAGE_TO_NAV_ID[p.id] || p.id;
    const el = document.querySelector(`[data-nav-id="${navId}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return p.id;
      }
    }
  }
  return 'home';
}

export function isPageVisible(id: string): boolean {
  if (typeof document === 'undefined') return false;
  const navId = PAGE_TO_NAV_ID[id] || id;
  const el = document.querySelector(`[data-nav-id="${navId}"]`);
  if (el) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return true;
  }
  return currentPage() === id;
}

export async function openPage(id: string): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const pageDef = PAGES.find(p => p.id === id);
  if (!pageDef) return false;

  const win = window as any;
  if (win.setIsCallMinimized) {
    win.setIsCallMinimized(true);
  }

  if (pageDef.parent) {
    const parentDef = PAGES.find(p => p.id === pageDef.parent);
    if (parentDef && !isPageVisible(parentDef.id)) {
      await openPage(parentDef.id);
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const navId = PAGE_TO_NAV_ID[id] || id;
  let targetEl = document.querySelector(`[data-nav-id="${navId}"]`) as HTMLElement;
  if (!targetEl) {
    targetEl = document.querySelector(`[data-current-view="${id}"]`) as HTMLElement;
  }

  if (targetEl) {
    targetEl.click();
    await new Promise(r => setTimeout(r, 400));
  } else if (win.setCurrentView) {
    win.setCurrentView(navId);
    await new Promise(r => setTimeout(r, 300));
  }

  return isPageVisible(id);
}

export async function goBack(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const cur = currentPage();

  const win = window as any;
  if (win.setIsCallMinimized) {
    win.setIsCallMinimized(true);
  }

  const backButtons = Array.from(document.querySelectorAll('[data-nav-id="back"]')) as HTMLElement[];
  const visibleBack = backButtons.find(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
  });

  if (visibleBack) {
    visibleBack.click();
    await new Promise(r => setTimeout(r, 400));
    const newCur = currentPage();
    return newCur !== cur;
  }

  const pageDef = PAGES.find(p => p.id === cur);
  if (pageDef && pageDef.parent) {
    const ok = await openPage(pageDef.parent);
    const newCur = currentPage();
    return ok && newCur !== cur;
  }

  if (cur === 'settings' || cur === 'home') {
    const ok = await openPage('home');
    const newCur = currentPage();
    return ok && newCur !== cur;
  }

  return false;
}

export const SETTINGS_MAIN_LIST = [
  'about_guide', 'connections', 'live_voice_model', 'voice_language',
  'chats_memory', 'look_feel', 'phone_control', 'pc_setup', 'privacy_controls'
];

export const VOICE_LANGUAGE_LIST = [
  'tts_model', 'assistant_name', 'your_name', 'personality',
  'affection', 'language', 'response_style', 'voice',
  'voice_model', 'voice_tuning', 'voice_check', 'mic_listening'
];

export async function openNumber(n: number): Promise<{ ok: boolean; page?: string }> {
  const cur = currentPage();
  let list = SETTINGS_MAIN_LIST;
  if (cur === 'voice_language') {
    list = VOICE_LANGUAGE_LIST;
  }
  const targetId = list[n - 1];
  if (!targetId) return { ok: false };
  const ok = await openPage(targetId);
  return { ok, page: targetId };
}

if (typeof window !== 'undefined') {
  (window as any).openPage = openPage;
  (window as any).goBack = goBack;
  (window as any).openNumber = openNumber;
  (window as any).currentPage = currentPage;
}
