// Local LLM sidecar for Vexa desktop — serves the bundled open-source model
// (Qwen3-8B Q4_K_M) through an OpenAI-compatible /v1/chat/completions endpoint
// so the app generates without any API key. Spawned by electron/main.js.
import { createServer } from "node:http"
import { readFileSync, existsSync, statSync } from "node:fs"
import {
  LlamaCompletion,
  LlamaText,
  getLlama,
} from "node-llama-cpp"

const args = process.argv.slice(2)
const getArg = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? "" : args[i + 1] || ""
}
const modelDir = getArg("--model-dir")
const modelFile = getArg("--model-file")
const port = Number(getArg("--port") || 9290)

if (!modelDir || !modelFile) {
  console.error("[localllm] missing --model-dir/--model-file")
  process.exit(2)
}
const modelPath = modelDir.endsWith("/") || modelDir.endsWith("\\")
  ? modelDir + modelFile
  : modelDir + "\\" + modelFile

// Wait (bounded) for the Electron main process to finish downloading the GGUF.
const DEADLINE = Date.now() + 30 * 60 * 1000
while (!existsSync(modelPath) && Date.now() < DEADLINE) {
  await new Promise((r) => setTimeout(r, 2500))
}
if (!existsSync(modelPath)) {
  console.error("[localllm] model file still missing after waiting")
  process.exit(3)
}
console.log("[localllm] model size:", (statSync(modelPath).size / 1e9).toFixed(2) + "GB")

let llama, model, contextSequence, completion

async function boot() {
  console.log("[localllm] loading llama (auto GPU)...")
  llama = await getLlama({
    gpu: process.env.VEXA_LLM_CPU ? "cpu" : "auto",
    log: false,
  })
  console.log("[localllm] gpu:", llama.gpu)
  model = await llama.loadModel({ modelPath })
  const context = await model.createContext({
    contextSize: parseInt(process.env.VEXA_LLM_CONTEXT || "8192", 10),
    batchSize: 512,
  })
  contextSequence = context.getSequence()
  completion = new LlamaCompletion({ contextSequence })
  console.log("[localllm] model READY")
}

async function bootWithCpuFallback() {
  try {
    await boot()
  } catch (e) {
    console.error("[localllm] GPU load failed:", e.message, "— retrying on CPU")
    if (!process.env.VEXA_LLM_CPU) {
      process.env.VEXA_LLM_CPU = "1"
      try {
        await boot()
      } catch (e2) {
        console.error("[localllm] CPU load also failed:", e2.message)
        process.exit(4)
      }
    } else {
      process.exit(4)
    }
  }
}

await bootWithCpuFallback()

// Qwen3-instruct plain ChatML rendering (no embedded chat template, which
// node-llama-cpp renders wrongly for these GGUF files — see provider QA logs).
function renderQwen3Chat(messages) {
  let out = ""
  for (const m of messages) {
    const role = m.role === "system" ? "system" : m.role === "assistant" ? "assistant" : "user"
    out += `<|im_start|>${role}\n${m.content.trim()}<|im_end|>\n`
  }
  out += `{"tools":[],"enable_thinking":false}\n`
  out += `<|im_start|>assistant\n`
  return out
}

// Busy flag: one completion at a time (single sequence).
let busy = false
const queue = []

function withLock(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject })
    pump()
  })
}
function pump() {
  if (busy || queue.length === 0) return
  busy = true
  const task = queue.shift()
  task
    .fn()
    .then(task.resolve)
    .catch(task.reject)
    .finally(() => {
      busy = false
      pump()
    })
}

// Strip reasoning/thinking blocks the model may prepend to its answer.
function stripQwen3Preamble(raw) {
  let text = String(raw || "")
  text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
  text = text.replace(/<thinking>[\s\S]*$/i, "")
  text = text.replace(/<\/thinking>/gi, "")
  text = text.trim()
  if (/^thinking\b/i.test(text)) {
    const r = text.indexOf("\nresponse")
    if (r !== -1) {
      text = text.slice(r).replace(/^\s*\n?\s*response\s*:?\s*\n+/i, "")
    } else {
      const parts = text.split(/\r?\n\r?\n\r?\n+/)
      if (parts.length > 1 && parts.at(-1).trim()) text = parts.at(-1)
    }
  }
  if (/^\s*response\b/i.test(text)) text = text.replace(/^\s*response\s*:?\s*\n+/i, "")
  return (typeof text === "string" ? text.trim() : "")
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "content-type")
  if (req.method === "OPTIONS") {
    res.writeHead(204).end()
    return
  }
  const url = new URL(req.url, "http://127.0.0.1")

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ status: "ready", model: modelFile, gpu: llama.gpu, code: "v5trim" }))
    return
  }

  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    let body = ""
    req.on("data", (c) => { body += c; if (body.length > 4e6) { req.destroy() } })
    req.on("end", () => {
      let payload
      try { payload = JSON.parse(body || "{}") } catch { payload = {} }
      const maxTokens = Math.min(Number(payload.max_tokens) || 4096, 8192)
      const temperature = typeof payload.temperature === "number" ? payload.temperature : 0.4
      const items = (payload.messages || [])
        .filter((m) => m && m.role && typeof m.content === "string" && m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }))

      withLock(async () => {
        const t0 = Date.now()
        try {
          const prompt = renderQwen3Chat(items)
          if (contextSequence.nextTokenIndex > 0) {
            await contextSequence.eraseContextTokenRanges([{ start: 0, end: contextSequence.nextTokenIndex }])
          }
          let out = await completion.generateCompletion(prompt, {
            maxTokens,
            temperature,
            customStopTriggers: ["<|im_end|>"],
            trimWhitespaceSuffix: true,
          })
          let imEnd = out.indexOf("<|im_end|>")
          if (imEnd !== -1) out = out.slice(0, imEnd)
          // Qwen3 (reasoning capable GGUF) may prepend a "thinking"/"response"
          // segment block (possibly as "<", " thinking", "< thinking", or quoted
          // variants). Normalise every known lead-in, then extract the final
          // answer segment from behind the "response" boundary or the last
          // heavily-separated block.
          let cleaned = String(out).trim()
          if (/^<+/.test(cleaned)) cleaned = cleaned.replace(/^<+/, "").trim()
          if (/^thinking\b/i.test(cleaned)) {
            cleaned = cleaned.replace(/^thinking\s*:?\s*\n+/i, "")
            const respIdx = cleaned.indexOf("\nresponse")
            if (respIdx !== -1) {
              cleaned = cleaned.slice(respIdx)
              cleaned = cleaned.replace(/^\s*\n?\s*response\s*:?\s*\n+/i, "")
            } else {
              const parts = cleaned.split(/\r?\n\r?\n\r?\n+/)
              if (parts.length > 1 && parts.at(-1).trim()) cleaned = parts.at(-1)
            }
          }
          cleaned = cleaned.trim()
          const content = typeof out === "string" && !cleaned ? out.trim() : cleaned
          res.writeHead(200, { "content-type": "application/json" })
          res.end(JSON.stringify({
            id: "localllm-" + Date.now(),
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: modelFile,
            choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, elapsed_ms: Date.now() - t0 },
          }))
        } catch (e) {
          console.error("[localllm] completion error:", e.message)
          res.writeHead(500, { "content-type": "application/json" })
          res.end(JSON.stringify({ error: { message: e.message } }))
        }
      })
    })
    return
  }

  res.writeHead(404, { "content-type": "application/json" })
  res.end(JSON.stringify({ error: "not found" }))
})

server.listen(port, "127.0.0.1", () => {
  console.log(`[localllm] listening on http://127.0.0.1:${port}`)
})
