import { describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../../../../src/lib/dom/targetDescriptor";
import type {
  WebGLSceneObject,
  WebGLSceneObjectController,
} from "../../../../src/lib/renderer/sceneObject";
import type { WebGLMediaImageSequenceSourceDescriptor } from "../../../../src/lib/source/sourceDescriptor";
import { compileRenderPolicy } from "../../../../src/lib/render/renderPolicy";
import { createImageSequenceRenderable } from "../../../../src/lib/render/renderables/imageSequenceRenderable";
import type {
  SceneRenderableController,
  SceneRenderableObject,
} from "../../../../src/lib/render/renderables/sceneRenderableController";

describe("createImageSequenceRenderable", () => {
  test("selects a frame from keyed progress and updates the texture plane", async () => {
    const anchor = document.createElement("section");
    const frames = createFrames(10);
    const updateTextureSource = vi.fn();
    const renderable = createImageSequenceRenderable(
      {
        descriptor: createTargetDescriptor(
          anchor,
          {
            key: "sequence.hero",
            source: {
              kind: "media",
              type: "image-sequence",
              frameCount: 10,
              frames,
              progressKey: "scrub",
            },
          },
          0,
        ),
        source: createImageSequenceSource(anchor),
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      {
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(),
        progressSignals: { get: () => 0.5 },
        createSceneController: () => createSceneController({ updateTextureSource }),
      },
    );

    await renderable.update();
    await renderable.update();

    expect(updateTextureSource).toHaveBeenCalledWith(frames[5]);
    expect(updateTextureSource).toHaveBeenCalledTimes(1);
    expect(renderable.status).toBe("ready");
    const effectSource = renderable.effectSource;
    expect(effectSource).toMatchObject({
      kind: "media",
      type: "image-sequence",
      element: anchor,
      frame: 6,
    });
    if (effectSource?.kind !== "media" || effectSource.type !== "image-sequence") {
      throw new Error("Expected image-sequence effect source.");
    }
    expect(effectSource.src).toContain("/frames/frame_0006.webp");
  });

  test("switches scrubbed frames synchronously from consumer-owned resources", async () => {
    const anchor = document.createElement("section");
    const frames = createFrames(10);
    const updateTextureSource = vi.fn();
    let progress = 0;
    const renderable = createImageSequenceRenderable(
      {
        descriptor: createTargetDescriptor(
          anchor,
          {
            key: "sequence.hero",
            source: {
              kind: "media",
              type: "image-sequence",
              frameCount: 10,
              frames,
              progressKey: "scrub",
            },
          },
          0,
        ),
        source: createImageSequenceSource(anchor),
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      {
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(),
        progressSignals: { get: () => progress },
        createSceneController: () => createSceneController({ updateTextureSource }),
      },
    );

    await renderable.update();
    expect(updateTextureSource).toHaveBeenCalledWith(frames[0]);

    progress = 1;
    renderable.update();

    expect(updateTextureSource).toHaveBeenLastCalledWith(frames[9]);
    const effectSource = renderable.effectSource;
    expect(effectSource).toMatchObject({
      frame: 10,
    });
    if (effectSource?.kind !== "media" || effectSource.type !== "image-sequence") {
      throw new Error("Expected image-sequence effect source.");
    }
    expect(effectSource.src).toContain("/frames/frame_0010.webp");
  });

  test("does not dispose consumer-owned image sequence frames", async () => {
    const anchor = document.createElement("section");
    const frames = createFrames(10);
    const close = vi.fn();
    const imageBitmap = {
      close,
      height: 900,
      width: 1600,
    } satisfies ImageBitmap;
    const mixedFrames = [imageBitmap, ...frames.slice(1)];
    const updateTextureSource = vi.fn();
    const renderable = createImageSequenceRenderable(
      {
        descriptor: createTargetDescriptor(
          anchor,
          {
            key: "sequence.hero",
            source: {
              kind: "media",
              type: "image-sequence",
              frameCount: 10,
              frames: mixedFrames,
              progressKey: "scrub",
            },
          },
          0,
        ),
        source: createImageSequenceSource(anchor, mixedFrames),
        role: "media",
        policy: compileRenderPolicy("media"),
      },
      {
        sceneAdapter: createSceneAdapter(),
        measureElement: () => createMeasurement(),
        progressSignals: { get: () => 0 },
        createSceneController: () => createSceneController({ updateTextureSource }),
      },
    );

    await renderable.update();
    renderable.dispose();

    expect(updateTextureSource).toHaveBeenCalledWith(imageBitmap);
    expect(close).not.toHaveBeenCalled();
  });
});

function createImageSequenceSource(
  anchor: HTMLElement,
  frames: readonly (HTMLImageElement | ImageBitmap)[] = createFrames(10),
): WebGLMediaImageSequenceSourceDescriptor {
  return {
    kind: "media",
    type: "image-sequence",
    anchor,
    frameCount: frames.length,
    frames,
    progressKey: "scrub",
    startFrame: 1,
  };
}

function createFrames(count: number): readonly HTMLImageElement[] {
  return Array.from({ length: count }, (_entry, index) => {
    const image = document.createElement("img");
    image.src = `/frames/frame_${String(index + 1).padStart(4, "0")}.webp`;
    return image;
  });
}

function createSceneController(options: {
  readonly updateTextureSource: (source: HTMLImageElement) => void;
}): SceneRenderableController {
  let attached = false;
  let disposed = false;
  let visible = true;
  const object: SceneRenderableObject & {
    updateTextureSource(source: HTMLImageElement): void;
  } = {
    key: "sequence.hero",
    object3D: {},
    visible: true,
    disposed: false,
    setVisible() {
      return;
    },
    updateLayout() {
      return;
    },
    updateTextureSource: options.updateTextureSource,
    dispose() {
      return;
    },
  };
  const controller: WebGLSceneObjectController = {
    object,
    get attached() {
      return attached;
    },
    get disposed() {
      return disposed;
    },
    get visible() {
      return visible;
    },
    attach() {
      attached = true;
    },
    updateLayout() {
      return;
    },
    setVisible(nextVisible) {
      visible = nextVisible;
    },
    setOrdering() {
      return;
    },
    render() {
      return;
    },
    dispose() {
      disposed = true;
    },
  };

  return {
    object,
    controller,
    updateLayout() {
      return;
    },
    updateTextContent() {
      return;
    },
    attach() {
      controller.attach();
    },
  };
}

function createSceneAdapter() {
  return {
    addObject: vi.fn(),
    removeObject: vi.fn(),
    render: vi.fn(),
  };
}

function createMeasurement() {
  return {
    x: 0,
    y: 0,
    left: 32,
    top: 40,
    right: 432,
    bottom: 340,
    width: 400,
    height: 300,
  };
}
