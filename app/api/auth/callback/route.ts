import { NextRequest, NextResponse } from "next/server";
import { createSignedSession } from "@/lib/session";

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get("host") ?? "localhost:3000"
  if (host.includes("localhost") || host.includes("vercel.app")) return `https://${host}`
  return "https://dash.vexaaai.vercel.app"
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = getBaseUrl(req);
  const ERROR_URL = `${baseUrl}/oautherror`;

  if (error) {
    return NextResponse.redirect(`${ERROR_URL}?error=access_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${ERROR_URL}?error=missing_params`);
  }

  const storedState = req.cookies.get("roblox_oauth_state")?.value;

  if (!storedState) {
    console.error("CSRF cookie missing.");
    return NextResponse.redirect(`${ERROR_URL}?error=invalid_state`);
  }

  if (storedState !== state) {
    console.error("CSRF mismatch.");
    return NextResponse.redirect(`${ERROR_URL}?error=invalid_state`);
  }

  try {
    const tokenRes = await fetch("https://apis.roblox.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  process.env.ROBLOX_REDIRECT_URI!,
        client_id:     process.env.ROBLOX_CLIENT_ID!,
        client_secret: process.env.ROBLOX_CLIENT_SECRET!,
      }),
    });

    if (!tokenRes.ok) {
      console.error("Token exchange failed");
      return NextResponse.redirect(`${ERROR_URL}?error=token_exchange`);
    }

    const tokenData   = await tokenRes.json();
    const accessToken = tokenData.access_token as string;

    const userRes = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${ERROR_URL}?error=userinfo_failed`);
    }

    const userInfo = await userRes.json();

    const session = {
      userId:      userInfo.sub,
      username:    userInfo.preferred_username ?? userInfo.name ?? userInfo.nickname,
      displayName: userInfo.name ?? userInfo.preferred_username,
      avatar:      userInfo.picture ?? null,
      accessToken,
      expiresAt:   Date.now() + tokenData.expires_in * 1000,
    };

    const response = NextResponse.redirect(baseUrl);
    const isCustomDomain = baseUrl.includes("vexaaai.vercel.app");

    const signedValue = createSignedSession(session);

    response.cookies.set("vexa_session", signedValue, {
      httpOnly: true,
      secure:   true,
      sameSite: "lax",
      maxAge:   tokenData.expires_in,
      path:     "/",
      domain:   isCustomDomain ? ".vexaaai.vercel.app" : undefined,
    });

    response.cookies.set("roblox_oauth_state", "", {
      httpOnly: true,
      secure:   true,
      sameSite: "lax",
      maxAge:   0,
      path:     "/",
      domain:   isCustomDomain ? ".vexaaai.vercel.app" : undefined,
    });

    return response;

  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(`${ERROR_URL}?error=server_error`);
  }
}