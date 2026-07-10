#!/usr/bin/env node

import {
  assertReleaseVersions,
  setReleaseVersion,
} from "./release-version.mjs";

const args = process.argv.slice(2);

try {
  if (args.length === 1 && args[0] === "--check") {
    const version = assertReleaseVersions(process.cwd());
    process.stdout.write(`Release versions OK: ${version}\n`);
  } else if (args.length === 1) {
    const version = setReleaseVersion(process.cwd(), args[0]);
    process.stdout.write(`Release version set: ${version}\n`);
  } else {
    throw new Error(
      "Usage: node scripts/set-release-version.mjs <major>.<minor>.<patch>-alpha.<number> | --check",
    );
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
