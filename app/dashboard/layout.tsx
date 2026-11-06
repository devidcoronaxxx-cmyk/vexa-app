import type { Metadata } from "next";

const TITLE = "Dashboard";
const DESC =
  "Your Vexa dashboard. Favorites, projects, and AI generation — all in one place.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://vexaaai.vercel.app/dashboard" },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
