import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("root workspace configuration", () => {
  test("declares the monorepo workspace entries and shared scripts", () => {
    const packageJsonPath = resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      private?: boolean;
      workspaces?: string[];
      scripts?: Record<string, string>;
    };

    expect(packageJson.private).toBe(true);
    expect(packageJson.workspaces).toEqual(["packages/*", "apps/*"]);
    expect(packageJson.scripts).toMatchObject({
      test: "vitest",
      typecheck: "tsc -p tsconfig.base.json --noEmit",
      build: "npm run build --workspaces --if-present",
      check: "npm run typecheck && npm test -- --run",
    });
  });
});
