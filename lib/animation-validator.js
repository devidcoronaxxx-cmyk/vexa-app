// Physics-informed validation of generated animations[] WITHOUT a runtime.
// A trained physical validator can replace this later behind the same
// (issues + score) interface; today the checks are numeric and deterministic:
//   - loop seam: first vs last pose must close for looping cycles
//   - joint names must resolve on a humanoid rig
//   - transforms finite and within sane angular ranges
//   - root motion bounded (no per-cycle teleporting)
//   - stride/contact density heuristic for walks/runs (foot-slide guard)

const KNOWN_JOINTS = new Set(
  ["RootJoint", "Root", "Torso", "Head", "Neck", "Waist", "HumanoidRootPart",
    "UpperTorso", "LowerTorso", "MidTorso", "Chest", "Pelvis", "Spine",
    "ShoulderR", "ShoulderL", "ElbowR", "ElbowL", "WristR", "WristL",
    "UpperArmR", "UpperArmL", "LowerArmR", "LowerArmL", "HandR", "HandL",
    "Right Shoulder", "Left Shoulder", "Right Elbow", "Left Elbow", "Right Wrist", "Left Wrist",
    "HipR", "HipL", "KneeR", "KneeL", "AnkleR", "AnkleL",
    "UpperLegR", "UpperLegL", "LowerLegR", "LowerLegL", "FootR", "FootL",
    "Right Hip", "Left Hip", "Right Knee", "Left Knee", "Right Ankle", "Left Ankle",
    "RightUpperArm", "RightLowerArm", "RightHand", "LeftUpperArm", "LeftLowerArm", "LeftHand",
    "RightUpperLeg", "RightLowerLeg", "RightFoot", "LeftUpperLeg", "LeftLowerLeg", "LeftFoot",
    "RightUpperArm_Anchor", "RightLowerArm_Anchor", "LeftUpperArm_Anchor", "LeftLowerArm_Anchor",
  ].map((s) => s.toLowerCase())
)

function getPoseAngles(pose) {
  const out = {}
  if (!pose || typeof pose !== "object") return out
  for (const [joint, v] of Object.entries(pose)) {
    let ang = null
    if (Array.isArray(v) && v.length >= 2) ang = [Number(v[0]), Number(v[1]), Number(v[2] ?? 0)]
    else if (typeof v === "object" && v && Array.isArray(v.euler)) ang = [Number(v.euler[0]), Number(v.euler[1]), Number(v.euler[2] ?? 0)]
    else if (typeof v === "object" && v && v.x !== undefined) ang = [Number(v.x), Number(v.y), Number(v.z ?? 0)]
    if (ang) out[joint] = ang
  }
  return out
}

function isValidJoint(name) {
  const n = String(name).toLowerCase()
  if (KNOWN_JOINTS.has(n)) return true
  if (n === "root" || n === "rootjoint") return true
  if (/^(right|left)/.test(n)) {
    const rest = n.replace(/^(right|left)/, "")
    if (/arm|hand|shoulder|elbow|wrist|leg|foot|knee|ankle|hip|thigh/.test(rest)) return true
  }
  return false
}

export function validateAnimations(anims) {
  const issues = []
  if (!Array.isArray(anims) || anims.length === 0) return { issues, score: 100 }

  for (const anim of anims) {
    const name = String(anim?.name || "?")
    const kfs = Array.isArray(anim?.keyframes) ? anim.keyframes : []
    if (kfs.length === 0) {
      issues.push(`ANIM EMPTY: "${name}" has no keyframes.`)
      continue
    }
    const fps = Number(anim?.fps) || 60
    if (!(fps > 0)) issues.push(`ANIM FPS: "${name}" has no valid fps (got ${anim?.fps}).`)

    // Sorting + monotonic time
    const sorted = [...kfs].sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0))
    let lastT = -1
    for (const k of sorted) {
      const t = Number(k?.time) || 0
      if (t < lastT) { issues.push(`ANIM TIME: "${name}" keyframes not in ascending time order.`); break }
      lastT = t
    }

    // Joint validity, finite transform ranges, per-joint continuity
    const jointsUsed = new Map() // joint -> {min,max,prev,first,last}
    let sawBadJoint = false
    for (const k of sorted) {
      const angles = getPoseAngles(k?.poses)
      if (Object.keys(angles).length === 0) continue
      for (const [joint, ang] of Object.entries(angles)) {
        if (!isValidJoint(joint) && !sawBadJoint) {
          issues.push(`ANIM JOINT: "${name}" references unknown joint "${joint}" — it will silently no-op on a humanoid rig.`)
          sawBadJoint = true
        }
        if (ang.some((a) => !Number.isFinite(a) || Math.abs(a) > 10000)) {
          if (!sawBadJoint) issues.push(`ANIM NUMBER: "${name}" has non-finite/absurd angles on "${joint}".`)
          continue
        }
        const rec = jointsUsed.get(joint) || { min: 0, max: 0, prev: null, first: ang, last: ang, steps: 0, sum: 0 }
        rec.min = Math.min(rec.min, ...ang.map(Math.abs))
        rec.max = Math.max(rec.max, ...ang.map(Math.abs))
        if (rec.prev) {
          const delta = Math.hypot(ang[0] - rec.prev[0], ang[1] - rec.prev[1], ang[2] - rec.prev[2])
          rec.sum += delta; rec.steps++
        }
        rec.prev = ang; rec.last = ang
        jointsUsed.set(joint, rec)
      }
    }

    if (Math.max(...[...jointsUsed.values()].map((r) => r.max), 0) > 4) {
      issues.push(`ANIM RANGE: "${name}" rotates a joint past ±4 rad (~230°) — bones would spin past the rig's physical stop.`)
    }

    // Loop seam: first pose must equal last pose.
    if (anim.loop === true && sorted.length > 1) {
      const head = getPoseAngles(sorted[0]?.poses)
      const tail = getPoseAngles(sorted[sorted.length - 1]?.poses)
      const joints = new Set([...Object.keys(head), ...Object.keys(tail)])
      let worst = 0
      for (const j of joints) {
        if (!head[j] || !tail[j]) continue
        worst = Math.max(worst, Math.hypot(head[j][0] - tail[j][0], head[j][1] - tail[j][1], head[j][2] - tail[j][2]))
      }
      if (worst > 1.2) issues.push(`ANIM LOOP SEAM: "${name}" loops but the first/last pose differ by ${worst.toFixed(1)} rad — the cycle will POP every repeat. Make the closing keyframe equal to the opening one.`)
    }

    // Root motion bound: teleporting cycles are fake.
    const move = anim.move || {}
    const dmag = Math.hypot(Number(move.dx) || 0, Number(move.dy) || 0, Number(move.dz) || 0)
    const dur = sorted.length ? (Number(sorted[sorted.length - 1].time) || 0) : 0
    if (dur > 0 && dmag / dur > 40) {
      issues.push(`ANIM ROOT MOTION: "${name}" moves ${(dmag / dur).toFixed(0)} studs/sec — that's teleporting, not moving. Keep root translation <=20 studs/sec.`)
    }

    // Foot-slide guard: walks/runs need ground contact, so feet must actually rotate through the stride.
    if (dur > 0.8 && /walk|run|jog|sprint|stomp|stride/i.test(name)) {
      let minFoot = Infinity
      for (const [joint, rec] of jointsUsed) {
        if (!/foot|ankle/.test(joint)) continue
        const avgStep = rec.steps > 0 ? rec.sum / rec.steps : 0
        minFoot = Math.min(minFoot, avgStep)
      }
      if (Number.isFinite(minFoot) && minFoot < 0.02) {
        issues.push(`ANIM FEET: "${name}" animation barely rotates the feet (mean ${minFoot.toFixed(3)} rad/step) at ${fps} keyframe density — feet will SLIDE across the floor instead of planting.`)
      }
    }
  }

  const crit = issues.filter((i) => /EMPTY|NUMBER/.test(i)).length
  const score = Math.max(0, 100 - issues.length * 6 - crit * 8)
  return { issues, score }
}