import { describe, expect, test } from "vitest";

import { createTargetDescriptor } from "./targetDescriptor";

describe("createTargetDescriptor", () => {
  test("returns a normalized descriptor with defaults", () => {
    const element = document.createElement("section");
    const declaration = {
      key: "hero.surface",
    };

    const descriptor = createTargetDescriptor(element, declaration, 7);

    expect(descriptor).toEqual({
      key: "hero.surface",
      element,
      scanOrder: 7,
      declaration: {
        key: "hero.surface",
        scroll: { type: "page" },
        pointer: {},
        lifecycle: {},
      },
    });
  });

  test("normalizes gate scroll declarations before registration", () => {
    const element = document.createElement("section");

    const descriptor = createTargetDescriptor(
      element,
      {
        key: "hero.gate",
        scroll: {
          type: "gate",
          start: "  center center  ",
          duration: 1,
        },
      },
      2,
    );

    expect(descriptor.declaration.scroll).toEqual({
      type: "gate",
      start: "center center",
      duration: 1,
      release: "forward-complete",
    });
    expect(descriptor.declaration.pointer).toEqual({});
    expect(descriptor.declaration.lifecycle).toEqual({});
  });

  test("preserves high-level lifecycle fallback hide modes", () => {
    const element = document.createElement("section");

    const descriptor = createTargetDescriptor(
      element,
      {
        key: "hero.surface",
        lifecycle: {
          hideWhenReady: true,
          hideMode: "self",
        },
      },
      0,
    );

    expect(descriptor.declaration.lifecycle).toEqual({
      hideWhenReady: true,
      hideMode: "self",
    });
  });

  test("throws before registration when gate scroll declarations are invalid", () => {
    const element = document.createElement("div");

    expect(() =>
      createTargetDescriptor(
        element,
        {
          key: "hero.gate",
          scroll: {
            type: "gate",
            start: "top top",
            duration: -1,
          },
        },
        0,
      ),
    ).toThrowError(/duration/i);
  });

  test("throws a visible error when key is missing", () => {
    const element = document.createElement("div");

    expect(() =>
      createTargetDescriptor(
        element,
        {
          key: "   ",
        },
        0,
      ),
    ).toThrowError("WebGL target declaration requires a non-empty key.");
  });
});
