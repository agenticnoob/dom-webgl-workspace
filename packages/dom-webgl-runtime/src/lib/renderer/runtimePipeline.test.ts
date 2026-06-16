import { afterEach, describe, expect, test, vi } from "vitest";

import type { PageScrollStateController } from "../input/pageScroll";
import type { PointerController } from "../input/pointerController";
import type { Renderable } from "../render/renderable";
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
  scrollState?: PageScrollStateController;
  pointerController?: PointerController;
  clock?: () => number;
};

type RuntimeWithPipelineSurface = WebGLRuntime & {
  unregisterTarget(key: string): void;
  sync(): void | Promise<void>;
};

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
});

async function createPipelineRuntime(
  options: Omit<RuntimePipelineOptions, "container" | "rendererHostFactory"> = {},
): Promise<RuntimeWithPipelineSurface> {
  const { createWebGLRuntime } = await import("./runtime");
  const container = document.createElement("div");

  return createWebGLRuntime({
    container,
    rendererHostFactory: createRendererHostStub,
    ...options,
  } as RuntimePipelineOptions) as RuntimeWithPipelineSurface;
}

function createRendererHostStub(container: HTMLElement): ThreeRendererHost {
  const canvas = container.ownerDocument.createElement("canvas");

  return {
    canvas,
    camera: {},
    renderer: {
      canvas,
      dispose() {
        // Tests cover runtime ownership without touching a real WebGL context.
      },
    },
    scene: {},
    dispose() {
      canvas.remove();
    },
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

function countRoles(renderables: Renderable[]): Partial<Record<string, number>> {
  return renderables.reduce<Partial<Record<string, number>>>(
    (counts, renderable) => {
      counts[renderable.role] = (counts[renderable.role] ?? 0) + 1;
      return counts;
    },
    {},
  );
}

function createScrollStateController(): PageScrollStateController {
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

function createPointerController(): PointerController {
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
      };
    },
    dispose: vi.fn(),
  };
}
