import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Smartphone, ChevronRight, Mic, Camera, Bluetooth, 
  Bell, PhoneCall, Users, Mail, MapPin, Image as ImageIcon, 
  Layers, Shield, Sun, Volume2, Globe, Play, Zap, Clock, Wifi, Lock, Plus, Check, AlertCircle,
  Settings as SettingsIcon
} from 'lucide-react';
import * as Permissions from '../lib/permissions';

interface PermissionItem {
  id: string;
  name: string;
  subtitle: string;
  icon: any;
  status: 'Allowed' | 'Skipped' | 'Needs Android app' | 'Off';
  type: 'runtime' | 'special';
}

const INITIAL_PERMISSIONS: PermissionItem[] = [
  // Basic
  { id: 'camera', name: 'Camera', subtitle: 'Required for photos and visual input', icon: Camera, status: 'Off', type: 'runtime' },
  { id: 'microphone', name: 'Microphone', subtitle: 'Required for voice commands', icon: Mic, status: 'Off', type: 'runtime' },
  { id: 'headphones', name: 'Headphones/Bluetooth', subtitle: 'Connect to audio devices', icon: Bluetooth, status: 'Needs Android app', type: 'runtime' },
  { id: 'notifications', name: 'Notifications', subtitle: 'Send alerts and updates', icon: Bell, status: 'Off', type: 'runtime' },
  { id: 'phoneCalls', name: 'Phone & Calls', subtitle: 'No permission needed · Opens dialer', icon: PhoneCall, status: 'Allowed', type: 'runtime' },
  { id: 'contacts', name: 'Contacts', subtitle: 'Lookup names and numbers for voice actions', icon: Users, status: Permissions.hasContactsApi() ? (Permissions.getSavedContactsCount() > 0 ? 'Allowed' : 'Off') : 'Needs Android app', type: 'runtime' },
  { id: 'sms', name: 'SMS', subtitle: 'Send and read text messages', icon: Mail, status: 'Needs Android app', type: 'runtime' },
  { id: 'location', name: 'Location', subtitle: 'Map and geofencing support', icon: MapPin, status: 'Off', type: 'runtime' },
  { id: 'mediaFiles', name: 'Photos/Media/Files', subtitle: 'Access images and documents', icon: ImageIcon, status: 'Needs Android app', type: 'runtime' },
  // Advanced
  { id: 'displayOverApps', name: 'Display over other apps', subtitle: 'Draw overlays and popups', icon: Layers, status: 'Needs Android app', type: 'special' },
  { id: 'notificationAccess', name: 'Notification access', subtitle: 'Read incoming notification content', icon: Bell, status: 'Needs Android app', type: 'special' },
  { id: 'dndAccess', name: 'Do Not Disturb access', subtitle: 'Manage silent mode settings', icon: Shield, status: 'Needs Android app', type: 'special' },
  { id: 'modifySettings', name: 'Modify system settings', subtitle: 'Change system-level preferences', icon: SettingsIcon || Smartphone, status: 'Needs Android app', type: 'special' },
  { id: 'accessibility', name: 'Accessibility service', subtitle: 'Deep phone automation control', icon: Shield, status: 'Needs Android app', type: 'special' },
  { id: 'batteryOpt', name: 'Ignore battery optimization', subtitle: 'Allow app to run in background', icon: Zap, status: 'Needs Android app', type: 'special' },
];

interface QuickActionItem {
  id: string;
  name: string;
  icon: any;
  requiredPermission: string;
  enabled: boolean;
}

const INITIAL_QUICK_ACTIONS: QuickActionItem[] = [
  { id: 'openApp', name: 'Open any app', icon: Smartphone, requiredPermission: 'displayOverApps', enabled: true },
  { id: 'makeCall', name: 'Phone call', icon: PhoneCall, requiredPermission: 'phoneCalls', enabled: true },
  { id: 'sendSms', name: 'Send SMS', icon: Mail, requiredPermission: 'sms', enabled: true },
  { id: 'openCamera', name: 'Camera / take photo', icon: Camera, requiredPermission: 'camera', enabled: true },
  { id: 'flashlight', name: 'Flashlight', icon: Zap, requiredPermission: 'modifySettings', enabled: true },
  { id: 'wifi', name: 'Wi-Fi', icon: Wifi, requiredPermission: 'modifySettings', enabled: true },
  { id: 'bluetooth', name: 'Bluetooth', icon: Bluetooth, requiredPermission: 'headphones', enabled: true },
  { id: 'volume', name: 'Volume', icon: Volume2, requiredPermission: 'modifySettings', enabled: true },
  { id: 'brightness', name: 'Brightness', icon: Sun, requiredPermission: 'modifySettings', enabled: true },
  { id: 'alarm', name: 'Alarm/Timer', icon: Clock, requiredPermission: 'notifications', enabled: true },
  { id: 'dnd', name: 'Do Not Disturb', icon: Shield, requiredPermission: 'dndAccess', enabled: true },
  { id: 'notifications', name: 'Read notifications', icon: Bell, requiredPermission: 'notificationAccess', enabled: true },
  { id: 'maps', name: 'Maps', icon: MapPin, requiredPermission: 'location', enabled: true },
  { id: 'media', name: 'Media play/pause', icon: Play, requiredPermission: 'mediaFiles', enabled: true },
];

export const PhoneControlHome = ({ settings, setSettings, setCurrentView }: any) => {
  return (
    <div className="fixed inset-0 z-[80] bg-[#020617] overflow-y-auto no-scrollbar flex flex-col">
      <header className="px-5 py-6 flex items-center gap-4 shrink-0">
        <button onClick={() => setCurrentView?.('settings')} className="p-2.5 bg-white/5 rounded-2xl active:scale-95 transition-transform"><ArrowLeft className="w-5 h-5 text-slate-300" /></button>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Phone control</h2>
      </header>
      <div className="px-6 py-4 space-y-4 pb-32">
        <button onClick={() => setCurrentView?.('quick-actions')} className="w-full p-5 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2.5rem] shadow-2xl flex items-center justify-between active:scale-[0.98] transition-all text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black uppercase tracking-wider text-white leading-tight">Quick actions</h4>
              <p className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">Configure device actions and shortcuts</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
        </button>

        <button onClick={() => setCurrentView?.('app-permissions')} className="w-full p-5 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2.5rem] shadow-2xl flex items-center justify-between active:scale-[0.98] transition-all text-left">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black uppercase tracking-wider text-white leading-tight">App permissions</h4>
              <p className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">Manage microphone, calls, and device access</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
        </button>
      </div>
    </div>
  );
};

export const AppPermissionsView = ({ setCurrentView, setToast }: any) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ basic: true, advanced: true });
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('iyabd_permissions_hidden_v5') || '[]'); } catch (e) { return []; }
  });
  const [permissions, setPermissions] = useState<PermissionItem[]>(() => {
    try {
      const saved = localStorage.getItem('iyabd_permissions_list_v5');
      const parsed = saved ? JSON.parse(saved) : {};
      return INITIAL_PERMISSIONS.map(p => {
        const stored = parsed[p.id];
        if (stored === 'Allowed' || stored === 'Granted') return { ...p, status: 'Allowed' as const };
        if (stored === 'Skipped' || stored === 'Denied') return { ...p, status: 'Skipped' as const };
        if (stored === 'Needs Android app') return { ...p, status: 'Needs Android app' as const };
        
        const helperStatus = Permissions.getStoredPermissionStatus(p.id);
        if (helperStatus === 'Needs Android app') return { ...p, status: 'Needs Android app' as const };
        if (helperStatus === 'Allowed') return { ...p, status: 'Allowed' as const };
        if (helperStatus === 'Skipped') return { ...p, status: 'Skipped' as const };

        return { ...p, status: 'Off' as const };
      });
    } catch (e) {}
    return INITIAL_PERMISSIONS.map(p => ({
      ...p,
      status: Permissions.getStoredPermissionStatus(p.id) === 'Needs Android app' ? 'Needs Android app' as const : 'Off' as const
    }));
  });

  const callBridge = (method: string, args: any = {}) => {
    if ((window as any).AndroidIYABD && (window as any).AndroidIYABD[method]) {
      try { (window as any).AndroidIYABD[method](JSON.stringify(args)); } catch (e) {}
    } else {
      console.log(`[Bridge] ${method}`, args);
    }
  };

  const checkStatuses = async () => {
    const isAndroid = typeof window !== 'undefined' && Boolean((window as any).AndroidIYABD);
    let micStatus: 'Allowed' | 'Skipped' | null = null;
    let notifStatus: 'Allowed' | 'Skipped' | null = null;

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const res = await navigator.permissions.query({ name: 'microphone' as any });
        if (res.state === 'granted') micStatus = 'Allowed';
        else if (res.state === 'denied') micStatus = 'Skipped';
      } catch (e) {}
    }
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') notifStatus = 'Allowed';
      else if (Notification.permission === 'denied') notifStatus = 'Skipped';
    }

    setPermissions(prev => {
      const updated = prev.map(p => {
        if (p.id === 'phoneCalls') {
          return { ...p, status: 'Allowed' as const, subtitle: 'No permission needed · Opens dialer' };
        }
        if (p.id === 'contacts') {
          if (!Permissions.hasContactsApi() && !isAndroid) {
            return { ...p, status: 'Needs Android app' as const, subtitle: 'Android app required' };
          }
          const cnt = Permissions.getSavedContactsCount();
          return {
            ...p,
            status: cnt > 0 ? ('Allowed' as const) : ('Off' as const),
            subtitle: cnt > 0 ? `${cnt} contacts saved for voice actions` : 'Tap to pick contacts for voice actions',
          };
        }
        if (!isAndroid && Permissions.ANDROID_ONLY_IDS.includes(p.id as any)) {
          return { ...p, status: 'Needs Android app' as const };
        }
        if (p.id === 'microphone' && micStatus) {
          return { ...p, status: micStatus };
        }
        if (p.id === 'notifications' && notifStatus) {
          return { ...p, status: notifStatus };
        }
        return p;
      });
      return updated;
    });
  };

  useEffect(() => {
    checkStatuses();
    window.addEventListener('focus', checkStatuses);
    return () => window.removeEventListener('focus', checkStatuses);
  }, []);

  const updateSingle = (id: string, status: 'Allowed' | 'Skipped' | 'Needs Android app' | 'Off') => {
    setPermissions(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, status } : p);
      const map: Record<string, string> = {};
      updated.forEach(p => map[p.id] = p.status);
      localStorage.setItem('iyabd_permissions_list_v5', JSON.stringify(map));
      return updated;
    });
  };

  const toggleHide = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = hiddenIds.includes(id) ? hiddenIds.filter(i => i !== id) : [...hiddenIds, id];
    setHiddenIds(next);
    localStorage.setItem('iyabd_permissions_hidden_v5', JSON.stringify(next));
  };

  const handleRowClick = async (perm: PermissionItem) => {
    if ((window as any).AndroidIYABD) {
      if (perm.status === 'Allowed') {
        callBridge('openSettings', { permission: perm.id });
        setToast?.(`Opening settings for ${perm.name}`);
      } else {
        callBridge('requestPermission', { permission: perm.id });
        setToast?.(`Requesting ${perm.name}`);
      }
      return;
    }

    // In Browser:
    if (perm.id === 'phoneCalls') {
      setToast?.("Phone calls are ready via browser dialer");
      updateSingle('phoneCalls', 'Allowed');
      return;
    }

    if (perm.id === 'contacts') {
      if (Permissions.hasContactsApi()) {
        try {
          const selected = await (navigator as any).contacts.select(['name', 'tel'], { multiple: true });
          if (selected && selected.length > 0) {
            const count = Permissions.saveContactsFromPicker(selected);
            setToast?.(`${count} contacts saved for voice actions`);
            checkStatuses();
          }
        } catch (e) {
          console.warn("Contact picker cancelled or error:", e);
        }
      } else {
        setToast?.("Contacts lookup requires native Android app");
      }
      return;
    }

    if (perm.id === 'notifications') {
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (isIframe) {
        setToast?.("Open the app link in a new Chrome tab to allow notifications");
      } else {
        setToast?.("Requesting notification permission...");
      }
      if (typeof Notification !== 'undefined') {
        try {
          const res = await Notification.requestPermission();
          const st = res === 'granted' ? 'Allowed' : 'Skipped';
          updateSingle(perm.id, st);
          setToast?.(st === 'Allowed' ? "Notifications allowed" : "Notifications skipped");
          return;
        } catch (e) {}
      }
      const res = await Permissions.requestNotificationsWithTimeout(8000);
      updateSingle(perm.id, res);
      setToast?.(res === 'Allowed' ? "Notifications allowed" : "Notifications skipped");
      return;
    }

    if (perm.status === 'Needs Android app' || Permissions.ANDROID_ONLY_IDS.includes(perm.id as any)) {
      setToast?.(`${perm.name} requires the native Android app`);
      return;
    }

    if (perm.id === 'microphone') {
      setToast?.("Requesting microphone permission...");
      const res = await Permissions.requestMicrophoneWithTimeout(8000);
      updateSingle(perm.id, res);
      setToast?.(res === 'Allowed' ? "Microphone allowed" : "Microphone skipped");
    } else if (perm.id === 'camera') {
      setToast?.("Requesting camera permission...");
      const res = await Permissions.requestCameraWithTimeout(8000);
      updateSingle(perm.id, res);
      setToast?.(res === 'Allowed' ? "Camera allowed" : "Camera skipped");
    } else if (perm.id === 'location') {
      setToast?.("Requesting location permission...");
      const res = await Permissions.requestLocationWithTimeout(8000);
      updateSingle(perm.id, res);
      setToast?.(res === 'Allowed' ? "Location allowed" : "Location skipped");
    }
  };

  const allowAll = async () => {
    setToast?.("Checking permissions...");

    if ((window as any).AndroidIYABD) {
      callBridge('requestAllPermissions', { permissions: permissions.map(p => p.id) });
      return;
    }

    // Browser implementation: request one by one with 8-second timeouts
    const micRes = await Permissions.requestMicrophoneWithTimeout(8000);
    const notifRes = await Permissions.requestNotificationsWithTimeout(8000);
    const camRes = await Permissions.requestCameraWithTimeout(8000);
    const locRes = await Permissions.requestLocationWithTimeout(8000);

    const map: Record<string, string> = {};
    const updated = permissions.map(p => {
      let st: 'Allowed' | 'Skipped' | 'Needs Android app' | 'Off' = p.status;
      if (p.id === 'microphone') st = micRes;
      else if (p.id === 'notifications') st = notifRes;
      else if (p.id === 'phoneCalls') st = 'Allowed';
      else if (p.id === 'contacts') st = Permissions.hasContactsApi() ? (Permissions.getSavedContactsCount() > 0 ? 'Allowed' : 'Off') : 'Needs Android app';
      else if (p.id === 'camera') st = camRes;
      else if (p.id === 'location') st = locRes;
      else if (Permissions.ANDROID_ONLY_IDS.includes(p.id as any)) st = 'Needs Android app';
      map[p.id] = st;
      return { ...p, status: st };
    });

    setPermissions(updated);
    localStorage.setItem('iyabd_permissions_list_v5', JSON.stringify(map));
    setToast?.("Permissions updated");
  };

  const renderSection = (title: string, id: string, items: PermissionItem[]) => (
    <div className="space-y-1">
      <button 
        onClick={() => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))}
        className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-black text-slate-600 uppercase tracking-widest mt-2"
      >
        <span>{title}</span>
        <ChevronRight className={`w-3 h-3 transition-transform ${expanded[id] ? 'rotate-90' : ''}`} />
      </button>
      {expanded[id] && (
        <div className="bg-[#0F172A]/40 border border-purple-500/10 rounded-2xl overflow-hidden divide-y divide-purple-500/5 shadow-inner">
          {items.map(perm => {
            const Icon = perm.icon;
            const isAllowed = perm.status === 'Allowed';
            const isSkipped = perm.status === 'Skipped';
            const isNeedsAndroid = perm.status === 'Needs Android app';
            const isHidden = hiddenIds.includes(perm.id);

            let badgeText = 'OFF';
            let badgeClass = 'text-slate-500';

            if (isHidden) {
              badgeText = 'HIDDEN';
              badgeClass = 'text-slate-500';
            } else if (perm.id === 'phoneCalls') {
              badgeText = 'READY (opens dialer)';
              badgeClass = 'text-emerald-400 text-[8px] bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold';
            } else if (perm.id === 'contacts') {
              if (Permissions.hasContactsApi()) {
                const count = Permissions.getSavedContactsCount();
                if (count > 0) {
                  badgeText = `${count} CONTACTS SAVED`;
                  badgeClass = 'text-emerald-400 text-[8px] bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold';
                } else {
                  badgeText = 'PICK CONTACT';
                  badgeClass = 'text-purple-300 text-[8px] bg-purple-600/60 border border-purple-500/40 px-2 py-0.5 rounded-full font-bold';
                }
              } else {
                badgeText = 'NEEDS ANDROID APP';
                badgeClass = 'text-purple-400 text-[8px] bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold';
              }
            } else if (perm.id === 'notifications' && isSkipped) {
              badgeText = 'TAP TO RETRY';
              badgeClass = 'text-amber-400 text-[8px] bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold';
            } else if (isAllowed) {
              badgeText = 'ALLOWED';
              badgeClass = 'text-emerald-400';
            } else if (isSkipped) {
              badgeText = 'SKIPPED';
              badgeClass = 'text-amber-400';
            } else if (isNeedsAndroid) {
              badgeText = 'NEEDS ANDROID APP';
              badgeClass = 'text-purple-400 text-[8px] bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold';
            }

            return (
              <button 
                key={perm.id}
                onClick={() => handleRowClick(perm)}
                className="w-full flex items-center justify-between p-3.5 px-4 active:bg-white/5 transition-colors text-left group"
              >
                <div className="flex items-center gap-3.5 min-w-0 pr-2">
                  <div className="w-8 h-8 bg-purple-600/15 border border-purple-500/20 rounded-xl flex items-center justify-center text-purple-400 shrink-0 group-active:scale-90 transition-transform">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[12px] font-black uppercase tracking-tight text-white truncate">{perm.name}</h4>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate">{perm.subtitle}</p>
                  </div>
                </div>
                <span 
                  onClick={(e) => isAllowed && toggleHide(e, perm.id)}
                  className={`text-[9px] font-black uppercase tracking-[2px] shrink-0 ${badgeClass} ${isAllowed ? 'cursor-pointer select-none' : ''}`}
                >
                  {badgeText}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[90] bg-[#020617] overflow-y-auto no-scrollbar flex flex-col">
      <header className="px-5 py-6 flex items-center gap-4 shrink-0">
        <button onClick={() => setCurrentView?.('phone')} className="p-2.5 bg-white/5 rounded-2xl active:scale-95 transition-transform">
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">App permissions</h2>
      </header>

      <div className="px-5 space-y-3 pb-36">
        <button 
          onClick={allowAll}
          className="w-full flex items-center justify-between p-4 bg-purple-600/20 border border-purple-500/30 rounded-2xl active:bg-purple-600/30 transition-colors text-left group shadow-lg"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-purple-900/40 group-active:scale-90 transition-transform">
              <Check className="w-5 h-5" />
            </div>
            <span className="text-[12px] font-black text-white uppercase tracking-[2px]">ALLOW ALL</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>

        <div className="bg-[#0F172A]/40 border border-red-500/20 rounded-2xl p-4 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
            ফুল ফোন কন্ট্রোলের জন্য Android নেটিভ অ্যাপ লাগবে।
          </p>
        </div>

        {renderSection("Basic", "basic", permissions.filter(p => p.type === 'runtime'))}
        {renderSection("Advanced", "advanced", permissions.filter(p => p.type === 'special'))}
      </div>
    </div>
  );
};

export const QuickActionsView = ({ setCurrentView, setToast }: any) => {
  const [expanded, setExpanded] = useState(true);
  const [actions, setActions] = useState<QuickActionItem[]>(() => {
    try {
      const saved = localStorage.getItem('iyabd_quick_actions_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        return INITIAL_QUICK_ACTIONS.map(action => ({
          ...action,
          enabled: parsed.find((a: any) => a.id === action.id)?.enabled ?? action.enabled
        }));
      }
    } catch (e) {}
    return INITIAL_QUICK_ACTIONS;
  });

  const [permissionsStatus, setPermissionsStatus] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('iyabd_permissions_list_v5');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  const toggleAction = (action: QuickActionItem) => {
    const isGranted = permissionsStatus[action.requiredPermission] === 'Granted' || !action.requiredPermission;
    if (!isGranted) {
      setToast?.(`Requires ${action.requiredPermission} permission`);
      setCurrentView?.('app-permissions');
      return;
    }

    const updated = actions.map(a => a.id === action.id ? { ...a, enabled: !a.enabled } : a);
    setActions(updated);
    localStorage.setItem('iyabd_quick_actions_v5', JSON.stringify(updated));
    setToast?.(`${action.name} ${!action.enabled ? 'ENABLED' : 'DISABLED'}`);
  };

  return (
    <div className="fixed inset-0 z-[90] bg-[#020617] overflow-y-auto no-scrollbar flex flex-col">
      <header className="px-5 py-6 flex items-center gap-4 shrink-0">
        <button onClick={() => setCurrentView?.('phone')} className="p-2.5 bg-white/5 rounded-2xl active:scale-95 transition-transform">
          <ArrowLeft className="w-5 h-5 text-slate-300" />
        </button>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Quick actions</h2>
      </header>

      <div className="px-5 space-y-2 pb-36">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-black text-slate-600 uppercase tracking-widest mt-2"
        >
          <span>Device Actions</span>
          <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>

        {expanded && (
          <div className="bg-[#0F172A]/40 border border-purple-500/10 rounded-[2rem] overflow-hidden divide-y divide-purple-500/5 shadow-inner">
            {actions.map(action => {
              const Icon = action.icon;
              const isGranted = permissionsStatus[action.requiredPermission] === 'Granted' || !action.requiredPermission;
              
              return (
                <div key={action.id} className="w-full flex items-center justify-between p-4 px-5 group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-9 h-9 bg-purple-600/15 border border-purple-500/20 rounded-xl flex items-center justify-center text-purple-400 shrink-0 group-active:scale-90 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[13px] font-black uppercase tracking-tight text-white truncate leading-none">{action.name}</h4>
                      <span className={`text-[8px] font-black uppercase tracking-[2px] mt-1.5 block ${!isGranted ? 'text-red-500/70' : action.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {!isGranted ? 'PERMISSION MISSING' : action.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleAction(action)}
                    className={`w-11 h-6 rounded-full transition-all flex items-center px-0.5 shrink-0 ${action.enabled ? 'bg-purple-600 shadow-lg shadow-purple-900/40' : 'bg-slate-700'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${action.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
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
