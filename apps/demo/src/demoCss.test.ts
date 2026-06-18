import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("demo CSS", () => {
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
});
