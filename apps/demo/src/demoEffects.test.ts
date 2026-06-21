import { describe, expect, test, vi } from "vitest";

import {
  demoCapabilityImageTextureEffect,
  demoCapabilitySurfaceEffect,
  demoCapabilityTextLayerEffect,
  demoCapabilityVideoPlaybackEffect,
  demoGLBVertexParticlesEffect,
  demoGLBRotateEffect,
  demoSurfaceEffect,
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

function createCapabilityContext(options: { source: unknown; target?: unknown }) {
  return {
    key: "demo.capability",
    sourceKind: "snapshot/element",
    layout: {
      x: 0,
      y: 0,
      width: 320,
      height: 180,
      top: 0,
      right: 320,
      bottom: 180,
      left: 0,
      viewport: { width: 800, height: 600 },
      devicePixelRatio: 1,
      layoutSignature: "capability",
    },
    input: {
      time: 0,
      delta: 16,
      scroll: { mode: "page", pageProgress: 0, direction: 0, velocity: 0 },
      pointer: {
        x: -1,
        y: -1,
        normalizedX: 0,
        normalizedY: 0,
        isInside: false,
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
      normalizedX: 0,
      normalizedY: 0,
      isInside: false,
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
    time: 0,
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
