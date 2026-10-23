import type {
  Camera,
  Material,
  Object3D,
  Scene,
  Texture,
} from "three";

/** The renderer calls warmup needs; `WebGLRenderer` satisfies it. */
export type WarmupRenderer = {
  compileAsync(root: Object3D, camera: Camera, scene: Scene): Promise<unknown>;
  initTexture(texture: Texture): void;
};

export type SectionWarmup = ReturnType<typeof createSectionWarmup>;

/** Frames between scans of the section for newly mounted materials. */
const rescanFrames = 15;
/** Texture uploads per frame, so warming does not create a long frame itself. */
const uploadsPerFrame = 2;

/**
 * Compiles a section's materials and uploads its textures before it is drawn.
 * Each material is compiled and each texture uploaded at most once.
 */
export function createSectionWarmup() {
  const compiled = new WeakSet<Material>();
  const uploaded = new WeakSet<Texture>();
  // Images decode off the main thread first; otherwise the upload decodes them.
  const decoded = new WeakSet<object>();
  const decoding = new WeakSet<object>();
  let pending: Texture[] = [];
  let compiling = false;
  let scanned = false;
  let sinceScan = rescanFrames;

  return {
    /** Advances one frame of work; true once everything found is prepared. */
    step(
      root: Object3D,
      renderer: WarmupRenderer,
      camera: Camera,
      scene: Scene,
    ) {
      sinceScan += 1;
      if (sinceScan >= rescanFrames && !compiling) {
        sinceScan = 0;
        scanned = true;
        const found = collectResources(root);
        const fresh = found.materials.filter((material) => !compiled.has(material));
        if (fresh.length > 0) {
          for (const material of fresh) compiled.add(material);
          compiling = true;
          // Lights come from the scene; materials only from this section.
          renderer
            .compileAsync(root, camera, scene)
            .catch(() => undefined)
            .finally(() => {
              compiling = false;
            });
        }
        pending = found.textures.filter((texture) => !uploaded.has(texture));
      }
      let uploads = 0;
      pending = pending.filter((texture) => {
        if (uploaded.has(texture) || !isUploadable(texture)) return false;
        const image: unknown = texture.image;
        if (needsDecode(image) && !decoded.has(image)) {
          if (!decoding.has(image)) {
            decoding.add(image);
            const settle = () => decoded.add(image);
            image.decode().then(settle, settle);
          }
          return true;
        }
        if (uploads >= uploadsPerFrame) return true;
        uploaded.add(texture);
        renderer.initTexture(texture);
        uploads += 1;
        return false;
      });
      return scanned && !compiling && pending.length === 0;
    },
  };
}

function collectResources(root: Object3D) {
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((object) => {
    if (!("material" in object)) return;
    const value: unknown = object.material;
    for (const material of Array.isArray(value) ? value : [value]) {
      if (!isMaterial(material)) continue;
      materials.add(material);
      collectTextures(material, textures);
    }
  });
  return { materials: [...materials], textures: [...textures] };
}

function collectTextures(material: Material, textures: Set<Texture>) {
  for (const value of Object.values(material)) {
    if (isTexture(value)) textures.add(value);
  }
  if (!("uniforms" in material)) return;
  const uniforms: unknown = material.uniforms;
  if (!uniforms || typeof uniforms !== "object") return;
  for (const uniform of Object.values(uniforms)) {
    const value: unknown =
      uniform && typeof uniform === "object" && "value" in uniform
        ? uniform.value
        : undefined;
    if (isTexture(value)) textures.add(value);
  }
}

// Video and render-target textures change every frame; their data is not ready
// to upload ahead of drawing, and an image still loading has nothing to upload.
function isUploadable(texture: Texture) {
  if ("isVideoTexture" in texture && texture.isVideoTexture) return false;
  if (texture.isRenderTargetTexture || texture.version === 0) return false;
  const image: unknown = texture.image;
  if (!image) return false;
  return !(typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement && !image.complete);
}

function needsDecode(image: unknown): image is HTMLImageElement {
  return typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement;
}

function isMaterial(value: unknown): value is Material {
  return typeof value === "object" && value !== null && "isMaterial" in value && value.isMaterial === true;
}

function isTexture(value: unknown): value is Texture {
  return typeof value === "object" && value !== null && "isTexture" in value && value.isTexture === true;
}
