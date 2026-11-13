export const maxDuration = 300

import { NextRequest, NextResponse } from "next/server"
import { runThinking, isValidModel } from "@/lib/ai"
import { getSession } from "@/lib/session"
import { rateLimited } from "@/lib/rate-limit"
import { proxyToCloud } from "@/lib/cloud-proxy"

// Desktop bundle ships without a cloud provider key: thinking runs in the cloud.
function shouldProxy(): boolean {
  return !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY && !process.env.LOCAL_LLM_URL
}

export async function OPTIONS() {
  const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://vexaaai.vercel.app"
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  })
}

export async function POST(req: NextRequest) {
  if (shouldProxy()) {
    try {
      return await proxyToCloud(req, "/api/actions/thinking")
    } catch {
      return NextResponse.json(
        { type: "chat", message: "Vexa cloud is unreachable. Check your internet connection.", __model: "error" },
        { status: 502 }
      )
    }
  }

  const origin = req.headers.get("origin") || ""
  const allowedOrigins = [
    "https://vexaaai.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]

  const session = await getSession()

  if (!session) {
    if (origin) {
      if (!allowedOrigins.includes(origin)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 })
      }
    } else {
      if (rateLimited(req, "thinking-proxy", 30, 60_000)) {
        return NextResponse.json({ error: "rate_limited" }, { status: 429 })
      }
    }
  }

  try {
    const body = await req.json()

    const prompt      = (typeof body.prompt === "string" ? body.prompt : "").trim()
    const model       = (typeof body.model === "string" ? body.model : "").trim()
    const projectName = (typeof body.projectName === "string" ? body.projectName : "").trim()
    const datamodel   = body.datamodel || null
    const gameModel   = body.gameModel || null
    const history     = (Array.isArray(body.history) ? body.history : []) as unknown[]

    if (!prompt) {
      return NextResponse.json({ error: "prompt required" }, { status: 400 })
    }

    const effectiveModel = model && isValidModel(model) ? model : ""

    const result = await runThinking({ prompt, model: effectiveModel, projectName, datamodel, gameModel, history: history as never[] })
    return NextResponse.json(result)
  } catch (err) {
    console.error("[/api/actions/thinking]", err)
    return NextResponse.json(
      { type: "chat", message: "Something went wrong. Please try again.", __model: "error" },
      { status: 500 }
    )
  }
}
