import type { NextConfig } from "next";

const nextConfig = {
  allowedDevOrigins: ["192.168.50.5"],
  devIndicators: false,
  transpilePackages: ["@viselora/dom-webgl", "@viselora/scroll-adapters"],
} satisfies NextConfig;

export default nextConfig;
