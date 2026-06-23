import path from "node:path";

import { describe, expect, test } from "vitest";

type ImportViolation = {
  file: string;
  specifier: string;
  reason: string;
};

type FindDemoImportViolations = (options?: {
  forbiddenSourceDirs?: readonly string[];
  workspaceRoot?: string;
  demoSourceDir?: string;
}) => Promise<ImportViolation[]>;

describe("example import boundary", () => {
  test("uses package public entrypoints and does not import demo source", async () => {
    const findViolations = await loadFindDemoImportViolations();

    await expect(
      findViolations({
        demoSourceDir: path.join(process.cwd(), "apps", "example", "src"),
        forbiddenSourceDirs: [path.join(process.cwd(), "apps", "demo", "src")],
      }),
    ).resolves.toEqual([]);
  });
});

async function loadFindDemoImportViolations(): Promise<FindDemoImportViolations> {
  // TypeScript does not resolve the colocated .mjs helper declaration under the current bundler setup.
  // @ts-expect-error runtime import is covered by the targeted test below.
  const module = (await import("../../../scripts/assert-demo-public-imports.mjs")) as {
    findDemoImportViolations: FindDemoImportViolations;
  };

  return module.findDemoImportViolations;
}
