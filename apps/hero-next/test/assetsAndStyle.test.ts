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

  test("defines the frosted full-viewport surface and motion fallback", () => {
    const css = readFileSync(resolve(appRoot, "app/globals.css"), "utf8");

    expect(css).toContain("#d9dcdd");
    expect(css).toContain(
      "radial-gradient(circle at 50% 46%, #f0f1f1 0%, #e4e6e6 38%, #cfd2d3 100%)",
    );
    expect(css).toMatch(/\.hero-runtime[\s\S]*100svh[\s\S]*overflow:\s*hidden/);
    expect(css).toMatch(/\.hero-runtime canvas[\s\S]*position:\s*fixed/);
    expect(css).toMatch(/\.hero-space::after[\s\S]*feTurbulence[\s\S]*opacity:\s*\.12/);
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("scroll-behavior: auto");
  });
});
