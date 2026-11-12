export function getCorsHeaders(origin?: string): Record<string, string> {
  const allowed = [
    "https://vexaaai.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]
  const allowedOrigin = origin && allowed.includes(origin) ? origin : "https://vexaaai.vercel.app"

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  }
}

export const CORS_HEADERS = getCorsHeaders()

export function handleOptions(origin?: string) {
  return new Response(null, { status: 204, headers: getCorsHeaders(origin) })
}
