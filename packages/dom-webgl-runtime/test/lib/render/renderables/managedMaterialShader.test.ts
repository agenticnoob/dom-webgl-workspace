import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { MeshPhysicalMaterial } from "three/src/materials/MeshPhysicalMaterial.js";
import { MeshStandardMaterial } from "three/src/materials/MeshStandardMaterial.js";
import type { Material } from "three/src/materials/Material.js";
import { Color } from "three/src/math/Color.js";
import { Vector2 } from "three/src/math/Vector2.js";
import { Texture } from "three/src/textures/Texture.js";
import { describe, expect, test, vi } from "vitest";

import type {
  WebGLEffectMaterialKind,
  WebGLEffectMaterialShaderDraft,
} from "../../../../src/lib/effects/effectMaterial";
import { createManagedMaterialShaderHost } from "../../../../src/lib/render/renderables/managedMaterialShader";

type ThreeUniform = { value: unknown };

type ThreeShaderDraft = {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, ThreeUniform>;
  defines: Record<string, string | number | boolean>;
};

describe("managed material shader", () => {
  test("composes controlled callbacks over a real Standard material", () => {
    const material = new MeshStandardMaterial();
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });
    const compile = vi.fn((draft: WebGLEffectMaterialShaderDraft) => {
      draft.fragmentShader = draft.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\nfloat appMarker = 1.0;",
      );
      draft.uniforms.appAmount = 0.25;
    });

    host.facade.onBeforeCompile({
      key: "app.standard",
      uniforms: { appAmount: 0 },
      compile,
    });
    const shader = createThreeShaderDraft();
    callMaterialCompile(material, shader);

    expect(compile).toHaveBeenCalledTimes(1);
    expect(shader.fragmentShader).toContain("float appMarker = 1.0;");
    expect(shader.uniforms.appAmount?.value).toBe(0.25);
    expect(shader.fragmentShader).toContain(
      "uniform vec2 domWebGLViewportSize;",
    );
    expect(shader.fragmentShader).toContain(
      "uniform float domWebGLPixelRatio;",
    );
  });

  test("preserves the base shader and cache key when no extension is registered", () => {
    const material = new MeshStandardMaterial();
    const baseCacheKey = material.customProgramCacheKey();
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });
    const shader = createThreeShaderDraft();

    callMaterialCompile(material, shader);

    expect(shader.fragmentShader).toBe(
      "#include <emissivemap_fragment>\n#include <lights_fragment_begin>",
    );
    expect(shader.uniforms.domWebGLViewportSize).toBeUndefined();
    expect(shader.uniforms.domWebGLPixelRatio).toBeUndefined();
    expect(material.customProgramCacheKey()).toBe(baseCacheKey);
    host.dispose();
  });

  test.each([
    ["basic", new MeshBasicMaterial()],
    ["standard", new MeshStandardMaterial()],
    ["physical", new MeshPhysicalMaterial()],
  ] satisfies readonly (readonly [WebGLEffectMaterialKind, Material])[])(
    "preserves the real %s material while exposing its controlled kind",
    (materialKind, material) => {
      const host = createManagedMaterialShaderHost({
        objectId: `mesh.${materialKind}`,
        materialKind,
        material,
      });
      const compile = vi.fn((draft: WebGLEffectMaterialShaderDraft) => {
        expect(draft.materialKind).toBe(materialKind);
      });

      host.facade.onBeforeCompile({ key: `app.${materialKind}`, compile });
      callMaterialCompile(material, createThreeShaderDraft());

      expect(compile).toHaveBeenCalledTimes(1);
    },
  );

  test("updates live uniforms without changing the program cache key or material version", () => {
    const material = new MeshStandardMaterial();
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });
    host.facade.onBeforeCompile({
      key: "app.standard",
      uniforms: { amount: 0.25, origin: [0.5, 0.5] },
      compile() {},
    });
    const shader = createThreeShaderDraft();
    callMaterialCompile(material, shader);
    const cacheKey = material.customProgramCacheKey();
    const version = material.version;

    host.facade.setUniforms("app.standard", {
      amount: 0.75,
      origin: [0.25, 0.8],
    });

    expect(shader.uniforms.amount?.value).toBe(0.75);
    expect(shader.uniforms.origin?.value).toMatchObject({ x: 0.25, y: 0.8 });
    expect(material.customProgramCacheKey()).toBe(cacheKey);
    expect(material.version).toBe(version);
  });

  test("normalizes colors and vectors then updates compatible values in place", () => {
    const material = new MeshStandardMaterial();
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });
    host.facade.onBeforeCompile({
      key: "app.values",
      uniforms: {
        tint: "#ff0000",
        origin: [0.5, 0.5],
        trail: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
      },
      compile() {},
    });
    const shader = createThreeShaderDraft();
    callMaterialCompile(material, shader);
    const tint = shader.uniforms.tint?.value;
    const origin = shader.uniforms.origin?.value;
    const trail = shader.uniforms.trail?.value;

    host.facade.setUniforms("app.values", {
      tint: "#00ff00",
      origin: [0.25, 0.75],
      trail: [
        [0.5, 0.6],
        [0.7, 0.8],
      ],
    });

    expect(tint).toBeInstanceOf(Color);
    expect(shader.uniforms.tint?.value).toBe(tint);
    expect(tint).toMatchObject({ r: 0, g: 1, b: 0 });
    expect(origin).toBeInstanceOf(Vector2);
    expect(shader.uniforms.origin?.value).toBe(origin);
    expect(origin).toMatchObject({ x: 0.25, y: 0.75 });
    expect(shader.uniforms.trail?.value).toBe(trail);
    expect(trail).toEqual([
      expect.objectContaining({ x: 0.5, y: 0.6 }),
      expect.objectContaining({ x: 0.7, y: 0.8 }),
    ]);
  });

  test("keeps identical registration idempotent and rejects conflicting definitions", () => {
    const material = new MeshStandardMaterial();
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });
    const definition = { key: "app.same", compile() {} };

    host.facade.onBeforeCompile(definition);
    const version = material.version;
    host.facade.onBeforeCompile(definition);

    expect(material.version).toBe(version);
    expect(() =>
      host.facade.onBeforeCompile({ key: "app.same", compile() {} }),
    ).toThrow(
      'WebGL mesh "mesh.hero" standard material shader extension "app.same" is already registered with a different definition.',
    );
  });

  test("rejects invalid keys, uniforms, and unknown updates contextually", () => {
    const material = new MeshStandardMaterial();
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });

    expect(() =>
      host.facade.onBeforeCompile({ key: " ", compile() {} }),
    ).toThrow("requires a non-empty extension key");
    expect(() =>
      host.facade.onBeforeCompile({
        key: "app.invalid",
        uniforms: { amount: Number.NaN },
        compile() {},
      }),
    ).toThrow(
      'WebGL mesh "mesh.hero" standard material shader extension "app.invalid" received invalid uniform "amount".',
    );

    host.facade.onBeforeCompile({
      key: "app.valid",
      uniforms: { amount: 0 },
      compile() {},
    });
    expect(() =>
      host.facade.setUniforms("app.missing", { amount: 1 }),
    ).toThrow(
      'WebGL mesh "mesh.hero" standard material shader extension "app.missing" is not registered.',
    );
    expect(() =>
      host.facade.setUniforms("app.valid", { missing: 1 }),
    ).toThrow(
      'WebGL mesh "mesh.hero" standard material shader extension "app.valid" does not declare uniform "missing".',
    );
  });

  test("remove changes cache identity and permits re-registration", () => {
    const material = new MeshStandardMaterial();
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });
    const first = { key: "app.radial", compile() {} };
    const second = { key: "app.radial", compile() {} };

    host.facade.onBeforeCompile(first);
    const registeredKey = material.customProgramCacheKey();
    host.facade.remove("app.radial");
    const removedKey = material.customProgramCacheKey();
    host.facade.remove("app.radial");
    host.facade.onBeforeCompile(second);

    expect(removedKey).not.toBe(registeredKey);
    expect(material.customProgramCacheKey()).not.toBe(removedKey);
  });

  test("adds contextual information when a consumer compile callback throws", () => {
    const material = new MeshStandardMaterial();
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });
    host.facade.onBeforeCompile({
      key: "app.broken",
      compile() {
        throw new Error("broken callback");
      },
    });

    expect(() => callMaterialCompile(material, createThreeShaderDraft())).toThrow(
      'WebGL mesh "mesh.hero" standard material shader extension "app.broken" failed',
    );
  });

  test("updates CSS viewport and DPR uniforms for every compiled variant", () => {
    const material = new MeshStandardMaterial();
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });
    host.facade.onBeforeCompile({ key: "app.radial", compile() {} });
    const first = createThreeShaderDraft();
    const second = createThreeShaderDraft();
    callMaterialCompile(material, first);
    callMaterialCompile(material, second);

    host.beforeRender({
      getSize(target) {
        return target.set(1200, 835);
      },
      getPixelRatio() {
        return 2;
      },
    });

    for (const shader of [first, second]) {
      expect(shader.uniforms.domWebGLViewportSize?.value).toMatchObject({
        x: 1200,
        y: 835,
      });
      expect(shader.uniforms.domWebGLPixelRatio?.value).toBe(2);
    }
  });

  test("clamps invalid viewport and DPR values before render", () => {
    const material = new MeshStandardMaterial();
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });
    host.facade.onBeforeCompile({ key: "app.radial", compile() {} });
    const shader = createThreeShaderDraft();
    callMaterialCompile(material, shader);

    host.beforeRender({
      getSize(target) {
        return target.set(Number.NaN, -4);
      },
      getPixelRatio() {
        return Number.POSITIVE_INFINITY;
      },
    });

    expect(shader.uniforms.domWebGLViewportSize?.value).toMatchObject({
      x: 1,
      y: 1,
    });
    expect(shader.uniforms.domWebGLPixelRatio?.value).toBe(1);
  });

  test("applies multiple extensions in registration order", () => {
    const material = new MeshStandardMaterial();
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });
    host.facade.onBeforeCompile({
      key: "app.first",
      defines: { APP_SHARED: 1 },
      compile(draft) {
        draft.fragmentShader += "\nFIRST";
      },
    });
    host.facade.onBeforeCompile({
      key: "app.second",
      defines: { APP_SHARED: 1 },
      compile(draft) {
        draft.fragmentShader += "\nSECOND";
      },
    });
    const shader = createThreeShaderDraft();

    callMaterialCompile(material, shader);

    expect(shader.fragmentShader.indexOf("FIRST")).toBeLessThan(
      shader.fragmentShader.indexOf("SECOND"),
    );
    expect(shader.defines.APP_SHARED).toBe(1);
  });

  test("rejects conflicting defines with extension context", () => {
    const material = new MeshStandardMaterial();
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });
    host.facade.onBeforeCompile({
      key: "app.first",
      defines: { APP_SHARED: 1 },
      compile() {},
    });
    host.facade.onBeforeCompile({
      key: "app.second",
      defines: { APP_SHARED: 2 },
      compile() {},
    });

    expect(() => callMaterialCompile(material, createThreeShaderDraft())).toThrow(
      'WebGL mesh "mesh.hero" standard material shader extension "app.second" conflicts on define "APP_SHARED".',
    );
  });

  test.each(["domWebGLViewportSize", "domWebGLPixelRatio"])(
    "rejects reserved runtime uniform %s",
    (name) => {
      const material = new MeshStandardMaterial();
      const host = createManagedMaterialShaderHost({
        objectId: "mesh.hero",
        materialKind: "standard",
        material,
      });

      expect(() =>
        host.facade.onBeforeCompile({
          key: "app.reserved",
          uniforms: { [name]: 1 },
          compile() {},
        }),
      ).toThrow(
        `WebGL mesh "mesh.hero" standard material shader extension "app.reserved" cannot declare reserved uniform "${name}".`,
      );
    },
  );

  test("reuses owned textures by source and disposes replacements exactly once", () => {
    const material = new MeshStandardMaterial();
    const materialDispose = vi.spyOn(material, "dispose");
    const firstCanvas = document.createElement("canvas");
    const secondCanvas = document.createElement("canvas");
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });
    host.facade.onBeforeCompile({
      key: "app.texture",
      uniforms: { map: { kind: "canvas-texture", source: firstCanvas } },
      compile() {},
    });
    const shader = createThreeShaderDraft();
    callMaterialCompile(material, shader);
    const firstTexture = shader.uniforms.map?.value;
    if (!(firstTexture instanceof Texture)) {
      throw new Error("Expected a managed texture uniform.");
    }
    const firstDispose = vi.spyOn(firstTexture, "dispose");

    host.facade.setUniforms("app.texture", {
      map: { kind: "canvas-texture", source: firstCanvas },
    });
    expect(shader.uniforms.map?.value).toBe(firstTexture);
    expect(firstDispose).not.toHaveBeenCalled();

    host.facade.setUniforms("app.texture", {
      map: { kind: "canvas-texture", source: secondCanvas },
    });
    const secondTexture = shader.uniforms.map?.value;
    if (!(secondTexture instanceof Texture)) {
      throw new Error("Expected a replacement managed texture uniform.");
    }
    const secondDispose = vi.spyOn(secondTexture, "dispose");

    expect(secondTexture).not.toBe(firstTexture);
    expect(firstDispose).toHaveBeenCalledTimes(1);

    host.dispose();
    host.dispose();

    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(secondDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).not.toHaveBeenCalled();
  });

  test("owns image and video uniform textures but rejects source textures", () => {
    const material = new MeshStandardMaterial();
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });
    host.facade.onBeforeCompile({
      key: "app.dom-textures",
      uniforms: {
        image: { kind: "image-texture", source: document.createElement("img") },
        video: {
          kind: "video-texture",
          source: document.createElement("video"),
        },
      },
      compile() {},
    });
    const shader = createThreeShaderDraft();
    callMaterialCompile(material, shader);
    const image = shader.uniforms.image?.value;
    const video = shader.uniforms.video?.value;
    if (!(image instanceof Texture) || !(video instanceof Texture)) {
      throw new Error("Expected managed DOM texture uniforms.");
    }
    const imageDispose = vi.spyOn(image, "dispose");
    const videoDispose = vi.spyOn(video, "dispose");

    host.dispose();

    expect(imageDispose).toHaveBeenCalledTimes(1);
    expect(videoDispose).toHaveBeenCalledTimes(1);

    const sourceHost = createManagedMaterialShaderHost({
      objectId: "mesh.source",
      materialKind: "standard",
      material: new MeshStandardMaterial(),
    });
    expect(() =>
      sourceHost.facade.onBeforeCompile({
        key: "app.source",
        uniforms: { map: { kind: "source-texture" } },
        compile() {},
      }),
    ).toThrow(
      'WebGL mesh "mesh.source" standard material shader extension "app.source" cannot bind source texture uniform "map" because no source texture is available.',
    );
  });

  test("restores prototype material hooks after idempotent disposal", () => {
    const material = new MeshStandardMaterial();
    const originalCompile = material.onBeforeCompile;
    const originalCacheKey = material.customProgramCacheKey;
    const originalCompileOwn = Object.hasOwn(material, "onBeforeCompile");
    const originalCacheKeyOwn = Object.hasOwn(material, "customProgramCacheKey");
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });

    expect(Object.hasOwn(material, "onBeforeCompile")).toBe(true);
    expect(Object.hasOwn(material, "customProgramCacheKey")).toBe(true);

    host.dispose();
    host.dispose();

    expect(material.onBeforeCompile).toBe(originalCompile);
    expect(material.customProgramCacheKey).toBe(originalCacheKey);
    expect(Object.hasOwn(material, "onBeforeCompile")).toBe(originalCompileOwn);
    expect(Object.hasOwn(material, "customProgramCacheKey")).toBe(
      originalCacheKeyOwn,
    );
  });

  test("restores pre-existing own material hooks", () => {
    const material = new MeshStandardMaterial();
    const originalCompile = vi.fn();
    const originalCacheKey = vi.fn(() => "app-base");
    material.onBeforeCompile = originalCompile;
    material.customProgramCacheKey = originalCacheKey;
    const host = createManagedMaterialShaderHost({
      objectId: "mesh.hero",
      materialKind: "standard",
      material,
    });

    host.dispose();

    expect(material.onBeforeCompile).toBe(originalCompile);
    expect(material.customProgramCacheKey).toBe(originalCacheKey);
    expect(Object.hasOwn(material, "onBeforeCompile")).toBe(true);
    expect(Object.hasOwn(material, "customProgramCacheKey")).toBe(true);
  });
});

function createThreeShaderDraft(): ThreeShaderDraft {
  return {
    vertexShader: "#include <begin_vertex>",
    fragmentShader:
      "#include <emissivemap_fragment>\n#include <lights_fragment_begin>",
    uniforms: {},
    defines: {},
  };
}

function callMaterialCompile(
  material: Material,
  shader: ThreeShaderDraft,
): void {
  Reflect.apply(material.onBeforeCompile, material, [shader, {}]);
}
