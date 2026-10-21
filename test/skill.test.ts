import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const skillRoot = resolve(repoRoot, "skills/viselora-dom-webgl");
const templateRoot = resolve(skillRoot, "templates/react-vite");
const verifier = resolve(skillRoot, "scripts/verify-consumer.mjs");
const fixtures: string[] = [];

afterEach(() => {
  for (const directory of fixtures.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("React/R3F consumer skill", () => {
  test("routes users to the actual public contract and verification scope", () => {
    const skill = readFileSync(resolve(skillRoot, "SKILL.md"), "utf8");
    const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
    expect(frontmatter).toMatch(/^name: viselora-dom-webgl$/m);
    const description = frontmatter.match(/^description: (.+)$/m)?.[1] ?? "";
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(1024);
    expect(description).toContain("Use when");
    expect(frontmatter).toMatch(/^license: MIT$/m);
    expect(skill).toContain("React 19, R3F 9 and Three.js 0.184–0.186");
    expect(skill).toContain("breaking React/R3F 0.2 alpha API");
    expect(skill).toContain(
      "[release status](https://github.com/agenticnoob/dom-webgl-workspace/blob/main/docs/STATUS.md#release-truth)",
    );
    expect(skill).toContain(
      "Static checks do not establish browser visual correctness",
    );
    for (const match of skill.matchAll(/\]\(((?:references|recipes)\/[^)]+)\)/g)) {
      expect(existsSync(resolve(skillRoot, match[1])), match[1]).toBe(true);
    }
    const metadata = readFileSync(
      resolve(skillRoot, "agents/openai.yaml"),
      "utf8",
    );
    expect(metadata).toContain("$viselora-dom-webgl");
  });

  test("stays self-contained when installed outside this repository", () => {
    const escaping = collectSkillFiles(skillRoot)
      .filter((file) => file.endsWith(".md"))
      .flatMap((file) =>
        [...readFileSync(file, "utf8").matchAll(/\]\(([^)#]+)(?:#[^)]*)?\)/g)]
          .map((match) => match[1])
          .filter((target) => !/^[a-z][a-z0-9+.-]*:/i.test(target))
          .filter((target) => {
            const path = relative(skillRoot, resolve(dirname(file), target));
            return path.startsWith("..") || isAbsolute(path);
          })
          .map((target) => `${relative(skillRoot, file)} -> ${target}`),
      );
    expect(escaping).toEqual([]);
    // Only consumer-facing scripts ship; maintainer scripts live in scripts/.
    expect(readdirSync(resolve(skillRoot, "scripts")).sort()).toEqual([
      "browser-check.mjs",
      "verify-consumer.mjs",
    ]);
  });

  test("states the constraints agents miss in the SKILL.md body", () => {
    // Agents often read only SKILL.md, so these must not live only in references.
    const skill = readFileSync(resolve(skillRoot, "SKILL.md"), "utf8");
    expect(skill).toContain('"@viselora/dom-webgl": "0.2.0-alpha.2"');
    expect(skill).toContain("--save-exact");
    expect(skill).toContain("scripts/verify-consumer.mjs");
    expect(skill).toContain("scripts/browser-check.mjs");
    expect(skill).toContain("npm install --save-dev playwright-core");
    expect(skill).toContain("prefers-reduced-motion: reduce");
    expect(skill).toContain("0.2.0-alpha.0 drew text about half the leading too high");
    expect(skill).toMatch(/`target\.revision`.+mutable/s);
    expect(skill).toContain("half-leading");
    for (const recipe of ["ModelTarget.tsx", "ScrollStory.tsx", "TextWave.tsx"]) {
      expect(skill).toContain(`](recipes/${recipe})`);
    }
  });

  test("ships recipes that satisfy the static consumer contract", () => {
    const root = copyTemplate();
    cpSync(resolve(skillRoot, "recipes"), resolve(root, "src/recipes"), {
      recursive: true,
    });
    const result = run(root);
    expect(result.status, result.stderr).toBe(0);
    const text = readFileSync(resolve(root, "src/recipes/TextWave.tsx"), "utf8");
    expect(text).toContain("target.revision !== revision");
    expect(text).toContain("createDOMTextTexture(target.element)");
    const model = readFileSync(resolve(root, "src/recipes/ModelTarget.tsx"), "utf8");
    expect(model).toContain("runtime.setTargetReady(targetId, true, target)");
    expect(model).toContain("disposeObject");
    expect(model).toContain('matchMedia("(prefers-reduced-motion: reduce)")');
  });

  test("ships a browser check that explains its usage", () => {
    const result = spawnSync(
      process.execPath,
      [resolve(skillRoot, "scripts/browser-check.mjs")],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Missing page URL");
    expect(result.stderr).toContain("--deterministic");
  });

  test("ships a small runnable native scene and explicit semantic DOM", () => {
    const app = readFileSync(resolve(templateRoot, "src/App.tsx"), "utf8");
    expect(app).toContain('from "@react-three/fiber"');
    expect(app).toContain('from "three"');
    expect(app).toContain("<mesh");
    expect(app).toContain("<WebGLTarget");
    expect(app).toContain("<h1>");
    const result = run(templateRoot);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "static consumer contract verification passed",
    );
    expect(result.stdout).toContain("still require runtime verification");
  });

  test("accepts native Three.js materials, geometry, controls and R3F hooks", () => {
    const root = copyTemplate();
    writeSource(
      root,
      `
import { useFrame, useThree } from "@react-three/fiber";
import { Mesh, PlaneGeometry, ShaderMaterial } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
export const visual = new Mesh(new PlaneGeometry(), new ShaderMaterial());
export function Animation() { useThree(); useFrame(() => {}); return null; }
`,
    );
    const result = run(root);
    expect(result.status, result.stderr).toBe(0);
  });

  test.each([
    'import { createDOMTargetRegistry } from "@viselora/dom-webgl/src/lib/domRuntime";',
    'export { createDOMTargetRegistry } from "../../packages/dom-webgl-runtime/src/lib/domRuntime";',
    'const internal = import("@viselora/dom-webgl/internal");',
  ])("rejects a private runtime dependency: %s", (source) => {
    const root = copyTemplate();
    writeSource(root, source);
    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Use a public Viselora entrypoint");
  });

  test.each([
    'import { Canvas as SceneCanvas } from "@react-three/fiber"; export const extra = <SceneCanvas />;',
    'import * as Fiber from "@react-three/fiber"; export const extra = <Fiber.Canvas />;',
    'import { createElement } from "react"; import { Canvas } from "@react-three/fiber"; export const extra = createElement(Canvas);',
  ])("rejects a second Canvas owner: %s", (source) => {
    const root = copyTemplate();
    writeSource(root, source);
    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("WebGLRuntime owns the Canvas");
  });

  test.each([
    'import { WebGLRenderer as Renderer } from "three"; new Renderer();',
    'import * as THREE from "three"; new THREE.WebGLRenderer();',
  ])("rejects a custom renderer: %s", (source) => {
    const root = copyTemplate();
    writeSource(root, source);
    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("do not construct another WebGLRenderer");
  });

  test("rejects a separate R3F root", () => {
    const root = copyTemplate();
    writeSource(
      root,
      'import { createRoot as createScene } from "@react-three/fiber"; createScene(document.createElement("canvas"));',
    );
    const result = run(root);
    expect(result.stderr).toContain("do not create another root");
    expect(result.status).toBe(1);
  });

  test.each([
    ["react", "^18.3.0"],
    ["@react-three/fiber", "^8.18.0"],
    ["three", "^0.170.0"],
    ["three", "^0.187.0"],
    ["@viselora/dom-webgl", "0.1.0-alpha.2"],
  ])("rejects an incompatible %s dependency", (name, version) => {
    const root = copyTemplate();
    const pkg = readJson(root, "package.json");
    pkg.dependencies[name] = version;
    writeJson(root, "package.json", pkg);
    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(name);
  });

  test.each(["^0.185.0", "~0.186.1"])(
    "accepts the supported three %s line",
    (version) => {
      const root = copyTemplate();
      const pkg = readJson(root, "package.json");
      pkg.dependencies.three = version;
      writeJson(root, "package.json", pkg);
      const result = run(root);
      expect(result.status, result.stderr).toBe(0);
    },
  );

  test("accepts reviewed local tarballs without inventing a publication claim", () => {
    const root = copyTemplate();
    const pkg = readJson(root, "package.json");
    pkg.dependencies["@viselora/dom-webgl"] =
      "file:../viselora-dom-webgl-0.2.0-alpha.2.tgz";
    writeJson(root, "package.json", pkg);
    expect(run(root).status).toBe(0);
  });

  test("rejects stale and unknown optional capabilities", () => {
    const root = copyTemplate();
    writeJson(root, "viselora.capabilities.json", {
      schemaVersion: 2,
      compatiblePackageVersion: "0.1.0-alpha.2",
      capabilities: ["removed-facade"],
    });
    const result = run(root);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Capability manifest version must be");
    expect(result.stderr).toContain("Unknown capability: removed-facade");
  });

  test("does not require an artificial capability acknowledgement for a consumer", () => {
    const root = copyTemplate();
    rmSync(resolve(root, "viselora.capabilities.json"));
    expect(run(root).status).toBe(0);
  });
});

function collectSkillFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (entry === "node_modules") return [];
    const path = resolve(directory, entry);
    return statSync(path).isDirectory() ? collectSkillFiles(path) : [path];
  });
}

function copyTemplate(): string {
  const root = mkdtempSync(resolve(tmpdir(), "viselora-consumer-contract-"));
  fixtures.push(root);
  cpSync(templateRoot, root, { recursive: true });
  return root;
}

function writeSource(root: string, source: string) {
  writeFileSync(resolve(root, "src/native-test.tsx"), source);
}

function readJson(
  root: string,
  path: string,
): { dependencies: Record<string, string> } {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function writeJson(root: string, path: string, value: unknown) {
  writeFileSync(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`);
}

function run(root: string) {
  return spawnSync(process.execPath, [verifier, root], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}
