import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { ShaderMaterial } from "three/src/materials/ShaderMaterial.js";
import { Texture } from "three/src/textures/Texture.js";
import { describe, expect, test, vi } from "vitest";

import type { WebGLEffectUniformValue } from "../../effects/effectAuthoring";
import { createMaterialLayer } from "./materialLayer";

describe("material layer", () => {
  test("replaces material, updates uniforms, and restores original material", () => {
    const originalMaterial = new MeshBasicMaterial({ opacity: 0.5 });
    const sourceTexture = new Texture();
    const target = { material: originalMaterial };

    const layer = createMaterialLayer({
      key: "test.layer",
      target,
      sourceTexture,
      sourceTextureUniform: "sourceMap",
      program: {
        fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
        uniforms: {
          amount: 0.25,
          enabled: true,
          uvScale: [1, 2],
          color: [1, 0.5, 0.25],
          tint: [1, 1, 1, 0.75],
          sourceMap: { kind: "source-texture" },
        },
        defines: { USE_SOURCE: true },
        blend: "additive",
      },
    });

    expect(target.material).toBeInstanceOf(ShaderMaterial);
    const shader = readShaderMaterial(target.material);
    expect(shader.uniforms.amount?.value).toBe(0.25);
    expect(shader.uniforms.enabled?.value).toBe(true);
    expect(shader.uniforms.uvScale?.value).toMatchObject({ x: 1, y: 2 });
    expect(shader.uniforms.color?.value).toMatchObject({ x: 1, y: 0.5, z: 0.25 });
    expect(shader.uniforms.tint?.value).toMatchObject({
      x: 1,
      y: 1,
      z: 1,
      w: 0.75,
    });
    expect(shader.uniforms.sourceMap?.value).toBe(sourceTexture);
    expect(shader.transparent).toBe(true);
    expect(shader.depthWrite).toBe(true);
    expect(shader.depthTest).toBe(true);
    expect(shader.toneMapped).toBe(true);

    layer.setUniforms({ amount: 0.75, uvScale: [3, 4] });

    expect(shader.uniforms.amount?.value).toBe(0.75);
    expect(shader.uniforms.uvScale?.value).toMatchObject({ x: 3, y: 4 });

    layer.clear();

    expect(target.material).toBe(originalMaterial);
  });

  test("setUniforms updates scalar uniforms without recompiling material", () => {
    const target = { material: new MeshBasicMaterial() };
    const layer = createMaterialLayer({
      key: "test.layer",
      target,
      program: {
        fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
        uniforms: { amount: 0.25 },
      },
    });
    const shader = readShaderMaterial(target.material);

    const version = shader.version;
    layer.setUniforms({ amount: 0.5 });

    expect(readShaderMaterial(target.material)).toBe(shader);
    expect(shader.uniforms.amount?.value).toBe(0.5);
    expect(shader.version).toBe(version);
  });

  test("setUniforms disposes replaced owned texture uniforms only when source changes", () => {
    const target = { material: new MeshBasicMaterial() };
    const first = document.createElement("canvas");
    const second = document.createElement("canvas");
    const layer = createMaterialLayer({
      key: "test.layer",
      target,
      program: {
        fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
        uniforms: { map: { kind: "canvas-texture", source: first } },
      },
    });
    const shader = readShaderMaterial(target.material);
    const original = shader.uniforms.map?.value as Texture;
    const dispose = vi.spyOn(original, "dispose");

    layer.setUniforms({ map: { kind: "canvas-texture", source: first } });
    expect(dispose).not.toHaveBeenCalled();

    layer.setUniforms({ map: { kind: "canvas-texture", source: second } });
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  test("disposes runtime-created material and DOM texture uniforms idempotently", () => {
    const target = { material: new MeshBasicMaterial() };
    const canvas = document.createElement("canvas");
    const layer = createMaterialLayer({
      key: "test.layer",
      target,
      program: {
        fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
        uniforms: {
          canvasMap: { kind: "canvas-texture", source: canvas },
        },
      },
    });
    const shader = readShaderMaterial(target.material);
    const materialDispose = vi.spyOn(shader, "dispose");
    const texture = shader.uniforms.canvasMap?.value as Texture;
    const textureDispose = vi.spyOn(texture, "dispose");

    layer.dispose();
    layer.dispose();

    expect(target.material).toBeInstanceOf(MeshBasicMaterial);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
  });

  test("marks runtime-created texture uniforms dirty without disposing source textures", () => {
    const target = { material: new MeshBasicMaterial() };
    const sourceTexture = new Texture();
    const canvas = document.createElement("canvas");
    const image = document.createElement("img");
    const video = document.createElement("video");
    const layer = createMaterialLayer({
      key: "test.layer",
      target,
      sourceTexture,
      program: {
        fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
        uniforms: {
          sourceMap: { kind: "source-texture" },
          canvasMap: { kind: "canvas-texture", source: canvas },
          imageMap: { kind: "image-texture", source: image },
          videoMap: { kind: "video-texture", source: video },
        },
      },
    });
    const shader = readShaderMaterial(target.material);
    const canvasTexture = shader.uniforms.canvasMap?.value as Texture;
    const imageTexture = shader.uniforms.imageMap?.value as Texture;
    const videoTexture = shader.uniforms.videoMap?.value as Texture;
    const sourceDispose = vi.spyOn(sourceTexture, "dispose");
    const canvasDispose = vi.spyOn(canvasTexture, "dispose");
    const imageDispose = vi.spyOn(imageTexture, "dispose");
    const videoDispose = vi.spyOn(videoTexture, "dispose");

    expect(shader.uniforms.sourceMap?.value).toBe(sourceTexture);
    expect(canvasTexture.version).toBeGreaterThan(0);
    expect(imageTexture.version).toBeGreaterThan(0);
    expect(videoTexture.version).toBeGreaterThan(0);

    layer.dispose();

    expect(sourceDispose).not.toHaveBeenCalled();
    expect(canvasDispose).toHaveBeenCalledTimes(1);
    expect(imageDispose).toHaveBeenCalledTimes(1);
    expect(videoDispose).toHaveBeenCalledTimes(1);
  });

  test("setUniforms only replaces owned textures for updated uniforms", () => {
    const target = { material: new MeshBasicMaterial() };
    const firstCanvas = document.createElement("canvas");
    const secondCanvas = document.createElement("canvas");
    const replacementCanvas = document.createElement("canvas");
    const layer = createMaterialLayer({
      key: "test.layer",
      target,
      program: {
        fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
        uniforms: {
          firstMap: { kind: "canvas-texture", source: firstCanvas },
          secondMap: { kind: "canvas-texture", source: secondCanvas },
          amount: 0.25,
        },
      },
    });
    const shader = readShaderMaterial(target.material);
    const firstTexture = shader.uniforms.firstMap?.value as Texture;
    const secondTexture = shader.uniforms.secondMap?.value as Texture;
    const firstDispose = vi.spyOn(firstTexture, "dispose");
    const secondDispose = vi.spyOn(secondTexture, "dispose");

    layer.setUniforms({ amount: 0.5 });

    expect(firstDispose).not.toHaveBeenCalled();
    expect(secondDispose).not.toHaveBeenCalled();

    layer.setUniforms({
      firstMap: { kind: "canvas-texture", source: replacementCanvas },
    });
    const replacementTexture = shader.uniforms.firstMap?.value as Texture;
    const replacementDispose = vi.spyOn(replacementTexture, "dispose");

    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(secondDispose).not.toHaveBeenCalled();

    layer.dispose();

    expect(firstDispose).toHaveBeenCalledTimes(1);
    expect(secondDispose).toHaveBeenCalledTimes(1);
    expect(replacementDispose).toHaveBeenCalledTimes(1);
  });

  test("compiles controlled vec2 uniform arrays without exposing raw Three types", () => {
    const target = { material: new MeshBasicMaterial() };
    const layer = createMaterialLayer({
      key: "test.layer",
      target,
      program: {
        fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
        uniforms: {
          trail: [
            [0.1, 0.2],
            [0.3, 0.4],
          ],
        },
      },
    });
    const shader = readShaderMaterial(target.material);

    expect(shader.uniforms.trail?.value).toEqual([
      expect.objectContaining({ x: 0.1, y: 0.2 }),
      expect.objectContaining({ x: 0.3, y: 0.4 }),
    ]);

    layer.setUniforms({
      trail: [
        [0.5, 0.6],
        [0.7, 0.8],
      ],
    });

    expect(shader.uniforms.trail?.value).toEqual([
      expect.objectContaining({ x: 0.5, y: 0.6 }),
      expect.objectContaining({ x: 0.7, y: 0.8 }),
    ]);
  });

  test("rejects invalid uniform values deterministically", () => {
    const target = { material: new MeshBasicMaterial() };

    expect(() =>
      createMaterialLayer({
        key: "bad.layer",
        target,
        program: {
          fragmentShader: "void main(){ gl_FragColor = vec4(1.0); }",
          uniforms: createInvalidUniforms(),
        },
      }),
    ).toThrow(
      'WebGL material layer "bad.layer" received invalid uniform "invalid".',
    );
  });
});

function readShaderMaterial(material: unknown): ShaderMaterial {
  if (!(material instanceof ShaderMaterial)) {
    throw new Error("Expected ShaderMaterial.");
  }

  return material;
}

function createInvalidUniforms() {
  return {
    invalid: { nested: true },
  } as unknown as Record<string, WebGLEffectUniformValue>;
}
