import { PAGES_REGISTRY } from './navRegistry';

export const MAIN_SETTINGS_ORDER = [
  'about', 'connections', 'live_voice_model', 'voice_language', 
  'chats_memory', 'look_feel', 'phone_control', 'pc_setup', 'privacy'
];

export const VOICE_SETTINGS_ORDER = [
  'tts_model', 'assistant_name', 'owner_name', 'personality', 
  'affection', 'language_page', 'response_style', 'voice_page', 
  'voice_model_list', 'voice_tuning', 'voice_check', 'mic_listening'
];

export async function navigateTo(ids: string[]): Promise<{ ok: boolean; missing?: string }> {
  if (typeof document === 'undefined') return { ok: false, missing: ids[0] };

  for (const id of ids) {
    if (id === 'back') {
      const res = await executeBack();
      if (!res.ok) return { ok: false, missing: 'back' };
      continue;
    }

    let el: HTMLElement | null = null;
    const startTime = Date.now();
    while (Date.now() - startTime < 1500) {
      el = document.querySelector(`[data-nav-id="${id}"]`) as HTMLElement;
      if (el) break;
      await new Promise(r => setTimeout(r, 100));
    }

    if (!el) {
      return { ok: false, missing: id };
    }

    el.click();
    await new Promise(r => setTimeout(r, 350));
  }
  return { ok: true };
}

export function getIdsForPageId(pageId: string): string[] {
  if (MAIN_SETTINGS_ORDER.includes(pageId)) {
    return ['settings', pageId];
  }
  if (VOICE_SETTINGS_ORDER.includes(pageId)) {
    return ['settings', 'voice_language', pageId];
  }
  if (['home', 'chat', 'history', 'settings'].includes(pageId)) {
    return [pageId];
  }
  return ['settings', pageId];
}

export function getCurrentViewOrState(): string {
  if (typeof document === 'undefined') return 'home';
  const viewEl = document.querySelector('[data-current-view]');
  if (viewEl) {
    const v = viewEl.getAttribute('data-current-view');
    if (v) return v;
  }
  return 'home';
}

export function getParentPageId(currentId: string): string {
  const aboutSub = ['about-app', 'privacy', 'developer', 'pricing', 'getting-started', 'how-to-use', 'guidelines', 'troubleshooting', 'help-support'];
  const voiceSub = VOICE_SETTINGS_ORDER;
  const lookSub = ['theme', 'orb', 'reduce_motion', 'rose_alive'];
  const phoneSub = ['quick_actions', 'app_permissions'];
  const pcSub = ['pc_helper', 'pc_control', 'pc_files', 'confirmations', 'pc_history', 'safety', 'local_ai', 'view_mode', 'office_team', 'system_status', 'office_test', 'office_layout'];

  if (aboutSub.includes(currentId)) return 'about';
  if (voiceSub.includes(currentId)) return 'voice_language';
  if (lookSub.includes(currentId)) return 'look_feel';
  if (phoneSub.includes(currentId)) return 'phone_control';
  if (pcSub.includes(currentId)) return 'pc_setup';
  if (MAIN_SETTINGS_ORDER.includes(currentId)) return 'settings';
  if (currentId === 'settings' || currentId === 'chat' || currentId === 'history' || currentId === 'about' || currentId === 'connections' || currentId === 'live_voice_model' || currentId === 'voice_language' || currentId === 'chats_memory' || currentId === 'look_feel' || currentId === 'phone_control' || currentId === 'pc_setup' || currentId === 'privacy') {
    return 'settings';
  }
  return 'home';
}

export async function executeBack(): Promise<{ ok: boolean }> {
  if (typeof document === 'undefined') return { ok: false };

  const startState = getCurrentViewOrState();

  // 1. Try clicking a visible [data-nav-id="back"] button
  const backButtons = Array.from(document.querySelectorAll('[data-nav-id="back"]')) as HTMLElement[];
  const visibleBack = backButtons.find(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
  });

  if (visibleBack) {
    visibleBack.click();
    await new Promise(r => setTimeout(r, 400));
    const endState = getCurrentViewOrState();
    if (endState !== startState) {
      return { ok: true };
    }
  }

  // 2. If no button or state didn't change, navigate to parent page
  const parentId = getParentPageId(startState);
  if (parentId && parentId !== startState) {
    if (parentId === 'settings') {
      const setBtn = document.querySelector('[data-nav-id="settings"]') || document.querySelector('button[aria-label="Back"]');
      if (setBtn) {
        (setBtn as HTMLElement).click();
        await new Promise(r => setTimeout(r, 300));
        return { ok: true };
      }
    }
    const res = await navigateTo([parentId]);
    const finalState = getCurrentViewOrState();
    if (res.ok || finalState !== startState) {
      return { ok: true };
    }
  }

  // Fallback to home if on main tab/settings
  if (startState !== 'home') {
    const homeBtn = document.querySelector('[data-nav-id="home"]') as HTMLElement;
    if (homeBtn) {
      homeBtn.click();
      await new Promise(r => setTimeout(r, 300));
      return { ok: true };
    }
  }

  return { ok: false };
}
