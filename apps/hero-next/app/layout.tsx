import type { Metadata } from "next";
import type { ReactNode } from "react";
import "lenis/dist/lenis.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "noobli — Agent-first builder",
  description:
    "一个关于自我、AI 公理、开放构建与公共联结的四章节个人站。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
