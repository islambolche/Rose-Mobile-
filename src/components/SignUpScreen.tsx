import React, { useState, useEffect } from "react";
import { ChevronLeft, User, Smartphone, Mail, Lock, Eye } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

interface SignUpScreenProps {
  onBack: () => void;
  onSuccess: (message: string) => void;
}

export const SignUpScreen: React.FC<SignUpScreenProps> = ({ onBack, onSuccess }) => {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [urlOk, setUrlOk] = useState(false);
  const [keyOk, setKeyOk] = useState(false);
  const [keyLen, setKeyLen] = useState(0);

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL || "";
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
    setUrlOk(url.startsWith("https://") && url.endsWith(".supabase.co"));
    setKeyOk(key.startsWith("eyJ") || key.startsWith("sb_publishable_"));
    setKeyLen(key.length);
  }, []);

  const isValid = fullName.trim() !== "" && phone.match(/^\d{10,15}$/) && email.includes("@") && password.length >= 8 && password === confirmPassword && agreed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    if (!isSupabaseConfigured()) {
        setError("Supabase URL / key Secrets এ নেই। Secrets এ যোগ করুন।");
        return;
    }
    setError(null);
    setLoading(true);

    let timer: NodeJS.Timeout;
    const authPromise = (async () => {
        try {
            const { data, error: signupError } = await supabase!.auth.signUp({
                email: email.trim().toLowerCase(),
                password,
                options: { data: { full_name: fullName.trim(), phone: phone.trim() } }
            });
            if (signupError) {
                if (signupError.message.includes("already registered")) throw new Error("এই ইমেইল দিয়ে আগে অ্যাকাউন্ট খোলা হয়েছে, লগইন করুন।");
                if (signupError.message === 'Invalid API key') throw new Error("Supabase key is wrong. Check the project URL and anon key in Secrets.");
                if (signupError.message === 'Failed to fetch') throw new Error("ইন্টারনেট বা সার্ভার সমস্যা।");
                throw signupError;
            }
            
            onSuccess(data.session ? "Success" : "আপনার ইমেইলে একটি লিংক পাঠানো হয়েছে। লিংকে ক্লিক করে যাচাই করুন, তারপর লগইন করুন।");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    })();

    timer = setTimeout(() => setLoading(false), 12000);
    await authPromise;
    clearTimeout(timer);
  };

  return (
    <div className="fixed inset-0 overflow-y-auto flex flex-col justify-end">
      {/* Background */}
      <img src="/rose-bg.webp" alt="Rose" className="fixed inset-0 w-full h-full object-cover object-[center_0%] z-0" />
      <div className="fixed bottom-0 left-0 right-0 h-[60%] z-[1] bg-gradient-to-t from-[#030614] to-transparent" />

      {/* Foreground */}
      <div className="relative z-[2] px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] flex flex-col gap-[12px] min-h-[50vh] justify-end">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="p-2 bg-[#0a0e1e]/55 backdrop-blur-[10px] border border-white/20 rounded-full">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <h2 className="text-[24px] font-bold text-white" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Create Account</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[12px]">
          {[
            { label: "Full Name", value: fullName, setter: setFullName, icon: User, type: "text", auto: "name" },
            { label: "Mobile Number", value: phone, setter: setPhone, icon: Smartphone, type: "tel", auto: "tel" },
            { label: "Email Address", value: email, setter: setEmail, icon: Mail, type: "email", auto: "email" },
          ].map((field) => (
            <div key={field.label} className="h-[48px] border border-white/20 rounded-full flex items-center px-4 bg-[#0a0e1e]/55 backdrop-blur-[10px]">
              <field.icon className="w-5 h-5 text-slate-400 mr-3" />
              <input type={field.type} placeholder={field.label} value={field.value} onChange={(e) => field.setter(e.target.value)} autoComplete={field.auto} className="flex-1 bg-transparent text-[16px] outline-none placeholder:text-slate-600" required />
            </div>
          ))}

          <div className="h-[48px] border border-white/20 rounded-full flex items-center px-4 bg-[#0a0e1e]/55 backdrop-blur-[10px]">
              <Lock className="w-5 h-5 text-slate-400 mr-3" />
              <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="flex-1 bg-transparent text-[16px] outline-none placeholder:text-slate-600" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 ml-2"><Eye className="w-5 h-5" /></button>
          </div>
          <div className="h-[48px] border border-white/20 rounded-full flex items-center px-4 bg-[#0a0e1e]/55 backdrop-blur-[10px]">
              <Lock className="w-5 h-5 text-slate-400 mr-3" />
              <input type={showPassword ? "text" : "password"} placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" className="flex-1 bg-transparent text-[16px] outline-none placeholder:text-slate-600" required />
          </div>

          <label className="flex items-start gap-2 text-[14px] text-slate-300 px-1">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
              I agree to the Terms & Privacy Policy.
          </label>
          <p className="text-[11px] text-slate-500 px-1">Name, email, phone and approximate location are stored for account management.</p>

          {error && <p className="text-red-500 text-[13px] font-bold text-center">{error}</p>}

          <button type="submit" disabled={!isValid || loading} className="w-full h-[52px] rounded-full bg-gradient-to-r from-pink-600 via-purple-600 to-blue-600 font-black uppercase text-[15px] tracking-widest mt-1 disabled:opacity-50">
              {loading ? "CREATING..." : "Create Account →"}
          </button>

          <p className="text-center text-[14px] text-slate-400 mt-2">
              Already have an account? <button type="button" onClick={onBack} className="text-purple-400 font-bold">Login</button>
          </p>
        </form>

        <p className="text-[11px] text-slate-500 text-center mt-2">
            URL ok: {urlOk ? "yes" : "no"} | Key format: {keyOk ? "ok" : "wrong"} (length {keyLen})
        </p>
      </div>
    </div>
  );
};
