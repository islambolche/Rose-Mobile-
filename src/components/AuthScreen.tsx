import React, { useState, useEffect } from "react";
import { Mail, Lock, Eye, ChevronLeft, Shield, Home } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { SignUpScreen } from "./SignUpScreen";

interface AuthScreenProps {
  onLoginSuccess: (user: any, role: string, initialView: "home" | "admin") => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [authView, setAuthView] = useState<"login" | "signup" | "admin-choice">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverConnected, setServerConnected] = useState<"connected" | "not_connected" | "missing" | null>(null);
  
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>('user');
  const [rememberChoice, setRememberChoice] = useState(false);
  
  const [email, setEmail] = useState(localStorage.getItem("remembered_email") || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!url || !key) {
        setServerConnected("missing");
        return;
      }
      try {
        const response = await fetch(`${url}/auth/v1/health`, {
            headers: { 'apikey': key }
        });
        setServerConnected(response.ok ? "connected" : "not_connected");
      } catch {
        setServerConnected("not_connected");
      }
    };
    checkConnection();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError("Cannot connect to the server. Check Supabase URL and key in Secrets.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      if (rememberMe) {
        localStorage.setItem("remembered_email", email.trim().toLowerCase());
      } else {
        localStorage.removeItem("remembered_email");
      }

      const { data, error: loginError } = await supabase!.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });
      if (loginError) {
        if (loginError.message === 'Invalid login credentials') throw new Error("ইমেইল বা পাসওয়ার্ড ভুল।");
        else if (loginError.message === 'Failed to fetch' || loginError.message.includes("Network")) throw new Error("ইন্টারনেট বা সার্ভার সমস্যা।");
        else throw loginError;
      }
      
      if (data.user) {
        const { data: profile, error: profileError } = await supabase!.from('profiles').select('role, status').eq('id', data.user.id).single();
        const userRole = profile?.role || 'user';
        
        setUser(data.user);
        setRole(userRole);

        if (userRole === 'admin') {
            const savedChoice = localStorage.getItem("admin_choice");
            if (savedChoice) {
                onLoginSuccess(data.user, userRole, savedChoice as "home" | "admin");
            } else {
                setAuthView("admin-choice");
            }
        } else {
            onLoginSuccess(data.user, userRole, "home");
        }
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAdminChoice = (choice: "home" | "admin") => {
      if (rememberChoice) {
          localStorage.setItem("admin_choice", choice);
      }
      onLoginSuccess(user, role, choice);
  };

  if (authView === "signup") {
    return <SignUpScreen onBack={() => setAuthView("login")} onSuccess={(msg) => { setError(msg); setAuthView("login"); }} />;
  }

  if (authView === "admin-choice") {
      return (
        <div className="fixed inset-0 bg-[#030614] flex flex-col items-center justify-center p-6 gap-6">
            <h2 className="text-2xl font-bold text-white mb-4">Welcome Admin</h2>
            <button onClick={() => handleAdminChoice("admin")} className="w-full h-[60px] rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 font-bold flex items-center justify-center gap-3">
                <Shield className="w-6 h-6"/> ADMIN PANEL
            </button>
            <button onClick={() => handleAdminChoice("home")} className="w-full h-[60px] rounded-2xl bg-white/10 border border-white/20 font-bold flex items-center justify-center gap-3">
                <Home className="w-6 h-6"/> HOME
            </button>
            <label className="flex items-center gap-2 text-slate-300">
                <input type="checkbox" checked={rememberChoice} onChange={(e) => setRememberChoice(e.target.checked)} /> Remember my choice
            </label>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 overflow-y-auto flex flex-col justify-end">
      <img src="/rose-bg.webp" alt="Rose" className="fixed inset-0 w-full h-full object-cover object-[center_0%] scale-[1.05] z-0" />
      <div className="fixed bottom-0 left-0 right-0 h-[50%] z-[1] bg-gradient-to-t from-[#030614] to-transparent opacity-[0.92]" />

      <div className="relative z-[2] px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] flex flex-col gap-[12px] h-[42vh] justify-end">
        <div className="flex items-end justify-between mb-2" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}>
            <h1 className="text-[32px] font-bold text-white leading-none">ROSE</h1>
            <div className="text-right">
                <p className="text-[13px] font-bold text-white leading-none">MD YOUSUF KHAN</p>
                <p className="text-[11px] text-slate-400 tracking-[0.1em] leading-none mt-1">Web Developer</p>
            </div>
        </div>

        <div className="flex bg-[#0a0e1e]/55 backdrop-blur-[10px] p-1 rounded-full h-[46px]">
            <button className="flex-1 text-[15px] font-black uppercase tracking-widest rounded-full bg-gradient-to-r from-purple-600 to-blue-600">Login</button>
            <button onClick={() => setAuthView("signup")} className="flex-1 text-[15px] font-black uppercase tracking-widest rounded-full text-slate-500">Create Account</button>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-[12px]">
            <div className="h-[50px] border border-white/15 rounded-full flex items-center px-4 bg-[#0a0e1e]/55 backdrop-blur-[10px]">
                <Mail className="w-5 h-5 text-slate-400 mr-3" />
                <input type="email" placeholder="ইমেইল লিখুন" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="flex-1 bg-transparent text-[16px] font-bold outline-none placeholder:text-slate-600" />
            </div>

            <div className="h-[50px] border border-white/15 rounded-full flex items-center px-4 bg-[#0a0e1e]/55 backdrop-blur-[10px]">
                <Lock className="w-5 h-5 text-slate-400 mr-3" />
                <input type={showPassword ? "text" : "password"} placeholder="পাসওয়ার্ড লিখুন" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="flex-1 bg-transparent text-[16px] font-bold outline-none placeholder:text-slate-600" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 ml-2"><Eye className="w-5 h-5" /></button>
            </div>

            <div className="flex items-center justify-between text-[13px] text-slate-400 font-bold px-1">
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /> Remember me
                </label>
                <button type="button" className="text-purple-400" onClick={() => {}}>Forgot Password?</button>
            </div>

            {error && <p className="text-red-500 text-[13px] font-bold text-center">{error}</p>}
            
            <button type="submit" disabled={loading} className="w-full h-[52px] rounded-full bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 font-black uppercase text-[15px] tracking-widest">
                {loading ? "LOGGING IN..." : "Login →"}
            </button>
        </form>

        <div className="flex items-center gap-2 h-[20px]">
            <div className="h-px bg-white/20 flex-1" />
            <span className="text-[12px] text-slate-400">or</span>
            <div className="h-px bg-white/20 flex-1" />
        </div>

        <button onClick={() => setError("Google login is not enabled yet")} className="w-full h-[46px] rounded-full border border-white/25 bg-[#0a0e1e]/55 backdrop-blur-[10px] flex items-center justify-center gap-3">
            <img src="https://www.google.com/favicon.ico" alt="G" className="w-[26px] h-[26px]" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling!.remove(); e.currentTarget.parentElement!.innerHTML = '<span class=\'font-black text-white\'>G</span>'; }} />
            <span className="text-[14px] font-bold text-white">Continue with Google</span>
        </button>

        <div className="flex items-center justify-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${serverConnected === "connected" ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Server: {serverConnected === "connected" ? "connected" : serverConnected === "missing" ? "KEY MISSING" : "not connected"}
            </span>
        </div>
      </div>
    </div>
  );
};
