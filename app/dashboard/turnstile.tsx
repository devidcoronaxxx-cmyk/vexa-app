"use client";

import { useEffect, useRef, useCallback } from "react";



declare global {
  interface Window {
    turnstile: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact";
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface Props {
  onVerify:  (token: string) => void;
  onExpire?: () => void;
  onError?:  () => void;
}

export function TurnstileWidget({ onVerify, onExpire, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef  = useRef<string | null>(null);
  const siteKey      = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!;

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return;


    if (widgetIdRef.current) {
      try { window.turnstile.remove(widgetIdRef.current); } catch {}
      widgetIdRef.current = null;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey:           siteKey,
      theme:             "dark",
      size:              "normal",
      callback:          onVerify,
      "expired-callback": () => { widgetIdRef.current = null; onExpire?.(); },
      "error-callback":   () => { widgetIdRef.current = null; onError?.(); },
    });
  }, [siteKey, onVerify, onExpire, onError]);

  useEffect(() => {

    if (window.turnstile) {
      renderWidget();
      return;
    }


    window.onTurnstileLoad = renderWidget;

    const existing = document.getElementById("cf-turnstile-script");
    if (!existing) {
      const script = document.createElement("script");
      script.id    = "cf-turnstile-script";
      script.src   = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetIdRef.current) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
  }, [renderWidget]);

  return (
    <div style={wrapStyle}>
      <div ref={containerRef} />
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  display:        "flex",
  justifyContent: "center",
  width:          "100%",
  margin:         "4px 0 20px",

  borderRadius:   8,
  overflow:       "hidden",
};