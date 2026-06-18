import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("demo CSS", () => {
  test("keeps the vertical scrollbar gutter stable during runtime scroll", () => {
    const css = readFileSync(resolve(__dirname, "demo.css"), "utf8");

    expect(css).toContain("scrollbar-gutter: stable");
    expect(css).toContain("overflow-y: scroll");
  });
});
