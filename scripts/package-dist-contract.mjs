import { readdir } from "node:fs/promises";

export const EXPECTED_PACKAGE_DIST_FILES = Object.freeze([
  "index.d.ts",
  "index.js",
  "index.js.map",
  "react.d.ts",
  "react.js",
  "react.js.map",
]);

export async function assertExactPackageDistFiles(distDirectory) {
  const actualFiles = (await readdir(distDirectory)).sort();
  const missingFiles = EXPECTED_PACKAGE_DIST_FILES.filter(
    (file) => !actualFiles.includes(file),
  );
  const extraFiles = actualFiles.filter(
    (file) => !EXPECTED_PACKAGE_DIST_FILES.includes(file),
  );

  if (missingFiles.length > 0 || extraFiles.length > 0) {
    const details = [
      missingFiles.length > 0 ? `missing: ${missingFiles.join(", ")}` : null,
      extraFiles.length > 0 ? `extra: ${extraFiles.join(", ")}` : null,
    ].filter(Boolean);

    throw new Error(
      `Package dist contract failed for ${distDirectory} (${details.join("; ")})`,
    );
  }

  return actualFiles;
}
