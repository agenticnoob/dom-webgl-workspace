import { describe, expect, test } from "vitest";

import { createTargetDescriptor } from "../../../src/lib/dom/targetDescriptor";
import { inferSourceDescriptor } from "../../../src/lib/source/inferSource";

describe("inferSourceDescriptor", () => {
  test("infers media/image for IMG targets without explicit source", () => {
    const element = document.createElement("img");
    element.setAttribute("src", "/image.png");

    expect(
      inferSourceDescriptor(createTargetDescriptor(element, { key: "image" }, 0)),
    ).toEqual({
      kind: "media",
      type: "image",
      anchor: element,
      element,
      src: "/image.png",
    });
  });

  test("infers media/video for VIDEO targets without explicit source", () => {
    const element = document.createElement("video");
    element.setAttribute("src", "/video.mp4");

    expect(
      inferSourceDescriptor(createTargetDescriptor(element, { key: "video" }, 0)),
    ).toEqual({
      kind: "media",
      type: "video",
      anchor: element,
      element,
      src: "/video.mp4",
      playback: undefined,
    });
  });

  test("uses requested dom/text before DOM-native inference", () => {
    const element = document.createElement("img");
    element.setAttribute("src", "/image.png");

    expect(
      inferSourceDescriptor(
        createTargetDescriptor(
          element,
          {
            key: "hero.text",
            source: { kind: "dom", type: "text" },
          },
          0,
        ),
      ),
    ).toEqual({
      kind: "dom",
      type: "text",
      element,
    });
  });

  test("uses a section as an anchored media/image source when src is declared", () => {
    const element = document.createElement("section");

    expect(
      inferSourceDescriptor(
        createTargetDescriptor(
          element,
          {
            key: "hero",
            source: { kind: "media", type: "image", src: "/hero.png" },
          },
          0,
        ),
      ),
    ).toEqual({
      kind: "media",
      type: "image",
      anchor: element,
      element: undefined,
      src: "/hero.png",
    });
  });

  test("rejects anchored media/image without a src", () => {
    const element = document.createElement("section");

    expect(() =>
      inferSourceDescriptor(
        createTargetDescriptor(
          element,
          {
            key: "hero",
            source: { kind: "media", type: "image" },
          },
          0,
        ),
      ),
    ).toThrow(
      'WebGL target "hero" declares media/image on a non-IMG element without src.',
    );
  });

  test("uses a section as an anchored media/video source when src is declared", () => {
    const element = document.createElement("section");
    const playback = { muted: true, loop: true };

    expect(
      inferSourceDescriptor(
        createTargetDescriptor(
          element,
          {
            key: "hero.video",
            source: {
              kind: "media",
              type: "video",
              src: "/hero.mp4",
              playback,
            },
          },
          0,
        ),
      ),
    ).toEqual({
      kind: "media",
      type: "video",
      anchor: element,
      element: undefined,
      src: "/hero.mp4",
      playback,
    });
  });

  test("rejects anchored media/video without a src", () => {
    const element = document.createElement("section");

    expect(() =>
      inferSourceDescriptor(
        createTargetDescriptor(
          element,
          {
            key: "hero.video",
            source: { kind: "media", type: "video" },
          },
          0,
        ),
      ),
    ).toThrow(
      'WebGL target "hero.video" declares media/video on a non-VIDEO element without src.',
    );
  });

  test("creates a model source from an explicit GLB declaration", () => {
    const element = document.createElement("div");

    expect(
      inferSourceDescriptor(
        createTargetDescriptor(
          element,
          {
            key: "hero.model",
            source: { kind: "model", type: "glb", src: "/models/hero.glb" },
          },
          0,
        ),
      ),
    ).toEqual({
      kind: "model",
      type: "glb",
      anchor: element,
      src: "/models/hero.glb",
    });
  });

  test("normalizes media/image-sequence to an anchored descriptor", () => {
    const element = document.createElement("section");
    const frame = document.createElement("canvas");

    expect(
      inferSourceDescriptor(
        createTargetDescriptor(
          element,
          {
            key: "sequence",
            source: {
              kind: "media",
              type: "image-sequence",
              frameCount: 1,
              frames: [frame],
              progressKey: "scrub",
            },
          },
          0,
        ),
      ),
    ).toEqual({
      kind: "media",
      type: "image-sequence",
      anchor: element,
      frameCount: 1,
      frames: [frame],
      progressKey: "scrub",
      startFrame: 1,
    });
  });

  test("rejects image sequence sources with empty frame counts", () => {
    const element = document.createElement("section");
    const target = createTargetDescriptor(
      element,
      {
        key: "sequence.bad",
        source: {
          kind: "media",
          type: "image-sequence",
          frameCount: 0,
          frames: [],
        },
      },
      0,
    );

    expect(() => inferSourceDescriptor(target)).toThrow(
      'WebGL target "sequence.bad" declares media/image-sequence with frameCount 0.',
    );
  });

  test("rejects image sequence sources that are not fully initialized", () => {
    const element = document.createElement("section");
    const target = createTargetDescriptor(
      element,
      {
        key: "sequence.partial",
        source: {
          kind: "media",
          type: "image-sequence",
          frameCount: 10,
          frames: createFrames(2),
        },
      },
      0,
    );

    expect(() => inferSourceDescriptor(target)).toThrow(
      'WebGL target "sequence.partial" declares media/image-sequence with 2 frames for frameCount 10.',
    );
  });

  test("rejects old explicit source kinds at runtime", () => {
    const element = document.createElement("section");

    expect(() =>
      inferSourceDescriptor(
        createTargetDescriptor(
          element,
          {
            key: "old",
            source: { kind: "image", src: "/legacy.png" } as never,
          },
          0,
        ),
      ),
    ).toThrow('Unsupported WebGL source declaration kind "image" on target "old".');
  });

  test("falls back to a dom/element source", () => {
    const element = document.createElement("section");
    const target = createTargetDescriptor(element, { key: "hero.surface" }, 0);

    expect(inferSourceDescriptor(target)).toEqual({
      kind: "dom",
      type: "element",
      element,
    });
  });
});

function createFrames(count: number): readonly HTMLImageElement[] {
  return Array.from({ length: count }, (_entry, index) => {
    const image = document.createElement("img");
    image.src = `/frames/frame_${String(index + 1).padStart(4, "0")}.webp`;
    return image;
  });
}
