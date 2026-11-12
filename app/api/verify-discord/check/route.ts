import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ verified: false }, { status: 400 });
  }

  const { data: entry } = await supabase
    .from("discord_verify_codes")
    .select("verified, expires_at")
    .eq("code", code)
    .single();

  if (!entry || new Date(entry.expires_at) < new Date()) {
    return NextResponse.json({ verified: false });
  }

  return NextResponse.json({ verified: entry.verified === true });
}