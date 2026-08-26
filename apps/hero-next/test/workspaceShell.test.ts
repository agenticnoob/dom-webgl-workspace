import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const appRoot = resolve(process.cwd(), "apps/hero-next");

describe("hero Next.js workspace shell", () => {
  test("declares a private App Router workspace with one managed visual layer and semantic chapter DOM", () => {
    const requiredFiles = [
      "package.json",
      "next.config.ts",
      "tsconfig.json",
      "next-env.d.ts",
      "app/layout.tsx",
      "app/page.tsx",
      "app/globals.css",
    ];

    expect(requiredFiles.every((path) => existsSync(resolve(appRoot, path)))).toBe(true);

    const packageJson = JSON.parse(
      readFileSync(resolve(appRoot, "package.json"), "utf8"),
    ) as {
      name?: string;
      private?: boolean;
      scripts?: Record<string, string>;
    };
    const nextConfigSource = readFileSync(
      resolve(appRoot, "next.config.ts"),
      "utf8",
    );
    const pageSource = readFileSync(resolve(appRoot, "app/page.tsx"), "utf8");
    const heroSource = readFileSync(
      resolve(appRoot, "src/experience/HeroExperience.tsx"),
      "utf8",
    );
    const narrativeSource = readFileSync(
      resolve(appRoot, "src/chapters/HeroChapterNarrative.tsx"),
      "utf8",
    );
    const chapterSource = readFileSync(
      resolve(appRoot, "src/chapters/HeroChapter.tsx"),
      "utf8",
    );
    const cssSource = readFileSync(
      resolve(appRoot, "app/globals.css"),
      "utf8",
    );

    expect(packageJson).toMatchObject({
      name: "@viselora/hero-next",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        typecheck: "tsc --noEmit",
      },
    });
    expect(nextConfigSource).toContain("devIndicators: false");
    expect(pageSource).toContain("<HeroExperience />");
    expect(heroSource).toContain('className="hero-space"');
    expect(heroSource).not.toMatch(/<h[1-6]|<p|<button|<nav|<a /);
    expect(narrativeSource).toContain("<HeroChapter");
    expect(chapterSource).toContain("<article");
    expect(chapterSource).toContain("<h1>");
    expect(cssSource).toMatch(/\.hero-space\s*{[\s\S]*?background: transparent;/);
    expect(cssSource).toMatch(
      /\.hero-chapter\s*{[\s\S]*?background: var\(--hero-chapter-background\);/,
    );
    expect(cssSource).toMatch(
      /\.hero-chapter\s*{[\s\S]*?color: var\(--hero-chapter-foreground\);/,
    );
  });
});
