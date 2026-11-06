import { getAdminSupabase } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { code, discordId } = await req.json();

  if (!code || !discordId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "no_account" }, { status: 401 });
  }

  const admin = getAdminSupabase();

  const { data: entry, error } = await admin
    .from("discord_verify_codes")
    .select("*")
    .eq("code", code)
    .eq("discord_id", discordId)
    .single();

  if (error || !entry) {
    console.error("[verify] lookup failed:", error?.message, { code, discordId });
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  if (new Date(entry.expires_at) < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 400 });
  }

  await admin
    .from("discord_verify_codes")
    .update({ verified: true })
    .eq("code", code);

  await admin
    .from("profiles")
    .update({ discord_id: discordId })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}