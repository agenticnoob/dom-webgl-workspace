import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const workspaceRoot = process.cwd();
const appRoot = resolve(workspaceRoot, "apps/hero-next");

describe("hero assets and visual surface", () => {
  test("does not ship an unmounted profile GLB or legacy Draco assets", () => {
    for (const path of [
      "models/noobli-base.glb",
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
      /\.hero-chapter\s*\{[^}]*color:\s*var\(--hero-chapter-foreground\)/,
    );
    expect(css).toMatch(/data-hero-theme="inverted"/);
    expect(css).toMatch(/data-dom-active="true"/);
    expect(css).toMatch(/\.hero-entry-runway\s*\{[^}]*min-height:\s*520svh/);
    expect(css).toMatch(/\.hero-exit-runway\s*\{[^}]*min-height:\s*420svh/);
    expect(css).toMatch(/\.hero-chapter-cycle\s*\{[^}]*position:\s*relative/);
    expect(css).toMatch(/\.hero-portal-stage\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.hero-portal-stage\s*\{[^}]*z-index:\s*11/);
    expect(css).toMatch(/\.hero-portal-copy\s*\{[^}]*grid-row:\s*1/);
    expect(css).toMatch(/\.hero-portal-line\s*\{[^}]*padding-block:\s*0\.2em/);
    expect(css).toMatch(
      /\.hero-portal-stage--final\s*\{[^}]*grid-template-rows:/,
    );
    expect(css).not.toMatch(/\.hero-final-hub\s*\{/);
    expect(css).toMatch(/\.hero-chapter\s*\{[^}]*z-index:\s*20/);
    expect(css).toMatch(
      /\.hero-locale\s*\{[^}]*background:\s*var\(--hero-background\)/,
    );
    expect(css).toMatch(/\.hero-locale button\s*\{[^}]*min-height:\s*2\.75rem/);
    expect(css).toMatch(
      /\.hero-locale button\s*\{[^}]*touch-action:\s*manipulation/,
    );
    expect(css).toMatch(/\.hero-locale button\s*\{[^}]*font-weight:\s*700/);
    expect(css).toMatch(
      /@media \(max-width:\s*700px\)[\s\S]*\.hero-portal-copy\s*\{[^}]*font-size:\s*0\.8125rem/,
    );
    expect(css).not.toMatch(/\.hero-profile/);

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
