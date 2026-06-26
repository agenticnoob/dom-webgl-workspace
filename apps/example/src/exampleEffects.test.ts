import { describe, expect, test } from "vitest";

import { exampleEffects, typeSafeDeclarations } from "./exampleEffects";

describe("example effect catalog", () => {
  test("exports the stable runtime effect array in display order", () => {
    expect(exampleEffects.map((effect) => effect.kind)).toEqual([
      "example.surfaceFill",
      "example.surfacePulse",
      "example.surfaceVideoBackground",
      "example.surfaceGhostCursor",
      "example.surfaceWaves",
      "example.textWave",
      "example.textReveal",
      "example.textSpotlight",
      "example.pinnedReveal",
      "example.imagePan",
      "example.imageZoom",
      "example.imageKenBurns",
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
    expect(typeSafeDeclarations).toContainEqual({
      kind: "example.surfaceVideoBackground",
      videoSrc: "/example/bg.mp4",
      opacity: 0.84,
    });
    expect(typeSafeDeclarations).toContainEqual({
      kind: "example.textSpotlight",
      color: "#f6c453",
      radius: 180,
    });
    expect(typeSafeDeclarations).toContainEqual({
      kind: "example.imageKenBurns",
      distance: 0.16,
      maxScale: 1.22,
    });
  });
});
