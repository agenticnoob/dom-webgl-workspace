import type { Metadata } from "next";
import type { ReactNode } from "react";
import "lenis/dist/lenis.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tetrahedron",
  description: "A Viselora tetrahedron study.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
