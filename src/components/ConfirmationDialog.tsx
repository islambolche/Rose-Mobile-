import React from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0A1628] border border-cyan-500/40 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(6,182,212,0.3)] text-center space-y-4">
        <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/30">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
        </div>
        <h3 className="text-lg font-black text-white">{title}</h3>
        <p className="text-xs text-slate-300">{message}</p>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-bold text-slate-300"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-2xl text-xs font-black uppercase text-white shadow-lg"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
