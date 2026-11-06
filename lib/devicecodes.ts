import crypto from "crypto";

interface DeviceCode {
  code:      string;
  token:     string | null;
  userId:    string | null;
  username:  string | null;
  createdAt: number;
  expiresAt: number;
}


const CODES = new Map<string, DeviceCode>();


const TOKENS = new Map<string, { userId: string; username: string }>();


setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of CODES) {
    if (now > entry.expiresAt) CODES.delete(code);
  }
}, 60_000);


export function createDeviceCode(): string {
  const code = crypto.randomBytes(4).toString("hex");
  CODES.set(code, {
    code,
    token:     null,
    userId:    null,
    username:  null,
    createdAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 10,
  });
  return code;
}


export function authorizeDeviceCode(
  code: string,
  userId: string,
  username: string
): boolean {
  const entry = CODES.get(code);
  if (!entry || Date.now() > entry.expiresAt) return false;

  const token = "gxp-" + crypto.randomBytes(28).toString("hex");

  entry.token    = token;
  entry.userId   = userId;
  entry.username = username;

  TOKENS.set(token, { userId, username });
  return true;
}


export function pollDeviceCode(code: string): string | null | false {
  const entry = CODES.get(code);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) { CODES.delete(code); return false; }
  return entry.token;
}


export function validateToken(token: string): { userId: string; username: string } | null {
  return TOKENS.get(token) ?? null;
}