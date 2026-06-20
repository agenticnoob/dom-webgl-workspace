import { afterEach, describe, expect, test, vi } from "vitest";

import type { ScrollStateController } from "../input/frameInput";
import type { PointerController } from "../input/pointerController";
import type { ScrollControllerGateTarget } from "../input/scrollController";
import { defineWebGLEffect } from "../effects/effectAuthoring";
import type { Renderable } from "../render/renderable";
import type { WebGLSceneAdapter } from "./sceneObject";
import type {
  WebGLModelSourceDescriptor,
  WebGLVideoSourceDescriptor,
} from "../source/sourceDescriptor";
import type { WebGLFrameInput } from "../types";
import type { createWebGLRuntime, WebGLRuntime } from "./runtime";
import type { ThreeRendererHost } from "./threeRenderer";

type ElementMeasurement = {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type RuntimePipelineOptions = Parameters<typeof createWebGLRuntime>[0] & {
  rendererHostFactory?: (container: HTMLElement) => ThreeRendererHost;
  measureElement?: (element: HTMLElement) => ElementMeasurement;
  loadVideo?: (
    source: WebGLVideoSourceDescriptor,
  ) => Promise<HTMLVideoElement>;
  loadModel?: (source: WebGLModelSourceDescriptor) => Promise<unknown>;
  onRenderableCreated?: (renderable: Renderable) => void;
  scrollState?: ScrollStateController;
  pointerController?: PointerController;
  clock?: () => number;
  invalidationController?: {
    observeTarget(target: { key: string; element: HTMLElement }): void;
    unobserveTarget(key: string): void;
    consumeDirtyKeys(): Set<string>;
    dispose(): void;
  };
};

type RuntimeWithPipelineSurface = WebGLRuntime & {
  unregisterTarget(key: string): void;
  sync(): void | Promise<void>;
};

const testSurfaceEffect = defineWebGLEffect<{
  kind: "test.surface";
  opacity?: number;
}>({
  kind: "test.surface",
  source: "snapshot/element",
  update(ctx, _state, params) {
    ctx.target?.setVisible(true);
    ctx.target?.setOpacity(params.opacity ?? 1);
  },
});

const testPointerTiltEffect = defineWebGLEffect<{
  kind: "test.pointerTilt";
  strength?: number;
  maxDegrees?: number;
}>({
  kind: "test.pointerTilt",
  update(ctx, _state, params) {
    const strength = params.strength ?? 1;
    const maxDegrees = params.maxDegrees ?? 8;
    const radians = (maxDegrees * Math.PI) / 180;

    ctx.target?.setRotation(
      -ctx.pointer.normalizedY * radians * strength,
      ctx.pointer.normalizedX * radians * strength,
    );
  },
});

describe("runtime pipeline sync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("three/addons/loaders/GLTFLoader.js");
    vi.resetModules();
  });

  test("registering an element creates one renderable on sync and reuses it on later syncs", async () => {
    const createdRenderables: Renderable[] = [];
    const measureElement = vi.fn(readZeroMeasurement);
    const runtime = await createPipelineRuntime({
      measureElement,
      onRenderableCreated(renderable) {
        createdRenderables.push(renderable);
      },
    });
    const element = document.createElement("section");

    runtime.registerTarget(element, { key: "hero" });

    expect(createdRenderables).toHaveLength(0);

    await runtime.sync();
    await runtime.sync();

    expect(createdRenderables).toHaveLength(1);
    expect(createdRenderables[0]?.key).toBe("hero");
    expect(createdRenderables[0]?.role).toBe("surface");
    expect(measureElement).toHaveBeenCalledTimes(2);
    expect(measureElement).toHaveBeenCalledWith(element);

    runtime.dispose();
  });

  test("registering image video and model declarations creates renderables with inferred roles", async () => {
    const createdRenderables: Renderable[] = [];
    const runtime = await createPipelineRuntime({
      loadVideo: async (source) => source.element,
      loadModel: async (source) => ({ src: source.src }),
      onRenderableCreated(renderable) {
        createdRenderables.push(renderable);
      },
    });
    const image = document.createElement("img");
    const video = document.createElement("video");
    const modelAnchor = document.createElement("div");

    image.setAttribute("src", "/poster.png");
    Object.defineProperty(image, "decode", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    video.setAttribute("src", "/clip.mp4");
    Object.defineProperty(video, "pause", {
      configurable: true,
      value: vi.fn(),
    });

    runtime.registerTarget(image, { key: "poster" });
    runtime.registerTarget(video, { key: "clip" });
    runtime.registerTarget(modelAnchor, {
      key: "product",
      source: { kind: "model", format: "glb", src: "/product.glb" },
    });

    await runtime.sync();

    expect(countRoles(createdRenderables)).toEqual({
      media: 2,
      model: 1,
    });

    runtime.dispose();
  });

  test("model declarations use the default GLB loader when no loader is injected", async () => {
    const loadAsync = vi.fn(async () => ({ scene: "loaded model" }));
    const GLTFLoader = vi.fn(() => ({ loadAsync }));

    vi.doMock("three/addons/loaders/GLTFLoader.js", () => ({
      GLTFLoader,
    }));

    const createdRenderables: Renderable[] = [];
    const runtime = await createPipelineRuntime({
      onRenderableCreated(renderable) {
        createdRenderables.push(renderable);
      },
    });
    const modelAnchor = document.createElement("div");

    runtime.registerTarget(modelAnchor, {
      key: "product",
      source: { kind: "model", format: "glb", src: "/product.glb" },
    });

    await runtime.sync();

    expect(GLTFLoader).toHaveBeenCalledTimes(1);
    expect(loadAsync).toHaveBeenCalledWith("/product.glb");
    expect(createdRenderables).toHaveLength(1);
    expect(createdRenderables[0]?.role).toBe("model");
    expect(
      (createdRenderables[0] as unknown as { resourceReady: boolean })
        .resourceReady,
    ).toBe(true);

    runtime.dispose();
  });

  test("runs model effects after the GLB source handle is ready", async () => {
    const updateEffect = vi.fn();
    const runtime = await createPipelineRuntime({
      loadModel: async () => ({
        scene: {
          children: [],
          clone() {
            return this;
          },
        },
      }),
      effects: [
        defineWebGLEffect({
          kind: "custom.modelProbe",
          source: "model/glb",
          update(ctx) {
            updateEffect(ctx.source);
          },
        }),
      ],
    });
    const anchor = document.createElement("div");

    runtime.registerTarget(anchor, {
      key: "product",
      source: { kind: "model", format: "glb", src: "/product.glb" },
      effects: [{ kind: "custom.modelProbe" }],
    });

    await runtime.sync();

    expect(updateEffect).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "model/glb",
        src: "/product.glb",
        model: expect.objectContaining({
          sampleVertices: expect.any(Function),
          createPointCloud: expect.any(Function),
        }),
      }),
    );

    runtime.dispose();
  });

  test("unregistering a target disposes the matching renderable once", async () => {
    const disposeCallsByKey = new Map<string, ReturnType<typeof vi.fn>>();
    const runtime = await createPipelineRuntime({
      onRenderableCreated(renderable) {
        const originalDispose = renderable.dispose.bind(renderable);
        const dispose = vi.fn(originalDispose);

        renderable.dispose = dispose;
        disposeCallsByKey.set(renderable.key, dispose);
      },
    });

    runtime.registerTarget(document.createElement("section"), { key: "hero" });
    runtime.registerTarget(document.createElement("section"), { key: "details" });

    await runtime.sync();

    runtime.unregisterTarget("hero");
    runtime.unregisterTarget("hero");

    expect(disposeCallsByKey.get("hero")).toHaveBeenCalledTimes(1);
    expect(disposeCallsByKey.get("details")).not.toHaveBeenCalled();

    runtime.dispose();
  });

  test("passes one shared frame input to renderables during sync", async () => {
    const scrollState = createScrollStateController();
    const pointerController = createPointerController();
    const receivedInputs: WebGLFrameInput[] = [];
    const runtime = await createPipelineRuntime({
      scrollState,
      pointerController,
      clock: () => 250,
      onRenderableCreated(renderable) {
        const originalUpdate = renderable.update.bind(renderable);

        renderable.update = (input) => {
          if (!input) {
            throw new Error("Expected runtime to pass WebGLFrameInput.");
          }

          receivedInputs.push(input);
          return originalUpdate(input);
        };
      },
    });

    runtime.registerTarget(document.createElement("section"), { key: "hero" });
    runtime.registerTarget(document.createElement("section"), { key: "details" });

    await runtime.sync();

    expect(receivedInputs).toHaveLength(2);
    expect(receivedInputs[0]).toBe(receivedInputs[1]);
    expect(receivedInputs[0]).toMatchObject({
      time: 250,
      delta: 0,
      scroll: {
        mode: "page",
        pageProgress: 0.4,
        direction: 1,
        velocity: 12,
      },
      pointer: {
        x: 12,
        y: 24,
        normalizedX: -0.5,
        normalizedY: 0.25,
        isInside: true,
      },
    });

    runtime.dispose();
    expect(pointerController.dispose).toHaveBeenCalledTimes(1);
  });

  test("captures pointer input from the document viewport instead of the runtime container box", async () => {
    const runtime = await createPipelineRuntime();

    document.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 700,
        clientY: 500,
      }),
    );

    await runtime.sync();

    const pointer = runtime.getDebugState().pointer;

    expect(pointer).toMatchObject({
      x: 700,
      y: 500,
      isInside: true,
    });
    expect(pointer.normalizedX).toBeCloseTo(0.75);
    expect(pointer.normalizedY).toBeCloseTo(-0.666666);

    runtime.dispose();
  });

  test("runs user-authored effects from runtime options", async () => {
    const setup = vi.fn(() => ({ updates: 0 }));
    const update = vi.fn((ctx, state: { updates: number }) => {
      state.updates += 1;
      ctx.target?.setVisible(true);
      ctx.target?.setRotation(0, ctx.pointer.normalizedX);
    });
    const sceneAdapter = createObjectRecordingSceneAdapter();
    const runtime = await createPipelineRuntime({
      effects: [
        defineWebGLEffect({
          kind: "custom.visibleTilt",
          source: "snapshot/element",
          setup,
          update,
        }),
      ],
      rendererHostFactory: (container) =>
        createRendererHostStub(container, sceneAdapter),
      measureElement: () => createLayoutMeasurement(12, 24, 200, 120),
      pointerController: createPointerController({
        isInside: true,
        normalizedX: 1,
        normalizedY: -0.5,
      }),
    });
    const element = document.createElement("section");

    runtime.registerTarget(element, {
      key: "custom.surface",
      source: { kind: "snapshot", mode: "element" },
      effects: [{ kind: "custom.visibleTilt" }],
    });

    await runtime.sync();
    await runtime.sync();

    expect(setup).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      key: "custom.surface",
      sourceKind: "snapshot/element",
      pointer: { normalizedX: 1 },
      target: {
        setVisible: expect.any(Function),
        setRotation: expect.any(Function),
      },
    });
    expect(sceneAdapter.objects[0]?.object3D).toMatchObject({
      visible: true,
    });

    runtime.dispose();
  });

  test("runs consumer-authored effects only when passed to the runtime", async () => {
    const sceneAdapter = createObjectRecordingSceneAdapter();
    const runtime = await createPipelineRuntime({
      effects: [testSurfaceEffect, testPointerTiltEffect],
      rendererHostFactory: (container) =>
        createRendererHostStub(container, sceneAdapter),
      measureElement: () => createLayoutMeasurement(12, 24, 200, 120),
      pointerController: createPointerController({
        isInside: true,
        normalizedX: 1,
        normalizedY: -0.5,
      }),
    });
    const element = document.createElement("section");

    runtime.registerTarget(element, {
      key: "consumer.surface",
      source: { kind: "snapshot", mode: "element" },
      effects: [
        { kind: "test.surface", opacity: 0.84 },
        { kind: "test.pointerTilt", strength: 0.5, maxDegrees: 10 },
      ],
    });

    await runtime.sync();

    const mesh = sceneAdapter.objects[0]?.object3D as {
      visible?: boolean;
      rotation?: { x?: number; y?: number };
      material?: { opacity?: number; transparent?: boolean };
    };

    expect(runtime.getDebugState().targets[0]?.error).toBeUndefined();
    expect(mesh.visible).toBe(true);
    expect(mesh.material?.transparent).toBe(true);
    expect(mesh.material?.opacity).toBe(0.84);
    expect(mesh.rotation?.x).toBeCloseTo(0.0436332313);
    expect(mesh.rotation?.y).toBeCloseTo(0.0872664626);

    runtime.dispose();
  });

  test("reports target effects that were not passed to the runtime", async () => {
    const runtime = await createPipelineRuntime();

    runtime.registerTarget(document.createElement("section"), {
      key: "missing.effect",
      effects: [{ kind: "custom.missing" }],
    });

    expect(() => runtime.sync()).toThrow(
      'WebGL target "missing.effect" references unknown effect "custom.missing". Register it through createWebGLRuntime({ effects: [...] }).',
    );
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "missing.effect",
      resourceStatus: "error",
      lifecycleState: "error",
      error:
        'WebGL target "missing.effect" references unknown effect "custom.missing". Register it through createWebGLRuntime({ effects: [...] }).',
    });

    runtime.dispose();
  });

  test("registers and unregisters gate targets with the scroll controller", async () => {
    const scrollController = createGateAwareScrollController();
    const runtime = await createPipelineRuntime({ scrollState: scrollController });
    const gateElement = document.createElement("section");
    const gateRect = readZeroDOMRect();
    const getBoundingClientRect = vi.fn(() => gateRect);

    gateElement.getBoundingClientRect = getBoundingClientRect;

    runtime.registerTarget(gateElement, {
      key: "hero.scene",
      scroll: {
        type: "gate",
        start: "top top",
        duration: 1,
        release: "both-directions-complete",
      },
    });

    expect(scrollController.registerGateTarget).toHaveBeenCalledWith({
      key: "hero.scene",
      scroll: {
        type: "gate",
        start: "top top",
        duration: 1,
        release: "both-directions-complete",
      },
      getRect: expect.any(Function),
    });
    expect(scrollController.registeredGateTargets[0]?.getRect()).toBe(gateRect);
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);

    runtime.unregisterTarget(" hero.scene ");

    expect(scrollController.unregisterGateTarget).toHaveBeenCalledWith(
      "hero.scene",
    );

    runtime.dispose();
  });

  test("passes gate frame input to renderables after the scroll controller enters a gate", async () => {
    const scrollController = createGateAwareScrollController();
    const receivedInputs: WebGLFrameInput[] = [];
    const runtime = await createPipelineRuntime({
      scrollState: scrollController,
      onRenderableCreated(renderable) {
        const originalUpdate = renderable.update.bind(renderable);

        renderable.update = (input) => {
          if (!input) {
            throw new Error("Expected runtime to pass WebGLFrameInput.");
          }

          receivedInputs.push(input);
          return originalUpdate(input);
        };
      },
    });

    runtime.registerTarget(document.createElement("section"), {
      key: "hero.scene",
      scroll: {
        type: "gate",
        start: "top top",
        duration: 1,
      },
    });
    scrollController.enterGate("hero.scene", 0.25);

    await runtime.sync();

    expect(receivedInputs).toHaveLength(1);
    expect(receivedInputs[0]?.scroll).toEqual({
      mode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 0.25,
      direction: 1,
      velocity: 250,
    });

    runtime.dispose();
  });

  test("keeps fallback visible while async renderable loading is pending", async () => {
    let resolveLoad: (() => void) | undefined;
    const runtime = await createPipelineRuntime({
      onRenderableCreated(renderable) {
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
          }),
        });
        const originalUpdate = renderable.update.bind(renderable);

        renderable.update = async (input) => {
          await new Promise<void>((resolve) => {
            resolveLoad = resolve;
          });
          return originalUpdate(input);
        };
      },
    });
    const element = document.createElement("section");

    runtime.registerTarget(element, {
      key: "hero.async",
      lifecycle: { hideWhenReady: true, hideMode: "subtree" },
    });

    const syncResult = runtime.sync();

    expect(element.style.visibility).toBe("");

    resolveLoad?.();
    await syncResult;

    expect(element.style.visibility).toBe("hidden");

    runtime.dispose();
  });

  test("async resource completion renders after the scene object attaches", async () => {
    let resolveLoad: (() => void) | undefined;
    const sceneAdapter = createRecordingSceneAdapter();
    const runtime = await createPipelineRuntime({
      rendererHostFactory: (container) =>
        createRendererHostStub(container, sceneAdapter),
      onRenderableCreated(renderable) {
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
          }),
        });
        const originalUpdate = renderable.update.bind(renderable);

        renderable.update = async (input) => {
          await new Promise<void>((resolve) => {
            resolveLoad = resolve;
          });
          return originalUpdate(input);
        };
      },
    });

    runtime.registerTarget(document.createElement("section"), {
      key: "hero.async",
    });

    const syncResult = runtime.sync();

    expect(sceneAdapter.render).not.toHaveBeenCalled();

    resolveLoad?.();
    await syncResult;

    expect(sceneAdapter.render).toHaveBeenCalledTimes(1);

    runtime.dispose();
  });

  test("mixed synchronous and async updates render synchronous scene changes before async completion", async () => {
    let resolveLoad: (() => void) | undefined;
    const sceneAdapter = createRecordingSceneAdapter();
    const runtime = await createPipelineRuntime({
      rendererHostFactory: (container) =>
        createRendererHostStub(container, sceneAdapter),
      onRenderableCreated(renderable) {
        if (renderable.key !== "hero.async") {
          return;
        }

        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
            visible: true,
          }),
        });
        const originalUpdate = renderable.update.bind(renderable);

        renderable.update = async (input) => {
          await new Promise<void>((resolve) => {
            resolveLoad = resolve;
          });
          return originalUpdate(input);
        };
      },
    });

    runtime.registerTarget(document.createElement("section"), {
      key: "hero.sync",
    });
    runtime.registerTarget(document.createElement("section"), {
      key: "hero.async",
    });

    const syncResult = runtime.sync();

    expect(sceneAdapter.render).toHaveBeenCalledTimes(1);

    resolveLoad?.();
    await syncResult;

    expect(sceneAdapter.render).toHaveBeenCalledTimes(2);

    runtime.dispose();
  });

  test("does not let stale async readiness hide a new same-key target", async () => {
    let resolveOldUpdate: (() => void) | undefined;
    let createdCount = 0;
    const runtime = await createPipelineRuntime({
      onRenderableCreated(renderable) {
        createdCount += 1;

        if (createdCount === 1) {
          Object.defineProperty(renderable, "sceneObjectController", {
            configurable: true,
            get: () => ({
              attached: true,
            }),
          });
          const originalUpdate = renderable.update.bind(renderable);

          renderable.update = async (input) => {
            await new Promise<void>((resolve) => {
              resolveOldUpdate = resolve;
            });
            return originalUpdate(input);
          };
          return;
        }

        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: false,
          }),
        });
      },
    });
    const oldElement = document.createElement("section");
    const newElement = document.createElement("section");

    runtime.registerTarget(oldElement, {
      key: "hero.async",
      lifecycle: { hideWhenReady: true, hideMode: "subtree" },
    });

    const oldSync = runtime.sync();

    runtime.unregisterTarget("hero.async");
    runtime.registerTarget(newElement, {
      key: "hero.async",
      lifecycle: { hideWhenReady: true, hideMode: "subtree" },
    });
    await runtime.sync();

    resolveOldUpdate?.();
    await oldSync;

    expect(oldElement.style.visibility).toBe("");
    expect(newElement.style.visibility).toBe("");

    runtime.dispose();
  });

  test("reports active gate state through runtime debug state", async () => {
    const scrollController = createGateAwareScrollController();
    const runtime = await createPipelineRuntime({ scrollState: scrollController });

    scrollController.enterGate("hero.scene", 0.5);

    await runtime.sync();

    expect(runtime.getDebugState()).toMatchObject({
      currentScrollMode: "gate",
      activeGateKey: "hero.scene",
      sceneProgress: 0.5,
    });

    runtime.dispose();
  });

  test("updates renderable layout every sync and invalidates dirty raster state", async () => {
    const element = document.createElement("section");
    const layouts: unknown[] = [];
    const invalidateContent = vi.fn();
    let syncCount = 0;
    const runtime = await createPipelineRuntime({
      measureElement: () =>
        ({
          x: 0,
          y: 0,
          left: 24,
          top: 40,
          right: 224,
          bottom: 160,
          width: 200,
          height: 120,
        }) as DOMRect,
      invalidationController: {
        observeTarget: vi.fn(),
        unobserveTarget: vi.fn(),
        consumeDirtyKeys() {
          syncCount += 1;
          return syncCount === 2 ? new Set(["responsive.box"]) : new Set();
        },
        dispose: vi.fn(),
      },
      onRenderableCreated(renderable) {
        const originalUpdateLayout = renderable.updateLayout?.bind(renderable);

        renderable.invalidateContent = invalidateContent;
        renderable.updateLayout = (snapshot) => {
          layouts.push(snapshot);
          originalUpdateLayout?.(snapshot);
        };
      },
    });

    runtime.registerTarget(element, { key: "responsive.box" });

    await runtime.sync();
    Object.assign(element.style, { backgroundColor: "rgb(40, 50, 60)" });
    await runtime.sync();

    expect(layouts).toHaveLength(2);
    expect(invalidateContent).toHaveBeenCalledTimes(1);
    expect(layouts[0]).toMatchObject({
      left: 24,
      top: 40,
      width: 200,
      height: 120,
      viewport: { width: 800, height: 600 },
    });

    runtime.dispose();
  });
});

async function createPipelineRuntime(
  options: Omit<RuntimePipelineOptions, "container"> = {},
): Promise<RuntimeWithPipelineSurface> {
  const { createWebGLRuntime } = await import("./runtime");
  const container = document.createElement("div");

  return createWebGLRuntime({
    container,
    rendererHostFactory: createRendererHostStub,
    ...options,
  } as RuntimePipelineOptions) as RuntimeWithPipelineSurface;
}

function createRendererHostStub(
  container: HTMLElement,
  sceneAdapter: WebGLSceneAdapter = createRecordingSceneAdapter(),
): ThreeRendererHost {
  const canvas = container.ownerDocument.createElement("canvas");

  Object.defineProperty(canvas, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        toJSON: () => undefined,
      }) as DOMRect,
  });

  return {
    canvas,
    camera: {},
    renderer: {
      canvas,
      render() {
        // Tests cover runtime ownership without touching a real WebGL context.
      },
      dispose() {
        // Tests cover runtime ownership without touching a real WebGL context.
      },
    },
    scene: {},
    sceneAdapter,
    getViewportSize() {
      return { width: 800, height: 600 };
    },
    resizeIfNeeded() {
      return;
    },
    dispose() {
      canvas.remove();
    },
  };
}

function createRecordingSceneAdapter(): WebGLSceneAdapter & {
  render: ReturnType<typeof vi.fn>;
} {
  return {
    addObject() {
      return;
    },
    removeObject() {
      return;
    },
    render: vi.fn(),
  };
}

function createObjectRecordingSceneAdapter(): WebGLSceneAdapter & {
  objects: Array<{ object3D?: unknown }>;
  render: ReturnType<typeof vi.fn>;
} {
  const objects: Array<{ object3D?: unknown }> = [];

  return {
    objects,
    addObject(object) {
      objects.push(object);
    },
    removeObject(object) {
      const index = objects.indexOf(object);

      if (index !== -1) {
        objects.splice(index, 1);
      }
    },
    render: vi.fn(),
  };
}

function readZeroMeasurement(): ElementMeasurement {
  return {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
}

function readZeroDOMRect(): DOMRect {
  return {
    ...readZeroMeasurement(),
    toJSON() {
      return readZeroMeasurement();
    },
  } as DOMRect;
}

function createLayoutMeasurement(
  left: number,
  top: number,
  width: number,
  height: number,
): ElementMeasurement {
  return {
    x: left,
    y: top,
    width,
    height,
    top,
    right: left + width,
    bottom: top + height,
    left,
  };
}

function createCanvasContextStub(): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function countRoles(renderables: Renderable[]): Partial<Record<string, number>> {
  return renderables.reduce<Partial<Record<string, number>>>(
    (counts, renderable) => {
      counts[renderable.role] = (counts[renderable.role] ?? 0) + 1;
      return counts;
    },
    {},
  );
}

function createScrollStateController(): ScrollStateController {
  const scroll = {
    mode: "page" as const,
    pageProgress: 0.4,
    direction: 1 as const,
    velocity: 12,
  };

  return {
    getState() {
      return scroll;
    },
    update() {
      return scroll;
    },
  };
}

function createGateAwareScrollController(): ScrollStateController & {
  registeredGateTargets: ScrollControllerGateTarget[];
  registerGateTarget: ReturnType<typeof vi.fn>;
  unregisterGateTarget: ReturnType<typeof vi.fn>;
  enterGate(key: string, sceneProgress: number): void;
} {
  let scroll: WebGLFrameInput["scroll"] = {
    mode: "page",
    pageProgress: 0,
    direction: 0,
    velocity: 0,
  };
  const registeredGateTargets: ScrollControllerGateTarget[] = [];

  return {
    registeredGateTargets,
    getState() {
      return scroll;
    },
    update() {
      return scroll;
    },
    registerGateTarget: vi.fn((target: ScrollControllerGateTarget) => {
      registeredGateTargets.push(target);
    }),
    unregisterGateTarget: vi.fn((key: string) => {
      const index = registeredGateTargets.findIndex(
        (target) => target.key === key,
      );

      if (index !== -1) {
        registeredGateTargets.splice(index, 1);
      }
    }),
    enterGate(key: string, sceneProgress: number) {
      scroll = {
        mode: "gate",
        activeGateKey: key,
        sceneProgress,
        direction: 1,
        velocity: 250,
      };
    },
  };
}

function createPointerController(
  pointer: Partial<WebGLFrameInput["pointer"]> = {},
): PointerController {
  return {
    getState() {
      return {
        x: 12,
        y: 24,
        normalizedX: -0.5,
        normalizedY: 0.25,
        isInside: true,
        isDown: false,
        downTime: 0,
        pressDuration: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragDeltaX: 0,
        dragDeltaY: 0,
        clickCount: 0,
        ...pointer,
      };
    },
    dispose: vi.fn(),
  };
}
