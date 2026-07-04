import type {
  WebGLLightDeclaration,
  WebGLStagePrimitiveDeclaration,
} from "../types";

import {
  createManagedLightObject,
  createManagedStagePrimitiveObject,
} from "./managedStageObjects";
import {
  normalizeLightDeclaration,
  normalizeStagePrimitiveDeclaration,
  type NormalizedLightDeclaration,
  type NormalizedStagePrimitiveDeclaration,
} from "./stageDeclarations";
import {
  createSceneObjectController,
  type WebGLSceneAdapter,
  type WebGLSceneObject,
  type WebGLSceneObjectController,
} from "./sceneObject";

export type StageObjectRegistry = {
  registerStagePrimitive(declaration: WebGLStagePrimitiveDeclaration): void;
  unregisterStagePrimitive(id: string): void;
  registerLight(declaration: WebGLLightDeclaration): void;
  unregisterLight(id: string): void;
  unregisterScene(sceneId: string): void;
  dispose(): void;
};

export type StageObjectRegistryOptions = {
  getSceneAdapter(sceneId: string): WebGLSceneAdapter;
  createPrimitiveObject?(
    declaration: NormalizedStagePrimitiveDeclaration,
  ): WebGLSceneObject;
  createLightObject?(declaration: NormalizedLightDeclaration): WebGLSceneObject;
};

type StageRegistryEntry = {
  sceneId: string;
  controller: WebGLSceneObjectController;
};

export function createStageObjectRegistry(
  options: StageObjectRegistryOptions,
): StageObjectRegistry {
  const primitiveEntries = new Map<string, StageRegistryEntry>();
  const lightEntries = new Map<string, StageRegistryEntry>();
  const createPrimitiveObject =
    options.createPrimitiveObject ?? createManagedStagePrimitiveObject;
  const createLightObject = options.createLightObject ?? createManagedLightObject;

  return {
    registerStagePrimitive(declaration): void {
      const normalized = normalizeStagePrimitiveDeclaration(declaration);

      if (primitiveEntries.has(normalized.id)) {
        throw new Error(
          `WebGL stage primitive id "${normalized.id}" is already registered.`,
        );
      }

      const adapter = options.getSceneAdapter(normalized.sceneId);
      const object = createPrimitiveObject(normalized);
      const controller = createSceneObjectController(adapter, object);

      controller.attach();
      primitiveEntries.set(normalized.id, {
        sceneId: normalized.sceneId,
        controller,
      });
    },
    unregisterStagePrimitive(id): void {
      unregisterEntry(primitiveEntries, id);
    },
    registerLight(declaration): void {
      const normalized = normalizeLightDeclaration(declaration);

      if (lightEntries.has(normalized.id)) {
        throw new Error(`WebGL light id "${normalized.id}" is already registered.`);
      }

      const adapter = options.getSceneAdapter(normalized.sceneId);
      const object = createLightObject(normalized);
      const controller = createSceneObjectController(adapter, object);

      controller.attach();
      lightEntries.set(normalized.id, {
        sceneId: normalized.sceneId,
        controller,
      });
    },
    unregisterLight(id): void {
      unregisterEntry(lightEntries, id);
    },
    unregisterScene(sceneId): void {
      const normalizedSceneId = sceneId.trim();

      unregisterEntriesForScene(primitiveEntries, normalizedSceneId);
      unregisterEntriesForScene(lightEntries, normalizedSceneId);
    },
    dispose(): void {
      disposeEntries(primitiveEntries);
      disposeEntries(lightEntries);
    },
  };
}

function unregisterEntry(
  entries: Map<string, StageRegistryEntry>,
  id: string,
): void {
  const normalizedId = id.trim();
  const entry = entries.get(normalizedId);

  if (!entry) {
    return;
  }

  entry.controller.dispose();
  entries.delete(normalizedId);
}

function unregisterEntriesForScene(
  entries: Map<string, StageRegistryEntry>,
  sceneId: string,
): void {
  for (const [id, entry] of [...entries]) {
    if (entry.sceneId !== sceneId) {
      continue;
    }

    entry.controller.dispose();
    entries.delete(id);
  }
}

function disposeEntries(entries: Map<string, StageRegistryEntry>): void {
  for (const entry of entries.values()) {
    entry.controller.dispose();
  }

  entries.clear();
}
