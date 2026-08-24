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

  test("keeps CSS semantic and excludes core WebGL clipping or motion", () => {
    const css = readFileSync(resolve(appRoot, "app/globals.css"), "utf8");

    expect(css).toMatch(/\.hero-runtime\s*\{[^}]*min-height:\s*100svh/);
    expect(css).toMatch(/\.hero-runtime\s*\{[^}]*overflow:\s*visible/);
    expect(css).toMatch(/\.hero-space[\s\S]*min-height:\s*100svh/);
    expect(css).toMatch(/\.hero-runtime canvas[\s\S]*position:\s*fixed/);
    expect(css).toMatch(/\.hero-ghost-surface[\s\S]*position:\s*fixed/);
    expect(css).toMatch(/\.hero-ghost-surface[\s\S]*pointer-events:\s*none/);

    expect(css).toMatch(/--hero-background:\s*#b8b8b8/);
    expect(css).toMatch(/--hero-foreground:\s*#5f5f5f/);
    expect(css).toMatch(
      /--hero-chapter-background:\s*var\(--hero-foreground\)/,
    );
    expect(css).toMatch(
      /--hero-chapter-foreground:\s*var\(--hero-background\)/,
    );
    expect(css).toMatch(
      /\.hero-chapter\s*\{[^}]*background:\s*var\(--hero-chapter-background\)/,
    );
    expect(css).toMatch(
      /\.hero-chapter\s*\{[^}]*color:\s*var\(--hero-chapter-foreground\)/,
    );
    expect(css).toMatch(/data-hero-theme="inverted"/);
    expect(css).toMatch(/data-dom-active="true"/);
    expect(css).toMatch(/\.hero-entry-runway\s*\{[^}]*min-height:\s*520svh/);
    expect(css).toMatch(/\.hero-exit-runway\s*\{[^}]*min-height:\s*420svh/);

    for (const forbidden of [
      /\bclip-path\s*:/,
      /\bmask(?:-[\w-]+)?\s*:/,
      /\bbox-shadow\s*:/,
      /\bfilter\s*:/,
      /\bopacity\s*:/,
      /\bmix-blend-mode\s*:/,
      /(?:^|\n)\s*transform\s*:/,
      /\banimation(?:-[\w-]+)?\s*:/,
      /::before|::after/,
      /gradient\(/,
      /data:image/,
    ]) {
      expect(css).not.toMatch(forbidden);
    }
  });
});
