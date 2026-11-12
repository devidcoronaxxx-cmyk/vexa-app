import type { Metadata } from "next";

const TITLE = "My Projects";
const DESC =
  "Manage your Vexa projects. Create, organize, and open your Roblox scripts right from your browser.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://vexaaai.vercel.app/local" },
  robots: { index: false, follow: false },
};

export default function LocalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
