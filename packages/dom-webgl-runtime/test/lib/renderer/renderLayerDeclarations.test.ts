import { describe, expect, test } from "vitest";

import {
  normalizeRenderLayerCameraDeclaration,
  normalizeRenderLayerPassDeclaration,
  normalizeRenderLayerSceneDeclaration,
  normalizeTargetSceneId,
} from "../../../src/lib/renderer/renderLayerDeclarations";
import type {
  WebGLCameraDeclaration,
  WebGLSceneDeclaration,
} from "../../../src/lib/types";

describe("render layer declaration normalization", () => {
  test("normalizes scene defaults without changing Level 1 main behavior", () => {
    expect(
      normalizeRenderLayerSceneDeclaration({
        id: " world ",
        defaultCameraId: " world.camera ",
        defaultPass: true,
      }),
    ).toEqual({
      id: "world",
      projection: "dom-aligned",
      defaultCameraId: "world.camera",
      defaultPass: true,
    });
  });

  test("normalizes camera defaults under an explicit scene", () => {
    expect(
      normalizeRenderLayerCameraDeclaration({
        id: " world.camera ",
        sceneId: " world ",
        default: true,
      }),
    ).toEqual({
      id: "world.camera",
      sceneId: "world",
      type: "orthographic",
      mode: "dom-aligned",
      default: true,
    });
  });

  test("normalizes pass defaults and derives id from scene plus camera", () => {
    expect(
      normalizeRenderLayerPassDeclaration({
        sceneId: " world ",
        cameraId: " world.camera ",
      }),
    ).toEqual({
      id: "world:world.camera:pass",
      sceneId: "world",
      cameraId: "world.camera",
      order: 0,
    });
  });

  test("keeps explicit target scene ids trimmed and defaults missing ids to the generated scene", () => {
    expect(normalizeTargetSceneId(" overlay ")).toBe("overlay");
    expect(normalizeTargetSceneId(undefined)).toBe("__dom-webgl-default__");
  });

  test("rejects empty ids and generated default overrides while allowing user main ids", () => {
    expect(() => normalizeRenderLayerSceneDeclaration({ id: " " })).toThrow(
      "WebGL scene declaration requires a non-empty id.",
    );
    expect(normalizeRenderLayerSceneDeclaration({ id: "main" })).toEqual({
      id: "main",
      projection: "dom-aligned",
      defaultPass: false,
    });
    expect(() =>
      normalizeRenderLayerSceneDeclaration({ id: "__dom-webgl-default__" }),
    ).toThrow(
      'WebGL scene id "__dom-webgl-default__" is reserved by the generated Level 1 scene.',
    );
    expect(() =>
      normalizeRenderLayerCameraDeclaration({
        id: "__dom-webgl-default__",
        sceneId: "world",
      }),
    ).toThrow(
      'WebGL camera id "__dom-webgl-default__" is reserved by the generated Level 1 camera.',
    );
    expect(() =>
      normalizeRenderLayerSceneDeclaration({
        id: "world",
        defaultCameraId: "__dom-webgl-default__",
      }),
    ).toThrow(
      'WebGL camera id "__dom-webgl-default__" is reserved by the generated Level 1 camera.',
    );
    expect(() =>
      normalizeRenderLayerPassDeclaration({
        id: "__dom-webgl-default__",
        sceneId: "world",
      }),
    ).toThrow(
      'WebGL render pass id "__dom-webgl-default__" is reserved by the generated Level 1 pass.',
    );
  });

  test("rejects future projection and camera policies in Phase 2", () => {
    const invalidSceneDeclaration: WebGLSceneDeclaration = {
      id: "world",
      // @ts-expect-error Phase 2 does not expose perspective-stage projection.
      projection: "perspective-stage",
    };
    const invalidCameraDeclaration: WebGLCameraDeclaration = {
      id: "world.camera",
      sceneId: "world",
      // @ts-expect-error Phase 2 does not expose perspective cameras.
      type: "perspective",
    };

    expect(() =>
      normalizeRenderLayerSceneDeclaration(invalidSceneDeclaration),
    ).toThrow('Unsupported WebGL scene projection "perspective-stage".');
    expect(() =>
      normalizeRenderLayerCameraDeclaration(invalidCameraDeclaration),
    ).toThrow('Unsupported WebGL camera type "perspective".');
  });
});
