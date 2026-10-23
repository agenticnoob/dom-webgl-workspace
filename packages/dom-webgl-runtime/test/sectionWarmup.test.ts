import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Texture,
  VideoTexture,
} from "three";
import { describe, expect, it } from "vitest";

import { createSectionWarmup } from "../src/lib/sectionWarmup";

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function loadedTexture() {
  const texture = new Texture({ width: 4, height: 4 });
  texture.needsUpdate = true;
  return texture;
}

function createRenderer() {
  const compiles: Array<ReturnType<typeof deferred>> = [];
  const uploads: Texture[] = [];
  return {
    compiles,
    uploads,
    compileAsync: () => {
      const next = deferred();
      compiles.push(next);
      return next.promise;
    },
    initTexture: (texture: Texture) => {
      uploads.push(texture);
    },
  };
}

const camera = new PerspectiveCamera();
const scene = new Scene();
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("section warmup", () => {
  it("compiles new materials once and reports ready after compilation", async () => {
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
    const renderer = createRenderer();
    const warmup = createSectionWarmup();

    expect(warmup.step(root, renderer, camera, scene)).toBe(false);
    expect(renderer.compiles).toHaveLength(1);
    renderer.compiles[0].resolve();
    await flush();
    expect(warmup.step(root, renderer, camera, scene)).toBe(true);

    for (let frame = 0; frame < 30; frame += 1) warmup.step(root, renderer, camera, scene);
    expect(renderer.compiles).toHaveLength(1);
  });

  it("warms materials that mount after the first scan", async () => {
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
    const renderer = createRenderer();
    const warmup = createSectionWarmup();
    warmup.step(root, renderer, camera, scene);
    renderer.compiles[0].resolve();
    await flush();

    root.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
    let ready = true;
    for (let frame = 0; frame < 15 && renderer.compiles.length < 2; frame += 1)
      ready = warmup.step(root, renderer, camera, scene);
    expect(renderer.compiles).toHaveLength(2);
    expect(ready).toBe(false);
  });

  it("uploads loaded material and uniform textures at most twice per frame", async () => {
    const maps = [loadedTexture(), loadedTexture(), loadedTexture()];
    const uniform = loadedTexture();
    const root = new Group();
    for (const map of maps) root.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial({ map })));
    root.add(
      new Mesh(
        new BoxGeometry(),
        new ShaderMaterial({ uniforms: { uMap: { value: uniform } } }),
      ),
    );
    const renderer = createRenderer();
    const warmup = createSectionWarmup();

    warmup.step(root, renderer, camera, scene);
    expect(renderer.uploads).toHaveLength(2);
    renderer.compiles[0].resolve();
    await flush();
    warmup.step(root, renderer, camera, scene);
    expect(renderer.uploads).toHaveLength(4);
    expect(new Set(renderer.uploads)).toEqual(new Set([...maps, uniform]));
    expect(warmup.step(root, renderer, camera, scene)).toBe(true);
  });

  it("decodes image elements before uploading them", async () => {
    const image = document.createElement("img");
    const decode = deferred();
    Object.defineProperty(image, "complete", { value: true });
    image.decode = () => decode.promise;
    const texture = new Texture(image);
    texture.needsUpdate = true;
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial({ map: texture })));
    const renderer = createRenderer();
    const warmup = createSectionWarmup();

    warmup.step(root, renderer, camera, scene);
    renderer.compiles[0].resolve();
    await flush();
    expect(warmup.step(root, renderer, camera, scene)).toBe(false);
    expect(renderer.uploads).toEqual([]);
    decode.resolve();
    await flush();
    expect(warmup.step(root, renderer, camera, scene)).toBe(true);
    expect(renderer.uploads).toEqual([texture]);
  });

  it("skips video, unloaded and empty textures", async () => {
    const video = new VideoTexture(document.createElement("video"));
    video.needsUpdate = true;
    const unloaded = new Texture();
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial({ map: video })));
    root.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial({ map: unloaded })));
    const renderer = createRenderer();
    const warmup = createSectionWarmup();

    warmup.step(root, renderer, camera, scene);
    renderer.compiles[0].resolve();
    await flush();
    expect(warmup.step(root, renderer, camera, scene)).toBe(true);
    expect(renderer.uploads).toEqual([]);
    video.dispose();
  });

  it("treats a failed compilation as finished", async () => {
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
    const warmup = createSectionWarmup();
    const renderer = {
      compileAsync: () => Promise.reject(new Error("lost context")),
      initTexture: () => {},
    };
    warmup.step(root, renderer, camera, scene);
    await flush();
    expect(warmup.step(root, renderer, camera, scene)).toBe(true);
  });
});
