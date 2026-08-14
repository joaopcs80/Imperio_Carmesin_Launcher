import { useState, useEffect } from "react";
import { Play, X, Server, Users, Shield, HelpCircle, Package } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { check } from "@tauri-apps/plugin-updater";
import bgImage from "./assets/bg.png";
import "./App.css";

function App() {
  const [status, setStatus] = useState<"bepinex_missing" | "bepinex_downloading" | "modpack_missing" | "modpack_downloading" | "ready" | "playing">("bepinex_missing");
  const [progress, setProgress] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [bepVersions, setBepVersions] = useState<{version: string, url: string}[]>([]);
  const [selectedBepUrl, setSelectedBepUrl] = useState("");

  // Updater States
  const [updateAvailable, setUpdateAvailable] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [autoUpdate, setAutoUpdate] = useState(() => {
    return localStorage.getItem("auto_update") !== "false"; // Default is true
  });

  // Dynamic Data States
  const [serverOnline, setServerOnline] = useState(false);
  const [playersOnline, setPlayersOnline] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(40);
  const [news, setNews] = useState<{tag: string, body: string}[]>([]);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    // Checar atualizações do Launcher
    async function checkForLauncherUpdates() {
      try {
        const update = await check();
        if (update) {
          if (autoUpdate) {
             setIsUpdating(true);
             let downloaded = 0;
             await update.downloadAndInstall((event: any) => {
                if (event.event === "Progress") {
                   downloaded += event.data.chunkLength;
                   if (event.data.contentLength) {
                     setUpdateProgress(Math.round((downloaded / event.data.contentLength) * 100));
                   }
                }
             });
             invoke("exit_app"); // Fecha para o usuário abrir de novo (ou poderíamos usar plugin-process para relaunch)
          } else {
             setUpdateAvailable(update);
          }
        }
      } catch (e) {
        console.error("Erro ao checar atualizações:", e);
      }
    }
    checkForLauncherUpdates();

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

    // Buscar notícias do site oficial
    invoke<string>("fetch_patchnotes").then((jsonString) => {
      try {
        const data = JSON.parse(jsonString);
        if (Array.isArray(data) && data.length > 0) {
          const formattedNews = data.slice(0, 4).map((r: any) => ({
            tag: r.version || r.tag_name,
            body: r.title || "Pequenas correções e melhorias."
          }));
          setNews(formattedNews);
        } else {
          setNews([{ tag: "V1.0", body: "Nenhuma atualização encontrada no site." }]);
        }
      } catch (e) {
        setNews([{ tag: "V1.0", body: "Nenhuma atualização encontrada no site." }]);
      }
    }).catch(() => {
        setNews([{ tag: "V1.0", body: "Nenhuma atualização encontrada no site." }]);
    });

    // Buscar versão mais recente do GitHub e gerenciar instalação
    invoke<string>("fetch_latest_news").then((jsonString) => {
      try {
        const data = JSON.parse(jsonString);
        if (Array.isArray(data) && data.length > 0) {
          
          const currentLatest = data[0].tag_name;
          setLatestVersion(currentLatest);
          
          const installedVersion = localStorage.getItem("modpack_version");
          
          // Verificar pasta física
          invoke<boolean>("check_bepinex_installed").then(hasBepinex => {
            if (!hasBepinex) {
               setStatus((prev) => prev === "playing" ? "playing" : "bepinex_missing");
               // Buscar versões
               invoke<{version: string, url: string}[]>("fetch_bepinex_versions").then(versions => {
                   setBepVersions(versions);
                   if (versions.length > 0) setSelectedBepUrl(versions[0].url);
               }).catch(() => {});
            } else {
               invoke<boolean>("check_modpack_installed").then(isInstalled => {
                 if (isInstalled && installedVersion === currentLatest) {
                   setStatus((prev) => prev === "playing" ? "playing" : "ready");
                 } else {
                   setStatus((prev) => prev === "playing" ? "playing" : "modpack_missing");
                 }
               });
            }
          });
          
        } else {
          invoke<boolean>("check_bepinex_installed").then(hasBepinex => {
             if (!hasBepinex) {
                setStatus((prev) => prev === "playing" ? "playing" : "bepinex_missing");
                invoke<{version: string, url: string}[]>("fetch_bepinex_versions").then(versions => {
                    setBepVersions(versions);
                    if (versions.length > 0) setSelectedBepUrl(versions[0].url);
                }).catch(() => {});
             } else {
                invoke<boolean>("check_modpack_installed").then(isInstalled => {
                   if (isInstalled) setStatus((prev) => prev === "playing" ? "playing" : "ready");
                   else setStatus((prev) => prev === "playing" ? "playing" : "modpack_missing");
                });
             }
          });
        }
      } catch (e) {
        invoke<boolean>("check_bepinex_installed").then(hasBepinex => {
           if (!hasBepinex) setStatus((prev) => prev === "playing" ? "playing" : "bepinex_missing");
           else setStatus((prev) => prev === "playing" ? "playing" : "ready");
        });
      }
    }).catch(() => {
        invoke<boolean>("check_bepinex_installed").then(hasBepinex => {
           if (!hasBepinex) setStatus((prev) => prev === "playing" ? "playing" : "bepinex_missing");
           else setStatus((prev) => prev === "playing" ? "playing" : "ready");
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

  const handleInstallBepInEx = async () => {
    if (!selectedBepUrl) {
        setErrorMsg("Selecione uma versão do BepInEx para instalar.");
        return;
    }
    setStatus("bepinex_downloading");
    try {
        await invoke("download_bepinex", { url: selectedBepUrl });
        const isInstalled = await invoke<boolean>("check_modpack_installed");
        if (isInstalled) {
            setStatus("ready");
        } else {
            setStatus("modpack_missing");
        }
    } catch (error) {
        setErrorMsg("Erro ao instalar BepInEx: " + error);
        setStatus("bepinex_missing");
    }
  };

  const handleUpdateModPack = async () => {
    try {
      const isRunning = await invoke<boolean>("check_game_running");
      if (isRunning) {
        setErrorMsg("O V Rising já está aberto! Feche o jogo antes de atualizar o ModPack.");
        return;
      }
      setStatus("modpack_downloading");
      setProgress(0);
      
      await invoke("download_and_extract");
      
      if (latestVersion) {
        localStorage.setItem("modpack_version", latestVersion);
      }
      setStatus("ready");
    } catch (error) {
      setErrorMsg("Erro na atualização: " + error);
      setStatus("modpack_missing");
    }
  };

  const handleLaunchGame = async () => {
    try {
      await invoke("launch_game");
      setStatus("playing");
    } catch (error) {
      setErrorMsg("Erro ao iniciar o jogo: " + error);
    }
  };



  const closeApp = () => {
    invoke("exit_app");
  };

  const toggleAutoUpdate = () => {
    const newVal = !autoUpdate;
    setAutoUpdate(newVal);
    localStorage.setItem("auto_update", newVal ? "true" : "false");
  };

  const startManualUpdate = async () => {
    if (!updateAvailable) return;
    setIsUpdating(true);
    let downloaded = 0;
    try {
      await updateAvailable.downloadAndInstall((event: any) => {
          if (event.event === "Progress") {
              downloaded += event.data.chunkLength;
              if (event.data.contentLength) {
                setUpdateProgress(Math.round((downloaded / event.data.contentLength) * 100));
              }
          }
      });
      invoke("exit_app");
    } catch (e) {
      setErrorMsg("Erro ao atualizar o launcher: " + e);
      setIsUpdating(false);
      setUpdateAvailable(null);
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
          <label className="flex items-center gap-2 text-xs text-white/50 hover:text-white cursor-pointer" onMouseDown={(e) => e.stopPropagation()}>
            <input 
              type="checkbox" 
              checked={autoUpdate}
              onChange={toggleAutoUpdate}
              className="accent-red-500 w-3 h-3"
            />
            Atualizar Launcher Automaticamente
          </label>
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
          <div className="flex flex-col items-end gap-3 w-[450px]">
            
            {/* Módulo BepInEx */}
            <div className="w-full bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col gap-3">
               <div className="flex justify-between items-center">
                   <span className="font-bold text-sm text-white/90 uppercase tracking-wider flex items-center gap-2"><Shield size={16} className="text-red-500" /> 1. Base BepInEx</span>
                   {status === "bepinex_missing" ? <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest bg-red-950/50 px-2 py-1 rounded">Faltando</span> : <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest bg-green-950/50 px-2 py-1 rounded">Instalado</span>}
               </div>
               
               {status === "bepinex_missing" ? (
                  <div className="flex gap-2 h-[40px]">
                     <select 
                          className="flex-1 bg-black/50 border border-white/20 text-white rounded p-2 text-sm outline-none cursor-pointer"
                          value={selectedBepUrl}
                          onChange={(e) => setSelectedBepUrl(e.target.value)}
                      >
                          {bepVersions.length > 0 ? bepVersions.map(v => (
                              <option key={v.version} value={v.url}>{v.version}</option>
                          )) : <option>Buscando versões...</option>}
                      </select>
                      <button 
                         onClick={handleInstallBepInEx}
                         className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-6 rounded transition-all whitespace-nowrap shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                      >
                         INSTALAR
                      </button>
                  </div>
               ) : status === "bepinex_downloading" ? (
                   <div className="text-xs text-red-400 animate-pulse text-center p-2 font-bold uppercase tracking-widest bg-black/50 rounded border border-white/5">
                      Instalando Base...
                   </div>
               ) : (
                  <div className="text-xs text-white/40 bg-black/30 p-2 rounded text-center border border-white/5">
                     Módulo injetor principal ativo no jogo.
                  </div>
               )}
            </div>

            {/* Módulo ModPack */}
            <div className={`w-full bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-lg flex flex-col gap-3 transition-opacity duration-300 ${status === "bepinex_missing" || status === "bepinex_downloading" ? "opacity-30 pointer-events-none" : ""}`}>
               <div className="flex justify-between items-center">
                   <span className="font-bold text-sm text-white/90 uppercase tracking-wider flex items-center gap-2"><Package size={16} className="text-red-500" /> 2. ModPack do Servidor</span>
                   {(status === "modpack_missing" || status === "idle" as any) ? <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest bg-red-950/50 px-2 py-1 rounded">Atualização Pendente</span> : status === "modpack_downloading" ? <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest bg-yellow-950/50 px-2 py-1 rounded">Baixando...</span> : <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest bg-green-950/50 px-2 py-1 rounded">Atualizado</span>}
               </div>
               
               {(status === "modpack_missing" || status === "idle" as any || status === "ready") && (
                   <div className="flex gap-2 items-center">
                       <button 
                           onClick={handleUpdateModPack}
                           className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold py-2 rounded transition-all border border-white/10 uppercase tracking-widest"
                       >
                           {status === "ready" ? "FORÇAR REPARO" : "ATUALIZAR MODS"}
                       </button>
                   </div>
               )}
               {status === "modpack_downloading" && (
                   <div className="w-full h-[32px] bg-black/50 rounded overflow-hidden relative border border-white/10">
                       <div 
                         className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300 ease-out"
                         style={{ width: `${progress}%` }}
                       />
                       <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md">{progress}%</span>
                   </div>
               )}
            </div>

            {/* JOGAR */}
            <div className="flex w-full gap-2 relative mt-2">
              <button
                onClick={() => setShowHelp(true)}
                className="h-[80px] w-[80px] shrink-0 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center hover:bg-white/10 hover:text-red-400 transition-all"
                title="O que é o ModPack?"
              >
                <HelpCircle size={24} />
              </button>

              <button
                onClick={handleLaunchGame}
                disabled={status !== "ready" && status !== "playing"}
                className={`
                  flex-1 relative h-[80px] rounded-2xl overflow-hidden font-black text-3xl tracking-widest transition-all duration-300
                  ${status === "playing" ? "bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none" : 
                    status === "ready" ? "bg-red-600 hover:bg-red-500 text-white hover:scale-[1.02] shadow-[0_0_40px_rgba(220,38,38,0.5)] border border-red-500/50" :
                    "bg-zinc-900/80 text-white/20 cursor-not-allowed shadow-none border border-white/5"}
                `}
              >
                {status === "ready" && <div className="absolute inset-0 bg-white opacity-0 hover:opacity-10 transition-opacity" />}
                
                <span className="relative z-10 flex items-center justify-center gap-4 drop-shadow-md">
                  {status === "playing" ? "EM EXECUÇÃO" : (
                      <>
                        <Play size={28} className={status === "ready" ? "fill-white" : "fill-white/20"} /> JOGAR
                      </>
                  )}
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

      {/* Updater Modal (Manual) */}
      {updateAvailable && !isUpdating && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-red-600/50 rounded-2xl p-6 max-w-md shadow-2xl relative flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-950 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
              <Package size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-black text-white mb-2 uppercase tracking-wide">
              Nova Versão Disponível
            </h2>
            <p className="text-white/80 leading-relaxed text-sm mb-6">
              O Launcher possui uma atualização ({updateAvailable.version}). Deseja instalar agora?
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setUpdateAvailable(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex-1"
              >
                DEPOIS
              </button>
              <button 
                onClick={startManualUpdate}
                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg transition-colors flex-1"
              >
                ATUALIZAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Updating Overlay */}
      {isUpdating && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 flex-col gap-4">
            <h2 className="text-2xl font-black text-red-500 animate-pulse">Atualizando Launcher...</h2>
            <div className="w-64 h-[20px] bg-black/50 rounded overflow-hidden relative border border-white/10">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300 ease-out"
                  style={{ width: `${updateProgress}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-md">{updateProgress}%</span>
            </div>
            <p className="text-white/50 text-xs">O launcher fechará automaticamente ao concluir.</p>
        </div>
      )}
    </div>
  );
}

export default App;
