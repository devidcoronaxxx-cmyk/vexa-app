// Deterministic taste critic: a layered, weighted rubric scoring a generation
// on 0–100 across the axes a seasoned Roblox reviewer uses. This is the v0 of
// the taste model — a trained critic can swap this function behind the same
// (score, grade, axes, weak, verdict) interface with zero code changes
// elsewhere.

const GRADES = [
  [90, "A", "professional"],
  [80, "B", "polished"],
  [70, "C", "complete"],
  [60, "D", "working"],
  [0, "F", "needs work"],
]

export function scoreTaste(result, effType, qualityIssues = []) {
  const scripts = Array.isArray(result?.scripts) ? result.scripts : []
  const instances = Array.isArray(result?.instances) ? result.instances : []
  const audio = Array.isArray(result?.sound_assets) ? result.sound_assets.length + (Array.isArray(result?.audio) ? result.audio.length : 0) : 0
  const anims = Array.isArray(result?.animations) ? result.animations.length : 0
  const vfx = Array.isArray(result?.scripts) ? scripts.filter((s) => /particle|trail|beam|emitter|vfx/i.test(String(s.code || s.source || ""))).length : 0
  const hasGui = instances.some((i) => /ScreenGui|Frame|TextLabel|TextButton/i.test(String(i.className || "")))
  const codeLines = scripts.reduce((acc, s) => acc + String(s.code || s.source || "").split("\n").length, 0)

  const critCount = qualityIssues.filter((q) => !EXCLUDE_QL.test(q)).length
  const criticallyBroken = qualityIssues.some((q) => /^(NO |CRITICAL|IMPOSSIBLE|BARE CUBE|EMPTY SCRIPTS|DANGLING|GAMEPLAY (IMPOSSIBLE|NO ))/i.test(q))

  // playability 0-100
  const playability = criticallyBroken ? Math.max(0, 100 - critCount * 14) : Math.max(0, 100 - critCount * 6)

  // completeness: how many expected layers exist
  let completenessScore = 0
  if (effType === "obby") {
    const has = (re) => scripts.some((s) => re.test(String(s.code || s.source || ""))) || instances.some((i) => re.test(String(i.name || "")))
    completenessScore += has(/spawn/i) ? 25 : 0
    completenessScore += has(/checkpoint|save/i) ? 25 : 0
    completenessScore += has(/finish|win|goal/i) ? 25 : 0
    completenessScore += has(/reset|die|fall|death/i) ? 15 : 0
    completenessScore += codeLines > 200 ? 10 : 0
  } else if (effType === "game") {
    completenessScore += scripts.filter((s) => String(s.code || s.source || "").length > 200).length > 2 ? 25 : 0
    completenessScore += instances.some((i) => /Remote|Event|Function/i.test(String(i.className || ""))) ? 20 : 0
    completenessScore += hasGui ? 20 : 0
    completenessScore += audio > 0 ? 15 : 0
    completenessScore += instances.some((i) => /SpawnLocation|Leaderboard|Floor/i.test(String(i.name || ""))) ? 10 : 0
    completenessScore += codeLines > 400 ? 10 : 0
  } else {
    completenessScore = Math.min(100, (scripts.length * 20 + instances.length * 6 + codeLines / 10))
  }

  // craft: code quality vs animation quality vs VFX polish
  const scriptCraft = Math.max(0, 100 - (result?.__validation?.errorCount || 0) * 12 - (result?.__validation?.warnCount || 0) * 4)
  const animCraft = anims > 0 ? Math.min(100, (result?.__animScore ?? 60)) : 70
  const craft = Math.round(scriptCraft * 0.5 + animCraft * 0.3 + Math.min(100, vfx * 25) * 0.2)

  // variety: unique content families present
  const families = new Set()
  if (anims > 0) families.add("anim")
  if (audio > 0) families.add("audio")
  if (hasGui) families.add("gui")
  if (vfx > 0) families.add("vfx")
  if (scripts.length > 0) families.add("logic")
  if (instances.length > 5) families.add("world")
  const variety = Math.min(100, families.size * 20 + (scripts.length > 2 ? 10 : 0))

  // presentation: visual intentionality (named parts, colors, lighting instances)
  const namedParts = instances.filter((i) => /part|model|mesh|gui|frame|folder/i.test(String(i.className || "")))
  const colored = namedParts.filter((i) => i.properties?.Color || i.properties?.BrickColor || i.properties?.Material)
  const presentFrac = namedParts.length > 0 ? colored.length / namedParts.length : 0
  const lighting = instances.filter((i) => /Atmosphere|Sky|Bloom|Light|ColorCorrection|Atmosphere/i.test(String(i.className || "")))
  const presentation = Math.round(presentFrac * 60 + Math.min(40, lighting.length * 10))

  // docs
  const docs = Math.min(100, [
    Array.isArray(result?.plan) && result.plan.length > 0 ? 30 : 0,
    Array.isArray(result?.notes) && result.notes.length > 0 ? 20 : 0,
    Array.isArray(result?.summary) && result.summary.length > 0 ? 10 : 0,
    (result?.thoughts?.length || 0) > 0 ? 10 : 0,
  ].reduce((a, b) => a + b, 0))

  const axes = {
    playability: Math.round(playability),
    completeness: Math.round(completenessScore),
    craft: Math.round(craft),
    variety: Math.round(variety),
    presentation: Math.round(presentation),
    docs: Math.round(docs),
  }
  const weights = { playability: 0.30, completeness: 0.22, craft: 0.18, variety: 0.12, presentation: 0.12, docs: 0.06 }
  const score = Math.round(
    axes.playability * weights.playability +
    axes.completeness * weights.completeness +
    axes.craft * weights.craft +
    axes.variety * weights.variety +
    axes.presentation * weights.presentation +
    axes.docs * weights.docs
  )

  const [, grade, verdict] = GRADES.find(([m]) => score >= m) || [0, "F", "needs work"]
  const weak = Object.entries(axes)
    .filter(([k]) => k !== "docs")
    .sort(([, a], [, b]) => a - b)
    .slice(0, 3)
    .map(([k]) => k)

  return { score, grade, verdict, axes, weak }
}

const EXCLUDE_QL = /ANIM |GAMEPLAY OBSTACLE|BUILD REVIEW|^GAMEPLAY FLAT VISUALS/