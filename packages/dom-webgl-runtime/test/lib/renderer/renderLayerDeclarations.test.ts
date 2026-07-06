import { describe, expect, test } from "vitest";

import {
  assertCameraMatchesSceneProjection,
  normalizeRenderLayerCameraDeclaration,
  normalizeRenderLayerPassDeclaration,
  normalizeRenderLayerSceneDeclaration,
  normalizeTargetPlacement,
  normalizeTargetSceneId,
} from "../../../src/lib/renderer/renderLayerDeclarations";

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

  test("normalizes scene timeline metadata", () => {
    expect(
      normalizeRenderLayerSceneDeclaration({
        id: " world ",
        timeline: {
          id: " hero.3d ",
          progressKey: " scroll.hero ",
          active: { from: 0.2, to: 0.8 },
        },
      }),
    ).toEqual({
      id: "world",
      projection: "dom-aligned",
      defaultPass: false,
      timeline: {
        id: "hero.3d",
        progressKey: "scroll.hero",
        active: { from: 0.2, to: 0.8 },
      },
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
      clear: false,
      clearDepth: false,
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

  test("normalizes screen scene camera pass and placement descriptors", () => {
    expect(
      normalizeRenderLayerSceneDeclaration({
        id: " overlay ",
        projection: "screen",
        defaultCameraId: " overlay.camera ",
      }),
    ).toEqual({
      id: "overlay",
      projection: "screen",
      defaultCameraId: "overlay.camera",
      defaultPass: false,
    });

    expect(
      normalizeRenderLayerCameraDeclaration({
        id: " overlay.camera ",
        sceneId: " overlay ",
        type: "orthographic",
        mode: "screen",
        default: true,
        zoom: 1.25,
      }),
    ).toEqual({
      id: "overlay.camera",
      sceneId: "overlay",
      type: "orthographic",
      mode: "screen",
      default: true,
      zoom: 1.25,
    });

    expect(
      normalizeRenderLayerPassDeclaration({
        sceneId: " overlay ",
        cameraId: " overlay.camera ",
        clearDepth: true,
      }),
    ).toEqual({
      id: "overlay:overlay.camera:pass",
      sceneId: "overlay",
      cameraId: "overlay.camera",
      order: 0,
      clear: false,
      clearDepth: true,
    });

    expect(
      normalizeTargetPlacement({
        mode: "screen-anchored",
        anchor: "top-right",
        offset: [-32, 32],
        size: [180, 48],
      }),
    ).toEqual({
      mode: "screen-anchored",
      anchor: "top-right",
      offset: [-32, 32],
      size: [180, 48],
    });
  });

  test("normalizes perspective stage camera and placement descriptors", () => {
    expect(
      normalizeRenderLayerSceneDeclaration({
        id: "world",
        projection: "perspective-stage",
        defaultPass: true,
      }),
    ).toEqual({
      id: "world",
      projection: "perspective-stage",
      defaultPass: true,
    });

    expect(
      normalizeRenderLayerCameraDeclaration({
        id: "world.camera",
        sceneId: "world",
        type: "perspective",
        mode: "perspective-stage",
        fov: 50,
        near: 0.1,
        far: 2000,
        position: [0, 0, 500],
        target: [0, 0, 0],
      }),
    ).toEqual({
      id: "world.camera",
      sceneId: "world",
      type: "perspective",
      mode: "perspective-stage",
      default: false,
      fov: 50,
      near: 0.1,
      far: 2000,
      position: [0, 0, 500],
      target: [0, 0, 0],
    });

    expect(
      normalizeRenderLayerCameraDeclaration({
        id: "world.controller.camera",
        sceneId: "world",
        type: "perspective",
        mode: "perspective-stage",
        position: [0, 0, 700],
        target: [0, 0, 0],
        fov: 44,
        controller: {
          timeline: {
            id: " hero.timeline ",
            progressKey: " hero.progress ",
            range: { from: 0.1, to: 0.9 },
          },
          to: {
            position: [0, 120, 520],
            target: [0, 48, 0],
            fov: 34,
          },
          easing: "smoothstep",
        },
      }),
    ).toEqual({
      id: "world.controller.camera",
      sceneId: "world",
      type: "perspective",
      mode: "perspective-stage",
      default: false,
      fov: 44,
      position: [0, 0, 700],
      target: [0, 0, 0],
      controller: {
        timeline: {
          id: "hero.timeline",
          progressKey: "hero.progress",
          range: { from: 0.1, to: 0.9 },
        },
        to: {
          position: [0, 120, 520],
          target: [0, 48, 0],
          fov: 34,
        },
        easing: "smoothstep",
      },
    });

    expect(normalizeTargetPlacement({ mode: "screen-depth", depth: 500 })).toEqual({
      mode: "screen-depth",
      depth: 500,
      size: "dom",
    });

    expect(
      normalizeTargetPlacement({
        mode: "stage-local",
        position: [0, 0, 0],
        rotation: [0, Math.PI, 0],
        scale: 1.2,
        size: [240, 240],
      }),
    ).toEqual({
      mode: "stage-local",
      position: [0, 0, 0],
      rotation: [0, Math.PI, 0],
      scale: 1.2,
      size: [240, 240],
    });

    expect(
      normalizeTargetPlacement({
        mode: "screen-plane",
        planeId: " floor ",
        offset: [1, 2, 3],
        scale: [1.5, 0.5],
      }),
    ).toEqual({
      mode: "screen-plane",
      planeId: "floor",
      offset: [1, 2, 3],
      scale: [1.5, 0.5],
    });

    expect(() =>
      normalizeTargetPlacement({ mode: "screen-plane", planeId: " " }),
    ).toThrow("WebGL screen-plane planeId declaration requires a non-empty id.");
  });

  test("rejects invalid camera controller declarations during camera normalization", () => {
    expect(() =>
      normalizeRenderLayerCameraDeclaration({
        id: "world.camera",
        sceneId: "world",
        type: "perspective",
        mode: "perspective-stage",
        controller: {
          timeline: "hero.timeline",
          to: {},
        },
      }),
    ).toThrow(
      'WebGL camera controller "to" must include position, target, or fov.',
    );
  });

  test("rejects incompatible scene and camera policies", () => {
    expect(() =>
      assertCameraMatchesSceneProjection(
        { id: "overlay", projection: "screen" },
        {
          id: "overlay.camera",
          type: "orthographic",
          mode: "dom-aligned",
        },
      ),
    ).toThrow(
      'WebGL camera "overlay.camera" uses orthographic/dom-aligned but scene "overlay" uses projection "screen".',
    );

    expect(() =>
      assertCameraMatchesSceneProjection(
        { id: "overlay", projection: "screen" },
        {
          id: "overlay.camera",
          type: "perspective",
          mode: "perspective-stage",
        },
      ),
    ).toThrow(
      'WebGL camera "overlay.camera" uses perspective/perspective-stage but scene "overlay" uses projection "screen".',
    );

    expect(() =>
      assertCameraMatchesSceneProjection(
        { id: "world", projection: "perspective-stage" },
        {
          id: "world.camera",
          type: "orthographic",
          mode: "screen",
        },
      ),
    ).toThrow(
      'WebGL camera "world.camera" uses orthographic/screen but scene "world" uses projection "perspective-stage".',
    );
  });
});
