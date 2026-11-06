import { NextResponse } from "next/server";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const res = await fetch(`${SB_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SB_ANON_KEY,
        Authorization: `Bearer ${SB_ANON_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      const msg = data.error_description || data.msg || data.error || "Registration failed";
      return NextResponse.json({ error: msg }, { status: res.status || 400 });
    }

    const user = data.user || data;
    const hasSession = Boolean(data.session || data.access_token);

    return NextResponse.json({
      user,
      needs_confirmation: !hasSession,
      access_token: data.session?.access_token || data.access_token || null,
      refresh_token: data.session?.refresh_token || data.refresh_token || null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }
}
