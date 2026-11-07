import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Sparkles } from 'lucide-react';
import { Message } from '../types';

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
        <div className="fixed inset-0 z-[90] bg-[#020617] flex flex-col">
            <header className="px-5 py-4 border-b border-white/5 flex items-center gap-4 shrink-0 bg-[#020617]/80 backdrop-blur-md">
                <button onClick={() => setCurrentView("home")} className="p-2.5 bg-white/5 rounded-2xl text-white active:scale-95 transition-transform">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">CHAT</h2>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar pb-32">
                {chatHistory.map((m, idx) => {
                    const isUser = m.role === "user" || m.sender === "user";
                    const textContent = m.content || m.text || "";
                    const timeStr = m.timestamp ? (typeof m.timestamp === 'string' ? m.timestamp : new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : "";
                    return (
                        <div key={m.id || idx} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                            <div className="flex items-center gap-1.5 mb-1 px-1">
                                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                                    {isUser ? "YOU" : settings.assistantName || "ROSE"}
                                </span>
                                {timeStr && <span className="text-[7.5px] text-slate-600">{timeStr}</span>}
                                {m.source && <span className="text-[7px] font-black uppercase text-orange-400/80 px-1 bg-orange-950/40 rounded border border-orange-500/20">{m.source}</span>}
                            </div>
                            <div className={`max-w-[85%] p-3.5 text-xs font-medium leading-relaxed rounded-2xl ${
                                isUser
                                    ? "bg-orange-600 text-white rounded-tr-sm shadow-md"
                                    : "bg-[#0F172A] border border-orange-500/20 text-slate-100 rounded-tl-sm whitespace-pre-wrap"
                            }`}>
                                {textContent}
                            </div>
                        </div>
                    );
                })}
                {isThinking && (
                    <div className="flex justify-start">
                        <div className="text-[10px] font-bold text-orange-400 italic px-2">{settings.assistantName || "Rose"} is typing...</div>
                    </div>
                )}
            </div>

            <div className="px-3 pt-2 pb-2 border-t border-white/5 bg-[#0F172A]/90 backdrop-blur-md shrink-0 flex items-center gap-2">
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
                    placeholder={`Message ${settings.assistantName}...`}
                    className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-orange-500"
                />
                <button
                    onClick={() => {
                        if (inputText.trim()) {
                            processCommand(inputText.trim());
                            setInputText("");
                        }
                    }}
                    disabled={!inputText.trim()}
                    className="p-2.5 bg-orange-600 disabled:opacity-40 hover:bg-orange-500 text-white rounded-2xl active:scale-95 transition-all shadow-md shrink-0"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
