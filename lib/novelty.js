// Local novelty kernel. Fingerprints a build's CONTENT VOCABULARY and scores
// how well it covers the genre's available mechanic families vs converging on
// the same narrow subset every time. Deterministic, no infra. A trained
// novelty/taste model can replace `scoreBuildNovelty` later behind the same
// interface — the input (fingerprint) and output (score + variation
// directive) stay identical.

const FAMILIES = {
  obby: {
    movement: /double.jump|jump_power|walkspeed|speed.pad|bhop|wall.jump/i,
    death: /killfloor|kill_floor|touching.*die|spikes|lava|instakill|void|fell/i,
    moving: /moving_platform|moving platform|tween|linearspeed|translate|conveyor/i,
    checkpoints: /checkpoint|respawn|spawnpoint|save/i,
    win: /finish|win\.|win_|complete|goal|victory|portal/i,
    pickups: /coin|token|gem|collect|pickup|orb/i,
    rewards: /leaderboard|leaderstats|timer|best.time|perfect|title/i,
    vfx: /particleemitter|trail|beam|sparkle|confetti/i,
    audio: /sound\.|soundservice|playsound/i,
    camera: /cameratype|camera.*shake|fov|shiftlock/i,
  },
  game: {
    combat: /damage|take.?damage|health\.|dead|die|reducehealth|hurt/i,
    movement: /humanoid\..*speed|dash|dodge|jump_power|climb/i,
    currency: /coin|money|wallet|gold|cash|currency|funds/i,
    shop: /shop|buy|purchase|button|thumbnail/i,
    progression: /leaderstats|level|xp|upgrade|tier|rank/i,
    datastore: /datastore|getdatastore|save|load/i,
    remotes: /remoteevent|remotefunction|fireclient|fireallclients/i,
    enemies: /spawn|enemy|npc|zombie|wave|boss|healthgui/i,
    abilities: /ability|skill|power|ultimate|active/i,
    world: /floor|aren|island|spawnlocation|lighting|atmosphere/i,
    vfx: /particleemitter|beam|trail|explosion|aura/i,
    audio: /soundgroup|musicdirector|ambient|playsound/i,
    ui: /screengui|textlabel|healthbar|frame|button/i,
  },
}

export function fingerprintBuild(result, effType) {
  const fp = { families: new Set(), assets: 0, scripts: 0 }
  const famTable = FAMILIES[effType]
  if (!famTable) return fp

  const scripts = Array.isArray(result?.scripts) ? result.scripts : []
  const instances = Array.isArray(result?.instances) ? result.instances : []
  const allCode = scripts.map((s) => String(s.code || s.source || "")).join("\n")
  const allInst = instances.map((i) => `${String(i.className || "")} ${String(i.name || "")}`).join("\n")
  const hay = allCode + "\n" + allInst

  for (const [fam, re] of Object.entries(famTable)) {
    if (re.test(hay)) fp.families.add(fam)
  }

  fp.scripts = scripts.filter((s) => String(s.code || s.source || "").trim().length > 100).length
  const assetKeys = ["sound_assets", "audio", "animations", "cinematics", "mesh_assets"]
  for (const k of assetKeys) if (Array.isArray(result?.[k]) && result[k].length > 0) fp.assets += result[k].length
  return fp
}

// 0-100. Coverage = how much of the genre's mechanic menu the build actually
// uses (higher = richer game, but >85% for an obby can mean noise). Density =
// how much live code/asset exists to back claims (guard against keyword-stuffing).
export function scoreBuildNovelty(result, effType, history = []) {
  if (!FAMILIES[effType]) return { score: 50, coverage: 0, missing: [], note: "n/a" }
  const fp = fingerprintBuild(result, effType)
  const total = Object.keys(FAMILIES[effType]).length
  const coverage = fp.families.size / total
  const missing = Object.keys(FAMILIES[effType]).filter((f) => !fp.families.has(f))
  const codeDensity = fp.scripts > 0 ? Math.min(1, fp.scripts / 4) : 0.15

  // Bias: a build that re-uses <30% of its genre's mechanics reads "samey".
  const coverageScore = coverage >= 0.5 ? (coverage >= 0.85 ? 70 : 100) : 30 + coverage * 100
  const score = Math.round(coverageScore * 0.8 + codeDensity * 100 * 0.2)

  // Repeat suppression vs project history (Jaccard on family sets).
  let repeatNote = ""
  if (history.length > 0) {
    const cur = fp.families
    let best = 0
    for (const h of history) {
      const set = new Set(h)
      if (set.size === 0) continue
      let inter = 0
      for (const f of cur) if (set.has(f)) inter++
      best = Math.max(best, inter / new Set([...cur, ...set]).size)
    }
    if (best > 0.8) repeatNote = ` — repeats the mechanic mix of a previous build in this project (Jaccard ${best.toFixed(2)})`
    if (best > 0.8) { }
  }
  return {
    score, coverage: Math.round(coverage * 100), missing,
    used: fp.families.size, total,
    note: `uses ${fp.families.size}/${total} mechanic families` + repeatNote,
  }
}

const LABELS = {
  obby: {
    movement: "a movement twist (double jump, speed pads, wall hops)",
    death: "a distinct death mechanic (kill-floor, spikes, void)",
    moving: "moving/threat platforms",
    checkpoints: "checkpoint respawns",
    win: "a finish/win condition",
    pickups: "coin/pickup runs",
    rewards: "leaderboard / best-time / perfect-run",
    vfx: "particle/trail rewards",
    audio: "a sound layer (coin pips, stage stingers)",
    camera: "camera pressure or FOV feedback",
  },
  game: {
    combat: "combat/damage",
    movement: "movement (dash/jump power)",
    currency: "currency earning",
    shop: "a shop/buy UI",
    progression: "levels/XP/upgrades in leaderstats",
    datastore: "a DataStore save/load",
    remotes: "validated RemoteEvents",
    enemies: "enemies/spawner/waves",
    abilities: "active abilities",
    world: "a themed world + lighting",
    vfx: "VFX tied to actions",
    audio: "wired audio (SFX/music)",
    ui: "real GUIs",
  },
}

export function noveltyDirective(novelty) {
  if (!novelty || novelty.missing?.length === 0) return ""
  const table = LABELS[novelty.genre] || {}
  const top = novelty.missing.slice(0, 3).map((f) => table[f] || f).join(", ")
  return `VARIATION DIRECTIVE: this build covers only ${novelty.used}/${novelty.total} of its genre's mechanics. Add: ${top}. Variety is the retention axis — samey builds die in the feed.`
}