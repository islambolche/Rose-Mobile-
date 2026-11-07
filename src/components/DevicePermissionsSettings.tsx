import React, { useState, useEffect } from "react";
import { ArrowLeft, Mic, Camera, MapPin, Bell, Clipboard, Lock, FileText, Smartphone } from "lucide-react";
import { isAllowed, setAllowed } from "../lib/permissions";

const ANDROID_PERMS = [
    { id: "perm_files", title: "All files and storage", subtitle: "Find and open files on your phone", steps: ["1. Open phone Settings.", "2. Go to Apps > Rose.", "3. Enable All files access."] },
    { id: "perm_access", title: "Accessibility control", subtitle: "Tap, type and scroll in other apps", steps: ["1. Open phone Settings.", "2. Go to Accessibility > Installed apps.", "3. Select Rose and turn it on."] },
    { id: "perm_notiflisten", title: "Notification access", subtitle: "Read comments and messages notifications", steps: ["1. Open phone Settings.", "2. Search for Notification access.", "3. Find Rose and allow access."] },
    { id: "perm_overlay", title: "Display over other apps", subtitle: "Floating Rose button", steps: ["1. Open phone Settings.", "2. Go to Apps > Special app access.", "3. Tap Display over other apps and allow Rose."] },
    { id: "perm_contacts", title: "Contacts", subtitle: "Read names and numbers", steps: ["1. Open phone Settings.", "2. Go to Apps > Rose > Permissions.", "3. Tap Contacts and select Allow."] },
    { id: "perm_sms", title: "Messages (SMS)", subtitle: "Read and send messages", steps: ["1. Open phone Settings.", "2. Go to Apps > Rose > Permissions.", "3. Tap SMS and select Allow."] },
    { id: "perm_calls", title: "Phone and call log", subtitle: "Make calls and see call history", steps: ["1. Open phone Settings.", "2. Go to Apps > Rose > Permissions.", "3. Tap Phone and select Allow."] },
    { id: "perm_calendar", title: "Calendar", subtitle: "Read and add events", steps: ["1. Open phone Settings.", "2. Go to Apps > Rose > Permissions.", "3. Tap Calendar and select Allow."] },
    { id: "perm_battery", title: "Run in background", subtitle: "Keep Rose working when the screen is off", steps: ["1. Open phone Settings.", "2. Go to Apps > Rose > Battery.", "3. Select Unrestricted."] },
];

export const DevicePermissionsSettings: React.FC<{ onClose: () => void; initialTab?: string }> = ({ onClose }) => {
  const [permissions, setPermissions] = useState<Record<string, "GRANTED" | "DENIED" | "ASK">>({});
  const [enableSheet, setEnableSheet] = useState<{ id: string; title: string; steps: string[] } | null>(null);

  const checkPermissions = async () => {
    // Simplified check
  };

  useEffect(() => { checkPermissions(); }, []);

  const togglePermission = (name: string) => {
    setAllowed(name, !isAllowed(name));
    setTick(t => t + 1);
  };
  const [_, setTick] = useState(0);

  return (
    <div className="fixed inset-0 z-[200] bg-[#020617] text-white flex flex-col font-sans">
      <header className="px-5 py-4 border-b border-[#2e2160] flex items-center gap-4">
        <button onClick={onClose} className="p-2 bg-[#1a1a35] rounded-xl"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-bold">Device Permissions</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="bg-[#1a1a35] p-4 rounded-2xl border border-[#2e2160] text-sm text-slate-300">
          Rose only uses what you allow. You can turn each one off here.
          <button className="block mt-3 w-full bg-purple-600 py-2 rounded-xl text-xs font-bold uppercase">Request all browser permissions</button>
        </div>

        <section>
          <h3 className="text-xs text-gray-400 uppercase font-bold mb-3">Browser Permissions</h3>
          {["microphone", "camera", "location", "notifications", "clipboard", "wake"].map(perm => (
            <div key={perm} className="flex items-center justify-between p-3 bg-[#0f0f23] border border-[#2e2160] rounded-2xl mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6d3fd1] to-[#4b27a0] flex items-center justify-center">
                    {perm === "microphone" && <Mic size={20}/>}
                    {perm === "camera" && <Camera size={20}/>}
                    {perm === "location" && <MapPin size={20}/>}
                    {perm === "notifications" && <Bell size={20}/>}
                    {perm === "clipboard" && <Clipboard size={20}/>}
                    {perm === "wake" && <Smartphone size={20}/>}
                </div>
                <div>
                  <div className="text-sm font-bold capitalize">{perm}</div>
                  <div className="text-xs text-gray-400 capitalize">{permissions[perm] || "ASK"}</div>
                </div>
              </div>
              <button 
                  onClick={() => togglePermission(perm)}
                  className={`w-12 h-7 rounded-full p-1 flex ${isAllowed(perm) ? "bg-purple-600 justify-end" : "bg-gray-700 justify-start"}`}
                >
                  <div className="w-5 h-5 bg-white rounded-full"/>
                </button>
            </div>
          ))}
        </section>

        <section>
          <h3 className="text-xs text-gray-400 uppercase font-bold mb-3">PHONE ACCESS (ROSE ANDROID APP)</h3>
          <p className="text-[10px] text-gray-500 mb-3">These work after you install the Rose Android app. Switches are saved now and the app will follow them.</p>
          {ANDROID_PERMS.map(perm => (
            <div key={perm.id} className="flex items-center justify-between p-3 bg-[#0f0f23] border border-[#2e2160] rounded-2xl mb-2">
              <div className="flex items-center gap-3">
                <div className="w-[42px] h-[42px] rounded-xl bg-gradient-to-br from-[#6d3fd1] to-[#4b27a0] flex items-center justify-center">
                    <Lock size={20}/>
                </div>
                <div>
                  <div className="text-[15px] font-bold">{perm.title}</div>
                  <div className="text-[12px] text-gray-400">{perm.subtitle}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">ANDROID APP NEEDED</span>
                <button onClick={() => setEnableSheet(perm)} className="text-[10px] bg-gray-700 px-2 py-1 rounded">HOW TO ENABLE</button>
                <button 
                  onClick={() => togglePermission(perm.id)}
                  className={`w-11 h-6 rounded-full p-1 flex ${isAllowed(perm.id) ? "bg-purple-600 justify-end" : "bg-gray-700 justify-start"}`}
                >
                  <div className="w-4 h-4 bg-white rounded-full"/>
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
      {enableSheet && (
        <div className="fixed inset-0 bg-black/80 flex items-end" onClick={() => setEnableSheet(null)}>
            <div className="bg-[#0f0f23] p-6 rounded-t-3xl w-full border-t border-[#2e2160]">
                <h3 className="text-lg font-bold mb-4">{enableSheet.title}</h3>
                {enableSheet.steps.map((step, i) => <p key={i} className="text-sm mb-2">{step}</p>)}
                <p className="text-[10px] text-gray-400 mt-4 bg-[#1a1a35] p-2 rounded-xl">Rose will always ask your OK before acting.</p>
            </div>
        </div>
      )}
    </div>
  );
};
