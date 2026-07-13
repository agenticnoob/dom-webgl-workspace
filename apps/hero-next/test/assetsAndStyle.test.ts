import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const workspaceRoot = process.cwd();
const appRoot = resolve(workspaceRoot, "apps/hero-next");

describe("hero assets and visual surface", () => {
  test("copies only the required tetrahedron and Draco files byte-for-byte", () => {
    const assetPairs = [
      ["models/4.glb", "models/4.glb"],
      ["draco/gltf/draco_decoder.js", "draco/gltf/draco_decoder.js"],
      ["draco/gltf/draco_decoder.wasm", "draco/gltf/draco_decoder.wasm"],
      [
        "draco/gltf/draco_wasm_wrapper.js",
        "draco/gltf/draco_wasm_wrapper.js",
      ],
    ];

    expect(
      assetPairs.every(([, target]) =>
        existsSync(resolve(appRoot, "public", target)),
      ),
    ).toBe(true);

    for (const [source, target] of assetPairs) {
      const sourceBytes = readFileSync(
        resolve(workspaceRoot, "apps/example/public", source),
      );
      const targetBytes = readFileSync(resolve(appRoot, "public", target));

      expect(targetBytes.equals(sourceBytes)).toBe(true);
    }
  });

  test("keeps hero CSS layout-only", () => {
    const css = readFileSync(resolve(appRoot, "app/globals.css"), "utf8");

    expect(css).toMatch(/\.hero-runtime[\s\S]*height:\s*100svh/);
    expect(css).toMatch(/\.hero-runtime canvas[\s\S]*position:\s*fixed/);
    expect(css).toMatch(/\.hero-ghost-surface[\s\S]*position:\s*fixed/);
    expect(css).toMatch(/\.hero-ghost-surface[\s\S]*pointer-events:\s*none/);

    for (const forbidden of [
      /\bbackground(?:-image)?\s*:/,
      /\bcolor\s*:/,
      /\bborder(?:-[\w-]+)?\s*:/,
      /\bbox-shadow\s*:/,
      /\bfilter\s*:/,
      /\bopacity\s*:/,
      /\bmix-blend-mode\s*:/,
      /\btransform\s*:/,
      /\banimation(?:-[\w-]+)?\s*:/,
      /::before|::after/,
      /gradient\(/,
      /data:image/,
    ]) {
      expect(css).not.toMatch(forbidden);
    }
  });
});
