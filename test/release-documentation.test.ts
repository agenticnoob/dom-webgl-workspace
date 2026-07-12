import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const docsRoot = resolve(repoRoot, "docs");
const canonicalState =
  "Capability-stable, release-validation stage. Runtime capabilities are not expanding during the alpha release work; package hardening, public documentation, skill authoring, defect fixes, and external-consumer validation remain active.";

describe("Viselora release documentation", () => {
  test("uses the release-validation decision instead of the freeze record", () => {
    expect(existsSync(resolve(docsRoot, "project-release-validation.md"))).toBe(true);
    expect(existsSync(resolve(docsRoot, "project-freeze.md"))).toBe(false);
    expect(readFileSync(resolve(repoRoot, "README.md"), "utf8")).toContain(
      canonicalState,
    );
    expect(readFileSync(resolve(docsRoot, "STATUS.md"), "utf8")).toContain(
      canonicalState,
    );
  });

  test("keeps active documentation on public Viselora package names", () => {
    const violations = activeMarkdownFiles()
      .map((file) => ({ file, content: readFileSync(file, "utf8") }))
      .flatMap(({ file, content }) =>
        [
          ["@project/dom-webgl", "runtime"].join("-"),
          ["@project/dom-webgl", "scroll-adapters"].join("-"),
          "feature-frozen reference project",
          "new R3F-based project",
          "separate R3F-based project",
        ]
          .filter((term) => content.includes(term))
          .map((term) => `${display(file)}: ${term}`),
      );

    expect(violations).toEqual([]);
  });

  test("documents npm-first package and skill usage", () => {
    const onboarding = read("agent/package-onboarding.md");
    const usage = read("agent/package-usage.md");
    const consumer = read("consumer-standard-usage.md");

    for (const content of [onboarding, usage, consumer]) {
      expect(content).toContain("@viselora/dom-webgl");
      expect(content).toContain("@viselora/scroll-adapters");
    }
    expect(onboarding).toContain("npm install @viselora/dom-webgl@alpha");
    expect(onboarding).toContain("skills/viselora-dom-webgl");
  });

  test("documents the general skill, selected verification, and status truth", () => {
    const rootReadme = readFileSync(resolve(repoRoot, "README.md"), "utf8");
    const docsIndex = read("README.md");
    const status = read("STATUS.md");
    const release = read("project-release-validation.md");
    const consumer = read("consumer-standard-usage.md");
    const onboarding = read("agent/package-onboarding.md");
    const combined = [rootReadme, docsIndex, status, release, consumer, onboarding].join("\n");

    expect(combined).toContain("general brief-to-browser development skill");
    expect(combined).toContain("skills/viselora-dom-webgl/references/capability-status.md");
    expect(combined).toContain("skills/viselora-dom-webgl/references/api-surface.generated.md");
    expect(combined).toContain("selected-capability verification");
    expect(combined).toContain("does not prove real-browser");
    expect(combined).toContain("not all public APIs are externally verified");
  });

  test("documents the alpha.1 recovery candidate without claiming publication", () => {
    const rootReadme = readFileSync(resolve(repoRoot, "README.md"), "utf8");
    const runtimeReadme = readFileSync(
      resolve(repoRoot, "packages/dom-webgl-runtime/README.md"),
      "utf8",
    );
    const adaptersReadme = readFileSync(
      resolve(repoRoot, "packages/dom-webgl-scroll-adapters/README.md"),
      "utf8",
    );
    const status = read("STATUS.md");
    const release = read("project-release-validation.md");
    const combined = [rootReadme, runtimeReadme, adaptersReadme, status, release].join("\n");
    const scripts = JSON.parse(
      readFileSync(resolve(repoRoot, "package.json"), "utf8"),
    ).scripts;

    expect(combined).toContain("0.1.0-alpha.1");
    expect(combined).toContain("cross-entrypoint");
    expect(combined).toContain(
      'Effect "<kind>" is not a scene-object effect.',
    );
    expect(combined).toContain("local tarball browser verified");
    expect(combined).toContain("registry publication pending");
    expect(combined).toContain("downstream consumer verification pending");
    expect(scripts["verify:release"]).toContain("verify:consumer");
  });

  test("keeps the formal MVP as a later isolated package-plus-skill repository", () => {
    const background = read("new-project/example-page-background.md");
    const mvp = read("new-project/example-page-mvp.md");
    const combined = `${background}\n${mvp}`;

    expect(combined).toContain("@viselora/dom-webgl@alpha");
    expect(combined).toContain("@viselora/scroll-adapters@alpha");
    expect(combined).toContain("viselora-dom-webgl");
    expect(combined).toContain("separate repository");
    expect(combined).toContain("surface pulse");
    expect(combined).toContain("video background texture");
    expect(combined).toContain("image hover overlay");
    expect(combined).toContain("pinned model animation with emissive glow");
    expect(combined).toContain("scroll-controlled image sequence");
    expect(combined).toContain("This repository does not create the formal MVP");
  });
});

function activeMarkdownFiles(): string[] {
  return [resolve(repoRoot, "README.md"), ...collectMarkdown(docsRoot)].filter(
    (file) =>
      !file.includes(`${sep}archive${sep}`) &&
      !file.includes(`${sep}superpowers${sep}plans${sep}`) &&
      !file.includes(`${sep}superpowers${sep}specs${sep}`),
  );
}

function collectMarkdown(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) return collectMarkdown(path);
    return path.endsWith(".md") ? [path] : [];
  });
}

function read(path: string): string {
  return readFileSync(resolve(docsRoot, path), "utf8");
}

function display(file: string): string {
  return relative(repoRoot, file).split(sep).join("/");
}
