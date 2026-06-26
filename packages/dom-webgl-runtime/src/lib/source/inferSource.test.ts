import { describe, expect, test } from "vitest";

import { createTargetDescriptor } from "../dom/targetDescriptor";
import { inferSourceDescriptor } from "./inferSource";

describe("inferSourceDescriptor", () => {
  test("infers an image source from an IMG element", () => {
    const image = document.createElement("img");
    image.setAttribute("src", "/images/hero.png");
    const target = createTargetDescriptor(image, { key: "hero.image" }, 0);

    expect(inferSourceDescriptor(target)).toEqual({
      kind: "image",
      element: image,
      src: "/images/hero.png",
    });
  });

  test("infers a video source from a VIDEO element", () => {
    const video = document.createElement("video");
    video.setAttribute("src", "/videos/intro.mp4");
    const target = createTargetDescriptor(video, { key: "hero.video" }, 0);

    expect(inferSourceDescriptor(target)).toEqual({
      kind: "video",
      element: video,
      src: "/videos/intro.mp4",
    });
  });

  test("uses requested text snapshot before DOM-native inference", () => {
    const image = document.createElement("img");
    image.setAttribute("src", "/images/hero.png");
    const target = createTargetDescriptor(
      image,
      {
        key: "hero.text",
        source: { kind: "snapshot", mode: "text" },
      },
      0,
    );

    expect(inferSourceDescriptor(target)).toEqual({
      kind: "snapshot",
      mode: "text",
      element: image,
    });
  });

  test("creates a model source from an explicit GLB declaration", () => {
    const element = document.createElement("div");
    const target = createTargetDescriptor(
      element,
      {
        key: "hero.model",
        source: { kind: "model", format: "glb", src: "/models/hero.glb" },
      },
      0,
    );

    expect(inferSourceDescriptor(target)).toEqual({
      kind: "model",
      format: "glb",
      anchor: element,
      src: "/models/hero.glb",
    });
  });

  test("accepts declared image sequence sources on any element anchor", () => {
    const element = document.createElement("section");
    const target = createTargetDescriptor(
      element,
      {
        key: "sequence.hero",
        source: {
          kind: "image-sequence",
          frameCount: 454,
          frameSrc: "/example/bg-sequence/frame_{frame:0000}.webp",
          progressKey: "example.video.scrub",
        },
      },
      0,
    );

    expect(inferSourceDescriptor(target)).toEqual({
      kind: "image-sequence",
      anchor: element,
      frameCount: 454,
      frameSrc: "/example/bg-sequence/frame_{frame:0000}.webp",
      progressKey: "example.video.scrub",
      startFrame: 1,
      preloadBefore: 6,
      preloadAfter: 18,
      maxCachedFrames: 72,
    });
  });

  test("rejects image sequence sources with empty frame counts", () => {
    const element = document.createElement("section");
    const target = createTargetDescriptor(
      element,
      {
        key: "sequence.bad",
        source: {
          kind: "image-sequence",
          frameCount: 0,
          frameSrc: "/frames/frame_{frame:0000}.webp",
        },
      },
      0,
    );

    expect(() => inferSourceDescriptor(target)).toThrow(
      'WebGL target "sequence.bad" declares an image sequence with frameCount 0.',
    );
  });

  test("rejects unsupported explicit model formats", () => {
    const element = document.createElement("div");
    const target = createTargetDescriptor(
      element,
      {
        key: "hero.model",
        source: {
          kind: "model",
          format: "obj" as "glb",
          src: "/models/hero.obj",
        },
      },
      0,
    );

    expect(() => inferSourceDescriptor(target)).toThrow(
      'Unsupported model source format "obj". Only "glb" is supported.',
    );
  });

  test("rejects explicit image declarations on non-image elements", () => {
    const element = document.createElement("div");
    const target = createTargetDescriptor(
      element,
      {
        key: "hero.image",
        source: { kind: "image", src: "/images/hero.png" },
      },
      0,
    );

    expect(() => inferSourceDescriptor(target)).toThrow(
      'WebGL target "hero.image" declares an image source but is not an IMG element.',
    );
  });

  test("rejects explicit video declarations on non-video elements", () => {
    const element = document.createElement("section");
    const target = createTargetDescriptor(
      element,
      {
        key: "hero.video",
        source: { kind: "video", src: "/videos/intro.mp4" },
      },
      0,
    );

    expect(() => inferSourceDescriptor(target)).toThrow(
      'WebGL target "hero.video" declares a video source but is not a VIDEO element.',
    );
  });

  test("falls back to an element snapshot", () => {
    const element = document.createElement("section");
    const target = createTargetDescriptor(element, { key: "hero.surface" }, 0);

    expect(inferSourceDescriptor(target)).toEqual({
      kind: "snapshot",
      mode: "element",
      element,
    });
  });
});
