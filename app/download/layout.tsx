import type { Metadata } from "next";

const TITLE = "Download Vexa";
const DESC =
  "Download the Vexa app and connect to Roblox Studio's built-in MCP server. Generate production-ready Roblox scripts, systems, and instances with AI — free.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://vexaaai.vercel.app/download" },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "https://vexaaai.vercel.app/download",
    type: "website",
  },
};

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
