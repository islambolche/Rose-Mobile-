import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Smartphone, ChevronRight, Mic, Camera,
  Bell, PhoneCall, Users, MapPin,
  Shield, Zap, Check, AlertCircle, Copy, MessageCircle, MessageSquare, Youtube, Facebook, Instagram,
  ExternalLink
} from 'lucide-react';

export interface PermissionItemConfig {
  id: string;
  num: number;
  name: string;
  desc: string;
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
    icon: Users,
    type: 'apk',
    buttonLabel: 'APK-তে আসবে',
  },
  {
    id: 'app_perm_phone_calls',
    num: 7,
    name: 'PHONE CALLS',
    desc: 'সরাসরি ভয়েস নির্দেশে ফোন কল করার সুবিধা APK সংস্করণে যুক্ত হবে।',
    icon: PhoneCall,
    type: 'apk',
    buttonLabel: 'APK-তে আসবে',
  },
  {
    id: 'app_perm_whatsapp',
    num: 8,
    name: 'WHATSAPP',
    desc: 'WhatsApp চ্যাটে বার্তা পাঠানো ও অ্যাপ ওপেন করার সুবিধা যুক্ত হবে।',
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
];

export type PermissionStatusType = 'চালু' | 'বন্ধ' | 'জিজ্ঞেস করা হয়নি' | 'APK-তে আসবে' | 'API সংযোগ পরে আসবে';

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
  const [selectedSubPerm, setSelectedSubPerm] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, PermissionStatusType>>({
    app_perm_camera: 'জিজ্ঞেস করা হয়নি',
    app_perm_microphone: 'জিজ্ঞেস করা হয়নি',
    app_perm_location: 'জিজ্ঞেস করা হয়নি',
    app_perm_notifications: 'জিজ্ঞেস করা হয়নি',
    app_perm_clipboard: 'জিজ্ঞেস করা হয়নি',
    app_perm_contacts: 'APK-তে আসবে',
    app_perm_phone_calls: 'APK-তে আসবে',
    app_perm_whatsapp: 'APK-তে আসবে',
    app_perm_messenger: 'APK-তে আসবে',
    app_perm_youtube: 'API সংযোগ পরে আসবে',
    app_perm_facebook: 'API সংযোগ পরে আসবে',
    app_perm_tiktok: 'API সংযোগ পরে আসবে',
    app_perm_instagram: 'API সংযোগ পরে আসবে',
  });
  const [isProcessing, setIsProcessing] = useState(false);

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

  // Check browser permissions on mount
  const refreshStatuses = async () => {
    const updated: Record<string, PermissionStatusType> = {
      app_perm_contacts: 'APK-তে আসবে',
      app_perm_phone_calls: 'APK-তে আসবে',
      app_perm_whatsapp: 'APK-তে আসবে',
      app_perm_messenger: 'APK-তে আসবে',
      app_perm_youtube: 'API সংযোগ পরে আসবে',
      app_perm_facebook: 'API সংযোগ পরে আসবে',
      app_perm_tiktok: 'API সংযোগ পরে আসবে',
      app_perm_instagram: 'API সংযোগ পরে আসবে',
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
    window.addEventListener('focus', refreshStatuses);
    return () => window.removeEventListener('focus', refreshStatuses);
  }, []);

  const handleAction = async (perm: PermissionItemConfig) => {
    if (perm.type === 'apk') {
      if (perm.actionUrl) {
        window.open(perm.actionUrl, '_blank', 'noopener,noreferrer');
        setToast?.(`${perm.name} খোলা হচ্ছে`);
      }
      return;
    }

    if (perm.type === 'api') {
      if (perm.actionUrl) {
        window.open(perm.actionUrl, '_blank', 'noopener,noreferrer');
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
      } catch (err) {
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
      } catch (err) {
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
      const isDenied = status === 'বন্ধ';

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
              onClick={() => setSelectedSubPerm(null)}
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
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {perm.desc}
                </p>
              </div>

              {/* If denied/blocked callout */}
              {isDenied && perm.browserSettingName && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 shadow-inner">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <div>
                    <p className="font-semibold leading-relaxed">
                      ব্রাউজারের সেটিংস থেকে চালু করো: Chrome → Site settings → {perm.browserSettingName}
                    </p>
                  </div>
                </div>
              )}

              {/* Exactly ONE button */}
              <div className="pt-2">
                {perm.type === 'apk' && !perm.actionUrl ? (
                  <button
                    disabled
                    className="w-full py-4 px-5 rounded-2xl bg-white/5 border border-white/10 text-slate-400 font-bold text-xs uppercase tracking-wider cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    APK-তে আসবে
                  </button>
                ) : (
                  <button
                    disabled={isProcessing}
                    onClick={() => handleAction(perm)}
                    className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <span>অনুরোধ করা হচ্ছে...</span>
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
        {/* Top Summary Line */}
        <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/25 text-center shadow-lg">
          <p className="text-xs font-semibold text-purple-200 leading-relaxed">
            ৫টা অনুমতি এখন দেওয়া যায়, বাকিগুলো APK/API ধাপে আসবে।
          </p>
        </div>

        {/* 13 Separate Bar-Buttons */}
        <div className="space-y-3">
          {PERMISSIONS_CONFIG.map((perm) => {
            const Icon = perm.icon;
            const status = statuses[perm.id] || 'জিজ্ঞেস করা হয়নি';

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
