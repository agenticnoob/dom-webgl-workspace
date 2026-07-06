import type {
  WebGLSceneObjectEffectSourceKind,
  WebGLSceneObjectPointerState,
} from "../effects/effectAuthoring";
import type {
  WebGLDebugInteractionSummary,
  WebGLFrameInput,
  WebGLTuple3,
} from "../types";

export type ManagedObjectPointerCapabilities = {
  readonly hover: boolean;
  readonly press: boolean;
  readonly click: boolean;
  readonly drag: boolean;
};

export type ManagedHitCandidate = {
  readonly id: string;
  readonly sceneId: string;
  readonly sourceKind: WebGLSceneObjectEffectSourceKind;
  readonly object3D: unknown;
  readonly hitTest: "bounds";
  readonly pickable: boolean;
  readonly pointer: ManagedObjectPointerCapabilities;
};

export type ManagedHitResult = {
  readonly id: string;
  readonly sceneId: string;
  readonly point: WebGLTuple3;
  readonly normal?: WebGLTuple3;
  readonly distance: number;
};

export type ManagedHitTestPass = {
  readonly id: string;
  readonly sceneId: string;
  readonly order: number;
  readonly camera: object;
  readonly viewport?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
};

export type ManagedInteractionDebugSummary = WebGLDebugInteractionSummary;

export type InteractionRouterUpdateInput = {
  readonly input: WebGLFrameInput;
  readonly passes: readonly ManagedHitTestPass[];
  readonly candidates: readonly ManagedHitCandidate[];
  pickManagedObjects(
    pass: ManagedHitTestPass,
    candidates: readonly ManagedHitCandidate[],
  ): ManagedHitResult | undefined;
};

export type InteractionRouterUpdateResult = {
  readonly debug: ManagedInteractionDebugSummary;
  readonly emptySpace: boolean;
};

export type InteractionRouter = {
  update(input: InteractionRouterUpdateInput): InteractionRouterUpdateResult;
  getObjectPointerState(id: string): WebGLSceneObjectPointerState;
  inspect(): ManagedInteractionDebugSummary;
  clearObject(id: string): void;
  dispose(): void;
};

const inactivePointerState: WebGLSceneObjectPointerState = {
  isHovered: false,
  isPressed: false,
  isDragging: false,
  wasClicked: false,
  dragStartX: 0,
  dragStartY: 0,
  dragDeltaX: 0,
  dragDeltaY: 0,
};

export function createInteractionRouter(): InteractionRouter {
  let previousPointerDown = false;
  let pressedObjectId: string | undefined;
  let capturedObjectId: string | undefined;
  let lastClickedObjectId: string | undefined;
  let debug: ManagedInteractionDebugSummary = {};
  const pointerStatesByObjectId = new Map<string, WebGLSceneObjectPointerState>();

  return {
    update(updateInput): InteractionRouterUpdateResult {
      const input = updateInput.input;
      const candidates = updateInput.candidates.filter(isPickableCandidate);
      const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const hit = readActiveHit(updateInput, candidates);
      const hitCandidate = hit ? candidateById.get(hit.id) : undefined;
      const hoveredObjectId = hitCandidate?.pointer.hover ? hitCandidate.id : undefined;
      let clickedObjectId: string | undefined;

      pointerStatesByObjectId.clear();

      if (input.pointer.isDown && !previousPointerDown && hitCandidate) {
        if (canPress(hitCandidate)) {
          pressedObjectId = hitCandidate.id;
        }
        if (hitCandidate.pointer.drag) {
          capturedObjectId = hitCandidate.id;
        }
      }

      if (!input.pointer.isDown && previousPointerDown) {
        const releaseObjectId = capturedObjectId ?? pressedObjectId;
        const releaseCandidate = releaseObjectId
          ? candidateById.get(releaseObjectId)
          : undefined;
        if (releaseObjectId && releaseCandidate?.pointer.click) {
          clickedObjectId = releaseObjectId;
          lastClickedObjectId = releaseObjectId;
        }
        pressedObjectId = undefined;
        capturedObjectId = undefined;
      }

      for (const candidate of candidates) {
        const isCaptured = capturedObjectId === candidate.id;
        const isPressed =
          pressedObjectId === candidate.id ||
          (isCaptured && input.pointer.isDown);
        const candidateHit = hit?.id === candidate.id ? hit : undefined;
        pointerStatesByObjectId.set(
          candidate.id,
          createObjectPointerState({
            input,
            candidate,
            hit: candidateHit,
            isHovered: hoveredObjectId === candidate.id,
            isPressed,
            isDragging: isCaptured && input.pointer.isDragging,
            wasClicked: clickedObjectId === candidate.id,
          }),
        );
      }

      previousPointerDown = input.pointer.isDown;
      debug = createDebugSummary({
        hit,
        hitCandidate,
        hoveredObjectId,
        pressedObjectId,
        capturedObjectId,
        lastClickedObjectId,
      });

      return {
        debug,
        emptySpace: debug.emptySpace === true,
      };
    },
    getObjectPointerState(id): WebGLSceneObjectPointerState {
      return pointerStatesByObjectId.get(id) ?? inactivePointerState;
    },
    inspect(): ManagedInteractionDebugSummary {
      return debug;
    },
    clearObject(id): void {
      pointerStatesByObjectId.delete(id);
      if (pressedObjectId === id) {
        pressedObjectId = undefined;
      }
      if (capturedObjectId === id) {
        capturedObjectId = undefined;
      }
      if (lastClickedObjectId === id) {
        lastClickedObjectId = undefined;
      }
      debug = createDebugSummary({});
    },
    dispose(): void {
      pointerStatesByObjectId.clear();
      previousPointerDown = false;
      pressedObjectId = undefined;
      capturedObjectId = undefined;
      lastClickedObjectId = undefined;
      debug = {};
    },
  };
}

function readActiveHit(
  input: InteractionRouterUpdateInput,
  candidates: readonly ManagedHitCandidate[],
): ManagedHitResult | undefined {
  const orderedPasses = [...input.passes].sort((left, right) => right.order - left.order);

  for (const pass of orderedPasses) {
    if (!isPointerInsidePass(input.input, pass)) {
      continue;
    }

    const passCandidates = candidates.filter(
      (candidate) => candidate.sceneId === pass.sceneId,
    );
    if (passCandidates.length === 0) {
      continue;
    }

    const hit = input.pickManagedObjects(pass, passCandidates);
    if (!hit) {
      continue;
    }

    if (passCandidates.some((candidate) => candidate.id === hit.id)) {
      return hit;
    }
  }

  return undefined;
}

function isPointerInsidePass(
  input: WebGLFrameInput,
  pass: ManagedHitTestPass,
): boolean {
  if (!pass.viewport) {
    return true;
  }

  const pointer = input.pointer;
  return (
    pointer.x >= pass.viewport.x &&
    pointer.x <= pass.viewport.x + pass.viewport.width &&
    pointer.y >= pass.viewport.y &&
    pointer.y <= pass.viewport.y + pass.viewport.height
  );
}

function isPickableCandidate(candidate: ManagedHitCandidate): boolean {
  if (!candidate.pickable) {
    return false;
  }

  return (
    candidate.pointer.hover ||
    candidate.pointer.press ||
    candidate.pointer.click ||
    candidate.pointer.drag
  );
}

function canPress(candidate: ManagedHitCandidate): boolean {
  return candidate.pointer.press || candidate.pointer.click || candidate.pointer.drag;
}

function createObjectPointerState(input: {
  readonly input: WebGLFrameInput;
  readonly candidate: ManagedHitCandidate;
  readonly hit?: ManagedHitResult;
  readonly isHovered: boolean;
  readonly isPressed: boolean;
  readonly isDragging: boolean;
  readonly wasClicked: boolean;
}): WebGLSceneObjectPointerState {
  const pointer = input.input.pointer;
  return {
    isHovered: input.isHovered,
    isPressed: input.isPressed,
    isDragging: input.isDragging,
    wasClicked: input.wasClicked,
    dragStartX: pointer.dragStartX,
    dragStartY: pointer.dragStartY,
    dragDeltaX: pointer.dragDeltaX,
    dragDeltaY: pointer.dragDeltaY,
    ...(input.hit
      ? {
          hit: {
            point: input.hit.point,
            ...(input.hit.normal ? { normal: input.hit.normal } : {}),
            distance: input.hit.distance,
          },
        }
      : {}),
  };
}

function createDebugSummary(input: {
  readonly hit?: ManagedHitResult;
  readonly hitCandidate?: ManagedHitCandidate;
  readonly hoveredObjectId?: string;
  readonly pressedObjectId?: string;
  readonly capturedObjectId?: string;
  readonly lastClickedObjectId?: string;
}): ManagedInteractionDebugSummary {
  return {
    ...(input.hoveredObjectId ? { hoveredObjectId: input.hoveredObjectId } : {}),
    ...(input.pressedObjectId ? { pressedObjectId: input.pressedObjectId } : {}),
    ...(input.capturedObjectId ? { capturedObjectId: input.capturedObjectId } : {}),
    ...(input.lastClickedObjectId
      ? { lastClickedObjectId: input.lastClickedObjectId }
      : {}),
    ...(input.hit && input.hitCandidate
      ? {
          activeHit: {
            objectId: input.hit.id,
            sceneId: input.hit.sceneId,
            sourceKind: input.hitCandidate.sourceKind,
          },
        }
      : { emptySpace: true }),
  };
}
