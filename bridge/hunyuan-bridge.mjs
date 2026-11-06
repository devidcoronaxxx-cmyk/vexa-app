// Vexa -> Hunyuan3D bridge.
//
// The bundled server talks a STABLE contract to local 3D backends:
//   GET  /health    -> { status:"ready" } when the pack server is reachable
//   POST /generate  -> { prompt, name?, negative?, seed? } -> { files:[...] }
//
// The Hunyuan3D-2 WinPortable pack only exposes Gradio, so this tiny bridge
// translates the stable contract to the pack's real API at runtime (auto
// discovered from /gradio_api/info) and back. The pack itself lives on the
// user's machine and is managed by the app (downloaded into userData), so the
// whole pipeline stays inside the Vexa download: zero keys, zero extra setup.

import http from "node:http";
import { Buffer } from "node:buffer";

const PACK = process.env.VEXA_HUNYUAN_URL || "http://127.0.0.1:8080";
const PORT = Number(process.env.VEXA_BRIDGE_PORT || 8081);

let apiInfo = null; // cached { fn, fnUrl, base } from the pack's Gradio info

function parseJson(res, buf) {
  try {
    return JSON.parse(buf.toString("utf-8"));
  } catch {
    return { _raw: buf.toString("utf-8").slice(0, 500), status: res.statusCode };
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

// Only consider the pack alive when a Gradio JSON API actually answers — a
// random service on the same port must NOT fake a ready 3D backend.
async function packUp() {
  for (const p of ["/gradio_api/info", "/info"]) {
    try {
      const r = await fetch(PACK + p, { signal: AbortSignal.timeout(3000) });
      if (r.status === 200 && /json/i.test(r.headers.get("content-type") || "")) return true;
    } catch {}
  }
  return false;
}

async function hurt(body, contentType, timeoutMs = 40000) {
  const res = await fetch(body.url, {
    method: body.method,
    headers: body.headers,
    body: body.payload,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.headers.get("content-type")) {
    contentType = res.headers.get("content-type");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.statusCode, contentType, buf };
}

// Discover the main generation endpoint (Gradio 4/5 exposes /gradio_api/info).
async function discoverApi() {
  if (apiInfo) return apiInfo;
  let res;
  try {
    res = await hurt(
      { url: `${PACK}/gradio_api/info`, method: "GET", headers: {}, payload: null },
      "application/json",
      15000
    );
  } catch (e) {
    throw new Error("pack unreachable: " + e.message);
  }
  if (res.status !== 200) {
    throw new Error("gradio info HTTP " + res.status + " (bridge needs tuning for this pack)");
  }
  const info = parseJson(res, res.buf);
  const endpoints = info?.named_endpoints || {};
  const keys = Object.keys(endpoints);
  if (!keys.length) {
    throw new Error("no named endpoints in gradio api info (bridge needs tuning)");
  }
  const name =
    keys.find((k) => /generate|main|app/i.test(k)) || keys[0];
  const params = (endpoints[name]?.parameters || []).map((p) => ({
    name: String(p.parameter_name || p.name || "").toLowerCase(),
    component: String(p.component || "").toLowerCase(),
    ptype: p.type || "",
  }));
  apiInfo = { name, params, base: PACK };
  console.log("[hunyuan-bridge] discovered fn:", name, "params:", params.length);
  return apiInfo;
}

// Upload an image to the pack and return its file URI so Gradio can read it.
async function uploadImage(dataUrlOrUrl) {
  let buf;
  let filename = "ref.png";
  if (typeof dataUrlOrUrl !== "string") {
    throw new Error("images must be data URLs or remote URLs");
  }
  if (/^data:/i.test(dataUrlOrUrl)) {
    const m = dataUrlOrUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if (!m) throw new Error("malformed image data URL");
    const mime = m[1] || "image/png";
    const ext = (mime.split("/")[1] || "png").replace("jpeg", "jpg");
    filename = "ref." + ext;
    buf = Buffer.from(m[3] || "", m[2] ? "base64" : "utf-8");
  } else {
    const r = await fetch(dataUrlOrUrl, { signal: AbortSignal.timeout(30000) });
    const arr = await r.arrayBuffer();
    buf = Buffer.from(arr);
    filename = /\.(\w+)$/i.exec(dataUrlOrUrl)?.[1] ? "ref." + /\.(\w+)$/i.exec(dataUrlOrUrl)[1] : "ref.png";
  }
  const boundary = "----vexabridge" + Date.now();
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const payload = Buffer.concat([Buffer.from(header, "utf-8"), buf, Buffer.from(tail, "utf-8")]);
  const res = await hurt(
    {
      url: `${PACK}/gradio_api/upload`,
      method: "POST",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "content-length": String(payload.length),
      },
      payload,
    },
    "application/json",
    60000
  );
  if (res.status !== 200) {
    throw new Error("gradio upload HTTP " + res.status);
  }
  const out = parseJson(res, res.buf);
  const first = Array.isArray(out) ? out[0] : out;
  return first?.url || first?.path || (typeof first === "string" ? first : null) || null;
}

// Map payload fields onto the pack's parameter order by name/component heuristics.
function buildData(params, body, imageUris) {
  let images = [...(imageUris || [])];
  const dict = {
    prompt: String(body.prompt || body.name || ""),
    negative: String(body.negative || ""),
    name: String(body.name || body.prompt || "").slice(0, 200),
    seed: body.seed ?? generateSeed(),
    thumb_size: 1024,
    image: images.shift(),
    images: images,
    model_version: body.model_version || undefined,
  };
  const out = [];
  for (const p of params) {
    const n = p.name;
    let v;
    if (/neg/.test(n)) v = dict.negative;
    else if (/seed/.test(n) || (p.component.includes("slider") && /(seed|random)/.test(n))) v = dict.seed;
    else if (/image/.test(n) && (p.component.includes("image") || p.ptype.includes("image"))) v = images.shift() || dict.image;
    else if (/prompt|text|description/.test(n)) v = dict.prompt;
    else if (/model|version/.test(n)) v = dict.model_version;
    else if (/thumb|size|dimension/.test(n)) v = dict.thumb_size;
    else if (/name/.test(n)) v = dict.name;
    else v = defaultFor(p.component);
    out.push(v);
  }
  return out;
}

function defaultFor(component) {
  if (component.includes("slider") || component.includes("number")) return 1024;
  if (component.includes("checkbox")) return true;
  if (component.includes("radio") || component.includes("dropdown")) return null;
  return "";
}

function generateSeed() {
  return Math.floor(Math.random() * 2147483647);
}

// Poll a Gradio job over SSE until it completes.
async function pollGradioJob(fn, eventId, timeoutMs = 300000) {
  const url = `${PACK}/gradio_api/call/${fn}/${eventId}`;
  const start = Date.now();
  const re = /\r?\n/;
  let buffer = "";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.search(re)) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line || !line.startsWith("data:")) continue;
        let ev;
        try {
          ev = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (ev.event === "complete") return ev;
        if (ev.event === "error") {
          const msg = ev.msg || "gradio error";
          throw new Error("pack generation error: " + msg);
        }
      }
      if (Date.now() - start > timeoutMs) break;
    }
  } catch (e) {
    if (/abort/i.test(String(e.message || e).slice(0, 60))) {
      throw new Error("pack job timed out (300s)");
    }
    throw e;
  }
  throw new Error("pack job ended without 'complete' event");
}

// Walk a gradio result tree and collect downloadable 3D file paths.
function collectFiles(node, acc) {
  if (typeof node === "string") {
    if (/\.(obj|glb|ply|mtl|woo3d|bin)(\s|$|\/|")/i.test(node)) acc.add(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const x of node) collectFiles(x, acc);
  } else if (node && typeof node === "object") {
    for (const k of Object.keys(node)) collectFiles(node[k], acc);
  }
}

async function toContractFile(candidate) {
  const clean = candidate.replace(/^"(.*)"$/, "$1").trim();
  const rel = clean.startsWith("/") ? clean : "/" + clean.replace(/^.*?\/tmp/, "/tmp").replace(/\\/g, "/");
  const url = clean.startsWith("http")
    ? clean
    : `${PACK}/gradio_api/file=${Buffer.from(rel).toString("base64url")}`;
  try {
    const head = await fetch(url, { method: "GET", signal: AbortSignal.timeout(20000) });
    const len = Number(head.headers.get("content-length") || 0);
    if (head.status !== 200) return null;
    await head.body?.cancel().catch(() => {});
    const format = /\.(\w+)$/i.exec(clean)?.[1] || "3d";
    return { name: clean.split("/").pop(), url, format: format.toLowerCase(), sizeBytes: len, path: rel };
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || "/").split("?")[0];
  try {
    if (req.method === "GET" && urlPath === "/health") {
      const up = await packUp();
      res.writeHead(up ? 200 : 503, { "content-type": "application/json" });
      res.end(up ? JSON.stringify({ status: "ready", backend: "hunyuan3d-2.1" }) : JSON.stringify({ status: "starting" }));
      return;
    }

    if (req.method === "POST" && urlPath === "/generate") {
      const body = JSON.parse((await readBody(req)).toString("utf-8") || "{}");
      console.log("[hunyuan-bridge] generate:", (body.name || body.prompt || "").slice(0, 80));

      if (!(await packUp())) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Motore Hunyuan non attivo: avvialo dall'installazione in Vexa." }));
        return;
      }

      const api = await discoverApi();
      const imageUris = [];
      for (const img of (body.images || [])) {
        const uri = await uploadImage(img);
        if (uri) imageUris.push(uri);
      }
      const data = buildData(api.params, body, imageUris);

      const callRes = await hurt(
        {
          url: `${PACK}/gradio_api/call/${api.name}`,
          method: "POST",
          headers: { "content-type": "application/json" },
          payload: Buffer.from(JSON.stringify({ data, event_data: null })),
        },
        "application/json",
        60000
      );
      if (callRes.status !== 200) {
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "pack call HTTP " + callRes.status + ": " + String(callRes.buf).slice(0, 300) }));
        return;
      }
      const cj = parseJson(callRes, callRes.buf);
      if (!cj.event_id) {
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "pack returned no event_id" }));
        return;
      }

      const done = await pollGradioJob(api.name, cj.event_id);
      const acc = new Set();
      collectFiles(done.result, acc);
      const files = [];
      for (const cand of acc) {
        const f = await toContractFile(cand);
        if (f) files.push(f);
      }
      if (!files.length) {
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "pack finished but produced no 3D files (bridge needs tuning)" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ files }));
      console.log("[hunyuan-bridge] delivered", files.length, "file(s)");
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  } catch (e) {
    console.error("[hunyuan-bridge] error:", e.message);
    if (!res.headersSent) {
      try {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: String(e.message || e) }));
      } catch {}
    }
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[hunyuan-bridge] listening on ${PORT}, pack at ${PACK}`);
});