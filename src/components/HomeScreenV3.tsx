import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Camera, CameraOff, Settings, X, AlertTriangle } from 'lucide-react';

export const HomeScreenV3 = ({
  assistantName,
  chatHistory,
  voiceActive,
  userAudioLevel,
  cameraStream,
  screenStream,
  setCameraStream,
  setScreenStream,
  toggleCamera,
  toggleMasterAssistant,
  isAssistantEnabled,
  setIsSettingsModalOpen,
  criticalError,
  setCriticalError,
  setCurrentView
}: any) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = React.useState('');
  const [viewportHeight, setViewportHeight] = React.useState(window.innerHeight);
  const [keyboardOpen, setKeyboardOpen] = React.useState(false);

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatHistory]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    setInputText('');
  };

  const handleFocus = () => {
    setKeyboardOpen(true);
    window.scrollTo(0, 0);
  };
  const handleBlur = () => {
    setTimeout(() => setKeyboardOpen(false), 100);
  };

  React.useEffect(() => {
    if (!voiceActive) return;
    const draw = (canvasId: string, isLeft: boolean) => {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#c77dff');
      gradient.addColorStop(1, '#ff5ccf');
      
      ctx.fillStyle = gradient;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#c77dff';
      
      const barCount = 11;
      const barWidth = canvas.width / (barCount * 1.5);
      const gap = canvas.width / (barCount * 3);
      
      for (let i = 0; i < barCount; i++) {
        const h = Math.max(4, (userAudioLevel / 100) * canvas.height * (i % 3 === 1 ? 1 : 0.5));
        const x = i * (barWidth + gap);
        const y = (canvas.height - h) / 2;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, h, barWidth / 2);
        ctx.fill();
      }
    };
    draw('left-waves', true);
    draw('right-waves', false);
  }, [voiceActive, userAudioLevel]);

  return (
    <div style={{ 
      position: 'fixed', top: 0, left: 0, width: '100vw', height: `${viewportHeight}px`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', 
      background: '#050814', color: 'white', fontFamily: 'sans-serif'
    }}>

      {/* ERROR BOX */}
      {criticalError && (
        <div style={{
          position: 'fixed', top: '80px', left: '24px', right: '24px', zIndex: 1000,
          background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(168,85,247,0.5)',
          borderRadius: '24px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
        }}>
          <h3 style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>Connection Issue</h3>
          <p style={{ fontSize: '10px', marginBottom: '16px' }}>{criticalError.message || "Connection failed."}</p>
          <button onClick={() => { setCriticalError(null); setCurrentView("connections"); }} style={{
            width: '100%', padding: '12px', background: '#7c3aed', color: 'white',
            fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', borderRadius: '9999px', border: 'none'
          }}>Go to Connections</button>
        </div>
      )}

      {/* 1. TOP BAR */}
      <header style={{ 
        height: '64px', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontStyle: 'italic' }}>
            {(assistantName || "Rose")[0].toUpperCase()}
          </div>
          <h1 style={{ fontSize: '14px', fontWeight: 900, fontStyle: 'italic', textTransform: 'uppercase' }}>{assistantName || "Rose"}</h1>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => toggleMasterAssistant()} style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: `1px solid ${isAssistantEnabled ? '#ef4444' : 'rgba(168,85,247,0.5)'}`, background: isAssistantEnabled ? '#ef444433' : '#0a1628', color: isAssistantEnabled ? '#ef4444' : '#a855f7' }}>
              {isAssistantEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button onClick={toggleCamera} style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: `1px solid ${cameraStream ? '#10b981' : 'rgba(168,85,247,0.5)'}`, background: cameraStream ? '#10b98133' : '#0a1628', color: cameraStream ? '#10b981' : '#a855f7' }}>
              {cameraStream ? <Camera size={20} /> : <CameraOff size={20} />}
            </button>
            <button onClick={() => setIsSettingsModalOpen(true)} style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', border: '1px solid rgba(168,85,247,0.5)', background: '#0a1628', color: '#a855f7' }}>
              <Settings size={20} />
            </button>
        </div>
      </header>

      {/* 2. TRANSCRIPT BOX */}
      <div style={{ flex: 1, minHeight: 0, margin: '8px', overflowY: 'auto', padding: '8px', background: 'rgba(15,23,42,0.9)', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto' }} ref={scrollRef}>
          {chatHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px' }}>
               <p style={{ fontSize: '10px', fontWeight: 600 }}>Hello! I am {assistantName}, your personal AI assistant.</p>
               <p style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px' }}>How can I help you today?</p>
            </div>
          ) : (
            chatHistory.map((m: any, idx: number) => (
              <div key={idx} style={{ marginBottom: '8px', textAlign: m.role === 'user' ? 'right' : 'left' }}>
                <div style={{ 
                  display: 'inline-block', padding: '8px 12px', borderRadius: '16px', fontSize: '11px',
                  background: m.role === 'user' ? '#059669' : '#1e293b', color: 'white'
                }}>
                  {m.content || m.text}
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Input Row */}
        <div style={{ minHeight: '56px', padding: '8px', display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <img src="/agents/rose-avatar.png" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          <input 
            value={inputText} onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Type a message..."
            enterKeyHint="send"
            style={{ flex: 1, height: '44px', borderRadius: '22px', fontSize: '16px', padding: '0 16px', background: '#0a1628', border: '1px solid #334155', color: 'white' }}
          />
          <button onClick={handleSend} style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #12b981, #0ea5a4)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', padding: 0, opacity: inputText.trim() ? 1 : 0.4, flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <button onClick={() => confirm("Delete all chats?") && (window.location.reload())} style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
            <X size={20} />
          </button>
        </div>
      </div>

      {/* 3. IMAGE AREA */}
      <div style={{ position: 'relative', width: '100vw', height: '100vw', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)', display: keyboardOpen ? 'none' : 'flex' }}>
        <img src="/rose-mobile.png" alt="Rose" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
        
        {/* Mic Waves */}
        {voiceActive && (
          <>
            <canvas id="left-waves" style={{ position: 'absolute', left: '38%', top: '60%', width: '8.5%', height: '8%', pointerEvents: 'none' }} />
            <canvas id="right-waves" style={{ position: 'absolute', left: '53.5%', top: '60%', width: '8.5%', height: '8%', pointerEvents: 'none' }} />
          </>
        )}
      </div>
    </div>
  );
};
