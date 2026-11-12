"use client";

import { useMemo, useRef, useState } from "react";

export interface MechNode {
  id: string;
  label: string;
  sub: string;
  type: string;
  icon: string;
  color: string;
  summary: string;
}

export interface MechLink { a: number; b: number }

const TYPE_ICON: Record<string, string> = {
  scripting: "bi-code-slash",
  animation: "bi-person-raised-hand",
  vfx: "bi-lightning-charge",
  cinematic: "bi-film",
  model3d: "bi-box-seam",
  sound: "bi-music-note",
  plan: "bi-list-check",
};

const TYPE_COLOR: Record<string, string> = {
  scripting: "#7dd3fc",
  animation: "#f0abfc",
  vfx: "#fcd846",
  cinematic: "#c4b5fd",
  model3d: "#fcd846",
  sound: "#86efac",
  plan: "#fda4af",
};

export function deriveMechanics(messages: { role: string; content: string }[]): { nodes: MechNode[]; links: MechLink[] } {
  const nodes: MechNode[] = [];
  messages.forEach((m, i) => {
    if (m.role !== "assistant") return;
    try {
      const p = JSON.parse(m.content);
      const d = p.data || {};
      const title = d.title || p.title;
      if (!title || typeof title !== "string") return;
      const type = String(p.__reqType || d.type || p.type || "scripting");
      nodes.push({
        id: `m${i}`,
        label: title.slice(0, 44),
        sub: type,
        type,
        icon: TYPE_ICON[type] || "bi-stars",
        color: TYPE_COLOR[type] || "#fcd846",
        summary: String(d.summary || p.summary || p.message || ""),
      });
    } catch {
      /* plain chat text — not a mechanic */
    }
  });
  const links: MechLink[] = [];
  const seen = new Set<string>();
  const add = (a: number, b: number) => {
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a !== b && !seen.has(k)) { seen.add(k); links.push({ a, b }); }
  };
  nodes.forEach((_n, i) => { if (i > 0) add(i - 1, i); });
  nodes.forEach((n, i) => { nodes.forEach((m, j) => { if (j > i && m.type === n.type) add(i, j); }); });
  return { nodes, links };
}

interface Props {
  projectName: string;
  messages: { role: string; content: string }[];
  quickStarts: { type: string; icon: string; label: string; prompt: string }[];
  onAddPrompt: (prompt: string) => void;
}

const RX = 250;
const RY = 185;

export default function MechanicsCanvas({ projectName, messages, quickStarts, onAddPrompt }: Props) {
  const { nodes, links } = useMemo(() => deriveMechanics(messages), [messages]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [sel, setSel] = useState<number | null>(null);
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  const used = useMemo(() => new Set(nodes.map(n => n.type)), [nodes]);
  const nextMove = quickStarts.find(q => !used.has(q.type)) || quickStarts[0];

  const pos = (i: number) => {
    const n = nodes.length;
    if (n === 1) return { x: 0, y: 150 };
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: Math.cos(a) * RX, y: Math.sin(a) * RY };
  };

  const clampZoom = (z: number) => Math.min(2, Math.max(0.4, z));

  return (
    <div
      style={{ position: "absolute", inset: 0, overflow: "hidden", cursor: "grab", touchAction: "none" }}
      onPointerDown={e => {
        if ((e.target as HTMLElement).closest("[data-node]")) return;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        drag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
      }}
      onPointerMove={e => {
        if (!drag.current) return;
        setPan({ x: drag.current.px + (e.clientX - drag.current.sx), y: drag.current.py + (e.clientY - drag.current.sy) });
      }}
      onPointerUp={() => { drag.current = null; }}
      onWheel={e => { setZoom(z => clampZoom(z - e.deltaY * 0.001)); }}
    >
      <div style={{ position: "absolute", left: "50%", top: "46%", transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", width: 0, height: 0 }}>
        <svg style={{ position: "absolute", left: -2000, top: -2000, width: 4000, height: 4000, overflow: "visible", pointerEvents: "none" }}>
          {links.map((l, i) => {
            const a = pos(l.a); const b = pos(l.b);
            return <line key={i} x1={a.x + 2000} y1={a.y + 2000} x2={b.x + 2000} y2={b.y + 2000} stroke="rgba(53,208,186,0.55)" strokeWidth={1.6} strokeDasharray="6 6" />;
          })}
        </svg>

        {/* center project node */}
        <div style={{ position: "absolute", left: -34, top: -78, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 68, height: 74, clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)", background: "linear-gradient(160deg, #2a2f38, #12151b)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: "#fcd846", fontFamily: "'Space Grotesk', sans-serif" }}>{(projectName || "V").charAt(0).toUpperCase()}</span>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", background: "rgba(16,19,25,0.9)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 999, padding: "5px 13px", whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{projectName}</div>
        </div>

        {/* mechanic nodes */}
        {nodes.map((n, i) => {
          const p = pos(i);
          const active = sel === i;
          return (
            <div
              key={n.id}
              data-node
              onClick={e => { e.stopPropagation(); setSel(active ? null : i); }}
              style={{ position: "absolute", left: p.x - 85, top: p.y - 33, width: 170, background: active ? "rgba(20,26,34,0.96)" : "rgba(14,17,23,0.88)", border: active ? "1px solid rgba(252,216,70,0.55)" : "1px dashed rgba(255,255,255,0.18)", borderRadius: 14, padding: "10px 12px", cursor: "pointer", boxShadow: active ? "0 12px 36px rgba(0,0,0,0.5), 0 0 24px rgba(252,216,70,0.12)" : "0 8px 26px rgba(0,0,0,0.45)", transition: "border-color .15s ease, box-shadow .15s ease" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: `${n.color}1f`, border: `1px solid ${n.color}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <i className={`bi ${n.icon}`} style={{ fontSize: 14, color: n.color }} />
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{n.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* empty state */}
      {nodes.length === 0 && (
        <div style={{ position: "absolute", left: "50%", top: "46%", transform: "translate(-50%, 90px)", textAlign: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>No mechanics yet</div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.32)", marginTop: 4 }}>Describe one below to start building</div>
        </div>
      )}

      {/* selected node detail */}
      {sel !== null && nodes[sel] && (
        <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", width: "min(460px, calc(100% - 32px))", background: "rgba(13,16,21,0.97)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "14px 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.55)", zIndex: 5, animation: "menuIn .22s cubic-bezier(.16,1,.3,1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
            <i className={`bi ${nodes[sel].icon}`} style={{ fontSize: 15, color: nodes[sel].color }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#fff" }}>{nodes[sel].label}</span>
            <button type="button" onClick={() => setSel(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>
          </div>
          {nodes[sel].summary && <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.55 }}>{nodes[sel].summary.slice(0, 320)}</div>}
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{nodes[sel].sub}</div>
        </div>
      )}

      {/* best next move */}
      {nextMove && nodes.length > 0 && sel === null && (
        <div style={{ position: "absolute", left: 18, bottom: 18, width: 250, background: "rgba(13,19,28,0.94)", border: "1px solid rgba(125,211,252,0.25)", borderRadius: 16, padding: "13px 15px", boxShadow: "0 16px 48px rgba(0,0,0,0.5)", zIndex: 5 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#7dd3fc", marginBottom: 4 }}>Best next move</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", lineHeight: 1.4, marginBottom: 10 }}>{nextMove.label}</div>
          <button type="button" onClick={() => onAddPrompt(nextMove.prompt)} style={{ padding: "7px 18px", background: "rgba(125,211,252,0.14)", border: "1px solid rgba(125,211,252,0.35)", borderRadius: 9, color: "#7dd3fc", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
        </div>
      )}

      {/* zoom controls */}
      <div style={{ position: "absolute", left: 18, bottom: nextMove && nodes.length > 0 && sel === null ? 196 : 18, display: "flex", alignItems: "center", gap: 2, background: "rgba(13,16,21,0.92)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 11, padding: 3, zIndex: 5, transition: "bottom .2s ease" }}>
        <button type="button" onClick={() => setZoom(z => clampZoom(z - 0.15))} style={{ width: 28, height: 28, borderRadius: 8, background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 15, cursor: "pointer" }}>−</button>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.55)", minWidth: 44, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom(z => clampZoom(z + 0.15))} style={{ width: 28, height: 28, borderRadius: 8, background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 15, cursor: "pointer" }}>+</button>
      </div>
    </div>
  );
}
