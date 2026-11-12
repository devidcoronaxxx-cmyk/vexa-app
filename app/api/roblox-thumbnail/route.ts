import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("placeId")
  if (!placeId) return NextResponse.json({ url: null }, { status: 400 })

  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&returnPolicy=PlaceHolder&size=256x256&format=Png&isCircular=false`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()
    const url = data?.data?.[0]?.imageUrl ?? null
    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ url: null }, { status: 500 })
  }
}
