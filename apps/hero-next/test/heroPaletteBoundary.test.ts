import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const sourceRoot = resolve(process.cwd(), "apps/hero-next/src");
const appRoot = resolve(process.cwd(), "apps/hero-next/app");

describe("hero palette and transition boundary", () => {
  test("keeps the only non-light author colors in the transition config", () => {
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
      "apps/hero-next/src/HeroExperience.tsx": [
        "#D8D8D8",
        "#F2F2F2",
        "#B8B8B8",
      ],
      "apps/hero-next/src/heroGhostEffects.ts": ["#F0F0F0"],
      "apps/hero-next/src/heroTransitionConfig.ts": [
        "#B8B8B8",
        "#5F5F5F",
      ],
    });
    const sources = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(sources).not.toMatch(/#3f3f3f|#0d0d0d|vec3\(0\.72\)/i);
  });

  test("keeps one hold signal family without obsolete scroll-cover artifacts", () => {
    const tetrahedronEffect = readFileSync(
      resolve(sourceRoot, "heroEffect.ts"),
      "utf8",
    );
    const backgroundEffect = readFileSync(
      resolve(sourceRoot, "heroGhostEffects.ts"),
      "utf8",
    );
    const experience = readFileSync(
      resolve(sourceRoot, "HeroExperience.tsx"),
      "utf8",
    );
    const sources = readSourceFiles(sourceRoot)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(sources).not.toMatch(
      /hero\.transition\.tetrahedron-cover|orientEnd|approachEnd|coverEnd|backgroundSwapPoint|foregroundResetPoint|exitPositionZ|coverPositionZ/,
    );
    expect(sources).not.toMatch(
      /WebGLScrollTimeline|transitionStart|transitionEnd|\+=300%/,
    );
    expect(sources).toContain("useScrollEffectProgressStore");
    expect(sources).toContain('hitTest: "mesh"');
    expect(sources).toContain("press: true");
    expect(tetrahedronEffect).toContain("publishHeroTransitionSignals");
    expect(backgroundEffect).toContain("readHeroTransitionSignals");
    expect(experience).toContain("signals: signalWriter");
    expect(`${tetrahedronEffect}\n${backgroundEffect}`).not.toMatch(
      /themeStore|eventBus|dispatchEvent|addEventListener\(["']hero/i,
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
