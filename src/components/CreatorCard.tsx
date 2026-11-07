import React from "react";
import { X } from "lucide-react";
import { CreatorProfileContent } from "./CreatorProfileContent";

interface CreatorCardProps {
  onClose: () => void;
}

export const CreatorCard: React.FC<CreatorCardProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto p-4 bg-black/80 backdrop-blur-md">
      <div className="max-w-sm mx-auto relative pb-6 pt-16">
        <button onClick={onClose} className="fixed top-4 right-4 z-50 text-slate-400 hover:text-white p-3 bg-white/5 rounded-full">
          <X className="w-6 h-6" />
        </button>
        <CreatorProfileContent />
      </div>
    </div>
  );
};
