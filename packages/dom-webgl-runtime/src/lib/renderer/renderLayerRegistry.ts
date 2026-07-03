import type { WebGLSceneAdapter } from "./sceneObject";
import type { ThreeRendererHost } from "./threeRenderer";

export type InternalRenderSceneEntry = {
  readonly id: "main";
  readonly generated: true;
  readonly projection: "dom-aligned";
  readonly scene: object;
  readonly sceneAdapter: WebGLSceneAdapter;
};

export type InternalRenderCameraEntry = {
  readonly id: "main";
  readonly generated: true;
  readonly type: "orthographic";
  readonly mode: "dom-aligned";
  readonly camera: object;
};

export type InternalRenderPassEntry = {
  readonly id: "main";
  readonly generated: true;
  readonly sceneId: "main";
  readonly cameraId: "main";
  readonly order: 0;
};

export type InternalRenderLayerRegistry = {
  getScene(id: string): InternalRenderSceneEntry;
  getCamera(id: string): InternalRenderCameraEntry;
  getPasses(): readonly InternalRenderPassEntry[];
  getMainSceneAdapter(): WebGLSceneAdapter;
  renderPasses(
    renderPass: (
      pass: InternalRenderPassEntry,
      scene: InternalRenderSceneEntry,
      camera: InternalRenderCameraEntry,
    ) => void,
  ): void;
};

export function createInternalRenderLayerRegistry(
  rendererHost: Pick<ThreeRendererHost, "scene" | "camera" | "sceneAdapter">,
): InternalRenderLayerRegistry {
  const mainScene = {
    id: "main",
    generated: true,
    projection: "dom-aligned",
    scene: rendererHost.scene,
    sceneAdapter: rendererHost.sceneAdapter,
  } satisfies InternalRenderSceneEntry;
  const mainCamera = {
    id: "main",
    generated: true,
    type: "orthographic",
    mode: "dom-aligned",
    camera: rendererHost.camera,
  } satisfies InternalRenderCameraEntry;
  const mainPass = {
    id: "main",
    generated: true,
    sceneId: "main",
    cameraId: "main",
    order: 0,
  } satisfies InternalRenderPassEntry;
  const passes = [mainPass] as const;

  return {
    getScene(id) {
      assertMainId(id, "scene");
      return mainScene;
    },
    getCamera(id) {
      assertMainId(id, "camera");
      return mainCamera;
    },
    getPasses() {
      return passes;
    },
    getMainSceneAdapter() {
      return mainScene.sceneAdapter;
    },
    renderPasses(renderPass) {
      for (const pass of passes) {
        renderPass(pass, mainScene, mainCamera);
      }
    },
  };
}

function assertMainId(id: string, kind: "scene" | "camera"): void {
  if (id !== "main") {
    throw new Error(`Unknown generated ${kind} "${String(id)}".`);
  }
}
