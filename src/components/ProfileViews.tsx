import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Sparkles, ChevronRight, User, Shield, Smile, Globe, Volume2, Pencil, Trash2, 
  ToggleRight, ToggleLeft, Facebook, Youtube, Instagram, MessageCircle, Send, Image as ImageIcon,
  Save, Lock, ExternalLink, Eye, EyeOff, LogOut, Loader2, AlertTriangle, Smartphone
} from 'lucide-react';
import { AssistantSettings, UserPreferences } from '../types';
import { supabase } from '../lib/supabase';

const ADMIN_EMAIL = "islambolche@gmail.com";

const isAiStudioPreview = () => {
  if (typeof window === 'undefined') return false;
  const isIframe = window.self !== window.top;
  const isAiStudioUrl = 
    window.location.hostname.endsWith(".usercontent.goog") || 
    window.location.hostname.includes("aistudio") ||
    (isIframe && (document.referrer.includes("aistudio.google.com") || (window.location as any).ancestorOrigins?.contains?.("https://aistudio.google.com")));
  return isAiStudioUrl;
};

// Branded SVG Logos
const FacebookLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#1877F2]">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const YoutubeLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#FF0000]">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

const TikTokLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.03 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.9-.32-1.98-.23-2.81.33-.76.51-1.2 1.43-1.1 2.34.01.52.17 1.03.47 1.47.5.76 1.44 1.22 2.34 1.14 1.25-.03 2.35-1.1 2.44-2.35.09-2.52.01-5.04.01-7.56V.02z" fill="white"/>
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.03 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.9-.32-1.98-.23-2.81.33-.76.51-1.2 1.43-1.1 2.34.01.52.17 1.03.47 1.47.5.76 1.44 1.22 2.34 1.14 1.25-.03 2.35-1.1 2.44-2.35.09-2.52.01-5.04.01-7.56V.02z" fill="none" stroke="#25F4EE" strokeWidth="0.5" />
  </svg>
);

const WhatsAppLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#25D366]">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.67 1.437 5.662 1.437h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const TelegramLogo = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#229ED9]">
    <path d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12z" fill="none" opacity=".1"/>
    <path d="M18.35 6.033l-16.14 6.223c-1.1.442-1.094 1.056-.201 1.33l4.144 1.293 9.593-6.052c.453-.274.868-.127.527.176l-7.773 7.013-.303 4.542c.445 0 .641-.204.89-.446l2.138-2.078 4.448 3.284c.82.452 1.41.22 1.614-.76l2.92-13.766c.299-1.2-.456-1.743-1.24-.13z" fill="#229ED9"/>
  </svg>
);

export const ProfileView = ({ settings, prefs, setSettings, setPrefs, setCurrentView }: any) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(settings.assistantName || 'ROSE');

  return (
    <div className="fixed inset-0 z-[80] bg-[#020617] overflow-y-auto no-scrollbar flex flex-col">
      <header className="px-5 py-6 flex items-center gap-4 shrink-0">
        <button onClick={() => setCurrentView('settings')} className="p-2.5 bg-white/5 rounded-2xl"><ArrowLeft className="w-5 h-5 text-slate-300" /></button>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Profile</h2>
      </header>
      
      <div className="flex flex-col items-center px-6 pt-4 pb-40">
        <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 border-4 border-[#020617] flex items-center justify-center shadow-2xl mb-4 relative">
          <Sparkles className="w-10 h-10 text-white" />
          <div className="absolute inset-0 rounded-full border-2 border-purple-500/30" />
        </div>
        <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase mb-8">{settings.ownerName || "Tell me your name"}</h1>

        {/* YOU Section */}
        <div className="w-full space-y-4 mb-8">
          <div className="flex items-center gap-2 px-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-black uppercase tracking-[3px] text-slate-400">YOU</span>
          </div>
          <div className="bg-[#0F172A]/80 border border-purple-500/30 rounded-[2rem] overflow-hidden">
            <button onClick={() => {
              const newName = prompt("Enter your name:", settings.ownerName || '');
              if (newName !== null) {
                const trimmed = newName.trim().substring(0, 30);
                localStorage.setItem('userName', trimmed);
                setSettings((s: AssistantSettings) => ({ ...s, ownerName: trimmed }));
              }
            }} className="w-full flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-3"><Pencil className="w-5 h-5 text-purple-400" /><span className="text-sm font-bold text-white">Your name</span></div>
              <div className="flex items-center gap-2"><span className="text-xs text-slate-400">{settings.ownerName || "Tell me your name"}</span><ChevronRight className="w-4 h-4 text-slate-500" /></div>
            </button>
            <button onClick={() => setCurrentView('privacy')} className="w-full flex items-center justify-between p-4">
              <div className="flex items-center gap-3"><Shield className="w-5 h-5 text-purple-400" /><span className="text-sm font-bold text-white">Privacy controls</span></div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* YOUR ASSISTANT Section */}
        <div className="w-full space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-black uppercase tracking-[3px] text-slate-400">YOUR ASSISTANT</span>
          </div>
          <div className="bg-[#0F172A]/80 border border-purple-500/30 rounded-[2rem] overflow-hidden">
            <button onClick={() => {
                setTempName(settings.assistantName || 'ROSE');
                setIsEditingName(true);
            }} className="w-full flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-3"><Sparkles className="w-5 h-5 text-purple-400" /><span className="text-sm font-bold text-white">Name</span></div>
              <div className="flex items-center gap-2"><span className="text-xs text-slate-400">{settings.assistantName || "ROSE"}</span><ChevronRight className="w-4 h-4 text-slate-500" /></div>
            </button>
            <button onClick={() => setCurrentView('personality')} className="w-full flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-3"><Smile className="w-5 h-5 text-purple-400" /><span className="text-sm font-bold text-white">Personality</span></div>
              <div className="flex items-center gap-2"><span className="text-xs text-slate-400">{settings.personality}</span><ChevronRight className="w-4 h-4 text-slate-500" /></div>
            </button>
            <button onClick={() => setCurrentView('language-list')} className="w-full flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-3"><Globe className="w-5 h-5 text-purple-400" /><span className="text-sm font-bold text-white">Language</span></div>
              <div className="flex items-center gap-2"><span className="text-xs text-slate-400">{prefs.language}</span><ChevronRight className="w-4 h-4 text-slate-500" /></div>
            </button>
            <button onClick={() => setCurrentView('voice-list')} className="w-full flex items-center justify-between p-4">
              <div className="flex items-center gap-3"><Volume2 className="w-5 h-5 text-purple-400" /><span className="text-sm font-bold text-white">Voice</span></div>
              <div className="flex items-center gap-2"><span className="text-xs text-slate-400">{prefs.voiceName}</span><ChevronRight className="w-4 h-4 text-slate-500" /></div>
            </button>
          </div>
        </div>
      </div>

      {isEditingName && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6">
            <div className="bg-[#0F172A] p-6 rounded-3xl w-full max-w-sm border border-purple-500/30">
                <h3 className="text-lg font-bold text-white mb-4">Edit Assistant Name</h3>
                <input 
                    type="text" 
                    value={tempName} 
                    onChange={(e) => setTempName(e.target.value.substring(0, 20))}
                    className="w-full bg-[#1e293b] text-white p-3 rounded-xl mb-4 border border-purple-500/30"
                    placeholder="Enter name (max 20)"
                />
                <div className="flex gap-2">
                    <button onClick={() => setIsEditingName(false)} className="flex-1 bg-slate-700 text-white p-3 rounded-xl">Cancel</button>
                    <button onClick={() => {
                        if (tempName.trim()) {
                            setSettings((s: AssistantSettings) => ({ ...s, assistantName: tempName.trim() }));
                            setIsEditingName(false);
                        }
                    }} className="flex-1 bg-purple-600 text-white p-3 rounded-xl">Save</button>
                </div>
                <button onClick={() => {
                    setSettings((s: AssistantSettings) => ({ ...s, assistantName: 'ROSE' }));
                    setIsEditingName(false);
                }} className="w-full mt-3 text-slate-400 text-sm font-bold uppercase underline">Reset to {settings.assistantName || "Rose"}</button>
            </div>
        </div>
      )}
    </div>
  );
};

export const PrivacyView = ({ setCurrentView, setToast }: any) => {
  const [adminData, setAdminData] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('iyabd_admin_profile_v3');
      return saved ? JSON.parse(saved) : { 
        name: 'MD YOUSUF KHAN',
        subtitle: 'Web Developer',
        banner: '', 
        links: { facebook: '', youtube: '', instagram: '', tiktok: '', whatsapp: '', telegram: '', website: '' } 
      };
    } catch (e) {
      return { 
        name: 'MD YOUSUF KHAN',
        subtitle: 'Web Developer',
        banner: '', 
        links: { facebook: '', youtube: '', instagram: '', tiktok: '', whatsapp: '', telegram: '', website: '' } 
      };
    }
  });

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!isLoginModalOpen) {
      const bottomNav = document.querySelector('nav');
      if (bottomNav) bottomNav.style.display = 'flex';
      return;
    }
    
    const handleResize = () => {
      if (window.visualViewport) {
        const isKeyboard = window.visualViewport.height < window.innerHeight * 0.8;
        setIsKeyboardOpen(isKeyboard);
        
        const bottomNav = document.querySelector('nav');
        if (bottomNav) {
          bottomNav.style.display = isKeyboard ? 'none' : 'flex';
        }
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      const bottomNav = document.querySelector('nav');
      if (bottomNav) bottomNav.style.display = 'flex';
    };
  }, [isLoginModalOpen]);

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const target = e.target;
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  };

  useEffect(() => {
    let channel: any;
    let subscription: any;

    async function initAuth() {
      if (!supabase) {
        setLoginError("Supabase keys missing in build settings");
        return;
      }
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const initialEmail = session?.user?.email || null;
        
        if (initialEmail && initialEmail !== ADMIN_EMAIL) {
          await supabase.auth.signOut();
          setUserEmail(null);
        } else {
          setUserEmail(initialEmail);
        }

        const authListener = supabase.auth.onAuthStateChange(async (_event, session) => {
          const email = session?.user?.email || null;
          if (email && email !== ADMIN_EMAIL) {
            if (supabase) await supabase.auth.signOut();
            setUserEmail(null);
          } else {
            setUserEmail(email);
          }
        });
        subscription = authListener.data.subscription;

        fetchLinks();

        if (supabase) {
          channel = supabase
            .channel('profile_settings_view_changes')
            .on('postgres_changes', { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'profile_settings',
              filter: 'id=eq.1'
            }, (payload) => {
              const data = payload.new;
              setAdminData({
                name: data.name || 'MD YOUSUF KHAN',
                subtitle: data.subtitle || 'Web Developer',
                banner: data.banner_url || '',
                links: data.links || { facebook: '', youtube: '', instagram: '', tiktok: '', whatsapp: '', telegram: '', website: '', phone: '' }
              });
            })
            .subscribe();
        }
      } catch (err) {
        console.error("Auth init error:", err);
      }
    }
    initAuth();

    return () => {
      if (subscription) subscription.unsubscribe();
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const fetchLinks = async () => {
    if (!supabase) return;
    setIsLoadingLinks(true);
    try {
      const { data, error } = await supabase
        .from('profile_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        const mappedData = {
          name: data.name || 'MD YOUSUF KHAN',
          subtitle: data.subtitle || 'Web Developer',
          banner: data.banner_url || '',
          links: data.links || { facebook: '', youtube: '', instagram: '', tiktok: '', whatsapp: '', telegram: '', website: '', phone: '' }
        };
        setAdminData(mappedData);
        localStorage.setItem('iyabd_admin_profile_v3', JSON.stringify(mappedData));
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setIsLoadingLinks(false);
    }
  };

  const handleLogin = () => {
    setLoginEmail('');
    setLoginPassword('');
    setLoginError(null);
    setIsLoginModalOpen(true);
  };

  const performLogin = async () => {
    if (!supabase) {
      setLoginError("Supabase keys missing in build settings");
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) throw error;

      if (data.user?.email !== ADMIN_EMAIL) {
        await supabase.auth.signOut();
        throw new Error("Access Denied: Only admin can login.");
      }

      setLoginEmail('');
      setLoginPassword('');
      setLoginError(null);
      setIsLoginModalOpen(false);
      setCurrentView('admin_panel');
    } catch (err: any) {
      setLoginError(err.message || "Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    try {
      await supabase.auth.signOut();
      setUserEmail(null);
      setToast("Logged out");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const socialLinks = [
    { id: 'facebook', label: 'Facebook', url: adminData.links?.facebook, logo: <FacebookLogo /> },
    { id: 'youtube', label: 'YouTube', url: adminData.links?.youtube, logo: <YoutubeLogo /> },
    { id: 'instagram', label: 'Instagram', url: adminData.links?.instagram, logo: <Instagram /> },
    { id: 'tiktok', label: 'TikTok', url: adminData.links?.tiktok, logo: <TikTokLogo /> },
    { id: 'whatsapp', label: 'WhatsApp', url: adminData.links?.whatsapp, logo: <WhatsAppLogo /> },
    { id: 'telegram', label: 'Telegram', url: adminData.links?.telegram, logo: <TelegramLogo /> },
    { id: 'phone', label: 'Phone', url: adminData.links?.phone ? `tel:${adminData.links.phone}` : '', logo: <Smartphone className="w-6 h-6 text-emerald-400" /> },
    { id: 'website', label: 'Website', url: adminData.links?.website, logo: <Globe className="w-6 h-6 text-indigo-400" /> },
  ];

  return (
    <div className="fixed inset-0 z-[90] bg-[#020617] overflow-y-auto no-scrollbar flex flex-col">
      <header className="px-5 py-6 flex items-center justify-between shrink-0 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-10 border-b border-white/5 min-h-[80px]">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentView('settings')} className="p-2.5 bg-white/5 rounded-2xl active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <div className="flex flex-col">
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">{adminData.name}</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{adminData.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAiStudioPreview() && (
            <>
              {!userEmail ? (
                <button 
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl active:bg-white/10 transition-colors min-h-[44px] flex items-center justify-center disabled:opacity-50"
                >
                  <span className="text-[10px] font-black uppercase tracking-[2px] text-slate-400">
                    {isLoggingIn ? "Logging in..." : "Login"}
                  </span>
                </button>
              ) : userEmail === ADMIN_EMAIL ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCurrentView('admin_panel')}
                    className="px-5 py-2.5 bg-purple-600/20 border border-purple-500/30 rounded-xl active:bg-purple-600/30 transition-colors min-h-[44px] flex items-center justify-center"
                  >
                    <span className="text-[10px] font-black uppercase tracking-[3px] text-purple-400">ADMIN</span>
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl active:bg-red-500/20 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col">
        {adminData.banner && (
          <div className="w-full aspect-video overflow-hidden shrink-0 shadow-2xl">
            <img src={adminData.banner} alt="Banner" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="px-6 py-8 space-y-3 pb-32">
          {socialLinks.filter(s => s.url).map(link => (
            <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-between p-4 bg-[#0F172A]/80 border border-purple-500/30 rounded-2xl active:bg-white/5 transition-colors min-h-[64px] group shadow-xl">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-white/5 rounded-2xl flex items-center justify-center shrink-0 border border-white/5">{link.logo}</div>
                <span className="text-[13px] font-black uppercase tracking-widest text-white">{link.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
            </a>
          ))}
          
          {socialLinks.filter(s => s.url).length === 0 && !adminData.banner && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
              <User className="w-16 h-16 mb-4 text-slate-500" />
              <p className="text-[10px] font-black uppercase tracking-[3px] text-slate-500">No profile links yet</p>
            </div>
          )}
        </div>
      </div>

      {isLoginModalOpen && (
        <div className="fixed inset-0 h-[100dvh] z-[110] bg-[#020617] flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-y-auto no-scrollbar">
          <header className="flex items-center justify-between mb-12 shrink-0">
            <h3 className="text-2xl font-black italic tracking-tighter uppercase text-white">Admin Login</h3>
            <button onClick={() => setIsLoginModalOpen(false)} className="p-2.5 bg-white/5 rounded-2xl active:scale-95 transition-transform"><ArrowLeft className="w-5 h-5 text-slate-300" /></button>
          </header>

          <div className="flex-1 flex flex-col max-w-sm mx-auto w-full pb-80">
            {!supabase ? (
              <div className="flex flex-col items-center gap-6 text-center py-10">
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                  <p className="text-xs font-bold text-amber-500">Add Supabase keys in Settings &gt; Connections</p>
                </div>
                <button 
                  onClick={() => {
                    setIsLoginModalOpen(false);
                    setCurrentView('connections');
                  }}
                  className="px-8 py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
                >
                  Go to Connections
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[3px] text-purple-400 ml-2">Email</label>
                  <input 
                    type="email" 
                    value={loginEmail} 
                    onChange={(e) => setLoginEmail(e.target.value)}
                    onFocus={handleInputFocus}
                    autoComplete="off"
                    className="w-full bg-[#0F172A] border border-white/10 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-purple-500/50 min-h-[52px]"
                    placeholder="admin@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-[3px] text-purple-400 ml-2">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={loginPassword} 
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && performLogin()}
                      onFocus={handleInputFocus}
                      autoComplete="off"
                      className="w-full bg-[#0F172A] border border-white/10 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-purple-500/50 min-h-[52px] pr-12"
                      placeholder="••••••••"
                    />
                    <button 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 active:text-white"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <p className="text-xs font-bold text-red-500 text-center">{loginError}</p>
                  </div>
                )}

                <button 
                  onClick={performLogin}
                  disabled={isLoggingIn}
                  className="w-full h-[56px] bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black uppercase tracking-[4px] text-sm shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                  {isLoggingIn ? "Authenticating..." : "Login"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminPanelView = ({ setCurrentView, setToast }: any) => {
  const [adminData, setAdminData] = useState<any>({ 
    name: 'MD YOUSUF KHAN',
    subtitle: 'Web Developer',
    banner: '', 
    links: { facebook: '', youtube: '', instagram: '', tiktok: '', whatsapp: '', telegram: '', website: '', phone: '' } 
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      if (!supabase) {
        setCurrentView('privacy');
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== ADMIN_EMAIL) {
        setCurrentView('privacy');
        return;
      }
      fetchSettings();
    }
    checkAuth();
  }, []);

  const fetchSettings = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('profile_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (data) {
        setAdminData({
          name: data.name || 'MD YOUSUF KHAN',
          subtitle: data.subtitle || 'Web Developer',
          banner: data.banner_url || '',
          links: data.links || { facebook: '', youtube: '', instagram: '', tiktok: '', whatsapp: '', telegram: '', website: '', phone: '' }
        });
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setCurrentView('privacy');
    setToast("Logged out");
  };

  const handleSave = async () => {
    if (!supabase) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profile_settings')
        .upsert({ 
          id: 1,
          name: adminData.name,
          subtitle: adminData.subtitle,
          banner_url: adminData.banner,
          links: adminData.links,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      setToast("Settings saved and published");
      setCurrentView('privacy');
    } catch (err: any) {
      alert("Save failed: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    setIsUploading(true); 
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `banner-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('banners')
        .getPublicUrl(filePath);

      setAdminData({ ...adminData, banner: publicUrl });
      setToast("Banner uploaded");
    } catch (err: any) {
      const msg = err.message || "Unknown error";
      if (msg.includes('bucket') || msg.includes('not found')) {
        alert("Upload failed: Storage bucket 'banners' might not exist. Please create it in Supabase dashboard.");
      } else {
        alert("Upload failed: " + msg);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const removeBanner = () => {
    setAdminData({ ...adminData, banner: '' });
    setToast("Banner removed");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#020617] overflow-y-auto flex flex-col no-scrollbar">
      <header className="px-5 py-6 flex items-center justify-between shrink-0 bg-[#020617]/80 backdrop-blur-xl sticky top-0 z-10 border-b border-white/5 min-h-[80px]">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentView('privacy')} className="p-2.5 bg-white/5 rounded-2xl active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-slate-300" />
          </button>
          <h3 className="text-xl font-black italic tracking-tighter uppercase text-white">Admin Panel</h3>
        </div>
        <button onClick={handleLogout} className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl active:bg-red-500/20 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <LogOut className="w-4 h-4 text-red-500" />
        </button>
      </header>

      <div className="px-6 py-8 space-y-8 pb-32">
        {/* Banner Section */}
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[3px] text-purple-400 ml-2">Banner Image (16:9)</label>
          <div className="relative aspect-video bg-white/5 rounded-[2rem] border border-white/10 overflow-hidden group shadow-inner">
            {adminData.banner ? (
              <img src={adminData.banner} className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center opacity-40">
                <ImageIcon className="w-8 h-8 mb-2" />
                <span className="text-[10px] font-bold">No banner</span>
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleBannerUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
              <span className="text-[10px] font-black uppercase tracking-widest text-white">
                {isUploading ? "Uploading..." : "Tap to upload"}
              </span>
            </div>
          </div>
          {adminData.banner && (
            <button onClick={removeBanner} className="flex items-center gap-2 text-red-400 text-[10px] font-black uppercase tracking-widest px-4 py-2 bg-red-400/10 rounded-xl mx-auto border border-red-400/20">
              <Trash2 className="w-3.5 h-3.5" /> Remove banner
            </button>
          )}
        </div>

        {/* Profile Section */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-[3px] text-purple-400 ml-2">Display Name</label>
            <input 
              type="text" 
              value={adminData.name} 
              onChange={(e) => setAdminData({ ...adminData, name: e.target.value })} 
              className="w-full bg-[#0F172A] border border-white/5 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-purple-500/50 min-h-[52px]" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-[3px] text-purple-400 ml-2">Subtitle / Role</label>
            <input 
              type="text" 
              value={adminData.subtitle} 
              onChange={(e) => setAdminData({ ...adminData, subtitle: e.target.value })} 
              className="w-full bg-[#0F172A] border border-white/5 rounded-2xl p-4 text-sm font-bold text-white outline-none focus:ring-1 focus:ring-purple-500/50 min-h-[52px]" 
            />
          </div>
        </div>

        {/* Social Links Section */}
        <div className="space-y-5">
          <label className="text-[10px] font-black uppercase tracking-[3px] text-purple-400 ml-2">Social Links</label>
          {['Facebook', 'YouTube', 'Instagram', 'TikTok', 'WhatsApp', 'Telegram', 'Phone', 'Website'].map(key => (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center gap-2 ml-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{key}</span>
              </div>
              <input 
                type="url" 
                value={adminData.links[key.toLowerCase()] || ''} 
                onChange={(e) => setAdminData({ 
                  ...adminData, 
                  links: { ...adminData.links, [key.toLowerCase()]: e.target.value } 
                })} 
                className="w-full bg-[#0F172A] border border-white/5 rounded-2xl p-4 text-xs font-bold text-white outline-none focus:ring-1 focus:ring-purple-500/50 shadow-inner min-h-[52px]" 
                placeholder={`https://${key.toLowerCase()}.com/...`} 
              />
            </div>
          ))}
        </div>

        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="w-full py-5 bg-purple-600 text-white rounded-[2rem] font-black uppercase tracking-[4px] text-sm shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-3 mt-10 min-h-[56px] disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {isSaving ? "Saving..." : "Save & Publish"}
        </button>
      </div>
    </div>
  );
};
