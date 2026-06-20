import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("runtime package public exports", () => {
  test("exposes root and React entrypoints without concrete effect presets", () => {
    const packageJsonPath = resolve(
      process.cwd(),
      "packages/dom-webgl-runtime/package.json",
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: string;
      exports?: Record<string, { import?: string; types?: string }>;
    };

    expect(packageJson.name).toBe("@project/dom-webgl-runtime");
    expect(packageJson.exports).toEqual({
      ".": {
        types: "./src/index.ts",
        import: "./src/index.ts",
      },
      "./react": {
        types: "./src/react.ts",
        import: "./src/react.ts",
      },
    });
  });
});
