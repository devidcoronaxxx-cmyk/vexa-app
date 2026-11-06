import { NextResponse } from "next/server";
import { verifyCode } from "@/lib/verify-store";

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();
    const clean = String(email || "").trim().toLowerCase();
    if (!clean || !String(code || "").trim()) {
      return NextResponse.json({ error: "Email e codice richiesti" }, { status: 400 });
    }
    const r = verifyCode(clean, String(code));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
