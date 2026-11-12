import React, { useState, useEffect } from "react";
import { 
  Shield, FileText, ArrowLeft, ExternalLink, Lock, Eye, AlertTriangle, 
  CheckCircle2, Sparkles, Phone, Mail, Globe, MessageCircle, Heart, User, ChevronRight
} from "lucide-react";
import { DEVELOPER_INFO } from "../lib/creator-profile";

interface PublicLegalPagesProps {
  initialPage?: "privacy" | "terms";
  onBackToApp?: () => void;
}

export const PublicLegalPages: React.FC<PublicLegalPagesProps> = ({
  initialPage = "privacy",
  onBackToApp
}) => {
  const [activeTab, setActiveTab] = useState<"privacy" | "terms">(initialPage);

  // Sync tab with URL if browser back/forward or direct navigation happens
  useEffect(() => {
    setActiveTab(initialPage);
  }, [initialPage]);

  const handleTabChange = (tab: "privacy" | "terms") => {
    setActiveTab(tab);
    try {
      window.history.pushState({}, "", `/${tab}`);
    } catch {}
  };

  const handleReturnToApp = () => {
    if (onBackToApp) {
      onBackToApp();
    } else {
      try {
        window.history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      } catch {
        window.location.href = "/";
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-purple-600 selection:text-white font-sans">
      {/* Background radial effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-purple-900/15 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-indigo-950/20 blur-[140px] rounded-full" />
      </div>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#020617]/85 border-b border-purple-500/20 px-4 sm:px-8 py-3.5 transition-all">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleReturnToApp}
              className="p-2 sm:px-3 sm:py-2 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/30 rounded-xl text-purple-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
              title="Return to Rose App"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">অ্যাপে ফিরে যান (Open App)</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-black text-sm shadow-[0_0_12px_rgba(168,85,247,0.4)]">
                R
              </div>
              <span className="font-black text-base sm:text-lg tracking-wider text-white">
                ROSE <span className="text-purple-400 text-xs font-bold uppercase ml-1">Legal</span>
              </span>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-[#0F172A] p-1 rounded-xl border border-purple-500/30 shadow-inner">
            <button
              onClick={() => handleTabChange("privacy")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "privacy"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>প্রাইভেসি</span>
              <span className="hidden md:inline font-mono text-[10px] opacity-80">(Privacy)</span>
            </button>
            <button
              onClick={() => handleTabChange("terms")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === "terms"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>শর্তাবলী</span>
              <span className="hidden md:inline font-mono text-[10px] opacity-80">(Terms)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Header Banner */}
        <div className="bg-[#0A1628]/90 border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>অফিশিয়াল পলিসি ও নীতিমালা</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {activeTab === "privacy" ? "Privacy Policy (গোপনীয়তা নীতি)" : "Terms of Service (ব্যবহারের শর্তাবলী)"}
              </h1>
              <p className="text-xs sm:text-sm text-purple-300 font-semibold mt-1">
                সর্বশেষ আপডেট: ১২ নভেম্বর, ২০২৬ &nbsp;|&nbsp; Last Updated: November 12, 2026
              </p>
            </div>
            <div className="text-right sm:border-l sm:border-purple-500/20 sm:pl-6 text-xs text-slate-400">
              <p className="font-bold text-slate-200">ROSE AI Assistant</p>
              <p>ডেভেলপার: {DEVELOPER_INFO.name}</p>
              <p>বাংলাদেশ (Bangladesh)</p>
            </div>
          </div>
        </div>

        {/* Content Section */}
        {activeTab === "privacy" ? <PrivacyContent /> : <TermsContent />}

        {/* Developer Contact Card */}
        <div className="bg-[#0A1628]/90 border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="flex items-center gap-3 border-b border-purple-500/20 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">যোগাযোগ ও ডেভেলপার তথ্য (Contact Developer)</h3>
              <p className="text-xs text-slate-400">যেকোনো প্রশ্ন, তথ্য সংশোধন বা সহায়তার জন্য যোগাযোগ করুন</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <a
              href={`https://wa.me/88${DEVELOPER_INFO.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-purple-500/20 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">WhatsApp / Phone</p>
                  <p className="text-xs font-bold text-white">{DEVELOPER_INFO.whatsapp}</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400" />
            </a>

            <a
              href={`mailto:${DEVELOPER_INFO.gmail}`}
              className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-purple-500/20 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Email (Gmail)</p>
                  <p className="text-xs font-bold text-white truncate max-w-[170px]">{DEVELOPER_INFO.gmail}</p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-400" />
            </a>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {Object.entries(DEVELOPER_INFO.social).map(([key, info]) => (
              <a
                key={key}
                href={info.link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-purple-600/20 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <span>{info.label}</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            ))}
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center py-6 text-xs text-slate-500 space-y-2">
          <p>© 2026 ROSE AI. All Rights Reserved. Created by {DEVELOPER_INFO.name}.</p>
          <div className="flex justify-center gap-4 text-[11px] text-purple-400 font-semibold">
            <button onClick={() => handleTabChange("privacy")} className="hover:underline">Privacy Policy</button>
            <span>•</span>
            <button onClick={() => handleTabChange("terms")} className="hover:underline">Terms of Service</button>
            <span>•</span>
            <button onClick={handleReturnToApp} className="hover:underline">Open Rose App</button>
          </div>
        </div>
      </main>
    </div>
  );
};

/* =========================================================================
   PRIVACY POLICY CONTENT: Bengali first, English below
   ========================================================================= */
const PrivacyContent: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* BENGALI SECTION */}
      <section className="bg-[#0F172A]/90 border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="border-b border-purple-500/20 pb-4">
          <span className="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider">
            বাংলা সংস্করণ (Bengali Version)
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
            প্রাইভেসি পলিসি — আপনার তথ্যের স্পষ্ট ও সৎ বিবরণ
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Rose অ্যাপে আপনার ব্যক্তিগত তথ্যের নিরাপত্তা ও গোপনীয়তা কীভাবে রক্ষা করা হয় তা স্পষ্টভাবে এখানে তুলে ধরা হলো।
          </p>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              ১. অ্যাপ ও ডেভেলপার পরিচিতি
            </h3>
            <p>
              অ্যাপটির নাম <strong className="text-white">ROSE</strong> (বা Rose AI)। এই অ্যাপ্লিকেশনটির একক নির্মাতা ও ডেভেলপার হলেন <strong className="text-white">{DEVELOPER_INFO.name}</strong> (বাংলাদেশ)। যেকোনো বিষয়ে সহায়তার জন্য ডেভেলপার পেজে উল্লেখিত ফোন/হোয়াটসঅ্যাপ ({DEVELOPER_INFO.whatsapp}) বা ইমেইলে যোগাযোগ করা যাবে।
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              ২. আমরা কোন তথ্য সংগ্রহ করি?
            </h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-white">নাম:</strong> সেটিংস বা প্রোফাইলে আপনি যে নাম প্রদান করেন, যাতে Rose আপনাকে সেই নামে সম্বোধন করতে পারে।</li>
              <li><strong className="text-white">চ্যাট মেসেজ ও ভয়েস ট্রান্সক্রিপ্ট:</strong> আপনি যেসব কথা লিখে বা ভয়েসে বলেন, তার শুধুমাত্র টেক্সট প্রতিলিপি (Text transcript); কোনো মূল অডিও ফাইল বা রেকর্ডিং স্থায়ীভাবে সংরক্ষণ করা হয় না।</li>
              <li><strong className="text-white">অ্যাপ সেটিংস ও পছন্দসমূহ:</strong> আপনার বাছাই করা থিম, ভয়েস মডেল, পারসোনালিটি এবং অন্যান্য প্রেফারেন্স।</li>
              <li><strong className="text-white">ঐচ্ছিক আনুমানিক অবস্থান (Approximate Location):</strong> আবহাওয়া বা স্থানীয় তথ্যের জন্য যদি আপনি অনুমতি দেন, তবে শুধু আনুমানিক শহর/অঞ্চল ব্যবহৃত হয়।</li>
              <li><strong className="text-white">টাস্ক ডেটা (Task Data):</strong> আপনি যে নোট, তালিকা বা শিডিউল টাস্ক তৈরি করেন।</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              ৩. তথ্য কোথায় সংরক্ষিত থাকে?
            </h3>
            <p>
              আপনার সমস্ত ব্যক্তিগত চ্যাট ও সেটিংস মূলত <strong className="text-white">আপনার নিজস্ব ডিভাইসে (ব্রাউজারের লোকাল স্টোরেজ/ক্যাশে)</strong> সংরক্ষিত থাকে। আপনি যদি একাধিক ডিভাইসে তথ্য সিঙ্ক করার জন্য <em>Database & Sync</em> অপশন ব্যবহার করেন, তবে তা এনক্রিপ্টেড ক্লাউড ডাটাবেস <strong className="text-white">Supabase</strong>-এ সুরক্ষিতভাবে জমা থাকে।
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              ৪. API Key সম্পূর্ণ আপনার কাছে নিরাপদ
            </h3>
            <p>
              আপনার প্রদত্ত Google Gemini, Groq বা অন্যান্য ব্যক্তিগত API Key শুধুমাত্র আপনার নিজস্ব ডিভাইসেই থাকে। এগুলো কখনো আমাদের কোনো নিজস্ব বা বাহ্যিক সেন্ট্রাল সার্ভারে পাঠানো বা সংরক্ষণ করা হয় না।
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              ৫. ভয়েস ও ক্যামেরা ব্যবহারের নিয়ম (কোনো রেকর্ডিং হয় না)
            </h3>
            <p>
              লাইভ কলে কথা বলার সময় মাইক্রোফোনের অডিও এবং ক্যামেরা চালু থাকলে ভিডিও ফ্রেম সরাসরি ও তাৎক্ষণিকভাবে শুধুমাত্র উত্তরের জন্য <strong className="text-white">Google Gemini</strong>-এর লাইভ সেশনে পাঠানো হয়। অ্যাপটি আপনার কোনো ভয়েস অডিও বা ক্যামেরা ভিডিও কখনো <strong>রেকর্ড বা সেভ করে না</strong>। কল শেষ হলে ক্যামেরা ও মাইক সাথে সাথে বন্ধ হয়ে যায়।
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              ৬. ব্যবহৃত তৃতীয় পক্ষ সার্ভিসসমূহ (Third-Party Services)
            </h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-white">Google Gemini API:</strong> কৃত্রিম বুদ্ধিমত্তা চ্যাট ও লাইভ ভয়েস উত্তর প্রস্তুত করতে।</li>
              <li><strong className="text-white">Supabase:</strong> ব্যবহারকারী লগইন ও ঐচ্ছিক ব্যাকআপ সিঙ্ক ডাটাবেস।</li>
              <li><strong className="text-white">Vercel:</strong> অ্যাপ্লিকেশনটির নির্ভরযোগ্য ওয়েব হোস্টিং অবকাঠামো।</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              ৭. ব্যবহারকারীর সম্পূর্ণ নিয়ন্ত্রণ (User Control)
            </h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>যেকোনো সময় <strong className="text-white">সব চ্যাট এক ক্লিকে মুছে ফেলা</strong> যায়।</li>
              <li><strong className="text-white">Settings → PRIVACY CONTROLS</strong> থেকে অ্যাকাউন্ট ও সমস্ত লোকাল ডেটা সম্পূর্ণ মুছে ফেলা যায়।</li>
              <li>লোকেশন বা জিপিএস বন্ধ রাখা যায়।</li>
              <li>মাইক্রোফোন ও ক্যামেরার অনুমতি যেকোনো মুহূর্তে বন্ধ (Deny) করা যায়।</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              ৮. শিশুদের গোপনীয়তা ও নীতিমালার পরিবর্তন
            </h3>
            <p>
              Rose অ্যাপটি ১৩ বছরের কম বয়সী শিশুদের ব্যবহারের উদ্দেশ্যে তৈরি নয়। অ্যাপের ফিচারে পরিবর্তন বা পরিমার্জন এলে এই পেজে সর্বশেষ সংস্করণ প্রকাশ করা হবে।
            </p>
          </div>
        </div>
      </section>

      {/* ENGLISH SECTION */}
      <section className="bg-[#0F172A]/90 border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="border-b border-purple-500/20 pb-4">
          <span className="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider">
            English Version
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
            Privacy Policy — Plain & Honest Disclosure
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            How your information is protected, stored, and managed when using the Rose AI application.
          </p>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white">1. App & Developer Identity</h3>
            <p>
              Application Name: <strong className="text-white">ROSE</strong> (Rose AI). Independent Creator & Developer: <strong className="text-white">{DEVELOPER_INFO.name}</strong>, Bangladesh. For any inquiries, official contact details are provided on the Developer profile (WhatsApp: {DEVELOPER_INFO.whatsapp}, Email: {DEVELOPER_INFO.gmail}).
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white">2. What Information is Collected?</h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-white">User Name:</strong> The display name entered in Settings so Rose can address you personally.</li>
              <li><strong className="text-white">Chat & Transcripts:</strong> Text messages and speech-to-text transcripts generated during interaction. Raw audio recordings are never stored.</li>
              <li><strong className="text-white">Preferences:</strong> Selected theme, personality, response style, and assistant tuning parameters.</li>
              <li><strong className="text-white">Approximate Location (Optional):</strong> If explicitly permitted, used solely for local context and weather answers.</li>
              <li><strong className="text-white">Task Data:</strong> User-created notes, task items, or assistant reminders.</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white">3. Storage & Data Location</h3>
            <p>
              All primary application data and chat history are stored <strong className="text-white">locally on your device</strong> (browser local storage). If you enable optional Database & Sync features, encrypted backup records are synchronized via <strong className="text-white">Supabase</strong>.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white">4. API Key Security</h3>
            <p>
              Any Google Gemini or external AI keys entered by the user remain strictly on the user's local device. They are never transmitted to our servers or third-party loggers.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white">5. Voice & Camera Streaming (Zero Recording)</h3>
            <p>
              Microphone audio and camera frames (when enabled during live calls) are streamed in real time to the <strong className="text-white">Google Gemini API</strong> strictly to formulate instant contextual responses. Neither audio nor video streams are ever recorded, saved, or archived by the app.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white">6. Third-Party Services</h3>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-white">Google Gemini API:</strong> Natural language generation and real-time multimodal processing.</li>
              <li><strong className="text-white">Supabase:</strong> Authentication and encrypted database synchronization.</li>
              <li><strong className="text-white">Vercel:</strong> Global edge application hosting and delivery.</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white">7. User Rights & Data Control</h3>
            <p>
              You maintain absolute control over your information:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Clear your complete chat history at any moment with a single click.</li>
              <li>Permanently erase your account and all stored local data via <strong className="text-white">Settings → PRIVACY CONTROLS</strong>.</li>
              <li>Revoke microphone, camera, or approximate location permissions at any time through your browser settings.</li>
            </ul>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white">8. Children's Privacy & Updates</h3>
            <p>
              ROSE is not designed for or targeted at children under 13 years of age. This Privacy Policy is updated whenever new app capabilities are released. Continued use constitutes acceptance of the latest published terms.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

/* =========================================================================
   TERMS OF SERVICE CONTENT: Bengali first, English below
   ========================================================================= */
const TermsContent: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* BENGALI SECTION */}
      <section className="bg-[#0F172A]/90 border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="border-b border-purple-500/20 pb-4">
          <span className="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider">
            বাংলা সংস্করণ (Bengali Version)
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
            ব্যবহারের নীতিমালা ও শর্তাবলী (Terms of Service)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Rose অ্যাপ ব্যবহারের ক্ষেত্রে প্রযোজ্য নিয়মকানুন ও পারস্পরিক দায়িত্বের বিবরণ।
          </p>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ১. ন্যায্য ও গঠনমূলক ব্যবহার (Fair Use)
            </h3>
            <p>
              Rose অ্যাপটি ব্যক্তিগত সহায়তা, পড়াশোনা, কোডিং, সৃজনশীল কাজ, বিনোদন ও দৈনন্দিন কাজে ব্যবহারের জন্য তৈরি করা হয়েছে। আপনি সুস্থ ও ইতিবাচক উদ্দেশ্যে অ্যাপের যেকোনো ফিচার স্বাধীনভাবে ব্যবহার করতে পারেন।
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              ২. কোনো প্রকার বেআইনি বা ক্ষতিকর কাজ নিষিদ্ধ (No Illegal Use)
            </h3>
            <p>
              অ্যাপটি কোনো আইনবিরোধী, সহিংস, প্রতারণামূলক, হয়রানিমূলক, বিদ্বেষমূলক বা অন্য কোনো ব্যক্তির ক্ষতি সাধনের উদ্দেশ্যে ব্যবহার করা সম্পূর্ণ ও কঠোরভাবে নিষিদ্ধ। অ্যাপের সিকিউরিটি ভাঙা বা সিস্টেমের অপব্যবহারের চেষ্টা করা যাবে না। নীতিমালা লঙ্ঘন করলে সংশ্লিষ্ট সেবা বন্ধ করা হতে পারে।
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              ৩. কৃত্রিম বুদ্ধিমত্তার (AI) উত্তর ভুল হতে পারে
            </h3>
            <p>
              Rose একটি আধুনিক কৃত্রিম বুদ্ধিমত্তা চালিত সহকারী। AI মডেলগুলো মাঝেমধ্যে তথ্যগত ভুল বা অসংগতিপূর্ণ উত্তর দিতে পারে। চিকিৎসা, আইনি, আর্থিক বা কোনো অত্যন্ত গুরুত্বপূর্ণ সিদ্ধান্ত গ্রহণের আগে ব্যবহারকারীকে নিজ দায়িত্বে তথ্য যাচাই করে নেওয়ার পরামর্শ দেওয়া হচ্ছে।
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-purple-400" />
              ৪. অনুমোদিত কাজের দায়ভার ব্যবহারকারীর
            </h3>
            <p>
              অ্যাপের মাধ্যমে ফোন কল, মেসেজ পাঠানো, অ্যাপ খোলা, পিসি কন্ট্রোল বা কোনো স্বয়ংক্রিয় অ্যাকশন আপনি নিজে যে অনুমোদন দেবেন, তার সম্পূর্ণ দায়িত্ব ও ফলাফল ব্যবহারকারীর নিজস্ব। ব্যবহারকারীর স্পষ্ট সম্মতি ছাড়া কোনো সংবেদনশীল অ্যাকশন স্বয়ংক্রিয়ভাবে কার্যকর হয় না।
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              ৫. "যেমন আছে তেমন" (Provided "As Is")
            </h3>
            <p>
              অ্যাপ্লিকেশনটি "যেমন আছে তেমনি" (as-is) কোনো প্রকাশ্য বা অপ্রকাশ্য ওয়ারেন্টি বা নিরবচ্ছিন্ন সেবার নিশ্চয়তা ছাড়া সরবরাহ করা হয়েছে। প্রযুক্তিগত সীমাবদ্ধতা বা নেটওয়ার্ক জনিত কোনো সাময়িক বিভ্রাটের জন্য ডেভেলপার দায়ী নন।
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              ৬. যোগাযোগের ঠিকানা
            </h3>
            <p>
              শর্তাবলী বা নীতিমালা সংক্রান্ত যেকোনো প্রশ্নের জন্য সরাসরি ডেভেলপার <strong className="text-white">{DEVELOPER_INFO.name}</strong>-এর সাথে যোগাযোগ করুন: WhatsApp: {DEVELOPER_INFO.whatsapp}, Email: {DEVELOPER_INFO.gmail}।
            </p>
          </div>
        </div>
      </section>

      {/* ENGLISH SECTION */}
      <section className="bg-[#0F172A]/90 border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="border-b border-purple-500/20 pb-4">
          <span className="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider">
            English Version
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
            Terms of Service — Conditions of Use
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            The terms governing your access to and usage of the ROSE assistant application.
          </p>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white">1. Fair Use</h3>
            <p>
              ROSE is provided for lawful personal assistance, education, coding, creative exploration, and daily productivity. You agree to use the application reasonably and constructively.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white">2. No Unlawful or Harmful Activities</h3>
            <p>
              You must not use ROSE for any illegal, harassing, deceptive, fraudulent, defamatory, or harmful purposes. Reverse-engineering system boundaries, attacking backend infrastructure, or generating illicit material is strictly prohibited and grounds for immediate access termination.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white">3. Artificial Intelligence Disclaimer</h3>
            <p>
              AI responses can occasionally be inaccurate, incomplete, or out of date. Responses do not constitute certified medical, financial, or legal advice. Users are solely responsible for independently verifying critical information before taking action.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white">4. User Responsibility for Approved Actions</h3>
            <p>
              Whenever the assistant triggers an action (such as phone calls, WhatsApp navigation, system shortcuts, or device integration), the user retains ultimate responsibility for approving and executing the command.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white">5. Provided "As-Is"</h3>
            <p>
              The service is provided on an "as-is" and "as-available" basis without warranties of any kind, whether express or implied. The developer assumes no liability for service interruptions, device incompatibilities, or third-party API changes.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 space-y-2">
            <h3 className="text-sm font-black text-white">6. Inquiries & Contact</h3>
            <p>
              Questions regarding these Terms of Service should be directed to <strong className="text-white">{DEVELOPER_INFO.name}</strong> at {DEVELOPER_INFO.gmail} or via WhatsApp at {DEVELOPER_INFO.whatsapp}.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
