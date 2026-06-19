import { describe, expect, test } from "vitest";

import { solidMaterialEffect } from "./builtins/solidMaterialEffect";
import { surfaceBasicEffect } from "./builtins/surfaceBasicEffect";
import { assertEffectCompatibility } from "./effectCompatibility";

describe("assertEffectCompatibility", () => {
  test("allows solid material on element snapshots", () => {
    expect(() =>
      assertEffectCompatibility(
        "card.surface",
        "material.solid",
        solidMaterialEffect,
        "snapshot/element",
      ),
    ).not.toThrow();
  });

  test("rejects solid material on image sources", () => {
    expect(() =>
      assertEffectCompatibility(
        "card.image",
        "material.solid",
        solidMaterialEffect,
        "image",
      ),
    ).toThrow(
      'WebGL effect "material.solid" cannot be used with source "image" on target "card.image".',
    );
  });

  test("allows surface material on element snapshots", () => {
    expect(() =>
      assertEffectCompatibility(
        "card.surface",
        "surface.basic",
        surfaceBasicEffect,
        "snapshot/element",
      ),
    ).not.toThrow();
  });

  test("rejects surface material on image sources", () => {
    expect(() =>
      assertEffectCompatibility(
        "card.image",
        "surface.basic",
        surfaceBasicEffect,
        "image",
      ),
    ).toThrow(
      'WebGL effect "surface.basic" cannot be used with source "image" on target "card.image".',
    );
  });
});
