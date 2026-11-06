import type { Metadata } from "next";

const TITLE = "Credits";
const DESC =
  "Vexa is built by Vexa Studios. Credits for the people and tools behind the best free AI for Roblox scripting.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://vexaaai.vercel.app/credits" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "https://vexaaai.vercel.app/credits",
    type: "website",
  },
};

export default function CreditsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
