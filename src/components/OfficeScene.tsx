import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Send, X, Sparkles, MessageSquare, History, Settings, User, Volume2, VolumeX, ArrowLeft } from 'lucide-react';
import { directGeminiGenerate } from '../lib/ai-service';
import { extractReplyText, prepareHistory } from '../lib/ai-utils';

interface Character {
  id: string;
  name: string;
  role: string;
  systemInstruction: string;
  defaultVoice: string;
  color: string;
  deskX: number;
  deskY: number;
}

const CHARACTERS: Character[] = [
  {
    id: 'rose',
    name: 'Rose',
    role: 'Reception & General Assistant',
    systemInstruction: 'You are Rose, the friendly and warm receptionist and general AI assistant of the office. Always answer warmly and concisely in the user\'s language.',
    defaultVoice: 'Sulafat',
    color: '#8B5CF6',
    deskX: 180,
    deskY: 280,
  },
  {
    id: 'writer',
    name: 'Writer',
    role: 'Content & Script Specialist',
    systemInstruction: 'You are Writer, specialized in crafting notes, blog posts, scripts, and captions in Bengali and English. Be creative, precise, and concise.',
    defaultVoice: 'Vindemiatrix',
    color: '#EC4899',
    deskX: 420,
    deskY: 280,
  },
  {
    id: 'designer',
    name: 'Designer',
    role: 'Creative & Image Specialist',
    systemInstruction: 'You are Designer, helping users brainstorm image concepts, UI design layouts, and visual creative prompts. Be inspiring and concise.',
    defaultVoice: 'Laomedeia',
    color: '#06B6D4',
    deskX: 660,
    deskY: 280,
  },
  {
    id: 'support',
    name: 'Support',
    role: 'Customer & Shop Support',
    systemInstruction: 'You are Support, answering business and customer service questions using shop catalog info, delivery policies, and friendly assistance. Be helpful and polite.',
    defaultVoice: 'Kore',
    color: '#10B981',
    deskX: 900,
    deskY: 280,
  },
];

export const OfficeScene = ({
  apiKey,
  onSwitchToClassic,
  onOpenSettings,
  onOpenHistory,
  onOpenChat,
  onOpenDeveloper,
}: {
  apiKey: string;
  onSwitchToClassic: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenChat: () => void;
  onOpenDeveloper: () => void;
}) => {
  const [activeChar, setActiveChar] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; charName?: string }>>([]);
  const [inputText, setInputText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hoveredChar, setHoveredChar] = useState<string | null>(null);
  const [thoughtBubble, setThoughtBubble] = useState<{ charId: string; text: string } | null>(null);

  // Periodic random thought bubbles for idle animation
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeChar) return;
      const randomChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
      const thoughts = [
        'Everything is running smoothly!',
        'Ready to help out.',
        'Checking the latest tasks...',
        'What shall we create today?'
      ];
      const text = thoughts[Math.floor(Math.random() * thoughts.length)];
      setThoughtBubble({ charId: randomChar.id, text });
      setTimeout(() => setThoughtBubble(null), 4000);
    }, 12000);
    return () => clearInterval(interval);
  }, [activeChar]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChar) return;
    const userText = inputText.trim();
    setInputText('');
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);

    try {
      setIsSpeaking(true);
      const currentMessages = [...messages, { sender: 'user', text: userText }];
      const preparedHistory = prepareHistory(currentMessages.map(m => ({ role: m.sender === 'user' ? 'user' : 'model', text: m.text })), activeChar.systemInstruction);
      console.log("FINAL TEXT:", userText, "CONTENTS LEN:", preparedHistory.length);
      
      const data = await directGeminiGenerate({
        model: 'gemini-3.8-flash',
        systemInstruction: activeChar.systemInstruction,
        contents: preparedHistory,
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
        apiKey
      });
      const reply = extractReplyText(data);
      setMessages((prev) => [...prev, { sender: 'assistant', text: reply.trim(), charName: activeChar.name }]);

      // Save to shared localStorage history
      try {
        const history = JSON.parse(localStorage.getItem('iyabd_chat_history') || '[]');
        history.push({ role: 'user', content: userText, timestamp: new Date().toISOString() });
        history.push({ role: 'assistant', content: `[${activeChar.name}] ${reply.trim()}`, timestamp: new Date().toISOString() });
        localStorage.setItem('iyabd_chat_history', JSON.stringify(history));
      } catch (e) {}

    } catch (e) {
      setMessages((prev) => [...prev, { sender: 'assistant', text: "Sorry, I encountered an error connecting to Gemini.", charName: activeChar.name }]);
    } finally {
      setIsSpeaking(false);
    }
  };

  // Load background image
  const [backgroundImage, setBackgroundImage] = useState<string | null>(() => {
    try {
      return localStorage.getItem('rose_office_bg');
    } catch {
      return null;
    }
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setBackgroundImage(result);
        localStorage.setItem('rose_office_bg', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const [isMicOn, setIsMicOn] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);

  // Simulate sound detection pulse
  useEffect(() => {
    if (isMicOn) {
        const interval = setInterval(() => {
            setIsPulsing(prev => !prev);
        }, 500);
        return () => clearInterval(interval);
    } else {
        setIsPulsing(false);
    }
  }, [isMicOn]);

  return (
    <div className="fixed inset-0 bg-[#020617] flex flex-col select-none overflow-hidden text-white font-sans">
      {/* Top Slim Bar */}
      <header className="h-14 px-6 bg-[#0B0F19]/90 border-b border-purple-500/20 flex items-center justify-between shrink-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300 font-black italic">
            R
          </div>
          <h1 className="text-base font-black italic tracking-wider uppercase text-white">ROSE</h1>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setIsMicOn(!isMicOn)} className={`p-2 rounded-xl transition-all ${isMicOn ? 'bg-red-600 text-white' : 'bg-white/10 text-slate-300'}`}>
             <Mic className="w-5 h-5" />
          </button>
          <button onClick={onOpenChat} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-300 border border-white/10 transition-colors">Chat</button>
          {/* Keep Camera, Settings etc here */}
        </div>
      </header>

      {/* Rose Character Scene */}
      <div className="flex-1 relative bg-[#020617] flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm" onClick={() => { /* tap to talk */ }}>
            <img src="/src/assets/images/rose_portrait_1793010994175.jpg" alt="Rose AI Assistant" className="w-full rounded-2xl shadow-2xl" />
            
            {isMicOn && isPulsing && (
                <>
                    <div className="absolute top-[20%] left-[10%] w-6 h-6 bg-purple-500 rounded-full animate-pulse opacity-70" />
                    <div className="absolute top-[20%] right-[10%] w-6 h-6 bg-purple-500 rounded-full animate-pulse opacity-70" />
                </>
            )}
        </div>
      </div>
      
      {/* Side Panel Chat Modal when a character is clicked */}
      <AnimatePresence>
        {activeChar && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-96 bg-[#0B0F19] border-l border-purple-500/30 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#111827]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-black italic text-lg shadow-lg">
                  {activeChar.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider text-white">{activeChar.name}</h3>
                  <p className="text-[10px] text-purple-300 font-bold uppercase tracking-tight">{activeChar.role}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveChar(null)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300 active:scale-95 transition-transform"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3.5 rounded-2xl text-xs font-medium leading-relaxed shadow-md ${
                      m.sender === 'user'
                        ? 'bg-purple-600 text-white rounded-br-none'
                        : 'bg-[#1E293B] text-slate-100 border border-white/5 rounded-bl-none'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {isSpeaking && (
                <div className="flex items-center gap-2 p-3 bg-[#1E293B] rounded-2xl w-max border border-white/5">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce delay-100" />
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce delay-200" />
                </div>
              )}
            </div>

            {/* Input Box */}
            <div className="p-4 border-t border-white/10 bg-[#111827] flex items-center gap-3">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={`Message ${activeChar.name}...`}
                className="flex-1 bg-[#090D1A] border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-purple-500 font-medium"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isSpeaking}
                className="p-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-2xl shadow-lg active:scale-95 transition-all shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
