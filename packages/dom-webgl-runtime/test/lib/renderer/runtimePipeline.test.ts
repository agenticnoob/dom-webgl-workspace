import { afterEach, describe, expect, test, vi } from "vitest";
import { Group } from "three/src/objects/Group.js";

import type { ScrollStateController } from "../../../src/lib/input/frameInput";
import type { PointerController } from "../../../src/lib/input/pointerController";
import type { ScrollControllerGateTarget } from "../../../src/lib/input/scrollController";
import { defineWebGLEffect } from "../../../src/lib/effects/effectAuthoring";
import type { Renderable } from "../../../src/lib/render/renderable";
import type {
  WebGLSceneAdapter,
  WebGLSceneGroup,
  WebGLSceneObject,
} from "../../../src/lib/renderer/sceneObject";
import type {
  WebGLMediaVideoSourceDescriptor,
  WebGLModelSourceDescriptor,
} from "../../../src/lib/source/sourceDescriptor";
import type { WebGLFrameInput, WebGLScrollAdapter } from "../../../src/lib/types";
import type { createWebGLRuntime, WebGLRuntime } from "../../../src/lib/renderer/runtime";
import type { ThreeRendererHost } from "../../../src/lib/renderer/threeRenderer";
import type {
  InternalRenderCameraEntry,
  InternalRenderLayerRegistry,
  InternalRenderPassEntry,
  InternalRenderSceneEntry,
} from "../../../src/lib/renderer/renderLayerRegistry";
import { createPostprocessController, type PostprocessController } from "../../../src/lib/renderer/postprocessController";

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
    source: WebGLMediaVideoSourceDescriptor,
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
  postprocessController?: PostprocessController;
  renderLayerRegistryFactory?: (
    rendererHost: ThreeRendererHost,
  ) => InternalRenderLayerRegistry;
};

type RuntimeWithPipelineSurface = WebGLRuntime & {
  unregisterTarget(key: string): void;
  sync(): void | Promise<void>;
};

type LayerSourceCase = {
  name: string;
  key: string;
  element: HTMLElement;
  declaration: Parameters<RuntimeWithPipelineSurface["registerTarget"]>[1];
  depthMode: "flat" | "model";
};

const testSurfaceEffect = defineWebGLEffect<{
  kind: "test.surface";
  opacity?: number;
}>({
  kind: "test.surface",
  source: "dom/element",
  update(ctx, _state, params) {
    ctx.object.visible = true;
    ctx.object.opacity = params.opacity ?? 1;
  },
});

function createLayerSourceCases(): LayerSourceCase[] {
  const domElement = document.createElement("section");
  const domText = document.createElement("p");
  const image = document.createElement("img");
  const video = document.createElement("video");
  const sequence = document.createElement("section");
  const model = document.createElement("section");

  domText.textContent = "Layer text";
  image.src = "/example/image.png";
  video.src = "/example/video.mp4";

  Object.defineProperty(image, "decode", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(video, "pause", {
    configurable: true,
    value: vi.fn(),
  });

  return [
    {
      name: "dom element",
      key: "case.dom.element",
      element: domElement,
      declaration: {
        key: "case.dom.element",
        source: { kind: "dom", type: "element" },
      },
      depthMode: "flat",
    },
    {
      name: "dom text",
      key: "case.dom.text",
      element: domText,
      declaration: {
        key: "case.dom.text",
        source: { kind: "dom", type: "text" },
      },
      depthMode: "flat",
    },
    {
      name: "media image",
      key: "case.media.image",
      element: image,
      declaration: {
        key: "case.media.image",
        source: { kind: "media", type: "image", src: "/example/image.png" },
      },
      depthMode: "flat",
    },
    {
      name: "media video",
      key: "case.media.video",
      element: video,
      declaration: {
        key: "case.media.video",
        source: { kind: "media", type: "video", src: "/example/video.mp4" },
      },
      depthMode: "flat",
    },
    {
      name: "media image sequence",
      key: "case.media.sequence",
      element: sequence,
      declaration: {
        key: "case.media.sequence",
        source: {
          kind: "media",
          type: "image-sequence",
          frameCount: 1,
          frames: [document.createElement("canvas")],
        },
      },
      depthMode: "flat",
    },
    {
      name: "model glb",
      key: "case.model.glb",
      element: model,
      declaration: {
        key: "case.model.glb",
        source: { kind: "model", type: "glb", src: "/models/hero.glb" },
      },
      depthMode: "model",
    },
  ];
}

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

    ctx.object.rotation.set(
      -ctx.pointer.normalizedY * radians * strength,
      ctx.pointer.normalizedX * radians * strength,
      0,
    );
  },
});

describe("runtime pipeline sync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("three/addons/loaders/GLTFLoader.js");
    vi.doUnmock("../../../src/lib/assets/modelLoader");
    vi.doUnmock("../resources/resourceManager");
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

  test("marks imperative runtime targets as managed fallback roots until unregister or dispose", async () => {
    const runtime = await createPipelineRuntime();
    const { isManagedFallbackRoot } = await import("../../../src/lib/dom/fallbackBoundary");
    const element = document.createElement("section");
    const disposedElement = document.createElement("section");

    runtime.registerTarget(element, { key: "hero" });
    runtime.registerTarget(disposedElement, { key: "disposed.hero" });

    expect(isManagedFallbackRoot(element)).toBe(true);
    expect(isManagedFallbackRoot(disposedElement)).toBe(true);

    runtime.unregisterTarget("hero");

    expect(isManagedFallbackRoot(element)).toBe(false);
    expect(isManagedFallbackRoot(disposedElement)).toBe(true);

    runtime.dispose();

    expect(isManagedFallbackRoot(disposedElement)).toBe(false);
  });

  test("registering image video and model declarations creates renderables with inferred roles", async () => {
    const createdRenderables: Renderable[] = [];
    const runtime = await createPipelineRuntime({
      loadVideo: async (source) => source.element ?? document.createElement("video"),
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
      source: { kind: "model", type: "glb", src: "/product.glb" },
    });

    await runtime.sync();

    expect(countRoles(createdRenderables)).toEqual({
      media: 2,
      model: 1,
    });

    runtime.dispose();
  });

  test("passes runtime model loader config to default model renderables", async () => {
    vi.resetModules();
    const loadGLBModel = vi.fn(async () => createModelObject3DStub());

    vi.doMock("../../../src/lib/assets/modelLoader", () => ({
      loadGLBModel,
    }));

    const runtime = await createPipelineRuntime({
      modelLoader: { draco: { decoderPath: "/runtime-draco/" } },
      measureElement: () => createLayoutMeasurement(0, 0, 200, 200),
    });
    const anchor = document.createElement("section");

    runtime.registerTarget(anchor, {
      key: "runtime.loader.model",
      source: { kind: "model", type: "glb", src: "/runtime-loader.glb" },
    });

    await runtime.sync();

    expect(loadGLBModel).toHaveBeenCalledWith(
      expect.objectContaining({ src: "/runtime-loader.glb" }),
      { runtimeLoader: { draco: { decoderPath: "/runtime-draco/" } } },
    );

    runtime.dispose();
  });

  test("passes active viewport priority to resource loads", async () => {
    const priorities: Array<number | undefined> = [];

    vi.resetModules();
    vi.doMock("../../../src/lib/resources/resourceManager", async () => {
      const actual = await vi.importActual<
        typeof import("../../../src/lib/resources/resourceManager")
      >("../../../src/lib/resources/resourceManager");

      return {
        ...actual,
        createResourceManager(
          options: Parameters<typeof actual.createResourceManager>[0] = {},
        ) {
          return actual.createResourceManager({
            ...options,
            readPriority() {
              const priority = options.readPriority?.();
              priorities.push(priority);
              return priority;
            },
          });
        },
      };
    });

    const runtime = await createPipelineRuntime({
      loadModel: async () => createModelObject3DStub(),
      measureElement: () => createLayoutMeasurement(0, 0, 200, 200),
    });
    const modelAnchor = document.createElement("section");

    runtime.registerTarget(modelAnchor, {
      key: "priority.model",
      source: { kind: "model", type: "glb", src: "/priority.glb" },
    });

    await runtime.sync();

    expect(priorities).toContain(100);

    runtime.dispose();
  });

  test("reports image sequence source kind and media role in debug state", async () => {
    const runtime = await createPipelineRuntime({
      onRenderableCreated(renderable) {
        renderable.update = () => undefined;
      },
    });
    const anchor = document.createElement("section");

    runtime.registerTarget(anchor, {
      key: "sequence.hero",
      source: {
        kind: "media",
        type: "image-sequence",
        frameCount: 10,
        frames: createFrames(10),
      },
    });

    await runtime.sync();

    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "sequence.hero",
      sourceKind: "media/image-sequence",
      renderRole: "media",
    });

    runtime.dispose();
  });

  test("aggregates renderable texture telemetry into debug warnings without exposing textures", async () => {
    const image = document.createElement("img");
    image.src = "/large-poster.png";
    Object.defineProperties(image, {
      naturalWidth: { value: 2048 },
      naturalHeight: { value: 1024 },
      decode: {
        configurable: true,
        value: vi.fn().mockResolvedValue(undefined),
      },
    });
    const runtime = await createPipelineRuntime({
      performanceBudget: { maxTextureSize: 1024 },
    });

    runtime.registerTarget(image, { key: "large.poster" });

    await runtime.sync();
    const debugState = runtime.getDebugState();

    expect(debugState.warnings).toContainEqual({
      code: "performance-budget-exceeded",
      target: "textureSize",
      count: 2048,
      limit: 1024,
    });
    expect(debugState).not.toHaveProperty("textures");

    runtime.dispose();
  });

  test("orders nested child target scene objects above parent media scene object", async () => {
    const sceneAdapter = createObjectRecordingSceneAdapter();
    const runtime = await createPipelineRuntime({
      rendererHostFactory: (container) =>
        createRendererHostStub(container, sceneAdapter),
      measureElement: () => createLayoutMeasurement(0, 0, 240, 160),
    });
    const parent = document.createElement("section");
    const child = document.createElement("p");
    child.textContent = "Nested card copy";
    parent.append(child);

    runtime.registerTarget(parent, {
      key: "sequence",
      source: {
        kind: "media",
        type: "image-sequence",
        frameCount: 1,
        frames: [document.createElement("canvas")],
      },
    });
    runtime.registerTarget(child, {
      key: "sequence.copy",
      source: { kind: "dom", type: "text" },
    });

    await runtime.sync();

    const parentOrder = sceneAdapter.objects.find(
      (object) => object.key === "sequence",
    )?.ordering?.renderOrder;
    const childOrder = sceneAdapter.objects.find(
      (object) => object.key === "sequence.copy",
    )?.ordering?.renderOrder;

    expect(parentOrder).toBeTypeOf("number");
    expect(childOrder).toBeTypeOf("number");
    expect(childOrder!).toBeGreaterThan(parentOrder!);
    expect(runtime.getDebugState().targets).toEqual([
      expect.objectContaining({
        key: "sequence",
        layerDepth: 0,
        siblingIndex: 0,
        computedRenderOrder: parentOrder,
      }),
      expect.objectContaining({
        key: "sequence.copy",
        parentKey: "sequence",
        layerDepth: 1,
        siblingIndex: 0,
        computedRenderOrder: childOrder,
      }),
    ]);

    runtime.dispose();
  });

  test("attaches subtree transform descendants under a parent group with local layouts", async () => {
    const sceneAdapter = createTransformGroupRecordingSceneAdapter();
    const textEffectUpdates: Array<{
      key: string;
      sourceKind: string;
      width: number;
      height: number;
    }> = [];
    const runtime = await createPipelineRuntime({
      effects: [
        defineWebGLEffect({
          kind: "test.textProbe",
          source: "dom/text",
          update(ctx) {
            textEffectUpdates.push({
              key: ctx.key,
              sourceKind: ctx.sourceKind,
              width: ctx.layout.width,
              height: ctx.layout.height,
            });
          },
        }),
      ],
      rendererHostFactory: (container) =>
        createRendererHostStub(container, sceneAdapter),
      measureElement: createMappedMeasureElement(
        new Map([
          ["sequence", createLayoutMeasurement(0, 0, 600, 320)],
          ["card", createLayoutMeasurement(100, 120, 220, 140)],
          ["card.title", createLayoutMeasurement(130, 150, 160, 32)],
          ["sibling", createLayoutMeasurement(420, 80, 180, 40)],
        ]),
      ),
    });
    const sequence = document.createElement("section");
    const card = document.createElement("aside");
    const title = document.createElement("strong");
    const sibling = document.createElement("p");
    title.textContent = "Nested text";
    sequence.dataset.testKey = "sequence";
    card.dataset.testKey = "card";
    title.dataset.testKey = "card.title";
    sibling.dataset.testKey = "sibling";
    sequence.append(card);
    card.append(title);

    runtime.registerTarget(sequence, {
      key: "sequence",
      source: { kind: "dom", type: "element" },
    });
    runtime.registerTarget(card, {
      key: "card",
      source: { kind: "dom", type: "element" },
      transformScope: "subtree",
    });
    runtime.registerTarget(title, {
      key: "card.title",
      source: { kind: "dom", type: "text" },
      effects: [{ kind: "test.textProbe" }],
    });
    runtime.registerTarget(sibling, {
      key: "sibling",
      source: { kind: "dom", type: "element" },
    });

    await runtime.sync();

    expect(sceneAdapter.groupsByKey.has("card")).toBe(true);
    expect(sceneAdapter.objectParentsByKey.get("sequence")).toBeUndefined();
    expect(sceneAdapter.objectParentsByKey.get("card")).toBe("card");
    expect(sceneAdapter.objectParentsByKey.get("card.title")).toBe("card");
    expect(sceneAdapter.objectParentsByKey.get("sibling")).toBeUndefined();
    expect(readTransformGroupObject3D(sceneAdapter, "card")).toMatchObject({
      position: { x: 210, y: 410, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
    expect(readSceneObjectLastLayout(sceneAdapter, "card")).toEqual({
      x: 0,
      y: 0,
      width: 220,
      height: 140,
    });
    expect(readSceneObjectLastLayout(sceneAdapter, "card.title")).toEqual({
      x: 0,
      y: 24,
      width: 160,
      height: 32,
    });
    expect(readSceneObjectLastLayout(sceneAdapter, "sibling")).toEqual({
      x: 510,
      y: 500,
      width: 180,
      height: 40,
    });
    expect(textEffectUpdates).toEqual([
      {
        key: "card.title",
        sourceKind: "dom/text",
        width: 160,
        height: 32,
      },
    ]);

    runtime.dispose();
  });

  test("attaches managed-scene subtree transform groups through the target scene adapter", async () => {
    const mainAdapter = createTransformGroupRecordingSceneAdapter();
    const worldAdapter = createTransformGroupRecordingSceneAdapter();
    const runtime = await createPipelineRuntime({
      rendererHostFactory: (container) =>
        createRendererHostStub(container, mainAdapter),
      renderLayerRegistryFactory: () =>
        createRenderLayerRegistryStub(mainAdapter, {
          scenes: { world: worldAdapter },
        }).registry,
      measureElement: createMappedMeasureElement(
        new Map([
          ["card", createLayoutMeasurement(100, 120, 220, 140)],
          ["card.title", createLayoutMeasurement(130, 150, 160, 32)],
        ]),
      ),
    });
    const card = document.createElement("aside");
    const title = document.createElement("strong");
    card.dataset.testKey = "card";
    title.dataset.testKey = "card.title";
    title.textContent = "Nested text";
    card.append(title);

    runtime.registerTarget(card, {
      key: "card",
      sceneId: "world",
      source: { kind: "dom", type: "element" },
      transformScope: "subtree",
    });
    runtime.registerTarget(title, {
      key: "card.title",
      sceneId: "world",
      source: { kind: "dom", type: "text" },
    });

    await runtime.sync();

    expect(mainAdapter.groupsByKey.size).toBe(0);
    expect(mainAdapter.objectParentsByKey.get("card.title")).toBeUndefined();
    expect(worldAdapter.groupsByKey.has("card")).toBe(true);
    expect(worldAdapter.objectParentsByKey.get("card")).toBe("card");
    expect(worldAdapter.objectParentsByKey.get("card.title")).toBe("card");
    expect(readSceneObjectLastLayout(worldAdapter, "card.title")).toEqual({
      x: 0,
      y: 24,
      width: 160,
      height: 32,
    });

    runtime.dispose();
  });

  test("removes a parent transform group without disposing still-registered children", async () => {
    const sceneAdapter = createTransformGroupRecordingSceneAdapter();
    const disposeCallsByKey = new Map<string, ReturnType<typeof vi.fn>>();
    const runtime = await createPipelineRuntime({
      rendererHostFactory: (container) =>
        createRendererHostStub(container, sceneAdapter),
      measureElement: createMappedMeasureElement(
        new Map([
          ["card", createLayoutMeasurement(100, 120, 220, 140)],
          ["card.title", createLayoutMeasurement(130, 150, 160, 32)],
        ]),
      ),
      onRenderableCreated(renderable) {
        const originalDispose = renderable.dispose.bind(renderable);
        const dispose = vi.fn(originalDispose);
        renderable.dispose = dispose;
        disposeCallsByKey.set(renderable.key, dispose);
      },
    });
    const card = document.createElement("aside");
    const title = document.createElement("strong");
    card.dataset.testKey = "card";
    title.dataset.testKey = "card.title";
    title.textContent = "Nested text";
    card.append(title);

    runtime.registerTarget(card, {
      key: "card",
      source: { kind: "dom", type: "element" },
      transformScope: "subtree",
    });
    runtime.registerTarget(title, {
      key: "card.title",
      source: { kind: "dom", type: "text" },
    });

    await runtime.sync();
    runtime.unregisterTarget("card");
    await runtime.sync();

    expect(sceneAdapter.removedGroupKeys).toEqual(["card"]);
    expect(disposeCallsByKey.get("card")).toHaveBeenCalledTimes(1);
    expect(disposeCallsByKey.get("card.title")).not.toHaveBeenCalled();
    expect(sceneAdapter.objectParentsByKey.get("card.title")).toBeUndefined();

    runtime.dispose();
  });

  test("keeps flat scene attachment and absolute layouts without transformScope", async () => {
    const sceneAdapter = createTransformGroupRecordingSceneAdapter();
    const runtime = await createPipelineRuntime({
      rendererHostFactory: (container) =>
        createRendererHostStub(container, sceneAdapter),
      measureElement: createMappedMeasureElement(
        new Map([
          ["card", createLayoutMeasurement(100, 120, 220, 140)],
          ["card.title", createLayoutMeasurement(130, 150, 160, 32)],
        ]),
      ),
    });
    const card = document.createElement("aside");
    const title = document.createElement("strong");
    card.dataset.testKey = "card";
    title.dataset.testKey = "card.title";
    title.textContent = "Nested text";
    card.append(title);

    runtime.registerTarget(card, {
      key: "card",
      source: { kind: "dom", type: "element" },
    });
    runtime.registerTarget(title, {
      key: "card.title",
      source: { kind: "dom", type: "text" },
    });

    await runtime.sync();

    expect(sceneAdapter.groupsByKey.size).toBe(0);
    expect(sceneAdapter.objectParentsByKey.get("card")).toBeUndefined();
    expect(sceneAdapter.objectParentsByKey.get("card.title")).toBeUndefined();
    expect(readSceneObjectLastLayout(sceneAdapter, "card.title")).toEqual({
      x: 210,
      y: 434,
      width: 160,
      height: 32,
    });

    runtime.dispose();
  });

  test("routes subtree parent effect target transforms to the parent group", async () => {
    const sceneAdapter = createTransformGroupRecordingSceneAdapter();
    const sourceHandleReady: boolean[] = [];
    const disposeCallsByKey = new Map<string, ReturnType<typeof vi.fn>>();
    const runtime = await createPipelineRuntime({
      effects: [
        defineWebGLEffect({
          kind: "test.groupTransform",
          source: "dom/element",
          update(ctx) {
            sourceHandleReady.push(Boolean(ctx.object.surface));
            ctx.object.position.set(12, -8, 3);
            ctx.object.rotation.set(0.1, -0.2, 0.3);
            ctx.object.scale.set(1.4, 0.8, 0.6);
            ctx.object.visible = false;
            ctx.object.opacity = 0.42;
          },
        }),
      ],
      rendererHostFactory: (container) =>
        createRendererHostStub(container, sceneAdapter),
      measureElement: createMappedMeasureElement(
        new Map([
          ["card", createLayoutMeasurement(100, 120, 220, 140)],
          ["card.title", createLayoutMeasurement(130, 150, 160, 32)],
        ]),
      ),
      onRenderableCreated(renderable) {
        const originalDispose = renderable.dispose.bind(renderable);
        const dispose = vi.fn(originalDispose);
        renderable.dispose = dispose;
        disposeCallsByKey.set(renderable.key, dispose);
      },
    });
    const card = document.createElement("aside");
    const title = document.createElement("strong");
    card.dataset.testKey = "card";
    title.dataset.testKey = "card.title";
    title.textContent = "Nested text";
    card.append(title);

    runtime.registerTarget(card, {
      key: "card",
      source: { kind: "dom", type: "element" },
      transformScope: "subtree",
      effects: [{ kind: "test.groupTransform" }],
    });
    runtime.registerTarget(title, {
      key: "card.title",
      source: { kind: "dom", type: "text" },
    });

    await runtime.sync();

    expect(sourceHandleReady).toEqual([true]);
    expect(readTransformGroupObject3D(sceneAdapter, "card")).toMatchObject({
      visible: false,
      position: { x: 12, y: -8, z: 3 },
      rotation: { x: 0.1, y: -0.2, z: 0.3 },
      scale: { x: 1.4, y: 0.8, z: 0.6 },
      children: [
        {
          material: {
            opacity: 0.42,
            transparent: true,
            needsUpdate: true,
          },
        },
      ],
    });
    expect(sceneAdapter.objectParentsByKey.get("card.title")).toBe("card");
    expect(disposeCallsByKey.get("card.title")).not.toHaveBeenCalled();

    runtime.dispose();
  });

  test.each(createLayerSourceCases())(
    "orders nested $name target above parent media without renderRole override",
    async ({ key, element, declaration, depthMode }) => {
    const sceneAdapter = createObjectRecordingSceneAdapter();
    const parent = document.createElement("section");
    parent.append(element);
    const runtime = await createPipelineRuntime({
      rendererHostFactory: (container) =>
        createRendererHostStub(container, sceneAdapter),
      measureElement: () => createLayoutMeasurement(0, 0, 240, 160),
      loadVideo: async (source) => source.element ?? document.createElement("video"),
      loadModel: async () => createModelObject3DStub(),
    });

    runtime.registerTarget(parent, {
      key: "parent.sequence",
      source: {
        kind: "media",
        type: "image-sequence",
        frameCount: 1,
        frames: [document.createElement("canvas")],
      },
    });
    runtime.registerTarget(element, declaration);

    await runtime.sync();

    const parentObject = readSceneObject(sceneAdapter, "parent.sequence");
    const childObject = readSceneObject(sceneAdapter, key);

    expect(childObject.ordering).toMatchObject({
      transparent: true,
      depthWrite: depthMode === "model",
      depthTest: depthMode === "model",
    });
    expect(childObject.ordering?.renderOrder).toBeGreaterThan(
      parentObject.ordering?.renderOrder ?? -1,
    );
    expect(readObject3DRenderOrder(childObject.object3D)).toBe(
      childObject.ordering?.renderOrder,
    );
    expect(readObject3DRenderOrder(parentObject.object3D)).toBe(
      parentObject.ordering?.renderOrder,
    );
    if (depthMode === "model") {
      expect(
        (childObject.object3D as { children?: unknown[] }).children?.length,
      ).toBeGreaterThan(0);
    }

    runtime.dispose();
    },
  );

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
      source: { kind: "model", type: "glb", src: "/product.glb" },
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
            updateEffect(ctx.object.model);
          },
        }),
      ],
    });
    const anchor = document.createElement("div");

    runtime.registerTarget(anchor, {
      key: "product",
      source: { kind: "model", type: "glb", src: "/product.glb" },
      effects: [{ kind: "custom.modelProbe" }],
    });

    await runtime.sync();

    expect(updateEffect).toHaveBeenCalledWith(
      expect.objectContaining({
        src: "/product.glb",
        meshes: expect.objectContaining({
          all: expect.any(Function),
          forEach: expect.any(Function),
        }),
        sampling: expect.objectContaining({
          vertices: expect.any(Function),
        }),
        points: expect.objectContaining({
          create: expect.any(Function),
        }),
      }),
    );
    const modelSource = updateEffect.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(modelSource).not.toHaveProperty("createPointCloud");

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

  test("uses a public scroll adapter as the page scroll source", async () => {
    const metrics = {
      scrollY: 100,
      scrollHeight: 2000,
      viewportHeight: 1000,
    };
    const scrollAdapter: WebGLScrollAdapter = {
      readMetrics: () => metrics,
    };
    const receivedInputs: WebGLFrameInput[] = [];
    const runtime = await createPipelineRuntime({
      scrollAdapter,
      pointerController: createPointerController(),
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

    metrics.scrollY = 250;
    runtime.registerTarget(document.createElement("section"), { key: "hero" });

    await runtime.sync();

    expect(receivedInputs).toHaveLength(1);
    expect(receivedInputs[0]?.scroll).toEqual({
      mode: "page",
      pageProgress: 0.25,
      direction: 1,
      velocity: 150,
    });

    runtime.dispose();
  });

  test("runs user-authored effects from runtime options", async () => {
    const setup = vi.fn(() => ({ updates: 0 }));
    const update = vi.fn((ctx, state: { updates: number }) => {
      state.updates += 1;
      ctx.object.visible = true;
      ctx.object.rotation.set(0, ctx.pointer.normalizedX, 0);
    });
    const sceneAdapter = createObjectRecordingSceneAdapter();
    const runtime = await createPipelineRuntime({
      effects: [
        defineWebGLEffect({
          kind: "custom.visibleTilt",
          source: "dom/element",
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
      source: { kind: "dom", type: "element" },
      effects: [{ kind: "custom.visibleTilt" }],
    });

    await runtime.sync();
    await runtime.sync();

    expect(setup).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      key: "custom.surface",
      sourceKind: "dom/element",
      pointer: { normalizedX: 1 },
      object: {
        visible: true,
        rotation: {
          set: expect.any(Function),
        },
        surface: {
          draw: expect.any(Function),
        },
      },
    });
    expect(update.mock.calls[0]?.[0]).not.toHaveProperty("source");
    expect(update.mock.calls[0]?.[0]).not.toHaveProperty("target");
    expect(update.mock.calls[0]?.[0]).not.toHaveProperty("visual");
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
      source: { kind: "dom", type: "element" },
      effects: [
        { kind: "test.surface", opacity: 0.84 },
        { kind: "test.pointerTilt", strength: 0.5, maxDegrees: 10 },
      ],
    });

    await runtime.sync();

    const group = sceneAdapter.objects[0]?.object3D as {
      visible?: boolean;
      rotation?: { x?: number; y?: number };
      children?: Array<{
        material?: { opacity?: number; transparent?: boolean };
      }>;
    };
    const mesh = group.children?.[0];

    expect(runtime.getDebugState().targets[0]?.error).toBeUndefined();
    expect(group.visible).toBe(true);
    expect(mesh).toBeDefined();
    if (!mesh) {
      throw new Error("Expected element plane group to contain a mesh child.");
    }
    expect(mesh.material?.transparent).toBe(true);
    expect(mesh.material?.opacity).toBe(0.84);
    expect(group.rotation?.x).toBeCloseTo(0.0436332313);
    expect(group.rotation?.y).toBeCloseTo(0.0872664626);

    runtime.dispose();
  });

  test("passes controlled postprocess requests through the effect object facade", async () => {
    const postprocessController = createPostprocessController();
    const runtime = await createPipelineRuntime({
      postprocessController,
      effects: [
        defineWebGLEffect({
          kind: "custom.postprocess",
          source: "dom/element",
          setup(ctx) {
            return ctx.object.postprocess.request({
              key: "custom.glow",
              bloom: { strength: 0.4 },
            });
          },
          update(_ctx, handle) {
            handle.update({
              key: "custom.glow",
              bloom: { strength: 0.8 },
              blur: { radius: 0.2 },
            });
          },
        }),
      ],
    });
    const element = document.createElement("section");

    runtime.registerTarget(element, {
      key: "postprocess.surface",
      source: { kind: "dom", type: "element" },
      effects: [{ kind: "custom.postprocess" }],
    });

    await runtime.sync();

    expect(postprocessController.inspectRequests()).toEqual([
      {
        key: "custom.glow",
        bloom: { strength: 0.8 },
        blur: { radius: 0.2 },
      },
    ]);

    runtime.unregisterTarget("postprocess.surface");

    expect(postprocessController.inspectRequests()).toEqual([]);

    runtime.dispose();
  });

  test("routes effect-owned postprocess requests through the runtime render pipeline", async () => {
    const sceneAdapter = createRecordingSceneAdapter();
    const renderOrder: string[] = [];
    const requestPostprocess = vi.fn(() => ({
      update: vi.fn(),
      dispose: vi.fn(),
    }));
    const postprocessController = createStubPostprocessController({
      requestPostprocess,
      render(renderBase) {
        renderOrder.push("postprocess:before");
        renderBase();
        renderOrder.push("postprocess:after");
      },
    });
    sceneAdapter.render.mockImplementation(() => {
      renderOrder.push("scene");
    });
    const runtime = await createPipelineRuntime({
      rendererHostFactory: (container) =>
        createRendererHostStub(container, sceneAdapter),
      postprocessController,
      effects: [
        defineWebGLEffect({
          kind: "custom.pipelinePostprocess",
          source: "dom/element",
          setup(ctx) {
            return ctx.object.postprocess.request({
              key: "pipeline.glow",
              bloom: { strength: 0.3 },
            });
          },
          update() {
            return;
          },
        }),
      ],
    });

    runtime.registerTarget(document.createElement("section"), {
      key: "pipeline.surface",
      effects: [{ kind: "custom.pipelinePostprocess" }],
    });

    await runtime.sync();

    expect(requestPostprocess).toHaveBeenCalledWith({
      key: "pipeline.glow",
      bloom: { strength: 0.3 },
    });
    expect(renderOrder).toEqual([
      "postprocess:before",
      "scene",
      "postprocess:after",
    ]);

    runtime.dispose();
  });

  test("default runtime postprocess controller executes an internal screen pass", async () => {
    const sceneAdapter = createRecordingSceneAdapter();
    const setRenderTarget = vi.fn();
    const renderPostprocessPass = vi.fn();
    const runtime = await createPipelineRuntime({
      rendererHostFactory(container) {
        const host = createRendererHostStub(container, sceneAdapter);

        return {
          ...host,
          renderer: {
            ...host.renderer,
            setRenderTarget,
            render: renderPostprocessPass,
          },
        };
      },
      effects: [
        defineWebGLEffect({
          kind: "custom.defaultPostprocess",
          source: "dom/element",
          setup(ctx) {
            return ctx.object.postprocess.request({
              key: "default.glow",
              bloom: { strength: 0.35 },
            });
          },
          update() {
            return;
          },
        }),
      ],
    });

    runtime.registerTarget(document.createElement("section"), {
      key: "default.postprocess.surface",
      effects: [{ kind: "custom.defaultPostprocess" }],
    });

    await runtime.sync();

    expect(sceneAdapter.render).toHaveBeenCalledTimes(1);
    expect(setRenderTarget).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        texture: expect.anything(),
      }),
    );
    expect(setRenderTarget).toHaveBeenNthCalledWith(2, null);
    expect(renderPostprocessPass).toHaveBeenCalledTimes(1);

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

  test("restores hidden fallback when viewport lifecycle disposes a ready renderable", async () => {
    const element = document.createElement("section");
    const dispose = vi.fn();
    let measurement = createLayoutMeasurement(0, 0, 200, 120);
    const runtime = await createPipelineRuntime({
      measureElement: () => measurement,
      onRenderableCreated(renderable) {
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
            visible: true,
          }),
        });
        const originalDispose = renderable.dispose.bind(renderable);

        renderable.dispose = () => {
          dispose();
          originalDispose();
        };
      },
    });

    runtime.registerTarget(element, {
      key: "hero.lifecycle",
      lifecycle: { hideWhenReady: true, hideMode: "subtree" },
    });

    await runtime.sync();
    expect(element.style.visibility).toBe("hidden");

    measurement = createLayoutMeasurement(0, 3_600, 200, 120);
    await runtime.sync();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(element.style.visibility).toBe("");
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero.lifecycle",
      lifecycleState: "disposed",
      visible: false,
    });

    runtime.dispose();
  });

  test("offscreen disposal with self mode does not hide unregistered child DOM", async () => {
    const element = document.createElement("section");
    const child = document.createElement("button");
    child.style.visibility = "visible";
    element.appendChild(child);
    let measurement = createLayoutMeasurement(0, 0, 200, 120);

    const runtime = await createPipelineRuntime({
      measureElement: () => measurement,
    });

    runtime.registerTarget(element, {
      key: "hero.unregistered-child",
      lifecycle: { hideWhenReady: true, hideMode: "self" },
    });

    await runtime.sync();

    expect(element.style.visibility).toBe("hidden");
    expect(child.style.visibility).toBe("visible");

    measurement = createLayoutMeasurement(0, 3_600, 200, 120);
    await runtime.sync();

    expect(element.style.visibility).toBe("");
    expect(child.style.visibility).toBe("visible");

    runtime.dispose();
  });

  test("skips far disposed target measurement only after stable small scroll deltas", async () => {
    const element = document.createElement("section");
    let scrollY = 0;
    stubWindowNumberProperty("scrollY", () => scrollY);
    const measureElement = vi.fn(() =>
      createLayoutMeasurement(0, 3_600, 200, 120),
    );
    const runtime = await createPipelineRuntime({ measureElement });

    runtime.registerTarget(element, { key: "hero.measure-skip" });

    await runtime.sync();
    scrollY = 24;
    await runtime.sync();
    expect(measureElement).toHaveBeenCalledTimes(2);
    scrollY = 48;
    await runtime.sync();
    expect(measureElement).toHaveBeenCalledTimes(3);
    scrollY = 72;
    await runtime.sync();

    expect(measureElement).toHaveBeenCalledTimes(3);
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero.measure-skip",
      lifecycleState: "disposed",
      visible: false,
    });

    runtime.dispose();
  });

  test("remeasures a skipped far target after a large scroll jump", async () => {
    const element = document.createElement("section");
    let scrollY = 0;
    stubWindowNumberProperty("scrollY", () => scrollY);
    const measureElement = vi.fn(() =>
      createLayoutMeasurement(0, 3_600, 200, 120),
    );
    const runtime = await createPipelineRuntime({ measureElement });

    runtime.registerTarget(element, { key: "hero.measure-jump" });

    await runtime.sync();
    scrollY = 24;
    await runtime.sync();
    scrollY = 48;
    await runtime.sync();
    scrollY = 72;
    await runtime.sync();
    expect(measureElement).toHaveBeenCalledTimes(3);

    scrollY = 1_200;
    await runtime.sync();

    expect(measureElement).toHaveBeenCalledTimes(4);

    runtime.dispose();
  });

  test("remeasures a skipped far target after viewport resize", async () => {
    const element = document.createElement("section");
    let scrollY = 0;
    let viewport = { width: 800, height: 600 };
    stubWindowNumberProperty("scrollY", () => scrollY);
    const measureElement = vi.fn(() =>
      createLayoutMeasurement(0, 3_600, 200, 120),
    );
    const runtime = await createPipelineRuntime({
      rendererHostFactory(container) {
        const host = createRendererHostStub(container);

        return {
          ...host,
          getViewportSize() {
            return viewport;
          },
        };
      },
      measureElement,
    });

    runtime.registerTarget(element, { key: "hero.measure-resize" });

    await runtime.sync();
    scrollY = 24;
    await runtime.sync();
    scrollY = 48;
    await runtime.sync();
    scrollY = 72;
    await runtime.sync();
    expect(measureElement).toHaveBeenCalledTimes(3);

    viewport = { width: 800, height: 720 };
    await runtime.sync();

    expect(measureElement).toHaveBeenCalledTimes(4);

    runtime.dispose();
  });

  test("remeasures a skipped far target when the target is dirty", async () => {
    const element = document.createElement("section");
    let scrollY = 0;
    let dirty = false;
    let measurement = createLayoutMeasurement(0, 3_600, 200, 120);
    const createdRenderables: Renderable[] = [];
    stubWindowNumberProperty("scrollY", () => scrollY);
    const measureElement = vi.fn(() => measurement);
    const runtime = await createPipelineRuntime({
      measureElement,
      invalidationController: {
        observeTarget: vi.fn(),
        unobserveTarget: vi.fn(),
        consumeDirtyKeys() {
          return dirty ? new Set(["hero.measure-dirty"]) : new Set();
        },
        dispose: vi.fn(),
      },
      onRenderableCreated(renderable) {
        createdRenderables.push(renderable);
      },
    });

    runtime.registerTarget(element, { key: "hero.measure-dirty" });

    await runtime.sync();
    scrollY = 24;
    await runtime.sync();
    scrollY = 48;
    await runtime.sync();
    scrollY = 72;
    await runtime.sync();
    expect(measureElement).toHaveBeenCalledTimes(3);

    dirty = true;
    measurement = createLayoutMeasurement(0, 0, 200, 120);
    await runtime.sync();

    expect(measureElement).toHaveBeenCalledTimes(4);
    expect(createdRenderables).toHaveLength(1);
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero.measure-dirty",
      lifecycleState: "active",
      visible: true,
    });

    runtime.dispose();
  });

  test("uses runtime scroll velocity rather than window scrollY for large adapter jumps", async () => {
    const element = document.createElement("section");
    let scrollVelocity = 0;
    stubWindowNumberProperty("scrollY", () => 0);
    const measureElement = vi.fn(() =>
      createLayoutMeasurement(0, 3_600, 200, 120),
    );
    const runtime = await createPipelineRuntime({
      measureElement,
      scrollState: createMutableScrollStateController(() => scrollVelocity),
    });

    runtime.registerTarget(element, { key: "hero.measure-adapter-jump" });

    await runtime.sync();
    scrollVelocity = 24;
    await runtime.sync();
    await runtime.sync();
    await runtime.sync();
    expect(measureElement).toHaveBeenCalledTimes(3);

    scrollVelocity = 1_200;
    await runtime.sync();

    expect(measureElement).toHaveBeenCalledTimes(4);

    runtime.dispose();
  });

  test("periodically revalidates skipped far targets to catch position-only layout shifts", async () => {
    const element = document.createElement("section");
    let scrollY = 0;
    let measurement = createLayoutMeasurement(0, 3_600, 200, 120);
    const createdRenderables: Renderable[] = [];
    stubWindowNumberProperty("scrollY", () => scrollY);
    const measureElement = vi.fn(() => measurement);
    const runtime = await createPipelineRuntime({
      measureElement,
      onRenderableCreated(renderable) {
        createdRenderables.push(renderable);
      },
    });

    runtime.registerTarget(element, { key: "hero.measure-shift" });

    await runtime.sync();
    scrollY = 24;
    await runtime.sync();
    scrollY = 48;
    await runtime.sync();
    scrollY = 72;
    await runtime.sync();
    expect(measureElement).toHaveBeenCalledTimes(3);

    measurement = createLayoutMeasurement(0, 0, 200, 120);
    scrollY = 96;
    await runtime.sync();
    scrollY = 120;
    await runtime.sync();
    scrollY = 144;
    await runtime.sync();

    expect(measureElement).toHaveBeenCalledTimes(4);
    expect(createdRenderables).toHaveLength(1);
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero.measure-shift",
      lifecycleState: "active",
      visible: true,
    });

    runtime.dispose();
  });

  test("parks near-offscreen renderables without restoring DOM fallback", async () => {
    const element = document.createElement("section");
    let measurement = createLayoutMeasurement(0, 0, 200, 120);
    const setVisible = vi.fn();
    const update = vi.fn();
    const runtime = await createPipelineRuntime({
      measureElement: () => measurement,
      onRenderableCreated(renderable) {
        let visible = true;
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
            visible,
          }),
        });
        const originalSetVisible = renderable.setVisible.bind(renderable);
        const originalUpdate = renderable.update.bind(renderable);

        renderable.setVisible = (nextVisible) => {
          visible = nextVisible;
          setVisible(nextVisible);
          originalSetVisible(nextVisible);
        };
        renderable.update = (frameInput) => {
          update(frameInput);
          return originalUpdate(frameInput);
        };
      },
    });

    runtime.registerTarget(element, {
      key: "hero.park",
      lifecycle: {
        hideWhenReady: true,
        hideMode: "subtree",
        offscreen: { strategy: "park", warmTtlMs: 2_000 },
      },
    });

    await runtime.sync();
    expect(element.style.visibility).toBe("hidden");
    expect(update).toHaveBeenCalledTimes(1);

    measurement = createLayoutMeasurement(0, 1_800, 200, 120);
    await runtime.sync();

    expect(setVisible).toHaveBeenLastCalledWith(false);
    expect(update).toHaveBeenCalledTimes(1);
    expect(element.style.visibility).toBe("hidden");
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero.park",
      lifecycleState: "paused",
      visible: false,
    });

    runtime.dispose();
  });

  test("restores DOM fallback and disposes parked renderables after warm TTL", async () => {
    const element = document.createElement("section");
    let now = 0;
    let measurement = createLayoutMeasurement(0, 0, 200, 120);
    const dispose = vi.fn();
    const runtime = await createPipelineRuntime({
      clock: () => now,
      measureElement: () => measurement,
      onRenderableCreated(renderable) {
        let visible = true;
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
            visible,
          }),
        });
        const originalDispose = renderable.dispose.bind(renderable);
        const originalSetVisible = renderable.setVisible.bind(renderable);

        renderable.dispose = () => {
          dispose();
          originalDispose();
        };
        renderable.setVisible = (nextVisible) => {
          visible = nextVisible;
          originalSetVisible(nextVisible);
        };
      },
    });

    runtime.registerTarget(element, {
      key: "hero.park-ttl",
      lifecycle: {
        hideWhenReady: true,
        hideMode: "subtree",
        offscreen: { strategy: "park", warmTtlMs: 100 },
      },
    });

    await runtime.sync();
    expect(element.style.visibility).toBe("hidden");

    measurement = createLayoutMeasurement(0, 1_800, 200, 120);
    now = 50;
    await runtime.sync();

    expect(dispose).not.toHaveBeenCalled();
    expect(element.style.visibility).toBe("hidden");

    now = 200;
    await runtime.sync();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(element.style.visibility).toBe("");
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero.park-ttl",
      lifecycleState: "disposed",
      visible: false,
    });

    runtime.dispose();
  });

  test("resumes parked renderables once without forcing visibility on later active syncs", async () => {
    const element = document.createElement("section");
    let measurement = createLayoutMeasurement(0, 0, 200, 120);
    const setVisible = vi.fn();
    const runtime = await createPipelineRuntime({
      measureElement: () => measurement,
      onRenderableCreated(renderable) {
        let visible = true;
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
            visible,
          }),
        });
        const originalSetVisible = renderable.setVisible.bind(renderable);

        renderable.setVisible = (nextVisible) => {
          visible = nextVisible;
          setVisible(nextVisible);
          originalSetVisible(nextVisible);
        };
      },
    });

    runtime.registerTarget(element, {
      key: "hero.resume",
      lifecycle: {
        offscreen: { strategy: "park", warmTtlMs: 2_000 },
      },
    });

    await runtime.sync();
    expect(setVisible).not.toHaveBeenCalled();

    measurement = createLayoutMeasurement(0, 1_800, 200, 120);
    await runtime.sync();
    expect(setVisible.mock.calls).toEqual([[false]]);

    measurement = createLayoutMeasurement(0, 0, 200, 120);
    await runtime.sync();
    expect(setVisible.mock.calls).toEqual([[false], [true]]);

    await runtime.sync();
    expect(setVisible.mock.calls).toEqual([[false], [true]]);

    runtime.dispose();
  });

  test("resume preserves effect-owned hidden visibility that was applied through ctx.object", async () => {
    const element = document.createElement("section");
    let measurement = createLayoutMeasurement(0, 0, 200, 120);
    const renderableSetVisible = vi.fn();
    const effectTargetSetVisible = vi.fn();
    const effectUpdate = vi.fn();
    let effectTargetVisible = true;
    let createdRenderable: Renderable | undefined;
    const runtime = await createPipelineRuntime({
      effects: [
        defineWebGLEffect({
          kind: "custom.hideTarget",
          source: "dom/element",
          update(ctx) {
            effectUpdate();
            ctx.object.visible = false;
          },
        }),
      ],
      measureElement: () => measurement,
      onRenderableCreated(renderable) {
        createdRenderable = renderable;
        let sceneVisible = true;
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
            visible: sceneVisible,
          }),
        });
        const originalSetVisible = renderable.setVisible.bind(renderable);

        renderable.setVisible = (nextVisible) => {
          sceneVisible = nextVisible;
          renderableSetVisible(nextVisible);
          originalSetVisible(nextVisible);
        };
      },
    });

    runtime.registerTarget(element, {
      key: "hero.resume-hidden",
      lifecycle: {
        offscreen: { strategy: "park", warmTtlMs: 2_000 },
      },
      effects: [{ kind: "custom.hideTarget" }],
    });

    await runtime.sync();
    const originalTarget = createdRenderable?.effectTarget;
    expect(originalTarget).toBeDefined();

    Object.defineProperty(createdRenderable as Renderable, "effectTarget", {
      configurable: true,
      get: () =>
        originalTarget
          ? {
              ...originalTarget,
              setVisible(nextVisible: boolean) {
                effectTargetVisible = nextVisible;
                effectTargetSetVisible(nextVisible);
                originalTarget.setVisible(nextVisible);
              },
            }
          : undefined,
    });

    await runtime.sync();
    expect(effectUpdate).toHaveBeenCalledTimes(2);
    expect(effectTargetSetVisible.mock.calls).toEqual([[false]]);
    expect(effectTargetVisible).toBe(false);
    expect(renderableSetVisible).not.toHaveBeenCalled();

    measurement = createLayoutMeasurement(0, 1_800, 200, 120);
    await runtime.sync();

    measurement = createLayoutMeasurement(0, 0, 200, 120);
    await runtime.sync();

    expect(renderableSetVisible.mock.calls).toEqual([[false], [false]]);
    expect(effectTargetSetVisible.mock.calls).toEqual([[false], [false]]);
    expect(effectTargetSetVisible).not.toHaveBeenCalledWith(true);
    expect(effectTargetVisible).toBe(false);

    runtime.dispose();
  });

  test("far-offscreen dispose does not let stale effect visibility leak into same-key rebuild resume", async () => {
    const element = document.createElement("section");
    let measurement = createLayoutMeasurement(0, 0, 200, 120);
    const renderableSetVisible: Array<ReturnType<typeof vi.fn>> = [];
    const effectUpdate = vi.fn();
    const effectDispose = vi.fn();
    let syncCount = 0;
    const runtime = await createPipelineRuntime({
      effects: [
        defineWebGLEffect({
          kind: "custom.disposeVisibilityLeak",
          source: "dom/element",
          update(ctx) {
            effectUpdate();
            void ctx;
          },
          dispose(ctx) {
            effectDispose();
            ctx.object.visible = false;
          },
        }),
      ],
      measureElement: () => measurement,
      invalidationController: {
        observeTarget: vi.fn(),
        unobserveTarget: vi.fn(),
        consumeDirtyKeys() {
          syncCount += 1;
          return syncCount === 3
            ? new Set(["hero.dispose-visibility-stale"])
            : new Set();
        },
        dispose: vi.fn(),
      },
      onRenderableCreated(renderable) {
        const setVisible = vi.fn();
        renderableSetVisible.push(setVisible);
        let visible = true;
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
            visible,
          }),
        });
        const originalSetVisible = renderable.setVisible.bind(renderable);

        renderable.setVisible = (nextVisible) => {
          visible = nextVisible;
          setVisible(nextVisible);
          originalSetVisible(nextVisible);
        };
      },
    });

    runtime.registerTarget(element, {
      key: "hero.dispose-visibility-stale",
      lifecycle: {
        offscreen: { strategy: "park", warmTtlMs: 2_000 },
      },
      effects: [{ kind: "custom.disposeVisibilityLeak" }],
    });

    await runtime.sync();
    expect(effectUpdate).toHaveBeenCalledTimes(1);
    expect(renderableSetVisible).toHaveLength(1);

    measurement = createLayoutMeasurement(0, 3_600, 200, 120);
    await runtime.sync();

    expect(effectDispose).toHaveBeenCalledTimes(1);
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero.dispose-visibility-stale",
      lifecycleState: "disposed",
      visible: false,
    });

    measurement = createLayoutMeasurement(0, 0, 200, 120);
    await runtime.sync();

    expect(effectUpdate).toHaveBeenCalledTimes(2);
    expect(renderableSetVisible).toHaveLength(2);
    expect(renderableSetVisible[1]).not.toHaveBeenCalled();

    measurement = createLayoutMeasurement(0, 1_800, 200, 120);
    await runtime.sync();
    expect(renderableSetVisible[1].mock.calls).toEqual([[false]]);

    measurement = createLayoutMeasurement(0, 0, 200, 120);
    await runtime.sync();

    expect(renderableSetVisible[1].mock.calls).toEqual([[false], [true]]);

    runtime.dispose();
  });

  test("old async completions do not replay post-update side effects after park and resume", async () => {
    const effectUpdate = vi.fn();
    const element = document.createElement("section");
    let measurement = createLayoutMeasurement(0, 0, 200, 120);
    let resolveUpdate: (() => void) | undefined;
    const updateLayout = vi.fn();
    const runtime = await createPipelineRuntime({
      effects: [
        defineWebGLEffect({
          kind: "custom.asyncProbe",
          source: "dom/element",
          update: effectUpdate,
        }),
      ],
      measureElement: () => measurement,
      onRenderableCreated(renderable) {
        let visible = true;
        let updateCallCount = 0;
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
            visible,
          }),
        });
        const originalSetVisible = renderable.setVisible.bind(renderable);
        const originalUpdate = renderable.update.bind(renderable);
        const originalUpdateLayout = renderable.updateLayout?.bind(renderable);

        renderable.setVisible = (nextVisible) => {
          visible = nextVisible;
          originalSetVisible(nextVisible);
        };
        renderable.update = (input) => {
          updateCallCount += 1;
          if (updateCallCount === 1) {
            return new Promise<void>((resolve) => {
              resolveUpdate = resolve;
            }).then(() => originalUpdate(input));
          }
          return originalUpdate(input);
        };
        renderable.updateLayout = (snapshot) => {
          updateLayout(snapshot);
          originalUpdateLayout?.(snapshot);
        };
      },
    });

    runtime.registerTarget(element, {
      key: "hero.async-park",
      lifecycle: {
        offscreen: { strategy: "park", warmTtlMs: 2_000 },
      },
      effects: [{ kind: "custom.asyncProbe" }],
    });

    const firstSync = runtime.sync();

    measurement = createLayoutMeasurement(0, 1_800, 200, 120);
    await runtime.sync();

    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero.async-park",
      lifecycleState: "paused",
      visible: false,
    });
    expect(updateLayout).not.toHaveBeenCalled();
    expect(effectUpdate).not.toHaveBeenCalled();

    measurement = createLayoutMeasurement(0, 0, 200, 120);
    await runtime.sync();

    expect(updateLayout).toHaveBeenCalledTimes(1);
    expect(effectUpdate).toHaveBeenCalledTimes(1);

    resolveUpdate?.();
    await firstSync;

    expect(updateLayout).toHaveBeenCalledTimes(1);
    expect(effectUpdate).toHaveBeenCalledTimes(1);
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero.async-park",
      lifecycleState: "active",
      visible: true,
    });

    runtime.dispose();
  });

  test("stale async reject after park and resume does not fail the old sync or restore fallback", async () => {
    const element = document.createElement("section");
    let measurement = createLayoutMeasurement(0, 0, 200, 120);
    let rejectOldUpdate: ((error: unknown) => void) | undefined;
    const runtime = await createPipelineRuntime({
      measureElement: () => measurement,
      onRenderableCreated(renderable) {
        let visible = true;
        let updateCallCount = 0;
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
            visible,
          }),
        });
        const originalSetVisible = renderable.setVisible.bind(renderable);
        const originalUpdate = renderable.update.bind(renderable);

        renderable.setVisible = (nextVisible) => {
          visible = nextVisible;
          originalSetVisible(nextVisible);
        };
        renderable.update = (input) => {
          updateCallCount += 1;
          if (updateCallCount === 1) {
            return new Promise<void>((_resolve, reject) => {
              rejectOldUpdate = reject;
            }).then(() => originalUpdate(input));
          }
          return originalUpdate(input);
        };
      },
    });

    runtime.registerTarget(element, {
      key: "hero.async-stale-reject",
      lifecycle: {
        hideWhenReady: true,
        hideMode: "subtree",
        offscreen: { strategy: "park", warmTtlMs: 2_000 },
      },
    });

    const firstSync = runtime.sync();

    measurement = createLayoutMeasurement(0, 1_800, 200, 120);
    await runtime.sync();

    measurement = createLayoutMeasurement(0, 0, 200, 120);
    await runtime.sync();

    expect(element.style.visibility).toBe("hidden");
    rejectOldUpdate?.(new Error("stale async reject"));
    await expect(firstSync).resolves.toBeUndefined();
    expect(element.style.visibility).toBe("hidden");
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero.async-stale-reject",
      resourceStatus: "ready",
      lifecycleState: "active",
      visible: true,
    });
    expect(runtime.getDebugState().targets[0]?.error).toBeUndefined();

    runtime.dispose();
  });

  test("stale async reject after parked TTL eviction does not fail the old sync or change disposed state", async () => {
    const element = document.createElement("section");
    let now = 0;
    let measurement = createLayoutMeasurement(0, 0, 200, 120);
    let rejectOldUpdate: ((error: unknown) => void) | undefined;
    const dispose = vi.fn();
    const runtime = await createPipelineRuntime({
      clock: () => now,
      measureElement: () => measurement,
      onRenderableCreated(renderable) {
        let visible = true;
        let updateCallCount = 0;
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
            visible,
          }),
        });
        const originalDispose = renderable.dispose.bind(renderable);
        const originalSetVisible = renderable.setVisible.bind(renderable);
        const originalUpdate = renderable.update.bind(renderable);

        renderable.dispose = () => {
          dispose();
          originalDispose();
        };
        renderable.setVisible = (nextVisible) => {
          visible = nextVisible;
          originalSetVisible(nextVisible);
        };
        renderable.update = (input) => {
          updateCallCount += 1;
          if (updateCallCount === 1) {
            return new Promise<void>((_resolve, reject) => {
              rejectOldUpdate = reject;
            }).then(() => originalUpdate(input));
          }
          return originalUpdate(input);
        };
      },
    });

    runtime.registerTarget(element, {
      key: "hero.async-stale-reject-ttl",
      lifecycle: {
        hideWhenReady: true,
        hideMode: "subtree",
        offscreen: { strategy: "park", warmTtlMs: 100 },
      },
    });

    const firstSync = runtime.sync();

    measurement = createLayoutMeasurement(0, 1_800, 200, 120);
    now = 50;
    await runtime.sync();

    now = 200;
    await runtime.sync();

    const debugStateBeforeReject = runtime.getDebugState().targets[0];
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(element.style.visibility).toBe("");
    expect(debugStateBeforeReject).toMatchObject({
      key: "hero.async-stale-reject-ttl",
      lifecycleState: "disposed",
      visible: false,
    });

    rejectOldUpdate?.(new Error("stale async reject after ttl"));
    await expect(firstSync).resolves.toBeUndefined();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(element.style.visibility).toBe("");
    expect(runtime.getDebugState().targets[0]).toMatchObject(debugStateBeforeReject!);
    expect(runtime.getDebugState().targets[0]?.error).toBeUndefined();

    runtime.dispose();
  });

  test("active async reject still marks the target as error and restores fallback", async () => {
    const element = document.createElement("section");
    let rejectUpdate: ((error: unknown) => void) | undefined;
    const runtime = await createPipelineRuntime({
      onRenderableCreated(renderable) {
        Object.defineProperty(renderable, "sceneObjectController", {
          configurable: true,
          get: () => ({
            attached: true,
            visible: true,
          }),
        });
        const originalUpdate = renderable.update.bind(renderable);

        renderable.update = (input) =>
          new Promise<void>((_resolve, reject) => {
            rejectUpdate = reject;
          }).then(() => originalUpdate(input));
      },
    });

    runtime.registerTarget(element, {
      key: "hero.async-reject",
      lifecycle: { hideWhenReady: true, hideMode: "subtree" },
    });

    const syncResult = runtime.sync();

    expect(element.style.visibility).toBe("");
    rejectUpdate?.(new Error("active async reject"));
    await expect(syncResult).rejects.toThrow("active async reject");
    expect(element.style.visibility).toBe("");
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "hero.async-reject",
      resourceStatus: "error",
      lifecycleState: "error",
    });

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

  test("debug state exposes target-local pointer only for pointer-declared targets", async () => {
    const runtime = await createPipelineRuntime();
    const pointerTarget = document.createElement("section");
    const staticTarget = document.createElement("section");

    runtime.registerTarget(pointerTarget, {
      key: "pointer.debug",
      pointer: { hover: true },
    });
    runtime.registerTarget(staticTarget, {
      key: "static.debug",
    });

    document.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 40,
        clientY: 30,
      }),
    );
    await runtime.sync();

    const state = runtime.getDebugState();
    expect(
      state.targets.find((target) => target.key === "pointer.debug"),
    ).toEqual(
      expect.objectContaining({
        pointer: expect.objectContaining({
          isInside: expect.any(Boolean),
          localX: expect.any(Number),
          localY: expect.any(Number),
        }),
      }),
    );
    expect(
      state.targets.find((target) => target.key === "static.debug"),
    ).not.toHaveProperty("pointer");

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

  test("static scene renders the first loop frame then idles on demand", async () => {
    const loopHost = createLoopRecordingHost();
    const measureElement = vi.fn(readZeroMeasurement);
    const runtime = await createPipelineRuntime({
      rendererHostFactory: loopHost.createHost,
      measureElement,
    });
    const element = document.createElement("section");

    runtime.registerTarget(element, { key: "static.hero" });

    loopHost.tick(16);
    loopHost.tick(32);

    expect(measureElement).toHaveBeenCalledTimes(1);
    expect(loopHost.sceneAdapter.render).toHaveBeenCalledTimes(1);

    runtime.dispose();
  });

  test("texture invalidation requests one additional on-demand frame for a static target", async () => {
    const loopHost = createLoopRecordingHost();
    const createdRenderables: Renderable[] = [];
    const runtime = await createPipelineRuntime({
      rendererHostFactory: loopHost.createHost,
      onRenderableCreated(renderable) {
        createdRenderables.push(renderable);
      },
    });
    const element = document.createElement("section");

    runtime.registerTarget(element, { key: "static.texture" });

    loopHost.tick(16);
    expect(loopHost.sceneAdapter.render).toHaveBeenCalledTimes(1);

    const source = createdRenderables[0]?.effectSource;
    if (source?.kind !== "dom" || source.type !== "element" || !source.surface) {
      throw new Error("Expected static DOM element surface source.");
    }

    source.surface.invalidate();
    loopHost.tick(32);
    loopHost.tick(48);

    expect(loopHost.sceneAdapter.render).toHaveBeenCalledTimes(2);

    runtime.dispose();
  });

  test("resource-ready dirty request renders one additional on-demand frame", async () => {
    const loopHost = createLoopRecordingHost();
    let resolveDecode: (() => void) | undefined;
    const image = document.createElement("img");
    image.src = "/poster.png";
    Object.defineProperty(image, "decode", {
      configurable: true,
      value: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveDecode = resolve;
          }),
      ),
    });
    const runtime = await createPipelineRuntime({
      rendererHostFactory: loopHost.createHost,
    });

    runtime.registerTarget(image, {
      key: "poster.image",
      source: { kind: "media", type: "image", src: "/poster.png" },
    });

    loopHost.tick(16);
    loopHost.tick(32);
    expect(loopHost.sceneAdapter.render).toHaveBeenCalledTimes(1);

    resolveDecode?.();
    await flushAsyncWork();

    loopHost.tick(48);
    loopHost.tick(64);

    expect(loopHost.sceneAdapter.render).toHaveBeenCalledTimes(2);

    runtime.dispose();
  });

  test("active postprocess controller state alone does not force the loop continuous", async () => {
    const loopHost = createLoopRecordingHost();
    const postprocessController = createStubPostprocessController({
      activeRequestCount: 1,
    });
    const runtime = await createPipelineRuntime({
      rendererHostFactory: loopHost.createHost,
      postprocessController,
    });

    runtime.registerTarget(document.createElement("section"), {
      key: "static.postprocess",
    });

    loopHost.tick(16);
    loopHost.tick(32);

    expect(loopHost.sceneAdapter.render).toHaveBeenCalledTimes(1);
    expect(postprocessController.render).toHaveBeenCalledTimes(1);

    runtime.dispose();
  });

  test("renderable continuous hook keeps the loop continuous", async () => {
    const loopHost = createLoopRecordingHost();
    const runtime = await createPipelineRuntime({
      rendererHostFactory: loopHost.createHost,
      onRenderableCreated(renderable) {
        renderable.shouldRenderContinuously = () => true;
      },
    });

    runtime.registerTarget(document.createElement("section"), {
      key: "animated.model",
    });

    loopHost.tick(16);
    loopHost.tick(32);

    expect(loopHost.sceneAdapter.render).toHaveBeenCalledTimes(2);

    runtime.dispose();
  });

  test("static and reactive effects do not keep the loop continuous without dirty work", async () => {
    const staticLoopHost = createLoopRecordingHost();
    let staticUpdates = 0;
    const staticEffect = defineWebGLEffect<{ kind: "test.staticOnce" }>({
      kind: "test.staticOnce",
      schedule: "static",
      update() {
        staticUpdates += 1;
      },
    });
    const staticRuntime = await createPipelineRuntime({
      rendererHostFactory: staticLoopHost.createHost,
      effects: [staticEffect],
    });
    staticRuntime.registerTarget(document.createElement("section"), {
      key: "effect.static",
      effects: [{ kind: "test.staticOnce" }],
    });

    staticLoopHost.tick(16);
    staticLoopHost.tick(32);

    expect(staticLoopHost.sceneAdapter.render).toHaveBeenCalledTimes(1);
    expect(staticUpdates).toBe(1);
    staticRuntime.dispose();

    const reactiveLoopHost = createLoopRecordingHost();
    let reactiveUpdates = 0;
    const reactiveEffect = defineWebGLEffect<{ kind: "test.reactiveOnly" }>({
      kind: "test.reactiveOnly",
      schedule: "reactive",
      update() {
        reactiveUpdates += 1;
      },
    });
    const reactiveRuntime = await createPipelineRuntime({
      rendererHostFactory: reactiveLoopHost.createHost,
      effects: [reactiveEffect],
    });
    reactiveRuntime.registerTarget(document.createElement("section"), {
      key: "effect.reactive",
      effects: [{ kind: "test.reactiveOnly" }],
    });

    reactiveLoopHost.tick(16);
    reactiveLoopHost.tick(32);

    expect(reactiveLoopHost.sceneAdapter.render).toHaveBeenCalledTimes(1);
    expect(reactiveUpdates).toBe(1);
    reactiveRuntime.dispose();
  });

  test("active effects gates and videos keep the loop continuous", async () => {
    const effectLoopHost = createLoopRecordingHost();
    let effectUpdates = 0;
    const continuousEffect = defineWebGLEffect<{ kind: "test.continuous" }>({
      kind: "test.continuous",
      update() {
        effectUpdates += 1;
      },
    });
    const effectRuntime = await createPipelineRuntime({
      rendererHostFactory: effectLoopHost.createHost,
      effects: [continuousEffect],
    });
    effectRuntime.registerTarget(document.createElement("section"), {
      key: "effect.hero",
      effects: [{ kind: "test.continuous" }],
    });

    effectLoopHost.tick(16);
    effectLoopHost.tick(32);

    expect(effectLoopHost.sceneAdapter.render).toHaveBeenCalledTimes(2);
    expect(effectUpdates).toBe(2);
    effectRuntime.dispose();

    const gateLoopHost = createLoopRecordingHost();
    const scrollController = createGateAwareScrollController();
    const gateRuntime = await createPipelineRuntime({
      rendererHostFactory: gateLoopHost.createHost,
      scrollState: scrollController,
    });
    gateRuntime.registerTarget(document.createElement("section"), {
      key: "gate.hero",
      scroll: { type: "gate", start: "top top", duration: 1 },
    });
    scrollController.enterGate("gate.hero", 0.5);

    gateLoopHost.tick(16);
    gateLoopHost.tick(32);

    expect(gateLoopHost.sceneAdapter.render).toHaveBeenCalledTimes(2);
    gateRuntime.dispose();

    const videoLoopHost = createLoopRecordingHost();
    const video = document.createElement("video");
    video.src = "/clip.mp4";
    Object.defineProperty(video, "pause", {
      configurable: true,
      value: vi.fn(),
    });
    const videoRuntime = await createPipelineRuntime({
      rendererHostFactory: videoLoopHost.createHost,
      loadVideo: async () => video,
    });
    videoRuntime.registerTarget(video, {
      key: "video.hero",
      source: { kind: "media", type: "video", src: "/clip.mp4" },
    });

    videoLoopHost.tick(16);
    await Promise.resolve();
    await Promise.resolve();
    videoLoopHost.tick(32);
    videoLoopHost.tick(48);

    expect(videoLoopHost.sceneAdapter.render).toHaveBeenCalledTimes(3);
    videoRuntime.dispose();

  });

  test("pointer declarations wake on-demand targets without forcing continuous rendering", async () => {
    const pointerLoopHost = createLoopRecordingHost();
    const runtime = await createPipelineRuntime({
      rendererHostFactory: pointerLoopHost.createHost,
      effects: [
        defineWebGLEffect({
          kind: "test.pointerReactive",
          schedule: "reactive",
          update(ctx) {
            ctx.object.rotation.set(0, ctx.targetPointer.normalizedX, 0);
          },
        }),
      ],
    });
    const target = document.createElement("section");
    runtime.registerTarget(target, {
      key: "pointer.hero",
      pointer: { hover: true },
      effects: [{ kind: "test.pointerReactive" }],
    });

    pointerLoopHost.tick(16);
    pointerLoopHost.tick(32);

    expect(pointerLoopHost.sceneAdapter.render).toHaveBeenCalledTimes(1);

    document.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientX: 120,
        clientY: 80,
      }),
    );
    pointerLoopHost.tick(48);

    expect(pointerLoopHost.sceneAdapter.render).toHaveBeenCalledTimes(2);
    runtime.dispose();
  });

  test("progress signal notifications wake on-demand image sequence targets", async () => {
    let progress = 0;
    let notifyProgress = () => {};
    let unsubscribed = false;
    const progressSignals = {
      get() {
        return progress;
      },
      subscribe(listener: () => void) {
        notifyProgress = listener;

        return () => {
          unsubscribed = true;
          notifyProgress = () => {};
        };
      },
    };
    const loopHost = createLoopRecordingHost();
    const runtime = await createPipelineRuntime({
      rendererHostFactory: loopHost.createHost,
      progressSignals,
    });

    runtime.registerTarget(document.createElement("section"), {
      key: "sequence.hero",
      source: {
        kind: "media",
        type: "image-sequence",
        frameCount: 2,
        frames: [document.createElement("canvas"), document.createElement("canvas")],
        progressKey: "sequence.progress",
      },
    });

    loopHost.tick(16);
    loopHost.tick(32);

    expect(loopHost.sceneAdapter.render).toHaveBeenCalledTimes(1);

    progress = 1;
    notifyProgress();
    loopHost.tick(48);

    expect(loopHost.sceneAdapter.render).toHaveBeenCalledTimes(2);

    runtime.dispose();
    expect(unsubscribed).toBe(true);
  });

  test("progress signal notifications refresh runtime timeline state", async () => {
    let progress = 0;
    let notifyProgress = () => {};
    const progressSignals = {
      get() {
        return progress;
      },
      subscribe(listener: () => void) {
        notifyProgress = listener;
        return () => {};
      },
    };
    const loopHost = createLoopRecordingHost();
    const { registry, updateTimelineState } = createRenderLayerRegistryStub(
      loopHost.sceneAdapter,
    );
    const runtime = await createPipelineRuntime({
      rendererHostFactory: loopHost.createHost,
      renderLayerRegistryFactory() {
        return registry;
      },
      progressSignals,
    });

    loopHost.tick(16);

    expect(updateTimelineState).toHaveBeenCalledWith(progressSignals);

    updateTimelineState.mockClear();
    progress = 1;
    notifyProgress();
    loopHost.tick(32);

    expect(updateTimelineState).toHaveBeenCalledWith(progressSignals);
    runtime.dispose();
  });

  test("renders through the generated render layer pass list", async () => {
    const sceneAdapter = createRecordingSceneAdapter();
    const { registry, renderPasses } =
      createRenderLayerRegistryStub(sceneAdapter);
    const runtime = await createPipelineRuntime({
      rendererHostFactory(container) {
        return createRendererHostStub(container, sceneAdapter);
      },
      renderLayerRegistryFactory() {
        return registry;
      },
    });

    runtime.sync();

    expect(renderPasses).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.render).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.render).toHaveBeenCalledWith(
      registry.getCamera("__dom-webgl-default__").camera,
    );
    runtime.dispose();
  });

  test("routes targets with sceneId to the managed scene adapter", async () => {
    const mainAdapter = createObjectRecordingSceneAdapter();
    const worldAdapter = createObjectRecordingSceneAdapter();
    const { registry } = createRenderLayerRegistryStub(mainAdapter, {
      scenes: {
        world: worldAdapter,
      },
    });
    const runtime = await createPipelineRuntime({
      rendererHostFactory(container) {
        return createRendererHostStub(container, mainAdapter);
      },
      renderLayerRegistryFactory() {
        return registry;
      },
    });
    const mainElement = document.createElement("section");
    const worldElement = document.createElement("section");

    runtime.registerTarget(mainElement, {
      key: "main.target",
      source: { kind: "dom", type: "element" },
    });
    runtime.registerTarget(worldElement, {
      key: "world.target",
      sceneId: "world",
      source: { kind: "dom", type: "element" },
    });

    await runtime.sync();

    expect(mainAdapter.objects.map((object) => object.key)).toEqual(["main.target"]);
    expect(worldAdapter.objects.map((object) => object.key)).toEqual([
      "world.target",
    ]);
    runtime.dispose();
  });

  test("targets without scene declarations still render through generated main", async () => {
    const sceneAdapter = createObjectRecordingSceneAdapter();
    const runtime = await createPipelineRuntime({
      rendererHostFactory(container) {
        return createRendererHostStub(container, sceneAdapter);
      },
    });
    const element = document.createElement("section");

    runtime.registerTarget(element, {
      key: "level1.surface",
      source: { kind: "dom", type: "element" },
    });

    await runtime.sync();

    expect(sceneAdapter.objects.map((object) => object.key)).toEqual([
      "level1.surface",
    ]);
    runtime.dispose();
  });

  test("vanilla target sceneId uses the same routing as React inheritance", async () => {
    const mainAdapter = createObjectRecordingSceneAdapter();
    const overlayAdapter = createObjectRecordingSceneAdapter();
    const { registry } = createRenderLayerRegistryStub(mainAdapter, {
      scenes: { overlay: overlayAdapter },
    });
    const runtime = await createPipelineRuntime({
      rendererHostFactory(container) {
        return createRendererHostStub(container, mainAdapter);
      },
      renderLayerRegistryFactory() {
        return registry;
      },
    });

    runtime.registerTarget(document.createElement("section"), {
      key: "overlay.title",
      sceneId: "overlay",
      source: { kind: "dom", type: "text" },
    });

    await runtime.sync();

    expect(overlayAdapter.objects.map((object) => object.key)).toEqual([
      "overlay.title",
    ]);
    runtime.dispose();
  });

  test("debug state includes managed scene ids for routed targets", async () => {
    const mainAdapter = createObjectRecordingSceneAdapter();
    const worldAdapter = createObjectRecordingSceneAdapter();
    const { registry } = createRenderLayerRegistryStub(mainAdapter, {
      scenes: { world: worldAdapter },
    });
    const runtime = await createPipelineRuntime({
      rendererHostFactory(container) {
        return createRendererHostStub(container, mainAdapter);
      },
      renderLayerRegistryFactory() {
        return registry;
      },
    });

    runtime.registerTarget(document.createElement("section"), {
      key: "world.target",
      sceneId: "world",
      source: { kind: "dom", type: "element" },
    });

    await runtime.sync();

    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "world.target",
      sceneId: "world",
    });
    runtime.dispose();
  });

  test("unregistering a managed scene releases live targets routed to that scene", async () => {
    const mainAdapter = createObjectRecordingSceneAdapter();
    const worldAdapter = createObjectRecordingSceneAdapter();
    const { registry, unregisterScene } = createRenderLayerRegistryStub(
      mainAdapter,
      { scenes: { world: worldAdapter } },
    );
    const runtime = await createPipelineRuntime({
      rendererHostFactory(container) {
        return createRendererHostStub(container, mainAdapter);
      },
      renderLayerRegistryFactory() {
        return registry;
      },
      measureElement: () => createLayoutMeasurement(0, 0, 120, 80),
    });

    runtime.registerTarget(document.createElement("section"), {
      key: "world.card",
      sceneId: "world",
      source: { kind: "dom", type: "element" },
    });

    await runtime.sync();

    expect(runtime.getDebugState().targetCount).toBe(1);
    expect(worldAdapter.objects.map((object) => object.key)).toEqual([
      "world.card",
    ]);

    runtime.unregisterScene("world");

    expect(unregisterScene).toHaveBeenCalledWith("world");
    expect(runtime.getDebugState().targetCount).toBe(0);
    expect(worldAdapter.objects).toHaveLength(0);

    await runtime.sync();

    expect(runtime.getDebugState().targetCount).toBe(0);
    runtime.dispose();
  });

  test("runtime registers managed scene camera and pass declarations", async () => {
    const sceneAdapter = createRecordingSceneAdapter();
    const { registry, registerScene, registerCamera, registerRenderPass } =
      createRenderLayerRegistryStub(sceneAdapter);
    const runtime = await createPipelineRuntime({
      rendererHostFactory(container) {
        return createRendererHostStub(container, sceneAdapter);
      },
      renderLayerRegistryFactory() {
        return registry;
      },
    });

    runtime.registerScene({ id: "world", defaultPass: true });
    runtime.registerCamera({ id: "world.camera", sceneId: "world", default: true });
    runtime.registerRenderPass({
      id: "world.pass",
      sceneId: "world",
      cameraId: "world.camera",
    });
    runtime.unregisterRenderPass("world.pass");
    runtime.unregisterCamera("world.camera");
    runtime.unregisterScene("world");

    expect(registerScene).toHaveBeenCalledWith({ id: "world", defaultPass: true });
    expect(registerCamera).toHaveBeenCalledWith({
      id: "world.camera",
      sceneId: "world",
      default: true,
    });
    expect(registerRenderPass).toHaveBeenCalledWith({
      id: "world.pass",
      sceneId: "world",
      cameraId: "world.camera",
    });
    runtime.dispose();
  });

  test("runtime registers stage primitives and lights into managed scenes", async () => {
    const mainAdapter = createObjectRecordingSceneAdapter();
    const worldAdapter = createObjectRecordingSceneAdapter();
    const { registry } = createRenderLayerRegistryStub(mainAdapter, {
      scenes: { world: worldAdapter },
    });
    const runtime = await createPipelineRuntime({
      renderLayerRegistryFactory() {
        return registry;
      },
    });

    runtime.registerStagePrimitive({
      id: "floor",
      sceneId: "world",
      kind: "plane",
      material: { kind: "standard", color: "#05070a" },
    });
    runtime.registerLight({
      id: "hero",
      sceneId: "world",
      kind: "point",
      intensity: 1.8,
      position: [0, 0, 160],
    });

    expect(worldAdapter.objects.map((object) => object.key)).toEqual([
      "floor",
      "hero",
    ]);
    expect(runtime.getDebugState().targetCount).toBe(0);
    expect(runtime.getDebugState()).toMatchObject({
      stagePrimitiveCount: 1,
      lightCount: 1,
      stagePrimitives: [{ id: "floor", sceneId: "world", kind: "plane" }],
      lights: [{ id: "hero", sceneId: "world", kind: "point" }],
    });

    runtime.unregisterStagePrimitive("floor");
    runtime.unregisterLight("hero");

    expect(worldAdapter.objects).toHaveLength(0);
    expect(runtime.getDebugState().stagePrimitiveCount).toBeUndefined();
    expect(runtime.getDebugState().lightCount).toBeUndefined();
    expect(runtime.getDebugState().stagePrimitives).toBeUndefined();
    expect(runtime.getDebugState().lights).toBeUndefined();
    runtime.dispose();
  });

  test("runtime updates timeline-bound stage object visibility from progress signals", async () => {
    let progress = 0;
    const mainAdapter = createObjectRecordingSceneAdapter();
    const worldAdapter = createObjectRecordingSceneAdapter();
    const { registry } = createRenderLayerRegistryStub(mainAdapter, {
      scenes: { world: worldAdapter },
    });
    const runtime = await createPipelineRuntime({
      renderLayerRegistryFactory() {
        return registry;
      },
      progressSignals: {
        get() {
          return progress;
        },
      },
    });

    runtime.registerStagePrimitive({
      id: "floor",
      sceneId: "world",
      kind: "plane",
      timeline: { id: "hero.3d", active: { from: 0.25, to: 0.75 } },
    });

    expect(worldAdapter.objects[0]?.object3D).toMatchObject({ visible: true });

    await runtime.sync();

    expect(worldAdapter.objects[0]?.object3D).toMatchObject({ visible: false });
    expect(runtime.getDebugState().stagePrimitives?.[0]).toMatchObject({
      id: "floor",
      timeline: {
        id: "hero.3d",
        progressKey: "hero.3d",
        active: false,
      },
    });

    progress = 0.5;
    await runtime.sync();

    expect(worldAdapter.objects[0]?.object3D).toMatchObject({ visible: true });
    expect(runtime.getDebugState().stagePrimitives?.[0]).toMatchObject({
      timeline: {
        active: true,
      },
    });
    runtime.dispose();
  });

  test("runtime updates timeline-bound target visibility from progress signals", async () => {
    let progress = 0;
    const sceneAdapter = createObjectRecordingSceneAdapter();
    const runtime = await createPipelineRuntime({
      renderLayerRegistryFactory() {
        return createRenderLayerRegistryStub(sceneAdapter).registry;
      },
      progressSignals: {
        get() {
          return progress;
        },
      },
    });

    const target = document.createElement("section");

    runtime.registerTarget(target, {
      key: "target.timeline",
      source: { kind: "dom", type: "element" },
      timeline: { id: "hero.3d", active: { from: 0.25, to: 0.75 } },
    });

    await runtime.sync();

    expect(sceneAdapter.objects[0]?.object3D).toMatchObject({ visible: false });

    progress = 0.5;
    await runtime.sync();

    expect(sceneAdapter.objects[0]?.object3D).toMatchObject({ visible: true });
    runtime.dispose();
  });

  test("unregistering a managed scene releases stage primitives and lights first", async () => {
    const mainAdapter = createObjectRecordingSceneAdapter();
    const worldAdapter = createObjectRecordingSceneAdapter();
    const { registry, unregisterScene } = createRenderLayerRegistryStub(
      mainAdapter,
      { scenes: { world: worldAdapter } },
    );
    const runtime = await createPipelineRuntime({
      renderLayerRegistryFactory() {
        return registry;
      },
    });

    runtime.registerStagePrimitive({
      id: "floor",
      sceneId: "world",
      kind: "plane",
    });
    runtime.registerLight({
      id: "hero",
      sceneId: "world",
      kind: "ambient",
    });

    expect(worldAdapter.objects.map((object) => object.key)).toEqual([
      "floor",
      "hero",
    ]);

    runtime.unregisterScene("world");

    expect(unregisterScene).toHaveBeenCalledWith("world");
    expect(worldAdapter.objects).toHaveLength(0);
    runtime.dispose();
  });

  test("projects screen anchored targets through the selected scene projection", async () => {
    const overlayAdapter = createObjectRecordingSceneAdapter();
    const { registry } = createRenderLayerRegistryStub(
      createObjectRecordingSceneAdapter(),
      {
        scenes: { overlay: overlayAdapter },
        sceneProjection: { overlay: "screen" },
        cameras: {
          "overlay.camera": {
            sceneId: "overlay",
            type: "orthographic",
            mode: "screen",
          },
        },
      },
    );
    const runtime = await createPipelineRuntime({
      renderLayerRegistryFactory() {
        return registry;
      },
      measureElement: () => createLayoutMeasurement(0, 0, 10, 10),
    });

    runtime.registerTarget(document.createElement("section"), {
      key: "overlay.badge",
      sceneId: "overlay",
      source: { kind: "dom", type: "element" },
      placement: {
        mode: "screen-anchored",
        anchor: "top-right",
        offset: [-32, 32],
        size: [180, 48],
      },
    });

    await runtime.sync();

    expect(readSceneObjectLastLayout(overlayAdapter, "overlay.badge")).toEqual({
      x: 768,
      y: 568,
      z: 0,
      width: 180,
      height: 48,
    });
    expect(runtime.getDebugState().targets[0]).toMatchObject({
      key: "overlay.badge",
      sceneId: "overlay",
      projection: "screen",
      placementMode: "screen-anchored",
    });

    runtime.dispose();
  });

  test("keeps Level 1 dom anchored layout unchanged", async () => {
    const sceneAdapter = createObjectRecordingSceneAdapter();
    const runtime = await createPipelineRuntime({
      rendererHostFactory(container) {
        return createRendererHostStub(container, sceneAdapter);
      },
      measureElement: () => createLayoutMeasurement(100, 120, 220, 140),
    });

    runtime.registerTarget(document.createElement("section"), {
      key: "level1.surface",
      source: { kind: "dom", type: "element" },
    });

    await runtime.sync();

    expect(readSceneObjectLastLayout(sceneAdapter, "level1.surface")).toEqual({
      x: 210,
      y: 410,
      width: 220,
      height: 140,
    });

    runtime.dispose();
  });

  test("clears depth before passes that request clearDepth", async () => {
    const clearDepth = vi.fn();
    const sceneAdapter = createRecordingSceneAdapter();
    const { registry } = createRenderLayerRegistryStub(sceneAdapter, {
      passes: [
        {
          id: "main",
          generated: true,
          sceneId: "__dom-webgl-default__",
          cameraId: "__dom-webgl-default__",
          order: 0,
          clear: false,
          clearDepth: false,
        },
        {
          id: "overlay.pass",
          generated: false,
          sceneId: "__dom-webgl-default__",
          cameraId: "__dom-webgl-default__",
          order: 1,
          clear: false,
          clearDepth: true,
        },
      ],
    });
    const runtime = await createPipelineRuntime({
      rendererHostFactory(container) {
        const host = createRendererHostStub(container, sceneAdapter);

        return {
          ...host,
          renderer: {
            ...host.renderer,
            clearDepth,
          },
        };
      },
      renderLayerRegistryFactory() {
        return registry;
      },
    });

    runtime.sync();

    expect(clearDepth).toHaveBeenCalledTimes(1);
    runtime.dispose();
  });

  test("clears the canvas once before rendering ordered passes", async () => {
    const operations: string[] = [];
    const clear = vi.fn(() => {
      operations.push("clear");
    });
    const sceneAdapter = {
      ...createRecordingSceneAdapter(),
      render: vi.fn(() => {
        operations.push("render");
      }),
    } satisfies WebGLSceneAdapter;
    const { registry } = createRenderLayerRegistryStub(sceneAdapter, {
      passes: [
        {
          id: "stage.pass",
          generated: false,
          sceneId: "__dom-webgl-default__",
          cameraId: "__dom-webgl-default__",
          order: -10,
          clear: false,
          clearDepth: false,
        },
        {
          id: "main",
          generated: true,
          sceneId: "__dom-webgl-default__",
          cameraId: "__dom-webgl-default__",
          order: 0,
          clear: false,
          clearDepth: false,
        },
      ],
    });
    const runtime = await createPipelineRuntime({
      rendererHostFactory(container) {
        const host = createRendererHostStub(container, sceneAdapter);

        return {
          ...host,
          renderer: {
            ...host.renderer,
            clear,
          },
        };
      },
      renderLayerRegistryFactory() {
        return registry;
      },
    });

    runtime.sync();

    expect(clear).toHaveBeenCalledTimes(1);
    expect(sceneAdapter.render).toHaveBeenCalledTimes(2);
    expect(operations).toEqual(["clear", "render", "render"]);
    runtime.dispose();
  });
});

async function createPipelineRuntime(
  options: Omit<RuntimePipelineOptions, "container"> = {},
): Promise<RuntimeWithPipelineSurface> {
  const { createWebGLRuntime } = await import("../../../src/lib/renderer/runtime");
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
    readRendererStats() {
      return {
        drawCalls: 0,
        triangles: 0,
        geometries: 0,
        textures: 0,
      };
    },
    resizeIfNeeded() {
      return;
    },
    dispose() {
      canvas.remove();
    },
  };
}

function createLoopRecordingHost(
  sceneAdapter: ReturnType<typeof createRecordingSceneAdapter> =
    createRecordingSceneAdapter(),
): {
  sceneAdapter: ReturnType<typeof createRecordingSceneAdapter>;
  setAnimationLoop: ReturnType<typeof vi.fn>;
  createHost(container: HTMLElement): ThreeRendererHost;
  tick(time: number): void;
} {
  let loopCallback: ((time: number) => void) | null = null;
  const setAnimationLoop = vi.fn(
    (callback: ((time: number) => void) | null) => {
      loopCallback = callback;
    },
  );

  return {
    sceneAdapter,
    setAnimationLoop,
    createHost(container) {
      const host = createRendererHostStub(container, sceneAdapter);

      return {
        ...host,
        renderer: {
          ...host.renderer,
          setAnimationLoop,
        },
      };
    },
    tick(time) {
      if (!loopCallback) {
        throw new Error("Renderer loop has not been started.");
      }

      loopCallback(time);
    },
  };
}

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
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

function createRenderLayerRegistryStub(
  sceneAdapter: WebGLSceneAdapter,
  options: {
    scenes?: Record<string, WebGLSceneAdapter>;
    sceneProjection?: Record<string, InternalRenderSceneEntry["projection"]>;
    cameras?: Record<
      string,
      Pick<InternalRenderCameraEntry, "sceneId" | "type" | "mode"> &
        Partial<InternalRenderCameraEntry>
    >;
    passes?: readonly InternalRenderPassEntry[];
  } = {},
): {
  registry: InternalRenderLayerRegistry;
  renderPasses: ReturnType<typeof vi.fn>;
  registerScene: ReturnType<typeof vi.fn>;
  unregisterScene: ReturnType<typeof vi.fn>;
  registerCamera: ReturnType<typeof vi.fn>;
  unregisterCamera: ReturnType<typeof vi.fn>;
  registerRenderPass: ReturnType<typeof vi.fn>;
  unregisterRenderPass: ReturnType<typeof vi.fn>;
  updateTimelineState: ReturnType<typeof vi.fn>;
} {
  const mainScene = {
    id: "__dom-webgl-default__",
    generated: true,
    projection: "dom-aligned",
    scene: {},
    camera: {},
    sceneAdapter,
  } satisfies InternalRenderSceneEntry;
  const mainCamera = {
    id: "__dom-webgl-default__",
    generated: true,
    sceneId: "__dom-webgl-default__",
    type: "orthographic",
    mode: "dom-aligned",
    default: true,
    camera: {},
  } satisfies InternalRenderCameraEntry;
  const mainPass = {
    id: "__dom-webgl-default__",
    generated: true,
    sceneId: "__dom-webgl-default__",
    cameraId: "__dom-webgl-default__",
    order: 0,
    clear: false,
    clearDepth: false,
  } satisfies InternalRenderPassEntry;
  const camerasById = new Map<string, InternalRenderCameraEntry>([
    [mainCamera.id, mainCamera],
    ...Object.entries(options.cameras ?? {}).map(
      ([id, camera]): [string, InternalRenderCameraEntry] => [
        id,
        {
          id,
          generated: camera.generated ?? false,
          sceneId: camera.sceneId,
          type: camera.type,
          mode: camera.mode,
          default: camera.default ?? true,
          camera: camera.camera ?? {},
        },
      ],
    ),
  ]);
  const sceneAdapters = new Map<string, WebGLSceneAdapter>([
    ["__dom-webgl-default__", sceneAdapter],
    ...Object.entries(options.scenes ?? {}),
  ]);
  const passes = options.passes ?? [mainPass];
  const registerScene = vi.fn();
  const registerCamera = vi.fn();
  const registerRenderPass = vi.fn();
  const unregisterScene = vi.fn();
  const unregisterCamera = vi.fn();
  const unregisterRenderPass = vi.fn();
  const updateTimelineState = vi.fn();
  const renderPasses = vi.fn(
    (renderPass: Parameters<InternalRenderLayerRegistry["renderPasses"]>[0]) => {
      for (const pass of passes) {
        renderPass(pass, mainScene, mainCamera);
      }
    },
  );

  return {
    registry: {
      getScene(id) {
        if (id === "__dom-webgl-default__") {
          return mainScene;
        }

        const defaultCamera = Array.from(camerasById.values()).find(
          (camera) => camera.sceneId === id && camera.default,
        );

        return {
          id,
          generated: false,
          projection: options.sceneProjection?.[id] ?? "dom-aligned",
          scene: {},
          camera: {},
          sceneAdapter: sceneAdapters.get(id) ?? sceneAdapter,
          ...(defaultCamera ? { defaultCameraId: defaultCamera.id } : {}),
        };
      },
      getCamera(id) {
        return camerasById.get(id) ?? mainCamera;
      },
      getPasses() {
        return passes;
      },
      getMainSceneAdapter() {
        return mainScene.sceneAdapter;
      },
      getSceneAdapterForTarget(sceneId) {
        return (
          sceneAdapters.get(sceneId ?? "__dom-webgl-default__") ?? sceneAdapter
        );
      },
      registerScene,
      unregisterScene,
      registerCamera,
      unregisterCamera,
      registerRenderPass,
      unregisterRenderPass,
      updateTimelineState,
      resize: vi.fn(),
      renderPasses,
      dispose: vi.fn(),
    },
    renderPasses,
    registerScene,
    unregisterScene,
    registerCamera,
    unregisterCamera,
    registerRenderPass,
    unregisterRenderPass,
    updateTimelineState,
  };
}

function createObjectRecordingSceneAdapter(): WebGLSceneAdapter & {
  objects: WebGLSceneObject[];
  render: ReturnType<typeof vi.fn>;
} {
  const objects: WebGLSceneObject[] = [];

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

function createTransformGroupRecordingSceneAdapter(): WebGLSceneAdapter & {
  objects: WebGLSceneObject[];
  groupsByKey: Map<string, WebGLSceneGroup>;
  objectParentsByKey: Map<string, string | undefined>;
  groupParentsByKey: Map<string, string | undefined>;
  removedGroupKeys: string[];
  render: ReturnType<typeof vi.fn>;
} {
  const objects: WebGLSceneObject[] = [];
  const groupsByKey = new Map<string, WebGLSceneGroup>();
  const objectParentsByKey = new Map<string, string | undefined>();
  const groupParentsByKey = new Map<string, string | undefined>();
  const removedGroupKeys: string[] = [];

  return {
    objects,
    groupsByKey,
    objectParentsByKey,
    groupParentsByKey,
    removedGroupKeys,
    addObject(object) {
      if (!objects.includes(object)) {
        objects.push(object);
      }
      objectParentsByKey.set(object.key, undefined);
    },
    removeObject(object) {
      const index = objects.indexOf(object);

      if (index !== -1) {
        objects.splice(index, 1);
      }
      objectParentsByKey.delete(object.key);
    },
    createGroup(key) {
      return {
        key,
        object3D: createTransformGroupObject3D(),
      };
    },
    addGroup(group, parent) {
      groupsByKey.set(group.key, group);
      groupParentsByKey.set(group.key, parent?.key);
    },
    removeGroup(group) {
      groupsByKey.delete(group.key);
      groupParentsByKey.delete(group.key);
      removedGroupKeys.push(group.key);
    },
    setObjectParent(object, parent) {
      objectParentsByKey.set(object.key, parent?.key);
    },
    setGroupParent(group, parent) {
      groupParentsByKey.set(group.key, parent?.key);
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

function createMappedMeasureElement(
  measurementsByTestKey: ReadonlyMap<string, ElementMeasurement>,
): (element: HTMLElement) => ElementMeasurement {
  return (element) => {
    const testKey = element.dataset.testKey;
    const measurement = testKey
      ? measurementsByTestKey.get(testKey)
      : undefined;

    if (!measurement) {
      throw new Error(`Missing test measurement for ${testKey ?? "element"}.`);
    }

    return measurement;
  };
}

function stubWindowNumberProperty(
  key: "innerHeight" | "scrollY",
  readValue: () => number,
): void {
  Object.defineProperty(window, key, {
    configurable: true,
    get: readValue,
  });
}

function readSceneObject(
  sceneAdapter: { objects: WebGLSceneObject[] },
  key: string,
): WebGLSceneObject {
  const object = sceneAdapter.objects.find((entry) => entry.key === key);

  if (!object) {
    throw new Error(`Missing scene object ${key}`);
  }

  return object;
}

function readSceneObjectLastLayout(
  sceneAdapter: { objects: WebGLSceneObject[] },
  key: string,
): unknown {
  const object = readSceneObject(sceneAdapter, key);

  if ("lastLayout" in object) {
    return object.lastLayout;
  }

  return undefined;
}

type TransformGroupObject3D = {
  position: { x: number; y: number; z: number; set(x: number, y: number, z: number): void };
  rotation: { x: number; y: number; z: number; set(x: number, y: number, z: number): void };
  scale: { x: number; y: number; z: number; set(x: number, y: number, z: number): void };
  visible: boolean;
  children: Array<{
    material: { opacity: number; transparent: boolean; needsUpdate: boolean };
  }>;
};

function createTransformGroupObject3D(): TransformGroupObject3D {
  return {
    position: createVector3(),
    rotation: createVector3(),
    scale: createVector3(1, 1, 1),
    visible: true,
    children: [
      {
        material: { opacity: 1, transparent: false, needsUpdate: false },
      },
    ],
  };
}

function createVector3(x = 0, y = 0, z = 0): TransformGroupObject3D["position"] {
  return {
    x,
    y,
    z,
    set(nextX, nextY, nextZ) {
      this.x = nextX;
      this.y = nextY;
      this.z = nextZ;
    },
  };
}

function readTransformGroupObject3D(
  sceneAdapter: ReturnType<typeof createTransformGroupRecordingSceneAdapter>,
  key: string,
): TransformGroupObject3D {
  const object3D = sceneAdapter.groupsByKey.get(key)?.object3D;

  if (!object3D) {
    throw new Error(`Missing transform group ${key}.`);
  }

  return object3D as TransformGroupObject3D;
}

function readObject3DRenderOrder(object3D: unknown): number | undefined {
  if (!object3D || typeof object3D !== "object") {
    return undefined;
  }

  return (object3D as { renderOrder?: number }).renderOrder;
}

function createModelObject3DStub() {
  return {
    scene: new Group(),
  };
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

function createFrames(count: number): readonly HTMLImageElement[] {
  return Array.from({ length: count }, (_entry, index) => {
    const image = document.createElement("img");
    image.src = `/frames/frame_${String(index + 1).padStart(4, "0")}.webp`;
    return image;
  });
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

function createMutableScrollStateController(
  readVelocity: () => number,
): ScrollStateController {
  return {
    getState() {
      return {
        mode: "page",
        pageProgress: 0,
        direction: 0,
        velocity: 0,
      };
    },
    update() {
      const velocity = readVelocity();

      return {
        mode: "page",
        pageProgress: 0,
        direction: velocity > 0 ? 1 : velocity < 0 ? -1 : 0,
        velocity,
      };
    },
  };
}

function createStubPostprocessController(
  overrides: Partial<PostprocessController> & {
    activeRequestCount?: number;
  } = {},
): PostprocessController {
  return {
    activeRequestCount: overrides.activeRequestCount ?? 0,
    inspect:
      overrides.inspect ??
      vi.fn(() => ({
        activeRequests: overrides.activeRequestCount ?? 0,
        passCount: 0,
        maxRenderTargetSize: 0,
      })),
    inspectRequests: vi.fn(() => []),
    requestPostprocess:
      overrides.requestPostprocess ??
      vi.fn(() => ({
        update: vi.fn(),
        dispose: vi.fn(),
      })),
    render:
      overrides.render ??
      vi.fn((renderBase: () => void) => {
        renderBase();
      }),
    dispose: overrides.dispose ?? vi.fn(),
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
