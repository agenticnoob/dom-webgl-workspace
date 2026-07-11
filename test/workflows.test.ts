import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

const root = process.cwd();

describe("Viselora GitHub workflows", () => {
  test("verify workflow runs the complete release-validation chain", () => {
    const workflow = readWorkflow("verify.yml");

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("node-version: 24");
    expect(workflow).toContain("npm@11");
    expect(workflow).toContain("npm ci");
    expectInOrder(workflow, [
      "npm run typecheck",
      "npm run test -- --run",
      "npm run build",
      "npm run check:imports",
      "npm run verify:versions",
      "npm run verify:tarballs",
      "npm run verify:consumer",
      "npm run verify:skill",
      "git diff --check",
    ]);
  });

  test("release workflow is manual, protected, OIDC-ready, and alpha-only", () => {
    const workflow = readWorkflow("release.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("environment: npm-release");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("id-token: write");
    expect(workflow).toContain("node-version: 24");
    expect(workflow).toContain("npm@11");
    expect(workflow).toContain("registry-url: https://registry.npmjs.org");
    expect(workflow).toContain("package-manager-cache: false");
    expect(workflow).not.toContain("cache: npm");
    expect(workflow).toContain("NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}");
    expect(workflow).toContain("npm run verify:release");
    expect(workflow).toContain("RELEASE_VERSION: ${{ inputs.version }}");
    expect(workflow).toContain('npm run release:publish -- "$RELEASE_VERSION"');
    expect(workflow).toMatch(/alpha|provenance/);
  });

  test("root scripts keep skill verification portable and release publication explicit", () => {
    const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));

    expect(manifest.scripts["skill:api:generate"]).toBe(
      "node skills/viselora-dom-webgl/scripts/generate-api-surface.mjs",
    );
    expect(manifest.scripts["skill:api:check"]).toBe(
      "node skills/viselora-dom-webgl/scripts/generate-api-surface.mjs --check && node skills/viselora-dom-webgl/scripts/check-api-coverage.mjs",
    );
    expect(manifest.scripts["verify:skill:template"]).toBe(
      "node ./scripts/verify-skill-template.mjs",
    );
    expectInOrder(manifest.scripts["verify:skill"], [
      "test/skill.test.ts test/skill-api-surface.test.ts",
      "npm run skill:api:check",
      "skills/viselora-dom-webgl/scripts/verify-consumer.mjs skills/viselora-dom-webgl/templates/react-vite",
      "npm run verify:skill:template",
    ]);
    expect(manifest.scripts["verify:skill"]).not.toContain("/Users/");
    expectInOrder(manifest.scripts["verify:release"], [
      "npm run build",
      "npm run verify:skill",
    ]);
    expect(manifest.scripts["verify:release"]).toContain("verify:consumer");
    expect(manifest.scripts["release:publish"]).toBe(
      "node ./scripts/publish-release.mjs",
    );
  });
});

function readWorkflow(name: string): string {
  const file = resolve(root, ".github/workflows", name);
  expect(existsSync(file), `${name} should exist`).toBe(true);
  return readFileSync(file, "utf8");
}

function expectInOrder(content: string, entries: string[]): void {
  let cursor = -1;
  for (const entry of entries) {
    const next = content.indexOf(entry, cursor + 1);
    expect(next, `${entry} should appear after the previous command`).toBeGreaterThan(cursor);
    cursor = next;
  }
}
