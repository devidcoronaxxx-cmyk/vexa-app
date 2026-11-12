"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

const LINES: string[] = [
  "local Vexa = require(script.Parent)",
  "local effect = Vexa.VFX.new(\"FireAura\")",
  "effect:SetColor(Color3.fromRGB(255, 110, 40))",
  "effect:SetIntensity(0.85)",
  "effect:AttachTo(player.Character.HumanoidRootPart)",
  "",
  "-- generating model: DragonGolem",
  "local model = Vexa.Model.new(\"DragonGolem\")",
  "model:Assemble({\"body\", \"wings\", \"head\"})",
  "model:ApplyMaterials(Enum.Material.Neon)",
  "model:WeldAll()",
  "",
  "Vexa.Generate(\"combat aura vfx\")",
];

const COLOR_MAP: Record<string, string> = {
  keyword: "#c792ea",
  builtin: "#7dcfff",
  string:  "#a5e844",
  number:  "#f78c6c",
  comment: "#636e83",
  property:"#82aaff",
  func:    "#ffcb6b",
  identifier: "#cdd6f4",
};

function tokenize(line: string): { text: string; color: string }[] {
  const tokens: { text: string; color: string }[] = [];
  let i = 0;
  while (i < line.length) {
    if (line.slice(i, i + 2) === "--") {
      tokens.push({ text: line.slice(i), color: COLOR_MAP.comment });
      break;
    }
    if (line[i] === '"' || line[i] === "'") {
      const q = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== q) j++;
      tokens.push({ text: line.slice(i, j + 1), color: COLOR_MAP.string });
      i = j + 1;
      continue;
    }
    if (/\d/.test(line[i])) {
      let j = i;
      while (j < line.length && /[\d.]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), color: COLOR_MAP.number });
      i = j;
      continue;
    }
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(line.slice(i));
    if (m) {
      const word = m[0];
      const prev = tokens.length ? tokens[tokens.length - 1] : null;
      let color = COLOR_MAP.identifier;
      if (["local", "end", "function", "if", "then", "else", "for", "in", "do", "return", "while", "and", "or", "not", "true", "false", "nil"].includes(word)) color = COLOR_MAP.keyword;
      else if (["require", "Color3", "Enum", "Vector3", "Instance", "task", "wait", "math"].includes(word)) color = COLOR_MAP.builtin;
      else if (prev && prev.text === ".") color = COLOR_MAP.property;
      else if (/^[A-Z]/.test(word)) color = COLOR_MAP.func;
      tokens.push({ text: word, color });
      i += word.length;
      continue;
    }
    tokens.push({ text: line[i], color: COLOR_MAP.identifier });
    i++;
  }
  return tokens;
}

export default function AuthVisual() {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (lineIdx >= LINES.length) {
      const t = setTimeout(() => { setLineIdx(0); setCharIdx(0); }, 4200);
      return () => clearTimeout(t);
    }
    const line = LINES[lineIdx];
    if (line === "" ) {
      const t = setTimeout(() => { setLineIdx(l => l + 1); setCharIdx(0); }, 340);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      if (charIdx >= line.length) {
        setLineIdx(l => l + 1);
        setCharIdx(0);
      } else {
        setCharIdx(c => c + 1);
      }
    }, charIdx === 0 ? 360 : 16);
    return () => clearTimeout(t);
  }, [lineIdx, charIdx]);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 9000);
    return () => clearTimeout(t);
  }, []);

  const currentLine = lineIdx < LINES.length ? LINES[lineIdx] : "";
  const typed = currentLine.slice(0, charIdx);
  const tokens = tokenize(typed);

  return (
    <div style={windowStyle}>
      <div style={titleBar}>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ ...dot, background: "#ff5f57" }} />
          <span style={{ ...dot, background: "#febc2e" }} />
          <span style={{ ...dot, background: "#28c840" }} />
        </div>
        <span style={titleText}>Vexa Studio — live generation</span>
        <span style={liveBadge}><span style={livePulse} />LIVE</span>
      </div>
      <div style={body}>
        <div style={explorer}>
          {["Workspace", "VFX_FireAura", "  Attachment", "  ParticleEmitter", "  Beam", "DragonGolem", "  body", "  wings", "  head", "LocalScript"].map((n, i) => (
            <div key={n} style={{ fontSize: 11, color: n === "Workspace" ? "rgba(255,255,255,0.75)" : i % 2 ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.30)", padding: "2.5px 8px", paddingLeft: n.startsWith("  ") ? 22 : 8, whiteSpace: "nowrap", fontWeight: n === "Workspace" ? 600 : 400 }}>
              {n.startsWith("  ") ? <i className="bi bi-file-earmark-code" style={{ fontSize: 10, marginRight: 6, opacity: 0.6 }} /> : <i className="bi bi-folder2-open" style={{ fontSize: 10, marginRight: 6, opacity: 0.7 }} />}
              {n.replace(/^  /, "")}
            </div>
          ))}
        </div>
        <div style={codePane}>
          {LINES.slice(0, lineIdx).map((l, i) => (
            <div key={i} style={{ ...codeLine, color: COLOR_MAP.comment, opacity: 0.9 }}>
              {l === "" ? " " : tokenize(l).map((t, j) => <span key={j} style={{ color: t.color }}>{t.text}</span>)}
            </div>
          ))}
          {lineIdx < LINES.length && (
            <div style={codeLine}>
              {tokens.map((t, j) => <span key={j} style={{ color: t.color }}>{t.text}</span>)}
              <span style={{ ...caret, opacity: visible ? 1 : 0 }} />
            </div>
          )}
          {lineIdx >= LINES.length && <div style={{ ...codeLine, color: "#fcd846", fontWeight: 600 }}>✓ Generation complete — 3 instances, 2 scripts, 0 errors</div>}
        </div>
      </div>
    </div>
  );
}

const windowStyle: CSSProperties = {
  width: "100%",
  maxWidth: 560,
  borderRadius: 14,
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(12,12,16,0.85)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
  marginTop: 30,
  animation: "fadeUp .6s cubic-bezier(.16,1,.3,1) .3s both",
};

const titleBar: CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  padding: "9px 12px",
  background: "rgba(255,255,255,0.04)",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
};

const dot: CSSProperties = { width: 10, height: 10, borderRadius: "50%" };

const titleText: CSSProperties = {
  flex: 1, fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.45)",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const liveBadge: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em",
  color: "#fcd846", background: "rgba(252,216,70,0.10)",
  border: "1px solid rgba(252,216,70,0.25)",
  borderRadius: 6, padding: "2px 6px",
};

const livePulse: CSSProperties = {
  width: 5, height: 5, borderRadius: "50%", background: "#fcd846",
  boxShadow: "0 0 8px rgba(252,216,70,0.8)",
  animation: "vxPulse 1.4s ease-in-out infinite",
};

const body: CSSProperties = { display: "flex", height: 250, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };

const explorer: CSSProperties = {
  width: 168, flexShrink: 0, padding: "10px 0",
  background: "rgba(0,0,0,0.25)",
  borderRight: "1px solid rgba(255,255,255,0.05)",
  overflow: "hidden",
};

const codePane: CSSProperties = {
  flex: 1, padding: "12px 14px", overflow: "hidden",
  background: "rgba(8,8,12,0.6)",
};

const codeLine: CSSProperties = {
  fontSize: 12, lineHeight: 1.65, whiteSpace: "pre", fontFamily: "inherit",
};

const caret: CSSProperties = {
  display: "inline-block", width: 7, height: 14,
  background: "#fcd846",
  verticalAlign: "text-bottom", marginLeft: 1,
  borderRadius: 1,
  animation: "vxCaret 1s step-end infinite",
};
