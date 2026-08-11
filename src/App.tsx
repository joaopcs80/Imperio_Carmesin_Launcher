import { useState } from "react";
import { Play, Download, Settings, Users, Server, Shield } from "lucide-react";
import bgImage from "./assets/bg.png";
import "./App.css";

function App() {
  const [status, setStatus] = useState<"idle" | "downloading" | "ready" | "playing">("idle");
  const [progress, setProgress] = useState(0);

  const handlePlayClick = () => {
    if (status === "idle") {
      setStatus("downloading");
      // Simulate download
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 5;
        setProgress(currentProgress);
        if (currentProgress >= 100) {
          clearInterval(interval);
          setStatus("ready");
          setTimeout(() => {
            setStatus("playing");
          }, 1000);
        }
      }, 200);
    } else if (status === "ready") {
      setStatus("playing");
      // TODO: Connect to server
    }
  };

  return (
    <div
      className="h-screen w-screen overflow-hidden text-white flex flex-col relative select-none font-sans"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/40 bg-gradient-to-t from-black/80 via-transparent to-black/30 backdrop-blur-[2px]" />

      {/* Top Bar (simulating draggable area if we disable default titlebar later) */}
      <div className="h-8 w-full flex items-center justify-between px-4 z-10 bg-black/20 backdrop-blur-md border-b border-white/5" data-tauri-drag-region>
        <div className="flex items-center gap-2 text-xs text-white/50 font-bold uppercase tracking-widest pointer-events-none">
          <Shield size={12} className="text-red-500" />
          V Rising Server Launcher
        </div>
        <div className="flex gap-4">
          <Settings size={14} className="text-white/50 hover:text-white cursor-pointer transition-colors" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 z-10 flex flex-col justify-between p-12">
        
        {/* Header/Logo Area */}
        <div className="mt-8">
          <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-red-400 to-red-800 drop-shadow-2xl">
            LORD OF WISDOM
          </h1>
          <p className="text-lg text-white/80 mt-2 font-medium tracking-wide flex items-center gap-2">
            <Server size={18} className="text-red-500" />
            198.22.204.17:43157
          </p>
          <div className="mt-6 flex gap-4">
            <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-lg border border-red-900/30 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-semibold text-white/90">Servidor Online</span>
            </div>
            <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-lg border border-red-900/30 flex items-center gap-2">
              <Users size={16} className="text-white/60" />
              <span className="text-sm font-semibold text-white/90">12/40 Jogadores</span>
            </div>
          </div>
        </div>

        {/* Bottom Area (News & Play Button) */}
        <div className="flex items-end justify-between">
          
          {/* Patch Notes / Info Box */}
          <div className="w-[400px] h-[200px] bg-black/60 backdrop-blur-xl border border-red-900/50 rounded-2xl p-6 shadow-2xl flex flex-col relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-1 h-full bg-red-600" />
             <h3 className="font-bold text-lg text-white mb-2">Últimas Atualizações</h3>
             <div className="flex-1 overflow-y-auto pr-2 text-sm text-white/70 space-y-3 custom-scrollbar">
                <p><span className="text-red-400 font-bold">v1.2.0</span> - Novos mods adicionados, correções de balanceamento de magias.</p>
                <p><span className="text-red-400 font-bold">v1.1.5</span> - Wipe no servidor principal.</p>
                <p><span className="text-red-400 font-bold">v1.1.0</span> - Modpack inicial lançado. Bem-vindos!</p>
             </div>
          </div>

          {/* Action Area */}
          <div className="flex flex-col items-end gap-4 w-[450px]">
            {/* Progress Bar Container */}
            {(status === "downloading" || status === "ready") && (
              <div className="w-full bg-black/80 backdrop-blur-md rounded-xl p-4 border border-white/10 shadow-2xl transition-all duration-500">
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-red-400 uppercase tracking-wider">
                    {status === "downloading" ? "Baixando Modpack..." : "Pronto para jogar!"}
                  </span>
                  <span className="text-white/80">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Play Button */}
            <button
              onClick={handlePlayClick}
              disabled={status === "playing" || status === "downloading"}
              className={`
                group relative w-full h-[80px] rounded-2xl overflow-hidden font-black text-3xl tracking-widest transition-all duration-300 shadow-[0_0_40px_rgba(220,38,38,0.3)]
                ${status === "playing" ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : 
                  status === "ready" ? "bg-red-600 hover:bg-red-500 text-white hover:scale-[1.02]" :
                  "bg-gradient-to-b from-red-700 to-red-950 hover:from-red-600 hover:to-red-900 text-white hover:shadow-[0_0_60px_rgba(220,38,38,0.6)] hover:scale-[1.02] border border-red-500/50"}
              `}
            >
              <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
              
              <span className="relative z-10 flex items-center justify-center gap-4 drop-shadow-md">
                {status === "idle" && <><Download className="animate-bounce" size={28} /> ATUALIZAR</>}
                {status === "downloading" && "ATUALIZANDO..."}
                {status === "ready" && <><Play size={28} className="fill-white" /> JOGAR</>}
                {status === "playing" && "JOGO EM EXECUÇÃO"}
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
