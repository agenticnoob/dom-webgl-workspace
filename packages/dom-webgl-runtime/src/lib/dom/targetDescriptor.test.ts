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
