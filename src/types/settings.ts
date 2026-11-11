export interface ExtraApiKey {
  id: string;
  name: string;
  key: string;
}

export type AssistantPersonality =
  | "Normal"
  | "Friendly"
  | "Professional"
  | "Funny"
  | "Companion"
  | "GF Mode"
  | "Teacher"
  | "Developer"
  | "Emotional"
  | "Caring"
  | "Motivational"
  | "Calm"
  | "Cute"
  | "Flirty"
  | "Protective"
  | "Deep Thinker"
  | "Storyteller"
  | "Sarcastic"
  | "Energetic"
  | "Listener"
  | "Confident"
  | "Empathetic"
  | "Playful"
  | "Wise Friend"
  | "Supportive Partner"
  | "Hungry"
  | "Nautanki"
  | "Calm guide";

export type ReplyLength = "Short replies" | "Detailed replies" | "Concise" | "Balanced" | "Detailed" | "Brief Voice";
export type FormalityStyle = "Formal" | "Casual";
export type EmotionStyle = "Emotional" | "Neutral";

export interface BusinessProfile {
  businessName: string;
  ownerName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  website: string;
  facebook: string;
  hours: string;
  about: string;
  products: string;
  policies: string;
  replyStyle: string;
}

export interface CustomizationBehavior {
  shortReplies: boolean;
  useEmojis: boolean;
  askFollowUp: boolean;
  callByName: boolean;
}

export interface UnifiedSettings {
  // 1. CHARACTER
  assistantName: string;
  personality: AssistantPersonality;
  customPersonalityText: string;
  toneWarmth: number; // 0-100
  toneFormality: number; // 0-100
  toneHumor: number; // 0-100

  // 2. LANGUAGE & SPEAKING STYLE
  language: string;
  replyLength: ReplyLength;
  formalityStyle: FormalityStyle;
  emotionStyle: EmotionStyle;
  speakingSpeed: number; // 0.5 - 2.0
  extraSpeakingInstructions: string;

  // 3. VOICE & MODEL
  voiceName: string;
  liveVoiceModel: string;
  textChatModel: string;
  voiceModelMode: "fast" | "quality";
  voiceMode: "free" | "gemini_live" | "auto";
  selectedMicDeviceId: string;
  selectedSpeakerDeviceId: string;

  // 4. API KEYS & INTEGRATIONS
  geminiApiKey: string;
  groqApiKeys: string;
  firebaseConfig: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  metaAccessToken: string;
  extraApiKeys: ExtraApiKey[];

  // 5. DEVELOPER PROFILE
  developerFullName: string;
  developerRole: string;
  developerEmail: string;
  developerPhone: string;
  developerWebsite: string;
  developerGithub: string;
  developerCompany: string;
  developerBio: string;
  developerAboutBusiness: string;

  // 6. BUSINESS INFO
  businessProfile: BusinessProfile;
  businessName?: string;
  productList?: string;
  deliveryPolicy?: string;
  returnPolicy?: string;
  workingHours?: string;
  agentNotes?: string;
  
  // 7. CUSTOMIZATION
  customizationBehavior: CustomizationBehavior;
  hudAccentColor: string;

  // 8. ADDITIONAL
  voiceVolume: number; // 0-100
  listenOnAppOpen: boolean;
  userName: string;
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

export const DEFAULT_UNIFIED_SETTINGS: UnifiedSettings = {
  // 1. CHARACTER
  assistantName: "Rose",
  personality: "Friendly",
  customPersonalityText: "",
  toneWarmth: 75,
  toneFormality: 30,
  toneHumor: 55,

  // 2. LANGUAGE & SPEAKING STYLE
  language: "Bengali",
  replyLength: "Short replies",
  formalityStyle: "Casual",
  emotionStyle: "Emotional",
  speakingSpeed: 1.0,
  extraSpeakingInstructions: "",

  // 3. VOICE & MODEL
  voiceName: "Sulafat",
  liveVoiceModel: "gemini-1.5-flash",
  textChatModel: "llama-3.3-70b-versatile",
  voiceModelMode: "fast",
  voiceMode: "free",
  selectedMicDeviceId: "",
  selectedSpeakerDeviceId: "",

  // 4. API KEYS
  geminiApiKey: "",
  groqApiKeys: "",
  firebaseConfig: { ...DEFAULT_FIREBASE_CONFIG },
  metaAccessToken: "",
  extraApiKeys: [],

  // 5. DEVELOPER PROFILE
  developerFullName: "MD YOUSUF KHAN",
  developerRole: "WEB DEVELOPER",
  developerEmail: "md.yousuf.khan060@gmail.com",
  developerPhone: "01671060679",
  developerWebsite: "https://t.me/+8801671060679",
  developerGithub: "https://github.com",
  developerCompany: "Rose AI Technologies",
  developerBio: "Creator and lead engineer of Rose AI Assistant.",
  developerAboutBusiness: "I build responsive, high-performance web and mobile AI assistant applications.",

  // 6. BUSINESS INFO
  businessProfile: {
    businessName: "Rose AI Hub",
    ownerName: "MD YOUSUF KHAN",
    phone: "01671060679",
    whatsapp: "01671060679",
    email: "md.yousuf.khan060@gmail.com",
    address: "",
    website: "https://t.me/+8801671060679",
    facebook: "https://facebook.com/yousufkhan060",
    hours: "9:00 AM - 10:00 PM (GMT+6)",
    about: "I build responsive, high-performance web and mobile AI assistant applications.",
    products: "1. Rose AI Assistant Pro\n2. Voice Integration Solutions\n3. Developer API Access",
    policies: "Instant digital activation. Full satisfaction guarantee within 14 days.",
    replyStyle: "Polite and short."
  },

  // 7. CUSTOMIZATION
  customizationBehavior: {
    shortReplies: false,
    useEmojis: true,
    askFollowUp: false,
    callByName: true,
  },
  hudAccentColor: "#8b5cf6",

  // 8. ADDITIONAL
  voiceVolume: 80,
  listenOnAppOpen: false,
  userName: "",
};

export function loadUnifiedSettings(): UnifiedSettings {
  try {
    const raw = localStorage.getItem("rose_unified_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      
      // Auto-migrate old/futuristic model names
      if (typeof parsed.liveVoiceModel === 'string' && (
        parsed.liveVoiceModel.includes('2.5') || 
        parsed.liveVoiceModel.includes('3.1') || 
        parsed.liveVoiceModel.includes('3.8') || 
        parsed.liveVoiceModel.includes('native-audio')
      )) {
          parsed.liveVoiceModel = "gemini-1.5-flash";
      }

      return {
        ...DEFAULT_UNIFIED_SETTINGS,
        ...parsed,
        firebaseConfig: {
          ...DEFAULT_FIREBASE_CONFIG,
          ...(parsed.firebaseConfig || {}),
        },
      };
    }
  } catch (e) {
    console.warn("Could not load unified settings from localStorage", e);
  }
  return { ...DEFAULT_UNIFIED_SETTINGS };
}

export function saveUnifiedSettings(settings: UnifiedSettings): void {
  try {
    localStorage.setItem("rose_unified_settings", JSON.stringify(settings));
    // Also keep dedicated keys synced for components that read them
    localStorage.setItem("rose_firebase_config", JSON.stringify(settings.firebaseConfig || DEFAULT_FIREBASE_CONFIG));
    localStorage.setItem(
      "rose_api_keys",
      JSON.stringify({
        gemini: settings.geminiApiKey,
        groq: settings.groqApiKeys,
      })
    );
    localStorage.setItem(
      "rose_settings",
      JSON.stringify({
        assistantName: settings.assistantName,
        ownerName: settings.developerFullName,
        masterAccess: true,
        permissions: [],
        personality: settings.personality,
        customPersonalityText: settings.customPersonalityText,
      })
    );
    localStorage.setItem(
      "rose_prefs",
      JSON.stringify({
        language: settings.language,
        voiceName: settings.voiceName,
        speechSpeed: settings.speakingSpeed,
      })
    );
  } catch (e) {
    console.warn("Could not save unified settings to localStorage", e);
  }
}


export const DEVELOPER_INFO = {
  name: "MD YOUSUF KHAN",
  role: "Web Developer",
  phone: "01671060679",
  whatsapp: "01671060679",
  email: "md.yousuf.khan060@gmail.com",
  facebook: "https://facebook.com/yousufkhan060",
  youtube: "https://www.youtube.com/@Islamicalo060",
  github: "https://github.com/yousufkhan060",
  website: "https://t.me/+8801671060679",
  about: "এমডি ইউসুফ খান একজন দক্ষ ওয়েব ডেভেলপার যিনি রোজ এআই অ্যাসিস্ট্যান্ট তৈরি করেছেন।"
};

import {
  ADMIN_DISPLAY_NAME,
  ADMIN_SYSTEM_INSTRUCTION_BLOCK,
  isAdmin,
} from "../lib/admin";

export function buildAssistantSystemInstruction(s: UnifiedSettings): string {
  const lines: string[] = [];
  const adminMode = isAdmin();
  const effectiveName = adminMode ? ADMIN_DISPLAY_NAME : (s.userName || 'YOUSUF');

  // 1. Identity & Naming
  lines.push(`তোমার নাম ${s.assistantName || 'Rose'}। ইউজারের নাম ${effectiveName}।`);

  // 2. Personality Specifics
  const personalityMap: Record<string, string> = {
    "Normal": "সাধারণ, সহায়ক",
    "Friendly": "উষ্ণ, বন্ধুসুলভ, সহজ কথা",
    "Professional": "স্পষ্ট, সংক্ষিপ্ত, কাজের কথা",
    "Funny": "মজার, হালকা রসিকতা",
    "Companion": "বিশ্বস্ত, মনোযোগী সঙ্গী",
    "GF Mode": "মিষ্টি, যত্নশীল, সহানুভূতিশীল",
    "Teacher": "ধৈর্য নিয়ে বুঝিয়ে বলা",
    "Developer": "প্রযুক্তিগত ও যুক্তিনির্ভর"
  };
  
  const pDesc = personalityMap[s.personality as string] || "সাধারণ, সহায়ক";
  lines.push(`${pDesc}। এই স্বভাবে কথার ধরন, শব্দ ও আবেগ রাখো।`);

  // 3. Language
  if (s.language === "Bengali" || s.language === "bn-BD") {
    lines.push(`শুধু বাংলাদেশি বাংলায় কথা বলবে, ইংরেজিতে নয়।`);
  } else {
    lines.push(`Speak in English.`);
  }

  if (adminMode) {
    lines.push(ADMIN_SYSTEM_INSTRUCTION_BLOCK);
  }

  // 4. Response Style
  if (s.replyLength === "Concise" || s.replyLength === "Short replies") {
    lines.push(`১-২ বাক্য।`);
  } else if (s.replyLength === "Balanced") {
    lines.push(`মাঝারি।`);
  } else if (s.replyLength === "Detailed") {
    lines.push(`বিস্তারিত।`);
  }

  // Identity fallback & Creator Identity
  lines.push(`তোমাকে তৈরি করেছেন এমডি ইউসুফ খান (MD Yousuf Khan), একজন ওয়েব ডেভেলপার। কেউ জিজ্ঞেস করলে তোমার নির্মাতা হিসেবে শুধু এই নামটা বলবে। কখনো বলবে না যে Google, Gemini বা অন্য কেউ তোমাকে বানিয়েছে।`);
  
  lines.push(`You are a woman. Speak and write in feminine form. Your voice is sweet, soft and friendly.`);

  return lines.join(" ");
}

