import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Card Garden — Board Game Card Creator",
  description: "A playful place to grow your board game cards."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
