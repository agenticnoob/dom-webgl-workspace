import type {
  WebGLDebugLightSummary,
  WebGLDebugMeshSummary,
  WebGLFrameInput,
  WebGLLightDeclaration,
  WebGLMeshDeclaration,
  WebGLProgressSignalSource,
} from "../types";
import type {
  WebGLEffectScopeSnapshot,
  WebGLSceneObjectEffectSourceKind,
  WebGLSceneObjectPointerState,
} from "../effects/effectAuthoring";
import type { WebGLEffectRegistry } from "../effects/effectRegistry";
import {
  createWebGLSceneObjectEffectController,
  type WebGLSceneObjectEffectController,
} from "../effects/sceneObjectEffectController";
import type { NormalizedTimelineBinding } from "../timeline/timelineDeclarations";
import { readTimelineProgress } from "../timeline/timelineDeclarations";

import {
  createManagedLightObject,
  createManagedMeshObject,
} from "./managedStageObjects";
import {
  normalizeLightDeclaration,
  normalizeMeshDeclaration,
  type NormalizedLightDeclaration,
  type NormalizedMeshDeclaration,
} from "./stageDeclarations";
import {
  inspectSceneObjectEffectKinds,
  inspectSceneObjectInteraction,
  type NormalizedSceneObjectInteractionDeclaration,
} from "./sceneObjectInteractionDeclarations";
import { createSceneObjectEffectObject } from "./sceneObjectEffectObject";
import type { ScreenPlanePlacementPlane } from "./screenPlanePlacement";
import type { ManagedHitCandidate } from "./interactionRouter";
import type { ManagedPhysicsCandidate } from "./physicsWorld";
import {
  createSceneObjectController,
  type WebGLSceneAdapter,
  type WebGLSceneObject,
  type WebGLSceneObjectController,
} from "./sceneObject";
import type { WebGLEffectsDeclaration } from "../types";
import type { NormalizedPhysicsDeclaration } from "./physicsDeclarations";

export type StageObjectRegistry = {
  registerMesh(declaration: WebGLMeshDeclaration): void;
  unregisterMesh(id: string): void;
  registerLight(declaration: WebGLLightDeclaration): void;
  unregisterLight(id: string): void;
  unregisterScene(sceneId: string): void;
  updateTimelineState(progressSignals: WebGLProgressSignalSource): void;
  updateEffects(input: WebGLFrameInput): boolean;
  collectHitCandidates(): ManagedHitCandidate[];
  collectPhysicsCandidates(): ManagedPhysicsCandidate[];
  readMeshPlane(
    planeId: string,
    sceneId: string,
  ): ScreenPlanePlacementPlane | undefined;
  inspect(): StageObjectRegistryDebugState;
  dispose(): void;
};

export type StageObjectRegistryDebugState = {
  meshes: WebGLDebugMeshSummary[];
  lights: WebGLDebugLightSummary[];
};

export type StageObjectRegistryOptions = {
  getSceneAdapter(sceneId: string): WebGLSceneAdapter;
  createMeshObject?(declaration: NormalizedMeshDeclaration): WebGLSceneObject;
  createLightObject?(declaration: NormalizedLightDeclaration): WebGLSceneObject;
  effectRegistry?: WebGLEffectRegistry;
  readEffectScopes?(sceneId: string): WebGLEffectScopeSnapshot;
  readObjectPointerState?(objectId: string): WebGLSceneObjectPointerState;
};

type RegistryEntry = {
  sceneId: string;
  visible: boolean;
  controller: WebGLSceneObjectController;
  timeline?: NormalizedTimelineBinding;
  timelineActive?: boolean;
  effectController?: WebGLSceneObjectEffectController;
};

type MeshRegistryEntry = RegistryEntry & {
  geometryKind: WebGLMeshDeclaration["geometry"]["kind"];
  effects?: WebGLEffectsDeclaration;
  interaction?: NormalizedSceneObjectInteractionDeclaration;
  physics?: NormalizedPhysicsDeclaration;
  screenPlane?: ScreenPlanePlacementPlane;
};

type LightRegistryEntry = RegistryEntry & {
  kind: WebGLLightDeclaration["kind"];
};

export function createStageObjectRegistry(
  options: StageObjectRegistryOptions,
): StageObjectRegistry {
  const meshEntries = new Map<string, MeshRegistryEntry>();
  const lightEntries = new Map<string, LightRegistryEntry>();
  const createMeshObject = options.createMeshObject ?? createManagedMeshObject;
  const createLightObject = options.createLightObject ?? createManagedLightObject;

  return {
    registerMesh(declaration): void {
      const normalized = normalizeMeshDeclaration(declaration);

      if (meshEntries.has(normalized.id)) {
        throw new Error(`WebGL mesh id "${normalized.id}" is already registered.`);
      }

      const adapter = options.getSceneAdapter(normalized.sceneId);
      const object = createMeshObject(normalized);
      const controller = createSceneObjectController(adapter, object);
      const screenPlane = createMeshScreenPlaneFact(normalized);
      let effectController: WebGLSceneObjectEffectController | undefined;

      try {
        effectController = createRegistryEffectController(options, {
          id: normalized.id,
          sceneId: normalized.sceneId,
          sourceKind: "mesh",
          object,
          effects: normalized.effects,
        });
        controller.attach();
        meshEntries.set(normalized.id, {
          sceneId: normalized.sceneId,
          geometryKind: normalized.geometry.kind,
          visible: normalized.visible,
          ...(normalized.timeline ? { timeline: normalized.timeline } : {}),
          ...(normalized.effects ? { effects: normalized.effects } : {}),
          ...(normalized.interaction ? { interaction: normalized.interaction } : {}),
          ...(normalized.physics ? { physics: normalized.physics } : {}),
          ...(screenPlane ? { screenPlane } : {}),
          ...(effectController ? { effectController } : {}),
          controller,
        });
      } catch (error: unknown) {
        effectController?.dispose();
        controller.dispose();
        throw error;
      }
    },
    unregisterMesh(id): void {
      unregisterEntry(meshEntries, id);
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

      unregisterEntriesForScene(meshEntries, normalizedSceneId);
      unregisterEntriesForScene(lightEntries, normalizedSceneId);
    },
    updateTimelineState(progressSignals): void {
      updateTimelineEntries(meshEntries, progressSignals);
      updateTimelineEntries(lightEntries, progressSignals);
    },
    updateEffects(input): boolean {
      let continuous = false;

      for (const entry of meshEntries.values()) {
        if (!entry.effectController || !readEffectiveVisibility(entry)) {
          continue;
        }

        entry.effectController.update(input);
        continuous =
          continuous || entry.effectController.schedulingMode === "frame";
      }

      return continuous;
    },
    collectHitCandidates(): ManagedHitCandidate[] {
      const meshes: ManagedHitCandidate[] = Array.from(meshEntries.values()).flatMap((entry) => {
        const pickable = entry.interaction?.pickable;
        if (!pickable || !readEffectiveVisibility(entry)) {
          return [];
        }

        return [
          {
            id: entry.controller.object.key,
            sceneId: entry.sceneId,
            sourceKind: "mesh" satisfies WebGLSceneObjectEffectSourceKind,
            object3D: entry.controller.object.object3D,
            hitTest: pickable.hitTest,
            pickable: true,
            pointer: pickable.pointer,
          },
        ];
      });
      return meshes;
    },
    collectPhysicsCandidates(): ManagedPhysicsCandidate[] {
      const meshes: ManagedPhysicsCandidate[] = Array.from(meshEntries).flatMap(([id, entry]) => {
        if (!entry.physics?.body || !readEffectiveVisibility(entry)) {
          return [];
        }

        return [
          {
            id,
            sceneId: entry.sceneId,
            sourceKind: "mesh" satisfies WebGLSceneObjectEffectSourceKind,
            object: entry.controller.object,
            physics: entry.physics,
            ...(options.readObjectPointerState
              ? { objectPointer: options.readObjectPointerState(id) }
              : {}),
          },
        ];
      });
      return meshes;
    },
    readMeshPlane(planeId, sceneId): ScreenPlanePlacementPlane | undefined {
      const meshEntry = meshEntries.get(planeId.trim());
      if (meshEntry?.screenPlane && meshEntry.sceneId === sceneId.trim()) {
        return meshEntry.screenPlane;
      }

      return undefined;
    },
    inspect(): StageObjectRegistryDebugState {
      return {
        meshes: Array.from(meshEntries, ([id, entry]) => ({
          id,
          sceneId: entry.sceneId,
          geometryKind: entry.geometryKind,
          ...(entry.timeline ? { timeline: readDebugTimeline(entry) } : {}),
          ...(entry.effects
            ? { effects: inspectSceneObjectEffectKinds(entry.effects) }
            : {}),
          ...(entry.interaction
            ? { interaction: inspectSceneObjectInteraction(entry.interaction) }
            : {}),
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
      disposeEntries(meshEntries);
      disposeEntries(lightEntries);
    },
  };
}

function createMeshScreenPlaneFact(
  declaration: NormalizedMeshDeclaration,
): ScreenPlanePlacementPlane | undefined {
  switch (declaration.geometry.kind) {
    case "plane":
      return {
        id: declaration.id,
        sceneId: declaration.sceneId,
        position: declaration.position,
        rotation: declaration.rotation,
        scale: declaration.scale,
        size: declaration.geometry.size,
      };
    case "box":
    case "sphere":
    case "cylinder":
    case "cone":
    case "tetrahedron":
    case "custom":
      return undefined;
  }
}

function createRegistryEffectController(
  options: StageObjectRegistryOptions,
  input: {
    id: string;
    sceneId: string;
    sourceKind: WebGLSceneObjectEffectSourceKind;
    object: WebGLSceneObject;
    effects: WebGLEffectsDeclaration | undefined;
  },
): WebGLSceneObjectEffectController | undefined {
  if (!input.effects) {
    return undefined;
  }

  const effectObject = createSceneObjectEffectObject({
    sourceKind: input.sourceKind,
    object: input.object,
  });

  return createWebGLSceneObjectEffectController({
    objectId: input.id,
    sourceKind: input.sourceKind,
    declaration: input.effects,
    getObject() {
      return effectObject;
    },
    ...(options.effectRegistry ? { registry: options.effectRegistry } : {}),
    ...(options.readObjectPointerState
      ? {
          getObjectPointerState() {
            return options.readObjectPointerState?.(input.id);
          },
        }
      : {}),
    readScopes() {
      return readEffectScopes(options, input.sceneId);
    },
  });
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

function readEffectiveVisibility(entry: RegistryEntry): boolean {
  return entry.visible && (entry.timelineActive ?? true);
}

function readEffectScopes(
  options: StageObjectRegistryOptions,
  sceneId: string,
): WebGLEffectScopeSnapshot {
  return (
    options.readEffectScopes?.(sceneId) ?? {
      runtime: {
        progress: {
          get() {
            return 0;
          },
        },
      },
      scene: { id: sceneId, projection: "perspective-stage" },
    }
  );
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

  entry.effectController?.dispose();
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

    entry.effectController?.dispose();
    entry.controller.dispose();
    entries.delete(id);
  }
}

function disposeEntries<TEntry extends RegistryEntry>(
  entries: Map<string, TEntry>,
): void {
  for (const entry of entries.values()) {
    entry.effectController?.dispose();
    entry.controller.dispose();
  }

  entries.clear();
}
