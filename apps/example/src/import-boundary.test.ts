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
});

async function loadFindExampleImportViolations(): Promise<FindExampleImportViolations> {
  // TypeScript does not resolve the colocated .mjs helper declaration under the current bundler setup.
  // @ts-expect-error runtime import is covered by the targeted test below.
  const module = (await import("../../../scripts/assert-example-public-imports.mjs")) as {
    findExampleImportViolations: FindExampleImportViolations;
  };

  return module.findExampleImportViolations;
}
