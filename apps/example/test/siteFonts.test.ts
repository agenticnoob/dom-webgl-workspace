import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const app = resolve(import.meta.dirname, "..");
const pages = readdirSync(app).filter((name) => name.endsWith(".html"));
const fontSheets = readdirSync(resolve(app, "src/fonts")).map((name) =>
  readFileSync(resolve(app, "src/fonts", name), "utf8"),
);

describe("site fonts", () => {
  it("loads no page font from a third-party host", () => {
    for (const page of pages) {
      const html = readFileSync(resolve(app, page), "utf8");
      expect(html, page).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    }
    for (const sheet of fontSheets) expect(sheet).not.toMatch(/https?:\/\//);
  });

  it("points every font URL and preload at a file in public/fonts", () => {
    const urls = [
      ...fontSheets.flatMap((sheet) => [...sheet.matchAll(/url\((\/fonts\/[^)]+)\)/g)].map((match) => match[1])),
      ...pages.flatMap((page) =>
        [...readFileSync(resolve(app, page), "utf8").matchAll(/href="(\/fonts\/[^"]+)"/g)].map((match) => match[1]),
      ),
    ];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(existsSync(resolve(app, "public", url.slice(1))), url).toBe(true);
  });

  it("ships the license with every font family", () => {
    const families = new Set(
      fontSheets.flatMap((sheet) => [...sheet.matchAll(/font-family: '([^']+)'/g)].map((match) => match[1])),
    );
    for (const family of families) {
      const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      expect(existsSync(resolve(app, "public/fonts", `OFL-${slug}.txt`)), family).toBe(true);
    }
  });
});
