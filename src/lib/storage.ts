import { Preferences } from '@capacitor/preferences';

const isCapacitor = () => typeof window !== 'undefined' && (window as any).Capacitor?.isNative;

export const storage = {
  async set(key: string, value: string): Promise<void> {
    try {
      if (isCapacitor()) {
        await Preferences.set({ key, value });
      } else {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('Storage set error', e);
    }
  },

  async get(key: string): Promise<string | null> {
    try {
      if (isCapacitor()) {
        const { value } = await Preferences.get({ key });
        return value;
      } else {
        return localStorage.getItem(key);
      }
    } catch (e) {
      console.error('Storage get error', e);
      return null;
    }
  },

  async remove(key: string): Promise<void> {
    try {
      if (isCapacitor()) {
        await Preferences.remove({ key });
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.error('Storage remove error', e);
    }
  }
};
