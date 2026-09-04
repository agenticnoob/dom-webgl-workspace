import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const workspaceRoot = process.cwd();
const appRoot = resolve(workspaceRoot, "apps/hero-next");

describe("hero assets and visual surface", () => {
  test("ships the optimized profile GLB and its local Draco decoder", () => {
    const modelPath = resolve(appRoot, "public/models/noobli-profile.glb");

    expect(existsSync(modelPath)).toBe(true);
    expect(statSync(modelPath).size).toBeLessThan(5_000_000);
    expect(readFileSync(modelPath).subarray(0, 4).toString("ascii")).toBe(
      "glTF",
    );

    for (const path of [
      "draco/gltf/draco_decoder.js",
      "draco/gltf/draco_decoder.wasm",
      "draco/gltf/draco_wasm_wrapper.js",
    ]) {
      expect(existsSync(resolve(appRoot, "public", path))).toBe(true);
    }

    expect(existsSync(resolve(appRoot, "public/models/noobli-base.glb"))).toBe(
      false,
    );
    expect(existsSync(resolve(appRoot, "public/models/4.glb"))).toBe(false);
  });

  test("keeps CSS semantic and excludes core WebGL clipping or motion", () => {
    const css = readFileSync(resolve(appRoot, "app/globals.css"), "utf8");

    expect(css).toMatch(/\.hero-runtime\s*\{[^}]*min-height:\s*100svh/);
    expect(css).toMatch(/\.hero-runtime\s*\{[^}]*overflow:\s*visible/);
    expect(css).toMatch(/\.hero-space[\s\S]*min-height:\s*100svh/);
    expect(css).toMatch(/body\s*\{[^}]*background:\s*#5f5f5f/);
    expect(css).toMatch(/\.hero-space\s*\{[\s\S]*background:\s*transparent/);
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
    expect(css).toMatch(/\.hero-entry-runway\s*\{[^}]*min-height:\s*600svh/);
    expect(css).toMatch(/\.hero-hub-runway--opening\s*\{[^}]*min-height:\s*0/);
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
      /@media \(max-width:\s*700px\)[\s\S]*\.hero-portal-copy\s*\{[^}]*font-size:\s*0\.9375rem/,
    );
    expect(css).toMatch(
      /\.hero-chapter--profile\s*\{[^}]*background:\s*transparent/,
    );
    expect(css).not.toContain("hero-chapter__frame");
    expect(css).not.toContain("hero-exit-sticky");
    expect(css).toMatch(
      /\.hero-profile\s*\{[\s\S]*width:\s*100vw[^}]*min-height:\s*0/,
    );
    expect(css).toMatch(
      /\.hero-profile__outro\s*\{[^}]*min-height:\s*82svh[^}]*margin-top:\s*0[^}]*align-items:\s*end/,
    );
    expect(css).toMatch(
      /\.hero-profile__model-exclusion\s*\{[^}]*left:\s*calc\(50vw - var\(--hero-profile-model-exclusion-width\) \/ 2\)/,
    );
    expect(css).toMatch(
      /\.hero-profile__speech-bubble\s*\{[^}]*left:\s*calc\(50vw - var\(--hero-profile-speech-width\) \/ 2\)/,
    );
    expect(css).toMatch(
      /\.hero-profile\s*\{[\s\S]*color:\s*var\(--hero-chapter-foreground\)/,
    );
    expect(css).toMatch(
      /\.hero-profile__lead,[\s\S]*\.hero-profile__story,[\s\S]*\.hero-profile__outro\s*\{[\s\S]*grid-template-columns:/,
    );
    expect(css).toMatch(
      /\.hero-profile__model-exclusion\s*\{[^}]*position:\s*fixed/,
    );
    expect(css).toMatch(
      /\.hero-profile__speech-bubble\s*\{[^}]*position:\s*fixed/,
    );
    expect(css).toMatch(
      /\.hero-profile__speech-surface\s*\{[^}]*border:\s*2px solid currentColor/,
    );
    expect(css).toMatch(
      /\.hero-profile__speech-bubble\s*\{[^}]*color:\s*var\(--hero-foreground\)/,
    );
    expect(css).toMatch(
      /\.hero-profile__speech-surface\s*\{[^}]*border-radius:\s*var\(--hero-profile-speech-radius\)/,
    );
    expect(css).toMatch(
      /\.hero-profile__speech-surface\s*\{[^}]*background:\s*var\(--hero-background\)/,
    );
    expect(css).not.toMatch(
      /\.hero-profile__speech-surface\s*\{[^}]*transform(?:-origin)?:/,
    );
    expect(css).not.toMatch(
      /\.hero-profile__speech-tail\s*\{[^}]*transform(?:-origin)?:/,
    );
    expect(css).toMatch(
      /\.hero-profile__speech-tail-fill\s*\{[^}]*var\(--hero-background\)/,
    );
    expect(css).toMatch(/\.hero-profile__flow\s*\{[^}]*max-width:/);
    expect(css).toMatch(/\.hero-profile__flow\s*\{[^}]*margin:\s*0 auto/);
    expect(css).toMatch(
      /\.hero-profile__story-column\s*\{[^}]*display:\s*flex/,
    );
    expect(css).toMatch(
      /\.hero-profile__wrap-token\s*\{[^}]*inset-inline-start:\s*var\(--hero-profile-line-shift,\s*0px\)/,
    );
    expect(css).not.toContain("--hero-profile-wrap-inset");
    expect(css).not.toContain("hero-profile__backdrop");
    expect(css).toMatch(
      /@media \(max-width:\s*700px\)[\s\S]*\.hero-profile__outro\s*\{[^}]*min-height:\s*84svh[^}]*margin-top:\s*0/,
    );

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
