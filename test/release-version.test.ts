import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const cliPath = resolve(repoRoot, "scripts/set-release-version.mjs");
const fixtureRoots: string[] = [];

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("release version management", () => {
  test("accepts a complete lockstep alpha state", () => {
    const root = createFixture("0.1.0-alpha.0");

    const result = runCli(root, "--check");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Release versions OK: 0.1.0-alpha.0");
    expect(result.stderr).toBe("");
  });

  test("rejects every mismatched release surface", () => {
    const mutations: Array<[string, (root: string) => void]> = [
      ["runtime", (root) => setJson(root, "packages/dom-webgl-runtime/package.json", ["version"], "0.1.0-alpha.1")],
      ["adapters", (root) => setJson(root, "packages/dom-webgl-scroll-adapters/package.json", ["version"], "0.1.0-alpha.1")],
      ["dependency", (root) => setJson(root, "packages/dom-webgl-scroll-adapters/package.json", ["dependencies", "@viselora/dom-webgl"], "0.1.0-alpha.1")],
      ["skill", (root) => replace(root, "skills/viselora-dom-webgl/SKILL.md", "0.1.0-alpha.0", "0.1.0-alpha.1")],
      ["lockfile", (root) => setJson(root, "package-lock.json", ["packages", "packages/dom-webgl-runtime", "version"], "0.1.0-alpha.1")],
    ];

    for (const [name, mutate] of mutations) {
      const root = createFixture("0.1.0-alpha.0");
      mutate(root);
      const result = runCli(root, "--check");
      expect(result.status, name).not.toBe(0);
      expect(result.stderr, name).toContain("Release version mismatch");
    }
  });

  test("updates both packages, the exact dependency, skill, app, and lockfile", () => {
    const root = createFixture("0.1.0-alpha.0");

    const result = runCli(root, "0.1.0-alpha.3");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Release version set: 0.1.0-alpha.3");
    expect(readVersionState(root)).toEqual({
      runtime: "0.1.0-alpha.3",
      adapters: "0.1.0-alpha.3",
      dependency: "0.1.0-alpha.3",
      skill: "0.1.0-alpha.3",
      lockRuntime: "0.1.0-alpha.3",
      lockAdapters: "0.1.0-alpha.3",
      lockDependency: "0.1.0-alpha.3",
      lockAppRuntime: "0.1.0-alpha.3",
      lockAppAdapters: "0.1.0-alpha.3",
    });
  });

  test.each(["1.0.0", "0.1.0-beta.0", "v0.1.0-alpha.0", "0.1-alpha.0"])(
    "rejects invalid alpha version %s without changing files",
    (version) => {
      const root = createFixture("0.1.0-alpha.0");
      const before = snapshot(root);

      const result = runCli(root, version);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("Expected <major>.<minor>.<patch>-alpha.<number>");
      expect(snapshot(root)).toEqual(before);
    },
  );

  test("does not partially write when the next state cannot be prepared", () => {
    const root = createFixture("0.1.0-alpha.0");
    writeFileSync(resolve(root, "package-lock.json"), "{ malformed\n");
    const before = snapshot(root);

    const result = runCli(root, "0.1.0-alpha.4");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("package-lock.json");
    expect(snapshot(root)).toEqual(before);
  });
});

function createFixture(version: string): string {
  const root = mkdtempSync(join(tmpdir(), "viselora-release-version-"));
  fixtureRoots.push(root);
  mkdirSync(resolve(root, "packages/dom-webgl-runtime"), { recursive: true });
  mkdirSync(resolve(root, "packages/dom-webgl-scroll-adapters"), { recursive: true });
  mkdirSync(resolve(root, "skills/viselora-dom-webgl"), { recursive: true });
  writeJson(root, "packages/dom-webgl-runtime/package.json", {
    name: "@viselora/dom-webgl",
    version,
  });
  writeJson(root, "packages/dom-webgl-scroll-adapters/package.json", {
    name: "@viselora/scroll-adapters",
    version,
    dependencies: { "@viselora/dom-webgl": version },
  });
  writeFileSync(
    resolve(root, "skills/viselora-dom-webgl/SKILL.md"),
    `---\nname: viselora-dom-webgl\ndescription: Fixture.\n---\n\nCompatible package version: ${version}\n`,
  );
  writeJson(root, "package-lock.json", {
    name: "fixture",
    lockfileVersion: 3,
    packages: {
      "apps/example": {
        name: "@viselora/example",
        dependencies: {
          "@viselora/dom-webgl": version,
          "@viselora/scroll-adapters": version,
        },
      },
      "packages/dom-webgl-runtime": {
        name: "@viselora/dom-webgl",
        version,
      },
      "packages/dom-webgl-scroll-adapters": {
        name: "@viselora/scroll-adapters",
        version,
        dependencies: { "@viselora/dom-webgl": version },
      },
      "node_modules/@viselora/dom-webgl": {
        resolved: "packages/dom-webgl-runtime",
        link: true,
      },
      "node_modules/@viselora/scroll-adapters": {
        resolved: "packages/dom-webgl-scroll-adapters",
        link: true,
      },
    },
  });
  return root;
}

function runCli(root: string, argument: string) {
  return spawnSync(process.execPath, [cliPath, argument], {
    cwd: root,
    encoding: "utf8",
  });
}

function readVersionState(root: string) {
  const runtime = readJson(root, "packages/dom-webgl-runtime/package.json");
  const adapters = readJson(root, "packages/dom-webgl-scroll-adapters/package.json");
  const lock = readJson(root, "package-lock.json");
  const skill = readFileSync(resolve(root, "skills/viselora-dom-webgl/SKILL.md"), "utf8")
    .match(/Compatible package version:\s*(\S+)/)?.[1];
  return {
    runtime: runtime.version,
    adapters: adapters.version,
    dependency: adapters.dependencies["@viselora/dom-webgl"],
    skill,
    lockRuntime: lock.packages["packages/dom-webgl-runtime"].version,
    lockAdapters: lock.packages["packages/dom-webgl-scroll-adapters"].version,
    lockDependency:
      lock.packages["packages/dom-webgl-scroll-adapters"].dependencies[
        "@viselora/dom-webgl"
      ],
    lockAppRuntime:
      lock.packages["apps/example"].dependencies["@viselora/dom-webgl"],
    lockAppAdapters:
      lock.packages["apps/example"].dependencies["@viselora/scroll-adapters"],
  };
}

function snapshot(root: string): Record<string, string> {
  return Object.fromEntries(
    [
      "packages/dom-webgl-runtime/package.json",
      "packages/dom-webgl-scroll-adapters/package.json",
      "skills/viselora-dom-webgl/SKILL.md",
      "package-lock.json",
    ].map((path) => [path, readFileSync(resolve(root, path), "utf8")]),
  );
}

function readJson(root: string, path: string): any {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

function writeJson(root: string, path: string, value: unknown): void {
  writeFileSync(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`);
}

function setJson(root: string, path: string, keys: string[], value: string): void {
  const json = readJson(root, path);
  let cursor = json;
  for (const key of keys.slice(0, -1)) cursor = cursor[key];
  cursor[keys.at(-1)!] = value;
  writeJson(root, path, json);
}

function replace(root: string, path: string, search: string, replacement: string): void {
  const absolute = resolve(root, path);
  const content = readFileSync(absolute, "utf8");
  writeFileSync(absolute, content.replace(search, replacement));
}
