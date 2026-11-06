import { getLlama, LlamaChatSession, ChatMLChatWrapper } from "node-llama-cpp"

const modelPath = "C:/Users/Windows 11/AppData/Local/Temp/opencode/llmtest/Qwen3-8B-Q4_K_M.gguf"
const llama = await getLlama({ gpu: "auto", log: false })
const model = await llama.loadModel({ modelPath })

async function run(label, items, maxTokens = 300) {
  try {
    const context = await model.createContext({ contextSize: 2048, batchSize: 128 })
    const seq = context.getSequence()
    const session = new LlamaChatSession({ contextSequence: seq, chatWrapper: new ChatMLChatWrapper() })
    const out = await session.prompt(items, { maxTokens, temperature: 0.3 })
    console.log(`${label}: ${JSON.stringify(String(out).slice(0, 220))}`)
  } catch (e) {
    console.log(`${label}: ERR ${e.message}`)
  }
}

await run("CHATML+system", [
  { role: "system", content: "Sei un esperto di Roblox Lua. Rispondi SOLO con codice Lua, nessun testo." },
  { role: "user", content: "Funzione che fa saltare il giocatore quando preme Spacebar." },
])
await run("CHATML+nosys", [{ role: "user", content: "Cos'è Roblox? Rispondi in una frase." }])
console.log("DONE")