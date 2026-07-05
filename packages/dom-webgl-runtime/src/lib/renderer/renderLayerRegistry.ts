import type { WebGLSceneAdapter } from "./sceneObject";
import {
  createManagedCamera,
  createManagedDomAlignedSceneAdapter,
  type ManagedThreeCameraEntry,
  type ManagedThreeSceneAdapterEntry,
  type ThreeRendererHost,
} from "./threeRenderer";
import {
  assertCameraMatchesSceneProjection,
  generatedRenderLayerId,
  type NormalizedRenderLayerCameraDeclaration,
  type NormalizedRenderLayerSceneDeclaration,
  normalizeRenderLayerCameraDeclaration,
  normalizeRenderLayerPassDeclaration,
  normalizeRenderLayerSceneDeclaration,
  normalizeTargetSceneId,
} from "./renderLayerDeclarations";
import {
  readCameraControllerFrame,
  readCameraControllerProgress,
  type NormalizedCameraControllerDeclaration,
  type NormalizedCameraControllerFrameDeclaration,
} from "./cameraControllerDeclarations";
import type { NormalizedTimelineBinding } from "../timeline/timelineDeclarations";
import { readTimelineProgress } from "../timeline/timelineDeclarations";
import type {
  WebGLCameraDeclaration,
  WebGLCameraMode,
  WebGLCameraType,
  WebGLDebugCameraControllerSummary,
  WebGLPassViewportDeclaration,
  WebGLPostprocessDeclaration,
  WebGLProgressSignalSource,
  WebGLRenderPassDeclaration,
  WebGLSceneDeclaration,
  WebGLSceneProjection,
} from "../types";
import type { DOMViewportSize } from "./domProjection";

export type InternalRenderSceneEntry = {
  readonly id: string;
  readonly generated: boolean;
  readonly projection: WebGLSceneProjection;
  readonly scene: object;
  readonly camera: object;
  readonly sceneAdapter: WebGLSceneAdapter;
  readonly defaultCameraId?: string;
  readonly timeline?: NormalizedTimelineBinding;
  readonly timelineActive?: boolean;
  readonly resize?: (viewport: DOMViewportSize) => void;
  readonly dispose?: () => void;
};

export type InternalRenderCameraEntry = {
  readonly id: string;
  readonly generated: boolean;
  readonly sceneId: string;
  readonly type: WebGLCameraType;
  readonly mode: WebGLCameraMode;
  readonly default: boolean;
  readonly camera: object;
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly position?: readonly [number, number, number];
  readonly target?: readonly [number, number, number];
  readonly controller?: NormalizedCameraControllerDeclaration;
  readonly controllerBaseFrame?: NormalizedCameraControllerFrameDeclaration;
  readonly resize?: (viewport: DOMViewportSize) => void;
  readonly applyFraming?: (
    framing: NormalizedCameraControllerFrameDeclaration,
    viewport: DOMViewportSize,
  ) => void;
  readonly dispose?: () => void;
};

export type InternalRenderPassEntry = {
  readonly id: string;
  readonly generated: boolean;
  readonly sceneId: string;
  readonly cameraId?: string;
  readonly order: number;
  readonly clear: boolean;
  readonly clearDepth: boolean;
  readonly viewport?: WebGLPassViewportDeclaration;
  readonly postprocess?: WebGLPostprocessDeclaration;
  readonly deferUntilCamera?: boolean;
};

export type InternalRenderLayerRegistry = {
  getScene(id: string): InternalRenderSceneEntry;
  getCamera(id: string): InternalRenderCameraEntry;
  getPasses(): readonly InternalRenderPassEntry[];
  getMainSceneAdapter(): WebGLSceneAdapter;
  getSceneAdapterForTarget(sceneId: string | undefined): WebGLSceneAdapter;
  registerScene(declaration: WebGLSceneDeclaration): void;
  unregisterScene(id: string): void;
  registerCamera(declaration: WebGLCameraDeclaration): void;
  unregisterCamera(id: string): void;
  registerRenderPass(declaration: WebGLRenderPassDeclaration): void;
  unregisterRenderPass(id: string): void;
  updateTimelineState(progressSignals: WebGLProgressSignalSource): void;
  updateCameraControllers(progressSignals: WebGLProgressSignalSource): boolean;
  inspectCameraControllers(): readonly WebGLDebugCameraControllerSummary[];
  resize(viewport: DOMViewportSize): void;
  renderPasses(
    renderPass: (
      pass: InternalRenderPassEntry,
      scene: InternalRenderSceneEntry,
      camera: InternalRenderCameraEntry,
    ) => void,
  ): void;
  dispose(): void;
};

export type InternalRenderLayerRegistryOptions = {
  createManagedSceneAdapter?(
    declaration: NormalizedRenderLayerSceneDeclaration,
  ): ManagedThreeSceneAdapterEntry;
  createManagedCamera?(
    declaration: NormalizedRenderLayerCameraDeclaration,
    scene: InternalRenderSceneEntry,
  ): ManagedThreeCameraEntry;
};

export function createInternalRenderLayerRegistry(
  rendererHost: Pick<
    ThreeRendererHost,
    "scene" | "camera" | "sceneAdapter" | "renderer" | "getViewportSize"
  >,
  options: InternalRenderLayerRegistryOptions = {},
): InternalRenderLayerRegistry {
  const createManagedSceneAdapter =
    options.createManagedSceneAdapter ??
    (() => createManagedDomAlignedSceneAdapter(rendererHost.renderer));
  const createManagedCameraEntry =
    options.createManagedCamera ??
    ((declaration: NormalizedRenderLayerCameraDeclaration) =>
      createManagedCamera(declaration));
  const mainScene = {
    id: generatedRenderLayerId,
    generated: true,
    projection: "dom-aligned",
    scene: rendererHost.scene,
    camera: rendererHost.camera,
    sceneAdapter: rendererHost.sceneAdapter,
  } satisfies InternalRenderSceneEntry;
  const mainCamera = {
    id: generatedRenderLayerId,
    generated: true,
    sceneId: generatedRenderLayerId,
    type: "orthographic",
    mode: "dom-aligned",
    default: true,
    camera: rendererHost.camera,
  } satisfies InternalRenderCameraEntry;
  const mainPass = {
    id: generatedRenderLayerId,
    generated: true,
    sceneId: generatedRenderLayerId,
    cameraId: generatedRenderLayerId,
    order: 0,
    clear: false,
    clearDepth: false,
  } satisfies InternalRenderPassEntry;
  const scenesById = new Map<string, InternalRenderSceneEntry>([
    [mainScene.id, mainScene],
  ]);
  const camerasById = new Map<string, InternalRenderCameraEntry>([
    [mainCamera.id, mainCamera],
  ]);
  const passesById = new Map<string, InternalRenderPassEntry>([
    [mainPass.id, mainPass],
  ]);
  const appliedControllerFramesByCameraId = new Map<
    string,
    NormalizedCameraControllerFrameDeclaration
  >();
  const cameraControllerSnapshotsByCameraId = new Map<
    string,
    { readonly progress: number; readonly applied: boolean }
  >();

  return {
    getScene(id) {
      const scene = scenesById.get(id);

      if (!scene) {
        throw new Error(`Unknown WebGL scene "${String(id)}".`);
      }

      return scene;
    },
    getCamera(id) {
      const camera = camerasById.get(id);

      if (!camera) {
        throw new Error(`Unknown WebGL camera "${String(id)}".`);
      }

      return camera;
    },
    getPasses() {
      return Array.from(passesById.values());
    },
    getMainSceneAdapter() {
      return mainScene.sceneAdapter;
    },
    getSceneAdapterForTarget(sceneId) {
      const normalizedSceneId = normalizeTargetSceneId(sceneId);
      const scene = scenesById.get(normalizedSceneId);

      if (!scene) {
        throw new Error(
          `WebGL target references unknown scene "${normalizedSceneId}".`,
        );
      }

      return scene.sceneAdapter;
    },
    registerScene(declaration) {
      const normalized = normalizeRenderLayerSceneDeclaration(declaration);

      if (scenesById.has(normalized.id)) {
        throw new Error(`WebGL scene id "${normalized.id}" is already registered.`);
      }

      const managed = createManagedSceneAdapter(normalized);
      managed.resize(rendererHost.getViewportSize());
      const scene = {
        id: normalized.id,
        generated: false,
        projection: normalized.projection,
        scene: managed.scene,
        camera: managed.camera,
        sceneAdapter: managed.sceneAdapter,
        defaultCameraId: normalized.defaultCameraId,
        ...(normalized.timeline ? { timeline: normalized.timeline } : {}),
        resize: managed.resize,
        dispose: managed.dispose,
      } satisfies InternalRenderSceneEntry;
      scenesById.set(scene.id, scene);

      if (normalized.defaultPass) {
        const pass = normalizeRenderLayerPassDeclaration({
          sceneId: normalized.id,
          cameraId: normalized.defaultCameraId,
        });
        passesById.set(pass.id, {
          ...pass,
          generated: false,
          deferUntilCamera: true,
          sceneId: pass.sceneId,
        });
      }
    },
    unregisterScene(id) {
      const scene = scenesById.get(id.trim());

      if (!scene || scene.generated) {
        return;
      }

      for (const [passId, pass] of passesById) {
        if (pass.sceneId === scene.id) {
          passesById.delete(passId);
        }
      }

      for (const [cameraId, camera] of camerasById) {
        if (camera.sceneId === scene.id) {
          resetCameraController(camera);
          camera.dispose?.();
          camerasById.delete(cameraId);
          appliedControllerFramesByCameraId.delete(cameraId);
          cameraControllerSnapshotsByCameraId.delete(cameraId);
        }
      }

      scene.dispose?.();
      scenesById.delete(scene.id);
    },
    registerCamera(declaration) {
      const normalized = normalizeRenderLayerCameraDeclaration(declaration);
      const scene = scenesById.get(normalized.sceneId);

      if (camerasById.has(normalized.id)) {
        throw new Error(`WebGL camera id "${normalized.id}" is already registered.`);
      }

      if (!scene) {
        throw new Error(
          `WebGL camera "${normalized.id}" references unknown scene "${normalized.sceneId}".`,
        );
      }

      assertCameraMatchesSceneProjection(scene, normalized);
      assertCameraControllerSupported(normalized);
      const managedCamera = createManagedCameraEntry(normalized, scene);
      managedCamera.resize(rendererHost.getViewportSize());
      const camera = {
        id: normalized.id,
        generated: false,
        sceneId: normalized.sceneId,
        type: normalized.type,
        mode: normalized.mode,
        default: normalized.default,
        camera: managedCamera.camera,
        ...(normalized.fov !== undefined ? { fov: normalized.fov } : {}),
        ...(normalized.near !== undefined ? { near: normalized.near } : {}),
        ...(normalized.far !== undefined ? { far: normalized.far } : {}),
        ...(normalized.position ? { position: normalized.position } : {}),
        ...(normalized.target ? { target: normalized.target } : {}),
        ...(normalized.controller
          ? {
              controller: normalized.controller,
              controllerBaseFrame: readCameraControllerBaseFrame(normalized),
            }
          : {}),
        resize: managedCamera.resize,
        applyFraming: managedCamera.applyFraming,
        dispose: managedCamera.dispose,
      } satisfies InternalRenderCameraEntry;
      camerasById.set(camera.id, camera);

      if (normalized.default) {
        scenesById.set(scene.id, {
          ...scene,
          defaultCameraId: normalized.id,
        });
      }
    },
    unregisterCamera(id) {
      const camera = camerasById.get(id.trim());

      if (!camera || camera.generated) {
        return;
      }

      resetCameraController(camera);
      camera.dispose?.();
      camerasById.delete(camera.id);
      appliedControllerFramesByCameraId.delete(camera.id);
      cameraControllerSnapshotsByCameraId.delete(camera.id);

      const scene = scenesById.get(camera.sceneId);
      if (scene?.defaultCameraId === camera.id) {
        scenesById.set(scene.id, omitDefaultCameraId(scene));
      }
    },
    registerRenderPass(declaration) {
      const normalized = normalizeRenderLayerPassDeclaration(declaration);

      if (passesById.has(normalized.id)) {
        throw new Error(
          `WebGL render pass id "${normalized.id}" is already registered.`,
        );
      }

      if (!scenesById.has(normalized.sceneId)) {
        throw new Error(
          `WebGL render pass "${normalized.id}" references unknown scene "${normalized.sceneId}".`,
        );
      }

      passesById.set(normalized.id, {
        ...normalized,
        generated: false,
        sceneId: normalized.sceneId,
        deferUntilCamera: true,
      });
    },
    unregisterRenderPass(id) {
      const pass = passesById.get(id.trim());

      if (!pass || pass.generated) {
        return;
      }

      passesById.delete(pass.id);
    },
    updateTimelineState(progressSignals) {
      for (const scene of scenesById.values()) {
        if (!scene.timeline?.active) {
          continue;
        }

        const snapshot = readTimelineProgress(scene.timeline, progressSignals);
        scenesById.set(scene.id, {
          ...scene,
          timelineActive: snapshot.active,
        });
      }
    },
    updateCameraControllers(progressSignals) {
      let changed = false;
      const viewport = rendererHost.getViewportSize();

      for (const camera of camerasById.values()) {
        if (!camera.controller || !camera.controllerBaseFrame) {
          continue;
        }

        const progress = readCameraControllerProgress(
          camera.controller,
          progressSignals,
        );
        const frame = readCameraControllerFrame(
          camera.controller,
          camera.controllerBaseFrame,
          progress,
        );
        const previous = appliedControllerFramesByCameraId.get(camera.id);

        cameraControllerSnapshotsByCameraId.set(camera.id, {
          progress,
          applied: true,
        });

        if (cameraControllerFramesEqual(previous, frame)) {
          continue;
        }

        camera.applyFraming?.(frame, viewport);
        appliedControllerFramesByCameraId.set(camera.id, frame);
        changed = true;
      }

      return changed;
    },
    inspectCameraControllers() {
      return Array.from(camerasById.values()).flatMap((camera) => {
        if (!camera.controller) {
          return [];
        }

        const snapshot = cameraControllerSnapshotsByCameraId.get(camera.id);

        return [
          {
            cameraId: camera.id,
            sceneId: camera.sceneId,
            timelineId: camera.controller.timeline.id,
            progressKey: camera.controller.timeline.progressKey,
            progress: snapshot?.progress ?? 0,
            applied: snapshot?.applied ?? false,
          },
        ];
      });
    },
    resize(viewport) {
      for (const scene of scenesById.values()) {
        if (!scene.generated) {
          scene.resize?.(viewport);
        }
      }
      for (const camera of camerasById.values()) {
        if (!camera.generated) {
          camera.resize?.(viewport);
          if (camera.controller) {
            appliedControllerFramesByCameraId.delete(camera.id);
          }
        }
      }
    },
    renderPasses(renderPass) {
      const orderedPasses = Array.from(passesById.values()).sort(
        (left, right) => left.order - right.order,
      );

      for (const pass of orderedPasses) {
        const scene = scenesById.get(pass.sceneId);
        const cameraId = pass.cameraId ?? readDefaultCameraIdForScene(pass.sceneId);
        const camera = cameraId ? camerasById.get(cameraId) : undefined;

        if (!scene) {
          throw new Error(
            `WebGL render pass "${pass.id}" references unknown scene "${pass.sceneId}".`,
          );
        }

        if (scene.timeline?.active && scene.timelineActive === false) {
          continue;
        }

        if ((!camera || !cameraId) && pass.deferUntilCamera) {
          continue;
        }

        if (!camera || !cameraId) {
          throw new Error(
            `WebGL render pass "${pass.id}" references unknown camera "${cameraId ?? "default"}".`,
          );
        }

        if (camera.sceneId !== scene.id) {
          throw new Error(
            `WebGL render pass "${pass.id}" references camera "${camera.id}" from scene "${camera.sceneId}".`,
          );
        }

        renderPass(pass, scene, camera);
      }
    },
    dispose() {
      for (const pass of Array.from(passesById.values())) {
        if (!pass.generated) {
          passesById.delete(pass.id);
        }
      }

      for (const camera of Array.from(camerasById.values())) {
        if (!camera.generated) {
          resetCameraController(camera);
          camera.dispose?.();
          camerasById.delete(camera.id);
          appliedControllerFramesByCameraId.delete(camera.id);
          cameraControllerSnapshotsByCameraId.delete(camera.id);
        }
      }

      for (const scene of Array.from(scenesById.values())) {
        if (!scene.generated) {
          scene.dispose?.();
          scenesById.delete(scene.id);
        }
      }
    },
  };

  function readDefaultCameraIdForScene(sceneId: string): string | undefined {
    const scene = scenesById.get(sceneId);

    if (scene?.defaultCameraId) {
      return scene.defaultCameraId;
    }

    for (const camera of camerasById.values()) {
      if (camera.sceneId === sceneId && camera.default) {
        return camera.id;
      }
    }

    return undefined;
  }

  function resetCameraController(camera: InternalRenderCameraEntry): void {
    if (!camera.controllerBaseFrame) {
      return;
    }

    camera.applyFraming?.(camera.controllerBaseFrame, rendererHost.getViewportSize());
  }
}

function assertCameraControllerSupported(
  camera: NormalizedRenderLayerCameraDeclaration,
): void {
  if (!camera.controller) {
    return;
  }

  if (camera.type === "perspective" && camera.mode === "perspective-stage") {
    return;
  }

  throw new Error(
    `WebGL camera controller "${camera.id}" requires a managed perspective-stage camera.`,
  );
}

function readCameraControllerBaseFrame(
  camera: NormalizedRenderLayerCameraDeclaration,
): NormalizedCameraControllerFrameDeclaration {
  return {
    position: camera.position ?? [0, 0, 500],
    target: camera.target ?? [0, 0, 0],
    fov: camera.fov ?? 50,
  };
}

function cameraControllerFramesEqual(
  left: NormalizedCameraControllerFrameDeclaration | undefined,
  right: NormalizedCameraControllerFrameDeclaration,
): boolean {
  if (!left) {
    return false;
  }

  return (
    tuple3Equal(left.position, right.position) &&
    tuple3Equal(left.target, right.target) &&
    left.fov === right.fov
  );
}

function tuple3Equal(
  left: readonly [number, number, number] | undefined,
  right: readonly [number, number, number] | undefined,
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

function omitDefaultCameraId(
  scene: InternalRenderSceneEntry,
): InternalRenderSceneEntry {
  return {
    id: scene.id,
    generated: scene.generated,
    projection: scene.projection,
    scene: scene.scene,
    camera: scene.camera,
    sceneAdapter: scene.sceneAdapter,
    ...(scene.timeline ? { timeline: scene.timeline } : {}),
    ...(scene.timelineActive !== undefined
      ? { timelineActive: scene.timelineActive }
      : {}),
    ...(scene.dispose ? { dispose: scene.dispose } : {}),
    ...(scene.resize ? { resize: scene.resize } : {}),
  };
}
