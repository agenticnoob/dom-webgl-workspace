import type { NextConfig } from "next";

const nextConfig = {
  // Development-only: keep LAN access working across DHCP address changes.
  allowedDevOrigins: ["**.*"],
  devIndicators: false,
  transpilePackages: ["@viselora/dom-webgl", "@viselora/scroll-adapters"],
} satisfies NextConfig;

export default nextConfig;
