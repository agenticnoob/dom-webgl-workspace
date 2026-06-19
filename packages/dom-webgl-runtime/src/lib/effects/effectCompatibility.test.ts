import { describe, expect, test } from "vitest";

import { defineWebGLEffect } from "./effectAuthoring";
import { assertEffectCompatibility } from "./effectCompatibility";

const elementOnlyEffect = defineWebGLEffect({
  kind: "custom.elementOnly",
  source: "snapshot/element",
  update() {
    return;
  },
});

const mediaEffect = defineWebGLEffect({
  kind: "custom.media",
  source: ["image", "video"],
  update() {
    return;
  },
});

describe("assertEffectCompatibility", () => {
  test("allows effects on matching source kinds", () => {
    expect(() =>
      assertEffectCompatibility(
        "card.surface",
        "custom.elementOnly",
        elementOnlyEffect,
        "snapshot/element",
      ),
    ).not.toThrow();
  });

  test("rejects effects on non-matching source kinds", () => {
    expect(() =>
      assertEffectCompatibility(
        "card.image",
        "custom.elementOnly",
        elementOnlyEffect,
        "image",
      ),
    ).toThrow(
      'WebGL effect "custom.elementOnly" cannot be used with source "image" on target "card.image".',
    );
  });

  test("allows effects on any listed source kind", () => {
    expect(() =>
      assertEffectCompatibility(
        "card.image",
        "custom.media",
        mediaEffect,
        "image",
      ),
    ).not.toThrow();
  });

  test("treats omitted source filters as all-source effects", () => {
    const globalEffect = defineWebGLEffect({
      kind: "custom.global",
      update() {
        return;
      },
    });

    expect(() =>
      assertEffectCompatibility(
        "card.model",
        "custom.global",
        globalEffect,
        "model/glb",
      ),
    ).not.toThrow();
  });
});
