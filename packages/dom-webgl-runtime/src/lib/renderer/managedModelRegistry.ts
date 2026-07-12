import { loadGLBModel } from "../assets/modelLoader";
import type {
  WebGLEffectScopeSnapshot,
  WebGLEffectSourceHandle,
  WebGLSceneObjectPointerState,
  WebGLModelEffectHandle,
} from "../effects/effectAuthoring";
import type { WebGLEffectObjectHandle } from "../effects/effectObject";
import type { WebGLEffectAnimationPlayOptions } from "../effects/effectObject";
import type { WebGLEffectRegistry } from "../effects/effectRegistry";
import {
  createWebGLSceneObjectEffectController,
  type WebGLSceneObjectEffectController,
} from "../effects/sceneObjectEffectController";
import type { ResourceHandle, ResourceManager } from "../resources/resourceManager";
import {
  createModelAnimationController,
  type ModelAnimationController,
  type ModelAnimationDiagnostic,
} from "../render/renderables/modelAnimationControls";
import { createModelEffectHandle } from "../render/renderables/modelEffectHandle";
import {
  createModelMorphControls,
  type ModelMorphControls,
  type ModelMorphDiagnostic,
} from "../render/renderables/modelMorphControls";
import {
  createModelRuntimeRoot,
  disposeModelSceneObject,
  instantiateModelSceneObject,
} from "../render/renderables/modelSceneObjects";
import type { WebGLModelSourceDescriptor } from "../source/sourceDescriptor";
import {
  normalizeTimelineBinding,
  readTimelineProgress,
  type NormalizedTimelineBinding,
  type TimelineProgressSnapshot,
} from "../timeline/timelineDeclarations";
import type {
  WebGLDebugModelDiagnostic,
  WebGLDebugModelPrepareSummary,
  WebGLDebugModelSummary,
  WebGLEffectsDeclaration,
  WebGLFrameInput,
  WebGLModelAnimationDeclaration,
  WebGLModelClipBlendDeclaration,
  WebGLModelClipPlaybackDeclaration,
  WebGLModelClipScrubDeclaration,
  WebGLModelDeclaration,
  WebGLModelLoaderDeclaration,
  WebGLModelMorphWeightDeclaration,
  WebGLModelPrepareDeclaration,
  WebGLProgressSignalSource,
  WebGLTuple3,
} from "../types";
import {
  inspectSceneObjectEffectKinds,
  inspectSceneObjectInteraction,
  normalizeSceneObjectEffects,
  normalizeSceneObjectInteraction,
  type NormalizedSceneObjectInteractionDeclaration,
} from "./sceneObjectInteractionDeclarations";
import {
  normalizePhysicsDeclaration,
  type NormalizedPhysicsDeclaration,
} from "./physicsDeclarations";
import { createSceneObjectEffectObject } from "./sceneObjectEffectObject";
import type { ManagedHitCandidate } from "./interactionRouter";
import type { ManagedPhysicsCandidate } from "./physicsWorld";
import {
  createSceneObjectController,
  type WebGLSceneAdapter,
  type WebGLSceneObject,
  type WebGLSceneObjectController,
} from "./sceneObject";

export type ManagedModelRegistry = {
  registerModel(declaration: WebGLModelDeclaration): void;
  unregisterModel(id: string): void;
  unregisterScene(sceneId: string): void;
  update(
    input: ManagedModelUpdateInput,
    progressSignals: WebGLProgressSignalSource,
    preparePolicy?: ManagedModelPreparePolicy,
  ): boolean | Promise<boolean>;
  consumeRenderWarmupRequests(): ManagedModelPrepareRequest[];
  collectHitCandidates(): ManagedHitCandidate[];
  collectPhysicsCandidates(): ManagedPhysicsCandidate[];
  markRenderWarmupComplete(id: string): void;
  inspect(): ManagedModelRegistryDebugState;
  dispose(): void;
};

export type ManagedModelRegistryDebugState = {
  models: WebGLDebugModelSummary[];
};

export type ManagedModelPrepareRequest = {
  readonly id: string;
  readonly sceneId: string;
};

export type ManagedModelPreparePolicy = {
  canLoadPreparedModel(request: {
    readonly id: string;
    readonly sceneId: string;
  }): boolean;
};

export type ManagedModelRegistryOptions = {
  resourceManager: ResourceManager;
  getSceneAdapter(sceneId: string): WebGLSceneAdapter;
  loadModel?(source: WebGLModelSourceDescriptor): Promise<unknown>;
  modelLoader?: WebGLModelLoaderDeclaration;
  effectRegistry?: WebGLEffectRegistry;
  readEffectScopes?(sceneId: string): WebGLEffectScopeSnapshot;
  readObjectPointerState?(objectId: string): WebGLSceneObjectPointerState;
};

export type ManagedModelUpdateInput = { readonly delta: number } & Partial<
  WebGLFrameInput
>;

type NormalizedModelDeclaration = {
  readonly id: string;
  readonly sceneId: string;
  readonly source: WebGLModelSourceDescriptor;
  readonly position: WebGLTuple3;
  readonly rotation: WebGLTuple3;
  readonly scale: WebGLTuple3;
  readonly visible: boolean;
  readonly timeline?: NormalizedTimelineBinding;
  readonly animation?: NormalizedModelAnimationDeclaration;
  readonly prepare?: NormalizedModelPrepareDeclaration;
  readonly effects?: WebGLEffectsDeclaration;
  readonly interaction?: NormalizedSceneObjectInteractionDeclaration;
  readonly physics?: NormalizedPhysicsDeclaration;
};

type NormalizedModelAnimationDeclaration = {
  readonly defaultClips: readonly NormalizedModelClipPlaybackDeclaration[];
  readonly scrub?: NormalizedModelClipScrubDeclaration;
  readonly blend?: NormalizedModelClipBlendDeclaration;
  readonly morphs: readonly NormalizedModelMorphWeightDeclaration[];
};

type NormalizedModelClipPlaybackDeclaration = {
  readonly clip: string;
  readonly options: WebGLEffectAnimationPlayOptions;
};

type NormalizedModelClipScrubDeclaration = {
  readonly clip: string;
  readonly timeline: NormalizedTimelineBinding;
  readonly durationSeconds?: number;
  readonly range?: { readonly from: number; readonly to: number };
};

type NormalizedModelClipBlendDeclaration = {
  readonly from: string;
  readonly to: string;
  readonly timeline: NormalizedTimelineBinding;
  readonly fadeMs?: number;
  readonly range?: { readonly from: number; readonly to: number };
};

type NormalizedModelMorphWeightDeclaration = {
  readonly name: string;
  readonly weight?: number;
  readonly timeline?: NormalizedTimelineBinding;
  readonly from: number;
  readonly to: number;
};

type NormalizedModelPrepareDeclaration = {
  readonly renderWarmup?: "idle";
};

type ManagedModelEntry = {
  readonly declaration: NormalizedModelDeclaration;
  readonly resource: ResourceHandle<unknown>;
  readonly controller?: WebGLSceneObjectController;
  readonly modelHandle?: WebGLModelEffectHandle;
  readonly effectObject?: WebGLEffectObjectHandle;
  readonly effectController?: WebGLSceneObjectEffectController;
  readonly morphControls?: ModelMorphControls;
  readonly animation?: ModelAnimationController;
  readonly loadPromise?: Promise<boolean>;
  readonly timelineSnapshot?: TimelineProgressSnapshot;
  readonly defaultClipsStarted?: boolean;
  readonly prepareLoad?: "queued" | "loading" | "ready";
  readonly renderWarmup?: "pending" | "complete";
  readonly disposed?: boolean;
  readonly error?: unknown;
};

type ModelObject3DLike = {
  visible?: boolean;
  position?: { set?(x: number, y: number, z: number): void; x?: number; y?: number; z?: number };
  rotation?: { set?(x: number, y: number, z: number): void; x?: number; y?: number; z?: number };
  scale?: { set?(x: number, y: number, z: number): void; x?: number; y?: number; z?: number };
};

export function createManagedModelRegistry(
  options: ManagedModelRegistryOptions,
): ManagedModelRegistry {
  const entries = new Map<string, ManagedModelEntry>();
  const loadModel =
    options.loadModel ??
    ((source: WebGLModelSourceDescriptor) =>
      loadGLBModel(source, { runtimeLoader: options.modelLoader }));

  return {
    registerModel(declaration): void {
      const normalized = normalizeModelDeclaration(declaration);

      if (entries.has(normalized.id)) {
        unregisterEntry(entries, normalized.id);
      }

      entries.set(normalized.id, {
        declaration: normalized,
        resource: options.resourceManager.acquire<unknown>(normalized.source),
      });
    },
    unregisterModel(id): void {
      unregisterEntry(entries, id.trim());
    },
    unregisterScene(sceneId): void {
      const normalizedSceneId = sceneId.trim();

      for (const [id, entry] of [...entries]) {
        if (entry.declaration.sceneId === normalizedSceneId) {
          unregisterEntry(entries, id);
        }
      }
    },
    update(input, progressSignals, preparePolicy): boolean | Promise<boolean> {
      const pendingLoads: Array<Promise<boolean>> = [];
      let continuous = false;

      for (const entry of entries.values()) {
        const visible = syncEntryTimeline(entry, progressSignals);

        if (!entry.controller) {
          if (!canStartModelLoad(entry, preparePolicy)) {
            Object.assign(entry, { prepareLoad: "queued" as const });
            continue;
          }

          Object.assign(entry, {
            prepareLoad: entry.declaration.prepare
              ? ("loading" as const)
              : undefined,
          });
          pendingLoads.push(loadEntry(entry, visible, progressSignals));
          continue;
        }

        entry.controller.setVisible(visible);
        if (visible) {
          updateEntryAnimation(entry, input.delta, progressSignals);
          updateEntryEffects(entry, input);
        }
        continuous =
          continuous ||
          shouldRenderContinuously(entry, visible) ||
          shouldRunEffectsContinuously(entry, visible);
      }

      if (pendingLoads.length === 0) {
        return continuous;
      }

      return Promise.all(pendingLoads).then((results) => {
        return (
          results.some(Boolean) ||
          Array.from(entries.values()).some((entry) =>
            shouldRenderContinuously(entry, readEffectiveVisibility(entry)) ||
            shouldRunEffectsContinuously(entry, readEffectiveVisibility(entry)),
          )
        );
      });
    },
    consumeRenderWarmupRequests(): ManagedModelPrepareRequest[] {
      const requests: ManagedModelPrepareRequest[] = [];

      for (const entry of entries.values()) {
        if (entry.renderWarmup !== "pending") {
          continue;
        }
        if (!entry.controller || !readEffectiveVisibility(entry)) {
          continue;
        }

        requests.push({
          id: entry.declaration.id,
          sceneId: entry.declaration.sceneId,
        });
      }

      return requests;
    },
    collectHitCandidates(): ManagedHitCandidate[] {
      return Array.from(entries.values()).flatMap((entry) => {
        const pickable = entry.declaration.interaction?.pickable;
        if (!pickable || !entry.controller || !readEffectiveVisibility(entry)) {
          return [];
        }

        return [
          {
            id: entry.declaration.id,
            sceneId: entry.declaration.sceneId,
            sourceKind: "model/glb",
            object3D: entry.controller.object.object3D,
            hitTest: pickable.hitTest,
            pickable: true,
            pointer: pickable.pointer,
          },
        ];
      });
    },
    collectPhysicsCandidates(): ManagedPhysicsCandidate[] {
      return Array.from(entries.values()).flatMap((entry) => {
        if (
          !entry.declaration.physics?.body ||
          !entry.controller ||
          !readEffectiveVisibility(entry)
        ) {
          return [];
        }

        return [
          {
            id: entry.declaration.id,
            sceneId: entry.declaration.sceneId,
            sourceKind: "model/glb",
            object: entry.controller.object,
            physics: entry.declaration.physics,
            ...(options.readObjectPointerState
              ? {
                  objectPointer: options.readObjectPointerState(
                    entry.declaration.id,
                  ),
                }
              : {}),
          },
        ];
      });
    },
    markRenderWarmupComplete(id): void {
      const entry = entries.get(id.trim());
      if (entry?.renderWarmup === "pending") {
        Object.assign(entry, { renderWarmup: "complete" as const });
      }
    },
    inspect(): ManagedModelRegistryDebugState {
      return {
        models: Array.from(entries.values(), inspectEntry),
      };
    },
    dispose(): void {
      disposeEntries(entries);
    },
  };

  function loadEntry(
    entry: ManagedModelEntry,
    visible: boolean,
    progressSignals: WebGLProgressSignalSource,
  ): Promise<boolean> {
    if (entry.loadPromise) {
      return entry.loadPromise;
    }

    const loadPromise = entry.resource
      .load(() => loadModel(entry.declaration.source))
      .then((model) => {
        if (entry.disposed) {
          return false;
        }

        const modelObject3D = instantiateModelSceneObject(model);
        const root = createModelRuntimeRoot(modelObject3D);
        applyModelTransform(root, entry.declaration);
        const modelForControls = createModelForControls(model, modelObject3D);
        const animation = createModelAnimationController(modelForControls);
        const morphControls = createModelMorphControls(modelObject3D);
        const modelHandle = createModelEffectHandle(modelObject3D, {
          animation,
          morphControls,
        });
        const sceneObject = createManagedModelSceneObject(
          entry.declaration.id,
          root,
        );
        const controller = createSceneObjectController(
          options.getSceneAdapter(entry.declaration.sceneId),
          sceneObject,
        );
        const effectSource: WebGLEffectSourceHandle = {
          kind: "model",
          type: "glb",
          anchor: entry.declaration.source.anchor,
          src: entry.declaration.source.src,
          model: modelHandle,
        };
        const effectObject = entry.declaration.effects
          ? createSceneObjectEffectObject({
              sourceKind: "model/glb",
              object: sceneObject,
              source: effectSource,
            })
          : undefined;
        const effectController = entry.declaration.effects
          ? createWebGLSceneObjectEffectController({
              objectId: entry.declaration.id,
              sourceKind: "model/glb",
              declaration: entry.declaration.effects,
              getObject() {
                return effectObject;
              },
              ...(options.effectRegistry
                ? { registry: options.effectRegistry }
                : {}),
              ...(options.readObjectPointerState
                ? {
                    getObjectPointerState() {
                      return options.readObjectPointerState?.(
                        entry.declaration.id,
                      );
                    },
                  }
                : {}),
              readScopes() {
                return readEffectScopes(options, entry.declaration.sceneId);
              },
            })
          : undefined;

        controller.attach();
        controller.setVisible(visible);
        Object.assign(entry, {
          controller,
          modelHandle,
          ...(effectObject ? { effectObject } : {}),
          ...(effectController ? { effectController } : {}),
          morphControls,
          ...(animation ? { animation } : {}),
          ...(entry.declaration.prepare
            ? { prepareLoad: "ready" as const }
            : {}),
          ...(entry.declaration.prepare?.renderWarmup === "idle"
            ? { renderWarmup: "pending" as const }
            : {}),
        });
        updateEntryAnimation(entry, 0, progressSignals);
        if (visible) {
          updateEntryEffects(entry, { delta: 0 });
        }

        return (
          shouldRenderContinuously(entry, visible) ||
          shouldRunEffectsContinuously(entry, visible)
        );
      })
      .catch((error: unknown) => {
        Object.assign(entry, { error });
        throw error;
      });

    Object.assign(entry, { loadPromise });
    return loadPromise;
  }
}

function canStartModelLoad(
  entry: ManagedModelEntry,
  preparePolicy: ManagedModelPreparePolicy | undefined,
): boolean {
  if (!entry.declaration.prepare) {
    return true;
  }

  return (
    preparePolicy?.canLoadPreparedModel({
      id: entry.declaration.id,
      sceneId: entry.declaration.sceneId,
    }) ?? true
  );
}

function normalizeModelDeclaration(
  declaration: WebGLModelDeclaration,
): NormalizedModelDeclaration {
  const id = normalizeRequiredString(declaration.id, "WebGL model id");
  const sceneId = normalizeRequiredString(
    declaration.sceneId,
    `WebGL model "${id}" sceneId`,
  );
  const src = normalizeRequiredString(
    declaration.src,
    `WebGL model "${id}" src`,
  );
  const prepare = normalizeModelPrepareDeclaration(declaration.prepare);
  const effects = normalizeSceneObjectEffects(declaration.effects);
  const interaction = normalizeSceneObjectInteraction(declaration.interaction);
  const physics = normalizePhysicsDeclaration(declaration.physics);

  return {
    id,
    sceneId,
    source: {
      kind: "model",
      type: "glb",
      anchor: createModelAnchor(),
      src,
      ...(declaration.loader ? { loader: declaration.loader } : {}),
    },
    position: normalizeTuple3(declaration.position, [0, 0, 0]),
    rotation: normalizeTuple3(declaration.rotation, [0, 0, 0]),
    scale: normalizeScale(declaration.scale),
    visible: declaration.visible ?? true,
    ...(declaration.timeline
      ? { timeline: normalizeTimelineBinding(declaration.timeline) }
      : {}),
    ...(declaration.animation
      ? { animation: normalizeModelAnimationDeclaration(declaration.animation) }
      : {}),
    ...(prepare ? { prepare } : {}),
    ...(effects ? { effects } : {}),
    ...(interaction ? { interaction } : {}),
    ...(physics ? { physics } : {}),
  };
}

function normalizeModelPrepareDeclaration(
  declaration: WebGLModelPrepareDeclaration | undefined,
): NormalizedModelPrepareDeclaration | undefined {
  if (declaration?.renderWarmup !== "idle") {
    return undefined;
  }

  return { renderWarmup: "idle" };
}

function normalizeModelAnimationDeclaration(
  declaration: WebGLModelAnimationDeclaration,
): NormalizedModelAnimationDeclaration {
  return {
    defaultClips: [
      ...(declaration.defaultClip
        ? [normalizeClipPlaybackDeclaration(declaration.defaultClip)]
        : []),
      ...(declaration.defaultClips ?? []).map(normalizeClipPlaybackDeclaration),
    ],
    ...(declaration.scrub
      ? { scrub: normalizeClipScrubDeclaration(declaration.scrub) }
      : {}),
    ...(declaration.blend
      ? { blend: normalizeClipBlendDeclaration(declaration.blend) }
      : {}),
    morphs: (declaration.morphs ?? []).map(normalizeMorphWeightDeclaration),
  };
}

function normalizeClipPlaybackDeclaration(
  declaration: WebGLModelClipPlaybackDeclaration,
): NormalizedModelClipPlaybackDeclaration {
  if (typeof declaration === "string") {
    return {
      clip: normalizeRequiredString(declaration, "WebGL model animation clip"),
      options: {},
    };
  }

  const options: WebGLEffectAnimationPlayOptions = {};
  if (declaration.loop) {
    options.loop = declaration.loop;
  }
  if (declaration.fadeInMs !== undefined) {
    options.fadeInMs = declaration.fadeInMs;
  }
  if (declaration.fadeOutMs !== undefined) {
    options.fadeOutMs = declaration.fadeOutMs;
  }
  if (declaration.clampWhenFinished !== undefined) {
    options.clampWhenFinished = declaration.clampWhenFinished;
  }
  if (declaration.timeScale !== undefined) {
    options.timeScale = declaration.timeScale;
  }

  return {
    clip: normalizeRequiredString(
      declaration.clip,
      "WebGL model animation clip",
    ),
    options,
  };
}

function normalizeClipScrubDeclaration(
  declaration: WebGLModelClipScrubDeclaration,
): NormalizedModelClipScrubDeclaration {
  return {
    clip: normalizeRequiredString(declaration.clip, "WebGL model scrub clip"),
    timeline: normalizeRequiredTimeline(declaration.timeline),
    ...(declaration.durationSeconds !== undefined
      ? { durationSeconds: Math.max(0, declaration.durationSeconds) }
      : {}),
    ...(declaration.range
      ? { range: normalizeRange(declaration.range.from, declaration.range.to) }
      : {}),
  };
}

function normalizeClipBlendDeclaration(
  declaration: WebGLModelClipBlendDeclaration,
): NormalizedModelClipBlendDeclaration {
  return {
    from: normalizeRequiredString(declaration.from, "WebGL model blend from clip"),
    to: normalizeRequiredString(declaration.to, "WebGL model blend to clip"),
    timeline: normalizeRequiredTimeline(declaration.timeline),
    ...(declaration.fadeMs !== undefined ? { fadeMs: declaration.fadeMs } : {}),
    ...(declaration.range
      ? { range: normalizeRange(declaration.range.from, declaration.range.to) }
      : {}),
  };
}

function normalizeMorphWeightDeclaration(
  declaration: WebGLModelMorphWeightDeclaration,
): NormalizedModelMorphWeightDeclaration {
  return {
    name: normalizeRequiredString(declaration.name, "WebGL model morph name"),
    ...(declaration.weight !== undefined
      ? { weight: clamp01(declaration.weight) }
      : {}),
    ...(declaration.timeline
      ? { timeline: normalizeRequiredTimeline(declaration.timeline) }
      : {}),
    from: clamp01(declaration.from ?? 0),
    to: clamp01(declaration.to ?? declaration.weight ?? 1),
  };
}

function normalizeRequiredTimeline(
  timeline: Parameters<typeof normalizeTimelineBinding>[0],
): NormalizedTimelineBinding {
  const normalized = normalizeTimelineBinding(timeline);

  if (!normalized) {
    throw new Error("Expected a WebGL timeline binding.");
  }

  return normalized;
}

function syncEntryTimeline(
  entry: ManagedModelEntry,
  progressSignals: WebGLProgressSignalSource,
): boolean {
  if (!entry.declaration.timeline) {
    return entry.declaration.visible;
  }

  const snapshot = readTimelineProgress(entry.declaration.timeline, progressSignals);
  Object.assign(entry, { timelineSnapshot: snapshot });
  return entry.declaration.visible && snapshot.active;
}

function updateEntryAnimation(
  entry: ManagedModelEntry,
  deltaMilliseconds: number,
  progressSignals: WebGLProgressSignalSource,
): void {
  const animation = entry.animation;
  const declaration = entry.declaration.animation;

  if (!declaration) {
    animation?.update(deltaMilliseconds);
    return;
  }

  if (
    animation &&
    declaration.defaultClips.length > 0 &&
    !entry.defaultClipsStarted
  ) {
    for (const clip of declaration.defaultClips) {
      animation.play(clip.clip, clip.options);
    }
    Object.assign(entry, { defaultClipsStarted: true });
  }

  if (animation && declaration.scrub) {
    const progress = readAnimationProgress(declaration.scrub, progressSignals);
    animation.scrub(declaration.scrub.clip, {
      progress,
      durationSeconds: declaration.scrub.durationSeconds ?? 1,
    });
  }

  if (animation && declaration.blend) {
    animation.blend(declaration.blend.from, declaration.blend.to, {
      weight: readAnimationProgress(declaration.blend, progressSignals),
    });
  }

  for (const morph of declaration.morphs) {
    const weight = morph.timeline
      ? mix(morph.from, morph.to, readTimelineProgress(morph.timeline, progressSignals).progress)
      : morph.weight ?? morph.to;
    entry.morphControls?.set(morph.name, weight);
  }

  animation?.update(deltaMilliseconds);
}

function updateEntryEffects(
  entry: ManagedModelEntry,
  input: ManagedModelUpdateInput,
): void {
  entry.effectController?.update(createManagedModelFrameInput(input));
}

function shouldRenderContinuously(
  entry: ManagedModelEntry,
  visible: boolean,
): boolean {
  return visible && (entry.animation?.inspect().activeClips.length ?? 0) > 0;
}

function shouldRunEffectsContinuously(
  entry: ManagedModelEntry,
  visible: boolean,
): boolean {
  return visible && entry.effectController?.schedulingMode === "frame";
}

function readEffectScopes(
  options: ManagedModelRegistryOptions,
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

function createManagedModelFrameInput(
  input: ManagedModelUpdateInput,
): WebGLFrameInput {
  return {
    time: input.time ?? 0,
    delta: input.delta,
    scroll: input.scroll ?? {
      mode: "page",
      pageProgress: 0,
      direction: 0,
      velocity: 0,
    },
    pointer: input.pointer ?? {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: false,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
      buttons: [],
      modifiers: { shift: false, alt: false, ctrl: false, meta: false },
    },
  };
}

function inspectEntry(entry: ManagedModelEntry): WebGLDebugModelSummary {
  const animationInspection = entry.animation?.inspect();
  const morphInspection = entry.morphControls?.inspect();
  const diagnostics: WebGLDebugModelDiagnostic[] = [
    ...(animationInspection?.diagnostics ?? []).map(mapAnimationDiagnostic),
    ...(morphInspection?.diagnostics ?? []).map(mapMorphDiagnostic),
  ];
  const morphs = morphInspection?.morphs;
  const bones = morphInspection?.bones;
  const prepare: WebGLDebugModelPrepareSummary | undefined =
    entry.prepareLoad || entry.renderWarmup
      ? {
          ...(entry.prepareLoad ? { load: entry.prepareLoad } : {}),
          ...(entry.renderWarmup
            ? {
                renderWarmup:
                  entry.renderWarmup === "complete" ? "complete" : "pending",
              }
            : {}),
        }
      : undefined;
  const attached = entry.controller?.attached ?? false;
  const error = readErrorMessage(entry.error);

  return {
    id: entry.declaration.id,
    sceneId: entry.declaration.sceneId,
    src: entry.declaration.source.src,
    resourceStatus: entry.resource.record.status,
    attached,
    visible: attached && readEffectiveVisibility(entry),
    ...(error ? { error } : {}),
    ...(entry.declaration.timeline ? { timeline: readDebugTimeline(entry) } : {}),
    ...(prepare ? { prepare } : {}),
    clips: entry.animation?.clips() ?? [],
    activeClips: animationInspection?.activeClips ?? [],
    ...(morphs && morphs.length > 0 ? { morphs } : {}),
    ...(bones && bones.length > 0 ? { bones } : {}),
    ...(entry.declaration.effects
      ? { effects: inspectSceneObjectEffectKinds(entry.declaration.effects) }
      : {}),
    ...(entry.declaration.interaction
      ? {
          interaction: inspectSceneObjectInteraction(
            entry.declaration.interaction,
          ),
        }
      : {}),
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
  };
}

function readErrorMessage(error: unknown): string | undefined {
  if (error === undefined || error === null) {
    return undefined;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

function mapAnimationDiagnostic(
  diagnostic: ModelAnimationDiagnostic,
): WebGLDebugModelDiagnostic {
  return {
    kind: diagnostic.kind,
    name: diagnostic.name,
  };
}

function mapMorphDiagnostic(
  diagnostic: ModelMorphDiagnostic,
): WebGLDebugModelDiagnostic {
  return {
    kind: diagnostic.kind,
    name: diagnostic.name,
  };
}

function readDebugTimeline(entry: ManagedModelEntry): {
  id: string;
  progressKey: string;
  active?: boolean;
} {
  const timeline = entry.declaration.timeline;

  if (!timeline) {
    throw new Error("Expected timeline metadata for model debug summary.");
  }

  return {
    id: timeline.id,
    progressKey: timeline.progressKey,
    ...(entry.timelineSnapshot
      ? { active: entry.timelineSnapshot.active }
      : {}),
  };
}

function createManagedModelSceneObject(
  key: string,
  object3D: unknown,
): WebGLSceneObject {
  return {
    key,
    object3D,
    setVisible(visible) {
      setObjectVisible(object3D, visible);
    },
    updateLayout() {},
    dispose() {
      disposeModelSceneObject(object3D);
    },
  };
}

function applyModelTransform(
  object3D: unknown,
  declaration: NormalizedModelDeclaration,
): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  const target = object3D as ModelObject3DLike;
  setTuple3(target.position, declaration.position);
  setTuple3(target.rotation, declaration.rotation);
  setTuple3(target.scale, declaration.scale);
}

function createModelForControls(
  model: unknown,
  scene: unknown,
): { scene: unknown; animations?: unknown } {
  const animations =
    model && typeof model === "object"
      ? (model as { animations?: unknown }).animations
      : undefined;

  return {
    scene,
    ...(animations !== undefined ? { animations } : {}),
  };
}

function unregisterEntry(
  entries: Map<string, ManagedModelEntry>,
  id: string,
): void {
  const entry = entries.get(id);

  if (!entry) {
    return;
  }

  Object.assign(entry, { disposed: true });
  entry.effectController?.dispose();
  entry.animation?.dispose();
  entry.controller?.dispose();
  entry.resource.dispose();
  entries.delete(id);
}

function disposeEntries(entries: Map<string, ManagedModelEntry>): void {
  for (const id of [...entries.keys()]) {
    unregisterEntry(entries, id);
  }
}

function readEffectiveVisibility(entry: ManagedModelEntry): boolean {
  return entry.declaration.visible && (entry.timelineSnapshot?.active ?? true);
}

function readAnimationProgress(
  declaration:
    | NormalizedModelClipScrubDeclaration
    | NormalizedModelClipBlendDeclaration,
  progressSignals: WebGLProgressSignalSource,
): number {
  const progress = readTimelineProgress(declaration.timeline, progressSignals).progress;

  if (!declaration.range) {
    return progress;
  }

  const length = declaration.range.to - declaration.range.from;
  if (length <= 0) {
    return progress >= declaration.range.to ? 1 : 0;
  }

  return clamp01((progress - declaration.range.from) / length);
}

function setObjectVisible(object3D: unknown, visible: boolean): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  (object3D as ModelObject3DLike).visible = visible;
}

function setTuple3(
  target:
    | {
        set?(x: number, y: number, z: number): void;
        x?: number;
        y?: number;
        z?: number;
      }
    | undefined,
  value: WebGLTuple3,
): void {
  if (!target) {
    return;
  }

  if (typeof target.set === "function") {
    target.set(value[0], value[1], value[2]);
    return;
  }

  target.x = value[0];
  target.y = value[1];
  target.z = value[2];
}

function normalizeRequiredString(value: string, label: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return normalized;
}

function normalizeTuple3(
  value: WebGLTuple3 | undefined,
  fallback: WebGLTuple3,
): WebGLTuple3 {
  if (!value) {
    return fallback;
  }

  return [
    normalizeFiniteNumber(value[0], fallback[0]),
    normalizeFiniteNumber(value[1], fallback[1]),
    normalizeFiniteNumber(value[2], fallback[2]),
  ];
}

function normalizeScale(value: number | WebGLTuple3 | undefined): WebGLTuple3 {
  if (value === undefined) {
    return [1, 1, 1];
  }

  if (typeof value === "number") {
    const scale = normalizeFiniteNumber(value, 1);
    return [scale, scale, scale];
  }

  return normalizeTuple3(value, [1, 1, 1]);
}

function normalizeFiniteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function normalizeRange(
  from: number | undefined,
  to: number | undefined,
): { readonly from: number; readonly to: number } {
  return {
    from: clamp01(from ?? 0),
    to: clamp01(to ?? 1),
  };
}

function createModelAnchor(): HTMLElement {
  const createElement = globalThis.document?.createElement;

  if (typeof createElement !== "function") {
    throw new Error(
      "WebGL model registration requires a browser DOM. Call it from a client/browser environment.",
    );
  }

  return createElement.call(globalThis.document, "span") as HTMLElement;
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * clamp01(progress);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}
