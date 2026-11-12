const { app, BrowserWindow, shell, ipcMain, Menu, Tray, nativeImage, dialog, net: electronNet } = require("electron");
const path = require("path");
const { spawn, exec, execSync } = require("child_process");
const fs = require("fs");
const net = require("net");
const http = require("http");
const https = require("https");
const { RojoManager } = require("./rojo-manager");
const { autoUpdater } = require("electron-updater");

const PROTOCOL = "vexa";
const APP_ID = "com.vexa.ai";

// ---------------------------------------------------------------------------
// Single instance: the app bundles a local server on a fixed port, so a second
// copy must never start. If another instance is already running we just focus
// its window (and optionally hand it a vexa:// deep link) and exit.
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv, _workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const deepLink = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (deepLink) handleDeepLink(deepLink);
  });
}

// Windows: stable AppUserModelID so notifications/taskbar grouping work.
app.setAppUserModelId(APP_ID);
app.setName("Vexa");

let mainWindow = null;
let tray = null;
let nextServer = null;
let bridgeProc = null;
let rojoManagerRef = null;
let localLlmProc = null;
let hunyuanPackProc = null;
let hunyuanBridgeProc = null;
let appIsQuitting = false;

const localLlmState = { state: "off", progress: 0, error: null };
const hunyuanState = { state: "off", progress: 0, error: null };

const PORT = 3000;
const BRIDGE_PORT = 8765;
const LOCAL_LLM_PORT = 9290;
const LOCAL_LLM_URL = `http://127.0.0.1:${LOCAL_LLM_PORT}`;
const LOCAL_LLM_MODEL = "Qwen3-8B-Q4_K_M.gguf";
const LOCAL_LLM_REPO = "https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf";
// 3D asset backends — both live on the user's machine (zero cost). The Hunyuan
// runtime is fully managed by the app (downloaded into userData so EVERYTHING
// ships inside the Vexa download): the pack's server runs on HUNYUAN_PACK_PORT
// and Vexa adds a tiny bridge on HUNYUAN_BRIDGE_PORT that exposes the stable
// /health + /generate contract the bundled server uses. LOCAL_HUNYUAN_URL thus
// points at the bridge.
const HUNYUAN_PACK_PORT = 8080;
const HUNYUAN_BRIDGE_PORT = 8081;
const LOCAL_HUNYUAN_URL = process.env.LOCAL_HUNYUAN_URL || `http://127.0.0.1:${HUNYUAN_BRIDGE_PORT}`;
const LOCAL_TRELLIS_URL = process.env.LOCAL_TRELLIS_URL || "http://127.0.0.1:7860";
const HUNYUAN_PACK_REPO = "YanWenKun/Hunyuan3D-2-WinPortable";
const SEVENZIP_URL = "https://www.7-zip.org/a/7zr.exe";
const isDev = !app.isPackaged;
const APP_VERSION = app.getVersion();

// Register as the default handler for vexa:// URLs.
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

function parseDeepLink(url) {
  try {
    const u = new URL(url);
    let route = u.pathname && u.pathname !== "/" ? u.pathname : (u.searchParams.get("route") || "/local");
    if (route === "/open" || route === "/app" || route === "") route = "/local";
    const code = u.searchParams.get("code");
    return { route, code };
  } catch {
    return { route: "/local", code: null };
  }
}

function handleDeepLink(url) {
  const { route, code } = parseDeepLink(url);
  console.log("[electron] deep link:", url, "->", route, code ? "(code: " + code + ")" : "");
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (code) {
    mainWindow.webContents.executeJavaScript(
      `localStorage.setItem("vexa_pending_code", ${JSON.stringify(code)})`
    );
  }

  const target = `http://localhost:${PORT}${route}`;
  if (!mainWindow.webContents.getURL().startsWith(`http://localhost:${PORT}`)) {
    mainWindow.loadURL(target);
  } else {
    mainWindow.webContents.executeJavaScript(`window.location.href = ${JSON.stringify(target)}`);
  }
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => { server.close(); resolve(false); });
    server.listen(port);
  });
}

function findNode() {
  // In packaged app, prefer the bundled Node.js runtime
  if (!isDev) {
    const bundled = path.join(process.resourcesPath, "node-runtime", "node.exe");
    if (fs.existsSync(bundled)) return bundled;
  }
  try {
    const { execSync } = require("child_process");
    if (process.platform === "win32") {
      return execSync("where node", { encoding: "utf-8" }).trim().split("\n")[0].trim();
    }
    return execSync("which node", { encoding: "utf-8" }).trim();
  } catch {
    return "node";
  }
}

// Minimal .env parser so the packaged app can read secrets from the bundled
// .env.local (it can't be read from the asar by the standalone server itself).
// Values already present in process.env win — they are the source of truth.
function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const out = {};
    for (const raw of fs.readFileSync(filePath, "utf-8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch (e) {
    console.error("[electron] failed to read env file:", e.message);
    return {};
  }
}

// Add NVIDIA keys the user created in-app (stored in userData so they survive
// app updates). Applied last so they win over bundled/process env.
function mergeUserNvidiaKeys(env) {
  const userFile = path.join(app.getPath("userData"), "vexa-keys.env");
  const userKeys = loadEnvFile(userFile);
  for (const [k, v] of Object.entries(userKeys)) {
    if (/^NVIDIA_[A-Z0-9_]+$/.test(k) && v) env[k] = v;
  }
  return env;
}

// ---------------------------------------------------------------------------
// Bundled local LLM (zero-key generations)
// ---------------------------------------------------------------------------
function setLlmState(s) {
  Object.assign(localLlmState, s);
  for (const w of BrowserWindow.getAllWindows()) {
    try { w.webContents.send("localllm:status", { ...localLlmState }); } catch {}
  }
}

function modelDir() {
  const dir = path.join(app.getPath("userData"), "models");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function modelPath() {
  return path.join(modelDir(), LOCAL_LLM_MODEL);
}

function downloadModel() {
  return new Promise((resolve, reject) => {
    const dest = modelPath();
    const tmp = dest + ".part";
    setLlmState({ state: "downloading", progress: 0, error: null });

    const attempt = (url, redirects) => {
      const req = https.get(url, { headers: { accept: "*/*" } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (redirects > 6) return reject(new Error("Too many redirects"));
          return attempt(new URL(res.headers.location, url).toString(), redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("Download failed: HTTP " + res.statusCode));
        }
        const total = Number(res.headers["content-length"]) || 0;
        const out = fs.createWriteStream(tmp);
        let got = 0;
        res.pipe(out);
        res.on("data", (c) => {
          got += c.length;
          if (total > 0) {
            const p = Math.min(99, Math.round((got / total) * 100));
            if (p !== localLlmState.progress) setLlmState({ progress: p });
          }
        });
        res.on("end", () => {
          out.end();
          fs.renameSync(tmp, dest);
          resolve();
        });
        req.on("error", (e) => {
          out.destroy();
          reject(e);
        });
      });
      req.on("error", reject);
    };
    attempt(LOCAL_LLM_REPO, 0);
  });
}

async function waitLlmReady(timeoutMs = 240000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(LOCAL_LLM_URL + "/health");
      if (r.ok) {
        const j = await r.json();
        if (j.status === "ready") return true;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 2500));
  }
  return false;
}

function startWorker() {
  if (localLlmProc) return;
  if (!fs.existsSync(modelPath())) return;
  setLlmState({ state: "starting", progress: 100, error: null });
  const workerScript = isDev
    ? path.join(__dirname, "localllm-worker.mjs")
    : path.join(process.resourcesPath, "app.asar.unpacked", "electron", "localllm-worker.mjs");
  const env = { ...process.env };
  if (process.env.VEXA_LLM_CPU) env.VEXA_LLM_CPU = process.env.VEXA_LLM_CPU;
  if (process.env.VEXA_LLM_CONTEXT) env.VEXA_LLM_CONTEXT = process.env.VEXA_LLM_CONTEXT;
  localLlmProc = spawn(
    findNode(),
    [workerScript, "--model-dir", modelDir(), "--model-file", LOCAL_LLM_MODEL, "--port", String(LOCAL_LLM_PORT)],
    { env, stdio: ["ignore", "pipe", "pipe"], shell: false, windowsHide: true }
  );
  localLlmProc.stdout.on("data", (d) => console.log("[llm]", d.toString().trim()));
  localLlmProc.stderr.on("data", (d) => console.error("[llm err]", d.toString().trim()));
  localLlmProc.on("exit", (code) => {
    localLlmProc = null;
    if (!appIsQuitting && localLlmState.state === "ready" && fs.existsSync(modelPath())) {
      setLlmState({ state: "error", error: "Worker exited (" + code + "), will retry" });
      setTimeout(startWorker, 30000);
    } else if (!appIsQuitting) {
      setLlmState({ state: "error", error: "Local model unavailable (exit " + code + ")" });
    }
  });
  waitLlmReady().then((ok) => setLlmState(ok ? { state: "ready", error: null } : { state: "error", error: "Model did not become ready" }));
}

function killLocalLlm() {
  if (localLlmProc) {
    try { localLlmProc.kill(); } catch {}
    localLlmProc = null;
  }
}

async function bootLocalLlm() {
  try {
    if (fs.existsSync(modelPath())) {
      setLlmState({ state: "ready", progress: 100 });
      startWorker();
      return;
    }
    await downloadModel();
    setLlmState({ state: "downloaded", progress: 100 });
    startWorker();
  } catch (e) {
    console.error("[local llm] boot failed:", e.message);
    setLlmState({ state: "error", error: e.message });
  }
}

// ---------------------------------------------------------------------------
// Managed Hunyuan3D 2.1 runtime — "everything ships inside the Vexa download".
// On first 3D use the app downloads the WinPortable pack into userData,
// extracts it with its own copy of 7zr, boots the pack's server (127.0.0.1:8080)
// and starts the tiny bridge (127.0.0.1:8081) that speaks the stable /generate
// contract. The user never touches GitHub and never pays anything.
// ---------------------------------------------------------------------------
function setHunyuanState(s) {
  Object.assign(hunyuanState, s);
  for (const w of BrowserWindow.getAllWindows()) {
    try { w.webContents.send("hunyuan:status", { ...hunyuanState }); } catch {}
  }
}

function hunyuanPackDir() {
  const d = path.join(app.getPath("userData"), "hunyuan-pack");
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function hunyuanUnpackedDir() {
  return path.join(hunyuanPackDir(), "unpacked");
}
function hunyuanInstalled() {
  const u = hunyuanUnpackedDir();
  return fs.existsSync(path.join(u, "gradio_app.py")) || fs.existsSync(path.join(u, "python", "python.exe"));
}
// The WinPortable pack ships the runtime only (~3.5GB): its ~19GB of model
// weights are fetched by a second step (2-download-models / download_models.py).
// Vexa runs that step too so EVERYTHING happens inside the app.
const HUNYUAN_MODELS_DONE = "hunyuan-models-ok.txt";
function hunyuanModelsPath() {
  return path.join(hunyuanPackDir(), HUNYUAN_MODELS_DONE);
}
function hunyuanWeightsDownloader() {
  const u = hunyuanUnpackedDir();
  const py = path.join(u, "python", "python.exe");
  if (fs.existsSync(path.join(u, "download_models.py")) && fs.existsSync(py)) {
    return { cmd: py, args: [path.join(u, "download_models.py")], cwd: u };
  }
  const bat = fs.readdirSync(u, { encoding: "utf-8" }).find((n) => /^2-download-models/i.test(n) && n.endsWith(".bat"));
  if (bat) return { cmd: "cmd.exe", args: ["/c", path.join(u, bat)], cwd: u };
  return null;
}
async function downloadHunyuanWeights() {
  const dl = hunyuanWeightsDownloader();
  if (!dl) return; // this pack variant already bundles weights
  if (fs.existsSync(hunyuanModelsPath())) return;
  setHunyuanState({ state: "downloading-models", progress: 0, error: null });
  console.log("[hunyuan] downloading model weights (~19GB):", dl.cmd, dl.args.join(" "));
  let log = "";
  await new Promise((resolve, reject) => {
    const p = spawn(dl.cmd, dl.args, {
      cwd: dl.cwd,
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    p.stdout?.on("data", (c) => { log += c; console.log("[hunyuan weights]", c.toString().trim().slice(-220)); });
    p.stderr?.on("data", (c) => { log += c; });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) {
        try { fs.writeFileSync(hunyuanModelsPath(), new Date().toISOString()); } catch {}
        resolve();
      } else {
        reject(new Error("Pesi 3D non scaricati (" + code + "): " + log.slice(-400)));
      }
    });
  });
}
function hunyuanRunner() {
  const u = hunyuanUnpackedDir();
  const py = path.join(u, "python", "python.exe");
  if (fs.existsSync(py) && fs.existsSync(path.join(u, "gradio_app.py"))) {
    return { cmd: py, args: [path.join(u, "gradio_app.py")], cwd: u };
  }
  const bat = ["3-start.bat", "3-start.bat(English)"].map((n) => path.join(u, n)).find((p) => fs.existsSync(p));
  if (bat) return { cmd: "cmd.exe", args: ["/c", bat], cwd: u };
  return null;
}

// Generic HTTPS download with redirect handling + resume support.
function downloadFile(url, dest, onDone) {
  return new Promise((resolve, reject) => {
    const tmp = dest + ".part";
    let have = 0;
    try { have = fs.existsSync(tmp) ? fs.statSync(tmp).size : 0; } catch { have = 0; }
    const attempt = (u, redirects) => {
      const headers = { accept: "*/*" };
      if (have > 0) headers.range = `bytes=${have}-`;
      const req = https.get(u, { headers }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (redirects > 6) return reject(new Error("Too many redirects"));
          return attempt(new URL(res.headers.location, u).toString(), redirects + 1);
        }
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          res.resume();
          return reject(new Error("Download failed: HTTP " + res.statusCode + " (" + u.slice(0, 70) + ")"));
        }
        if (res.statusCode === 200) have = 0; // server ignored Range -> restart
        const total = Number(res.headers["content-length"] || 0) + have;
        const out = fs.createWriteStream(tmp, have > 0 ? { flags: "a" } : undefined);
        let got = have;
        res.pipe(out);
        res.on("data", (c) => {
          got += c.length;
          if (total > 0 && onDone) onDone(got, total);
        });
        res.on("end", () => {
          out.end(() => {
            fs.renameSync(tmp, dest);
            resolve();
          });
        });
        req.on("error", (e) => { out.destroy(); reject(e); });
      });
      req.on("error", reject);
    };
    attempt(url, 0);
  });
}

async function hunyuanReleaseAssets() {
  const res = await fetch(`https://api.github.com/repos/${HUNYUAN_PACK_REPO}/releases/latest`, {
    headers: { "user-agent": "Vexa" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("GitHub release HTTP " + res.status);
  const j = await res.json();
  return (j.assets || [])
    .filter((a) => /\.7z(\.\d{3})?$/i.test(a.name))
    .map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size || 0 }));
}

async function downloadHunyuanPack() {
  setHunyuanState({ state: "downloading", progress: 0, error: null });
  const dir = path.join(hunyuanPackDir(), "parts");
  fs.mkdirSync(dir, { recursive: true });
  const assets = await hunyuanReleaseAssets();
  if (!assets.length) throw new Error("Nessun pacchetto Hunyuan trovato nella release");
  const total = assets.reduce((s, a) => s + a.size, 0);
  const perPart = assets.map((a) => ({ a, dest: path.join(dir, a.name), seen: 0 }));
  let doneBytes = 0;
  for (const { a, dest } of perPart) {
    const existing = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
    if (existing >= a.size) { doneBytes += existing; continue; }
    await downloadFile(a.url, dest, (got, tot) => {
      const partDone = doneBytes + got;
      const grand = total || tot;
      const p = Math.min(99, Math.round((partDone / grand) * 100));
      if (p !== hunyuanState.progress) setHunyuanState({ progress: p });
    });
    const final = fs.statSync(dest).size;
    doneBytes += final;
  }
}

async function extractHunyuanPack() {
  setHunyuanState({ state: "extracting", progress: 99, error: null });
  const d = hunyuanPackDir();
  const seven = path.join(d, "7zr.exe");
  if (!fs.existsSync(seven)) {
    await downloadFile(SEVENZIP_URL, seven, null);
  }
  const partsDir = path.join(d, "parts");
  const first = fs.readdirSync(partsDir).filter((f) => /\.7z(\.001)?$/i.test(f)).sort()[0];
  if (!first) throw new Error("Nessuna parte del pack trovata da estrarre");
  const out = hunyuanUnpackedDir();
  fs.mkdirSync(out, { recursive: true });
  await new Promise((resolve, reject) => {
    const p = spawn(seven, ["x", path.join(partsDir, first), `-o${out}`, "-y"], { cwd: d, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    p.stdout?.on("data", (c) => { log += c; if ((log.length & ~1023) < 10) console.log("[hunyuan extract]", c.toString().trim()); });
    p.stderr?.on("data", (c) => { log += c; });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error("Estrazione fallita (7z exit " + code + ")"))));
  });
}

async function installHunyuan() {
  if (["downloading", "extracting", "downloading-models", "starting"].includes(hunyuanState.state)) return;
  if (hunyuanInstalled()) return bootHunyuan();
  await downloadHunyuanPack();
  await extractHunyuanPack();
  await downloadHunyuanWeights();
  await bootHunyuan();
}

function hunyuanBridgeScript() {
  if (isDev) return path.join(__dirname, "..", "bridge", "hunyuan-bridge.mjs");
  return path.join(process.resourcesPath, "bridge", "hunyuan-bridge.mjs");
}

function startBridgeHunyuan() {
  if (hunyuanBridgeProc) return;
  const script = hunyuanBridgeScript();
  if (!fs.existsSync(script)) {
    console.error("[electron] hunyuan bridge script missing:", script);
    return;
  }
  const nodeBin = findNode();
  console.log("[electron] starting hunyuan bridge:", script);
  hunyuanBridgeProc = spawn(nodeBin, [script], {
    cwd: path.dirname(script),
    env: { ...process.env, VEXA_BRIDGE_PORT: String(HUNYUAN_BRIDGE_PORT), VEXA_HUNYUAN_URL: `http://127.0.0.1:${HUNYUAN_PACK_PORT}` },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  hunyuanBridgeProc.stdout.on("data", (d) => console.log("[hunyuan-bridge]", d.toString().trim()));
  hunyuanBridgeProc.stderr.on("data", (d) => console.error("[hunyuan-bridge]", d.toString().trim()));
  hunyuanBridgeProc.on("error", (e) => console.error("[hunyuan-bridge] spawn error:", e.message));
  hunyuanBridgeProc.on("close", (code) => { hunyuanBridgeProc = null; });
}

async function isHunyuanReady(timeoutMs = 2000) {
  try {
    const r = await fetch(`${LOCAL_HUNYUAN_URL}/health`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    return j?.status === "ready";
  } catch {
    return false;
  }
}

async function waitHunyuanReady(timeoutMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isHunyuanReady(2500)) return true;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return false;
}

function startHunyuanServer() {
  const runner = hunyuanRunner();
  if (!runner) {
    console.error("[electron] hunyuan runner not found in:", hunyuanUnpackedDir());
    setHunyuanState({ state: "error", error: "Motore Hunyuan non trovato (files corrotti?)" });
    return;
  }
  setHunyuanState({ state: "starting", error: null });
  console.log("[electron] starting hunyuan pack:", runner.cmd, runner.args.join(" "));
  hunyuanPackProc = spawn(runner.cmd, runner.args, {
    cwd: runner.cwd,
    windowsHide: true,
    env: { ...process.env, PYTHONUTF8: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  hunyuanPackProc.stdout.on("data", (d) => console.log("[hunyuan]", d.toString().trim().slice(-400)));
  hunyuanPackProc.stderr.on("data", (d) => console.error("[hunyuan err]", d.toString().trim().slice(-400)));
  hunyuanPackProc.on("error", (e) => console.error("[hunyuan] spawn error:", e.message));
  hunyuanPackProc.on("close", (code) => {
    hunyuanPackProc = null;
    if (!appIsQuitting && hunyuanState.state === "ready") {
      console.warn("[hunyuan] pack exited", code, "(3D will reappear if the server comes back)");
    }
  });
}

async function bootHunyuan() {
  try {
    if (!hunyuanInstalled()) {
      // Auto-install in background on first boot (like the Qwen model):
      // the pack, weights and servers set themselves up so 3D is ready
      // without any click. installHunyuan is idempotent (it no-ops when a
      // download is already running or the pack is installed).
      installHunyuan().catch((e) => console.error("[hunyuan] auto-install failed:", e?.message || e));
      return;
    }
    await downloadHunyuanWeights();
    startBridgeHunyuan();
    if (!(await isHunyuanReady(2500))) {
      if (!hunyuanPackProc) startHunyuanServer();
    }
    const ok = await waitHunyuanReady();
    setHunyuanState(ok ? { state: "ready", error: null } : { state: "error", error: "Il motore 3D non è riuscito a partire. Riprova." });
  } catch (e) {
    console.error("[hunyuan] boot failed:", e.message);
    setHunyuanState({ state: "error", error: e.message });
  }
}

function killHunyuan() {
  for (const proc of [hunyuanBridgeProc, hunyuanPackProc]) {
    if (!proc?.pid) continue;
    try {
      if (process.platform === "win32") exec(`taskkill /pid ${proc.pid} /T /F`, { windowsHide: true });
      else proc.kill("SIGTERM");
    } catch {}
  }
  hunyuanBridgeProc = null;
  hunyuanPackProc = null;
}

async function startNextServer() {
  const inUse = await isPortInUse(PORT);
  if (inUse) {
    console.log("[electron] port", PORT, "already in use, reusing");
    return;
  }

  return new Promise((resolve, reject) => {
    const appDir = isDev
      ? path.join(__dirname, "..")
      : path.join(process.resourcesPath, "app");

    let cmd, args, opts;

    if (isDev) {
      const nextBin = path.join(appDir, "node_modules", "next", "dist", "bin", "next");
      cmd = "node";
      args = [`"${nextBin}"`, "dev", "-p", String(PORT)];
      opts = { cwd: appDir, shell: true, env: mergeUserNvidiaKeys({ ...process.env, PORT: String(PORT), LOCAL_LLM_URL, LOCAL_HUNYUAN_URL, LOCAL_TRELLIS_URL }) };
    } else {
      const unpackedDir = path.join(process.resourcesPath, "app.asar.unpacked");
      const standaloneDir = path.join(unpackedDir, ".next", "standalone");

      let serverRoot = standaloneDir;
      if (!fs.existsSync(path.join(serverRoot, "server.js"))) {
        const nested = fs.readdirSync(standaloneDir).find((d) =>
          d !== "node_modules" &&
          fs.statSync(path.join(standaloneDir, d)).isDirectory() &&
          fs.existsSync(path.join(standaloneDir, d, "server.js"))
        );
        if (nested) serverRoot = path.join(standaloneDir, nested);
      }
      const serverScript = path.join(serverRoot, "server.js");

      const staticDst = path.join(serverRoot, ".next", "static");
      const publicDst = path.join(serverRoot, "public");

      try {
        const staticSrc = path.join(unpackedDir, ".next", "static");
        const publicSrc = path.join(unpackedDir, "public");
        if (fs.existsSync(staticSrc) && !fs.existsSync(staticDst)) fs.cpSync(staticSrc, staticDst, { recursive: true });
        if (fs.existsSync(publicSrc) && !fs.existsSync(publicDst)) fs.cpSync(publicSrc, publicDst, { recursive: true });
      } catch (e) {
        console.error("[electron] copy static:", e.message);
      }

      const nodeBin = findNode();
      console.log("[electron] using node:", nodeBin);
      console.log("[electron] server script:", serverScript);

      const bundledEnv = loadEnvFile(path.join(process.resourcesPath, "app", ".env.local"));
      const serverEnv = mergeUserNvidiaKeys({ ...bundledEnv, ...process.env, PORT: String(PORT), HOSTNAME: "127.0.0.1", LOCAL_LLM_URL, LOCAL_HUNYUAN_URL, LOCAL_TRELLIS_URL });

      cmd = nodeBin;
      args = [serverScript];
      opts = { cwd: serverRoot, env: serverEnv };
    }

    nextServer = spawn(cmd, args, opts);

    nextServer.stdout.on("data", (data) => {
      console.log("[next]", data.toString());
    });

    nextServer.stderr.on("data", (data) => {
      console.error("[next err]", data.toString());
    });

    nextServer.on("error", (err) => {
      console.error("[next] spawn error:", err);
      reject(err);
    });

    nextServer.on("close", (code) => {
      console.log("[next] exited with code", code);
    });

    resolve();
  });
}

// Kill the spawned server, including its whole child tree (important on
// Windows where killing the parent node leaves the actual server alive).
function killNextServer() {
  if (!nextServer) return;
  const pid = nextServer.pid;
  nextServer = null;
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      exec(`taskkill /pid ${pid} /T /F`, { windowsHide: true });
    } else {
      process.kill(pid, "SIGTERM");
      setTimeout(() => { try { process.kill(pid, "SIGKILL"); } catch {} }, 3000);
    }
  } catch (e) {
    console.error("[electron] kill server:", e.message);
  }
}

// ---------------------------------------------------------------------------
// Vexa Bridge — local MCP client for Roblox Studio (127.0.0.1:8765).
// The bridge is bundled with the app (resources/bridge) and started
// automatically so the app can connect to Studio without a plugin.
// ---------------------------------------------------------------------------

function getBridgeScript() {
  if (isDev) return path.join(__dirname, "..", "bridge", "vexa-bridge.mjs");
  return path.join(process.resourcesPath, "bridge", "vexa-bridge.mjs");
}

async function isBridgeRunning() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`http://127.0.0.1:${BRIDGE_PORT}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

async function startBridge() {
  if (await isBridgeRunning()) {
    console.log("[electron] bridge already running on", BRIDGE_PORT);
    return;
  }
  const script = getBridgeScript();
  if (!fs.existsSync(script)) {
    console.error("[electron] bridge script not found:", script);
    return;
  }
  const nodeBin = findNode();
  console.log("[electron] starting bridge:", script, "with", nodeBin);
  bridgeProc = spawn(nodeBin, [script], {
    cwd: path.dirname(script),
    env: { ...process.env, VEXA_BRIDGE_PORT: String(BRIDGE_PORT) },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  bridgeProc.stdout.on("data", (d) => console.log("[bridge]", d.toString()));
  bridgeProc.stderr.on("data", (d) => console.error("[bridge]", d.toString()));
  bridgeProc.on("error", (e) => console.error("[bridge] spawn error:", e.message));
  bridgeProc.on("close", (code) => {
    console.log("[bridge] exited", code);
    bridgeProc = null;
  });
}

function killBridge() {
  if (!bridgeProc) return;
  const pid = bridgeProc.pid;
  bridgeProc = null;
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      exec(`taskkill /pid ${pid} /T /F`, { windowsHide: true });
    } else {
      process.kill(pid, "SIGTERM");
    }
  } catch (e) {
    console.error("[electron] kill bridge:", e.message);
  }
}

// Keep the bundled Vexa Studio plugin in sync with %LOCALAPPDATA%\Roblox\Plugins
// so Studio loads it automatically across version updates.
function ensureStudioPlugin() {
  try {
    const local = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Local");
    const src = isDev
      ? path.join(__dirname, "..", "bridge", "studio-plugin", "Vexa")
      : path.join(process.resourcesPath, "bridge", "studio-plugin", "Vexa");
    const dst = path.join(local, "Roblox", "Plugins", "Vexa");
    if (!fs.existsSync(path.join(src, "init.lua"))) return;
    fs.mkdirSync(dst, { recursive: true });
    fs.copyFileSync(path.join(src, "init.lua"), path.join(dst, "init.lua"));
    console.log("[electron] Vexa Studio plugin installed:", dst);
  } catch (e) {
    console.error("[electron] plugin install:", e.message);
  }
}

// Keep the bridge alive: if it dies (crash, kill, update), start it again within
// a few seconds so the app never gets stuck in "disconnected" permanently.
let bridgeWatchdog = null;
function superviseBridge() {
  if (bridgeWatchdog) return;
  bridgeWatchdog = setInterval(async () => {
    try {
      const up = await isBridgeRunning();
      if (!up) {
        console.log("[electron] bridge not running, restarting...");
        startBridge();
      }
    } catch (e) {
      console.error("[electron] bridge watchdog error:", e.message);
    }
  }, 5000);
  bridgeWatchdog.unref && bridgeWatchdog.unref();
}

function isAllowedUrl(url) {
  if (!url) return false;
  if (url.startsWith(`http://localhost:${PORT}`)) return true;
  if (isDev && url.startsWith("http://127.0.0.1:") ) return true;
  return false;
}

async function waitForServer(maxWaitMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(`http://localhost:${PORT}/api/actions/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

function createWindow() {
  const isMac = process.platform === "darwin";

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Vexa",
    backgroundColor: "#09090b",
    show: false,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, "..", "public", "icons", "android-chrome-512x512.png"),
    ...(isMac
      ? { titleBarStyle: "hiddenInset", trafficLightPosition: { x: 14, y: 14 } }
      : { frame: true }),
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[renderer ${level}] ${message} (${sourceId}:${line})`);
  });

  // Never let the app browse anywhere except the bundled server.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

  // Give the renderer the current local-LLM and 3D snapshots right after the
  // page loads (subscriptions in the UI get all later changes via broadcasts).
  mainWindow.webContents.on("did-finish-load", () => {
    try { mainWindow.webContents.send("localllm:status", { ...localLlmState }); } catch {}
    try { mainWindow.webContents.send("hunyuan:status", { ...hunyuanState }); } catch {}
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function showApp() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadURL(`http://localhost:${PORT}/local`);
}

function showError() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(ERROR_HTML)}`);
}

function createTray() {
  const iconPath = path.join(__dirname, "..", "public", "icons", "android-chrome-512x512.png");
  const image = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  tray = new Tray(image.resize({ width: 16, height: 16 }));
  tray.setToolTip("Vexa");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Vexa", click: () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    } },
    { type: "separator" },
    { label: "Quit", click: () => { appIsQuitting = true; app.quit(); } },
  ]));
  tray.on("click", () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

// Compare "1.5.1" style versions, ignoring a leading "v". Returns >0 when a>b.
function compareVersions(a, b) {
  const pa = String(a || "")
    .replace(/^v/i, "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "")
    .replace(/^v/i, "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Silent-install the downloaded setup. The app must quit first — NSIS upgrades
// only work while the target app is not running.
function runInstaller(installerPath) {
  appIsQuitting = true;
  killNextServer();
  app.quit();

  setTimeout(() => {
    try {
      const child = spawn(installerPath, ["/S"], { detached: true, stdio: "ignore", windowsHide: true });
      child.unref();
      console.log("[electron] installer launched (silent):", installerPath);
      relaunchAfterInstall();
    } catch (e) {
      console.error("[electron] failed to launch installer:", e.message);
      shell.openExternal(installerPath);
    }
  }, 500);
}

// Best-effort: when the silent install finishes (NSIS runs ~10-15s), start the
// freshly installed Vexa. NSIS default dir is per-user Programs.
function relaunchAfterInstall() {
  const candidates = [
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Vexa", "Vexa.exe"),
    path.join("C:", "Program Files", "Vexa", "Vexa.exe"),
    path.join("C:", "Program Files (x86)", "Vexa", "Vexa.exe"),
  ];
  const tm = setTimeout(() => {
    for (const exe of candidates) {
      if (fs.existsSync(exe)) {
        console.log("[electron] relaunching updated app:", exe);
        try { spawn(exe, [], { detached: true, stdio: "ignore" }).unref(); } catch {}
        return;
      }
    }
    console.log("[electron] updated app exe not found at known paths; please open it manually.");
  }, 20000);
  tm.unref();
}

// Download the installer from a direct URL to userData, then run it.
function downloadAndInstall(url, version) {
  const dir = path.join(app.getPath("userData"), "updates");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.error("[electron] create updates dir:", e.message);
  }
  const safeVersion = String(version || APP_VERSION).replace(/[^0-9a-zA-Z.-]/g, "_");
  const target = path.join(dir, `Vexa-Setup-${safeVersion}.exe`);

  dialog
    .showMessageBox(mainWindow, {
      type: "info",
      title: "Downloading update",
      message: `Downloading Vexa ${version}…`,
      detail: `The app will close and install automatically when the download finishes.`,
      buttons: ["OK"], defaultId: 0, cancelId: 0,
    })
    .catch(() => {});

  const req = electronNet.request(url);
  req.on("response", (res) => {
    if (res.statusCode !== 200) {
      console.error("[electron] update download HTTP", res.statusCode);
      try { if (!appIsQuitting) shell.openExternal(url); } catch {}
      return;
    }
    const total = Number(res.headers["content-length"] || 0);
    let received = 0;
    const out = fs.createWriteStream(target);
    res.on("data", (chunk) => {
      received += chunk.length;
      if (received % (5 * 1024 * 1024) < 1024) {
        console.log(`[electron] update download: ${received}/${total} bytes`);
      }
    });
    out.on("error", (e) => {
      console.error("[electron] update write error:", e.message);
      try { if (!appIsQuitting) shell.openExternal(url); } catch {}
    });
    res.pipe(out);
    res.on("end", () => {
      out.end();
      console.log("[electron] update downloaded:", target);
      runInstaller(target);
    });
    req.on("error", (e) => {
      console.error("[electron] update download error:", e.message);
      try { if (!appIsQuitting) shell.openExternal(url); } catch {}
    });
  });
  req.end();
}

// Lightweight update check. The bundled site's own copy of /api/app/latest has
// no env vars inside the packaged app, so ask the cloud release endpoint first
// and fall back to the local site only if the cloud is unreachable.
async function checkForUpdates() {
  const latestUrl = `https://vexaaai.vercel.app/api/app/latest`;
  let data = null;
  try {
    const res = await fetch(latestUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) data = await res.json();
  } catch (e) {
    console.warn("[electron] cloud update check failed:", e.message);
  }
  if (!data || typeof data.version !== "string") {
    try {
      const res = await fetch(`http://localhost:${PORT}/api/app/latest`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) data = await res.json();
    } catch {}
  }
  if (!data || typeof data.version !== "string") return false;
  if (compareVersions(data.version, APP_VERSION) <= 0) return false;

  const notes = data.notes ? "\n\n" + data.notes : "";
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Update available",
    message: `A new version of Vexa is available (v${data.version}). Install it?`,
    detail: `You're running v${APP_VERSION}.${notes}`,
    buttons: ["Yes — install", "No"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return false;

  const exe = typeof data.exe === "string" && data.exe.trim() ? data.exe.trim() : null;
  if (exe && process.platform === "win32") {
    downloadAndInstall(exe, data.version);
    return true;
  }
  // No direct installer URL configured (or not on Windows): open the download page.
  if (data.url) shell.openExternal(data.url);
  return true;
}

// ---------------------------------------------------------------------------
// Auto-update (electron-updater). Differential NSIS updates: only the blocks
// that actually changed are downloaded (usually a few MB instead of ~490 MB),
// then the app restarts on the new version. The feed is the GitHub release
// configured in package.json -> build.publish.
// ---------------------------------------------------------------------------
let autoUpdaterReady = false;
function initAutoUpdater() {
  if (autoUpdaterReady) return;
  if (!app.isPackaged || process.platform !== "win32") return;
  autoUpdaterReady = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;

  autoUpdater.on("error", (e) => console.error("[updater]", (e && e.message) || e));
  autoUpdater.on("update-available", (info) => console.log("[updater] available:", info && info.version));
  autoUpdater.on("update-not-available", () => console.log("[updater] up to date"));
  autoUpdater.on("download-progress", (p) => {
    if (p && typeof p.percent === "number") console.log("[updater] " + Math.round(p.percent) + "%");
  });
  autoUpdater.on("update-downloaded", async (info) => {
    try {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Aggiornamento pronto",
        message: `Vexa ${info && info.version ? info.version : ""} è pronto`,
        detail: "Riavvia ora per applicarlo. Se scegli Dopo, verrà applicato alla prossima chiusura.",
        buttons: ["Riavvia ora", "Dopo"],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) {
        appIsQuitting = true;
        killNextServer();
        setImmediate(() => autoUpdater.quitAndInstall(false, true));
      }
    } catch (e) {
      console.error("[updater] install prompt:", e.message);
    }
  });

  const check = () => autoUpdater.checkForUpdates().catch((e) => console.warn("[updater] check:", (e && e.message) || e));
  check();
  const iv = setInterval(check, 6 * 60 * 60 * 1000);
  if (iv.unref) iv.unref();
}

const ERROR_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Vexa</title>
<style>body{margin:0;background:#09090b;color:#e5e5e5;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}
.card{max-width:420px;text-align:center;padding:32px;border:1px solid rgba(255,255,255,.1);border-radius:16px;background:#121216}
h1{font-size:18px;margin:0 0 10px}p{font-size:13px;line-height:1.6;color:#9ca3af;margin:0 0 18px}
button{background:#a3e635;color:#060810;border:0;border-radius:8px;padding:10px 20px;font-weight:700;cursor:pointer}
.spinner{width:20px;height:20px;border:3px solid rgba(255,255,255,.1);border-top-color:#a3e635;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 14px}
@keyframes spin{to{transform:rotate(360deg}}
</style></head><body><div class="card"><h1>Couldn't start Vexa</h1>
<p>The local engine failed to start.<br>Trying to reconnect...</p>
<div class="spinner"></div>
<button onclick="tryConnect()">Retry</button></div>
<script>
function tryConnect(){
  fetch("http://localhost:3000/api/actions/health",{signal:AbortSignal.timeout(3000)})
  .then(function(r){if(r.ok)location.href="http://localhost:3000/local"})
  .catch(function(){})
}
setInterval(tryConnect,3000);
tryConnect();
</script></body></html>`;

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
if (gotLock) {
  app.whenReady().then(async () => {
    // macOS: cold-start deep link (open-url fires before whenReady in some cases)
    const deepLink = process.argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (deepLink) handleDeepLink(deepLink);

    Menu.setApplicationMenu(null);
    createWindow();
    createTray();

    try {
      await startNextServer();
    } catch (err) {
      console.error("[electron] failed to start server:", err);
    }

    const serverReady = await waitForServer(30000);
    if (serverReady) {
      console.log("[electron] server ready, loading app");
      bootLocalLlm();
      bootHunyuan();
      showApp();
      initAutoUpdater();
    } else {
      console.error("[electron] server did not become ready in time");
      showError();
    }

    // -----------------------------------------------------------------------
    // Roblox Studio helpers – detect running instance and focus its window
    // -----------------------------------------------------------------------
    function isStudioRunning() {
      try {
        const out = execSync('tasklist /FI "IMAGENAME eq RobloxStudioBeta.exe" /NH', { encoding: "utf-8", timeout: 5000 });
        return out.includes("RobloxStudioBeta.exe");
      } catch { return false; }
    }

    function focusStudioWindow() {
      try {
        execSync(
          `powershell -NoProfile -Command "$p = Get-Process RobloxStudioBeta -EA 0 | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1; ` +
          `if ($p) { Add-Type -Name W -Namespace N -MemberDefinition '[DllImport(\\"user32.dll\\")] public static extern bool SetForegroundWindow(IntPtr h);'; ` +
          `[N.W]::SetForegroundWindow($p.MainWindowHandle) }"`,
          { timeout: 5000, stdio: "ignore" }
        );
      } catch {}
    }

    // -----------------------------------------------------------------------
    // Rojo – official Studio sync. Starts a local Rojo server and writes the
    // generated scripts/instances into a real Rojo project on disk.
    // -----------------------------------------------------------------------
    const rojoManager = new RojoManager({ app, isDev });
    rojoManagerRef = rojoManager;

    ipcMain.handle("rojo:status", () => rojoManager.status());
    ipcMain.handle("rojo:start", () => rojoManager.start());
    ipcMain.handle("rojo:stop", () => rojoManager.stop());
    ipcMain.handle("rojo:apply", (_event, payload) => rojoManager.apply(payload));
    ipcMain.handle("rojo:open-workspace", async () => {
      const dir = rojoManager.workspaceDir();
      try { fs.mkdirSync(dir, { recursive: true }); await shell.openPath(dir); return { ok: true, dir }; }
      catch (e) { return { ok: false, error: e.message }; }
    });

    ipcMain.handle("open-roblox-studio", async (_event, placeId) => {
      const studioPath = findRobloxStudio();
      if (!studioPath) return { success: false, error: "Roblox Studio not found" };
      try {
        if (isStudioRunning()) {
          focusStudioWindow();
        } else if (placeId) {
          shell.openExternal(`roblox-studio://place/edit?placeId=${placeId}`);
        } else {
          spawn(studioPath, [], { detached: true, stdio: "ignore" }).unref();
        }
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    ipcMain.handle("app:get-info", () => ({
      version: APP_VERSION,
      platform: process.platform,
      isPackaged: app.isPackaged,
    }));

    ipcMain.handle("localllm:status", () => ({ ...localLlmState, url: LOCAL_LLM_URL, model: LOCAL_LLM_MODEL }));
    ipcMain.handle("localllm:start", async () => { bootLocalLlm(); return { ...localLlmState }; });

    ipcMain.handle("hunyuan:status", () => ({ ...hunyuanState, url: LOCAL_HUNYUAN_URL }));
    ipcMain.handle("hunyuan:install", async () => {
      try {
        await installHunyuan();
      } catch (e) {
        console.error("[hunyuan] install failed:", e.message);
        setHunyuanState({ state: "error", error: e.message });
      }
      return { ...hunyuanState };
    });
    ipcMain.handle("hunyuan:retry", async () => {
      bootHunyuan();
      return { ...hunyuanState };
    });

    // Model installer: first-run wizard downloads the chosen tier's weights.
    function modelsBaseDir() { return path.join(process.env.USERPROFILE || process.env.HOME || "", ".vexa", "models") }
    function modelDirStatus() {
      const base = modelsBaseDir()
      const installed = []
      try {
        for (const name of fs.readdirSync(base)) {
          const d = path.join(base, name)
          if (fs.statSync(d).isDirectory() && fs.readdirSync(d).length > 0) installed.push(name)
        }
      } catch {}
      return { base, installed, hasAny: installed.length > 0 }
    }
    ipcMain.handle("models:status", () => modelDirStatus())
    ipcMain.handle("models:install", async (event, tier) => {
      const t = String(tier || "M").toUpperCase()
      const script = isDev
        ? path.join(__dirname, "..", "servers", "install-models.py")
        : path.join(process.resourcesPath, "servers", "install-models.py")
      if (!fs.existsSync(script)) return { ok: false, error: "install-models.py not found" }
      return new Promise((resolve) => {
        const proc = spawn("python", [script, "--tier", t], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PYTHONUTF8: "1" } })
        let out = ""
        proc.stdout.on("data", (d) => { const s = d.toString(); out += s; try { event.sender.send("models:progress", { line: s }) } catch {} })
        proc.stderr.on("data", (d) => { const s = d.toString(); out += s; try { event.sender.send("models:progress", { line: s }) } catch {} })
        proc.on("close", (code) => resolve({ ok: code === 0, code, output: out.slice(-2000) }))
        proc.on("error", (e) => resolve({ ok: false, error: e.message }))
      })
    })

    ipcMain.handle("app:check-updates", async () => {
      if (app.isPackaged && process.platform === "win32") {
        try {
          const r = await autoUpdater.checkForUpdates();
          return { ok: true, version: r && r.updateInfo ? r.updateInfo.version : APP_VERSION };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }
      await checkForUpdates();
      return { ok: true, version: APP_VERSION };
    });

    // Save the user's own NVIDIA NIM key (from the in-app GLM-5.3 setup sheet)
    // so the local server stops proxying to the cloud and generates with their
    // key, then relaunch so the server picks it up.
    ipcMain.handle("vexa-set-nim-key", async (_event, apiKey) => {
      const key = String(apiKey || "").trim();
      if (!/^nvapi-[A-Za-z0-9_-]{16,}$/.test(key)) {
        return { success: false, error: "Invalid NVIDIA key: must start with nvapi-." };
      }
      const userFile = path.join(app.getPath("userData"), "vexa-keys.env");
      try {
        fs.mkdirSync(path.dirname(userFile), { recursive: true });
        fs.writeFileSync(
          userFile,
          `# Vexa - NVIDIA NIM key created by the user\n# Used by the bundled server so each user has their own rate limits.\nNVIDIA_GLM_API_KEY=${key}\n`,
          "utf-8"
        );
        setTimeout(() => { app.relaunch(); app.exit(0); }, 800);
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // On macOS deep links arrive via open-url.
    app.on("open-url", (_event, url) => handleDeepLink(url));

    setTimeout(checkForUpdates, 15000);
  });
}

function findRobloxStudio() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return null;

  const versionsDir = path.join(localAppData, "Roblox", "Versions");
  if (!fs.existsSync(versionsDir)) return null;

  const versions = fs.readdirSync(versionsDir)
    .filter((d) => d.startsWith("version-"))
    .sort()
    .reverse();

  for (const v of versions) {
    const studioPath = path.join(versionsDir, v, "RobloxStudioBeta.exe");
    if (fs.existsSync(studioPath)) return studioPath;
  }

  return null;
}

app.on("window-all-closed", () => {
  appIsQuitting = true;
  killNextServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  appIsQuitting = true;
  killNextServer();
  killBridge();
  killLocalLlm();
  killHunyuan();
  try { rojoManagerRef && rojoManagerRef.stop(); } catch {}
});
