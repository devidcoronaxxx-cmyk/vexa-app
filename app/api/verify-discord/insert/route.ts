import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { code, discordId } = await req.json();

  if (!code || !discordId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  if (typeof code !== "string" || typeof discordId !== "string") {
    return NextResponse.json({ error: "invalid_types" }, { status: 400 });
  }

  if (code.length > 128 || discordId.length > 64) {
    return NextResponse.json({ error: "input_too_long" }, { status: 400 });
  }

  const { error } = await supabase
    .from("discord_verify_codes")
    .insert({
      code,
      discord_id: discordId,
      verified: false,
      expires_at: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
    });

  if (error) {
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
