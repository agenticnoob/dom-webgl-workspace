import { describe, expect, test } from "vitest";

import type { WebGLDeclaration } from "../types";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import { inferRenderRole } from "./renderRole";

describe("inferRenderRole", () => {
  const element = document.createElement("div");
  const image = document.createElement("img");
  const video = document.createElement("video");

  test.each([
    [
      "element snapshot",
      { kind: "snapshot", mode: "element", element },
      "surface",
    ],
    ["text snapshot", { kind: "snapshot", mode: "text", element }, "content"],
    ["image", { kind: "image", element: image, src: "/image.png" }, "media"],
    ["video", { kind: "video", element: video, src: "/video.mp4" }, "media"],
    [
      "GLB model",
      { kind: "model", format: "glb", anchor: element, src: "/model.glb" },
      "model",
    ],
  ] as const)(
    "infers %s source as %s",
    (_name, sourceDescriptor, expectedRole) => {
      expect(inferRenderRole(sourceDescriptor, { key: "hero.target" })).toBe(
        expectedRole,
      );
    },
  );

  test("prefers an explicit declaration render role", () => {
    const sourceDescriptor = {
      kind: "image",
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
