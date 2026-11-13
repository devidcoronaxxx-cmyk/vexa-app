const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  isElectron: true,
  openRobloxStudio: (placeId) => ipcRenderer.invoke("open-roblox-studio", placeId),
  getAppInfo: () => ipcRenderer.invoke("app:get-info"),
  checkForUpdates: () => ipcRenderer.invoke("app:check-updates"),  getLocalLlmStatus: () => ipcRenderer.invoke("localllm:status"),
  startLocalLlm: () => ipcRenderer.invoke("localllm:start"),
  onLocalLlmStatus: (cb) => {
    const handler = (_e, s) => cb(s);
    ipcRenderer.on("localllm:status", handler);
    return () => ipcRenderer.removeListener("localllm:status", handler);
  },
  getHunyuanStatus: () => ipcRenderer.invoke("hunyuan:status"),
  installHunyuan: () => ipcRenderer.invoke("hunyuan:install"),
  retryHunyuan: () => ipcRenderer.invoke("hunyuan:retry"),
  models: {
    status: () => ipcRenderer.invoke("models:status"),
    install: (tier) => ipcRenderer.invoke("models:install", tier),
    onProgress: (cb) => { const h = (_e, d) => cb(d); ipcRenderer.on("models:progress", h); return () => ipcRenderer.removeListener("models:progress", h); },
  },
  rojo: {
    status: () => ipcRenderer.invoke("rojo:status"),
    start: () => ipcRenderer.invoke("rojo:start"),
    stop: () => ipcRenderer.invoke("rojo:stop"),
    apply: (payload) => ipcRenderer.invoke("rojo:apply", payload),
    openWorkspace: () => ipcRenderer.invoke("rojo:open-workspace"),
  },
  onHunyuanStatus: (cb) => {
    const handler = (_e, s) => cb(s);
    ipcRenderer.on("hunyuan:status", handler);
    return () => ipcRenderer.removeListener("hunyuan:status", handler);
  },
});
