import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: NextRequest) {
  try {

    const body = await req.json();
    const { discord_id, reason } = body;


    if (!discord_id) {
      return NextResponse.json({ error: "Missing discord_id" }, { status: 400 });
    }


    const secret = req.headers.get("x-admin-secret");
    const expected = process.env.ADMIN_SECRET || "";
    if (!secret || !expected || secret.length !== expected.length) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    const crypto = await import("crypto");
    if (!crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(expected))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }



    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll: () => [],
          setAll: () => {}
        }
      }
    );


    const { data, error } = await supabase
      .from("profiles")
      .update({
        banned: true,
        ban_reason: reason || "No reason provided",
        updated_at: new Date().toISOString()
      })
      .eq("discord_id", discord_id)
      .select();

    if (error) {
      console.error("Supabase Error:", error.message);
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }


    if (!data || data.length === 0) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `User ${discord_id} banned on Vexa.`
    });

  } catch (err) {
    console.error("API Route Error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
