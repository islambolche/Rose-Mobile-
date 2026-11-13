import { supabase } from "../lib/supabase";

export const PC_DEVICE_ID_KEY = "rose_pc_device_id";
export const PC_SECRET_KEY = "rose_pc_secret";
export const DEFAULT_PC_DEVICE_ID = "yousuf-laptop";

export type PcCommandStatus =
  | "pending"
  | "awaiting_confirm"
  | "approved"
  | "running"
  | "done"
  | "failed"
  | "rejected";

export interface PcDeviceRow {
  id: string;
  name?: string | null;
  last_seen?: string | number | null;
  info?: Record<string, any> | null;
  cpu_usage?: number;
  ram_usage?: number;
  battery?: number;
}

export interface PcCommandRow {
  id: string;
  device_id: string;
  action: string;
  args_json: string;
  ts: number;
  sig: string;
  approve_sig?: string | null;
  needs_confirm?: boolean | null;
  status: PcCommandStatus | string;
  result?: any;
  error?: string | null;
  source?: string | null;
  created_at?: string;
}

export function getPcDeviceId(): string {
  if (typeof window === "undefined") return DEFAULT_PC_DEVICE_ID;
  try {
    const val = (localStorage.getItem(PC_DEVICE_ID_KEY) || "").trim();
    return val || DEFAULT_PC_DEVICE_ID;
  } catch {
    return DEFAULT_PC_DEVICE_ID;
  }
}

export function setPcDeviceId(deviceId: string): void {
  if (typeof window === "undefined") return;
  try {
    const clean = deviceId.trim() || DEFAULT_PC_DEVICE_ID;
    localStorage.setItem(PC_DEVICE_ID_KEY, clean);
  } catch {}
}

export function getPcSecret(): string {
  if (typeof window === "undefined") return "";
  try {
    return (localStorage.getItem(PC_SECRET_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function setPcSecret(secret: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PC_SECRET_KEY, secret.trim());
  } catch {}
}

export async function sign(msg: string): Promise<string> {
  const secret = getPcSecret();
  if (!secret) {
    throw new Error("Secret বসাও (PC HELPER)");
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(msg));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeRow(row: any): PcCommandRow {
  if (!row) return row;
  let parsedResult = row.result;
  if (typeof parsedResult === "string") {
    try {
      parsedResult = JSON.parse(parsedResult);
    } catch {
      // keep raw string
    }
  }
  return {
    ...row,
    result: parsedResult,
  };
}

export async function sendPcCommand(
  action: string,
  args: Record<string, any> = {}
): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase সংযোগ নেই");
  }
  const secret = getPcSecret();
  if (!secret) {
    throw new Error("PC HELPER-এ Secret বসাও");
  }

  const device_id = getPcDeviceId();
  const id = crypto.randomUUID();
  const ts = Date.now();
  const args_json = JSON.stringify(args ?? {});
  const sig = await sign(`${id}|${device_id}|${action}|${args_json}|${ts}`);

  const { error } = await supabase.from("pc_commands").insert([
    {
      id,
      device_id,
      action,
      args_json,
      ts,
      sig,
      status: "pending",
      source: "mobile",
    },
  ]);

  if (error) {
    throw new Error(error.message || "কমান্ড পাঠানো যায়নি");
  }

  return id;
}

const TERMINAL_STATUSES = new Set([
  "done",
  "failed",
  "error",
  "rejected",
  "awaiting_confirm",
]);

export async function waitResult(
  id: string,
  timeoutMs: number = 30000,
  onProgress?: (row: PcCommandRow) => void
): Promise<PcCommandRow> {
  if (!supabase) {
    throw new Error("Supabase সংযোগ নেই");
  }
  const client = supabase;

  return new Promise<PcCommandRow>((resolve, reject) => {
    let settled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let channel: any = null;

    const cleanup = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
      if (channel) {
        try {
          client.removeChannel(channel);
        } catch {}
        channel = null;
      }
    };

    const handleRow = (rawRow: any) => {
      if (settled || !rawRow) return;
      const row = normalizeRow(rawRow);
      if (onProgress) {
        try {
          onProgress(row);
        } catch {}
      }
      if (TERMINAL_STATUSES.has(String(row.status))) {
        settled = true;
        cleanup();
        resolve(row);
      }
    };

    const pollOnce = async () => {
      if (settled) return;
      try {
        const { data, error } = await client
          .from("pc_commands")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (!error && data) {
          handleRow(data);
        }
      } catch {
        // ignore transient poll failure
      }
    };

    try {
      channel = client
        .channel(`pc_cmd_${id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "pc_commands",
            filter: `id=eq.${id}`,
          },
          (payload: any) => {
            if (payload?.new) {
              handleRow(payload.new);
            }
          }
        )
        .subscribe();
    } catch {
      // Realtime optional; 2s polling will resolve
    }

    // Check immediately and fallback poll every 2 seconds
    void pollOnce();
    pollTimer = setInterval(() => {
      void pollOnce();
    }, 2000);

    timeoutTimer = setTimeout(async () => {
      if (settled) return;
      await pollOnce();
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error("সময় শেষ — PC Helper থেকে কোনো উত্তর আসেনি"));
      }
    }, Math.max(1000, timeoutMs));
  });
}

export async function approve(id: string): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase সংযোগ নেই");
  }
  const approve_sig = await sign(`${id}|approve`);
  const { error } = await supabase
    .from("pc_commands")
    .update({
      approve_sig,
      status: "approved",
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Approve করা যায়নি");
  }
}

export async function reject(id: string): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase সংযোগ নেই");
  }
  const { error } = await supabase
    .from("pc_commands")
    .update({
      status: "rejected",
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Reject করা যায়নি");
  }
}

export function isLastSeenWithin45s(lastSeen?: string | number | null): boolean {
  if (lastSeen === null || lastSeen === undefined || lastSeen === "") return false;
  const ts =
    typeof lastSeen === "number" ? lastSeen : new Date(String(lastSeen)).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= 45000;
}

export async function getDeviceStatus(): Promise<{
  online: boolean;
  device: PcDeviceRow | null;
  error?: string;
}> {
  if (!supabase) {
    return { online: false, device: null, error: "Supabase সংযোগ নেই" };
  }
  const deviceId = getPcDeviceId();
  const { data, error } = await supabase
    .from("pc_devices")
    .select("*")
    .eq("id", deviceId)
    .maybeSingle();

  if (error) {
    return { online: false, device: null, error: error.message };
  }
  const device = (data as PcDeviceRow | null) || null;
  return {
    online: isLastSeenWithin45s(device?.last_seen),
    device,
  };
}

export async function isOnline(): Promise<boolean> {
  try {
    const res = await getDeviceStatus();
    return res.online;
  } catch {
    return false;
  }
}
