import { createServerSupabase } from "@/lib/supabase-server";
import { getAdminSupabase } from "@/lib/supabase";
import { VerifyDiscordClient } from "./client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify Discord",
  description: "Link your Discord account to Vexa.",
  robots: { index: false, follow: false },
};

export default async function VerifyDiscordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; discordId?: string }>;
}) {
  const { code, discordId } = await searchParams;

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  let username: string | null = null;
  let avatarUrl: string | null = null;
  let robloxUserId: number | null = null;

  if (user) {
    const admin = getAdminSupabase();
    const { data: profile } = await admin
      .from("profiles")
      .select("username, display_name, avatar_url, roblox_user_id")
      .eq("id", user.id)
      .single();

    username =
      profile?.username?.trim() ||
      profile?.display_name?.trim() ||
      user.email?.split("@")[0] ||
      "user";

    avatarUrl = profile?.avatar_url ?? null;
    robloxUserId = profile?.roblox_user_id ?? null;
  }

  return (
    <VerifyDiscordClient
      code={code ?? null}
      discordId={discordId ?? null}
      user={
        user
          ? {
              username: username ?? "user",
              userId: user.id,
              avatarUrl,
              robloxUserId,
            }
          : null
      }
    />
  );
}