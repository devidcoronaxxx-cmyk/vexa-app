"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function SupabaseTest() {
  useEffect(() => {
    async function test() {
      try {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .limit(1);

        console.log("SUPABASE DATA:", data);
        console.log("SUPABASE ERROR:", error);
      } catch (err) {
        console.error("SUPABASE CRASH:", err);
      }
    }

    test();
  }, []);

  return null;
}

