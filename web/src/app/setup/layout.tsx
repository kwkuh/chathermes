import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup · ChatHermes",
  // A setup screen has no business in search results, and an indexed one is an
  // invitation to try claiming installs.
  robots: { index: false, follow: false },
};

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
