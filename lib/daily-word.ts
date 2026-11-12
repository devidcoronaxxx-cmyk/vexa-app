export type WordleCheck = {
  ok: boolean
  dateKey?: string
  word?: string
  source?: string
  entry?: string
}

type CachedWord = { word: string; source: string; fetchedAt: number }

const cache = new Map<string, CachedWord>()
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

const FALLBACK_WORDS_RAW = [
  "abode", "abyss", "acorn", "actor", "adept", "admin", "admit", "adobe", "adopt", "adult",
  "after", "again", "agape", "agent", "agile", "aglow", "ahead", "aisle", "alarm", "album",
  "alert", "alias", "alibi", "alien", "align", "alike", "alive", "allow", "alloy", "alone",
  "along", "aloof", "alpha", "altar", "alter", "amber", "amend", "among", "ample", "angel",
  "anger", "angle", "angry", "anime", "ankle", "annex", "apart", "apple", "apply", "apron",
  "arena", "argue", "arise", "armor", "aroma", "array", "arrow", "aside", "asset", "atlas",
  "audio", "audit", "augur", "award", "aware", "awake", "awful", "axiom", "azure", "badge",
  "bagel", "baker", "banjo", "barge", "basic", "basil", "batch", "beach", "beard", "beast",
  "begin", "being", "below", "bench", "berry", "birth", "black", "blade", "blame", "blank",
  "blast", "blaze", "bleak", "blend", "bless", "blimp", "blind", "blink", "bliss", "blitz",
  "block", "bloom", "blown", "board", "bonus", "boost", "booth", "bound", "brain", "brake",
  "brand", "brass", "brave", "bread", "break", "brick", "bride", "brief", "bring", "brisk",
  "broad", "broil", "broth", "brown", "brush", "buddy", "build", "built", "bunch", "burst",
  "buyer", "cabin", "cable", "cacao", "cagey", "camel", "candy", "canoe", "canon", "cargo",
  "carol", "carry", "carve", "catch", "cause", "cease", "cedar", "chain", "chair", "chalk",
  "champ", "chant", "chaos", "charm", "chart", "cheap", "check", "cheek", "cheer", "chess",
  "chest", "chief", "child", "chill", "chime", "china", "chord", "cider", "cigar", "civic",
  "civil", "claim", "clamp", "clash", "clasp", "class", "clean", "clear", "click", "cliff",
  "climb", "cling", "clock", "clone", "close", "cloth", "cloud", "clown", "coach", "coast",
  "comic", "coral", "couch", "cough", "could", "count", "court", "cover", "crack", "craft",
  "crane", "crash", "crate", "crave", "crawl", "craze", "crazy", "cream", "credo", "crest",
  "crime", "crisp", "cross", "crowd", "crown", "crush", "crust", "cubic", "curve", "cycle",
  "daily", "dance", "dandy", "dawn", "dealt", "death", "debit", "debut", "decal", "decor",
  "delay", "delta", "dense", "depot", "depth", "derby", "desk", "diary", "dicey", "digit",
  "diner", "dizzy", "dodge", "dogma", "doing", "donor", "doubt", "dozen", "draft", "drain",
  "drama", "drank", "drawn", "dream", "dress", "dried", "drift", "drill", "drink", "drive",
  "drove", "drown", "drum", "drunk", "dutch", "early", "earth", "ease", "eaten", "ebony",
  "eject", "elder", "elect", "elite", "elope", "ember", "empty", "enact", "endow", "enemy",
  "enjoy", "enter", "entry", "equal", "equip", "erase", "error", "erupt", "essay", "ether",
  "ethos", "evade", "event", "every", "evoke", "exact", "exalt", "excel", "exile", "exist",
  "extra", "fable", "facet", "faint", "fairy", "faith", "false", "fancy", "fatal", "fault",
  "favor", "feast", "feign", "fence", "ferry", "fetch", "fever", "fewer", "fiery", "fifth",
  "fifty", "fight", "final", "first", "flame", "flash", "flask", "fleet", "flesh", "fling",
  "flint", "float", "flock", "flood", "floor", "flour", "fluid", "flung", "flute", "focus",
  "foggy", "force", "forge", "forgo", "forte", "forth", "forty", "forum", "found", "frame",
  "fraud", "fresh", "fried", "front", "frost", "fruit", "fully", "fungi", "funny", "gadget",
  "gaily", "gamer", "gamma", "gauge", "gaunt", "genie", "genre", "giant", "given", "glade",
  "glare", "glass", "glaze", "gleam", "glide", "glimmer", "globe", "gloom", "glory", "gloss",
  "glove", "glyph", "gourd", "grace", "grade", "grain", "grand", "grant", "grape", "graph",
  "grasp", "grass", "grave", "gravy", "great", "grief", "grill", "grind", "grin", "grips",
  "groat", "group", "grove", "growl", "grown", "guard", "guess", "guest", "guide", "guild",
  "guilt", "guise", "gulch", "gumbo", "gusto", "habit", "hairy", "halls", "handy", "happy",
  "harpy", "haste", "hasty", "hatch", "haunt", "haven", "havoc", "hazel", "heady", "heart",
  "heath", "heavy", "helix", "hello", "hence", "heron", "hilly", "hinge", "hobby", "honey",
  "honor", "hood", "hook", "hoped", "horse", "hotel", "hound", "house", "hover", "human",
  "humid", "humor", "hunch", "hurl", "husky", "hutch", "hydra", "hyena", "hymn", "ideal",
  "idiom", "image", "imply", "inbox", "incur", "index", "inner", "input", "ionic", "irony",
  "islet", "issue", "ivory", "jab", "jaunt", "jewel", "joins", "jolly", "judge", "juice",
  "juicy", "jumbo", "kayak", "khaki", "kings", "kitty", "knack", "kneel", "knoll", "known",
  "koala", "label", "labor", "lager", "lance", "lanky", "lapse", "large", "laser", "latch",
  "later", "laugh", "layer", "leach", "leafy", "leaky", "learn", "lease", "leash", "least",
  "leave", "ledge", "leech", "lemon", "level", "lever", "light", "like", "lilac", "limit",
  "linen", "liner", "lion", "lipid", "liver", "llama", "lobby", "local", "lodge", "logic",
  "lofty", "lolly", "loose", "lorry", "lotus", "lover", "lower", "lucky", "lunar", "lunch",
  "lunge", "lurch", "lured", "lurid", "lusty", "lyric", "macro", "madam", "magma", "mango",
  "manic", "maple", "marble", "march", "marsh", "mason", "match", "maxim", "maybe", "mayor",
  "mealy", "meant", "medal", "melon", "mercy", "merge", "merit", "merry", "metro", "micro",
  "midst", "might", "mimic", "mince", "minor", "minus", "mirth", "mocha", "modal", "model",
  "moist", "molar", "monte", "month", "moral", "mossy", "motif", "motor", "motto", "mount",
  "mourn", "mouse", "mouth", "mower", "muddy", "mulch", "mummy", "munch", "mural", "mushy",
  "music", "musty", "nanny", "nasal", "naval", "needy", "nerve", "never", "newly", "niche",
  "night", "ninja", "ninth", "noble", "noise", "noisy", "nomad", "north", "nosed", "noted",
  "novel", "nudge", "nurse", "nylon", "oasis", "obese", "occur", "ocean", "oddly", "offer",
  "often", "olive", "omega", "onion", "onset", "opera", "orbit", "organ", "other", "otter",
  "ought", "ounce", "outer", "owing", "oxide", "ozone", "paddy", "pagan", "paint", "palsy",
  "panel", "panic", "paper", "parry", "party", "pasta", "patch", "patio", "pause", "peace",
  "peach", "pearl", "pecan", "pedal", "peony", "perch", "peril", "perky", "pesto", "phase",
  "phone", "photo", "piano", "piece", "pier", "pigmy", "pilot", "pinch", "pious", "pivot",
  "pixel", "pizza", "plain", "plaid", "plane", "plank", "plant", "plate", "plaza", "pluck",
  "plush", "point", "poise", "polar", "polka", "pollen", "poppy", "porch", "pouch", "pound",
  "power", "press", "price", "pride", "prize", "probe", "prone", "proof", "prose", "proud",
  "prove", "prune", "psalm", "pub", "pulse", "punch", "pupil", "pure", "purse", "quaint",
  "quart", "quasi", "queen", "query", "quest", "queue", "quick", "quiet", "quill", "quilt",
  "quirk", "quota", "quote", "radar", "radio", "rainy", "raise", "ramen", "ranch", "randy",
  "range", "rapid", "raspy", "ratio", "raven", "ready", "realm", "rebel", "refer", "reign",
  "relax", "relay", "relic", "remit", "rental", "rerun", "resin", "retro", "revel", "rhino",
  "rhyme", "ripen", "riser", "rising", "risky", "rival", "river", "roast", "robin", "robot",
  "rocky", "rodeo", "roger", "roman", "rough", "round", "route", "rowdy", "royal", "ruler",
  "rumba", "rural", "rusty", "saber", "sadly", "saint", "salad", "salsa", "salvo", "sandy",
  "sassy", "sauce", "saucy", "sauna", "savor", "scalp", "scare", "scarf", "scary", "scout",
  "scrap", "screw", "scrub", "scuba", "seize", "senor", "sense", "serum", "serve", "setup",
  "seven", "shack", "shade", "shaft", "shake", "shall", "shame", "shape", "share", "shark",
  "sharp", "shawl", "sheep", "sheet", "shelf", "shell", "shift", "shine", "shirt", "shock",
  "shore", "short", "shout", "shove", "shown", "shrub", "shrug", "sight", "sigma", "silky",
  "silly", "since", "siren", "sixth", "sixty", "skill", "skulk", "skull", "skunk", "slack",
  "slash", "slate", "slave", "sleek", "sleep", "sleet", "slice", "slide", "slime", "sling",
  "slope", "sloth", "slush", "small", "smart", "smash", "smell", "smile", "smoke", "smoky",
  "snack", "snail", "snake", "sneak", "snoop", "snout", "snowy", "soapy", "sober", "solar",
  "solid", "solve", "sonic", "south", "spade", "spare", "spark", "spawn", "speak", "spear",
  "speck", "speed", "spell", "spend", "spent", "spice", "spicy", "spike", "spill", "spine",
  "spire", "spite", "splat", "split", "spoil", "spoke", "spool", "sport", "spout", "spray",
  "squat", "stack", "staff", "stage", "stain", "stair", "stake", "stale", "stamp", "stand",
  "stark", "star", "start", "state", "stave", "steady", "steam", "steel", "steep", "steer",
  "stem", "stick", "sting", "stink", "stock", "stole", "stone", "stood", "stool", "store",
  "storm", "story", "stove", "strap", "straw", "stray", "strip", "stuck", "study", "stuff",
  "stump", "style", "sugar", "suite", "sulky", "sunny", "super", "surge", "surly", "sushi",
  "swamp", "swan", "sweat", "sweep", "sweet", "swell", "swept", "swift", "swing", "swirl",
  "sword", "sworn", "swung", "syrup", "table", "taboo", "tacit", "tacky", "taffy", "taker",
  "tamed", "taper", "tardy", "taste", "taunt", "teach", "teeth", "tempo", "tense", "tepid",
  "tern", "there", "thick", "thief", "thigh", "thing", "think", "third", "thorn", "those",
  "three", "threw", "throw", "thumb", "thump", "thyme", "tiara", "tidal", "tight", "timer",
  "tint", "tiny", "tiptoe", "titan", "title", "toast", "today", "token", "tonic", "tooth",
  "topaz", "topic", "torch", "total", "totem", "touch", "tough", "towel", "tower", "toxic",
  "trace", "track", "tract", "trade", "trail", "train", "trait", "tramp", "trash", "trawl",
  "tread", "treat", "trend", "trial", "tribe", "trick", "tried", "troll", "troop", "truce",
  "truck", "truly", "trump", "trunk", "truth", "tulip", "tumor", "tunic", "turbo", "tutor",
  "twang", "tweak", "tweed", "tweet", "twice", "twine", "twirl", "twist", "udder", "ultra",
  "uncle", "undue", "unfit", "union", "unite", "unity", "until", "upper", "upset", "urban",
  "usage", "usher", "usual", "utter", "vague", "valet", "valid", "valor", "value", "vapor",
  "vault", "vegan", "vegas", "veil", "veldt", "venom", "verge", "verse", "verso", "vigor",
  "villa", "viral", "virus", "visit", "vista", "vital", "vivid", "vocal", "vodka", "vogue",
  "voice", "vomit", "voter", "vouch", "vow", "wacky", "wager", "wagon", "waist", "waive",
  "watch", "water", "waxen", "weary", "weave", "wedge", "weigh", "weird", "whale", "wharf",
  "wheat", "wheel", "where", "while", "whine", "whisk", "white", "whole", "whose", "wider",
  "widow", "width", "wield", "woman", "world", "worry", "worse", "worst", "worth", "would",
  "wound", "woven", "wrack", "wrist", "write", "wrong", "wrote", "xenon", "yacht", "yearn",
  "yeast", "yield", "youth", "zebra", "zesty", "zonal", "zebec",
]

const FALLBACK_WORDS = Array.from(new Set(FALLBACK_WORDS_RAW.filter((w) => /^[a-z]{5}$/.test(w))))

function hashDate(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return h
}

export function dateKeyForOffset(offsetMinutes: number): string {
  const clamped = Number.isFinite(offsetMinutes) ? Math.max(-840, Math.min(840, offsetMinutes)) : 0
  const shifted = new Date(Date.now() - clamped * 60_000)
  const y = shifted.getUTCFullYear()
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0")
  const d = String(shifted.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function normalizeWordle(input: string): string {
  return (input || "").toLowerCase().replace(/[^a-z]/g, "")
}

async function fetchFromNyt(key: string): Promise<{ word: string; source: string } | null> {
  try {
    const res = await fetch(`https://www.nytimes.com/svc/wordle/v2/${key}.json`, {
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json().catch(() => null)) as { solution?: unknown } | null
    const word = normalizeWordle(typeof data?.solution === "string" ? data.solution : "")
    return word ? { word, source: "nytimes" } : null
  } catch {
    return null
  }
}

async function fetchFromMirror(key: string): Promise<{ word: string; source: string } | null> {
  try {
    const res = await fetch("https://wordlehintstoday.org/api/v1/wordle/answers/latest", {
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = (await res.json().catch(() => null)) as { date?: unknown; answer?: unknown } | null
    if (data?.date !== key) return null
    const word = normalizeWordle(typeof data?.answer === "string" ? data.answer : "")
    return word ? { word, source: "mirror" } : null
  } catch {
    return null
  }
}

export async function getDailyWord(offsetMinutes: number): Promise<WordleCheck> {
  const key = dateKeyForOffset(offsetMinutes)
  const seen = cache.get(key)
  if (seen && Date.now() - seen.fetchedAt < CACHE_TTL_MS) {
    return { ok: true, dateKey: key, word: seen.word, source: seen.source }
  }
  const nyt = await fetchFromNyt(key)
  if (nyt) {
    cache.set(key, { word: nyt.word, source: nyt.source, fetchedAt: Date.now() })
    return { ok: true, dateKey: key, word: nyt.word, source: nyt.source }
  }
  const mirror = await fetchFromMirror(key)
  if (mirror) {
    cache.set(key, { word: mirror.word, source: mirror.source, fetchedAt: Date.now() })
    return { ok: true, dateKey: key, word: mirror.word, source: mirror.source }
  }
  const word = FALLBACK_WORDS[hashDate(key) % FALLBACK_WORDS.length]
  return { ok: true, dateKey: key, word, source: "local" }
}

export async function validateWordle(input: string, offsetMinutes: number): Promise<WordleCheck> {
  const entry = normalizeWordle(input)
  const info = await getDailyWord(offsetMinutes)
  if (!info.word) return { ...info, ok: false, entry }
  return { ...info, ok: entry === info.word, entry }
}