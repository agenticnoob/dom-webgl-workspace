import { describe, expect, test } from "vitest";

import type { WebGLDeclaration } from "../types";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import { inferRenderRole } from "./renderRole";

describe("inferRenderRole", () => {
  const element = document.createElement("div");
  const image = document.createElement("img");
  const video = document.createElement("video");

  test.each([
    ["dom element", { kind: "dom", type: "element", element }, "surface"],
    ["dom text", { kind: "dom", type: "text", element }, "content"],
    [
      "media image",
      { kind: "media", type: "image", anchor: image, element: image, src: "/image.png" },
      "media",
    ],
    [
      "media video",
      { kind: "media", type: "video", anchor: video, element: video, src: "/video.mp4" },
      "media",
    ],
    [
      "media image-sequence",
      {
        kind: "media",
        type: "image-sequence",
        anchor: element,
        frameCount: 1,
        frames: [document.createElement("canvas")],
        startFrame: 1,
      },
      "media",
    ],
    [
      "model glb",
      { kind: "model", type: "glb", anchor: element, src: "/model.glb" },
      "model",
    ],
  ] satisfies Array<[string, WebGLSourceDescriptor, "surface" | "content" | "media" | "model"]>)(
    "infers %s source as %s",
    (_name, sourceDescriptor, expectedRole) => {
      expect(inferRenderRole(sourceDescriptor, { key: "hero.target" })).toBe(
        expectedRole,
      );
    },
  );

  test("prefers an explicit declaration render role", () => {
    const sourceDescriptor = {
      kind: "media",
      type: "image",
      anchor: image,
      element: image,
      src: "/image.png",
    } satisfies WebGLSourceDescriptor;
    const declaration = {
      key: "hero.overlay",
      renderRole: "overlay",
    } satisfies WebGLDeclaration;

    expect(inferRenderRole(sourceDescriptor, declaration)).toBe("overlay");
  });
});
