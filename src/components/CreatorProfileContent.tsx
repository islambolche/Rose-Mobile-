import React from "react";
import { Phone, MessageCircle, Copy, Lock, Award, Instagram, Youtube, Smartphone, Facebook, ExternalLink } from "lucide-react";
import { CREATOR_PROFILE } from "../lib/creator-profile";

export const CreatorProfileContent: React.FC = () => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const contactItems = [
    { label: "Phone", value: CREATOR_PROFILE.phone, icon: Phone, action: () => window.location.href = `tel:${CREATOR_PROFILE.phone}` },
    { label: "WhatsApp", value: CREATOR_PROFILE.whatsapp, icon: MessageCircle, action: () => window.open(`https://wa.me/88${CREATOR_PROFILE.whatsapp}`, "_blank") },
    { label: "Facebook", value: "Facebook", icon: Facebook, action: () => window.open(CREATOR_PROFILE.facebook, "_blank") },
    { label: "Instagram", value: "Instagram", icon: Instagram, action: () => window.open(CREATOR_PROFILE.instagram, "_blank") },
    { label: "YouTube", value: "YouTube", icon: Youtube, action: () => window.open(CREATOR_PROFILE.youtube, "_blank") },
    { label: "TikTok", value: "TikTok", icon: Smartphone, action: () => window.open(CREATOR_PROFILE.tiktok, "_blank") },
  ];

  return (
    <>
      {/* Header Card */}
      <div className="bg-[#0A1628] border border-cyan-500/40 rounded-2xl p-6 text-center shadow-lg space-y-3 mb-3">
        <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full mx-auto shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center justify-center text-white text-2xl font-black">
          YK
        </div>
        <div>
          <h4 className="text-lg font-black text-white">{CREATOR_PROFILE.name}</h4>
          <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest mt-1">{CREATOR_PROFILE.role}</p>
        </div>
        <div className="flex justify-center gap-2 pt-1">
          <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/30">
            <Award className="w-3 h-3"/> {CREATOR_PROFILE.badge}
          </span>
          <span className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/30">
            <Lock className="w-3 h-3"/> {CREATOR_PROFILE.lockBadge}
          </span>
        </div>
      </div>

      {/* Contact Cards - as siblings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {contactItems.map((item, index) => (
          <div key={index} className="flex items-center justify-between bg-[#0A1628] p-4 rounded-2xl border border-cyan-500/40 shadow-lg transition-colors hover:border-cyan-500/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <item.icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{item.label}</span>
                <span className="text-xs font-bold text-slate-200">{item.value === item.label ? "Open Profile" : item.value}</span>
              </div>
            </div>
            <div className="flex gap-1">
              {item.label === "Phone" && (
                <button onClick={() => copyToClipboard(item.value)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400"><Copy className="w-4 h-4"/></button>
              )}
              <button onClick={item.action} className="p-2 hover:bg-white/10 rounded-lg text-emerald-400"><ExternalLink className="w-4 h-4"/></button>
            </div>
          </div>
        ))}
        
        {/* Telegram Card */}
        <div className="flex items-center justify-between bg-[#0A1628] p-4 rounded-2xl border border-cyan-500/40 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Telegram</span>
                <span className="text-xs font-bold text-slate-500 italic">Not provided</span>
              </div>
            </div>
        </div>
      </div>
    </>
  );
};
