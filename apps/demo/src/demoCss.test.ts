import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("demo CSS", () => {
  test("loads the Lenis recommended runtime CSS", () => {
    const hookSource = readFileSync(
      resolve(__dirname, "useDemoSmoothScrollStack.ts"),
      "utf8",
    );

    expect(hookSource).toContain('import "lenis/dist/lenis.css";');
  });

  test("keeps the vertical scrollbar gutter stable during runtime scroll", () => {
    const css = readFileSync(resolve(__dirname, "demo.css"), "utf8");

    expect(css).toContain("scrollbar-gutter: stable");
    expect(css).toContain("overflow-y: scroll");
  });

  test("keeps demo grids and media targets from overflowing narrow viewports", () => {
    const css = readFileSync(resolve(__dirname, "demo.css"), "utf8");

    expect(css).toContain("box-sizing: border-box");
    expect(css).toContain("overflow-x: clip");
    expect(css).toContain("repeat(auto-fit, minmax(min(100%, 220px), 1fr))");
    expect(css).toContain("repeat(auto-fit, minmax(min(100%, 240px), 1fr))");
    expect(css).toContain("grid-auto-rows: 180px");
    expect(css).toContain("grid-auto-rows: 232px");
    expect(css).toMatch(/\.demo-card-media\s*\{[^}]*height: 100%/);
    expect(css).not.toMatch(/\.demo-card-media\s*\{[^}]*aspect-ratio:/);
  });

  test("renders the first scroll marker image as a native sticky full-bleed cover target", () => {
    const css = readFileSync(resolve(__dirname, "demo.css"), "utf8");

    expect(css).toMatch(/\.demo-scroll-zoom-stage\s*\{[^}]*height: 220vh/);
    expect(css).toMatch(/\.demo-scroll-zoom-stage\s*\{[^}]*position: relative/);
    expect(css).toMatch(/\.demo-scroll-zoom-stage\s*\{[^}]*margin-left: calc/);
    expect(css).toMatch(/\.demo-scroll-zoom-stage\s*\{[^}]*margin-bottom: 42vh/);
    expect(css).toMatch(/\.demo-scroll-zoom-stage\s*\{[^}]*overflow: clip/);
    expect(css).toMatch(/\.demo-scroll-card--zoom-image\s*\{[^}]*width: 100vw/);
    expect(css).toMatch(/\.demo-scroll-card--zoom-image\s*\{[^}]*height: 100vh/);
    expect(css).toMatch(/\.demo-scroll-card--zoom-image\s*\{[^}]*position: sticky/);
    expect(css).toMatch(/\.demo-scroll-card--zoom-image\s*\{[^}]*top: 0/);
    expect(css).toMatch(/\.demo-scroll-card--zoom-image\s*\{[^}]*object-fit: cover/);
    expect(css).toMatch(/\.demo-scroll-zoom-gallery-viewport\s*\{[^}]*position: sticky/);
    expect(css).toMatch(/\.demo-scroll-zoom-gallery-viewport\s*\{[^}]*margin-top: -100vh/);
    expect(css).toMatch(/\.demo-scroll-zoom-gallery\s*\{[^}]*width: max-content/);
    expect(css).not.toContain("--demo-scroll-zoom-progress");
    expect(css).not.toContain("--demo-scroll-zoom-gallery-travel");
    expect(css).not.toMatch(/\.demo-scroll-zoom-gallery\s*\{[^}]*transform:/);
    expect(css).not.toMatch(/\.demo-scroll-zoom-gallery\s*\{[^}]*transition:\s*transform/);
  });
});
