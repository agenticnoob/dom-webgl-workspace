import { describe, expect, test } from "vitest";

import { createTargetRegistry } from "./registry";

describe("createTargetRegistry", () => {
  test("registers a target and returns its normalized descriptor", () => {
    const registry = createTargetRegistry();
    const element = document.createElement("section");

    const descriptor = registry.register(
      element,
      {
        key: "hero.surface",
      },
      4,
    );

    expect(descriptor).toEqual({
      key: "hero.surface",
      element,
      scanOrder: 4,
      declaration: {
        key: "hero.surface",
        scroll: { type: "page" },
        pointer: {},
        lifecycle: {},
      },
    });
    expect(registry.get("hero.surface")).toBe(descriptor);
  });

  test("throws when registering duplicate keys", () => {
    const registry = createTargetRegistry();

    registry.register(
      document.createElement("div"),
      {
        key: "hero.surface",
      },
      0,
    );

    expect(() =>
      registry.register(
        document.createElement("div"),
        {
          key: "hero.surface",
        },
        1,
      ),
    ).toThrowError(
      'WebGL target key "hero.surface" is already registered.',
    );
  });

  test("unregister removes the descriptor", () => {
    const registry = createTargetRegistry();

    registry.register(
      document.createElement("div"),
      {
        key: "hero.surface",
      },
      0,
    );

    registry.unregister("hero.surface");

    expect(registry.get("hero.surface")).toBeUndefined();
    expect(registry.list()).toEqual([]);
  });
});
