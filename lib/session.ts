import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

export interface VexaSession {
  userId:      string;
  username:    string;
  displayName: string;
  avatar:      string | null;
  accessToken: string;
  expiresAt:   number;
}

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 32) || "";
}

function signSession(data: string): string {
  const secret = getSessionSecret();
  if (!secret) return "";
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function signSessionPayload(session: VexaSession): string {
  const payload = JSON.stringify(session);
  const sig = signSession(payload);
  return `${sig}.${Buffer.from(payload).toString("base64")}`;
}

export function verifySessionPayload(signed: string): VexaSession | null {
  const dotIdx = signed.indexOf(".");
  if (dotIdx === -1) return null;
  const sig = signed.slice(0, dotIdx);
  const payloadB64 = signed.slice(dotIdx + 1);
  const payload = Buffer.from(payloadB64, "base64").toString();
  const expected = signSession(payload);
  if (!expected) return null;

  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  try {
    const session: VexaSession = JSON.parse(payload);
    if (Date.now() > session.expiresAt - 60_000) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<VexaSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("vexa_session")?.value;
  if (!raw) return null;

  return verifySessionPayload(raw);
}

export function createSignedSession(session: VexaSession): string {
  return signSessionPayload(session);
}
