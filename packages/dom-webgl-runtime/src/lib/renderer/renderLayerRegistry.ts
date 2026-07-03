import type { WebGLSceneAdapter } from "./sceneObject";
import {
  createManagedDomAlignedSceneAdapter,
  type ManagedThreeSceneAdapterEntry,
  type ThreeRendererHost,
} from "./threeRenderer";
import {
  generatedRenderLayerId,
  normalizeRenderLayerCameraDeclaration,
  normalizeRenderLayerPassDeclaration,
  normalizeRenderLayerSceneDeclaration,
  normalizeTargetSceneId,
} from "./renderLayerDeclarations";
import type {
  WebGLCameraDeclaration,
  WebGLRenderPassDeclaration,
  WebGLSceneDeclaration,
} from "../types";
import type { DOMViewportSize } from "./domProjection";

export type InternalRenderSceneEntry = {
  readonly id: string;
  readonly generated: boolean;
  readonly projection: "dom-aligned";
  readonly scene: object;
  readonly camera: object;
  readonly sceneAdapter: WebGLSceneAdapter;
  readonly defaultCameraId?: string;
  readonly resize?: (viewport: DOMViewportSize) => void;
  readonly dispose?: () => void;
};

export type InternalRenderCameraEntry = {
  readonly id: string;
  readonly generated: boolean;
  readonly sceneId: string;
  readonly type: "orthographic";
  readonly mode: "dom-aligned";
  readonly default: boolean;
  readonly camera: object;
  readonly dispose?: () => void;
};

export type InternalRenderPassEntry = {
  readonly id: string;
  readonly generated: boolean;
  readonly sceneId: string;
  readonly cameraId?: string;
  readonly order: number;
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
  createManagedSceneAdapter?(): ManagedThreeSceneAdapterEntry;
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

      const managed = createManagedSceneAdapter();
      managed.resize(rendererHost.getViewportSize());
      const scene = {
        id: normalized.id,
        generated: false,
        projection: normalized.projection,
        scene: managed.scene,
        camera: managed.camera,
        sceneAdapter: managed.sceneAdapter,
        defaultCameraId: normalized.defaultCameraId,
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
          camera.dispose?.();
          camerasById.delete(cameraId);
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

      const camera = {
        id: normalized.id,
        generated: false,
        sceneId: normalized.sceneId,
        type: normalized.type,
        mode: normalized.mode,
        default: normalized.default,
        camera: scene.camera,
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

      camera.dispose?.();
      camerasById.delete(camera.id);

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
    resize(viewport) {
      for (const scene of scenesById.values()) {
        if (!scene.generated) {
          scene.resize?.(viewport);
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
          camera.dispose?.();
          camerasById.delete(camera.id);
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
    ...(scene.dispose ? { dispose: scene.dispose } : {}),
    ...(scene.resize ? { resize: scene.resize } : {}),
  };
}
