import { supabase } from "./supabase";

export interface PcCommandArgs {
  name?: string;
  url?: string;
  path?: string;
  query?: string;
  root?: string;
  text?: string;
  keys?: string[];
  x?: number;
  y?: number;
  key?: "volume_up" | "volume_down" | "mute" | "play_pause" | "next" | "prev";
  times?: number;
  cmd?: string;
  prompt?: string;
  [key: string]: any;
}

export interface PcCommandRecord {
  id: string;
  device_id: string;
  action: string;
  args_json: string;
  ts: number;
  sig: string;
  source: "mobile" | "pc";
  status: "pending" | "awaiting_confirm" | "approved" | "rejected" | "done" | "error";
  result?: any;
  error?: string;
  approve_sig?: string;
  created_at?: string;
}

export interface PcDeviceRecord {
  id: string;
  name?: string;
  status?: string;
  last_seen?: number | string;
  cpu_usage?: number;
  ram_usage?: number;
  battery?: number;
  system_info?: any;
  updated_at?: string;
}

export const PC_SECRET_STORAGE_KEY = "pc_helper_secret";
export const PC_DEVICE_ID_STORAGE_KEY = "pc_helper_device_id";

export function getStoredPcSecret(): string {
  if (typeof window === "undefined") return "";
  return (localStorage.getItem(PC_SECRET_STORAGE_KEY) || "").trim();
}

export function setStoredPcSecret(secret: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PC_SECRET_STORAGE_KEY, secret.trim());
}

export function getStoredDeviceId(): string {
  if (typeof window === "undefined") return "default_pc";
  return (localStorage.getItem(PC_DEVICE_ID_STORAGE_KEY) || "default_pc").trim();
}

export function setStoredDeviceId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PC_DEVICE_ID_STORAGE_KEY, id.trim());
}

/**
 * Calculates HMAC-SHA256 signature formatted as a lowercase hex string using Web Crypto API.
 */
export async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  if (!secret) return "";
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (err) {
    console.error("[pcCommand] HMAC-SHA256 error:", err);
    return "";
  }
}

/**
 * Main function to send a command to the PC helper app via Supabase pc_commands table
 */
export async function sendPcCommand(
  action: string,
  args: PcCommandArgs = {},
  options: {
    source?: "mobile" | "pc";
    onToast?: (message: string) => void;
  } = {}
): Promise<{ success: boolean; status: string; result?: any; error?: string; message: string }> {
  const secret = getStoredPcSecret();
  if (!secret) {
    const errorMsg = "PC HELPER-এ secret বসাও";
    if (options.onToast) options.onToast(errorMsg);
    return { success: false, status: "error", error: errorMsg, message: errorMsg };
  }

  const deviceId = getStoredDeviceId();
  const id = crypto.randomUUID();
  const ts = Date.now();
  const argsJson = JSON.stringify(args || {});

  // Signature calculation: HMAC_SHA256(secret, `${id}|${deviceId}|${action}|${argsJson}|${ts}`)
  const signatureData = `${id}|${deviceId}|${action}|${argsJson}|${ts}`;
  const sig = await hmacSha256Hex(secret, signatureData);

  const source = options.source || (typeof window !== "undefined" && window.innerWidth >= 1024 ? "pc" : "mobile");

  const newRecord: Partial<PcCommandRecord> = {
    id,
    device_id: deviceId,
    action,
    args_json: argsJson,
    ts,
    sig,
    source,
    status: "pending",
  };

  if (!supabase) {
    const msg = "Supabase সংযোগ নেই";
    if (options.onToast) options.onToast(msg);
    return { success: false, status: "error", error: msg, message: msg };
  }

  try {
    const { error: insertError } = await supabase.from("pc_commands").insert([newRecord]);
    if (insertError) {
      console.error("[sendPcCommand] Insert error:", insertError.message);
      const msg = `কমান্ড পাঠাতে সমস্যা: ${insertError.message}`;
      if (options.onToast) options.onToast(msg);
      return { success: false, status: "error", error: insertError.message, message: msg };
    }

    if (options.onToast) {
      options.onToast(`কমান্ড পাঠানো হয়েছে: ${action}`);
    }

    // Wait for command execution or status update via realtime / polling (timeout 12s)
    const startTime = Date.now();
    while (Date.now() - startTime < 12000) {
      await new Promise((res) => setTimeout(res, 600));
      const { data, error } = await supabase
        .from("pc_commands")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) {
        if (data.status === "done") {
          let parsedResult = data.result;
          if (typeof parsedResult === "string") {
            try {
              parsedResult = JSON.parse(parsedResult);
            } catch (e) {}
          }
          return {
            success: true,
            status: "done",
            result: parsedResult,
            message: `কমান্ড সম্পন্ন: ${data.action}`,
          };
        } else if (data.status === "error") {
          return {
            success: false,
            status: "error",
            error: data.error || "Execution failed",
            message: `ত্রুটি: ${data.error || "কাজ সম্পন্ন হয়নি"}`,
          };
        } else if (data.status === "awaiting_confirm") {
          return {
            success: false,
            status: "awaiting_confirm",
            message: "ফোনে অনুমতি দাও (Awaiting confirmation)",
          };
        } else if (data.status === "rejected") {
          return {
            success: false,
            status: "rejected",
            message: "কমান্ড বাতিল করা হয়েছে",
          };
        }
      }
    }

    return {
      success: true,
      status: "pending",
      message: "কমান্ড পাঠানো হয়েছে (PC রেসপন্সের অপেক্ষায়...)",
    };
  } catch (err: any) {
    console.error("[sendPcCommand] Exception:", err);
    return {
      success: false,
      status: "error",
      error: err?.message || "Unknown error",
      message: "কমান্ড পাঠাতে গিয়ে ত্রুটি হয়েছে",
    };
  }
}

/**
 * Approve an awaiting command
 */
export async function approvePcCommand(commandId: string): Promise<boolean> {
  if (!supabase) return false;
  const secret = getStoredPcSecret();
  const approveSig = await hmacSha256Hex(secret, `${commandId}|approve`);

  const { error } = await supabase
    .from("pc_commands")
    .update({
      status: "approved",
      approve_sig: approveSig,
    })
    .eq("id", commandId);

  return !error;
}

/**
 * Reject an awaiting command
 */
export async function rejectPcCommand(commandId: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from("pc_commands")
    .update({
      status: "rejected",
    })
    .eq("id", commandId);

  return !error;
}

export const PC_COMMAND_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "pc_command",
        description: "Send a remote control command to the user's connected PC (apps, volume, lock, files, power, etc.).",
        parameters: {
          type: "OBJECT",
          properties: {
            action: {
              type: "STRING",
              description: "Action name: ping, open_app, open_url, open_path, list_dir, search_files, screenshot, type_text, hotkey, click, media, lock, shutdown, restart, cancel_shutdown, run_shell, ask_local_ai",
            },
            args: {
              type: "OBJECT",
              description: "Arguments for the command e.g. { name: 'chrome' }, { url: 'https://...' }, { key: 'volume_up' }, { path: 'C:/...' }",
            },
          },
          required: ["action"],
        },
      },
    ],
  },
];
