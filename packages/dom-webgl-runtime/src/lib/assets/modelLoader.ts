import type { WebGLModelSourceDescriptor } from "../source/sourceDescriptor";
import type { WebGLModelLoaderDeclaration } from "../types";

type GLTFLoaderLike = {
  loadAsync(src: string): Promise<unknown>;
  setDRACOLoader?(loader: unknown): void;
};

type GLTFLoaderConstructor = new () => GLTFLoaderLike;

type DRACOLoaderLike = {
  setDecoderPath(path: string): DRACOLoaderLike;
  preload?(): void;
  dispose?(): void;
};

type DRACOLoaderConstructor = new () => DRACOLoaderLike;

export type ModelLoaderOptions = {
  runtimeLoader?: WebGLModelLoaderDeclaration;
};

export async function loadGLBModel(
  source: WebGLModelSourceDescriptor,
  options: ModelLoaderOptions = {},
): Promise<unknown> {
  const { GLTFLoader } = (await import(
    "three/addons/loaders/GLTFLoader.js"
  )) as { GLTFLoader: GLTFLoaderConstructor };
  const loader = new GLTFLoader();
  const loaderConfig = mergeModelLoaderConfig(
    options.runtimeLoader,
    source.loader,
  );
  const dracoConfig = loaderConfig.draco;

  if (!dracoConfig) {
    return loader.loadAsync(source.src);
  }

  const { DRACOLoader } = (await import(
    "three/addons/loaders/DRACOLoader.js"
  )) as { DRACOLoader: DRACOLoaderConstructor };
  const dracoLoader = new DRACOLoader().setDecoderPath(
    dracoConfig.decoderPath,
  );

  if (dracoConfig.preload) {
    dracoLoader.preload?.();
  }
  loader.setDRACOLoader?.(dracoLoader);

  try {
    return await loader.loadAsync(source.src);
  } finally {
    dracoLoader.dispose?.();
  }
}

export function mergeModelLoaderConfig(
  runtimeLoader: WebGLModelLoaderDeclaration | undefined,
  sourceLoader: WebGLModelLoaderDeclaration | undefined,
): WebGLModelLoaderDeclaration {
  const runtimeDraco = runtimeLoader?.draco;
  const sourceDraco = sourceLoader?.draco;
  const draco = sourceDraco
    ? runtimeDraco
      ? { ...runtimeDraco, ...sourceDraco }
      : { ...sourceDraco }
    : runtimeDraco
      ? { ...runtimeDraco }
      : undefined;

  return draco ? { draco } : {};
}
