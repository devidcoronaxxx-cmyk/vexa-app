import { NextResponse } from "next/server";
import { CLOUD_API_URL } from "@/lib/cloud-proxy";

export const dynamic = "force-dynamic";

// Version + download link for the desktop app. On Vercel the URL comes from
// env; the desktop bundle has no env vars, so it asks the cloud instead.
// The `exe` field (optional, env APP_EXE_URL) lets the desktop updater download
// and silently install the new build without leaving the app. `notes` (env
// APP_UPDATE_NOTES) is shown to the user in the "update available" dialog.
export async function GET() {
  const version = "1.8.0";

  const url = (process.env.APP_DOWNLOAD_URL || "").trim();
  if (url) {
    const exe = (process.env.APP_EXE_URL || "").trim() || undefined;
    const notes = (process.env.APP_UPDATE_NOTES || "").trim() || undefined;
    return NextResponse.json({ version, url, name: "Vexa", ...(exe ? { exe } : {}), ...(notes ? { notes } : {}) });
  }

  try {
    const res = await fetch(`${CLOUD_API_URL}/api/app/latest`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data?.url) {
        return NextResponse.json(data);
      }
    }
  } catch {}

  return NextResponse.json({ error: "no_download_url_configured" }, { status: 503 });
}