import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
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
  "references/api-coverage.json",
  "references/api-effects-rendering.md",
  "references/api-lifecycle-debug.md",
  "references/api-scenes-models.md",
  "references/api-scroll-interaction.md",
  "references/api-surface.generated.md",
  "references/architecture-rules.md",
  "references/asset-pipeline.md",
  "references/capability-status.md",
  "references/effect-recipes.md",
  "references/narrative-design.md",
  "references/public-api.md",
  "references/quickstart.md",
  "references/troubleshooting.md",
  "references/verification.md",
  "scripts/check-api-coverage.mjs",
  "scripts/generate-api-surface.mjs",
  "scripts/verify-consumer.mjs",
  "templates/asset-manifest.json",
  "templates/effects/image-hover-overlay.ts",
  "templates/effects/pinned-model-glow.tsx",
  "templates/effects/scroll-image-sequence.tsx",
  "templates/effects/surface-pulse.ts",
  "templates/effects/video-background-texture.ts",
  "templates/react-vite/asset-manifest.json",
  "templates/react-vite/index.html",
  "templates/react-vite/package.json",
  "templates/react-vite/public/media/product-source.svg",
  "templates/react-vite/src/App.tsx",
  "templates/react-vite/src/effects.ts",
  "templates/react-vite/src/main.tsx",
  "templates/react-vite/src/styles.css",
  "templates/react-vite/story-plan.md",
  "templates/react-vite/tsconfig.json",
  "templates/react-vite/viselora.capabilities.json",
  "templates/story-plan.md",
] as const;

afterEach(() => {
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    rmSync(fixtureRoot, { force: true, recursive: true });
  }
});

describe("viselora-dom-webgl skill", () => {
  test("contains exactly the general development skill deliverables", () => {
    expect(collectFiles(skillRoot)).toEqual(requiredFiles);
  });

  test("keeps SKILL.md concise and routes every reference directly", () => {
    const skill = read("SKILL.md");
    const references = requiredFiles.filter((file) => file.startsWith("references/"));

    expect(skill.match(/Compatible package version: 0\.1\.0-alpha\.1/g)).toHaveLength(1);
    expect(skill).not.toContain("## Export inventory");
    expect(skill.split("\n").length).toBeLessThanOrEqual(123);
    for (const reference of references) {
      expect(skill).toContain(`](${reference})`);
    }
    for (const match of skill.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      expect(existsSync(resolve(skillRoot, match[1])), match[1]).toBe(true);
    }
  });

  test("uses minimal skill frontmatter and general-development metadata", () => {
    const skill = read("SKILL.md");
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1];

    expect(frontmatter?.split("\n").map((line) => line.split(":", 1)[0])).toEqual([
      "name",
      "description",
    ]);
    expect(frontmatter).toContain("name: viselora-dom-webgl");
    expect(frontmatter).toMatch(/narrative|story/i);
    expect(frontmatter).toMatch(/existing|enhance/i);
    expect(frontmatter).toMatch(/API|capabilit/i);
    expect(frontmatter).toMatch(/interaction/i);
    expect(frontmatter).toMatch(/asset/i);
    expect(frontmatter).toMatch(/debug/i);
    expect(frontmatter).toMatch(/verif/i);

    expect(read("agents/openai.yaml")).toBe(
      [
        "interface:",
        '  display_name: "Viselora Development"',
        '  short_description: "Build verified scroll narratives with public Viselora packages"',
        '  default_prompt: "Use $viselora-dom-webgl to turn my brief into a DOM-first scroll narrative with local licensed assets, selected public capabilities, and browser-backed verification."',
        "",
      ].join("\n"),
    );
  });

  test("uses only public package entrypoints and excludes R3F", () => {
    const content = collectFiles(skillRoot)
      .filter((file) => /\.(?:md|json|mjs|tsx?|yaml)$/.test(file))
      .map((file) => read(file))
      .join("\n");

    expect(content).not.toMatch(/from\s+["']@project\//);
    expect(content).not.toMatch(/(?:from\s+|import\s+)["'][^"']*packages\/dom-webgl-runtime\/src/);
    expect(content).not.toMatch(/from\s+["']@react-three\/fiber["']/);
  });

  test("defines the narrative brief, directions, beats, and review gates", () => {
    const narrative = read("references/narrative-design.md");
    const storyPlan = read("templates/story-plan.md");
    const content = `${narrative}\n${storyPlan}`;

    for (const term of [
      "audience",
      "core message",
      "desired outcome",
      "tone",
      "page length",
      "interaction density",
      "existing assets",
      "accessibility",
      "mobile",
      "performance",
      "reduced motion",
      "2–3",
      "recommend",
      "4–8",
      "chronology",
      "journey",
      "problem-to-solution",
      "layered product reveal",
      "state transformation",
      "comparison",
      "spatial exploration",
    ]) {
      expect(content.toLowerCase()).toContain(term.toLowerCase());
    }
    for (const field of [
      "Beat id",
      "Message advance",
      "Semantic DOM/fallback",
      "Entrance",
      "Active",
      "Exit",
      "Scroll owner/range",
      "Primary interaction",
      "Capability id/status",
      "Asset ids",
      "Direct assertion",
    ]) {
      expect(storyPlan).toContain(field);
    }
  });

  test("defines a local license-aware asset contract", () => {
    const guidance = read("references/asset-pipeline.md");
    const manifest = readJson(skillRoot, "templates/asset-manifest.json");
    const asset = manifest.assets[0];

    expect(guidance).toContain("no production hotlink");
    for (const field of [
      "localPath",
      "storyBeatIds",
      "purpose",
      "source",
      "author",
      "license",
      "deploymentRights",
      "modifications",
      "metadata",
      "fallback",
      "alt",
    ]) {
      expect(JSON.stringify(asset)).toContain(field);
    }
  });

  test("keeps every API reference on the shared capability contract", () => {
    for (const path of [
      "references/api-effects-rendering.md",
      "references/api-scenes-models.md",
      "references/api-scroll-interaction.md",
      "references/api-lifecycle-debug.md",
    ]) {
      const content = read(path);
      expect(content, path).toContain("## Contents");
      expect(content, path).toContain("Compatible package version: 0.1.0-alpha.1");
      expect(content, path).toContain("Public entrypoint");
      expect(content, path).toContain("When to use");
      expect(content, path).toContain("Declaration/props shape");
      expect(content, path).toContain("Ownership and stability");
      expect(content, path).toContain("Fallback and lifecycle");
      expect(content, path).toContain("Version limitations");
      expect(content, path).toMatch(/from "@viselora\//);
      expect(content, path).toContain("Direct verification");
    }
  });

  test("documents four entrypoints, generated discovery, statuses, and React type floor", () => {
    const publicApi = read("references/public-api.md");
    const quickstart = read("references/quickstart.md");
    for (const entrypoint of [
      "@viselora/dom-webgl",
      "@viselora/dom-webgl/react",
      "@viselora/scroll-adapters",
      "@viselora/scroll-adapters/react",
    ]) {
      expect(publicApi).toContain(entrypoint);
    }
    expect(publicApi).toContain("api-surface.generated.md");
    expect(publicApi).toContain("capability-status.md");
    expect(publicApi).toContain("not recommendation evidence");
    expect(quickstart).toContain("@types/react >=19.2.0");
    expect(quickstart).toContain("skipLibCheck: false");
  });

  test("samples the image source explicitly through the verified hover path", () => {
    for (const path of [
      "templates/effects/image-hover-overlay.ts",
      "templates/react-vite/src/effects.ts",
    ]) {
      const content = read(path);
      expect(content).toContain("uniform sampler2D uSourceTexture");
      expect(content).toContain("texture2D(uSourceTexture, vUv)");
      expect(content).toContain('sourceTextureUniform: "uSourceTexture"');
      expect(content).toContain('mode: "replace-source"');
      expect(content).toContain("ctx.targetPointer.isInside");
      expect(content).toContain("ctx.resources.addDisposable");
    }
  });

  test("keeps blocked and experimental effects out of the default template", () => {
    const app = read("templates/react-vite/src/App.tsx");
    const effects = read("templates/react-vite/src/effects.ts");
    const manifest = readJson(skillRoot, "templates/react-vite/viselora.capabilities.json");
    const combined = `${app}\n${effects}`;

    expect(combined).not.toContain("surfacePulseEffect");
    expect(combined).not.toContain("modelGlowEffect");
    expect(combined).not.toContain("imageSequenceEffect");
    expect(manifest.capabilities.map((entry: { id: string }) => entry.id)).toEqual([
      "managed-image-hover",
      "shared-scroll-progress",
      "single-runtime-canvas",
      "resource-fallback-lifecycle",
      "reduced-motion-signaling",
    ]);
  });

  test("labels every optional recipe with status-aware implementation metadata", () => {
    const recipes = read("references/effect-recipes.md");
    for (const heading of [
      "Surface pulse",
      "Video background texture",
      "Image hover overlay",
      "Pinned model glow",
      "Scroll image sequence",
    ]) {
      const start = recipes.indexOf(`## ${heading}`);
      expect(start, heading).toBeGreaterThan(-1);
      const end = recipes.indexOf("\n## ", start + 4);
      const section = recipes.slice(start, end < 0 ? undefined : end);
      for (const field of [
        "Compatible version",
        "Status",
        "Required exports",
        "Assets and fallback",
        "Ownership",
        "Mobile and reduced motion",
        "Required evidence",
        "Limitations",
      ]) {
        expect(section, `${heading}: ${field}`).toContain(field);
      }
    }
  });

  test("routes architecture, failure classification, and completion evidence honestly", () => {
    const architecture = read("references/architecture-rules.md");
    const troubleshooting = read("references/troubleshooting.md");
    const verification = read("references/verification.md");

    for (const term of [
      "one runtime",
      "one canvas",
      "one scroll source",
      "one pointer source",
      "module scope",
      "stable",
      "semantic DOM",
      "fallback",
      "no production hotlink",
    ]) {
      expect(architecture.toLowerCase()).toContain(term.toLowerCase());
    }
    for (const category of [
      "API/type failures",
      "Asset failures",
      "Lifecycle failures",
      "Visible-output failures",
      "Package-defect candidates",
    ]) {
      expect(troubleshooting).toContain(category);
    }
    expect(troubleshooting).toContain("minimal public-boundary reproduction");
    expect(verification).toContain("Skill integrity");
    expect(verification).toContain("Selected consumer checks");
    expect(verification).toContain("Real-browser evidence");
    expect(verification).toContain("Narrative review");
    expect(verification).toContain("does not prove real-browser");
  });

  test("requires experimental public-boundary preflight before implementation", () => {
    const skill = read("SKILL.md");
    const status = read("references/capability-status.md");
    const architecture = read("references/architecture-rules.md");
    const scroll = read("references/api-scroll-interaction.md");
    const lifecycle = read("references/api-lifecycle-debug.md");
    const troubleshooting = read("references/troubleshooting.md");
    const verification = read("references/verification.md");

    expect(skill).toContain("experimental public-boundary preflight");
    expect(skill.indexOf("experimental public-boundary preflight")).toBeLessThan(
      skill.indexOf("Implement with one page-level runtime"),
    );
    expect(status).toContain("scene-object-effect-registration");
    expect(status).toContain("0.1.0-alpha.0");
    expect(status).toContain("blocked");
    expect(status).toContain("0.1.0-alpha.1");
    expect(status).toMatch(/scene-object-interaction \| experimental/);
    expect(status).toMatch(/advanced-effect-facades \| experimental/);
    expect(architecture).toContain("Canvas z-index 0");
    expect(architecture).toContain("content z-index 1");
    expect(architecture).toContain("opaque overlay");
    expect(scroll).toContain("smooth={false}");
    expect(scroll).toContain("ScrollTrigger={ScrollTrigger}");
    expect(lifecycle).toContain("resourceStatus");
    expect(lifecycle).toContain("attached");
    expect(lifecycle).toContain("final pixels");
    expect(troubleshooting).toContain(
      'Effect "<kind>" is not a scene-object effect.',
    );
    expect(troubleshooting).toContain("ready != attached");
    expect(verification).toContain(
      "Real-browser evidence was not executed by this verifier.",
    );
  });

  test("rejects experimental capability checks without browser preflight evidence", () => {
    const fixtureRoot = copyTemplate({ installTypeScript: false });
    selectCapabilities(fixtureRoot, [
      {
        id: "image-sequence",
        acknowledgement: "experimental",
        checks: [
          "final-canvas-pixel-change",
          "first-frame-fallback",
          "bounded-cache",
          "forward-reverse-scroll",
        ],
      },
    ]);
    installImageSequenceFixture(fixtureRoot);

    const result = runVerifier(fixtureRoot);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("preflight");
  });

  test("accepts a verified subset without unrelated recipes", () => {
    const fixtureRoot = copyTemplate();
    const result = runVerifier(fixtureRoot);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain(
      "Viselora static consumer contract verification passed.",
    );
    expect(result.stdout).toContain(
      "Real-browser evidence was not executed by this verifier.",
    );
  });

  test("accepts an acknowledged experimental image sequence without requiring video or model", () => {
    const fixtureRoot = copyTemplate();
    selectCapabilities(fixtureRoot, [
      {
        id: "image-sequence",
        acknowledgement: "experimental",
        preflight: {
          status: "browser-passed",
          evidence: "docs/evidence/image-sequence.json",
        },
        checks: [
          "final-canvas-pixel-change",
          "first-frame-fallback",
          "bounded-cache",
          "forward-reverse-scroll",
        ],
      },
    ]);
    installImageSequenceFixture(fixtureRoot);
    writeBrowserEvidence(fixtureRoot, "image-sequence");

    const result = runVerifier(fixtureRoot);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
  });

  test("rejects invalid experimental preflight evidence fields", () => {
    const fixtureRoot = copyTemplate({ installTypeScript: false });
    selectCapabilities(fixtureRoot, [
      {
        id: "image-sequence",
        acknowledgement: "experimental",
        preflight: {
          status: "browser-passed",
          evidence: "docs/evidence/image-sequence.json",
        },
        checks: [
          "final-canvas-pixel-change",
          "first-frame-fallback",
          "bounded-cache",
          "forward-reverse-scroll",
        ],
      },
    ]);
    installImageSequenceFixture(fixtureRoot);
    mkdirSync(resolve(fixtureRoot, "docs/evidence"), { recursive: true });
    writeJson(fixtureRoot, "docs/evidence/image-sequence.json", {
      packageVersion: "0.1.0-alpha.9",
      capabilityId: "wrong",
      passed: false,
      consoleErrors: ["boom"],
      pageErrors: ["boom"],
      measurements: {},
    });

    const result = runVerifier(fixtureRoot);
    expect(result.status).not.toBe(0);
    for (const field of [
      "packageVersion",
      "capabilityId",
      "passed",
      "consoleErrors",
      "pageErrors",
      "measurement",
    ]) {
      expect(result.stderr).toContain(field);
    }
  });

  test.each([
    [
      "a missing capability manifest",
      (root: string) => rmSync(resolve(root, "viselora.capabilities.json")),
      "viselora.capabilities.json",
    ],
    [
      "an unknown capability id",
      (root: string) => selectCapabilities(root, [{ id: "unknown-capability", checks: [] }]),
      "unknown capability",
    ],
    [
      "a compatible-version mismatch",
      (root: string) => {
        const manifest = readJson(root, "viselora.capabilities.json");
        manifest.compatiblePackageVersion = "0.1.0-alpha.9";
        writeJson(root, "viselora.capabilities.json", manifest);
      },
      "compatiblePackageVersion",
    ],
    [
      "an empty capability list",
      (root: string) => selectCapabilities(root, []),
      "non-empty capabilities",
    ],
    [
      "an unacknowledged experimental capability",
      (root: string) => selectCapabilities(root, [{ id: "image-sequence", checks: [] }]),
      "acknowledgement",
    ],
    [
      "a blocked capability in consumer mode",
      (root: string) => selectCapabilities(root, [{ id: "surface-pulse-visible-output", acknowledgement: "blocked-defect-reproduction", checks: [] }]),
      "blocked",
    ],
    [
      "a blocked capability without entry acknowledgement",
      (root: string) => selectCapabilities(root, [{ id: "surface-pulse-visible-output", checks: [] }], "retained-defect-reproduction"),
      "blocked-defect-reproduction",
    ],
    [
      "a selected capability missing a required check",
      (root: string) => selectCapabilities(root, [{ id: "managed-image-hover", checks: ["final-canvas-pixel-change"] }]),
      "touch-or-scroll-alternative",
    ],
    [
      "an unknown check name",
      (root: string) => selectCapabilities(root, [{ id: "managed-image-hover", checks: ["final-canvas-pixel-change", "touch-or-scroll-alternative", "loading-error-fallback", "made-up-check"] }]),
      "unknown check",
    ],
    [
      "selected local media without an asset record",
      (root: string) => writeJson(root, "asset-manifest.json", { schemaVersion: 1, assets: [] }),
      "asset record",
    ],
    [
      "a hotlinked production asset",
      (root: string) => {
        const assets = readJson(root, "asset-manifest.json");
        assets.assets[0].localPath = "https://example.com/product.svg";
        writeJson(root, "asset-manifest.json", assets);
      },
      "localPath",
    ],
    [
      "a private Viselora import",
      (root: string) => append(root, "src/App.tsx", '\nimport "@viselora/dom-webgl/private";\n'),
      "non-public Viselora import",
    ],
    [
      "a direct Three renderer",
      (root: string) => append(root, "src/App.tsx", "\nnew WebGLRenderer();\n"),
      "direct WebGLRenderer construction is prohibited",
    ],
    [
      "an R3F import",
      (root: string) => append(root, "src/App.tsx", '\nimport { Canvas } from "@react-three/fiber";\n'),
      "React Three Fiber is prohibited",
    ],
    [
      "a second runtime",
      (root: string) => append(root, "src/App.tsx", "\nconst duplicateRoot = <WebGLScrollRuntime />;\n"),
      "exactly one runtime root",
    ],
    [
      "an unstable effect array",
      (root: string) => replace(root, "src/App.tsx", "effects={runtimeEffects}", "effects={[...runtimeEffects]}"),
      "stable module-scope array",
    ],
    [
      "an inline target declaration",
      (root: string) => replace(root, "src/App.tsx", "webgl={imageDeclaration}", "webgl={{ ...imageDeclaration }}"),
      "target declarations must be stable",
    ],
    [
      "a consumer render loop",
      (root: string) => append(root, "src/App.tsx", "\nrequestAnimationFrame(() => undefined);\n"),
      "consumer render loops are prohibited",
    ],
    [
      "an unmanaged scroll source",
      (root: string) => append(root, "src/App.tsx", '\nwindow.addEventListener("scroll", () => undefined);\n'),
      "managed ownership path",
    ],
    [
      "an unmanaged pointer source",
      (root: string) => append(root, "src/App.tsx", '\nwindow.addEventListener("pointermove", () => undefined);\n'),
      "managed ownership path",
    ],
    [
      "missing selected capability implementation evidence",
      (root: string) => replace(root, "src/effects.ts", 'mode: "replace-source"', 'mode: "overlay"'),
      "managed-image-hover",
    ],
  ])("rejects a consumer with %s", (_name, mutate, message) => {
    const fixtureRoot = copyTemplate();
    mutate(fixtureRoot);

    const result = runVerifier(fixtureRoot);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(message);
  });
});

export function readJson(root: string, path: string): Record<string, any> {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

export function writeJson(root: string, path: string, value: unknown): void {
  writeFileSync(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`);
}

export function selectCapabilities(
  root: string,
  entries: readonly Record<string, unknown>[],
  mode = "consumer",
): void {
  writeJson(root, "viselora.capabilities.json", {
    schemaVersion: 1,
    compatiblePackageVersion: "0.1.0-alpha.1",
    mode,
    assetManifest: "./asset-manifest.json",
    capabilities: entries,
  });
}

export function runScript(path: string, args: readonly string[]) {
  return spawnSync(process.execPath, [path, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function collectFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) {
      files.push(...collectFiles(path));
    } else {
      files.push(relative(skillRoot, path).split(sep).join("/"));
    }
  }
  return files.sort();
}

function read(path: string): string {
  return readFileSync(resolve(skillRoot, path), "utf8");
}

function copyTemplate(options: { installTypeScript?: boolean } = {}): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "viselora-skill-consumer-"));
  fixtureRoots.push(fixtureRoot);
  cpSync(templateRoot, fixtureRoot, { recursive: true });
  installSelectedCapabilityFixture(fixtureRoot);
  if (options.installTypeScript !== false) {
    const nodeModules = resolve(fixtureRoot, "node_modules");
    mkdirSync(nodeModules, { recursive: true });
    symlinkSync(resolve(repoRoot, "node_modules/typescript"), resolve(nodeModules, "typescript"), "dir");
  }
  return fixtureRoot;
}

function installSelectedCapabilityFixture(root: string): void {
  selectCapabilities(root, [
    {
      id: "managed-image-hover",
      checks: [
        "final-canvas-pixel-change",
        "touch-or-scroll-alternative",
        "loading-error-fallback",
      ],
    },
  ]);
  cpSync(
    resolve(skillRoot, "templates/asset-manifest.json"),
    resolve(root, "asset-manifest.json"),
  );

  const effectsPath = resolve(root, "src/effects.ts");
  let effects = readFileSync(effectsPath, "utf8");
  if (effects.includes('mode: "overlay"')) {
    effects = effects
      .replace(
        "  uniform float uHover;",
        "  uniform sampler2D uSourceTexture;\n  uniform float uHover;",
      )
      .replace(
        "    gl_FragColor = vec4(0.49, 0.83, 0.98, uHover * edge * 0.5);",
        "    vec4 source = texture2D(uSourceTexture, vUv);\n    gl_FragColor = vec4(mix(source.rgb, vec3(0.49, 0.83, 0.98), uHover * edge * 0.35), source.a);",
      )
      .replace('mode: "overlay"', 'mode: "replace-source"')
      .replace(
        "        program: { fragmentShader: hoverFragmentShader, uniforms: { uHover: 0 } },",
        "        sourceTextureUniform: \"uSourceTexture\",\n        program: { fragmentShader: hoverFragmentShader, uniforms: { uHover: 0 } },",
      );
    writeFileSync(effectsPath, effects);
  }
}

function installImageSequenceFixture(root: string): void {
  writeFileSync(
    resolve(root, "src/image-sequence.tsx"),
    [
      'import { defineWebGLEffect, type WebGLDeclaration } from "@viselora/dom-webgl";',
      'import { WebGLTarget } from "@viselora/dom-webgl/react";',
      'import { WebGLScrollTimeline } from "@viselora/scroll-adapters/react";',
      'import { ScrollTrigger } from "gsap/ScrollTrigger";',
      'const progressKey = "sequence-progress";',
      'const frames = [{ src: "/media/sequence/frame-01.webp" }];',
      'export const imageSequenceEffect = defineWebGLEffect({ kind: "story.imageSequence", source: "media/image-sequence", update(ctx) { ctx.object.texture?.setTransform({ offsetX: ctx.progress.get(progressKey) }); } });',
      'const declaration = { key: "story.sequence", source: { kind: "media", type: "image-sequence", frameCount: frames.length, frames, progressKey: "sequence-progress" }, lifecycle: { hideWhenReady: true, hideMode: "self", offscreen: { strategy: "restore-dom" } }, effects: [{ kind: "story.imageSequence" }] } satisfies WebGLDeclaration;',
      'export const sequenceEvidence = <WebGLScrollTimeline id="sequence-progress" ScrollTrigger={ScrollTrigger}><WebGLTarget webgl={declaration}><img src="/media/sequence/frame-01.webp" alt="Sequence first frame" /></WebGLTarget></WebGLScrollTimeline>;',
      "",
    ].join("\n"),
  );
  const assets = readJson(root, "asset-manifest.json");
  assets.assets.push({
    id: "story-sequence",
    kind: "image-sequence",
    localPath: "public/media/sequence",
    storyBeatIds: ["beat-02"],
    purpose: "Experimental sequence validation",
    source: { url: "generated-locally", author: "Fixture", license: "CC0-1.0", deploymentRights: "public-deployment-approved" },
    modifications: [],
    metadata: { frameCount: 1, pattern: "frame-%02d.webp", startFrame: 1, progressRange: [0, 1], firstFrame: "public/media/sequence/frame-01.webp", cacheBudget: 4 },
    fallback: { kind: "first-frame", localPath: "public/media/sequence/frame-01.webp" },
    alt: "Sequence first frame",
  });
  writeJson(root, "asset-manifest.json", assets);
}

function append(root: string, path: string, content: string): void {
  const absolutePath = resolve(root, path);
  writeFileSync(absolutePath, readFileSync(absolutePath, "utf8") + content);
}

function writeBrowserEvidence(root: string, capabilityId: string): void {
  mkdirSync(resolve(root, "docs/evidence"), { recursive: true });
  writeJson(root, `docs/evidence/${capabilityId}.json`, {
    packageVersion: "0.1.0-alpha.1",
    capabilityId,
    passed: true,
    consoleErrors: [],
    pageErrors: [],
    measurements: { changedPixels: 120 },
  });
}

function replace(root: string, path: string, search: string, replacement: string): void {
  const absolutePath = resolve(root, path);
  const content = readFileSync(absolutePath, "utf8");
  expect(content).toContain(search);
  writeFileSync(absolutePath, content.replace(search, replacement));
}

function runVerifier(root: string) {
  return runScript(verifierPath, [root]);
}
