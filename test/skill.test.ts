import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const skillRoot = resolve(repoRoot, "skills/viselora-dom-webgl");
const verifierPath = resolve(skillRoot, "scripts/verify-consumer.mjs");
const templateRoot = resolve(skillRoot, "templates/react-vite");
const fixtureRoots: string[] = [];

const requiredFiles = [
  "SKILL.md",
  "agents/openai.yaml",
  "references/architecture-rules.md",
  "references/effect-recipes.md",
  "references/public-api.md",
  "references/quickstart.md",
  "references/troubleshooting.md",
  "references/verification.md",
  "scripts/verify-consumer.mjs",
  "templates/effects/image-hover-overlay.ts",
  "templates/effects/pinned-model-glow.tsx",
  "templates/effects/scroll-image-sequence.tsx",
  "templates/effects/surface-pulse.ts",
  "templates/effects/video-background-texture.ts",
  "templates/react-vite/package.json",
  "templates/react-vite/src/App.tsx",
  "templates/react-vite/src/effects.ts",
] as const;

afterEach(() => {
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

describe("viselora-dom-webgl skill", () => {
  test("contains exactly the public skill deliverables", () => {
    expect(collectFiles(skillRoot)).toEqual(requiredFiles);
  });

  test("uses minimal skill frontmatter and matching agent metadata", () => {
    const skill = read("SKILL.md");
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1];

    expect(frontmatter).toBeDefined();
    expect(frontmatter?.split("\n").map((line) => line.split(":", 1)[0])).toEqual([
      "name",
      "description",
    ]);
    expect(frontmatter).toContain("name: viselora-dom-webgl");
    expect(frontmatter).not.toContain("TODO");

    expect(read("agents/openai.yaml")).toBe(
      [
        "interface:",
        '  display_name: "Viselora DOM WebGL"',
        '  short_description: "Build verified DOM-first WebGL pages with Viselora"',
        '  default_prompt: "Use $viselora-dom-webgl to build a DOM-first WebGL page with one runtime and verified public package imports."',
        "",
      ].join("\n"),
    );
  });

  test("documents the exact alpha and all five complete recipes", () => {
    const allContent = requiredFiles
      .filter((file) => /\.(?:md|tsx?)$/.test(file))
      .map((file) => read(file))
      .join("\n");
    const recipes = read("references/effect-recipes.md");

    expect(allContent).toContain("Compatible package version: 0.1.0-alpha.0");
    expect(recipes).toContain("## Surface pulse");
    expect(recipes).toContain("## Video background texture");
    expect(recipes).toContain("## Image hover overlay");
    expect(recipes).toContain("## Pinned model glow");
    expect(recipes).toContain("## Scroll image sequence");

    expect(read("templates/effects/surface-pulse.ts")).toContain(
      'kind: "viselora.surfacePulse"',
    );
    expect(read("templates/effects/video-background-texture.ts")).toContain(
      'kind: "viselora.videoBackground"',
    );
    expect(read("templates/effects/image-hover-overlay.ts")).toContain(
      'kind: "viselora.imageHoverOverlay"',
    );
    expect(read("templates/effects/pinned-model-glow.tsx")).toContain(
      'kind: "viselora.modelGlow"',
    );
    expect(read("templates/effects/scroll-image-sequence.tsx")).toContain(
      'progressKey: "sequence-progress"',
    );
  });

  test("uses only public package entrypoints and excludes R3F", () => {
    const content = collectFiles(skillRoot)
      .map((file) => read(file))
      .join("\n");

    expect(content).not.toMatch(/from\s+["']@project\//);
    expect(content).not.toMatch(
      /(?:from\s+|import\s+)["'][^"']*packages\/dom-webgl-runtime\/src/,
    );
    expect(content).not.toMatch(/from\s+["']@react-three\/fiber["']/);
  });

  test("accepts the supplied React Vite consumer", () => {
    const result = runVerifier(templateRoot);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Viselora consumer verification passed");
  });

  test.each([
    [
      "wrong package version",
      (root: string) =>
        replace(root, "package.json", '"0.1.0-alpha.0"', '"^0.1.0-alpha.0"'),
      "exactly 0.1.0-alpha.0",
    ],
    [
      "project aliases",
      (root: string) => append(root, "src/App.tsx", '\nimport "@project/runtime";\n'),
      "@project/* imports are prohibited",
    ],
    [
      "repository source imports",
      (root: string) =>
        append(
          root,
          "src/App.tsx",
          '\nimport "packages/dom-webgl-runtime/src/index";\n',
        ),
      "repository source imports are prohibited",
    ],
    [
      "two runtime roots",
      (root: string) =>
        append(root, "src/App.tsx", "\nconst duplicateRoot = <WebGLScrollRuntime />;\n"),
      "exactly one runtime root",
    ],
    [
      "a direct Three renderer",
      (root: string) => append(root, "src/App.tsx", "\nnew WebGLRenderer();\n"),
      "direct WebGLRenderer construction is prohibited",
    ],
    [
      "an R3F import",
      (root: string) =>
        append(root, "src/App.tsx", '\nimport { Canvas } from "@react-three/fiber";\n'),
      "React Three Fiber is prohibited",
    ],
    [
      "an R3F Canvas",
      (root: string) => append(root, "src/App.tsx", "\nconst extraCanvas = <Canvas />;\n"),
      "R3F Canvas roots are prohibited",
    ],
    [
      "component-scoped runtime effects",
      (root: string) => {
        replace(root, "src/App.tsx", "export function App() {", "export function App() {\n  const runtimeEffects = [];");
        replace(root, "src/App.tsx", "effects={runtimeEffects}", "effects={runtimeEffects}");
      },
      "runtimeEffects must be declared at module scope",
    ],
    [
      "a component-owned scroll listener",
      (root: string) =>
        append(
          root,
          "src/App.tsx",
          '\nwindow.addEventListener("scroll", () => undefined);\n',
        ),
      "scroll and pointer input must use one managed ownership path",
    ],
    [
      "the video surface",
      (root: string) => replace(root, "src/App.tsx", 'type: "video"', 'type: "image"'),
      "missing media/video surface",
    ],
    [
      "the pointer-hover surface",
      (root: string) => replace(root, "src/App.tsx", 'pointer: { hover: true }', ""),
      "missing pointer-hover surface",
    ],
    [
      "the pinned model glow surface",
      (root: string) => replace(root, "src/App.tsx", 'kind: "viselora.modelGlow"', 'kind: "viselora.surfacePulse"'),
      "missing pinned model glow surface",
    ],
    [
      "the image-sequence surface",
      (root: string) => replace(root, "src/App.tsx", 'type: "image-sequence"', 'type: "image"'),
      "missing media/image-sequence surface",
    ],
  ])("rejects a consumer with %s", (_name, mutate, message) => {
    const fixtureRoot = copyTemplate();
    mutate(fixtureRoot);

    const result = runVerifier(fixtureRoot);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(message);
  });
});

function collectFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      files.push(...collectFiles(path));
      continue;
    }
    files.push(relative(skillRoot, path).split(sep).join("/"));
  }
  return files.sort();
}

function read(path: string): string {
  return readFileSync(resolve(skillRoot, path), "utf8");
}

function copyTemplate(): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "viselora-skill-consumer-"));
  fixtureRoots.push(fixtureRoot);
  cpSync(templateRoot, fixtureRoot, { recursive: true });
  return fixtureRoot;
}

function append(root: string, path: string, content: string): void {
  const absolutePath = resolve(root, path);
  writeFileSync(absolutePath, readFileSync(absolutePath, "utf8") + content);
}

function replace(root: string, path: string, search: string, replacement: string): void {
  const absolutePath = resolve(root, path);
  const content = readFileSync(absolutePath, "utf8");
  expect(content).toContain(search);
  writeFileSync(absolutePath, content.replace(search, replacement));
}

function runVerifier(root: string) {
  return spawnSync(process.execPath, [verifierPath, root], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}
