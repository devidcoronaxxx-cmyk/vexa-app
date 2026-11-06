import type { Metadata } from "next";

const TITLE = "Sign In";
const DESC =
  "Sign in to Vexa — the free AI for Roblox Studio that generates scripts, systems, and instances in seconds.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://vexaaai.vercel.app/auth/login" },
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
