import { registerPlugin } from '@capacitor/core';

export interface PhoneControlPlugin {
  openApp(options: { name: string }): Promise<{ opened?: boolean; app?: string; reason?: string; error?: string; permission?: string }>;
  findContact(options: { name: string }): Promise<{ contacts?: Array<{ name: string; number: string }>; error?: string; permission?: string }>;
  callNumber(options: { number: string }): Promise<{ started?: boolean; error?: string; permission?: string }>;
  openWhatsAppChat(options: { number: string; text: string }): Promise<{ opened?: boolean; reason?: string; error?: string }>;
  composeSms(options: { number: string; text: string }): Promise<{ opened?: boolean; reason?: string; error?: string }>;
  openUrl(options: { url: string }): Promise<{ opened?: boolean; reason?: string; error?: string }>;
}

const isNative = () => {
  const cap = (window as any).Capacitor;
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
};

const PhoneControlNative = registerPlugin<PhoneControlPlugin>('PhoneControl');

export const PhoneControl: PhoneControlPlugin = {
  openApp: async (options) => {
    if (!isNative()) return { error: 'unsupported' };
    try {
      return await PhoneControlNative.openApp(options);
    } catch (e: any) {
      return { error: e?.message || 'failed' };
    }
  },
  findContact: async (options) => {
    if (!isNative()) return { error: 'unsupported' };
    try {
      return await PhoneControlNative.findContact(options);
    } catch (e: any) {
      return { error: e?.message || 'failed' };
    }
  },
  callNumber: async (options) => {
    if (!isNative()) return { error: 'unsupported' };
    try {
      return await PhoneControlNative.callNumber(options);
    } catch (e: any) {
      return { error: e?.message || 'failed' };
    }
  },
  openWhatsAppChat: async (options) => {
    if (!isNative()) return { error: 'unsupported' };
    try {
      return await PhoneControlNative.openWhatsAppChat(options);
    } catch (e: any) {
      return { error: e?.message || 'failed' };
    }
  },
  composeSms: async (options) => {
    if (!isNative()) return { error: 'unsupported' };
    try {
      return await PhoneControlNative.composeSms(options);
    } catch (e: any) {
      return { error: e?.message || 'failed' };
    }
  },
  openUrl: async (options) => {
    if (!isNative()) return { error: 'unsupported' };
    try {
      return await PhoneControlNative.openUrl(options);
    } catch (e: any) {
      return { error: e?.message || 'failed' };
    }
  },
};

export const PHONE_CONTROL_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'open_app',
        description: 'Find and launch an installed app on the user\'s phone by name immediately.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Name of the app to open (e.g. YouTube, WhatsApp, Facebook, Gallery, Settings).' }
          },
          required: ['name']
        }
      },
      {
        name: 'find_contact',
        description: 'Find contacts stored on the user\'s phone by name.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Name or partial name of the contact to search.' }
          },
          required: ['name']
        }
      },
      {
        name: 'call_contact',
        description: 'Call a contact or phone number on the user\'s phone. ALWAYS requires user confirmation first.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name_or_number: { type: 'STRING', description: 'Contact name or phone number to call.' }
          },
          required: ['name_or_number']
        }
      },
      {
        name: 'message_contact',
        description: 'Prepare a message to a contact via WhatsApp or SMS. ALWAYS requires user confirmation first.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name_or_number: { type: 'STRING', description: 'Contact name or phone number to message.' },
            text: { type: 'STRING', description: 'The message content text.' },
            via: { type: 'STRING', enum: ['whatsapp', 'sms'], description: 'Messaging channel: whatsapp or sms.' }
          },
          required: ['name_or_number', 'text', 'via']
        }
      },
      {
        name: 'open_website',
        description: 'Open a website URL in the browser immediately.',
        parameters: {
          type: 'OBJECT',
          properties: {
            url: { type: 'STRING', description: 'Web URL to open in browser.' }
          },
          required: ['url']
        }
      },
      {
        name: 'read_notifications',
        description: 'Read the latest notifications from the phone (Android Termux only).',
        parameters: {
          type: 'OBJECT',
          properties: {}
        }
      },
      {
        name: 'take_photo',
        description: 'Take a photo using the phone camera (Android Termux only).',
        parameters: {
          type: 'OBJECT',
          properties: {
            camera: { type: 'NUMBER', description: 'Camera ID (0 for back, 1 for front)' }
          }
        }
      }
    ]
  }
];
