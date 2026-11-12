import { redirect } from "next/navigation";
import { getSessionUser, createServerSupabase } from "@/lib/supabase-server";
import DashboardShell from "./shell";
import type { Profile, Project } from "@/lib/supabase";

export default async function DashboardPage() {
  let profile: Profile | null = null;
  try {
    profile = await getSessionUser();
  } catch {}
  if (!profile) redirect("/auth/login?redirect=/dashboard");

  const client = await createServerSupabase();
  const { data: projects, error } = await client
    .from("projects")
    .select("id, name, description, created_at, updated_at, user_id, place_id")
    .eq("user_id", profile.id)
    .order("updated_at", { ascending: false });

  if (error) console.error("[dashboard] failed to fetch projects:", error.message);
  console.log("[dashboard] first project raw:", JSON.stringify(projects?.[0]));

  return (
    <DashboardShell
      profile={profile}
      initialProjects={(projects as Project[]) ?? []}
    />
  );
}