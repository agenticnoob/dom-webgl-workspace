import { describe, expect, test } from "vitest";

import { projectDOMRectToSceneLayout } from "./domProjection";

describe("projectDOMRectToSceneLayout", () => {
  test("maps top-left DOM rects to centered bottom-left scene coordinates", () => {
    expect(
      projectDOMRectToSceneLayout(
        createDOMRect({ left: 20, top: 40, width: 200, height: 100 }),
        { width: 800, height: 600 },
      ),
    ).toEqual({
      x: 120,
      y: 510,
      width: 200,
      height: 100,
    });
  });

  test("keeps zero-size rects zero-size without throwing", () => {
    expect(
      projectDOMRectToSceneLayout(
        createDOMRect({ left: 10, top: 15, width: 0, height: 0 }),
        { width: 800, height: 600 },
      ),
    ).toEqual({
      x: 10,
      y: 585,
      width: 0,
      height: 0,
    });
  });
});

function createDOMRect({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
}): DOMRectReadOnly {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return { left, top, width, height };
    },
  } as DOMRectReadOnly;
}
