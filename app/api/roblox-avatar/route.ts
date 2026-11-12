import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")

  const debug: Record<string, unknown> = {
    step: "start",
    userId,
    timestamp: new Date().toISOString(),
  }

  if (!userId) {
    debug.error = "No userId provided"
    return NextResponse.json({ url: null, debug }, { status: 400 })
  }


  const robloxUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
  debug.requestUrl = robloxUrl

  let res: Response
  try {
    res = await fetch(robloxUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Next.js server)",
        "Accept": "application/json",
      },
    })
    debug.step = "fetch_complete"
    debug.httpStatus = res.status
    debug.httpStatusText = res.statusText
    debug.headers = Object.fromEntries(res.headers.entries())
  } catch (err) {
    debug.step = "fetch_threw"
    debug.error = String(err)
    return NextResponse.json({ url: null, debug })
  }

  let data: unknown
  let rawText: string
  try {
    rawText = await res.text()
    debug.rawBody = rawText.slice(0, 1000)
    data = JSON.parse(rawText)
    debug.step = "json_parsed"
    debug.parsedData = data
  } catch (err) {
    debug.step = "json_parse_failed"
    debug.error = String(err)
    return NextResponse.json({ url: null, debug })
  }

  const parsed = data as { data?: { imageUrl?: string; state?: string }[] }
  const entry = parsed?.data?.[0]
  debug.entry = entry
  debug.imageUrl = entry?.imageUrl ?? null
  debug.state = entry?.state ?? null

  const url = entry?.imageUrl ?? null
  debug.step = "done"
  debug.result = url ? "got_url" : "url_was_null"

  return NextResponse.json({ url, debug })
}
