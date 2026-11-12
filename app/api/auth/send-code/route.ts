import { NextResponse } from "next/server";
import { canSend, issueCode } from "@/lib/verify-store";

const RESEND_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "Vexa <onboarding@resend.dev>";

async function sendViaResend(to: string, code: string): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_KEY) return { ok: false, error: "missing_key" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject: `Il tuo codice Vexa: ${code}`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#101013;color:#fff;border-radius:16px;">
          <div style="font-size:15px;color:rgba(255,255,255,.65);margin-bottom:12px;">Il tuo codice di verifica Vexa:</div>
          <div style="font-size:38px;font-weight:800;letter-spacing:10px;color:#fcd846;margin-bottom:12px;">${code}</div>
          <div style="font-size:13px;color:rgba(255,255,255,.45);">Scade tra 10 minuti. Se non l'hai richiesto tu, ignora questa email.</div>
        </div>`,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, error: t.slice(0, 200) || `resend HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const clean = String(email || "").trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      return NextResponse.json({ error: "Email non valida" }, { status: 400 });
    }
    const gate = canSend(clean);
    if (!gate.ok) {
      return NextResponse.json({ error: `Attendi ${gate.waitSec || 30}s prima di richiederne un altro.` }, { status: 429 });
    }
    const { code } = issueCode(clean);
    const sent = await sendViaResend(clean, code);
    if (!sent.ok && sent.error !== "missing_key") {
      return NextResponse.json({ error: `Invio email fallito: ${sent.error}` }, { status: 502 });
    }
    // Senza chiave Resend (o in dev): restituisco il codice così il flusso resta provabile.
    // Con chiave configurata il codice arriva SOLO via email.
    return NextResponse.json({ ok: true, devCode: sent.ok ? undefined : code });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
