#!/usr/bin/env node
/*
  Vexa Bridge — local connector between the Vexa app and Roblox Studio
  (127.0.0.1:8765). Two independent channels:

  1) Vexa Studio Connector plugin (preferred): the bundled Luau plugin
     registers via POST /api/studio/register, polls GET /api/studio/pop for
     commands and reports results via POST /api/studio/report. No MCP toggle,
     no authentication, no StudioMCP.exe needed. Works as soon as Studio is
     open with the plugin loaded.

  2) Roblox built-in MCP server (fallback): Studio exposes its MCP server at
     "%LOCALAPPDATA%\Roblox\mcp.bat" once you enable it (Assistant > ... >
     Manage MCP Servers > "Enable Studio as MCP server"). The bridge is an MCP
     CLIENT over stdio to StudioMCP.exe.

  The bridge auto-selects the healthiest channel and exposes a local HTTP API
  for the Vexa app:

    POST /api/mcp/execute  { tool, args }   -> { ok, commandId }
    GET  /api/mcp/result?id=...             -> { status:"done", result }
    GET  /api/mcp/status                    -> { connected, token, studio }
    POST /api/studio/register               -> plugin handshake
    GET  /api/studio/pop?token=...          -> plugin command queue
    POST /api/studio/report                 -> plugin command results
    GET  /health                            -> { ok, studio }

  Usage:
    node vexa-bridge.mjs                 # port 8765
    node vexa-bridge.mjs --port 9000
*/
import http from "node:http"
import { randomBytes } from "node:crypto"
import { spawn, spawnSync } from "node:child_process"
import os from "node:os"
import path from "node:path"
import fs from "node:fs"

const VERSION = "1.6.0"
const PORT = parsePort(process.argv)
const HOST = "127.0.0.1"
const TOKEN = "gx-mcp-local-" + randomBytes(16).toString("hex")

const now = () => Date.now()
const pending = []     // {id, tool, args, createdAt}
const results = new Map()
const qaReports = [] // {source, channel, time, checks} — latest N runtime QA probe reports from a playing build
const qaRunIds = new Set() // dedupe by runId
const qaStats = { count: 0, lastAt: 0, lastSource: "" }
let rpcId = 0
let studioId = null    // resolved via list_roblox_studios
let studioReady = false
let mcpVersion = null
let mcpError = null

// Self-healing state
let respawnTimer = null
let respawnDelay = 2000
let lastErrors = []     // rolling last execution error strings
let recycling = false
let startedAt = now()

// --------------------------------------------------------------------------
// Plugin channel state (Vexa Studio Connector plugin, via loopback HTTP).
// The bridge accepts registrations from the plugin, feeds it commands and
// collects results. When a plugin instance is present it is preferred over
// the StudioMCP stdio channel because it does NOT depend on Roblox's MCP
// toggle or authentication.
// --------------------------------------------------------------------------
const HEARTBEAT_MAX_GAP = 20_000 // ms without a pop/register -> forget instance
const pluginClients = new Map()  // token -> {instanceId, name, placeId, placeName, capabilities, pollMs, queue, lastSeen, ...}
const pluginCommands = new Map() // commandId -> {token, resolve, reject, timer}
const pluginStats = { registers: 0, pops: 0, reports: 0, lastPopAt: 0, lastReportAt: 0, queueDepth: 0 }
let activeChannel = "mcp"        // "plugin" | "mcp"

// --------------------------------------------------------------------------
// MCP stdio client
// --------------------------------------------------------------------------

function findStudioMcpExe() {
  // Launching StudioMCP.exe directly is more robust than running Roblox's
  // generated mcp.bat (which throws batch-parse errors and relies on a stale
  // hardcoded version hash). Prefer an env override, then scan the Versions
  // folder, then fall back to the registry ContentFolder key.
  if (process.env.VEXA_MCP_EXE && fs.existsSync(process.env.VEXA_MCP_EXE)) return process.env.VEXA_MCP_EXE
  const root = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local")
  const versionsDir = path.join(root, "Roblox", "Versions")
  let best = null
  let bestTime = 0
  try {
    for (const d of fs.readdirSync(versionsDir)) {
      if (!String(d).startsWith("version-")) continue
      const p = path.join(versionsDir, d, "StudioMCP.exe")
      if (!fs.existsSync(p)) continue
      const mt = fs.statSync(p).mtimeMs
      if (mt > bestTime) { bestTime = mt; best = p }
    }
  } catch (_e) {}
  if (!best) {
    try {
      const out = spawnSync("reg", ["query", "HKEY_CURRENT_USER\\Software\\Roblox\\RobloxStudio", "/v", "ContentFolder"], { encoding: "utf8", timeout: 5000 })
      const m = (out.stdout || "").match(/ContentFolder\s+REG_SZ\s+(.+)/)
      if (m) {
        const exe = path.resolve(path.join(m[1].trim(), "..", "StudioMCP.exe"))
        if (fs.existsSync(exe)) best = exe
      }
    } catch (_e) {}
  }
  return best ? path.resolve(best) : null
}

const pendingRpc = new Map() // id -> { resolve, reject }
let child = null
let stdinOk = false

const MCP_PROTOCOL_VERSION = "2024-11-05"

function spawnMcp() {
  if (child) return
  const exe = findStudioMcpExe()
  if (!exe) {
    mcpError = "Studio MCP not found. In Roblox Studio: Assistant > ... > Manage MCP Servers > turn ON 'Enable Studio as MCP server', then start this bridge."
    console.error("  [mcp] " + mcpError)
    return
  }
  mcpError = null
  console.log("  [mcp] Launching Studio MCP: " + exe)
  child = spawn(exe, [], { stdio: ["pipe", "pipe", "pipe"] })
  stdinOk = true

  let buffer = ""
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8")
    let idx
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      if (!line) continue
      let msg
      try { msg = JSON.parse(line) } catch { continue }
      handleRpcMessage(msg)
    }
  })
  child.stderr.on("data", (chunk) => {
    const t = chunk.toString("utf8").trim()
    if (t) console.log("  [mcp-stderr] " + t.split("\n").join(" "))
  })
  child.on("exit", (code) => {
    stdinOk = false
    studioReady = false
    studioId = null
    console.log("  [mcp] Studio MCP process exited (code " + code + ")")
    // Reject all in-flight rpc requests
    for (const [, p] of pendingRpc) p.reject(new Error("MCP process exited"))
    pendingRpc.clear()
    child = null
    mcpError = "Studio MCP disconnected. Make sure Roblox Studio is running with MCP enabled."
    scheduleRespawn()
  })
}

function scheduleRespawn() {
  if (respawnTimer) return
  console.log("  [mcp] Auto-restart in " + respawnDelay + "ms")
  respawnTimer = setTimeout(() => {
    respawnTimer = null
    if (!child) {
      spawnMcp()
      respawnDelay = Math.min(respawnDelay * 2, 15000)
    }
  }, respawnDelay)
}

function recycleNow() {
  if (recycling) return
  recycling = true
  console.log("  [mcp] Force-recycling the Studio MCP connection...")
  const c = child
  child = null
  stdinOk = false
  studioReady = false
  studioId = null
  if (respawnTimer) { clearTimeout(respawnTimer); respawnTimer = null }
  if (c) { try { c.kill("SIGKILL") } catch (_e) {} }
  try { spawnSync("taskkill", ["/F", "/IM", "StudioMCP.exe"], { encoding: "utf8", timeout: 5000 }) } catch (_e) {}
  for (const [, p] of pendingRpc) p.reject(new Error("MCP recycled"))
  pendingRpc.clear()
  lastErrors = []
  respawnDelay = 2000
  setTimeout(() => { spawnMcp(); recycling = false }, 1500)
}

function sendRpc(method, params, notification = false) {
  if (!child || !stdinOk) throw new Error("MCP not connected")
  const msg = notification
    ? { jsonrpc: "2.0", method, params }
    : { jsonrpc: "2.0", id: ++rpcId, method, params }
  child.stdin.write(JSON.stringify(msg) + "\n", "utf8")
  if (notification) return null
  return new Promise((resolve, reject) => {
    pendingRpc.set(msg.id, { resolve, reject, started: now() })
    setTimeout(() => {
      if (pendingRpc.has(msg.id)) {
        pendingRpc.delete(msg.id)
        reject(new Error("MCP request timed out: " + method))
      }
    }, 120_000)
  })
}

function handleRpcMessage(msg) {
  // Server-to-client request (rare; e.g. logging) — respond with -32601 method not found.
  if (msg.id !== undefined && msg.id !== null && msg.method) {
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "method not found" } }) + "\n", "utf8")
    return
  }
  if (msg.method) {
    // Notifications: ignore (progress/logging).
    return
  }
  const p = pendingRpc.get(msg.id)
  if (p) {
    pendingRpc.delete(msg.id)
    if (msg.error) p.reject(new Error(msg.error.message || "MCP error"))
    else p.resolve(msg.result)
  }
}

async function initMcp() {
  const init = await sendRpc("initialize", {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "vexa-bridge", version: VERSION },
  })
  mcpVersion = init?.protocolVersion || null
  sendRpc("notifications/initialized", {}, true)
}

async function callTool(name, args) {
  const result = await sendRpc("tools/call", { name, arguments: args })
  const content = Array.isArray(result?.content) ? result.content : []
  const text = content.map((c) => c?.text || "").join("\n")
  const isError = !!result?.isError
  let parsed = null
  if (!isError) {
    try { parsed = JSON.parse(text) } catch { parsed = null }
  }
  return { ok: !isError, text, data: parsed, raw: result }
}

function pickStudioId(item) {
  if (typeof item === "string") return item.trim() || null
  if (!item || typeof item !== "object") return null
  for (const k of ["studio_id", "studioId", "studioInstanceId", "instanceId", "id", "name"]) {
    const v = item[k]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && v) return String(v)
  }
  return null
}

// Detect whether the Roblox Studio app itself is running, so we can tell the
// user apart: "Studio closed" vs "Studio open but MCP host not answering".
function isStudioRunning() {
  try {
    const out = spawnSync("tasklist", ["/FI", "IMAGENAME eq RobloxStudioBeta.exe", "/NH"], { encoding: "utf8", timeout: 4000 })
    return /RobloxStudioBeta\.exe/i.test(out.stdout || "")
  } catch {
    return null
  }
}

// Resolve the target Studio instance once (docs: every call takes studio_id).
async function ensureStudioId() {
  if (studioId) return studioId
  const res = await callTool("list_roblox_studios", {})
  const txt = String(res.text || "")
  const lower = txt.toLowerCase()
  let studios = []
  if (res.data && Array.isArray(res.data)) studios = res.data
  else if (res.data && typeof res.data === "object") {
    if (Array.isArray(res.data.studios)) studios = res.data.studios
    else if (Array.isArray(res.data.instances)) studios = res.data.instances
  }
  if (studios.length === 0) {
    // Studio can answer with a plain-text notice instead of JSON when the MCP
    // server inside Studio is not reachable/enabled yet.
    const studioRunning = isStudioRunning()
    if (studioRunning === false) {
      mcpError = "Roblox Studio non è in esecuzione. Aprilo, carica un luogo e riavvia Vexa (il ponte si riconnetterà da solo)."
    } else if (/unable to reach|not connected|no studio/i.test(lower)) {
      mcpError = "Roblox Studio è aperto ma il server MCP non risponde: controlla in Assistant → ⋯ → Manage MCP Servers che “Enable Studio as MCP server” sia attivo e premi Connect, poi riavvia Vexa."
    } else {
      mcpError = "Nessuna istanza di Roblox Studio connessa al ponte. Apri un luogo in Studio col MCP abilitato, poi riprova."
    }
    throw new Error(mcpError)
  }
  studioId = pickStudioId(studios[0])
  if (!studioId) {
    mcpError = "Risposta inattesa dal server Studio (“" + txt.slice(0, 120).replace(/\s+/g, " ") + "”). Riavvia Studio e Vexa."
    throw new Error(mcpError)
  }
  console.log("  [mcp] Using Studio instance: " + studioId)
  return studioId
}

// --------------------------------------------------------------------------
// Tool translation: app command -> Studio MCP tool call
// --------------------------------------------------------------------------

function buildApplyLuau(payload) {
  const json = JSON.stringify(payload)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
  return [
    "local HttpService = game:GetService(\"HttpService\")",
    "local payload = HttpService:JSONDecode(\"" + json + "\")",
    "local created = {}",
    "local deleted = {}",
    "",
    "local function resolveContainer(p)",
    "	if not p or p == \"\" then return true, nil end",
    "	local remaining = p",
    "	if remaining:sub(1, 5) == \"game.\" or remaining:sub(1, 5) == \"game/\" then remaining = remaining:sub(6) end",
    "	local first = remaining:match(\"^([^%.%/]+)\")",
    "	if not first then return false, \"Invalid path\" end",
    "	local container",
    "	if first == \"Workspace\" then",
    "		container = workspace",
    "	else",
    "		local ok, svc = pcall(function() return game:GetService(first) end)",
    "		if ok then container = svc",
    "		else",
    "			local found = game:FindFirstChild(first, true)",
    "			if not found then return false, \"Parent not found: \" .. tostring(first) end",
    "			container = found",
    "		end",
    "	end",
    "	local i = 0",
    "	for part in string.gmatch(remaining, \"[^%.%/]+\") do",
    "		i = i + 1",
    "		if i > 1 then",
    "			local child = container:FindFirstChild(part, true)",
    "			if not child then return false, \"Parent not found: \" .. tostring(part) end",
    "			container = child",
    "		end",
    "	end",
    "	return true, container",
    "end",
    "",
    "local function applyProperty(inst, name, value)",
    "	if value == nil then return true end",
    "	if type(value) == \"table\" and type(value.type) == \"string\" then",
    "		local t = value.type",
    "		if t == \"Color3\" then",
    "			inst[name] = Color3.fromRGB(value.r or 0, value.g or 0, value.b or 0)",
    "		elseif t == \"Vector3\" then",
    "			inst[name] = Vector3.new(value.x or 0, value.y or 0, value.z or 0)",
    "		elseif t == \"Vector2\" then",
    "			inst[name] = Vector2.new(value.x or 0, value.y or 0)",
    "		elseif t == \"UDim2\" then",
    "			inst[name] = UDim2.new(value.xScale or 0, value.xOffset or 0, value.yScale or 0, value.yOffset or 0)",
    "		elseif t == \"UDim\" then",
    "			inst[name] = UDim.new(value.scale or 0, value.offset or 0)",
    "		elseif t == \"NumberRange\" then",
    "			inst[name] = NumberRange.new(value.min or 0, value.max or 0)",
    "		elseif t == \"NumberSequence\" then",
    "			local kps = {}",
    "			for _, k in ipairs(value.keypoints or {}) do",
    "				table.insert(kps, NumberSequenceKeypoint.new(k.time or 0, k.value or 0))",
    "			end",
    "			inst[name] = NumberSequence.new(kps)",
    "		elseif t == \"ColorSequence\" then",
    "			local kps = {}",
    "			for _, k in ipairs(value.keypoints or {}) do",
    "				table.insert(kps, ColorSequenceKeypoint.new(k.time or 0, Color3.fromRGB(k.r or 0, k.g or 0, k.b or 0)))",
    "			end",
    "			inst[name] = ColorSequence.new(kps)",
    "		elseif t == \"NormalId\" and Enum.NormalId[value.value] then",
    "			inst[name] = Enum.NormalId[value.value]",
    "		elseif t == \"CFrame\" then",
    "			inst[name] = CFrame.new(value.x or 0, value.y or 0, value.z or 0, value.rx or 0, value.ry or 0, value.rz or 0)",
    "		else",
    "			inst[name] = value.value",
    "		end",
    "		return true",
    "	end",
    "	if type(value) == \"string\" then",
    "		local enumName, member = value:match(\"^Enum%.(%w+)%.(%w+)$\")",
    "		if enumName and member and rawget(Enum, enumName) and rawget(Enum[enumName], member) then",
    "			inst[name] = Enum[enumName][member]",
    "			return true",
    "		end",
    "	end",
    "	inst[name] = value",
    "	return true",
    "end",
    "",
    "for _, del in ipairs(payload.deletions or {}) do",
    "	local ok, parent = resolveContainer(del and del.parent)",
    "	if ok and parent and del and del.name then",
    "		local target = parent:FindFirstChild(del.name, true)",
    "		if target then",
    "			table.insert(deleted, target:GetFullName())",
    "			target:Destroy()",
    "		end",
    "	end",
    "end",
    "",
    "for _, ins in ipairs(payload.instances or {}) do",
    "	local ok, parent = resolveContainer(ins and ins.parent or \"Workspace\")",
    "	if not ok or not ins or not ins.name then",
    "		table.insert(created, \"ERROR: \" .. tostring(parent))",
    "	else",
    "		local okc, out = pcall(function()",
    "			local inst = Instance.new(ins.className or ins.class or \"Instance\")",
    "			inst.Name = ins.name",
    "			for k, v in pairs(ins.properties or {}) do applyProperty(inst, k, v) end",
    "			inst.Parent = parent",
    "			return inst:GetFullName()",
    "		end)",
    "		if okc then table.insert(created, out)",
    "		else table.insert(created, \"ERROR creating \" .. (ins.name or \"?\") .. \": \" .. tostring(out)) end",
    "	end",
    "end",
    "",
    "for _, scr in ipairs(payload.scripts or {}) do",
    "	local ok, parent = resolveContainer(scr and scr.parent or \"ServerScriptService\")",
    "	if not ok or not scr or not scr.name then",
    "		table.insert(created, \"ERROR: \" .. tostring(parent))",
    "	else",
    "		local oks, outs = pcall(function()",
    "			local script",
    "			if scr.type == \"LocalScript\" then script = Instance.new(\"LocalScript\")",
    "			elseif scr.type == \"ModuleScript\" then script = Instance.new(\"ModuleScript\")",
    "			else script = Instance.new(\"Script\") end",
    "			script.Name = scr.name",
    "			script.Source = scr.code or \"\"",
    "			script.Parent = parent",
    "			return script:GetFullName()",
    "		end)",
    "		if oks then table.insert(created, outs)",
    "		else table.insert(created, \"ERROR creating \" .. (scr.name or \"?\") .. \": \" .. tostring(outs)) end",
    "	end",
    "end",
    "",
    "local skippedCount = 0",
    "for _, key in ipairs({ \"animations\", \"cinematics\", \"audio\", \"sound_assets\", \"mesh_assets\" }) do",
    "	if type(payload[key]) == \"table\" then skippedCount = skippedCount + #payload[key] end",
    "end",
    "",
    'return HttpService:JSONEncode({ created = created, deleted = deleted, skipped = skippedCount > 0 and skippedCount or nil })',
  ].join("\n")
}

// --------------------------------------------------------------------------
// Plugin channel: registry, command queue, result handling
// --------------------------------------------------------------------------

function prunePlugins() {
  const stale = now() - HEARTBEAT_MAX_GAP
  for (const [t, e] of pluginClients) {
    if (e.lastSeen < stale) {
      console.log("  [plugin] forgot stale instance: " + e.instanceId + " (" + e.placeName + ")")
      pluginClients.delete(t)
    }
  }
}

function pluginSummary() {
  const out = []
  for (const e of pluginClients.values()) {
    out.push({ instanceId: e.instanceId, name: e.name, placeId: e.placeId, placeName: e.placeName, version: e.pluginVersion, ageMs: now() - e.lastSeen })
  }
  return out
}

function pickPluginEntry() {
  let newest = null
  for (const e of pluginClients.values()) {
    if (!newest || e.lastSeen > newest.lastSeen) newest = e
  }
  return newest
}

function execPluginCommand(entry, cmd) {
  return new Promise((resolve, reject) => {
    const id = "p-" + now() + "-" + randomBytes(4).toString("hex")
    const timer = setTimeout(() => {
      pluginCommands.delete(id)
      reject(new Error("Plugin command timed out: " + cmd.tool))
    }, 120_000)
    pluginCommands.set(id, { token: entry.token, resolve, reject, timer })
    entry.queue.push({ id, tool: cmd.tool, code: cmd.code, mode: cmd.mode })
  })
}

function handlePluginReport(token, body) {
  pluginStats.reports++
  pluginStats.lastReportAt = now()
  const id = String(body.id || "")
  const pc = pluginCommands.get(id)
  if (!pc) return false
  if (pc.token !== token) return false
  pluginCommands.delete(id)
  clearTimeout(pc.timer)
  if (body.ok === false || (typeof body.error === "string" && body.error !== "" && body.ok !== true)) {
    pc.reject(new Error(typeof body.error === "string" ? body.error : "Plugin command failed"))
  } else {
    pc.resolve({ result: body.result })
  }
  return true
}

function pushQaReport(r, channel) {
  if (!r || typeof r !== "object" || !r.checks || typeof r.checks !== "object") return false
  const rid = typeof r.runId === "string" ? r.runId : ""
  if (rid) {
    if (qaRunIds.has(rid)) return false
    qaRunIds.add(rid)
    if (qaRunIds.size > 60) {
      for (const k of [...qaRunIds].slice(0, qaRunIds.size - 40)) qaRunIds.delete(k)
    }
  }
  const entry = {
    source: String(r.source || "unknown"),
    channel: channel || "game",
    runId: rid || "",
    time: Number(r.time || 0) || Math.floor(Date.now() / 1000),
    receivedAt: now(),
    checks: r.checks,
  }
  qaReports.unshift(entry)
  if (qaReports.length > 20) qaReports.length = 20
  qaStats.count = qaReports.length
  qaStats.lastAt = now()
  qaStats.lastSource = entry.source
  return true
}

async function runViaPlugin(tool, args) {
  const entry = pickPluginEntry()
  if (!entry) throw new Error("Nessuna istanza di Roblox Studio (plugin) connessa al ponte. Apri Studio col plugin Vexa attivo, poi riprova.")
  const cmd = buildPluginCommand(tool, args)
  if (!cmd) throw new Error("Unknown tool: " + tool)
  const res = await execPluginCommand(entry, { tool: "exec", code: cmd.code, mode: cmd.mode })
  const text = typeof res.result === "string" ? res.result : JSON.stringify(res.result ?? null)
  let data = null
  try { data = JSON.parse(text) } catch { data = null }
  return data !== null ? data : { text }
}

function buildPluginCommand(tool, args) {
  switch (tool) {
    case "apply_generation":
      return { code: buildApplyLuau(args.generation || {}), mode: "edit" }
    case "execute_luau":
    case "execute_script":
      return { code: args.code || args.script || args.source || "", mode: args.datamodel_type === "Edit" ? "edit" : "read" }
    case "get_game_model":
      return { code: gameModelCode(), mode: "read" }
    case "get_children":
      return { code: descendantsCode(typeof args.path === "string" ? args.path : "game", false), mode: "read" }
    case "find_instance":
      return { code: descendantsCode(typeof args.path === "string" ? args.path : "game", true), mode: "read" }
    case "get_selection":
      return { code: selectionCode(), mode: "read" }
    case "verify_place":
      return { code: verifyPlaceCode(Array.isArray(args.names) ? args.names : []), mode: "read" }
    case "get_script_source":
      return { code: scriptSourceCode(typeof args.path === "string" ? args.path : "", false), mode: "read" }
    case "set_script_source":
      return { code: scriptSourceCode(typeof args.path === "string" ? args.path : "", String(args.source || "")), mode: "edit" }
    default:
      return null
  }
}

function selectionCode() {
  return 'local s = game:GetService("Selection"):Get(); local out = {}; for _, i in ipairs(s) do table.insert(out, { Name = i.Name, ClassName = i.ClassName, Path = i:GetFullName() }) end; return game:GetService("HttpService"):JSONEncode(out)'
}

function descendantsCode(p, includeProps) {
  const q = (s) => '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\u0000-\u001f]/g, "") + '"'
  const propLine = includeProps
    ? 'local props = {}; local okc, cp = pcall(function() for _, k in ipairs({ "Position", "Size", "Color", "Material", "Transparency", "Source", "Value" }) do local okp, v = pcall(function() return inst[k] end); if okp then props[k] = tostring(v) end end return props end); if okc then info.Properties = cp end'
    : ""
return [
    "local pcs = " + q(p) + "",
    "local target",
    "local function resolvePath(pathStr)",
    "  if not pathStr or pathStr == \"\" then return game end",
    "  local clean = pathStr",
    "  if clean:sub(1, 5) == \"game.\" then clean = clean:sub(6) end",
    "  if clean:sub(1, 5) == \"game/\" then clean = clean:sub(6) end",
    "  if clean == \"game\" or clean == \"Game\" then return game end",
    "  local current = game",
    "  for part in string.gmatch(clean, \"[^%.%/]+\") do",
    "    local child = current:FindFirstChild(part, true)",
    "    if not child then return nil end",
    "    current = child",
    "  end",
    "  return current",
    "end",
    "target = resolvePath(pcs)",
    "if not target then return game:GetService(\"HttpService\"):JSONEncode({ missing = " + q(p) + " }) end",
    "local out = {}",
    "local seen = {}",
    "local function walk(inst, depth)",
    "  if not inst or depth > 6 then return end",
    "  local info = { Name = inst.Name, ClassName = inst.ClassName, Path = inst:GetFullName(), Children = {} }",
    "  " + propLine,
    "  for _, c in ipairs(inst:GetChildren()) do",
    "    if not seen[c] then seen[c] = true; walk(c, depth + 1) end",
    "  end",
    "  table.insert(out, info)",
    "end",
    "walk(target, 0)",
    "return game:GetService(\"HttpService\"):JSONEncode(out)",
  ].join("\n")
}

function verifyPlaceCode(names) {
  const q = (s) =>
    "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/[\u0000-\u001f]/g, "") + "'"
  return [
    "local names = {" + names.map(q).join(", ") + "}",
    "local found, missing = {}, {}",
    "for _, n in ipairs(names) do",
    "	local ok = false",
    "	for _, desc in pairs(game:GetDescendants()) do",
    "		if desc.Name == n then ok = true break end",
    "	end",
    "	if ok then table.insert(found, n) else table.insert(missing, n) end",
    "end",
    "return game:GetService(\"HttpService\"):JSONEncode({ found = found, missing = missing, total = #names })",
  ].join("\n")
}

function scriptSourceCode(p, newSource) {
  const q = (s) =>
    '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\u0000-\u001f]/g, "") + '"'
  const readOnly = newSource === false
  if (readOnly) {
    return [
      "local t = game:FindFirstChild(" + q(p) + ", true)",
      'if not t then return game:GetService("HttpService"):JSONEncode({ missing = ' + q(p) + " }) end",
      'return game:GetService("HttpService"):JSONEncode({ path = t:GetFullName(), className = t.ClassName, source = tostring(t:FindFirstChild("Source") and t.Source.Value or "") })',
    ].join("\n")
  }
  return [
    "local t = game:FindFirstChild(" + q(p) + ", true)",
    'if not t then return game:GetService("HttpService"):JSONEncode({ error = "not found: ' + q(p) + '" }) end',
    'if not t:IsA("LuaSourceContainer") then return game:GetService("HttpService"):JSONEncode({ error = "not a script: " .. t:GetFullName() }) end',
    't.Source = ' + q(newSource),
    'return game:GetService("HttpService"):JSONEncode({ path = t:GetFullName(), sourceSet = true })',
  ].join("\n")
}

function gameModelCode() {
  return [
    "local out = {}",
    "local seen = {}",
    "local function walk(inst, depth)",
    "  if not inst or depth > 8 then return end",
    "  local kids = {}",
    "  for _, c in ipairs(inst:GetChildren()) do",
    "    if not seen[c] then seen[c] = true; table.insert(kids, { Name = c.Name, ClassName = c.ClassName, Path = c:GetFullName(), Children = walk(c, depth + 1) }) end",
    "  end",
    "  return kids",
    "end",
    "local svcs = {}",
    "for _, svc in ipairs({ \"Workspace\", \"ServerScriptService\", \"ReplicatedStorage\", \"Lighting\", \"StarterGui\", \"StarterPack\", \"ServerStorage\", \"SoundService\" }) do",
    "  local s = game:FindService(svc)",
    "  if s then table.insert(svcs, { Name = s.Name, ClassName = s.ClassName, Path = s:GetFullName(), Children = walk(s, 0) }) end",
    "end",
    "for _, s in ipairs(game:GetChildren()) do",
    "  if s.ClassName:match(\"Service\") then table.insert(svcs, { Name = s.Name, ClassName = s.ClassName, Path = s:GetFullName(), Children = walk(s, 0) }) end",
    "end",
    "return game:GetService(\"HttpService\"):JSONEncode({ services = svcs })",
  ].join("\n")
}

async function executeAppCommand(tool, args) {
  prunePlugins()
  if (pluginClients.size > 0) {
    activeChannel = "plugin"
    return runViaPlugin(tool, args)
  }
  activeChannel = "mcp"
  const sid = await ensureStudioId()

  switch (tool) {
    case "apply_generation": {
      const res = await callTool("execute_luau", { code: buildApplyLuau(args.generation || {}), datamodel_type: "Edit", studio_id: sid })
      if (!res.ok) throw new Error(res.text || "Studio failed to apply generation")
      let created = [], deleted = [], skipped = 0
      if (res.data) {
        created = res.data.created || []
        deleted = res.data.deleted || []
        skipped = res.data.skipped || 0
      }
      return { created, deleted, skipped }
    }

    case "execute_luau":
    case "execute_script": {
      const code = args.code || args.script || args.source || ""
      const res = await callTool("execute_luau", { code, datamodel_type: args.datamodel_type || "Edit", studio_id: sid })
      if (!res.ok) throw new Error(res.text || "Luau execution failed")
      return res.data !== null ? res.data : { text: res.text }
    }

    case "get_game_model": {
      const res = await callTool("search_game_tree", { studio_id: sid })
      return res.data !== null ? res.data : { text: res.text }
    }

    case "get_children": {
      const res = await callTool("search_game_tree", { path: args.path || "game", studio_id: sid })
      if (res.data !== null) return res.data
      const insp = await callTool("inspect_instance", { instance_path: args.path || "game", studio_id: sid })
      return insp.data !== null ? insp.data : { text: insp.text }
    }

    case "find_instance": {
      const res = await callTool("inspect_instance", { instance_path: args.path || "game", studio_id: sid })
      return res.data !== null ? res.data : { text: res.text }
    }

    case "get_script_source": {
      const res = await callTool("script_read", { script_path: args.path || "", studio_id: sid })
      return { path: args.path, source: res.data?.source ?? res.data?.script ?? res.text }
    }

    case "set_script_source": {
      const res = await callTool("multi_edit", { edits: [{ path: args.path, content: args.source || "" }], datamodel_type: "Edit", studio_id: sid })
      return res.data !== null ? res.data : { text: res.text }
    }

    case "get_selection": {
      // Studio MCP has no get_selection tool; emulate via execute_luau.
      const res = await callTool("execute_luau", {
        code: 'local s = game:GetService("Selection"):Get(); local out = {}; for _, i in ipairs(s) do table.insert(out, { Name = i.Name, ClassName = i.ClassName, Path = i:GetFullName() }) end; return game:GetService("HttpService"):JSONEncode(out)',
        datamodel_type: "Edit",
        studio_id: sid,
      })
      if (!res.ok) throw new Error(res.text || "get_selection failed")
      return Array.isArray(res.data) ? res.data : { text: res.text }
    }

    case "verify_place": {
      // Read back from Studio: confirm every instance name the apply step
      // created actually resolves in the live (Edit) datamodel. This is the
      // "did it really land?" loop — not trust, verification.
      const names = Array.isArray(args.names) ? args.names : []
      if (names.length === 0) return { found: [], missing: [], total: 0 }
      const q = (s) =>
        "'" + String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/[\u0000-\u001f]/g, "") + "'"
      const code = [
        "local names = {" + names.map(q).join(", ") + "}",
        "local found, missing = {}, {}",
        "for _, n in ipairs(names) do",
        "	local ok = false",
        "	for _, desc in pairs(game:GetDescendants()) do",
        "		if desc.Name == n then ok = true break end",
        "	end",
        "	if ok then table.insert(found, n) else table.insert(missing, n) end",
        "end",
        "return game:GetService(\"HttpService\"):JSONEncode({ found = found, missing = missing, total = #names })",
      ].join("\n")
      const res = await callTool("execute_luau", { code, datamodel_type: "Edit", studio_id: sid })
      if (!res.ok) throw new Error(res.text || "verify_place failed")
      const data = Array.isArray(res.data) ? res.data[0] : res.data
      if (data && data.found) return data
      return { found: [], missing: names, total: names.length, note: "verify not available in this Studio" }
    }

    default:
      throw new Error("Unknown tool: " + tool)
  }
}

// --------------------------------------------------------------------------
// HTTP server
// --------------------------------------------------------------------------

function json(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  })
  res.end(text)
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ""
    req.on("data", (c) => { data += c; if (data.length > 5_000_000) req.destroy() })
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}) } catch { resolve({}) } })
    req.on("error", () => resolve({}))
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`)
  const path = url.pathname

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    })
    return res.end()
  }

  try {
    if (req.method === "GET" && path === "/health") {
      prunePlugins()
      return json(res, 200, { ok: true, name: "vexa-bridge", token: TOKEN, port: PORT, version: VERSION, uptime: now() - startedAt, child: !!child && stdinOk, nextRespawn: respawnDelay, channel: activeChannel, plugins: pluginSummary(), pluginDbg: pluginStats, qa: qaStats, studio: { ready: studioReady, error: mcpError, process: isStudioRunning() } })

    } else if (req.method === "GET" && path === "/api/mcp/status") {
      prunePlugins()
      return json(res, 200, { connected: !!child && stdinOk, token: TOKEN, channel: activeChannel, plugins: pluginClients.size, studio: { ready: studioReady, error: mcpError } })

    } else if (req.method === "POST" && path === "/api/studio/register") {
      const body = await readBody(req)
      const incomingToken = typeof body.token === "string" ? body.token : ""
      let entry = incomingToken ? pluginClients.get(incomingToken) : null
      pluginStats.registers++
      if (!entry) {
        const nt = "gx-plugin-" + randomBytes(16).toString("hex")
        entry = {
          token: nt,
          instanceId: typeof body.instanceId === "string" && body.instanceId ? body.instanceId : "studio-" + randomBytes(6).toString("hex"),
          name: String(body.name || "Roblox Studio"),
          placeId: String(body.placeId || ""),
          placeName: String(body.placeName || ""),
          studioVersion: String(body.studioVersion || ""),
          pluginVersion: String(body.pluginVersion || ""),
          capabilities: Array.isArray(body.capabilities) ? body.capabilities : ["exec"],
          pollMs: 800,
          queue: [],
          registeredAt: now(),
          lastSeen: now(),
        }
        pluginClients.set(entry.token, entry)
        console.log("  [plugin] registered: " + entry.instanceId + " (" + entry.placeName + ")")
      } else {
        entry.lastSeen = now()
        entry.placeId = String(body.placeId || entry.placeId)
        entry.placeName = String(body.placeName || entry.placeName)
        entry.studioVersion = String(body.studioVersion || entry.studioVersion)
        entry.pluginVersion = String(body.pluginVersion || entry.pluginVersion)
      }
      return json(res, 200, { ok: true, token: entry.token, instanceId: entry.instanceId, pollMs: entry.pollMs, bridgeVersion: VERSION })

    } else if (req.method === "GET" && path === "/api/studio/pop") {
      const t = url.searchParams.get("token") || ""
      const entry = pluginClients.get(t)
      if (!entry) return json(res, 404, { ok: false, error: "unknown token" })
      prunePlugins()
      entry.lastSeen = now()
      const cmd = entry.queue.shift() || null
      pluginStats.pops++
      pluginStats.lastPopAt = now()
      pluginStats.queueDepth = entry.queue.length
      return json(res, 200, { ok: true, command: cmd })

    } else if (req.method === "POST" && path === "/api/studio/report") {
      const body = await readBody(req)
      const t = typeof body.token === "string" ? body.token : ""
      const accepted = handlePluginReport(t, body || {})
      return json(res, 200, { ok: true, accepted })

    } else if (req.method === "POST" && path === "/api/studio/qa") {
      // Plugin-harvested runtime QA reports (probe in-game -> ServerStorage ->
      // plugin -> bridge). Only an authenticated registered plugin can post.
      const body = await readBody(req)
      const t = typeof body.token === "string" ? body.token : ""
      if (!pluginClients.has(t)) return json(res, 401, { ok: false, error: "unknown token" })
      const received = pushQaReport(body && body.report, "plugin")
      return json(res, 200, { ok: true, received, count: qaReports.length })

    } else if (req.method === "POST" && (path === "/restart" || path === "/recycle")) {
      recycleNow()
      return json(res, 200, { ok: true, recycled: true })

    } else if (req.method === "POST" && path === "/api/mcp/execute") {
      const body = await readBody(req)
      const tool = typeof body.tool === "string" ? body.tool : null
      if (!tool) return json(res, 400, { ok: false, error: "missing tool" })
      if ((!child || !stdinOk) && pluginClients.size === 0) return json(res, 503, { ok: false, error: mcpError || "Studio MCP not connected" })
      const id = `cmd-${now()}-${randomBytes(4).toString("hex")}`
      pending.push({ id, tool, args: body.args || {}, createdAt: now() })
      // Run the command asynchronously so the HTTP response format stays the
      // same as before (immediate commandId, then poll result).
      runQueued(id, tool, body.args || {}).then(
        (output) => { lastErrors = []; results.set(id, { id, output, createdAt: now() }) },
        (err) => {
          const msg = String((err && err.message) || err)
          results.set(id, { id, output: null, error: msg, createdAt: now() })
          if (!/non è in esecuzione|MCP non risponde|nessuna istanza|Risposta inattesa|not connected|no studio|unable to reach|not found|Unknown tool/i.test(msg)) {
            lastErrors.push(msg)
            if (lastErrors.length > 8) lastErrors.shift()
            if (lastErrors.length >= 4 && lastErrors.every((e) => e === lastErrors[0])) recycleNow()
          }
        }
      )
      return json(res, 200, { ok: true, commandId: id })

    } else if (req.method === "GET" && path === "/api/mcp/result") {
      const id = url.searchParams.get("id")
      if (!id) return json(res, 400, { ok: false, error: "missing id" })
      const r = results.get(id)
      if (!r) return json(res, 200, { status: "pending" })
      return json(res, 200, { status: "done", result: { output: r.output, error: r.error } })

    } else if (req.method === "POST" && path === "/api/mcp/collect") {
      // In-build QA probe reports land here when a heavy game/obby is played
      // in Studio direct from the game (HTTP enabled) or via the plugin
      // harvest at /api/studio/qa. Store the latest few so the app can show
      // runtime verification.
      const body = await readBody(req)
      let parsed = typeof body === "object" && body !== null ? body : null
      if (!parsed || !parsed.checks) {
        try { parsed = typeof body === "string" ? JSON.parse(body) : null } catch { parsed = null }
      }
      const received = pushQaReport(parsed, "http")
      return json(res, 200, { ok: true, received, count: qaReports.length })

    } else if (req.method === "GET" && path === "/api/mcp/collect") {
      return json(res, 200, { ok: true, reports: qaReports.slice(0, 10), count: qaReports.length, stats: qaStats })

    } else {
      return json(res, 404, { ok: false, error: "not found" })
    }
  } catch (err) {
    return json(res, 500, { ok: false, error: String(err.message || err) })
  }
})

// Serialize executions so Studio applies commands one at a time.
let queueChain = Promise.resolve()
function runQueued(id, tool, args) {
  queueChain = queueChain.then(() => executeAppCommand(tool, args))
  return queueChain
}

server.listen(PORT, HOST, () => {
  console.log("")
  console.log("  Vexa Bridge running")
  console.log(`  URL:    http://${HOST}:${PORT}`)
  console.log(`  Token:  ${TOKEN}`)
  console.log("")
  console.log("  This bridge talks to the Roblox Studio built-in MCP server.")
  console.log("  No plugin is needed inside Studio.")
  console.log("  Press Ctrl+C to stop.")
  console.log("")

  spawnMcp()

  let bootTimer = null
  const boot = async () => {
    prunePlugins()
    if (pluginClients.size > 0) {
      // Plugin channel present: a fresh plugin entry (registering + polling)
      // IS the proof the link is alive — no probe command needed. Mark ready
      // without polluting the plugin command queue.
      activeChannel = "plugin"
      const entry = pickPluginEntry()
      if (entry && now() - entry.lastSeen < 8000) {
        studioReady = true
        mcpError = null
        respawnDelay = 2000
        console.log("  [plugin] Connected to Studio (plugin channel). Ready to run commands.")
        clearInterval(bootTimer)
      } else {
        studioReady = false
        mcpError = "Plugin registrato ma non sta rispondendo: riapri Studio col plugin Vexa attivo."
        console.log("  [plugin] Not ready yet: " + mcpError)
      }
      return
    }
    if (!child) { spawnMcp(); return }
    try {
      await initMcp()
      await ensureStudioId()
      studioReady = true
      mcpError = null
      respawnDelay = 2000
      console.log("  [mcp] Connected to Studio. Ready to run commands.")
      clearInterval(bootTimer)
    } catch (err) {
      studioReady = false
      if (mcpError) console.log("  [mcp] Not ready yet: " + mcpError)
      else console.log("  [mcp] Not ready yet: " + String(err.message || err))
    }
  }
  boot()
  bootTimer = setInterval(boot, 4000)

  console.log("  [mcp] Self-healing enabled: bridge reconnects automatically.")
})

process.on("unhandledRejection", (e) => console.error("  [error] unhandledRejection: " + String((e && e.stack) || e)))
process.on("uncaughtException", (e) => console.error("  [error] uncaughtException: " + String((e && e.stack) || e)))

function parsePort(args) {
  const i = args.indexOf("--port")
  if (i !== -1 && args[i + 1]) {
    const n = Number(args[i + 1])
    if (Number.isInteger(n) && n > 0 && n < 65536) return n
  }
  if (process.env.VEXA_BRIDGE_PORT) {
    const n = Number(process.env.VEXA_BRIDGE_PORT)
    if (Number.isInteger(n) && n > 0 && n < 65536) return n
  }
  return 8765
}