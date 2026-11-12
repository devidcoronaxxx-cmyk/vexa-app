import OpenAI from "openai"
import { SYSTEM_PROMPT, STEPS_SYSTEM, REVIEW_SYSTEM, REFINE_SYSTEM, DIRECTOR_SYSTEM } from "./prompts.js"
import { validateLuau, hasErrors, summarizeIssues } from "./lua-validator.js"
import { buildGameKnowledge } from "./game-knowledge.js"
import { checkGameplay, hasCriticalGameplay } from "./gameplay-validator.js"
import { validateAnimations } from "./animation-validator.js"
import { scoreBuildNovelty, noveltyDirective } from "./novelty.js"
import { scoreTaste } from "./taste.js"

const client = new OpenAI({
  // Placeholder avoids a constructor throw when the key is absent (desktop
  // bundle). Callers guard on key presence before actually invoking the API.
  apiKey: process.env.NVIDIA_API_KEY || "missing-key-placeholder",
  baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
})

export const NVIDIA_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b",
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "z-ai/glm-5.3-flash",
  "z-ai/glm-5.3",
  "nvidia/nemotron-3.5-bolt-e4b",
]

export const GLM_MODELS = ["z-ai/glm-5.3", "z-ai/glm-5.3-flash"]

// Sentinel id for the bundled open-source model hosted by the desktop app's
// local llama server (LOCAL_LLM_URL). Used as the zero-key fallback so Vexa
// works immediately after install without registering for any API key.
export const LOCAL_MODEL = "local/qwen3-8b"

// ── Local 3D asset backends (zero-cost: never bill the user or the cloud) ──
// Open-source 3D generation runs entirely on the user's machine, like the
// bundled LLM above. A model only appears in the picker when its local server
// is actually reachable. Hunyuan3D-2.1 (Tencent) = the open-state text→3D
// model, combined with the LLM into ONE agent: Qwen writes the asset blueprint,
// Hunyuan builds the mesh. One 3D model only (size/quality budget): Hunyuan3D
// 2.1 wins over TRELLIS/Unique3D for text→3D, so it is the single 3D backend.
export const HUNYUAN_MODEL = "hunyuan3d-2.1"
export const TRELLIS_MODEL = "trellis-2-fast"
export const USD_MODELS = [HUNYUAN_MODEL, TRELLIS_MODEL]

function localUrl(name, fallback) {
  return (process.env[name] || fallback || "").replace(/\/+$/, "")
}
export function hunyuanUrl() { return localUrl("LOCAL_HUNYUAN_URL", "http://127.0.0.1:8081") }
export function trellisUrl() { return localUrl("LOCAL_TRELLIS_URL", "http://127.0.0.1:7860") }
export function is3dModel(model) { return USD_MODELS.includes(model) }
export function has3dBackend(model) {
  if (model === HUNYUAN_MODEL) return hunyuanUrl()
  if (model === TRELLIS_MODEL) return trellisUrl()
  return ""
}
export async function is3dServerAlive(model) {
  const base = has3dBackend(model)
  if (!base) return false
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store", signal: AbortSignal.timeout(1500) })
    return res.ok
  } catch { return false }
}

// Vexa Team organs: specialized local models Qwen delegates to. Optional: if a
// server is down, the team skips that organ and keeps building with structured
// data. Qwen (the brain) plans; these are the hands.
export const STABLE_AUDIO_MODEL = "stable-audio"
export const KIMODO_MODEL = "kimodo"
export const AINVFX_MODEL = "ainvfx-fluid"
export function stableAudioUrl() { return localUrl("LOCAL_STABLE_AUDIO_URL", "http://127.0.0.1:8124") }
export function kimodoUrl() { return localUrl("LOCAL_KIMODO_URL", "http://127.0.0.1:8123") }
export function ainvfxUrl() { return localUrl("LOCAL_AINVFX_URL", "http://127.0.0.1:8125") }
export async function isAudioServerAlive() { try { const r = await fetch(`${stableAudioUrl()}/health`, { cache: "no-store", signal: AbortSignal.timeout(1500) }); return r.ok } catch { return false } }
export async function isMotionServerAlive() { try { const r = await fetch(`${kimodoUrl()}/health`, { cache: "no-store", signal: AbortSignal.timeout(1500) }); return r.ok } catch { return false } }
export async function isVfxServerAlive() { try { const r = await fetch(`${ainvfxUrl()}/health`, { cache: "no-store", signal: AbortSignal.timeout(1500) }); return r.ok } catch { return false } }

// DeepSeek (OpenAI-compatible endpoints). deepseek-chat = fast V3-class for
// everyday builds; deepseek-reasoner = R1-class chain-of-thought (slower, and
// it rejects temperature/top_p), opt-in via VEXA_PRIMARY_MODEL or the picker.
export const DEEPSEEK_MODELS = [
  "deepseek-chat",
  "deepseek-reasoner",
]

// Frontier providers (used when their API key is configured): their raw
// reasoning beats the NVIDIA open models on complex logic and architecture.
// VEXA_FRONTIER_MODELS (comma-separated) extends the whitelist for validated
// model ids / brand-new release names.
export const FRONTIER_MODELS = [
  "claude-opus-4-5",
  "claude-sonnet-4-5",
  "claude-3-7-sonnet",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
]

function extraFrontierModels() {
  return (process.env.VEXA_FRONTIER_MODELS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
}

export const ALL_MODELS = [...FRONTIER_MODELS, ...NVIDIA_MODELS]

function pickPrimaryModel() {
  const explicit = (process.env.VEXA_PRIMARY_MODEL || "").trim()
  if (explicit) return explicit
  if (process.env.ANTHROPIC_API_KEY) return "claude-sonnet-4-5"
  if (process.env.OPENAI_API_KEY) return "gpt-5"
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) return "gemini-2.5-pro"
  if (process.env.LOCAL_LLM_URL) return LOCAL_MODEL
  return "nvidia/nemotron-3-ultra-550b-a55b"
}

// Same resolution but evaluated at call time (the module-level DEFAULT_MODEL is
// frozen at import; this one reacts to keys set between requests).
export function currentPrimaryModel() {
  return pickPrimaryModel()
}

// Fast default: glm-5.3-flash is Z.ai's fast GT-5.3 variant served by NVIDIA
// NIM — strong on complex chain logic, architecture and JSON fidelity, with a
// small active param count so builds stay snappy. The full 753B glm-5.3 stays
// in the heavy chain as lead when needed. Dedicated flash key handled via
// NVIDIA_GLM_FLASH_API_KEY (main key backstop). When a frontier key is
// configured, the primary switches to the strongest available model so Vexa's
// reasoning ceiling rises with the user's keys.
const DEFAULT_MODEL = pickPrimaryModel()
// Heavy requests (cinematics/animations/3D/sound) produce huge JSON payloads.
// glm-5.3 leads the chain; nemotron-3-ultra-550b (55B active) follows, and
// super-120b (~170 tok/s) finishes anything Ultra can't fit in the window.
// moonshotai/kimi-k3 (1T MoE) would be stronger, but NVIDIA rate-limits it
// (persistent 429) so it can't lead the chain. Frontier primary (Claude/GPT/
// Gemini) is preferred for heavy kits when configured.
const ANIMATION_MODEL = pickPrimaryModel()
const ANIMATION_FALLBACK_ORDER = [
  "nvidia/nemotron-3-ultra-550b-a55b",
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "z-ai/glm-5.3-flash",
  "z-ai/glm-5.3",
  "nvidia/nemotron-3.5-bolt-e4b",
]
const STEPS_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b"
// The thinking pass is a UX progress preview (not fed back into generation), so
// speed wins: lightning-30b returns it in seconds instead of a ~65s 120b wait.
const THINKING_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b"

const MAX_TOKENS = 8192

const MAX_CONVERSATION_CHARS = 48000

const FALLBACK_ORDER = [
  ...(DEFAULT_MODEL.startsWith("nvidia/") ? [] : [DEFAULT_MODEL]),
  "nvidia/nemotron-3-ultra-550b-a55b",
  "nvidia/nemotron-3.5-lightning-30b-a3b",
  "z-ai/glm-5.3-flash",
]

const ANIMATION_KEYWORDS = [
  "animat", "animation", "animazione", "animare",
  "walk", "run", "jump", "dance", "wave", "idle", "punch", "kick",
  "swing", "slam", "crouch", "crawl", "dodge", "salute", "sit", "stand",
  "cammin", "corr", "salt", "ballo", "danza", "cenno", "gesto", "saluto",
  "wave your", "raise your arm", "move its arm", "twirl", "spin", "flip",
  "door slide", "slide open", "sliding door", "rotate", "open the door",
  "tween", "keyframe", "gesture", "motion", "movimento", "move the", "make it move",
]

const CINEMATIC_KEYWORDS = [
  "cinematic", "cinematica", "cutscene", "cut-scene", "scena cinematografica",
  "showcase", "show case", "scene", "scena", "trailer", "trailer", "intro",
  "camera", "inquadratura", "cam", "angle", "angolazione", "shot", "inquadr",
  "slow motion", "slow-mo", "ralenti", "camera shake", "screen shake",
  "flash", "lighting", "illuminazion", "fov", "zoom",
  "hitstop", "freeze frame", "congelamento", "impact frame", "letterbox",
  "vignette", "color grade", "slow motion effect",
  "excalibur", "kamehameha", "getsuga", "ultimate", "ultimata", "anime attack",
  "cinematografico", "dramatic entrance", "entrata drammatica",
]

const VFX_KEYWORDS = [
  "vfx", "effett", "particle", "particella", "effetto", "fx",
  "fire", "fuoco", "flame", "fiamma", "explos", "esplos", "bomb", "blast",
  "lightning", "fulmine", "electric", "elettric", "spark", "scintilla",
  "magic", "magia", "portal", "portale", "beam", "ray", "raggio", "laser",
  "smoke", "fumo", "mist", "nebbia", "aura", "glow", "bagliore", "glow",
  "muzzle", "sparo", "blood", "sangue", "blood", "shockwave", "onda d'urto",
  "trail", "scia", "splash", "schizzo", "heal", "cura", "speed", "boost",
  "energy", "energia", "orb", "shield", "scudo", "forcefield", "campo di forza",
  "butterfly", "farfalla", "confetti", "coro", "snow", "neve", "rain", "pioggia",
  "fountain", "fontana", "geyser", "water", "acqua", "lava", "light beam",
]

const MODEL3D_KEYWORDS = [
  "model", "modello", "3d", "build me", "construct", "costruisc", "sword",
  "spada", "gun", "arma", "rifle", "pistol", "car", "macchina", "auto", "vehicle",
  "veicolo", "house", "casa", "building", "edificio", "tower", "torre", "robot",
  "turret", "torretta", "chair", "sedia", "table", "tavolo", "statue", "statua",
  "bridge", "ponte", "castle", "castello", "prop", "scenario", "environment",
  "object", "oggetto", "asset", "item model", "cosmetic", "hat", "cappello",
  "weapon model", "pickaxe", "scalpel", "dagger", "katana", "axe", "ascia", "hammer",
  "mazza", "mace", "staff", "bastone", "wand", "bacchetta", "treasure", "tesoro",
  "chest", "forziere", "coin", "moneta", "gem", "gemma", "crystal", "cristallo",
  "rocket", "razzo", "tank", "carro", "spaceship", "astronave", "bike", "moto",
  "bicycle", "bicicletta", "boat", "barca", "ship", "nave", "plane", "aereo",
  "helmet", "elmo", "armor", "armatura", "shield model",
]

const SOUND_KEYWORDS = [
  "sound", "sound effect", "sfx", "audio", "music", "musica", "suono", "suoni",
  "ambience", "ambient", "atmosfera", "footstep", "passi", "footsteps",
  "walking sound", "footstep sound", "background music", "bgm", "ost",
  "soundtrack", "colonna sonora", "sound design", "soundscape", "soundscape",
  "voice", "voce", "dialog", "dialogue", "dialogo", "announcer", "annuncio",
  "notification sound", "pickup sound", "coin sound", "moneta", "rumore",
  "noise", "rumori", "laser sound", "gunshot sound", "sparo suono", "win sound",
  "lose sound", "victory", "sconfitta", "level up sound", "tasto sound",
  "click sound", "button sound", "play sound", "suona", "suonare", "beep",
  "ding", "chime", "jingle", "fanfare", "record scratch", "whoosh sound",
  "explosion sound", "boom", "thud", "impact sound", "grunt", "groan", "roar",
  "roaring", "mistica", "bell", "campana", "drum", "batteria", "beat", "bass",
  "synth", "piano", "guitar", "chitarra", "violin", "orchestra", "choir", "coro",
  "heartbeat", "battito", "tick", "tock", "ticking", "wind", "vento", "rain",
  "pioggia", "thunder", "tuono", "storm", "tempesta", "fire crackle", "fuoco",
  "water", "acqua", "splash", "schizzo", "door sound", "porta", "creak",
  "scricchiolio", "alarm", "allarme", "siren", "sirena", "whistle", "fischio",
  "horn", "klakson", "engine", "motore", "vroom", "explosion rumble", "rumbling",
  "monster growl", "growl", "creature sound", "dinosaur roar", "dragon roar",
  "soundtrack theme", "theme music", "epic music", "dramatic music", "calm music",
  "lofi", "phonk", "synthwave", "sound layer", "sound layers", "mix", "mixing",
  "glass shatter", "break", "rotta", "step on", "ridge", "dirt", "grass", "legno",
  "wood", "concrete", "cemento", "metal sound", "metallo", "stone sound", "pietra",
]

// Words that unambiguously request a specific output mode — count double.
const STRONG_WORDS = new Set([
  "cinematic", "cinematica", "cinematografico", "cutscene", "cut-scene", "scena cinematografica",
  "trailer", "slow motion", "slow-mo", "slowmo", "camera shake", "screen shake", "freeze frame",
  "hitstop", "letterbox", "showcase",
  "animation", "animazione", "animate", "animare", "keyframe", "walkcycle",
  "vfx", "fx", "particle", "particles", "particella", "particelle", "effetto", "effetti",
  "sound", "sound effect", "sfx", "audio", "music", "musica", "soundtrack", "sound design",
  "bgm", "ost", "colonna sonora",
  "3d model", "build me", "build a", "construct", "costruisc", "weapon model", "item model", "shield model",
])

// Generic words that also appear in scripting/other contexts — count half so a
// single occurrence can't hijack the output mode ("model", "camera", "fire").
const AMBIGUOUS_WORDS = new Set([
  "model", "3d", "object", "asset",
  "camera", "cam", "shot", "angle", "scene", "scena", "intro", "flash",
  "lighting", "illuminazion", "fire", "heal", "speed", "boost", "energy", "aura",
  "water", "splash", "rain", "snow", "neve", "pioggia", "acqua", "vento", "fuoco", "coro", "moneta",
  "break", "mix",
])

const NEGATION_PHRASES = [
  "don't ", "dont ", "no ", "not ", "never ", "avoid ", "without ",
  "senza ", "non ", "niente ", "evita ",
]

const TYPE_PRIORITY = { cinematic: 0, model3d: 1, sound: 2, vfx: 3, animation: 4 }

function keywordWeight(k) {
  if (AMBIGUOUS_WORDS.has(k)) return 0.5
  if (STRONG_WORDS.has(k)) return 2
  // Compound/intent keywords that end in a mode morpheme ("explosion sound",
  // "gunshot sound", "sword model", "walk animation") are strong signals even
  // if not hand-listed above.
  if (/(animat|animation|animaz|cinematic|cinematica|cutscene|particle|particell|effett|sound|suono|audio|music|musica|vfx|sfx|model|modello|build|construct)\w*$/.test(k)) return 2
  return 1
}

export function detectRequestType(prompt, type) {
  if (type === "cinematic" || type === "animation" || type === "vfx" || type === "model3d" || type === "sound" || type === "game") {
    return type
  }

  const low = (" " + String(prompt || "") + " ").toLowerCase()

  const groups = [
    ["cinematic", CINEMATIC_KEYWORDS],
    ["model3d", MODEL3D_KEYWORDS],
    ["sound", SOUND_KEYWORDS],
    ["vfx", VFX_KEYWORDS],
    ["animation", ANIMATION_KEYWORDS],
  ]

  const scores = []

  for (const [cat, keywords] of groups) {
    let score = 0
    const sorted = keywords
      .map(k => k.toLowerCase())
      .filter(k => k.length >= 2)
      .sort((a, b) => b.length - a.length)
    // Track ranges already claimed by a longer keyword in this category so
    // substring overlaps ("cam" inside "camera") don't inflate the score.
    const covered = []
    for (const k of sorted) {
      const w = keywordWeight(k)
      let idx = low.indexOf(k)
      let found = false
      let negated = false
      while (idx !== -1) {
        const end = idx + k.length
        if (!covered.some(([s, e]) => idx >= s && end <= e)) {
          found = true
          if (NEGATION_PHRASES.some(np => low.slice(Math.max(0, idx - 20), idx).includes(np))) negated = true
        }
        idx = low.indexOf(k, idx + k.length)
      }
      if (found) score += negated ? -w : w
      idx = low.indexOf(k)
      while (idx !== -1) {
        covered.push([idx, idx + k.length])
        idx = low.indexOf(k, idx + k.length)
      }
    }
    scores.push({ cat, score })
  }

  scores.sort((a, b) => b.score - a.score || TYPE_PRIORITY[a.cat] - TYPE_PRIORITY[b.cat])
  const best = scores[0]
  return best && best.score >= 1 ? best.cat : "scripting"
}

export function isValidModel(model) {
  if (model === LOCAL_MODEL) return true
  if (model === TEAM_MODEL) return true
  if (ALL_MODELS.includes(model)) return true
  if (is3dModel(model)) return true
  return extraFrontierModels().includes(model)
}

// Requests that mean "build me a whole game / world" rather than one system,
// script or asset. When matched, the Creative Director pass expands the raw
// idea into a full multi-discipline brief and the build runs in FULL GAME KIT
// mode (big model, big token budget, art-director refinement).
const GAME_REQUEST_PATTERNS = [
  /\b(make|build|create|crea|creami|fammi|fai|fare|costruisc|voglio)\b[\s\S]{0,40}\b(game|gioco|world|mondo|roblox)\b/i,
  /\b(game|gioco)\b[\s\S]{0,30}\b(like|tipo|stile|come|simile|ispirato|inspired)\b/i,
  /\b(blox ?fruit|obbie|obby|tycoon|simulator|simulatore|survival|horror|rpg|mmo|mmorpg|roguelike|souls ?like|fighting game|open world|sandbox|platformer)\b/i,
  /\b(full|complete|intero|completo|starter|starting)\b[\s\S]{0,20}\b(game|gioco)\b/i,
]

export function isGameRequest(prompt) {
  const p = String(prompt || "")
  if (p.trim().length < 4) return false
  return GAME_REQUEST_PATTERNS.some(re => re.test(p))
}

// Obby / obstacle-course requests get a specialised focus: a real obby is a
// sequenced run of platforms with spawning, checkpoints and a goal — not an
// open-world game kit. Funnelling them through the FULL GAME KIT doctrine made
// the model split its fixed token budget across VFX/audio/cinematics, starving
// the actual obstacle layout (few platforms, lazy positioning, truncated build).
const OBBY_REQUEST_PATTERNS = [
  /\bobb(y|ie|ies|ys)\b/i,
  /\b(obstacle|jump)\s+course\b/i,
  /\bparkour\b/i,
  /\bpercorso\s+(?:a\s+|di\s+)?ostacoli\b/i,
  /\b(?:sviluppa|crea|fai|fammi|costruisci)\s+un\s+obby\b/i,
  /\bon?o\s+obby\b/i,
  /\bmini\s+obby\b/i,
]

export function isObbyRequest(prompt) {
  const p = String(prompt || "")
  if (p.trim().length < 3) return false
  return OBBY_REQUEST_PATTERNS.some(re => re.test(p))
}

// Creative Director pass: turn a short idea into a rich multi-discipline brief
// the generator can execute as a complete game. One bounded call; on any
// failure we fall back to the raw prompt so the pipeline never degrades.
export async function runDirector(prompt) {
  if ((!process.env.NVIDIA_API_KEY && !process.env.NVIDIA_GLM_API_KEY && !process.env.NVIDIA_GLM_FLASH_API_KEY && !process.env.LOCAL_LLM_URL) || !prompt || !String(prompt).trim()) return ""
  try {
    const { output } = await callNvidiaWithFallback(
      DIRECTOR_SYSTEM,
      [{ role: "user", content: String(prompt).trim() }],
      45000,
      // Keep briefs tight: a long creative brief inflates the main call's
      // ambition and pushes its JSON past the token budget.
      ANIMATION_MODEL,
      undefined,
      800
    )
    const brief = (output || "").trim()
    if (brief.length < 40) return ""
    console.log("[runDirector] brief generated — length:", brief.length)
    return brief
  } catch (e) {
    console.warn("[runDirector] failed — falling back to the raw prompt:", e.message)
    return ""
  }
}

const MAX_HISTORY_TURNS = 12

export function scanGameModelForKeywords(gameModel, keywords) {
  if (!gameModel || !keywords?.length) return []

  let parsed
  try {
    parsed = typeof gameModel === "string" ? JSON.parse(gameModel) : gameModel
  } catch {
    return []
  }

  const results = []

  const KEY_PROPS = new Set(["Position", "Size", "Color", "BrickColor", "Orientation", "CFrame", "SoundId", "MaxHealth", "WalkSpeed", "Anchored", "Velocity"])

  function pickProps(node) {
    const props = node.Properties || node.properties
    if (!props || typeof props !== "object") return null
    const picked = {}
    for (const [k, v] of Object.entries(props)) {
      if (KEY_PROPS.has(k)) picked[k] = v
    }
    return Object.keys(picked).length ? picked : null
  }

  function walk(node, path) {
    if (!node || typeof node !== "object") return

    const name = node.Name || node.name || ""
    const className = node.ClassName || node.className || ""
    const currentPath = path ? `${path}.${name}` : name

    if (name && keywords.some(kw => name.toLowerCase().includes(kw.toLowerCase()))) {
      const directChildren = (node.Children || node.children || [])
        .slice(0, 6)
        .map(c => c && (c.Name || c.name))
        .filter(Boolean)
      results.push({ path: currentPath, name, className, properties: pickProps(node), children: directChildren })
    }

    const children = node.Children || node.children || []
    if (Array.isArray(children)) {
      for (const child of children) walk(child, currentPath)
    }

    if (!Array.isArray(node)) {
      for (const [key, val] of Object.entries(node)) {
        if (
          val &&
          typeof val === "object" &&
          !Array.isArray(val) &&
          key !== "Properties" &&
          key !== "properties" &&
          key !== "Children" &&
          key !== "children"
        ) {
          walk(val, currentPath)
        }
      }
    }
  }

  walk(parsed, "")
  return results
}

export function extractKeywordsFromPrompt(prompt) {
  const stopWords = new Set([
    "the", "they", "when", "then", "want", "make", "have", "will", "should",
    "inside", "into", "with", "from", "that", "this", "player", "script",
    "touch", "reset", "add", "put", "create", "and", "for", "can", "also",
    "like", "just", "get", "set", "use", "give", "let", "run", "its", "all",
    "but", "not", "any", "are", "was", "had", "has", "been", "being", "their",
    "which", "would", "could", "should", "does", "did", "do", "an", "a", "of",
    "to", "in", "on", "at", "by", "if", "so", "or", "is", "it", "be", "as",
  ])

  return [
    ...new Set(
      prompt
        .split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z0-9_]/g, ""))
        .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()))
    ),
  ]
}

export function buildScanContext(gameModel, prompt) {
  if (!gameModel) return ""

  const keywords = extractKeywordsFromPrompt(prompt)
  const found = scanGameModelForKeywords(gameModel, keywords)

  if (!found.length) return ""

  const lines = found.map(i => {
    let line = `- "${i.name}" (${i.className}) → full path: game.${i.path}`
    if (i.properties && Object.keys(i.properties).length) {
      const props = Object.entries(i.properties)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(", ")
      line += ` | ${props}`
    }
    if (i.children && i.children.length) {
      line += ` | children: ${i.children.join(", ")}`
    }
    return line
  }).join("\n")

  return (
    `\n\n## Instances found in the game matching this request:\n${lines}\n\n` +
    `Use these exact paths when writing scripts. ` +
    `Where properties are listed (Position, Size, Color, etc.) use those REAL values in your code — ` +
    `never invent coordinates, sizes, or colors that differ from what the scan reports. ` +
    `If a script should live inside one of these instances, set its "parent" to the full path shown above ` +
    `(e.g. "Workspace.resetblock8"). The plugin will place the script there automatically.`
  )
}

export function summariseAssistantTurn(rawContent) {
  try {
    const d = JSON.parse(rawContent)

    if (d.type === "generation") {
      const parts = []
      if (d.title) parts.push(`Title: ${d.title}`)
      if (d.summary) parts.push(`Summary: ${d.summary}`)
      if (Array.isArray(d.animations) && d.animations.length) {
        for (const a of d.animations) {
          const name = a.name || "animation"
          const target = a.target || "auto"
          parts.push(`Animation (${name}) on ${target}: ${a.description || ""}`)
        }
      }
      if (Array.isArray(d.cinematics) && d.cinematics.length) {
        for (const c of d.cinematics) {
          parts.push(`Cinematic (${c.name || "scene"}): ${c.description || ""} — ${(c.shots || []).length} shots, ${(c.flashes || []).length} flashes, ${(c.sounds || []).length} sounds`)
        }
      }
      if (Array.isArray(d.audio) && d.audio.length) {
        for (const a of d.audio) {
          const kind = a.kind || "sfx"
          parts.push(`Audio (${kind}) ${a.name || "sound"}: ${a.description || ""} — volume ${a.volume ?? 0.8},${a.loop ? " looping" : " one-shot"}`)
        }
      }
      if (Array.isArray(d.scripts) && d.scripts.length) {
        for (const s of d.scripts) {
          const name = s.name || s.instanceName || "script"
          const code = s.code || s.source || ""
          if (code) parts.push(`Script (${name}):\n${code}`)
        }
      }
      return parts.join("\n\n") || rawContent
    }

    if (d.type === "clarification") return d.question || rawContent
    if (d.type === "chat") return d.message || rawContent

    return rawContent
  } catch {
    return rawContent
  }
}

export function buildMessages(system, userContent, history = [], images = []) {
  const recentHistory = (history || []).slice(-MAX_HISTORY_TURNS * 2)

  const historyMessages = []
  for (const msg of recentHistory) {
    const { role, content } = msg
    if (!content) continue

    if (role === "user") {
      historyMessages.push({ role: "user", content })
    } else if (role === "assistant") {
      historyMessages.push({ role: "assistant", content: summariseAssistantTurn(content) })
    }
  }

  // Trim ONLY the history against a fixed budget — never the current user
  // message. (Subtracting system.length from the cap went negative once the
  // system prompt grew past 48k chars, which silently truncated the ENTIRE
  // user request down to "" — the model then replied with a bare greeting.)
  const trimmedHistory = trimToCharLimit(historyMessages, MAX_CONVERSATION_CHARS)

  const messages = [...trimmedHistory]

  if (images && images.length > 0) {
    const content = [
      { type: "text", text: userContent || "Generate based on the attached images." },
      ...images.map(base64 => ({
        type: "image_url",
        image_url: { url: `data:image/png;base64,${base64}` }
      }))
    ]
    messages.push({ role: "user", content })
  } else {
    messages.push({ role: "user", content: userContent })
  }

  return { system, messages }
}

function trimToCharLimit(messages, maxChars) {
  const total = () => messages.reduce((sum, m) => sum + (m.content?.length || 0), 0)

  let droppedPairs = 0
  const startTotal = total()

  while (total() > maxChars && messages.length > 1) {
    if (messages[0].role === "user" && messages[1]?.role === "assistant") {
      messages.splice(0, 2)
      droppedPairs++
    } else {
      messages.splice(0, 1)
    }
  }

  if (droppedPairs > 0) {
    console.warn(
      `[trimToCharLimit] dropped ${droppedPairs} oldest turn(s) — ` +
      `started at ${startTotal} chars, cap is ${maxChars}. ` +
      `If this fires often, scripts are getting evicted from context — consider raising MAX_CONVERSATION_CHARS further.`
    )
  }

  if (total() > maxChars && messages.length) {
    const last = messages[messages.length - 1]
    const over = total() - maxChars
    last.content = last.content.slice(0, Math.max(0, last.content.length - over))
    console.warn(`[trimToCharLimit] truncated the current user message by ${over} chars to fit the cap.`)
  }

  return messages
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504])
const MAX_RETRIES = 1

async function callNvidia(system, messages, model = DEFAULT_MODEL, timeoutMs = 90000, maxTokens = MAX_TOKENS) {
  const isGlm = GLM_MODELS.includes(model)
  const isGlmFlash = model === "z-ai/glm-5.3-flash"
  const apiKey = isGlmFlash
    ? process.env.NVIDIA_GLM_FLASH_API_KEY || process.env.NVIDIA_GLM_API_KEY || process.env.NVIDIA_API_KEY
    : isGlm
      ? process.env.NVIDIA_GLM_API_KEY || process.env.NVIDIA_GLM_FLASH_API_KEY || process.env.NVIDIA_API_KEY
      : process.env.NVIDIA_API_KEY
  if (!apiKey) {
    const e = new Error("No NVIDIA API key configured.")
    e.isAuthError = true
    throw e
  }

  console.log("[callNvidia] model:", model, "messages:", messages.length)

  let attempts = 0

  while (true) {
    attempts++
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await client.chat.completions.create(
        {
          model,
          messages: [
            { role: "system", content: system },
            ...messages,
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
          top_p: 0.9,
          // Nemotron spends long stretches on hidden reasoning before any
          // content appears; disabling it sends the entire token budget to
          // the actual answer and keeps heavy builds inside Vercel's window.
          chat_template_kwargs: { thinking: false },
        },
        { headers: { authorization: `Bearer ${apiKey}` }, signal: controller.signal }
      )

      const output = res.choices?.[0]?.message?.content || ""

      console.log("[callNvidia] succeeded — output length:", output.length)
      return { output, reasoning: "" }
    } catch (e) {
      const isRateLimit = e.status === 429
      const isAuthError = e.status === 401 || e.status === 403

      // Transient failures (rate limits, 5xx) get short exponential backoff
      // before we burn through the fallback models.
      if ((isRateLimit || RETRYABLE_STATUS.has(e.status)) && attempts <= MAX_RETRIES) {
        const backoffMs = 1000 * 2 ** (attempts - 1)
        console.warn(
          `[callNvidia] transient failure on ${model} (attempt ${attempts}/${MAX_RETRIES + 1}), retrying in ${backoffMs}ms`
        )
        await new Promise((r) => setTimeout(r, backoffMs))
        continue
      }

      const isAbort =
        e.name === "AbortError" ||
        e.constructor?.name === "APIUserAbortError" ||
        (typeof e.message === "string" && /aborted|abort/i.test(e.message))
      if (isAbort) {
        const timeoutErr = new Error(`NVIDIA request to model ${model} timed out after ${timeoutMs}ms`)
        timeoutErr.isTimeout = true
        throw timeoutErr
      }

      console.error(`[callNvidia] model ${model} failed:`, e.message)
      const err = new Error(`NVIDIA returned ${e.status || "error"}: ${e.message}`)
      err.isRateLimit = isRateLimit
      err.isAuthError = isAuthError
      err.status = e.status
      throw err
    } finally {
      clearTimeout(timer)
    }
  }
}

// ── Provider layer ─────────────────────────────────────────────────────────
// Frontier providers come first whenever their key is configured: the router
// below picks a backend from the model id (claude-* → Anthropic, gpt-*/o* →
// OpenAI, gemini-* → Google, anything else → NVIDIA). Every backend returns
// { output, reasoning } and raises errors with .status / .isAuthError /
// .isRateLimit so the shared fallback loop handles them uniformly.

function providerKeyError(name, envVar) {
  const e = new Error(`${name} not configured — ${envVar} is missing. Skipping this model.`)
  e.status = 0
  return e
}

function providerHttpError(name, status, message) {
  const e = new Error(`${name} returned ${status}: ${message || "no body"}`)
  e.status = status
  e.isRateLimit = status === 429
  e.isAuthError = status === 401 || status === 403
  return e
}

async function callAnthropic(system, messages, model, timeoutMs, maxTokens) {
  if (!process.env.ANTHROPIC_API_KEY) throw providerKeyError("Anthropic", "ANTHROPIC_API_KEY")
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, temperature: 0.7, top_p: 0.9, messages }),
    signal: AbortSignal.timeout(timeoutMs ?? 90000),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw providerHttpError("Anthropic", res.status, data?.error?.message || res.statusText)
  const output = (data?.content || []).filter(b => b.type === "text").map(b => b.text).join("")
  if (!output) throw new Error("Anthropic returned empty output")
  return { output, reasoning: "" }
}

async function callOpenAI(system, messages, model, timeoutMs, maxTokens) {
  if (!process.env.OPENAI_API_KEY) throw providerKeyError("OpenAI", "OPENAI_API_KEY")
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens: maxTokens,
      temperature: 0.7,
      top_p: 0.9,
    }),
    signal: AbortSignal.timeout(timeoutMs ?? 90000),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw providerHttpError("OpenAI", res.status, data?.error?.message || res.statusText)
  const output = data?.choices?.[0]?.message?.content || ""
  if (!output) throw new Error("OpenAI returned empty output")
  return { output, reasoning: "" }
}

async function callGemini(system, messages, model, timeoutMs, maxTokens) {
  if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) throw providerKeyError("Gemini", "GOOGLE_API_KEY")
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
  const contents = (messages || []).map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content || "") }],
  }))
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: maxTokens },
      }),
      signal: AbortSignal.timeout(timeoutMs ?? 90000),
    }
  )
  const data = await res.json().catch(() => null)
  if (!res.ok) throw providerHttpError("Gemini", res.status, data?.error?.message || res.statusText)
  const output = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("")
  if (!output) throw new Error("Gemini returned empty output")
  return { output, reasoning: "" }
}

// Bundled desktop model (llama.cpp sidecar exposing an OpenAI-compatible
// /v1/chat/completions). Used when the user has no API key: zero-friction
// out-of-the-box generations. The shared fallback deadline already bounds it.
async function callLocal(system, messages, model, timeoutMs = 150000, maxTokens = MAX_TOKENS) {
  const base = (process.env.LOCAL_LLM_URL || "").replace(/\/+$/, "")
  if (!base) throw new Error("Local model not configured — LOCAL_LLM_URL is missing.")
  const tMs = timeoutMs || 150000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), tMs)
  try {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.LOCAL_LLM_MODEL || "qwen3-8b",
        messages: [{ role: "system", content: system }, ...messages],
        max_tokens: maxTokens || MAX_TOKENS,
        temperature: 0.2,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`Local model HTTP ${res.status}: ${detail.slice(0, 140)}`)
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error("Local model returned an empty completion.")
    return { output: content, reasoning: "" }
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`Local model timed out after ${Math.round(tMs / 1000)}s.`)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

const USD_BRIEF_SYSTEM = `You are the 3D art director of a game engine. The user asks for a single 3D model.
Produce ONE compact JSON object, no markdown, with EXACTLY these fields:
{
  "name": "short lowercase slug for an asset folder (letters, digits, dashes)",
  "category": "weapon|vehicle|prop|character|building|creature|environment",
  "title": "human-readable title in English (max 5 words)",
  "summary": "one short English sentence describing the object (max 15 words)",
  "prompt3d": "a detailed English text-to-3D prompt (80-200 words): real-world material, silhouette, proportions, structural details and the PBR feel (metal/rough/glossy/wood/stone/glass). Describe ONLY the single object, centered, watertight, no scene, no background, no other characters."
}
If the request is ambiguous, pick a sensible default. The "prompt3d" must be fully self-contained for a text-to-3D generator.`

// The LLM half of the "Hunyuan+Qwen" single agent: whatever text LLM is live
// (local Qwen, NVIDIA, frontier, ...) turns the user's request into the exact
// single-object spec Hunyuan needs before the local Hunyuan server builds.
async function request3dBrief(prompt) {
  try {
    const { output } = await callNvidiaWithFallback(
      USD_BRIEF_SYSTEM,
      [{ role: "user", content: String(prompt || "").trim() }],
      60000,
      currentPrimaryModel(),
      [LOCAL_MODEL, "nvidia/nemotron-3.5-lightning-30b-a3b", "z-ai/glm-5.3-flash"],
      1200
    )
    const parsed = extractJson(output)
    if (parsed && typeof parsed.prompt3d === "string" && parsed.prompt3d.trim().length > 20) {
      const name = String(parsed.name || "asset").replace(/[^a-z0-9_\-]+/gi, "-").toLowerCase().replace(/^-+|-+$/g, "") || "asset"
      return {
        name,
        title: String(parsed.title || "3D asset").slice(0, 80),
        summary: String(parsed.summary || "").slice(0, 160),
        prompt3d: parsed.prompt3d.trim(),
        category: String(parsed.category || "prop"),
      }
    }
  } catch (e) { console.warn("[request3dBrief] failed — using the raw prompt:", e.message) }
  return { name: "asset", title: "3D asset", summary: "", prompt3d: String(prompt || "").trim(), category: "prop" }
}

// Stable contract with the local 3D servers (a pack wrapper exposes POST
// /health and POST /generate). Both run on the user's machine — zero cost.
async function callLocal3dServer(base, payload) {
  if (!base) {
    const e = new Error("3D local server not configured.")
    e.is3dUnavailable = true
    throw e
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 285000)
  try {
    const res = await fetch(`${base}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      const e = new Error(`3D server HTTP ${res.status}: ${detail.slice(0, 160)}`)
      e.is3dUnavailable = true
      throw e
    }
    const data = await res.json().catch(() => null)
    if (!data || !Array.isArray(data.files) || data.files.length === 0) {
      const e = new Error("3D server returned no files.")
      e.is3dUnavailable = true
      throw e
    }
    return data
  } catch (e) {
    if (e.name === "AbortError") {
      const err = new Error("3D generation timed out after ~4.5 minutes.")
      err.is3dUnavailable = true
      throw err
    }
    throw e
  } finally { clearTimeout(timer) }
}

const FRIENDLY_3D_NAMES = { [HUNYUAN_MODEL]: "Hunyuan3D 2.1", [TRELLIS_MODEL]: "TRELLIS 2" }

// The combined Hunyuan+Qwen agent (blueprint → mesh) and the standalone
// TRELLIS fast path (reference image → mesh). Returns the asset3d payload the
// client saves as an assistant message; the mesh file is on the local server.
export async function generateAsset3d({ model, prompt, images = [] }) {
  const base = has3dBackend(model)
  if (!base) throw new Error(`Model ${model} has no local backend.`)
  const engine = FRIENDLY_3D_NAMES[model] || model
  if (model === TRELLIS_MODEL && (!images || images.length === 0)) {
    const e = new Error("TRELLIS 2 is image-to-3D — attach a reference image to the request.")
    e.is3dUnavailable = true
    throw e
  }
  const t0 = Date.now()
  const brief = await request3dBrief(prompt)
  const payload = model === TRELLIS_MODEL
    ? { engine: "trellis-2", images }
    : { engine: "hunyuan3d-2.1", prompt: brief.prompt3d, name: brief.name, category: brief.category, pbr: true }
  const data = await callLocal3dServer(base, payload)
  const validFiles = (data.files || []).filter((f) => (f?.sizeBytes || 0) > 0 || (f?.url || f?.path))
  if (validFiles.length === 0) { const e = new Error("3D server returned empty/corrupt mesh files."); e.is3dUnavailable = true; throw e }
  data.files = validFiles
  const seconds = Math.round((Date.now() - t0) / 1000)
  const prefix = model === TRELLIS_MODEL ? "trellis" : "hunyuan"
  const files = (data.files || []).map((f, i) => ({
    name: f?.name || `${prefix}-${brief.name || i + 1}.${f?.format || "obj"}`,
    url: f?.url || f?.path || "",
    path: f?.path || "",
    format: f?.format || "obj",
    sizeBytes: f?.sizeBytes || 0,
  }))
  return {
    type: "asset3d",
    title: brief.title || "Modello 3D generato",
    summary: brief.summary || `Modello 3D generato in locale (${engine})`,
    asset: { name: brief.name || "asset", engine: model, format: files[0]?.format || "obj", files, prompt3d: brief.prompt3d, seconds, pbr: model !== TRELLIS_MODEL },
    __model: model,
    __provider: "local-3d",
  }
}

function callByModel(system, messages, model, timeoutMs, maxTokens) {
  if (model.startsWith("local/")) return callLocal(system, messages, model, timeoutMs, maxTokens)
  if (model.startsWith("claude-")) return callAnthropic(system, messages, model, timeoutMs, maxTokens)
  if (model.startsWith("gpt-") || model.startsWith("o3") || model.startsWith("o4")) return callOpenAI(system, messages, model, timeoutMs, maxTokens)
  if (model.startsWith("gemini-")) return callGemini(system, messages, model, timeoutMs, maxTokens)
  return callNvidia(system, messages, model, timeoutMs, maxTokens)
}

function hasAnyProviderKey() {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.NVIDIA_API_KEY || process.env.NVIDIA_GLM_API_KEY || process.env.NVIDIA_GLM_FLASH_API_KEY || process.env.LOCAL_LLM_URL)
}

export async function callNvidiaWithFallback(system, messages, timeoutMs = 90000, preferredModel, fallbackModels = FALLBACK_ORDER, maxTokens = MAX_TOKENS) {
  if (!hasAnyProviderKey()) {
    throw new Error(
      "No AI provider key configured. Set at least one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, NVIDIA_API_KEY."
    )
  }

  // "vexa-team" and "local/qwen3-8b" are UI-facing aliases, not provider ids.
  // Passing them as preferredModel burned the whole budget on a skip (it also
  // broke out of the loop), so generation failed even with working keys.
  if (preferredModel === TEAM_MODEL || preferredModel === LOCAL_MODEL) preferredModel = undefined

  let modelOrder = preferredModel
    ? [preferredModel, ...fallbackModels.filter(m => m !== preferredModel)]
    : fallbackModels

  // Frontier-only setups (no NVIDIA key): fixed NVIDIA ids in the chain (e.g.
  // STEPS_MODEL/THINKING_MODEL) could never succeed — repoint the whole order
  // at the configured frontier provider so those passes keep working instead
  // of degrading to errors.
  const hasFrontierKey = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY)
  if (hasFrontierKey && !process.env.NVIDIA_API_KEY) {
    const primary = currentPrimaryModel()
    if (!primary.startsWith("nvidia/")) {
      const candidates = []
      if (process.env.ANTHROPIC_API_KEY) candidates.push("claude-sonnet-4-5")
      if (process.env.OPENAI_API_KEY) candidates.push("gpt-5")
      if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) candidates.push("gemini-2.5-pro")
      const frontierOrder = [primary, ...candidates.filter(m => m !== primary)]
      if (frontierOrder.length > 0) modelOrder = frontierOrder
    }
  }

  // Zero-key setup: run the bundled local open-source model so the desktop app
  // works right after install, no signup. When cloud keys exist, the local
  // model only becomes the ultimate last-resort fallback.
  const hasNvidiaKey = !!(process.env.NVIDIA_API_KEY || process.env.NVIDIA_GLM_API_KEY || process.env.NVIDIA_GLM_FLASH_API_KEY)
  if (process.env.LOCAL_LLM_URL) {
    if (!hasFrontierKey && !hasNvidiaKey) {
      modelOrder = [LOCAL_MODEL]
    } else if (!modelOrder.includes(LOCAL_MODEL)) {
      modelOrder = [...modelOrder, LOCAL_MODEL]
    }
  }

  let lastError
  // timeoutMs is the TOTAL budget shared across every fallback attempt —
  // otherwise a timed-out primary followed by full-length fallback calls
  // blows through the serverless function limit.
  const deadline = Date.now() + timeoutMs

  for (let i = 0; i < modelOrder.length; i++) {
    const model = modelOrder[i]
    const left = deadline - Date.now()
    // Give every remaining fallback a guaranteed ~30s slice, so a primary that
    // burns the whole budget no longer starves the rest of the chain.
    const remainingModels = modelOrder.length - i
    const reserve = (remainingModels - 1) * 30000
    // Never let one slow primary eat the whole budget: cap it at 120s so the
    // remaining models still get a real chance (NVIDIA sometimes stalls a model).
    const attempt = remainingModels > 1 ? Math.min(left - reserve, 120000) : left - reserve
    if (attempt < 20000) {
      console.warn(`[callNvidiaWithFallback] skipping "${model}" — only ${Math.round(left / 1000)}s of budget left (${remainingModels - 1} fallbacks to keep ~30s each)`)
      break
    }
    const attemptMs = Math.max(attempt, 20000)
    try {
      console.log(`[callNvidiaWithFallback] trying model "${model}" (${Math.round(attemptMs / 1000)}s budget)`)
      const { output, reasoning } = await callByModel(system, messages, model, attemptMs, maxTokens)
      if (output) {
        return { output, reasoning, model, fellBack: model !== preferredModel }
      }
      console.warn(`[callNvidiaWithFallback] model ${model} returned empty, trying next...`)
    } catch (e) {
      console.warn(`[callNvidiaWithFallback] model ${model} failed:`, e.message)
      lastError = e
      // Bad credentials won't get better on the next model — fail fast.
      if (e.isAuthError) break
      continue
    }
  }

  throw new Error(`All model attempts failed.${lastError ? " Last error: " + lastError.message : ""}`)
}

export function repairJson(partial) {
  const start = partial.indexOf("{")
  if (start === -1) return partial
  const text = partial.slice(start)

  let inString = false
  let escapeNext = false
  const stack = []

  for (const ch of text) {
    if (escapeNext) { escapeNext = false; continue }
    if (ch === "\\" && inString) { escapeNext = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === "{" || ch === "[") stack.push(ch)
    else if (ch === "}" && stack.at(-1) === "{") stack.pop()
    else if (ch === "]" && stack.at(-1) === "[") stack.pop()
  }

  let closing = inString ? '"' : ""
  for (const opener of [...stack].reverse()) {
    closing += opener === "{" ? "}" : "]"
  }

  return text + closing
}

// Truncated outputs usually die mid-array ("..."opacity": 0.8,) — plain bracket
// closing can't fix that. Walk back through safe structural cut points
// (commas/closing brackets outside strings) and retry a closed parse at each;
// keep the largest prefix that parses.
// LLM JSON often contains UNESCAPED quotes inside string values (Luau code:
// print("hi"), multi-line scripts with raw newlines). Once the scanner drifts,
// every downstream parse fails. This pass re-derives true string boundaries:
// a quote only CLOSES a string if what follows looks structural (: , } ] or
// whitespace/EOL); otherwise it is literal content and gets escaped. Raw
// control characters inside strings are escaped too.
function repairStructuralQuotes(text) {
  let out = ""
  let i = 0
  const n = text.length
  let inStr = false
  while (i < n) {
    const ch = text[i]
    if (!inStr) {
      if (ch === '"') { inStr = true; out += ch; i++; continue }
      out += ch; i++; continue
    }
    // inside a string
    if (ch === "\\") {
      // keep valid escapes; drop useless escapes of ordinary chars
      const nxt = text[i + 1]
      if (nxt !== undefined && '"\\/bfnrtu'.includes(nxt)) { out += ch + nxt; i += 2 }
      else { out += "\\\\" + (nxt ?? ""); i += 1 + (nxt === undefined ? 0 : 1) }
      continue
    }
    if (ch === '"') {
      // decide: closing quote or embedded literal?
      let j = i + 1
      while (j < n && /\s/.test(text[j])) j++
      const nxt = j < n ? text[j] : ""
      if (nxt === "" || ":,}]".includes(nxt)) {
        // structural follow-up -> genuine close (newline counts via /\s/)
        inStr = false
        out += ch
        i++
        continue
      }
      // another '"' immediately after ("") also reads as close+open of empty
      if (nxt === '"') { inStr = false; out += ch; i++; continue }
      out += '\\"'
      i++
      continue
    }
    if (ch === "\n") { out += "\\n"; i++; continue }
    if (ch === "\r") { out += "\\r"; i++; continue }
    if (ch === "\t") { out += "\\t"; i++; continue }
    if (ch.charCodeAt(0) < 32) { out += " "; i++; continue }
    out += ch
    i++
  }
  return out
}

function salvageTruncatedJson(text) {
  const start = text.indexOf("{")
  if (start === -1) return null
  const body = text.slice(start)

  const cuts = []
  let inStr = false
  let esc = false
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (esc) { esc = false; continue }
    if (ch === "\\") { if (inStr) esc = true; continue }
    if (ch === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (ch === "," || ch === "}" || ch === "]") cuts.push(i)
  }

  // Wide sweep: sample up to 400 cut points across the WHOLE document,
  // newest first — early breakage no longer hides older valid prefixes.
  const MAX_ATTEMPTS = 400
  const stride = Math.max(1, Math.ceil(cuts.length / MAX_ATTEMPTS))
  for (let k = cuts.length - 1; k >= 0; k -= stride) {
    let candidate = body.slice(0, cuts[k] + 1).replace(/[,\s]+$/, "")
    try {
      const obj = JSON.parse(candidate + closingSuffixFor(candidate))
      if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj
    } catch {}
  }
  return null

}

function closingSuffixFor(text) {
  let inString = false
  let esc = false
  const stack = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (esc) { esc = false; continue }
    if (ch === "\\") { if (inString) esc = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === "{" || ch === "[") stack.push(ch)
    else if (ch === "}" && stack.at(-1) === "{") stack.pop()
    else if (ch === "]" && stack.at(-1) === "[") stack.pop()
  }
  let suffix = inString ? '"' : ""
  for (const opener of [...stack].reverse()) {
    suffix += opener === "{" ? "}" : "]"
  }
  return suffix
}

// Models occasionally emit bare Roblox literals ("Font": Enum.Font.GothamBold,
// "TextColor3": Color3.new(0.2, 0.6, 1)) which are invalid JSON. Quote them —
// outside strings only, so real string values are never touched.
function sanitiseBareRobloxLiterals(text) {
  const RE = /(\b(?:Enum\.[A-Za-z0-9_.]+|(?:Vector3|Vector2|Color3|CFrame|UDim2|UDim|NumberRange|NumberSequence|BrickColor)\.(?:new|fromRGB|fromHSV|palette)\([^()]*\)))/g
  let out = ""
  let inStr = false
  let esc = false
  let segStart = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (esc) { esc = false; continue }
    if (ch === "\\") { if (inStr) esc = true; continue }
    if (ch === '"') {
      if (!inStr) {
        out += text.slice(segStart, i).replace(RE, m => '"' + m + '"') + '"'
      } else {
        out += text.slice(segStart, i + 1)
      }
      segStart = i + 1
      inStr = !inStr
    }
  }
  if (segStart < text.length) {
    const tail = inStr ? text.slice(segStart) : text.slice(segStart).replace(RE, m => '"' + m + '"')
    out += tail
  }
  return out
}

export function extractJson(raw) {
  console.log("[extractJson] raw length:", raw.length)
  let text = raw.trim()
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim()
  text = sanitiseBareRobloxLiterals(text)

  try {
    const result = JSON.parse(text)
    console.log("[extractJson] direct parse succeeded")
    return result
  } catch {}

  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start !== -1 && end > start) {
    try {
      const result = JSON.parse(text.slice(start, end + 1))
      console.log("[extractJson] slice parse succeeded")
      return result
    } catch {}
  }

  // Structural repair: re-derive string boundaries (unescaped quotes/newlines
  // in Luau code corrupt naive scanning) and retry the cheap strategies.
  let clean = null
  try {
    clean = repairStructuralQuotes(text)
    if (clean && clean !== text) {
      const result = JSON.parse(clean)
      console.log("[extractJson] structural-repair parse succeeded")
      result.__repaired = true
      return result
    }
  } catch {}

  try {
    const result = JSON.parse(repairJson(text))
    result.__repaired = true
    console.log("[extractJson] repair parse succeeded")
    return result
  } catch {}

  // Truncated mid-token (finish_reason "length"): recover the largest complete
  // prefix instead of throwing the whole build away. Prefer salvaging the
  // structurally-repaired text — its cut points are trustworthy even when the
  // original contained unescaped quotes; fall back to the raw text.
  if (clean && clean !== text) {
    try {
      const salvaged = salvageTruncatedJson(clean)
      if (salvaged && salvaged.type) {
        salvaged.__repaired = true
        console.log("[extractJson] salvage-after-structural-repair succeeded — type:", salvaged.type)
        return salvaged
      }
    } catch {}
  }
  try {
    const salvaged = salvageTruncatedJson(text)
    if (salvaged && salvaged.type) {
      salvaged.__repaired = true
      console.log("[extractJson] salvage parse succeeded — type:", salvaged.type)
      return salvaged
    }
  } catch {}

  console.error("[extractJson] all strategies failed — raw sample:", raw.slice(0, 300))
  return {
    type: "chat",
    message: "Something went wrong parsing the response. Please try again.",
    __parse_failed: true,
  }
}

export function buildContext(projectName, datamodel, gameModel) {
  const parts = []

  if (projectName) parts.push(`Project name: ${projectName}`)

  if (datamodel && Object.keys(datamodel).length > 0) {
    parts.push("\n## DataModel snapshot (from Studio plugin)")
    for (const [service, children] of Object.entries(datamodel)) {
      const list = Array.isArray(children) ? children.slice(0, 20) : []
      parts.push(list.length ? `- ${service}: ${list.join(", ")}` : `- ${service}: (empty)`)
    }
  }

  if (gameModel) {
    try {
      const parsed = JSON.parse(gameModel)
      let compact = JSON.stringify(parsed)
      if (compact.length > 6000) compact = compact.slice(0, 6000) + "... (truncated)"
      parts.push(`\n## Full game model JSON\n${compact}`)
    } catch {}
  }

  return parts.join("\n")
}

function easeInOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

function applyAnticipationSettle(keyframes) {
  if (keyframes.length < 3) return keyframes
  const first = keyframes[0]
  const last = keyframes[keyframes.length - 1]

  // Add anticipation before first major pose: slight reverse motion
  if (first.poses) {
    const anticipPoses = {}
    for (const [bone, pose] of Object.entries(first.poses)) {
      if (typeof pose === "object" && pose.euler) {
        anticipPoses[bone] = {
          euler: pose.euler.map(v => Math.max(-180, Math.min(180, v * 0.1)))
        }
      }
    }
    keyframes.unshift({ ...first, poses: anticipPoses, time: first.time - 0.1, ease: "out" })
  }

  // Add settle after last pose: small oscillations
  if (last.poses) {
    const settlePoses = {}
    for (const [bone, pose] of Object.entries(last.poses)) {
      if (typeof pose === "object" && pose.euler) {
        settlePoses[bone] = {
          euler: pose.euler.map(v => Math.max(-180, Math.min(180, v * 0.2)))
        }
      }
    }
    keyframes.push({ ...last, poses: settlePoses, time: last.time + 0.2, ease: "in" })
  }

  return keyframes
}

function addArcInterpolation(keyframes) {
  if (keyframes.length < 2) return keyframes
  const result = [keyframes[0]]

  for (let i = 1; i < keyframes.length; i++) {
    const prev = keyframes[i - 1]
    const curr = keyframes[i]

    result.push(curr)

    // Add arc control point between keyframes for joint chains
    if (i < keyframes.length - 1) {
      const next = keyframes[i + 1]
      if (!prev.poses || !curr.poses || !next.poses) continue

      // Find common bones and add arc intermediate pose
      const commonBones = Object.keys(prev.poses).filter(b => curr.poses[b] && next.poses[b])
      for (const bone of commonBones) {
        const prevEuler = typeof prev.poses[bone].euler === "object" ? prev.poses[bone].euler : [0, 0, 0]
        const currEuler = typeof curr.poses[bone].euler === "object" ? curr.poses[bone].euler : [0, 0, 0]
        const nextEuler = typeof next.poses[bone].euler === "object" ? next.poses[bone].euler : [0, 0, 0]

        // Simple arc: midpoint pose between prev and next with eased offset
        const midEuler = currEuler.map((v, idx) => {
          const avg = (prevEuler[idx] + nextEuler[idx]) / 2
          return Math.max(-180, Math.min(180, avg + (Math.random() - 0.5) * 10))
        })

        // Insert arc pose just before current keyframe
        const insertPos = result.length - 1
        result.splice(insertPos, 0, {
          ...curr,
          poses: { ...(result[insertPos]?.poses || {}), [bone]: { euler: midEuler } },
          time: curr.time - 0.05,
          ease: "inout"
        })
      }
    }
  }

  return result
}

function polishAnimations(animations) {
  if (!Array.isArray(animations) || animations.length === 0) return
  for (const anim of animations) {
    if (!anim || !Array.isArray(anim.keyframes)) continue
    anim.keyframes = anim.keyframes
      .filter(k => k && typeof k.time === "number" && k.poses && typeof k.poses === "object")
      .sort((a, b) => a.time - b.time)

    // Apply anticipation and settle
    anim.keyframes = applyAnticipationSettle(anim.keyframes, 60)

    for (const k of anim.keyframes) {
      // Advanced easing selection based on keyframe position
      if (!k.ease) {
        const totalDuration = anim.keyframes[anim.keyframes.length - 1].time
        const t = k.time / totalDuration
        if (t < 0.3) k.ease = easeInOutCubic(t) > 0.5 ? "in" : "out"
        else if (t > 0.7) k.ease = easeOutCubic(1 - t) > 0.5 ? "out" : "in"
        else k.ease = "inout"
      }

      for (const bone of Object.keys(k.poses || {})) {
        const e = k.poses[bone]?.euler
        if (Array.isArray(e)) {
          k.poses[bone].euler = e.map(v =>
            typeof v === "number" ? Math.max(-180, Math.min(180, v)) : 0
          )
        }
      }
    }

    // Add arc interpolation for smoother joint motion
    anim.keyframes = addArcInterpolation(anim.keyframes)

    if (anim.loop === true && anim.keyframes.length > 1) {
      const first = anim.keyframes[0]
      const last = anim.keyframes[anim.keyframes.length - 1]
      if (last.time > first.time) {
        last.poses = JSON.parse(JSON.stringify(first.poses))
        if (!last.ease || last.ease === "in") last.ease = "inout"
      }
    }
    const duration = anim.keyframes.length ? anim.keyframes[anim.keyframes.length - 1].time : 0
    if (anim.keyframes.length < 5) {
      if (!anim.warnings) anim.warnings = []
      anim.warnings.push(
        `Low keyframe count (${anim.keyframes.length} over ${duration.toFixed(1)}s) — smoothness may suffer.`
      )
    }
    const joints = new Set()
    for (const k of anim.keyframes) for (const b of Object.keys(k.poses || {})) joints.add(b)
    if (joints.size > 0 && joints.size < 3) {
      if (!anim.warnings) anim.warnings = []
      anim.warnings.push(
        `Only ${joints.size} joint(s) animated (${[...joints].join(", ")}) — secondary motion may be missing.`
      )
    }
    if (anim.move) anim.move = anim.move.slice(0, 3).map(v => (typeof v === "number" ? v : 0))
  }
}

function polishCinematics(cinematics) {
  if (!Array.isArray(cinematics) || cinematics.length === 0) return
  const clamp = (v, lo, hi) => (typeof v === "number" ? Math.max(lo, Math.min(hi, v)) : lo)
  const vec3 = (v) => {
    if (!Array.isArray(v)) return [0, 0, 0]
    return v.slice(0, 3).map(x => (typeof x === "number" ? x : 0))
  }
  const color = (v) => {
    if (!Array.isArray(v)) return [255, 255, 255]
    return v.slice(0, 3).map(x => Math.round(clamp(typeof x === "number" ? x : 255, 0, 255)))
  }
  const easeWhitelist = ["in", "out", "inout", "linear", "expoin", "expoout", "backin", "backout"]
  for (const c of cinematics) {
    if (!c || typeof c !== "object") continue
    if (c.name) c.name = String(c.name).replace(/[^A-Za-z0-9_]/g, "")
    c.duration = clamp(c.duration, 0, 30)
    c.loop = c.loop === true
    c.trigger = c.trigger === "remote" ? "remote" : "start"
    const shots = Array.isArray(c.shots) ? c.shots : []
    const flashes = Array.isArray(c.flashes) ? c.flashes : []
    const lighting = Array.isArray(c.lighting) ? c.lighting : []
    for (const s of shots) {
      if (!s || typeof s !== "object") continue
      s.time = clamp(s.time, 0, 30)
      s.duration = clamp(s.duration, 0.05, 10)
      s.pos = vec3(s.pos)
      s.lookAt = vec3(s.lookAt)
      s.fov = clamp(s.fov, 30, 120)
      s.shake = clamp(s.shake, 0, 3)
      s.shakeFreq = clamp(s.shakeFreq, 0, 30)
      s.roll = clamp(s.roll, -45, 45)
      s.ease = easeWhitelist.includes(s.ease) ? s.ease : "inout"
      s.cut = s.cut === true
      s.orbit = s.orbit === true
      s.orbitSpeed = clamp(s.orbitSpeed, 0.1, 360)
      s.follow = typeof s.follow === "string" ? s.follow : s.follow === true
      if (s.targetOffset) s.targetOffset = vec3(s.targetOffset)
    }
    shots.sort((a, b) => (a.time || 0) - (b.time || 0))
    for (const f of flashes) {
      if (!f || typeof f !== "object") continue
      f.time = clamp(f.time, 0, 30)
      f.duration = clamp(f.duration, 0.02, 1)
      f.color = color(f.color)
      f.opacity = clamp(f.opacity, 0, 1)
      f.ease = easeWhitelist.includes(f.ease) ? f.ease : "inout"
    }
    for (const l of lighting) {
      if (!l || typeof l !== "object") continue
      l.time = clamp(l.time, 0, 30)
      l.duration = clamp(l.duration, 0, 10)
      if (l.brightness != null) l.brightness = clamp(l.brightness, 0, 5)
      if (l.ambient) l.ambient = color(l.ambient)
      if (l.outdoorAmbient) l.outdoorAmbient = color(l.outdoorAmbient)
      if (l.fogEnd != null) l.fogEnd = clamp(l.fogEnd, 0, 1000)
      if (l.clockTime != null) l.clockTime = clamp(l.clockTime, 0, 24)
    }
    lighting.sort((a, b) => (a.time || 0) - (b.time || 0))
    // slowmo[] — hitstop / slow-motion punches
    c.slowmo = (Array.isArray(c.slowmo) ? c.slowmo : []).filter(
      s => s && typeof s === "object" && typeof s.timescale === "number"
    )
    for (const s of c.slowmo) {
      s.time = clamp(s.time, 0, 30)
      s.duration = clamp(s.duration, 0.02, 5)
      s.timescale = clamp(s.timescale, 0.02, 1)
    }
    c.slowmo.sort((a, b) => (a.time || 0) - (b.time || 0))
    // post[] — color grading / bloom / depth-of-field
    c.post = (Array.isArray(c.post) ? c.post : []).filter(
      p => p && typeof p === "object" && ["color", "bloom", "dof"].includes(p.effect)
    )
    for (const p of c.post) {
      p.time = clamp(p.time, 0, 30)
      p.duration = clamp(p.duration, 0.02, 10)
      p.hold = p.hold === true
      p.easing = ["linear", "quad", "quart", "quint", "sine", "expo", "back", "bounce", "elastic"].includes(p.easing) ? p.easing : "quad"
      for (const k of ["saturation", "contrast", "brightness"]) if (p[k] != null) p[k] = clamp(p[k], -2, 2)
      for (const k of ["threshold", "intensity"]) if (p[k] != null) p[k] = clamp(p[k], 0, 10)
      if (p.size != null) p.size = clamp(p.size, 0, 100)
      if (p.focalDistance != null) p.focalDistance = clamp(p.focalDistance, 0, 1000)
      if (p.focalLength != null) p.focalLength = clamp(p.focalLength, 0, 500)
      if (p.aperture != null) p.aperture = clamp(p.aperture, 0, 20)
      if (p.focusRadius != null) p.focusRadius = clamp(p.focusRadius, 0, 100)
      if (p.tint) p.tint = color(p.tint)
    }
    c.post.sort((a, b) => (a.time || 0) - (b.time || 0))
    // bars[] — letterbox framing
    c.bars = (Array.isArray(c.bars) ? c.bars : []).filter(
      b => b && typeof b === "object"
    )
    for (const b of c.bars) {
      b.time = clamp(b.time, 0, 30)
      b.duration = clamp(b.duration, 0.1, 5)
      b.amount = clamp(b.amount, 0, 0.4)
    }
    c.bars.sort((a, b) => (a.time || 0) - (b.time || 0))
    // vignette[] — edge darkening
    c.vignette = (Array.isArray(c.vignette) ? c.vignette : []).filter(
      v => v && typeof v === "object"
    )
    for (const v of c.vignette) {
      v.time = clamp(v.time, 0, 30)
      v.duration = clamp(v.duration, 0.1, 5)
      v.amount = clamp(v.amount, 0, 1)
      if (v.color) v.color = color(v.color)
    }
    c.vignette.sort((a, b) => (a.time || 0) - (b.time || 0))
    // events[] — fire a RemoteEvent to the server on the scene clock
    c.events = (Array.isArray(c.events) ? c.events : []).filter(
      e => e && typeof e === "object" && (e.remote || e.name)
    )
    for (const e of c.events) {
      e.time = clamp(e.time, 0, 30)
      e.remote = String(e.remote || e.name || "")
    }
    c.events.sort((a, b) => (a.time || 0) - (b.time || 0))
    // vfx[] — data-driven shockwave / beam / muzzle / burst on the scene clock
    c.vfx = (Array.isArray(c.vfx) ? c.vfx : []).filter(
      v => v && typeof v === "object" && ["shockwave", "ring", "beam", "muzzle", "flash", "burst"].includes(String(v.kind || "").toLowerCase())
    )
    for (const v of c.vfx) {
      v.time = clamp(v.time, 0, 30)
      v.life = clamp(v.life, 0.05, 3)
      v.size = clamp(v.size, 0.1, 60)
      v.count = clamp(v.count, 1, 300)
      v.speed = clamp(v.speed, 1, 100)
      if (v.color) v.color = color(v.color)
      if (v.pos && typeof v.pos === "object" && Array.isArray(v.pos)) v.pos = vec3(v.pos)
    }
    c.vfx.sort((a, b) => (a.time || 0) - (b.time || 0))
    // sounds[] — audio on the scene clock (play/stop Sound instances at time)
    c.sounds = (Array.isArray(c.sounds) ? c.sounds : []).filter(
      s => s && typeof s === "object" && (s.stop === true || s.stopping === true ? s.name : (s.soundId || s.id))
    )
    for (const s of c.sounds) {
      s.time = clamp(s.time, 0, 30)
      if (s.stop === true || s.stopping === true) {
        s.name = String(s.name || "")
        s.stop = true
        continue
      }
      s.name = String(s.name || "sound")
      s.soundId = String(s.soundId || s.id || "")
      s.volume = clamp(s.volume ?? 0.8, 0, 2)
      s.pitch = clamp(s.pitch ?? 1, 0.1, 3)
      s.loop = s.loop === true
      s.life = clamp(s.life, 0.1, 30)
      if (s.emitter) s.emitter = String(s.emitter)
    }
    c.sounds.sort((a, b) => (a.time || 0) - (b.time || 0))
    let last = 0
    for (const s of shots) last = Math.max(last, (s.time || 0) + (s.duration || 0))
    for (const f of flashes) last = Math.max(last, (f.time || 0) + (f.duration || 0))
    for (const s of c.slowmo) last = Math.max(last, (s.time || 0) + (s.duration || 0))
    for (const p of c.post) last = Math.max(last, (p.time || 0) + (p.duration || 0))
    for (const b of c.bars) last = Math.max(last, (b.time || 0) + (b.duration || 0))
    for (const v of c.vignette) last = Math.max(last, (v.time || 0) + (v.duration || 0))
    for (const e of c.events) last = Math.max(last, (e.time || 0))
    for (const v of c.vfx) last = Math.max(last, (v.time || 0) + (v.life || 0))
    for (const s of c.sounds) last = Math.max(last, (s.time || 0))
    if (!c.duration || c.duration <= 0) c.duration = Math.max(last, 1)
    else c.duration = Math.max(c.duration, last)
    c.shots = shots
    c.flashes = flashes
    c.lighting = lighting
  }
}

function polishAudio(audio) {
  if (!Array.isArray(audio) || audio.length === 0) return
  const clamp = (v, lo, hi) => (typeof v === "number" ? Math.max(lo, Math.min(hi, v)) : lo)
  for (const a of audio) {
    if (!a || typeof a !== "object") continue
    if (a.name) a.name = String(a.name).replace(/[^A-Za-z0-9_]/g, "")
    a.kind = ["sfx", "ambient", "music", "footstep", "voice", "announcer"].includes(a.kind) ? a.kind : "sfx"
    if (a.loop != null) a.loop = a.loop === true
    if (a.volume != null) a.volume = clamp(a.volume, 0, 1)
    else a.volume = a.kind === "music" ? 0.5 : 0.8
    if (a.fadeIn != null) a.fadeIn = clamp(a.fadeIn, 0, 10)
    if (a.fadeOut != null) a.fadeOut = clamp(a.fadeOut, 0, 10)
    if (a.emitter != null && typeof a.emitter === "string") {
      const e = a.emitter.trim()
      a.emitter = ["workspace", "player", "character", "rig", "none"].includes(e.toLowerCase()) ? e.toLowerCase() : ""
    }
    if (a.trigger != null && typeof a.trigger === "object" && a.trigger.event) {
      a.trigger = {
        event: String(a.trigger.event),
        source: typeof a.trigger.source === "string" ? a.trigger.source : "",
      }
    }
  }
}

export function providerLabel(model) {
  if (!model) return "NVIDIA"
  if (model.startsWith("local/")) return "Local"
  if (model.startsWith("deepseek-")) return "DeepSeek"
  if (model.startsWith("claude-")) return "Anthropic"
  if (model.startsWith("gemini-")) return "Google"
  if (model.startsWith("gpt-") || model.startsWith("o3") || model.startsWith("o4")) return "OpenAI"
  return "NVIDIA"
}

export function normaliseResponse(result, model, reasoning = "", fellBack = false) {
  result.__model = model
  result.__provider = providerLabel(model)
  result.__fallback_used = fellBack
  const type = result.type || "generation"
  console.log("[normaliseResponse] type:", type, "model:", model, "fellBack:", fellBack)

  if (type === "generation") {
    for (const key of ["title", "summary"]) {
      if (result[key] == null) result[key] = ""
    }
    for (const key of ["scripts", "instances", "notes", "warnings", "suggestions", "thoughts", "plan", "thinking_steps", "animations", "cinematics", "audio", "sound_assets", "mesh_assets"]) {
      if (result[key] == null) result[key] = []
    }
    if (reasoning && result.thinking_steps.length === 0) {
      result.thinking_steps = reasoning
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, 12)
    }
    polishAnimations(result.animations)
    polishCinematics(result.cinematics)
    polishAudio(result.audio)
    if (result.__repaired) {
      if (!result.warnings) result.warnings = []
      if (!result.warnings.some(w => w.toLowerCase().includes("truncated"))) {
        result.warnings.push(
          "Response was truncated and partially recovered. Some script code may be incomplete — try regenerating."
        )
      }
      delete result.__repaired
    }
  } else if (type === "clarification") {
    if (result.question == null) result.question = "Can you give me more details?"
    if (result.options == null) result.options = []
  } else if (type === "chat") {
    if (result.message == null) result.message = ""
  }

  delete result.__parse_failed
  return result
}

export function validateGeneration(result) {
  if (!result || result.type !== "generation") return result

  const scripts = Array.isArray(result.scripts) ? result.scripts : []
  const reports = []
  let errorCount = 0
  let warnCount = 0

  for (const script of scripts) {
    const code = script.code || script.source || ""
    const issues = validateLuau(code, script.name || "script")
    reports.push({
      name: script.name || "script",
      issues,
      ok: !hasErrors(issues),
    })
    errorCount += issues.filter(i => i.severity === "error").length
    warnCount += issues.filter(i => i.severity === "warn").length
  }

  result.__validation = {
    checked: scripts.length,
    errorCount,
    warnCount,
    allOk: errorCount === 0,
    reports,
  }
  return result
}

const DISCIPLINE_RULES = {
  obby: [
    "OBBY RULES: every platform's Position must be within jump reach (max 7 studs up, 14 studs horizontal) of the previous one. WalkSpeed=16 humanoid. Include a SpawnLocation at the start. Each stage needs a checkpoint script with SetPrimaryPartCFrame for respawn. Win platform at the end triggers a win message.",
    "DIFFICULTY CURVE: early platforms = wide + low + forgiving. Middle = narrower, higher, introduce variety. End = tight precision. Never repeat the same obstacle 3+ times in a row. Checkpoints every 3-5 obstacles.",
    "If DANGLING REFERENCES mention platform names, add the missing instances to instances[] and update script WaitForChild calls.",
  ],
  game: [
    "GAME RULES: include DataStore saving (GetDataStore/SetAsync/GetAsync in pcall with retry). Server scripts must validate all RemoteEvent arguments with typeof/tonumber checks. Add leaderstats setup in PlayerAdded. Include a combat/damage system with Health. The game needs a Floor/BasePart arena in instances[].",
    "CORE LOOP: every game needs a clear repeatable action (collect/defeat/complete/earn) with visual+audio feedback on every reward. Win/lose conditions must be defined. Progression system (coins/score/level) must be visible in leaderstats or UI.",
    "DIFFICULTY CURVE: enemies should scale with player progression. Early = 1-2 hits, mid = requires combos, boss = pattern recognition. The player should feel stronger over time.",
    "Every RemoteEvent usage must have server-side argument validation before trusting client data.",
  ],
  animation: [
    "ANIMATION RULES: animations[] must have 6-12 keyframes per second of motion, minimum 5 total. Every keyframe needs an ease field ('in'/'out'/'inout'/'linear'). First motion keyframe eases 'in' or 'inout' (start from rest). If loop=true, first and last keyframe poses must be identical. Each keyframe must pose at least 3 joints (upper+lower+extremity).",
    "PERSONALITY: motion should convey character. Heavy = slow + big ease + deep settle, light = bouncy + quick. Anticipation before every major action. Follow-through after. Never uniform keyframe spacing - vary timing for dramatic rhythm.",
  ],
  vfx: [
    "VFX RULES: scripts must create ParticleEmitter/Beam/Trail with real properties (Rate, Lifetime, Speed, Spread, Color). Every emitter must have Clear()/Destroy/Debris cleanup after lifetime. Wrap emitter creation in pcall. Attach emitters to real parts, never floating.",
    "LAYERED EFFECTS: every VFX needs 2-3 layers: core (bright/dense) + glow (soft/large) + secondary (sparks/debris). Single-layer effects read as prototype. Color must transition through 2+ colors.",
  ],
  sound: [
    "SOUND RULES: emit sound_assets[] for procedural SFX (explosion, whoosh, coin, etc.) with unique ids. Reference them from audio[] with 'generated:<id>'. Assign every sound to a SoundGroup (SFX/Music/Voice/UI). Add a VolumeController with proper volume properties.",
    "AUDIO HIERARCHY: SFX (0.7-1.0) > Voice (0.6-0.9) > Music (0.3-0.5) > Ambience (0.2-0.4). Add rollOffMaxDistance for spatial audio: close (20-40) for SFX, medium (40-80) for voices, far (80-200) for ambience.",
  ],
  cinematic: [
    "CINEMATIC RULES: minimum 3 shots with varied camera moves (push-in, orbit, whip). Every shot needs fov, shake, ease. Add flashes[] at impact frames (0.1-0.2s white). Sync lighting[] changes with shot beats. Deliver matching animations[] and VFX scripts[] in the same response.",
    "VISUAL RHYTHM: vary FOV across shots (tight 35-50 for drama, wide 70-90 for scale). Vary shot duration (fast cuts 0.3-0.5s for impact, slow holds 2-3s for drama). Three-beat arc: charge -> release -> aftermath.",
  ],
  model3d: [
    "3D MODEL RULES: use mesh_assets[] for curved/organic shapes. Minimum 8 parts for a simple prop, 12+ for a hero object. Include a WeldScript that welds every part to PrimaryPart. Set PrimaryPart on the model. Add detail passes: bolts, seams, chamfers.",
  ],
}

async function repairScripts(result, userPrompt, projectName, globalIssues = []) {
  const scripts = (result.scripts || []).filter(s => s && (s.code || s.source))
  if (!scripts.length && globalIssues.length === 0) return result

  const effType = result.__eff_type || ""

  const payload = scripts.map(s => ({
    name: s.name || "script",
    type: s.type || "Script",
    parent: s.parent || "ServerScriptService",
    code: s.code || s.source || "",
  }))

  const validationSummary = payload.map(p => {
    const issues = validateLuau(p.code, p.name)
    return `### ${p.name}\n${summarizeIssues(issues)}`
  }).join("\n\n")

  const buildIssues = globalIssues.length
    ? "## Build review issues (fix these too):\n" + globalIssues.map(g => "- " + g).join("\n")
    : "## Build review passed."

  // Discipline-specific fix instructions injected into the repair prompt.
  const disciplineRules = {
    obby: [
      "OBBY RULES: every platform's Position must be within jump reach (max 7 studs up, 14 studs horizontal) of the previous one. WalkSpeed=16 humanoid. Include a SpawnLocation at the start. Each stage needs a checkpoint script with SetPrimaryPartCFrame for respawn. Win platform at the end triggers a win message.",
      "DIFFICULTY CURVE: early platforms = wide + low + forgiving. Middle = narrower, higher, introduce variety. End = tight precision. Never repeat the same obstacle 3+ times in a row. Checkpoints every 3-5 obstacles.",
      "If DANGLING REFERENCES mention platform names, add the missing instances to instances[] and update script WaitForChild calls.",
    ],
    game: [
      "GAME RULES: include DataStore saving (GetDataStore/SetAsync/GetAsync in pcall with retry). Server scripts must validate all RemoteEvent arguments with typeof/tonumber checks. Add leaderstats setup in PlayerAdded. Include a combat/damage system with Health. The game needs a Floor/BasePart arena in instances[].",
      "CORE LOOP: every game needs a clear repeatable action (collect/defeat/complete/earn) with visual+audio feedback on every reward. Win/lose conditions must be defined. Progression system (coins/score/level) must be visible in leaderstats or UI.",
      "DIFFICULTY CURVE: enemies should scale with player progression. Early = 1-2 hits, mid = requires combos, boss = pattern recognition. The player should feel stronger over time.",
      "Every RemoteEvent usage must have server-side argument validation before trusting client data.",
    ],
    animation: [
      "ANIMATION RULES: animations[] must have 6-12 keyframes per second of motion, minimum 5 total. Every keyframe needs an ease field ('in'/'out'/'inout'/'linear'). First motion keyframe eases 'in' or 'inout' (start from rest). If loop=true, first and last keyframe poses must be identical. Each keyframe must pose at least 3 joints (upper+lower+extremity).",
      "PERSONALITY: motion should convey character — heavy = slow + big ease + deep settle, light = bouncy + quick. Anticipation before every major action. Follow-through after. Never uniform keyframe spacing — vary timing for dramatic rhythm.",
    ],
    vfx: [
      "VFX RULES: scripts must create ParticleEmitter/Beam/Trail with real properties (Rate, Lifetime, Speed, Spread, Color). Every emitter must have Clear()/Destroy/Debris cleanup after lifetime. Wrap emitter creation in pcall. Attach emitters to real parts, never floating.",
      "LAYERED EFFECTS: every VFX needs 2-3 layers — core (bright/dense) + glow (soft/large) + secondary (sparks/debris). Single-layer effects read as prototype. Color must transition through 2+ colors (white→orange→red, blue→cyan→transparent).",
    ],
    sound: [
      "SOUND RULES: emit sound_assets[] for procedural SFX (explosion, whoosh, coin, etc.) with unique ids. Reference them from audio[] with 'generated:<id>'. Assign every sound to a SoundGroup (SFX/Music/Voice/UI). Add a VolumeController with proper volume properties.",
      "AUDIO HIERARCHY: SFX (0.7-1.0) > Voice (0.6-0.9) > Music (0.3-0.5) > Ambience (0.2-0.4). Add rollOffMaxDistance for spatial audio: close (20-40) for SFX, medium (40-80) for voices, far (80-200) for ambience.",
    ],
    cinematic: [
      "CINEMATIC RULES: minimum 3 shots with varied camera moves (push-in, orbit, whip). Every shot needs fov, shake, ease. Add flashes[] at impact frames (0.1-0.2s white). Sync lighting[] changes with shot beats. Deliver matching animations[] and VFX scripts[] in the same response.",
      "VISUAL RHYTHM: vary FOV across shots (tight 35-50 for drama, wide 70-90 for scale). Vary shot duration (fast cuts 0.3-0.5s for impact, slow holds 2-3s for drama). Three-beat arc: charge → release → aftermath.",
    ],
    model3d: [
      "3D MODEL RULES: use mesh_assets[] for curved/organic shapes. Minimum 8 parts for a simple prop, 12+ for a hero object. Include a WeldScript that welds every part to PrimaryPart. Set PrimaryPart on the model. Add detail passes: bolts, seams, chamfers.",
    ],
  }

  const rules = []
  if (effType && disciplineRules[effType]) rules.push(...disciplineRules[effType])
  const rulesBlock = rules.length
    ? "## Discipline rules (apply these fixes):\n" + rules.map(r => "- " + r).join("\n")
    : ""

  const messages = [
    {
      role: "user",
      content: [
        `Original user request: ${userPrompt}`,
        projectName ? `Project: ${projectName}` : "",
        rulesBlock,
        "## Validation errors for the generated scripts:",
        validationSummary,
        buildIssues,
        "## Full scripts that need fixing:",
        JSON.stringify(payload),
      ].filter(Boolean).join("\n\n"),
    },
  ]

  try {
    const { output, model: usedModel, fellBack } = await callNvidiaWithFallback(
      REVIEW_SYSTEM,
      messages,
      60000,
      "nvidia/nemotron-3-ultra-550b-a55b",
      ["nvidia/nemotron-3.5-lightning-30b-a3b"],
      16000
    )

    const repaired = extractJson(output)
    if (repaired && Array.isArray(repaired.scripts) && repaired.scripts.length) {
      const repairedByName = new Map()
      for (const s of repaired.scripts) {
        if (s?.name) repairedByName.set(s.name, s)
      }

      let replaced = 0
      result.scripts = (result.scripts || []).map(s => {
        const fixed = repairedByName.get(s.name)
        if (fixed && fixed.code) {
          replaced++
          return { ...s, code: fixed.code }
        }
        return s
      })

      result.__repair = {
        used: true,
        replaced,
        model: usedModel,
        fellBack,
        total: scripts.length,
      }
      if (!result.warnings) result.warnings = []
      result.warnings.push(`Code review pass fixed issues in ${replaced} script(s).`)
    } else {
      result.__repair = { used: true, replaced: 0, total: scripts.length, failed: true }
    }
  } catch (e) {
    console.error("[repairScripts] review pass failed:", e.message)
    result.__repair = { used: true, replaced: 0, total: scripts.length, failed: true, error: e.message }
  }

  return result
}

// Runtime QA auto-repair: a live playtest probe (buildQAProbeLuau) reported
// script errors / unreachable course / missing spawn to the bridge; the app
// sends the previous generation + that report here. Only scripts/instances
// touched by the findings are regenerated, then merged back by name. The same
// discipline rules as repairScripts apply so a broken obby is fixed as an obby.
export async function runRuntimeRepair({ prompt, generation, report, model = "", projectName = "" }) {
  const base = (generation && typeof generation === "object") ? generation : {}
  if (!Array.isArray(base.scripts) && !Array.isArray(base.instances)) {
    return { ...base, __repair: { used: false, failed: true, error: "no generation to repair" } }
  }

  const checks = (report && typeof report === "object" && report.checks) || {}
  const errors = Array.isArray(checks.errors) ? checks.errors.filter(s => typeof s === "string").slice(0, 8) : []
  const course = checks.course && typeof checks.course === "object" ? checks.course : null
  const noSpawn = checks.spawnlocation === false
  const noProgression = checks.leaderstats === false
  const deadRemotes = Array.isArray(checks.remotesDead) ? checks.remotesDead.filter(s => typeof s === "string").slice(0, 6) : []
  const noActivity = checks.progression === false
  const noPlayer = checks.humanoid === false

  const findings = []
  if (errors.length) {
    findings.push("RUNTIME SCRIPT ERRORS (fix these exact scripts so they stop erroring):")
    findings.push(...errors.map(e => `- ${e}`))
  }
  if (noSpawn) findings.push("- NO SPAWN: no SpawnLocation found in the live place - players cannot spawn. Ensure the place has one.")
  if (course && course.total > 0 && course.reachable === false) {
    findings.push(`- COURSE UNREACHABLE: only ${course.chain}/${course.total} obstacles are reachable by jumping (max 7 studs up, 18 studs horizontal, from the spawn). Reposition/arrange the obstacles so every step is reachable.`)
  }
  if (noProgression) findings.push("- NO PROGRESSION: no leaderstats (Coins) appeared for players. Add a leaderstats setup in PlayerAdded.")
  if (noPlayer) findings.push("- NO PLAYER CHARACTER: no Humanoid was found for a player during the probe - the game must spawn a playable character.")
  if (noActivity) findings.push("- NO PROGRESSION ACTIVITY: leaderstats existed but no value changed while playing - connect the reward/collect loop so players actually progress during play.")
  if (deadRemotes.length) findings.push(`- DEAD REMOTES: these RemoteEvents/Functions exist but no server script references them: ${deadRemotes.join(", ")}. Add server-side handlers that wire them up.`)

  if (findings.length === 0) {
    return { ...base, __repair: { used: false, reason: "no critical runtime findings" } }
  }

  const effType = base.__eff_type || ""
  const rules = []
  if (effType && DISCIPLINE_RULES[effType]) rules.push(...DISCIPLINE_RULES[effType])
  const rulesBlock = rules.length
    ? "## Discipline rules (apply these fixes):\n" + rules.map(r => "- " + r).join("\n")
    : ""

  const scripts = (base.scripts || []).map(s => ({ name: s.name, type: s.type, parent: s.parent, code: s.code || s.source || "" }))
  const instances = (base.instances || []).map(i => ({ name: i.name, class: i.class || i.className, parent: i.parent, properties: i.properties || {} }))

  const messages = [
    {
      role: "user",
      content: [
        `Original user request: ${prompt}`,
        projectName ? `Project: ${projectName}` : "",
        rulesBlock,
        "## Runtime QA report (fix ONLY these problems):",
        findings.join("\n"),
        "## Previous generation - fix ONLY what the QA report above requires:",
        JSON.stringify({ scripts, instances }).slice(0, 120000),
        "## Output JSON:",
        "{ \"scripts\": [ repaired or new scripts with name/type/parent/code ], \"instances\": [ new instances needed by those scripts with name/class/parent/properties ] }",
      ].filter(Boolean).join("\n\n"),
    },
  ]

  try {
    const { output, model: usedModel, fellBack } = await callNvidiaWithFallback(
      REVIEW_SYSTEM,
      messages,
      60000,
      model || "nvidia/nemotron-3-ultra-550b-a55b",
      ["nvidia/nemotron-3.5-lightning-30b-a3b"],
      16000
    )
    const patch = extractJson(output)
    const repaired = { ...base }

    let replaced = 0
    if (patch && Array.isArray(patch.scripts)) {
      const byName = new Map()
      for (const s of patch.scripts) if (s && s.name) byName.set(s.name, s)
      repaired.scripts = (repaired.scripts || []).map(s => {
        const f = byName.get(s.name)
        if (f && (f.code || f.source)) { replaced++; return { ...s, code: f.code || f.source } }
        return s
      })
      for (const s of patch.scripts) {
        if (s && s.name && !(repaired.scripts || []).some(x => x.name === s.name)) {
          repaired.scripts.push({ name: s.name, type: s.type || "Script", parent: s.parent || "ServerScriptService", code: s.code || s.source || "" })
          replaced++
        }
      }
    }

    let added = 0
    if (patch && Array.isArray(patch.instances)) {
      repaired.instances = repaired.instances || []
      const known = new Set(repaired.instances.map(i => String(i.name || "")))
      for (const i of patch.instances) {
        if (!i || !i.name) continue
        const key = String(i.name)
        if (!known.has(key)) {
          repaired.instances.push({ name: i.name, class: i.class || i.className, parent: i.parent, properties: i.properties || {} })
          known.add(key)
          added++
        } else {
          repaired.instances = repaired.instances.map(x => String(x.name || "") === key ? { ...x, ...i } : x)
        }
      }
    }

    repaired.__repair = { used: true, replaced, added, model: usedModel, fellBack }
    if (Array.isArray(repaired.__quality)) repaired.__quality.push(...findings.map(f => "QA: " + f))
    return repaired
  } catch (e) {
    return { ...base, __repair: { used: true, failed: true, error: e.message } }
  }
}

// Art-director pass: give the model its own first draft back and let it critique
// and polish it against professional standards. This is what turns a first-pass
// output into something AAA — density, arcs, timing, cleanup. Bounded to ONE
// extra call, only when there is real content to refine.
//
// Deterministic quality gates: cheap code-level checks for the doctrine's
// minimum bars. Their findings are injected into the refinement prompt so the
// critique targets ACTUAL weaknesses instead of hoping the model finds them.
export function assessQuality(result, effType) {
  const issues = []
  const parts = Array.isArray(result.instances) ? result.instances.filter(i => i && !/script/i.test(String(i.className || i.class || ""))) : []
  const scripts = Array.isArray(result.scripts) ? result.scripts : []
  const anims = Array.isArray(result.animations) ? result.animations : []
  const cines = Array.isArray(result.cinematics) ? result.cinematics : []
  const audio = Array.isArray(result.audio) ? result.audio : []
  const soundAssets = Array.isArray(result.sound_assets) ? result.sound_assets : []
  const meshes = Array.isArray(result.mesh_assets) ? result.mesh_assets : []

  // ── Cross-cutting senior checks (apply to EVERY build type) ────────────────
  // 1. Script reference integrity: every WaitForChild/FindFirstChild name in a
  //    script should resolve to an instance or variable defined elsewhere.
  //    (A pro never ships a script that waits on a part nobody created.)
  if (scripts.length > 0 && parts.length > 0) {
    const declared = new Set()
    for (const p of parts) {
      if (p.name) declared.add(String(p.name).toLowerCase())
      for (const child of Array.isArray(p.children) ? p.children : []) {
        if (child.name) declared.add(String(child.name).toLowerCase())
      }
    }
    const derefSummary = []
    for (const s of scripts) {
      const code = String(s.code || s.source || "")
      const matches = [...code.matchAll(/(?:WaitForChild|FindFirstChild|FindFirstChildOfClass)\(\s*["']([^"']+)["']/gi)]
        .map(m => m[1].toLowerCase())
        .filter(name => name !== "humanoid" && name !== "humanoidrootpart" && name !== "torso" && name !== "head" && name !== "spawnlocation" && name !== "part" && name !== "door" && name !== "handle" && name !== "weld" && name !== "primarypart")
      const nameLower = String(s.name || "").toLowerCase()
      for (const referred of matches) {
        // Ignore lookups that resolve to the script's own name (ModuleScript refs)
        if (referred === nameLower) continue
        // Prefix-aware: a lookup like "checkpoint_" that is a prefix of a real
        // instance name ("checkpoint_1", "checkpoint_2"...) is a dynamic iterate,
        // not a dangling ref. Also allow singular/plural forms of an existing part.
        const base = referred.replace(/[0-9]+$/, "").replace(/s$/, "")
        const resolves = declared.has(referred) ||
          [...declared].some(d => d.startsWith(referred) || referred.startsWith(d) || (base && base.startsWith(d)))
        if (!resolves) derefSummary.push(`${s.name || "script"} -> "${referred}"`)
      }
    }
    if (derefSummary.length > 0) {
      issues.push(`DANGLING REFERENCES: ${derefSummary.length} script lookup(s) don't match any produced instance (${derefSummary.slice(0, 4).join("; ")}${derefSummary.length > 4 ? ", ..." : ""}). Add the missing instance OR wire the script to an existing part name — a runtime error kills the whole feature.`)
    }
  }

  // 2. SpawnLocation: game-like builds need a real spawn point in Workspace.
  if ((effType === "game" || effType === "obby") && parts.length > 0) {
    const hasSpawn = ["spawn", "spawnlocation", "start", "startplatform", "spawnpoint"].some(kw =>
      parts.some(p => String(p.name || "").toLowerCase().includes(kw))
    )
    if (!hasSpawn) {
      issues.push("NO SPAWN POINT: the build has no instance named like SpawnLocation/StartPlatform — players need a SpawnLocation (or a part the spawn script uses). Add it or the round can't start.")
    }
  }

  // 3. OBBY PHYSICS: with default Roblox humanoid (WalkSpeed 16), max jump
  //    height ≈ 7.2 studs and a running jump covers ≈ 12-14 studs. Check every
  //    consecutive platform pair is physically reachable so the course is fair.
  //    Deterministic, no AI: this is the check that kills "impossible obstacle"
  //    obbies that a pro would never ship.
  if (effType === "obby" && parts.length >= 2) {
    const platforms = parts
      .map(p => {
        const props = p.properties || {}
        const pos = Array.isArray(props.Position) ? props.Position : null
        const size = Array.isArray(props.Size) ? props.Size : null
        const cframe = Array.isArray(props.CFrame) ? props.CFrame : null
        let x = null, y = null, z = null
        if (pos && pos.length >= 3) { x = pos[0]; y = pos[1]; z = pos[2] }
        else if (cframe && cframe.length >= 4) { x = cframe[0]; y = cframe[2]; z = cframe[1] }
        return { name: p.name || "?", x, y, size }
      })
      .filter(p => p.x != null && p.y != null)
    platforms.sort((a, b) => a.y - b.y)
    let impossible = 0
    const impossibleList = []
    for (let i = 1; i < platforms.length; i++) {
      const a = platforms[i - 1], b = platforms[i]
      const dy = b.y - a.y
      const dx = Math.hypot(b.x - a.x, (b.z ?? 0) - (a.z ?? 0))
      const parts = []
      if (dy > 7.2) parts.push(`+${dy.toFixed(1)} high`)
      if (dx > 15) parts.push(`${dx.toFixed(1)} studs gap`)
      if (parts.length) {
        impossible++
        impossibleList.push(`${a.name}→${b.name} (${parts.join(", ")})`)
      }
    }
    if (impossible > 0 && impossibleList.length < 5) {
      issues.push(`IMPOSSIBLE JUMPS: ${impossible} jump(s) exceed Roblox humanoid reach (${impossibleList.join("; ")}). Max ~7.2 studs up, ~15 studs across — move platforms closer or lower so the course is completable.`)
    } else if (impossibleList.length >= 5) {
      issues.push(`IMPOSSIBLE JUMPS: ${impossible} jumps break basic humanoid physics (examples: ${impossibleList.slice(0, 3).join("; ")}...). Vertically-sorted platforms are flagged — the course needs a real per-step layout, not random placement.`)
    }
  }

  // 4. GAME NETWORKING: multiplayer kit must send through RemoteEvents and the
  //    server must validate (no clients setting money/gold directly).
  if (effType === "game") {
    const allCodeLower = scripts.map(s => String(s.code || s.source || "")).join("\n").toLowerCase()
    const usesRemote = /remote\.(fireclient|fireallclients)|remoteevent|replicatestorage|remotefolder|\.fire\w*\(/i.test(allCodeLower)
    const hasDataStore = /datastore|datastoreservice|getdatastore/i.test(allCodeLower)
    const hasLeaderstats = /leaderstats/.test(allCodeLower)
    if (usesRemote) {
      const validatesArgs = /typeof\(|checkcaller|pcall|tonumber\(|isA\(|type\(/.test(allCodeLower)
      if (!validatesArgs) {
        issues.push("REMOTE VALIDATION MISSING: RemoteEvents are used but the server never validates arguments (typeof/pcall/checkcaller) — malicious clients can inject bad data. Add server-side argument checks.")
      }
    }
    if (!hasDataStore) {
      issues.push("NO DATASTORE SAVING: a game 'kit' without DataStore persist isn't a complete game — wrap GetDataStore/SetAsync/GetAsync in pcall with retry.")
    }
    if (parts.length === 0) {
      issues.push("NO WORLD INSTANCES: the game kit produced no instances[] world (floor, barriers, landmarks). A playable arena is Tier 1.")
    }
  }

  // 5. 3D MODELS must be meshes or multi-part assemblies, never a bare cube.
  if (effType === "model3d" && parts.length === 1 && meshes.length === 0) {
    issues.push("BARE CUBE: the 3D model is a single part with no mesh_assets[] and no detail parts — deliver the item as a procedural mesh (mesh_assets[]) referenced by a MeshPart, or break it into segmentation/detail parts.")
  }

  if (effType === "model3d") {
    if (parts.length < 8 && meshes.length === 0) {
      issues.push(`3D MODEL DENSITY: only ${parts.length} parts were produced and no mesh_assets[]. The doctrine minimum for even a simple prop is 8+ elements (detail passes: bolts, seams, chamfers, panel lines). Add the missing detail passes.`)
    } else if (parts.length < 12 && meshes.length === 0) {
      issues.push(`3D MODEL DENSITY: ${parts.length} parts is below the 12-part hero-object bar. Add grip/wrap segmentation, panel lines, edge chamfers or greebles.`)
    }
    if (parts.length > 0 && !parts.some(p => /weld/i.test(String(p.name || ""))) && !scripts.some(s => /weld/i.test(String(s.name || "")))) {
      issues.push("ASSEMBLY: no weld script found — add a WeldScript that welds every part to the PrimaryPart and sets the model's PrimaryPart.")
    }
  }

  if (anims.length > 0) {
    const weak = anims.filter(a => Array.isArray(a.keyframes) && a.keyframes.length < 5)
    if (weak.length) {
      issues.push(`ANIMATION DENSITY: ${weak.length} animation(s) have fewer than 5 keyframes. Rebuild them with 6-12 keyframes per second of motion, extremes + breakdowns, eased.`)
    }
    const flat = anims.filter(a => Array.isArray(a.keyframes) && a.keyframes.some(k => {
      const posed = Object.values(k.poses || {}).filter(p => p && Array.isArray(p.euler))
      return posed.length < 3
    }))
    if (flat.length) {
      issues.push("JOINT COVERAGE: some keyframes pose fewer than 3 bones — key upper+lower+extremity plus a counter element so limbs don't read as puppets.")
    }
    const noEase = anims.filter(a => Array.isArray(a.keyframes) && a.keyframes.some(k => !k.ease))
    if (noEase.length) {
      issues.push(`EASING MISSING: ${noEase.length} animation(s) contain keyframes without an ease field. Every keyframe needs "in"/"out"/"inout" chosen from the motion's physics.`)
    }
    const badLoop = anims.filter(a => a.loop && Array.isArray(a.keyframes) && a.keyframes.length > 1 && JSON.stringify(a.keyframes[0].poses || {}) !== JSON.stringify(a.keyframes[a.keyframes.length - 1].poses || {}))
    if (badLoop.length) {
      issues.push(`LOOP SEAM BROKEN: ${badLoop.length} looping animation(s) start and end on different poses — the first and last keyframe poses must be IDENTICAL or the cycle pops.`)
    }
  }

  if (effType === "animation" && anims.length === 0) {
    issues.push("CRITICAL — NO STRUCTURED ANIMATIONS: animations[] is EMPTY. The plugin consumes animations[] data (id, name, fps, loop, keyframes[{time, joints:{JointName:[x,y,z]}, ease}]) — it CANNOT use pose tables written inside Luau scripts. Rebuild: keep any trigger/control script if useful, but the MOTION ITSELF must be authored as keyframe data inside animations[]. Minimum one animation with 8+ dense eased keyframes covering 3-4 joints per moving limb.")
  }
  if (effType === "vfx" && scripts.length === 0 && parts.length === 0) {
    issues.push("NO VFX DATA: the request asked for an effect but neither scripts[] nor instances[] contain it — deliver the effect as real emitter/particle scripts plus its instances.")
  }
  if (effType === "sound" && audio.length === 0 && soundAssets.length === 0) {
    issues.push("NO SOUND DATA: the request asked for audio but audio[] and sound_assets[] are both empty — deliver the layered sound design.")
  }
  if ((effType === "cinematic" || effType === "vfx") && cines.length === 0 && effType === "cinematic") {
    issues.push("NO CINEMATIC DATA: the request asked for a cinematic scene but cinematics[] is empty — deliver the choreography as shots[]/flashes[]/lighting[] data.")
  }

  if ((effType === "sound" || /sound|audio|music|sfx/i.test(effType)) && audio.length === 0 && soundAssets.length === 0 && scripts.length > 0) {
    issues.push("AUDIO DATA MISSING: the response has scripts but NO audio[]/sound_assets[] data. Emit sound_assets[] entries for every archetype sfx (generated:<id>) plus audio[] with SoundGroup assignments — never sounds-as-code-only.")
  }

  if (effType === "cinematic" && cines.length > 0) {
    for (const c of cines) {
      const shots = Array.isArray(c.shots) ? c.shots.length : 0
      if (shots < 3) {
        issues.push(`CINEMATIC STRUCTURE: a scene with ${shots} shot(s) reads static. Use at least 3-6 shots with arcs: push-in charge, whip/zoom release, low-angle aftermath.`)
      }
      const flashes = Array.isArray(c.flashes) ? c.flashes.length : 0
      if (flashes === 0) {
        issues.push("IMPACT PUNCTUATION: no flashes[] — add a white/colored flash (0.1-0.25s) exactly on the strike frame.")
      }
    }
  }

  if (scripts.length > 0) {
    const empty = scripts.filter(s => !String(s.code || s.source || "").trim())
    if (empty.length) {
      issues.push(`EMPTY SCRIPTS: ${empty.length} script(s) have no code (${empty.map(s => s.name).join(", ")}). Write their complete Luau.`)
    }
    const stub = scripts.filter(s => {
      const code = String(s.code || s.source || "")
      return code.trim().length > 0 && code.trim().length < 200
    })
    if (stub.length) {
      issues.push(`STUB SCRIPTS: ${stub.map(s => s.name).join(", ")} contain less than 200 characters of Luau — that is a placeholder, not a system. Write the full implementation (guards, cleanup, edge cases).`)
    }
  }

  if (effType === "vfx") {
    const vfxCode = scripts.map(s => String(s.code || s.source || "")).join("\n")
    const hasEmitters = /ParticleEmitter|Emit\(|EmitCount|Rate\s*=|Beam|Trail/i.test(vfxCode)
    if (vfxCode.length > 0 && !hasEmitters) {
      issues.push("VFX IMPLEMENTATION: the scripts never create ParticleEmitter/Beam/Trail or call :Emit() — implement the effect with real emitter tuning (rate, lifetime, speed, spread, color gradient), not placeholders.")
    }
    const hasCleanup = /Clear\(\)|:Destroy\(\)|Debris/i.test(vfxCode)
    if (vfxCode.length > 0 && !hasCleanup) {
      issues.push("VFX CLEANUP MISSING: no emitter Clear()/Destroy/Debris logic — effects must self-destruct after their lifetime or they leak.")
    }
  }

  if (effType === "sound" && audio.length > 0) {
    const unassigned = audio.filter(a => !a.soundGroup && !a.group)
    if (unassigned.length === audio.length) {
      issues.push("MIX BUSES MISSING: no audio[] entry is assigned to a SoundGroup — assign every sound to SFX/Music/Voice/UI and add a VolumeController so players can mix.")
    }
  }

  if (effType === "game") {
    const allCode = scripts.map(s => String(s.code || s.source || "")).join("\n").toLowerCase()
    const hasCoreSystem = /combat|damage|shop|currency|coins|datastore|leaderstat|save/.test(allCode)
    if (!hasCoreSystem) {
      issues.push("CORE SYSTEMS MISSING: the game kit has no combat/damage, shop/currency, DataStore saving or leaderstats code. Tier 1 of the doctrine is mandatory — write the core loop systems as complete server scripts.")
    }
  }

  // ── GAME DESIGN QUALITY (creative + structural, not just technical) ──────
  // These checks catch builds that work but aren't FUN — the gap between
  // "functional prototype" and "shipped game". A 4-year dev ships games
  // people WANT to play; a beginner ships games that merely run.

  // 1. OBBY DESIGN: difficulty must ramp, not stay flat.
  if (effType === "obby" && platforms.length >= 4) {
    const yValues = platforms.map(p => p.y).filter(y => y != null)
    if (yValues.length >= 4) {
      const firstThird = yValues.slice(0, Math.floor(yValues.length / 3))
      const lastThird = yValues.slice(-Math.floor(yValues.length / 3))
      const avgFirst = firstThird.reduce((a, b) => a + b, 0) / firstThird.length
      const avgLast = lastThird.reduce((a, b) => a + b, 0) / lastThird.length
      if (Math.abs(avgLast - avgFirst) < 3) {
        issues.push("FLAT DIFFICULTY CURVE: the obby platforms have similar heights throughout (avg start ≈ avg end). A good obby ramps: early stages low/wide, later stages higher/tighter. Add height variation that increases toward the end.")
      }
    }
    // Checkpoint density: obby should have checkpoints every 3-5 obstacles
    const checkpointCount = scripts.filter(s => /checkpoint|save/i.test(String(s.name || ""))).length +
      parts.filter(p => /checkpoint/i.test(String(p.name || ""))).length
    if (checkpointCount === 0 && platforms.length > 6) {
      issues.push("NO CHECKPOINTS: an obby with 6+ platforms has no checkpoint system. Players need checkpoints every 3-5 obstacles — dying at stage 20 and restarting from 0 is frustration, not challenge.")
    }
    // Obstacle variety: same platform type repeated = boring
    const platformTypes = parts.map(p => String(p.className || p.class || p.name || "").toLowerCase())
    const uniqueTypes = new Set(platformTypes)
    if (uniqueTypes.size === 1 && platforms.length > 4) {
      issues.push("LOW VARIETY: all platforms are the same class/type. A good obby alternates mechanics: static jumps, moving platforms, disappearing blocks, conveyors, spinners. Add at least 2 different obstacle types.")
    }
  }

  // 2. GAME DESIGN: core loop, progression, win/lose, reward feedback
  if (effType === "game") {
    const allCode = scripts.map(s => String(s.code || s.source || "")).join("\n").toLowerCase()
    // Core loop: must have a repeatable action (collect, defeat, complete)
    const hasCoreLoop = /collect|pickup|defeat|kill|complete|finish|win|score|earn|build|craft/.test(allCode)
    if (!hasCoreLoop && scripts.length > 0) {
      issues.push("NO CORE LOOP: the game has no detectable repeatable action (collect/defeat/complete/earn). A game without a core loop is a sandbox, not a game — add the primary verb the player repeats.")
    }
    // Win/lose conditions
    const hasWinLose = /win|lose|gameover|game.?over|victory|defeat|round.?end|match.?end/.test(allCode)
    if (!hasWinLose && scripts.length > 0) {
      issues.push("NO WIN/LOSE: the game has no detectable win or lose condition. Every game needs clear success/failure states so the player knows what they're working toward.")
    }
    // Progression feedback (coins, score, level, XP)
    const hasProgression = /coins|score|level|xp|experience|currency|money|gold|gems?|points?/.test(allCode)
    if (!hasProgression && scripts.length > 2) {
      issues.push("NO PROGRESSION SYSTEM: the game has no visible score/currency/level feedback. Players need to SEE their progress (leaderstats, UI score, currency popup) to stay motivated.")
    }
    // Reward feedback: coins/collectibles should trigger visual/audio feedback
    const hasRewardFeedback = /particle|effect|sound|play\(|:emit|screen|gui|popup|show|display|leaderboard/.test(allCode)
    if (hasProgression && !hasRewardFeedback && scripts.length > 0) {
      issues.push("NO REWARD FEEDBACK: the game has a progression system but no visual/audio reward when the player earns something. Add particle effects, sound, screen flash, or score popup on every collection/kill — the player must FEEL the reward.")
    }
  }

  // 3. VFX DESIGN: effects must have visual hierarchy and feedback
  if (effType === "vfx") {
    const vfxCode = scripts.map(s => String(s.code || s.source || "")).join("\n")
    // Layered effects: good VFX has 2+ layers (core + glow/sparks/secondary)
    const emitterCount = (vfxCode.match(/ParticleEmitter|:Emit\(/g) || []).length
    if (emitterCount > 0 && emitterCount < 2) {
      issues.push("SINGLE-LAYER VFX: only 1 emitter detected. Professional effects use 2-3 layers: core (bright/dense) + glow (soft/large) + secondary (sparks/debris). Layered effects read as polished; single-layer reads as prototype.")
    }
    // Color gradient: good VFX uses multi-color sequences
    const colorSeqCount = (vfxCode.match(/ColorSequence|Color3\.fromRGB|fromHSV/g) || []).length
    if (emitterCount > 0 && colorSeqCount < 2) {
      issues.push("FLAT VFX COLORS: fewer than 2 color definitions. Good effects transition through colors (white→orange→red for fire, blue→cyan→transparent for ice). Monochrome effects read as placeholder.")
    }
  }

  // 4. CINEMATIC DESIGN: storytelling and emotional arc
  if (effType === "cinematic" && cines.length > 0) {
    for (const c of cines) {
      const shots = Array.isArray(c.shots) ? c.shots : []
      // Shot variety: all same FOV = no visual rhythm
      const fovs = shots.map(s => s.fov).filter(f => f != null)
      if (fovs.length >= 3) {
        const fovRange = Math.max(...fovs) - Math.min(...fovs)
        if (fovRange < 10) {
          issues.push("STATIC FRAMING: all shots use similar FOV (range < 10). A cinematic needs visual rhythm: tight shots (FOV 35-50) for drama, wide shots (FOV 70-90) for scale. Vary the FOV to guide emotion.")
        }
      }
      // Timing variety: all same duration = no pacing
      const durations = shots.map(s => s.duration).filter(d => d != null)
      if (durations.length >= 3) {
        const durRange = Math.max(...durations) - Math.min(...durations)
        if (durRange < 0.3) {
          issues.push("FLAT PACING: all shots have similar duration. Cinematic rhythm needs contrast: fast cuts (0.3-0.5s) for impact, slow holds (2-3s) for drama. Mix short and long shots.")
        }
      }
    }
  }

  // 5. SOUND DESIGN: audio must have hierarchy and spatial presence
  if (effType === "sound" && audio.length > 0) {
    // Volume hierarchy: SFX should be louder than ambience, music balanced
    const volumes = audio.map(a => a.volume || 0.5)
    const hasSameVolume = volumes.every(v => Math.abs(v - volumes[0]) < 0.1)
    if (hasSameVolume && audio.length > 2) {
      issues.push("FLAT MIX: all sounds have similar volume. A professional mix has hierarchy: SFX (0.7-1.0) > Voice (0.6-0.9) > Music (0.3-0.5) > Ambience (0.2-0.4). Balance the levels so important sounds cut through.")
    }
    // Spatial: sounds should have varied roll-off distances
    const rollOffs = audio.filter(a => a.rollOffMaxDistance).map(a => a.rollOffMaxDistance)
    if (audio.length > 2 && rollOffs.length === 0) {
      issues.push("NO SPATIAL AUDIO: all sounds are global (no rollOffMaxDistance). Spatial audio creates immersion: close sounds (20-40 studs) for SFX, medium (40-80) for voices, far (80-200) for ambience. Add roll-off distances.")
    }
  }

  // 6. GUI DESIGN: every game-like build needs a real UI
  if (effType === "game" || effType === "obby") {
    const guiInstances = parts.filter(p =>
      /screen|gui|frame|button|label|text/i.test(String(p.className || p.class || ""))
    )
    const guiScripts = scripts.filter(s =>
      /gui|ui|button|click|shop|inventory|menu|hud|health.?bar|stats/i.test(String(s.name || ""))
    )
    const hasGUI = guiInstances.length > 0 || guiScripts.length > 0
    if (!hasGUI && scripts.length > 0) {
      issues.push("NO GUI: this game/obby has no ScreenGui, Frame, Button, or UI script. Every playable game needs at minimum a HealthBar + StatsDisplay. Add ScreenGui instances in StarterGui with proper hierarchy (Frame → UIListLayout → UICorner → UIPadding → children).")
    }
    // Check for health bar specifically
    const hasHealthBar = parts.some(p => /health|hp/i.test(String(p.name || ""))) ||
      scripts.some(s => /health|hp|damage/i.test(String(s.name || "")))
    if (hasGUI && !hasHealthBar && scripts.length > 0) {
      const allCodeLower = scripts.map(s => String(s.code || s.source || "")).join("\n").toLowerCase()
      if (/health|damage|combat/i.test(allCodeLower)) {
        issues.push("NO HEALTH BAR: the game has health/damage logic but no HealthBar UI. Add a Frame-based health bar in StarterGui that updates via RemoteEvent when health changes — players need to SEE their health.")
      }
    }
    // Check for layout system (UIListLayout/UIGridLayout)
    const hasLayout = parts.some(p => /layout|listlayout|gridlayout/i.test(String(p.name || "")))
    if (guiInstances.length > 3 && !hasLayout) {
      issues.push("NO LAYOUT SYSTEM: multiple GUI elements exist but no UIListLayout/UIGridLayout. Manual positioning breaks on different screen sizes. Add UIListLayout (vertical/horizontal lists) or UIGridLayout (grids) with UIPadding on every container.")
    }
    // Check for UICorner (modern Roblox look)
    const hasCorner = parts.some(p => /uicorner/i.test(String(p.name || "")))
    if (guiInstances.length > 2 && !hasCorner) {
      issues.push("NO UICORNER: GUI frames have sharp corners. Modern Roblox UI uses rounded corners (UICorner, CornerRadius 6-12) on every Frame and Button for a polished look.")
    }
  }

  return issues
}

// ── Deterministic auto-fix: patch issues that don't need AI ────────────────
// Runs BEFORE the AI repair pass to shrink its workload and guarantee the fix
// for purely mechanical problems (physics, missing spawn, etc.).
export function autoFix(result, effType) {
  if (!result || result.type !== "generation") return result
  const parts = Array.isArray(result.instances) ? result.instances : []
  const fixes = []

  // ── Obby: reposition platforms that break jump physics ────────────────────
  if (effType === "obby" && parts.length >= 2) {
    const maxDy = 7.0   // slightly under 7.2 for safety margin
    const maxDx = 14.0  // slightly under 15 for safety margin
    const platforms = parts
      .map((p, idx) => {
        const props = p.properties || {}
        const pos = Array.isArray(props.Position) ? props.Position : null
        const cframe = Array.isArray(props.CFrame) ? props.CFrame : null
        let x = null, y = null, z = null
        if (pos && pos.length >= 3) { x = pos[0]; y = pos[1]; z = pos[2] }
        else if (cframe && cframe.length >= 4) { x = cframe[0]; y = cframe[2]; z = cframe[1] }
        return { idx, name: p.name || "?", x, y, z, origPos: pos, origCf: cframe }
      })
      .filter(p => p.x != null && p.y != null)
    platforms.sort((a, b) => a.y - b.y)

    for (let i = 1; i < platforms.length; i++) {
      const a = platforms[i - 1], b = platforms[i]
      const dy = b.y - a.y
      const dx = Math.hypot((b.x ?? 0) - (a.x ?? 0), (b.z ?? 0) - (a.z ?? 0))

      let newY = b.y, newX = b.x, newZ = b.z
      let changed = false

      // Fix vertical: bring down if too high
      if (dy > maxDy) {
        newY = a.y + maxDy
        changed = true
      }
      // Fix horizontal: bring closer if too far
      if (dx > maxDx && b.x != null && a.x != null) {
        const ratio = maxDx / dx
        newX = a.x + (b.x - a.x) * ratio
        if (b.z != null && a.z != null) newZ = a.z + (b.z - a.z) * ratio
        changed = true
      }

      if (changed) {
        const p = parts[b.idx]
        if (b.origPos && b.origPos.length >= 3) {
          p.properties = p.properties || {}
          p.properties.Position = [
            Math.round((newX ?? b.x) * 100) / 100,
            Math.round((newY ?? b.y) * 100) / 100,
            Math.round((newZ ?? b.z) * 100) / 100,
          ]
        } else if (b.origCf && b.origCf.length >= 4) {
          p.properties = p.properties || {}
          p.properties.CFrame = [
            Math.round((newX ?? b.x) * 100) / 100,
            b.origCf[1],
            Math.round((newY ?? b.y) * 100) / 100,
            Math.round((newZ ?? b.z) * 100) / 100,
          ]
        }
        fixes.push(`repositioned "${b.name}" for jump reachability`)
      }
    }
  }

  // ── Game/Obby: insert missing SpawnLocation ──────────────────────────────
  if (effType === "game" || effType === "obby") {
    const hasSpawn = parts.some(p => /spawn|startplatform|start/i.test(String(p.name || "")))
    if (!hasSpawn && parts.length > 0) {
      const firstPart = parts[0]
      const pos = firstPart.properties?.Position || [0, 10, 0]
      const spawnPos = Array.isArray(pos) ? [pos[0], (pos[1] || 10) + 5, pos[2] || 0] : [0, 15, 0]
      result.instances.push({
        name: "AutoSpawnLocation",
        className: "SpawnLocation",
        parent: "Workspace",
        properties: {
          Position: spawnPos,
          Size: [6, 1, 6],
          Anchored: true,
          Transparency: 0.3,
          Color: [0.3, 1, 0.3],
          Material: "SmoothPlastic",
        },
      })
      fixes.push("inserted AutoSpawnLocation near first platform")
    }
  }

  if (fixes.length) {
    result.__autoFix = { applied: fixes.length, details: fixes }
    if (!result.warnings) result.warnings = []
    result.warnings.push(`Auto-fix: ${fixes.length} issue(s) corrected deterministically (${fixes[0]}${fixes.length > 1 ? ", ..." : ""}).`)
  }
  return result
}

// Surgical recovery: when the polished result STILL misses mandatory sections
// (e.g. cinematics[] empty on a cinematic request), ask the model for ONLY the
// missing arrays instead of regenerating everything.
async function fillMissingSections(refined, userPrompt, gaps, effectiveModel, effectiveFallbacks, timeBudgetMs = 40000) {
  const context = JSON.stringify({
    title: refined.title,
    summary: refined.summary,
    instances: (refined.instances || []).map(i => i.name),
    scripts: (refined.scripts || []).map(s => s.name),
    animations: (refined.animations || []).map(a => ({ name: a.name, duration: a.duration })),
  })
  const system =
    "You are a JSON-only generator. The user's request was already fulfilled EXCEPT for the sections listed in NEEDED. " +
    "Produce ONLY those missing sections as valid JSON — same schema as the Vexa generation format. " +
    "Match the existing build's theme, names and timing so everything stays synchronized. " +
    'Respond with a single JSON object containing ONLY the needed arrays, e.g. {"cinematics":[...]} — no prose, no other fields.'
  const message =
    `Original request: ${userPrompt}\n\nExisting build context:\n${context}\n\nNEEDED (produce these arrays, complete and high quality):\n${gaps.map((g, i) => `${i + 1}. ${g}`).join("\n")}`
  const { output } = await callNvidiaWithFallback(
    system,
    [{ role: "user", content: message }],
    Math.max(25000, timeBudgetMs),
    effectiveModel,
    effectiveFallbacks || [],
    8000
  )
  const filled = extractJson(output)
  if (filled.__parse_failed) return null
  return filled
}

async function refineGeneration(result, userPrompt, effectiveModel, effectiveFallbacks, detectedType, projectName, qualityIssues = [], timeBudgetMs = 200000) {
  const refineStartedAt = Date.now()
  const rawDraft = JSON.stringify({
    type: "generation",
    title: result.title,
    summary: result.summary,
    notes: result.notes,
    warnings: result.warnings,
    suggestions: result.suggestions,
    instances: result.instances,
    deletions: result.deletions,
    scripts: result.scripts,
    animations: result.animations,
    cinematics: result.cinematics,
    audio: result.audio,
    sound_assets: result.sound_assets,
    mesh_assets: result.mesh_assets,
    plan: result.plan,
  })

  const focusNote = detectedType && detectedType !== "scripting"
    ? `\nThe requested focus type is "${detectedType}" — apply its quality bar strictly.`
    : ""

  const gateNote = qualityIssues.length > 0
    ? `\n\nMANDATORY FIXES (automated quality gates flagged these — resolve EVERY one):\n${qualityIssues.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : ""

  const message =
    `Original user request: ${userPrompt}\n` +
    (projectName ? `Project: ${projectName}\n` : "") +
    `First-draft generation to critique and improve:\n\n${rawDraft}` +
    focusNote +
    gateNote

  try {
    const { output, model: usedModel, fellBack } = await callNvidiaWithFallback(
      REFINE_SYSTEM,
      [{ role: "user", content: message }],
      Math.max(30000, timeBudgetMs),
      effectiveModel,
      effectiveFallbacks,
      12000
    )

    const refined = extractJson(output)
    if (refined.__parse_failed || refined.type !== "generation") {
      console.warn("[refineGeneration] refined output unparseable or wrong type — keeping draft")
      return result
    }

    // Anti-regression: refinement must never DELETE whole categories the draft delivered.
    const SUBSTANCE_FIELDS = ["instances", "scripts", "animations", "cinematics", "audio", "sound_assets", "mesh_assets"]
    for (const f of SUBSTANCE_FIELDS) {
      const before = Array.isArray(result[f]) ? result[f].length : 0
      const after = Array.isArray(refined[f]) ? refined[f].length : 0
      if (before > 0 && after === 0) {
        console.warn(`[refineGeneration] refined dropped ${f} (${before} items) — restoring from draft`)
        refined[f] = result[f]
      }
    }

    // Gate re-check: if CRITICAL/NO-section issues survive the polish pass,
    // make one surgical fill-in call that produces ONLY the missing arrays.
    const gaps = assessQuality(refined, detectedType).filter(q => /^(CRITICAL|NO )/.test(q))
    const refineElapsed = Date.now() - refineStartedAt
    const fillBudget = Math.min(45000, timeBudgetMs - refineElapsed - 5000)
    if (gaps.length > 0 && fillBudget > 25000) {
      try {
        console.log("[refineGeneration] gates still failing after polish — surgical fill:", gaps.join(" | "))
        const filled = await fillMissingSections(refined, userPrompt, gaps, effectiveModel, effectiveFallbacks, fillBudget)
        if (filled) {
          for (const f of SUBSTANCE_FIELDS) {
            if (Array.isArray(filled[f]) && filled[f].length > 0 && (!Array.isArray(refined[f]) || refined[f].length === 0)) {
              refined[f] = filled[f]
            }
          }
        }
      } catch (e) {
        console.warn("[refineGeneration] fill-in pass failed:", e.message)
      }
    }

    // Carry the polish data that normaliseResponse adds, so refined sections
    // still get the same safety passes.
    refined.__model = usedModel
    refined.__provider = providerLabel(usedModel)
    refined.__fallback_used = fellBack
    refined.__eff_type = result.__eff_type
    if (Array.isArray(refined.warnings) && Array.isArray(result.warnings)) {
      refined.warnings = [...new Set([...result.warnings, ...refined.warnings])]
    }
    refined.__refined = { used: true, model: usedModel }
    console.log("[refineGeneration] refinement accepted — model:", usedModel)
    return refined
  } catch (e) {
    console.error("[refineGeneration] refinement pass failed:", e.message)
    result.__refined = { used: false, error: e.message }
    return result
  }
}

const TYPE_FOCUS = {
  animation: `## CURRENT FOCUS: ANIMATION — AAA QUALITY BAR
MANDATORY FORMAT: animations[] MUST contain the motion as structured keyframe data (at least one entry, 8+ dense eased keyframes). NEVER author the motion as pose tables or CFrame lerp code inside Luau scripts — scripts[] may only TRIGGER/PLAY what animations[] defines. An animations[]-empty response is a failed response no matter how good its scripts are.
The user explicitly wants an ANIMATION. Deliver your primary result in animations[] as a full professional KeyframeSequence. If supporting scripts/instances are needed (a character to animate, a control script to trigger the animation), include them too, but the animation itself is the star — dense, believable, loop-safe keyframes with full joint coverage.

SENIOR MOTION DOCTRINE (a hired animator would reject anything below this):
- KEY EVERY JOINT THAT MOVES, INCLUDE ITS SUB-SEGMENTS: an arm swing = RightUpperArm + RightLowerArm + RightHand keyed at every frame where the arm is in motion (never key the upper arm only and let the forearm hang). Add the counter element (torso, opposite arm, or hips) so the body doesn't read as a puppet with one limb.
- POSE READS FIRST: each keyframe must be a clear, readable pose on its own (silhouette test). If two keyframes look identical, remove one. Extreme poses go at the extremes; neutral poses hold the in-betweens.
- TIMING IS THE CRAFT: slow anticipation, FAST action, soft settle. A swing that takes 1s must spend ~0.2s loading, ~0.1s snapping, ~0.7s recovering — never uniform spacing. Vary spacing aggressively; cluster keyframes where speed changes.
- ARC EVERYTHING: limbs travel on arcs. Between an arm raised forward and raised up, insert an intermediate euler that traces the curve — never a straight-line interpolation between extreme values.
- OVERLAP & SECONDARY: hands/feet/hair LAG the main limb by 1-2 frames' worth of eased delay. The wrist continues when the arm stops (follow-through).
- WEIGHT = SPEED SHAPING: heavy objects/characters move slower with bigger ease "in"/"out" and more settle; light ones start fast, decelerate, float.
- LOOP SEAMS: for loop=true, final keyframe pose MUST equal the first (pose AND root), and the LAST keyframe's ease must flow INTO the first (use "out"/"inout" on the seam) so the cycle re-seams without a pop. A walk/run needs a full stride (both legs) per loop.
- ROOT WORK: walks/runs get root bounce (HumanoidRootPart pitch), stride translation in "move", and torso counter-rotation to the hips. Idle gets breathing root movement, never frozen.
- JOINT-SAFE ANGLES: never exceed plausible mechanical range (elbows/knees bend 0-160deg, wrists 0-90deg, neck 0-45deg). Keep euler magnitudes in -90..90 unless a pose genuinely needs more.

MOON ANIMATOR CRAFT (the plugin writes your keyframes into Moon Animator as a real KeyframeSequence — write like a Moon Animator user, not a code dumper):
- POSE-TO-POSE, NOT CHAOS: key the EXTREME poses first (the readable silhouettes: wind-up, strike, land), then BREAKDOWN poses (the transition midpoints that define the arc and weight), then the in-betweens. Your keyframe list must visibly alternate extremes and breakdowns — that is what Moon Animator users do with the timeline.
- CONTACT / PASSING / UP / DOWN (locomotion): a proper walk/run cycle keys CONTACT (foot flat on the ground), PASSING (weight directly over the planted foot), UP (highest body point), DOWN (lowest). Feet plant, pass under the body, then leave the ground. No cycle reads as walking without these four beats keyed.
- EASING IS THE MOON ANIMATOR TIMELINE: pick the ease that matches the motion's physics — "in" = accelerating (gravity fall, snap-down), "out" = decelerating (landing settle, easing out of a push), "inout" = pivots and constant-speed travels, "linear" only for mechanical. Moon Animator users tune curves per keyframe; your per-keyframe ease does the same job.
- ANTICIPATION, ACTION, FOLLOW-THROUGH PROPORTIONS: an action should spend roughly 15% loading, 35-40% on the main move, 45-50% recovering/settling. Secondary parts (lower arm, hand, hair-equivalents like a tail) LAG the primary limb by one frame of eased delay — key them slightly out of phase, not copied.
- OVERLAP AND DRAG: the wrist keeps moving after the arm stops (follow-through), the foot drags at the end of its stride, the head trails the spine. Every extremity should overshoot its final pose slightly then ease back.
- EXAGGERATION TO READ: AAA games read because poses are pushed — a punch drives the shoulder past the target line, a landing sinks deeper than mechanical necessity. If the motion is barely visible, double the angle, then dial back 20%.
- WEIGHT LANGUAGE: mass shows in the ROOT. A heavy character's root sinks before every footfall and settles after; a light one floats. A 200kg robot and a fairy do not share a walk cycle.
- SILHOUETTE TEST: every keyframe must read as a clear pose as a black silhouette. If a frame is a blob, it's a bad pose — separate the limbs from the torso.
- MOON ANIMATOR LOOPING: Moon Animator loops by repeating the sequence. loop=true means keyframe 1 and the last keyframe MUST be the exact same pose (identical eulers on every joint) AND the root "move" must total zero over the loop (or exactly one stride). Otherwise the cycle pops in the editor.
- FPS SENSE: 30fps is the Moon Animator default and your fps field. Key on whole-frame times (0.0, 0.1, 0.2...) so the sequence lands on real frames; sub-frame times (0.133) interpolate but reduce editability.

EXTENDED MOTION REFERENCE (add to the base library — adapt, don't copy):
- SWORD SLASH (right-handed): load 0.15s (arm pulled back over right shoulder, torso coils -15deg) -> diagonal chop 0.12s (arm extends across, torso uncoils +20deg, follow-through carries the blade low-left) -> hold 0.2s -> recover. Key upper+lower arm, hand, torso lean, slight neck tilt. Arc through intermediate values; the blade tip reads as cutting a curve.
- SPELLCAST: raise BOTH arms to chest height 0.4s (palms out, elbows bent), gather (hands converge, torso leans back slightly, anticipation), then thrust forward 0.15s with hands extended, fingers (hand) spread, head follows. Optional float (root rise) during gather.
- DODGE ROLL: crouch 0.15s -> tuck (arms in, knees 80-100deg, root drops and translates forward, torso pitches forward over ~0.35s) -> unroll to standing with settle. Whole-body keyframes; fast.
- SPRINT: like run but aggressive: hips +/-50deg, elbows locked ~90deg pumping, fists pumped (key hands), root pitch forward -8deg, move stride larger, arms OPPOSITE legs.
- DEATH (ragdoll-style): knees buckle 0.2s, root drops, torso pitches back +25deg, arms flail outward (key upper+lower+hand), head back, then final settle onto ground (root move down). Slow the last keyframes for weight.
- GET UP: push up on hands (arms extended, legs trailing), lift chest, rise to knees, one foot down, stand. Key the weight shift.
- SIT: lower the body via knees/hips (key legs + root), arms relax to lap/armrest, head forward slightly. Loopable idle variant.
- CARRY WALK: walk cycle + both arms forward holding an invisible load: elbows bent ~60deg, hands at chest height, root more upright, shorter stride, slower.
- RIFLE AIM/SHOOT: stance (feet staggered), arms bring rifle to shoulder 0.3s, aim hold (micro sway on hands), recoil punch 0.06s (both arms kick back +4-6deg, root slight recoil), recover. Loop for auto-fire.
- EMOTE DANCE (floss/like/turkey-based): the VALUE is off-beat limb phase + snap on the beat. Root bounces on beat, arms hit accents 1-2 frames late, knees micro-bounce, head pops.

QUALITY CHECKLIST BEFORE YOU OUTPUT (every animation):
1. At least 3-4 joints keyed per moving limb (upper+lower+extremity+counter).
2. 6-12 keyframes per second; never fewer than 5 total.
3. Every keyframe has ease; motion starts from rest ("in"/"inout").
4. loop=true -> first==last pose exactly.
5. No joint exceeds mechanical range; no NaN; eulers in degrees.
6. Non-rig object? Then a clean 1-3 pose track + "move" for translation is acceptable — but object slides still need eased start/stop.`,
  cinematic: `## CURRENT FOCUS: CINEMATIC SEQUENCE — AAA QUALITY BAR
The user explicitly wants a CINEMATIC SCENE / SHOWCASE (anime-style attack, cutscene, trailer moment, dramatic entrance). Deliver your primary result in cinematics[] as a full choreographed sequence, AND the animation[]/VFX/scripts[] it showcases, all timed to the same clock. Use the CINEMATIC LIBRARY schema and rules in the system prompt. The plugin builds a LocalScript from your cinematics[] data — you only author the data.

SENIOR CINEMATOGRAPHY DOCTRINE (a trailer editor would reject anything below this):
- SHOT ARCS, NOT STATIC FRAMES: every shot starts in one place and ends in another. No frozen cameras. A 2s "hold" still has micro-drift toward the subject.
- THREE-BEAT SCENES: charge (slow push-in / orbit) → release (fast whip/zoom + fov punch + shake + flash) → aftermath (low-angle slow settle + lighting return). This rhythm IS the craft.
- IMPACT SYNCHRONIZATION: the strike frame gets a fast short shot (0.2-0.5s), a fov punch (up to 90+), a shake burst (0.5-1.2 amplitude for 0.3-0.5s), and a flash (white, 0.1-0.2s, opacity 1) — ALL AT THE SAME time value.
- ORBITS SHOW OFF: for 3D attacks use a shot whose pos circles the target while lookAt stays on it (camera "target" field + rotating pos). Never orbit at full speed the whole scene.
- SHAKE IS CAUSED, NOT CONSTANT: amplitude ramps into an impact and settles after. Between impacts shake = 0.
- FLASHES ARE PUNCTUATION: white for impact, colored (matching the attack glow) for the release/afterglow. 0.1-0.25s, opacity 0.8-1. Never more than one flash per beat.
- LIGHTING TELLS THE STORY: dark/cool ambient during the charge (brightness ~0.5-0.8, blue/purple ambient), flare brighter + shorter fog at release, return to a brighter neutral in the aftermath. Sync the lighting key to the shot that shows the release.
- SCENE LENGTH: 4-15s. A 6s scene = 4-6 shots, 2-4 flashes, 2-3 lighting keys. Never exceed 20s unless the user asked for a full cutscene.
- EVERY SECOND OF SCENE = 1-2 SHOTS MAX during slow beats; the release can cram 2 shots into 1 second. Fast beats get fast shots.

ANIME ULTIMATE ATTACK RECIPE (Excalibur / Kamehameha style) — adapt to the user's move:
- 0.0s PUSH-IN: camera low-front of the attacker, fov 65, pos ahead-below, lookAt torso. Lighting dark blue/purple, brightness 0.7, fogEnd 250. Charge VFX (aura emitters, ramping PointLight) + charge animation pose start.
- 1.5s ORBIT: pos circles the target, lookAt fixed on the torso, fov 60, shake 0.15 (build). Glow intensifies; animation reaches the wind-up pose.
- 3.0s RELEASE WHIP: 0.3s fast whip to the side + fov 85 + shake 0.8/10Hz, WHITE flash 0.15s. Beam/attack VFX fires (scripts[]) + attack animation snap.
- 3.6s IMPACT: camera at the impact area, shake 1.2/12Hz for 0.4s, colored flash matching the beam, shockwave VFX.
- 5.0s AFTERMATH: low-angle slow push-in, fov 55, lighting returns brighter/neutral, smoke/debris linger.
- All timings line up with the animations[] and VFX/scripts[] in the SAME response.

QUALITY CHECKLIST BEFORE YOU OUTPUT (every cinematic):
1. duration >= last shot/flash/lighting end time.
2. Shots have pos+lookAt (or target tracking), fov, ease, and time+duration — every field.
3. Fast beats use "in" ease, settles use "out", orbits use "inout".
4. At least one shake burst exactly at an impact time, 0 shake elsewhere.
5. Flashes time-matched to impact shots; colored flashes match attack color.
6. Lighting keys at charge (dark) and release (flare); a beat of contrast between them.
7. The showcased animation[]/VFX exist in the same response and share the same timestamps.`,
  vfx: `## CURRENT FOCUS: VFX — AAA QUALITY BAR
The user explicitly wants VISUAL EFFECTS. Deliver a professional-grade effect using the VFX LIBRARY below. Real ParticleEmitter/Beam/Trail instances with fully tuned properties (never defaults), anchored on Attachment instances, wrapped in pcall, parented to a VFX_<Effect> Folder in Workspace, triggered via scripts[] and cleaned up. Never output a bare script that relies on placeholders.

SENIOR VFX DOCTRINE (an effects artist's checklist):
- FULLY TUNED EMITTER, NOT DEFAULTS: every emitter must set Rate, Speed, Lifetime, Size, Transparency, Color, Rotation, SpreadAngle, EmissionDirection, LightEmission, LightInfluence, Drag, Gravity, Shape, ShapeStyle, and when relevant VelocityInheritance. Zero of these may be left at defaults.
- RICH CURVES: use 3-5 keypoint ColorSequence/NumberSequence (not 2) for gradients that read as "lit": fire (white-hot core -> orange -> deep red -> dark), magic (bright edge -> mid glow -> transparent). Multi-keypoint = the difference between cheap and expensive-looking.
- VOLUME VIA SHAPE, NOT JUST EMISSION: set emitter Shape = Enum.ParticleEmitterShape.Box/Sphere/Cylinder with proper Size for fills and bursts; ShapeStyle = Surface for even emission. Combine 2-3 emitters (core + glow + sparks) instead of one busy emitter.
- ATTACHMENTS ALWAYS: parent emitters to real Attachment instances (on HumanoidRootPart or a named Part), never to a Part directly, and never raw CFrames in the emitter logic. WeldConstraint when on moving models so effects follow motion.
- LIGHT IS HALF THE EFFECT: pair every big effect with a PointLight/SpotLight (set Range, Brightness, Color, and animate brightness via tween) — a fire without warm light reads as flat. Never leave default white 1.0.
- PERFORMANCE BUDGET (a real game ships this): keep total visible particles under ~500; avoid emitting every frame; reuse one emitter with EmitCount bursts for one-shots (explosion, muzzle flash); always emitter:Clear() + destroy after lifetime; throttle repeated effects (Touched, RemoteEvent, MouseButton1Click) with a cooldown.
- CHOREOGRAPHY: big effects get layers (flash -> blast -> debris -> smoke afterglow), each delayed 0.05-0.15s. Layer the timing, don't fire everything at once. Camera shake for impacts, brief.
- CLEANUP: effects must despawn (delay loops with a lifetime, destroy() at the end). No particle leak, no orphaned lights.
- SCRIPT-BASED FX are welcome for beams/rings/shockwaves (tween Size/Transparency/CFrame) — see the ADVANCED PROFESSIONAL EFFECTS section.

EXTENDED RECIPES (add to the base library):
- LEVEL-UP / SKILL UNLOCK: rising pillar emitter (vertical beam, gold) + expanding ring (tweened flat cylinder) + orbiting sparks (Shape=Sphere, small, short lifetime) + golden PointLight that flares and fades + a few confetti particles. Layered timing 0.05s apart.
- FROST / ICE CRYSTALS: slow white-blue emitter (very low rate, high lifetime, big spread, low speed) + 2-4 crystal WedgeParts (Glass/Neon light-blue) that tween in scale + cold mist (blue-grey, slow, lightinfluence high). Light color (150,220,255).
- FIREWORK: launcher tube flash -> single rising particle -> at peak: EmitCount burst ring (thin, long-lifetime) + wide second burst (color = user's choice) + fading PointLight + brief small debris. Delay phases with task.delay.
- HEAL / SIPHON BEAM: Beam from caster to target (green for heal, red for drain) with LightEmission, Width animated 0.3-0.8, animated Color via tween, receiving impact emitter at target + sparkle rise on the healed player.
- VOID / BLACKHOLE: swirl emitter (Shape=Sphere, Rotation spinning, dark purple) + attraction: a Gravity source or pulling tween on nearby parts + edge glow ring (Beam torus) + purple PointLight that pulses. Sinister color (60,20,90) -> (120,80,255).
- SONIC / SPEED STREAKS: thin long-lived emitter (Stretch, VelocityParallel, light-blue) shooting horizontally + ground dust behind + subtle screen shake + small wind beams (Beam) on the sides.
- ELECTRIC HARNESS / CHARGE UP: surrounding beam arcs (2-4 Lightning beams from body to air), crackling sparks (fast, low rate), cyan PointLight flickering via task.delay loop, small sparks jumping to nearby parts. Build-up -> flash -> release (EmitCount burst).
- ELECTRIC FIELD: torus-shaped emitter (Shape=Torus, Rotation=Vector3.new(0,0,1), inner/outer radius animated) with blue-purple gradient, central PointLight that pulses rhythmically, small static sparks at torus edge. Active zone damage area. Toggle on/off via RemoteEvent.
- PLASMA BURST: spheroid emitter (Shape=Sphere, high Rate, medium Speed, short Lifetime) with dynamic ColorSequence (violet->white->transparent), central PointLight that intensifies then fades, ring-shaped shockwave Beam that expands then contracts. Used for ultimate abilities.
- FROST / ICE CRYSTALS: slow white-blue emitter (very low rate, high lifetime, big spread, low speed) + 2-4 crystal WedgeParts (Glass/Neon light-blue) that tween in scale + cold mist (blue-grey, slow, lightinfluence high). Light color (150,220,255). Crystals shatter on duration end.
- LAVA: slow bubbling emitter (orange-red, low rate, high lifetime, big size, slow speed, Gravity up) + ember sparks + glow PointLight (orange) + brief steam wisps when touched.
- DUST KICK (footsteps, landing, movement): small flat quick-fade grey-brown emitter at foot/impact point, Speed low, Lifetime short, Rate bursts on step. Subtle = premium.

WHEN WRITING EFFECTS:
- Always wrap creation in pcall and parent to a clearly named Folder "VFX_<Effect>" in Workspace so the user can find/tweak it.
- For repeated effects (attacks, connecting), connect to the relevant event (Touched, RemoteEvent, MouseButton1Click) and throttle/cleanup: emitter:Clear() when done, destroy after lifetime.`,
  sound: `## CURRENT FOCUS: SOUND DESIGN & AUDIO — AAA QUALITY BAR
The user explicitly wants SOUND / MUSIC / AUDIO (sound effects, footsteps, ambience, music, voices, announcements). Deliver a professional audio system using the audio[] field (structured Sound data) PLUS the supporting instances[]/scripts[] of the SOUND ENGINE section in the system prompt. The plugin builds real Sound instances, SoundGroups (mix buses), echo zones and a VolumeController from your audio[] — never a bare script with placeholders.

SOUND SOURCES — TWO OPTIONS (use BOTH where they fit):
1. GENERATED (preferred for SFX archetypes): emit sound_assets[] entries and reference them from audio[] with "generated:<id>" (see GENERATED SOUND ASSETS in the system prompt). ANY request for an archetype sfx (explosion, whoosh, coin, levelup, footsteps sfx, UI click, magic, laser...) MUST include at least one sound_assets[] entry — a sound-effect request answered without sound_assets[] is INCOMPLETE.
2. LIBRARY: real Roblox rbxassetid:// ids for music loops, ambience and voice (no procedural archetype exists for these).

AAA SOUND DOCTRINE (a game-audio lead's checklist — reject anything below this):
- EVERY SOUND IS DESIGNED, NOT DEFAULTED: each audio[] entry sets SoundId (a "generated:<id>" reference or REAL library asset, never "123456789"), Volume, PlaybackSpeed, RollOffMaxDistance, and rolls off properly (so sounds fade with distance instead of being global). LAYER, don't bloat: a "sword swing" = 2 layers (whoosh + subtle metallic ring); an explosion = 3 layers (deep boom + crackle + debris rattle).
- FOUR DISTINCT ELEMENTS: one-shots (sfx, burst), loops (ambient/music), footsteps (material-aware, stride-synced), and voices/announcers (announcement lines). Design each for its job: loops must start at silence-safe points; one-shots must be short; footsteps must fit a Humanoid stride, not fire every frame.
- MIX BUSES (SoundGroups) ALWAYS: create the "SFX" (volume 1.0), "Music" (0.5), "Voice" (0.9), "UI" (0.7) buses in instances[] and assign EVERY sound to exactly one. A VolumeController script reads a RemoteEvent (or a NumberValue "MasterVolume" in SoundService) and drives each bus so players can mix the game. This is the difference between a game and a demo.
- FOOTSTEP SYSTEM MATCHES MATERIAL: raycast below the HumanoidRootPart on a stride cooldown (~0.5s walk / ~0.35s run — tie to speed), index a material = sound map (concrete/wood/grass/gravel/metal/water), and play with modest random pitch (0.95-1.05) so steps never feel robotic. Distinct "step" per left/right foot loop.
- MUSIC IS SCORED, NOT PLAYED: provide a music loop (looping ambient) plus, when the user wants drama, a simple two-layer music system (calm + intense) switched when a state changes (combat, boss, win). Fade (tween Volume) in/out on transitions — never hard-switch.
- DUCKING & PRIORITY: when a voice/announcer plays, duck (lower) the music/SFX briefly. Use sound.Priority (Enum.SoundPriority.Medium/High) and PlaybackSpeed shifts for variety.
- TRIGGERS ARE EVENTS, NOT FRAMES: wire audio[] entries to real events listed in trigger (Humanoid.Running, ProximityPrompt.Triggered, RemoteEvent / MouseButton1/Click, Touched, etc.) with a cooldown; connect and :Disconnect() properly. One-shots call :Play(); loops call :Play() once and only :Stop() when done.
- ECHO/SPACE (optional, CINEMATIC): SoundReverb in a zone (dungeon, cave, cathedral), reverbTime/distortion tuned, and place the Sound with SoundGroup + RollOff for depth.
- AAA AUDIO CHECKLIST:
1. Every audio[] entry has a real SoundId, kind, volume, and a SoundGroup assignment.
2. Footsteps: material-aware map + stride cooldown + pitch variance.
3. Music: loops; layered calm/intense with volume fades; ducked under announcers.
4. No sound fires every frame; all have triggers; all cleanly stop/disconnect.
5. Mix buses SFX/Music/Voice/UI + VolumeController exist in the same response.`,
  model3d: `## CURRENT FOCUS: 3D MODEL — AAA QUALITY BAR
The user explicitly wants a 3D MODEL/OBJECT. Construct it as a proper multi-part assembly using the 3D MODEL CONSTRUCTION section below: every part in instances[] with real Material/Color/Size/Position, semantic names, a WeldScript that welds and sets PrimaryPart, and gameplay scripts when the object is usable. A single Part is not acceptable for a "model" request.

SENIOR MODELING DOCTRINE (a modeler's quality bar):
- PROPORTION FIRST: use real reference scale. Humanoid ~7.5 heads tall, head ~1.4 studs; a door 7-8 studs tall, 3-3.5 wide; a car ~4.5 long x 2 wide x 1.4 high, wheels 1.1 diameter; a sword blade ~2/3 of total length; a gun length ~3.2 studs. If proportions are off the model looks broken at a glance.
- MINIMUM PART DENSITY (a "model" is an assembly, not a brick — AAA bar, go HIGHER for hero objects): sword/katana >= 12 (segmented grip wrap, fuller line, flared guard tips, gem pommel), gun >= 15 (receiver split with seam, vent rows, optic assembly, muzzle device), door >= 6, tree >= 8 (tapered trunk segments + root flares + layered varied canopy), crate/chest >= 10 (corner brackets, rivets, plank lines, latch assembly), car >= 20 (panel gaps, mirrors, grille rows, hubcaps, brake discs, exhausts, light lenses), house >= 25 (trim columns, tiered WedgePart roof, framed windows with sill+glass, chimney, gutters), robot/turret >= 18 (two-stage hydraulic joints, overlapping armor plates, bolt rings, glow core + PointLight), character prop >= 12, furniture >= 8, bridge >= 12, statue >= 12. Detail passes (bolts/seams/chamfers/panel lines) count toward the total and are REQUIRED, not optional.
- DETAIL PASSES IN ORDER: silhouette -> panel lines (ultra-thin dark parts ~0.05 studs) -> edge chamfers (WedgeParts/insets) -> material mix (primary + accent + max ONE hero emissive) -> greebles for machinery (pipes, grilles as rows of tiny boxes, two-stage cylinders).
- MESH ASSETS FIRST FOR CURVES: blades, crystals, barrels, vases, rocks and any organic silhouette should use mesh_assets[] procedural geometry ("mesh": "<id>" on the Part entry), combined with part-built mechanical details. Hybrid mesh+parts reads AAA; stacked boxes read amateur.
- BEVELS & SHAPE: avoid harsh boxy silhouettes — use WedgeParts for bevels, thin trim Parts for seams, and UnionOperation (CSG) only when two parts truly intersect and must appear fused. Tilt parts (Orientation) for angled surfaces; never leave a flat seam where a 45deg bevel reads better.
- Z-FIGHTING BAN: never stack two coplanar faces at the same position (glass on window frame must be inset by >= 0.02 studs; trim on walls offset outward). Overlapping coplanar surfaces flicker in-engine.
- MATERIALS PER FUNCTION: Metal for mechanical, Wood/SmoothWood for timber, Glass (with Transparency ~0.6-0.75) for windows, Neon + LightEmission for emissive/energy parts, Stone/Slate/Concrete for architecture, SmoothPlastic for toys/characters. Never all-default Plastic.
- COLOR PALETTE: 2-3 harmonious base colors + 1 accent. A sword is not "grey" — it's steel (90,95,105) blade, brass (200,165,70) guard, dark wood (70,45,30) handle, neon edge if magic.
- SYMMETRY & NAMING: mirror left/right detail (L/R pairs), name parts semantically (Blade, Handle, Chassis, Hood, R_Wheel). A reviewer finds every part by name.
- ALWAYS: PrimaryPart set, WeldScript welds every part, CanCollide/Anchored correct (static world props anchored; held/wielded parts unanchored + welded to the grip), offsets so parts interlock without visible gaps.

EXTENDED RECIPES (add to the base library):
- TURRET / ROBOT: base (metal cylinder) + rotating head/turret (Sphere/cylinder, welded but free to rotate via HingeConstraint or a motor) + arm/cannon (barrel Part + muzzle Attachment) + eye (Neon) + vents (thin dark trim). Give it a scan/aim script with visible rotation.
- HELICOPTER: fuselage (streamlined: wedge nose + box body) + tail boom + tail rotor (thin) + main rotor (flat disc + hub) + skids + windshield (Glass) + searchlight. Rotor spins via script.
- BOW: grip + two curved limbs (WedgeParts angled) + string (thin dark Part) + arrow prop (shaft + tip + fletching) + optional glow nock. Draw + fire script.
- SHIELD: face plate (oval/round) + rim (toroidal via stacked WedgeParts) + boss + grip bar + optional emblem (Neon) + paint trim.
- BOSS / LARGE ENEMY: oversized torso + limbs with thicker proportions + armor plates (offset trim parts, metal) + glow veins (Neon strips) + horns/claws (WedgeParts) + a PointLight. Scale reads intimidation.
- WALL / STRUCTURE: foundation + wall panels (with brick texture feel via Stone) + pillars + top trim + window/door frame openings (inset trim, Glass). Mortar look via thin dark trim lines.
- FURNITURE: chair (seat + 4 legs + backrest + armrests + padding cushions), table (top + skirt + 4 legs + optional shelf), bed (frame + mattress + pillows + blanket + headboard). Cushions slightly overlapping, softer materials.
- ROCKS / TERRAIN PROPS: irregular cluster of 3-6 WedgeParts/cylinders, varied orientations, 2-3 stone tones, subtle moss (green tint on top). No perfect cubes.
- STATUE / DECOR: base plinth + tapered body (WedgeParts) + head + arms + details (gems as Neon) + weathered trim. Monumental scale.
- STORAGE CRATE VARIANT: lidded crate (6 panels) + metal bands (thin dark strips on corners) + lock plate + rope handle; lid opens via HingeConstraint + script.

QUALITY CHECKLIST BEFORE YOU OUTPUT (every model):
1. Part count meets the density bar above.
2. Proportions match reference scale; nothing reads as a single brick.
3. Materials + a 2-3 color palette with 1 accent; emissive parts Neon.
4. No coplanar z-fighting faces; bevels where the silhouette would be boxy.
5. PrimaryPart + WeldScript; names are semantic; L/R mirrored.
6. Gameplay script included when the object is usable/moving.`,
  obby: `## CURRENT FOCUS: OBBY / OBSTACLE COURSE — THE SEQUENCED JUMP COURSE DOCTRINE
The user asked for an OBBY (obstacle course / parkour / jump course). This is a SPECIALISED game: a single skill-based jump line from START to FINISH. Your WHOLE budget goes into the obstacle layout, spawning and the two gameplay scripts. Do NOT spread tokens across VFX, audio, animations or a cinematic — an obby does not need them, and adding them starves the course itself (that is exactly what makes bad obbies: 3 platforms dumped at random).

WHAT A GOOD OBBY NEEDS (deliver ALL of these):
1. OBSTACLE LINE (instances[] — the star): 15-30 platforms forming the run length, each a Part/MeshPart with explicit Size, Position and Material in Workspace. Lay them out as a real jump course:
   - Start platform (wide, flat, at a low elevation, with a SpawnLocation on it).
   - A sequential chain where each platform is reachable by a jump from the previous one (2-4 studs higher, 5-12 studs ahead — never out of humanoid reach, never overlapping).
   - Vary the obstacles: long jumps, vertical climbs, narrow beams, moving platforms, lava-touch kill zones, spinners, slides — at least 3 different obstacle types mixed in.
   - Every obstacle has a Color or Material that reads against the skybox (bright palette, no two adjacent same the same hue).
   - A FINISH platform (distinct color, with a big checkered goal that triggers the win).
2. SPAWN (instances[]): a SpawnLocation at the start with Neutral=true, teamless. Set the course up so falling cancels reset to the start or last checkpoint.
3. DEATH/CHECKPOINT SYSTEM (scripts[]): the core of an obby. A server script that:
   - Detects when a player's Humanoid dies or the character falls below the course (a kill floor / bounds check).
   - Respawns them at the START or last checkpoint (checkpoint parts placed every 4-6 obstacles).
   - A checkpoint part stores the player's respawn point (per-player, not global).
   - The FINISH (win) part fires a win: clears the obby / triggers a victory message, optionally awards a leaderstat (e.g. "ObbyWins").
4. CHECKPOINT INSTANCES (instances[]): 2-4 evenly spaced Checkpoint parts with a visible color (e.g. green glow) and a ProximityPrompt or Touched trigger.
5. LIGHTING (instances[] or properties): set a pleasant mood — Sky/Atmosphere, Lighting.FogEnd/Brightness, maybe a subtle ColorCorrection. Cheap, one or two instances, not a VFX system.
6. OPTIONAL (ONLY if the run is already complete and you have token left): a simple ScreenGui win banner. Never spend budget on VFX/audio/cinematics/animations — skip them entirely.

RULES:
- Every platform/obstacle MUST have a real Size + Position that makes a feasible, fair jump course. If positions are random/overlapping the build is a failure.
- Scripts MUST be complete Luau (not stubs), pcall-wrapped where touching anything risky, and wired: checkpoint script uses the checkpoint parts' names, win script uses the finish part's name.
- Keep notes[] short: state the challenge progression, not filler.
- If the user asked for "easy/facile", keep 12-15 platforms with generous landings; if "hard/difficile", 25-30 platforms with tighter jumps.

OUTPUT PRIORITY: obstacle line first and complete → spawn → death/checkpoint/win scripts → checkpoints → lighting → optional win banner. A complete 20-platform fair course with working respawn beats an ambitious 3-platform one with VFX.`,

  game: `## CURRENT FOCUS: FULL GAME KIT — ONE-PROMPT COMPLETE GAME
The user asked for a GAME (a full game, a game "like X", a game idea, a starter game, a world). This is Vexa's flagship mode: build a COMPLETE, playable starter game in a SINGLE response — not one system. The MULTI-DISCIPLINE AAA SHOWCASES doctrine applies to the whole game, scaled from one scene to a whole game. Everything must land in Studio together, wired to the same clock.

WHAT "COMPLETE" MEANS (deliver ALL of these in one response):
1. GAME IDENTITY: title (title field), a 2-3 sentence summary, and a clear core loop (e.g. collect -> spend -> upgrade -> fight -> repeat). Name the fantasy and the hook so it reads like a real game pitch.
2. WORLD STARTER (instances[]): a playable arena/map for the theme (island, arena, dungeon, town — base floor + barriers + landmarks built from Parts/WedgeParts), a SpawnLocation, Lighting config (ClockTime, FogEnd, Brightness, Ambient, OutdoorAmbient) that sells the mood, and 1-2 landmark setpieces. Strong, coherent art direction (palette, materials, mood) — never a gray box.
3. CORE SYSTEMS (scripts[] + instances[] + remotes, all server-authoritative): the main loop mechanics matching the genre (combat / fruit abilities / shooting / obby movement), currency + shop/buying with a ScreenGui UI + RemoteEvents + DataStore saving (pcall-wrapped with retry), progression (levels/XP/upgrades) with UI, Leaderstats for core stats, and shared config in ModuleScripts. RemoteEvent args validated on the server.
4. SIGNATURE 3D MODELS (mesh_assets[] + instances[]): the game's iconic object (the weapon/fruit/mount/base/mascot) as a procedural mesh referenced from a MeshPart instance (properties.Size), plus supporting detail parts (handles, glow, trim). Never a single Part.
5. THEMED VFX (scripts[] + instances[]): VFX for the core fantasy (attack/ability flashes, auras, ambient world effects: fire, portal, rain, magic) using the VFX LIBRARY — fully tuned emitters anchored on Attachment instances, parented to VFX_<Name> Folders, pcall-wrapped, always Clear()/destroyed after lifetime.
6. FULL AUDIO (sound_assets[] + audio[] + instances[]): procedural sound_assets[] for the loop's moments (attack whoosh, coin, level up, footstep, ambient) PLUS audio[] with mix buses (SFX/Music/Voice/UI SoundGroups + VolumeController) and a music layer (calm/intense pair + MusicDirector that fades on state). Every sound wired to a real trigger, never per-frame.
7. SIGNATURE ANIMATION (animations[]): the hero's key pose/attack — dense keyframes, 3-4 joints per moving limb, counter elements, loop-safe.
8. CINEMATIC INTRO (cinematics[]): a trailer moment for the game — title shot -> orbit showcase of the hero/landmark -> the signature attack (hitstop + flash + shake + whip) -> aftermath settle. Shots/flashes/lighting/slowmo/post/sounds/vfx synced to the SAME clock as the signature animation + VFX + audio. Under ~15s.
9. WIRED TOGETHER: the signature attack triggers its VFX + audio + animation on one clock; the intro cinematic plays via trigger "start"; progression and currency connect to the shop UI. A reviewer should be able to open the game and FEEL a real game, not a demo of scripts.

QUALITY BAR: every discipline at its AAA doctrine (see SENIOR doctrines above). This is the product's flagship output.

OUTPUT PRIORITY (your budget is finite — build in this order and NEVER let earlier tiers be incomplete to fund later ones):
- TIER 1 (mandatory, complete): world starter + SpawnLocation + Lighting, core loop systems (combat/movement mechanics) as FULL scripts, currency + shop UI + RemoteEvents, DataStore saving. A game without working core systems is a failure.
- TIER 2 (mandatory unless truly massive): leaderstats, progression/upgrades, signature mesh model + supporting parts.
- TIER 3 (include when budget remains): cinematic intro, audio system + sound_assets, signature animation, themed VFX. If you are running out of tokens, finish cleanly at the end of Tier 2 and list what to ask for next in notes[] (e.g. "Ask me for the ultimate-attack cinematic showcase"). Never truncate mid-script to squeeze Tier 3 in.`,

  plan: `## CURRENT FOCUS: PLAN
The user explicitly wants a PLAN, not code. Respond with type "plan" using the PLANNING schema — phases, data flow, scripts/instances needed, considerations. No Luau code.`,
}

export function buildTypeFocus(type) {
  const key = type && TYPE_FOCUS[type] ? type : ""
  return key ? TYPE_FOCUS[key] : ""
}

// Runtime QA probe shipped with heavy game/obby builds. Runs on the server at
// start, checks the built place against the same invariants Vexa enforces at
// generation, and posts a JSON report to the local Vexa Bridge
// (http://127.0.0.1:8765/api/mcp/collect) plus a Studio-readable mirror in
// ServerStorage.VexaQA.Report. Everything pcall-guarded: no bridge running →
// the probe silently no-ops.
function buildQAProbeLuau() {
  return [
    "-- Vexa QA probe v2: self-verifies this build at runtime.",
    "-- Writes the report to ServerStorage.VexaQA.Report (channel-proof: the",
    "-- plugin harvests it and forwards it to the bridge) and also POSTs to",
    "-- the bridge directly when the game has HTTP enabled.",
    "local HttpService = game:GetService(\"HttpService\")",
    "local LogService = game:GetService(\"LogService\")",
    "local ServerStorage = game:GetService(\"ServerStorage\")",
    "local Players = game:GetService(\"Players\")",
    "local Workspace = workspace",
    "",
    "local runId = HttpService:GenerateGUID(false)",
    "local report = { source = \"VexaQA\", runId = runId, time = os.time(), checks = {} }",
    "",
    "local errors = {}",
    "LogService.MessageOut:Connect(function(m)",
    "  local mt = m and m.type or nil",
    "  if mt == Enum.MessageType.MessageError and m.message then",
    "    table.insert(errors, tostring(m.message))",
"    if #errors > 8 then table.remove(errors, 1) end",
"  end",
"end)",
"",
"local humanoid, hp0",
"local function samplePlayer()",
"  if humanoid then return true end",
"  for _, p in ipairs(Players:GetPlayers()) do",
"    local c = p.Character or p.CharacterAdded:Wait(3)",
"    if c then",
"      local h = c:FindFirstChildOfClass(\"Humanoid\")",
"      if h then humanoid = h; hp0 = h.Health; return true end",
"    end",
"  end",
"  return false",
"end",
"",
"local function grab(name, fn)",
    "  local ok, val = pcall(fn)",
    "  if ok then report.checks[name] = val else report.checks[name] = \"error: \" .. tostring(val) end",
    "end",
    "",
    "local function reachableCourse()",
    "  local spawn = Workspace:FindFirstChildOfClass(\"SpawnLocation\")",
    "  if not spawn then return { reachable = false, chain = 0, total = 0 } end",
    "  local objects = {}",
    "  for _, p in ipairs(Workspace:GetDescendants()) do",
    "    if p:IsA(\"BasePart\") and p ~= spawn and p.CanCollide then",
    "      table.insert(objects, { name = tostring(p.Name), x = p.Position.X, y = p.Position.Y + 3, z = p.Position.Z })",
    "    end",
    "  end",
    "  local total = #objects",
    "  if total == 0 then return { reachable = true, chain = 1, total = 1 } end",
    "  local used = {}",
    "  local reached = 1",
    "  local cx, cy, cz = spawn.Position.X, spawn.Position.Y + 3, spawn.Position.Z",
    "  for _ = 1, math.min(total * 3, 600) do",
    "    local best, bestD = nil, 1e9",
    "    for i, o in ipairs(objects) do",
    "      if not used[i] then",
    "        local dy = o.y - cy",
    "        local horiz = ((o.x - cx) ^ 2 + (o.z - cz) ^ 2) ^ 0.5",
    "        if dy <= 7 and dy >= -7 and horiz <= 18 and horiz + math.abs(dy) < bestD then",
    "          best, bestD = i, horiz + math.abs(dy)",
    "        end",
    "      end",
    "    end",
    "    if not best then break end",
    "    used[best] = true",
    "    reached = reached + 1",
    "    cx, cy, cz = objects[best].x, objects[best].y, objects[best].z",
    "  end",
    "  return { reachable = reached >= total, chain = reached, total = total }",
    "end",
    "",
    "task.wait(5)",
    "",
    "grab(\"spawns\", function() return #Workspace:GetChildren() end)",
    "grab(\"spawnlocation\", function() return Workspace:FindFirstChildOfClass(\"SpawnLocation\") ~= nil end)",
    "grab(\"scripts\", function()",
    "  local n = 0",
    "  for _, s in ipairs(game:GetService(\"ServerScriptService\"):GetDescendants()) do",
    "    if s:IsA(\"LuaSource\") then n = n + 1 end",
    "  end",
    "  return n",
    "end)",
    "grab(\"remotes\", function() return #game:GetService(\"ReplicatedStorage\"):GetDescendants() end)",
    "grab(\"leaderstats\", function()",
    "  for _, p in ipairs(Players:GetPlayers()) do",
    "    local ls = p:FindFirstChild(\"leaderstats\")",
    "    if not ls then ls = p:WaitForChild(\"leaderstats\", 5) end",
    "    if ls and ls:FindFirstChild(\"Coins\") then return true end",
    "  end",
    "  return false",
    "end)",
    "grab(\"humanoid\", function()",
    "  return samplePlayer()",
    "end)",
    "grab(\"progression\", function()",
    "  local p = Players:GetPlayers()[1]",
    "  if not p then return false end",
    "  local ls = p:FindFirstChild(\"leaderstats\")",
    "  if not ls then ls = p:WaitForChild(\"leaderstats\", 3) end",
    "  if not ls then return false end",
    "  local before = {}",
    "  for _, v in ipairs(ls:GetChildren()) do",
    "    if v:IsA(\"NumberValue\") then before[v.Name] = v.Value end",
    "  end",
    "  samplePlayer()",
    "  task.wait(2)",
    "  for _, v in ipairs(ls:GetChildren()) do",
    "    if v:IsA(\"NumberValue\") and v.Value ~= (before[v.Name] or 0) then return true end",
    "  end",
    "  return false",
    "end)",
    "grab(\"combat\", function()",
    "  if not humanoid then return false end",
    "  return hp0 ~= nil and humanoid.Health < hp0 - 0.5",
    "end)",
    "grab(\"remotesDead\", function()",
    "  local replicas = {}",
    "  for _, d in ipairs(game:GetService(\"ReplicatedStorage\"):GetDescendants()) do",
    "    if d:IsA(\"RemoteEvent\") or d:IsA(\"RemoteFunction\") then",
    "      table.insert(replicas, tostring(d.Name))",
    "    end",
    "  end",
    "  if #replicas == 0 then return nil end",
    "  local sources = {}",
    "  for _, s in ipairs(game:GetService(\"ServerScriptService\"):GetDescendants()) do",
    "    if s:IsA(\"LuaSource\") then",
    "      local src = (type(s.Source) == \"string\") and s.Source or \"\"",
    "      table.insert(sources, src)",
    "    end",
    "  end",
    "  local dead = {}",
    "  for _, rn in ipairs(replicas) do",
    "    local found = false",
    "    for _, src in ipairs(sources) do",
    "      if string.find(src, rn, 1, true) then",
    "        found = true",
    "        break",
    "      end",
    "    end",
    "    if not found then",
    "      table.insert(dead, rn)",
    "      if #dead >= 5 then break end",
    "    end",
    "  end",
    "  if #dead > 0 then return dead end",
    "  return nil",
    "end)",
    "grab(\"course\", reachableCourse)",
    "task.wait(1)",
    "report.checks.errors = errors",
    "report.checks.noCrash = #errors == 0",
    "",
    "local text = HttpService:JSONEncode(report)",
    "",
    "local folder = ServerStorage:FindFirstChild(\"VexaQA\")",
    "if not folder then",
    "  folder = Instance.new(\"Folder\")",
    "  folder.Name = \"VexaQA\"",
    "  folder.Parent = ServerStorage",
    "end",
    "local stored = folder:FindFirstChild(\"Report\")",
    "if not stored then",
    "  stored = Instance.new(\"StringValue\")",
    "  stored.Name = \"Report\"",
    "  stored.Parent = folder",
    "end",
    "stored.Value = text",
    "",
    "if HttpService.HttpEnabled then",
    "  pcall(function()",
    "    HttpService:PostAsync(\"http://127.0.0.1:8765/api/mcp/collect\", text, \"application/json\")",
    "  end)",
    "end",
  ].join("\n")
}

export const TEAM_MODEL = "vexa-team"

// ── Vexa Team: one agent, many models working as a team ──
// Members: Qwen 3 (local code/systems specialist), Hunyuan3D 2.1 (local 3D
// mesh builder), and the configured cloud lead (architect). They share one
// blackboard: the coordinator writes a build brief, every member receives
// the brief + all previous members' outputs, and the builder assembles.
// Future members (stable-audio, ainvfx-fluid) slot in here once their local
// servers exist — the protocol already supports them.
const TEAM_FUTURE = []

function teamHasCloud() {
  return !!(process.env.NVIDIA_API_KEY || process.env.NVIDIA_GLM_API_KEY || process.env.NVIDIA_GLM_FLASH_API_KEY ||
    process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY)
}

const TEAM_3D_WORDS = /\b(3d|mesh|model|modello|character|personaggio|npc|statua|statue|creatura|creature|mostro|monster|animale|animal|veicolo|vehicle|robot|drago|dragon|\bobj\b|\bglb\b|\bfbx\b|sculpt|figura)\b/i

function teamTimeout(promise, ms, label) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(label + " timed out after " + Math.round(ms / 1000) + "s"))), ms)])
}

function cloudLeadModel() {
  const explicit = (process.env.VEXA_PRIMARY_MODEL || "").trim()
  if (explicit && explicit !== LOCAL_MODEL) return explicit
  if (process.env.ANTHROPIC_API_KEY) return "claude-sonnet-4-5"
  if (process.env.OPENAI_API_KEY) return "gpt-5"
  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) return "gemini-2.5-pro"
  if (process.env.NVIDIA_API_KEY || process.env.NVIDIA_GLM_API_KEY || process.env.NVIDIA_GLM_FLASH_API_KEY) return "z-ai/glm-5.3-flash"
  return ""
}

async function planTeamPass({ fullPrompt, effType }) {
  const qwen = !!process.env.LOCAL_LLM_URL
  const lead = cloudLeadModel()
  const cloud = !!lead
  if (!qwen && !cloud) return null
  // Only models that really participate. No cloud names in the roster
  // unless the cloud lead is actually building (Qwen offline).
  const members = []
  if (qwen) members.push(LOCAL_MODEL)
  else if (cloud) members.push(lead)
  const needs3d = effType === "model3d" || effType === "game" || TEAM_3D_WORDS.test(fullPrompt)
  let hunyuanAlive = false
  if (needs3d) {
    try { hunyuanAlive = await is3dServerAlive(HUNYUAN_MODEL) } catch { hunyuanAlive = false }
    if (hunyuanAlive && !members.includes(HUNYUAN_MODEL)) members.push(HUNYUAN_MODEL)
  }
  const audioAlive = await isAudioServerAlive().catch(() => false)
  const motionAlive = await isMotionServerAlive().catch(() => false)
  const vfxAlive = await isVfxServerAlive().catch(() => false)
  if (audioAlive && !members.includes(STABLE_AUDIO_MODEL)) members.push(STABLE_AUDIO_MODEL)
  if (motionAlive && !members.includes(KIMODO_MODEL)) members.push(KIMODO_MODEL)
  if (vfxAlive && !members.includes(AINVFX_MODEL)) members.push(AINVFX_MODEL)
  // Builder choice: Qwen first (user's pick), cloud lead only when Qwen is absent.
  const builder = qwen ? LOCAL_MODEL : lead
  const handoffs = []
  let brief = ""
  let briefBy = ""
  if (qwen) {
    // Qwen coordinates AND builds: brief first, then the full build reads it.
    handoffs.push("Qwen 3 (brief)")
    try {
      const { output } = await callNvidiaWithFallback(
        "You are the coordinator of the Vexa team: Qwen 3 (code/systems builder, local) and Hunyuan3D 2.1 (3D meshes, local). Reply with SHORT JSON only: {\"brief\": \"2-4 sentence build plan: systems, file/script names, data flow\", \"needs3d\": true/false}. No prose outside the JSON.",
        [{ role: "user", content: `Task type: ${effType}\nTask: ${fullPrompt.slice(0, 3000)}` }],
        120000, LOCAL_MODEL, [LOCAL_MODEL], 1200
      )
      const m = String(output || "").match(/\{[\s\S]*\}/)
      if (m) {
        try {
          const j = JSON.parse(m[0])
          if (j.brief) { brief = String(j.brief).slice(0, 1200); briefBy = "Qwen 3" }
        } catch { brief = String(output || "").slice(0, 1200); briefBy = "Qwen 3" }
      } else if (output) { brief = String(output).slice(0, 1200); briefBy = "Qwen 3" }
    } catch (e) {
      console.warn("[vexa-team] brief failed, building without it:", e.message)
    }
  } else {
    handoffs.push(`${shortTeamName(lead)} (solo — local Qwen offline)`)
  }
  return { brief, briefBy, builder, members, handoffs, hunyuanAlive, needs3d: needs3d && hunyuanAlive }
}

function shortTeamName(id) {
  if (!id) return "lead"
  if (id === LOCAL_MODEL) return "Qwen 3"
  if (id === HUNYUAN_MODEL) return "Hunyuan3D 2.1"
  return id.includes("/") ? id.split("/").pop() : id
}

export async function runGenerate({
  prompt,
  model,
  type,
  projectName = "",
  datamodel,
  gameModel,
  history,
  images = [],
  files = [],
  teamMode = true,
  thinkingLevel = "medium",
}) {
  console.log("[runGenerate] start — prompt:", prompt.slice(0, 100), "model:", model, "files:", files.length, "images:", images.length, "type:", type)

  const cleanHistory = (history || []).filter(msg => {
    if (msg.role === "user") return true
    if (msg.role === "assistant") {
      try {
        const d = JSON.parse(msg.content)
        return d.type === "generation" || d.type === "clarification" || d.type === "chat"
      } catch { return false }
    }
    return false
  })

  const context = buildContext(projectName, datamodel, gameModel)
  const scanContext = buildScanContext(gameModel, prompt)

  let fileContext = ""
  if (files && files.length > 0) {
    const fileParts = files.map(f => `### ${f.name}\n\`\`\`lua\n${f.content}\n\`\`\``)
    fileContext = `\n\n## Attached files:\n${fileParts.join("\n\n")}`
  }

  const fullPrompt = prompt + fileContext

  const lowPrompt = (" " + fullPrompt + " ").toLowerCase()
  const detectedType = detectRequestType(lowPrompt, type)

  // "Make me a game / a world like X" requests get the Creative Director pass:
  // the short idea becomes a full multi-discipline brief, and the whole build
  // runs on the big model with the FULL GAME KIT focus (world + systems +
  // models + VFX + audio + animations + cinematic intro, all in one response).
  // Obby/obstacle-course requests get a specialised focus (see TYPE_FOCUS.obby):
  // a sequenced jump course is funded entirely by its obstacle layout, so it
  // must NOT be diluted by the FULL GAME KIT's VFX/audio/cinematic tiers.
  const obbyRequest = isObbyRequest(fullPrompt)
  const gameRequest = isGameRequest(fullPrompt)
  const effType = obbyRequest ? "obby" : (gameRequest ? "game" : detectedType)

  const heavyRequest =
    effType === "game" ||
    effType === "obby" ||
    effType === "cinematic" ||
    effType === "animation" ||
    effType === "vfx" ||
    effType === "model3d" ||
    effType === "sound"

  const focusType = effType === "scripting" ? "" : effType
  const typeFocus = buildTypeFocus(focusType)
  const knowledge = buildGameKnowledge({ type: focusType, gameRequest, effType, prompt: fullPrompt })
  const system = SYSTEM_PROMPT + (typeFocus ? `\n\n${typeFocus}` : "") + (knowledge ? `\n\n${knowledge}` : "") + (context ? `\n\n${context}` : "") + scanContext +
    `\n\n--- FINAL REMINDER (highest priority) ---\nIf the user's message asks for ANYTHING to be built, created, fixed or changed — respond in MODE 1 generation with the full JSON. NEVER greet, NEVER list capabilities, NEVER ask "what would you like me to build?". Chat mode is ONLY for messages with zero build intent.`
  console.log("[runGenerate] system length:", system.length, "| has MODE SELECTION:", system.includes("MODE SELECTION"), "| has TYPE FOCUS:", !!typeFocus)

  let effectiveUserPrompt = fullPrompt
  // Long system prompts dilute attention: without this, big models occasionally
  // greet/clarify instead of building. The type is already known server-side
  // (client UI selection + keyword detection), so reinforce the decision where
  // the model's attention is highest — the current user message.
  const isBuildRequest =
    effType === "game" ||
    effType === "obby" ||
    effType === "cinematic" ||
    effType === "animation" ||
    effType === "vfx" ||
    effType === "model3d" ||
    effType === "sound" ||
    /\b(build|create|make|generate|script|add|fix|model|system|gui|weapon|sword|gun|car|house|door|tycoon|obby|shop|inventory|combat|effect|explosion|animation|cinematic)\b/i.test(fullPrompt)
  if (isBuildRequest && !gameRequest) {
    effectiveUserPrompt +=
      `\n\n[DIRECTIVE — this is a BUILD request. Respond in MODE 1 generation NOW: deliver the complete JSON with instances/scripts/etc for "${fullPrompt.slice(0, 120).replace(/"/g, "'")}". Do NOT greet, do NOT introduce yourself, do NOT ask what to build, do NOT use type "chat" or "clarification".]`
  }
  let directorBrief = ""
  // Obby is already fully specified by the OBBY DOCTRINE; running the director
  // on it just drains the token/time budget before the build itself.
  if (gameRequest && !obbyRequest) {
    directorBrief = await runDirector(fullPrompt)
    if (directorBrief) {
      effectiveUserPrompt = `${directorBrief}\n\nUSER'S ORIGINAL REQUEST (stay faithful to this):\n${fullPrompt}`
    }
  }

  // Vexa Team pre-pass: the coordinator writes a shared brief, the chosen
  // builder receives it + the handoff chain. Everything below (validators,
  // repair, fill) runs unchanged on the team-built output.
  let teamInfo = null
  let teamBuilder = ""
  if (model === TEAM_MODEL && (isBuildRequest || gameRequest || teamMode)) {
    try {
      teamInfo = await planTeamPass({ fullPrompt, effType })
    } catch (e) { console.warn("[vexa-team] plan failed:", e.message); teamInfo = null }
    if (teamInfo) {
      if (teamInfo.builder) teamBuilder = teamInfo.builder
      if (teamInfo.brief) {
        effectiveUserPrompt += `\n\n[VEXA TEAM BRIEF from the coordinator — follow this plan. Handoffs so far: ${teamInfo.handoffs.join(" | ")}.\n${teamInfo.brief}]`
      }
      console.log("[vexa-team] members:", teamInfo.members.join(", "), "| builder:", teamBuilder)
    }
  }

  let { system: sys, messages } = buildMessages(system, effectiveUserPrompt, cleanHistory, images)

  const requestedModel = teamBuilder || (model && isValidModel(model) ? model : DEFAULT_MODEL)

  // Local 3D asset generation — the "Hunyuan+Qwen" single agent (or standalone
  // TRELLIS). Only when the user picked a 3D model AND its local server is up;
  // otherwise we keep the classic LLM model3d build and flag it. Zero cost.
  let local3dWarn = ""
  // Vexa Team mixed handoff (mesh FIRST, code SECOND referencing it):
  // Qwen writes the asset blueprint → Hunyuan builds the real mesh →
  // the mesh names/paths are injected into the builder prompt so scripts,
  // animations, VFX and sounds reference the ACTUAL asset. Then the mesh
  // is merged into the final build below. Nothing breaks: on any failure
  // the team continues code-only with a warning.
  let teamMesh = null
  if (model === TEAM_MODEL && teamInfo?.needs3d) {
    if (await is3dServerAlive(HUNYUAN_MODEL)) {
      try {
        let assetPrompt = fullPrompt
        if (process.env.LOCAL_LLM_URL) {
          try {
            const { output: bp } = await teamTimeout(callNvidiaWithFallback(
              "You are Qwen 3, the 3D-blueprint specialist of the Vexa team. Reply with a SHORT asset brief: object, style, proportions, key details, materials. Plain text, no JSON.",
              [{ role: "user", content: fullPrompt.slice(0, 2000) }],
              45000, LOCAL_MODEL, [LOCAL_MODEL], 600
            ), 50000, "blueprint")
            if (bp) {
              assetPrompt = `ASSET BLUEPRINT by Qwen 3:\n${String(bp).slice(0, 1500)}\n\nUSER REQUEST:\n${fullPrompt}`
              teamInfo.handoffs.push("Qwen 3 → Hunyuan3D 2.1 (blueprint)")
            }
          } catch (e) { console.warn("[vexa-team] blueprint failed:", e.message) }
        }
        console.log("[runGenerate] vexa-team: blueprint → Hunyuan mesh build")
        const meshRes = await teamTimeout(
          generateAsset3d({ model: HUNYUAN_MODEL, prompt: assetPrompt, images }),
          180000, "hunyuan mesh"
        )
        if (meshRes?.asset) {
          teamMesh = meshRes.asset
          teamInfo.handoffs.push(`Hunyuan3D 2.1 → builder (mesh "${teamMesh.name}")`)
          const fileList = (teamMesh.files || []).map((f) => f.name || f.path).filter(Boolean).join(", ")
          effectiveUserPrompt += `\n\n[VEXA TEAM — MESH READY. Hunyuan3D 2.1 built "${teamMesh.name}" (${teamMesh.format || "obj"}): ${fileList || "see mesh_assets"}. Your scripts, animations, VFX and sounds MUST reference this exact asset (load it, weld it, animate its rig, attach effects/sounds to it). Do NOT invent a different mesh.]`
        }
      } catch (e) {
        console.warn("[vexa-team] mesh step failed — continuing code-only:", e.message)
        local3dWarn = "Il motore 3D non ha finito in tempo: build di codice completo, mesh da rigenerare."
      }
    } else {
      local3dWarn = "Il modello 3D locale non è attivo: build di codice completo senza mesh reale."
    }
  }
  if (teamMesh) {
    // The mesh arrived AFTER the first message build — rebuild so the
    // builder actually sees the MESH READY context (info passing).
    const rebuilt = buildMessages(system, effectiveUserPrompt, cleanHistory, images)
    sys = rebuilt.system
    messages = rebuilt.messages
  }
  if (effType === "model3d" && is3dModel(requestedModel)) {
    if (await is3dServerAlive(requestedModel)) {
      try {
        console.log("[runGenerate] local 3D backend alive — running asset generation")
        return await generateAsset3d({ model: requestedModel, prompt: fullPrompt, images })
      } catch (e) {
        console.warn("[runGenerate] local 3D generation failed — classic build:", e.message)
        local3dWarn = "Il modello 3D locale non ha prodotto un file: ho generato il classico build con parti saldate. Verifica che il pack Hunyuan/TRELLIS sia acceso."
      }
    } else {
      console.log("[runGenerate] 3D server not alive — classic model3d build")
      local3dWarn = "Il modello 3D locale non è attivo: ho generato il build con parti e script come sempre. Accendi il pack 3D per ottenere file .obj/.glb reali."
    }
  }

  // Big-model requests: cinematics (choreographed camera + timing JSON), animations
  // (dense keyframe JSON), VFX (tuned emitter property tables), 3D models
  // (multi-part assemblies) and sound (layered audio schedules) all need the
  // best reasoning. They get a bigger token budget and longer timeout with a
  // fast fallback chain.
  const t0 = Date.now()
  const effectiveModel = teamBuilder || (heavyRequest ? ANIMATION_MODEL : requestedModel)
  const effectiveFallbacks = heavyRequest ? ANIMATION_FALLBACK_ORDER : undefined
  // Games are the longest builds; cap their generation window so the whole
  // pipeline (director + gen + refine + possible fill-in) always fits the 300s limit.
  const mainBudget = heavyRequest ? (effType === "game" ? Math.min(240000, 285000 - (Date.now() - t0)) : 285000) : 90000
  const genTimeout = mainBudget
  // Heavy runs on nemotron-3-super-120b (~170 tok/s). Full-game kits are the
  // largest payloads: capped lower so they finish CLEANLY on the first pass
  // (a complete 16k-token game beats a truncated 20k attempt plus repair),
  // everything else gets the full window.
  const genMaxTokens = heavyRequest ? 16000 : MAX_TOKENS

  let raw = ""
  let usedModel = effectiveModel
  let usedReasoning = ""
  let fellBack = false

  try {
    const { output, reasoning, model: pickedModel, fellBack: didFallBack } =
      await callNvidiaWithFallback(sys, messages, genTimeout, effectiveModel, effectiveFallbacks, genMaxTokens)
    raw = output
    usedReasoning = reasoning || ""
    usedModel = pickedModel
    fellBack = didFallBack
  } catch (e) {
    console.error("[runGenerate] all NVIDIA models failed:", e)
    return {
      type: "chat",
      message: `Generation failed: ${e.message}`,
      __model: effectiveModel,
      __provider: providerLabel(effectiveModel),
      __fallback_used: false,
    }
  }

  console.log("[runGenerate] raw output:", raw.slice(0, 500))

  let parsed = extractJson(raw)
  console.log("[runGenerate] parsed type:", parsed.type)
  console.log("[runGenerate] parse_failed:", parsed.__parse_failed)

  // If the model produced prose or a mangled object for a heavy request, give it
  // one chance to return strictly-valid JSON before degrading to the generic
  // chat error. Only one retry — bounded token budget AND time budget (a repair
  // that starts too late would blow past the serverless window and 504 anyway),
  // so a broken output can't double the cost forever.
  const repairAllowed = heavyRequest && Date.now() - t0 < 150000
  // double the cost forever.
  if (parsed.__parse_failed && repairAllowed && raw.includes("{")) {
    console.log("[runGenerate] attempting JSON repair retry")
    try {
      const repairMessage =
        `The previous response for this request was malformed or cut off before it became valid JSON.\n\n` +
        `Regenerate the COMPLETE deliverable as ONE valid JSON object matching the requested schema. ` +
        `Be economical: keep every required array (instances/scripts/animations/cinematics/audio/sound_assets/mesh_assets) complete but trim optional prose fields (notes, thoughts, plan, summary) to at most 3 short bullets. ` +
        `No markdown fences, no commentary, no trailing text.\n\n` +
        `The original user request was:\n\n${effectiveUserPrompt}\n\n` +
        `Here is the broken/partial output for reference:\n\n${raw.slice(0, 12000)}`
      const { output: repairedRaw, model: repairedModel, fellBack: repairedFellBack } =
        await callNvidiaWithFallback(
          system,
          [{ role: "user", content: repairMessage }],
          Math.max(30000, Math.min(180000, 290000 - (Date.now() - t0))),
          effectiveModel,
          effectiveFallbacks,
          heavyRequest ? 16000 : 8000
        )
      const repaired = extractJson(repairedRaw)
      if (!repaired.__parse_failed && repaired.type === "generation") {
        parsed = repaired
        usedModel = repairedModel
        fellBack = repairedFellBack
        if (!parsed.warnings) parsed.warnings = []
        if (!parsed.warnings.some(w => w.toLowerCase().includes("repair"))) {
          parsed.warnings.push(
            "The first response couldn't be read as JSON, so a repair pass regenerated it. Output may differ from intent — review it."
          )
        }
      }
    } catch (e) {
      console.error("[runGenerate] JSON repair retry failed:", e.message)
    }
  }

  // A salvaged build can be structurally valid but THIN — e.g. every instance
  // recovered while all scripts were cut off. If gates flag missing sections
  // and time remains, surgically generate ONLY the missing arrays.
  if (!parsed.__parse_failed && heavyRequest && Date.now() - t0 < 170000) {
    try {
      const preGaps = assessQuality(parsed, effType).filter(q => /^(CRITICAL|NO |CORE SYSTEMS|EMPTY SCRIPTS|STUB|VFX IMPLEMENTATION)/.test(q))
      const fillBudget = Math.min(90000, 290000 - (Date.now() - t0) - 15000)
      if (preGaps.length > 0 && fillBudget > 25000) {
        console.log("[runGenerate] thin salvage — filling missing sections:", preGaps.join(" | "))
        // Use STEPS_MODEL (fast, reliable lightning-30b) for the surgical fill —
        // the slow main model already proved unreliable for full generation,
        // and the fill only needs to produce a handful of specific arrays.
        const filled = await fillMissingSections(parsed, effectiveUserPrompt, preGaps, STEPS_MODEL, undefined, fillBudget)
        if (filled) {
          const SUBST = ["scripts", "cinematics", "audio", "sound_assets", "mesh_assets", "animations"]
          for (const f of SUBST) {
            const incoming = Array.isArray(filled[f]) ? filled[f] : []
            if (incoming.length === 0) continue
            const existing = Array.isArray(parsed[f]) ? parsed[f] : []
            if (f === "scripts") {
              // keep only substantive originals; append filled ones not already present by name
              const solid = existing.filter(s => String(s?.code || s?.source || "").trim().length > 100)
              const names = new Set(solid.map(s => String(s.name || "").toLowerCase()))
              const extra = incoming.filter(s => !names.has(String(s.name || "").toLowerCase()))
              parsed.scripts = [...solid, ...extra]
            } else if (existing.length === 0) {
              parsed[f] = incoming
            } else {
              const names = new Set(existing.map(x => String(x?.name || x?.id || "").toLowerCase()))
              parsed[f] = [...existing, ...incoming.filter(x => !names.has(String(x?.name || x?.id || "").toLowerCase()))]
            }
          }
          if (!parsed.warnings) parsed.warnings = []
          parsed.warnings.push("Part of the first response was cut off; the missing sections were regenerated separately and merged in.")
        }
      }
    } catch (e) {
      console.warn("[runGenerate] thin-salvage fill failed:", e.message)
    }
  }

  if (teamMesh) {
    // Merge the real mesh into the team build (mesh_assets[] for the
    // hybrid pipeline + asset3d with the local files, same shape the
    // standalone 3D path returns).
    if (!Array.isArray(parsed.mesh_assets)) parsed.mesh_assets = []
    parsed.mesh_assets.push({
      id: `hunyuan-${String(teamMesh.name || "asset").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      source: "hunyuan3d-2.1", name: teamMesh.name, format: teamMesh.format,
      files: teamMesh.files, prompt3d: teamMesh.prompt3d,
    })
    parsed.asset3d = teamMesh
  }
  if (local3dWarn) {
    if (!parsed.warnings) parsed.warnings = []
    parsed.warnings.push(local3dWarn)
  }

  let result = normaliseResponse(parsed, usedModel, usedReasoning, fellBack)
  result.__eff_type = effType
  if (teamInfo) {
    const prettySoon = { "stable-audio": "Stable Audio", "ainvfx-fluid": "AINVFX Fluid" }
    const coming = teamInfo.members.filter((m) => String(m).endsWith("(soon)")).map((m) => prettySoon[String(m).replace(" (soon)", "")] || m)
    // Report who REALLY ran (planned roster is not the truth when fallbacks kick in).
    const ran = []
    if (teamInfo.brief && teamInfo.briefBy) ran.push(`${teamInfo.briefBy} (brief)`)
    ran.push(`${shortTeamName(usedModel)}${usedModel === effectiveModel ? "" : " (fallback)"}`)
    if (teamMesh) ran.push("Hunyuan3D 2.1 (mesh)")
    result.__team = { members: teamInfo.members, builder: teamBuilder || requestedModel, handoffs: teamInfo.handoffs, ran }
    const line = `Built by the Vexa team (${ran.join(" + ")})${coming.length ? ` — ${coming.join(", ")} join when their servers are online.` : "."}`
    if (result.type === "generation") {
      if (!Array.isArray(result.notes)) result.notes = []
      result.notes.unshift(line)
    } else {
      if (!Array.isArray(result.warnings)) result.warnings = []
      result.warnings.unshift(line)
    }
  }
  if (gameRequest) {
    result.__director = { used: Boolean(directorBrief) }
  }
  if (result.type === "generation") {
    // Pass 1: validate everything we produced.
    result = validateGeneration(result)

    // Senior review across the whole build (doctrines + cross-cutting checks):
    // references, physics, spawn, networking, density. Cheap (deterministic,
    // no extra API call) and surfaces what a reviewer would catch by hand.
    result.__quality = assessQuality(result, effType)

    // Physics-informed animation validation (loop seam, joint validity, root
    // motion, foot-slide) — issues flow into the repair pass so bad animated
    // sequences get rebuilt, not shipped.
    const animValidation = validateAnimations(result.animations)
    if (animValidation.issues.length > 0) {
      if (!result.__quality) result.__quality = []
      result.__quality.push(...animValidation.issues)
    }
    result.__animScore = animValidation.score

    // Structural gameplay pass (data-level): impossible jumps, missing
    // spawn/win, flat visuals, missing progression. These issues flow into
    // the same __quality list the repair pass consumes, so Vexa corrects
    // playability — not just Lua syntax.
    const gameplayIssues = checkGameplay(result, effType)
    if (gameplayIssues.length > 0) {
      if (!result.__quality) result.__quality = []
      result.__quality.push(...gameplayIssues)
    }

    if (result.__quality.length > 0) {
      if (!result.warnings) result.warnings = []
      result.warnings.push(`Build review: ${result.__quality.length} issue(s) for a reviewer to look at (${result.__quality.slice(0, 2).map(q => q.replace(/.*?: /, "")).join("; ")}…).`)
    }

    // Deterministic auto-fix: reposition impossible jumps, insert missing
    // SpawnLocation, etc. — cheap fixes that don't need an AI model.
    result = autoFix(result, effType)

    const hasBadScripts = result.__validation?.errorCount > 0 && result.__validation.checked > 0
    const hasCriticalQuality = result.__quality?.some(q => /^(NO |CRITICAL|IMPOSSIBLE|BARE CUBE|EMPTY SCRIPTS|STUB|DANGLING REFERENCES|NO DATASTORE|NO WORLD|CORE SYSTEMS|FLAT DIFFICULTY|NO CORE LOOP|NO WIN|NO CHECKPOINTS|SINGLE-LAYER|FLAT VFX|STATIC FRAMING|FLAT PACING|FLAT MIX|NO GUI|NO HEALTH)/.test(q)) || hasCriticalGameplay(result.__quality)

    // Pass 2: for heavy builds we ALWAYS run the senior review/repair pass (the
    // user wants any issue fixed, not just listed). For light requests the repair
    // runs only when scripts fail validation or the build has a critical flaw.
    const alwaysRepair = heavyRequest
    const shouldRepair = (hasBadScripts || hasCriticalQuality) || (alwaysRepair && result.__validation?.checked > 0)
    if (shouldRepair && Date.now() - t0 < 210000) {
      result = await repairScripts(result, prompt, projectName, result.__quality || [])
      // Pass 3: re-validate after repair.
      result = validateGeneration(result)
      result.__quality = assessQuality(result, effType)
    } else if (result.__validation?.checked > 0 && !hasBadScripts) {
      // No errors — but if warnings exist, surface them to the user in the summary.
      if (!result.warnings) result.warnings = []
      const w = result.__validation.warnCount
      if (w > 0) result.warnings.push(`${w} minor warning(s) from the code linter (non-blocking).`)
    }

    // Pass 4: art-director refinement — DISABLED for speed.
    // The 550B model produces quality output on first pass; refinement
    // adds ~150s latency with diminishing returns.

    // Taste critic: one deterministic 0-100 score + weak axes (the v0 of the
    // taste model). Same interface a trained critic will replace later.
    result.__taste = scoreTaste(result, effType, result.__quality || [])

    // Novelty kernel: how much of the genre's mechanic menu the build covers.
    result.__novelty = scoreBuildNovelty(result, effType)
    result.__novelty.directive = noveltyDirective({ ...result.__novelty, genre: effType })

    // Heavy full games/obbies carry a self-verifying QA probe: on server start
    // it writes ServerStorage.VexaQA.Report (harvested by the plugin and pushed
    // to the bridge even without in-game HTTP) and, when HTTP is enabled,
    // POSTs directly to the bridge. This is the playtest loop: press Play in
    // Studio, the results come back and show up in the Runtime QA panel.
    // Iterative refinement: one polish pass for heavy requests, so the model
  // "thinks longer" instead of one-shotting. Bounded by timeBudget.
  // Thinking levels: low=0 refine, medium=1, high=2, xhigh=3, max=4 passes.
  const refinePasses = thinkingLevel === "low" ? 0 : thinkingLevel === "medium" ? 1 : thinkingLevel === "high" ? 2 : thinkingLevel === "xhigh" ? 3 : 4
  if (refinePasses > 0 && Array.isArray(result.scripts) && result.scripts.length > 0) {
    for (let p = 0; p < refinePasses; p++) {
      try {
        const refined = await refineGeneration(
          result, fullPrompt, effectiveModel, effectiveFallbacks, effType, projectName || "", [], 60000
        )
        if (refined && refined.type === "generation") result = refined
        else break
      } catch (e) {
        console.warn("[runGenerate] refinement skipped:", e.message); break
      }
    }
  }

  if (heavyRequest && (effType === "game" || effType === "obby") && Array.isArray(result.scripts)) {
      result.scripts = [...result.scripts, { name: "VexaQA", type: "Script", code: buildQAProbeLuau(), parent: "ServerScriptService" }]
      if (!result.warnings) result.warnings = []
      result.warnings.push("A QA probe (VexaQA) is installed — press Play in Studio once and it auto-reports runtime findings to the bridge.")
    }
  }

  return result
}

export async function runFetchSteps(prompt) {
  console.log("[runFetchSteps] prompt:", prompt.slice(0, 100))

  const { system, messages } = buildMessages(STEPS_SYSTEM, prompt, [])

  try {
    const { output } = await callNvidiaWithFallback(system, messages, 20000, STEPS_MODEL)
    const text = output.trim()
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/```\s*$/m, "")
      .trim()
    console.log("[runFetchSteps] raw output:", text.slice(0, 200))
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 6).map(String).filter(s => s.trim())
    }
  } catch (e) {
    console.error("[runFetchSteps] all NVIDIA models failed:", e)
  }

  return []
}

export async function runThinking({
  prompt,
  model,
  projectName = "",
  datamodel,
  gameModel,
  history,
}) {
  console.log("[runThinking] start — prompt:", prompt.slice(0, 100))

  const cleanHistory = (history || []).filter(msg => {
    if (msg.role === "user") return true
    if (msg.role === "assistant") {
      try {
        const d = JSON.parse(msg.content)
        return d.type === "generation" || d.type === "clarification" || d.type === "chat"
      } catch { return false }
    }
    return false
  })

  const context = buildContext(projectName, datamodel, gameModel)
  const scanContext = buildScanContext(gameModel, prompt)
  const system =
    SYSTEM_PROMPT +
    (context ? `\n\n${context}` : "") +
    scanContext +
    "\n\nDo not write the full response yet. Think through the request carefully: " +
    "what the user wants, what Roblox/Luau systems are involved, " +
    "what edge cases or ambiguities exist, and the implementation approach you'll take."

  const { system: sys, messages } = buildMessages(system, prompt, cleanHistory)

  const requestedModel =
    model && isValidModel(model) ? model : THINKING_MODEL

  try {
    const { output, reasoning, model: usedModel, fellBack } =
      await callNvidiaWithFallback(sys, messages, 90000, requestedModel)

    const steps = (reasoning || output)
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, 20)

    return {
      type: "thinking",
      thinking_steps: steps,
      __model: usedModel,
      __provider: providerLabel(usedModel),
      __fallback_used: fellBack,
    }
  } catch (e) {
    console.error("[runThinking] all NVIDIA models failed:", e)
    return {
      type: "thinking",
      thinking_steps: [],
      __error: `Thinking pass failed: ${e.message}`,
      __model: requestedModel,
      __provider: providerLabel(requestedModel),
      __fallback_used: false,
    }
  }
}

const TOOL_SYSTEM = `You are Vexa's Plugin Tool Integrator. A Roblox Studio plugin wants to automate an external Studio plugin/tool (an "unknown tool") to do a task inside the game.

You receive:
- "task": what the user wants done with the tool (e.g. "use the tool to create a wave animation on the rig").
- "apis": a scan of _G globals that look like plugin APIs (name, kind, number of functions, a sample key). This is the detected surface of the tool.

Your job:
1. Identify the tool from its global name / structure / common knowledge. Many Roblox plugins expose globals (e.g. Moon Animator -> _G.MoonGlobal). If you already know the tool's API, you can skip research.
2. Research it if needed: propose web search queries and doc URLs. You WILL get real search results and fetched pages back in a follow-up before writing code.
3. Write a self-contained Luau ADAPTER: a function that takes an input table (the animation payload) and drives the real plugin API to create the result. It must run inside Roblox Studio via loadstring, so it has NO imports except the passed "env" table keys: animation (the animation data table), model (Instance), workspace (Instance), instance (Instance class), cframe (CFrame), enums (Enum), vector3 (Vector3), playerPlugin (the Vexa plugin object), moonGlobal (_G.MoonGlobal or nil). It may use those or _G directly.
4. Return the final result as STRICT JSON ONLY with this shape:

{
  "identified": "tool name or null",
  "confidence": 0.0-1.0,
  "search_queries": ["..."],
  "sources": ["...", "..."],
  "ready": true or false,
  "adapter_luau": "the full Luau adapter source as a string (only when ready)",
  "usage_note": "1-2 sentences explaining what the adapter does and what it creates inside the tool"
}

Rules:
- adapter_luau must be a valid Luau function: local function adapter(env) ... end return adapter
- The adapter should be defensive: wrap risky calls in pcall, return false on failure, true on success.
- If you know the tool's API well (e.g. Moon Animator -> _G.MoonGlobal createAnimation/addKeyframeByBone/setAngleByBone/setAnimation/play), write the adapter IMMEDIATELY with ready=true and EMPTY search_queries/sources. Only request research for genuinely unknown tools.
- If you are NOT confident the tool exists or can be automated, set ready=false and adapter_luau="".
- NEVER invent API calls; use the detected surface (apis) and the research you receive. If unsure, set ready=false.
- After writing, do not add explanations outside the JSON.

## KNOWN TOOL REFERENCE — Moon Animator 2
Global: _G.MoonGlobal (wait until .ready true). Two API surfaces exist depending on plugin version — PROBE at runtime which one is present and use it.

### Legacy function API (older versions)
- moon.createAnimation() -> animation object
- moon.addKeyframe(animation, framePos) -> keyframe   (framePos = frame index, 60 fps: frame = floor(time*60))
- moon.addKeyframeByBone(animation, boneName, framePos, copyFrom?) -> keyframe
- moon.setAngle(angleCFrame, animation, keyframe, addTrack?)
- moon.setAngleByBone(angleCFrame, animation, keyframe, boneName, addTrack?)
- moon.setPosition(positionCFrame, animation, keyframe, addTrack?)
- moon.setAnimation(animation), moon.play(animation), moon.stop(), moon.pause()
- moon.getKeyframes(animation), moon.getBones(animation), moon.rename(animation, newName) (pcall)
- moon.getKeyframeValue(keyframe, boneName), moon.setKeyframeValue(keyframe, boneName, cframe) (pcall)

### Class-based API (version 34000+ — the current one)
- require(_g.class.ItemObject): ItemObject.new() or ItemObject:ItemFactory() -> animation item; item:AddRig(model); item:AddProperty("C0") -> property track (Motor6D C0)
- require(_g.class.Keyframe): Keyframe.new() -> keyframe; keyframe:SetTargetValue(value, boneName?) and keyframe:SetTargetValue(boneName, value) (both orders appear — pcall each); keyframe:GetTargetValue(); keyframe:SetEase(easingName) (real easing!)
- Track: track:AddKeyframe(keyframe, framePos) (or track:AddKeyframe(framePos) builds one)
- Playback: require(_g.class.PlaybackHandler) -> :Play(), :Stop(), :SetLoop(true/false)
- Timeline: require(_g.class.LayerHandler) -> :AddItemObject(item), :SetActiveItemObject(item), :GetActiveItemObject()
- Easing names: _g.EasingFunctions has Sine/Quad/Cubic/Quart/Quint/Sextic/Expo/Circ/Back/Elastic/Bounce with In/Out/InOut/OutIn, plus Linear and Constant. Map payload ease -> "QuadIn"/"QuadOut"/"QuadInOut"/"Linear". Prefer EASE field of the keyframe (e.g. "in" -> keyframe:SetEase("QuadIn"), "out" -> "QuadOut", "inout" -> "QuadInOut").
- Usage: get itemCls, keyCls, playback (probe: local function cls(name) local d = _g[name]; if typeof(d)=="table" then return d end local ok,c = pcall(require, _g.class[name]); if ok and typeof(c)=="table" then return c end end)

env.animation is the payload table DIRECTLY (no .shape). Its shape:
{ name, target, loop, priority, description, move={dx,dy,dz}, keyframes={ {time=seconds, ease="in"|"out"|"inout"|"linear", poses={ BoneName={ euler={x,y,z} } }} } }
- euler is in DEGREES, order X,Y,Z. Build the joint CFrame like this: local cf = CFrame.fromEulerAnglesYXZ(math.rad(y), math.rad(x), math.rad(z)) where x=euler[1], y=euler[2], z=euler[3].
- keyframe.time is in SECONDS; Moon Animator uses 60 fps frames, so framePos = math.floor(keyframe.time * 60).
Bone names are Motor6D names (R15: RightUpperArm, RightLowerArm, RightHand, LeftUpperArm, ..., UpperTorso, LowerTorso, Neck, HumanoidRootPart; R6: Torso, Head, Right Arm, Right Leg, Left Arm, Left Leg).
Use env.moonGlobal (already set) as the global. Return true when done, false on failure. Prefer _G.MoonGlobal only if env.moonGlobal is nil.

MOON ADAPTER RECIPE: decide surface with a probe: if typeof(_g.createAnimation)=="function" use the legacy calls; otherwise use the class-based calls. Sort keyframes by time. Legacy: moon.addKeyframe(anim,pos) then for EACH bone pose moon.setAngleByBone(cf, anim, key, boneName, true) (addTrack=true). Class-based: item=ItemObject.new(); LayerHandler:AddItemObject(item); item:AddRig(env.model); track=item:AddProperty("C0"); per keyframe: key=Keyframe.new(); track:AddKeyframe(key,pos); key:SetTargetValue(cf,boneName) (try arg orders); key:SetEase(easeName). Finally set loop (PlaybackHandler:SetLoop) and playback:Play(). Wrap every Moon call in pcall; return true only if at least one keyframe was added and playback started, else false. This is the ONLY correct way to get real bone rotations + real easing into Moon Animator.`

async function analyzeToolAsk(system, task, apis, timeoutMs = 45000) {
  const model = "meta/llama-3.1-8b-instruct"
  try {
    const { output } = await callNvidia(system, [
      {
        role: "user",
        content: JSON.stringify({
          task,
          apis: Object.entries(apis || {}).slice(0, 60).map(([name, v]) => ({
            name,
            kind: v?.kind || typeof v,
            funcs: v?.funcs,
            sample: v?.sample,
          })),
        }),
      },
    ], model, timeoutMs, 5000)
    return extractJson(output)
  } catch (e) {
    console.error("[analyzeTool] LLM call failed:", e.message)
    return { ready: false, adapter_luau: "", identified: null, confidence: 0, __error: e.message }
  }
}

const ALLOWED_ENV_KEYS = [
  "animation", "model", "workspace", "instance", "cframe", "enums",
  "vector3", "playerPlugin", "moonGlobal", "g", "_g", "global",
]

// Heuristic lint: the adapter may only read env.<allowed> or _G directly.
// If it references an env.<unknown> key, the adapter would fail at runtime — reject it.
function validateAdapter(adapterLua) {
  if (!adapterLua || adapterLua.trim().length < 30) return false
  const re = /env\.([A-Za-z_][A-Za-z0-9_]*)/g
  let m
  while ((m = re.exec(adapterLua)) !== null) {
    if (!ALLOWED_ENV_KEYS.includes(m[1])) return false
  }
  if (/\bloadstring\b|\bos\.execute\b|require\(["']/.test(adapterLua)) return false
  return true
}

export async function analyzeTool({ task, apis }) {
  try {
    let system = TOOL_SYSTEM
    let result = await analyzeToolAsk(system, task, apis)

    const queries = Array.isArray(result?.search_queries) ? result.search_queries : []
    const sources = Array.isArray(result?.sources) ? result.sources : []
    const needResearch = (queries.length > 0 || sources.length > 0) && result?.ready !== true

    if (needResearch) {
      const { researchTool } = await import("./websearch.js")
      const research = await researchTool(result?.identified || task, queries.slice(0, 3), sources.slice(0, 3))
      const researchBlock = [
        research.searches ? `## Web search results\n${research.searches}` : "",
        research.pages ? `## Fetched documentation\n${research.pages}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")

      system = `${TOOL_SYSTEM}\n\n## Research round complete\nBelow is real research output. Use it to finalize. ${researchBlock}`
      result = await analyzeToolAsk(system, task, apis, 40000)
    }

    const validated = validateAdapter(result?.adapter_luau)
    const ready = result?.ready === true && validated
    if (!validated && result?.adapter_luau) {
      console.warn("[analyzeTool] adapter failed validation — treating as not-ready")
    }

    return {
      identified: result?.identified || null,
      confidence: typeof result?.confidence === "number" ? result.confidence : 0,
      ready,
      adapter_luau: ready ? result.adapter_luau : "",
      usage_note: result?.usage_note || "",
      sources,
      __error: result?.__error || undefined,
      __model: result?.__model || undefined,
    }
  } catch (e) {
    console.error("[analyzeTool] failed:", e)
    return {
      identified: null,
      confidence: 0,
      ready: false,
      adapter_luau: "",
      usage_note: `Tool analysis failed: ${e.message}`,
      sources: [],
    }
  }
}
