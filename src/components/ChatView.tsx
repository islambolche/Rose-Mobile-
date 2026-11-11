import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Mic } from 'lucide-react';
import { Message } from '../types';
import rosePortraitImg from '../assets/images/rose_portrait_1793010994175.jpg';

export const ChatView = ({ 
    chatHistory, 
    processCommand, 
    settings, 
    setCurrentView,
    isThinking
}: { 
    chatHistory: Message[], 
    processCommand: (text: string, mode?: "text" | "voice") => void, 
    settings: any,
    setCurrentView: (v: any) => void,
    isThinking: boolean
}) => {
    const [inputText, setInputText] = useState("");
    const [thinkingSeconds, setThinkingSeconds] = useState(0);
    const [roseAvatarError, setRoseAvatarError] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isThinking) {
            setThinkingSeconds(0);
            return;
        }
        setThinkingSeconds(0);
        const timer = setInterval(() => {
            setThinkingSeconds((prev) => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [isThinking]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatHistory, isThinking]);

    return (
        <div className="fixed inset-0 z-[90] bg-[#020617] flex flex-col overflow-hidden">
            {/* Layer 0: Fixed background image with dark overlay */}
            <div className="absolute inset-0 z-0 pointer-events-none select-none overflow-hidden">
                <img
                    src={rosePortraitImg}
                    alt="Rose"
                    className="w-full h-full object-cover object-center"
                />
                <div
                    className="absolute inset-0"
                    style={{ backgroundColor: "rgba(3,6,20,0.88)" }}
                />
            </div>

            {/* Layer 2: Header */}
            <header className="relative z-[2] px-5 py-4 border-b border-white/5 flex items-center gap-4 shrink-0 bg-[#020617]/90 backdrop-blur-md">
                <button onClick={() => setCurrentView("home")} className="p-2.5 bg-white/5 rounded-2xl text-white active:scale-95 transition-transform">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">CHAT</h2>
            </header>

            {/* Layer 1: Messages Container */}
            <div
                ref={scrollRef}
                className="relative z-[1] flex-1 min-h-0 overflow-y-auto space-y-4 no-scrollbar pb-32"
                style={{ padding: "12px 14px" }}
            >
                {chatHistory.map((m, idx) => {
                    const isUser = m.role === "user" || (m as any).sender === "user";
                    const textContent = m.content || m.text || "";
                    const isSystem = m.role === "system" || (m as any).isError || textContent.toLowerCase().includes("gemini error") || textContent === "Mic heard nothing";
                    const timeStr = m.time || (m.timestamp ? (typeof m.timestamp === 'string' ? m.timestamp : new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : "");
                    const isVoice = m.replyMode === "voice";

                    if (isSystem) {
                        const fallbackUser = chatHistory.slice(0, idx).reverse().find((u) => u.role === "user" || (u as any).sender === "user");
                        const retryText = String((m as any).retryText || fallbackUser?.text || fallbackUser?.content || "").trim();
                        return (
                            <div key={m.id || idx} className="flex flex-col w-full items-center my-1">
                                <div className="max-w-[90%] px-4 py-2.5 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-semibold text-center shadow-lg break-words flex flex-col items-center gap-1.5">
                                    <span>{textContent}</span>
                                    {retryText && (
                                        <button
                                            type="button"
                                            onClick={() => processCommand(retryText)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-100 text-[10px] font-bold uppercase tracking-wider active:scale-95 transition-all"
                                        >
                                            Retry
                                        </button>
                                    )}
                                </div>
                                {(m as any).debugLine && (
                                    <div className="max-w-[92%] text-[10px] text-slate-400 font-mono text-center mt-1 break-words px-2 whitespace-pre-line">
                                        {(m as any).debugLine}
                                    </div>
                                )}
                                {timeStr && (
                                    <span className="text-[10px] text-slate-400 font-medium mt-1">{timeStr}</span>
                                )}
                            </div>
                        );
                    }

                    return (
                        <div key={m.id || idx} className={`flex flex-col w-full ${isUser ? "items-end" : "items-start"}`}>
                            <div className={`flex items-end gap-2 w-full ${isUser ? "justify-end" : "justify-start"}`}>
                                {!isUser && (
                                    <div className="w-10 h-10 rounded-full bg-[#0F172A] border border-purple-500/30 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(168,85,247,0.25)] mb-1 relative">
                                        {!roseAvatarError ? (
                                            <img
                                                src="/rose-avatar.jpg"
                                                alt="Rose"
                                                onError={() => setRoseAvatarError(true)}
                                                className="w-full h-full rounded-full object-cover object-[50%_25%]"
                                            />
                                        ) : (
                                            <span className="text-xs">🌹</span>
                                        )}
                                        {isVoice && (
                                            <div className="absolute -top-1 -right-1 z-10 bg-purple-600 rounded-full p-0.5 border border-[#0F172A]">
                                                <Mic className="w-2 h-2 text-white" />
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className={`max-w-[82%] px-4 py-3 text-[15px] font-medium leading-relaxed shadow-lg relative ${
                                    isUser
                                        ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm"
                                        : "bg-[#0F172A]/85 backdrop-blur-md border border-purple-500/25 text-white rounded-2xl rounded-tl-sm whitespace-pre-wrap"
                                }`}>
                                    {isUser && isVoice && (
                                        <div className="absolute -top-2 -left-2 bg-purple-500 rounded-full p-1 border-2 border-[#020617] shadow-sm">
                                            <Mic className="w-2.5 h-2.5 text-white" />
                                        </div>
                                    )}
                                    {textContent}
                                </div>
                            </div>
                            {timeStr && (
                                <span className={`text-[10px] text-slate-400 font-medium mt-1 px-1 ${isUser ? "text-right pr-1" : "text-left pl-9"}`}>
                                    {timeStr}
                                </span>
                            )}
                        </div>
                    );
                })}

                {isThinking && (
                    <div className="flex flex-col w-full items-start">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-[#0F172A] border border-purple-500/30 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(168,85,247,0.25)]">
                                {!roseAvatarError ? (
                                    <img
                                        src="/rose-avatar.jpg"
                                        alt="Rose"
                                        onError={() => setRoseAvatarError(true)}
                                        className="w-full h-full rounded-full object-cover object-[50%_25%]"
                                    />
                                ) : (
                                    <span className="text-xs">🌹</span>
                                )}
                            </div>
                            <div className="bg-[#0F172A]/85 backdrop-blur-md border border-purple-500/25 text-purple-300 rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs font-semibold italic animate-pulse shadow-lg">
                                Rose is thinking... ({thinkingSeconds}s)
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Layer 2: Input Bar */}
            <div className="relative z-[2] px-3 pt-2 pb-2 border-t border-white/5 bg-[#0F172A]/90 backdrop-blur-md shrink-0 flex items-center gap-2">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && inputText.trim()) {
                            processCommand(inputText.trim());
                            setInputText("");
                        }
                    }}
                    placeholder={`Message ${settings.assistantName || "Rose"}...`}
                    className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                    onClick={() => {
                        if (inputText.trim()) {
                            processCommand(inputText.trim());
                            setInputText("");
                        }
                    }}
                    disabled={!inputText.trim()}
                    className="p-2.5 bg-purple-600 disabled:opacity-40 hover:bg-purple-500 text-white rounded-2xl active:scale-95 transition-all shadow-md shrink-0"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
