import { describe, expect, test, vi } from "vitest";

import type { WebGLEffectCanvasDrawer } from "@project/dom-webgl-runtime";

import { createEffectContext } from "./effectContext";
import {
  exampleModelDarkSceneEffect,
  exampleSurfaceFillEffect,
  exampleSurfaceGhostCursorEffect,
  exampleSurfacePulseEffect,
  exampleSurfaceVideoBackgroundEffect,
  exampleSurfaceWavesEffect,
} from "../src/surfaceEffects";

describe("surface example effects", () => {
  test("surface fill draws once for element snapshots and no-ops for unsupported sources", () => {
    const surface = {
      draw: vi.fn(),
      setOpacity: vi.fn(),
      setVisible: vi.fn(),
    };
    const target = {
      setOpacity: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
          type: "element",
        element: document.createElement("section"),
        surface,
      },
      target,
    });

    const state = exampleSurfaceFillEffect.setup?.(context, {
      kind: "example.surfaceFill",
      imageSrc: "/example/bg.png",
      opacity: 0.72,
    });
    if (!state) {
      throw new Error("Expected example.surfaceFill setup state");
    }
    exampleSurfaceFillEffect.update(context, state, {
      kind: "example.surfaceFill",
      imageSrc: "/example/bg.png",
      opacity: 0.72,
    });
    exampleSurfaceFillEffect.update(
      createEffectContext({
        source: {
          kind: "dom",
          type: "text",
          element: document.createElement("p"),
          text: "Wrong source",
        },
      }),
      state,
      { kind: "example.surfaceFill", imageSrc: "/example/bg.png", opacity: 1 },
    );

    expect(exampleSurfaceFillEffect.source).toBe("dom/element");
    expect(surface.draw).toHaveBeenCalledTimes(1);
    expect(surface.setVisible).toHaveBeenCalledWith(true);
    expect(surface.setOpacity).toHaveBeenCalledWith(0.72);
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setOpacity).not.toHaveBeenCalled();
  });

  test("model dark scene draws an opaque black WebGL surface backdrop", () => {
    let drawSurface: WebGLEffectCanvasDrawer | undefined;
    const surface = {
      draw: vi.fn((drawer: WebGLEffectCanvasDrawer) => {
        drawSurface = drawer;
      }),
      setOpacity: vi.fn(),
      setVisible: vi.fn(),
    };
    const target = {
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
          type: "element",
        element: document.createElement("section"),
        surface,
      },
      target,
    });

    exampleModelDarkSceneEffect.update(context, undefined, {
      kind: "example.modelDarkScene",
    });

    expect(exampleModelDarkSceneEffect.source).toBe("dom/element");
    expect(surface.draw).toHaveBeenCalledTimes(1);
    expect(surface.setVisible).toHaveBeenCalledWith(true);
    expect(surface.setOpacity).toHaveBeenCalledWith(1);
    expect(target.setVisible).toHaveBeenCalledWith(true);
    if (!drawSurface) {
      throw new Error("Expected example.modelDarkScene to draw a surface");
    }

    const canvasContext = createModelDarkSceneContext();
    drawSurface({
      canvas: document.createElement("canvas"),
      context: canvasContext,
      width: 320,
      height: 180,
      devicePixelRatio: 1,
    });

    expect(canvasContext.clearRect).toHaveBeenCalledWith(0, 0, 320, 180);
    expect(canvasContext.fillStyle).toBe("#000000");
    expect(canvasContext.fillRect).toHaveBeenCalledWith(0, 0, 320, 180);
    expect(canvasContext.createRadialGradient).not.toHaveBeenCalled();
  });

  test("surface pulse visibly animates surface opacity for element snapshots", () => {
    const surface = {
      draw: vi.fn(),
      setOpacity: vi.fn(),
      setVisible: vi.fn(),
    };
    const target = {
      setOpacity: vi.fn(),
      setScale: vi.fn(),
      setVisible: vi.fn(),
    };
    const layout = {
      key: "example.test",
      left: 0,
      top: 0,
      width: 120,
      height: 60,
      viewport: { width: 1024, height: 768 },
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
          type: "element",
        element: document.createElement("section"),
        surface,
      },
      layout,
      target,
      time: 520,
    });

    exampleSurfacePulseEffect.update(context, undefined, {
      kind: "example.surfacePulse",
      scale: 1.2,
      opacity: 0.76,
    });
    exampleSurfacePulseEffect.update(
      createEffectContext({
        source: {
          kind: "dom",
          type: "element",
          element: document.createElement("section"),
          surface,
        },
        target,
        time: 1040,
      }),
      undefined,
      {
        kind: "example.surfacePulse",
        scale: 1.2,
        opacity: 0.76,
      },
    );

    expect(exampleSurfacePulseEffect.source).toBe("dom/element");
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setScale).not.toHaveBeenCalled();
    expect(target.setOpacity).not.toHaveBeenCalled();
    expect(surface.setVisible).toHaveBeenCalledWith(true);
    expect(surface.draw).toHaveBeenCalledTimes(2);
    expect(surface.setOpacity).toHaveBeenCalledTimes(2);
    expect(surface.setOpacity).toHaveBeenCalledWith(1);
  });

  test("surface video background prepares an autoplaying looping texture source", () => {
    const previousPlay = HTMLMediaElement.prototype.play;
    const previousPause = HTMLMediaElement.prototype.pause;
    const previousLoad = HTMLMediaElement.prototype.load;
    const play = vi.fn(() => Promise.resolve());
    const pause = vi.fn();
    const load = vi.fn();
    HTMLMediaElement.prototype.play = play;
    HTMLMediaElement.prototype.pause = pause;
    HTMLMediaElement.prototype.load = load;
    const surface = {
      draw: vi.fn(),
      setOpacity: vi.fn(),
      setVisible: vi.fn(),
      invalidate: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
          type: "element",
        element: document.createElement("section"),
        surface,
      },
      target: {
        setVisible: vi.fn(),
      },
    });

    try {
      const state = exampleSurfaceVideoBackgroundEffect.setup?.(context, {
        kind: "example.surfaceVideoBackground",
        videoSrc: "/example/bg.mp4",
        opacity: 0.84,
      });
      if (!state) {
        throw new Error("Expected example.surfaceVideoBackground setup state");
      }

      exampleSurfaceVideoBackgroundEffect.update(context, state, {
        kind: "example.surfaceVideoBackground",
        videoSrc: "/example/bg.mp4",
        opacity: 0.84,
      });

      expect(exampleSurfaceVideoBackgroundEffect.source).toBe("dom/element");
      expect(state.video?.src).toContain("/example/bg.mp4");
      expect(state.video?.loop).toBe(true);
      expect(state.video?.muted).toBe(true);
      expect(state.video?.playsInline).toBe(true);
      expect(play).toHaveBeenCalled();
      expect(surface.draw).toHaveBeenCalled();
      expect(surface.setVisible).toHaveBeenCalledWith(true);
      expect(surface.setOpacity).toHaveBeenCalledWith(0.84);
      exampleSurfaceVideoBackgroundEffect.dispose?.(context, state, {
        kind: "example.surfaceVideoBackground",
        videoSrc: "/example/bg.mp4",
        opacity: 0.84,
      });
      expect(pause).toHaveBeenCalled();
      expect(load).toHaveBeenCalled();
      expect(state.video).toBeUndefined();
      expect(state.videoSrc).toBeUndefined();
    } finally {
      HTMLMediaElement.prototype.play = previousPlay;
      HTMLMediaElement.prototype.pause = previousPause;
      HTMLMediaElement.prototype.load = previousLoad;
    }
  });

  test("surface ghost cursor and waves use material layers instead of CPU canvas redraws", () => {
    const ghostLayer = {
      setProgram: vi.fn(),
      setUniforms: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
    };
    const wavesLayer = {
      setProgram: vi.fn(),
      setUniforms: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
    };
    const surface = {
      createMaterialLayer: vi.fn((options: { key: string }) =>
        options.key === "example.surfaceWaves" ? wavesLayer : ghostLayer
      ),
      draw: vi.fn(),
      setOpacity: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
          type: "element",
        element: document.createElement("section"),
        surface,
      },
      layout: {
        left: 10,
        top: 20,
        width: 320,
        height: 180,
      },
      pointer: {
        x: 170,
        y: 92,
        isInside: true,
      },
      target: {
        setVisible: vi.fn(),
      },
      time: 960,
    });

    const ghostState = exampleSurfaceGhostCursorEffect.setup?.(context, {
      kind: "example.surfaceGhostCursor",
      trailLength: 18,
      color: "#b497cf",
      opacity: 0.88,
    });
    if (!ghostState) {
      throw new Error("Expected example.surfaceGhostCursor setup state");
    }

    exampleSurfaceGhostCursorEffect.update(context, ghostState, {
      kind: "example.surfaceGhostCursor",
      trailLength: 18,
      color: "#b497cf",
      opacity: 0.88,
    });
    const state = exampleSurfaceWavesEffect.setup?.(context, {
      kind: "example.surfaceWaves",
      lineColor: "#172124",
      opacity: 0.82,
    });
    if (!state) {
      throw new Error("Expected example.surfaceWaves setup state");
    }

    exampleSurfaceWavesEffect.update(context, state, {
      kind: "example.surfaceWaves",
      lineColor: "#172124",
      opacity: 0.82,
    });

    expect(exampleSurfaceGhostCursorEffect.source).toBe("dom/element");
    expect(exampleSurfaceWavesEffect.source).toBe("dom/element");
    expect(surface.createMaterialLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "example.surfaceGhostCursor",
        mode: "replace-source",
        sourceTextureUniform: "uSource",
      }),
    );
    expect(ghostLayer.setUniforms).toHaveBeenCalledWith(
      expect.objectContaining({
        uPointer: expect.any(Array),
        uPointerIntensity: expect.any(Number),
        uTime: 960,
      }),
    );
    expect(surface.createMaterialLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "example.surfaceWaves",
        mode: "replace-source",
        sourceTextureUniform: "uSource",
        program: expect.objectContaining({
          fragmentShader: expect.stringContaining("uWaveDensity"),
          uniforms: expect.objectContaining({
            uLineColor: expect.any(Array),
            uOpacity: 0.82,
          }),
        }),
      }),
    );
    expect(wavesLayer.setUniforms).toHaveBeenCalledWith(
      expect.objectContaining({
        uPointer: expect.any(Array),
        uPointerActive: true,
        uTime: 960,
      }),
    );
    expect(surface.draw).not.toHaveBeenCalled();
    expect(surface.setVisible).toHaveBeenCalledWith(true);
    expect(surface.setOpacity).toHaveBeenCalledWith(1);
  });

  test("surface waves updates shader uniforms while pointer is outside because GPU waves keep moving", () => {
    const wavesLayer = {
      setProgram: vi.fn(),
      setUniforms: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
    };
    const surface = {
      createMaterialLayer: vi.fn(() => wavesLayer),
      draw: vi.fn(),
      setOpacity: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "dom",
          type: "element",
        element: document.createElement("section"),
        surface,
      },
      layout: {
        left: 10,
        top: 20,
        width: 320,
        height: 180,
      },
      pointer: {
        x: 0,
        y: 0,
        isInside: true,
      },
      target: {
        setVisible: vi.fn(),
      },
      time: 960,
    });

    const state = exampleSurfaceWavesEffect.setup?.(context, {
      kind: "example.surfaceWaves",
      lineColor: "#172124",
      opacity: 0.82,
    });
    if (!state) {
      throw new Error("Expected example.surfaceWaves setup state");
    }

    exampleSurfaceWavesEffect.update(context, state, {
      kind: "example.surfaceWaves",
      lineColor: "#172124",
      opacity: 0.82,
    });
    exampleSurfaceWavesEffect.update(
      createEffectContext({
        source: {
          kind: "dom",
          type: "element",
          element: document.createElement("section"),
          surface,
        },
        layout: {
          left: 10,
          top: 20,
          width: 320,
          height: 180,
        },
        pointer: {
          x: 0,
          y: 0,
          isInside: true,
        },
        target: {
          setVisible: vi.fn(),
        },
        time: 976,
      }),
      state,
      {
        kind: "example.surfaceWaves",
        lineColor: "#172124",
        opacity: 0.82,
      },
    );

    expect(surface.createMaterialLayer).toHaveBeenCalledTimes(1);
    expect(wavesLayer.setUniforms).toHaveBeenCalledTimes(2);
    expect(wavesLayer.setUniforms).toHaveBeenLastCalledWith(
      expect.objectContaining({
        uPointerActive: false,
        uTime: 976,
      }),
    );
    expect(surface.draw).not.toHaveBeenCalled();
    expect(surface.setVisible).toHaveBeenCalledWith(true);
    expect(surface.setOpacity).toHaveBeenLastCalledWith(1);
  });

  test("surface ghost cursor stops uniform updates after inactive trail decay", () => {
    const ghostLayer = {
      setProgram: vi.fn(),
      setUniforms: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
    };
    const surface = {
      createMaterialLayer: vi.fn(() => ghostLayer),
      setOpacity: vi.fn(),
      setVisible: vi.fn(),
    };
    const activeContext = createEffectContext({
      source: {
        kind: "dom",
          type: "element",
        element: document.createElement("section"),
        surface,
      },
      layout: {
        left: 10,
        top: 20,
        width: 320,
        height: 180,
      },
      pointer: {
        x: 170,
        y: 92,
        isInside: true,
      },
      target: {
        setVisible: vi.fn(),
      },
      time: 960,
    });
    const state = exampleSurfaceGhostCursorEffect.setup?.(activeContext, {
      kind: "example.surfaceGhostCursor",
      trailLength: 18,
      color: "#b497cf",
      opacity: 0.88,
    });
    if (!state) {
      throw new Error("Expected example.surfaceGhostCursor setup state");
    }
    exampleSurfaceGhostCursorEffect.update(activeContext, state, {
      kind: "example.surfaceGhostCursor",
      trailLength: 18,
      color: "#b497cf",
      opacity: 0.88,
    });
    const inactiveContext = createEffectContext({
      source: {
        kind: "dom",
          type: "element",
        element: document.createElement("section"),
        surface,
      },
      layout: {
        left: 10,
        top: 20,
        width: 320,
        height: 180,
      },
      pointer: {
        x: 0,
        y: 0,
        isInside: true,
      },
      target: {
        setVisible: vi.fn(),
      },
      time: 976,
    });

    for (let index = 0; index < 42; index += 1) {
      exampleSurfaceGhostCursorEffect.update(inactiveContext, state, {
        kind: "example.surfaceGhostCursor",
        trailLength: 18,
        color: "#b497cf",
        opacity: 0.88,
      });
    }
    ghostLayer.setUniforms.mockClear();
    exampleSurfaceGhostCursorEffect.update(inactiveContext, state, {
      kind: "example.surfaceGhostCursor",
      trailLength: 18,
      color: "#b497cf",
      opacity: 0.88,
    });

    expect(ghostLayer.setUniforms).not.toHaveBeenCalled();
    expect(surface.setVisible).toHaveBeenLastCalledWith(true);
    expect(surface.setOpacity).toHaveBeenLastCalledWith(1);
  });

});

function createModelDarkSceneContext(): CanvasRenderingContext2D & {
  fillStyle: string;
  clearRect: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  createRadialGradient: ReturnType<typeof vi.fn>;
} {
  const context = {
    fillStyle: "",
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  };

  return context as unknown as CanvasRenderingContext2D & {
    fillStyle: string;
    clearRect: ReturnType<typeof vi.fn>;
    fillRect: ReturnType<typeof vi.fn>;
    createRadialGradient: ReturnType<typeof vi.fn>;
  };
}
