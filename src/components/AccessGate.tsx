import React from "react";
import { motion } from "framer-motion";
import { 
  Lock, AlertTriangle, CreditCard, ExternalLink, 
  LogOut, ShieldAlert, MessageCircle, Crown 
} from "lucide-react";
import { supabase } from "../lib/supabase";

interface AccessGateProps {
  type: "blocked" | "subscribe";
  plan?: string;
  onLogout: () => void;
}

export const AccessGate: React.FC<AccessGateProps> = ({ type, plan, onLogout }) => {
  const handleLogout = async () => {
    await supabase!.auth.signOut();
    onLogout();
  };

  const handleContactAdmin = () => {
    window.open("https://wa.me/8801671060679", "_blank");
  };

  if (type === "blocked") {
    return (
      <div className="fixed inset-0 z-[250] bg-[#020617] flex flex-col items-center justify-center p-6 text-white">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm text-center space-y-6"
        >
          <div className="w-24 h-24 bg-red-500/10 border border-red-500/20 rounded-full mx-auto flex items-center justify-center">
            <ShieldAlert className="w-12 h-12 text-red-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black uppercase tracking-tighter italic">Access Denied</h1>
            <p className="text-slate-400 text-sm font-medium">Your account has been blocked by the administrator.</p>
          </div>
          
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-medium text-slate-500 italic">
            "We detected unusual activity or a violation of terms. Please contact support for more information."
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <button
              onClick={handleContactAdmin}
              className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <MessageCircle className="w-5 h-5" />
              Contact Admin
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-red-500/10 border border-red-500/20 text-red-500 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[250] bg-[#020617] flex flex-col items-center justify-center p-6 text-white">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-sm text-center space-y-8"
      >
        <div className="relative">
          <div className="w-24 h-24 bg-purple-600/20 border border-purple-500/30 rounded-3xl mx-auto flex items-center justify-center rotate-6">
            <Crown className="w-12 h-12 text-purple-400 -rotate-6" />
          </div>
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute top-0 right-1/4 w-4 h-4 bg-amber-400 rounded-full blur-md"
          />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">Rose Premium</h1>
          <p className="text-slate-400 text-sm font-medium">Your current plan: <span className="text-purple-400 font-bold uppercase">{plan || 'Expired'}</span></p>
        </div>

        <div className="grid grid-cols-1 gap-4 text-left">
          {[
            "Full Voice Access",
            "Unlimited Chat History",
            "Custom Personalities",
            "Advanced Phone Controls"
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-3 p-4 bg-[#0F172A] border border-white/5 rounded-2xl">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                 <Lock className="w-3 h-3 text-emerald-500" />
              </div>
              <span className="text-xs font-bold text-slate-200">{feature}</span>
            </div>
          ))}
        </div>

        <div className="space-y-4 pt-4">
          <button
            onClick={handleContactAdmin}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white py-5 rounded-2xl font-black uppercase text-sm tracking-[3px] shadow-2xl shadow-purple-900/40 flex items-center justify-center gap-3 active:scale-95 transition-transform"
          >
            Activate Subscription
            <ExternalLink className="w-5 h-5" />
          </button>
          <button
            onClick={handleLogout}
            className="w-full bg-white/5 border border-white/10 text-slate-400 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-transform"
          >
            Sign Out
          </button>
        </div>

        <p className="text-[10px] text-slate-500 font-medium px-4">
          Subscriptions are handled manually. Tap activate to message the admin on WhatsApp.
        </p>
      </motion.div>
    </div>
  );
};
