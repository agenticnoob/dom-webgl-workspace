import { describe, expect, test, vi } from "vitest";

import {
  exampleImagePanEffect,
  exampleImageZoomEffect,
  exampleModelFloatEffect,
  exampleModelSpinEffect,
  exampleSurfaceFillEffect,
  exampleSurfacePulseEffect,
  exampleTextRevealEffect,
  exampleTextWaveEffect,
  exampleVideoDriftEffect,
  exampleVideoPlaybackEffect,
} from "./exampleEffects";

describe("example effect authoring definitions", () => {
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
        kind: "snapshot/element",
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
          kind: "snapshot/text",
          element: document.createElement("p"),
          text: "Wrong source",
        },
      }),
      state,
      { kind: "example.surfaceFill", imageSrc: "/example/bg.png", opacity: 1 },
    );

    expect(exampleSurfaceFillEffect.source).toBe("snapshot/element");
    expect(surface.draw).toHaveBeenCalledTimes(1);
    expect(surface.setVisible).toHaveBeenCalledWith(true);
    expect(surface.setOpacity).toHaveBeenCalledWith(0.72);
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setOpacity).not.toHaveBeenCalled();
  });

  test("surface pulse visibly animates surface opacity and target scale for element snapshots", () => {
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
        kind: "snapshot/element",
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
          kind: "snapshot/element",
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

    expect(exampleSurfacePulseEffect.source).toBe("snapshot/element");
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setScale).not.toHaveBeenCalled();
    expect(target.setOpacity).not.toHaveBeenCalled();
    expect(surface.setVisible).toHaveBeenCalledWith(true);
    expect(surface.draw).toHaveBeenCalledTimes(2);
    expect(surface.setOpacity).toHaveBeenCalledTimes(2);
    expect(surface.setOpacity).toHaveBeenCalledWith(1);
  });

  test("text wave rewrites glyph commands using elapsed runtime time", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "snapshot/text",
        element: document.createElement("p"),
        text: "Wave",
        textLayer,
      },
      time: 1000,
    });

    exampleTextWaveEffect.update(context, undefined, {
      kind: "example.textWave",
      amplitude: 8,
    });

    expect(exampleTextWaveEffect.source).toBe("snapshot/text");
    expect(textLayer.setGlyphs).toHaveBeenCalledTimes(1);
    const transform = textLayer.setGlyphs.mock.calls[0]?.[0];
    const commands = transform?.([
      createGlyph(0, "W"),
      createGlyph(1, "a"),
    ]);
    expect(commands?.[0]).toMatchObject({ index: 0, char: "W" });
    expect(commands?.[0]?.y).not.toBe(0);
  });

  test("text reveal maps scroll progress to glyph opacity and scale", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "snapshot/text",
        element: document.createElement("p"),
        text: "Reveal",
        textLayer,
      },
      scrollProgress: 0.5,
    });

    exampleTextRevealEffect.update(context, undefined, {
      kind: "example.textReveal",
      color: "#d95f42",
    });

    expect(exampleTextRevealEffect.source).toBe("snapshot/text");
    const transform = textLayer.setGlyphs.mock.calls[0]?.[0];
    const commands = transform?.([
      createGlyph(0, "R"),
      createGlyph(1, "e"),
      createGlyph(2, "v"),
      createGlyph(3, "e"),
    ]);
    expect(commands?.[0]).toMatchObject({ index: 0, opacity: 1, color: "#d95f42" });
    expect(commands?.[3]).toMatchObject({ index: 3, opacity: 0.18, scaleX: 0.82 });
  });

  test("image pan applies a texture transform only to image sources", () => {
    const image = {
      setTextureTransform: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "image",
        element: document.createElement("img"),
        src: "/example/image.png",
        image,
      },
      scrollProgress: 0.5,
    });

    exampleImagePanEffect.update(context, undefined, {
      kind: "example.imagePan",
      distance: 0.2,
    });

    expect(exampleImagePanEffect.source).toBe("image");
    expect(image.setTextureTransform).toHaveBeenCalledWith({
      repeatX: 1.12,
      repeatY: 1.12,
      offsetX: 0.1,
      offsetY: 0,
    });
  });

  test("image zoom drives target scale for image sources", () => {
    const target = {
      setScale: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "image",
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

    expect(exampleImageZoomEffect.source).toBe("image");
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setScale).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 1);
  });

  test("video playback configures media once during setup", () => {
    const video = {
      play: vi.fn(),
      setMuted: vi.fn(),
      setPlaybackRate: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "video",
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

    expect(exampleVideoPlaybackEffect.source).toBe("video");
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
        kind: "video",
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

    expect(exampleVideoDriftEffect.source).toBe("video");
    expect(video.setTextureTransform).toHaveBeenCalledWith({
      repeatX: 1.08,
      repeatY: 1.08,
      offsetX: expect.any(Number),
      offsetY: expect.any(Number),
    });
  });

  test("model spin uses the public target handle and model source kind", () => {
    const target = {
      setRotation: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "model/glb",
        anchor: document.createElement("section"),
        src: "/models/hero.glb",
        model: {
          object3D: {},
          traverseMeshes: vi.fn(),
          sampleVertices: vi.fn(),
          createPointCloud: vi.fn(),
        },
      },
      target,
      time: 2000,
    });

    exampleModelSpinEffect.update(context, undefined, {
      kind: "example.modelSpin",
      speed: 0.25,
    });

    expect(exampleModelSpinEffect.source).toBe("model/glb");
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setRotation).toHaveBeenCalledWith(0, 0.5, 0);
  });

  test("model float combines layout position and runtime time", () => {
    const target = {
      setPosition: vi.fn(),
      setRotation: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createEffectContext({
      source: {
        kind: "model/glb",
        anchor: document.createElement("section"),
        src: "/models/hero.glb",
        model: {
          object3D: {},
          traverseMeshes: vi.fn(),
          sampleVertices: vi.fn(),
          createPointCloud: vi.fn(),
        },
      },
      target,
      time: 1400,
      layout: {
        key: "example.test",
        left: 10,
        top: 20,
        width: 120,
        height: 60,
        viewport: { width: 1024, height: 768 },
      },
    });

    exampleModelFloatEffect.update(context, undefined, {
      kind: "example.modelFloat",
      amplitude: 24,
    });

    expect(exampleModelFloatEffect.source).toBe("model/glb");
    expect(target.setVisible).toHaveBeenCalledWith(true);
    expect(target.setPosition).toHaveBeenCalledWith(70, expect.any(Number), 0);
    expect(target.setRotation).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 0);
  });
});

function createGlyph(index: number, char: string) {
  return {
    index,
    char,
    line: 0,
    x: index * 12,
    y: 0,
    width: 10,
    height: 20,
    baseline: 16,
  };
}

function createEffectContext(overrides: Record<string, unknown>) {
  return {
    key: "example.test",
    sourceKind: "snapshot/element",
    layout: {
      key: "example.test",
      left: 0,
      top: 0,
      width: 120,
      height: 60,
      viewport: { width: 1024, height: 768 },
    },
    input: {
      time: 0,
      delta: 16,
      scroll: { mode: "page", x: 0, y: 0, progress: 0 },
      pointer: { x: 0, y: 0, normalizedX: 0, normalizedY: 0, isInside: false },
    },
    pointer: { x: 0, y: 0, normalizedX: 0, normalizedY: 0, isInside: false },
    scroll: { mode: "page", x: 0, y: 0, progress: 0 },
    scrollProgress: 0,
    time: 0,
    delta: 16,
    target: undefined,
    resources: {
      addDisposable: vi.fn(),
      createObject3D: vi.fn((factory: () => unknown) => factory()),
      dispose: vi.fn(),
    },
    ...overrides,
  } as never;
}
