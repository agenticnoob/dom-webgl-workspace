import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

type PackageManifest = {
  name?: string;
  version?: string;
  type?: string;
  files?: string[];
  main?: string;
  types?: string;
  exports?: Record<string, { types?: string; import?: string }>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

const packageBuildScript =
  "tsup src/index.ts src/react.ts --format esm --dts --sourcemap --clean --splitting false --out-dir dist";
const packagePostbuildScript =
  "node ../../scripts/finalize-package-dts.mjs";

const expectedDistFiles = [
  "./dist/index.d.ts",
  "./dist/index.js",
  "./dist/index.js.map",
  "./dist/react.d.ts",
  "./dist/react.js",
  "./dist/react.js.map",
];

describe("release package contracts", () => {
  const rootPackage = readJson<PackageManifest>("package.json");
  const runtimePackage = readJson<PackageManifest>(
    "packages/dom-webgl-runtime/package.json",
  );
  const adaptersPackage = readJson<PackageManifest>(
    "packages/dom-webgl-scroll-adapters/package.json",
  );

  test("publishes the runtime package with exact alpha metadata", () => {
    expect(runtimePackage).toMatchObject({
      name: "@viselora/dom-webgl",
      version: "0.1.0-alpha.0",
      type: "module",
      files: ["dist", "README.md", "LICENSE"],
      main: "./dist/index.js",
      types: "./dist/index.d.ts",
      license: "MIT",
      publishConfig: { access: "public" },
      repository: {
        type: "git",
        url: "git+https://github.com/agenticnoob/dom-webgl-workspace.git",
        directory: "packages/dom-webgl-runtime",
      },
      bugs: {
        url: "https://github.com/agenticnoob/dom-webgl-workspace/issues",
      },
      homepage:
        "https://github.com/agenticnoob/dom-webgl-workspace#readme",
      exports: {
        ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
        "./react": {
          types: "./dist/react.d.ts",
          import: "./dist/react.js",
        },
      },
      scripts: {
        typecheck: "tsc -p tsconfig.json --noEmit",
        build: packageBuildScript,
        postbuild: packagePostbuildScript,
      },
    });
    expect(runtimePackage.dependencies).toEqual({ three: "^0.184.0" });
    expect(runtimePackage.peerDependencies).toEqual({ react: ">=18.0.0" });
    expect(runtimePackage.peerDependenciesMeta).toEqual({
      react: { optional: true },
    });
    expect(runtimePackage).not.toHaveProperty("private");
  });

  test("publishes the adapters package in core-version lockstep", () => {
    expect(adaptersPackage).toMatchObject({
      name: "@viselora/scroll-adapters",
      version: "0.1.0-alpha.0",
      type: "module",
      files: ["dist", "README.md", "LICENSE"],
      main: "./dist/index.js",
      types: "./dist/index.d.ts",
      license: "MIT",
      publishConfig: { access: "public" },
      repository: {
        type: "git",
        url: "git+https://github.com/agenticnoob/dom-webgl-workspace.git",
        directory: "packages/dom-webgl-scroll-adapters",
      },
      bugs: {
        url: "https://github.com/agenticnoob/dom-webgl-workspace/issues",
      },
      homepage:
        "https://github.com/agenticnoob/dom-webgl-workspace#readme",
      exports: {
        ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
        "./react": {
          types: "./dist/react.d.ts",
          import: "./dist/react.js",
        },
      },
      scripts: {
        typecheck: "tsc -p tsconfig.json --noEmit",
        build: packageBuildScript,
        postbuild: packagePostbuildScript,
      },
    });
    expect(adaptersPackage.dependencies).toEqual({
      "@viselora/dom-webgl": "0.1.0-alpha.0",
    });
    expect(adaptersPackage.peerDependencies).toEqual({
      gsap: ">=3.12.0",
      lenis: ">=1.0.0",
      react: ">=18.0.0",
    });
    expect(adaptersPackage.peerDependenciesMeta).toEqual({
      gsap: { optional: true },
      lenis: { optional: true },
      react: { optional: true },
    });
    expect(adaptersPackage).not.toHaveProperty("private");
  });

  test.each([
    ["runtime", runtimePackage],
    ["adapters", adaptersPackage],
  ])("builds the %s package to the six public dist files", (_name, manifest) => {
    expect(readExpectedDistFiles(manifest)).toEqual(expectedDistFiles);
  });

  test("resolves Viselora workspaces from source in clean development checkouts", () => {
    const tsconfig = readJson<TypeScriptConfig>("tsconfig.base.json");
    const adaptersTsconfig = readJson<TypeScriptConfig>(
      "packages/dom-webgl-scroll-adapters/tsconfig.json",
    );
    const vitestConfig = readFileSync(
      resolve(process.cwd(), "vitest.config.ts"),
      "utf8",
    );
    const sourceEntrypoints = {
      "@viselora/dom-webgl": [
        "packages/dom-webgl-runtime/src/index.ts",
      ],
      "@viselora/dom-webgl/react": [
        "packages/dom-webgl-runtime/src/react.ts",
      ],
      "@viselora/scroll-adapters": [
        "packages/dom-webgl-scroll-adapters/src/index.ts",
      ],
      "@viselora/scroll-adapters/react": [
        "packages/dom-webgl-scroll-adapters/src/react.ts",
      ],
    };

    expect(tsconfig.compilerOptions?.paths).toEqual(sourceEntrypoints);
    expect(adaptersTsconfig.compilerOptions?.paths).toEqual({});
    for (const [specifier, [entrypoint]] of Object.entries(sourceEntrypoints)) {
      expect(vitestConfig).toContain(`find: "${specifier}"`);
      expect(vitestConfig).toContain(`"./${entrypoint}"`);
    }
  });

  test("uses the required tsup release build range", () => {
    expect(rootPackage.devDependencies?.tsup).toBe("^8.5.0");
  });
});

type TypeScriptConfig = {
  compilerOptions?: { paths?: Record<string, string[]> };
};

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as T;
}

function readExpectedDistFiles(manifest: PackageManifest): string[] {
  const rootImport = manifest.exports?.["."]?.import;
  const reactImport = manifest.exports?.["./react"]?.import;
  const files = [
    manifest.types,
    manifest.main,
    rootImport ? `${rootImport}.map` : undefined,
    manifest.exports?.["./react"]?.types,
    reactImport,
    reactImport ? `${reactImport}.map` : undefined,
  ];

  return files.filter((file): file is string => file !== undefined).sort();
}
