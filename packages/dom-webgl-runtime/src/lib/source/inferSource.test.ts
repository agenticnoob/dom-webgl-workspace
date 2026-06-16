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
