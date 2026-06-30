import { describe, expect, test, vi } from "vitest";

import { createEffectContext } from "./effectContext";
import {
  exampleImageHoverRevealEffect,
  exampleImageKenBurnsEffect,
  exampleImagePanEffect,
  exampleImageZoomEffect,
  exampleVideoDriftEffect,
  exampleVideoPlaybackEffect,
} from "../src/mediaEffects";

describe("media example effects", () => {
  test("image pan applies a texture transform only to image sources", () => {
    const image = {
      setTextureTransform: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "media",
        type: "image",
        element: document.createElement("img"),
        src: "/example/image.png",
        image,
      },
      layout: { top: 354, height: 60, viewport: { width: 1024, height: 768 } },
      scrollProgress: 0.5,
    });

    exampleImagePanEffect.update(context, undefined, {
      kind: "example.imagePan",
      distance: 0.2,
    });

    expect(exampleImagePanEffect.source).toBe("media/image");
    expect(image.setTextureTransform).toHaveBeenCalledWith({
      repeatX: 1.12,
      repeatY: 1.12,
      offsetX: 0.1,
      offsetY: 0,
    });
  });

  test("image pan uses target viewport position when global scroll progress is still low", () => {
    const image = {
      setTextureTransform: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "media",
        type: "image",
        element: document.createElement("img"),
        src: "/example/image.png",
        image,
      },
      layout: { top: 120, height: 240, viewport: { width: 1024, height: 768 } },
      scrollProgress: 0,
    });

    exampleImagePanEffect.update(context, undefined, {
      kind: "example.imagePan",
      distance: 0.2,
    });

    expect(image.setTextureTransform).toHaveBeenCalledWith(
      expect.objectContaining({
        offsetX: expect.any(Number),
      }),
    );
    expect(image.setTextureTransform.mock.calls[0]?.[0].offsetX).toBeGreaterThan(0);
  });

  test("image zoom drives target scale for image sources", () => {
    const target = {
      setScale: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "media",
        type: "image",
        element: document.createElement("img"),
        src: "/example/image.png",
        image: {},
      },
      target,
      time: 800,
    });

    exampleImageZoomEffect.update(context, undefined, {
      kind: "example.imageZoom",
      maxScale: 1.36,
    });

    expect(exampleImageZoomEffect.source).toBe("media/image");
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setScale).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 1);
  });

  test("image ken burns combines texture transform and target scale", () => {
    const image = {
      setTextureTransform: vi.fn(),
    };
    const target = {
      setScale: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "media",
        type: "image",
        element: document.createElement("img"),
        src: "/example/bg.png",
        image,
      },
      target,
      time: 1200,
    });

    exampleImageKenBurnsEffect.update(context, undefined, {
      kind: "example.imageKenBurns",
      distance: 0.16,
      maxScale: 1.22,
    });

    expect(exampleImageKenBurnsEffect.source).toBe("media/image");
    expect(image.setTextureTransform).toHaveBeenCalledWith({
      repeatX: expect.any(Number),
      repeatY: expect.any(Number),
      offsetX: expect.any(Number),
      offsetY: expect.any(Number),
    });
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setScale).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 1);
  });

  test("image hover reveal creates a material layer with a second image texture", () => {
    const layer = {
      setProgram: vi.fn(),
      setUniforms: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
    };
    const image = {
      createMaterialLayer: vi.fn(() => layer),
      invalidate: vi.fn(),
      setVisible: vi.fn(),
      setOpacity: vi.fn(),
    };
    const target = {
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "media",
        type: "image",
        element: document.createElement("img"),
        src: "/example/show.png",
        image,
      },
      target,
      layout: { left: 20, top: 30, width: 320, height: 180 },
      pointer: { x: 140, y: 102, isInside: true },
    });

    const state = exampleImageHoverRevealEffect.setup?.(context, {
      kind: "example.imageHoverReveal",
      revealSrc: "/example/mask.png",
      radius: 84,
      feather: 20,
      roughness: 0.28,
    });
    if (!state) {
      throw new Error("Expected example.imageHoverReveal setup state");
    }

    exampleImageHoverRevealEffect.update(context, state, {
      kind: "example.imageHoverReveal",
      revealSrc: "/example/mask.png",
      radius: 84,
      feather: 20,
      roughness: 0.28,
    });

    expect(exampleImageHoverRevealEffect.source).toBe("media/image");
    expect(image.createMaterialLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "example.imageHoverReveal",
        mode: "replace-source",
        program: expect.objectContaining({
          fragmentShader: expect.stringContaining("uMaskTexture"),
          uniforms: expect.objectContaining({
            uMaskTexture: expect.objectContaining({ kind: "canvas-texture" }),
            uRevealTexture: expect.objectContaining({ kind: "canvas-texture" }),
            uRoughness: 0.28,
          }),
        }),
        sourceTextureUniform: "uBaseTexture",
      }),
    );
    expect(state.revealImage?.src).toContain("/example/mask.png");
    expect(layer.setUniforms).toHaveBeenLastCalledWith(
      expect.objectContaining({
        uPointer: [120, 72],
        uPointerActive: true,
        uRadius: 84,
        uFeather: 20,
        uRoughness: 0.28,
        uTrailOpacity: 1,
        uMaskTexture: expect.objectContaining({ kind: "canvas-texture" }),
        uTargetSize: [320, 180],
      }),
    );
    expect(image.createMaterialLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        program: expect.objectContaining({
          fragmentShader: expect.not.stringContaining("dissolveNoise"),
        }),
      }),
    );
    expect(layer.setUniforms.mock.calls.at(-1)?.[0]).not.toHaveProperty("uRevealTexture");
    expect(image.setVisible).toHaveBeenCalledWith(true);
    expect(image.setOpacity).toHaveBeenCalledWith(1);
    expect(target.setVisible).toHaveBeenCalledWith(true);
  });

  test("image hover reveal accumulates the trail into a mask texture instead of a point window", () => {
    const layer = {
      setProgram: vi.fn(),
      setUniforms: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
    };
    const image = {
      createMaterialLayer: vi.fn(() => layer),
      invalidate: vi.fn(),
      setVisible: vi.fn(),
      setOpacity: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "media",
        type: "image",
        element: document.createElement("img"),
        src: "/example/show.png",
        image,
      },
      layout: { left: 0, top: 0, width: 320, height: 180 },
      pointer: { x: 12, y: 20, isInside: true },
      time: 0,
    });

    const state = exampleImageHoverRevealEffect.setup?.(context, {
      kind: "example.imageHoverReveal",
      revealSrc: "/example/mask.png",
    });
    if (!state) {
      throw new Error("Expected example.imageHoverReveal setup state");
    }

    expect(image.createMaterialLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        program: expect.objectContaining({
          fragmentShader: expect.stringContaining("uMaskTexture"),
        }),
      }),
    );
    expect(image.createMaterialLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        program: expect.objectContaining({
          fragmentShader: expect.not.stringContaining("uTrailPoints"),
        }),
      }),
    );
    expect(image.createMaterialLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        program: expect.objectContaining({
          fragmentShader: expect.not.stringContaining("uTrailCount"),
        }),
      }),
    );

    for (let index = 0; index < 80; index++) {
      exampleImageHoverRevealEffect.update(
        createEffectContext({
          source: {
            kind: "media",
            type: "image",
            element: document.createElement("img"),
            src: "/example/show.png",
            image,
          },
          layout: { left: 0, top: 0, width: 320, height: 180 },
          pointer: { x: 12 + index * 2, y: 20, isInside: true },
          time: index * 50,
        }),
        state,
        {
          kind: "example.imageHoverReveal",
          revealSrc: "/example/mask.png",
        },
      );
    }

    expect(layer.setUniforms).toHaveBeenLastCalledWith(
      expect.not.objectContaining({
        uTrailPoints: expect.anything(),
        uTrailCount: expect.anything(),
      }),
    );
    expect(layer.setUniforms).toHaveBeenLastCalledWith(
      expect.objectContaining({
        uMaskTexture: expect.objectContaining({ kind: "canvas-texture" }),
        uTrailOpacity: 1,
      }),
    );
  });

  test("image hover reveal refreshes the reveal texture after the image loads", () => {
    const layer = {
      setProgram: vi.fn(),
      setUniforms: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
    };
    const image = {
      createMaterialLayer: vi.fn(() => layer),
      invalidate: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "media",
        type: "image",
        element: document.createElement("img"),
        src: "/example/show.png",
        image,
      },
    });

    const state = exampleImageHoverRevealEffect.setup?.(context, {
      kind: "example.imageHoverReveal",
      revealSrc: "/example/mask.png",
    });
    if (!state?.revealImage?.onload) {
      throw new Error("Expected reveal image load handler");
    }

    state.revealImage.onload(new Event("load"));

    expect(layer.setUniforms).toHaveBeenCalledWith(
      expect.objectContaining({
        uRevealReady: true,
        uRevealTexture: { kind: "image-texture", source: state.revealImage },
      }),
    );
    expect(image.invalidate).toHaveBeenCalled();
  });

  test("image hover reveal keeps an eraser trail that fades as one layer after the pointer leaves", () => {
    const layer = {
      setProgram: vi.fn(),
      setUniforms: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
    };
    const image = {
      createMaterialLayer: vi.fn(() => layer),
      invalidate: vi.fn(),
      setVisible: vi.fn(),
      setOpacity: vi.fn(),
    };
    const insideContext = createEffectContext({
      source: {
        kind: "media",
        type: "image",
        element: document.createElement("img"),
        src: "/example/show.png",
        image,
      },
      layout: { left: 20, top: 30, width: 320, height: 180 },
      pointer: { x: 140, y: 102, isInside: true },
      time: 100,
    });

    const state = exampleImageHoverRevealEffect.setup?.(insideContext, {
      kind: "example.imageHoverReveal",
      revealSrc: "/example/mask.png",
      restoreMs: 2000,
    });
    if (!state?.revealImage?.onload) {
      throw new Error("Expected example.imageHoverReveal setup state");
    }
    state.revealImage.onload(new Event("load"));

    exampleImageHoverRevealEffect.update(insideContext, state, {
      kind: "example.imageHoverReveal",
      revealSrc: "/example/mask.png",
      restoreMs: 2000,
    });

    expect(layer.setUniforms).toHaveBeenLastCalledWith(
      expect.objectContaining({
        uMaskTexture: expect.objectContaining({ kind: "canvas-texture" }),
        uTrailOpacity: 1,
      }),
    );

    const outsideContext = createEffectContext({
      source: {
        kind: "media",
        type: "image",
        element: document.createElement("img"),
        src: "/example/show.png",
        image,
      },
      layout: { left: 20, top: 30, width: 320, height: 180 },
      pointer: { x: 0, y: 0, isInside: false },
      time: 1000,
    });

    exampleImageHoverRevealEffect.update(outsideContext, state, {
      kind: "example.imageHoverReveal",
      revealSrc: "/example/mask.png",
      restoreMs: 2000,
    });

    expect(layer.setUniforms).toHaveBeenLastCalledWith(
      expect.objectContaining({
        uPointerActive: false,
        uTrailOpacity: 0.55,
      }),
    );
  });

  test("image hover reveal fades while the pointer is stationary inside the target", () => {
    const layer = {
      setProgram: vi.fn(),
      setUniforms: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
    };
    const image = {
      createMaterialLayer: vi.fn(() => layer),
      invalidate: vi.fn(),
      setVisible: vi.fn(),
      setOpacity: vi.fn(),
    };
    const state = exampleImageHoverRevealEffect.setup?.(
      createEffectContext({
        source: {
          kind: "media",
          type: "image",
          element: document.createElement("img"),
          src: "/example/show.png",
          image,
        },
        layout: { left: 20, top: 30, width: 320, height: 180 },
        pointer: { x: 140, y: 102, isInside: true },
        time: 100,
      }),
      {
        kind: "example.imageHoverReveal",
        revealSrc: "/example/mask.png",
        restoreMs: 2000,
      },
    );
    if (!state?.revealImage?.onload) {
      throw new Error("Expected example.imageHoverReveal setup state");
    }
    state.revealImage.onload(new Event("load"));

    const params = {
      kind: "example.imageHoverReveal",
      revealSrc: "/example/mask.png",
      restoreMs: 2000,
    } as const;
    exampleImageHoverRevealEffect.update(
      createEffectContext({
        source: {
          kind: "media",
          type: "image",
          element: document.createElement("img"),
          src: "/example/show.png",
          image,
        },
        layout: { left: 20, top: 30, width: 320, height: 180 },
        pointer: { x: 140, y: 102, isInside: true },
        time: 100,
      }),
      state,
      params,
    );
    exampleImageHoverRevealEffect.update(
      createEffectContext({
        source: {
          kind: "media",
          type: "image",
          element: document.createElement("img"),
          src: "/example/show.png",
          image,
        },
        layout: { left: 20, top: 30, width: 320, height: 180 },
        pointer: { x: 140, y: 102, isInside: true },
        time: 1000,
      }),
      state,
      params,
    );

    expect(layer.setUniforms).toHaveBeenLastCalledWith(
      expect.objectContaining({
        uPointerActive: true,
        uTrailOpacity: 0.55,
      }),
    );
  });

  test("image hover reveal bakes faded mask opacity before drawing a new stroke", () => {
    const fakeContext = createFakeCanvasContext();
    vi.stubGlobal("CanvasRenderingContext2D", function CanvasRenderingContext2D() {});
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(fakeContext as unknown as CanvasRenderingContext2D);
    try {
      const layer = {
        setProgram: vi.fn(),
        setUniforms: vi.fn(),
        clear: vi.fn(),
        dispose: vi.fn(),
      };
      const image = {
        createMaterialLayer: vi.fn(() => layer),
        invalidate: vi.fn(),
        setVisible: vi.fn(),
        setOpacity: vi.fn(),
      };
      const state = exampleImageHoverRevealEffect.setup?.(
        createEffectContext({
          source: {
            kind: "media",
            type: "image",
            element: document.createElement("img"),
            src: "/example/show.png",
            image,
          },
          layout: { left: 0, top: 0, width: 320, height: 180 },
          pointer: { x: 50, y: 50, isInside: true },
          time: 100,
        }),
        {
          kind: "example.imageHoverReveal",
          revealSrc: "/example/mask.png",
          restoreMs: 2000,
        },
      );
      if (!state?.revealImage?.onload) {
        throw new Error("Expected example.imageHoverReveal setup state");
      }
      state.revealImage.onload(new Event("load"));

      const params = {
        kind: "example.imageHoverReveal",
        revealSrc: "/example/mask.png",
        restoreMs: 2000,
      } as const;
      exampleImageHoverRevealEffect.update(
        createEffectContext({
          source: {
            kind: "media",
            type: "image",
            element: document.createElement("img"),
            src: "/example/show.png",
            image,
          },
          layout: { left: 0, top: 0, width: 320, height: 180 },
          pointer: { x: 50, y: 50, isInside: true },
          time: 100,
        }),
        state,
        params,
      );
      exampleImageHoverRevealEffect.update(
        createEffectContext({
          source: {
            kind: "media",
            type: "image",
            element: document.createElement("img"),
            src: "/example/show.png",
            image,
          },
          layout: { left: 0, top: 0, width: 320, height: 180 },
          pointer: { x: 50, y: 50, isInside: true },
          time: 1000,
        }),
        state,
        params,
      );
      exampleImageHoverRevealEffect.update(
        createEffectContext({
          source: {
            kind: "media",
            type: "image",
            element: document.createElement("img"),
            src: "/example/show.png",
            image,
          },
          layout: { left: 0, top: 0, width: 320, height: 180 },
          pointer: { x: 90, y: 50, isInside: true },
          time: 1100,
        }),
        state,
        params,
      );

      expect(fakeContext.operations).toContain("composite:destination-in");
      expect(fakeContext.alphaValues).toContain(0.5);
      expect(layer.setUniforms).toHaveBeenLastCalledWith(
        expect.objectContaining({
          uTrailOpacity: 1,
        }),
      );
    } finally {
      getContext.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  test("image hover reveal draws irregular polygon stamps without radial circle gradients", () => {
    const fakeContext = createFakeCanvasContext();
    vi.stubGlobal("CanvasRenderingContext2D", function CanvasRenderingContext2D() {});
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(fakeContext as unknown as CanvasRenderingContext2D);
    try {
      const layer = {
        setProgram: vi.fn(),
        setUniforms: vi.fn(),
        clear: vi.fn(),
        dispose: vi.fn(),
      };
      const image = {
        createMaterialLayer: vi.fn(() => layer),
        invalidate: vi.fn(),
        setVisible: vi.fn(),
        setOpacity: vi.fn(),
      };
      const context = createEffectContext({
        source: {
          kind: "media",
          type: "image",
          element: document.createElement("img"),
          src: "/example/show.png",
          image,
        },
        layout: { left: 0, top: 0, width: 320, height: 180 },
        pointer: { x: 80, y: 80, isInside: true },
        time: 100,
      });

      const state = exampleImageHoverRevealEffect.setup?.(context, {
        kind: "example.imageHoverReveal",
        revealSrc: "/example/mask.png",
        roughness: 0.3,
      });
      if (!state?.revealImage?.onload) {
        throw new Error("Expected example.imageHoverReveal setup state");
      }
      state.revealImage.onload(new Event("load"));
      exampleImageHoverRevealEffect.update(context, state, {
        kind: "example.imageHoverReveal",
        revealSrc: "/example/mask.png",
        roughness: 0.3,
      });

      expect(fakeContext.createRadialGradient).not.toHaveBeenCalled();
      expect(fakeContext.lineTo.mock.calls.length).toBeGreaterThan(50);
      expect(fakeContext.lineTo.mock.calls.length).toBeLessThan(200);
    } finally {
      getContext.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  test("image hover reveal disposes the material layer", () => {
    const layer = {
      setProgram: vi.fn(),
      setUniforms: vi.fn(),
      clear: vi.fn(),
      dispose: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "media",
        type: "image",
        element: document.createElement("img"),
        src: "/example/show.png",
        image: {
          createMaterialLayer: vi.fn(() => layer),
        },
      },
    });

    const state = exampleImageHoverRevealEffect.setup?.(context, {
      kind: "example.imageHoverReveal",
      revealSrc: "/example/mask.png",
    });
    if (!state) {
      throw new Error("Expected example.imageHoverReveal setup state");
    }

    exampleImageHoverRevealEffect.dispose?.(context, state, {
      kind: "example.imageHoverReveal",
      revealSrc: "/example/mask.png",
    });

    expect(layer.dispose).toHaveBeenCalledTimes(1);
    expect(state.layer).toBeUndefined();
    expect(state.revealImage).toBeUndefined();
  });

  test("video playback configures media once during setup", () => {
    const video = {
      play: vi.fn(),
      setMuted: vi.fn(),
      setPlaybackRate: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "media",
        type: "video",
        element: document.createElement("video"),
        src: "/example/video.mp4",
        video,
      },
    });

    const state = exampleVideoPlaybackEffect.setup?.(context, {
      kind: "example.videoPlayback",
      playbackRate: 0.8,
    });
    if (!state) {
      throw new Error("Expected example.videoPlayback setup state");
    }
    exampleVideoPlaybackEffect.update(context, state, {
      kind: "example.videoPlayback",
      playbackRate: 0.8,
    });

    expect(exampleVideoPlaybackEffect.source).toBe("media/video");
    expect(video.setMuted).toHaveBeenCalledWith(true);
    expect(video.setPlaybackRate).toHaveBeenCalledWith(0.8);
    expect(video.play).toHaveBeenCalledTimes(1);
  });

  test("video drift applies a texture transform to video sources", () => {
    const video = {
      setTextureTransform: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "media",
        type: "video",
        element: document.createElement("video"),
        src: "/example/video.mp4",
        video,
      },
      time: 900,
    });

    exampleVideoDriftEffect.update(context, undefined, {
      kind: "example.videoDrift",
      distance: 0.12,
    });

    expect(exampleVideoDriftEffect.source).toBe("media/video");
    expect(video.setTextureTransform).toHaveBeenCalledWith({
      repeatX: 1.08,
      repeatY: 1.08,
      offsetX: expect.any(Number),
      offsetY: expect.any(Number),
    });
  });

});

function createFakeCanvasContext() {
  const operations: string[] = [];
  const alphaValues: number[] = [];
  const context = {
    operations,
    alphaValues,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    set globalCompositeOperation(value: string) {
      operations.push(`composite:${value}`);
    },
    get globalCompositeOperation() {
      return "source-over";
    },
    set globalAlpha(value: number) {
      alphaValues.push(value);
    },
    get globalAlpha() {
      return 1;
    },
    set fillStyle(_value: unknown) {
      return;
    },
    get fillStyle() {
      return "#fff";
    },
  };

  return context;
}
