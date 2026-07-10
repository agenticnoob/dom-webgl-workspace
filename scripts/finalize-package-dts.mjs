import { readdir, rm } from "node:fs/promises";

import { build } from "tsup";

const outDir = "dist";
const declarationEntries = {
  index: "src/index.ts",
  react: "src/react.ts",
};
const publicDeclarationFiles = new Set(["index.d.ts", "react.d.ts"]);

for (const [name, entry] of Object.entries(declarationEntries)) {
  await build({
    entry: { [name]: entry },
    format: ["esm"],
    dts: { only: true },
    outDir,
    config: false,
    silent: true,
  });
}

for (const file of await readdir(outDir)) {
  if (/\.d\.(?:ts|mts|cts)$/.test(file) && !publicDeclarationFiles.has(file)) {
    await rm(`${outDir}/${file}`);
  }
}
