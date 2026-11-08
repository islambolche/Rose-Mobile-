import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
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
    processCommand: (text: string) => void, 
    settings: any,
    setCurrentView: (v: any) => void,
    isThinking: boolean
}) => {
    const [inputText, setInputText] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

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

                    if (isSystem) {
                        return (
                            <div key={m.id || idx} className="flex flex-col w-full items-center my-1">
                                <div className="max-w-[90%] px-4 py-2.5 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs font-semibold text-center shadow-lg break-words">
                                    {textContent}
                                </div>
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
                                    <div className="w-7 h-7 rounded-full bg-[#0F172A] border border-purple-500/30 flex items-center justify-center shrink-0 shadow-md mb-1">
                                        <span className="text-xs">🌹</span>
                                    </div>
                                )}
                                <div className={`max-w-[82%] px-4 py-3 text-[15px] font-medium leading-relaxed shadow-lg ${
                                    isUser
                                        ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm"
                                        : "bg-[#0F172A]/85 backdrop-blur-md border border-purple-500/25 text-white rounded-2xl rounded-tl-sm whitespace-pre-wrap"
                                }`}>
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
                            <div className="w-7 h-7 rounded-full bg-[#0F172A] border border-purple-500/30 flex items-center justify-center shrink-0 shadow-md">
                                <span className="text-xs">🌹</span>
                            </div>
                            <div className="bg-[#0F172A]/85 backdrop-blur-md border border-purple-500/25 text-purple-300 rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs font-semibold italic animate-pulse shadow-lg">
                                Rose is thinking...
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
