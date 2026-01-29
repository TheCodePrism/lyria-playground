import LyriaPlayground from "@/components/playground/LyriaPlayground";

export const metadata = {
  title: "Lyria RealTime — All-in-One Playground",
  description: "Next-gen AI music generation playground powered by Google Lyria.",
};

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="p-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl cyber-gradient flex items-center justify-center font-bold text-white shadow-lg overflow-hidden">
            <span className="text-xl">L</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">LYRIA <span className="text-primary">STUDIO</span></h1>
            <p className="text-[10px] opacity-40 font-mono uppercase tracking-[0.2em]">Real-time AI Synthesis</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium opacity-60">
          <a href="#" className="hover:text-primary transition-colors">Documentation</a>
          <a href="#" className="hover:text-primary transition-colors">Presets</a>
          <a href="#" className="hover:text-primary transition-colors">Community</a>
        </div>
      </header>

      {/* Main Content */}
      <LyriaPlayground />

      {/* Footer */}
      <footer className="p-8 text-center border-t border-white/5 opacity-30 text-[11px] font-mono uppercase tracking-widest">
        &copy; 2026 Lyria Studio &bull; Advancing Generative Audio
      </footer>
    </main>
  );
}
