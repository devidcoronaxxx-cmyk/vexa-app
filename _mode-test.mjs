import { getLlama } from "node-llama-cpp"

const modelPath = "C:/Users/Windows 11/AppData/Local/Temp/opencode/llmtest/Qwen3-8B-Q4_K_M.gguf"
const llama = await getLlama({ gpu: "auto", log: false })
const model = await llama.loadModel({ modelPath })
const context = await model.createContext({ contextSize: 2048, batchSize: 128 })
const seqA = context.getSequence()
const seqB = context.getSequence()

// Mode A: array of chat items (as the worker does)
{
  const { LlamaChatSession } = await import("node-llama-cpp")
  const session = new LlamaChatSession({ contextSequence: seqA })
  const items = [
    { role: "system", content: "Sei un esperto di Roblox Lua. Output solo codice." },
    { role: "user", content: "Scrivi Lua che fa saltare con Spacebar." },
  ]
  const out = await session.prompt(items, { maxTokens: 200, temperature: 0.3 })
  console.log("MODE_A(array):", JSON.stringify(String(out).slice(0, 160)))
}

// Mode B: single string prompt with system prefix baked in
{
  const { LlamaChatSession } = await import("node-llama-cpp")
  const session = new LlamaChatSession({ contextSequence: seqB })
  const out = await session.prompt("Scrivi una riga di Lua che fa saltare il giocatore con Spacebar.", { maxTokens: 200, temperature: 0.3 })
  console.log("MODE_B(string):", JSON.stringify(String(out).slice(0, 160)))
}