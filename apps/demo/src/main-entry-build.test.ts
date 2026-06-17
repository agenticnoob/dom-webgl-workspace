// @vitest-environment node

import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RollupOutput } from "rollup";
import { build } from "vite";
import { describe, expect, test } from "vitest";

const demoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

describe("demo main entry build", () => {
  test("does not emit a free React global from the JSX entrypoint", async () => {
    const result = await build({
      root: demoRoot,
      logLevel: "silent",
      build: {
        write: false,
      },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const chunks = outputs.flatMap((output) =>
      (output as RollupOutput).output.filter((item) => item.type === "chunk"),
    );

    expect(chunks.map((chunk) => chunk.code).join("\n")).not.toContain(
      "React.createElement",
    );
  });
});
