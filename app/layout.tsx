import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boardgame Card Studio",
  description: "Create, illustrate, and organize your board game cards."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
