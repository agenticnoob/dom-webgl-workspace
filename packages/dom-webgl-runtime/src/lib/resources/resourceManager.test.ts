import { describe, expect, test } from "vitest";

import type { WebGLSourceDescriptor } from "../source/sourceDescriptor";
import { createResourceManager } from "./resourceManager";

describe("createResourceManager", () => {
  test("creates idle resource records keyed by descriptor", () => {
    const manager = createResourceManager();
    const snapshot = createSnapshotDescriptor("hero.surface");

    const handle = manager.acquire(snapshot);

    expect(handle.record).toMatchObject({
      key: "snapshot:element:hero.surface",
      kind: "snapshot",
      status: "idle",
      refCount: 1,
    });
    expect(manager.inspect("snapshot:element:hero.surface")).toBe(handle.record);
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

function createSnapshotDescriptor(key: string): WebGLSourceDescriptor {
  const element = document.createElement("section");
  element.setAttribute("data-webgl-key", key);

  return {
    kind: "snapshot",
    mode: "element",
    element,
  };
}

function createAnonymousSnapshotDescriptor(): WebGLSourceDescriptor {
  const element = document.createElement("section");

  return {
    kind: "snapshot",
    mode: "element",
    element,
  };
}

function createImageDescriptor(src: string): WebGLSourceDescriptor {
  const element = document.createElement("img");
  element.src = src;

  return {
    kind: "image",
    element,
    src,
  };
}

function createModelDescriptor(src: string): WebGLSourceDescriptor {
  const anchor = document.createElement("div");

  return {
    kind: "model",
    format: "glb",
    anchor,
    src,
  };
}

function createVideoDescriptor(src: string): WebGLSourceDescriptor {
  const element = document.createElement("video");
  element.src = src;

  return {
    kind: "video",
    element,
    src,
  };
}
