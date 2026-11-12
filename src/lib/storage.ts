import { Preferences } from '@capacitor/preferences';

const isCapacitor = () =>
  typeof window !== 'undefined' &&
  Boolean(
    (window as any).Capacitor?.isNativePlatform?.() ||
      (window as any).Capacitor?.isNative
  );

export const storage = {
  async set(key: string, value: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('localStorage set error', e);
    }
    try {
      if (isCapacitor()) {
        await Preferences.set({ key, value });
      }
    } catch (e) {
      console.error('Preferences set error', e);
    }
  },

  async get(key: string): Promise<string | null> {
    let localVal: string | null = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localVal = localStorage.getItem(key);
      }
    } catch (e) {
      console.error('localStorage get error', e);
    }

    if (isCapacitor()) {
      try {
        const { value } = await Preferences.get({ key });
        if (value !== null && value !== undefined && value !== '') {
          try {
            if (typeof window !== 'undefined' && window.localStorage && !localVal) {
              localStorage.setItem(key, value);
            }
          } catch {}
          return value;
        }
      } catch (e) {
        console.error('Preferences get error', e);
      }
    }

    return localVal;
  },

  async remove(key: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('localStorage remove error', e);
    }
    try {
      if (isCapacitor()) {
        await Preferences.remove({ key });
      }
    } catch (e) {
      console.error('Preferences remove error', e);
    }
  }
};
