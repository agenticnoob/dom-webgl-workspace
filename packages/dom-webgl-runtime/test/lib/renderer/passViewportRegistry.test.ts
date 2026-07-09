import { describe, expect, test } from "vitest";

import { createPassViewportRegistry } from "../../../src/lib/renderer/passViewportRegistry";

describe("pass viewport registry", () => {
  test("measures registered DOM anchors as CSS-pixel rectangles", () => {
    const registry = createPassViewportRegistry();
    const element = {
      getBoundingClientRect() {
        return {
          left: 24,
          top: 48,
          width: 320,
          height: 180,
          right: 344,
          bottom: 228,
        };
      },
    } as HTMLElement;

    registry.register({ id: "hero.viewport", element });

    expect(
      registry.resolve({ mode: "dom-rect", anchorId: "hero.viewport" }),
    ).toEqual({
      mode: "dom-rect",
      anchorId: "hero.viewport",
      scissor: true,
      rect: { x: 24, y: 48, width: 320, height: 180 },
    });
  });

  test("preserves offscreen DOM coordinates for renderer-side clipping", () => {
    const registry = createPassViewportRegistry();
    const element = {
      getBoundingClientRect() {
        return {
          left: -24,
          top: -48,
          width: 320,
          height: 180,
          right: 296,
          bottom: 132,
        };
      },
    } as HTMLElement;

    registry.register({ id: "hero.viewport", element });

    expect(
      registry.resolve({ mode: "dom-rect", anchorId: "hero.viewport" }),
    ).toEqual({
      mode: "dom-rect",
      anchorId: "hero.viewport",
      scissor: true,
      rect: { x: -24, y: -48, width: 320, height: 180 },
    });
  });

  test("returns canvas mode for missing or canvas viewport declarations", () => {
    const registry = createPassViewportRegistry();

    expect(registry.resolve(undefined)).toEqual({ mode: "canvas" });
    expect(registry.resolve({ mode: "canvas" })).toEqual({ mode: "canvas" });
  });

  test("throws a controlled error for unknown DOM anchors", () => {
    const registry = createPassViewportRegistry();

    expect(() =>
      registry.resolve({ mode: "dom-rect", anchorId: "missing" }),
    ).toThrow('Unknown WebGL pass viewport anchor "missing".');
  });

  test("throws a controlled error when dom-rect reaches runtime without an anchor id", () => {
    const registry = createPassViewportRegistry();

    expect(() => registry.resolve({ mode: "dom-rect" })).toThrow(
      "WebGL pass viewport dom-rect mode requires an anchorId after React context normalization.",
    );
  });
});
