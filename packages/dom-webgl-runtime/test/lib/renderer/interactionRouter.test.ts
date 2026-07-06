import { describe, expect, test } from "vitest";

import {
  createInteractionRouter,
  type ManagedHitCandidate,
  type ManagedHitResult,
  type ManagedHitTestPass,
} from "../../../src/lib/renderer/interactionRouter";
import type { WebGLFrameInput } from "../../../src/lib/types";

describe("interaction router", () => {
  test("routes only pickable candidates and keeps raw intersections private", () => {
    const router = createInteractionRouter();
    const pickable = createCandidate("box", { hover: true });

    const result = router.update({
      input: createFrameInput({ x: 100, y: 100, isDown: false }),
      passes: [createPass("world", 0)],
      candidates: [
        createCandidate("ignored", { hover: true }, { pickable: false }),
        pickable,
      ],
      pickManagedObjects(_pass, candidates) {
        expect(candidates.map((candidate) => candidate.id)).toEqual(["box"]);
        return createHit("box");
      },
    });

    expect(result.debug).toEqual({
      hoveredObjectId: "box",
      activeHit: { objectId: "box", sceneId: "world", sourceKind: "stage/box" },
    });
    expect("intersection" in result.debug).toBe(false);
    expect(router.getObjectPointerState("box")).toMatchObject({
      isHovered: true,
      isPressed: false,
      wasClicked: false,
    });
  });

  test("honors pass viewport gating and higher order pass priority", () => {
    const router = createInteractionRouter();
    const calls: string[] = [];

    router.update({
      input: createFrameInput({ x: 250, y: 250, isDown: false }),
      passes: [
        createPass("back", 0, { x: 0, y: 0, width: 300, height: 300 }),
        createPass("front", 10, { x: 200, y: 200, width: 300, height: 300 }),
        createPass("outside", 20, { x: 500, y: 500, width: 50, height: 50 }),
      ],
      candidates: [
        createCandidate("back-object", { hover: true }, { sceneId: "back" }),
        createCandidate("front-object", { hover: true }, { sceneId: "front" }),
      ],
      pickManagedObjects(pass, candidates) {
        calls.push(pass.sceneId);
        return candidates[0] ? createHit(candidates[0].id, pass.sceneId) : undefined;
      },
    });

    expect(calls).toEqual(["front"]);
    expect(router.inspect()).toMatchObject({ hoveredObjectId: "front-object" });
  });

  test("captures object drag until release and emits click on release", () => {
    const router = createInteractionRouter();
    const candidate = createCandidate("model", {
      hover: true,
      press: true,
      click: true,
      drag: true,
    });

    router.update({
      input: createFrameInput({ x: 100, y: 100, isDown: true }),
      passes: [createPass("world", 0)],
      candidates: [candidate],
      pickManagedObjects() {
        return createHit("model");
      },
    });
    router.update({
      input: createFrameInput({
        x: 500,
        y: 500,
        isDown: true,
        isDragging: true,
        dragStartX: 100,
        dragStartY: 100,
        dragDeltaX: 400,
        dragDeltaY: 400,
      }),
      passes: [createPass("world", 0)],
      candidates: [candidate],
      pickManagedObjects() {
        return undefined;
      },
    });
    router.update({
      input: createFrameInput({
        x: 500,
        y: 500,
        isDown: false,
        clickCount: 1,
        dragStartX: 100,
        dragStartY: 100,
        dragDeltaX: 400,
        dragDeltaY: 400,
      }),
      passes: [createPass("world", 0)],
      candidates: [candidate],
      pickManagedObjects() {
        return undefined;
      },
    });

    expect(router.inspect()).toMatchObject({
      lastClickedObjectId: "model",
    });
    expect(router.getObjectPointerState("model")).toMatchObject({
      isHovered: false,
      isPressed: false,
      isDragging: false,
      wasClicked: true,
      dragDeltaX: 400,
      dragDeltaY: 400,
    });
  });

  test("reports empty space when no object is hit", () => {
    const router = createInteractionRouter();

    expect(
      router.update({
        input: createFrameInput({ x: 20, y: 20, isDown: false }),
        passes: [createPass("world", 0)],
        candidates: [createCandidate("box", { hover: true })],
        pickManagedObjects() {
          return undefined;
        },
      }).debug,
    ).toEqual({ emptySpace: true });
  });
});

function createCandidate(
  id: string,
  pointer: Partial<ManagedHitCandidate["pointer"]>,
  options: {
    readonly sceneId?: string;
    readonly sourceKind?: ManagedHitCandidate["sourceKind"];
    readonly pickable?: boolean;
  } = {},
): ManagedHitCandidate {
  return {
    id,
    sceneId: options.sceneId ?? "world",
    sourceKind: options.sourceKind ?? "stage/box",
    object3D: {},
    hitTest: "bounds",
    pickable: options.pickable ?? true,
    pointer: {
      hover: false,
      press: false,
      click: false,
      drag: false,
      ...pointer,
    },
  };
}

function createPass(
  sceneId: string,
  order: number,
  viewport?: ManagedHitTestPass["viewport"],
): ManagedHitTestPass {
  return {
    id: `${sceneId}.pass`,
    sceneId,
    order,
    camera: {},
    ...(viewport ? { viewport } : {}),
  };
}

function createHit(id: string, sceneId = "world"): ManagedHitResult {
  return {
    id,
    sceneId,
    point: [1, 2, 3],
    distance: 10,
  };
}

function createFrameInput(
  pointer: Partial<WebGLFrameInput["pointer"]>,
): WebGLFrameInput {
  return {
    time: 100,
    delta: 16,
    scroll: {
      mode: "page",
      pageProgress: 0,
      direction: 0,
      velocity: 0,
    },
    pointer: {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: true,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
      ...pointer,
    },
  };
}
