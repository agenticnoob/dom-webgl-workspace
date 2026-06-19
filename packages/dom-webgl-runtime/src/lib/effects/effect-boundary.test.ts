import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

describe("effect module boundaries", () => {
  test("pure effect modules do not import renderer, React, demo, or Three.js code", () => {
    const effectFiles = listFiles(
      join(process.cwd(), "packages/dom-webgl-runtime/src/lib/effects"),
    )
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => !file.endsWith(".test.ts"));

    for (const file of effectFiles) {
      const source = readFileSync(file, "utf8");

      expect(source, file).not.toMatch(/from ["']three/);
      expect(source, file).not.toMatch(/from ["']react/);
      expect(source, file).not.toMatch(/apps\/demo|@project\/dom-webgl-demo/);
      expect(source, file).not.toMatch(/render\/renderables/);
    }
  });
});

function listFiles(root: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...listFiles(path));
      continue;
    }

    files.push(path);
  }

  return files;
}
