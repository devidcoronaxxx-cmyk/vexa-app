// Procedural texture engine. Turns a mesh descriptor into a real PNG (color
// map) using seeded value-noise + per-material recipes (metal, gold, wood, gem,
// stone, ceramic, neon). Deterministic per seed: the same descriptor always
// renders the exact same pixels.

import zlib from "node:zlib"

export const TEXTURE_SIZE = 256

export const TEXTURE_MATERIALS = [
  "metal", "gold", "wood", "gem", "stone", "ceramic", "neon",
]

// ── PRNG + noise ─────────────────────────────────────────────────────────────
function hash2(x, y, seed) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 3266489917)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

function smooth(t) {
  return t * t * (3 - 2 * t)
}

function noise2(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y)
  const xf = smooth(x - xi), yf = smooth(y - yi)
  const c = (dx, dy) => hash2(xi + dx, yi + dy, seed)
  return (
    c(0, 0) * (1 - xf) * (1 - yf) +
    c(1, 0) * xf * (1 - yf) +
    c(0, 1) * (1 - xf) * yf +
    c(1, 1) * xf * yf
  )
}

function fbm(x, y, seed, octaves = 4) {
  let sum = 0, amp = 1, freq = 1, norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq, seed + i * 101)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

// ── color helpers ────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const m = String(hex || "").match(/^#?([0-9a-f]{6})$/i)
  return m
    ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)]
    : [200, 204, 216]
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

// ── material recipes ─────────────────────────────────────────────────────────
// Each returns { r, g, b } 0..255 given (nx, ny) in [0,1], base color and seed.

function metal(nx, ny, base, seed) {
  const n = fbm(nx * 8, ny * 8, seed)
  const streak = noise2(nx * 1.5, ny * 60, seed + 6) * 0.5 + 0.5
  const edge = Math.sin(ny * Math.PI * 3) * 0.5 + 0.5
  const shade = 0.68 + 0.32 * (0.6 * n + 0.3 * streak + 0.1 * edge)
  const t = clamp01(shade)
  return [base[0] * t, base[1] * t, base[2] * t]
}

function gold(nx, ny, base, seed) {
  const n = fbm(nx * 10, ny * 6, seed + 1)
  const sheen = Math.pow(clamp01(Math.sin(ny * Math.PI + nx * 2 + n * 0.4)), 3)
  const sparkle = noise2(nx * 80, ny * 80, seed + 2) > 0.94 ? 1.15 : 1
  const t = clamp01(0.72 + 0.28 * n + 0.35 * sheen) * sparkle
  return [
    Math.min(255, base[0] * t),
    Math.min(255, base[1] * t),
    Math.min(255, base[2] * t * 0.9),
  ]
}

function wood(nx, ny, base, seed) {
  const grain = Math.abs(Math.sin((ny * 14 + fbm(nx * 6, ny * 2, seed + 3) * 2.4) * Math.PI))
  const knot = Math.max(0, 1 - Math.hypot((nx - 0.5) * 4, (ny - 0.5) * 2))
  const t = clamp01(0.55 + grain * 0.35 + knot * 0.25)
  return [base[0] * t, base[1] * t * (0.9 + grain * 0.2), base[2] * t * 0.8]
}

function gem(nx, ny, base, seed) {
  const facets = Math.abs(Math.sin((nx * 14 + ny * 14 + fbm(nx * 8, ny * 8, seed + 4) * 3) * Math.PI))
  const glow = Math.pow(clamp01(1 - Math.hypot(nx - 0.5, ny - 0.5) * 1.7), 2)
  const t = clamp01(0.5 + facets * 0.45 + glow * 0.35)
  return [
    Math.min(255, base[0] * t + 40 * glow),
    Math.min(255, base[1] * t + 30 * glow),
    Math.min(255, base[2] * t + 25 * glow),
  ]
}

function stone(nx, ny, base, seed) {
  const n = fbm(nx * 6, ny * 6, seed + 5)
  const speck = noise2(nx * 40, ny * 40, seed + 7) * 0.5 + 0.5
  const crevice = clamp01(1 - Math.pow(n, 5) * 3)
  const t = clamp01(0.6 + n * 0.3 + speck * 0.12 - crevice * 0.15)
  return [base[0] * t, base[1] * t, base[2] * t]
}

function ceramic(nx, ny, base, seed) {
  const n = fbm(nx * 3, ny * 3, seed + 8)
  const glaze = Math.pow(clamp01(Math.sin((ny + n * 0.5) * Math.PI * 5)), 2) * 0.3
  const t = clamp01(0.75 + n * 0.15 + glaze)
  return [base[0] * t, base[1] * t, base[2] * t]
}

function neon(nx, ny, base, seed) {
  const core = Math.max(0, 1 - Math.hypot(nx - 0.5, ny - 0.5) * 1.8)
  const flicker = 0.75 + fbm(nx * 20, ny * 20, seed + 9) * 0.35
  const t = clamp01(core * flicker + 0.12)
  return [
    Math.min(255, base[0] * t + 120 * core * flicker),
    Math.min(255, base[1] * t + 80 * core * flicker),
    Math.min(255, base[2] * t + 40 * core * flicker),
  ]
}

const RECIPES = {
  metal,
  gold,
  wood,
  gem,
  stone,
  ceramic,
  neon,
}

export function resolveTextureMaterial(descriptor) {
  const kind = String(descriptor?.kind || "").toLowerCase()
  if (descriptor?.material && RECIPES[String(descriptor.material).toLowerCase()]) {
    return String(descriptor.material).toLowerCase()
  }
  const byKind = {
    katana: "metal", sword: "metal", dagger: "metal", spear: "metal",
    pickaxe: "metal", blade: "metal", coin: "gold", shield: "metal",
    staff: "wood", barrel: "wood", vase: "ceramic", crystal: "gem",
    gem: "gem", rock: "stone", wall: "stone", tower: "stone",
    sphere: "metal", cube: "metal", cylinder: "metal", cone: "metal",
    pyramid: "metal", torus: "metal",
  }
  return byKind[kind] || "metal"
}

// ── PNG encoder (no deps: zlib + manual CRC) ────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, "ascii")
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 6   // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowOff = (stride + 1) * y
    raw[rowOff] = 0 // filter None
    rgba.copy(raw, rowOff + 1, y * stride, (y + 1) * stride)
  }
  const idat = zlib.deflateSync(raw, { level: 6 })
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))])
}

// ── public API ──────────────────────────────────────────────────────────────
export function generateTexture(descriptor) {
  const size = TEXTURE_SIZE
  const material = resolveTextureMaterial(descriptor)
  const base = hexToRgb(descriptor?.color)
  const seed =
    descriptor?.seed != null
      ? Math.floor(Number(descriptor.seed)) || 0
      : Math.floor(Math.random() * 2 ** 31)
  const recipe = RECIPES[material]

  if (!recipe) throw new Error(`Unknown texture material: ${material}`)

  const rgba = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = px / size, ny = py / size
      const c = recipe(nx, ny, base, seed)
      const i = (py * size + px) * 4
      rgba[i] = Math.min(255, Math.round(c[0]))
      rgba[i + 1] = Math.min(255, Math.round(c[1]))
      rgba[i + 2] = Math.min(255, Math.round(c[2]))
      rgba[i + 3] = 255
    }
  }

  const png = encodePNG(size, size, rgba)
  return { png, size, material }
}