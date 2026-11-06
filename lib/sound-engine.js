// Procedural audio synthesis engine. Turns a short descriptor from the AI into
// a real 16-bit PCM WAV file (44.1kHz mono) using layered DSP: noise, tonal
// oscillators with pitch envelopes, biquad filter sweeps, distortion, delay
// tails and a soft limiter. Seeded PRNG so the same descriptor reproduces the
// exact same sound.

export const SAMPLE_RATE = 44100

export const SFX_KINDS = [
  "explosion", "whoosh", "slash", "gunshot", "laser", "hit", "coin",
  "levelup", "magic", "sparkle", "lightning", "thunder", "footstep",
  "dash", "heal", "beam", "uiclick", "rumble", "punch", "shatter",
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

// ── noise generators ────────────────────────────────────────────────────────
function white(rng) {
  return rng() * 2 - 1
}

function pink(rng, st) {
  const w = white(rng)
  st.b0 = 0.99886 * st.b0 + w * 0.0555179
  st.b1 = 0.99332 * st.b1 + w * 0.0750759
  st.b2 = 0.969 * st.b2 + w * 0.153852
  st.b3 = 0.8665 * st.b3 + w * 0.3104856
  st.b4 = 0.55 * st.b4 + w * 0.5329522
  st.b5 = -0.7616 * st.b5 - w * 0.016898
  return st.b0 + st.b1 + st.b2 + st.b3 + st.b4 + st.b5 + st.b6 + w * 0.5362
}

function brown(rng, st) {
  st.b0 = (st.b0 + 0.02 * white(rng)) / 1.02
  return st.b0 * 3.5
}

// ── biquad filters (RBJ cookbook) ───────────────────────────────────────────
class Biquad {
  constructor() {
    this.b0 = this.b1 = this.b2 = this.a1 = this.a2 = 0
    this.x1 = this.x2 = this.y1 = this.y2 = 0
  }
  lowpass(freq, q, sr) {
    const w0 = (2 * Math.PI * freq) / sr
    const alpha = Math.sin(w0) / (2 * q)
    const cw = Math.cos(w0)
    const a0 = 1 + alpha
    this.b0 = ((1 - cw) / 2) / a0
    this.b1 = (1 - cw) / a0
    this.b2 = ((1 - cw) / 2) / a0
    this.a1 = (-2 * cw) / a0
    this.a2 = ((1 - alpha) / a0)
  }
  highpass(freq, q, sr) {
    const w0 = (2 * Math.PI * freq) / sr
    const alpha = Math.sin(w0) / (2 * q)
    const cw = Math.cos(w0)
    const a0 = 1 + alpha
    this.b0 = ((1 + cw) / 2) / a0
    this.b1 = (-(1 + cw)) / a0
    this.b2 = ((1 + cw) / 2) / a0
    this.a1 = (-2 * cw) / a0
    this.a2 = ((1 - alpha) / a0)
  }
  bandpass(freq, q, sr) {
    const w0 = (2 * Math.PI * freq) / sr
    const alpha = Math.sin(w0) / (2 * q)
    const cw = Math.cos(w0)
    const a0 = 1 + alpha
    this.b0 = alpha / a0
    this.b1 = 0
    this.b2 = -alpha / a0
    this.a1 = (-2 * cw) / a0
    this.a2 = ((1 - alpha) / a0)
  }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1
    this.x1 = x
    this.y2 = this.y1
    this.y1 = y
    return y
  }
  reset() {
    this.x1 = this.x2 = this.y1 = this.y2 = 0
  }
}

// ── synthesis context ───────────────────────────────────────────────────────
class Track {
  constructor(seed, duration) {
    this.sr = SAMPLE_RATE
    this.length = Math.max(1, Math.round(duration * this.sr))
    this.buf = new Float32Array(this.length)
    this.rng = mulberry32(seed)
    this.noise = { b0: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0, b6: 0 }
  }
  addLayer(fn) {
    // fn(t, i, rng) -> sample
    for (let i = 0; i < this.length; i++) {
      this.buf[i] += fn(i / this.sr, i, this.rng)
    }
  }
  // Schedules short random events (ticks, bells, debris) straight into the
  // buffer. fn(t, rng) returns null | { gap, length, sample(lt) } where lt is
  // the offset in samples since the event started.
  addRandomEvents(fn) {
    let next = 0.02
    for (let i = 0; i < this.length; i++) {
      const t = i / this.sr
      if (t >= next) {
        const ev = fn(t, this.rng)
        if (!ev) {
          next = t + 0.02
          continue
        }
        next = t + ev.gap
        const len = Math.min(ev.length, this.length - i)
        for (let k = 0; k < len; k++) {
          this.buf[i + k] += ev.sample(k, t)
        }
        i += len - 1
      }
    }
  }
  master() {
    // fade in 3ms, fade out 25ms to kill clicks
    const fadeIn = Math.min(this.length, Math.round(this.sr * 0.003))
    const fadeOut = Math.min(this.length, Math.round(this.sr * 0.025))
    for (let i = 0; i < fadeIn; i++) this.buf[i] *= i / fadeIn
    for (let i = fadeOut; i > 0; i--) this.buf[this.length - i] *= i / fadeOut
    // soft limiter + normalize to ~-1 dBFS
    let peak = 0
    for (let i = 0; i < this.length; i++) peak = Math.max(peak, Math.abs(this.buf[i]))
    const target = 0.89
    const gain = peak > 0 ? target / peak : 1
    for (let i = 0; i < this.length; i++) {
      let s = this.buf[i] * gain
      s = Math.tanh(s * 1.6) / Math.tanh(1.6)
      this.buf[i] = s
    }
  }
  toWav() {
    this.master()
    return encodeWav(this.buf, this.sr)
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────
function env(t, a, d, s = 0, r = 0) {
  // simple ADSR returning 0..1, times in seconds
  if (t < a) return a > 0 ? t / a : 1
  const afterAttack = t - a
  if (afterAttack < d) {
    const p = d > 0 ? afterAttack / d : 1
    return 1 - (1 - s) * p
  }
  if (s > 0 && r > 0) {
    const afterDecay = afterAttack - d
    if (afterDecay < r) return s * (1 - afterDecay / r)
  }
  return s
}

function expDecay(t, tau) {
  return Math.exp(-t / tau)
}

function oscSine(t, f, phase = 0) {
  return Math.sin(2 * Math.PI * f * t + phase)
}

function oscSaw(t, f) {
  return 2 * ((t * f) % 1) - 1
}

function oscSquare(t, f) {
  return ((t * f) % 1) < 0.5 ? 1 : -1
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x))
}

// ── recipes ─────────────────────────────────────────────────────────────────
// Each recipe adds one or more layers. p = descriptor params (duration, pitch…).

function addExplosion(tr, p) {
  const dur = p.duration || 2.2
  const lp = new Biquad()
  const lp2 = new Biquad()
  const hp = new Biquad()
  // deep sub thump
  tr.addLayer((t) => {
    const f = 70 - 50 * clamp01(t / 0.4)
    return oscSine(t, f) * expDecay(t, 0.12) * 1.6
  })
  // brown-noise body, LP sweep down
  tr.addLayer((t) => {
    lp.lowpass(Math.max(60, 900 * Math.exp(-t * 3)), 0.6, tr.sr)
    return lp.process(brown(tr.rng, tr.noise)) * expDecay(t, 0.35) * 2.2
  })
  // initial crack (highpassed burst)
  tr.addLayer((t) => {
    hp.highpass(2200 - 1500 * clamp01(t / 0.3), 0.8, tr.sr)
    const g = t < 0.12 ? 1 - t / 0.12 : 0
    return hp.process(white(tr.rng)) * g * 1.2
  })
  // long rumble tail with second LP
  tr.addLayer((t) => {
    lp2.lowpass(Math.max(45, 300 * Math.exp(-t * 2.2)), 0.5, tr.sr)
    return lp2.process(brown(tr.rng, tr.noise)) * expDecay(t, 0.9) * 1.4
  })
  // metal debris rattle (sparse HP ticks after 0.25s)
  tr.addRandomEvents((t, rng) => {
    if (t < 0.25 || t > dur * 0.7) return null
    return {
      gap: 0.05 + rng() * 0.12,
      length: Math.round(tr.sr * 0.05),
      sample: (k) => (rng() * 2 - 1) * 0.5 * Math.exp(-k / (tr.sr * 0.015)) * (1 - t / dur),
    }
  })
  // echo tail
  const delaySamples = Math.round(tr.sr * 0.09)
  const tail = new Float32Array(tr.length)
  for (let i = 0; i < tr.length; i++) {
    const src = tr.buf[i]
    tail[i] = src
    if (i + delaySamples < tr.length) tail[i + delaySamples] += src * 0.25
  }
  tr.buf = tail
}

function addWhoosh(tr, p) {
  const dur = p.duration || 0.75
  const bp = new Biquad()
  let f = p.freqStart ?? 350
  const fEnd = p.freqEnd ?? 2800
  tr.addLayer((t) => {
    const p01 = clamp01(t / dur)
    // sweep up then fall
    const fNow = p01 < 0.6
      ? f + (fEnd - f) * (p01 / 0.6)
      : fEnd - (fEnd - f * 1.6) * ((p01 - 0.6) / 0.4)
    bp.bandpass(Math.max(120, fNow), 1.1, tr.sr)
    const env = Math.sin(Math.PI * p01) ** 1.8
    return bp.process(white(tr.rng)) * env * 1.4
  })
  // breathy low body
  const lp = new Biquad()
  tr.addLayer((t) => {
    lp.lowpass(900, 0.7, tr.sr)
    const p01 = clamp01(t / dur)
    return lp.process(pink(tr.rng, tr.noise)) * Math.sin(Math.PI * p01) * 0.35
  })
}

function addSlash(tr, p) {
  const dur = p.duration || 0.32
  const hp = new Biquad()
  const bp = new Biquad()
  tr.addLayer((t) => {
    const p01 = clamp01(t / dur)
    hp.highpass(1400 + 2600 * Math.sin(Math.PI * p01), 0.9, tr.sr)
    const g = Math.sin(Math.PI * p01) ** 2
    return hp.process(white(tr.rng)) * g * 1.5
  })
  // metallic ring
  tr.addLayer((t) => {
    bp.bandpass(2400 + 900 * Math.sin(2 * Math.PI * t / dur), 14, tr.sr)
    return bp.process(white(tr.rng)) * expDecay(t, 0.08) * 0.6
  })
  // whoosh base
  const w = new Biquad()
  tr.addLayer((t) => {
    const p01 = clamp01(t / dur)
    w.bandpass(500 + 2500 * p01, 1.2, tr.sr)
    return w.process(white(tr.rng)) * Math.sin(Math.PI * p01) * 0.5
  })
}

function addGunshot(tr) {
  // crack
  tr.addLayer((t) => {
    const g = t < 0.02 ? 1 - t / 0.02 : 0
    return white(tr.rng) * g * 1.8
  })
  // body boom
  const lp = new Biquad()
  tr.addLayer((t) => {
    lp.lowpass(Math.max(55, 300 * Math.exp(-t * 14)), 0.5, tr.sr)
    return lp.process(brown(tr.rng, tr.noise)) * expDecay(t, 0.14) * 2.4
  })
  // mechanical snap
  tr.addLayer((t) => {
    const f = 240 * Math.exp(-t * 9) + 40
    return oscSine(t, f) * expDecay(t, 0.05) * 0.8
  })
  // tail room
  const lp2 = new Biquad()
  tr.addLayer((t) => {
    lp2.lowpass(420, 0.5, tr.sr)
    return lp2.process(brown(tr.rng, tr.noise)) * expDecay(t, 0.5) * 0.5
  })
}

function addLaser(tr, p) {
  const dur = p.duration || 0.42
  const fStart = p.freqStart ?? 1800
  const fEnd = p.freqEnd ?? 180
  tr.addLayer((t) => {
    const f = fStart * Math.pow(fEnd / fStart, clamp01(t / dur))
    let s = oscSaw(t, f) * 0.7 + oscSquare(t, f * 1.01) * 0.3
    s = Math.tanh(s * 3)
    return s * Math.sin(Math.PI * clamp01(t / dur)) * 0.9
  })
  // harmonic sheen
  tr.addLayer((t) => {
    const f = (fStart * Math.pow(fEnd / fStart, clamp01(t / dur))) * 2.01
    return oscSine(t, f) * Math.sin(Math.PI * clamp01(t / dur)) * 0.25
  })
  // zap tail
  const bp = new Biquad()
  tr.addLayer((t) => {
    bp.bandpass(1400, 2, tr.sr)
    return bp.process(white(tr.rng)) * expDecay(t, 0.05) * 0.3
  })
}

function addHit(tr) {
  // meaty thump
  tr.addLayer((t) => {
    const f = 130 * Math.exp(-t * 18) + 35
    return oscSine(t, f) * expDecay(t, 0.09) * 1.8
  })
  // impact smack
  const lp = new Biquad()
  tr.addLayer((t) => {
    lp.lowpass(1200, 0.8, tr.sr)
    const g = t < 0.04 ? 1 : expDecay(t - 0.04, 0.03)
    return lp.process(white(tr.rng)) * g * 1.2
  })
  // crackle snap
  tr.addLayer((t) => {
    const g = t < 0.012 ? 1 - t / 0.012 : 0
    return white(tr.rng) * g * 1.1
  })
  // body
  tr.addLayer((t) => {
    return oscSine(t, 60) * expDecay(t, 0.2) * 0.7
  })
}

function addCoin(tr, p) {
  const base = (p.pitch ?? 1) * 988
  tr.addLayer((t) => {
    const g = t < 0.16 ? 1 : expDecay(t - 0.16, 0.1)
    return oscSine(t, base, Math.PI * 0.5) * g * 0.7 + oscSine(t, base * 2.76, 0.9) * g * 0.12
  })
  tr.addLayer((t) => {
    const g = t < 0.34 ? 1 : expDecay(t - 0.34, 0.12)
    const off = Math.max(0, t - 0.15)
    return oscSine(off, base * 1.335, 1.1) * g * 0.75 + oscSine(off, base * 2.98, 0.5) * g * 0.12
  })
  // sparkle ticks
  tr.addLayer((t) => {
    const g = t < 0.4 ? 1 : expDecay(t - 0.4, 0.2)
    return oscSine(t, base * 2.02, 2.2) * g * 0.15
  })
}

function addLevelup(tr) {
  const seq = [523.25, 659.25, 783.99, 1046.5]
  tr.addLayer((t) => {
    const step = clamp01(t / 0.7) * (seq.length - 1)
    const idx = Math.min(seq.length - 1, Math.floor(step))
    const f = seq[idx] + (seq[idx + 1] || seq[idx] * 2) * 0
    const local = t - idx * (0.7 / (seq.length - 1))
    const g = env(local, 0.005, 0.12)
    return (oscSine(t, f) + 0.3 * oscSine(t, f * 2)) * g * 0.7
  })
  // shimmer
  tr.addLayer((t) => {
    const g = Math.sin(Math.PI * clamp01(t / 0.9)) ** 2
    return oscSine(t, 2093) * g * 0.1 + oscSine(t, 2637) * g * 0.07
  })
}

function addMagic(tr, p) {
  // airy chord shimmer
  const f = p.pitch ?? 660
  tr.addLayer((t) => {
    const g = Math.sin(Math.PI * clamp01(t / (p.duration || 1.4))) ** 2
    return (oscSine(t, f, 0.4) * 0.4 + oscSine(t, f * 1.25, 1.8) * 0.3 + oscSine(t, f * 1.5, 3.1) * 0.2) * g * 0.7
  })
  // sparkle ticks rising
  tr.addRandomEvents((t, rng) => {
    if (t < 0.05 || t > (p.duration || 1.4) * 0.9) return null
    return {
      gap: 0.06 + rng() * 0.1,
      length: Math.round(tr.sr * 0.09),
      sample: (k) => oscSine(k / tr.sr, (1400 + rng() * 2200) * (1 + (k / tr.sr) * 8), rng() * 6) * (1 - k / (tr.sr * 0.09)) * 0.18,
    }
  })
}

function addSparkle(tr) {
  tr.addRandomEvents((t, rng) => {
    if (t > 0.8) return null
    return {
      gap: 0.04 + rng() * 0.08,
      length: Math.round(tr.sr * 0.08),
      sample: (k) => oscSine(k / tr.sr, (1800 + rng() * 2600) * (1 + (k / tr.sr) * 12), rng() * 6) * (1 - k / (tr.sr * 0.08)) * 0.22,
    }
  })
}

function addLightning(tr) {
  // crackle
  const hp = new Biquad()
  let next = 0
  tr.addLayer((t) => {
    hp.highpass(1500, 0.7, tr.sr)
    const burst = t >= next
    if (burst) next = t + 0.02 + tr.rng() * 0.06
    return hp.process(white(tr.rng)) * (burst ? 1 : 0.3) * (1 - clamp01(t / 0.5)) * 1.3
  })
  // deep boom
  const lp = new Biquad()
  tr.addLayer((t) => {
    lp.lowpass(Math.max(50, 500 * Math.exp(-t * 4)), 0.5, tr.sr)
    return lp.process(brown(tr.rng, tr.noise)) * expDecay(t, 0.25) * 2.4
  })
  // long rumble
  const lp2 = new Biquad()
  tr.addLayer((t) => {
    lp2.lowpass(120, 0.5, tr.sr)
    return lp2.process(brown(tr.rng, tr.noise)) * expDecay(t, 1.1) * 0.9
  })
}

function addThunder(tr) {
  const lp = new Biquad()
  tr.addLayer((t) => {
    lp.lowpass(Math.max(45, 400 * Math.exp(-t * 1.6)), 0.5, tr.sr)
    return lp.process(brown(tr.rng, tr.noise)) * (0.7 + 0.3 * Math.sin(t * 9)) * expDecay(t, 1.4) * 2.2
  })
  // first crack
  tr.addLayer((t) => {
    const g = t < 0.03 ? 1 - t / 0.03 : 0
    return white(tr.rng) * g * 1.4
  })
}

function addFootstep(tr) {
  const lp = new Biquad()
  tr.addLayer((t) => {
    lp.lowpass(280, 0.7, tr.sr)
    const g = expDecay(t, 0.06)
    return lp.process(brown(tr.rng, tr.noise)) * g * 2.0
  })
  tr.addLayer((t) => {
    const f = 95 * Math.exp(-t * 30) + 40
    return oscSine(t, f) * expDecay(t, 0.05) * 0.9
  })
  // scuff
  const hp = new Biquad()
  tr.addLayer((t) => {
    hp.highpass(1500, 1, tr.sr)
    return hp.process(white(tr.rng)) * expDecay(t, 0.02) * 0.5
  })
}

function addDash(tr, p) {
  const dur = p.duration || 0.35
  const bp = new Biquad()
  tr.addLayer((t) => {
    const p01 = clamp01(t / dur)
    bp.bandpass(500 + 3000 * p01, 1.0, tr.sr)
    return bp.process(white(tr.rng)) * Math.sin(Math.PI * p01) ** 2 * 1.5
  })
  // speed whoosh harmonic
  tr.addLayer((t) => {
    const f = 300 + 900 * clamp01(t / dur)
    return oscSine(t, f) * Math.sin(Math.PI * clamp01(t / dur)) * 0.25
  })
}

function addHeal(tr, p) {
  const dur = p.duration || 1.6
  const f = p.pitch ?? 330
  tr.addLayer((t) => {
    const p01 = clamp01(t / dur)
    const rise = f * (1 + 0.5 * p01)
    return (oscSine(t, rise, 0.3) * 0.5 + oscSine(t, rise * 1.5, 2.1) * 0.25) * Math.sin(Math.PI * p01) ** 1.4 * 0.8
  })
  // warm pad
  tr.addLayer((t) => {
    const p01 = clamp01(t / dur)
    return oscSine(t, f * 1.12, 4.2) * Math.sin(Math.PI * p01) ** 1.6 * 0.3
  })
  // bell accent
  tr.addLayer((t) => {
    const g = t < 0.25 ? 1 : expDecay(t - 0.25, 0.4)
    return oscSine(t, f * 2.02, 1.4) * g * 0.12
  })
}

function addBeam(tr, p) {
  const dur = p.duration || 0.9
  const fStart = p.freqStart ?? 150
  const fEnd = p.freqEnd ?? 700
  const lp = new Biquad()
  const hp = new Biquad()
  tr.addLayer((t) => {
    const p01 = clamp01(t / dur)
    const f = fStart + (fEnd - fStart) * p01
    lp.lowpass(f * 2.2, 0.6, tr.sr)
    hp.highpass(f * 0.6, 0.6, tr.sr)
    let s = oscSaw(t, f) * 0.5 + oscSquare(t, f * 1.005) * 0.3
    s = Math.tanh(s * 2.5)
    const g = Math.sin(Math.PI * p01) ** 0.8
    return (lp.process(s) + hp.process(s) * 0.4) * g * 0.9
  })
  // tremolo shimmer
  tr.addLayer((t) => {
    const p01 = clamp01(t / dur)
    const trem = 0.75 + 0.25 * Math.sin(2 * Math.PI * 30 * t)
    return oscSine(t, fStart * 2 * (1 + p01)) * Math.sin(Math.PI * p01) * trem * 0.15
  })
}

function addUiClick(tr) {
  tr.addLayer((t) => {
    const g = t < 0.03 ? 1 - t / 0.03 : 0
    return oscSine(t, 1200, 0.5) * g * 0.5
  })
  tr.addLayer((t) => {
    const g = t < 0.02 ? 1 - t / 0.02 : 0
    return white(tr.rng) * g * 0.3
  })
}

function addRumble(tr, p) {
  const dur = p.duration || 2.5
  const lp = new Biquad()
  tr.addLayer((t) => {
    lp.lowpass(Math.max(35, 90 + 30 * Math.sin(t * 5)), 0.6, tr.sr)
    return lp.process(brown(tr.rng, tr.noise)) * (0.8 + 0.2 * Math.sin(t * 7)) * 2.0
  })
  // sub pulse
  tr.addLayer((t) => {
    const pulsing = 0.6 + 0.4 * Math.sin(2 * Math.PI * 2.5 * t)
    return oscSine(t, 42, 1) * expDecay(t, dur * 0.25) * pulsing * 1.2
  })
}

function addPunch(tr) {
  // quick thump
  tr.addLayer((t) => {
    const f = 110 * Math.exp(-t * 22) + 40
    return oscSine(t, f) * expDecay(t, 0.07) * 1.8
  })
  // snap
  tr.addLayer((t) => {
    const g = t < 0.015 ? 1 - t / 0.015 : 0
    return white(tr.rng) * g * 1.2
  })
  // chest thud
  const lp = new Biquad()
  tr.addLayer((t) => {
    lp.lowpass(400, 0.8, tr.sr)
    return lp.process(brown(tr.rng, tr.noise)) * expDecay(t, 0.1) * 1.3
  })
}

function addShatter(tr) {
  // glass crack
  const hp = new Biquad()
  tr.addLayer((t) => {
    hp.highpass(3000, 0.8, tr.sr)
    const g = expDecay(t, 0.06)
    return hp.process(white(tr.rng)) * g * 1.4
  })
  // tinkling debris (dense random bells)
  tr.addRandomEvents((t, rng) => {
    if (t < 0.02 || t > 0.6) return null
    return {
      gap: 0.015 + rng() * 0.05,
      length: Math.round(tr.sr * 0.12),
      sample: (k) => oscSine(k / tr.sr, 2200 + rng() * 5000, rng() * 6) * (1 - k / (tr.sr * 0.12)) * 0.3,
    }
  })
}

const RECIPES = {
  explosion: addExplosion,
  whoosh: addWhoosh,
  slash: addSlash,
  gunshot: addGunshot,
  laser: addLaser,
  hit: addHit,
  coin: addCoin,
  levelup: addLevelup,
  magic: addMagic,
  sparkle: addSparkle,
  lightning: addLightning,
  thunder: addThunder,
  footstep: addFootstep,
  dash: addDash,
  heal: addHeal,
  beam: addBeam,
  uiclick: addUiClick,
  rumble: addRumble,
  punch: addPunch,
  shatter: addShatter,
}

export function synthesizeSFX(descriptor) {
  const kind = String(descriptor?.kind || "hit").toLowerCase()
  const recipe = RECIPES[kind]
  if (!recipe) throw new Error(`Unknown sfx kind: ${kind}`)
  const seed = descriptor?.seed != null ? descriptor.seed : Math.floor(Math.random() * 2 ** 31)
  const dur = descriptor?.duration || DEFAULT_DURATIONS[kind] || 1.0
  const tr = new Track(seed, dur)
  recipe(tr, { ...(descriptor || {}), seed })
  return tr.toWav()
}

const DEFAULT_DURATIONS = {
  explosion: 2.2, whoosh: 0.75, slash: 0.32, gunshot: 0.5, laser: 0.42,
  hit: 0.3, coin: 0.5, levelup: 0.9, magic: 1.4, sparkle: 0.8, lightning: 1.6,
  thunder: 2.6, footstep: 0.14, dash: 0.35, heal: 1.6, beam: 0.9, uiclick: 0.06,
  rumble: 2.5, punch: 0.22, shatter: 0.7,
}

// ── WAV encoder ─────────────────────────────────────────────────────────────
export function encodeWav(samples, sampleRate = SAMPLE_RATE) {
  const n = samples.length
  const bytesPerSample = 2
  const buffer = new ArrayBuffer(44 + n * bytesPerSample)
  const view = new DataView(buffer)

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, "RIFF")
  view.setUint32(4, 36 + n * bytesPerSample, true)
  writeStr(8, "WAVE")
  writeStr(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeStr(36, "data")
  view.setUint32(40, n * bytesPerSample, true)

  let offset = 44
  for (let i = 0; i < n; i++) {
    let s = samples[i]
    s = Math.max(-1, Math.min(1, s))
    view.setInt16(offset, Math.round(s * 32767), true)
    offset += 2
  }
  return Buffer.from(buffer)
}
