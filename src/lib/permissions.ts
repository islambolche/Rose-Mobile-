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

export function savePermissionToMap(id: string, status: "Allowed" | "Skipped" | "Needs Android app" | "Off") {
  try {
    const raw = localStorage.getItem("iyabd_permissions_list_v5");
    const map = raw ? JSON.parse(raw) : {};
    map[id] = status;
    localStorage.setItem("iyabd_permissions_list_v5", JSON.stringify(map));
  } catch (e) {}
}

export const ANDROID_ONLY_IDS = [
  "contacts",
  "phoneCalls",
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
  if (ANDROID_ONLY_IDS.includes(id as any)) {
    const isAndroid = typeof window !== "undefined" && Boolean((window as any).AndroidIYABD);
    if (!isAndroid) return "Needs Android app";
  }

  try {
    const raw = localStorage.getItem("iyabd_permissions_list_v5");
    if (raw) {
      const map = JSON.parse(raw);
      if (map[id] === "Allowed" || map[id] === "Granted") return "Allowed";
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

export async function checkContacts(): Promise<"Needs Android app"> {
  savePermissionToMap("contacts", "Needs Android app");
  return "Needs Android app";
}

export async function checkPhoneCalls(): Promise<"Needs Android app"> {
  savePermissionToMap("phoneCalls", "Needs Android app");
  return "Needs Android app";
}

export async function requestMicrophoneWithTimeout(timeoutMs: number = 8000): Promise<"Allowed" | "Skipped"> {
  try {
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setAllowed("microphone", false);
      savePermissionToMap("microphone", "Skipped");
      return "Skipped";
    }

    const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });
    const timeoutPromise = new Promise<MediaStream>((_, reject) =>
      setTimeout(() => reject(new Error("Microphone request timed out (8s)")), timeoutMs)
    );

    const stream = await Promise.race([streamPromise, timeoutPromise]);
    try {
      stream.getTracks().forEach((t) => t.stop());
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

export async function requestContacts(): Promise<"Needs Android app"> {
  savePermissionToMap("contacts", "Needs Android app");
  return "Needs Android app";
}

export async function requestPhoneCalls(): Promise<"Needs Android app"> {
  savePermissionToMap("phoneCalls", "Needs Android app");
  return "Needs Android app";
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
      stream.getTracks().forEach((t) => t.stop());
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

