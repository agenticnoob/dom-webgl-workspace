import { describe, expect, test } from "vitest";

import {
  computeObjectFitContentBox,
  computeObjectFitTextureTransform,
} from "../../../../src/lib/render/renderables/objectFit";

describe("computeObjectFitTextureTransform", () => {
  test("computes cover crop for wider media inside a portrait DOM box", () => {
    expect(
      computeObjectFitTextureTransform({
        fit: "cover",
        position: "50% 50%",
        box: { width: 300, height: 400 },
        media: { width: 1600, height: 900 },
      }),
    ).toEqual({
      repeatX: 0.421875,
      repeatY: 1,
      offsetX: 0.2890625,
      offsetY: 0,
    });
  });

  test("keeps full texture for contain and fill", () => {
    expect(
      computeObjectFitTextureTransform({
        fit: "contain",
        position: "50% 50%",
        box: { width: 300, height: 400 },
        media: { width: 1600, height: 900 },
      }),
    ).toEqual({ repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 });
    expect(
      computeObjectFitTextureTransform({
        fit: "fill",
        position: "50% 50%",
        box: { width: 300, height: 400 },
        media: { width: 1600, height: 900 },
      }),
    ).toEqual({ repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0 });
  });

  test("computes contained media content box without stretching", () => {
    expect(
      computeObjectFitContentBox({
        fit: "contain",
        position: "50% 50%",
        box: { width: 300, height: 400 },
        media: { width: 1600, height: 900 },
      }),
    ).toEqual({
      width: 300,
      height: 168.75,
      offsetX: 0,
      offsetY: 115.625,
    });
  });

  test("computes natural-size content box for object-fit none", () => {
    expect(
      computeObjectFitContentBox({
        fit: "none",
        position: "25% 75%",
        box: { width: 300, height: 400 },
        media: { width: 160, height: 90 },
      }),
    ).toEqual({
      width: 160,
      height: 90,
      offsetX: 35,
      offsetY: 232.5,
    });
  });

  test("uses percentage object position for cover crop", () => {
    expect(
      computeObjectFitTextureTransform({
        fit: "cover",
        position: "25% 75%",
        box: { width: 300, height: 400 },
        media: { width: 1600, height: 900 },
      }),
    ).toEqual({
      repeatX: 0.421875,
      repeatY: 1,
      offsetX: 0.14453125,
      offsetY: 0,
    });
  });
});
