// In-memory OTP store (single local server — fine for the desktop app).
// email -> { code, expiresAt, attempts, sends, firstSentAt }
type Entry = { code: string; expiresAt: number; attempts: number; sends: number; firstSentAt: number; lastSentAt: number };
const store = new Map<string, Entry>();

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 5;

function get(email: string): Entry | undefined {
  const e = store.get(email.toLowerCase());
  if (e && e.expiresAt < Date.now() && e.attempts >= 0) {
    // keep for rate-limit accounting, but mark expired via expiresAt
  }
  return e;
}

export function canSend(email: string): { ok: boolean; waitSec?: number } {
  const now = Date.now();
  const e = get(email);
  if (e && now - e.firstSentAt < 60 * 60 * 1000 && e.sends >= MAX_SENDS_PER_HOUR) {
    return { ok: false, waitSec: Math.ceil((60 * 60 * 1000 - (now - e.firstSentAt)) / 1000) };
  }
  if (e && now < e.expiresAt && now - e.lastSentAt < 30 * 1000) {
    return { ok: false, waitSec: Math.ceil((30 * 1000 - (now - e.lastSentAt)) / 1000) };
  }
  return { ok: true };
}

export function issueCode(email: string): { code: string } {
  const now = Date.now();
  const key = email.toLowerCase();
  const prev = store.get(key);
  const freshWindow = !prev || now - prev.firstSentAt >= 60 * 60 * 1000;
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const entry: Entry = {
    code,
    expiresAt: now + CODE_TTL_MS,
    attempts: 0,
    sends: freshWindow ? 1 : (prev?.sends ?? 0) + 1,
    firstSentAt: freshWindow ? now : prev!.firstSentAt,
    lastSentAt: now,
  };
  store.set(key, entry);
  return { code };
}

export function verifyCode(email: string, code: string): { ok: boolean; error?: string } {
  const e = store.get(email.toLowerCase());
  if (!e) return { ok: false, error: "Nessun codice attivo per questa email. Richiedine uno nuovo." };
  if (Date.now() > e.expiresAt) return { ok: false, error: "Codice scaduto. Richiedine uno nuovo." };
  if (e.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Troppi tentativi. Richiedi un nuovo codice." };
  if (e.code !== code.trim()) {
    e.attempts += 1;
    return { ok: false, error: `Codice errato (${MAX_ATTEMPTS - e.attempts} tentativi rimasti).` };
  }
  store.delete(email.toLowerCase());
  return { ok: true };
}
