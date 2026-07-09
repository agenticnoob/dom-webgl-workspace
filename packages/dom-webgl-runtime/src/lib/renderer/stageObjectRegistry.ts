import type {
  WebGLDebugLightSummary,
  WebGLDebugStagePrimitiveSummary,
  WebGLFrameInput,
  WebGLLightDeclaration,
  WebGLProgressSignalSource,
  WebGLStagePrimitiveDeclaration,
} from "../types";
import type {
  WebGLEffectScopeSnapshot,
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
  createManagedStagePrimitiveObject,
} from "./managedStageObjects";
import {
  normalizeLightDeclaration,
  normalizeStagePrimitiveDeclaration,
  type NormalizedLightDeclaration,
  type NormalizedStagePrimitiveDeclaration,
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
  registerStagePrimitive(declaration: WebGLStagePrimitiveDeclaration): void;
  unregisterStagePrimitive(id: string): void;
  registerLight(declaration: WebGLLightDeclaration): void;
  unregisterLight(id: string): void;
  unregisterScene(sceneId: string): void;
  updateTimelineState(progressSignals: WebGLProgressSignalSource): void;
  updateEffects(input: WebGLFrameInput): boolean;
  collectHitCandidates(): ManagedHitCandidate[];
  collectPhysicsCandidates(): ManagedPhysicsCandidate[];
  readStagePlane(
    planeId: string,
    sceneId: string,
  ): ScreenPlanePlacementPlane | undefined;
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

type StagePrimitiveRegistryEntry = RegistryEntry & {
  kind: WebGLStagePrimitiveDeclaration["kind"];
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
      const screenPlane = createScreenPlaneFact(normalized);
      const effectObject = normalized.effects
        ? createSceneObjectEffectObject({
            sourceKind: readStagePrimitiveSourceKind(normalized.kind),
            object,
          })
        : undefined;
      const effectController = normalized.effects
        ? createWebGLSceneObjectEffectController({
            objectId: normalized.id,
            sourceKind: readStagePrimitiveSourceKind(normalized.kind),
            declaration: normalized.effects,
            getObject() {
              return effectObject;
            },
            ...(options.effectRegistry ? { registry: options.effectRegistry } : {}),
            ...(options.readObjectPointerState
              ? {
                  getObjectPointerState() {
                    return options.readObjectPointerState?.(normalized.id);
                  },
                }
              : {}),
            readScopes() {
              return readEffectScopes(options, normalized.sceneId);
            },
          })
        : undefined;

      controller.attach();
      primitiveEntries.set(normalized.id, {
        sceneId: normalized.sceneId,
        kind: normalized.kind,
        visible: normalized.visible,
        ...(normalized.timeline ? { timeline: normalized.timeline } : {}),
        ...(normalized.effects ? { effects: normalized.effects } : {}),
        ...(normalized.interaction ? { interaction: normalized.interaction } : {}),
        ...(normalized.physics ? { physics: normalized.physics } : {}),
        ...(screenPlane ? { screenPlane } : {}),
        ...(effectController ? { effectController } : {}),
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
    updateEffects(input): boolean {
      let continuous = false;

      for (const entry of primitiveEntries.values()) {
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
      return Array.from(primitiveEntries.values()).flatMap((entry) => {
        const pickable = entry.interaction?.pickable;
        if (!pickable || !readEffectiveVisibility(entry)) {
          return [];
        }

        return [
          {
            id: entry.controller.object.key,
            sceneId: entry.sceneId,
            sourceKind: readStagePrimitiveSourceKind(entry.kind),
            object3D: entry.controller.object.object3D,
            hitTest: pickable.hitTest,
            pickable: true,
            pointer: pickable.pointer,
          },
        ];
      });
    },
    collectPhysicsCandidates(): ManagedPhysicsCandidate[] {
      return Array.from(primitiveEntries).flatMap(([id, entry]) => {
        if (!entry.physics?.body || !readEffectiveVisibility(entry)) {
          return [];
        }

        return [
          {
            id,
            sceneId: entry.sceneId,
            sourceKind: readStagePrimitiveSourceKind(entry.kind),
            object: entry.controller.object,
            physics: entry.physics,
            ...(options.readObjectPointerState
              ? { objectPointer: options.readObjectPointerState(id) }
              : {}),
          },
        ];
      });
    },
    readStagePlane(planeId, sceneId): ScreenPlanePlacementPlane | undefined {
      const entry = primitiveEntries.get(planeId.trim());
      if (!entry?.screenPlane || entry.sceneId !== sceneId.trim()) {
        return undefined;
      }

      return entry.screenPlane;
    },
    inspect(): StageObjectRegistryDebugState {
      return {
        stagePrimitives: Array.from(primitiveEntries, ([id, entry]) => ({
          id,
          sceneId: entry.sceneId,
          kind: entry.kind,
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
      disposeEntries(primitiveEntries);
      disposeEntries(lightEntries);
    },
  };
}

function createScreenPlaneFact(
  declaration: NormalizedStagePrimitiveDeclaration,
): ScreenPlanePlacementPlane | undefined {
  switch (declaration.kind) {
    case "plane":
      return {
        id: declaration.id,
        sceneId: declaration.sceneId,
        position: declaration.position,
        rotation: declaration.rotation,
        scale: declaration.scale,
        size: declaration.size,
      };
    case "box":
      return undefined;
  }
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

function readStagePrimitiveSourceKind(
  kind: WebGLStagePrimitiveDeclaration["kind"],
): "stage/plane" | "stage/box" {
  switch (kind) {
    case "plane":
      return "stage/plane";
    case "box":
      return "stage/box";
  }
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
