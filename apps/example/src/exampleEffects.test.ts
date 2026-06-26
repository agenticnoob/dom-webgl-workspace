import { describe, expect, test } from "vitest";

import { exampleEffects, typeSafeDeclarations } from "./exampleEffects";

describe("example effect catalog", () => {
  test("exports the stable runtime effect array in display order", () => {
    expect(exampleEffects.map((effect) => effect.kind)).toEqual([
      "example.surfaceFill",
      "example.surfacePulse",
      "example.textWave",
      "example.textReveal",
      "example.pinnedReveal",
      "example.imagePan",
      "example.imageZoom",
      "example.videoPlayback",
      "example.videoDrift",
      "example.modelSpin",
      "example.modelFloat",
    ]);
  });

  test("keeps type-safe declarations aligned with the effect catalog", () => {
    expect(typeSafeDeclarations.map((effect) => effect.kind)).toEqual(
      exampleEffects.map((effect) => effect.kind),
    );
    expect(typeSafeDeclarations).toContainEqual({
      kind: "example.pinnedReveal",
      progressKey: "example.pinned.reveal",
      color: "#172124",
    });
  });
});
