// Structural gameplay validation over the generated payload (data-level, no
// Roblox runtime). Feeds issues back into the auto-fix/repair loop so Vexa
// corrects playability — impossible jumps, missing spawn/win, flat visuals,
// missing progression — not just Lua syntax.

function toVec3(v) {
  if (Array.isArray(v)) return { x: Number(v[0]) || 0, y: Number(v[1]) || 0, z: Number(v[2]) || 0 }
  if (v && typeof v === "object") {
    const cast = (n) => {
      const d = Number(Array.isArray(n) ? n[0] : n)
      return Number.isFinite(d) ? d : 0
    }
    return { x: cast(v.x ?? v.X), y: cast(v.y ?? v.Y), z: cast(v.z ?? v.Z) }
  }
  return null
}

function isBasePart(inst) {
  const c = String(inst?.className || "").toLowerCase()
  return c.startsWith("part") || c === "spawnlocation" || c === "meshpart" || c === "basepart"
}

const OBJ_MAX_UP = 7
const OBJ_MAX_HORIZ = 18

export function checkGameplay(result, effType) {
  const issues = []
  const instances = Array.isArray(result?.instances) ? result.instances : []
  const scripts = Array.isArray(result?.scripts) ? result.scripts : []
  if (effType !== "obby" && effType !== "game") return issues

  const parts = instances.filter(isBasePart)
  const named = (re) => instances.find((i) => re.test(String(i?.name || "")))
  const platforms = parts.filter((p) => p.properties && toVec3(p.properties.Position))

  if (effType === "obby") {
    if (platforms.length < 10) {
      issues.push(`GAMEPLAY OBSTACLE COUNT: only ${platforms.length} positioned platforms — a real obby needs 15-30 (${platforms.length} is a demo, not a course).`)
    }
    const spawn =
      instances.find((i) => String(i.className).toLowerCase() === "spawnlocation") ||
      parts.find((p) => /spawn|start/i.test(String(p.name || "")))
    if (!spawn) issues.push("GAMEPLAY NO SPAWN: no SpawnLocation/start platform in instances[] — players can't spawn at the start.")

    const win = named(/finish|win|goal|end(i|ed)?\b|exit|portal|last/i)
    if (!win) issues.push("GAMEPLAY NO WIN: no finish/win/goal platform — the course has no completion target.")

    const bad = []
    let overlapReported = false
    for (let i = 1; i < platforms.length; i++) {
      const a = toVec3(platforms[i - 1].properties.Position)
      const b = toVec3(platforms[i].properties.Position)
      if (!a || !b) continue
      const dy = b.y - a.y
      const horiz = Math.hypot(b.x - a.x, b.z - a.z)
      if (Math.abs(horiz) < 0.5 && Math.abs(dy) < 0.5 && !overlapReported) {
        issues.push(`GAMEPLAY OVERLAP: "${platforms[i].name}" sits inside "${platforms[i - 1].name}" (same Position) — overlapping platforms are unreadable and unfun.`)
        overlapReported = true
      }
      if (dy > OBJ_MAX_UP || horiz > OBJ_MAX_HORIZ || dy < -OBJ_MAX_UP) {
        bad.push(`${platforms[i - 1].name} -> ${platforms[i].name} (up ${dy.toFixed(1)} / horiz ${horiz.toFixed(1)})`)
      }
    }
    if (bad.length) {
      issues.push(`GAMEPLAY IMPOSSIBLE JUMP: ${bad.length} out-of-reach hop(s) (every jump must be ≤${OBJ_MAX_UP} up, ≤${OBJ_MAX_HORIZ} horiz): ${bad.slice(0, 4).join("; ")}${bad.length > 4 ? "; …" : ""}`)
    }

    const colored = platforms.filter((p) => p.properties?.Color || p.properties?.BrickColor)
    if (colored.length === 0 && platforms.length >= 2) {
      issues.push("GAMEPLAY FLAT VISUALS: no platform sets a Color — adjacent obstacles read identical; give every obstacle a distinct hue/material.")
    }
  }

  if (effType === "game") {
    const code = scripts.map((s) => String(s.code || s.source || "")).join("\n")
    const allCode = code.toLowerCase()
    if (!/leaderstats|\.leaderstats/.test(allCode)) {
      issues.push("GAMEPLAY NO PROGRESSION: no leaderstats setup in PlayerAdded — progression (coins/level) must be visible to the player.")
    }
    if (!/getdatastore|datastore/.test(allCode)) {
      issues.push("GAMEPLAY NO DATASTORE: no DataStore save/load in pcall — progress is wiped every session and grinding feels pointless.")
    }
    const remotes = instances.filter((i) => /remote/i.test(String(i.className || "")))
    const hasRemoteValidate = /typeof\(|tonumber\(|type\(\s*[^)]*\s*\)\s*==\s*"number"/i.test(allCode)
    if (remotes.length && !hasRemoteValidate) {
      issues.push("GAMEPLAY NO REMOTE VALIDATION: RemoteEvents/RemoteFunctions exist but server code never validates args (typeof/tonumber) — exploitable on a live server.")
    }
    const world = parts.find((p) => /floor|arena|ground|island|plate|platform|theater|map/i.test(String(p.name || "")))
    if (!world) issues.push("GAMEPLAY NO WORLD: no visible floor/arena base part in instances[] — a game without a world is a tech demo.")
  }

  return issues
}

export function hasCriticalGameplay(issues) {
  return (issues || []).some((q) => /^GAMEPLAY (IMPOSSIBLE|NO |OVERLAP|FLAT VISUALS)/.test(q))
}