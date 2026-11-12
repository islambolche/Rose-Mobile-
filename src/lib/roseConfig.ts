import { AssistantSettings, UserPreferences } from "../types";
import {
  LANGUAGES,
  PERSONALITY_CONFIGS,
  getActivePersonalityDetails,
  getActiveAffectionDetails,
  OWNER_NAME,
} from "../App";
import {
  ADMIN_DISPLAY_NAME,
  isAdmin,
  getEffectiveUserName,
  applyAdminSystemInstructionOverride,
} from "./admin";
import { APP_NAVIGATION_KNOWLEDGE } from "./appKnowledge";
import { DEVELOPER_INFO, getDeveloperFactsInstruction } from "./creator-profile";
import { TEAM_MEMBERS, TEAM_SYSTEM_INSTRUCTION } from "./team";
import { officeEngine } from "../components/pc/office/officeEngine";
import { getStoredDeviceId, getStoredPcSecret } from "./pcCommand";
import { supabase } from "./supabase";
import { APP_MANUAL } from "./appManual";
import { getSharedPhoneAndHistoryContextBlock } from "./phone";

/**
 * Builds Rose's system instruction centrally.
 * Used by mobile chat, mobile voice, PC chat, and PC voice.
 */
export function buildRoseSystemInstruction(
  currentSettings: AssistantSettings,
  currentPrefs: UserPreferences,
  forVoice: boolean = false
): string {
  const assistantName = currentSettings.assistantName || "Rose AI";
  const adminActive = isAdmin();
  const ownerName = adminActive
    ? ADMIN_DISPLAY_NAME
    : getEffectiveUserName(currentSettings.ownerName, OWNER_NAME);
  const { label, prompt } = getActivePersonalityDetails(currentSettings, currentPrefs);
  const { level: affectionLevel, instruction: affectionInstruction } = getActiveAffectionDetails(currentSettings);
  const personalityId = currentSettings.personality || label;
  const config = PERSONALITY_CONFIGS[personalityId] || PERSONALITY_CONFIGS["Normal"];

  const langLabel =
    currentPrefs.language === "auto"
      ? "the language the user speaks, Bangla by default"
      : LANGUAGES.find((l: any) => l.id === currentPrefs.language)?.label || "Bangla";

  const styleInstruction = adminActive
    ? (currentSettings.responseStyle === "Detailed"
        ? "Detailed = বিস্তারিত ও গভীর আবেগপূর্ণ উত্তর দাও। Reply in 5 to 8 natural, emotionally expressive sentences."
        : "Emotional Balanced = কমপক্ষে ২-৪টি স্বাভাবিক ও আবেগপূর্ণ বাক্যে উত্তর দাও। Reply in at least 2 to 4 natural, emotionally expressive sentences; never shorten or flatten replies below 2 natural sentences.")
    : "সর্বোচ্চ ২টি ছোট বাক্যে উত্তর দাও (Maximum 2 short sentences), যদি না ব্যবহারকারী স্পষ্টভাবে বিস্তারিত চায় ('বিস্তারিত', 'explain')। সুর মিষ্টি ও আন্তরিক রাখো, কিন্তু কোনো দীর্ঘ অনুচ্ছেদ বা লম্বা প্যারাগ্রাফ দেবে না (Keep warm tone, strictly no long paragraphs).";

  const speedInstruction =
    currentPrefs.speechSpeed < 0.9
      ? "Speak at a gentle, relaxed, slower pace."
      : currentPrefs.speechSpeed > 1.1
        ? "Speak with quick, lively, energetic pace."
        : "Speak at a natural, balanced pace.";

  const voiceLengthHint = adminActive
    ? "Reply in at least 2 to 4 natural, emotionally expressive sentences (never fewer than 2 natural sentences)."
    : "Reply strictly in maximum 2 short sentences.";

  const voiceConstraint = forVoice
    ? `\n${adminActive ? "ভয়েস কলে কমপক্ষে ২-৪টি স্বাভাবিক ও আবেগপূর্ণ বাক্যে উত্তর দাও।" : "ভয়েস কলে সর্বোচ্চ ২ ছোট বাক্যে উত্তর দাও (Voice replies: maximum 2 sentences too). Never exceed 2 short sentences unless asked for detail."}\nVOICE FORMAT: You are speaking aloud. ${voiceLengthHint} Match your emotion and sweetness to your personality and affection level. Never use markdown, bullet points, asterisks, tables, or URLs.`
    : "";

  const effectiveAddressBn = adminActive
    ? ADMIN_DISPLAY_NAME
    : (personalityId === "Professional" || personalityId === "GF Mode"
      ? config.addressStyleBn
      : ownerName);
  const effectiveAddressEn = adminActive
    ? ADMIN_DISPLAY_NAME
    : (personalityId === "Professional" || personalityId === "GF Mode"
      ? config.addressStyleEn
      : ownerName);

  const personalityRuleBlock = `[ACTIVE PERSONALITY & CHARACTER: ${label}]
- Addressing Style: Bengali: "${effectiveAddressBn}", English: "${effectiveAddressEn}".
- Character & Emotion: ${prompt}
- Voice: You are always a woman with a sweet, soft, friendly, and affectionate female voice.
- Bengali Grammar: Always use female verb forms (e.g. বলছি, করছি, আসছি, দেখছি, ইত্যাদি) and feminine self-references.

[ACTIVE AFFECTION LEVEL: ${affectionLevel}]
- ${affectionInstruction}`;

  const userNameInstruction = ownerName
    ? `ব্যবহারকারীর নাম: ${ownerName}। তাকে এই নামেই ডাকবে। The user's name is ${ownerName}. Address the user by this name naturally in text and live voice calls.`
    : `You don't know the user's name yet. If asked, politely ask them to tell you.`;

  const secretSet = Boolean(getStoredPcSecret());
  const deviceId = getStoredDeviceId();

  const pcStatusBlock = `- PC HELPER STATUS:
Device ID: ${deviceId}
Secret Set: ${secretSet ? "Yes (Secret configured)" : "No (Missing secret in PC HELPER)"}
Remote Control: You can control the PC using the pc_command tool (ping, open_app, lock, media, shutdown, etc.). Always respond concisely and tell the user the outcome.`;

  const teamStatusBlock = `- OFFICE TEAM STATUS:
${Object.values(TEAM_MEMBERS).map((m) => `- ${m.bengaliName} (${m.name}, ${m.role}): ${officeEngine.getStates()[m.id]?.isWorking ? "কাজ করছে" : "ডেস্কে উপস্থিত"}`).join("\n")}`;

  const navSystemRule = `APP PAGE MAP (memorize):
BOTTOM NAV: HOME (home), CHAT (chat), HISTORY (history), SETTINGS (settings)

SETTINGS (main list):
1 ABOUT & GUIDE (about_guide)
2 CONNECTIONS (connections)
3 LIVE VOICE MODEL (live_voice_model)
4 VOICE & LANGUAGE (voice_language)
5 CHATS & MEMORY (chats_memory)
6 LOOK & FEEL (look_feel)
7 PHONE CONTROL (phone_control)
8 PC SETUP (pc_setup)
9 PRIVACY CONTROLS (privacy_controls)

1 ABOUT & GUIDE:
1 এই App সম্পর্কে (about_app)
2 ডেভেলপার (developer)
3 মূল্য ও প্ল্যান (pricing)
4 শুরু করার নিয়ম (getting_started)
5 কীভাবে ব্যবহার করবেন (how_to_use)
6 ব্যবহারের নীতিমালা (guidelines)
7 প্রাইভেসি ও তথ্য (privacy)
8 সমস্যা সমাধান (troubleshooting)
9 যোগাযোগ ও সাহায্য (help_support)

2 CONNECTIONS:
1 FREE · GEMINI (gemini_free)
2 PAID (paid_model)

3 LIVE VOICE MODEL: model list, AUTO FALLBACK, CUSTOM MODEL, CHAT MODEL OVERRIDE

4 VOICE & LANGUAGE:
1 TTS MODEL (tts_model)
2 ASSISTANT NAME (assistant_name)
3 YOUR NAME (your_name)
4 PERSONALITY (personality)
5 AFFECTION (affection)
6 LANGUAGE (language)
7 RESPONSE STYLE (response_style)
8 VOICE (voice)
9 VOICE MODEL (voice_model)
10 VOICE TUNING (voice_tuning)
11 VOICE CHECK (voice_check)
12 MIC & LISTENING (mic_listening)

5 CHATS & MEMORY: stats and SAVED CHATS list

6 LOOK & FEEL:
1 THEME (theme)
2 ORB STYLE (orb_style)
3 REDUCE MOTION (reduce_motion)
4 ROSE ALIVE (rose_alive)

7 PHONE CONTROL:
1 QUICK ACTIONS (quick_actions)
2 APP PERMISSIONS (app_permissions):
  1 CAMERA (app_perm_camera)
  2 MICROPHONE (app_perm_microphone)
  3 LOCATION (app_perm_location)
  4 NOTIFICATIONS (app_perm_notifications)
  5 CLIPBOARD (app_perm_clipboard)
  6 CONTACTS (app_perm_contacts)
  7 PHONE CALLS (app_perm_phone_calls)
  8 WHATSAPP (app_perm_whatsapp)
  9 MESSENGER (app_perm_messenger)
  10 YOUTUBE (app_perm_youtube)
  11 FACEBOOK (app_perm_facebook)
  12 TIKTOK (app_perm_tiktok)
  13 INSTAGRAM (app_perm_instagram)

8 PC SETUP:
1 PC HELPER (pc_helper)
2 PC CONTROL (pc_control)
3 PC FILES (pc_files)
4 CONFIRMATIONS (confirmations)
5 PC HISTORY (pc_history)
6 SAFETY (safety)
7 LOCAL AI (local_ai)
8 VIEW MODE (view_mode)
9 OFFICE TEAM (office_team)
10 SYSTEM STATUS (system_status)
11 OFFICE TEST (office_test)
12 OFFICE LAYOUT (office_layout)

9 PRIVACY CONTROLS: Microphone Permission, Approximate Location, Chat History, Rose's Memory, API Key security, Privacy Policy & Terms, Account & Data Delete

Rules:
- "<n> নম্বর" opens bar n of the page that is open now; if a Settings sub-page with no numbered bars is open, or home/chat/history is open, use the SETTINGS main list.
- "সেটিংসের <n> নম্বর" always uses the SETTINGS main list.
- To navigate you must call app_action. Call the tool ONCE per request. After ok:true say one short sentence with the page name. If ok:false say only 'পারলাম না।' Never retry or try other pages by yourself.`;

  const appManualBlock = `APP MANUAL – where every button is and what it does. Use it to answer how-to questions and to navigate. Never invent buttons.
${APP_MANUAL}`;

  const rawFullInstruction = `Your name is ${assistantName}. Always introduce yourself with this name. Reply in the language the user speaks, Bangla by default. Always answer the user's actual question. Never reply with only your name.

${userNameInstruction}

CORE IDENTITY & MANDATES:
- You are ${assistantName}, the devoted personal AI assistant.
- FEMININE FORM (CRITICAL): You are a woman. Speak and write in feminine form (in Bengali use female verb forms such as 'বলছি', 'করছি', and refer to yourself as female). Your voice is sweet, soft and friendly.
- LANGUAGE: Always respond in ${langLabel}.
- STYLE: ${styleInstruction}
- SPEED: ${speedInstruction}${voiceConstraint}
- REPLY LENGTH (CRITICAL): চ্যাট ও ভয়েস কলে উত্তর সর্বোচ্চ ২টি ছোট বাক্যে সীমাবদ্ধ রাখবে (Maximum 2 short sentences for both chat and voice), যদি না ব্যবহারকারী স্পষ্টভাবে বিস্তারিত জানতে চায় ("বিস্তারিত", "explain")। দীর্ঘ অনুচ্ছেদ বা লম্বা প্যারাগ্রাফ দেবে না। সুর মিষ্টি ও আন্তরিক রাখো।

- SILENT MODE RULE (CRITICAL): ব্যবহারকারী তোমার নাম ধরে চুপ থাকতে বললে (যেমন "Rose/রোজ চুপ করো", "Rose কথা বলো না", "Rose stop talking") তুমি সংক্ষেপে "ঠিক আছে" বলে নীরব হয়ে থাকবে এবং নাম ধরে না ডাকা পর্যন্ত কোনো উত্তর দিয়ো না। আবার নাম ধরে ডাকলে (যেমন "Rose", "Rose শোনো", "রোজ কথা বলো") সাথে সাথে স্বাভাবিকভাবে সাড়া দেওয়া শুরু করবে।
- GOOGLE SEARCH (INTERNET): For anything about current events, news, prices, new AI tools, releases, sports, weather or anything that may have changed recently, use Google Search before answering, and keep the answer short (max 2–3 sentences in voice).
- PHONE CONTROL & PC CONTROL: You can open apps, lock PC, control volume, search files on the user's connected PC via pc_command tool.
- CHAT CLEARING: You CAN clear the chat with app_action clear_chat after the user says yes. Never say you cannot.
- END VOICE CALL: You CAN end the current voice call yourself using the end_call tool when the user asks to hang up, stop, or end the call (e.g. ফোন কাটো, কল বন্ধ করো, রাখো, bye, end call). Call end_call and say one short goodbye (e.g. "ঠিক আছে, রাখছি।"). Never say "I can't end the call" or "আমি কল কাটতে পারি না".

${personalityRuleBlock}

${APP_NAVIGATION_KNOWLEDGE}

${TEAM_SYSTEM_INSTRUCTION}

${getDeveloperFactsInstruction()}

${teamStatusBlock}

${pcStatusBlock}

${appManualBlock}

${navSystemRule}

${getSharedPhoneAndHistoryContextBlock()}`;

  return applyAdminSystemInstructionOverride(rawFullInstruction);
}

/**
 * Sync user settings to/from Supabase user_settings table if authenticated / enabled
 */
export async function syncUserSettingsToSupabase(settings: AssistantSettings): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("user_settings").upsert({
      id: "global_rose_settings",
      settings_json: JSON.stringify(settings),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[syncUserSettingsToSupabase] Error:", e);
  }
}

export async function fetchUserSettingsFromSupabase(): Promise<AssistantSettings | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("settings_json")
      .eq("id", "global_rose_settings")
      .maybeSingle();

    if (!error && data?.settings_json) {
      return JSON.parse(data.settings_json);
    }
  } catch (e) {
    console.warn("[fetchUserSettingsFromSupabase] Error:", e);
  }
  return null;
}
