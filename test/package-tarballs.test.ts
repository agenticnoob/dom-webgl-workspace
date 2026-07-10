import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, test } from "vitest";

const modulePath = resolve(process.cwd(), "scripts/package-tarballs.mjs");
const expectedFiles = [
  "LICENSE",
  "README.md",
  "dist/index.d.ts",
  "dist/index.js",
  "dist/index.js.map",
  "dist/react.d.ts",
  "dist/react.js",
  "dist/react.js.map",
  "package.json",
];

describe("package tarball contracts", () => {
  test("accepts only the exact public package files", () => {
    const result = runAssertion(expectedFiles);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("OK");
  });

  test.each([
    ["missing declaration", expectedFiles.filter((file) => file !== "dist/react.d.ts"), "Missing"],
    ["source file", [...expectedFiles, "src/index.ts"], "Unexpected"],
    ["test file", [...expectedFiles, "test/index.test.ts"], "Unexpected"],
    ["internal docs", [...expectedFiles, "docs/internal.md"], "Unexpected"],
    ["temporary asset", [...expectedFiles, "tmp/debug.json"], "Unexpected"],
    ["hashed declaration chunk", [...expectedFiles, "dist/types-AbCd1234.d.ts"], "Unexpected"],
  ])("rejects %s", (_name, files, message) => {
    const result = runAssertion(files);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(message);
  });

  test("parses one npm pack JSON result with integrity metadata", () => {
    const packJson = JSON.stringify([
      {
        id: "@viselora/dom-webgl@0.1.0-alpha.0",
        name: "@viselora/dom-webgl",
        version: "0.1.0-alpha.0",
        filename: "viselora-dom-webgl-0.1.0-alpha.0.tgz",
        integrity: "sha512-example",
        shasum: "abc123",
        files: expectedFiles.map((path) => ({ path, size: 1, mode: 420 })),
      },
    ]);
    const result = runParse(packJson);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      name: "@viselora/dom-webgl",
      version: "0.1.0-alpha.0",
      integrity: "sha512-example",
      shasum: "abc123",
    });
  });

  test.each(["[]", "{}", "not-json"])(
    "rejects invalid npm pack output %s",
    (packJson) => {
      const result = runParse(packJson);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("npm pack --json");
    },
  );
});

function runAssertion(files: string[]) {
  return runModule(
    "assertPackageFileList(JSON.parse(process.argv[1])); console.log('OK')",
    JSON.stringify(files),
  );
}

function runParse(packJson: string) {
  return runModule(
    "console.log(JSON.stringify(parsePackJson(process.argv[1])))",
    packJson,
  );
}

function runModule(statement: string, argument: string) {
  const source = [
    `import { assertPackageFileList, parsePackJson } from ${JSON.stringify(modulePath)};`,
    "try {",
    statement,
    "} catch (error) {",
    "  console.error(error instanceof Error ? error.message : String(error));",
    "  process.exitCode = 1;",
    "}",
  ].join("\n");
  return spawnSync(process.execPath, ["--input-type=module", "-e", source, argument], {
    encoding: "utf8",
  });
}
