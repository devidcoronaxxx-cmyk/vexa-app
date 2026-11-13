import { spawn } from "node:child_process"
import path from "node:path"
const root = process.env.VEXA_DIR || process.cwd()
const exe = path.join(root, "node_modules", "electron", "dist", "electron.exe")
const p = spawn(exe, ["--no-sandbox", "."], { cwd: root, detached: true, stdio: "ignore", windowsHide: false })
p.unref()
console.log("electron-detached pid=" + p.pid)
setTimeout(() => process.exit(0), 2500)