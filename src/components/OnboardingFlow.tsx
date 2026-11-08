import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Bell, BookUser, Phone, ChevronRight, ArrowLeft, Check, Shield, AlertCircle } from "lucide-react";
import { OrbSphere } from "./OrbSphere";

import * as Permissions from "../lib/permissions";

interface OnboardingFlowProps {
  onComplete: () => void;
}

type PermissionStatus = "idle" | "Allowed" | "Skipped" | "Needs Android app";

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [slide, setSlide] = useState(0);
  const [micStatus, setMicStatus] = useState<PermissionStatus>("idle");
  const [notifStatus, setNotifStatus] = useState<PermissionStatus>("idle");
  const [contactsStatus, setContactsStatus] = useState<PermissionStatus>("Needs Android app");
  const [phoneStatus, setPhoneStatus] = useState<PermissionStatus>("Needs Android app");
  const [notifAccessStatus, setNotifAccessStatus] = useState<PermissionStatus>("Needs Android app");
  const [showMicHelp, setShowMicHelp] = useState(false);
  const [handledAnyPermission, setHandledAnyPermission] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  // Finish onboarding and store flag
  const finishOnboarding = () => {
    try {
      localStorage.setItem("onboardingDone", "true");
    } catch (e) {}
    onComplete();
  };

  // Check real browser permission status
  const checkRealPermissions = async () => {
    // Check Microphone
    try {
      const mic = await Permissions.checkMicrophone();
      if (mic === "Allowed" || mic === "Skipped") setMicStatus(mic);
    } catch (e) {}

    // Check Notifications
    try {
      const notif = await Permissions.checkNotifications();
      if (notif === "Allowed" || notif === "Skipped") setNotifStatus(notif);
    } catch (e) {}

    setContactsStatus("Needs Android app");
    setPhoneStatus("Needs Android app");
    setNotifAccessStatus("Needs Android app");
  };

  // Re-check permissions every time slide 4 opens
  useEffect(() => {
    if (slide === 3) {
      checkRealPermissions();
    }
  }, [slide]);

  // Handle Microphone Request with 8s timeout
  const requestMicrophone = async () => {
    setShowMicHelp(false);
    try {
      const res = await Permissions.requestMicrophoneWithTimeout(8000);
      setMicStatus(res);
      setHandledAnyPermission(true);
    } catch (err: any) {
      setMicStatus("Skipped");
      setHandledAnyPermission(true);
    }
  };

  // Handle Notifications Request with 8s timeout
  const requestNotifications = async () => {
    try {
      const res = await Permissions.requestNotificationsWithTimeout(8000);
      setNotifStatus(res);
      setHandledAnyPermission(true);
    } catch (e) {
      setNotifStatus("Skipped");
      setHandledAnyPermission(true);
    }
  };

  // Handle "Allow All" - must never block, 8s timeouts, always finishes onboarding
  const handleAllowAll = async () => {
    try {
      const micRes = await Permissions.requestMicrophoneWithTimeout(8000);
      setMicStatus(micRes);
    } catch (e) {
      setMicStatus("Skipped");
    }

    try {
      const notifRes = await Permissions.requestNotificationsWithTimeout(8000);
      setNotifStatus(notifRes);
    } catch (e) {
      setNotifStatus("Skipped");
    }

    // 3. Phone calls: browser dialer is ready
    Permissions.savePermissionToMap("phoneCalls", "Allowed");

    if (Permissions.hasContactsApi()) {
      const count = Permissions.getSavedContactsCount();
      Permissions.savePermissionToMap("contacts", count > 0 ? "Allowed" : "Off");
    } else {
      Permissions.savePermissionToMap("contacts", "Needs Android app");
    }
    Permissions.savePermissionToMap("notificationAccess", "Needs Android app");

    setTimeout(() => {
      finishOnboarding();
    }, 1500);
  };

  // Touch Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (diff > 50) {
      // Swipe Left -> Next Slide
      if (slide < 3) setSlide((s) => s + 1);
    } else if (diff < -50) {
      // Swipe Right -> Previous Slide
      if (slide > 0) setSlide((s) => s - 1);
    }
    setTouchStart(null);
  };

  const isLastSlide = slide === 3;
  const canGetStarted = isLastSlide && (handledAnyPermission || micStatus === "Allowed" || notifStatus === "Allowed");

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-[250] bg-[#020617] text-white flex flex-col justify-between p-5 select-none font-sans overflow-hidden"
      style={{
        backgroundImage: "radial-gradient(circle at 50% 30%, #1e1b4b 0%, #020617 70%)",
      }}
    >
      {/* HEADER: Progress Bar & Skip */}
      <div className="shrink-0 space-y-3 pt-2">
        <div className="flex items-center justify-between gap-3">
          {/* Back button on slides 2-4 */}
          {slide > 0 ? (
            <button
              onClick={() => setSlide((s) => s - 1)}
              className="p-1.5 text-slate-400 hover:text-white rounded-full bg-white/5 active:scale-95 transition-transform"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-7 h-7" />
          )}

          {/* 4 Segmented Progress Bar */}
          <div className="flex-1 max-w-xs flex gap-1.5 h-1.5">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`flex-1 rounded-full transition-all duration-300 ${
                  idx <= slide ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" : "bg-white/10"
                }`}
              />
            ))}
          </div>

          {/* Skip Button */}
          <button
            onClick={finishOnboarding}
            className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1 active:scale-95 transition-transform"
          >
            Skip
          </button>
        </div>
      </div>

      {/* SLIDE CONTENT AREA */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto py-4 relative min-h-0">
        <AnimatePresence mode="wait">
          {/* SLIDE 1 */}
          {slide === 0 && (
            <motion.div
              key="slide0"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center text-center space-y-6 max-w-xs mx-auto"
            >
              <div className="relative my-4">
                <OrbSphere styleId="classic" size={150} state="idle" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black italic tracking-tight text-white uppercase">Meet Rose</h1>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  Talk to your phone the way you talk to a friend, in Bengali, English or both.
                </p>
              </div>
            </motion.div>
          )}

          {/* SLIDE 2 */}
          {slide === 1 && (
            <motion.div
              key="slide1"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center text-center space-y-6 max-w-xs mx-auto"
            >
              <div className="relative flex flex-col items-center my-2">
                <OrbSphere styleId="neon" size={150} state="listening" />

                {/* Animated Sound-Wave Bars under Orb */}
                <div className="flex items-center justify-center gap-1.5 mt-5 h-6">
                  {[12, 22, 16, 26, 18, 24, 14].map((h, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [6, h, 8, h * 0.8, 6] }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.8,
                        delay: i * 0.1,
                        ease: "easeInOut",
                      }}
                      className="w-1 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]"
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-black italic tracking-tight text-white uppercase">Just say it</h1>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  Tap the orb and speak. Rose listens, answers out loud and keeps the conversation going.
                </p>
              </div>
            </motion.div>
          )}

          {/* SLIDE 3 */}
          {slide === 2 && (
            <motion.div
              key="slide2"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center text-center space-y-6 max-w-xs mx-auto"
            >
              <div className="relative my-4">
                <OrbSphere styleId="solar" size={150} state="idle" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-black italic tracking-tight text-white uppercase">It gets things done</h1>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  Chat, write, create images, and more, just ask.
                </p>
              </div>
            </motion.div>
          )}

          {/* SLIDE 4: PERMISSIONS */}
          {slide === 3 && (
            <motion.div
              key="slide3"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center text-center w-full max-w-sm mx-auto space-y-4"
            >
              <div className="space-y-1 text-center">
                <h1 className="text-xl font-black italic tracking-tight text-white uppercase">Let Rose help</h1>
                <p className="text-[11px] text-slate-400 font-medium">
                  Each one is optional. You can change them later in Settings.
                </p>
              </div>

              {/* CARD LIST */}
              <div className="w-full bg-[#0F172A]/80 border border-purple-500/20 rounded-2xl p-2.5 space-y-2 text-left backdrop-blur-md">
                {/* 1. Microphone */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/30 border border-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white leading-tight">Microphone</h4>
                      <p className="text-[10px] text-slate-400 truncate">So Rose can hear you</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (micStatus === "Skipped") setShowMicHelp(!showMicHelp);
                      else requestMicrophone();
                    }}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shrink-0 border ${
                      micStatus === "Allowed"
                        ? "bg-teal-500/20 border-teal-500 text-teal-300 shadow-[0_0_8px_rgba(20,184,166,0.3)]"
                        : micStatus === "Skipped"
                        ? "bg-orange-500/20 border-orange-500/60 text-orange-300"
                        : "bg-purple-600 hover:bg-purple-500 border-purple-400 text-white"
                    }`}
                  >
                    {micStatus === "Allowed" ? "Allowed" : micStatus === "Skipped" ? "Skipped" : "Allow"}
                  </button>
                </div>

                {showMicHelp && (
                  <p className="text-[9.5px] text-orange-300 bg-orange-950/40 border border-orange-500/30 p-2 rounded-lg text-center">
                    To allow microphone: open phone Settings &gt; Apps &gt; Rose &gt; Permissions &gt; Microphone.
                  </p>
                )}

                {/* 2. Notifications */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/30 border border-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white leading-tight">Notifications</h4>
                      <p className="text-[10px] text-slate-400 truncate">Reminders and updates</p>
                    </div>
                  </div>
                  <button
                    onClick={requestNotifications}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shrink-0 border ${
                      notifStatus === "Allowed"
                        ? "bg-teal-500/20 border-teal-500 text-teal-300 shadow-[0_0_8px_rgba(20,184,166,0.3)]"
                        : notifStatus === "Skipped"
                        ? "bg-orange-500/20 border-orange-500/60 text-orange-300"
                        : "bg-purple-600 hover:bg-purple-500 border-purple-400 text-white"
                    }`}
                  >
                    {notifStatus === "Allowed" ? "Allowed" : notifStatus === "Skipped" ? "Skipped" : "Allow"}
                  </button>
                </div>

                {/* 3. Contacts */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/30 border border-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                      <BookUser className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white leading-tight">Contacts</h4>
                      <p className="text-[10px] text-slate-400 truncate">Find a number from a name</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-purple-950/60 border border-purple-500/30 text-purple-300 shrink-0">
                    Needs Android app
                  </span>
                </div>

                {/* 4. Phone calls */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/30 border border-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white leading-tight">Phone calls</h4>
                      <p className="text-[10px] text-slate-400 truncate">Call people directly</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-purple-950/60 border border-purple-500/30 text-purple-300 shrink-0">
                    Needs Android app
                  </span>
                </div>

                {/* 5. Notification access */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/30 border border-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-purple-900/40 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white leading-tight">Notification access</h4>
                      <p className="text-[10px] text-slate-400 truncate">Read incoming notifications</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-purple-950/60 border border-purple-500/30 text-purple-300 shrink-0">
                    Needs Android app
                  </span>
                </div>
              </div>

              {/* Bottom Guarantee */}
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                <Shield className="w-3 h-3 text-purple-400 shrink-0" />
                <span>Your keys, chats and settings stay on this phone.</span>
              </div>

              {/* Allow All & Not Now Actions */}
              <div className="w-full space-y-1.5 pt-1">
                <button
                  onClick={handleAllowAll}
                  className="w-full py-2.5 bg-purple-600/80 hover:bg-purple-600 border border-purple-400/50 rounded-xl text-xs font-black uppercase text-white shadow-md active:scale-95 transition-all"
                >
                  Allow all
                </button>
                <button
                  onClick={() => {
                    setHandledAnyPermission(true);
                    finishOnboarding();
                  }}
                  className="text-[11px] font-bold text-slate-400 hover:text-white py-1 transition-colors"
                >
                  Not now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* FOOTER BUTTON: Continue or Get Started */}
      <div className="shrink-0 pt-2 pb-1">
        {slide < 3 ? (
          <button
            onClick={() => setSlide((s) => Math.min(3, s + 1))}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-full shadow-[0_0_20px_rgba(147,51,234,0.4)] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={finishOnboarding}
            className="w-full py-3.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-full shadow-[0_0_20px_rgba(20,184,166,0.4)] active:scale-95 transition-all"
          >
            Get started
          </button>
        )}
      </div>
    </div>
  );
};
