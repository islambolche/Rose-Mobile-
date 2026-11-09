import { getGlobalMicStream, stopGlobalMicStream } from "./audio-manager";
export type PermissionStatus =
  | "Allowed"
  | "Skipped"
  | "Needs Android app"
  | "granted"
  | "denied"
  | "prompt"
  | "unsupported";

export const PERMISSION_NAMES = [
  "microphone",
  "camera",
  "location",
  "notifications",
  "clipboard",
  "wake",
  "contacts",
  "phoneCalls",
  "notificationAccess",
] as const;

export type PermissionName = typeof PERMISSION_NAMES[number];

export function isAllowed(name: string): boolean {
  return localStorage.getItem(`perm_${name}`) === "true";
}

export function setAllowed(name: string, allowed: boolean | string) {
  if (typeof allowed === "boolean") {
    localStorage.setItem(`perm_${name}`, allowed ? "true" : "false");
  } else {
    localStorage.setItem(`perm_${name}`, allowed);
  }
}

export function hasContactsApi(): boolean {
  return typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;
}

export function getSavedContactsCount(): number {
  try {
    const raw = localStorage.getItem("iyabd_saved_contacts");
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.length;
    }
  } catch (e) {}
  return 0;
}

export function getSavedContacts(): Array<{ name: string; tel: string }> {
  try {
    const raw = localStorage.getItem("iyabd_saved_contacts");
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) {}
  return [];
}

export function saveContactsFromPicker(selected: any[]): number {
  if (!Array.isArray(selected)) return getSavedContactsCount();
  const current = getSavedContacts();
  const normalized = selected.map((c: any) => ({
    name: Array.isArray(c.name) ? String(c.name[0] || "") : String(c.name || ""),
    tel: Array.isArray(c.tel) ? String(c.tel[0] || "") : String(c.tel || ""),
  })).filter((c) => c.name || c.tel);

  const merged = [...current];
  normalized.forEach((n) => {
    const idx = merged.findIndex((m) => m.name.toLowerCase() === n.name.toLowerCase());
    if (idx >= 0) {
      merged[idx] = n;
    } else {
      merged.push(n);
    }
  });

  try {
    localStorage.setItem("iyabd_saved_contacts", JSON.stringify(merged));
    savePermissionToMap("contacts", merged.length > 0 ? "Allowed" : "Off");
  } catch (e) {}
  return merged.length;
}

export function savePermissionToMap(id: string, status: string) {
  try {
    const raw = localStorage.getItem("iyabd_permissions_list_v5");
    const map = raw ? JSON.parse(raw) : {};
    map[id] = status;
    localStorage.setItem("iyabd_permissions_list_v5", JSON.stringify(map));
  } catch (e) {}
}

export const ANDROID_ONLY_IDS = [
  "notificationAccess",
  "headphones",
  "sms",
  "mediaFiles",
  "displayOverApps",
  "dndAccess",
  "modifySettings",
  "accessibility",
  "batteryOpt",
] as const;

export function getStoredPermissionStatus(id: string): "Allowed" | "Skipped" | "Needs Android app" | "prompt" {
  if (id === "phoneCalls") {
    return "Allowed";
  }

  if (id === "contacts") {
    if (!hasContactsApi()) {
      const isAndroid = typeof window !== "undefined" && Boolean((window as any).AndroidIYABD);
      if (!isAndroid) return "Needs Android app";
    } else {
      const count = getSavedContactsCount();
      return count > 0 ? "Allowed" : "prompt";
    }
  }

  if (ANDROID_ONLY_IDS.includes(id as any)) {
    const isAndroid = typeof window !== "undefined" && Boolean((window as any).AndroidIYABD);
    if (!isAndroid) return "Needs Android app";
  }

  try {
    const raw = localStorage.getItem("iyabd_permissions_list_v5");
    if (raw) {
      const map = JSON.parse(raw);
      if (map[id] === "Allowed" || map[id] === "Granted" || map[id] === "Ready") return "Allowed";
      if (map[id] === "Skipped" || map[id] === "Denied") return "Skipped";
      if (map[id] === "Needs Android app") return "Needs Android app";
    }
  } catch (e) {}

  if (id === "microphone") {
    const perm = localStorage.getItem("perm_microphone");
    if (perm === "true") return "Allowed";
    if (perm === "false") return "Skipped";
  }

  if (id === "notifications") {
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "granted") return "Allowed";
      if (Notification.permission === "denied") return "Skipped";
    }
    const perm = localStorage.getItem("perm_notifications");
    if (perm === "true") return "Allowed";
    if (perm === "false") return "Skipped";
  }

  return "prompt";
}

export async function checkMicrophone(): Promise<"Allowed" | "Skipped" | "prompt"> {
  if (typeof window === "undefined" || !navigator.mediaDevices) {
    return isAllowed("microphone") ? "Allowed" : "prompt";
  }
  const stored = getStoredPermissionStatus("microphone");
  if (stored === "Allowed" || stored === "Skipped") return stored;

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const res = await navigator.permissions.query({ name: "microphone" as any });
      if (res.state === "granted") {
        setAllowed("microphone", true);
        savePermissionToMap("microphone", "Allowed");
        return "Allowed";
      }
      if (res.state === "denied") {
        setAllowed("microphone", false);
        savePermissionToMap("microphone", "Skipped");
        return "Skipped";
      }
    } catch (e) {}
  }
  return "prompt";
}

export async function checkNotifications(): Promise<"Allowed" | "Skipped" | "prompt"> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "Skipped";
  }
  if (Notification.permission === "granted") {
    setAllowed("notifications", true);
    savePermissionToMap("notifications", "Allowed");
    return "Allowed";
  }
  if (Notification.permission === "denied") {
    setAllowed("notifications", false);
    savePermissionToMap("notifications", "Skipped");
    return "Skipped";
  }
  const stored = getStoredPermissionStatus("notifications");
  if (stored === "Allowed" || stored === "Skipped") return stored;
  return "prompt";
}

export async function checkContacts(): Promise<string> {
  if (hasContactsApi()) {
    const count = getSavedContactsCount();
    return count > 0 ? `${count} contacts saved` : "prompt";
  }
  savePermissionToMap("contacts", "Needs Android app");
  return "Needs Android app";
}

export async function checkPhoneCalls(): Promise<"READY (opens dialer)"> {
  savePermissionToMap("phoneCalls", "Allowed");
  return "READY (opens dialer)";
}

export async function requestMicrophoneWithTimeout(timeoutMs: number = 8000): Promise<"Allowed" | "Skipped"> {
  try {
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setAllowed("microphone", false);
      savePermissionToMap("microphone", "Skipped");
      return "Skipped";
    }

    const streamPromise = getGlobalMicStream({ audio: true });
    const timeoutPromise = new Promise<MediaStream>((_, reject) =>
      setTimeout(() => reject(new Error("Microphone request timed out (8s)")), timeoutMs)
    );

    const stream = await Promise.race([streamPromise, timeoutPromise]);
    try {
      stopGlobalMicStream();
    } catch (e) {}

    setAllowed("microphone", true);
    savePermissionToMap("microphone", "Allowed");
    return "Allowed";
  } catch (err) {
    setAllowed("microphone", false);
    savePermissionToMap("microphone", "Skipped");
    return "Skipped";
  }
}

export async function requestNotificationsWithTimeout(timeoutMs: number = 8000): Promise<"Allowed" | "Skipped"> {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setAllowed("notifications", false);
      savePermissionToMap("notifications", "Skipped");
      return "Skipped";
    }

    if (Notification.permission === "granted") {
      setAllowed("notifications", true);
      savePermissionToMap("notifications", "Allowed");
      return "Allowed";
    }
    if (Notification.permission === "denied") {
      setAllowed("notifications", false);
      savePermissionToMap("notifications", "Skipped");
      return "Skipped";
    }

    const reqPromise = Notification.requestPermission();
    const timeoutPromise = new Promise<NotificationPermission>((_, reject) =>
      setTimeout(() => reject(new Error("Notification request timed out (8s)")), timeoutMs)
    );

    const res = await Promise.race([reqPromise, timeoutPromise]);
    const isGranted = res === "granted";
    setAllowed("notifications", isGranted);
    savePermissionToMap("notifications", isGranted ? "Allowed" : "Skipped");
    return isGranted ? "Allowed" : "Skipped";
  } catch (err) {
    setAllowed("notifications", false);
    savePermissionToMap("notifications", "Skipped");
    return "Skipped";
  }
}

export async function requestMicrophone(): Promise<"Allowed" | "Skipped"> {
  return requestMicrophoneWithTimeout(8000);
}

export async function requestNotifications(): Promise<"Allowed" | "Skipped"> {
  return requestNotificationsWithTimeout(8000);
}

export async function requestContacts(): Promise<string> {
  if (hasContactsApi()) {
    try {
      const selected = await (navigator as any).contacts.select(["name", "tel"], { multiple: true });
      if (selected && selected.length > 0) {
        const count = saveContactsFromPicker(selected);
        return `${count} contacts saved`;
      }
    } catch (e) {}
    const count = getSavedContactsCount();
    return count > 0 ? `${count} contacts saved` : "prompt";
  }
  savePermissionToMap("contacts", "Needs Android app");
  return "Needs Android app";
}

export async function requestPhoneCalls(): Promise<"READY (opens dialer)"> {
  savePermissionToMap("phoneCalls", "Allowed");
  return "READY (opens dialer)";
}

export async function requestCameraWithTimeout(timeoutMs: number = 8000): Promise<"Allowed" | "Skipped"> {
  try {
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setAllowed("camera", false);
      savePermissionToMap("camera", "Skipped");
      return "Skipped";
    }

    const streamPromise = navigator.mediaDevices.getUserMedia({ video: true });
    const timeoutPromise = new Promise<MediaStream>((_, reject) =>
      setTimeout(() => reject(new Error("Camera request timed out")), timeoutMs)
    );

    const stream = await Promise.race([streamPromise, timeoutPromise]);
    try {
      stopGlobalMicStream();
    } catch (e) {}

    setAllowed("camera", true);
    savePermissionToMap("camera", "Allowed");
    return "Allowed";
  } catch (err) {
    setAllowed("camera", false);
    savePermissionToMap("camera", "Skipped");
    return "Skipped";
  }
}

export async function requestLocationWithTimeout(timeoutMs: number = 8000): Promise<"Allowed" | "Skipped"> {
  try {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setAllowed("location", false);
      savePermissionToMap("location", "Skipped");
      return "Skipped";
    }

    const geoPromise = new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: timeoutMs });
    });
    const timeoutPromise = new Promise<GeolocationPosition>((_, reject) =>
      setTimeout(() => reject(new Error("Location request timed out")), timeoutMs)
    );

    await Promise.race([geoPromise, timeoutPromise]);
    setAllowed("location", true);
    savePermissionToMap("location", "Allowed");
    return "Allowed";
  } catch (err) {
    setAllowed("location", false);
    savePermissionToMap("location", "Skipped");
    return "Skipped";
  }
}

