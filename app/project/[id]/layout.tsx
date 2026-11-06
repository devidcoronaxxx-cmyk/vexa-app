import type { Metadata } from "next";

const TITLE = "Project Editor";
const DESC =
  "Chat with Vexa AI and generate scripts, instances, and GUIs for your Roblox project in real time.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  robots: { index: false, follow: false },
};

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
