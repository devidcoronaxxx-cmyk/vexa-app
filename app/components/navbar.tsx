"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useTheme } from "./ThemeProvider";

interface NavbarProps {
  activePage?: "home" | "dashboard" | "terms" | "privacy" | "download" | "credits";
  rightSlot?: ReactNode;
}

const NAV_LINKS: { href: string; label: string; key: string }[] = [
  { href: "/", label: "Home", key: "home" },
  { href: "/download", label: "Download", key: "download" },
  { href: "/credits", label: "Credits", key: "credits" },
  { href: "https://github.com/devidcoronaxxx-cmyk/vexa-app", label: "Source", key: "source" },
];

export function Navbar({ activePage, rightSlot }: NavbarProps) {
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    closeOnDesktop();
    window.addEventListener("resize", closeOnDesktop);
    return () => window.removeEventListener("resize", closeOnDesktop);
  }, []);

  const INK = "#1a1f2e";
  const ACCENT = "#3b5bdb";
  const CREAM = "#ffffff";

  const themeToggle = (
    <button type="button" onClick={toggle} aria-label="Toggle theme" suppressHydrationWarning style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid rgba(26,31,46,0.12)", background: "rgba(26,31,46,0.05)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1f2e", transition: "all 0.18s" }}>
      {theme === "light" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
      )}
    </button>
  );

  const defaultActions = (
    <a
      href="/download"
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700,
        color: "#fff", background: ACCENT, textDecoration: "none",
        boxShadow: "0 4px 14px rgba(59,91,219,0.25)",
        transition: "all 0.2s",
      }}
    >
      Download App
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    </a>
  );

  const actions = rightSlot ?? defaultActions;

  const navLinkStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    letterSpacing: active ? "-0.01em" : "0em",
    color: active ? ACCENT : "rgba(26,31,46,0.6)",
    textDecoration: "none",
    padding: "7px 13px",
    borderRadius: 10,
    background: active ? "rgba(59,91,219,0.08)" : "transparent",
    border: active ? "1px solid rgba(59,91,219,0.25)" : "1px solid transparent",
    transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
    fontFamily: "inherit",
    position: "relative",
  } as React.CSSProperties);

  return (
    <>
      <style>{`
        .g-nav-link:hover {
          color: #1a1f2e !important;
          background: rgba(59,91,219,0.06) !important;
        }
        .g-hamburger-btn {
          display: none;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 4.5px;
          width: 36px;
          height: 36px;
          background: rgba(26,31,46,0.05);
          border: 1px solid rgba(26,31,46,0.12);
          border-radius: 11px;
          cursor: pointer;
          padding: 0;
          transition: all 0.18s;
        }
        .g-hamburger-btn:hover { background: rgba(59,91,219,0.08) !important; border-color: rgba(59,91,219,0.35) !important; }
        .g-hamburger-btn span {
          display: block;
          width: 15px;
          height: 1.5px;
          background: rgba(26,31,46,0.7);
          border-radius: 2px;
          transition: transform 0.22s ease, opacity 0.22s ease;
          transform-origin: center;
        }
        .g-hamburger-btn.open span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
        .g-hamburger-btn.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .g-hamburger-btn.open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }
        .g-mobile-panel {
          display: none;
          position: absolute;
          top: calc(100% + 10px);
          left: 16px;
          right: 16px;
          background: rgba(255,255,255,0.94);
          backdrop-filter: blur(42px) saturate(1.8);
          -webkit-backdrop-filter: blur(42px) saturate(1.8);
          border: 1px solid rgba(59,91,219,0.16);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.6), 0 24px 70px rgba(0,0,0,0.15), 0 0 60px rgba(59,91,219,0.06);
          border-radius: 18px;
          padding: 14px;
          flex-direction: column;
          gap: 4px;
          animation: gMenuIn 0.24s cubic-bezier(0.16,1,0.3,1);
          z-index: 49;
        }
        .g-mobile-panel.open { display: flex; }
        .g-mobile-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,91,219,0.25), transparent);
          margin: 8px 0;
        }
        @keyframes gMenuIn   { from { opacity: 0; transform: translateY(8px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @media (max-width: 767px) {
          .g-desktop-nav   { display: none !important; }
          .g-desktop-actions { display: none !important; }
          .g-hamburger-btn { display: flex !important; }
        }
      `}</style>

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          height: 64,
          background: scrolled
            ? "rgba(255,255,255,0.85)"
            : "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0))",
          backdropFilter: "blur(28px) saturate(1.6)",
          WebkitBackdropFilter: "blur(28px) saturate(1.6)",
          borderBottom: scrolled ? "1px solid rgba(59,91,219,0.12)" : "1px solid transparent",
          boxShadow: scrolled
            ? "0 14px 46px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)"
            : "none",
          transition: "all 0.35s cubic-bezier(0.16,1,0.3,1)",
          animation: "gHeaderIn 0.5s cubic-bezier(0.16,1,0.3,1) both",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            textDecoration: "none",
          }}
        >
          <Image
            src="/icons/vexa-mark-navy.png"
            alt="Vexa"
            width={24}
            height={24}
            style={{ objectFit: "contain" }}
          />
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: INK,
            }}
          >
            Vexa
            <span
              style={{
                marginLeft: 7,
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: ACCENT,
                padding: "2px 7px",
                borderRadius: 6,
                border: "1px solid rgba(59,91,219,0.28)",
                background: "rgba(59,91,219,0.08)",
                verticalAlign: "middle",
              }}
            >
              Beta
            </span>
          </span>
        </Link>
        <nav
          className="g-desktop-nav"
          aria-label="Primary navigation"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px",
            borderRadius: 14,
            border: "1px solid rgba(26,31,46,0.08)",
            background: "rgba(26,31,46,0.03)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className="g-nav-link"
              style={navLinkStyle(activePage === l.key)}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="g-desktop-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {themeToggle}
          {actions}
        </div>
        <button
          type="button"
          className={`g-hamburger-btn${menuOpen ? " open" : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className={`g-mobile-panel${menuOpen ? " open" : ""}`} role="navigation" aria-label="Mobile navigation">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className="g-nav-link"
              style={{ ...navLinkStyle(activePage === l.key), padding: "11px 13px", borderRadius: 12, fontSize: 14 }}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="g-mobile-divider" />
          <div style={{ padding: "4px 0 2px" }}>{actions}</div>
        </div>
      </header>
    </>
  );
}