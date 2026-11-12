// Luau validator — catches real problems in generated code before it ships.
// Heuristic (not a full parser): balanced constructs, truncation markers,
// placeholder assets, and common Roblox/Luau anti-patterns.

const TRUNCATION_MARKERS = [
  /\.\.\.\s*(?:$|\n)/,
  /--\s*rest\s+of\s+code/i,
  /--\s*\.\.\.\s*/i,
  /--\s*\(same\s+as\s+before\)/i,
  /--\s*remaining\s+code/i,
  /--\s*continue\s+here/i,
  /#\s*(?:remaining|truncated|omitted)\b/i,
  /\[.*?\.\.\.\s*\]/,
]

const PLACEHOLDER_ASSET = /rbxassetid:\s*(?:["']?)(0|123456789|9999999|1000000000000|0000000000000)\1/i

const ANTI_PATTERNS = [
  { re: /(?<![.\w])wait\s*\(/,   severity: "warn", msg: "Use task.wait() instead of the deprecated wait()" },
  { re: /(?<![.\w])spawn\s*\(/,  severity: "warn", msg: "Use task.spawn() instead of the deprecated spawn()" },
  { re: /(?<![.\w])delay\s*\(/,  severity: "warn", msg: "Use task.delay() instead of the deprecated delay()" },
  { re: /(?<![.\w])elapsedTime\s*\(/, severity: "warn", msg: "elapsedTime() is deprecated — use os.clock() or tick()" },
  { re: /\bgame:GetService\(\s*["']RbxHttpService/, severity: "warn", msg: "RbxHttpService is restricted in most games" },
  { re: /\bgame\.(Players|Workspace|Lighting|ReplicatedStorage|StarterGui|ServerScriptService|ReplicatedFirst|Debris|RunService|TweenService|SoundService|DataStoreService|HttpService)\b/, severity: "info", msg: "Consider game:GetService() instead of game.<Service> direct access" },
  { re: /math\.random\(\s*\d+\s*,\s*\d+\s*\)\s*\+\s*1/, severity: "warn", msg: "math.random(a,b) is inclusive — remove the +1" },
  { re: /\bNaN\b/,                severity: "error", msg: "NaN is not a valid Luau value" },
  { re: /\binstance\.new\b/,          severity: "warn", msg: "Use Instance.new() (capital I)" },
  { re: /\bInstance\.new\(\s*["'](?![A-Z])/, severity: "warn", msg: "Instance.new class name should be capitalized" },
  { re: /\.Parent\s*=\s*workspace\b/i, severity: "info", msg: "Consider parenting to a named container, not Workspace root" },
  { re: /while\s+true\s+do[^]*?\bwait\s*\(0\)/, severity: "warn", msg: "Use task.wait() inside while true loops" },
  { re: /\brbxassetid:\s*["']?\d{4,7}["']?/, severity: "info", msg: "Short asset IDs may be placeholder sounds — verify they resolve" },
  { re: /(?:["'])[^"']*asset\/\?id=\d+(?:["'])/, severity: "warn", msg: "Old 'asset/?id=' URL format detected — use rbxassetid:// or rbxasset://" },
  { re: /:GetMouse\s*\(/, severity: "warn", msg: "Player:GetMouse() doesn't work on mobile/touch devices — use UserInputService instead" },
  { re: /\bgame\.Players\.LocalPlayer\b/, severity: "info", msg: "Use game:GetService(\"Players\").LocalPlayer and check it exists" },
  { re: /\.Character\b[^]*?\.HumanoidRootPart\b/, severity: "info", msg: "Wait for HumanoidRootPart with :WaitForChild() to avoid nil after respawn" },
  { re: /\bgame\.GetService\(/, severity: "error", msg: "GetService is a method — use game:GetService() (colon, not dot)" },
  { re: /\bworkspace\.GetService\(/, severity: "error", msg: "GetService is a method — use :GetService() (colon, not dot)" },
  { re: /\b\.Value\s*=\s*\.Value\s*\+\s*1\b/, severity: "info", msg: "Use `x.Value += 1` (Luau compound assignment)" },
  { re: /\bstring\.format\s*\(\s*["']%[sdq]/ , severity: "info", msg: "Consider f-strings (`f\"{var}\"`) for readability" },
  { re: /["']\s*\+\s*\w+|\w+\s*\+\s*["']/, severity: "warn", msg: "String concatenation uses `+` (JS) — Luau uses `..`" },
  { re: /\b\.TimeOfDay\s*=\s*\d+/, severity: "warn", msg: "Lighting.TimeOfDay expects a string like \"12:00:00\", not a number" },
  { re: /\bTweenService:Create\s*\([^,]+,[^,]+,[^)]*[+*-]\s*[^)]*\)\s*:\s*Play/, severity: "warn", msg: "TweenService:Create() needs a goal table with the final property values" },
  { re: /\bCFrame\.angles\s*\([^)]*\)\s*\*\s*CFrame\.angles/, severity: "info", msg: "Consider CFrame.Angles(...) composed with * for combined rotation" },
]

// Strip Lua strings and comments so structural checks don't trip on literals.
function stripLuaLiterals(src) {
  let out = ""
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    // Line comment
    if (c === "-" && src[i + 1] === "-") {
      let j = i + 2
      if (src[j] === "[" && src[j + 1] === "[") {
        // long comment
        const end = src.indexOf("]]", j)
        i = end === -1 ? n : end + 2
      } else {
        while (i < n && src[i] !== "\n") i++
      }
      continue
    }
    // String
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n) {
        if (src[j] === "\\") { j += 2; continue }
        if (src[j] === c) break
        j++
      }
      i = j + 1
      continue
    }
    // Long string
    if (c === "[" && src[i + 1] === "[") {
      const end = src.indexOf("]]", i + 2)
      i = end === -1 ? n : end + 2
      continue
    }
    out += c
    i++
  }
  return out
}

// Count net balance of block keywords. Returns list of {line, open, close} deltas.
function blockBalance(src) {
  // tokenize on word boundaries
  const tokens = src.split(/\b/)
  let balance = 0
  const events = [] // {line, delta, keyword}
  let line = 1
  for (const tok of tokens) {
    for (const ch of tok) if (ch === "\n") line++
    const kw = tok.trim().toLowerCase()
    if (kw === "if" || kw === "for" || kw === "while" || kw === "function" || kw === "repeat") {
      balance += 1
      events.push({ line, delta: 1, kw })
    } else if (kw === "end" || kw === "until") {
      balance -= 1
      events.push({ line, delta: -1, kw })
    }
  }
  return { balance, events }
}

// Track paren/bracket balance, reporting first offending line.
function parenBalance(src) {
  const stack = []
  let line = 1
  let firstErr = null
  for (const ch of src) {
    if (ch === "\n") { line++; continue }
    if (ch === "(" || ch === "[" || ch === "{") stack.push({ ch, line })
    else if (ch === ")" || ch === "]" || ch === "}") {
      const open = stack.pop()
      if (!open || !pairsMatch(open.ch, ch)) {
        if (!firstErr) firstErr = { line, expected: open ? pairOf(open.ch) : null, got: ch }
      }
    }
  }
  if (!firstErr && stack.length) firstErr = { line: stack[0].line, expected: pairOf(stack[0].ch), got: "(unclosed)" }
  return firstErr
}

function pairsMatch(a, b) {
  return (a === "(" && b === ")") || (a === "[" && b === "]") || (a === "{" && b === "}")
}
function pairOf(c) { return c === "(" ? ")" : c === "[" ? "]" : "}" }

// Simple check for accidental JS-isms that break Luau.
// Runs on literal-stripped source so strings/comments don't false-positive.
function jsIsms(src) {
  const out = []
  if (/===\s*null|\bundefined\b|\bconst\s+\w+\s*=|\blet\s+\w+\s*=|\barrow\s*=>|=>\s*{/.test(src)) {
    out.push({ severity: "error", msg: "JS syntax detected (const/let/=>/null/undefined) — Luau uses local/function" })
  }
  if (/(?<!local\s|\w|\.)\bconst\b/.test(src)) out.push({ severity: "error", msg: "`const` is not a Luau keyword — use local (JS-ism)" })
  if (/(?<!local\s|\w|\.)\blet\b/.test(src)) out.push({ severity: "error", msg: "`let` is not a Luau keyword — use local (JS-ism)" })
  if (/!!\s*\w+/.test(src)) out.push({ severity: "warn", msg: "Double-bang (!!) is a JS idiom — use `not not x` or a boolean expression" })

  // High-confidence JS standard-library calls that Luau spells differently.
  if (/\bMath\.(floor|random|max|min|ceil|abs|pow|sqrt|PI)\b/.test(src)) out.push({ severity: "error", msg: "`Math.<fn>()` is JS — Luau uses lowercase math.<fn>()" })
  if (/\bconsole\.(log|error|warn)\(/.test(src)) out.push({ severity: "error", msg: "`console.log()` is JS — use print()" })
  if (/\bDate\.now\s*\(/.test(src)) out.push({ severity: "error", msg: "`Date.now()` is JS — use os.time()/os.clock()" })
  if (/\bJSON\.(stringify|parse)\b/.test(src)) out.push({ severity: "error", msg: "`JSON.<fn>()` is JS — use game:GetService(\"HttpService\"):JSONEncode()/JSONDecode()" })
  if (/\.toUpperCase\s*\(/.test(src)) out.push({ severity: "error", msg: "`.toUpperCase()` is JS — use string.upper()" })
  if (/\.toLowerCase\s*\(/.test(src)) out.push({ severity: "error", msg: "`.toLowerCase()` is JS — use string.lower()" })
  if (/\.substring\s*\(/.test(src)) out.push({ severity: "error", msg: "`.substring()` is JS — use string.sub()" })
  if (/\.split\s*\(/.test(src)) out.push({ severity: "warn", msg: "`.split()` is JS — use string.split()" })
  if (/\b\.push\s*\(/.test(src)) out.push({ severity: "warn", msg: "`.push()` is JS — use table.insert()" })
  if (/\b\.pop\s*\(/.test(src)) out.push({ severity: "warn", msg: "`.pop()` is JS — use table.remove()" })
  if (/\b\.shift\s*\(/.test(src)) out.push({ severity: "warn", msg: "`.shift()` is JS — use table.remove()" })
  if (/\b\.splice\s*\(/.test(src)) out.push({ severity: "warn", msg: "`.splice()` is JS — use table.remove()/table.insert()" })
  if (/\b\.map\s*\(/.test(src)) out.push({ severity: "warn", msg: "`.map()` is JS — Luau uses loops (no Array.map)" })
  if (/\b\.filter\s*\(/.test(src)) out.push({ severity: "warn", msg: "`.filter()` is JS — Luau uses loops (no Array.filter)" })
  if (/\b\.forEach\s*\(/.test(src)) out.push({ severity: "warn", msg: "`.forEach()` is JS — use a for loop" })
  if (/\b\.reduce\s*\(/.test(src)) out.push({ severity: "warn", msg: "`.reduce()` is JS — write an explicit loop" })
  if (/\basync\s+function\b/.test(src)) out.push({ severity: "error", msg: "`async function` is JS — Luau has no async/await; use task.spawn()" })
  if (/\bawait\b/.test(src)) out.push({ severity: "error", msg: "`await` is JS — Luau has no async/await; use task.wait() or promises" })
  if (/\$\{/.test(src)) out.push({ severity: "error", msg: "Template literal `${}` is JS — use string concatenation with .." })
  if (/!=|!==/.test(src)) out.push({ severity: "error", msg: "`!=` is JS — Luau uses `~=` for inequality" })
  if (/===/.test(src)) out.push({ severity: "error", msg: "`===` is JS — Luau uses `==` for equality" })
  if (/&&|\|\|/.test(src)) out.push({ severity: "error", msg: "`&&`/`||` are JS — Luau uses `and`/`or`" })
  if (/\w+\s*\.\s*length\b/.test(src)) out.push({ severity: "warn", msg: "`.length` is JS — Luau uses `#value`" })
  if (/\?\./.test(src)) out.push({ severity: "error", msg: "Optional chaining `?.` is JS — Luau guards with if x and x.y then" })
  if (/\b\.includes\s*\(/.test(src)) out.push({ severity: "warn", msg: "`.includes()` is JS — use string.find() or table.find()" })
  if (/\b\.join\s*\(/.test(src)) out.push({ severity: "warn", msg: "`.join()` is JS — use table.concat()" })
  if (/\b\.slice\s*\(/.test(src)) out.push({ severity: "warn", msg: "`.slice()` is JS — use table.move()/string.sub()" })
  if (/\.forEach\s*\(|\.map\s*\(|\.filter\s*\(/.test(src)) out.push({ severity: "error", msg: "Array methods (.forEach/.map/.filter) are JS — use Luau loops" })
  return out
}

// Detect `while true do` bodies that never yield (freeze the server).
function infiniteLoops(src) {
  const out = []
  const re = /while\s+true\s+do/g
  let m
  while ((m = re.exec(src)) !== null) {
    const start = m.index + m[0].length
    const window = src.slice(start, start + 700)
    const closeIdx = window.indexOf("end")
    const body = closeIdx === -1 ? window : window.slice(0, closeIdx)
    const yields = /task\.(wait|delay|defer)|\bwait\s*\(|:\s*Wait\s*\(|:WaitForChild\s*\(|RunService\.|yield\s*\(/.test(body)
    if (!yields) {
      out.push({ severity: "error", msg: "`while true do` loop never yields — it will freeze the server. Add task.wait() inside." })
    }
  }
  return out
}

export function validateLuau(code, name = "script") {
  const issues = []
  const add = (severity, msg, line) => {
    issues.push({ severity, msg, line: line || null, script: name })
  }

  if (!code || !code.trim()) {
    add("error", "Script is empty — no code generated")
    return issues
  }

  // 1. Truncation markers
  for (const re of TRUNCATION_MARKERS) {
    const m = code.match(re)
    if (m) add("error", `Truncation marker found ("${m[0].trim()}") — script is incomplete`, null)
  }

  // 2. Placeholder assets
  if (PLACEHOLDER_ASSET.test(code)) add("warn", "Placeholder asset ID detected — replace with a real asset", null)

  // 3. Structural balance
  const cleaned = stripLuaLiterals(code)
  const { balance, events } = blockBalance(cleaned)
  if (balance !== 0) {
    const lastEnd = events.filter(e => e.delta === -1).pop()
    const lastOpen = events.filter(e => e.delta === 1).pop()
    const line = lastOpen ? lastOpen.line : lastEnd ? lastEnd.line : null
    add("error", `Unbalanced blocks (net ${balance > 0 ? balance + " missing 'end'" : -balance + " extra 'end'"}s)`, line)
  }
  const parenErr = parenBalance(cleaned)
  if (parenErr) add("error", `Unbalanced bracket: expected "${parenErr.expected || ""}" but found "${parenErr.got}"`, parenErr.line)

  // 4. Anti-patterns
  const lines = code.split("\n")
  for (const p of ANTI_PATTERNS) {
    const m = code.match(p.re)
    if (m) {
      const lineNo = lines.findIndex(l => p.re.test(l))
      add(p.severity, p.msg, lineNo === -1 ? null : lineNo + 1)
    }
  }

  // 5. JS-isms (on literal-stripped source to avoid string/comment false positives)
  for (const js of jsIsms(cleaned)) add(js.severity, js.msg, null)

  // 5b. Freezing loops (on cleaned source)
  for (const inf of infiniteLoops(cleaned)) add(inf.severity, inf.msg, null)

  // 6. Detect double indentation depth > 24 (likely runaway nesting)
  const maxIndent = Math.max(...lines.map(l => (l.match(/^(\s+)/) || ["", ""])[1].length))
  if (maxIndent > 24) add("warn", `Very deep indentation (${maxIndent} spaces) — consider refactoring into functions`, null)

  return issues
}

export function hasErrors(issues) {
  return issues.some(i => i.severity === "error")
}

export function summarizeIssues(issues) {
  if (!issues.length) return "No issues detected."
  const grouped = {}
  for (const i of issues) {
    const key = i.severity
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(i)
  }
  const parts = []
  if (grouped.error) parts.push(`${grouped.error.length} error(s): ${grouped.error.map(i => i.msg).join("; ")}`)
  if (grouped.warn) parts.push(`${grouped.warn.length} warning(s): ${grouped.warn.map(i => i.msg).join("; ")}`)
  return parts.join(" — ")
}
