import type { Material } from "three/src/materials/Material.js";
import { Color } from "three/src/math/Color.js";
import { Vector2 } from "three/src/math/Vector2.js";
import { Vector3 } from "three/src/math/Vector3.js";
import { Vector4 } from "three/src/math/Vector4.js";
import type { WebGLProgramParametersWithUniforms } from "three/src/renderers/webgl/WebGLPrograms.js";
import type { WebGLRenderer } from "three/src/renderers/WebGLRenderer.js";
import { CanvasTexture } from "three/src/textures/CanvasTexture.js";
import { Texture } from "three/src/textures/Texture.js";
import { VideoTexture } from "three/src/textures/VideoTexture.js";

import type {
  WebGLEffectTextureUniform,
  WebGLEffectUniformValue,
} from "../../effects/effectAuthoring";
import type {
  WebGLEffectMaterialKind,
  WebGLEffectMaterialShaderDefinition,
  WebGLEffectMaterialShaderDraft,
  WebGLEffectMaterialShaderFacade,
} from "../../effects/effectMaterial";

import {
  createTextureUploadState,
  type TextureUploadState,
} from "./textureUploadState";

export type ManagedMaterialShaderRenderer = {
  getSize(target: Vector2): Vector2;
  getPixelRatio(): number;
};

export type ManagedMaterialShaderHost = {
  readonly facade: WebGLEffectMaterialShaderFacade;
  beforeRender(renderer: ManagedMaterialShaderRenderer): void;
  dispose(): void;
};

type ManagedMaterialShaderHostOptions = {
  readonly objectId: string;
  readonly materialKind: WebGLEffectMaterialKind;
  readonly material: Material;
};

type ThreeUniform = { value: unknown };

type ShaderExtensionEntry = {
  readonly definition: WebGLEffectMaterialShaderDefinition;
  readonly uniforms: Map<string, ManagedUniformEntry>;
};

type ManagedUniformEntry = {
  publicValue: WebGLEffectUniformValue;
  normalizedValue: unknown;
  ownedTexture?: OwnedTextureResource;
  readonly compiledUniforms: Set<ThreeUniform>;
};

type OwnedTextureResource = {
  readonly texture: Texture;
  readonly upload: TextureUploadState;
  readonly cacheKey: string;
};

type MaterialHookState<T> = {
  readonly own: boolean;
  readonly value: T;
};

const viewportUniformName = "domWebGLViewportSize";
const pixelRatioUniformName = "domWebGLPixelRatio";

let nextDefinitionId = 0;
const definitionIds = new WeakMap<WebGLEffectMaterialShaderDefinition, number>();
let nextTextureUniformSourceId = 0;
const textureUniformSourceIds = new WeakMap<object, number>();

export function createManagedMaterialShaderHost(
  options: ManagedMaterialShaderHostOptions,
): ManagedMaterialShaderHost {
  const entries = new Map<string, ShaderExtensionEntry>();
  const baseOnBeforeCompile = options.material.onBeforeCompile;
  const baseCustomProgramCacheKey = options.material.customProgramCacheKey;
  const baseProgramCacheKey = Reflect.apply(
    baseCustomProgramCacheKey,
    options.material,
    [],
  );
  const onBeforeCompileState = {
    own: Object.hasOwn(options.material, "onBeforeCompile"),
    value: baseOnBeforeCompile,
  } satisfies MaterialHookState<Material["onBeforeCompile"]>;
  const customProgramCacheKeyState = {
    own: Object.hasOwn(options.material, "customProgramCacheKey"),
    value: baseCustomProgramCacheKey,
  } satisfies MaterialHookState<Material["customProgramCacheKey"]>;
  const viewportSize = new Vector2(1, 1);
  const compiledViewportUniforms = new Set<ThreeUniform>();
  const compiledPixelRatioUniforms = new Set<ThreeUniform>();
  let disposed = false;

  options.material.onBeforeCompile = managedOnBeforeCompile;
  options.material.customProgramCacheKey = managedCustomProgramCacheKey;

  const facade: WebGLEffectMaterialShaderFacade = {
    onBeforeCompile(definition) {
      if (disposed) {
        return;
      }

      const key = readNonEmptyKey(options, definition.key);
      const existing = entries.get(key);
      if (existing?.definition === definition) {
        return;
      }
      if (existing) {
        throw new Error(
          `${extensionContext(options, key)} is already registered with a different definition.`,
        );
      }

      entries.set(key, createEntry(options, key, definition));
      options.material.needsUpdate = true;
    },
    setUniforms(key, values) {
      if (disposed) {
        return;
      }

      const normalizedKey = readNonEmptyKey(options, key);
      const entry = entries.get(normalizedKey);
      if (!entry) {
        throw new Error(
          `${extensionContext(options, normalizedKey)} is not registered.`,
        );
      }

      for (const [name, value] of Object.entries(values)) {
        const uniform = entry.uniforms.get(name);
        if (!uniform) {
          throw new Error(
            `${extensionContext(options, normalizedKey)} does not declare uniform "${name}".`,
          );
        }
        updateManagedUniform(options, normalizedKey, name, uniform, value);
      }
    },
    remove(key) {
      if (disposed) {
        return;
      }

      const normalizedKey = readNonEmptyKey(options, key);
      const entry = entries.get(normalizedKey);
      if (!entry) {
        return;
      }
      entries.delete(normalizedKey);
      disposeEntry(entry);
      options.material.needsUpdate = true;
    },
  };

  return {
    facade,
    beforeRender(renderer) {
      if (disposed) {
        return;
      }

      renderer.getSize(viewportSize);
      viewportSize.set(
        readPositiveFinite(viewportSize.x),
        readPositiveFinite(viewportSize.y),
      );
      const pixelRatio = readPositiveFinite(renderer.getPixelRatio());
      for (const uniform of compiledViewportUniforms) {
        uniform.value = viewportSize;
      }
      for (const uniform of compiledPixelRatioUniforms) {
        uniform.value = pixelRatio;
      }
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const entry of entries.values()) {
        disposeEntry(entry);
      }
      entries.clear();
      restoreOnBeforeCompile(
        options.material,
        onBeforeCompileState,
      );
      restoreCustomProgramCacheKey(
        options.material,
        customProgramCacheKeyState,
      );
      compiledViewportUniforms.clear();
      compiledPixelRatioUniforms.clear();
    },
  };

  function managedOnBeforeCompile(
    parameters: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ): void {
    Reflect.apply(baseOnBeforeCompile, options.material, [parameters, renderer]);
    if (entries.size === 0) {
      return;
    }

    let vertexShader = parameters.vertexShader;
    let fragmentShader = parameters.fragmentShader;
    let defines = readControlledDefines(parameters.defines);

    for (const [key, entry] of entries) {
      const draftUniforms = Object.fromEntries(
        [...entry.uniforms].map(([name, uniform]) => [
          name,
          clonePublicUniformValue(uniform.publicValue),
        ]),
      );
      const draft = {
        materialKind: options.materialKind,
        vertexShader,
        fragmentShader,
        uniforms: draftUniforms,
        defines: mergeExtensionDefines(
          options,
          key,
          defines,
          entry.definition.defines,
        ),
      } satisfies WebGLEffectMaterialShaderDraft;

      try {
        entry.definition.compile(draft);
      } catch (error) {
        throw new Error(`${extensionContext(options, key)} failed.`, {
          cause: error,
        });
      }

      if (
        typeof draft.vertexShader !== "string" ||
        typeof draft.fragmentShader !== "string"
      ) {
        throw new Error(
          `${extensionContext(options, key)} must return string shader sources.`,
        );
      }

      vertexShader = draft.vertexShader;
      fragmentShader = draft.fragmentShader;
      defines = mergeExtensionDefines(options, key, defines, draft.defines);

      for (const [name, value] of Object.entries(draft.uniforms)) {
        let uniform = entry.uniforms.get(name);
        if (!uniform) {
          uniform = createManagedUniform(options, key, name, value);
          entry.uniforms.set(name, uniform);
        } else {
          updateManagedUniform(options, key, name, uniform, value);
        }

        const compiledUniform = { value: uniform.normalizedValue };
        uniform.compiledUniforms.add(compiledUniform);
        parameters.uniforms[name] = compiledUniform;
      }
    }

    parameters.vertexShader = vertexShader;
    parameters.fragmentShader = injectRuntimeUniformDeclarations(fragmentShader);
    parameters.defines = defines;
    const viewportUniform = { value: viewportSize };
    const pixelRatioUniform = { value: 1 };
    compiledViewportUniforms.add(viewportUniform);
    compiledPixelRatioUniforms.add(pixelRatioUniform);
    parameters.uniforms[viewportUniformName] = viewportUniform;
    parameters.uniforms[pixelRatioUniformName] = pixelRatioUniform;
  }

  function managedCustomProgramCacheKey(): string {
    if (entries.size === 0) {
      return baseProgramCacheKey;
    }
    const extensionKey = [...entries]
      .map(([key, entry]) => `${key}:${readDefinitionId(entry.definition)}`)
      .join("|");
    return `${baseProgramCacheKey}|dom-webgl:${options.materialKind}:${extensionKey}`;
  }
}

function createEntry(
  options: ManagedMaterialShaderHostOptions,
  key: string,
  definition: WebGLEffectMaterialShaderDefinition,
): ShaderExtensionEntry {
  const uniforms = new Map<string, ManagedUniformEntry>();
  for (const [name, value] of Object.entries(definition.uniforms ?? {})) {
    uniforms.set(name, createManagedUniform(options, key, name, value));
  }

  readControlledDefines(definition.defines);
  return { definition, uniforms };
}

function createManagedUniform(
  options: ManagedMaterialShaderHostOptions,
  key: string,
  name: string,
  value: WebGLEffectUniformValue,
): ManagedUniformEntry {
  assertUniformNameAvailable(options, key, name);
  const normalized = normalizeUniformValue(options, key, name, value);
  return {
    publicValue: clonePublicUniformValue(value),
    normalizedValue: normalized.value,
    ...(normalized.ownedTexture
      ? { ownedTexture: normalized.ownedTexture }
      : {}),
    compiledUniforms: new Set(),
  };
}

function updateManagedUniform(
  options: ManagedMaterialShaderHostOptions,
  key: string,
  name: string,
  uniform: ManagedUniformEntry,
  value: WebGLEffectUniformValue,
): void {
  const publicValue = clonePublicUniformValue(value);
  const textureCacheKey = readTextureUniformCacheKey(value);
  if (
    textureCacheKey &&
    uniform.ownedTexture?.cacheKey === textureCacheKey
  ) {
    uniform.publicValue = publicValue;
    uniform.ownedTexture.upload.markUploadDirty("material-uniform");
    return;
  }

  const normalized = normalizeUniformValue(options, key, name, value);
  const normalizedValue = normalized.value;
  disposeOwnedTexture(uniform.ownedTexture);
  if (normalized.ownedTexture) {
    uniform.ownedTexture = normalized.ownedTexture;
  } else {
    delete uniform.ownedTexture;
  }
  uniform.publicValue = publicValue;

  if (updateNormalizedValueInPlace(uniform.normalizedValue, normalizedValue)) {
    for (const compiled of uniform.compiledUniforms) {
      compiled.value = uniform.normalizedValue;
    }
    return;
  }

  uniform.normalizedValue = normalizedValue;
  for (const compiled of uniform.compiledUniforms) {
    compiled.value = normalizedValue;
  }
}

function normalizeUniformValue(
  options: ManagedMaterialShaderHostOptions,
  key: string,
  name: string,
  value: WebGLEffectUniformValue,
): { value: unknown; ownedTexture?: OwnedTextureResource } {
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return { value };
    }
    return throwInvalidUniform(options, key, name);
  }
  if (typeof value === "boolean") {
    return { value };
  }
  if (typeof value === "string") {
    return { value: new Color(value) };
  }
  if (Array.isArray(value)) {
    if (value.every(isVec2Tuple)) {
      return { value: value.map((tuple) => new Vector2(tuple[0], tuple[1])) };
    }
    if (value.length === 2 && value.every(isFiniteNumber)) {
      return { value: new Vector2(value[0], value[1]) };
    }
    if (value.length === 3 && value.every(isFiniteNumber)) {
      return { value: new Vector3(value[0], value[1], value[2]) };
    }
    if (value.length === 4 && value.every(isFiniteNumber)) {
      return { value: new Vector4(value[0], value[1], value[2], value[3]) };
    }
  }

  if (isTextureUniform(value)) {
    const ownedTexture = createOwnedTexture(options, key, name, value);
    return { value: ownedTexture.texture, ownedTexture };
  }

  return throwInvalidUniform(options, key, name);
}

function updateNormalizedValueInPlace(current: unknown, next: unknown): boolean {
  if (current instanceof Color && next instanceof Color) {
    current.copy(next);
    return true;
  }
  if (current instanceof Vector2 && next instanceof Vector2) {
    current.copy(next);
    return true;
  }
  if (current instanceof Vector3 && next instanceof Vector3) {
    current.copy(next);
    return true;
  }
  if (current instanceof Vector4 && next instanceof Vector4) {
    current.copy(next);
    return true;
  }
  if (isVector2Array(current) && isVector2Array(next)) {
    if (current.length !== next.length) {
      return false;
    }
    for (let index = 0; index < current.length; index += 1) {
      current[index].copy(next[index]);
    }
    return true;
  }
  return false;
}

function createOwnedTexture(
  options: ManagedMaterialShaderHostOptions,
  key: string,
  name: string,
  value: WebGLEffectTextureUniform,
): OwnedTextureResource {
  let texture: Texture;
  switch (value.kind) {
    case "source-texture":
      throw new Error(
        `${extensionContext(options, key)} cannot bind source texture uniform "${name}" because no source texture is available.`,
      );
    case "canvas-texture":
      texture = new CanvasTexture(value.source);
      break;
    case "image-texture":
      texture = new Texture(value.source);
      break;
    case "video-texture":
      texture = new VideoTexture(value.source);
      break;
  }

  const upload = createTextureUploadState({
    key: `${options.objectId}.${key}.${name}`,
    texture,
    source: "source" in value ? value.source : undefined,
  });
  upload.markUploadDirty("material-uniform");
  return {
    texture,
    upload,
    cacheKey: readTextureUniformCacheKey(value) ?? "",
  };
}

function disposeEntry(entry: ShaderExtensionEntry): void {
  for (const uniform of entry.uniforms.values()) {
    disposeOwnedTexture(uniform.ownedTexture);
    uniform.compiledUniforms.clear();
  }
  entry.uniforms.clear();
}

function disposeOwnedTexture(resource: OwnedTextureResource | undefined): void {
  if (!resource) {
    return;
  }
  resource.upload.dispose();
  resource.texture.dispose();
}

function readTextureUniformCacheKey(
  value: WebGLEffectUniformValue,
): string | undefined {
  if (!isTextureUniform(value)) {
    return undefined;
  }
  switch (value.kind) {
    case "source-texture":
      return "source-texture";
    case "canvas-texture":
    case "image-texture":
    case "video-texture":
      return `${value.kind}:${readTextureUniformSourceId(value.source)}`;
  }
}

function readTextureUniformSourceId(source: object): number {
  const existing = textureUniformSourceIds.get(source);
  if (existing !== undefined) {
    return existing;
  }
  nextTextureUniformSourceId += 1;
  textureUniformSourceIds.set(source, nextTextureUniformSourceId);
  return nextTextureUniformSourceId;
}

function clonePublicUniformValue(
  value: WebGLEffectUniformValue,
): WebGLEffectUniformValue {
  if (!Array.isArray(value)) {
    return value;
  }
  if (value.every(isVec2Tuple)) {
    return value.map((tuple) => [tuple[0], tuple[1]] as const);
  }
  switch (value.length) {
    case 2:
      return [value[0], value[1]];
    case 3:
      return [value[0], value[1], value[2]];
    case 4:
      return [value[0], value[1], value[2], value[3]];
  }
  return value;
}

function readControlledDefines(
  defines: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> {
  const controlled: Record<string, string | number | boolean> = {};
  for (const [name, value] of Object.entries(defines ?? {})) {
    if (
      typeof value !== "string" &&
      typeof value !== "boolean" &&
      (typeof value !== "number" || !Number.isFinite(value))
    ) {
      throw new Error(`WebGL material shader define "${name}" is invalid.`);
    }
    controlled[name] = value;
  }
  return controlled;
}

function mergeExtensionDefines(
  options: ManagedMaterialShaderHostOptions,
  key: string,
  current: Record<string, string | number | boolean>,
  extension: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> {
  const next = { ...current };
  const controlledExtension = readControlledDefines(extension);
  for (const [name, value] of Object.entries(controlledExtension)) {
    const existing = current[name];
    if (existing !== undefined && existing !== value) {
      throw new Error(
        `${extensionContext(options, key)} conflicts on define "${name}".`,
      );
    }
    next[name] = value;
  }
  return next;
}

function injectRuntimeUniformDeclarations(fragmentShader: string): string {
  let declarations = "";
  if (!fragmentShader.includes(`uniform vec2 ${viewportUniformName};`)) {
    declarations += `uniform vec2 ${viewportUniformName};\n`;
  }
  if (!fragmentShader.includes(`uniform float ${pixelRatioUniformName};`)) {
    declarations += `uniform float ${pixelRatioUniformName};\n`;
  }
  return `${declarations}${fragmentShader}`;
}

function assertUniformNameAvailable(
  options: ManagedMaterialShaderHostOptions,
  key: string,
  name: string,
): void {
  if (name === viewportUniformName || name === pixelRatioUniformName) {
    throw new Error(
      `${extensionContext(options, key)} cannot declare reserved uniform "${name}".`,
    );
  }
}

function readNonEmptyKey(
  options: ManagedMaterialShaderHostOptions,
  key: string,
): string {
  const normalized = key.trim();
  if (!normalized) {
    throw new Error(
      `WebGL mesh "${options.objectId}" ${options.materialKind} material shader requires a non-empty extension key.`,
    );
  }
  return normalized;
}

function readDefinitionId(
  definition: WebGLEffectMaterialShaderDefinition,
): number {
  const existing = definitionIds.get(definition);
  if (existing !== undefined) {
    return existing;
  }
  nextDefinitionId += 1;
  definitionIds.set(definition, nextDefinitionId);
  return nextDefinitionId;
}

function extensionContext(
  options: ManagedMaterialShaderHostOptions,
  key: string,
): string {
  return `WebGL mesh "${options.objectId}" ${options.materialKind} material shader extension "${key}"`;
}

function throwInvalidUniform(
  options: ManagedMaterialShaderHostOptions,
  key: string,
  name: string,
): never {
  throw new Error(
    `${extensionContext(options, key)} received invalid uniform "${name}".`,
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

function isVector2Array(value: unknown): value is Vector2[] {
  return Array.isArray(value) && value.every((entry) => entry instanceof Vector2);
}

function isTextureUniform(value: unknown): value is WebGLEffectTextureUniform {
  if (!value || typeof value !== "object" || !("kind" in value)) {
    return false;
  }
  const kind = value.kind;
  return (
    kind === "source-texture" ||
    kind === "canvas-texture" ||
    kind === "image-texture" ||
    kind === "video-texture"
  );
}

function readPositiveFinite(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function restoreOnBeforeCompile(
  material: Material,
  state: MaterialHookState<Material["onBeforeCompile"]>,
): void {
  if (state.own) {
    material.onBeforeCompile = state.value;
    return;
  }
  Reflect.deleteProperty(material, "onBeforeCompile");
}

function restoreCustomProgramCacheKey(
  material: Material,
  state: MaterialHookState<Material["customProgramCacheKey"]>,
): void {
  if (state.own) {
    material.customProgramCacheKey = state.value;
    return;
  }
  Reflect.deleteProperty(material, "customProgramCacheKey");
}
