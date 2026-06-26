import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { describe, expect, test } from "vitest";

describe("WebGLSourceDescriptor internal types", () => {
  test("cover all phase 1 source descriptor variants", () => {
    const repoRoot = process.cwd();
    const tempDir = mkdtempSync(resolve(tmpdir(), "dom-webgl-source-types-"));
    const fixturePath = resolve(tempDir, "fixture.ts");
    const sourceDescriptorPath = resolve(
      repoRoot,
      "packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.ts",
    );
    const relativeSourceDescriptorPath = relative(
      dirname(fixturePath),
      sourceDescriptorPath,
    )
      .split(sep)
      .join("/");
    const importPath = relativeSourceDescriptorPath.startsWith(".")
      ? relativeSourceDescriptorPath
      : `./${relativeSourceDescriptorPath}`;

    writeFileSync(
      fixturePath,
      `
        import type { WebGLSourceDescriptor } from "${importPath}";

        const element = document.createElement("section");
        const image = document.createElement("img");
        const video = document.createElement("video");

        const descriptors = [
          {
            kind: "snapshot",
            mode: "element",
            element,
          },
          {
            kind: "snapshot",
            mode: "text",
            element,
          },
          {
            kind: "image",
            element: image,
            src: "/images/hero.png",
          },
          {
            kind: "video",
            element: video,
            src: "/videos/intro.mp4",
          },
          {
            kind: "model",
            format: "glb",
            anchor: element,
            src: "/models/hero.glb",
          },
          {
            kind: "image-sequence",
            anchor: element,
            frameCount: 454,
            frameSrc: "/example/bg-sequence/frame_{frame:0000}.webp",
            progressKey: "example.video.scrub",
            startFrame: 1,
            preloadBefore: 6,
            preloadAfter: 18,
            maxCachedFrames: 72,
          },
        ] satisfies WebGLSourceDescriptor[];

        descriptors[0] satisfies WebGLSourceDescriptor;
      `,
    );

    try {
      const configPath = resolve(repoRoot, "tsconfig.base.json");
      const configFile = ts.readConfigFile(configPath, (fileName) =>
        readFileSync(fileName, "utf8"),
      );
      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        repoRoot,
        {
          noEmit: true,
          allowImportingTsExtensions: true,
          types: [],
        },
        configPath,
      );
      const program = ts.createProgram(
        [fixturePath, sourceDescriptorPath],
        parsedConfig.options,
      );
      const diagnostics = ts.getPreEmitDiagnostics(program);

      expect(formatDiagnostics(diagnostics)).toBe("");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n",
      );

      if (!diagnostic.file || diagnostic.start === undefined) {
        return message;
      }

      const position = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start,
      );

      return `${diagnostic.file.fileName}:${position.line + 1}:${
        position.character + 1
      } - ${message}`;
    })
    .join("\n");
}
