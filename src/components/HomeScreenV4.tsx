import React, { useState, useEffect, useRef } from 'react';
import { Mic, Camera, Image as ImageIcon, Settings, X, Send, Trash2 } from 'lucide-react';
import { useRoseLive } from '../lib/useRoseLive';
import { getGeminiKey } from '../lib/geminiKey';
import { buildAssistantSystemInstruction } from '../types/settings';

export const HomeScreenV4 = ({
  assistantName,
  chatHistory,
  setChatHistory,
  saveChatHistory,
  cameraStream,
  toggleCamera,
  setIsSettingsModalOpen,
  unifiedSettings
}: any) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState('');
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const live = useRoseLive(() => ({
    apiKey: getGeminiKey(),
    model: 'gemini-3.8-flash',
    voiceName: unifiedSettings.voiceName || "Sulafat",
    systemInstruction: buildAssistantSystemInstruction(unifiedSettings),
    onUserText: (t) => {}, 
    onRoseText: (t) => {},
    onTurnComplete: () => {}
  }));


  useEffect(() => {
    const handleVisualViewport = () => {
      const height = window.visualViewport?.height || window.innerHeight;
      setViewportHeight(height);
      setKeyboardOpen(window.innerHeight - height > 120);
    };
    window.visualViewport?.addEventListener('resize', handleVisualViewport);
    window.visualViewport?.addEventListener('scroll', handleVisualViewport);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleVisualViewport);
      window.visualViewport?.removeEventListener('scroll', handleVisualViewport);
    };
  }, []);

  const handleSend = () => { 
    if (!inputText.trim()) return;
    if (live.on && live.session) {
      live.session.sendText(inputText);
    }
    setInputText(''); 
  };
  const handleFocus = () => { setKeyboardOpen(true); window.scrollTo(0, 0); };
  const handleBlur = () => { setTimeout(() => setKeyboardOpen(false), 100); };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: `${viewportHeight}px`, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'linear-gradient(180deg, #050a24 0%, #0a0f3a 60%, #1a0b4a 100%)', color: 'white', fontFamily: 'sans-serif' }}>
      {!keyboardOpen && (
        <div style={{ width: '100vw', aspectRatio: '941 / 650', overflow: 'hidden', flexShrink: 0 }}>
            <img src="/rose-top.jpg" onError={(e) => (e.target as HTMLImageElement).src = '/rose.jpg'} style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'top' }} />
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, borderRadius: '0 0 28px 28px', borderBottom: '2px solid rgba(110,100,255,0.7)', boxShadow: '0 0 20px rgba(99,102,241,0.5)', background: 'rgba(5,8,40,0.9)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }} ref={scrollRef}>
          {chatHistory.map((m: any, idx: number) => (
              <div key={idx} style={{ marginBottom: '8px', textAlign: m.role === 'user' ? 'right' : 'left' }}>
                <div style={{ display: 'inline-block', padding: '10px 14px', borderRadius: '20px', fontSize: '13px', background: m.role === 'user' ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'rgba(30, 41, 59, 0.8)', color: 'white' }}>{m.content || m.text}</div>
              </div>
          ))}
        </div>
        <div style={{ fontSize: '11px', color: '#8b8cff', padding: '0 10px' }}>
            Session: {live.status} | sent: {live.sent} | received: {live.recv} | 
            Key: {getGeminiKey() ? `yes (len ${getGeminiKey().length})` : 'no'} | 
            Path: Google API (Direct)
        </div>
        {live.error && <div style={{ color: 'red', fontSize: '11px', padding: '5px' }}>{live.error}</div>}

        <div style={{ margin: '10px', height: '60px', borderRadius: '30px', border: '2px solid rgba(130,110,255,0.9)', background: 'rgba(12,14,60,0.95)', boxShadow: '0 0 16px rgba(120,90,255,0.5)', display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '6px', gap: '8px', flexShrink: 0 }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'black', flexShrink: 0 }}>R</div>
          <input value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} onFocus={handleFocus} onBlur={handleBlur} placeholder="Type a message..." style={{ flex: 1, minWidth: 0, height: '44px', background: 'transparent', border: 'none', color: 'white', fontSize: '17px', padding: '0 10px' }} />
          <button onClick={handleSend} style={{ width: '44px', height: '44px', borderRadius: '50%', background: inputText.trim() ? 'linear-gradient(135deg, #7c3aed, #c026d3)' : 'rgba(255,255,255,0.1)', flexShrink: 0 }}><Send size={20}/></button>
          <button onClick={() => setShowDeleteConfirm(true)} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,77,109,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d6d', flexShrink: 0, border: 'none', marginLeft: '4px', marginRight: '-2px' }}><Trash2 size={16}/></button>
        </div>
      </div>

      {!keyboardOpen && (
        <div style={{ display: 'flex', margin: '0 12px 12px', gap: '10px', flexShrink: 0 }}>
            <button onClick={live.toggle} style={{ flex: 1, height: '76px', borderRadius: '22px', border: `2px solid ${live.on ? '#ff2fd0' : '#334155'}`, background: 'rgba(5,8,40,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', transform: `scale(${1 + live.level * 0.25})` }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" strokeWidth="2"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22d3ee"/><stop offset="100%" stopColor="#ff2fd0"/></linearGradient></defs><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM10 5h4M10 8h4M10 11h4M12 14v2m-3 2h6m-4 2h2" stroke="url(#g)"/><path d="M3 3l18 18" stroke={live.on ? "transparent" : "grey"}/></svg>
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                    {[...Array(5)].map((_, i) => <div key={i} style={{ width: '3px', height: `${3 + live.level * 30}px`, background: 'linear-gradient(to top, #22d3ee, #ff2fd0)' }} />)}
                </div>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>{live.on ? "Mic ON" : "Mic OFF"}</span>
            </button>
            <button onClick={toggleCamera} style={{ flex: 1, height: '76px', borderRadius: '22px', border: `2px solid #2f7bff`, background: 'rgba(5,8,40,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Camera size={24} color="#2f7bff" /><span style={{ fontSize: '15px', fontWeight: 'bold', color: 'white' }}>Camera</span></button>
            <button style={{ flex: 1, height: '76px', borderRadius: '22px', border: `2px solid #12e29a`, background: 'rgba(5,8,40,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><ImageIcon size={24} color="#12e29a" /><span style={{ fontSize: '15px', fontWeight: 'bold', color: 'white' }}>Gallery</span></button>
            <button onClick={() => setIsSettingsModalOpen(true)} style={{ flex: 1, height: '76px', borderRadius: '22px', border: `2px solid #9b5cff`, background: 'rgba(5,8,40,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Settings size={24} color="#9b5cff" /><span style={{ fontSize: '15px', fontWeight: 'bold', color: 'white' }}>Settings</span></button>
        </div>
      )}

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#0b0f3a', border: '1px solid rgba(130,110,255,0.8)', borderRadius: '20px', padding: '20px', width: '80%', maxWidth: '320px' }}>
                <h3 style={{ color: 'white', marginBottom: '15px', fontSize: '16px' }}>Delete all chats?</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#334155', color: 'white' }}>Cancel</button>
                    <button onClick={() => { setChatHistory([]); localStorage.removeItem('rose_chat_history'); setShowDeleteConfirm(false); }} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#ff4d6d', color: 'white' }}>Delete</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
