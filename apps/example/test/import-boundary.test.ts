import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "vitest";

type ImportViolation = {
  file: string;
  specifier: string;
  reason: string;
};

type FindExampleImportViolations = (options?: {
  workspaceRoot?: string;
  exampleSourceDir?: string;
}) => Promise<ImportViolation[]>;

describe("example import boundary", () => {
  test("uses package public entrypoints and does not import demo source", async () => {
    const findViolations = await loadFindExampleImportViolations();

    await expect(
      findViolations({
        exampleSourceDir: path.join(process.cwd(), "apps", "example", "src"),
      }),
    ).resolves.toEqual([]);
  });

  test("allows only the Viselora package public entrypoints", async () => {
    const findViolations = await loadFindExampleImportViolations();
    const fixtureDir = mkdtempSync(path.join(tmpdir(), "viselora-imports-"));

    try {
      writeFileSync(
        path.join(fixtureDir, "fixture.ts"),
        [
          'import "@viselora/dom-webgl";',
          'import "@viselora/dom-webgl/react";',
          'import "@viselora/scroll-adapters";',
          'import "@viselora/scroll-adapters/react";',
          'import "@viselora/dom-webgl/internal";',
        ].join("\n"),
      );

      const violations = await findViolations({ exampleSourceDir: fixtureDir });

      expect(violations).toEqual([
        expect.objectContaining({
          specifier: "@viselora/dom-webgl/internal",
          reason: "non-public Viselora package import",
        }),
      ]);
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  test("rejects every legacy @project package import", async () => {
    const findViolations = await loadFindExampleImportViolations();
    const fixtureDir = mkdtempSync(path.join(tmpdir(), "project-imports-"));

    try {
      writeFileSync(
        path.join(fixtureDir, "fixture.ts"),
        'import "@project/unrelated-package";',
      );

      const violations = await findViolations({ exampleSourceDir: fixtureDir });

      expect(violations).toEqual([
        expect.objectContaining({
          specifier: "@project/unrelated-package",
          reason: "legacy @project package import",
        }),
      ]);
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});

async function loadFindExampleImportViolations(): Promise<FindExampleImportViolations> {
  // TypeScript does not resolve the colocated .mjs helper declaration under the current bundler setup.
  // @ts-expect-error runtime import is covered by the targeted test below.
  const module = (await import("../../../scripts/assert-example-public-imports.mjs")) as {
    findExampleImportViolations: FindExampleImportViolations;
  };

  return module.findExampleImportViolations;
}
