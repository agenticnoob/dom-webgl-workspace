import { OrthographicCamera } from "three/src/cameras/OrthographicCamera.js";
import { PerspectiveCamera } from "three/src/cameras/PerspectiveCamera.js";
import { AmbientLight } from "three/src/lights/AmbientLight.js";
import { DirectionalLight } from "three/src/lights/DirectionalLight.js";
import { Group } from "three/src/objects/Group.js";
import { WebGLRenderer } from "three/src/renderers/WebGLRenderer.js";
import { Scene } from "three/src/scenes/Scene.js";
import { capDevicePixelRatio } from "./layoutPass";
import type {
  WebGLSceneAdapter,
  WebGLSceneGroup,
  WebGLSceneObject,
} from "./sceneObject";
import type { DOMViewportSize } from "./domProjection";
import type { NormalizedRenderLayerCameraDeclaration } from "./renderLayerDeclarations";

export type ThreeRendererAdapter = {
  readonly canvas: HTMLCanvasElement;
  readonly info?: unknown;
  setAnimationLoop?(callback: ((time: number) => void) | null): void;
  setPixelRatio?(ratio: number): void;
  setSize?(width: number, height: number, updateStyle?: boolean): void;
  setClearAlpha?(alpha: number): void;
  clear?(): void;
  clearDepth?(): void;
  setRenderTarget?(target: object | null): void;
  render?(scene: object, camera: object): void;
  dispose(): void;
};

export type ThreeRendererStats = {
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs?: number;
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
  readRendererStats(): ThreeRendererStats;
  resizeIfNeeded(): void;
  dispose(): void;
};

export type ManagedThreeSceneAdapterEntry = {
  readonly scene: object;
  readonly camera: object;
  readonly sceneAdapter: WebGLSceneAdapter;
  resize(viewport: DOMViewportSize): void;
  dispose(): void;
};

export type ManagedThreeCameraEntry = {
  readonly camera: object;
  resize(viewport: DOMViewportSize): void;
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

  configureCanvasStage(container, canvas);
  container.insertBefore(canvas, container.firstChild);
  const restoreDOMStageLayer = configureDOMStageLayer(container, canvas);
  let viewport = configureCSSPixelViewport(
    container,
    canvas,
    objects.renderer,
    objects.camera,
  );

  // Throttle renderer.setSize to avoid GL_INVALID_VALUE spam from Chrome's
  // GL_CHROMIUM_copy_texture during continuous window resize (~12fps cap).
  let lastApplyMs = 0;
  const RESIZE_COOLDOWN_MS = 80;

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
    readRendererStats(): ThreeRendererStats {
      return readRendererStats(objects.renderer);
    },
    resizeIfNeeded(): void {
      const nextViewport = readCSSPixelViewport(container, canvas);

      if (
        viewport.width === nextViewport.width &&
        viewport.height === nextViewport.height &&
        viewport.devicePixelRatio === nextViewport.devicePixelRatio
      ) {
        return;
      }

      const now = performance.now();
      if (now - lastApplyMs < RESIZE_COOLDOWN_MS) {
        return;
      }

      applyCSSPixelViewport(objects.renderer, objects.camera, nextViewport);
      viewport = nextViewport;
      lastApplyMs = now;
    },
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      objects.renderer.dispose();
      restoreDOMStageLayer();
      canvas.remove();
    },
  };
}

export function createManagedDomAlignedSceneAdapter(
  renderer: ThreeRendererAdapter,
): ManagedThreeSceneAdapterEntry {
  return createManagedSceneAdapter(renderer);
}

export function createManagedSceneAdapter(
  renderer: ThreeRendererAdapter,
): ManagedThreeSceneAdapterEntry {
  const scene = new Scene();
  configureDefaultSceneLighting(scene);
  const camera = new OrthographicCamera(0, 800, 600, 0, 0.1, 1000);
  const sceneAdapter = createThreeSceneAdapter(scene, camera, renderer);

  return {
    scene,
    camera,
    sceneAdapter,
    resize(viewport) {
      configureOrthographicCamera(camera, viewport.width, viewport.height);
    },
    dispose() {
      clearSceneObjects(scene);
    },
  };
}

export function createManagedCamera(
  declaration: NormalizedRenderLayerCameraDeclaration,
): ManagedThreeCameraEntry {
  if (declaration.type === "perspective") {
    const camera = new PerspectiveCamera(
      declaration.fov ?? 50,
      1,
      declaration.near ?? 0.1,
      declaration.far ?? 2000,
    );
    configurePerspectiveCamera(camera, declaration, { width: 800, height: 600 });

    return {
      camera,
      resize(viewport) {
        configurePerspectiveCamera(camera, declaration, viewport);
      },
      dispose() {
        return;
      },
    };
  }

  const camera = new OrthographicCamera(0, 800, 600, 0, 0.1, 1000);
  configureManagedOrthographicCamera(camera, declaration, {
    width: 800,
    height: 600,
  });

  return {
    camera,
    resize(viewport) {
      configureManagedOrthographicCamera(camera, declaration, viewport);
    },
    dispose() {
      return;
    },
  };
}

function createDefaultThreeRendererObjects(
  canvas: HTMLCanvasElement,
): ThreeRendererObjects {
  const scene = new Scene();
  const renderer = new WebGLRenderer({
    antialias: false,
    alpha: true,
    powerPreference: "high-performance",
    canvas,
  });
  readRendererSetClearAlpha(renderer)?.(0);
  configureDefaultSceneLighting(scene);

  return {
    camera: new OrthographicCamera(0, 800, 600, 0, 0.1, 1000),
    renderer: {
      canvas,
      get info() {
        return renderer.info;
      },
      setSize(width, height, updateStyle) {
        readRendererSetSize(renderer)?.(width, height, updateStyle);
      },
      setPixelRatio(ratio) {
        readRendererSetPixelRatio(renderer)?.(ratio);
      },
      setAnimationLoop(callback) {
        readRendererSetAnimationLoop(renderer)?.(callback);
      },
      setClearAlpha(alpha) {
        readRendererSetClearAlpha(renderer)?.(alpha);
      },
      clear() {
        readRendererClear(renderer)?.();
      },
      clearDepth() {
        readRendererClearDepth(renderer)?.();
      },
      setRenderTarget(target) {
        readRendererSetRenderTarget(renderer)?.(target);
      },
      render(scene, camera) {
        readRendererRender(renderer)?.(scene, camera);
      },
      dispose() {
        renderer.dispose();
      },
    },
    scene,
  };
}

function readRendererStats(renderer: ThreeRendererAdapter): ThreeRendererStats {
  const info = readRendererInfo(renderer.info);
  const stats: ThreeRendererStats = {
    drawCalls: readFiniteNumber(info?.render?.calls),
    triangles: readFiniteNumber(info?.render?.triangles),
    geometries: readFiniteNumber(info?.memory?.geometries),
    textures: readFiniteNumber(info?.memory?.textures),
  };
  const programs = readRendererProgramCount(info?.programs);

  if (programs !== undefined) {
    stats.programs = programs;
  }

  return stats;
}

function readRendererInfo(info: unknown):
  | {
      render?: { calls?: unknown; triangles?: unknown };
      memory?: { geometries?: unknown; textures?: unknown };
      programs?: unknown;
    }
  | undefined {
  if (!isRecord(info)) {
    return undefined;
  }

  const render = isRecord(info.render) ? info.render : undefined;
  const memory = isRecord(info.memory) ? info.memory : undefined;

  return {
    ...(render ? { render } : {}),
    ...(memory ? { memory } : {}),
    programs: info.programs,
  };
}

function readRendererProgramCount(programs: unknown): number | undefined {
  if (!programs || typeof programs !== "object" || !("length" in programs)) {
    return undefined;
  }

  return readFiniteNumber(programs.length);
}

function readFiniteNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function configureDefaultSceneLighting(scene: object): void {
  const add = readSceneMethod(scene, "add");

  if (!add) {
    return;
  }

  const ambientLight = new AmbientLight(0xffffff, 0.45);
  const directionalLight = new DirectionalLight(0xffffff, 1);

  directionalLight.position.set(1, 1.5, 2);
  add(ambientLight);
  add(directionalLight);
}

function configureCSSPixelViewport(
  container: HTMLElement,
  canvas: HTMLCanvasElement,
  renderer: ThreeRendererAdapter,
  camera: object,
): DOMViewportState {
  const viewport = readCSSPixelViewport(container, canvas);

  applyCSSPixelViewport(renderer, camera, viewport);

  return viewport;
}

type DOMViewportState = DOMViewportSize & {
  devicePixelRatio: number;
};

function readCSSPixelViewport(
  container: HTMLElement,
  canvas: HTMLCanvasElement,
): DOMViewportState {
  const stageRect = canvas.getBoundingClientRect();
  const width = readFirstPositiveNumber(
    stageRect.width,
    document.documentElement.clientWidth,
    window.innerWidth,
    container.clientWidth,
    800,
  );
  const height = readFirstPositiveNumber(
    stageRect.height,
    document.documentElement.clientHeight,
    window.innerHeight,
    container.clientHeight,
    600,
  );

  return {
    width,
    height,
    devicePixelRatio: capDevicePixelRatio(window.devicePixelRatio || 1),
  };
}

function readFirstPositiveNumber(...values: number[]): number {
  return values.find((value) => Number.isFinite(value) && value > 0) ?? 1;
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

function configureDOMStageLayer(
  container: HTMLElement,
  canvas: HTMLCanvasElement,
): () => void {
  const restoreEntries: Array<{
    child: HTMLElement;
    previousPosition: string;
    previousZIndex: string;
    appliedPosition: boolean;
    appliedZIndex: boolean;
  }> = [];

  for (const child of Array.from(container.children)) {
    if (!(child instanceof HTMLElement) || child === canvas) {
      continue;
    }

    const { style } = child;
    const previousPosition = style.position;
    const previousZIndex = style.zIndex;
    const appliedPosition = !previousPosition;
    const appliedZIndex = !previousZIndex;

    if (appliedPosition) {
      style.position = "relative";
    }

    if (appliedZIndex) {
      style.zIndex = "1";
    }

    restoreEntries.push({
      child,
      previousPosition,
      previousZIndex,
      appliedPosition,
      appliedZIndex,
    });
  }

  return () => {
    for (const entry of restoreEntries) {
      if (entry.appliedPosition && entry.child.style.position === "relative") {
        entry.child.style.position = entry.previousPosition;
      }

      if (entry.appliedZIndex && entry.child.style.zIndex === "1") {
        entry.child.style.zIndex = entry.previousZIndex;
      }
    }
  };
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

function configureManagedOrthographicCamera(
  camera: object,
  _declaration: NormalizedRenderLayerCameraDeclaration,
  viewport: DOMViewportSize,
): void {
  configureOrthographicCamera(camera, viewport.width, viewport.height);
}

function configurePerspectiveCamera(
  camera: object,
  declaration: NormalizedRenderLayerCameraDeclaration,
  viewport: DOMViewportSize,
): void {
  Object.assign(camera, {
    aspect: viewport.width / viewport.height,
  });

  const position = declaration.position ?? [0, 0, 500];
  const target = declaration.target ?? [0, 0, 0];
  const cameraPosition = (camera as { position?: { set?: unknown } }).position;

  if (cameraPosition && typeof cameraPosition.set === "function") {
    cameraPosition.set(position[0], position[1], position[2]);
  }

  const lookAt = (camera as { lookAt?: unknown }).lookAt;
  if (typeof lookAt === "function") {
    lookAt.call(camera, target[0], target[1], target[2]);
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
  const attachedObjects = new Set<WebGLSceneObject>();
  const attachedGroups = new Set<WebGLSceneGroup>();

  return {
    addObject(object): void {
      if (attachedObjects.has(object)) {
        return;
      }

      addToRoot(object.object3D ?? object);
      attachedObjects.add(object);
    },
    removeObject(object): void {
      if (!attachedObjects.has(object)) {
        return;
      }

      removeFromCurrentParent(object.object3D ?? object);
      attachedObjects.delete(object);
    },
    createGroup(key): WebGLSceneGroup {
      return {
        key,
        object3D: new Group(),
      };
    },
    addGroup(group, parent): void {
      if (attachedGroups.has(group)) {
        return;
      }

      if (parent?.object3D) {
        addToParent(group.object3D ?? group, parent.object3D);
      } else {
        addToRoot(group.object3D ?? group);
      }
      attachedGroups.add(group);
    },
    removeGroup(group): void {
      if (!attachedGroups.has(group)) {
        return;
      }

      removeFromCurrentParent(group.object3D ?? group);
      attachedGroups.delete(group);
    },
    setObjectParent(object, parent): void {
      if (!attachedObjects.has(object)) {
        return;
      }

      if (parent?.object3D) {
        addToParent(object.object3D ?? object, parent.object3D);
        return;
      }

      addToRoot(object.object3D ?? object);
    },
    setGroupParent(group, parent): void {
      if (!attachedGroups.has(group)) {
        return;
      }

      if (parent?.object3D) {
        addToParent(group.object3D ?? group, parent.object3D);
        return;
      }

      addToRoot(group.object3D ?? group);
    },
    render(cameraOverride?: object): void {
      renderer.render?.(scene, cameraOverride ?? camera);
    },
  };

  function addToRoot(object: unknown): void {
    readSceneMethod(scene, "add")?.(object);
  }

  function addToParent(object: unknown, parent: unknown): void {
    readObject3DMethod(parent, "add")?.(object);
  }

  function removeFromCurrentParent(object: unknown): void {
    const parent = readObject3DParent(object);

    if (parent) {
      const remove = readObject3DMethod(parent, "remove");

      if (remove) {
        remove(object);
        return;
      }
    }

    readSceneMethod(scene, "remove")?.(object);
  }
}

function clearSceneObjects(scene: object): void {
  const children = (scene as { children?: unknown }).children;
  const remove = readSceneMethod(scene, "remove");

  if (!Array.isArray(children) || !remove) {
    return;
  }

  for (const child of [...children]) {
    remove(child);
  }
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

function readObject3DParent(object: unknown): unknown {
  if (!object || typeof object !== "object") {
    return undefined;
  }

  return (object as { parent?: unknown }).parent;
}

function readObject3DMethod(
  object: unknown,
  methodName: "add" | "remove",
): ((child: unknown) => void) | undefined {
  if (!object || typeof object !== "object") {
    return undefined;
  }

  const method = (object as Record<string, unknown>)[methodName];

  if (typeof method !== "function") {
    return undefined;
  }

  return method.bind(object) as (child: unknown) => void;
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

function readRendererSetClearAlpha(
  renderer: object,
): ((alpha: number) => void) | undefined {
  const setClearAlpha = (renderer as Record<string, unknown>).setClearAlpha;

  if (typeof setClearAlpha !== "function") {
    return undefined;
  }

  return setClearAlpha.bind(renderer) as (alpha: number) => void;
}

function readRendererClear(renderer: object): (() => void) | undefined {
  const clear = (renderer as Record<string, unknown>).clear;

  if (typeof clear !== "function") {
    return undefined;
  }

  return clear.bind(renderer) as () => void;
}

function readRendererClearDepth(renderer: object): (() => void) | undefined {
  const clearDepth = (renderer as Record<string, unknown>).clearDepth;

  if (typeof clearDepth !== "function") {
    return undefined;
  }

  return clearDepth.bind(renderer) as () => void;
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

function readRendererSetRenderTarget(
  renderer: object,
): ((target: object | null) => void) | undefined {
  const setRenderTarget = (renderer as Record<string, unknown>).setRenderTarget;

  if (typeof setRenderTarget !== "function") {
    return undefined;
  }

  return setRenderTarget.bind(renderer) as (target: object | null) => void;
}
