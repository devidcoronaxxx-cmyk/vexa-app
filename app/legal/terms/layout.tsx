import type { Metadata } from "next";

const TITLE = "Terms of Service";
const DESC =
  "Vexa Terms of Service — the rules for using the free AI-powered Roblox script generator and Roblox Studio plugin.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://vexaaai.vercel.app/legal/terms" },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
