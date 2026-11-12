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

export function getCurrentView(): string {
  if (typeof document === 'undefined') return 'home';
  const viewEl = document.querySelector('[data-current-view]');
  if (viewEl) {
    const v = viewEl.getAttribute('data-current-view');
    if (v) return v;
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
  const current = getCurrentView();
  if (current === id || current === navId) return true;
  return false;
}

export async function openPage(id: string): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const pageDef = PAGES.find(p => p.id === id);
  if (!pageDef) return false;

  if (pageDef.parent) {
    const parentDef = PAGES.find(p => p.id === pageDef.parent);
    if (parentDef) {
      const parentNavId = PAGE_TO_NAV_ID[parentDef.id] || parentDef.id;
      const parentEl = document.querySelector(`[data-nav-id="${parentNavId}"]`) as HTMLElement;
      if (parentEl) {
        parentEl.click();
        await new Promise(r => setTimeout(r, 300));
      } else {
        await openPage(parentDef.id);
      }
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
  } else {
    const win = window as any;
    if (win.setCurrentView) {
      win.setCurrentView(navId);
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return isPageVisible(id);
}

export async function goBack(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const current = getCurrentView();

  const backButtons = Array.from(document.querySelectorAll('[data-nav-id="back"]')) as HTMLElement[];
  const visibleBack = backButtons.find(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
  });

  if (visibleBack) {
    visibleBack.click();
    await new Promise(r => setTimeout(r, 400));
    return true;
  }

  const pageDef = PAGES.find(p => p.id === current || PAGE_TO_NAV_ID[p.id] === current);
  if (pageDef && pageDef.parent) {
    return openPage(pageDef.parent);
  }

  const homeBtn = document.querySelector('[data-nav-id="home"]') as HTMLElement;
  if (homeBtn) {
    homeBtn.click();
    await new Promise(r => setTimeout(r, 300));
    return true;
  }

  const win = window as any;
  if (win.setCurrentView) {
    win.setCurrentView('home');
    return true;
  }

  return false;
}

if (typeof window !== 'undefined') {
  (window as any).openPage = openPage;
  (window as any).goBack = goBack;
}
