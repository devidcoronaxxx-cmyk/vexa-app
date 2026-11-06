import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TIER_ENV: Record<string, string[]> = {
  low: ["APP_DOWNLOAD_URL_LOW", "APP_EXE_URL_LOW", "APP_DOWNLOAD_URL", "APP_EXE_URL"],
  mid: ["APP_DOWNLOAD_URL_MID", "APP_EXE_URL_MID", "APP_DOWNLOAD_URL", "APP_EXE_URL"],
  high: ["APP_DOWNLOAD_URL_HIGH", "APP_EXE_URL_HIGH", "APP_DOWNLOAD_URL", "APP_EXE_URL"],
};

// Serve the installer for a given tier. Falls back to the generic URL if a
// tier-specific one is not configured. Never redirects to a stale/old site.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tier = (url.searchParams.get("tier") || "mid").toLowerCase();
  const keys = TIER_ENV[tier] || TIER_ENV.mid;
  for (const key of keys) {
    const v = (process.env[key] || "").trim();
    if (v) return NextResponse.redirect(v, 302);
  }
  return NextResponse.json(
    { error: "no_download_url_configured", message: "Installer non ancora pubblicato per questo tier. Scaricalo dalla pagina release del progetto." },
    { status: 200 }
  );
}
