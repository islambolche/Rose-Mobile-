import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Lock, ClipboardPaste, ExternalLink, Save, Check, Loader2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { KeyStatus } from '../lib/chatEngines';

interface ApiKeyCardProps {
  inputId?: string;
  displayName: string;
  icon: React.ElementType;
  status: KeyStatus;
  apiKey: string;
  placeholder: string;
  link: string;
  onChange?: (key: string) => void;
  onSave: (key: string) => Promise<void>;
  onPaste: () => Promise<void>;
  onGet: () => void;
  isVerifying: boolean;
}

export const ApiKeyCard: React.FC<ApiKeyCardProps> = ({
  inputId,
  displayName,
  icon: Icon,
  status,
  apiKey,
  placeholder,
  link,
  onChange,
  onSave,
  onPaste,
  onGet,
  isVerifying,
}) => {
  const [localKey, setLocalKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalKey(apiKey);
  }, [apiKey]);

  const renderStatusBadge = () => {
    if (isVerifying) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/15 border border-purple-400/40 rounded-full shrink-0">
          <Loader2 className="w-3 h-3 text-purple-300 animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">...</span>
        </div>
      );
    }
    const hasStoredKey = Boolean(apiKey && apiKey.trim());
    const effectiveStatus: KeyStatus =
      hasStoredKey && status === 'NOT SET' ? 'SAVED – NOT TESTED' : status;

    if (effectiveStatus === 'READY' || effectiveStatus === 'CONNECTED') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/15 border border-emerald-500/40 rounded-full shrink-0">
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">CONNECTED</span>
        </div>
      );
    }
    if (effectiveStatus === 'LIMIT REACHED') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/40 rounded-full shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">LIMIT REACHED</span>
        </div>
      );
    }
    if (effectiveStatus === 'INVALID') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/15 border border-red-500/40 rounded-full shrink-0">
          <XCircle className="w-3 h-3 text-red-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-red-400">INVALID</span>
        </div>
      );
    }
    if (effectiveStatus === 'SAVED – NOT TESTED' || hasStoredKey) {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/40 rounded-full shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">SAVED – NOT TESTED</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800/80 border border-slate-600/40 rounded-full shrink-0">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">NOT SET</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="w-full p-4 bg-[#0F172A]/85 rounded-[2rem] border border-purple-500/30 shadow-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-full bg-purple-600 border border-purple-400/30 flex items-center justify-center text-white shrink-0 shadow-md">
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-black text-lg tracking-wider text-white truncate">{displayName}</h3>
        </div>
        {renderStatusBadge()}
      </div>

      {/* Input */}
      <div className="relative w-full">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none">
          <Lock className="w-4 h-4" />
        </div>
        <input
          id={inputId}
          ref={inputRef}
          type={showKey ? 'text' : 'password'}
          value={localKey}
          onChange={(e) => {
            setLocalKey(e.target.value);
            onChange?.(e.target.value);
          }}
          placeholder={placeholder}
          className="w-full p-4 pl-11 pr-24 bg-[#0F172A]/90 rounded-2xl border border-purple-500/30 focus:border-purple-400 text-sm text-white font-mono outline-none shadow-lg transition-colors"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            type="button"
            onClick={async () => {
              await onPaste();
            }}
            className="p-2 text-slate-400 hover:text-white"
          >
            <ClipboardPaste className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setShowKey(!showKey)} className="p-2 text-slate-400 hover:text-white">
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Bottom Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onGet}
          className="p-4 bg-transparent hover:bg-[#0F172A] rounded-2xl border border-purple-500/30 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-purple-300 active:scale-[0.98] transition-all"
        >
          <ExternalLink className="w-4 h-4" />
          <span>GET KEY</span>
        </button>
        <button
          type="button"
          onClick={() => onSave(localKey)}
          disabled={isVerifying}
          className="p-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 rounded-2xl border border-purple-400/40 shadow-xl shadow-purple-950/50 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-white active:scale-[0.98] transition-all"
        >
          {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>SAVE</span>
        </button>
      </div>
    </div>
  );
};
