import { describe, expect, test, vi } from "vitest";

import { createPointerController } from "../../../src/lib/input/pointerController";

describe("createPointerController", () => {
  test("updates pointer position and normalized coordinates on pointer move", () => {
    const target = createTargetElement({
      left: 10,
      top: 20,
      width: 200,
      height: 100,
    });
    const pointer = createPointerController(target);

    dispatchPointer(target, "pointermove", { clientX: 60, clientY: 45 });

    expect(pointer.getState()).toMatchObject({
      x: 50,
      y: 25,
      normalizedX: -0.5,
      normalizedY: 0.5,
      isInside: true,
    });

    pointer.dispose();
  });

  test("updates down state and click count on pointer down and up", () => {
    const target = createTargetElement({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    const pointer = createPointerController(target);

    dispatchPointer(target, "pointerdown", { clientX: 20, clientY: 30 });

    expect(pointer.getState()).toMatchObject({
      x: 20,
      y: 30,
      isDown: true,
      clickCount: 0,
    });

    dispatchPointer(target, "pointerup", { clientX: 20, clientY: 30 });

    expect(pointer.getState()).toMatchObject({
      x: 20,
      y: 30,
      isDown: false,
      clickCount: 1,
    });

    pointer.dispose();
  });

  test("captures pointer button and modifier state for camera gestures", () => {
    const target = createTargetElement({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    const pointer = createPointerController(target);

    dispatchPointer(target, "pointerdown", {
      button: 2,
      buttons: 2,
      altKey: true,
      clientX: 40,
      clientY: 50,
    });

    expect(pointer.getState()).toMatchObject({
      button: "secondary",
      buttons: ["secondary"],
      modifiers: { alt: true, shift: false, ctrl: false, meta: false },
    });

    pointer.dispose();
  });

  test("starts dragging after down and movement and reports drag deltas", () => {
    const target = createTargetElement({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    const pointer = createPointerController(target);

    dispatchPointer(target, "pointerdown", { clientX: 10, clientY: 15 });
    dispatchPointer(target, "pointermove", { clientX: 35, clientY: 40 });

    expect(pointer.getState()).toMatchObject({
      isDown: true,
      isDragging: true,
      dragStartX: 10,
      dragStartY: 15,
      dragDeltaX: 25,
      dragDeltaY: 25,
    });

    pointer.dispose();
  });

  test("stops dragging on pointer up and keeps later moves non-dragging", () => {
    const target = createTargetElement({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    const pointer = createPointerController(target);

    dispatchPointer(target, "pointerdown", { clientX: 10, clientY: 15 });
    dispatchPointer(target, "pointermove", { clientX: 35, clientY: 40 });
    dispatchPointer(target, "pointerup", { clientX: 35, clientY: 40 });

    expect(pointer.getState()).toMatchObject({
      isDown: false,
      isDragging: false,
      dragDeltaX: 25,
      dragDeltaY: 25,
    });

    dispatchPointer(target, "pointermove", { clientX: 50, clientY: 60 });

    expect(pointer.getState()).toMatchObject({
      isDown: false,
      isDragging: false,
      dragDeltaX: 25,
      dragDeltaY: 25,
    });

    pointer.dispose();
  });

  test("returns a pointer state snapshot instead of the mutable controller state", () => {
    const target = createTargetElement({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    const pointer = createPointerController(target);

    dispatchPointer(target, "pointermove", { clientX: 10, clientY: 10 });

    const state = pointer.getState();
    state.x = 999;
    state.isDown = true;
    state.buttons.push("secondary");
    state.modifiers.alt = true;

    expect(pointer.getState()).toMatchObject({
      x: 10,
      isDown: false,
      buttons: [],
      modifiers: { alt: false },
    });

    pointer.dispose();
  });

  test("removes pointer listeners on dispose and can dispose more than once", () => {
    const target = createTargetElement({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    const pointer = createPointerController(target);

    dispatchPointer(target, "pointermove", { clientX: 10, clientY: 10 });
    pointer.dispose();
    pointer.dispose();
    dispatchPointer(target, "pointermove", { clientX: 90, clientY: 90 });

    expect(pointer.getState()).toMatchObject({
      x: 10,
      y: 10,
      normalizedX: -0.8,
      normalizedY: 0.8,
    });
  });

  test("notifies when pointer input changes and stops after dispose", () => {
    const target = createTargetElement({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
    const onPointerInput = vi.fn();
    const pointer = createPointerController({
      coordinateElement: target,
      onPointerInput,
    });

    dispatchPointer(target, "pointermove", { clientX: 10, clientY: 10 });
    dispatchPointer(target, "pointerdown", { clientX: 10, clientY: 10 });
    dispatchPointer(target, "pointerup", { clientX: 10, clientY: 10 });

    expect(onPointerInput).toHaveBeenCalledTimes(3);

    pointer.dispose();
    dispatchPointer(target, "pointermove", { clientX: 30, clientY: 30 });

    expect(onPointerInput).toHaveBeenCalledTimes(3);
  });
});

type RectInit = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function createTargetElement(rect: RectInit): HTMLElement {
  const element = document.createElement("div");

  Object.defineProperty(element, "getBoundingClientRect", {
    value: () => ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      width: rect.width,
      height: rect.height,
      toJSON: () => undefined,
    }),
  });

  return element;
}

function dispatchPointer(
  target: HTMLElement,
  type: "pointermove" | "pointerdown" | "pointerup",
  init: Pick<
    MouseEventInit,
    | "altKey"
    | "button"
    | "buttons"
    | "clientX"
    | "clientY"
    | "ctrlKey"
    | "metaKey"
    | "shiftKey"
  >,
): void {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      altKey: init.altKey,
      button: init.button,
      buttons: init.buttons,
      clientX: init.clientX,
      clientY: init.clientY,
      ctrlKey: init.ctrlKey,
      metaKey: init.metaKey,
      shiftKey: init.shiftKey,
    }),
  );
}
