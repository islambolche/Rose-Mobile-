import React, { useState, useEffect, useRef } from 'react';
import { Search, Trash2, Copy, Trash, X, ArrowDown } from 'lucide-react';
import { Message } from '../types';

interface TranscriptBoxProps {
  chatHistory: Message[];
  interimUserText?: string;
  interimRoseText?: string;
  assistantName?: string;
  onClearHistory: () => void;
  onDeleteMessage: (id: string) => void;
  onCopyMessage: (content: string) => void;
  renderExtra?: React.ReactNode;
}

export const TranscriptBox: React.FC<TranscriptBoxProps> = ({
  chatHistory,
  interimUserText,
  interimRoseText,
  assistantName = 'ROSE',
  onClearHistory,
  onDeleteMessage,
  onCopyMessage,
  renderExtra,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isUserScrolledUp, setIsUserScrolledUp] = useState<boolean>(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Filter messages for search: show full history from top to bottom
  const filteredMessages = searchTerm.trim()
    ? chatHistory.filter(m => (m.text || m.content || "").toLowerCase().includes(searchTerm.toLowerCase()))
    : chatHistory;

  // Scroll detection: checks if user has scrolled up to read older messages
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setIsUserScrolledUp(!isAtBottom);
  };

  // Initial scroll to bottom on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Auto-scroll to bottom on new messages or streaming chunks, UNLESS user scrolled up
  useEffect(() => {
    if (scrollRef.current && !isUserScrolledUp) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, interimUserText, interimRoseText]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      setIsUserScrolledUp(false);
    }
  };

  return (
    <div className="bg-[#0A1628]/90 border border-emerald-500/50 rounded-3xl p-3 shadow-[0_0_20px_rgba(16,185,129,0.2)] flex flex-col min-h-[160px] flex-1 overflow-hidden relative">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-1.5 shrink-0 px-0.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-[9px] font-black uppercase tracking-[3px] text-emerald-400 shrink-0">TRANSCRIPT</span>
          {isSearching && (
            <div className="flex items-center gap-1 bg-black/60 border border-emerald-500/40 rounded-full px-2 py-0.5 min-w-0 flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search messages..."
                className="bg-transparent text-white text-[10px] w-full outline-none placeholder:text-slate-500"
                autoFocus
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="text-slate-400 hover:text-white">
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          <button
            onClick={() => {
              setIsSearching(!isSearching);
              if (isSearching) setSearchTerm("");
            }}
            className={`p-1 rounded-full border transition-all active:scale-95 ${
              isSearching
                ? "bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                : "bg-black/40 border-emerald-500/30 text-slate-400 hover:text-white"
            }`}
            title="Search transcript"
          >
            <Search className="w-3 h-3" />
          </button>

          <button
            onClick={onClearHistory}
            className="p-1 bg-black/40 border border-red-500/30 rounded-full text-slate-400 hover:text-red-400 transition-all active:scale-95"
            title="Clear all history"
          >
            <Trash2 className="w-3 h-3" />
          </button>

          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider ml-0.5">Live HUD</span>
        </div>
      </div>

      {/* MESSAGES SCROLL CONTAINER */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-2 pr-1 relative custom-scrollbar"
      >
        {chatHistory.length === 0 && !interimUserText && !interimRoseText ? (
          /* Initial Empty State */
          <div className="flex flex-col items-center justify-center h-full text-center py-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold mb-0.5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              {(assistantName || 'Rose')[0].toUpperCase()}
            </div>
            <p className="text-[10px] font-semibold text-slate-200">Hello! I am {assistantName}, your personal AI assistant.</p>
            <p className="text-[9px] text-slate-400 mt-0">How can I help you today?</p>
          </div>
        ) : (
          <>
            {filteredMessages.map((m, idx) => {
              const isUser = m.role === 'user' || m.sender === 'user';
              const textContent = m.text || m.content || '';
              const messageId = m.id || `${idx}`;
              const isMenuOpen = activeMenuId === messageId;
              const timeDisplay = m.time || (m.timestamp ? String(m.timestamp) : '');

              return (
                <div
                  key={messageId}
                  className={`flex flex-col relative group ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5 px-0.5">
                    <span className={`text-[7.5px] font-bold uppercase tracking-widest ${isUser ? 'text-slate-500' : 'text-slate-400 font-black'}`}>
                      {isUser ? 'YOU' : 'ROSE'}
                    </span>
                    {timeDisplay && <span className="text-[7px] text-slate-600 font-mono">{timeDisplay}</span>}
                    {m.source && (
                      <span className="text-[6.5px] font-black uppercase text-emerald-400/80 px-1 bg-emerald-950/40 rounded border border-emerald-500/20">
                        {m.source}
                      </span>
                    )}
                  </div>

                  <div
                    onClick={() => setActiveMenuId(isMenuOpen ? null : messageId)}
                    className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-[11px] font-medium leading-relaxed cursor-pointer transition-all ${
                      isUser
                        ? 'bg-emerald-600 text-white rounded-br-none shadow-[0_0_10px_rgba(16,185,129,0.3)] hover:bg-emerald-500'
                        : 'bg-slate-800 border border-white/10 text-slate-200 rounded-bl-none shadow hover:border-white/20'
                    }`}
                  >
                    {textContent}
                  </div>

                  {/* Context Popover Menu for Copy & Delete */}
                  {isMenuOpen && (
                    <div className={`absolute top-full mt-1 z-30 bg-[#020617] border border-emerald-500/40 rounded-xl shadow-xl p-1 flex items-center gap-1 backdrop-blur-md ${isUser ? 'right-0' : 'left-0'}`}>
                      <button
                        onClick={() => {
                          onCopyMessage(textContent);
                          setActiveMenuId(null);
                        }}
                        className="flex items-center gap-1 text-[9px] font-bold text-slate-200 hover:text-emerald-300 px-2 py-1 rounded-lg hover:bg-emerald-500/20 transition-colors"
                      >
                        <Copy className="w-3 h-3 text-emerald-400" /> Copy
                      </button>
                      <button
                        onClick={() => {
                          if (m.id) onDeleteMessage(m.id);
                          setActiveMenuId(null);
                        }}
                        className="flex items-center gap-1 text-[9px] font-bold text-slate-200 hover:text-red-300 px-2 py-1 rounded-lg hover:bg-red-500/20 transition-colors"
                      >
                        <Trash className="w-3 h-3 text-red-400" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Live Interim User Transcript (green bubble on right) */}
            {interimUserText && (
              <div className="flex flex-col items-end opacity-90 animate-pulse">
                <span className="text-[7.5px] font-bold text-emerald-400 uppercase tracking-widest mb-0.5">
                  YOU
                </span>
                <div className="max-w-[85%] px-3 py-1.5 rounded-2xl text-[11px] font-medium bg-emerald-700/80 border border-emerald-400/40 text-white rounded-br-none shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                  {interimUserText}
                </div>
              </div>
            )}

            {/* Live Interim Rose Transcript (dark gray bubble on left labeled ROSE (REPLYING...)) */}
            {interimRoseText && (
              <div className="flex flex-col items-start opacity-90 animate-pulse">
                <span className="text-[7.5px] font-black text-slate-300 uppercase tracking-widest mb-0.5">
                  ROSE (REPLYING...)
                </span>
                <div className="max-w-[85%] px-3 py-1.5 rounded-2xl text-[11px] font-medium bg-slate-800 border border-white/20 text-slate-200 rounded-bl-none shadow-md">
                  {interimRoseText}
                </div>
              </div>
            )}
            
            {renderExtra && (
              <div className="flex flex-col items-center py-4 w-full">
                {renderExtra}
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating "↓ নতুন কথা" (New Message) Badge when Scrolled Up */}
      {isUserScrolledUp && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-3 right-4 z-30 bg-emerald-600 hover:bg-emerald-500 border border-emerald-300 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.6)] flex items-center gap-1 active:scale-95 transition-transform"
        >
          <ArrowDown className="w-3 h-3" /> ↓ নতুন কথা
        </button>
      )}
    </div>
  );
};
