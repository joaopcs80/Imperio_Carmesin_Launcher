use tauri::Emitter;
use winreg::enums::*;
use winreg::RegKey;
use std::path::PathBuf;
use reqwest::Client;
use std::io::Write;
use futures_util::StreamExt;
use sysinfo::System;

fn find_v_rising_path() -> Option<String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let steam_key = hklm.open_subkey_with_flags(r#"SOFTWARE\WOW6432Node\Valve\Steam"#, KEY_READ).ok()?;
    let install_path: String = steam_key.get_value("InstallPath").ok()?;
    
    let library_folders_path = PathBuf::from(&install_path).join("steamapps").join("libraryfolders.vdf");
    
    if let Ok(content) = std::fs::read_to_string(&library_folders_path) {
        let mut current_path = install_path.clone();
        for line in content.lines() {
            let line = line.trim();
            if line.starts_with("\"path\"") {
                let parts: Vec<&str> = line.split('"').collect();
                if parts.len() >= 4 {
                    current_path = parts[3].replace("\\\\", "\\");
                }
            }
            if line.starts_with("\"1604030\"") {
                let game_path = PathBuf::from(&current_path).join("steamapps").join("common").join("VRising");
                if game_path.exists() {
                    return Some(game_path.to_string_lossy().into_owned());
                }
            }
        }
    }
    
    let default_game_path = PathBuf::from(&install_path).join("steamapps").join("common").join("VRising");
    if default_game_path.exists() {
        return Some(default_game_path.to_string_lossy().into_owned());
    }
    
    None
}

#[tauri::command]
fn check_game_running() -> bool {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    for process in sys.processes().values() {
        let name = process.name().to_lowercase();
        if name == "vrising.exe" {
            return true;
        }
    }
    false
}

#[tauri::command]
fn launch_game() -> Result<(), String> {
    std::process::Command::new("cmd")
        .args(["/C", "start steam://rungameid/1604030"])
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn download_and_extract(app: tauri::AppHandle) -> Result<(), String> {
    let url = "https://github.com/joaopcs80/Imperio_Carmesim_ModPack/releases/latest/download/ModPack_vAtual.zip";
    
    let game_path = find_v_rising_path().ok_or("A pasta do V Rising não foi encontrada na sua Steam. Inicie o jogo pelo menos uma vez.")?;
    let plugins_path = PathBuf::from(&game_path).join("BepInEx").join("plugins");
    let imperio_folder = plugins_path.join("ImperioCarmesim");
    
    std::fs::create_dir_all(&plugins_path).map_err(|e| format!("Falha ao criar pastas: {}", e))?;
    
    if imperio_folder.exists() {
        std::fs::remove_dir_all(&imperio_folder).map_err(|e| format!("Falha ao apagar versão antiga: {}", e))?;
    }
    
    let client = Client::builder()
        .user_agent("VRising-Launcher")
        .build()
        .map_err(|e| e.to_string())?;
        
    let res = client.get(url).send().await.map_err(|e| format!("Falha no download: {}", e))?;
    let total_size = res.content_length().unwrap_or(0);
    
    let mut stream = res.bytes_stream();
    let zip_path = PathBuf::from(&game_path).join("temp_modpack.zip");
    let mut file = std::fs::File::create(&zip_path).map_err(|e| e.to_string())?;
    
    let mut downloaded: u64 = 0;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        
        downloaded += chunk.len() as u64;
        if total_size > 0 {
            let percentage = (downloaded as f64 / total_size as f64) * 100.0;
            app.emit("download_progress", percentage as u32).ok();
        }
    }
    file.sync_all().map_err(|e| e.to_string())?;
    
    let zip_file = std::fs::File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(zip_file).map_err(|e| e.to_string())?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        if let Some(outpath) = file.enclosed_name() {
            let full_outpath = PathBuf::from(&game_path).join(outpath);
            
            if file.is_dir() {
                std::fs::create_dir_all(&full_outpath).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = full_outpath.parent() {
                    std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
                let mut outfile = std::fs::File::create(&full_outpath).map_err(|e| e.to_string())?;
                std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
            }
        }
    }
    
    std::fs::remove_file(&zip_path).ok();
    
    Ok(())
}

#[tauri::command]
async fn fetch_server_status() -> Result<String, String> {
    let client = Client::builder()
        .user_agent("VRising-Launcher")
        .build()
        .map_err(|e| e.to_string())?;
        
    let res = client.get("https://carmesim80.discloud.app/api/status")
        .send().await.map_err(|e| e.to_string())?;
        
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
async fn fetch_latest_news() -> Result<String, String> {
    let client = Client::builder()
        .user_agent("VRising-Launcher")
        .build()
        .map_err(|e| e.to_string())?;
        
    let res = client.get("https://api.github.com/repos/joaopcs80/Imperio_Carmesim_ModPack/releases")
        .send().await.map_err(|e| e.to_string())?;
        
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

#[tauri::command]
fn exit_app() {
    std::process::exit(0);
}

use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
struct BepInExVersion {
    version: String,
    url: String,
}

#[tauri::command]
async fn fetch_bepinex_versions() -> Result<Vec<BepInExVersion>, String> {
    let client = Client::builder().user_agent("VRising-Launcher").build().map_err(|e| e.to_string())?;
    
    // Baixa o index de pacotes (usando API v1)
    let res = client.get("https://thunderstore.io/c/v-rising/api/v1/package/")
        .send().await.map_err(|e| e.to_string())?;
        
    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let mut versions = Vec::new();
    
    if let Some(arr) = json.as_array() {
        for pkg in arr {
            if pkg["name"] == "BepInExPack_V_Rising" {
                if let Some(versions_arr) = pkg["versions"].as_array() {
                    for ver in versions_arr {
                        if let (Some(version_number), Some(download_url)) = (ver["version_number"].as_str(), ver["download_url"].as_str()) {
                            versions.push(BepInExVersion {
                                version: version_number.to_string(),
                                url: download_url.to_string(),
                            });
                        }
                    }
                }
                break;
            }
        }
    }
    
    Ok(versions)
}

#[tauri::command]
async fn download_bepinex(url: String) -> Result<String, String> {
    let game_path = find_v_rising_path().ok_or("A pasta do V Rising não foi encontrada na sua Steam.")?;
    
    let client = Client::builder().user_agent("VRising-Launcher").build().map_err(|e| e.to_string())?;
    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    
    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    
    let temp_dir = std::env::temp_dir();
    let zip_path = temp_dir.join("bepinex_temp.zip");
    std::fs::write(&zip_path, bytes).map_err(|e| e.to_string())?;
    
    let zip_file = std::fs::File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(zip_file).map_err(|e| e.to_string())?;
    
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        if let Some(mut outpath) = file.enclosed_name() {
            // Thunderstore zip contains a folder BepInExPack_V_Rising/
            let path_str = outpath.to_string_lossy().to_string();
            if path_str.starts_with("BepInExPack_V_Rising") {
                let stripped = outpath.strip_prefix("BepInExPack_V_Rising").map_err(|e| e.to_string())?;
                if stripped.as_os_str().is_empty() { continue; }
                let full_outpath = PathBuf::from(&game_path).join(stripped);
                
                if file.is_dir() {
                    std::fs::create_dir_all(&full_outpath).map_err(|e| e.to_string())?;
                } else {
                    if let Some(p) = full_outpath.parent() {
                        if !p.exists() {
                            std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
                        }
                    }
                    let mut outfile = std::fs::File::create(&full_outpath).map_err(|e| e.to_string())?;
                    std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    
    let _ = std::fs::remove_file(zip_path);
    
    // Desativar a janela de console preta do BepInEx
    let cfg_path = PathBuf::from(&game_path).join("BepInEx").join("config").join("BepInEx.cfg");
    if let Ok(content) = std::fs::read_to_string(&cfg_path) {
        let mut new_content = String::new();
        let mut in_console = false;
        for line in content.lines() {
            if line.starts_with("[Logging.Console]") {
                in_console = true;
            } else if line.starts_with('[') {
                in_console = false;
            }
            if in_console && line.starts_with("Enabled = true") {
                new_content.push_str("Enabled = false\n");
            } else {
                new_content.push_str(line);
                new_content.push('\n');
            }
        }
        let _ = std::fs::write(&cfg_path, new_content);
    }

    Ok("BepInEx Instalado com sucesso!".into())
}

#[tauri::command]
fn check_bepinex_installed() -> bool {
    if let Some(game_path) = find_v_rising_path() {
        let winhttp = PathBuf::from(&game_path).join("winhttp.dll");
        return winhttp.exists();
    }
    false
}

#[tauri::command]
fn check_modpack_installed() -> bool {
    if let Some(game_path) = find_v_rising_path() {
        let path = PathBuf::from(&game_path).join("BepInEx").join("plugins").join("ImperioCarmesim");
        return path.exists();
    }
    false
}

#[tauri::command]
fn drag_window(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            check_game_running,
            launch_game,
            download_and_extract,
            fetch_server_status,
            fetch_latest_news,
            exit_app,
            check_modpack_installed,
            check_bepinex_installed,
            fetch_bepinex_versions,
            download_bepinex,
            drag_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
