"use client";

import { useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

// Landing page for the email-confirmation / password-reset link.
// The supabase-js client auto-detects `token_hash` (implicit flow) or `code`
// (PKCE) in the URL and verifies/exchanges it, then we send the user on.
export default function AuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/onboarding";
    // Auth payload arrives either as query params (code / token_hash) or in the
    // URL fragment (implicit access_token) — both are consumed by the client's
    // detectSessionInUrl.
    const hasAuthPayload = /(?:token_hash|code|access_token|refresh_token|error)=/.test(
      window.location.search + " " + window.location.hash
    );

    let done = false;
    const go = (path: string) => {
      if (done) return;
      done = true;
      window.location.href = path;
    };

    if (!hasAuthPayload) {
      go("/auth/login?error=missing_code");
      return;
    }

    // Fires as soon as the auto-detected verification completes.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) go(next);
    });

    // Already-signed-in / poll fallback in case the event fired early.
    let poll: ReturnType<typeof setInterval> | null = null;
    const checkSession = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) go(next);
      });
    };
    checkSession();
    poll = setInterval(checkSession, 400);

    const guard = setTimeout(() => {
      go("/auth/login?error=verification_failed");
    }, 15000);

    return () => {
      sub.subscription.unsubscribe();
      if (poll) clearInterval(poll);
      clearTimeout(guard);
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "transparent", fontFamily: "'Inter', sans-serif" }}>
      <Image src="/icons/vexa-logo.svg" alt="Vexa" width={44} height={44} style={{ objectFit: "contain", opacity: 0.7 }} />
      <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.10)", borderTopColor: "rgba(167,139,250,0.9)", animation: "spin .8s linear infinite" }} />
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}>Verifying your email…</div>
    </div>
  );
}
