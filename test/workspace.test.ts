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

  test("uses the Viselora public identities for package consumers", () => {
    const runtimePackage = readPackage(
      "packages/dom-webgl-runtime/package.json",
    );
    const adaptersPackage = readPackage(
      "packages/dom-webgl-scroll-adapters/package.json",
    );
    const examplePackage = readPackage("apps/example/package.json");

    expect(runtimePackage.name).toBe("@viselora/dom-webgl");
    expect(adaptersPackage.name).toBe("@viselora/scroll-adapters");
    expect(examplePackage).toMatchObject({
      name: "@viselora/example",
      dependencies: {
        "@viselora/dom-webgl": runtimePackage.version,
        "@viselora/scroll-adapters": adaptersPackage.version,
      },
    });
  });
});

function readPackage(path: string): {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
} {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), path), "utf8"),
  ) as {
    name?: string;
    version?: string;
    dependencies?: Record<string, string>;
  };
}
