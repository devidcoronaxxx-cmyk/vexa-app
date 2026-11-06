import type { Metadata } from "next";

const TITLE = "Get Started";
const DESC =
  "Set up Vexa in minutes. Install the Roblox Studio plugin, connect your account, and start generating scripts with AI.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "https://vexaaai.vercel.app/onboarding" },
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
