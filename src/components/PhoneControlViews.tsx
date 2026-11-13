import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Smartphone, ChevronRight, Mic, Camera,
  Bell, PhoneCall, Users, MapPin,
  Shield, Zap, Check, AlertCircle, Copy, MessageCircle, MessageSquare, Youtube, Facebook, Instagram,
  ExternalLink
} from 'lucide-react';
import { openExternal } from '../lib/openExternal';

const NATIVE_APP_PACKAGES: Record<string, string> = {
  app_perm_whatsapp: 'com.whatsapp',
  app_perm_messenger: 'com.facebook.orca',
};

type NativePermAlias = 'camera' | 'microphone' | 'location' | 'notifications' | 'contacts' | 'phone';

const NATIVE_PERM_ALIAS_BY_ID: Record<string, NativePermAlias> = {
  app_perm_camera: 'camera',
  app_perm_microphone: 'microphone',
  app_perm_location: 'location',
  app_perm_notifications: 'notifications',
  app_perm_contacts: 'contacts',
  app_perm_phone_calls: 'phone',
};

const NATIVE_BATCH_ORDER: Array<{ id: string; alias: NativePermAlias; label: string }> = [
  { id: 'app_perm_microphone', alias: 'microphone', label: 'MICROPHONE' },
  { id: 'app_perm_camera', alias: 'camera', label: 'CAMERA' },
  { id: 'app_perm_contacts', alias: 'contacts', label: 'CONTACTS' },
  { id: 'app_perm_phone_calls', alias: 'phone', label: 'PHONE CALLS' },
  { id: 'app_perm_location', alias: 'location', label: 'LOCATION' },
  { id: 'app_perm_notifications', alias: 'notifications', label: 'NOTIFICATIONS' },
];

const WHATSAPP_MESSENGER_NOTE = 'কল ও মেসেজ Rose-কে বললেই হবে; নিজে Send করার সুবিধা পরের আপডেটে';
const CLIPBOARD_APP_NOTE = 'কী-এর ঘরে লম্বা চেপে Paste করা যায়';
const PERMANENT_DENIED_ANDROID_MSG = 'ফোনের Settings → Apps → ROSE → Permissions থেকে চালু করো।';

function checkIsNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as any).Capacitor?.isNativePlatform?.() === true;
}

function getRosePhoneNativePlugin(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).Capacitor?.Plugins?.RosePhone || null;
}

function mapNativePermState(state: unknown): PermissionStatusType {
  if (state === 'granted') return 'চালু';
  if (state === 'denied') return 'বন্ধ';
  return 'জিজ্ঞেস করা হয়নি';
}

export interface PermissionItemConfig {
  id: string;
  num: number;
  name: string;
  desc: string;
  appDesc?: string;
  icon: any;
  type: 'browser' | 'apk' | 'api';
  browserSettingName?: string;
  buttonLabel?: string;
  actionUrl?: string;
}

export const PERMISSIONS_CONFIG: PermissionItemConfig[] = [
  {
    id: 'app_perm_camera',
    num: 1,
    name: 'CAMERA',
    desc: 'Rose আপনার ক্যামেরা ব্যবহার করে ছবি বা চারপাশের দৃশ্য দেখতে পারবে।',
    icon: Camera,
    type: 'browser',
    browserSettingName: 'Camera',
    buttonLabel: 'অনুমতি দাও',
  },
  {
    id: 'app_perm_microphone',
    num: 2,
    name: 'MICROPHONE',
    desc: 'Rose আপনার কণ্ঠ শুনে সরাসরি কথা বলা ও ভয়েস নির্দেশনার জন্য মাইক্রোফোন ব্যবহার করে।',
    icon: Mic,
    type: 'browser',
    browserSettingName: 'Microphone',
    buttonLabel: 'অনুমতি দাও',
  },
  {
    id: 'app_perm_location',
    num: 3,
    name: 'LOCATION',
    desc: 'আপনার বর্তমান অবস্থান, স্থানীয় আবহাওয়া ও দূরত্বের তথ্যের জন্য লোকেশন প্রয়োজন।',
    icon: MapPin,
    type: 'browser',
    browserSettingName: 'Location',
    buttonLabel: 'অনুমতি দাও',
  },
  {
    id: 'app_perm_notifications',
    num: 4,
    name: 'NOTIFICATIONS',
    desc: 'জরুরি বার্তা, রিমাইন্ডার এবং সময়োপযোগী তথ্য পাঠানোর জন্য নোটিফিকেশন প্রয়োজন।',
    icon: Bell,
    type: 'browser',
    browserSettingName: 'Notifications',
    buttonLabel: 'অনুমতি দাও',
  },
  {
    id: 'app_perm_clipboard',
    num: 5,
    name: 'CLIPBOARD',
    desc: 'আপনার কপি করা লেখা সহজে পড়তে এবং চ্যাটে ইনপুট দেওয়ার জন্য ক্লিপবোর্ড অনুমতি দরকার।',
    appDesc: CLIPBOARD_APP_NOTE,
    icon: Copy,
    type: 'browser',
    browserSettingName: 'Clipboard',
    buttonLabel: 'অনুমতি দাও',
  },
  {
    id: 'app_perm_contacts',
    num: 6,
    name: 'CONTACTS',
    desc: 'মোবাইলের কন্টাক্ট তালিকা দেখে ভয়েসে সহজে যোগাযোগের জন্য এই সুবিধা আসবে।',
    appDesc: 'মোবাইলের কন্টাক্ট তালিকা দেখে ভয়েসে সহজে কল ও মেসেজ করার জন্য কন্টাক্ট অনুমতি প্রয়োজন।',
    icon: Users,
    type: 'apk',
    buttonLabel: 'APK-তে আসবে',
  },
  {
    id: 'app_perm_phone_calls',
    num: 7,
    name: 'PHONE CALLS',
    desc: 'সরাসরি ভয়েস নির্দেশে ফোন কল করার সুবিধা APK সংস্করণে যুক্ত হবে।',
    appDesc: 'সরাসরি ভয়েস নির্দেশে ফোন কল করার জন্য ফোন কল অনুমতি প্রয়োজন।',
    icon: PhoneCall,
    type: 'apk',
    buttonLabel: 'APK-তে আসবে',
  },
  {
    id: 'app_perm_whatsapp',
    num: 8,
    name: 'WHATSAPP',
    desc: 'WhatsApp চ্যাটে বার্তা পাঠানো ও অ্যাপ ওপেন করার সুবিধা যুক্ত হবে।',
    appDesc: 'WhatsApp অ্যাপ ওপেন ও কল/মেসেজ শুরু করার জন্য ব্যবহৃত হয়।',
    icon: MessageCircle,
    type: 'apk',
    buttonLabel: 'WhatsApp খোলো',
    actionUrl: 'https://wa.me/',
  },
  {
    id: 'app_perm_messenger',
    num: 9,
    name: 'MESSENGER',
    desc: 'Facebook Messenger-এ দ্রুত বার্তা আদান-প্রদানের জন্য সংযোগ সুবিধা আসবে।',
    appDesc: 'Facebook Messenger অ্যাপ ওপেন ও যোগাযোগের জন্য ব্যবহৃত হয়।',
    icon: MessageSquare,
    type: 'apk',
    buttonLabel: 'Messenger খোলো',
    actionUrl: 'https://m.me/',
  },
  {
    id: 'app_perm_youtube',
    num: 10,
    name: 'YOUTUBE',
    desc: 'YouTube-এ সরাসরি ভিডিও খোঁজা ও চালানোর জন্য API সংযোগ পরে আসবে।',
    icon: Youtube,
    type: 'api',
    buttonLabel: 'YouTube খোলো',
    actionUrl: 'https://www.youtube.com/',
  },
  {
    id: 'app_perm_facebook',
    num: 11,
    name: 'FACEBOOK',
    desc: 'Facebook পোস্ট ও আপডেটের সাথে যুক্ত হওয়ার API সুবিধা পরে আসবে।',
    icon: Facebook,
    type: 'api',
    buttonLabel: 'Facebook খোলো',
    actionUrl: 'https://www.facebook.com/',
  },
  {
    id: 'app_perm_tiktok',
    num: 12,
    name: 'TIKTOK',
    desc: 'TikTok ট্রেন্ডিং ভিডিও ও কন্টেন্ট দেখার সংযোগ সুবিধা পরে আসবে।',
    icon: Smartphone,
    type: 'api',
    buttonLabel: 'TikTok খোলো',
    actionUrl: 'https://www.tiktok.com/',
  },
  {
    id: 'app_perm_instagram',
    num: 13,
    name: 'INSTAGRAM',
    desc: 'Instagram প্রোফাইল ও ফটো শেয়ারিংয়ের সংযোগ সুবিধা পরে আসবে।',
    icon: Instagram,
    type: 'api',
    buttonLabel: 'Instagram খোলো',
    actionUrl: 'https://www.instagram.com/',
  },
  {
    id: 'app_perm_accessibility',
    num: 14,
    name: 'ACCESSIBILITY (অটো-চাপা)',
    desc: 'WhatsApp, Messenger এবং ভিডিও পোস্টে Send/Call/Upload বোতাম অটো-চাপার জন্য Accessibility অনুমতি প্রয়োজন।',
    icon: Zap,
    type: 'apk',
    buttonLabel: 'চালু করো',
  },
];

export type PermissionStatusType = 'চালু' | 'বন্ধ' | 'জিজ্ঞেস করা হয়নি' | 'APK-তে আসবে' | 'API সংযোগ পরে আসবে';

interface BatchPermSummaryItem {
  id: string;
  label: string;
  granted: boolean;
  denied: boolean;
}

export const PhoneControlHome = ({ setCurrentView }: any) => {
  return (
    <div data-current-view="phone_control" className="fixed inset-0 z-[80] bg-[#020617] overflow-y-auto no-scrollbar flex flex-col">
      <header className="px-5 py-6 flex items-center gap-4 shrink-0">
        <button
          data-nav-id="back"
          onClick={() => setCurrentView?.('settings')}
          className="p-2.5 bg-white/5 rounded-2xl active:scale-95 transition-transform"
          aria-label="Back to Settings"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">7. PHONE CONTROL</h2>
      </header>
      <div className="px-6 py-4 space-y-4 pb-32">
        <button
          data-nav-id="quick_actions"
          onClick={() => setCurrentView?.('quick-actions')}
          className="w-full p-5 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2.5rem] shadow-2xl flex items-center justify-between active:scale-[0.98] transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black uppercase tracking-wider text-white leading-tight">1. QUICK ACTIONS</h4>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Device actions & shortcuts</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
        </button>

        <button
          data-nav-id="app_permissions"
          onClick={() => setCurrentView?.('app-permissions')}
          className="w-full p-5 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2.5rem] shadow-2xl flex items-center justify-between active:scale-[0.98] transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black uppercase tracking-wider text-white leading-tight">2. APP PERMISSIONS</h4>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Camera, mic, location & apps</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
        </button>
      </div>
    </div>
  );
};

export const AppPermissionsView = ({ setCurrentView, setToast }: any) => {
  const isApp = checkIsNativeApp();
  const [selectedSubPerm, setSelectedSubPerm] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, PermissionStatusType>>(() => {
    const rosePhone = getRosePhoneNativePlugin();
    const hasOpenApp = isApp && typeof rosePhone?.openApp === 'function';
    return {
      app_perm_camera: 'জিজ্ঞেস করা হয়নি',
      app_perm_microphone: 'জিজ্ঞেস করা হয়নি',
      app_perm_location: 'জিজ্ঞেস করা হয়নি',
      app_perm_notifications: 'জিজ্ঞেস করা হয়নি',
      app_perm_clipboard: isApp ? 'চালু' : 'জিজ্ঞেস করা হয়নি',
      app_perm_contacts: isApp ? 'জিজ্ঞেস করা হয়নি' : 'APK-তে আসবে',
      app_perm_phone_calls: isApp ? 'জিজ্ঞেস করা হয়নি' : 'APK-তে আসবে',
      app_perm_whatsapp: isApp ? (hasOpenApp ? 'চালু' : 'বন্ধ') : 'APK-তে আসবে',
      app_perm_messenger: isApp ? (hasOpenApp ? 'চালু' : 'বন্ধ') : 'APK-তে আসবে',
      app_perm_youtube: 'API সংযোগ পরে আসবে',
      app_perm_facebook: 'API সংযোগ পরে আসবে',
      app_perm_tiktok: 'API সংযোগ পরে আসবে',
      app_perm_instagram: 'API সংযোগ পরে আসবে',
      app_perm_accessibility: isApp ? 'বন্ধ' : 'APK-তে আসবে',
    };
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [permanentlyDenied, setPermanentlyDenied] = useState<Record<string, boolean>>({});
  const failedPackagesRef = React.useRef<Record<string, boolean>>({});
  const [isTestingContacts, setIsTestingContacts] = useState(false);
  const [contactsTestResult, setContactsTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [isGrantingAll, setIsGrantingAll] = useState(false);
  const [grantAllStepText, setGrantAllStepText] = useState<string>('');
  const [grantAllSummary, setGrantAllSummary] = useState<BatchPermSummaryItem[] | null>(null);

  // Sync current app view with global window for nav router visibility checks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__currentAppView = selectedSubPerm || 'app_permissions';
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__currentAppView = null;
      }
    };
  }, [selectedSubPerm]);

  // Check native (in app) or browser (on web) permissions
  const refreshStatuses = async () => {
    const appMode = checkIsNativeApp();
    const rosePhone = getRosePhoneNativePlugin();

    if (appMode) {
      const hasOpenApp = typeof rosePhone?.openApp === 'function';
      const updated: Record<string, PermissionStatusType> = {
        app_perm_camera: 'জিজ্ঞেস করা হয়নি',
        app_perm_microphone: 'জিজ্ঞেস করা হয়নি',
        app_perm_location: 'জিজ্ঞেস করা হয়নি',
        app_perm_notifications: 'জিজ্ঞেস করা হয়নি',
        app_perm_clipboard: 'চালু',
        app_perm_contacts: 'জিজ্ঞেস করা হয়নি',
        app_perm_phone_calls: 'জিজ্ঞেস করা হয়নি',
        app_perm_whatsapp: !hasOpenApp || failedPackagesRef.current.app_perm_whatsapp ? 'বন্ধ' : 'চালু',
        app_perm_messenger: !hasOpenApp || failedPackagesRef.current.app_perm_messenger ? 'বন্ধ' : 'চালু',
        app_perm_youtube: 'API সংযোগ পরে আসবে',
        app_perm_facebook: 'API সংযোগ পরে আসবে',
        app_perm_tiktok: 'API সংযোগ পরে আসবে',
        app_perm_instagram: 'API সংযোগ পরে আসবে',
        app_perm_accessibility: 'বন্ধ',
      };

      if (rosePhone && typeof rosePhone.checkPermissions === 'function') {
        try {
          const nativeRes = await rosePhone.checkPermissions();
          const nextPermanent: Record<string, boolean> = {};
          for (const [permId, alias] of Object.entries(NATIVE_PERM_ALIAS_BY_ID)) {
            const rawState = nativeRes?.[alias];
            updated[permId] = mapNativePermState(rawState);
            nextPermanent[permId] = rawState === 'denied';
          }
          setPermanentlyDenied(prev => ({ ...prev, ...nextPermanent }));
        } catch {
          // Ignore native query error; keep current fallback
        }
      }

      if (rosePhone && typeof rosePhone.isAccessibilityOn === 'function') {
        try {
          const accRes = await rosePhone.isAccessibilityOn();
          const isAccOn =
            typeof accRes === 'boolean'
              ? accRes
              : Boolean(accRes?.enabled ?? accRes?.on ?? accRes?.isOn ?? accRes?.active ?? accRes?.value);
          updated.app_perm_accessibility = isAccOn ? 'চালু' : 'বন্ধ';
        } catch {
          updated.app_perm_accessibility = 'বন্ধ';
        }
      }

      setStatuses(prev => ({ ...prev, ...updated }));
      return;
    }

    // Browser mode: keep existing browser permission checks
    const updated: Record<string, PermissionStatusType> = {
      app_perm_contacts: 'APK-তে আসবে',
      app_perm_phone_calls: 'APK-তে আসবে',
      app_perm_whatsapp: 'APK-তে আসবে',
      app_perm_messenger: 'APK-তে আসবে',
      app_perm_youtube: 'API সংযোগ পরে আসবে',
      app_perm_facebook: 'API সংযোগ পরে আসবে',
      app_perm_tiktok: 'API সংযোগ পরে আসবে',
      app_perm_instagram: 'API সংযোগ পরে আসবে',
      app_perm_accessibility: 'APK-তে আসবে',
    };

    // 1. Camera
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const res = await navigator.permissions.query({ name: 'camera' as any });
        updated.app_perm_camera = res.state === 'granted' ? 'চালু' : res.state === 'denied' ? 'বন্ধ' : 'জিজ্ঞেস করা হয়নি';
      } else {
        const saved = localStorage.getItem('perm_camera_status');
        updated.app_perm_camera = saved === 'granted' ? 'চালু' : saved === 'denied' ? 'বন্ধ' : 'জিজ্ঞেস করা হয়নি';
      }
    } catch {
      const saved = localStorage.getItem('perm_camera_status');
      updated.app_perm_camera = saved === 'granted' ? 'চালু' : saved === 'denied' ? 'বন্ধ' : 'জিজ্ঞেস করা হয়নি';
    }

    // 2. Microphone
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const res = await navigator.permissions.query({ name: 'microphone' as any });
        updated.app_perm_microphone = res.state === 'granted' ? 'চালু' : res.state === 'denied' ? 'বন্ধ' : 'জিজ্ঞেস করা হয়নি';
      } else {
        const saved = localStorage.getItem('perm_mic_status');
        updated.app_perm_microphone = saved === 'granted' ? 'চালু' : saved === 'denied' ? 'বন্ধ' : 'জিজ্ঞেস করা হয়নি';
      }
    } catch {
      const saved = localStorage.getItem('perm_mic_status');
      updated.app_perm_microphone = saved === 'granted' ? 'চালু' : saved === 'denied' ? 'বন্ধ' : 'জিজ্ঞেস করা হয়নি';
    }

    // 3. Location
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const res = await navigator.permissions.query({ name: 'geolocation' as any });
        updated.app_perm_location = res.state === 'granted' ? 'চালু' : res.state === 'denied' ? 'বন্ধ' : 'জিজ্ঞেস করা হয়নি';
      } else {
        const saved = localStorage.getItem('perm_location_status');
        updated.app_perm_location = saved === 'granted' ? 'চালু' : saved === 'denied' ? 'বন্ধ' : 'জিজ্ঞেস করা হয়নি';
      }
    } catch {
      const saved = localStorage.getItem('perm_location_status');
      updated.app_perm_location = saved === 'granted' ? 'চালু' : saved === 'denied' ? 'বন্ধ' : 'জিজ্ঞেস করা হয়নি';
    }

    // 4. Notifications
    try {
      if (typeof Notification !== 'undefined') {
        updated.app_perm_notifications = Notification.permission === 'granted' ? 'চালু' : Notification.permission === 'denied' ? 'বন্ধ' : 'জিজ্ঞেস করা হয়নি';
      } else {
        updated.app_perm_notifications = 'বন্ধ';
      }
    } catch {
      updated.app_perm_notifications = 'জিজ্ঞেস করা হয়নি';
    }

    // 5. Clipboard
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const res = await navigator.permissions.query({ name: 'clipboard-read' as any });
        updated.app_perm_clipboard = res.state === 'granted' ? 'চালু' : res.state === 'denied' ? 'বন্ধ' : 'জিজ্ঞেস করা হয়নি';
      } else {
        const saved = localStorage.getItem('perm_clipboard_status');
        updated.app_perm_clipboard = saved === 'granted' ? 'চালু' : saved === 'denied' ? 'বন্ধ' : 'জিজ্ঞেস করা হয়নি';
      }
    } catch {
      const saved = localStorage.getItem('perm_clipboard_status');
      updated.app_perm_clipboard = saved === 'granted' ? 'চালু' : saved === 'denied' ? 'বন্ধ' : 'জিজ্ঞেস করা হয়নি';
    }

    setStatuses(prev => ({ ...prev, ...updated }));
  };

  useEffect(() => {
    refreshStatuses();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshStatuses();
      }
    };
    window.addEventListener('focus', refreshStatuses);
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('resume', refreshStatuses as EventListener);

    let capAppListenerHandle: any = null;
    const capApp = typeof window !== 'undefined' ? (window as any).Capacitor?.Plugins?.App : null;
    if (capApp && typeof capApp.addListener === 'function') {
      try {
        capAppListenerHandle = capApp.addListener('appStateChange', (state: { isActive?: boolean }) => {
          if (state?.isActive) {
            refreshStatuses();
          }
        });
      } catch {
        // Ignore if Capacitor App plugin isn't installed
      }
    }

    return () => {
      window.removeEventListener('focus', refreshStatuses);
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('resume', refreshStatuses as EventListener);
      if (capAppListenerHandle && typeof capAppListenerHandle.remove === 'function') {
        capAppListenerHandle.remove();
      } else if (capAppListenerHandle && typeof capAppListenerHandle.then === 'function') {
        capAppListenerHandle.then((h: any) => h?.remove?.()).catch(() => {});
      }
    };
  }, []);

  const handleOpenAppSettings = async () => {
    const rosePhone = getRosePhoneNativePlugin();
    if (!rosePhone || typeof rosePhone.openAppSettings !== 'function') {
      setToast?.(PERMANENT_DENIED_ANDROID_MSG);
      return;
    }
    try {
      await rosePhone.openAppSettings();
    } catch {
      setToast?.(PERMANENT_DENIED_ANDROID_MSG);
    }
  };

  const requestNativeRosePermission = async (
    permId: string,
    alias: NativePermAlias
  ): Promise<{ granted: boolean; denied: boolean }> => {
    const rosePhone = getRosePhoneNativePlugin();
    if (!rosePhone || typeof rosePhone.requestPermissions !== 'function') {
      return { granted: false, denied: false };
    }
    try {
      const res = await rosePhone.requestPermissions({ permissions: [alias] });
      let state = res?.[alias];

      // Re-check via checkPermissions so status accurately reflects OS state
      if (typeof rosePhone.checkPermissions === 'function') {
        try {
          const checkRes = await rosePhone.checkPermissions();
          if (checkRes && checkRes[alias] !== undefined) {
            state = checkRes[alias];
          }
        } catch {
          // Use requestPermissions result
        }
      }

      const mapped = mapNativePermState(state);
      const isPermDenied = state === 'denied';
      setStatuses(prev => ({ ...prev, [permId]: mapped }));
      setPermanentlyDenied(prev => ({ ...prev, [permId]: isPermDenied }));
      await refreshStatuses();
      return { granted: state === 'granted', denied: isPermDenied };
    } catch {
      await refreshStatuses();
      return { granted: false, denied: false };
    }
  };

  const handleTestContacts = async () => {
    const rosePhone = getRosePhoneNativePlugin();
    if (!rosePhone || typeof rosePhone.getAllContacts !== 'function') {
      setContactsTestResult({ ok: false, text: 'কন্টাক্ট প্লাগইন পাওয়া যায়নি' });
      return;
    }
    setIsTestingContacts(true);
    setContactsTestResult(null);
    try {
      const res = await rosePhone.getAllContacts();
      const count = Array.isArray(res?.contacts) ? res.contacts.length : 0;
      const msg = `মোট ${count} টা কন্টাক্ট পাওয়া গেছে`;
      setContactsTestResult({ ok: true, text: msg });
      setToast?.(msg);
      await refreshStatuses();
    } catch (err: any) {
      await refreshStatuses();
      const errMsg = String(err?.message || 'কন্টাক্ট আনা যায়নি — আগে অনুমতি দাও');
      setContactsTestResult({ ok: false, text: errMsg });
      setToast?.(errMsg);
    } finally {
      setIsTestingContacts(false);
    }
  };

  const handleRequestAllPermissions = async () => {
    if (!isApp || isGrantingAll || isProcessing) return;
    setIsGrantingAll(true);
    setGrantAllSummary(null);
    const summary: BatchPermSummaryItem[] = [];

    try {
      for (let i = 0; i < NATIVE_BATCH_ORDER.length; i++) {
        const item = NATIVE_BATCH_ORDER[i];
        setGrantAllStepText(`${i + 1}/${NATIVE_BATCH_ORDER.length}: ${item.label}...`);
        const res = await requestNativeRosePermission(item.id, item.alias);
        summary.push({
          id: item.id,
          label: item.label,
          granted: res.granted,
          denied: res.denied,
        });
      }

      await refreshStatuses();
      setGrantAllSummary(summary);
      const grantedCount = summary.filter(i => i.granted).length;
      setToast?.(`${grantedCount}/${NATIVE_BATCH_ORDER.length}টি অনুমতি চালু হয়েছে`);
    } finally {
      setGrantAllStepText('');
      setIsGrantingAll(false);
    }
  };

  const handleAction = async (perm: PermissionItemConfig) => {
    // Native Android app path: use RosePhone plugin exclusively (no navigator.permissions / WebView prompts)
    if (isApp) {
      const rosePhone = getRosePhoneNativePlugin();
      const nativeAlias = NATIVE_PERM_ALIAS_BY_ID[perm.id];

      if (nativeAlias) {
        setIsProcessing(true);
        try {
          const { granted, denied } = await requestNativeRosePermission(perm.id, nativeAlias);
          if (granted) {
            setToast?.(`${perm.name} অনুমতি চালু হয়েছে`);
          } else if (denied) {
            setToast?.(`${perm.name} অনুমতি বন্ধ করা হয়েছে — ফোনের সেটিংস থেকে চালু করো`);
          } else {
            setToast?.(`${perm.name} অনুমতি দেওয়া হয়নি`);
          }
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      if (perm.id === 'app_perm_clipboard') {
        setToast?.(CLIPBOARD_APP_NOTE);
        return;
      }

      if (perm.id === 'app_perm_accessibility') {
        if (rosePhone && typeof rosePhone.openAccessibilitySettings === 'function') {
          try {
            await rosePhone.openAccessibilitySettings();
            setToast?.('Accessibility সেটিংস খোলা হচ্ছে — ROSE চালু করো');
          } catch {
            setToast?.('Accessibility সেটিংস খোলা যায়নি');
          }
        } else {
          setToast?.('Accessibility প্লাগইন পাওয়া যায়নি');
        }
        return;
      }

      if (perm.id === 'app_perm_whatsapp' || perm.id === 'app_perm_messenger') {
        const pkg = NATIVE_APP_PACKAGES[perm.id];
        if (rosePhone && typeof rosePhone.openApp === 'function' && pkg) {
          setIsProcessing(true);
          try {
            await rosePhone.openApp({ package: pkg });
            failedPackagesRef.current[perm.id] = false;
            setStatuses(prev => ({ ...prev, [perm.id]: 'চালু' }));
            setToast?.(`${perm.name} খোলা হচ্ছে`);
          } catch {
            failedPackagesRef.current[perm.id] = true;
            setStatuses(prev => ({ ...prev, [perm.id]: 'বন্ধ' }));
            setToast?.(`${perm.name} ফোনে ইনস্টল করা নেই বা খোলা যায়নি`);
          } finally {
            setIsProcessing(false);
          }
          return;
        }
      }

      if (perm.actionUrl) {
        openExternal(perm.actionUrl);
        setToast?.(`${perm.name} খোলা হচ্ছে`);
      }
      return;
    }

    // Browser mode: preserve existing browser behavior
    if (perm.type === 'apk') {
      if (perm.actionUrl) {
        openExternal(perm.actionUrl);
        setToast?.(`${perm.name} খোলা হচ্ছে`);
      }
      return;
    }

    if (perm.type === 'api') {
      if (perm.actionUrl) {
        openExternal(perm.actionUrl);
        setToast?.(`${perm.name} খোলা হচ্ছে`);
      }
      return;
    }

    // Browser Permissions
    setIsProcessing(true);

    if (perm.id === 'app_perm_camera') {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setStatuses(prev => ({ ...prev, app_perm_camera: 'বন্ধ' }));
          setToast?.('ক্যামেরা সমর্থিত নয়');
          setIsProcessing(false);
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(t => t.stop());
        setStatuses(prev => ({ ...prev, app_perm_camera: 'চালু' }));
        localStorage.setItem('perm_camera_status', 'granted');
        setToast?.('ক্যামেরা অনুমতি চালু হয়েছে');
      } catch {
        setStatuses(prev => ({ ...prev, app_perm_camera: 'বন্ধ' }));
        localStorage.setItem('perm_camera_status', 'denied');
        setToast?.('ক্যামেরা অনুমতি দেওয়া হয়নি');
      } finally {
        setIsProcessing(false);
      }
    } else if (perm.id === 'app_perm_microphone') {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setStatuses(prev => ({ ...prev, app_perm_microphone: 'বন্ধ' }));
          setToast?.('মাইক্রোফোন সমর্থিত নয়');
          setIsProcessing(false);
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        setStatuses(prev => ({ ...prev, app_perm_microphone: 'চালু' }));
        localStorage.setItem('perm_mic_status', 'granted');
        setToast?.('মাইক্রোফোন অনুমতি চালু হয়েছে');
      } catch {
        setStatuses(prev => ({ ...prev, app_perm_microphone: 'বন্ধ' }));
        localStorage.setItem('perm_mic_status', 'denied');
        setToast?.('মাইক্রোফোন অনুমতি দেওয়া হয়নি');
      } finally {
        setIsProcessing(false);
      }
    } else if (perm.id === 'app_perm_location') {
      if (!navigator.geolocation) {
        setStatuses(prev => ({ ...prev, app_perm_location: 'বন্ধ' }));
        setToast?.('লোকেশন সমর্থিত নয়');
        setIsProcessing(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        () => {
          setStatuses(prev => ({ ...prev, app_perm_location: 'চালু' }));
          localStorage.setItem('perm_location_status', 'granted');
          setToast?.('লোকেশন অনুমতি চালু হয়েছে');
          setIsProcessing(false);
        },
        () => {
          setStatuses(prev => ({ ...prev, app_perm_location: 'বন্ধ' }));
          localStorage.setItem('perm_location_status', 'denied');
          setToast?.('লোকেশন অনুমতি দেওয়া হয়নি');
          setIsProcessing(false);
        },
        { timeout: 10000 }
      );
    } else if (perm.id === 'app_perm_notifications') {
      if (typeof Notification === 'undefined') {
        setStatuses(prev => ({ ...prev, app_perm_notifications: 'বন্ধ' }));
        setToast?.('নোটিফিকেশন সমর্থিত নয়');
        setIsProcessing(false);
        return;
      }
      try {
        const res = await Notification.requestPermission();
        if (res === 'granted') {
          setStatuses(prev => ({ ...prev, app_perm_notifications: 'চালু' }));
          setToast?.('নোটিফিকেশন অনুমতি চালু হয়েছে');
        } else {
          setStatuses(prev => ({ ...prev, app_perm_notifications: 'বন্ধ' }));
          setToast?.('নোটিফিকেশন অনুমতি দেওয়া হয়নি');
        }
      } catch {
        setStatuses(prev => ({ ...prev, app_perm_notifications: 'বন্ধ' }));
      } finally {
        setIsProcessing(false);
      }
    } else if (perm.id === 'app_perm_clipboard') {
      try {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          setStatuses(prev => ({ ...prev, app_perm_clipboard: 'বন্ধ' }));
          setToast?.('ক্লিপবোর্ড সমর্থিত নয়');
          setIsProcessing(false);
          return;
        }
        await navigator.clipboard.readText();
        setStatuses(prev => ({ ...prev, app_perm_clipboard: 'চালু' }));
        localStorage.setItem('perm_clipboard_status', 'granted');
        setToast?.('ক্লিপবোর্ড অনুমতি চালু হয়েছে');
      } catch {
        setStatuses(prev => ({ ...prev, app_perm_clipboard: 'বন্ধ' }));
        localStorage.setItem('perm_clipboard_status', 'denied');
        setToast?.('ক্লিপবোর্ড অনুমতি দেওয়া হয়নি');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const renderStatusPill = (status: PermissionStatusType) => {
    let colorClass = 'bg-slate-800 text-slate-300 border-slate-700';
    if (status === 'চালু') {
      colorClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    } else if (status === 'বন্ধ') {
      colorClass = 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    } else if (status === 'জিজ্ঞেস করা হয়নি') {
      colorClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    } else if (status === 'APK-তে আসবে') {
      colorClass = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    } else if (status === 'API সংযোগ পরে আসবে') {
      colorClass = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    }

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 ${colorClass}`}>
        {status}
      </span>
    );
  };

  // If a sub-permission is selected, render its small page
  if (selectedSubPerm) {
    const perm = PERMISSIONS_CONFIG.find(p => p.id === selectedSubPerm);
    if (perm) {
      const Icon = perm.icon;
      const status = statuses[perm.id] || 'জিজ্ঞেস করা হয়নি';
      const isWhatsAppOrMessenger = perm.id === 'app_perm_whatsapp' || perm.id === 'app_perm_messenger';
      const isNativePerm = Boolean(NATIVE_PERM_ALIAS_BY_ID[perm.id]);
      const isClipboardInApp = isApp && perm.id === 'app_perm_clipboard';
      const isDeniedTwice = isApp && isNativePerm && (status === 'বন্ধ' || Boolean(permanentlyDenied[perm.id]));
      const isBrowserDenied = !isApp && status === 'বন্ধ' && Boolean(perm.browserSettingName);
      const displayDesc = isApp && perm.appDesc ? perm.appDesc : perm.desc;

      return (
        <div
          data-current-view={perm.id}
          data-nav-id={perm.id}
          className="fixed inset-0 z-[90] bg-[#020617] text-white overflow-y-auto no-scrollbar flex flex-col"
        >
          {/* Header with back button */}
          <header className="px-5 py-6 flex items-center gap-4 shrink-0 border-b border-purple-500/20 bg-[#0A051C]/90 backdrop-blur-md sticky top-0 z-50">
            <button
              data-nav-id="back"
              onClick={() => {
                setContactsTestResult(null);
                setSelectedSubPerm(null);
              }}
              className="p-2.5 bg-white/5 rounded-2xl active:scale-95 transition-transform border border-white/10 text-slate-300 hover:text-white"
              aria-label="Back to App Permissions"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-black uppercase tracking-wider text-white leading-tight">
                {perm.num}. {perm.name}
              </h2>
              <p className="text-[10px] font-bold uppercase text-purple-300 tracking-wider">
                App Permissions · {perm.name}
              </p>
            </div>
          </header>

          <main className="flex-1 p-5 max-w-lg w-full mx-auto space-y-5 pb-36">
            {/* Permission Detail Card */}
            <div className="p-6 rounded-[2.5rem] bg-[#0F172A]/90 border border-purple-500/30 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-white">
                      {perm.name}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">
                      স্ট্যাটাস
                    </span>
                  </div>
                </div>
                {renderStatusPill(status)}
              </div>

              {/* Description (Bengali, 1-2 lines) */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {displayDesc}
                </p>
                {isApp && isWhatsAppOrMessenger && (
                  <p className="text-xs text-purple-300 leading-relaxed font-semibold">
                    {WHATSAPP_MESSENGER_NOTE}
                  </p>
                )}
              </div>

              {/* Denied twice callout in Android app */}
              {isDeniedTwice && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-3 shadow-inner">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <p className="font-semibold leading-relaxed">
                      {PERMANENT_DENIED_ANDROID_MSG}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAppSettings}
                    className="w-full py-3 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-100 font-black text-xs tracking-wide active:scale-[0.98] transition-all"
                  >
                    ফোনের সেটিংস খোলো
                  </button>
                </div>
              )}

              {/* Browser denied callout */}
              {isBrowserDenied && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 shadow-inner">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <p className="font-semibold leading-relaxed">
                      ব্রাউজারের সেটিংস থেকে চালু করো: Chrome → Site settings → {perm.browserSettingName}
                    </p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!isClipboardInApp && (
                <div className="pt-2 space-y-3">
                  {!isApp && perm.type === 'apk' && !perm.actionUrl ? (
                    <button
                      disabled
                      className="w-full py-4 px-5 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-bold text-xs uppercase tracking-wider cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      APK-তে আসবে
                    </button>
                  ) : isApp && isNativePerm ? (
                    <>
                      <button
                        disabled={isProcessing || isTestingContacts}
                        onClick={() => handleAction(perm)}
                        className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4 text-purple-200" />
                        <span>{isProcessing ? 'অনুরোধ করা হচ্ছে...' : 'অনুমতি দাও'}</span>
                      </button>

                      {perm.id === 'app_perm_contacts' && (
                        <button
                          disabled={isProcessing || isTestingContacts}
                          onClick={handleTestContacts}
                          className="w-full py-3.5 px-5 rounded-2xl bg-white/10 hover:bg-white/15 border border-purple-500/30 text-purple-100 font-black text-xs uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                          <Users className="w-4 h-4 text-purple-300" />
                          <span>{isTestingContacts ? 'পরীক্ষা করা হচ্ছে...' : 'পরীক্ষা করো'}</span>
                        </button>
                      )}

                      {perm.id === 'app_perm_contacts' && contactsTestResult && (
                        <div
                          className={`p-3.5 rounded-2xl border text-xs font-semibold text-center ${
                            contactsTestResult.ok
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                          }`}
                        >
                          {contactsTestResult.text}
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      disabled={isProcessing}
                      onClick={() => handleAction(perm)}
                      className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      {isProcessing ? (
                        <span>অনুরোধ করা হচ্ছে...</span>
                      ) : isApp && perm.id === 'app_perm_accessibility' ? (
                        <>
                          <Zap className="w-4 h-4 text-purple-200" />
                          <span>চালু করো</span>
                        </>
                      ) : isApp && isWhatsAppOrMessenger ? (
                        <>
                          <span>খোলো</span>
                          <ExternalLink className="w-4 h-4 text-purple-200" />
                        </>
                      ) : perm.actionUrl ? (
                        <>
                          <span>{perm.buttonLabel}</span>
                          <ExternalLink className="w-4 h-4 text-purple-200" />
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-purple-200" />
                          <span>{status === 'চালু' ? 'পুনরায় অনুমতি পরীক্ষা করো' : (perm.buttonLabel || 'অনুমতি দাও')}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      );
    }
  }

  // Main App Permissions Page (13 separate bar-buttons)
  return (
    <div
      data-current-view="app_permissions"
      data-nav-id="app_permissions"
      className="fixed inset-0 z-[90] bg-[#020617] text-white overflow-y-auto no-scrollbar flex flex-col"
    >
      <header className="px-5 py-6 flex items-center gap-4 shrink-0 border-b border-purple-500/20 bg-[#0A051C]/90 backdrop-blur-md sticky top-0 z-50">
        <button
          data-nav-id="back"
          onClick={() => setCurrentView?.('phone')}
          className="p-2.5 bg-white/5 rounded-2xl active:scale-95 transition-transform border border-white/10 text-slate-300 hover:text-white"
          aria-label="Back to Phone Control"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <div>
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">
            2. APP PERMISSIONS
          </h2>
          <p className="text-[10px] font-bold uppercase text-purple-300 tracking-wider">
            Phone Control Subsystem
          </p>
        </div>
      </header>

      <div className="px-5 py-4 space-y-4 pb-36 max-w-lg w-full mx-auto">
        {isApp ? (
          <div className="space-y-3">
            <button
              disabled={isGrantingAll || isProcessing}
              onClick={handleRequestAllPermissions}
              className="w-full py-4 px-5 rounded-[2rem] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white font-black text-sm tracking-wide active:scale-[0.98] transition-all shadow-xl flex items-center justify-center gap-2.5"
            >
              <Shield className="w-5 h-5 text-purple-100 shrink-0" />
              <span>{isGrantingAll ? (grantAllStepText || 'অনুমতি চাওয়া হচ্ছে...') : 'সব অনুমতি একসাথে দাও'}</span>
            </button>

            {grantAllSummary && (
              <div className="p-4 rounded-2xl bg-[#0F172A]/95 border border-purple-500/30 shadow-lg space-y-2.5">
                <p className="text-[11px] font-black uppercase tracking-wider text-purple-300">
                  অনুমতির সারসংক্ষেপ
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {grantAllSummary.map((item) => (
                    <div
                      key={item.id}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between ${
                        item.granted
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      <span className="shrink-0 font-black">
                        {item.granted ? '✓' : '✗'}
                      </span>
                    </div>
                  ))}
                </div>
                {grantAllSummary.some((item) => item.denied) && (
                  <div className="pt-1 space-y-2">
                    <p className="text-[11px] text-rose-300 font-semibold leading-relaxed">
                      {PERMANENT_DENIED_ANDROID_MSG}
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenAppSettings}
                      className="w-full py-2.5 px-4 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-100 font-black text-xs tracking-wide active:scale-[0.98] transition-all"
                    >
                      ফোনের সেটিংস খোলো
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Top Summary Line (Browser mode) */
          <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/25 text-center shadow-lg">
            <p className="text-xs font-semibold text-purple-200 leading-relaxed">
              ৫টা অনুমতি এখন দেওয়া যায়, বাকিগুলো APK/API ধাপে আসবে।
            </p>
          </div>
        )}

        {/* 13 Separate Bar-Buttons */}
        <div className="space-y-3">
          {PERMISSIONS_CONFIG.map((perm) => {
            const Icon = perm.icon;
            const status = statuses[perm.id] || 'জিজ্ঞেস করা হয়নি';
            const isWhatsAppOrMessenger = perm.id === 'app_perm_whatsapp' || perm.id === 'app_perm_messenger';
            const isAccessibilityBar = perm.id === 'app_perm_accessibility';
            const isNativePerm = Boolean(NATIVE_PERM_ALIAS_BY_ID[perm.id]);
            const isClipboardInApp = isApp && perm.id === 'app_perm_clipboard';
            const isDeniedTwice = isApp && isNativePerm && (status === 'বন্ধ' || Boolean(permanentlyDenied[perm.id]));

            if (!isApp) {
              return (
                <button
                  key={perm.id}
                  data-nav-id={perm.id}
                  onClick={() => setSelectedSubPerm(perm.id)}
                  className="w-full p-4 sm:p-5 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2.5rem] shadow-2xl flex items-center justify-between active:scale-[0.98] transition-all text-left group"
                >
                  <div className="flex items-center gap-4 min-w-0 pr-2">
                    <div className="w-12 h-12 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 group-active:scale-90 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base font-black uppercase tracking-wider text-white leading-tight truncate">
                        {perm.num}. {perm.name}
                      </h4>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                          স্ট্যাটাস:
                        </span>
                        {renderStatusPill(status)}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 shrink-0 group-hover:text-purple-400 transition-colors" />
                </button>
              );
            }

            return (
              <div
                key={perm.id}
                data-nav-id={perm.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedSubPerm(perm.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedSubPerm(perm.id);
                  }
                }}
                className="w-full p-4 sm:p-5 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2.5rem] shadow-2xl text-left group cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0 pr-2">
                    <div className="w-12 h-12 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 group-active:scale-90 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base font-black uppercase tracking-wider text-white leading-tight truncate">
                        {perm.num}. {perm.name}
                      </h4>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                          স্ট্যাটাস:
                        </span>
                        {renderStatusPill(status)}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 shrink-0 group-hover:text-purple-400 transition-colors" />
                </div>

                {isClipboardInApp && (
                  <p className="mt-2.5 text-[11px] text-emerald-300/90 font-medium leading-snug">
                    {CLIPBOARD_APP_NOTE}
                  </p>
                )}

                {isWhatsAppOrMessenger && (
                  <p className="mt-2.5 text-[11px] text-purple-300/90 font-medium leading-snug">
                    {WHATSAPP_MESSENGER_NOTE}
                  </p>
                )}

                {isDeniedTwice && (
                  <p className="mt-2.5 text-[11px] text-rose-300/90 font-medium leading-snug">
                    {PERMANENT_DENIED_ANDROID_MSG}
                  </p>
                )}

                {(isNativePerm || isWhatsAppOrMessenger || isAccessibilityBar) && (
                  <div
                    className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isAccessibilityBar && (
                      <button
                        type="button"
                        disabled={isProcessing || isGrantingAll}
                        onClick={() => handleAction(perm)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white font-black text-xs tracking-wide active:scale-95 transition-all inline-flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 text-purple-200" />
                        <span>চালু করো</span>
                      </button>
                    )}

                    {isNativePerm && (
                      <button
                        type="button"
                        disabled={isProcessing || isTestingContacts || isGrantingAll}
                        onClick={() => handleAction(perm)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white font-black text-xs tracking-wide active:scale-95 transition-all"
                      >
                        অনুমতি দাও
                      </button>
                    )}

                    {perm.id === 'app_perm_contacts' && (
                      <button
                        type="button"
                        disabled={isProcessing || isTestingContacts || isGrantingAll}
                        onClick={handleTestContacts}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-purple-500/30 disabled:opacity-60 text-purple-100 font-black text-xs tracking-wide active:scale-95 transition-all"
                      >
                        {isTestingContacts ? 'পরীক্ষা করা হচ্ছে...' : 'পরীক্ষা করো'}
                      </button>
                    )}

                    {isDeniedTwice && (
                      <button
                        type="button"
                        disabled={isProcessing || isGrantingAll}
                        onClick={handleOpenAppSettings}
                        className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 disabled:opacity-60 text-rose-100 font-black text-xs tracking-wide active:scale-95 transition-all"
                      >
                        ফোনের সেটিংস খোলো
                      </button>
                    )}

                    {isWhatsAppOrMessenger && (
                      <button
                        type="button"
                        disabled={isProcessing || isGrantingAll}
                        onClick={() => handleAction(perm)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-60 text-white font-black text-xs tracking-wide active:scale-95 transition-all inline-flex items-center gap-1.5"
                      >
                        <span>খোলো</span>
                        <ExternalLink className="w-3.5 h-3.5 text-purple-200" />
                      </button>
                    )}
                  </div>
                )}

                {perm.id === 'app_perm_contacts' && contactsTestResult && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className={`mt-2.5 p-2.5 rounded-xl border text-xs font-semibold text-center ${
                      contactsTestResult.ok
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {contactsTestResult.text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const QuickActionsView = ({ setCurrentView, setToast }: any) => {
  return (
    <div data-current-view="quick_actions" className="fixed inset-0 z-[90] bg-[#020617] overflow-y-auto no-scrollbar flex flex-col">
      <header className="px-5 py-6 flex items-center gap-4 shrink-0">
        <button
          data-nav-id="back"
          onClick={() => setCurrentView?.('phone')}
          className="p-2.5 bg-white/5 rounded-2xl active:scale-95 transition-transform"
          aria-label="Back to Phone Control"
        >
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">1. Quick actions</h2>
      </header>

      <div className="px-5 space-y-4 pb-36 max-w-lg w-full mx-auto">
        <div className="p-5 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2.5rem] shadow-2xl text-center space-y-2">
          <Zap className="w-10 h-10 text-purple-400 mx-auto" />
          <h4 className="text-base font-black uppercase text-white">Device Shortcuts</h4>
          <p className="text-xs text-slate-400">
            Quick device actions and automation triggers for mobile and desktop.
          </p>
        </div>
      </div>
    </div>
  );
};

export class PhoneErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("Error Boundary caught:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[200] bg-[#020617] flex flex-col items-center justify-center p-6 text-center">
          <p className="text-white font-black uppercase tracking-wider mb-6">Something went wrong. Tap to go back Home.</p>
          <button onClick={() => window.location.href = '/'} className="px-8 py-4 bg-purple-600 rounded-full font-black uppercase text-white shadow-lg">Go Home</button>
        </div>
      );
    }
    return this.props.children;
  }
}
