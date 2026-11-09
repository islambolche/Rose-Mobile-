/**
 * Phone-Actions Layer for Rose AI Assistant
 * - Gemini Function Calling declarations
 * - PhoneBridge interface & Browser implementation
 * - Quick Action toggle respect & enforcement
 * - Action confirmation flow (Call, SMS, WhatsApp)
 * - Persistent action logging in History
 * - Data sanitization against prompt injection
 */

export interface PhoneActionResult {
  success: boolean;
  tool: string;
  status: 'executed' | 'confirmation_needed' | 'refused' | 'unsupported';
  message: string;
  url?: string;
  confirmation?: ActionConfirmationData;
}

export interface ActionConfirmationData {
  id: string;
  type: 'call' | 'sms' | 'whatsapp';
  title: string;
  recipient: string;
  text?: string;
  cardPrompt: string; // e.g. "Send to Mom: I will be late" or "Call John"
  executeUrl: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: number;
}

export interface PhoneActionLogItem {
  id: string;
  tool: string;
  status: 'executed' | 'confirmed' | 'cancelled' | 'refused' | 'unsupported' | 'pending';
  summary: string;
  details?: Record<string, any>;
  timestamp: string;
}

// 1. GEMINI TOOL DECLARATIONS
export const GEMINI_PHONE_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "open_app",
        description: "Open an installed mobile application by name (e.g. YouTube, WhatsApp, Camera, Chrome, Facebook, Settings).",
        parameters: {
          type: "OBJECT",
          properties: {
            app_name: { type: "STRING", description: "Name of the app to open" }
          },
          required: ["app_name"]
        }
      },
      {
        name: "call_contact",
        description: "Initiate a phone call to a named contact or phone number.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", description: "Name of the person or contact to call" },
            phone_number: { type: "STRING", description: "Phone number if provided or known" }
          },
          required: ["name"]
        }
      },
      {
        name: "send_sms",
        description: "Prepare an SMS text message to send to a contact or phone number.",
        parameters: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING", description: "Name of the recipient" },
            message: { type: "STRING", description: "Text content of the SMS" },
            phone_number: { type: "STRING", description: "Phone number of recipient if known" }
          },
          required: ["name", "message"]
        }
      },
      {
        name: "send_whatsapp",
        description: "Send a message via WhatsApp to a contact or phone number.",
        parameters: {
          type: "OBJECT",
          properties: {
            message: { type: "STRING", description: "Message text to send on WhatsApp" },
            name: { type: "STRING", description: "Name of the recipient" },
            phone_number: { type: "STRING", description: "Phone number with country code if known" }
          },
          required: ["message"]
        }
      },
      {
        name: "open_maps",
        description: "Search or navigate to a place, address, business, or destination on Google Maps.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "Destination, address, or search location" }
          },
          required: ["query"]
        }
      },
      {
        name: "youtube_search",
        description: "Search for and play videos, music, songs, or artists on YouTube.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "Search query, song title, or artist" }
          },
          required: ["query"]
        }
      },
      {
        name: "play_media",
        description: "Control device media playback (play, pause, resume, next, stop).",
        parameters: {
          type: "OBJECT",
          properties: {
            action: { type: "STRING", description: "Action: play, pause, resume, next, stop" },
            title: { type: "STRING", description: "Optional title of song or media" }
          },
          required: ["action"]
        }
      },
      {
        name: "set_alarm",
        description: "Set an alarm, wake-up alert, or timer.",
        parameters: {
          type: "OBJECT",
          properties: {
            time: { type: "STRING", description: "Alarm time, e.g. '07:30 AM' or 'in 25 minutes'" },
            label: { type: "STRING", description: "Optional label for the alarm" }
          },
          required: ["time"]
        }
      },
      {
        name: "flashlight",
        description: "Turn the phone flashlight / torch on or off.",
        parameters: {
          type: "OBJECT",
          properties: {
            state: { type: "STRING", description: "State: 'on', 'off', or 'toggle'" }
          },
          required: ["state"]
        }
      },
      {
        name: "volume",
        description: "Adjust device audio volume level.",
        parameters: {
          type: "OBJECT",
          properties: {
            level: { type: "STRING", description: "Level: 'up', 'down', 'mute', 'max', or 0-100" }
          },
          required: ["level"]
        }
      },
      {
        name: "brightness",
        description: "Adjust screen brightness level.",
        parameters: {
          type: "OBJECT",
          properties: {
            level: { type: "STRING", description: "Brightness: 'up', 'down', 'min', 'max', or 0-100" }
          },
          required: ["level"]
        }
      },
      {
        name: "wifi",
        description: "Turn device Wi-Fi on or off.",
        parameters: {
          type: "OBJECT",
          properties: {
            state: { type: "STRING", description: "State: 'on', 'off', or 'toggle'" }
          },
          required: ["state"]
        }
      },
      {
        name: "bluetooth",
        description: "Turn device Bluetooth on or off.",
        parameters: {
          type: "OBJECT",
          properties: {
            state: { type: "STRING", description: "State: 'on', 'off', or 'toggle'" }
          },
          required: ["state"]
        }
      }
    ]
  }
];

// Mapping to Quick Action IDs in Settings > Quick Actions
export const TOOL_TO_QUICK_ACTION: Record<string, { id: string; name: string }> = {
  open_app: { id: 'openApp', name: 'Open any app' },
  call_contact: { id: 'makeCall', name: 'Phone call' },
  send_sms: { id: 'sendSms', name: 'Send SMS' },
  send_whatsapp: { id: 'sendSms', name: 'WhatsApp message' },
  open_maps: { id: 'maps', name: 'Maps' },
  youtube_search: { id: 'media', name: 'YouTube / Media' },
  play_media: { id: 'media', name: 'Media playback' },
  set_alarm: { id: 'alarm', name: 'Alarm/Timer' },
  flashlight: { id: 'flashlight', name: 'Flashlight' },
  volume: { id: 'volume', name: 'Volume' },
  brightness: { id: 'brightness', name: 'Brightness' },
  wifi: { id: 'wifi', name: 'Wi-Fi' },
  bluetooth: { id: 'bluetooth', name: 'Bluetooth' },
};

/**
 * Check if the user has enabled the corresponding Quick Action.
 * If disabled in Settings > Phone Control > Quick Actions, the action is refused.
 */
export function isQuickActionEnabled(toolName: string): { enabled: boolean; actionName: string } {
  const mapping = TOOL_TO_QUICK_ACTION[toolName];
  if (!mapping) return { enabled: true, actionName: toolName };

  try {
    const saved = localStorage.getItem('iyabd_quick_actions_v5') || localStorage.getItem('iyabd_quick_actions');
    if (saved) {
      const actions = JSON.parse(saved);
      if (Array.isArray(actions)) {
        const found = actions.find((a: any) => a.id === mapping.id);
        if (found && found.enabled === false) {
          return { enabled: false, actionName: mapping.name };
        }
      }
    }
  } catch (e) {}

  return { enabled: true, actionName: mapping.name };
}

/**
 * Log action execution/status to persistent History
 */
export function logPhoneAction(item: Omit<PhoneActionLogItem, 'id' | 'timestamp'>): PhoneActionLogItem {
  const logItem: PhoneActionLogItem = {
    ...item,
    id: 'act_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
  };

  try {
    const raw = localStorage.getItem('iyabd_action_history') || '[]';
    const list: PhoneActionLogItem[] = JSON.parse(raw);
    list.unshift(logItem);
    // keep last 100 actions
    localStorage.setItem('iyabd_action_history', JSON.stringify(list.slice(0, 100)));
  } catch (e) {}

  return logItem;
}

export function getPhoneActionHistory(): PhoneActionLogItem[] {
  try {
    const raw = localStorage.getItem('iyabd_action_history') || '[]';
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

/**
 * Helper to safely launch external URLs without blocking popup filters
 */
function safelyOpenUrl(url: string) {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
    }, 200);
  } catch (e) {
    try { window.location.href = url; } catch (err) {}
  }
}

/**
 * Helper to call the Termux API bridge on the backend
 */
async function callTermuxApi(action: string, args: any): Promise<boolean> {
  try {
    const res = await fetch('/api/termux/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, args })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Sync contacts from Termux API into local storage
 */
export async function syncTermuxContacts() {
  try {
    const res = await fetch('/api/termux/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'contacts' })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.output)) {
        const list = data.output.map((c: any) => ({
          name: c.name,
          tel: c.number
        }));
        localStorage.setItem('iyabd_saved_contacts', JSON.stringify(list));
        return list.length;
      }
    }
  } catch (e) {}
  return 0;
}

/**
 * 2. PHONE BRIDGE INTERFACE
 */
export interface PhoneBridge {
  open_app(args: { app_name: string }): Promise<PhoneActionResult>;
  call_contact(args: { name: string; phone_number?: string }): Promise<PhoneActionResult>;
  send_sms(args: { name: string; message: string; phone_number?: string }): Promise<PhoneActionResult>;
  send_whatsapp(args: { message: string; name?: string; phone_number?: string }): Promise<PhoneActionResult>;
  open_maps(args: { query: string }): Promise<PhoneActionResult>;
  youtube_search(args: { query: string }): Promise<PhoneActionResult>;
  play_media(args: { action: string; title?: string }): Promise<PhoneActionResult>;
  set_alarm(args: { time: string; label?: string }): Promise<PhoneActionResult>;
  flashlight(args: { state: string }): Promise<PhoneActionResult>;
  volume(args: { level: string }): Promise<PhoneActionResult>;
  brightness(args: { level: string }): Promise<PhoneActionResult>;
  wifi(args: { state: string }): Promise<PhoneActionResult>;
  bluetooth(args: { state: string }): Promise<PhoneActionResult>;
  read_notifications(): Promise<PhoneActionResult>;
  take_photo(args: { camera?: number }): Promise<PhoneActionResult>;
}

/**
 * Helper to lookup saved contacts from localStorage (Contact Picker API cache)
 */
export function lookupSavedContact(query: string): { name: string; tel: string } | null {
  try {
    const raw = localStorage.getItem('iyabd_saved_contacts');
    if (!raw) return null;
    const list: Array<{ name: string; tel: string }> = JSON.parse(raw);
    const q = (query || '').toLowerCase().trim();
    if (!q) return null;
    const exact = list.find((c) => c.name?.toLowerCase() === q);
    if (exact) return exact;
    const partial = list.find((c) => c.name?.toLowerCase().includes(q) || q.includes(c.name?.toLowerCase()));
    if (partial) return partial;
  } catch (e) {}
  return null;
}

/**
 * Browser PhoneBridge Implementation
 */
export const browserPhoneBridge: PhoneBridge = {
  async open_app({ app_name }) {
    const name = String(app_name || '').trim();
    const lower = name.toLowerCase();

    // Map common apps to Android intent or web URLs
    let url = '';
    if (lower.includes('youtube')) {
      url = 'https://www.youtube.com';
    } else if (lower.includes('whatsapp')) {
      url = 'https://web.whatsapp.com';
    } else if (lower.includes('facebook')) {
      url = 'https://www.facebook.com';
    } else if (lower.includes('chrome') || lower.includes('browser')) {
      url = 'https://www.google.com';
    } else if (lower.includes('map')) {
      url = 'https://maps.google.com';
    } else if (lower.includes('camera')) {
      url = 'intent:#Intent;action=android.media.action.IMAGE_CAPTURE;end';
    } else if (lower.includes('setting')) {
      url = 'intent:#Intent;action=android.settings.SETTINGS;end';
    } else {
      const cleanPkg = lower.replace(/[^a-z0-9]/g, '');
      url = `intent://#Intent;package=com.${cleanPkg};scheme=https;end`;
    }

    // Try Termux intent bridge first if applicable
    const termuxOk = await callTermuxApi('intent', { url });
    if (termuxOk) {
      logPhoneAction({
        tool: 'open_app',
        status: 'executed',
        summary: `Opened app: ${name} (Termux)`,
        details: { app_name: name, url, method: 'termux' },
      });
      return {
        success: true,
        tool: 'open_app',
        status: 'executed',
        message: `Opening ${name}...`,
        url,
      };
    }

    safelyOpenUrl(url);
    logPhoneAction({
      tool: 'open_app',
      status: 'executed',
      summary: `Opened app: ${name}`,
      details: { app_name: name, url },
    });

    return {
      success: true,
      tool: 'open_app',
      status: 'executed',
      message: `Opening ${name}...`,
      url,
    };
  },

  async call_contact({ name, phone_number }) {
    let resolvedNumber = phone_number || '';
    let displayName = name || phone_number || 'Contact';
    if (!resolvedNumber && name) {
      const match = lookupSavedContact(name);
      if (match && match.tel) {
        resolvedNumber = match.tel;
        displayName = match.name || displayName;
      }
    }
    const recipient = String(displayName).trim();
    const rawNumber = String(resolvedNumber || name || '').trim();
    const telNumber = rawNumber.replace(/[^\d+*#]/g, '') || rawNumber;
    const telUrl = `tel:${encodeURIComponent(telNumber)}`;

    const confirmation: ActionConfirmationData = {
      id: 'conf_call_' + Date.now(),
      type: 'call',
      title: 'Phone Call Confirmation',
      recipient,
      cardPrompt: `Call ${recipient}`,
      executeUrl: telUrl,
      status: 'pending',
      createdAt: Date.now(),
    };

    logPhoneAction({
      tool: 'call_contact',
      status: 'pending',
      summary: `Call requested: ${recipient}`,
      details: { recipient, telNumber },
    });

    return {
      success: true,
      tool: 'call_contact',
      status: 'confirmation_needed',
      message: `Call ${recipient}`,
      url: telUrl,
      confirmation,
    };
  },

  async send_sms({ name, message, phone_number }) {
    // Treat message text strictly as data (prevent command execution)
    const safeMessage = String(message || '').trim();
    let resolvedNumber = phone_number || '';
    let displayName = name || phone_number || 'Recipient';
    if (!resolvedNumber && name) {
      const match = lookupSavedContact(name);
      if (match && match.tel) {
        resolvedNumber = match.tel;
        displayName = match.name || displayName;
      }
    }
    const recipient = String(displayName).trim();
    const rawNumber = String(resolvedNumber || '').trim();
    const smsNumber = rawNumber.replace(/[^\d+]/g, '');

    const smsUrl = smsNumber
      ? `sms:${encodeURIComponent(smsNumber)}?body=${encodeURIComponent(safeMessage)}`
      : `sms:?body=${encodeURIComponent(safeMessage)}`;

    const confirmation: ActionConfirmationData = {
      id: 'conf_sms_' + Date.now(),
      type: 'sms',
      title: 'SMS Message Confirmation',
      recipient,
      text: safeMessage,
      cardPrompt: `Send to ${recipient}: "${safeMessage}"`,
      executeUrl: smsUrl,
      status: 'pending',
      createdAt: Date.now(),
    };

    logPhoneAction({
      tool: 'send_sms',
      status: 'pending',
      summary: `SMS drafted for ${recipient}`,
      details: { recipient, message: safeMessage },
    });

    return {
      success: true,
      tool: 'send_sms',
      status: 'confirmation_needed',
      message: `Send to ${recipient}: "${safeMessage}"`,
      url: smsUrl,
      confirmation,
    };
  },

  async send_whatsapp({ message, name, phone_number }) {
    // Treat message text strictly as data
    const safeMessage = String(message || '').trim();
    let resolvedNumber = phone_number || '';
    let displayName = name || phone_number || 'WhatsApp Contact';
    if (!resolvedNumber && name) {
      const match = lookupSavedContact(name);
      if (match && match.tel) {
        resolvedNumber = match.tel;
        displayName = match.name || displayName;
      }
    }
    const recipient = String(displayName).trim();
    const rawNumber = String(resolvedNumber || '').replace(/[^\d]/g, '');

    const waUrl = rawNumber
      ? `https://wa.me/${encodeURIComponent(rawNumber)}?text=${encodeURIComponent(safeMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(safeMessage)}`;

    const confirmation: ActionConfirmationData = {
      id: 'conf_wa_' + Date.now(),
      type: 'whatsapp',
      title: 'WhatsApp Confirmation',
      recipient,
      text: safeMessage,
      cardPrompt: `Send to ${recipient}: "${safeMessage}"`,
      executeUrl: waUrl,
      status: 'pending',
      createdAt: Date.now(),
    };

    logPhoneAction({
      tool: 'send_whatsapp',
      status: 'pending',
      summary: `WhatsApp drafted for ${recipient}`,
      details: { recipient, message: safeMessage },
    });

    return {
      success: true,
      tool: 'send_whatsapp',
      status: 'confirmation_needed',
      message: `Send to ${recipient}: "${safeMessage}"`,
      url: waUrl,
      confirmation,
    };
  },

  async open_maps({ query }) {
    const q = String(query || '').trim();
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

    safelyOpenUrl(url);
    logPhoneAction({
      tool: 'open_maps',
      status: 'executed',
      summary: `Maps search: ${q}`,
      details: { query: q, url },
    });

    return {
      success: true,
      tool: 'open_maps',
      status: 'executed',
      message: `Opening Google Maps for ${q}...`,
      url,
    };
  },

  async youtube_search({ query }) {
    const q = String(query || '').trim();
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

    safelyOpenUrl(url);
    logPhoneAction({
      tool: 'youtube_search',
      status: 'executed',
      summary: `YouTube search: ${q}`,
      details: { query: q, url },
    });

    return {
      success: true,
      tool: 'youtube_search',
      status: 'executed',
      message: `Searching YouTube for ${q}...`,
      url,
    };
  },

  async play_media({ action, title }) {
    const isAndroid = typeof window !== 'undefined' && Boolean((window as any).AndroidIYABD);
    if (isAndroid && (window as any).AndroidIYABD?.playMedia) {
      try {
        (window as any).AndroidIYABD.playMedia(JSON.stringify({ action, title }));
        return {
          success: true,
          tool: 'play_media',
          status: 'executed',
          message: `Media playback: ${action}`,
        };
      } catch (e) {}
    }

    logPhoneAction({
      tool: 'play_media',
      status: 'unsupported',
      summary: `Play media (${action}) requested`,
      details: { action, title },
    });

    return {
      success: false,
      tool: 'play_media',
      status: 'unsupported',
      message: 'Needs Android app',
    };
  },

  async set_alarm({ time, label }) {
    const isAndroid = typeof window !== 'undefined' && Boolean((window as any).AndroidIYABD);
    if (isAndroid && (window as any).AndroidIYABD?.setAlarm) {
      try {
        (window as any).AndroidIYABD.setAlarm(JSON.stringify({ time, label }));
        return {
          success: true,
          tool: 'set_alarm',
          status: 'executed',
          message: `Alarm set for ${time}`,
        };
      } catch (e) {}
    }

    logPhoneAction({
      tool: 'set_alarm',
      status: 'unsupported',
      summary: `Alarm set requested for ${time}`,
      details: { time, label },
    });

    return {
      success: false,
      tool: 'set_alarm',
      status: 'unsupported',
      message: 'Needs Android app',
    };
  },

  async flashlight({ state }) {
    const isAndroid = typeof window !== 'undefined' && Boolean((window as any).AndroidIYABD);
    if (isAndroid && (window as any).AndroidIYABD?.flashlight) {
      try {
        (window as any).AndroidIYABD.flashlight(JSON.stringify({ state }));
        return {
          success: true,
          tool: 'flashlight',
          status: 'executed',
          message: `Flashlight ${state}`,
        };
      } catch (e) {}
    }

    // Try Termux API
    const termuxOk = await callTermuxApi('torch', { state });
    if (termuxOk) {
      logPhoneAction({
        tool: 'flashlight',
        status: 'executed',
        summary: `Flashlight ${state} (Termux)`,
        details: { state, method: 'termux' },
      });
      return {
        success: true,
        tool: 'flashlight',
        status: 'executed',
        message: `Flashlight ${state}`,
      };
    }

    logPhoneAction({
      tool: 'flashlight',
      status: 'unsupported',
      summary: `Flashlight ${state} requested`,
      details: { state },
    });

    return {
      success: false,
      tool: 'flashlight',
      status: 'unsupported',
      message: 'Needs Android app or Termux API',
    };
  },

  async volume({ level }) {
    const isAndroid = typeof window !== 'undefined' && Boolean((window as any).AndroidIYABD);
    if (isAndroid && (window as any).AndroidIYABD?.volume) {
      try {
        (window as any).AndroidIYABD.volume(JSON.stringify({ level }));
        return {
          success: true,
          tool: 'volume',
          status: 'executed',
          message: `Volume set to ${level}`,
        };
      } catch (e) {}
    }

    // Try Termux API
    const levelNum = level === 'up' ? 100 : level === 'down' ? 0 : level === 'mute' ? 0 : level === 'max' ? 100 : parseInt(level);
    const termuxOk = await callTermuxApi('volume', { level: isNaN(levelNum) ? 50 : levelNum });
    if (termuxOk) {
       logPhoneAction({
        tool: 'volume',
        status: 'executed',
        summary: `Volume ${level} (Termux)`,
        details: { level, method: 'termux' },
      });
      return {
        success: true,
        tool: 'volume',
        status: 'executed',
        message: `Volume set to ${level}`,
      };
    }

    logPhoneAction({
      tool: 'volume',
      status: 'unsupported',
      summary: `Volume ${level} requested`,
      details: { level },
    });

    return {
      success: false,
      tool: 'volume',
      status: 'unsupported',
      message: 'Needs Android app or Termux API',
    };
  },

  async brightness({ level }) {
    const isAndroid = typeof window !== 'undefined' && Boolean((window as any).AndroidIYABD);
    if (isAndroid && (window as any).AndroidIYABD?.brightness) {
      try {
        (window as any).AndroidIYABD.brightness(JSON.stringify({ level }));
        return {
          success: true,
          tool: 'brightness',
          status: 'executed',
          message: `Brightness set to ${level}`,
        };
      } catch (e) {}
    }

    // Try Termux API
    const levelNum = level === 'up' ? 255 : level === 'down' ? 0 : level === 'min' ? 0 : level === 'max' ? 255 : Math.floor((parseInt(level) / 100) * 255);
    const termuxOk = await callTermuxApi('brightness', { level: isNaN(levelNum) ? 128 : levelNum });
    if (termuxOk) {
      logPhoneAction({
        tool: 'brightness',
        status: 'executed',
        summary: `Brightness ${level} (Termux)`,
        details: { level, method: 'termux' },
      });
      return {
        success: true,
        tool: 'brightness',
        status: 'executed',
        message: `Brightness set to ${level}`,
      };
    }

    logPhoneAction({
      tool: 'brightness',
      status: 'unsupported',
      summary: `Brightness ${level} requested`,
      details: { level },
    });

    return {
      success: false,
      tool: 'brightness',
      status: 'unsupported',
      message: 'Needs Android app or Termux API',
    };
  },

  async wifi({ state }) {
    const isAndroid = typeof window !== 'undefined' && Boolean((window as any).AndroidIYABD);
    if (isAndroid && (window as any).AndroidIYABD?.wifi) {
      try {
        (window as any).AndroidIYABD.wifi(JSON.stringify({ state }));
        return {
          success: true,
          tool: 'wifi',
          status: 'executed',
          message: `Wi-Fi ${state}`,
        };
      } catch (e) {}
    }

    logPhoneAction({
      tool: 'wifi',
      status: 'unsupported',
      summary: `Wi-Fi ${state} requested`,
      details: { state },
    });

    return {
      success: false,
      tool: 'wifi',
      status: 'unsupported',
      message: 'Needs Android app or Termux API',
    };
  },

  async bluetooth({ state }) {
    const isAndroid = typeof window !== 'undefined' && Boolean((window as any).AndroidIYABD);
    if (isAndroid && (window as any).AndroidIYABD?.bluetooth) {
      try {
        (window as any).AndroidIYABD.bluetooth(JSON.stringify({ state }));
        return {
          success: true,
          tool: 'bluetooth',
          status: 'executed',
          message: `Bluetooth ${state}`,
        };
      } catch (e) {}
    }

    logPhoneAction({
      tool: 'bluetooth',
      status: 'unsupported',
      summary: `Bluetooth ${state} requested`,
      details: { state },
    });

    return {
      success: false,
      tool: 'bluetooth',
      status: 'unsupported',
      message: 'Needs Android app or Termux API',
    };
  },

  async read_notifications() {
    const termuxOk = await callTermuxApi('notifications', {});
    if (termuxOk) {
       logPhoneAction({
        tool: 'read_notifications',
        status: 'executed',
        summary: `Read notifications (Termux)`,
        details: { method: 'termux' },
      });
      return {
        success: true,
        tool: 'read_notifications',
        status: 'executed',
        message: `Reading notifications...`,
      };
    }
    return {
      success: false,
      tool: 'read_notifications',
      status: 'unsupported',
      message: 'Termux API required'
    };
  },

  async take_photo({ camera }) {
    const termuxOk = await callTermuxApi('photo', { camera: camera || 0 });
    if (termuxOk) {
       logPhoneAction({
        tool: 'take_photo',
        status: 'executed',
        summary: `Took photo (Termux)`,
        details: { camera, method: 'termux' },
      });
      return {
        success: true,
        tool: 'take_photo',
        status: 'executed',
        message: `Photo captured and saved to ~/rose_capture_...`,
      };
    }
    return {
      success: false,
      tool: 'take_photo',
      status: 'unsupported',
      message: 'Termux API required'
    };
  },
};

/**
 * Dispatch tool call through PhoneBridge with Quick Action validation
 */
export async function executePhoneAction(
  toolName: string,
  toolArgs: Record<string, any>
): Promise<PhoneActionResult> {
  // 1. Check Quick Actions toggle
  const { enabled, actionName } = isQuickActionEnabled(toolName);
  if (!enabled) {
    const msg = `${actionName} is disabled in Quick Actions settings.`;
    logPhoneAction({
      tool: toolName,
      status: 'refused',
      summary: `Action Refused: ${actionName} disabled`,
      details: { tool: toolName, toolArgs },
    });
    return {
      success: false,
      tool: toolName,
      status: 'refused',
      message: msg,
    };
  }

  // 2. Dispatch to PhoneBridge implementation
  const bridgeFn = (browserPhoneBridge as any)[toolName];
  if (typeof bridgeFn === 'function') {
    return await bridgeFn(toolArgs);
  }

  return {
    success: false,
    tool: toolName,
    status: 'unsupported',
    message: 'Needs Android app',
  };
}

/**
 * Confirms and executes a pending action (Call, SMS, WhatsApp)
 */
export async function confirmAndExecuteAction(confirmation: ActionConfirmationData) {
  // 1. Try Termux API first if it's a Call or SMS
  let termuxSuccess = false;
  if (confirmation.type === 'call') {
    const rawNum = confirmation.executeUrl.replace('tel:', '');
    termuxSuccess = await callTermuxApi('call', { number: decodeURIComponent(rawNum) });
  } else if (confirmation.type === 'sms') {
    // extract number and body from sms:number?body=text
    const match = confirmation.executeUrl.match(/sms:([^?]+)\?body=(.+)/);
    if (match) {
      const number = decodeURIComponent(match[1]);
      const text = decodeURIComponent(match[2]);
      termuxSuccess = await callTermuxApi('sms', { number, text });
    }
  }

  // 2. Fallback to browser URL launch if Termux failed or not applicable
  if (!termuxSuccess) {
    safelyOpenUrl(confirmation.executeUrl);
  }

  logPhoneAction({
    tool: confirmation.type,
    status: 'confirmed',
    summary: `Sent/Called: ${confirmation.recipient}`,
    details: { confirmation, method: termuxSuccess ? 'termux' : 'browser' },
  });
}

/**
 * Cancels a pending action
 */
export function cancelPendingAction(confirmation: ActionConfirmationData) {
  logPhoneAction({
    tool: confirmation.type,
    status: 'cancelled',
    summary: `Cancelled: ${confirmation.recipient}`,
    details: { confirmation },
  });
}
