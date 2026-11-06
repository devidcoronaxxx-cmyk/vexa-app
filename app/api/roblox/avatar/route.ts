import { NextRequest, NextResponse } from "next/server"

const ROBLOX_THUMBNAIL_URL =
  "https://thumbnails.roblox.com/v1/users/avatar-headshot" +
  "?size=150x150&format=Png&isCircular=true&userIds="

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")
  if (!userId || !/^\d+$/.test(userId)) {
    return NextResponse.json({ imageUrl: null }, { status: 400 })
  }

  try {
    const res = await fetch(ROBLOX_THUMBNAIL_URL + userId, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return NextResponse.json({ imageUrl: null }, { status: 502 })

    const data = await res.json()
    const entry = data?.data?.[0]
    const imageUrl =
      entry?.state === "Completed" ? (entry.imageUrl as string) : null

    return NextResponse.json({ imageUrl })
  } catch {
    return NextResponse.json({ imageUrl: null }, { status: 502 })
  }
}