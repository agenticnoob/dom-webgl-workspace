import type { NextConfig } from "next";

const nextConfig = {
  devIndicators: false,
  transpilePackages: ["@viselora/dom-webgl", "@viselora/scroll-adapters"],
} satisfies NextConfig;

export default nextConfig;
