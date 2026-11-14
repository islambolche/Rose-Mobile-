import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Camera, Settings, X, AlertTriangle } from 'lucide-react';

export const HomeScreenV2 = ({
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
  return (
    <div style={{ 
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', 
      height: '100dvh', width: '100vw', overflow: 'hidden', 
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

      {/* VIDEO PREVIEWS */}
      {(cameraStream || screenStream) && (
        <div style={{
          position: 'fixed', top: '80px', right: '16px', zIndex: 100, width: '128px', aspectRatio: '3/4',
          background: 'black', borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(16,185,129,0.5)',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
        }}>
          <video
            ref={(el) => {
              if (el) {
                if (cameraStream) el.srcObject = cameraStream;
                else if (screenStream) el.srcObject = screenStream;
              }
            }}
            autoPlay playsInline muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <button
            onClick={() => {
              if (cameraStream) { cameraStream.getTracks().forEach((t: any) => t.stop()); setCameraStream(null); }
              if (screenStream) { screenStream.getTracks().forEach((t: any) => t.stop()); setScreenStream(null); }
            }}
            style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(220,38,38,0.8)', borderRadius: '50%', color: 'white', border: 'none', padding: '4px' }}
          >
            <X size={12} />
          </button>
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
          {[
            { icon: Camera, action: toggleCamera, active: !!cameraStream, color: '#10b981' },
            { icon: isAssistantEnabled ? Mic : MicOff, action: toggleMasterAssistant, active: isAssistantEnabled, color: '#ef4444' },
            { icon: Settings, action: () => setIsSettingsModalOpen(true), active: false, color: '#10b981' }
          ].map((btn, i) => (
            <button key={i} onClick={btn.action} style={{
              width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '12px', border: `1px solid ${btn.active ? btn.color : 'rgba(168,85,247,0.5)'}`,
              background: btn.active ? `${btn.color}33` : '#0a1628', color: btn.active ? btn.color : '#a855f7',
              transition: 'all 0.2s'
            }}>
              <btn.icon size={20} />
            </button>
          ))}
        </div>
      </header>

      {/* 2. TRANSCRIPT BOX */}
      <div style={{ flex: 1, minHeight: 0, margin: '8px', overflowY: 'auto', padding: '8px', background: 'rgba(15,23,42,0.9)', borderRadius: '16px' }}>
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

      {/* 3. IMAGE AREA */}
      <div style={{ width: '100vw', height: '100vw', flexShrink: 0, position: 'relative', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <img src="/rose-home-ai.png" alt="Rose" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }} />
        
        {/* Mic Waves */}
        {voiceActive && (
          <div style={{ position: 'absolute', left: '48%', top: '62%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 20, pointerEvents: 'none' }}>
             <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '32px' }}>
                 <motion.div style={{ width: '4px', background: '#a855f7', borderRadius: '9999px' }} animate={{height: Math.max(4, userAudioLevel/2)}} />
                 <motion.div style={{ width: '4px', background: '#a855f7', borderRadius: '9999px' }} animate={{height: Math.max(12, userAudioLevel)}} />
                 <motion.div style={{ width: '4px', background: '#a855f7', borderRadius: '9999px' }} animate={{height: Math.max(4, userAudioLevel/2)}} />
             </div>
             <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(168,85,247,0.3)', animation: 'pulse 1s infinite' }} />
             <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '32px' }}>
                 <motion.div style={{ width: '4px', background: '#a855f7', borderRadius: '9999px' }} animate={{height: Math.max(4, userAudioLevel/2)}} />
                 <motion.div style={{ width: '4px', background: '#a855f7', borderRadius: '9999px' }} animate={{height: Math.max(12, userAudioLevel)}} />
                 <motion.div style={{ width: '4px', background: '#a855f7', borderRadius: '9999px' }} animate={{height: Math.max(4, userAudioLevel/2)}} />
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
