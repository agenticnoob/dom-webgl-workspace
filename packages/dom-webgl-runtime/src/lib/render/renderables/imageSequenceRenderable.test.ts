import { describe, expect, test, vi } from "vitest";

import { createTargetDescriptor } from "../../dom/targetDescriptor";
import type { WebGLSceneObjectController } from "../../renderer/sceneObject";
import type { WebGLImageSequenceSourceDescriptor } from "../../source/sourceDescriptor";
import { compileRenderPolicy } from "../renderPolicy";
import { createImageSequenceRenderable } from "./imageSequenceRenderable";
import type { SceneRenderableController } from "./sceneRenderableController";

describe("createImageSequenceRenderable", () => {
  test("selects a frame from keyed progress and updates the texture plane", async () => {
    const anchor = document.createElement("section");
    const updateTextureSource = vi.fn();
    const read = vi.fn(() =>
      Promise.resolve({
        close: vi.fn(),
        height: 900,
        image: document.createElement("img"),
        width: 1600,
      }),
    );
    const preloadAround = vi.fn(() => Promise.resolve());
    const renderable = createImageSequenceRenderable(
      {
        descriptor: createTargetDescriptor(
          anchor,
          {
            key: "sequence.hero",
            source: {
              kind: "image-sequence",
              frameCount: 10,
              frameSrc: "/frames/frame_{frame:0000}.webp",
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
        createFrameCache: () => ({
          preloadAround,
          read,
          dispose: vi.fn(),
        }),
        createSceneController: () => createSceneController({ updateTextureSource }),
      },
    );

    await renderable.update();

    expect(read).toHaveBeenCalledWith(6);
    expect(preloadAround).toHaveBeenCalledWith(6);
    expect(updateTextureSource).toHaveBeenCalledTimes(1);
    expect(renderable.status).toBe("ready");
    expect(renderable.effectSource).toMatchObject({
      kind: "image-sequence",
      element: anchor,
      frame: 6,
      src: "/frames/frame_0006.webp",
    });
  });
});

function createImageSequenceSource(
  anchor: HTMLElement,
): WebGLImageSequenceSourceDescriptor {
  return {
    kind: "image-sequence",
    anchor,
    frameCount: 10,
    frameSrc: "/frames/frame_{frame:0000}.webp",
    progressKey: "scrub",
    startFrame: 1,
    preloadBefore: 1,
    preloadAfter: 2,
    maxCachedFrames: 4,
  };
}

function createSceneController(options: {
  readonly updateTextureSource: (source: HTMLImageElement) => void;
}): SceneRenderableController {
  let attached = false;
  let disposed = false;
  let visible = true;
  const controller: WebGLSceneObjectController = {
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
    render() {
      return;
    },
    dispose() {
      disposed = true;
    },
  };

  return {
    object: {
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
    },
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
