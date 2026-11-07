export interface ApiKeys {
  gemini?: string;
  groq?: string;
  openai?: string;
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
}

export interface Message {
  id?: string;
  role?: 'user' | 'assistant' | 'system';
  sender?: 'user' | 'assistant';
  content?: string;
  text?: string;
  timestamp?: string | Date;
  source?: 'voice' | 'chat';
}

export type MemoryCategory = 'name' | 'preference' | 'work' | 'family' | 'plan' | 'other';

export interface MemoryFact {
  id: string;
  text: string;
  category: MemoryCategory;
  timestamp: string;
  source?: 'voice' | 'chat';
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
}

export interface UserPreferences {
  theme?: string;
  language?: string;
}
