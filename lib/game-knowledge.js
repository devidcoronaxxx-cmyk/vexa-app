// Game intelligence layer. Pure data + keyword matching — no deps.
// Injected into the generation system prompt so Vexa designs with real
// market, genre, loop and retention knowledge instead of generating blind.

const GENRE_PACKS = {
  obby: `OBBY/CORSE MARKET DATA: the #1 discovery ladder on Roblox. Players decide "fun" in the first 5 seconds — load into a visible, bright obstacle in <1s, never an empty room. Retention = checkpoint density (every 4-6 obstacles), fail-friction (respawn <1s, no cutscene), and reward cadence (a small visual reward every 10-15 obstacles: confetti, sound, color change). The best obbies become harder FASTER than creators fear: players are better than you think. Difficulty spikes every 3-4 obstacles, never a plateau. Visual variety per obstacle (color/material, never two adjacent same hue) is what keeps a 30-obstacle run readable. Ranked/win-rate leaderboards and a "perfect run" stat double replay.`,
  combat: `COMBAT/RPG LOOP DATA: combat feels good when HIT-FEEL is present: knockback, hitstop (0.05-0.1s), camera shake, damage numbers, sound layered on the same frame as contact. Balance rule: player DPS vs enemy HP must be tuned so a fight takes 15-40s at player skill — never a 2-hit or a 5-minute sponge in the early game. Progression visibility is the retention engine: every kill must advance XP/coins/level visibly (leaderstats + toast), or players don't feel progress. Difficulty curve: early fights teach the player's 1 combo; mid requires 2-3; bosses require pattern READING (telegraph + dodge window + punish). Never spawn enemies on top of spawn.`,
  tycoon: `TYCOON/SIMULATOR LOOP DATA: the dopamine engine is the 1-2-4 multiplier ladder (upgrades cost 2x, reward 1.5-2x) — this exact curve keeps sessions stretching. Idle value must tick VISIBLY (floating numbers, coin counter on the products). Physical proximity rewards: player walks near machines → floating +N pops. The retention hook is the "something new glows" loop: every 30-60s an upgrade becomes affordable and glows — if nothing glows for 90s the session dies. Automatabile progression: early manual (click/walk), mid helper bots, late full idle. Milestone unlocks (rebirth/prestige) with permanent bonuses are what make players return daily.`,
  horror: `HORROR MARKET DATA: fear = anticipation + vulnerability, not jump-scares. Audio and lighting do 70% of the work: darkness with a single light source, ambient creep, dynamic music that dims as the threat approaches. The player must feel UNSAFE (limited stamina, no save points too close, the monster always faster than the player). Retention = looping tension (safe room → explore → escape) with escalating stakes. Session-1 rule: first scare within 90 seconds or players label it "not scary" and leave. Never spawn the threat the same way twice in a row — vary the pattern.`,
  racing: `RACING/DRIVING DATA: car feel > graphics. Steering must have weight (acceleration → top speed curve, drift = counter-steer + e-brake + boost), a speedometer + FOV increase sells speed 10x better than motion blur. Track design: straight → technical section → straight (rhythm), with a checkpoint density that never leaves a player >6s from a restart point. Content loop: 3 maps minimum for "many maps" feel, or time-trials/leaderboard ghosts to stretch one map. Upgrade path (speed/accel/handling/grip) must be visible in a garage UI, and every race must award currency even on loss (keeps losers in the session).`,
  survivor: `SURVIVOR/ROUNDS DATA: power fantasy with a clock. Wave/round design: increasing enemy COUNT + occasional enemy TYPE unlock every 3-5 waves — player power and enemy count must rise on a similar curve or it plateaus into boredom. Pickups (weapon upgrades, heal, magnet) must drop between waves, never mid-wave. The camera and map must make threat direction readable (spawn edges glow, minimap blips). Session hook: "3 more waves" challenge — show the wave you'll unlock next at the end of each.`,
  social: `SOCIAL/ROLEPLAY DATA: the game is the set-piece; players create the content. Deliver a distinct location with 2-3 activity stations (jobs/minigames), an economy (earn + spend), and visible self-expression (avatar props, customizable space). Micro-transaction feel equivalence: premium currency + play currency; daily task streak (rewards ramp 1/2/3/5) is the retention anchor. Server is the product: name a lobby with capacity, add a chat/friends affordance and easy "stay connected" (auto-session next task within 5s).`,
  fps: `FPS/SHOOTER DATA: the gun must read good in the first 30 seconds. Recoil pattern, muzzle flash, tracer, hit-marker, sound — all on the same shot. Movement-skill ceiling (slide, jump, ads, crouch) separates good from great. Match flow: 2-5 min rounds, instant respawn (respawn <2s) or teams feel dead. Weapon economy keeps rounds tense (win streak → better gun → comeback possible). Skill tiers in UI (not just levels) create the climb. Ping/lag guard: client-side damage prediction feels responsive.`,
  farming: `FARMING/MINING DATA: the gather→upgrade→expand loop. Each action must yield instantly (chop → wood pops with +N) and feed a visible stockpile. Upgrade curve: tool tiers multiply yield (1x, 2x, 4x…) so a 10-minute grind is satisfying. Automation as the reward ladder: manual → pet helper → auto-fleet, revealed exactly when the player feels "this is repetitive now." Prestige (reset for permanent % bonus) is the daily-return engine. The map fills in stages (unlock rows of plots) to pace a growing "my land" attachment.`,
}

const CROSS_GENRE_RELIGHT = `PLATFORM-LEVEL KNOWLEDGE (retention & catalog):
- First-time UX is the game: a new player must understand the core action within 10 seconds of spawning (visible object, one clear action, instant feedback). Tutorials as walls of text are a drop-off; tutorials as "do the thing once" are fine.
- Feedback on every action: visual + audio + numeric. No output on an input = dead game.
- Sessions: good games have a 5-15 min main loop PLUS a 30-60 min "one more round/upgrade" hook PLUS a daily reason to return (streak, daily task, energy not fully blocking).
- Progression is psychological: leaderstats/UI must show level, currency, next-unlock. A visible "next" (level 4 → unlock sword) is the strongest next-action signal.
- Difficulty must never punish failure more than visibility: dead → respawn <1s, understand why, retry. No long respawn waits, no punishing loss of progress on early death.
- The catalog rewards niche identity over generic medieval/fantasy: a clear hook ("dragon tycoon", "pizza delivery sim") outranks "adventure game". A describe-able hook in one sentence is a design requirement.`

const GENRE_KEYWORDS = [
  ["farming", /\b(farm|farming|plantation|mining|mine|harvest|grow|crops?|orchard)\b/i],
  ["fps", /\b(fps|shooter|shoot|gun|weapon|war|soldier|csgo|army|sniper|rifle|pistol)\b/i],
  ["social", /\b(roleplay|rp|social|hangout|chat|town|local|club|party|meet|visit|mansion|apartment)\b/i],
  ["survivor", /\b(surviv|waves|rounds?|zombie|horde|camp|defense|tower|survival)\b/i],
  ["racing", /\b(car|racing|drive|drift|vehicle|motorcycle|bike|speed|track|turbo|nitro)\b/i],
  ["horror", /\b(horror|scary|fear|frighten|haunt|entity|monster|creepy|dark|ghost)\b/i],
  ["tycoon", /\b(tycoon|simulator|sim|idle|clicker|money|profit|rich|billion|rebirth|prestige|minigame|machines?)\b/i],
  ["combat", /\b(combat|rpg|fight|boss|sword|enemy|attack|damage|dungeon|quest|leveling?|xp|stats?|grind)\b/i],
  ["obby", /\b(obby|obstacle|parkour|jump|course|platformer|partkour)\b/i],
]

function detectGenre(prompt) {
  for (const [key, re] of GENRE_KEYWORDS) {
    if (re.test(prompt)) return key
  }
  return null
}

export function buildGameKnowledge({ type, gameRequest = false, prompt = "", effType = "" } = {}) {
  const text = (" " + prompt + " ").toLowerCase()
  const forceKey =
    (effType === "obby" && "obby") ||
    (effType === "game" && gameRequest && detectGenre(text)) ||
    (type && GENRE_PACKS[type] ? type : "")

  const genreKey = forceKey || detectGenre(text) || (gameRequest ? "combat" : "")
  const parts = []

  if (genreKey && GENRE_PACKS[genreKey]) {
    parts.push(`## MARKET KNOWLEDGE — ${genreKey.toUpperCase()} GENRE\n${GENRE_PACKS[genreKey]}`)
  }
  if (gameRequest || effType === "game") {
    parts.push(`## PLATFORM-LEVEL KNOWLEDGE\n${CROSS_GENRE_RELIGHT}`)
  }
  return parts.length ? "--- GAME INTELLIGENCE (design with this data, not generic guesses) ---\n" + parts.join("\n\n") : ""
}