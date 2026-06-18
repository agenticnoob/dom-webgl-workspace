import { OrthographicCamera } from "three/src/cameras/OrthographicCamera.js";
import { WebGLRenderer } from "three/src/renderers/WebGLRenderer.js";
import { Scene } from "three/src/scenes/Scene.js";
import { capDevicePixelRatio } from "./layoutPass";
import type { WebGLSceneAdapter, WebGLSceneObject } from "./sceneObject";
import type { DOMViewportSize } from "./domProjection";

export type ThreeRendererAdapter = {
  readonly canvas: HTMLCanvasElement;
  setAnimationLoop?(callback: ((time: number) => void) | null): void;
  setPixelRatio?(ratio: number): void;
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
  getViewportSize(): DOMViewportSize;
  resizeIfNeeded(): void;
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
  let viewport = configureCSSPixelViewport(
    container,
    objects.renderer,
    objects.camera,
  );

  configureCanvasStage(container, canvas);
  container.appendChild(canvas);

  return {
    canvas,
    renderer: objects.renderer,
    scene: objects.scene,
    camera: objects.camera,
    sceneAdapter:
      objects.sceneAdapter ??
      createThreeSceneAdapter(objects.scene, objects.camera, objects.renderer),
    getViewportSize(): DOMViewportSize {
      return { width: viewport.width, height: viewport.height };
    },
    resizeIfNeeded(): void {
      const nextViewport = readCSSPixelViewport(container);

      if (
        viewport.width === nextViewport.width &&
        viewport.height === nextViewport.height &&
        viewport.devicePixelRatio === nextViewport.devicePixelRatio
      ) {
        return;
      }

      applyCSSPixelViewport(objects.renderer, objects.camera, nextViewport);
      viewport = nextViewport;
    },
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
    antialias: false,
    alpha: true,
    powerPreference: "high-performance",
    canvas,
  });

  return {
    camera: new OrthographicCamera(0, 800, 600, 0, 0.1, 1000),
    renderer: {
      canvas,
      setSize(width, height, updateStyle) {
        readRendererSetSize(renderer)?.(width, height, updateStyle);
      },
      setPixelRatio(ratio) {
        readRendererSetPixelRatio(renderer)?.(ratio);
      },
      setAnimationLoop(callback) {
        readRendererSetAnimationLoop(renderer)?.(callback);
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
): DOMViewportState {
  const viewport = readCSSPixelViewport(container);

  applyCSSPixelViewport(renderer, camera, viewport);

  return viewport;
}

type DOMViewportState = DOMViewportSize & {
  devicePixelRatio: number;
};

function readCSSPixelViewport(container: HTMLElement): DOMViewportState {
  const visualViewport = window.visualViewport;

  return {
    width: visualViewport?.width || window.innerWidth || container.clientWidth || 800,
    height:
      visualViewport?.height || window.innerHeight || container.clientHeight || 600,
    devicePixelRatio: capDevicePixelRatio(window.devicePixelRatio || 1),
  };
}

function applyCSSPixelViewport(
  renderer: ThreeRendererAdapter,
  camera: object,
  viewport: DOMViewportState,
): void {
  renderer.setPixelRatio?.(viewport.devicePixelRatio);
  renderer.setSize?.(viewport.width, viewport.height, false);
  configureOrthographicCamera(camera, viewport.width, viewport.height);
}

function configureCanvasStage(
  container: HTMLElement,
  canvas: HTMLCanvasElement,
): void {
  if (!container.style.position) {
    container.style.position = "relative";
  }

  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0px",
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    display: "block",
    zIndex: "0",
  });
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

function readRendererSetPixelRatio(
  renderer: object,
): ((ratio: number) => void) | undefined {
  const setPixelRatio = (renderer as Record<string, unknown>).setPixelRatio;

  if (typeof setPixelRatio !== "function") {
    return undefined;
  }

  return setPixelRatio.bind(renderer) as (ratio: number) => void;
}

function readRendererSetAnimationLoop(
  renderer: object,
): ((callback: ((time: number) => void) | null) => void) | undefined {
  const setAnimationLoop = (renderer as Record<string, unknown>).setAnimationLoop;

  if (typeof setAnimationLoop !== "function") {
    return undefined;
  }

  return setAnimationLoop.bind(renderer) as (
    callback: ((time: number) => void) | null,
  ) => void;
}
