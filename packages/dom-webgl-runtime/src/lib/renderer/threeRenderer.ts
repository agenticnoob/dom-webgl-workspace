import { OrthographicCamera } from "three/src/cameras/OrthographicCamera.js";
import { WebGLRenderer } from "three/src/renderers/WebGLRenderer.js";
import { Scene } from "three/src/scenes/Scene.js";
import type { WebGLSceneAdapter, WebGLSceneObject } from "./sceneObject";

export type ThreeRendererAdapter = {
  readonly canvas: HTMLCanvasElement;
  setSize?(width: number, height: number, updateStyle?: boolean): void;
  render?(scene: object, camera: object): void;
  dispose(): void;
};

export type ThreeRendererObjects = {
  readonly renderer: ThreeRendererAdapter;
  readonly scene: object;
  readonly camera: object;
  readonly sceneAdapter?: WebGLSceneAdapter;
};

export type ThreeRendererObjectsFactory = (
  canvas: HTMLCanvasElement,
) => ThreeRendererObjects;

export type ThreeRendererHostOptions = {
  createObjects?: ThreeRendererObjectsFactory;
};

export type ThreeRendererHost = {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: ThreeRendererAdapter;
  readonly scene: object;
  readonly camera: object;
  readonly sceneAdapter: WebGLSceneAdapter;
  dispose(): void;
};

export function createThreeRendererHost(
  container: HTMLElement,
  options: ThreeRendererHostOptions = {},
): ThreeRendererHost {
  const canvas = container.ownerDocument.createElement("canvas");
  const objects = (options.createObjects ?? createDefaultThreeRendererObjects)(
    canvas,
  );
  let disposed = false;

  container.appendChild(canvas);
  configureCSSPixelViewport(container, objects.renderer, objects.camera);

  return {
    canvas,
    renderer: objects.renderer,
    scene: objects.scene,
    camera: objects.camera,
    sceneAdapter:
      objects.sceneAdapter ??
      createThreeSceneAdapter(objects.scene, objects.camera, objects.renderer),
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      objects.renderer.dispose();
      canvas.remove();
    },
  };
}

function createDefaultThreeRendererObjects(
  canvas: HTMLCanvasElement,
): ThreeRendererObjects {
  const renderer = new WebGLRenderer({
    antialias: true,
    canvas,
  });

  return {
    camera: new OrthographicCamera(0, 800, 600, 0, 0.1, 1000),
    renderer: {
      canvas,
      setSize(width, height, updateStyle) {
        readRendererSetSize(renderer)?.(width, height, updateStyle);
      },
      render(scene, camera) {
        readRendererRender(renderer)?.(scene, camera);
      },
      dispose() {
        renderer.dispose();
      },
    },
    scene: new Scene(),
  };
}

function configureCSSPixelViewport(
  container: HTMLElement,
  renderer: ThreeRendererAdapter,
  camera: object,
): void {
  const width = container.clientWidth || window.innerWidth || 800;
  const height = container.clientHeight || window.innerHeight || 600;

  renderer.setSize?.(width, height, false);
  configureOrthographicCamera(camera, width, height);
}

function configureOrthographicCamera(
  camera: object,
  width: number,
  height: number,
): void {
  Object.assign(camera, {
    left: 0,
    right: width,
    top: height,
    bottom: 0,
  });

  const position = (camera as { position?: { set?: unknown } }).position;

  if (position && typeof position.set === "function") {
    position.set(0, 0, 500);
  }

  const updateProjectionMatrix = (camera as {
    updateProjectionMatrix?: unknown;
  }).updateProjectionMatrix;

  if (typeof updateProjectionMatrix === "function") {
    updateProjectionMatrix.call(camera);
  }
}

function createThreeSceneAdapter(
  scene: object,
  camera: object,
  renderer: ThreeRendererAdapter,
): WebGLSceneAdapter {
  const attached = new Set<WebGLSceneObject>();

  return {
    addObject(object): void {
      if (attached.has(object)) {
        return;
      }

      readSceneMethod(scene, "add")?.(object.object3D ?? object);
      attached.add(object);
    },
    removeObject(object): void {
      if (!attached.has(object)) {
        return;
      }

      readSceneMethod(scene, "remove")?.(object.object3D ?? object);
      attached.delete(object);
    },
    render(): void {
      renderer.render?.(scene, camera);
    },
  };
}

function readSceneMethod(
  scene: object,
  methodName: "add" | "remove",
): ((object: unknown) => void) | undefined {
  const method = (scene as Record<string, unknown>)[methodName];

  if (typeof method !== "function") {
    return undefined;
  }

  return method.bind(scene) as (object: unknown) => void;
}

function readRendererRender(
  renderer: object,
): ((scene: object, camera: object) => void) | undefined {
  const render = (renderer as Record<string, unknown>).render;

  if (typeof render !== "function") {
    return undefined;
  }

  return render.bind(renderer) as (scene: object, camera: object) => void;
}

function readRendererSetSize(
  renderer: object,
): ((width: number, height: number, updateStyle?: boolean) => void) | undefined {
  const setSize = (renderer as Record<string, unknown>).setSize;

  if (typeof setSize !== "function") {
    return undefined;
  }

  return setSize.bind(renderer) as (
    width: number,
    height: number,
    updateStyle?: boolean,
  ) => void;
}
