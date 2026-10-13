import { createElement } from "react";
import { create, act } from "@react-three/test-renderer";
import * as THREE from "three";
import { extend, useThree } from "@react-three/fiber";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Mesh, ShaderMaterial, Texture } from "three";
import {
  PaperReaderSurface,
  type PaperReaderSurfaceProps,
} from "../../src/recipes/paper-reader/PaperReaderSurface";
import { defaultPaperReaderPalette } from "../../src/recipes/paper-reader/model";
import { installCanvasContext } from "../canvasContext";

beforeEach(() => {
  extend({
    Mesh: THREE.Mesh,
    PlaneGeometry: THREE.PlaneGeometry,
    MeshBasicMaterial: THREE.MeshBasicMaterial,
    ShaderMaterial: THREE.ShaderMaterial,
  });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  installCanvasContext();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function fixture() {
  let value = 0.25;
  const props: PaperReaderSurfaceProps = {
    progress: { get: vi.fn(() => value) },
    progressKey: "notes.progress",
    eyebrow: "READING ROOM",
    content: {
      title: "Field notes",
      intro: "A collection.",
      sections: [
        {
          id: "one",
          label: "01",
          title: "Observe",
          body: "Begin with an observation.",
        },
        {
          id: "two",
          label: "02",
          title: "Make",
          body: "Make a small experiment.",
        },
      ],
    },
    palette: defaultPaperReaderPalette,
    onReady: vi.fn(),
    onError: vi.fn(),
  };
  return {
    props,
    progress(next: number) {
      value = next;
    },
  };
}
function material(renderer: Awaited<ReturnType<typeof create>>) {
  const mesh = renderer.scene.findByType("Mesh").instance as Mesh;
  if (!mesh.isMesh || !(mesh.material instanceof ShaderMaterial))
    throw new Error("Expected native paper material");
  return mesh.material;
}

describe("paper reader R3F lifecycle", () => {
  test("uses its View dimensions and updates keyed progress without rebuilding atlas", async () => {
    const { props, progress } = fixture();
    const renderer = await create(createElement(PaperReaderSurface, props), {
      width: 640,
      height: 720,
    });
    const shader = material(renderer);
    const atlas = shader.uniforms.inkAtlas.value;
    expect(shader.uniforms.viewport.value).toEqual([640, 720]);
    expect(props.onReady).toHaveBeenCalledWith(true);
    const before = [...shader.uniforms.origins.value];
    progress(0.75);
    await renderer.advanceFrames(1, 1 / 60);
    expect(props.progress.get).toHaveBeenCalledWith("notes.progress");
    expect(shader.uniforms.origins.value).not.toEqual(before);
    expect(material(renderer)).toBe(shader);
    expect(shader.uniforms.inkAtlas.value).toBe(atlas);
    await renderer.unmount();
  });
  test("resize releases old texture/material; unmount releases the replacement once", async () => {
    const { props } = fixture();
    let resize: (width: number, height: number) => void = () => {};
    function Scene() {
      resize = useThree((state) => state.setSize);
      return createElement(PaperReaderSurface, props);
    }
    const renderer = await create(createElement(Scene), {
      width: 640,
      height: 720,
    });
    const original = material(renderer);
    const texture = original.uniforms.inkAtlas.value as Texture;
    const disposeMaterial = vi.spyOn(original, "dispose");
    const disposeTexture = vi.spyOn(texture, "dispose");
    await act(async () => resize(800, 760));
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
    expect(disposeTexture).toHaveBeenCalledTimes(1);
    const next = material(renderer);
    expect(next).not.toBe(original);
    const disposeNext = vi.spyOn(next, "dispose");
    const disposeNextTexture = vi.spyOn(
      next.uniforms.inkAtlas.value as Texture,
      "dispose",
    );
    await renderer.unmount();
    expect(disposeNext).toHaveBeenCalledTimes(1);
    expect(disposeNextTexture).toHaveBeenCalledTimes(1);
    expect(props.onReady).toHaveBeenLastCalledWith(false);
  });
  test("tracks a DOM-only View resize independently of the shared Canvas dimensions", async () => {
    const { props } = fixture();
    const renderer = await create(
      createElement(PaperReaderSurface, {
        ...props,
        viewport: { width: 640, height: 720 },
      }),
      { width: 1440, height: 900 },
    );
    const original = material(renderer);
    expect(original.uniforms.viewport.value).toEqual([640, 720]);
    const dispose = vi.spyOn(
      original.uniforms.inkAtlas.value as Texture,
      "dispose",
    );
    await renderer.update(
      createElement(PaperReaderSurface, {
        ...props,
        viewport: { width: 800, height: 760 },
      }),
    );
    expect(material(renderer).uniforms.viewport.value).toEqual([800, 760]);
    expect(dispose).toHaveBeenCalledTimes(1);
    await renderer.unmount();
  });
  test("independent instances retain their own atlas and progress", async () => {
    const a = fixture();
    const b = fixture();
    b.progress(0.75);
    const first = await create(createElement(PaperReaderSurface, a.props), {
      width: 640,
      height: 720,
    });
    const second = await create(createElement(PaperReaderSurface, b.props), {
      width: 800,
      height: 720,
    });
    const shader = material(second);
    const dispose = vi.spyOn(shader, "dispose");
    expect(material(first).uniforms.inkAtlas.value).not.toBe(
      shader.uniforms.inkAtlas.value,
    );
    await first.unmount();
    expect(dispose).not.toHaveBeenCalled();
    expect(b.props.onReady).toHaveBeenLastCalledWith(true);
    await second.unmount();
  });
  test("reports a failed texture context once and leaves semantic fallback ready", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { props } = fixture();
    const renderer = await create(createElement(PaperReaderSurface, props), {
      width: 640,
      height: 720,
    });
    await renderer.advanceFrames(3, 1 / 60);
    expect(props.onReady).toHaveBeenCalledWith(false);
    expect(props.onError).toHaveBeenCalledTimes(1);
    expect(renderer.scene.findByType("Mesh").instance.visible).toBe(false);
    await renderer.unmount();
  });
  test("recovers from an undersized stage when the View grows", async () => {
    const { props } = fixture();
    let resize: (width: number, height: number) => void = () => {};
    function Scene() {
      resize = useThree((state) => state.setSize);
      return createElement(PaperReaderSurface, props);
    }
    const renderer = await create(createElement(Scene), {
      width: 640,
      height: 90,
    });
    expect(props.onReady).toHaveBeenCalledWith(false);
    expect(props.onError).toHaveBeenCalledTimes(1);
    await act(async () => resize(640, 720));
    expect(props.onReady).toHaveBeenLastCalledWith(true);
    expect(material(renderer)).toBeInstanceOf(ShaderMaterial);
    await renderer.unmount();
  });
});
