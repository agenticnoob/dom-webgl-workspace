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
		        const frame = document.createElement("canvas");

	        const descriptors = [
	          {
	            kind: "dom",
	            type: "element",
	            element,
	          },
	          {
	            kind: "dom",
	            type: "text",
	            element,
	          },
	          {
	            kind: "media",
	            type: "image",
	            anchor: image,
	            element: image,
	            src: "/images/hero.png",
	          },
	          {
	            kind: "media",
	            type: "video",
	            anchor: video,
	            element: video,
	            src: "/videos/intro.mp4",
	          },
	          {
		            kind: "media",
		            type: "image-sequence",
		            anchor: element,
		            frameCount: 1,
		            frames: [frame],
		            progressKey: "example.video.scrub",
		            startFrame: 1,
		          },
	          {
	            kind: "model",
	            type: "glb",
	            anchor: element,
	            src: "/models/hero.glb",
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
