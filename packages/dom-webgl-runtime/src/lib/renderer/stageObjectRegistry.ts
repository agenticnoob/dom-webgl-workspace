import type {
  WebGLDebugLightSummary,
  WebGLDebugStagePrimitiveSummary,
  WebGLLightDeclaration,
  WebGLProgressSignalSource,
  WebGLStagePrimitiveDeclaration,
} from "../types";
import type { NormalizedTimelineBinding } from "../timeline/timelineDeclarations";
import { readTimelineProgress } from "../timeline/timelineDeclarations";

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
  updateTimelineState(progressSignals: WebGLProgressSignalSource): void;
  inspect(): StageObjectRegistryDebugState;
  dispose(): void;
};

export type StageObjectRegistryDebugState = {
  stagePrimitives: WebGLDebugStagePrimitiveSummary[];
  lights: WebGLDebugLightSummary[];
};

export type StageObjectRegistryOptions = {
  getSceneAdapter(sceneId: string): WebGLSceneAdapter;
  createPrimitiveObject?(
    declaration: NormalizedStagePrimitiveDeclaration,
  ): WebGLSceneObject;
  createLightObject?(declaration: NormalizedLightDeclaration): WebGLSceneObject;
};

type RegistryEntry = {
  sceneId: string;
  visible: boolean;
  controller: WebGLSceneObjectController;
  timeline?: NormalizedTimelineBinding;
  timelineActive?: boolean;
};

type StagePrimitiveRegistryEntry = RegistryEntry & {
  kind: WebGLStagePrimitiveDeclaration["kind"];
};

type LightRegistryEntry = RegistryEntry & {
  kind: WebGLLightDeclaration["kind"];
};

export function createStageObjectRegistry(
  options: StageObjectRegistryOptions,
): StageObjectRegistry {
  const primitiveEntries = new Map<string, StagePrimitiveRegistryEntry>();
  const lightEntries = new Map<string, LightRegistryEntry>();
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
        kind: normalized.kind,
        visible: normalized.visible,
        ...(normalized.timeline ? { timeline: normalized.timeline } : {}),
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
        kind: normalized.kind,
        visible: normalized.visible,
        ...(normalized.timeline ? { timeline: normalized.timeline } : {}),
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
    updateTimelineState(progressSignals): void {
      updateTimelineEntries(primitiveEntries, progressSignals);
      updateTimelineEntries(lightEntries, progressSignals);
    },
    inspect(): StageObjectRegistryDebugState {
      return {
        stagePrimitives: Array.from(primitiveEntries, ([id, entry]) => ({
          id,
          sceneId: entry.sceneId,
          kind: entry.kind,
          ...(entry.timeline ? { timeline: readDebugTimeline(entry) } : {}),
        })),
        lights: Array.from(lightEntries, ([id, entry]) => ({
          id,
          sceneId: entry.sceneId,
          kind: entry.kind,
          ...(entry.timeline ? { timeline: readDebugTimeline(entry) } : {}),
        })),
      };
    },
    dispose(): void {
      disposeEntries(primitiveEntries);
      disposeEntries(lightEntries);
    },
  };
}

function updateTimelineEntries<TEntry extends RegistryEntry>(
  entries: Map<string, TEntry>,
  progressSignals: WebGLProgressSignalSource,
): void {
  for (const entry of entries.values()) {
    if (!entry.timeline?.active) {
      continue;
    }

    const snapshot = readTimelineProgress(entry.timeline, progressSignals);
    entry.timelineActive = snapshot.active;
    entry.controller.setVisible(entry.visible && snapshot.active);
  }
}

function readDebugTimeline(entry: RegistryEntry): {
  id: string;
  progressKey: string;
  active?: boolean;
} {
  const timeline = entry.timeline;

  if (!timeline) {
    throw new Error("Expected timeline metadata for debug summary.");
  }

  return {
    id: timeline.id,
    progressKey: timeline.progressKey,
    ...(entry.timelineActive !== undefined ? { active: entry.timelineActive } : {}),
  };
}

function unregisterEntry<TEntry extends RegistryEntry>(
  entries: Map<string, TEntry>,
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

function unregisterEntriesForScene<TEntry extends RegistryEntry>(
  entries: Map<string, TEntry>,
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

function disposeEntries<TEntry extends RegistryEntry>(
  entries: Map<string, TEntry>,
): void {
  for (const entry of entries.values()) {
    entry.controller.dispose();
  }

  entries.clear();
}
