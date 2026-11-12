const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

const clean = (s = "") =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()

function parseDuckDuckGo(html) {
  if (html.includes("anomaly") || !html.includes("result__a")) return []
  const blocks = [...html.matchAll(/class="result__a"[\s\S]*?<\/a>[\s\S]*?class="result__snippet"[\s\S]*?<\/a>/gi)]
  const out = []
  for (const b of blocks) {
    const title = b.match(/class="result__a"[\s\S]*?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    const snippet = b.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)
    if (!title) continue
    const uddg = title[1].match(/uddg=([^&]+)/)
    let url = uddg ? decodeURIComponent(uddg[1]) : title[1]
    if (!url.startsWith("http")) url = title[1]
    out.push({ title: clean(title[2]), url, snippet: clean(snippet?.[1] || "") })
  }
  return out
}

function parseBing(html) {
  const out = []
  const blocks = [...html.matchAll(/<li class="b_algo"[\s\S]*?<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h2>[\s\S]*?<\/li>/gi)]
  for (const b of blocks) {
    let url = b[1]
    const u = b[1].match(/u=a1([A-Za-z0-9_\-%.]+)/)
    if (u) {
      try { url = decodeURIComponent(u[1]) } catch { /* keep original */ }
    }
    out.push({ title: clean(b[2]), url, snippet: "" })
  }
  return out
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) return null
  return await res.text()
}

export async function searchWeb(query, count = 6) {
  const q = encodeURIComponent(query)
  const strategies = [
    { fn: () => fetchText(`https://html.duckduckgo.com/html/?q=${q}`), parse: parseDuckDuckGo },
    { fn: () => fetchText(`https://www.bing.com/search?q=${q}&setlang=en`), parse: parseBing },
    { fn: () => fetchText(`https://lite.duckduckgo.com/lite/?q=${q}`), parse: parseDuckDuckGo },
  ]
  for (const s of strategies) {
    try {
      const html = await s.fn()
      if (!html) continue
      const results = s.parse(html)
      if (results.length > 0) return results.slice(0, count)
    } catch {
      continue
    }
  }
  return []
}

export async function fetchPageText(url, maxChars = 20000) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const text = await res.text()
    return text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars)
  } catch {
    return null
  }
}

export async function researchTool(name, queries = [], sources = []) {
  const results = []
  for (const q of queries.slice(0, 4)) {
    const items = await searchWeb(q)
    if (items.length) {
      results.push(`\n### Search: ${q}`)
      for (const it of items) {
        results.push(`- [${it.title}](${it.url})${it.snippet ? ` — ${it.snippet}` : ""}`)
        if (sources.length < 6 && it.url.startsWith("http")) sources.push(it.url)
      }
    }
  }
  const fetched = []
  for (const url of sources.slice(0, 3)) {
    const text = await fetchPageText(url)
    if (text) fetched.push(`\n### Page: ${url}\n${text.slice(0, 8000)}`)
  }
  return { searches: results.join("\n"), pages: fetched.join("\n") }
}
