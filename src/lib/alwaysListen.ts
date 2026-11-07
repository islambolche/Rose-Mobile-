import { registerPlugin } from '@capacitor/core';

export interface AlwaysListenPlugin {
  start(): Promise<{ started?: boolean }>;
  stop(): Promise<{ stopped?: boolean }>;
  isRunning(): Promise<{ running?: boolean }>;
  requestBatteryOptimizationExemption(): Promise<{ requested?: boolean }>;
}

const isNative = () => {
  const cap = (window as any).Capacitor;
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
};

const AlwaysListenNative = registerPlugin<AlwaysListenPlugin>('AlwaysListen');

export const AlwaysListen: AlwaysListenPlugin = {
  start: async () => {
    if (!isNative()) return { started: false };
    try {
      return await AlwaysListenNative.start();
    } catch (e) {
      return { started: false };
    }
  },
  stop: async () => {
    if (!isNative()) return { stopped: false };
    try {
      return await AlwaysListenNative.stop();
    } catch (e) {
      return { stopped: false };
    }
  },
  isRunning: async () => {
    if (!isNative()) return { running: false };
    try {
      return await AlwaysListenNative.isRunning();
    } catch (e) {
      return { running: false };
    }
  },
  requestBatteryOptimizationExemption: async () => {
    if (!isNative()) return { requested: false };
    try {
      return await AlwaysListenNative.requestBatteryOptimizationExemption();
    } catch (e) {
      return { requested: false };
    }
  },
};
