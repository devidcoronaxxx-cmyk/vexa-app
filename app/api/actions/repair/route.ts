export const maxDuration = 300

import { NextRequest, NextResponse } from "next/server"
import { runRuntimeRepair, isValidModel } from "@/lib/ai"
import { getSession } from "@/lib/session"
import { rateLimited } from "@/lib/rate-limit"
import { proxyToCloud } from "@/lib/cloud-proxy"

const MAX_BODY_BYTES = 2_000_000

// Desktop bundle ships without the NVIDIA key: repair runs in the cloud
// and this local route just forwards. On Vercel (or dev with keys) it runs.
function shouldProxy(): boolean {
  return !process.env.NVIDIA_API_KEY && !process.env.NVIDIA_GLM_API_KEY && !process.env.NVIDIA_GLM_FLASH_API_KEY && !process.env.LOCAL_LLM_URL
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
      return await proxyToCloud(req, "/api/actions/repair")
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
  const projectName = (typeof body.projectName === "string" ? body.projectName : "").trim()
  const generation  = body.generation || null
  const report      = body.report || null

  if (!prompt || !generation || !report) {
    return NextResponse.json(
      { error: "prompt, generation and report required" },
      { status: 400 }
    )
  }

  const effectiveModel = model && isValidModel(model) ? model : ""

  try {
    const result = await runRuntimeRepair({ prompt, generation, report, model: effectiveModel, projectName })
    return NextResponse.json(result)
  } catch (err) {
    console.error("[/api/actions/repair]", err)
    return NextResponse.json(
      { type: "chat", message: "Something went wrong. Please try again.", __model: "error" },
      { status: 500 }
    )
  }
}