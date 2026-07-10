#!/usr/bin/env node

import { publishRelease } from "./release-publisher.mjs";

const [version, ...extra] = process.argv.slice(2);

try {
  if (!version || extra.length > 0) {
    throw new Error("Usage: npm run release:publish -- <version>");
  }
  const results = publishRelease({ version });
  for (const { name, action } of results) {
    console.log(`${action === "published" ? "Published" : "Skipped"}: ${name}@${version}`);
  }
  console.log(`Release registry verification passed: ${version}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
