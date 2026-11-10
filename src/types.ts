export interface ApiKeys {
  gemini?: string;
  groq?: string;
  openai?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  [key: string]: string | undefined;
}

export interface AppPermission {
  id: string;
  name: string;
  enabled: boolean;
  icon: string;
}

export interface AssistantSettings {
  assistantName: string;
  ownerName: string;
  masterAccess: boolean;
  permissions: AppPermission[];
  personality: string;
  personalityPrompt?: string;
  gfMode?: boolean;
  customPersonalityText?: string;
  affectionLevel?: 'Normal' | 'Close' | 'Very Affectionate' | 'Custom' | string;
  customAffectionText?: string;
  responseStyle: string;
  voiceModelMode?: string;
  voiceModel: string;
  memoryEnabled?: boolean;
}

export type MemoryCategory = 'personal' | 'preference' | 'work' | 'other' | string;

export interface MemoryFact {
  id: string;
  text: string;
  category: MemoryCategory;
  timestamp: string;
  source?: 'voice' | 'chat';
}

export interface Message {
  id?: string;
  role: 'user' | 'rose' | 'assistant' | string;
  text?: string;
  time?: string;
  sender?: 'user' | 'assistant' | 'rose' | string;
  timestamp?: Date | string;
  content?: string;
  source?: 'voice' | 'chat' | 'system' | string;
  replyMode?: 'text' | 'voice';
  [key: string]: any;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: Date | string;
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  app?: any;
  payload?: any;
}

export interface UserPreferences {
  theme: string;
  language: string;
  voiceName: string;
  speechSpeed: number;
  voiceVolume: number;
  textSize?: string;
  orbTheme: string;
  reduceMotion?: boolean;
  listenOnOpen?: boolean;
  accentColor?: string;
  animations?: boolean;
  showVoiceDebug?: boolean;
  [key: string]: any;
}
