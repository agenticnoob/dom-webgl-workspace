#!/usr/bin/env node

import { createVerifiedTarballs } from "./package-tarballs.mjs";

let packed;
try {
  packed = createVerifiedTarballs(process.cwd());
  for (const metadata of packed.packages) {
    process.stdout.write(
      `${metadata.name}@${metadata.version}: ${metadata.files.length}/9 allowed files, ${metadata.integrity}\n`,
    );
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  packed?.cleanup();
}
