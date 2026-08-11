import { useState, useEffect } from "react";
import { Play, Download, Settings, Users, Server, Shield, HelpCircle, X, RefreshCw, CheckCircle2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import bgImage from "./assets/bg.png";
import "./App.css";

function App() {
  const [status, setStatus] = useState<"idle" | "downloading" | "ready" | "playing">("idle");
  const [progress, setProgress] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // Dynamic Data States
  const [serverOnline, setServerOnline] = useState(false);
  const [playersOnline, setPlayersOnline] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(40);
  const [news, setNews] = useState<{tag: string, body: string}[]>([]);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    // Escutar progresso de download
    const unlisten = listen<number>("download_progress", (event) => {
      setProgress(Math.round(event.payload));
    });

    // Buscar dados do Servidor
    invoke<string>("fetch_server_status").then((jsonString) => {
      try {
        const data = JSON.parse(jsonString);
        setServerOnline(data.online === true);
        setPlayersOnline(data.players || 0);
        setMaxPlayers(data.max_players || 40);
      } catch (e) {
        setServerOnline(false);
      }
    }).catch(() => setServerOnline(false));

    // Buscar notícias do GitHub e gerenciar versão
    invoke<string>("fetch_latest_news").then((jsonString) => {
      try {
        const data = JSON.parse(jsonString);
        if (Array.isArray(data) && data.length > 0) {
          const formattedNews = data.slice(0, 4).map((r: any) => ({
            tag: r.tag_name,
            body: r.name || "Pequenas correções e melhorias."
          }));
          setNews(formattedNews);
          
          const currentLatest = data[0].tag_name;
          setLatestVersion(currentLatest);
          
          const installedVersion = localStorage.getItem("modpack_version");
          
          // Verificar pasta física
          invoke<boolean>("check_modpack_installed").then(isInstalled => {
            if (isInstalled && installedVersion === currentLatest) {
              setStatus((prev) => prev === "playing" ? "playing" : "ready");
            } else {
              setStatus((prev) => prev === "playing" ? "playing" : "idle");
            }
          });
          
        } else {
          setNews([{ tag: "V1.0", body: "Nenhuma atualização encontrada no momento." }]);
          // Falha na API do Github (repositório privado ou sem release), confia apenas na pasta física
          invoke<boolean>("check_modpack_installed").then(isInstalled => {
             if (isInstalled) setStatus((prev) => prev === "playing" ? "playing" : "ready");
          });
        }
      } catch (e) {
        setNews([{ tag: "V1.0", body: "Nenhuma atualização encontrada no momento." }]);
        invoke<boolean>("check_modpack_installed").then(isInstalled => {
           if (isInstalled) setStatus((prev) => prev === "playing" ? "playing" : "ready");
        });
      }
    }).catch(() => {
        setNews([{ tag: "V1.0", body: "Nenhuma atualização encontrada no momento." }]);
        invoke<boolean>("check_modpack_installed").then(isInstalled => {
           if (isInstalled) setStatus((prev) => prev === "playing" ? "playing" : "ready");
        });
    });

    // Monitorar se o jogo está aberto em tempo real
    const interval = setInterval(async () => {
      try {
        const isRunning = await invoke<boolean>("check_game_running");
        setStatus((prevStatus) => {
          if (isRunning) return "playing";
          
          if (!isRunning && prevStatus === "playing") {
             // O jogo fechou, voltar para JOGAR (se estiver instalado)
             return "ready";
          }
          return prevStatus;
        });
      } catch (e) {}
    }, 3000);

    return () => {
      unlisten.then((f) => f());
      clearInterval(interval);
    };
  }, []);

  const handlePlayClick = async () => {
    if (status === "idle") {
      try {
        const isRunning = await invoke<boolean>("check_game_running");
        if (isRunning) {
          setErrorMsg("O V Rising já está aberto! Feche o jogo antes de atualizar o ModPack.");
          return;
        }

        setStatus("downloading");
        setProgress(0);
        
        await invoke("download_and_extract");
        
        if (latestVersion) {
          localStorage.setItem("modpack_version", latestVersion);
        }
        setStatus("ready");
      } catch (error) {
        setErrorMsg("Erro na atualização: " + error);
        setStatus("idle");
      }
    } else if (status === "ready") {
      try {
        await invoke("launch_game");
        setStatus("playing");
      } catch (error) {
        setErrorMsg("Erro ao iniciar o jogo: " + error);
      }
    }
  };

  const forceUpdate = () => {
    setStatus("idle");
  };

  const closeApp = () => {
    invoke("exit_app");
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
      <div className="absolute inset-0 bg-black/40 bg-gradient-to-t from-black/80 via-transparent to-black/30 backdrop-blur-[2px]" />

      {/* Top Bar */}
      <div 
        className="h-8 w-full flex items-center justify-between px-4 z-50 bg-black/20 backdrop-blur-md border-b border-white/5 cursor-move"
        onMouseDown={() => invoke("drag_window")}
      >
        <div className="flex items-center gap-2 text-xs text-white/50 font-bold uppercase tracking-widest pointer-events-none">
          <Shield size={12} className="text-red-500" />
          V Rising Server Launcher
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={closeApp} className="text-white/50 hover:text-red-500 hover:bg-red-500/10 p-1 rounded transition-colors cursor-pointer" onMouseDown={(e) => e.stopPropagation()}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 z-10 flex flex-col justify-between p-12">
        
        {/* Header */}
        <div className="mt-8">
          <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-red-400 to-red-800 drop-shadow-2xl">
            IMPÉRIO CARMESIM
          </h1>
          <p className="text-lg text-white/80 mt-2 font-medium tracking-wide flex items-center gap-2">
            <Server size={18} className="text-red-500" />
            198.22.204.17:43157
          </p>
          <div className="mt-6 flex gap-4">
            {serverOnline ? (
              <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-lg border border-red-900/30 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-semibold text-white/90">Servidor Online</span>
              </div>
            ) : (
              <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-lg border border-red-900/30 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-sm font-semibold text-white/90">Servidor Offline</span>
              </div>
            )}
            <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-lg border border-red-900/30 flex items-center gap-2">
              <Users size={16} className="text-white/60" />
              <span className="text-sm font-semibold text-white/90">{playersOnline}/{maxPlayers} Jogadores</span>
            </div>
          </div>
        </div>

        {/* Bottom Area */}
        <div className="flex items-end justify-between">
          
          <div className="w-[400px] h-[200px] bg-black/60 backdrop-blur-xl border border-red-900/50 rounded-2xl p-6 shadow-2xl flex flex-col relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-1 h-full bg-red-600" />
             <h3 className="font-bold text-lg text-white mb-2">Últimas Atualizações</h3>
             <div className="flex-1 overflow-y-auto pr-2 text-sm text-white/70 space-y-3 custom-scrollbar">
                {news.length > 0 ? news.map((item, index) => (
                  <p key={index}>
                    <span className="text-red-400 font-bold">{item.tag}</span> - {item.body}
                  </p>
                )) : (
                  <p className="text-white/40 italic">Buscando notícias...</p>
                )}
             </div>
          </div>

          {/* Action Area */}
          <div className="flex flex-col items-end gap-4 w-[450px]">
            {(status === "downloading" || status === "ready") && (
              <div className="w-full bg-black/80 backdrop-blur-md rounded-xl p-4 border border-white/10 shadow-2xl transition-all duration-500">
                {status === "downloading" ? (
                  <>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-red-400 uppercase tracking-wider">
                        Baixando Modpack...
                      </span>
                      <span className="text-white/80">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-green-500 font-black tracking-widest text-sm py-1 uppercase">
                    <CheckCircle2 size={18} className="text-green-400" />
                    ModPack Instalado e Atualizado!
                  </div>
                )}
              </div>
            )}

            <div className="flex w-full gap-2 relative">
              {status === "ready" && (
                <button
                  onClick={forceUpdate}
                  className="h-[80px] w-[80px] shrink-0 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col items-center justify-center hover:bg-white/10 hover:text-red-400 transition-all text-[10px] uppercase font-bold text-white/50"
                  title="Forçar Reinstalação"
                >
                  <RefreshCw size={20} className="mb-1" />
                  REPARAR
                </button>
              )}
              
              <button
                onClick={() => setShowHelp(true)}
                className="h-[80px] w-[80px] shrink-0 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center hover:bg-white/10 hover:text-red-400 transition-all"
                title="O que é o ModPack?"
              >
                <HelpCircle size={24} />
              </button>

              <button
                onClick={handlePlayClick}
                disabled={status === "playing" || status === "downloading"}
                className={`
                  flex-1 relative h-[80px] rounded-2xl overflow-hidden font-black text-3xl tracking-widest transition-all duration-300 shadow-[0_0_40px_rgba(220,38,38,0.3)]
                  ${status === "playing" ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" : 
                    status === "ready" ? "bg-red-600 hover:bg-red-500 text-white hover:scale-[1.02]" :
                    "bg-gradient-to-b from-red-700 to-red-950 hover:from-red-600 hover:to-red-900 text-white hover:shadow-[0_0_60px_rgba(220,38,38,0.6)] hover:scale-[1.02] border border-red-500/50"}
                `}
              >
                <div className="absolute inset-0 bg-white opacity-0 hover:opacity-10 transition-opacity" />
                
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

      {/* Help Modal */}
      {showHelp && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-red-900/50 rounded-2xl p-8 max-w-lg shadow-2xl relative">
            <button 
              onClick={() => setShowHelp(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white"
            >
              <X size={24} />
            </button>
            <h2 className="text-2xl font-black text-red-500 mb-4 flex items-center gap-2">
              <Shield size={24} /> O que é o ModPack?
            </h2>
            <div className="space-y-4 text-white/80 leading-relaxed text-sm">
              <p>
                Para jogar no servidor <strong>Império Carmesim</strong>, você precisa instalar os arquivos customizados criados pela nossa equipe (HUD, Interface, Novas Mecânicas).
              </p>
              <p>
                Ao clicar em <strong>"ATUALIZAR"</strong>, nosso Launcher fará tudo sozinho:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-white/70">
                <li>Buscará automaticamente a pasta onde seu <strong>V Rising</strong> está instalado na Steam.</li>
                <li>Baixará a versão mais recente do ModPack.</li>
                <li>Instalará as extensões dentro da pasta <code>BepInEx/plugins</code>, que é a ferramenta que o V Rising usa para carregar mods de forma segura.</li>
              </ul>
              <div className="mt-6 p-4 bg-red-950/30 border border-red-900/30 rounded-lg">
                <p className="text-red-400 font-bold text-xs uppercase tracking-wider mb-1">Nota Importante</p>
                <p className="text-xs">Os mods são 100% seguros, criptografados e foram desenvolvidos exclusivamente para este servidor.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Error Modal */}
      {errorMsg && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-red-600/50 rounded-2xl p-6 max-w-md shadow-2xl relative flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-950 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
              <Shield size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-black text-white mb-2 uppercase tracking-wide">
              Atenção
            </h2>
            <p className="text-white/80 leading-relaxed text-sm mb-6">
              {errorMsg}
            </p>
            <button 
              onClick={() => setErrorMsg("")}
              className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-8 rounded-lg transition-colors w-full"
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
