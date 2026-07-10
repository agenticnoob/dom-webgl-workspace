import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("runtime package public exports", () => {
  test("keeps pointer state helpers internal to the package", async () => {
    const rootApi = await import("../src/index");

    expect(rootApi).not.toHaveProperty("createInitialPointerState");
  });

  test("exposes root and React entrypoints without concrete effect presets", () => {
    const packageJsonPath = resolve(
      process.cwd(),
      "packages/dom-webgl-runtime/package.json",
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: string;
      exports?: Record<string, { import?: string; types?: string }>;
    };

    expect(packageJson.name).toBe("@viselora/dom-webgl");
    expect(packageJson.exports).toEqual({
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
      "./react": {
        types: "./dist/react.d.ts",
        import: "./dist/react.js",
      },
    });
  });
});
