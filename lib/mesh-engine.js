// Procedural mesh generation engine. Turns a short descriptor from the AI into
// a real OBJ mesh (vertices + smooth normals + triangle faces) using parametric
// geometry: lathe/revolve, extrusion, UV sphere, noise displacement, and
// composed multi-part recipes (katana, pickaxe, crystal…). Seeded so the same
// descriptor reproduces the exact same mesh.

export const MESH_KINDS = [
  "katana", "sword", "dagger", "spear", "pickaxe", "staff", "crystal",
  "gem", "rock", "barrel", "vase", "coin", "shield", "wall", "tower",
  "sphere", "cube", "cylinder", "cone", "pyramid", "torus", "blade",
]

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash3(x, y, z, seed) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2246822519) + Math.imul(seed | 0, 3266489917)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

function valueNoise(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = smoothstep(x - xi), yf = smoothstep(y - yi), zf = smoothstep(z - zi)
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz, seed)
  return (
    c(0, 0, 0) * (1 - xf) * (1 - yf) * (1 - zf) +
    c(1, 0, 0) * xf * (1 - yf) * (1 - zf) +
    c(0, 1, 0) * (1 - xf) * yf * (1 - zf) +
    c(0, 0, 1) * (1 - xf) * (1 - yf) * zf +
    c(1, 1, 0) * xf * yf * (1 - zf) +
    c(1, 0, 1) * xf * (1 - yf) * zf +
    c(0, 1, 1) * (1 - xf) * yf * zf +
    c(1, 1, 1) * xf * yf * zf
  )
}

const V3 = (x, y, z) => [x, y, z]

// ── primitive builders ──────────────────────────────────────────────────────
// Each returns { verts: [[x,y,z]...], faces: [[a,b,c]...] } with CCW-out faces.

function box(size, center = [0, 0, 0]) {
  const [sx, sy, sz] = size
  const [cx, cy, cz] = center
  const verts = []
  const faces = []
  // 8 corners, order: 0..7
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) {
    verts.push(V3(cx + dx * sx / 2, cy + dy * sy / 2, cz + dz * sz / 2))
  }
  // faces (CCW from outside) — index = dx*4+dy*2+dz
  const idx = (dx, dy, dz) => (dx === 1 ? 1 : 0) * 4 + (dy === 1 ? 1 : 0) * 2 + (dz === 1 ? 1 : 0)
  const quads = [
    // +X face (dx=1): corners (1,dy,dz)
    [idx(1, -1, -1), idx(1, -1, 1), idx(1, 1, 1), idx(1, 1, -1)],
    // -X face
    [idx(-1, -1, -1), idx(-1, 1, -1), idx(-1, 1, 1), idx(-1, -1, 1)],
    // +Y face (dy=1)
    [idx(-1, 1, -1), idx(1, 1, -1), idx(1, 1, 1), idx(-1, 1, 1)],
    // -Y face (dy=-1)
    [idx(-1, -1, -1), idx(-1, -1, 1), idx(1, -1, 1), idx(1, -1, -1)],
    // +Z face (dz=1)
    [idx(-1, -1, 1), idx(1, -1, 1), idx(1, 1, 1), idx(-1, 1, 1)],
    // -Z face (dz=-1)
    [idx(-1, -1, -1), idx(1, -1, -1), idx(1, 1, -1), idx(-1, 1, -1)],
  ]
  for (const q of quads) {
    faces.push([q[0], q[1], q[2]], [q[0], q[2], q[3]])
  }
  return { verts, faces }
}

// Lathe: revolve a 2D profile [{r, y}] around the Y axis.
function lathe(profile, segments, opts = {}) {
  const closed = opts.closed !== false
  const verts = []
  const faces = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    for (const p of profile) {
      verts.push(V3(p.r * ca, p.y, p.r * sa))
    }
  }
  const cols = profile.length
  const row = (i) => i * cols
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = row(i) + j
      const b = row(i) + j + 1
      const c = row(i + 1) + j + 1
      const d = row(i + 1) + j
      faces.push([a, b, c], [a, c, d])
    }
  }
  if (closed) {
    const topIdx = verts.length
    const bottomIdx = verts.length + 1
    const top = profile[0]
    const bottom = profile[profile.length - 1]
    verts.push(V3(0, top.y, 0), V3(0, bottom.y, 0))
    const isClosedTop = Math.abs(top.r) < 1e-6
    const isClosedBottom = Math.abs(bottom.r) < 1e-6
    if (!isClosedTop) {
      for (let i = 0; i < segments; i++) {
        const a = row(i)
        const b = row(i + 1)
        faces.push([topIdx, b, a])
      }
    }
    if (!isClosedBottom) {
      for (let i = 0; i < segments; i++) {
        const a = row(i) + cols - 1
        const b = row(i + 1) + cols - 1
        faces.push([bottomIdx, a, b])
      }
    }
  }
  return { verts, faces }
}

function uvSphere(radius, latSegs = 12, lonSegs = 18, y0 = -radius, y1 = radius) {
  const verts = []
  const faces = []
  for (let i = 0; i <= latSegs; i++) {
    const t = i / latSegs
    const phi = t * Math.PI
    const y = y0 + (y1 - y0) * t
    const r = radius * Math.sin(phi)
    for (let j = 0; j <= lonSegs; j++) {
      const theta = (j / lonSegs) * Math.PI * 2
      verts.push(V3(r * Math.cos(theta), y, r * Math.sin(theta)))
    }
  }
  const cols = lonSegs + 1
  for (let i = 0; i < latSegs; i++) {
    for (let j = 0; j < lonSegs; j++) {
      const a = i * cols + j
      const b = a + 1
      const c = a + cols + 1
      const d = a + cols
      faces.push([a, c, b], [a, d, c])
    }
  }
  return { verts, faces }
}

// Tapered blade along +Y: diamond cross-section (edge front, spine back),
// width/thickness taper from base to tip.
function blade(length, baseW, baseT, taper = 0.06, rings = 8) {
  const verts = []
  const faces = []
  const profile = (w, t, bx) => [
    V3(bx, 0, t),        // cutting edge (front +Z)
    V3(bx - w, 0, 0),    // left spine
    V3(bx, 0, -t),       // back edge
    V3(bx + w, 0, 0),    // right spine
  ]
  for (let i = 0; i < rings; i++) {
    const y = (i / (rings - 1)) * length
    const p = i / (rings - 1)
    const w = baseW * (1 - (1 - taper) * p)
    const t = baseT * (1 - (1 - taper * 1.4) * p)
    const bx = (i === rings - 1) ? 0 : baseW * 0.9 * p * p * 1.2 // lean toward the edge near the tip
    for (const v of profile(w, t, bx)) verts.push(V3(v[0], y, v[2]))
  }
  const cols = 4
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < cols; j++) {
      const j2 = (j + 1) % cols
      const a = i * cols + j
      const b = i * cols + j2
      const c = (i + 1) * cols + j2
      const d = (i + 1) * cols + j
      faces.push([a, b, c], [a, c, d])
    }
  }
  // tip pyramid (rings-1 row)
  const tip = verts.length
  const rowT = (rings - 1) * cols
  verts.push(V3(0, length, 0))
  for (let j = 0; j < cols; j++) {
    const j2 = (j + 1) % cols
    faces.push([rowT + j, rowT + j2, tip])
  }
  return { verts, faces }
}

function octahedron(rx, ry, rz) {
  const verts = [
    V3(rx, 0, 0), V3(-rx, 0, 0), V3(0, ry, 0), V3(0, -ry, 0), V3(0, 0, rz), V3(0, 0, -rz),
  ]
  const faces = [
    [2, 0, 4], [2, 4, 1], [2, 1, 5], [2, 5, 0],
    [3, 4, 0], [3, 1, 4], [3, 5, 1], [3, 0, 5],
  ]
  return { verts, faces }
}

// ── recipes ─────────────────────────────────────────────────────────────────
function buildKatana(p) {
  const parts = []
  const scale = p.scale ?? 1
  // blade
  const bladeLen = 2.8 * scale
  parts.push(blade(bladeLen, 0.16 * scale, 0.045 * scale, 0.05, 10))
  // guard (thin octagon disc)
  parts.push(lathe([{ r: 0.36 * scale, y: -0.04 }, { r: 0.36 * scale, y: 0.04 }, { r: 0.05 * scale, y: 0.04 }, { r: 0.05 * scale, y: -0.04 }], 12, { closed: false }))
  // handle (slight taper)
  const hLen = 1.0 * scale
  parts.push(lathe([
    { r: 0.05 * scale, y: -hLen - 0.04 },
    { r: 0.085 * scale, y: -hLen * 0.7 - 0.04 },
    { r: 0.075 * scale, y: -0.04 },
  ], 12))
  // pommel
  parts.push(lathe([{ r: 0.001, y: -hLen - 0.12 }, { r: 0.08 * scale, y: -hLen - 0.1 }, { r: 0.09 * scale, y: -hLen - 0.05 }, { r: 0.09 * scale, y: -hLen }], 12))
  return parts
}

function buildSword(p) {
  const parts = []
  const scale = p.scale ?? 1
  parts.push(blade(2.2 * scale, 0.18 * scale, 0.06 * scale, 0.08, 9))
  parts.push(lathe([{ r: 0.2 * scale, y: -0.03 }, { r: 0.2 * scale, y: 0.03 }, { r: 0.06 * scale, y: 0.03 }, { r: 0.06 * scale, y: -0.03 }], 10, { closed: false }))
  parts.push(lathe([{ r: 0.07 * scale, y: -0.9 * scale }, { r: 0.09 * scale, y: -0.4 * scale }, { r: 0.08 * scale, y: -0.03 }], 10))
  parts.push(uvSphere(0.09 * scale, 6, 10, -0.09 * scale, 0.09 * scale))
  return parts
}

function buildDagger(p) {
  const parts = []
  const scale = p.scale ?? 1
  parts.push(blade(1.5 * scale, 0.13 * scale, 0.05 * scale, 0.05, 8))
  parts.push(lathe([{ r: 0.15 * scale, y: -0.02 }, { r: 0.15 * scale, y: 0.02 }, { r: 0.05 * scale, y: 0.02 }, { r: 0.05 * scale, y: -0.02 }], 8, { closed: false }))
  parts.push(lathe([{ r: 0.06 * scale, y: -0.55 * scale }, { r: 0.075 * scale, y: -0.02 }], 8))
  return parts
}

function buildSpear(p) {
  const parts = []
  const scale = p.scale ?? 1
  parts.push(blade(1.2 * scale, 0.14 * scale, 0.05 * scale, 0.05, 8))
  parts.push(lathe([{ r: 0.07 * scale, y: -3.4 * scale }, { r: 0.075 * scale, y: -0.0 }], 8))
  parts.push(uvSphere(0.06 * scale, 6, 8, -0.06 * scale, 0.06 * scale))
  return parts
}

function buildPickaxe(p) {
  const parts = []
  const scale = p.scale ?? 1
  parts.push(lathe([{ r: 0.055 * scale, y: -1.6 * scale }, { r: 0.075 * scale, y: -0.8 * scale }, { r: 0.06 * scale, y: 0 }], 8))
  // curved head: two short prongs via a thin tapered box + wedge
  const headW = 0.55 * scale
  parts.push(box([headW, 0.09 * scale, 0.09 * scale], [0, 0.045 * scale, 0]))
  // prong tips
  parts.push(box([0.12 * scale, 0.22 * scale, 0.09 * scale], [-headW / 2 - 0.03 * scale, 0.11 * scale, 0]))
  parts.push(box([0.12 * scale, 0.22 * scale, 0.09 * scale], [headW / 2 + 0.03 * scale, 0.11 * scale, 0]))
  return parts
}

function buildStaff(p) {
  const parts = []
  const scale = p.scale ?? 1
  parts.push(lathe([{ r: 0.08 * scale, y: -3.2 * scale }, { r: 0.1 * scale, y: -1.6 * scale }, { r: 0.08 * scale, y: 0 }], 10))
  parts.push(uvSphere(0.18 * scale, 10, 14, 0, 0.18 * scale))
  return parts
}

function buildCrystal(p, rng) {
  const scale = p.scale ?? 1
  const n = (p.facets ?? 6) * 2
  const ry = (p.height ?? 1.6) * scale
  const rx = (p.width ?? 0.4) * scale
  // crystal = elongated n-gon bipyramid with rotated tip
  const verts = []
  const faces = []
  const base = n / 2
  const bottom = []
  const top = []
  const twist = (rng() - 0.5) * 0.5
  for (let i = 0; i < base; i++) {
    const a = (i / base) * Math.PI * 2
    const rr = rx * (0.9 + rng() * 0.25)
    bottom.push(V3(Math.cos(a) * rr, -ry / 2, Math.sin(a) * rr))
  }
  for (let i = 0; i < base; i++) {
    const a = (i / base) * Math.PI * 2 + twist
    const rr = rx * (0.9 + rng() * 0.25)
    top.push(V3(Math.cos(a) * rr, ry / 2, Math.sin(a) * rr))
  }
  verts.push(...bottom, ...top)
  const bIdx = (i) => i
  const tIdx = (i) => base + i
  for (let i = 0; i < base; i++) {
    const j = (i + 1) % base
    faces.push([bIdx(i), tIdx(i), tIdx(j)], [bIdx(i), tIdx(j), bIdx(j)])
  }
  // caps
  const bTip = verts.length
  verts.push(V3(0, -ry / 2 - 0.35 * scale, 0))
  const tTip = verts.length
  verts.push(V3(0, ry / 2 + 0.35 * scale, 0))
  for (let i = 0; i < base; i++) {
    const j = (i + 1) % base
    faces.push([bTip, bIdx(j), bIdx(i)], [tTip, tIdx(i), tIdx(j)])
  }
  return { verts, faces }
}

function buildGem(p) {
  const scale = p.scale ?? 1
  const g = octahedron(0.5 * scale, 0.7 * scale, 0.5 * scale)
  return g
}

function buildRock(p) {
  const seed = p.seed ?? 1
  const radius = p.radius ?? 1
  const lat = 12
  const lon = 16
  const verts = []
  const faces = []
  const grid = []
  for (let i = 0; i <= lat; i++) {
    const row = []
    const phi = (i / lat) * Math.PI
    const cp = Math.cos(phi)
    const sp = Math.sin(phi)
    for (let j = 0; j <= lon; j++) {
      const theta = (j / lon) * Math.PI * 2
      const ct = Math.cos(theta)
      const st = Math.sin(theta)
      const n1 = valueNoise(sp * ct * 2.2, cp * 2.2, sp * st * 2.2, seed)
      const n2 = valueNoise(sp * ct * 5.0 + 7, cp * 5.0 + 7, sp * st * 5.0 + 7, seed) * 0.35
      const r = radius * (0.72 + 0.5 * n1 + 0.25 * n2)
      const v = V3(r * sp * ct, r * cp, r * sp * st)
      verts.push(v)
      row.push(verts.length - 1)
    }
    grid.push(row)
  }
  for (let i = 0; i < lat; i++) {
    for (let j = 0; j < lon; j++) {
      const a = grid[i][j]
      const b = grid[i][j + 1]
      const c = grid[i + 1][j + 1]
      const d = grid[i + 1][j]
      faces.push([a, c, b], [a, d, c])
    }
  }
  return { verts, faces }
}

function buildBarrel(p) {
  const scale = p.scale ?? 1
  const r = 0.5 * scale
  const h = 1.0 * scale
  const profile = [
    { r: 0.001, y: -h / 2 },
    { r: r * 0.94, y: -h / 2 },
    { r: r * 0.98, y: -h / 2 + 0.04 * scale },
    { r: r * 1.08, y: -h * 0.1 },
    { r: r * 0.98, y: h / 2 - 0.04 * scale },
    { r: r * 0.94, y: h / 2 },
    { r: 0.001, y: h / 2 },
  ]
  return lathe(profile, 14)
}

function buildVase(p) {
  const scale = p.scale ?? 1
  const h = 1.4 * scale
  const profile = [
    { r: 0.22 * scale, y: -h / 2 },
    { r: 0.2 * scale, y: -h / 2 + 0.15 * scale },
    { r: 0.48 * scale, y: -h * 0.12 },
    { r: 0.4 * scale, y: h * 0.25 },
    { r: 0.15 * scale, y: h / 2 - 0.12 * scale },
    { r: 0.17 * scale, y: h / 2 },
  ]
  return lathe(profile, 16)
}

function buildCoin(p) {
  const scale = p.scale ?? 1
  const r = 0.45 * scale
  const t = 0.06 * scale
  const profile = [
    { r: r * 0.72, y: -t },
    { r: r, y: -t },
    { r: r, y: t },
    { r: r * 0.72, y: t },
  ]
  return lathe(profile, 18)
}

function buildShield(p) {
  const scale = p.scale ?? 1
  const r = 0.9 * scale
  const profile = [
    { r: 0.001, y: -1.2 * r },
    { r: r * 0.7, y: -1.15 * r },
    { r: r, y: -0.4 * r },
    { r: r * 0.95, y: 0 },
    { r: r, y: 0.5 * r },
    { r: r * 0.6, y: 1.2 * r },
    { r: 0.001, y: 1.25 * r },
  ]
  return lathe(profile, 22)
}

function buildWall(p) {
  const scale = p.scale ?? 1
  const parts = []
  const w = (p.width ?? 6) * scale
  const h = (p.height ?? 3) * scale
  const t = 0.3 * scale
  const merlon = (p.merlons ?? 4)
  parts.push(box([w, h, t], [0, h / 2, 0]))
  for (let i = 0; i < merlon; i++) {
    const x = -w / 2 + (w / merlon) * (i + 0.5)
    parts.push(box([w / merlon * 0.55, 0.6 * scale, t * 1.15], [x, h + 0.3 * scale, 0]))
  }
  return parts
}

function buildTower(p) {
  const parts = []
  const scale = p.scale ?? 1
  const r = 1.1 * scale
  const h = (p.height ?? 5) * scale
  parts.push(lathe([{ r: 0.001, y: 0 }, { r: r, y: 0 }, { r: r, y: h }], 12))
  const cren = 6
  const rr = r * 1.05
  for (let i = 0; i < cren; i++) {
    const a = (i / cren) * Math.PI * 2
    const cx = Math.cos(a) * rr
    const cz = Math.sin(a) * rr
    parts.push(box([0.5 * scale, 0.7 * scale, 0.5 * scale], [cx, h + 0.35 * scale, cz]))
  }
  return parts
}

function buildPrimitive(kind, p) {
  const scale = p.scale ?? 1
  switch (kind) {
    case "sphere": return [uvSphere(scale, 14, 18)]
    case "cube": return [box([scale * 2, scale * 2, scale * 2])]
    case "cylinder": return [lathe([{ r: 0.001, y: -scale }, { r: scale, y: -scale }, { r: scale, y: scale }], 14)]
    case "cone": return [lathe([{ r: 0.001, y: -scale }, { r: scale, y: -scale }, { r: 0.001, y: scale }], 14)]
    case "pyramid": return [octahedron(scale, scale, scale)]
    case "torus": {
      const R = scale
      const rt = scale * 0.35
      const segs = 12
      const segs2 = 16
      const verts = []
      const faces = []
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2
        for (let j = 0; j < segs2; j++) {
          const b = (j / segs2) * Math.PI * 2
          verts.push(V3((R + rt * Math.cos(b)) * Math.cos(a), rt * Math.sin(b), (R + rt * Math.cos(b)) * Math.sin(a)))
        }
      }
      for (let i = 0; i < segs; i++) {
        for (let j = 0; j < segs2; j++) {
          const a = (i * segs2 + j) % (segs * segs2)
          const b = (i * segs2 + (j + 1) % segs2) % (segs * segs2)
          const c = ((i + 1) % segs) * segs2 + (j + 1) % segs2
          const d = ((i + 1) % segs) * segs2 + j
          faces.push([a, c, b], [a, d, c])
        }
      }
      return [{ verts, faces }]
    }
  }
}

// ── assembly ────────────────────────────────────────────────────────────────
// ── UV mapping ──────────────────────────────────────────────────────────────
// Assigns per-corner UVs: each face is projected onto its own plane so every
// triangle gets a clean, non-overlapping [0,1]² island. For a flat/angular mesh
// (props, crystals, blades) adjacent faces share a direction so their islands
// line up; curved parts rely on the texture being noise-driven. This avoids the
// classic "one UV per vertex" failure on welded seams without extra data.
function computeCornerUVs(verts, faces) {
  // Global per-axis minimum: subtracting it keeps UVs ≥ 0, lets adjacent
  // faces share a consistent world-space origin (no per-face tiles → no
  // repeating texture bands), and preserves uniform physical texel density.
  let min = [Infinity, Infinity, Infinity]
  for (const [x, y, z] of verts) {
    if (x < min[0]) min[0] = x
    if (y < min[1]) min[1] = y
    if (z < min[2]) min[2] = z
  }
  const uvs = []
  for (const [a, b, c] of faces) {
    const [ax, ay, az] = verts[a]
    const [bx, by, bz] = verts[b]
    const [cx, cy, cz] = verts[c]
    const ux = bx - ax, uy = by - ay, uz = bz - az
    const vx = cx - ax, vy = cy - ay, vz = cz - az
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const an = Math.abs(nx), bn = Math.abs(ny), cn = Math.abs(nz)
    let uAxis, vAxis
    if (an >= bn && an >= cn) { uAxis = 1; vAxis = 2 } // dominant normal ~X → map Y,Z
    else if (bn >= an && bn >= cn) { uAxis = 0; vAxis = 2 } // ~Y → map X,Z
    else { uAxis = 0; vAxis = 1 } // ~Z → map X,Y
    for (const idx of [a, b, c]) {
      const p = verts[idx]
      uvs.push([
        Math.round((p[uAxis] - min[uAxis]) * 10000) / 10000,
        Math.round((p[vAxis] - min[vAxis]) * 10000) / 10000,
      ])
    }
  }
  return uvs
}

const RECIPES = {
  katana: buildKatana,
  sword: buildSword,
  dagger: buildDagger,
  spear: buildSpear,
  pickaxe: buildPickaxe,
  staff: buildStaff,
  crystal: buildCrystal,
  gem: buildGem,
  rock: buildRock,
  barrel: buildBarrel,
  vase: buildVase,
  coin: buildCoin,
  shield: buildShield,
  wall: buildWall,
  tower: buildTower,
  blade: (p) => [blade((p.length ?? 2.5) * (p.scale ?? 1), 0.16 * (p.scale ?? 1), 0.05 * (p.scale ?? 1), 0.05, 10)],
  sphere: (p) => buildPrimitive("sphere", p),
  cube: (p) => buildPrimitive("cube", p),
  cylinder: (p) => buildPrimitive("cylinder", p),
  cone: (p) => buildPrimitive("cone", p),
  pyramid: (p) => buildPrimitive("pyramid", p),
  torus: (p) => buildPrimitive("torus", p),
}

function mergeParts(parts) {
  const verts = []
  const faces = []
  let offset = 0
  for (const part of parts) {
    for (const v of part.verts) verts.push(v)
    for (const f of part.faces) faces.push([f[0] + offset, f[1] + offset, f[2] + offset])
    offset += part.verts.length
  }
  return { verts, faces }
}

function computeNormals(verts, faces) {
  const normals = verts.map(() => [0, 0, 0])
  for (const [a, b, c] of faces) {
    const [ax, ay, az] = verts[a]
    const [bx, by, bz] = verts[b]
    const [cx, cy, cz] = verts[c]
    const ux = bx - ax, uy = by - ay, uz = bz - az
    const vx = cx - ax, vy = cy - ay, vz = cz - az
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
    nx /= len; ny /= len; nz /= len
    normals[a][0] += nx; normals[a][1] += ny; normals[a][2] += nz
    normals[b][0] += nx; normals[b][1] += ny; normals[b][2] += nz
    normals[c][0] += nx; normals[c][1] += ny; normals[c][2] += nz
  }
  return normals.map(n => {
    const len = Math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) || 1
    return [n[0] / len, n[1] / len, n[2] / len]
  })
}

function orientOutward(verts, faces) {
  const n = faces.length
  if (n === 0) return faces
  const edgeKey = (a, b) => (a < b ? a + "," + b : b + "," + a)
  const edgeMap = new Map()
  for (let fi = 0; fi < n; fi++) {
    const f = faces[fi]
    for (let i = 0; i < 3; i++) {
      const a = f[i], b = f[(i + 1) % 3]
      const k = edgeKey(a, b)
      const dir = a < b ? 1 : -1
      const entry = edgeMap.get(k)
      if (entry) entry.push([fi, dir])
      else edgeMap.set(k, [[fi, dir]])
    }
  }

  const flip = new Array(n).fill(false)
  const visited = new Array(n).fill(false)

  for (let start = 0; start < n; start++) {
    if (visited[start]) continue
    const comp = []
    const queue = [start]
    visited[start] = true
    while (queue.length) {
      const fi = queue.shift()
      comp.push(fi)
      const f = faces[fi]
      const sX = flip[fi] ? -1 : 1
      for (let i = 0; i < 3; i++) {
        const a = f[i], b = f[(i + 1) % 3]
        const dX = a < b ? 1 : -1
        for (const [nf, dY] of edgeMap.get(edgeKey(a, b))) {
          if (nf === fi || visited[nf]) continue
          visited[nf] = true
          if (-(dX * dY) * sX === -1) flip[nf] = true
          queue.push(nf)
        }
      }
    }

    const vset = new Set()
    for (const fi of comp) for (const vi of faces[fi]) vset.add(vi)
    const varr = [...vset]
    const ccx = varr.reduce((s, vi) => s + verts[vi][0], 0) / varr.length
    const ccy = varr.reduce((s, vi) => s + verts[vi][1], 0) / varr.length
    const ccz = varr.reduce((s, vi) => s + verts[vi][2], 0) / varr.length
    let sum = 0
    for (const fi of comp) {
      const [a, b, c] = faces[fi]
      const [ax, ay, az] = verts[a]
      const [bx, by, bz] = verts[b]
      const [cx, cy, cz] = verts[c]
      const ux = bx - ax, uy = by - ay, uz = bz - az
      const vx = cx - ax, vy = cy - ay, vz = cz - az
      let nx = uy * vz - uz * vy
      let ny = uz * vx - ux * vz
      let nz = ux * vy - uy * vx
      if (flip[fi]) { nx = -nx; ny = -ny; nz = -nz }
      sum += nx * ((ax + bx + cx) / 3 - ccx) + ny * ((ay + by + cy) / 3 - ccy) + nz * ((az + bz + cz) / 3 - ccz)
    }
    if (sum < 0) for (const fi of comp) flip[fi] = !flip[fi]
  }

  for (let fi = 0; fi < n; fi++) {
    if (flip[fi]) { const f = faces[fi]; faces[fi] = [f[2], f[1], f[0]] }
  }
  return faces
}

export function generateMesh(descriptor) {
  const kind = String(descriptor?.kind || "crystal").toLowerCase()
  const recipe = RECIPES[kind]
  if (!recipe) throw new Error(`Unknown mesh kind: ${kind}`)
  const seed = descriptor?.seed != null ? descriptor.seed : Math.floor(Math.random() * 2 ** 31)
  const rng = mulberry32(seed)
  const parts = recipe(descriptor, rng)
  const partsArr = Array.isArray(parts) ? parts : [parts]
  const geo = mergeParts(partsArr)
  orientOutward(geo.verts, geo.faces)
  const normals = computeNormals(geo.verts, geo.faces)
  const uvs = computeCornerUVs(geo.verts, geo.faces)

  const obj = toObj(kind, descriptor?.name || kind, geo.verts, geo.faces, normals, uvs)

  let min = [Infinity, Infinity, Infinity]
  let max = [-Infinity, -Infinity, -Infinity]
  for (const v of geo.verts) {
    min = [Math.min(min[0], v[0]), Math.min(min[1], v[1]), Math.min(min[2], v[2])]
    max = [Math.max(max[0], v[0]), Math.max(max[1], v[1]), Math.max(max[2], v[2])]
  }

  return {
    obj,
    kind,
    name: descriptor?.name || kind,
    scale: descriptor?.scale ?? 1,
    vertexCount: geo.verts.length,
    faceCount: geo.faces.length,
    uvCount: uvs.length,
    material: resolveMaterial(descriptor),
    color: descriptor?.color ?? defaultColorFor(kind),
    bounds: { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] },
  }
}

// Surface appearance (used by the texture engine upstream).
export function resolveMaterial(descriptor) {
  if (descriptor?.material) return String(descriptor.material).toLowerCase()
  return defaultMaterialFor(String(descriptor?.kind || "crystal").toLowerCase())
}

function defaultMaterialFor(kind) {
  const base = {
    katana: "metal", sword: "metal", dagger: "metal", spear: "metal",
    pickaxe: "metal", blade: "metal", coin: "gold", shield: "metal",
    staff: "wood", barrel: "wood", vase: "ceramic", crystal: "gem",
    gem: "gem", rock: "stone", wall: "stone", tower: "stone",
    sphere: "metal", cube: "metal", cylinder: "metal", cone: "metal",
    pyramid: "metal", torus: "metal",
  }
  return base[kind] || "metal"
}

function defaultColorFor(kind) {
  const base = {
    katana: "#c8ccd8", sword: "#c8ccd8", dagger: "#c8ccd8", spear: "#c8ccd8",
    pickaxe: "#a89f8a", blade: "#dfe3ec", coin: "#f4c430", shield: "#88909e",
    staff: "#6b4a2f", barrel: "#6b4a2f", vase: "#b87333", crystal: "#7ff0ff",
    gem: "#ff5fd0", rock: "#8f8f96", wall: "#9aa0ab", tower: "#9aa0ab",
    sphere: "#c8ccd8", cube: "#c8ccd8", cylinder: "#c8ccd8", cone: "#c8ccd8",
    pyramid: "#c8ccd8", torus: "#c8ccd8",
  }
  return base[kind] || "#c8ccd8"
}

function toObj(name, objName, verts, faces, normals, uvs) {
  const lines = []
  lines.push(`o ${objName.replace(/[^A-Za-z0-9_]/g, "_")}`)
  for (const [x, y, z] of verts) lines.push(`v ${fmt(x)} ${fmt(y)} ${fmt(z)}`)
  for (const [x, y, z] of normals) lines.push(`vn ${fmt(x)} ${fmt(y)} ${fmt(z)}`)
  if (uvs && uvs.length === faces.length * 3) {
    for (const [u, v] of uvs) lines.push(`vt ${fmt(u)} ${fmt(v)}`)
  }
  let vi = 0
  for (const [a, b, c] of faces) {
    if (uvs && uvs.length === faces.length * 3) {
      lines.push(`f ${a + 1}/${vi + 1}/${a + 1} ${b + 1}/${vi + 2}/${b + 1} ${c + 1}/${vi + 3}/${c + 1}`)
      vi += 3
    } else {
      lines.push(`f ${a + 1}//${a + 1} ${b + 1}//${b + 1} ${c + 1}//${c + 1}`)
    }
  }
  return lines.join("\n") + "\n"
}

function fmt(x) {
  const v = Math.round(x * 10000) / 10000
  return Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")
}
