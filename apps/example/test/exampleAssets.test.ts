import { access } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "vitest";

const examplePublicDir = path.join(process.cwd(), "apps", "example", "public");

describe("example static assets", () => {
  test("ships every static asset referenced by the React example", async () => {
    await expectAsset("example/image.png");
    await expectAsset("example/show.png");
    await expectAsset("example/mask.png");
    await expectAsset("example/video.mp4");
    await expectAsset("example/bg.mp4");
    await expectAsset("example/bg-sequence/frame_0001.webp");
    await expectAsset("example/bg-sequence/frame_0454.webp");
    await expectAsset("models/hero.glb");
    await expectAsset("models/4.glb");
    await expectAsset("draco/gltf/draco_decoder.js");
    await expectAsset("draco/gltf/draco_decoder.wasm");
    await expectAsset("draco/gltf/draco_wasm_wrapper.js");
  });
});

async function expectAsset(relativePath: string): Promise<void> {
  await expect(access(path.join(examplePublicDir, relativePath))).resolves.toBeUndefined();
}
