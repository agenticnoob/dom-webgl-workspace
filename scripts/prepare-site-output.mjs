#!/usr/bin/env node
// Turns a static build directory into Vercel Build Output API v3:
// `<out>/static` holds the files, `<out>/config.json` the routes.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [source, output] = process.argv.slice(2);
if (!source || !output) {
  process.stderr.write("Usage: node scripts/prepare-site-output.mjs <dist> <output>\n");
  process.exit(1);
}

const siteOutputConfig = {
  version: 3,
  routes: [
    // Vite fingerprints everything under /assets; it never changes in place.
    {
      src: "/assets/(.*)",
      headers: { "cache-control": "public, max-age=31536000, immutable" },
      continue: true,
    },
    // Font files carry a content hash in their names (scripts/fetch-site-fonts.mjs).
    {
      src: "/fonts/(.*)\\.woff2",
      headers: { "cache-control": "public, max-age=31536000, immutable" },
      continue: true,
    },
    { handle: "filesystem" },
    { src: "/(.*)", status: 404, dest: "/index.html" },
  ],
};

const out = resolve(output);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(resolve(source), resolve(out, "static"), { recursive: true });
writeFileSync(resolve(out, "config.json"), `${JSON.stringify(siteOutputConfig, null, 2)}\n`);
process.stdout.write(`Vercel output ready in ${out}\n`);
