import { ArrowLeft, Facebook, Smartphone, Monitor, Lock } from "lucide-react";
import { IntegrationItem } from "./IntegrationItem";

export const IntegrationsView = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="fixed inset-0 z-[110] bg-[#020617] text-white flex flex-col font-sans">
      <header className="px-5 py-4 border-b border-purple-500/20 flex items-center gap-4 shrink-0 bg-[#020617]/90 backdrop-blur-md">
        <button onClick={onBack} className="p-2.5 bg-purple-500/10 rounded-2xl text-purple-400 active:scale-95 transition-transform">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">INTEGRATIONS</h2>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4 pb-32">
        <IntegrationItem title="Facebook Page" subtitle="Automate comments and posts" icon={Facebook} connected={false} />
        <IntegrationItem title="Phone control" subtitle="Sync with Android app" icon={Smartphone} connected={false} />
        <IntegrationItem title="PC control" subtitle="Sync with PC agent" icon={Monitor} connected={false} />
      </div>
    </div>
  );
};
