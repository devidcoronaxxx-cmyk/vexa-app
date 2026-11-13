export const maxDuration = 300

import { NextRequest, NextResponse } from "next/server"
import { runGenerate, isValidModel } from "@/lib/ai"
import { getSession } from "@/lib/session"
import { rateLimited } from "@/lib/rate-limit"
import { proxyToCloud } from "@/lib/cloud-proxy"

const MAX_BODY_BYTES = 1_024_000

// Desktop bundle ships without a cloud provider key: generation runs in the cloud
// and this local route just forwards. On Vercel (or dev with keys) it runs.
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
      return await proxyToCloud(req, "/api/actions/generate")
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
      // Browser request: must come from an allowed origin.
      if (!allowedOrigins.includes(origin)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 })
      }
    } else {
      // No Origin header = server-to-server (desktop proxy). Browsers always
      // send Origin on cross-origin POSTs, so this can't be abused via CORS.
      if (rateLimited(req, "ai-proxy", 30, 60_000)) {
        return NextResponse.json({ error: "rate_limited" }, { status: 429 })
      }
    }
  }

  let bodyText: string
  try {
    bodyText = await req.text()
  } catch {
    return NextResponse.json({ error: "body_too_large" }, { status: 413 })
  }

  if (bodyText.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "body_too_large" }, { status: 413 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(bodyText)
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const prompt      = (typeof body.prompt === "string" ? body.prompt : "").trim()
  const model       = (typeof body.model === "string" ? body.model : "").trim()
  const type        = (typeof body.type === "string" ? body.type : "scripting").trim()
  const projectName = (typeof body.projectName === "string" ? body.projectName : "").trim()
  const datamodel   = body.datamodel || null
  const gameModel   = body.gameModel || null
  const history     = (Array.isArray(body.history) ? body.history : []) as unknown[]
  const images      = (Array.isArray(body.images) ? body.images : []).slice(0, 5) as unknown[]
  const files       = (Array.isArray(body.files) ? body.files : []).slice(0, 10) as unknown[]
  const teamMode    = body.teamMode === true
  const thinkingLevel = typeof body.thinkingLevel === "string" ? body.thinkingLevel : "medium"

  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 })
  }

  const effectiveModel = model && isValidModel(model) ? model : ""

  try {
    const result = await runGenerate({ prompt, model: effectiveModel, type, projectName, datamodel, gameModel, history: history as never[], images: images as never[], files: files as never[], teamMode, thinkingLevel })
    return NextResponse.json(result)
  } catch (err) {
    console.error("[/api/actions/generate]", err)
    return NextResponse.json(
      { type: "chat", message: "Something went wrong. Please try again.", __model: "error" },
      { status: 500 }
    )
  }
}
