import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const ignoredDirectories = new Set([
  ".codegraph",
  ".git",
  "dist",
  "node_modules",
]);
const ignoredDirectoryPrefixes = [".tmp-dom-webgl-"];
const testFilePattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

describe("workspace structure", () => {
  test("keeps test files outside production source directories", () => {
    const misplacedTests = collectFiles(repoRoot)
      .map((file) => relative(repoRoot, file).split(sep).join("/"))
      .filter((file) => testFilePattern.test(file))
      .filter((file) => file.split("/").includes("src"));

    expect(misplacedTests).toEqual([]);
  });
});

function collectFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    if (ignoredDirectories.has(entry) || isIgnoredDirectoryPrefix(entry)) {
      continue;
    }

    const filePath = join(directory, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      files.push(...collectFiles(filePath));
      continue;
    }

    files.push(filePath);
  }

  return files;
}

function isIgnoredDirectoryPrefix(entry: string): boolean {
  return ignoredDirectoryPrefixes.some((prefix) => entry.startsWith(prefix));
}
