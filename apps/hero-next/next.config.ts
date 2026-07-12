import type { NextConfig } from "next";

const nextConfig = {
  transpilePackages: ["@viselora/dom-webgl", "@viselora/scroll-adapters"],
} satisfies NextConfig;

export default nextConfig;
