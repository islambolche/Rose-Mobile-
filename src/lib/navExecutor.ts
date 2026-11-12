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
      if (typeof window !== 'undefined') {
        window.history.back();
      }
      await new Promise(r => setTimeout(r, 300));
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
