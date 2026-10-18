#!/usr/bin/env node
// Builds the contents of the generated agenticnoob/viselora-skills repository.
// `skills/` in this repository is the only source; the output holds its
// git-tracked files plus a README and the LICENSE.
//
//   node scripts/build-skill-repo.mjs <output-dir>

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function buildSkillRepo(root, output) {
  if (existsSync(output) && readdirSync(output).length > 0)
    throw new Error(`Output directory must be empty: ${output}`);
  const listed = spawnSync("git", ["ls-files", "-z", "--", "skills"], {
    cwd: root,
    encoding: "utf8",
  });
  if (listed.status !== 0)
    throw new Error(`git ls-files failed: ${listed.stderr}`);
  const files = listed.stdout.split("\0").filter(Boolean);
  if (!files.some((file) => file.endsWith("/SKILL.md")))
    throw new Error("No SKILL.md is tracked under skills/");

  const copies = [
    ...files.map((file) => [file, file]),
    ["scripts/skill-repo.README.md", "README.md"],
    ["LICENSE", "LICENSE"],
  ];
  for (const [from, to] of copies) {
    const target = resolve(output, to);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(resolve(root, from), target);
  }
  return copies.map(([, to]) => to).sort();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const output = process.argv[2];
  if (!output) {
    process.stderr.write("Usage: node scripts/build-skill-repo.mjs <output-dir>\n");
    process.exit(2);
  }
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const written = buildSkillRepo(root, resolve(output));
    process.stdout.write(`Viselora skill repository built: ${written.length} files\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
