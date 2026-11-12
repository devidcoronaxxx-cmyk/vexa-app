export const maxDuration = 300

import { NextResponse } from "next/server"
import { runThinking } from "@/lib/ai"
import { rateLimited } from "@/lib/rate-limit"
import { proxyToCloud } from "@/lib/cloud-proxy"

function shouldProxy() {
  return !process.env.NVIDIA_API_KEY && !process.env.NVIDIA_GLM_API_KEY && !process.env.NVIDIA_GLM_FLASH_API_KEY && !process.env.LOCAL_LLM_URL
}

export async function POST(req) {
  if (shouldProxy()) {
    try {
      return await proxyToCloud(req, "/api/actions/thinking-steps")
    } catch {
      return NextResponse.json({ steps: [] })
    }
  }

  const origin = req.headers.get("origin") || ""
  if (origin && origin !== "https://vexaaai.vercel.app" && !origin.startsWith("http://localhost") && !origin.startsWith("http://127.0.0.1")) {
    return NextResponse.json({ steps: [] }, { status: 403 })
  }
  if (!origin && rateLimited(req, "steps-proxy", 60, 60_000)) {
    return NextResponse.json({ steps: [] }, { status: 429 })
  }

  try {
    const body = await req.json()
    const prompt = (body.prompt || "").trim()

    if (!prompt) {
      return NextResponse.json({ steps: [] })
    }

    const result = await runThinking({ prompt })
    return NextResponse.json({ steps: result.thinking_steps ?? [] })
  } catch (err) {
    console.error("[/api/actions/thinking-steps]", err)
    return NextResponse.json({ steps: [] })
  }
}
