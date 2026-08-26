import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const sourceRoot = resolve(process.cwd(), "apps/hero-next/src");
const appRoot = resolve(process.cwd(), "apps/hero-next/app");

describe("hero palette and transition boundary", () => {
  test("keeps one semantic two-tone palette across WebGL and DOM tokens", () => {
    const files = [...readSourceFiles(sourceRoot), ...readSourceFiles(appRoot)];
    const colorsByFile = Object.fromEntries(
      files
        .map((file) => [
          relative(process.cwd(), file),
          [...readFileSync(file, "utf8").matchAll(/#[\da-fA-F]{6}/g)].map(
            ([color]) => color.toUpperCase(),
          ),
        ])
        .filter(([, colors]) => colors.length > 0),
    );

    expect(colorsByFile).toEqual({
      "apps/hero-next/app/globals.css": [
        "#B8B8B8",
        "#B8B8B8",
        "#5F5F5F",
        "#5F5F5F",
        "#B8B8B8",
      ],
      "apps/hero-next/src/experience/HeroExperience.tsx": [
        "#F2F2F2",
        "#B8B8B8",
      ],
      "apps/hero-next/src/ghost/pointerLight.ts": ["#F0F0F0"],
      "apps/hero-next/src/transition/transitionConfig.ts": [
        "#B8B8B8",
        "#5F5F5F",
      ],
    });
    const sources = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(sources).not.toMatch(/#3f3f3f|#0d0d0d|vec3\(0\.72\)/i);
  });

  test("keeps four scroll signal pairs, one theme store, and no obsolete cover path", () => {
    const tetrahedronEffect = readFileSync(
      resolve(sourceRoot, "tetrahedron/effect.ts"),
      "utf8",
    );
    const backgroundEffect = readFileSync(
      resolve(sourceRoot, "ghost/backgroundEffect.ts"),
      "utf8",
    );
    const experience = readFileSync(
      resolve(sourceRoot, "experience/HeroExperience.tsx"),
      "utf8",
    );
    const sources = readSourceFiles(sourceRoot)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(sources).not.toMatch(
      /hero\.transition\.tetrahedron-cover|coverEnd|backgroundSwapPoint|foregroundResetPoint|exitPositionZ|coverPositionZ|\+=300%/,
    );
    for (let chapter = 1; chapter <= 4; chapter += 1) {
      expect(sources).toContain(`entry: "hero.chapter-${chapter}.entry"`);
      expect(sources).toContain(`exit: "hero.chapter-${chapter}.exit"`);
    }
    expect(sources).toContain("heroChapterDefinitions");
    expect(sources).toContain("useScrollEffectProgressStore");
    expect(sources).toContain('hitTest: "mesh"');
    expect(sources).toContain("press: true");
    expect(tetrahedronEffect).toContain("publishHeroTransitionSignals");
    expect(backgroundEffect).toContain("readHeroTransitionSignals");
    expect(experience).toContain("signals: signalWriter");
    expect(experience).toContain("theme: theme.store");
    expect(experience).toContain("locale: locale.store");
    expect(`${tetrahedronEffect}\n${backgroundEffect}`).not.toMatch(
      /eventBus|dispatchEvent|addEventListener\(["']hero/i,
    );
  });
});

function readSourceFiles(root: string): readonly string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      return readSourceFiles(path);
    }

    return /\.(?:css|ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}
