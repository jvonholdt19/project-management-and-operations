import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lane",
  description: "All projects, one board.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
