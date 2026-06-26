import {
  AdditiveBlending,
  CustomBlending,
  MultiplyBlending,
  NormalBlending,
  OneMinusSrcColorFactor,
  SrcAlphaFactor,
} from "three/src/constants.js";
import type { Material } from "three/src/materials/Material.js";
import {
  ShaderMaterial,
  type ShaderMaterialParameters,
} from "three/src/materials/ShaderMaterial.js";
import { Vector2 } from "three/src/math/Vector2.js";
import { Vector3 } from "three/src/math/Vector3.js";
import { Vector4 } from "three/src/math/Vector4.js";
import { CanvasTexture } from "three/src/textures/CanvasTexture.js";
import { Texture } from "three/src/textures/Texture.js";
import { VideoTexture } from "three/src/textures/VideoTexture.js";

import type {
  WebGLEffectBlendMode,
  WebGLEffectMaterialLayerHandle,
  WebGLEffectMaterialProgram,
  WebGLEffectTextureUniform,
  WebGLEffectUniformValue,
} from "../../effects/effectAuthoring";

export type MaterialLayerTarget = {
  material: unknown;
};

export type MaterialLayerOptions = {
  key: string;
  target: MaterialLayerTarget;
  program: WebGLEffectMaterialProgram;
  sourceTexture?: Texture;
  sourceTextureUniform?: string;
  mode?: "replace-source" | "overlay";
};

export function createMaterialLayer(
  options: MaterialLayerOptions,
): WebGLEffectMaterialLayerHandle {
  const originalMaterial = options.target.material;
  let disposed = false;
  let activeMaterial: ShaderMaterial | undefined;
  const ownedTexturesByUniform = new Map<string, Texture[]>();
  let currentProgram = options.program;

  applyProgram(currentProgram);

  return {
    setProgram(program) {
      if (disposed) {
        return;
      }

      currentProgram = program;
      applyProgram(program);
    },
    setUniforms(uniforms) {
      if (disposed || !activeMaterial) {
        return;
      }

      for (const [name, value] of Object.entries(uniforms)) {
        const nextOwnedTextures: Texture[] = [];
        activeMaterial.uniforms[name] = {
          value: compileUniformValue(options.key, name, value, {
            sourceTexture: options.sourceTexture,
            ownedTextures: nextOwnedTextures,
          }),
        };
        replaceOwnedTextures(name, nextOwnedTextures);
      }

      activeMaterial.needsUpdate = true;
    },
    clear() {
      if (disposed) {
        return;
      }

      restoreOriginalMaterial();
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      restoreOriginalMaterial();
    },
  };

  function applyProgram(program: WebGLEffectMaterialProgram): void {
    restoreOriginalMaterial();
    activeMaterial = compileShaderMaterial(options, program, currentProgram);
    options.target.material = activeMaterial;
  }

  function restoreOriginalMaterial(): void {
    if (activeMaterial) {
      activeMaterial.dispose();
      activeMaterial = undefined;
    }

    disposeOwnedTextures();
    options.target.material = originalMaterial;
  }

  function compileShaderMaterial(
    layerOptions: MaterialLayerOptions,
    program: WebGLEffectMaterialProgram,
    fallbackProgram: WebGLEffectMaterialProgram,
  ): ShaderMaterial {
    const uniforms = compileUniforms(layerOptions, program, replaceOwnedTextures);

    const parameters: ShaderMaterialParameters = {
      vertexShader: program.vertexShader ?? defaultVertexShader,
      fragmentShader: program.fragmentShader,
      uniforms,
      blending: mapBlendMode(program.blend),
      transparent: program.transparent ?? fallbackProgram.transparent ?? true,
      depthWrite: program.depthWrite ?? fallbackProgram.depthWrite ?? true,
      depthTest: program.depthTest ?? fallbackProgram.depthTest ?? true,
      toneMapped: program.toneMapped ?? fallbackProgram.toneMapped ?? true,
    };

    if (program.defines) {
      parameters.defines = program.defines;
    }

    if (program.blend === "screen") {
      parameters.blendSrc = SrcAlphaFactor;
      parameters.blendDst = OneMinusSrcColorFactor;
    }

    return new ShaderMaterial(parameters);
  }

  function replaceOwnedTextures(name: string, textures: Texture[]): void {
    disposeTextures(ownedTexturesByUniform.get(name) ?? []);
    if (textures.length > 0) {
      ownedTexturesByUniform.set(name, textures);
      return;
    }

    ownedTexturesByUniform.delete(name);
  }

  function disposeOwnedTextures(): void {
    for (const textures of ownedTexturesByUniform.values()) {
      disposeTextures(textures);
    }
    ownedTexturesByUniform.clear();
  }
}

function compileUniforms(
  options: MaterialLayerOptions,
  program: WebGLEffectMaterialProgram,
  replaceOwnedTextures: (name: string, textures: Texture[]) => void,
): Record<string, { value: unknown }> {
  const uniforms: Record<string, { value: unknown }> = {};

  for (const [name, value] of Object.entries(program.uniforms ?? {})) {
    const ownedTextures: Texture[] = [];
    uniforms[name] = {
      value: compileUniformValue(options.key, name, value, {
        sourceTexture: options.sourceTexture,
        ownedTextures,
      }),
    };
    replaceOwnedTextures(name, ownedTextures);
  }

  if (options.sourceTextureUniform && !uniforms[options.sourceTextureUniform]) {
    uniforms[options.sourceTextureUniform] = {
      value: readSourceTexture(options.key, options.sourceTextureUniform, {
        sourceTexture: options.sourceTexture,
      }),
    };
  }

  return uniforms;
}

function compileUniformValue(
  key: string,
  name: string,
  value: WebGLEffectUniformValue,
  resources: {
    sourceTexture?: Texture;
    ownedTextures: Texture[];
  },
): unknown {
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.every(isVec2Tuple)) {
      return value.map((tuple) => new Vector2(tuple[0], tuple[1]));
    }

    if (value.length === 2 && value.every(isFiniteNumber)) {
      return new Vector2(value[0], value[1]);
    }

    if (value.length === 3 && value.every(isFiniteNumber)) {
      return new Vector3(value[0], value[1], value[2]);
    }

    if (value.length === 4 && value.every(isFiniteNumber)) {
      return new Vector4(value[0], value[1], value[2], value[3]);
    }
  }

  if (isTextureUniform(value)) {
    return compileTextureUniform(key, name, value, resources);
  }

  throwInvalidUniform(key, name);
}

function compileTextureUniform(
  key: string,
  name: string,
  value: WebGLEffectTextureUniform,
  resources: {
    sourceTexture?: Texture;
    ownedTextures: Texture[];
  },
): Texture {
  switch (value.kind) {
    case "source-texture":
      return readSourceTexture(key, name, resources);
    case "canvas-texture": {
      const texture = new CanvasTexture(value.source);
      resources.ownedTextures.push(texture);
      return texture;
    }
    case "image-texture": {
      const texture = new Texture(value.source);
      texture.needsUpdate = true;
      resources.ownedTextures.push(texture);
      return texture;
    }
    case "video-texture": {
      const texture = new VideoTexture(value.source);
      resources.ownedTextures.push(texture);
      return texture;
    }
  }
}

function readSourceTexture(
  key: string,
  name: string,
  resources: { sourceTexture?: Texture },
): Texture {
  if (resources.sourceTexture) {
    return resources.sourceTexture;
  }

  throw new Error(
    `WebGL material layer "${key}" cannot bind source texture uniform "${name}" because no source texture is available.`,
  );
}

function mapBlendMode(blend: WebGLEffectBlendMode | undefined): Material["blending"] {
  switch (blend) {
    case undefined:
    case "normal":
      return NormalBlending;
    case "additive":
      return AdditiveBlending;
    case "multiply":
      return MultiplyBlending;
    case "screen":
      return CustomBlending;
  }
}

function disposeTextures(textures: readonly Texture[]): void {
  for (const texture of textures) {
    texture.dispose();
  }
}

function isTextureUniform(value: unknown): value is WebGLEffectTextureUniform {
  return Boolean(
    value &&
      typeof value === "object" &&
      "kind" in value &&
      ((value as { kind?: unknown }).kind === "source-texture" ||
        (value as { kind?: unknown }).kind === "canvas-texture" ||
        (value as { kind?: unknown }).kind === "image-texture" ||
        (value as { kind?: unknown }).kind === "video-texture"),
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isVec2Tuple(value: unknown): value is readonly [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(isFiniteNumber)
  );
}

function throwInvalidUniform(key: string, name: string): never {
  throw new Error(
    `WebGL material layer "${key}" received invalid uniform "${name}".`,
  );
}

const defaultVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
