import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, FileText, ChevronRight, ExternalLink } from "lucide-react";
import { PRIVACY_BN, PRIVACY_EN, TERMS_BN, TERMS_EN, LAST_UPDATED } from "../content/legal";
import { navStore } from "../lib/nav";

interface LegalViewProps {
  onBack?: () => void;
  setCurrentView?: (v: string) => void;
}

export const PrivacyPolicyView: React.FC<LegalViewProps> = ({ onBack, setCurrentView }) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (setCurrentView) {
      setCurrentView("privacy");
    } else {
      navStore.pop();
    }
  };

  const handleOpenTerms = () => {
    navStore.push("terms");
    if (setCurrentView) {
      setCurrentView("terms");
    }
  };

  return (
    <motion.div
      key="privacy_policy"
      data-current-view="privacy_policy"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      className="fixed inset-0 z-[80] bg-[#020617] overflow-y-auto no-scrollbar flex flex-col"
    >
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#020617]/95 backdrop-blur-md border-b border-white/5 shrink-0">
        <div className="max-w-3xl mx-auto w-full px-5 py-4 flex items-center gap-4">
          <button
            data-nav-id="back"
            type="button"
            onClick={handleBack}
            className="p-2.5 bg-white/5 rounded-xl active:scale-95 transition-transform border border-white/5 text-slate-300 hover:text-white"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white leading-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              প্রাইভেসি পলিসি
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
              Privacy Policy &nbsp;•&nbsp; {LAST_UPDATED}
            </p>
          </div>
        </div>
      </header>

      <div className="px-5 py-5 flex flex-col flex-1 pb-36 max-w-3xl mx-auto w-full">
        {/* Scrollable Content */}
        <div className="space-y-6 flex-1 text-slate-200">
          {/* Bengali Section */}
          <div className="p-5 sm:p-6 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2rem] shadow-2xl space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20">
              <span className="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                বাংলা (Bengali)
              </span>
            </div>
            <pre className="font-sans whitespace-pre-wrap text-xs sm:text-sm text-slate-300 leading-relaxed break-words">
              {PRIVACY_BN}
            </pre>
          </div>

          {/* English Section */}
          <div className="p-5 sm:p-6 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2rem] shadow-2xl space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20">
              <span className="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                English
              </span>
            </div>
            <pre className="font-sans whitespace-pre-wrap text-xs sm:text-sm text-slate-300 leading-relaxed break-words">
              {PRIVACY_EN}
            </pre>
          </div>

          {/* Bottom link button to Terms */}
          <div className="pt-2 pb-4">
            <button
              data-nav-id="terms_link"
              type="button"
              onClick={handleOpenTerms}
              className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-98 transition-all shadow-xl shadow-purple-900/40"
            >
              <FileText className="w-4 h-4" />
              <span>শর্তাবলী দেখুন (Terms of Service)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const TermsView: React.FC<LegalViewProps> = ({ onBack, setCurrentView }) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (setCurrentView) {
      setCurrentView("about");
    } else {
      navStore.pop();
    }
  };

  return (
    <motion.div
      key="terms"
      data-current-view="terms"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      className="fixed inset-0 z-[80] bg-[#020617] overflow-y-auto no-scrollbar flex flex-col"
    >
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#020617]/95 backdrop-blur-md border-b border-white/5 shrink-0">
        <div className="max-w-3xl mx-auto w-full px-5 py-4 flex items-center gap-4">
          <button
            data-nav-id="back"
            type="button"
            onClick={handleBack}
            className="p-2.5 bg-white/5 rounded-xl active:scale-95 transition-transform border border-white/5 text-slate-300 hover:text-white"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white leading-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              শর্তাবলী
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
              Terms of Service &nbsp;•&nbsp; {LAST_UPDATED}
            </p>
          </div>
        </div>
      </header>

      <div className="px-5 py-5 flex flex-col flex-1 pb-36 max-w-3xl mx-auto w-full">
        {/* Scrollable Content */}
        <div className="space-y-6 flex-1 text-slate-200">
          {/* Bengali Section */}
          <div className="p-5 sm:p-6 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2rem] shadow-2xl space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20">
              <span className="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                বাংলা (Bengali)
              </span>
            </div>
            <pre className="font-sans whitespace-pre-wrap text-xs sm:text-sm text-slate-300 leading-relaxed break-words">
              {TERMS_BN}
            </pre>
          </div>

          {/* English Section */}
          <div className="p-5 sm:p-6 bg-[#0F172A]/80 border border-purple-500/30 rounded-[2rem] shadow-2xl space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-purple-500/20">
              <span className="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                English
              </span>
            </div>
            <pre className="font-sans whitespace-pre-wrap text-xs sm:text-sm text-slate-300 leading-relaxed break-words">
              {TERMS_EN}
            </pre>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
