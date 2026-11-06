import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  roblox_user_id: number | null;
  open_cloud_api_key: string | null;
  discord_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  place_id: number | null 
}

export interface Message {
  id: string;
  project_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Email-link auth (signup confirmation + password reset). @supabase/ssr's
// createBrowserClient forces the PKCE flow, whose `code_verifier` cookie is
// scoped to the origin that started the request — that breaks confirmation
// when the email link is opened from a different context (e.g. the desktop
// app runs on localhost:3000). The implicit flow uses a self-contained
// `token_hash` instead, so confirmation works from any browser. This client
// is only used to TRIGGER emails; sessions are always handled by `supabase`.
export const AUTH_CALLBACK_URL = "https://vexaaai.vercel.app/auth/callback";

export const supabaseEmail = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      flowType: "implicit",
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

export function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}