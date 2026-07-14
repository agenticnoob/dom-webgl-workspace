import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const workspaceRoot = process.cwd();
const appRoot = resolve(workspaceRoot, "apps/hero-next");

describe("hero assets and visual surface", () => {
  test("does not ship legacy GLB or Draco assets", () => {
    for (const path of [
      "models/4.glb",
      "draco/gltf/draco_decoder.js",
      "draco/gltf/draco_decoder.wasm",
      "draco/gltf/draco_wasm_wrapper.js",
    ]) {
      expect(existsSync(resolve(appRoot, "public", path))).toBe(false);
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
