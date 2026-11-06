import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
const root = String.raw`C:\Users\Windows 11\Documents\Vexa Project\vexa`
const exe = path.join(root, "node_modules", "electron", "dist", "electron.exe")
const log = path.join(process.env.TEMP, "opencode", "vexa-boot.log")
const err = path.join(process.env.TEMP, "opencode", "vexa-boot.err")
fs.rmSync(log, { force: true }); fs.rmSync(err, { force: true })
const p = spawn(exe, ["."], { cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"], windowsHide: true })
p.stdout.on("data", d => fs.appendFileSync(log, d))
p.stderr.on("data", d => fs.appendFileSync(err, d))
p.on("error", e => fs.appendFileSync(err, "ERR:" + e.message))
p.unref()
console.log("PID=" + p.pid)
setInterval(() => {
  const parts = path.join(process.env.APPDATA, "Vexa", "hunyuan-pack", "parts")
  const files = fs.readdirSync(parts).filter(n => n.endsWith(".part"))
  const mb = files.map(n => n + "=" + (fs.statSync(path.join(parts, n)).size / 1048576).toFixed(1) + "MB").join(" | ")
  console.log(new Date().toISOString().slice(11, 19) + " " + (mb || "nessun .part"))
}, 15000)
