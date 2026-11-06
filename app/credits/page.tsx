"use client"

import { Navbar } from "../components/navbar"
import { Footer } from "../components/footer"

const SERIF = "Georgia, 'Times New Roman', serif"
const SANS = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
const INK = "#1c1b1a"
const CREAM = "#d8d5c8"
const ACCENT = "#bc5b28"

export default function CreditsPage() {
  return (
    <div style={{ minHeight: "100vh", background: CREAM, fontFamily: SANS, color: INK }}>
      <Navbar activePage="credits" />

      <section style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "clamp(100px,14vw,160px) clamp(18px,5vw,24px) clamp(60px,8vw,96px)",
        textAlign: "center",
      }}>
        <h1 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: "clamp(40px,7vw,58px)", marginBottom: 12, color: INK }}>
          Credits
        </h1>
        <p style={{ fontSize: 14, color: "rgba(28,27,26,0.55)", marginBottom: 40, maxWidth: 400, lineHeight: 1.6 }}>
          Built with care for the Roblox developer community.
        </p>

        <div style={{
          maxWidth: 520, width: "100%", padding: "32px 28px", textAlign: "left",
          background: "#fff", border: "1px solid #c8c4b8", borderRadius: 16,
          boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
        }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: "rgba(28,27,26,0.4)", marginBottom: 10 }}>
              Original Creator
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: INK, marginBottom: 8 }}>
              troojin
            </div>
            <p style={{ fontSize: 13.5, color: "rgba(28,27,26,0.6)", lineHeight: 1.7, margin: 0 }}>
              Original creator of the Vexa project (formerly Galaxium), from which this project was forked and renamed.
            </p>
          </div>

          <div style={{ height: 1, background: "#c8c4b8", marginBottom: 28 }} />

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: "rgba(28,27,26,0.4)", marginBottom: 10 }}>
              Community
            </div>
            <p style={{ fontSize: 13.5, color: "rgba(28,27,26,0.6)", lineHeight: 1.7, margin: 0 }}>
              Vexa grows thanks to its community. Join us on Discord.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
