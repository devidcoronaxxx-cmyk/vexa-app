import { NextRequest, NextResponse } from "next/server"

// Desktop bundles ship without secrets: sensitive work happens in the cloud
// deployment and the local standalone server just forwards requests there.
export const CLOUD_API_URL = process.env.CLOUD_API_URL || "https://vexaaai.vercel.app"

export async function proxyToCloud(req: NextRequest, cloudPath: string): Promise<NextResponse> {
  const hasBody = req.method !== "GET" && req.method !== "HEAD"
  const bodyText = hasBody ? await req.text() : undefined

  const res = await fetch(`${CLOUD_API_URL}${cloudPath}`, {
    method: req.method,
    headers: { "Content-Type": "application/json" },
    body: bodyText && bodyText.length > 0 ? bodyText : undefined,
    cache: "no-store",
  })

  const text = await res.text()
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  })
}
