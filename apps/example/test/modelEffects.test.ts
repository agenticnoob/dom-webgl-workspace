import React, { createElement, Fragment } from "react";
import { create, act } from "@react-three/test-renderer";
import { extend, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DOMTargetState } from "@viselora/dom-webgl";
import { installCanvasContext } from "./canvasContext";

const injected = vi.hoisted(() => ({
  time: 0,
  progress: 0,
  available: true,
  listeners: new Set<() => void>(),
  target: undefined as DOMTargetState | undefined,
  scene: undefined as THREE.Group | undefined,
  texture: undefined as THREE.Texture | undefined,
  ready: vi.fn(),
}));
vi.mock("@viselora/dom-webgl/react", () => ({
  useWebGLRuntime: () => ({
    progress: { get: () => injected.progress },
    getTarget: () => injected.target,
    setTargetReady: injected.ready,
    subscribe: (listener: () => void) => {
      injected.listeners.add(listener);
      return () => injected.listeners.delete(listener);
    },
    getDebugState: () => ({ ready: injected.available }),
  }),
}));
vi.mock("../src/useClonedModel", () => ({
  useClonedModel: () => ({ scene: injected.scene, animations: [] }),
}));
vi.mock("@react-three/drei", async (original) => ({
  ...(await original<typeof import("@react-three/drei")>()),
  useTexture: (src: string | string[]) =>
    Array.isArray(src) ? src.map(() => injected.texture) : injected.texture,
}));
import {
  HoverRevealVisual,
  ImageVisual,
  ModelVisual,
  SequenceVisual,
  SurfaceVisual,
  TextVisual,
  VideoVisual,
} from "../src/BasicVisuals";
const renderers: Awaited<ReturnType<typeof create>>[] = [];
function Clock() {
  useFrame((state) => {
    state.clock.elapsedTime = injected.time;
  }, -1);
  return null;
}
async function mount(node: React.ReactNode) {
  const renderer = await create(
    createElement(Fragment, null, createElement(Clock), node),
    { width: 400, height: 300 },
  );
  renderers.push(renderer);
  return renderer;
}
beforeEach(() => {
  extend({
    Mesh: THREE.Mesh,
    Group: THREE.Group,
    PlaneGeometry: THREE.PlaneGeometry,
    MeshBasicMaterial: THREE.MeshBasicMaterial,
    ShaderMaterial: THREE.ShaderMaterial,
    PerspectiveCamera: THREE.PerspectiveCamera,
    AmbientLight: THREE.AmbientLight,
    DirectionalLight: THREE.DirectionalLight,
    PointLight: THREE.PointLight,
    Color: THREE.Color,
  });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  installCanvasContext();
  const element = document.createElement("div");
  element.style.backgroundColor = "black";
  injected.target = {
    id: "visual",
    element,
    rect: {
      left: 0,
      top: 120,
      right: 400,
      bottom: 420,
      width: 400,
      height: 300,
    },
    ready: false,
    visible: true,
    offscreen: "park",
    revision: 0,
  };
  const image = document.createElement("img");
  Object.defineProperties(image, {
    naturalWidth: { value: 800 },
    naturalHeight: { value: 600 },
  });
  injected.texture = new THREE.Texture(image);
  injected.scene = new THREE.Group();
  injected.scene.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshStandardMaterial(),
    ),
  );
  injected.time = 0;
  injected.progress = 0;
  injected.available = true;
  injected.listeners.clear();
  injected.ready.mockReset();
  injected.ready.mockImplementation(
    (_id: string, ready: boolean, expected?: DOMTargetState) => {
      if (!injected.target || (expected && expected !== injected.target))
        return;
      injected.target.ready = ready;
      for (const listener of injected.listeners) listener();
    },
  );
});
afterEach(async () => {
  for (const renderer of renderers.splice(0)) await renderer.unmount();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("native example animation and ownership", () => {
  test("spin and floating models update actual Object3D transforms and park offscreen", async () => {
    const renderer = await mount(
      createElement(ModelVisual, {
        id: "visual",
        src: "/fixture.glb",
        mode: "spin",
      }),
    );
    injected.time = 2;
    await renderer.advanceFrames(1, 1 / 60);
    const group = injected.scene!.parent!;
    expect(group.rotation.y).toBeCloseTo(0.5);
    expect(group.scale.x).toBeGreaterThan(0);
    expect(injected.ready).toHaveBeenCalledWith(
      "visual",
      true,
      injected.target,
    );
    expect(
      (renderer.scene.findByType("AmbientLight").instance as THREE.AmbientLight)
        .intensity,
    ).toBe(0.45);
    const key = renderer.scene.findByType("DirectionalLight")
      .instance as THREE.DirectionalLight;
    expect(key.intensity).toBe(1);
    expect(key.position.toArray()).toEqual([1, 1.5, 2]);
    const initialScale = group.scale.x;
    injected.target!.rect.width = 100;
    await renderer.advanceFrames(1, 1 / 60);
    expect(group.scale.x).toBeLessThan(initialScale);
    injected.target!.visible = false;
    await renderer.advanceFrames(1, 1 / 60);
    expect(group.visible).toBe(false);
    injected.target!.visible = true;
    await renderer.update(
      createElement(
        Fragment,
        null,
        createElement(Clock),
        createElement(ModelVisual, {
          id: "visual",
          src: "/fixture.glb",
          mode: "float",
        }),
      ),
    );
    injected.time = 1.4;
    await renderer.advanceFrames(1, 1 / 60);
    expect(group.position.y).not.toBe(0);
    expect(group.rotation.x).not.toBe(0);
  });
  test("glow clones material per instance and leaves cached model assets alive", async () => {
    const mesh = injected.scene!.children[0] as THREE.Mesh<
      THREE.BoxGeometry,
      THREE.MeshStandardMaterial
    >;
    const cached = mesh.material;
    const disposeCached = vi.spyOn(cached, "dispose");
    const disposeGeometry = vi.spyOn(mesh.geometry, "dispose");
    const renderer = await mount(
      createElement(ModelVisual, {
        id: "visual",
        src: "/fixture.glb",
        mode: "glow",
      }),
    );
    expect(mesh.material).not.toBe(cached);
    expect(cached.emissiveIntensity).toBe(1);
    expect(mesh.material.emissiveIntensity).toBe(1.5);
    expect(
      (renderer.scene.findByType("PointLight").instance as THREE.PointLight)
        .intensity,
    ).toBe(1.8);
    const dispose = vi.spyOn(mesh.material, "dispose");
    await renderer.unmount();
    renderers.splice(renderers.indexOf(renderer), 1);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(disposeCached).not.toHaveBeenCalled();
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(injected.ready).toHaveBeenLastCalledWith(
      "visual",
      false,
      injected.target,
    );
  });
  test.each(["pan", "zoom", "ken-burns"] as const)(
    "%s animates its own texture or plane and releases only the clone",
    async (mode) => {
      const cached = injected.texture!;
      const disposeCached = vi.spyOn(cached, "dispose");
      const renderer = await mount(
        createElement(ImageVisual, { id: "visual", src: "/fixture.png", mode }),
      );
      injected.time = 1.2;
      await renderer.advanceFrames(1, 1 / 60);
      const mesh = renderer.scene.findByType("Mesh").instance as THREE.Mesh<
        THREE.PlaneGeometry,
        THREE.MeshBasicMaterial
      >;
      const texture = mesh.material.map!;
      expect(texture).not.toBe(cached);
      if (mode === "pan") {
        expect(texture.repeat.x).toBe(1.12);
        expect(texture.offset.x).toBeGreaterThan(0);
      } else expect(mesh.scale.x).toBeGreaterThan(1);
      expect(cached.offset.x).toBe(0);
      const dispose = vi.spyOn(texture, "dispose");
      await renderer.unmount();
      renderers.splice(renderers.indexOf(renderer), 1);
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(disposeCached).not.toHaveBeenCalled();
    },
  );
  test("zoom keeps cover cropping when the DOM viewport changes aspect", async () => {
    const renderer = await mount(
      createElement(ImageVisual, {
        id: "visual",
        src: "/fixture.png",
        mode: "zoom",
      }),
    );
    const texture = (
      renderer.scene.findByType("Mesh").instance as THREE.Mesh<
        THREE.PlaneGeometry,
        THREE.MeshBasicMaterial
      >
    ).material.map!;
    injected.target!.rect.width = 200;
    await renderer.advanceFrames(1, 1 / 60);
    expect(texture.repeat.toArray()).toEqual([0.5, 1]);
    expect(texture.offset.toArray()).toEqual([0.25, 0]);
    injected.target!.rect.width = 800;
    await renderer.advanceFrames(1, 1 / 60);
    expect(texture.repeat.toArray()).toEqual([1, 0.5]);
    expect(texture.offset.toArray()).toEqual([0, 0.25]);
  });
  test("sequence scrubs both directions with one GPU texture and recenters on pointer leave", async () => {
    const frames = [0, 1, 2].map(() => fakeBitmap());
    const requested: number[] = [];
    const renderer = await mount(
      createElement(SequenceVisual, {
        id: "visual",
        sequence: {
          count: frames.length,
          frameNear: (index: number) => {
            requested.push(index);
            return frames[index];
          },
        },
        progressKey: "sequence",
        card: { current: null },
      }),
    );
    const node = renderer.scene.findAllByType("Mesh")[0];
    const mesh = node.instance as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.MeshBasicMaterial
    >;
    const texture = mesh.material.map!;
    injected.progress = 1;
    await renderer.advanceFrames(1, 1 / 60);
    expect(texture.image).toBe(frames[2]);
    expect(texture.flipY).toBe(false);
    injected.progress = 0;
    await renderer.advanceFrames(1, 1 / 60);
    expect(texture.image).toBe(frames[0]);
    expect(requested).toContain(2);
    expect(requested.at(-1)).toBe(0);
    expect(mesh.material.map).toBe(texture);
    await renderer.fireEvent(node, "pointerMove", { uv: { x: 1, y: 0 } });
    await renderer.advanceFrames(1, 1 / 60);
    expect(texture.offset.x).toBeGreaterThan(0.04);
    await renderer.fireEvent(node, "pointerOut");
    await renderer.advanceFrames(1, 1 / 60);
    expect(texture.offset.toArray()).toEqual([0.04, 0.04]);
  });
  test("hover reveal releases its mask while retaining the shared loaded images", async () => {
    injected.target!.rect.width = 200;
    const renderer = await mount(
      createElement(HoverRevealVisual, { id: "visual" }),
    );
    await renderer.advanceFrames(1, 1 / 60);
    const material = (
      renderer.scene.findByType("Mesh").instance as THREE.Mesh<
        THREE.PlaneGeometry,
        THREE.ShaderMaterial
      >
    ).material;
    expect(material.uniforms.uUvRepeat.value).toEqual([0.5, 1]);
    expect(material.uniforms.uUvOffset.value).toEqual([0.25, 0]);
    const disposeMask = vi.spyOn(
      material.uniforms.uMaskTexture.value as THREE.Texture,
      "dispose",
    );
    const disposeLoaded = vi.spyOn(injected.texture!, "dispose");
    await renderer.unmount();
    renderers.splice(renderers.indexOf(renderer), 1);
    expect(disposeMask).toHaveBeenCalledTimes(1);
    expect(disposeLoaded).not.toHaveBeenCalled();
  });
  test("sequence card rebuilds its text atlas for a same-size content revision", async () => {
    const card = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "First caption";
    card.append(title);
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue(
      new DOMRect(20, 180, 240, 120),
    );
    vi.spyOn(title, "getBoundingClientRect").mockReturnValue(
      new DOMRect(40, 200, 200, 40),
    );
    const frame = fakeBitmap();
    const renderer = await mount(
      createElement(SequenceVisual, {
        id: "visual",
        sequence: { count: 1, frameNear: () => frame },
        progressKey: "sequence",
        card: { current: card },
      }),
    );
    await renderer.advanceFrames(1, 1 / 60);
    const material = (
      renderer.scene.findAllByType("Mesh")[1].instance as THREE.Mesh<
        THREE.PlaneGeometry,
        THREE.MeshBasicMaterial
      >
    ).material;
    const previous = material.map!;
    const dispose = vi.spyOn(previous, "dispose");
    title.textContent = "Revised caption";
    injected.target!.revision++;
    await renderer.advanceFrames(1, 1 / 60);
    expect(material.map).not.toBe(previous);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
  test("video configures playback, pauses offscreen and releases the native VideoTexture", async () => {
    const video = document.createElement("video");
    injected.target = { ...injected.target!, element: video };
    Object.defineProperty(video, "readyState", { value: 2 });
    const play = vi.spyOn(video, "play").mockResolvedValue();
    const pause = vi.spyOn(video, "pause").mockImplementation(() => {});
    const renderer = await mount(
      createElement(VideoVisual, {
        id: "visual",
        src: "/fixture.mp4",
        playbackRate: 0.8,
        drift: true,
      }),
    );
    await act(async () => {
      await renderer.advanceFrames(1, 1 / 60);
    });
    expect(video.playbackRate).toBe(0.8);
    expect(video.loop).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
    const map = (
      renderer.scene.findByType("Mesh").instance as THREE.Mesh<
        THREE.PlaneGeometry,
        THREE.MeshBasicMaterial
      >
    ).material.map!;
    expect(map.repeat.x).toBe(1.08);
    const dispose = vi.spyOn(map, "dispose");
    injected.target!.visible = false;
    await renderer.advanceFrames(1, 1 / 60);
    expect(pause).toHaveBeenCalled();
    await renderer.unmount();
    renderers.splice(renderers.indexOf(renderer), 1);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
  test("video cover uses intrinsic media size and a rejected play keeps the DOM fallback", async () => {
    const video = document.createElement("video");
    injected.target = { ...injected.target!, element: video };
    Object.defineProperties(video, {
      readyState: { value: 2 },
      videoWidth: { value: 1600 },
      videoHeight: { value: 600 },
    });
    vi.spyOn(video, "play").mockResolvedValue();
    vi.spyOn(video, "pause").mockImplementation(() => {});
    const renderer = await mount(
      createElement(VideoVisual, { id: "visual", src: "/fixture.mp4" }),
    );
    await act(async () => {
      await renderer.advanceFrames(1, 1 / 60);
    });
    const texture = (
      renderer.scene.findByType("Mesh").instance as THREE.Mesh<
        THREE.PlaneGeometry,
        THREE.MeshBasicMaterial
      >
    ).material.map!;
    expect(texture.repeat.toArray()).toEqual([0.5, 1]);
    expect(texture.offset.toArray()).toEqual([0.25, 0]);
    injected.target!.visible = false;
    await renderer.advanceFrames(1, 1 / 60);
    vi.mocked(video.play).mockRejectedValue(new Error("Autoplay blocked"));
    injected.target!.visible = true;
    await act(async () => {
      await renderer.advanceFrames(1, 1 / 60);
    });
    expect(injected.target!.ready).toBe(false);
    await renderer.advanceFrames(2, 1 / 60);
    expect(injected.target!.ready).toBe(false);
  });
  test("surface clears only its decorative DOM fill and restores it on unmount", async () => {
    const renderer = await mount(
      createElement(SurfaceVisual, { id: "visual", mode: "pulse" }),
    );
    await renderer.advanceFrames(1, 1 / 60);
    expect(injected.target!.element.style.backgroundColor).toBe("transparent");
    await renderer.unmount();
    renderers.splice(renderers.indexOf(renderer), 1);
    expect(injected.target!.element.style.backgroundColor).toBe("black");
  });
  test("surface restores its original DOM background on renderer failure and hides it again after recovery", async () => {
    const renderer = await mount(
      createElement(SurfaceVisual, { id: "visual", mode: "pulse" }),
    );
    await renderer.advanceFrames(1, 1 / 60);
    expect(injected.target!.element.style.backgroundColor).toBe("transparent");
    injected.available = false;
    for (const listener of injected.listeners) listener();
    expect(injected.target!.element.style.backgroundColor).toBe("black");
    await renderer.advanceFrames(1, 1 / 60);
    expect(injected.target!.element.style.backgroundColor).toBe("black");
    injected.available = true;
    for (const listener of injected.listeners) listener();
    expect(injected.target!.element.style.backgroundColor).toBe("transparent");
  });
  test("text revision rebuilds its texture after same-size content or style changes", async () => {
    const element = injected.target!.element;
    element.textContent = "FIRST";
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 120, 400, 300),
    );
    const renderer = await mount(
      createElement(TextVisual, { id: "visual", mode: "wave" }),
    );
    await renderer.advanceFrames(1, 1 / 60);
    const material = (
      renderer.scene.findByType("Mesh").instance as THREE.Mesh<
        THREE.PlaneGeometry,
        THREE.MeshBasicMaterial
      >
    ).material;
    const previous = material.map!;
    const dispose = vi.spyOn(previous, "dispose");
    element.textContent = "SECOND";
    element.style.color = "rgb(200, 0, 0)";
    injected.target!.revision++;
    await renderer.advanceFrames(1, 1 / 60);
    expect(material.map).not.toBe(previous);
    expect(dispose).toHaveBeenCalledTimes(1);
    const current = material.map;
    await renderer.advanceFrames(1, 1 / 60);
    expect(material.map).toBe(current);
  });
});

function fakeBitmap(): ImageBitmap {
  return { width: 400, height: 225, close: () => {} };
}
