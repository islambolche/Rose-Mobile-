import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import {
  supabase,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
  DEFAULT_GOOGLE_CLIENT_ID,
} from '../lib/supabase';

interface RoseLoginScreenProps {
  onLoginSuccess: () => void;
}

export const RoseLoginScreen: React.FC<RoseLoginScreenProps> = ({ onLoginSuccess }) => {
  const [tab, setTab] = useState<'login' | 'signup' | 'forgot' | 'recovery'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const translateError = (err: any): string => {
    const raw = String(err?.message || err || '');
    const msg = raw.toLowerCase();
    if (msg.includes('provider is not enabled') || msg.includes('unsupported provider')) {
      return 'Supabase Dashboard → Authentication → Providers → Google চালু (Enable) করে Client ID ও Client Secret সেভ করুন';
    }
    if (
      msg.includes('user already registered') ||
      msg.includes('already registered') ||
      msg.includes('already been registered') ||
      msg.includes('already exists')
    ) {
      return 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে, লগইন করুন';
    }
    if (
      msg.includes('invalid login credentials') ||
      msg.includes('invalid password') ||
      msg.includes('invalid email') ||
      msg.includes('wrong password') ||
      msg.includes('invalid grant')
    ) {
      return 'ইমেইল বা পাসওয়ার্ড ভুল';
    }
    if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
      return 'আগে ইমেইলের কনফার্ম লিংকে চাপুন';
    }
    if (msg.includes('password should be at least')) {
      return 'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে।';
    }
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
      return 'ইন্টারনেট দেখুন';
    }
    return raw || 'লগইন করতে সমস্যা হয়েছে';
  };

  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const errorDesc =
        urlParams.get('error_description') ||
        hashParams.get('error_description') ||
        urlParams.get('error') ||
        hashParams.get('error');

      if (errorDesc) {
        setMessage({ type: 'error', text: translateError(errorDesc) });
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      const code = urlParams.get('code');
      const hash = window.location.hash;

      if (code) {
        setLoading(true);
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        setLoading(false);
        if (!error) {
          window.history.replaceState({}, document.title, window.location.pathname);
          onLoginSuccess();
        } else {
          setMessage({ type: 'error', text: translateError(error) });
        }
      } else if (hash && hash.includes('type=recovery')) {
        setTab('recovery');
      }
    };
    handleCallback();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setTab('recovery');
      } else if (session) {
        onLoginSuccess();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [onLoginSuccess]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage(null);
    try {
      try {
        const settingsRes = await fetch(`${DEFAULT_SUPABASE_URL}/auth/v1/settings`, {
          headers: { apikey: DEFAULT_SUPABASE_ANON_KEY },
        });
        if (settingsRes.ok) {
          const settingsJson = await settingsRes.json();
          if (settingsJson?.external && settingsJson.external.google === false) {
            setMessage({
              type: 'error',
              text: `Supabase Dashboard → Authentication → Providers → Google চালু (Enable) করে Client ID (${DEFAULT_GOOGLE_CLIENT_ID.slice(
                0,
                16
              )}…) ও Client Secret সেভ করুন`,
            });
            setLoading(false);
            return;
          }
        }
      } catch {}

      const isNative = Boolean((window as any).Capacitor?.isNativePlatform());
      const redirectTo = isNative ? 'rose://login' : `${window.location.origin}/auth/callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          ...(isNative ? { skipBrowserRedirect: true } : {}),
        },
      });
      if (error) throw error;

      if (isNative && data?.url) {
        if ((window as any).RosePhone?.openExternal) {
          (window as any).RosePhone.openExternal({ url: data.url });
        } else {
          window.open(data.url, '_system');
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: translateError(err) });
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (tab === 'signup') {
      if (!fullName.trim()) {
        setMessage({ type: 'error', text: 'দয়া করে আপনার নাম দিন।' });
        return;
      }
      if (password.length < 8) {
        setMessage({ type: 'error', text: 'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে।' });
        return;
      }
      if (password !== confirmPassword) {
        setMessage({ type: 'error', text: 'পাসওয়ার্ড মিলছে না।' });
        return;
      }
    }

    if (tab === 'recovery') {
      if (password.length < 8) {
        setMessage({ type: 'error', text: 'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে।' });
        return;
      }
      if (password !== confirmPassword) {
        setMessage({ type: 'error', text: 'পাসওয়ার্ড মিলছে না।' });
        return;
      }
    }

    if (tab !== 'forgot' && tab !== 'recovery' && (!email.trim() || !password)) {
      setMessage({ type: 'error', text: 'ইমেইল এবং পাসওয়ার্ড দিন।' });
      return;
    }

    if (tab === 'forgot' && !email.trim()) {
      setMessage({ type: 'error', text: 'আপনার ইমেইল লিখুন।' });
      return;
    }

    setLoading(true);
    try {
      if (tab === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (data?.user?.identities && data.user.identities.length === 0) {
          setMessage({ type: 'error', text: 'এই ইমেইলে আগেই অ্যাকাউন্ট আছে, লগইন করুন' });
          setTab('login');
          return;
        }
        if (data?.session) {
          onLoginSuccess();
          return;
        }
        setMessage({ type: 'success', text: 'আপনার ইমেইলে কনফার্ম লিংক পাঠানো হয়েছে, লিংকে চাপুন' });
        setTab('login');
      } else if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        onLoginSuccess();
      } else if (tab === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback`,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'পাসওয়ার্ড বদলানোর লিংক ইমেইলে পাঠানো হয়েছে' });
        setTab('login');
      } else if (tab === 'recovery') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage({ type: 'success', text: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।' });
        setTab('login');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: translateError(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 text-white flex items-center justify-center p-4 md:p-8 overflow-y-auto z-[999] font-['Hind_Siliguri','Noto_Sans_Bengali',sans-serif]"
      style={{
        background: 'linear-gradient(145deg, #0b1026 0%, #070a18 100%)',
      }}
    >
      {/* Soft rose-gold glow top-right (#ff7a8a at 25% opacity) & soft teal glow bottom-left (#2dd4bf at 15% opacity) */}
      <div
        className="absolute top-0 right-0 w-[520px] h-[520px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: 'rgba(255, 122, 138, 0.25)' }}
      />
      <div
        className="absolute bottom-0 left-0 w-[520px] h-[520px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: 'rgba(45, 212, 191, 0.15)' }}
      />

      {/* Main Container: Mobile (< 1024px) = single centered col, PC (>= 1024px) = 2 cols */}
      <div className="w-full max-w-5xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 relative z-10 my-auto py-6">
        {/* PC Left Column (Hidden on Mobile) */}
        <div className="hidden lg:flex flex-col items-start max-w-lg gap-6">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: 'radial-gradient(circle at 32% 28%, #ffd1dc 0%, #ff7a8a 48%, #b4386b 100%)',
                boxShadow: '0 0 32px rgba(255, 122, 138, 0.5)',
              }}
            >
              <span className="text-2xl font-black text-white">R</span>
            </div>
            <h1
              className="text-5xl font-black tracking-widest bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(90deg, #ffd1dc 0%, #ff8fa3 50%, #ffffff 100%)',
              }}
            >
              ROSE AI
            </h1>
          </div>

          <p className="text-lg font-bold text-[#ffd1dc]">আপনার বাংলা AI সহকারী 🌹</p>
          <p className="text-sm text-slate-300 font-medium leading-relaxed">
            মোবাইল ও পিসি — এক অ্যাকাউন্টে সবকিছু
          </p>

          <div className="grid grid-cols-2 gap-3.5 w-full pt-2">
            {[
              { icon: '🎙', title: 'বাংলায় কথা বলে উত্তর' },
              { icon: '💻', title: 'পিসি কন্ট্রোল ও অফিস টিম' },
              { icon: '🌍', title: 'খবর, প্রশ্ন ও ট্রেন্ড' },
              { icon: '🔒', title: 'নিরাপদ ও প্রাইভেট' },
            ].map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3.5 rounded-2xl backdrop-blur-md"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                <span className="text-xl">{f.icon}</span>
                <span className="text-xs font-bold text-slate-100">{f.title}</span>
              </div>
            ))}
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-950/60 border border-rose-500/60 rounded-full text-[11px] font-black uppercase tracking-wider text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)] mt-2">
            MADE IN BANGLADESH
          </div>
        </div>

        {/* Right / Center Card Column */}
        <div className="w-full max-w-md flex flex-col items-center gap-5">
          {/* Mobile Header Logo (Hidden on PC) */}
          <div className="flex lg:hidden flex-col items-center gap-2 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle at 32% 28%, #ffd1dc 0%, #ff7a8a 48%, #b4386b 100%)',
                boxShadow: '0 0 28px rgba(255, 122, 138, 0.48)',
              }}
            >
              <span className="text-xl font-black text-white">R</span>
            </div>
            <h1
              className="text-3xl font-black tracking-widest bg-clip-text text-transparent"
              style={{
                backgroundImage: 'linear-gradient(90deg, #ffd1dc 0%, #ff8fa3 50%, #ffffff 100%)',
              }}
            >
              ROSE
            </h1>
            <p className="text-xs font-bold text-[#ffd1dc]">আপনার বাংলা AI সহকারী 🌹</p>
          </div>

          {/* Frosted Glass Card */}
          <div
            className="w-full rounded-[24px] p-6 md:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.65)] flex flex-col gap-4"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <div className="hidden lg:block text-left mb-0.5">
              <h2 className="text-2xl font-black text-white">স্বাগতম 👋</h2>
              <p className="text-xs text-slate-300 font-medium mt-1">চালিয়ে যেতে লগইন করুন</p>
            </div>

            {message && (
              <div
                className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-3 ${
                  message.type === 'error'
                    ? 'bg-rose-500/20 border border-rose-500/40 text-rose-200'
                    : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200'
                }`}
              >
                {message.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            {/* 1. Tabs: লগইন | নতুন অ্যাকাউন্ট */}
            {tab !== 'forgot' && tab !== 'recovery' && (
              <div
                className="flex p-1 rounded-[14px]"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setMessage(null);
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-[10px] transition-all ${
                    tab === 'login' ? 'text-white shadow-md' : 'text-slate-300 hover:text-white'
                  }`}
                  style={
                    tab === 'login'
                      ? { background: 'linear-gradient(90deg, #ff8fa3 0%, #b4386b 100%)' }
                      : undefined
                  }
                >
                  লগইন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('signup');
                    setMessage(null);
                  }}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-[10px] transition-all ${
                    tab === 'signup' ? 'text-white shadow-md' : 'text-slate-300 hover:text-white'
                  }`}
                  style={
                    tab === 'signup'
                      ? { background: 'linear-gradient(90deg, #ff8fa3 0%, #b4386b 100%)' }
                      : undefined
                  }
                >
                  নতুন অ্যাকাউন্ট
                </button>
              </div>
            )}

            {tab === 'forgot' && (
              <div className="text-xs font-bold text-[#ffd1dc] text-center py-1">
                পাসওয়ার্ড পুনরুদ্ধার করুন
              </div>
            )}

            {tab === 'recovery' && (
              <div className="text-xs font-bold text-[#ffd1dc] text-center py-1">
                নতুন পাসওয়ার্ড লিখুন
              </div>
            )}

            {/* 2. Input Fields */}
            <form onSubmit={handleEmailAuth} className="flex flex-col gap-3.5">
              {tab === 'signup' && (
                <div className="relative">
                  <User className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="আপনার নাম লিখুন"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-12 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.12)] rounded-[14px] pl-11 pr-4 text-xs text-white placeholder-slate-400 outline-none focus:border-[#ff8fa3] font-medium transition-colors"
                    required
                  />
                </div>
              )}

              {tab !== 'recovery' && (
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="ইমেইল লিখুন"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-12 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.12)] rounded-[14px] pl-11 pr-4 text-xs text-white placeholder-slate-400 outline-none focus:border-[#ff8fa3] font-medium transition-colors"
                    required
                  />
                </div>
              )}

              {tab !== 'forgot' && (
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="পাসওয়ার্ড লিখুন"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.12)] rounded-[14px] pl-11 pr-11 text-xs text-white placeholder-slate-400 outline-none focus:border-[#ff8fa3] font-medium transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-slate-400 hover:text-white"
                    aria-label="Show or hide password"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {(tab === 'signup' || tab === 'recovery') && (
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="আবার পাসওয়ার্ড লিখুন"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-12 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.12)] rounded-[14px] pl-11 pr-11 text-xs text-white placeholder-slate-400 outline-none focus:border-[#ff8fa3] font-medium transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-3.5 text-slate-400 hover:text-white"
                    aria-label="Show or hide confirm password"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {/* 3. Remember Me & Forgot Password Row */}
              {tab === 'login' || tab === 'signup' ? (
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-medium">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#ff8fa3] bg-white/10 border-white/20"
                    />
                    মনে রাখো
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('forgot');
                      setMessage(null);
                    }}
                    className="text-[#ff8fa3] hover:underline font-semibold"
                  >
                    পাসওয়ার্ড ভুলে গেছি?
                  </button>
                </div>
              ) : (
                <div className="flex justify-end text-xs pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTab('login');
                      setMessage(null);
                    }}
                    className="text-[#ff8fa3] hover:underline font-semibold"
                  >
                    লগইনে ফিরে যান
                  </button>
                </div>
              )}

              {/* 4. ONE ROW with two equal small buttons side by side */}
              <div className="grid grid-cols-2 gap-[12px] pt-1">
                {/* LEFT: Gradient button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="h-[46px] rounded-[12px] font-bold text-[15px] text-white shadow-[0_4px_20px_rgba(180,56,107,0.4)] hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 px-3 whitespace-nowrap"
                  style={{
                    background: 'linear-gradient(90deg, #ff8fa3 0%, #b4386b 100%)',
                  }}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                  <span>
                    {tab === 'signup'
                      ? 'অ্যাকাউন্ট খুলুন'
                      : tab === 'forgot'
                      ? 'লিংক পাঠান'
                      : tab === 'recovery'
                      ? 'সেভ করুন'
                      : 'লগইন করুন'}
                  </span>
                </button>

                {/* RIGHT: White Google button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="h-[46px] rounded-[12px] bg-white text-slate-900 font-bold text-[15px] shadow-md hover:bg-slate-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 px-3 whitespace-nowrap"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.19v3.15C3.17 21.32 7.23 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.19C.43 8.1 0 9.83 0 12s.43 3.9 1.19 5.42l4.09-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.17 2.68 1.19 6.58l4.09 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Google</span>
                </button>
              </div>
            </form>

            {/* 5. Small Grey Note */}
            <div className="text-[11px] text-slate-400 text-center leading-relaxed pt-0.5">
              এটা ROSE-এর আলাদা পাসওয়ার্ড — আপনার Gmail-এর পাসওয়ার্ড কখনো চাওয়া হয় না।
            </div>
          </div>

          {/* Footer Badge & Terms */}
          <div className="flex flex-col items-center gap-2 text-center pb-2">
            <div className="inline-flex items-center px-3.5 py-1 bg-emerald-950/60 border border-rose-500/60 rounded-full text-[10px] font-black uppercase tracking-wider text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              MADE IN BANGLADESH
            </div>
            <p className="text-[10px] text-slate-400 max-w-xs leading-normal">
              লগইন করলে আপনি ব্যবহারের নীতিমালা ও প্রাইভেসি মেনে নিচ্ছেন
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
