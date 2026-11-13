import { NextResponse } from "next/server"
import { CORS_HEADERS, handleOptions } from "@/lib/cors"
import { currentPrimaryModel, HUNYUAN_MODEL, TRELLIS_MODEL, hunyuanUrl, trellisUrl, is3dServerAlive } from "@/lib/ai"

export async function OPTIONS() {
  return handleOptions()
}

export async function GET() {
  // Local 3D backends appear in the picker ONLY when their server is reachable
  // on the user's machine — a model that would cost something or that can't run
  // is never offered. Health probes are cheap localhost calls.
  const [hunyuanAlive, trellisAlive] = await Promise.all([
    is3dServerAlive(HUNYUAN_MODEL),
    is3dServerAlive(TRELLIS_MODEL),
  ])

  const models = [
    { id: "vexa-team", name: "Vexa Team", provider: "Vexa" },
    ...(hunyuanAlive ? [{ id: HUNYUAN_MODEL, name: "Hunyuan3D 2.1", provider: "Local 3D", kind: "asset3d", license: "Tencent Hunyuan (free, local)" }] : []),
    ...(trellisAlive ? [{ id: TRELLIS_MODEL, name: "TRELLIS 2 (fast)", provider: "Local 3D", kind: "asset3d-image", license: "MIT (free, local)" }] : []),
  ]

  return NextResponse.json({
    models,
    default: currentPrimaryModel(),
    keyed: Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
    // Convenience for UIs that want to explain per-model availability.
    backends: {
      hunyuan3d: hunyuanAlive ? hunyuanUrl() : null,
      trellis: trellisAlive ? trellisUrl() : null,
      local_llm: process.env.LOCAL_LLM_URL || null,
    },
  }, { headers: CORS_HEADERS })
}