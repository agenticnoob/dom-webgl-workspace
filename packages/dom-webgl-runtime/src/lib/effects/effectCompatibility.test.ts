import { describe, expect, test } from "vitest";

import { assertMaterialSourceCompatibility } from "./effectCompatibility";
import type { NormalizedWebGLMaterialDeclaration } from "./effectNormalization";
import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";

describe("assertMaterialSourceCompatibility", () => {
  test("allows solid material on element snapshots", () => {
    expect(() =>
      assertMaterialSourceCompatibility(
        "card.surface",
        createSolidMaterial(),
        createElementSnapshotSource(),
      ),
    ).not.toThrow();
  });

  test("rejects solid material on image sources with the existing error contract", () => {
    expect(() =>
      assertMaterialSourceCompatibility(
        "card.image",
        createSolidMaterial(),
        createImageSource(),
      ),
    ).toThrow(
      'WebGL target "card.image" uses solid material on unsupported source "image". Solid material effects support only snapshot/element targets.',
    );
  });

  test("allows surface material on element snapshots", () => {
    expect(() =>
      assertMaterialSourceCompatibility(
        "card.surface",
        { kind: "surface", color: 0xffffff, opacity: 1, radius: 12 },
        createElementSnapshotSource(),
      ),
    ).not.toThrow();
  });

  test("rejects surface material on image sources", () => {
    expect(() =>
      assertMaterialSourceCompatibility(
        "card.image",
        { kind: "surface", color: 0xffffff, opacity: 1, radius: 12 },
        createImageSource(),
      ),
    ).toThrow(
      'WebGL target "card.image" uses surface material on unsupported source "image". Surface material effects support only snapshot/element targets.',
    );
  });
});

function createSolidMaterial(): NormalizedWebGLMaterialDeclaration {
  return { kind: "solid", color: 0xffffff, opacity: 1 };
}

function createElementSnapshotSource(): WebGLSourceDescriptor {
  return {
    kind: "snapshot",
    mode: "element",
    element: document.createElement("section"),
  };
}

function createImageSource(): WebGLSourceDescriptor {
  return {
    kind: "image",
    element: document.createElement("img"),
    src: "/demo/image.png",
  };
}
