import { describe, expect, test } from "vitest";

import {
  readModelPrepareDecision,
  type ModelPreparePass,
} from "../../../src/lib/renderer/modelPreparePolicy";

describe("model prepare policy", () => {
  test("allows canvas-pass scenes immediately", () => {
    expect(
      readModelPrepareDecision({
        sceneId: "world",
        viewportHeight: 720,
        passes: [{ sceneId: "world", viewport: { mode: "canvas" } }],
      }),
    ).toEqual({ allowed: true, reason: "canvas-pass" });
  });

  test("allows DOM-bound scenes inside the prepare margin", () => {
    const passes: ModelPreparePass[] = [
      {
        sceneId: "world",
        viewport: {
          mode: "dom-rect",
          rect: { x: 0, y: 1600, width: 640, height: 420 },
        },
      },
    ];

    expect(
      readModelPrepareDecision({
        sceneId: "world",
        viewportHeight: 720,
        passes,
      }),
    ).toEqual({ allowed: true, reason: "near-dom-pass" });
  });

  test("queues DOM-bound scenes outside the prepare margin", () => {
    const passes: ModelPreparePass[] = [
      {
        sceneId: "world",
        viewport: {
          mode: "dom-rect",
          rect: { x: 0, y: 4200, width: 640, height: 420 },
        },
      },
    ];

    expect(
      readModelPrepareDecision({
        sceneId: "world",
        viewportHeight: 720,
        passes,
      }),
    ).toEqual({ allowed: false, reason: "far-dom-pass" });
  });

  test("queues DOM-bound scenes with invalid or empty viewport rects", () => {
    const passes: ModelPreparePass[] = [
      {
        sceneId: "world",
        viewport: {
          mode: "dom-rect",
          rect: { x: 0, y: 120, width: 0, height: 420 },
        },
      },
      {
        sceneId: "world",
        viewport: {
          mode: "dom-rect",
          rect: { x: 0, y: 160, width: 640, height: 0 },
        },
      },
    ];

    expect(
      readModelPrepareDecision({
        sceneId: "world",
        viewportHeight: 720,
        passes,
      }),
    ).toEqual({ allowed: false, reason: "far-dom-pass" });
  });

  test("queues scenes without a matching pass", () => {
    expect(
      readModelPrepareDecision({
        sceneId: "world",
        viewportHeight: 720,
        passes: [{ sceneId: "other", viewport: { mode: "canvas" } }],
      }),
    ).toEqual({ allowed: false, reason: "no-pass" });
  });
});
