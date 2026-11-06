"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

interface NavbarProps {
  activePage?: "home" | "dashboard" | "terms" | "privacy" | "download" | "credits";
  rightSlot?: ReactNode;
}

const NAV_LINKS: { href: string; label: string; key: string }[] = [
  { href: "/", label: "Home", key: "home" },
  { href: "/download", label: "Download", key: "download" },
  { href: "/credits", label: "Credits", key: "credits" },
];

export function Navbar({ activePage, rightSlot }: NavbarProps) {
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

  const defaultActions = (
    <a
      href="/download"
      className="vx-neon-btn"
      style={{ padding: "8px 15px", fontSize: 13 }}
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
    color: active ? "#ffe98a" : "rgba(255,255,255,0.48)",
    textDecoration: "none",
    padding: "7px 13px",
    borderRadius: 10,
    background: active
      ? "linear-gradient(180deg, rgba(252,216,70,0.14), rgba(252,216,70,0.05))"
      : "transparent",
    border: active ? "1px solid rgba(252,216,70,0.30)" : "1px solid transparent",
    boxShadow: active
      ? "inset 0 1px 0 rgba(255,255,255,0.10), 0 0 18px rgba(252,216,70,0.18)"
      : "none",
    transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
    fontFamily: "inherit",
    position: "relative",
  } as React.CSSProperties);

  return (
    <>
      <style>{`
        .g-nav-link {
          position: relative;
        }
        .g-nav-link:hover {
          color: rgba(255,255,255,0.92) !important;
          background: rgba(255,255,255,0.06) !important;
        }

        .g-hamburger-btn {
          display: none;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 4.5px;
          width: 36px;
          height: 36px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 11px;
          cursor: pointer;
          padding: 0;
          transition: all 0.18s;
        }
        .g-hamburger-btn:hover { background: rgba(252,216,70,0.08) !important; border-color: rgba(252,216,70,0.35) !important; }
        .g-hamburger-btn span {
          display: block;
          width: 15px;
          height: 1.5px;
          background: rgba(255,255,255,0.7);
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
          background: rgba(9,10,16,0.94);
          backdrop-filter: blur(42px) saturate(1.8);
          -webkit-backdrop-filter: blur(42px) saturate(1.8);
          border: 1px solid rgba(252,216,70,0.16);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 24px 70px rgba(0,0,0,0.6), 0 0 60px rgba(252,216,70,0.08);
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
          background: linear-gradient(90deg, transparent, rgba(252,216,70,0.25), transparent);
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
            ? "rgba(6,7,12,0.72)"
            : "linear-gradient(180deg, rgba(6,7,12,0.55), rgba(6,7,12,0))",
          backdropFilter: "blur(28px) saturate(1.6)",
          WebkitBackdropFilter: "blur(28px) saturate(1.6)",
          borderBottom: scrolled ? "1px solid rgba(252,216,70,0.10)" : "1px solid transparent",
          boxShadow: scrolled
            ? "0 14px 46px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)"
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
            src="/icons/vexa-mark-cream.png"
            alt="Vexa"
            width={24}
            height={24}
            style={{ objectFit: "contain", filter: "drop-shadow(0 0 10px rgba(252,216,70,0.45))" }}
          />
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "#fff",
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
                color: "#ffe98a",
                padding: "2px 7px",
                borderRadius: 6,
                border: "1px solid rgba(252,216,70,0.28)",
                background: "rgba(252,216,70,0.08)",
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
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
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
        <div className="g-desktop-actions" style={{ display: "flex" }}>
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
