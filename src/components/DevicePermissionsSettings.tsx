import React, { useState, useEffect, useCallback } from "react";
import { getGlobalMicStream } from "../lib/audio-manager";
import { ArrowLeft, Mic, Bell, Lock, Smartphone, Loader2, Shield } from "lucide-react";
import { isAllowed, setAllowed, savePermissionToMap } from "../lib/permissions";

export const DevicePermissionsSettings: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<string>("");

  const checkState = useCallback(() => {
    const newState: Record<string, string> = {};
    ["microphone", "notifications", "phone_calls", "contacts", "notification_access"].forEach(id => {
        if (id === "phone_calls") newState[id] = "READY (OPENS DIALER)";
        else if (id === "contacts" || id === "notification_access") newState[id] = (window as any).RoseNative ? "ALLOW" : "NEEDS ANDROID APP";
        else newState[id] = isAllowed(id) ? "ALLOWED" : "ALLOW";
    });
    setResults(newState);
  }, []);

  useEffect(() => {
    checkState();
    window.addEventListener("focus", checkState);
    return () => window.removeEventListener("focus", checkState);
  }, [checkState]);

  const requestPermission = async (id: string) => {
    setProcessingId(id);
    try {
        if (id === "microphone") {
            try {
                const stream = await getGlobalMicStream({ audio: true });
                stream.getTracks().forEach(t => t.stop());
                setAllowed("microphone", true);
                setResults(r => ({...r, microphone: "ALLOWED"}));
            } catch (e: any) {
                setResults(r => ({...r, microphone: e.name === "NotAllowedError" ? "DENIED (CHECK SETTINGS)" : "ALLOWED"})); // Simplification
            }
        } else if (id === "notifications") {
            const res = await Notification.requestPermission();
            setResults(r => ({...r, notifications: res === "granted" ? "ALLOWED" : "TAP TO RETRY"}));
        } else if ((window as any).RoseNative) {
             const res = id === "notification_access" 
                ? await (window as any).RoseNative.openNotificationAccessSettings()
                : await (window as any).RoseNative.requestPermission(id === "phone_calls" ? "phone_calls" : "contacts");
             setResults(r => ({...r, [id]: res === "granted" ? "ALLOWED" : "TAP TO RETRY"}));
        }
    } finally {
        setProcessingId(null);
    }
  }

  const handleAllowAll = async () => {
    setLoading(true);
    const ids = ["microphone", "notifications", "phone_calls", "contacts", "notification_access"];
    let allowedCount = 0;
    let needsAndroid = 0;

    for (const id of ids) {
        setProcessingId(id);
        await requestPermission(id);
        if (results[id] === "ALLOWED") allowedCount++;
        if (results[id] === "NEEDS ANDROID APP") needsAndroid++;
    }
    setProcessingId(null);
    setLoading(false);
    setSummary(`${allowedCount} of ${ids.length} allowed. ${needsAndroid} need the Android app.`);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#020617] text-white flex flex-col font-sans">
      <header className="px-5 py-4 border-b border-[#2e2160] flex items-center gap-4">
        <button onClick={onClose} className="p-2 bg-[#1a1a35] rounded-xl"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-bold">Permissions</h2>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="bg-[#1a1a35] p-4 rounded-2xl border border-[#2e2160] text-sm">
            <button 
                disabled={loading}
                onClick={handleAllowAll}
                className={`w-full py-3 rounded-xl font-bold uppercase ${loading ? "bg-gray-600" : "bg-purple-600"}`}
            >
                {loading ? "ALLOWING..." : "ALLOW ALL"}
            </button>
            {summary && <p className="mt-3 text-xs text-center text-gray-400">{summary}</p>}
        </div>

        <section>
          {["microphone", "notifications", "phone_calls", "contacts", "notification_access"].map(id => (
            <div key={id} className="flex items-center justify-between p-3 bg-[#0f0f23] border border-[#2e2160] rounded-2xl mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1a1a35] flex items-center justify-center">
                    {processingId === id ? <Loader2 className="animate-spin" size={20}/> : <Lock size={20}/>}
                </div>
                <div>
                  <div className="text-sm font-bold capitalize">{id.replace('_', ' ')}</div>
                  <div className="text-xs text-gray-400">{results[id]}</div>
                </div>
              </div>
              <button 
                  disabled={loading || processingId !== null || results[id].includes("ALLOWED") || results[id].includes("NEEDS")}
                  onClick={() => requestPermission(id)}
                  className="text-xs font-bold px-3 py-1 bg-purple-600 rounded-lg"
                >
                  {results[id]}
              </button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};
