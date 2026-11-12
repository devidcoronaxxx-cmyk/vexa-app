import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Profile } from "./supabase";

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
          }
        },
      },
    }
  );
}

export async function getSessionUser(): Promise<Profile | null> {
  const client = await createServerSupabase();

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();


  if (!profileError && profile) {
    return profile as Profile;
  }


  const fallbackProfile = {
    id: user.id,
    username:
      user.user_metadata?.username ||
      user.email?.split("@")[0] ||
      "user",
    display_name:
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "User",
    avatar_url: user.user_metadata?.avatar_url || null,
    open_cloud_api_key: null,
  };

  try {
    const { data: inserted } = await client
      .from("profiles")
      .upsert(fallbackProfile, { onConflict: "id" })
      .select("*")
      .single();

    if (inserted) return inserted as Profile;
  } catch {}

  return fallbackProfile as Profile;
}