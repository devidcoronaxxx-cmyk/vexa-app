import { supabase } from "@/lib/supabase";

export async function testSupabase() {
  const { data, error } = await supabase.from("projects").select("*").limit(1);
  console.log("data:", data);
  console.log("error:", error);
}