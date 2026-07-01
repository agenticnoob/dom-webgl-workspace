import { describe, expect, test } from "vitest";

import { exampleEffects, typeSafeDeclarations } from "../src/exampleEffects";

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
      "example.textPressure",
      "example.textScramble",
      "example.pinnedReveal",
      "example.sequenceCardSlide",
      "example.sequenceCardBorderGlow",
      "example.imagePan",
      "example.imageZoom",
      "example.imageKenBurns",
      "example.imageHoverReveal",
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
      kind: "example.sequenceCardSlide",
      progressKey: "example.video.scrub",
      travel: 280,
      minOpacity: 0.18,
      maxOpacity: 0.82,
    });
    expect(typeSafeDeclarations).toContainEqual({
      kind: "example.sequenceCardBorderGlow",
      progressKey: "example.video.scrub",
      travel: 280,
      edgeSensitivity: 0.3,
      colorSensitivity: 0.5,
      glowRadius: 40,
      glowIntensity: 1,
      fillOpacity: 0.42,
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
      kind: "example.textPressure",
      color: "#f4f4f5",
      radius: 180,
    });
    expect(typeSafeDeclarations).toContainEqual({
      kind: "example.textScramble",
      color: "#172124",
      scrambleChars: ".:",
      radius: 148,
      speed: 0.45,
    });
    expect(typeSafeDeclarations).toContainEqual({
      kind: "example.imageKenBurns",
      distance: 0.16,
      maxScale: 1.22,
    });
    expect(typeSafeDeclarations).toContainEqual({
      kind: "example.imageHoverReveal",
      revealSrc: "/example/mask.png",
      radius: 132,
      feather: 42,
      restoreMs: 2200,
      roughness: 0.26,
    });
  });
});
