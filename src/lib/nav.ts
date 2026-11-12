export interface PageDef {
  id: string;
  parent: string | null;
}

export const PAGES: PageDef[] = [
  { id: 'home', parent: null },
  { id: 'chat', parent: null },
  { id: 'history', parent: 'home' },
  { id: 'camera_toggle', parent: null },
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
  { id: 'developer_tools', parent: 'settings' },
  { id: 'error_log', parent: 'developer_tools' },
  { id: 'app_status', parent: 'developer_tools' },
  { id: 'find_problems', parent: 'developer_tools' },
  { id: 'system_info', parent: 'developer_tools' },

  { id: 'about_app', parent: 'about_guide' },
  { id: 'developer', parent: 'about_guide' },
  { id: 'pricing', parent: 'about_guide' },
  { id: 'getting_started', parent: 'about_guide' },
  { id: 'how_to_use', parent: 'about_guide' },
  { id: 'guidelines', parent: 'about_guide' },
  { id: 'privacy', parent: 'about_guide' },
  { id: 'terms', parent: null },
  { id: 'privacy_policy', parent: null },
  { id: 'troubleshooting', parent: 'about_guide' },
  { id: 'help_support', parent: 'about_guide' },

  { id: 'gemini_free', parent: 'connections' },
  { id: 'paid_model', parent: 'connections' },

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
  { id: 'reduce_motion', parent: 'look_feel' },
  { id: 'rose_alive', parent: 'look_feel' },

  { id: 'quick_actions', parent: 'phone_control' },
  { id: 'app_permissions', parent: 'phone_control' },
  { id: 'app_perm_camera', parent: 'app_permissions' },
  { id: 'app_perm_microphone', parent: 'app_permissions' },
  { id: 'app_perm_location', parent: 'app_permissions' },
  { id: 'app_perm_notifications', parent: 'app_permissions' },
  { id: 'app_perm_clipboard', parent: 'app_permissions' },
  { id: 'app_perm_contacts', parent: 'app_permissions' },
  { id: 'app_perm_phone_calls', parent: 'app_permissions' },
  { id: 'app_perm_whatsapp', parent: 'app_permissions' },
  { id: 'app_perm_messenger', parent: 'app_permissions' },
  { id: 'app_perm_youtube', parent: 'app_permissions' },
  { id: 'app_perm_facebook', parent: 'app_permissions' },
  { id: 'app_perm_tiktok', parent: 'app_permissions' },
  { id: 'app_perm_instagram', parent: 'app_permissions' },

  { id: 'pc_helper', parent: 'pc_setup' },
  { id: 'pc_control', parent: 'pc_setup' },
  { id: 'pc_files', parent: 'pc_setup' },
  { id: 'confirmations', parent: 'pc_setup' },
  { id: 'pc_history', parent: 'pc_setup' },
  { id: 'safety', parent: 'pc_setup' },
  { id: 'local_ai', parent: 'pc_setup' },
  { id: 'view_mode', parent: 'pc_setup' },
  { id: 'office_team', parent: 'pc_setup' },
  { id: 'system_status', parent: 'pc_setup' },
  { id: 'office_test', parent: 'pc_setup' },
  { id: 'office_layout', parent: 'pc_setup' },
];

const PAGE_TO_NAV_ID: Record<string, string> = {
  home: 'home',
  chat: 'chat',
  history: 'history',
  camera_toggle: 'camera_toggle',
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
  developer_tools: 'developer_tools',
  error_log: 'error_log',
  app_status: 'app_status',
  find_problems: 'find_problems',
  system_info: 'system_info',

  about_app: 'about_app',
  developer: 'developer',
  pricing: 'pricing',
  getting_started: 'getting_started',
  how_to_use: 'how_to_use',
  guidelines: 'guidelines',
  privacy: 'privacy',
  terms: 'terms',
  privacy_policy: 'privacy_policy',
  troubleshooting: 'troubleshooting',
  help_support: 'help_support',

  gemini_free: 'gemini_free',
  paid_model: 'paid_model',

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
  reduce_motion: 'reduce_motion',
  rose_alive: 'rose_alive',

  quick_actions: 'quick_actions',
  app_permissions: 'app_permissions',
  app_perm_camera: 'app_perm_camera',
  app_perm_microphone: 'app_perm_microphone',
  app_perm_location: 'app_perm_location',
  app_perm_notifications: 'app_perm_notifications',
  app_perm_clipboard: 'app_perm_clipboard',
  app_perm_contacts: 'app_perm_contacts',
  app_perm_phone_calls: 'app_perm_phone_calls',
  app_perm_whatsapp: 'app_perm_whatsapp',
  app_perm_messenger: 'app_perm_messenger',
  app_perm_youtube: 'app_perm_youtube',
  app_perm_facebook: 'app_perm_facebook',
  app_perm_tiktok: 'app_perm_tiktok',
  app_perm_instagram: 'app_perm_instagram',

  pc_helper: 'pc_helper',
  pc_control: 'pc_control',
  pc_files: 'pc_files',
  confirmations: 'confirmations',
  pc_history: 'pc_history',
  safety: 'safety',
  local_ai: 'local_ai',
  view_mode: 'view_mode',
  office_team: 'office_team',
  system_status: 'system_status',
  office_test: 'office_test',
  office_layout: 'office_layout',
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
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return p.id;
      }
    }
  }
  return 'home';
}

export function isPageVisible(id: string): boolean {
  if (typeof document === 'undefined') return false;
  if (id === 'home' || id === 'chat' || id === 'history') {
    const activeTabEl = document.querySelector(`[data-nav-id="${id}"]`);
    if (activeTabEl && currentPage() === id) return true;
  }
  const navId = PAGE_TO_NAV_ID[id] || id;
  const el = document.querySelector(`[data-nav-id="${navId}"]`);
  if (el) {
    const rect = (el as HTMLElement).getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return true;
  }
  const viewEl = document.querySelector(`[data-current-view="${id}"]`) || document.querySelector(`[data-current-view="${navId}"]`);
  if (viewEl) return true;
  return currentPage() === id;
}

export async function openPage(id: string): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  // 2) Call screen on top: minimize call screen at start of openPage and goBack
  const win = window as any;
  if (win.setIsCallMinimized) {
    win.setIsCallMinimized(true);
  }

  const pageDef = PAGES.find(p => p.id === id);
  if (!pageDef) return false;

  // Handle camera_toggle
  if (id === 'camera_toggle') {
    const camBtn = document.querySelector('[data-nav-id="camera_toggle"]') as HTMLElement;
    if (camBtn) {
      camBtn.click();
      return true;
    }
    return false;
  }

  // Handle main tabs: home, chat, history
  if (id === 'home' || id === 'chat' || id === 'history') {
    if (win.setActiveTab) {
      win.setActiveTab(id === 'chat' ? 'chat' : id === 'history' ? 'history' : 'home');
    }
    if (win.setCurrentView) {
      win.setCurrentView('home');
    }
    const tStart = Date.now();
    while (Date.now() - tStart < 1000) {
      if (isPageVisible(id)) return true;
      await new Promise(r => setTimeout(r, 50));
    }
    return isPageVisible(id);
  }

  // 1) Blank page fix:
  // (a) set bottom tab to SETTINGS exactly like tapping the SETTINGS button
  if (win.setCurrentView) {
    win.setCurrentView('settings');
  } else {
    const settingsBtn = document.querySelector('[data-nav-id="settings"]') as HTMLElement;
    if (settingsBtn) settingsBtn.click();
  }

  // (b) wait until the Settings main screen is rendered
  let settingsRendered = false;
  const sStart = Date.now();
  while (Date.now() - sStart < 1500) {
    if (document.querySelector('[data-nav-id="about"]') || document.querySelector('[data-nav-id="voice_language"]') || document.querySelector('[data-nav-id="connections"]')) {
      settingsRendered = true;
      break;
    }
    await new Promise(r => setTimeout(r, 50));
  }

  if (id === 'settings') {
    return isPageVisible('settings');
  }

  // (c) open the parent bar if needed, wait until rendered
  if (pageDef.parent && pageDef.parent !== 'settings') {
    const parentDef = PAGES.find(p => p.id === pageDef.parent);
    if (parentDef && !isPageVisible(parentDef.id)) {
      await openPage(parentDef.id);
      let parentRendered = false;
      const pStart = Date.now();
      while (Date.now() - pStart < 1500) {
        const pNavId = PAGE_TO_NAV_ID[parentDef.id] || parentDef.id;
        if (document.querySelector(`[data-nav-id="${pNavId}"]`) || isPageVisible(parentDef.id)) {
          parentRendered = true;
          break;
        }
        await new Promise(r => setTimeout(r, 50));
      }
    }
  }

  // (d) open the bar
  const navId = PAGE_TO_NAV_ID[id] || id;
  let targetEl = document.querySelector(`[data-nav-id="${navId}"]`) as HTMLElement;
  if (!targetEl) {
    targetEl = document.querySelector(`[data-current-view="${id}"]`) as HTMLElement;
  }

  if (targetEl) {
    targetEl.click();
  } else if (win.openSettingsPage) {
    win.openSettingsPage(id);
  } else if (win.setCurrentView) {
    win.setCurrentView(navId);
  }

  // Verify the page element is in the DOM before returning ok:true; otherwise return ok:false
  let verified = false;
  const vStart = Date.now();
  while (Date.now() - vStart < 1500) {
    if (isPageVisible(id)) {
      verified = true;
      break;
    }
    await new Promise(r => setTimeout(r, 50));
  }

  return verified;
}

export async function goBack(): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  // 2) Call screen on top: minimize call screen at start of openPage and goBack
  const win = window as any;
  if (win.setIsCallMinimized) {
    win.setIsCallMinimized(true);
  }

  const cur = currentPage();

  const backButtons = Array.from(document.querySelectorAll('[data-nav-id="back"]')) as HTMLElement[];
  const visibleBack = backButtons.find(el => {
    const rect = (el as HTMLElement).getBoundingClientRect();
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

export const ABOUT_GUIDE_LIST = [
  'about_app', 'developer', 'pricing', 'getting_started', 'how_to_use',
  'guidelines', 'privacy', 'troubleshooting', 'help_support'
];

export const CONNECTIONS_LIST = ['gemini_free', 'paid_model'];

export const VOICE_LANGUAGE_LIST = [
  'tts_model', 'assistant_name', 'your_name', 'personality',
  'affection', 'language', 'response_style', 'voice',
  'voice_model', 'voice_tuning', 'voice_check', 'mic_listening'
];

export const LOOK_FEEL_LIST = ['theme', 'orb_style', 'reduce_motion', 'rose_alive'];

export const PHONE_CONTROL_LIST = ['quick_actions', 'app_permissions'];

export const APP_PERMISSIONS_LIST = [
  'app_perm_camera',
  'app_perm_microphone',
  'app_perm_location',
  'app_perm_notifications',
  'app_perm_clipboard',
  'app_perm_contacts',
  'app_perm_phone_calls',
  'app_perm_whatsapp',
  'app_perm_messenger',
  'app_perm_youtube',
  'app_perm_facebook',
  'app_perm_tiktok',
  'app_perm_instagram',
];

export const PC_SETUP_LIST = [
  'pc_helper', 'pc_control', 'pc_files', 'confirmations', 'pc_history',
  'safety', 'local_ai', 'view_mode', 'office_team', 'system_status',
  'office_test', 'office_layout'
];

export async function openNumber(n: number): Promise<{ ok: boolean; page?: string }> {
  const cur = currentPage();
  let list = SETTINGS_MAIN_LIST;

  if (cur === 'about_guide') list = ABOUT_GUIDE_LIST;
  else if (cur === 'connections') list = CONNECTIONS_LIST;
  else if (cur === 'voice_language') list = VOICE_LANGUAGE_LIST;
  else if (cur === 'look_feel') list = LOOK_FEEL_LIST;
  else if (cur === 'phone_control') list = PHONE_CONTROL_LIST;
  else if (cur === 'app_permissions') list = APP_PERMISSIONS_LIST;
  else if (cur === 'pc_setup') list = PC_SETUP_LIST;
  else list = SETTINGS_MAIN_LIST;

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
