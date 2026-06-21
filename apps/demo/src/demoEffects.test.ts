import { describe, expect, test, vi } from "vitest";

import {
  demoCapabilityImageTextureEffect,
  demoCapabilitySurfaceEffect,
  demoCapabilityTextLayerEffect,
  demoCapabilityVideoPlaybackEffect,
  demoGLBVertexParticlesEffect,
  demoGLBRotateEffect,
  demoScrambledTextEffect,
  demoScrollImageZoomEffect,
  demoSurfaceEffect,
  demoTextPressureEffect,
} from "./demoEffects";

describe("demoSurfaceEffect", () => {
  test("draws a visible element snapshot surface while applying target opacity", () => {
    const surface = {
      draw: vi.fn(),
      setOpacity: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createCapabilityContext({
      target: {
        setOpacity: vi.fn(),
        setVisible: vi.fn(),
      },
      source: {
        kind: "snapshot/element",
        element: document.createElement("section"),
        surface,
      },
    });

    const state = demoSurfaceEffect.setup?.(context, {
      kind: "demo.surface",
      opacity: 0.82,
    });
    demoSurfaceEffect.update(context, state, {
      kind: "demo.surface",
      opacity: 0.82,
    });
    demoSurfaceEffect.update(context, state, {
      kind: "demo.surface",
      opacity: 0.64,
    });

    expect(context.target?.setVisible).toHaveBeenCalledWith(true);
    expect(context.target?.setOpacity).toHaveBeenLastCalledWith(0.64);
    expect(surface.draw).toHaveBeenCalledTimes(1);
    expect(surface.setVisible).toHaveBeenCalledWith(true);
    expect(surface.setOpacity).toHaveBeenCalledWith(0.82);
  });
});

describe("demo capability effects", () => {
  test("draws the element surface once with a visible overlay", () => {
    const surface = {
      draw: vi.fn(),
      setOpacity: vi.fn(),
      setVisible: vi.fn(),
    };
    const context = createCapabilityContext({
      source: {
        kind: "snapshot/element",
        element: document.createElement("section"),
        surface,
      },
    });

    demoCapabilitySurfaceEffect.setup?.(context, {
      kind: "demo.capabilitySurface",
    });
    demoCapabilitySurfaceEffect.update(context, undefined, {
      kind: "demo.capabilitySurface",
    });
    demoCapabilitySurfaceEffect.update(context, undefined, {
      kind: "demo.capabilitySurface",
    });

    expect(surface.draw).toHaveBeenCalledTimes(1);
    expect(surface.setOpacity).toHaveBeenCalledWith(0.55);
    expect(surface.setVisible).toHaveBeenCalledWith(true);
  });

  test("draws the text layer once with non-identity glyph commands", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createCapabilityContext({
      source: {
        kind: "snapshot/text",
        element: document.createElement("p"),
        text: "Hello",
        textLayer,
      },
    });

    demoCapabilityTextLayerEffect.setup?.(context, {
      kind: "demo.capabilityTextLayer",
    });
    demoCapabilityTextLayerEffect.update(context, undefined, {
      kind: "demo.capabilityTextLayer",
    });
    demoCapabilityTextLayerEffect.update(context, undefined, {
      kind: "demo.capabilityTextLayer",
    });

    expect(textLayer.setGlyphs).toHaveBeenCalledTimes(1);

    const transform = textLayer.setGlyphs.mock.calls[0]?.[0];
    const commands = transform?.([
      {
        index: 0,
        char: "H",
        line: 0,
        x: 0,
        y: 20,
        width: 10,
        height: 20,
        baseline: 16,
      },
    ]);

    expect(commands?.[0]).toMatchObject({
      index: 0,
      char: "*",
      color: "#ffcf5a",
      rotation: -0.05,
      scaleX: 1.08,
      scaleY: 1.28,
      y: 10,
    });
  });

  test("applies a visible image texture transform once", () => {
    const image = {
      setTextureTransform: vi.fn(),
    };
    const context = createCapabilityContext({
      source: {
        kind: "image",
        element: document.createElement("img"),
        src: "/poster.png",
        image,
      },
    });

    demoCapabilityImageTextureEffect.setup?.(context, {
      kind: "demo.capabilityImageTexture",
    });
    demoCapabilityImageTextureEffect.update(context, undefined, {
      kind: "demo.capabilityImageTexture",
    });
    demoCapabilityImageTextureEffect.update(context, undefined, {
      kind: "demo.capabilityImageTexture",
    });

    expect(image.setTextureTransform).toHaveBeenCalledTimes(1);
    expect(image.setTextureTransform).toHaveBeenCalledWith({
      repeatX: 0.55,
      repeatY: 0.55,
      offsetX: 0.22,
      offsetY: 0.22,
    });
  });

  test("applies video playback settings once", () => {
    const video = {
      play: vi.fn(),
      setMuted: vi.fn(),
      setPlaybackRate: vi.fn(),
    };
    const context = createCapabilityContext({
      source: {
        kind: "video",
        element: document.createElement("video"),
        src: "/intro.mp4",
        video,
      },
    });

    demoCapabilityVideoPlaybackEffect.setup?.(context, {
      kind: "demo.capabilityVideoPlayback",
    });
    demoCapabilityVideoPlaybackEffect.update(context, undefined, {
      kind: "demo.capabilityVideoPlayback",
    });
    demoCapabilityVideoPlaybackEffect.update(context, undefined, {
      kind: "demo.capabilityVideoPlayback",
    });

    expect(video.setMuted).toHaveBeenCalledTimes(1);
    expect(video.setPlaybackRate).toHaveBeenCalledTimes(1);
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(video.setMuted).toHaveBeenCalledWith(true);
    expect(video.setPlaybackRate).toHaveBeenCalledWith(1.15);
  });

  test("scrambles text glyphs while pointer is inside", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createCapabilityContext({
      layout: { left: 100, top: 100, width: 160, height: 60 },
      pointer: { isInside: true, x: 130, y: 120 },
      source: {
        kind: "snapshot/text",
        element: document.createElement("p"),
        text: "Hello",
        textLayer,
      },
      time: 1_250,
    });

    const state = demoScrambledTextEffect.setup?.(context, {
      kind: "demo.scrambledText",
      intensity: 1,
    });
    if (!state) {
      throw new Error("Expected demo.scrambledText setup state");
    }
    demoScrambledTextEffect.update(
      createCapabilityContext({
        layout: { left: 100, top: 100, width: 160, height: 60 },
        pointer: { isInside: true, x: 146, y: 124 },
        source: {
          kind: "snapshot/text",
          element: document.createElement("p"),
          text: "Hello",
          textLayer,
        },
        time: 1_266,
      }),
      state,
      { kind: "demo.scrambledText", intensity: 1 },
    );

    expect(textLayer.setGlyphs).toHaveBeenCalled();

    const transform = textLayer.setGlyphs.mock.calls.at(-1)?.[0];
    const commands = (transform?.([
      createGlyph(0, "H"),
      createGlyph(1, "e"),
      createGlyph(2, "l"),
      createGlyph(3, "l"),
      createGlyph(4, "o"),
      createGlyph(20, "!"),
    ]) ?? []) as Array<{ index: number; char?: string; opacity?: number }>;

    expect(commands.slice(0, 5).some((command) => command.char !== "Hello"[command.index])).toBe(true);
    expect(commands.find((command) => command.index === 20)?.char).toBe("!");
    expect(commands?.every((command) => command.opacity === 1)).toBe(true);
  });

  test("restores original text glyphs when pointer leaves", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createCapabilityContext({
      pointer: { isInside: false },
      source: {
        kind: "snapshot/text",
        element: document.createElement("p"),
        text: "Hello",
        textLayer,
      },
      time: 1_250,
    });

    const state = demoScrambledTextEffect.setup?.(context, {
      kind: "demo.scrambledText",
      intensity: 1,
    });
    if (!state) {
      throw new Error("Expected demo.scrambledText setup state");
    }
    demoScrambledTextEffect.update(context, state, {
      kind: "demo.scrambledText",
      intensity: 1,
    });

    const transform = textLayer.setGlyphs.mock.calls.at(-1)?.[0];
    const commands = (transform?.([
      createGlyph(0, "H"),
      createGlyph(1, "e"),
      createGlyph(2, "l"),
      createGlyph(3, "l"),
      createGlyph(4, "o"),
    ]) ?? []) as Array<{ index: number; char?: string; opacity?: number }>;

    expect(commands?.map((command) => command.char).join("")).toBe("Hello");
  });

  test("does not scramble when the pointer is inside the runtime but outside the text layout", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createCapabilityContext({
      layout: { left: 100, top: 100, width: 160, height: 60 },
      pointer: { isInside: true, x: 20, y: 20 },
      source: {
        kind: "snapshot/text",
        element: document.createElement("p"),
        text: "Hello",
        textLayer,
      },
      time: 1_250,
    });

    const state = demoScrambledTextEffect.setup?.(context, {
      kind: "demo.scrambledText",
      intensity: 1,
    });
    if (!state) {
      throw new Error("Expected demo.scrambledText setup state");
    }
    demoScrambledTextEffect.update(context, state, {
      kind: "demo.scrambledText",
      intensity: 1,
    });

    const transform = textLayer.setGlyphs.mock.calls.at(-1)?.[0];
    const commands = (transform?.([
      createGlyph(0, "H"),
      createGlyph(1, "e"),
      createGlyph(2, "l"),
      createGlyph(3, "l"),
      createGlyph(4, "o"),
    ]) ?? []) as Array<{ index: number; char?: string }>;

    expect(commands.map((command) => command.char).join("")).toBe("Hello");
  });

  test("does not keep scrambling from time alone when the pointer is stationary", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createCapabilityContext({
      layout: { left: 100, top: 100, width: 160, height: 60 },
      pointer: { isInside: true, x: 140, y: 120 },
      source: {
        kind: "snapshot/text",
        element: document.createElement("p"),
        text: "Hello",
        textLayer,
      },
      time: 1_250,
    });

    const state = demoScrambledTextEffect.setup?.(context, {
      kind: "demo.scrambledText",
      intensity: 1,
    });
    if (!state) {
      throw new Error("Expected demo.scrambledText setup state");
    }
    demoScrambledTextEffect.update(
      createCapabilityContext({
        layout: { left: 100, top: 100, width: 160, height: 60 },
        pointer: { isInside: true, x: 140, y: 120 },
        source: {
          kind: "snapshot/text",
          element: document.createElement("p"),
          text: "Hello",
          textLayer,
        },
        time: 1_500,
      }),
      state,
      { kind: "demo.scrambledText", intensity: 1 },
    );

    const transform = textLayer.setGlyphs.mock.calls.at(-1)?.[0];
    const commands = (transform?.([
      createGlyph(0, "H"),
      createGlyph(1, "e"),
      createGlyph(2, "l"),
      createGlyph(3, "l"),
      createGlyph(4, "o"),
    ]) ?? []) as Array<{ index: number; char?: string }>;

    expect(commands.map((command) => command.char).join("")).toBe("Hello");
  });

  test("pressurizes only glyphs near a moving pointer inside the text layout", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createCapabilityContext({
      layout: { left: 100, top: 100, width: 180, height: 80 },
      pointer: { isInside: true, x: 130, y: 120 },
      source: {
        kind: "snapshot/text",
        element: document.createElement("h2"),
        text: "HELLO!",
        textLayer,
      },
      time: 2_000,
    });

    const state = demoTextPressureEffect.setup?.(context, {
      kind: "demo.textPressure",
      intensity: 1,
      radius: 54,
    });
    if (!state) {
      throw new Error("Expected demo.textPressure setup state");
    }
    demoTextPressureEffect.update(
      createCapabilityContext({
        layout: { left: 100, top: 100, width: 180, height: 80 },
        pointer: { isInside: true, x: 138, y: 122 },
        source: {
          kind: "snapshot/text",
          element: document.createElement("h2"),
          text: "HELLO!",
          textLayer,
        },
        time: 2_016,
      }),
      state,
      { kind: "demo.textPressure", intensity: 1, radius: 54 },
    );

    const transform = textLayer.setGlyphs.mock.calls.at(-1)?.[0];
    const commands = (transform?.([
      createGlyph(0, "H"),
      createGlyph(1, "E"),
      createGlyph(2, "L"),
      createGlyph(3, "L"),
      createGlyph(18, "!"),
    ]) ?? []) as Array<{
      index: number;
      char?: string;
      color?: string;
      rotation?: number;
      scaleX?: number;
      scaleY?: number;
    }>;

    expect(commands.slice(0, 4).some((command) => (command.scaleY ?? 1) > 1)).toBe(
      true,
    );
    expect(commands.slice(0, 4).some((command) => (command.scaleX ?? 1) < 1)).toBe(
      true,
    );
    expect(commands.find((command) => command.index === 18)).toMatchObject({
      char: "!",
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    });
  });

  test("uses glyph visual center instead of baseline math for pressure proximity", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createCapabilityContext({
      layout: { left: 100, top: 100, width: 180, height: 80 },
      pointer: { isInside: true, x: 110, y: 130 },
      source: {
        kind: "snapshot/text",
        element: document.createElement("h2"),
        text: "A",
        textLayer,
      },
      time: 2_000,
    });

    const state = demoTextPressureEffect.setup?.(context, {
      kind: "demo.textPressure",
      intensity: 1,
      radius: 18,
    });
    if (!state) {
      throw new Error("Expected demo.textPressure setup state");
    }
    demoTextPressureEffect.update(
      createCapabilityContext({
        layout: { left: 100, top: 100, width: 180, height: 80 },
        pointer: { isInside: true, x: 111, y: 130 },
        source: {
          kind: "snapshot/text",
          element: document.createElement("h2"),
          text: "A",
          textLayer,
        },
        time: 2_016,
      }),
      state,
      { kind: "demo.textPressure", intensity: 1, radius: 18 },
    );

    const transform = textLayer.setGlyphs.mock.calls.at(-1)?.[0];
    const commands = (transform?.([
      {
        ...createGlyph(0, "A"),
        x: 5,
        y: 20,
        width: 10,
        height: 20,
      },
    ]) ?? []) as Array<{ index: number; scaleY?: number }>;

    expect(commands[0]?.scaleY).toBeGreaterThan(1);
  });

  test("does not pressurize text from runtime pointer state outside the text layout", () => {
    const textLayer = {
      setGlyphs: vi.fn(),
    };
    const context = createCapabilityContext({
      layout: { left: 100, top: 100, width: 180, height: 80 },
      pointer: { isInside: true, x: 40, y: 40 },
      source: {
        kind: "snapshot/text",
        element: document.createElement("h2"),
        text: "HELLO",
        textLayer,
      },
      time: 2_000,
    });

    const state = demoTextPressureEffect.setup?.(context, {
      kind: "demo.textPressure",
      intensity: 1,
    });
    if (!state) {
      throw new Error("Expected demo.textPressure setup state");
    }
    demoTextPressureEffect.update(context, state, {
      kind: "demo.textPressure",
      intensity: 1,
    });

    const transform = textLayer.setGlyphs.mock.calls.at(-1)?.[0];
    const commands = (transform?.([
      createGlyph(0, "H"),
      createGlyph(1, "E"),
      createGlyph(2, "L"),
    ]) ?? []) as Array<{ index: number; scaleX?: number; scaleY?: number }>;

    expect(commands.every((command) => command.scaleX === 1)).toBe(true);
    expect(commands.every((command) => command.scaleY === 1)).toBe(true);
  });

  test("scales scroll image targets from their sticky stage progress", () => {
    const target = {
      setScale: vi.fn(),
    };
    demoScrollImageZoomEffect.setup?.(
      createImageZoomContext({
        stageRect: { top: 0, height: 1200 },
        target,
      }),
      { kind: "demo.scrollImageZoom", maxScale: 1.8 },
    );

    demoScrollImageZoomEffect.update(
      createImageZoomContext({
        stageRect: { top: -300, height: 1200 },
        target,
      }),
      undefined,
      { kind: "demo.scrollImageZoom", maxScale: 1.8 },
    );
    demoScrollImageZoomEffect.update(
      createImageZoomContext({
        stageRect: { top: -600, height: 1200 },
        target,
      }),
      undefined,
      { kind: "demo.scrollImageZoom", maxScale: 1.8 },
    );

    expect(target.setScale).toHaveBeenNthCalledWith(1, 1, 1, 1);
    expect(target.setScale).toHaveBeenNthCalledWith(2, 1.4, 1.4, 1);
    expect(target.setScale).toHaveBeenNthCalledWith(3, 1.8, 1.8, 1);
  });

  test("reverses scroll image target scale when sticky stage progress moves backward", () => {
    const target = {
      setScale: vi.fn(),
    };
    demoScrollImageZoomEffect.setup?.(
      createImageZoomContext({
        stageRect: { top: -600, height: 1200 },
        target,
      }),
      { kind: "demo.scrollImageZoom", maxScale: 1.8 },
    );

    demoScrollImageZoomEffect.update(
      createImageZoomContext({
        stageRect: { top: -300, height: 1200 },
        target,
      }),
      undefined,
      { kind: "demo.scrollImageZoom", maxScale: 1.8 },
    );
    demoScrollImageZoomEffect.update(
      createImageZoomContext({
        stageRect: { top: 0, height: 1200 },
        target,
      }),
      undefined,
      { kind: "demo.scrollImageZoom", maxScale: 1.8 },
    );

    expect(target.setScale).toHaveBeenNthCalledWith(1, 1.8, 1.8, 1);
    expect(target.setScale).toHaveBeenNthCalledWith(2, 1.4, 1.4, 1);
    expect(target.setScale).toHaveBeenNthCalledWith(3, 1, 1, 1);
  });
});

describe("demoGLBRotateEffect", () => {
  test("rotates the original GLB object slowly on the y axis using seconds", () => {
    const context = createEffectContext({ time: 10_000 });

    demoGLBRotateEffect.update(context, undefined, { kind: "demo.glbRotate" });

    expect(context.source.kind).toBe("model/glb");
    if (context.source.kind !== "model/glb") {
      throw new Error("Expected model/glb source");
    }

    const object3D = context.source.model.object3D as {
      rotation: { x: number; y: number; z: number };
    };

    expect(object3D.rotation).toEqual({
      x: 0,
      y: 0.15,
      z: 0,
    });
    expect(context.source.model.createPointCloud).not.toHaveBeenCalled();
    expect(context.source.model.traverseMeshes).not.toHaveBeenCalled();
  });
});

describe("demoGLBVertexParticlesEffect", () => {
  test("hides the original GLB meshes and scatters vertex particles along pointer movement", () => {
    const pointCloud = createPointCloud();
    const mesh = { visible: true };
    const context = createEffectContext({ pointCloud, meshes: [mesh] });
    const initialPositions = new Float32Array(
      pointCloud.geometry.attributes.position.array,
    );

    const state = demoGLBVertexParticlesEffect.setup?.(context, {
      kind: "demo.glbVertexParticles",
      color: "rgb(255, 0, 0)",
      density: 2.5,
      size: 0.026,
    });

    demoGLBVertexParticlesEffect.update(
      createEffectContext({ pointCloud, time: 1_000 }),
      state,
      { kind: "demo.glbVertexParticles" },
    );
    demoGLBVertexParticlesEffect.update(
      createEffectContext({
        pointCloud,
        pointer: { isInside: true, normalizedX: 0.6, normalizedY: 0 },
        time: 1_000,
      }),
      state,
      { kind: "demo.glbVertexParticles" },
    );
    demoGLBVertexParticlesEffect.update(
      createEffectContext({
        pointCloud,
        pointer: { isInside: true, normalizedX: 0.8, normalizedY: 0 },
        time: 1_016,
      }),
      state,
      { kind: "demo.glbVertexParticles" },
    );

    expect(pointCloud.geometry.attributes.position.array).toEqual(initialPositions);
    expect(pointCloud.geometry.attributes.position.needsUpdate).toBe(true);
    pointCloud.geometry.attributes.position.needsUpdate = false;

    demoGLBVertexParticlesEffect.update(
      createEffectContext({
        pointCloud,
        pointer: { isInside: true, normalizedX: -0.04, normalizedY: 0 },
        time: 1_032,
      }),
      state,
      { kind: "demo.glbVertexParticles" },
    );
    demoGLBVertexParticlesEffect.update(
      createEffectContext({
        pointCloud,
        pointer: { isInside: true, normalizedX: 0.04, normalizedY: 0 },
        time: 1_048,
      }),
      state,
      { kind: "demo.glbVertexParticles" },
    );

    expect(context.source.kind).toBe("model/glb");
    if (context.source.kind !== "model/glb") {
      throw new Error("Expected model/glb source");
    }

    expect(context.source.model.createPointCloud).toHaveBeenCalledWith({
      color: "rgb(255, 0, 0)",
      density: 2.5,
      size: 0.026,
    });
    expect(context.source.model.traverseMeshes).toHaveBeenCalled();
    expect(mesh.visible).toBe(false);
    expect(
      (context.source.model.object3D as { add: ReturnType<typeof vi.fn> }).add,
    ).toHaveBeenCalledWith(pointCloud);
    expect(pointCloud.material.depthTest).toBe(false);
    expect(pointCloud.material.depthWrite).toBe(false);
    expect(pointCloud.material.transparent).toBe(true);
    expect(pointCloud.renderOrder).toBe(10);
    expect(pointCloud.scale.setScalar).toHaveBeenCalledWith(1.015);
    expect(pointCloud.geometry.attributes.position.array).not.toEqual(
      initialPositions,
    );
    expect(pointCloud.geometry.attributes.position.needsUpdate).toBe(true);

    const dispose = vi.mocked(context.resources.addDisposable).mock.calls[0]?.[0];
    dispose?.();
    expect(mesh.visible).toBe(true);
  });

  test("uses the model layout instead of the full viewport center for particle hits", () => {
    const pointCloud = createPointCloud();
    const layout = { left: 300, top: 200, width: 100, height: 100 };
    const context = createEffectContext({ pointCloud, layout });
    const initialPositions = new Float32Array(
      pointCloud.geometry.attributes.position.array,
    );
    const state = demoGLBVertexParticlesEffect.setup?.(context, {
      kind: "demo.glbVertexParticles",
    });

    demoGLBVertexParticlesEffect.update(
      createEffectContext({
        pointCloud,
        layout,
        pointer: { isInside: true, normalizedX: 0, normalizedY: 0 },
        time: 1_000,
      }),
      state,
      { kind: "demo.glbVertexParticles" },
    );
    demoGLBVertexParticlesEffect.update(
      createEffectContext({
        pointCloud,
        layout,
        pointer: { isInside: true, normalizedX: 0.05, normalizedY: 0 },
        time: 1_016,
      }),
      state,
      { kind: "demo.glbVertexParticles" },
    );

    expect(pointCloud.geometry.attributes.position.array).toEqual(initialPositions);

    demoGLBVertexParticlesEffect.update(
      createEffectContext({
        pointCloud,
        layout,
        pointer: { isInside: true, normalizedX: -0.13, normalizedY: 0.17 },
        time: 1_032,
      }),
      state,
      { kind: "demo.glbVertexParticles" },
    );
    demoGLBVertexParticlesEffect.update(
      createEffectContext({
        pointCloud,
        layout,
        pointer: { isInside: true, normalizedX: -0.12, normalizedY: 0.17 },
        time: 1_048,
      }),
      state,
      { kind: "demo.glbVertexParticles" },
    );

    expect(pointCloud.geometry.attributes.position.array).not.toEqual(
      initialPositions,
    );
  });

  test("projects particle hits through the current model y rotation", () => {
    const pointCloud = createPointCloud({
      positions: new Float32Array([0, -1, -1, 0, 0, 0, 0, 1, 1]),
    });
    const context = createEffectContext({
      pointCloud,
      rotation: { x: 0, y: Math.PI / 2, z: 0 },
    });
    const initialPositions = new Float32Array(
      pointCloud.geometry.attributes.position.array,
    );
    const state = demoGLBVertexParticlesEffect.setup?.(context, {
      kind: "demo.glbVertexParticles",
    });

    demoGLBVertexParticlesEffect.update(
      createEffectContext({
        pointCloud,
        pointer: { isInside: true, normalizedX: 0.2, normalizedY: 0 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        time: 1_000,
      }),
      state,
      { kind: "demo.glbVertexParticles" },
    );
    demoGLBVertexParticlesEffect.update(
      createEffectContext({
        pointCloud,
        pointer: { isInside: true, normalizedX: 0.04, normalizedY: 0 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        time: 1_016,
      }),
      state,
      { kind: "demo.glbVertexParticles" },
    );

    expect(pointCloud.geometry.attributes.position.array).not.toEqual(
      initialPositions,
    );
    expect(pointCloud.geometry.attributes.position.array[5]).not.toBe(
      initialPositions[5],
    );
  });
});

function createPointCloud(options: { positions?: Float32Array } = {}) {
  return {
    geometry: {
      attributes: {
            position: {
          array:
            options.positions ??
            new Float32Array([-1, -1, 0, 0, 0, 0, 1, 1, 0]),
          needsUpdate: false,
        },
      },
      dispose: vi.fn(),
    },
    material: {
      depthTest: true,
      depthWrite: true,
      dispose: vi.fn(),
      transparent: false,
    },
    parent: { remove: vi.fn() },
    renderOrder: 0,
    scale: { setScalar: vi.fn() },
  };
}

function createGlyph(index: number, char: string) {
  return {
    index,
    char,
    line: 0,
    x: index * 10,
    y: 20,
    width: 10,
    height: 20,
    baseline: 16,
  };
}

function createCapabilityContext(options: {
  layout?: Partial<{
    height: number;
    left: number;
    top: number;
    width: number;
  }>;
  pointer?: Partial<{
    isInside: boolean;
    normalizedX: number;
    normalizedY: number;
    x: number;
    y: number;
  }>;
  source: unknown;
  target?: unknown;
  time?: number;
}) {
  return {
    key: "demo.capability",
    sourceKind: "snapshot/element",
    layout: {
      x: options.layout?.left ?? 0,
      y: options.layout?.top ?? 0,
      width: options.layout?.width ?? 320,
      height: options.layout?.height ?? 180,
      top: options.layout?.top ?? 0,
      right: (options.layout?.left ?? 0) + (options.layout?.width ?? 320),
      bottom: (options.layout?.top ?? 0) + (options.layout?.height ?? 180),
      left: options.layout?.left ?? 0,
      viewport: { width: 800, height: 600 },
      devicePixelRatio: 1,
      layoutSignature: "capability",
    },
    input: {
      time: options.time ?? 0,
      delta: 16,
      scroll: { mode: "page", pageProgress: 0, direction: 0, velocity: 0 },
      pointer: {
        x: options.pointer?.x ?? -1,
        y: options.pointer?.y ?? -1,
        normalizedX: options.pointer?.normalizedX ?? 0,
        normalizedY: options.pointer?.normalizedY ?? 0,
        isInside: options.pointer?.isInside ?? false,
        isDown: false,
        downTime: 0,
        pressDuration: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragDeltaX: 0,
        dragDeltaY: 0,
        clickCount: 0,
      },
    },
    pointer: {
      x: options.pointer?.x ?? -1,
      y: options.pointer?.y ?? -1,
      normalizedX: options.pointer?.normalizedX ?? 0,
      normalizedY: options.pointer?.normalizedY ?? 0,
      isInside: options.pointer?.isInside ?? false,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
    },
    scroll: { mode: "page", pageProgress: 0, direction: 0, velocity: 0 },
    scrollProgress: 0,
    time: options.time ?? 0,
    delta: 16,
    source: options.source,
    target: options.target,
    resources: {
      addDisposable: vi.fn(),
      createObject3D: vi.fn((factory: () => unknown) => factory()),
      dispose: vi.fn(),
    },
  } as Parameters<typeof demoCapabilitySurfaceEffect.update>[0];
}

function createImageZoomContext(options: {
  stageRect: { top: number; height: number };
  target: unknown;
}) {
  const image = document.createElement("img");
  image.src = "/demo/bg.png";
  const stage = document.createElement("section");
  stage.append(image);
  stage.getBoundingClientRect = vi.fn(() => ({
    bottom: options.stageRect.top + options.stageRect.height,
    height: options.stageRect.height,
    left: 0,
    right: 320,
    top: options.stageRect.top,
    width: 320,
    x: 0,
    y: options.stageRect.top,
    toJSON: () => ({}),
  }));

  const baseContext = createCapabilityContext({
    source: {
      kind: "image",
      element: image,
      src: "/demo/bg.png",
    },
    target: options.target,
  });

  return {
    ...baseContext,
    key: "demo.scroll.marker.01",
    sourceKind: "image",
  } as Parameters<typeof demoScrollImageZoomEffect.update>[0];
}

function createEffectContext(
  options: {
    pointCloud?: ReturnType<typeof createPointCloud>;
    layout?: Partial<{
      left: number;
      top: number;
      width: number;
      height: number;
    }>;
    meshes?: Array<{ visible?: boolean }>;
    pointer?: Partial<{
      isInside: boolean;
      normalizedX: number;
      normalizedY: number;
    }>;
    rotation?: { x: number; y: number; z: number };
    time?: number;
  } = {},
) {
  const object3D = {
    add: vi.fn(),
    rotation: options.rotation ?? { x: 1, y: 1, z: 1 },
  };
  const layoutLeft = options.layout?.left ?? 0;
  const layoutTop = options.layout?.top ?? 0;
  const layoutWidth = options.layout?.width ?? 800;
  const layoutHeight = options.layout?.height ?? 600;

  return {
    key: "demo.model",
    sourceKind: "model/glb",
    layout: {
      x: layoutLeft,
      y: layoutTop,
      width: layoutWidth,
      height: layoutHeight,
      top: layoutTop,
      right: layoutLeft + layoutWidth,
      bottom: layoutTop + layoutHeight,
      left: layoutLeft,
      viewport: { width: 800, height: 600 },
      devicePixelRatio: 1,
      layoutSignature: "test",
    },
    input: {
      time: options.time ?? 0,
      delta: 16,
      scroll: { mode: "page", pageProgress: 0, direction: 0, velocity: 0 },
      pointer: {
        x: -1,
        y: -1,
        normalizedX: options.pointer?.normalizedX ?? 0,
        normalizedY: options.pointer?.normalizedY ?? 0,
        isInside: options.pointer?.isInside ?? false,
        isDown: false,
        downTime: 0,
        pressDuration: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragDeltaX: 0,
        dragDeltaY: 0,
        clickCount: 0,
      },
    },
    pointer: {
      x: -1,
      y: -1,
      normalizedX: options.pointer?.normalizedX ?? 0,
      normalizedY: options.pointer?.normalizedY ?? 0,
      isInside: options.pointer?.isInside ?? false,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
    },
    scroll: { mode: "page", pageProgress: 0, direction: 0, velocity: 0 },
    scrollProgress: 0,
    time: options.time ?? 0,
    delta: 16,
    source: {
      kind: "model/glb",
      anchor: document.createElement("div"),
      src: "/models/hero.glb",
      model: {
        object3D,
        traverseMeshes: vi.fn((visitor: (mesh: unknown) => void) => {
          for (const mesh of options.meshes ?? []) {
            visitor(mesh);
          }
        }),
        sampleVertices: vi.fn(() => new Float32Array()),
        createPointCloud: vi.fn(() => options.pointCloud ?? createPointCloud()),
      },
    },
    target: undefined,
    resources: {
      addDisposable: vi.fn(),
      createObject3D: vi.fn((factory: () => unknown) => factory()),
      dispose: vi.fn(),
    },
  } as Parameters<typeof demoGLBRotateEffect.update>[0];
}
