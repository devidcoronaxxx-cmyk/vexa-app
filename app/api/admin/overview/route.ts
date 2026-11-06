import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { getAdminSupabase } from "@/lib/supabase"

type FeedbackRow = {
  id: string
  user_id: string
  rating: number | null
  comment: string | null
  created_at: string
}

export async function GET() {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    const adminDb = getAdminSupabase()
    const { data: profile } = await adminDb
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()

    const adminIds = (process.env.ADMIN_USER_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)

    const isAllowedAdmin = adminIds.includes(user.id)

    if (!isAllowedAdmin) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    const [users, messages, projects, feedback] = await Promise.all([
      adminDb.from("profiles").select("id", { count: "exact", head: true }),
      adminDb.from("messages").select("id", { count: "exact", head: true }),
      adminDb.from("projects").select("id", { count: "exact", head: true }),
      adminDb
        .from("feedback")
        .select("id, user_id, rating, comment, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ])

    if (feedback.error) {
      return NextResponse.json(
        { error: "failed_feedback", details: feedback.error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      counts: {
        users: users.count ?? null,
        messages: messages.count ?? null,
        projects: projects.count ?? null,
      },
      feedback: (feedback.data as FeedbackRow[]) ?? [],
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: "failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
