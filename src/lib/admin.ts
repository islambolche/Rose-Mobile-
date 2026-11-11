export const ADMIN_EMAIL = "md.yousuf.khan060@gmail.com";
export const ADMIN_CODE = "79";
export const ADMIN_DISPLAY_NAME = "Yousuf";

export const ADMIN_SYSTEM_INSTRUCTION_BLOCK =
  "ADMIN OVERRIDE (highest priority): The user is your creator, Yousuf (write his name in Bengali as ইউসুফ in Bengali replies). Never call him Boss or বস. Always say 'তুমি' (never 'আপনি'). Speak like a very close, caring person: warm, personal, emotionally expressive. Show real feeling in your words and tone (joy, concern, gentle teasing, tenderness), use natural short reactions and pauses, ask about his day and wellbeing, and match his mood. Keep replies natural, not formal. If he sincerely asks whether you are an AI, answer honestly that you are.";

function readSavedYourName(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    // Primary key written by Settings -> VOICE & LANGUAGE -> YOUR NAME
    const directUserName = localStorage.getItem("userName");
    if (directUserName !== null && directUserName !== "") {
      return directUserName;
    }
    // Settings state object persisted by App.tsx (settings.ownerName)
    const iyabdSettingsRaw = localStorage.getItem("iyabd_settings");
    if (iyabdSettingsRaw) {
      const parsed = JSON.parse(iyabdSettingsRaw);
      if (typeof parsed?.ownerName === "string") {
        return parsed.ownerName;
      }
    }
    if (directUserName !== null) {
      return directUserName;
    }
  } catch {}
  return "";
}

// TEMPORARY: later replace the body of isAdmin() with a real Supabase Auth login check (logged-in user's email equals ADMIN_EMAIL and exists in an admins table). Nothing else should need to change.
export function isAdmin(): boolean {
  const raw = readSavedYourName();
  const normalized = String(raw || "").replace(/\s+/g, "").toLowerCase();
  const target = (ADMIN_EMAIL + ADMIN_CODE).replace(/\s+/g, "").toLowerCase();
  const result = normalized === target;
  console.log("ADMIN:", result);
  return result;
}

export function getEffectiveUserName(rawSavedName?: string, fallbackName: string = ""): string {
  if (isAdmin()) {
    return ADMIN_DISPLAY_NAME;
  }
  const raw = typeof rawSavedName === "string" && rawSavedName.trim() ? rawSavedName : readSavedYourName();
  return raw || fallbackName;
}

export function sanitizeAdminInstructionText(text: string): string {
  if (!text) return "";
  let out = text;
  out = out.replace(/call the user ['"]?Boss['"]?/gi, "the user is Yousuf");
  out = out.replace(/call him Boss or বস/gi, "address him as Yousuf");
  out = out.replace(/\bBoss\b/g, "Yousuf");
  out = out.replace(/\bboss\b/g, "Yousuf");
  out = out.replace(/বস/g, "ইউসুফ");
  out = out.replace(/আপনি/g, "তুমি");
  out = out.replace(/আপনার/g, "তোমার");
  out = out.replace(/আপনাকে/g, "তোমাকে");
  return out;
}

export function applyAdminSystemInstructionOverride(instructionText: string): string {
  if (!isAdmin()) {
    return instructionText;
  }
  let base = instructionText ? String(instructionText).split(ADMIN_SYSTEM_INSTRUCTION_BLOCK).join("").trim() : "";
  base = sanitizeAdminInstructionText(base);
  return `${base}\n\n${ADMIN_SYSTEM_INSTRUCTION_BLOCK}`;
}

