import { describe, expect, test } from "vitest";

import type {
  WebGLDOMSourceDescriptor,
  WebGLMediaImageSequenceSourceDescriptor,
  WebGLMediaImageSourceDescriptor,
  WebGLMediaVideoSourceDescriptor,
  WebGLModelSourceDescriptor,
} from "../source/sourceDescriptor";
import { createResourceManager } from "./resourceManager";

describe("createResourceManager", () => {
  test("creates idle resource records keyed by descriptor", () => {
    const manager = createResourceManager();
    const snapshot = createSnapshotDescriptor("hero.surface");

    const handle = manager.acquire(snapshot);

    expect(handle.record).toMatchObject({
      key: "dom:element:hero.surface",
      kind: "dom",
      status: "idle",
      refCount: 1,
    });
    expect(manager.inspect("dom:element:hero.surface")).toBe(handle.record);
  });

  test("shares records by normalized resource key and reference counts handles", () => {
    const manager = createResourceManager();
    const first = manager.acquire(createModelDescriptor("/models/hero.glb"));
    const second = manager.acquire(createModelDescriptor("/models/./hero.glb"));

    expect(second.record).toBe(first.record);
    expect(first.record.refCount).toBe(2);

    first.dispose();
    expect(second.record.refCount).toBe(1);

    first.dispose();
    expect(second.record.refCount).toBe(1);

    second.dispose();
    expect(manager.inspect("model:glb:/models/hero.glb")).toBeUndefined();
  });

  test("keeps query and hash variants in separate resource records", () => {
    const manager = createResourceManager();

    const first = manager.acquire(
      createModelDescriptor("/models/hero.glb?tenant=a"),
    );
    const second = manager.acquire(
      createModelDescriptor("/models/hero.glb?tenant=b"),
    );
    const third = manager.acquire(
      createModelDescriptor("/models/hero.glb#preview"),
    );

    expect(second.record).not.toBe(first.record);
    expect(third.record).not.toBe(first.record);
    expect(third.record).not.toBe(second.record);
    expect(manager.inspect("model:glb:/models/hero.glb?tenant=a")).toBe(
      first.record,
    );
    expect(manager.inspect("model:glb:/models/hero.glb?tenant=b")).toBe(
      second.record,
    );
    expect(manager.inspect("model:glb:/models/hero.glb#preview")).toBe(third.record);
  });

  test("preserves absolute URL origins in resource cache keys", () => {
    const manager = createResourceManager();

    const first = manager.acquire(
      createModelDescriptor("https://a.example.com/models/hero.glb"),
    );
    const second = manager.acquire(
      createModelDescriptor("https://b.example.com/models/hero.glb"),
    );

    expect(first.record.key).toBe(
      "model:glb:https://a.example.com/models/hero.glb",
    );
    expect(second.record.key).toBe(
      "model:glb:https://b.example.com/models/hero.glb",
    );
    expect(first.record.key).not.toBe(second.record.key);
    expect(first.record).not.toBe(second.record);
  });

  test("keeps anonymous snapshot elements in separate resource records", () => {
    const manager = createResourceManager();
    const first = manager.acquire(createAnonymousSnapshotDescriptor());
    const second = manager.acquire(createAnonymousSnapshotDescriptor());

    expect(second.record).not.toBe(first.record);
    expect(first.record.key).not.toBe(second.record.key);
  });

  test("does not share image resource records across distinct DOM image elements", () => {
    const manager = createResourceManager();
    const firstDescriptor = createImageDescriptor("/assets/hero.png");
    const secondDescriptor = createImageDescriptor("/assets/hero.png");

    const first = manager.acquire(firstDescriptor);
    const second = manager.acquire(secondDescriptor);

    expect(second.record).not.toBe(first.record);
    expect(first.record.element).toBe(firstDescriptor.element);
    expect(second.record.element).toBe(secondDescriptor.element);
  });

  test("does not share video resource records across distinct DOM video elements", () => {
    const manager = createResourceManager();
    const firstDescriptor = createVideoDescriptor("/assets/hero.mp4");
    const secondDescriptor = createVideoDescriptor("/assets/hero.mp4");

    const first = manager.acquire(firstDescriptor);
    const second = manager.acquire(secondDescriptor);

    expect(second.record).not.toBe(first.record);
    expect(first.record.element).toBe(firstDescriptor.element);
    expect(second.record.element).toBe(secondDescriptor.element);
  });

  test("keys image sequence resources by anchor and count", () => {
    const manager = createResourceManager();
    const anchor = document.createElement("section");
    const first = manager.acquire(createImageSequenceDescriptor(anchor, 10));
    const second = manager.acquire(createImageSequenceDescriptor(anchor, 20));

    expect(first.record.key).not.toBe(second.record.key);
    expect(first.record.kind).toBe("image-sequence");
    expect(second.record.kind).toBe("image-sequence");
  });

  test("loads records through loading to ready", async () => {
    const manager = createResourceManager();
    const handle = manager.acquire(createImageDescriptor("/assets/hero.png"));
    let resolveLoad!: (value: { width: number }) => void;

    const load = handle.load(
      () =>
        new Promise<{ width: number }>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    expect(handle.record.status).toBe("loading");

    resolveLoad({ width: 1200 });
    await expect(load).resolves.toEqual({ width: 1200 });
    expect(handle.record).toMatchObject({
      status: "ready",
      value: { width: 1200 },
    });
  });

  test("moves failed loads into error state", async () => {
    const manager = createResourceManager();
    const handle = manager.acquire(createImageDescriptor("/assets/missing.png"));
    const error = new Error("missing image");

    await expect(handle.load(async () => Promise.reject(error))).rejects.toThrow(
      "missing image",
    );
    expect(handle.record).toMatchObject({
      status: "error",
      error,
    });
  });

  test("limits concurrent resource loads", async () => {
    const manager = createResourceManager({ maxConcurrentResourceLoads: 2 });
    const first = manager.acquire<{ id: string }>(
      createModelDescriptor("/models/a.glb"),
    );
    const second = manager.acquire<{ id: string }>(
      createModelDescriptor("/models/b.glb"),
    );
    const third = manager.acquire<{ id: string }>(
      createModelDescriptor("/models/c.glb"),
    );
    const completions: Array<() => void> = [];
    let activeLoads = 0;
    let peakActiveLoads = 0;

    const firstLoad = first.load(createDeferredLoader("a"));
    const secondLoad = second.load(createDeferredLoader("b"));
    const thirdLoad = third.load(createDeferredLoader("c"));

    expect(activeLoads).toBe(2);
    expect(peakActiveLoads).toBe(2);
    expect(completions).toHaveLength(2);
    expect(third.record.status).toBe("loading");

    completions[0]?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(completions).toHaveLength(3);
    expect(activeLoads).toBe(2);
    expect(peakActiveLoads).toBe(2);

    completions[1]?.();
    completions[2]?.();

    await expect(Promise.all([firstLoad, secondLoad, thirdLoad])).resolves.toEqual(
      [{ id: "a" }, { id: "b" }, { id: "c" }],
    );
    expect(activeLoads).toBe(0);

    function createDeferredLoader(id: string): () => Promise<{ id: string }> {
      return () =>
        new Promise<{ id: string }>((resolve) => {
          activeLoads += 1;
          peakActiveLoads = Math.max(peakActiveLoads, activeLoads);
          completions.push(() => {
            activeLoads -= 1;
            resolve({ id });
          });
        });
    }
  });

  test("starts higher priority queued loads before lower priority loads", async () => {
    const manager = createResourceManager({ maxConcurrentResourceLoads: 1 });
    const first = manager.acquire<string>(createModelDescriptor("/first.glb"));
    const second = manager.acquire<string>(createModelDescriptor("/second.glb"));
    const order: string[] = [];
    let releaseFirst!: () => void;

    const firstLoad = first.load(
      () =>
        new Promise<string>((resolve) => {
          order.push("first");
          releaseFirst = () => resolve("first");
        }),
      { priority: 0 },
    );
    const secondLoad = second.load(async () => {
      order.push("second");
      return "second";
    }, { priority: 10 });

    expect(order).toEqual(["first"]);
    releaseFirst();
    await Promise.all([firstLoad, secondLoad]);
    expect(order).toEqual(["first", "second"]);
  });

  test("drains pending resource loads by priority while preserving FIFO ties", async () => {
    const manager = createResourceManager({ maxConcurrentResourceLoads: 1 });
    const first = manager.acquire<string>(createModelDescriptor("/first.glb"));
    const low = manager.acquire<string>(createModelDescriptor("/low.glb"));
    const high = manager.acquire<string>(createModelDescriptor("/high.glb"));
    const tied = manager.acquire<string>(createModelDescriptor("/tied.glb"));
    const order: string[] = [];
    let releaseFirst!: () => void;

    const firstLoad = first.load(
      () =>
        new Promise<string>((resolve) => {
          order.push("first");
          releaseFirst = () => resolve("first");
        }),
      { priority: 0 },
    );
    const lowLoad = low.load(async () => {
      order.push("low");
      return "low";
    }, { priority: 1 });
    const highLoad = high.load(async () => {
      order.push("high");
      return "high";
    }, { priority: 10 });
    const tiedLoad = tied.load(async () => {
      order.push("tied");
      return "tied";
    }, { priority: 1 });

    expect(order).toEqual(["first"]);
    releaseFirst();
    await Promise.all([firstLoad, lowLoad, highLoad, tiedLoad]);
    expect(order).toEqual(["first", "high", "low", "tied"]);
  });

  test("uses manager priority context when load options omit priority", async () => {
    let priority = 0;
    const manager = createResourceManager({
      maxConcurrentResourceLoads: 1,
      readPriority: () => priority,
    });
    const first = manager.acquire<string>(createModelDescriptor("/first.glb"));
    const low = manager.acquire<string>(createModelDescriptor("/low.glb"));
    const high = manager.acquire<string>(createModelDescriptor("/high.glb"));
    const order: string[] = [];
    let releaseFirst!: () => void;

    priority = 0;
    const firstLoad = first.load(
      () =>
        new Promise<string>((resolve) => {
          order.push("first");
          releaseFirst = () => resolve("first");
        }),
    );
    priority = 10;
    const lowLoad = low.load(async () => {
      order.push("low");
      return "low";
    });
    priority = 100;
    const highLoad = high.load(async () => {
      order.push("high");
      return "high";
    });

    expect(order).toEqual(["first"]);
    releaseFirst();
    await Promise.all([firstLoad, lowLoad, highLoad]);
    expect(order).toEqual(["first", "high", "low"]);
  });

  test("adopts the existing image element for image resources", () => {
    const manager = createResourceManager();
    const descriptor = createImageDescriptor("/assets/hero.png");

    const handle = manager.acquire(descriptor);

    expect(handle.record).toMatchObject({
      kind: "image",
      element: descriptor.element,
    });
  });

  test("adopts the existing video element identity for video resources", () => {
    const manager = createResourceManager();
    const descriptor = createVideoDescriptor("/assets/hero.mp4");

    const handle = manager.acquire(descriptor);

    expect(handle.record).toMatchObject({
      kind: "video",
      element: descriptor.element,
    });
  });
});

function createSnapshotDescriptor(key: string): WebGLDOMSourceDescriptor {
  const element = document.createElement("section");
  element.setAttribute("data-webgl-key", key);

  return {
    kind: "dom",
    type: "element",
    element,
  };
}

function createAnonymousSnapshotDescriptor(): WebGLDOMSourceDescriptor {
  const element = document.createElement("section");

  return {
    kind: "dom",
    type: "element",
    element,
  };
}

function createImageDescriptor(src: string): WebGLMediaImageSourceDescriptor {
  const element = document.createElement("img");
  element.src = src;

  return {
    kind: "media",
    type: "image",
    anchor: element,
    element,
    src,
  };
}

function createModelDescriptor(src: string): WebGLModelSourceDescriptor {
  const anchor = document.createElement("div");

  return {
    kind: "model",
    type: "glb",
    anchor,
    src,
  };
}

function createVideoDescriptor(src: string): WebGLMediaVideoSourceDescriptor {
  const element = document.createElement("video");
  element.src = src;

  return {
    kind: "media",
    type: "video",
    anchor: element,
    element,
    src,
  };
}

function createImageSequenceDescriptor(
  anchor: HTMLElement,
  frameCount: number,
): WebGLMediaImageSequenceSourceDescriptor {
  return {
    kind: "media",
    type: "image-sequence",
    anchor,
    frameCount,
    frames: createFrames(frameCount),
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
