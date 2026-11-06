import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";
import { createHmac, timingSafeEqual } from "crypto";

const discordStates = new Map<string, number>()
const STATE_TTL_MS = 10 * 60 * 1000

setInterval(() => {
  const now = Date.now()
  for (const [key, ts] of discordStates) {
    if (now - ts > STATE_TTL_MS) discordStates.delete(key)
  }
}, 60_000)

function signState(userId: string): string {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 32) || "";
  const ts = Date.now()
  const payload = `${userId}:${ts}`
  const sig = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16)
  return `${ts}.${sig}.${Buffer.from(userId).toString("base64")}`
}

function verifyState(state: string): string | null {
  const parts = state.split(".")
  if (parts.length !== 3) return null

  const ts = parseInt(parts[0], 10)
  if (isNaN(ts) || Date.now() - ts > STATE_TTL_MS) return null

  let userId: string
  try {
    userId = Buffer.from(parts[2], "base64").toString()
  } catch {
    return null
  }
  if (!userId) return null

  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 32) || "";
  const expected = createHmac("sha256", secret).update(`${userId}:${ts}`).digest("hex").slice(0, 16)
  try {
    if (!timingSafeEqual(Buffer.from(parts[1]), Buffer.from(expected))) return null
  } catch {
    return null
  }

  return userId
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({
      error: "Missing code or state",
      received: { hasCode: !!code, hasState: !!state }
    }, { status: 400 });
  }

  const userId = verifyState(state);
  if (!userId) {
    return NextResponse.json({ error: "Invalid or expired state" }, { status: 400 });
  }

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return NextResponse.json({ error: "Token exchange failed" }, { status: 400 });

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    const guildId = process.env.DISCORD_GUILD_ID;
    if (guildId) {
      await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUser.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": "VexaApp (https://vexaaai.vercel.app, 1.0.0)",
        },
        body: JSON.stringify({ access_token: tokenData.access_token }),
      });
    }

    const admin = getAdminSupabase();
    const { error: dbError } = await admin
      .from("profiles")
      .update({
        discord_id: discordUser.id,
        discord_username: discordUser.username,
        discord_avatar: discordUser.avatar,
      })
      .eq("id", userId);

    if (dbError) throw dbError;

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
